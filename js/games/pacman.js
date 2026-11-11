import { fitCanvas, loop, noScroll } from '../util.js';

// The maze: # wall, . dot, o power pellet, - door of the ghost house, _ inside of a wall block, space = empty corridor.
// The corridor in row 9 runs off both edges: that is the tunnel.
export const MAP = [
  '###################',
  '#........#........#',
  '#o##.###.#.###.##o#',
  '#.................#',
  '#.##.#.#####.#.##.#',
  '#....#...#...#....#',
  '####.### # ###.####',
  '#__#.#       #.#__#',
  '####.# ##-## #.####',
  '    .  #   #  .    ',
  '####.# ##### #.####',
  '#__#.#       #.#__#',
  '####.# ##### #.####',
  '#........#........#',
  '#.##.###.#.###.##.#',
  '#o.#...........#.o#',
  '##.#.#.#####.#.#.##',
  '#....#...#...#....#',
  '#.######.#.######.#',
  '#.................#',
  '###################',
];
const COLS = 19, ROWS = 21, TUNNEL = 9;
const UP = { dx: 0, dy: -1 }, LEFT = { dx: -1, dy: 0 }, DOWN = { dx: 0, dy: 1 }, RIGHT = { dx: 1, dy: 0 };
const DIRS = [UP, LEFT, DOWN, RIGHT];                    // also the order in which ghosts settle ties
const NAMED = { up: UP, left: LEFT, down: DOWN, right: RIGHT };
const HOME = { x: 9, y: 9 }, DOOR = { x: 9, y: 7 };      // the middle of the ghost house and the tile just outside its door
const PAC_AT = { x: 9, y: 15 }, FRUIT_AT = { x: 9, y: 11 };
const STEP = 1 / 120;                                    // the game advances in fixed small steps
const SCHEDULE = [7, 20, 7, 20, 5, 20, 5];               // seconds of scatter, chase, scatter, ... and then chase for good
const FRUIT_POINTS = [100, 300, 500, 700, 1000, 2000, 3000, 5000];
const EXTRA_LIFE_AT = 10000;
// corner: where the ghost retreats to in scatter mode. slot: its place inside the house (none = starts outside).
// It leaves the house after `wait` seconds, or sooner once `dots` dots have been eaten.
const GHOSTS = [
  { name: 'blinky', color: '#ef4444', corner: { x: 17, y: -2 } },
  { name: 'pinky', color: '#f9a8d4', corner: { x: 1, y: -2 }, slot: 9, wait: 0.6, dots: 0 },
  { name: 'inky', color: '#22d3ee', corner: { x: 18, y: 22 }, slot: 8, wait: 5, dots: 20 },
  { name: 'clyde', color: '#fb923c', corner: { x: 0, y: 22 }, slot: 10, wait: 10, dots: 45 },
];
const wrap = (x) => (x + COLS) % COLS;
// Speeds in tiles per second: level 1, levels 2-4, level 5 and up.
export function speeds(level) {
  const k = level === 1 ? 0 : level < 5 ? 1 : 2;
  return { pac: [6.4, 7.2, 8][k], ghost: [5.6, 6.5, 7.4][k], fright: [3.8, 4.2, 4.6][k], tunnel: [3.2, 3.6, 4][k], eyes: 14 };
}
export const frightTime = (level) => Math.max(1.5, 7 - level); // seconds the ghosts stay blue: 6 on level 1

// ---------------------------------------------------------------- the rules (nothing is drawn in this part)
// Everybody moves from the middle of one tile to the middle of the next: x, y is the tile being left,
// dx, dy the direction and t (0..1) how far along the way they are.
export function createPacman(random = Math.random) {
  const s = { tiles: [], pac: null, ghosts: [], want: null, phase: 'ready', phaseT: 0, score: 0, lives: 3, level: 1, dotsLeft: 0, dotsTotal: 0, mode: 'scatter', frightT: 0, fruit: 0, popups: [], time: 0 };
  let sp, modeIx, modeT, houseT, dotsEaten, combo, bonusGiven = false, afterDeath;

  const tile = (x, y) => (y < 0 || y >= ROWS ? '#' : s.tiles[y][wrap(x)]);
  const open = (x, y) => { const c = tile(x, y); return c !== '#' && c !== '-' && c !== '_'; };
  s.open = open;

  function placeActors() {
    s.pac = { x: PAC_AT.x, y: PAC_AT.y, dx: -1, dy: 0, t: 0, face: LEFT, ox: 0, oy: 0 }; // sets off to the left by himself
    s.want = null;
    s.ghosts = GHOSTS.map((d) => {
      const inside = d.slot !== undefined;
      return { ...d, x: DOOR.x, y: DOOR.y, dx: inside ? 0 : -1, dy: 0, t: 0, hx: inside ? d.slot : DOOR.x, hy: inside ? HOME.y : DOOR.y, state: inside ? 'home' : 'out', fright: false, eyes: false };
    });
    s.frightT = 0; s.fruit = 0; s.mode = 'scatter'; modeIx = 0; modeT = 0; houseT = 0;
  }
  function loadLevel() {
    s.tiles = MAP.map((row) => row.split(''));
    s.tiles[PAC_AT.y][PAC_AT.x] = ' '; // no dot under Pac-Man's starting place
    s.dotsTotal = s.dotsLeft = s.tiles.flat().filter((c) => c === '.' || c === 'o').length;
    dotsEaten = 0; afterDeath = false; sp = speeds(s.level);
    placeActors();
    s.phase = 'ready'; s.phaseT = 2;
  }
  // Turn around on the spot: the tile ahead becomes the tile being left.
  function reverse(a) {
    if (!a.dx && !a.dy) return;
    a.x = wrap(a.x + a.dx); a.y += a.dy; a.t = 1 - a.t; a.dx = -a.dx; a.dy = -a.dy;
  }
  function add(points) {
    s.score += points;
    if (!bonusGiven && s.score >= EXTRA_LIFE_AT) { bonusGiven = true; s.lives++; }
  }
  function eat(x, y) {
    const c = s.tiles[y][x];
    if (c !== '.' && c !== 'o') return;
    s.tiles[y][x] = ' '; s.dotsLeft--; dotsEaten++;
    add(c === 'o' ? 50 : 10);
    if (c === 'o') { // power pellet: the ghosts turn blue and run
      combo = 0; s.frightT = frightTime(s.level);
      for (const g of s.ghosts) if (!g.eyes) { g.fright = true; if (g.state === 'out') reverse(g); }
    }
    if (dotsEaten === Math.floor(s.dotsTotal / 3) || dotsEaten === Math.floor(s.dotsTotal * 2 / 3)) s.fruit = 9.5;
    if (!s.dotsLeft) { s.phase = 'clear'; s.phaseT = 2; }
  }

  function movePac(dt) {
    const p = s.pac, w = s.want;
    if (w && (p.dx || p.dy) && (w.dx !== p.dx || w.dy !== p.dy)) {
      if (w.dx === -p.dx && w.dy === -p.dy) { reverse(p); p.face = w; } // turning back works anywhere
      else if (p.t <= 0.3 && open(p.x + w.dx, p.y + w.dy)) {
        // The turn was pressed a moment too late: take the corner anyway. ox, oy smooth out the small jump.
        const fx = p.x + p.dx * p.t, fy = p.y + p.dy * p.t;
        p.dx = w.dx; p.dy = w.dy; p.face = w;
        p.ox += fx - (p.x + p.dx * p.t); p.oy += fy - (p.y + p.dy * p.t);
      }
    }
    if (!p.dx && !p.dy) { // standing in the middle of a tile
      if (!w || !open(p.x + w.dx, p.y + w.dy)) return;
      p.dx = w.dx; p.dy = w.dy; p.face = w;
    }
    p.t += sp.pac * dt;
    while (p.t >= 1) {
      p.x = wrap(p.x + p.dx); p.y += p.dy; p.t -= 1;
      eat(p.x, p.y);
      if (s.phase !== 'play') { p.t = 0; return; }
      if (s.want && open(p.x + s.want.dx, p.y + s.want.dy)) { p.dx = s.want.dx; p.dy = s.want.dy; p.face = s.want; }
      else if (!open(p.x + p.dx, p.y + p.dy)) { p.dx = p.dy = 0; p.t = 0; }
    }
  }

  // The tile a ghost is heading for. Each ghost hunts in its own way.
  function target(g) {
    if (g.eyes) return DOOR;
    if (s.mode === 'scatter') return g.corner;
    const p = s.pac, f = p.face;
    if (g.name === 'pinky') return { x: p.x + f.dx * 4, y: p.y + f.dy * 4 };          // aims ahead of Pac-Man
    if (g.name === 'inky') { const b = s.ghosts[0]; return { x: (p.x + f.dx * 2) * 2 - b.x, y: (p.y + f.dy * 2) * 2 - b.y }; } // pincer with Blinky
    if (g.name === 'clyde') return (g.x - p.x) ** 2 + (g.y - p.y) ** 2 > 36 ? p : g.corner; // loses his nerve up close
    return p;                                                                              // Blinky simply chases
  }
  // At the middle of a tile a ghost picks its next step; it never turns back on its own.
  function choose(g) {
    const opts = DIRS.filter((d) => !(d.dx === -g.dx && d.dy === -g.dy) && open(g.x + d.dx, g.y + d.dy));
    let pick = { dx: -g.dx, dy: -g.dy };
    if (opts.length && g.fright && !g.eyes) pick = opts[Math.floor(random() * opts.length)];
    else if (opts.length) {
      const t = target(g);
      let best = Infinity;
      for (const d of opts) { const far = (g.x + d.dx - t.x) ** 2 + (g.y + d.dy - t.y) ** 2; if (far < best) { best = far; pick = d; } }
    }
    g.dx = pick.dx; g.dy = pick.dy;
  }
  function moveGhost(g, dt) {
    if (g.state === 'home') { // waiting inside the house, bobbing up and down
      g.hy = HOME.y + Math.sin(s.time * 7 + g.slot) * 0.2;
      if (houseT >= g.wait || (!afterDeath && dotsEaten >= g.dots)) g.state = 'leaving';
      return;
    }
    if (g.state === 'leaving') { // to the middle of the house, then up through the door
      const v = 3.6 * dt;
      if (g.hx !== HOME.x) g.hx = Math.abs(HOME.x - g.hx) <= v ? HOME.x : g.hx + Math.sign(HOME.x - g.hx) * v;
      else if (g.hy - v > DOOR.y) g.hy -= v;
      else { g.state = 'out'; g.x = DOOR.x; g.y = DOOR.y; g.t = 0; g.dy = 0; g.dx = random() < 0.5 ? -1 : 1; }
      return;
    }
    if (g.state === 'entering') { // a pair of eyes going back in to get a new body
      g.hy += 7 * dt;
      if (g.hy >= HOME.y) { g.hy = HOME.y; g.eyes = false; g.fright = false; g.state = 'leaving'; }
      return;
    }
    const inTunnel = g.y === TUNNEL && (g.x < 4 || g.x > COLS - 5);
    g.t += (g.eyes ? sp.eyes : inTunnel ? sp.tunnel : g.fright ? sp.fright : sp.ghost) * dt;
    while (g.t >= 1) {
      g.x = wrap(g.x + g.dx); g.y += g.dy; g.t -= 1;
      if (g.eyes && g.x === DOOR.x && g.y === DOOR.y) { g.state = 'entering'; g.hx = DOOR.x; g.hy = DOOR.y; g.t = 0; return; }
      choose(g);
    }
  }
  function tickModes(dt) {
    if (s.frightT > 0) { // the scatter / chase clock stands still while the ghosts are blue
      s.frightT -= dt;
      if (s.frightT <= 0) { s.frightT = 0; for (const g of s.ghosts) g.fright = false; }
      return;
    }
    if (modeIx >= SCHEDULE.length) return;
    modeT += dt;
    if (modeT < SCHEDULE[modeIx]) return;
    modeT = 0; modeIx++; s.mode = modeIx % 2 ? 'chase' : 'scatter';
    for (const g of s.ghosts) if (g.state === 'out' && !g.eyes) reverse(g);
  }
  function meetGhosts() {
    const p = s.pac, px = p.x + p.dx * p.t, py = p.y + p.dy * p.t;
    for (const g of s.ghosts) {
      if (g.state !== 'out' || g.eyes) continue;
      const gx = g.x + g.dx * g.t, gy = g.y + g.dy * g.t;
      let dx = Math.abs(gx - px); dx = Math.min(dx, COLS - dx);
      if (dx * dx + (gy - py) ** 2 > 0.3) continue; // closer than about half a tile
      if (!g.fright) { s.phase = 'dying'; s.phaseT = 1.6; return; }
      const points = 200 << combo; combo = Math.min(3, combo + 1); // 200, 400, 800, 1600
      add(points); g.fright = false; g.eyes = true;
      s.popups.push({ x: gx, y: gy, text: String(points), t: 0.9 });
      s.phase = 'eat'; s.phaseT = 0.4;
      return;
    }
  }

  s.pos = (a) => (a.state && a.state !== 'out' ? { x: a.hx, y: a.hy } : { x: a.x + a.dx * a.t + (a.ox || 0), y: a.y + a.dy * a.t + (a.oy || 0) });
  s.turn = (name) => { if (NAMED[name]) s.want = NAMED[name]; };
  s.step = (dt) => {
    s.time += dt;
    s.popups = s.popups.filter((p) => (p.t -= dt) > 0);
    s.pac.ox *= 0.82; s.pac.oy *= 0.82;
    if (s.phase === 'over') return;
    if (s.phase !== 'play') { // a short break: get ready, ghost eaten, Pac-Man caught, level cleared
      s.phaseT -= dt;
      if (s.phaseT > 0) return;
      if (s.phase === 'clear') { s.level++; loadLevel(); }
      else if (s.phase !== 'dying') s.phase = 'play';
      else if (--s.lives <= 0) s.phase = 'over';
      else { placeActors(); afterDeath = true; s.phase = 'ready'; s.phaseT = 1.5; }
      return;
    }
    tickModes(dt); houseT += dt;
    if (s.fruit > 0) {
      s.fruit -= dt;
      const p = s.pos(s.pac);
      if (Math.abs(p.x - FRUIT_AT.x) < 0.6 && Math.abs(p.y - FRUIT_AT.y) < 0.6) {
        const points = FRUIT_POINTS[Math.min(s.level, FRUIT_POINTS.length) - 1];
        add(points); s.fruit = 0; s.popups.push({ x: FRUIT_AT.x, y: FRUIT_AT.y, text: String(points), t: 1.2 });
      }
    }
    movePac(dt);
    if (s.phase !== 'play') return;
    for (const g of s.ghosts) moveGhost(g, dt);
    meetGhosts();
  };
  loadLevel();
  return s;
}

// ---------------------------------------------------------------- the game on screen
const KEYS = { ArrowUp: 'up', w: 'up', ArrowLeft: 'left', a: 'left', ArrowDown: 'down', s: 'down', ArrowRight: 'right', d: 'right' };
const HUD = 1.4, BG = '#0a0c14', TAU = Math.PI * 2;
const FRUIT_COLORS = ['#ef4444', '#fb7185', '#fb923c', '#4ade80', '#a3e635', '#38bdf8', '#facc15', '#c084fc'];

export default {
  id: 'pacman', name: 'Pac-Man', icon: 'ghost', color: '#facc15', tag: 'Arcade',
  desc: 'Clear the maze of dots and stay away from the four ghosts. Power pellets turn the tables.',
  help: 'Arrow keys / WASD or swipe to steer · P to pause',
  create(stage, api) {
    stage.innerHTML = `
      <canvas class="pacman" id="pm-c"></canvas>
      <div class="pm-swipe touch-only" id="pm-swipe"><i data-lucide="move"></i> Swipe here or on the maze</div>`;
    const cv = stage.querySelector('#pm-c'), ctx = cv.getContext('2d'), zone = stage.querySelector('#pm-swipe');
    const font = getComputedStyle(document.body).fontFamily;
    const game = createPacman();
    let W = 1, ts = 1, walls = null, wallsLit = null;
    let state = 'intro', acc = 0, endTimer = null, shown = '';

    // The walls never change, so they are painted once into a hidden picture and copied every frame.
    function paintWalls(color) {
      const c = document.createElement('canvas');
      c.width = cv.width; c.height = Math.ceil(ROWS * ts);
      const g = c.getContext('2d'), path = new Path2D(), isWall = (x, y) => y >= 0 && y < ROWS && x >= 0 && x < COLS && MAP[y][x] === '#';
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        if (!isWall(x, y)) continue;
        const cx = (x + 0.5) * ts, cy = (y + 0.5) * ts;
        let joined = isWall(x - 1, y) || isWall(x, y - 1);
        if (isWall(x + 1, y)) { path.moveTo(cx, cy); path.lineTo(cx + ts, cy); joined = true; }
        if (isWall(x, y + 1)) { path.moveTo(cx, cy); path.lineTo(cx, cy + ts); joined = true; }
        if (!joined) { path.moveTo(cx, cy); path.lineTo(cx + 0.01, cy); }
      }
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = color; g.lineWidth = ts * 0.58; g.stroke(path);
      g.strokeStyle = BG; g.lineWidth = ts * 0.32; g.stroke(path);
      g.fillStyle = '#f9a8d4'; g.fillRect(DOOR.x * ts + ts * 0.02, (DOOR.y + 1.42) * ts, ts * 0.96, ts * 0.16); // the door
      return c;
    }
    const at = (v) => (v + 0.5) * ts;

    function drawPac(x, y) {
      const p = game.pac, r = ts * 0.56, f = p.face;
      const ang = f === RIGHT ? 0 : f === DOWN ? TAU / 4 : f === LEFT ? TAU / 2 : -TAU / 4;
      let mouth = (p.dx || p.dy) && game.phase === 'play' ? 0.04 + 0.22 * Math.abs(Math.sin(game.time * 16)) : 0.12;
      if (game.phase === 'dying') { // folds up and disappears
        const k = Math.min(1, Math.max(0, (1.25 - game.phaseT) / 1.0));
        if (k >= 1) return;
        mouth = 0.12 + (1 - 0.12) * k;
      }
      ctx.fillStyle = '#fde047';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r, ang + mouth * Math.PI, ang - mouth * Math.PI + TAU); ctx.closePath(); ctx.fill();
    }
    function drawGhost(g, x, y) {
      const r = ts * 0.56, look = g.state === 'out' ? g : { dx: 0, dy: g.state === 'entering' ? 1 : -1 };
      if (!g.eyes) {
        const ending = game.frightT > 0 && game.frightT < 1.8 && Math.floor(game.frightT * 5) % 2 === 0;
        ctx.fillStyle = g.fright ? (ending ? '#e5e7eb' : '#2545d6') : g.color;
        const top = y - r * 0.08, bottom = y + r * 0.98, wob = Math.floor(game.time * 9) % 2;
        ctx.beginPath(); ctx.arc(x, top, r, Math.PI, 0); ctx.lineTo(x + r, bottom);
        for (let i = 0; i < 3; i++) { // three little feet that wiggle
          const x1 = x + r - (i + 0.5) * (r * 2 / 3), x2 = x + r - (i + 1) * (r * 2 / 3);
          ctx.lineTo(x1, bottom - r * (wob ? 0.3 : 0.16)); ctx.lineTo(x2, bottom);
        }
        ctx.closePath(); ctx.fill();
        if (g.fright) { // a worried face
          ctx.fillStyle = ending ? '#dc2626' : '#fbcfe8';
          for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(x + sx * r * 0.34, y - r * 0.18, r * 0.13, 0, TAU); ctx.fill(); }
          ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = Math.max(1, r * 0.11); ctx.beginPath();
          for (let i = 0; i <= 6; i++) ctx.lineTo(x - r * 0.54 + i * r * 0.18, y + r * (i % 2 ? 0.3 : 0.46));
          ctx.stroke();
          return;
        }
      }
      for (const sx of [-1, 1]) { // eyes that look where the ghost is going
        const ex = x + sx * r * 0.36 + look.dx * r * 0.12, ey = y - r * 0.2 + look.dy * r * 0.14;
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, ey, r * 0.25, r * 0.31, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#1e3a8a'; ctx.beginPath(); ctx.arc(ex + look.dx * r * 0.12, ey + look.dy * r * 0.14, r * 0.14, 0, TAU); ctx.fill();
      }
    }
    function drawFruit(x, y, level, size) {
      ctx.strokeStyle = '#65a30d'; ctx.lineWidth = Math.max(1, size * 0.1);
      ctx.beginPath(); ctx.moveTo(x, y - size * 0.25); ctx.quadraticCurveTo(x + size * 0.1, y - size * 0.7, x + size * 0.45, y - size * 0.75); ctx.stroke();
      ctx.fillStyle = FRUIT_COLORS[(level - 1) % FRUIT_COLORS.length];
      ctx.beginPath(); ctx.arc(x, y + size * 0.12, size * 0.52, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(x - size * 0.18, y - size * 0.06, size * 0.13, 0, TAU); ctx.fill();
    }
    function text(str, x, y, size, color) {
      ctx.font = `800 ${size}px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = size * 0.28; ctx.lineJoin = 'round'; ctx.strokeStyle = BG; ctx.strokeText(str, x, y);
      ctx.fillStyle = color; ctx.fillText(str, x, y);
    }
    // Draws something at its place and, near the tunnel, once more on the other side of the maze.
    function twice(x, fn) { fn(at(x)); if (x < 0.5) fn(at(x + COLS)); else if (x > COLS - 1.5) fn(at(x - COLS)); }

    function draw() {
      ctx.fillStyle = BG; ctx.fillRect(0, 0, cv.width, cv.height);
      if (!walls) return;
      const lit = game.phase === 'clear' && game.phaseT < 1.5 && Math.floor(game.phaseT * 4) % 2 === 0;
      ctx.drawImage(lit ? wallsLit : walls, 0, 0);
      const blink = Math.floor(game.time * 4) % 2 === 0;
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const c = game.tiles[y][x];
        if (c === '.') { ctx.fillStyle = '#fbcfa0'; ctx.beginPath(); ctx.arc(at(x), at(y), ts * 0.11, 0, TAU); ctx.fill(); }
        else if (c === 'o' && (blink || game.phase !== 'play')) { ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.arc(at(x), at(y), ts * 0.3, 0, TAU); ctx.fill(); }
      }
      if (game.fruit > 0) drawFruit(at(FRUIT_AT.x), at(FRUIT_AT.y), game.level, ts * 0.62);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, cv.width, ROWS * ts); ctx.clip();
      const hideGhosts = game.phase === 'clear' || (game.phase === 'dying' && game.phaseT < 1.25);
      if (!hideGhosts) for (const g of game.ghosts) { const p = game.pos(g); twice(p.x, (px) => drawGhost(g, px, at(p.y))); }
      if (game.phase !== 'over') { const p = game.pos(game.pac); twice(p.x, (px) => drawPac(px, at(p.y))); }
      ctx.restore();
      for (const p of game.popups) text(p.text, at(p.x), at(p.y) - (0.9 - Math.min(0.9, p.t)) * ts * 0.5, ts * 0.62, '#67e8f9');
      if (game.phase === 'ready' && state !== 'intro') text('READY!', at(FRUIT_AT.x), at(FRUIT_AT.y), ts * 0.86, '#fde047');
      if (game.phase === 'over') text('GAME OVER', at(FRUIT_AT.x), at(FRUIT_AT.y), ts * 0.86, '#f87171');
      // below the maze: spare lives on the left, the level on the right
      const hy = (ROWS + HUD / 2) * ts;
      ctx.fillStyle = '#fde047';
      for (let i = 0; i < Math.min(game.lives - 1, 6); i++) {
        const lx = ts * (0.9 + i * 1.25);
        ctx.beginPath(); ctx.moveTo(lx, hy); ctx.arc(lx, hy, ts * 0.42, Math.PI * 1.2, Math.PI * 0.8 + TAU); ctx.closePath(); ctx.fill();
      }
      drawFruit(cv.width - ts * 0.8, hy, game.level, ts * 0.42);
      ctx.font = `700 ${ts * 0.56}px ${font}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#a1a1aa';
      ctx.fillText(`LEVEL ${game.level}`, cv.width - ts * 1.5, hy + ts * 0.03);
    }

    function frame(dt) {
      if (state === 'play') {
        acc += dt;
        for (; acc >= STEP; acc -= STEP) game.step(STEP);
        if (game.phase === 'over') {
          state = 'over';
          endTimer = setTimeout(() => api.finish(game.score, { text: `Score: ${game.score} · level ${game.level}` }), 1300);
        }
      }
      const line = `${game.score}|${game.level}|${game.lives}`;
      if (line !== shown) {
        shown = line; api.score(game.score);
        api.status(`Level ${game.level} · ${game.lives} ${game.lives === 1 ? 'life' : 'lives'}`);
      }
      draw();
    }
    function pause() {
      if (state !== 'play') return;
      state = 'paused';
      api.overlay({ title: 'Paused', text: 'Enter or Space to continue', icon: 'pause', button: 'Resume', onClick: () => { state = 'play'; } });
    }

    // Swiping, on the maze or on the pad under it. The turn is taken as soon as the finger has moved far
    // enough, without waiting for it to lift, so one long drag can hold several turns.
    let sx = 0, sy = 0, swiping = false;
    const onDown = (e) => { swiping = true; sx = e.clientX; sy = e.clientY; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not vital */ } };
    const onMove = (e) => {
      if (!swiping || state !== 'play') return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 14) return;
      game.turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
      sx = e.clientX; sy = e.clientY;
    };
    const onUp = () => { swiping = false; };
    for (const el of [cv, zone]) {
      el.addEventListener('pointerdown', onDown);
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
    }
    noScroll(cv, zone);
    const onHide = () => { if (document.hidden) pause(); };
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', onHide);

    const stopFit = fitCanvas(cv, (w) => { W = w; ts = W / COLS; walls = paintWalls('#2f5bea'); wallsLit = paintWalls('#e5e7eb'); draw(); });
    const stopLoop = loop(frame);
    api.overlay({ title: 'Pac-Man', text: 'Eat every dot. Steer with the arrow keys, WASD or by swiping.', icon: 'play', button: 'Start', onClick: () => { state = 'play'; } });

    return {
      key(e) {
        if (e.key === 'p') { pause(); return true; }
        const d = KEYS[e.key];
        if (!d) return;
        if (state === 'play') game.turn(d);
        return true;
      },
      destroy() {
        stopFit(); stopLoop(); clearTimeout(endTimer);
        window.removeEventListener('blur', pause);
        document.removeEventListener('visibilitychange', onHide);
      },
    };
  },
};
