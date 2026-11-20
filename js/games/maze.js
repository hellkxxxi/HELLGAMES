import { fitCanvas, loop, noScroll } from '../util.js';

// ---------------------------------------------------------------- the rules (nothing is drawn here)
// A maze is a grid of cells. `open[i]` says in which directions cell i has no wall: the sum of
// 1 (up), 2 (right), 4 (down) and 8 (left).
export const DIRS = { up: { bit: 1, dx: 0, dy: -1, back: 4 }, right: { bit: 2, dx: 1, dy: 0, back: 8 }, down: { bit: 4, dx: 0, dy: 1, back: 1 }, left: { bit: 8, dx: -1, dy: 0, back: 2 } };
export const SIZES = { small: [10, 10], medium: [16, 16], large: [24, 24] };

// Digs a maze in which exactly one way leads from any cell to any other. Mostly it digs on from the
// cell it has just reached, which makes winding corridors; now and then it starts a side passage from
// a cell it passed long ago, which makes forks. BRANCHY is how often it does the latter.
const BRANCHY = 0.1;
export function makeMaze(cols, rows, rnd = Math.random) {
  const open = new Uint8Array(cols * rows), seen = new Uint8Array(cols * rows), live = [0]; // live: cells that may still have a wall to dig through
  seen[0] = 1;
  while (live.length) {
    const k = rnd() < BRANCHY ? Math.floor(rnd() * live.length) : live.length - 1;
    const at = live[k], x = at % cols, y = Math.floor(at / cols);
    const ways = Object.values(DIRS).filter((d) => x + d.dx >= 0 && x + d.dx < cols && y + d.dy >= 0 && y + d.dy < rows && !seen[at + d.dx + d.dy * cols]);
    if (!ways.length) { live.splice(k, 1); continue; }
    const d = ways[Math.floor(rnd() * ways.length)], to = at + d.dx + d.dy * cols;
    open[at] |= d.bit; open[to] |= d.back; seen[to] = 1; live.push(to);
  }
  return { cols, rows, open, start: 0, exit: cols * rows - 1 };
}
// One move: from `at` in the direction `dir`, on along the corridor and round its bends, until there is
// a choice to make, a dead end or the exit. Answers the cells passed, the last one being where the move ends.
export function walk(maze, at, dir) {
  const path = [];
  let d = DIRS[dir];
  while (d && maze.open[at] & d.bit) {
    at += d.dx + d.dy * maze.cols; path.push(at);
    if (at === maze.exit) break;
    const onward = Object.values(DIRS).filter((n) => n.bit !== d.back && maze.open[at] & n.bit);
    d = onward.length === 1 ? onward[0] : null; // exactly one way on: keep going
  }
  return path;
}
// The way from one cell to another, as a list of cells without the first.
export function solve(maze, from = maze.start, to = maze.exit) {
  const before = new Int32Array(maze.cols * maze.rows).fill(-1), queue = [from];
  before[from] = from;
  for (let k = 0; k < queue.length && before[to] < 0; k++) {
    const at = queue[k];
    for (const d of Object.values(DIRS)) { const next = at + d.dx + d.dy * maze.cols; if (maze.open[at] & d.bit && before[next] < 0) { before[next] = at; queue.push(next); } }
  }
  const path = [];
  for (let at = to; at !== from; at = before[at]) path.unshift(at);
  return path;
}

// ---------------------------------------------------------------- the game on screen
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const SPEED = 26; // cells a second while the devil runs down a corridor

export default {
  id: 'maze', name: 'Labyrinth', icon: 'route', color: '#a3e635', tag: 'Puzzle', since: '1.1',
  desc: 'Find the way out of a maze that is new every time. One push and the devil runs to the next fork.',
  help: 'Arrow keys, W A S D or a swipe: the devil runs on until the way forks · the clock starts with the first move · the portal is the way out',
  scoreLabel: 'Time', lowerBetter: true, swipe: true,
  format: clock,
  variants: { small: 'Small', medium: 'Medium', large: 'Large' },
  create(stage, api) {
    stage.innerHTML = `
      <div class="mn-top"><div class="seg" id="mz-size">${Object.entries(this.variants).map(([id, name]) => `<button data-s="${id}">${name}</button>`).join('')}</div></div>
      <canvas class="maze" id="mz-c"></canvas>`;
    const cv = stage.querySelector('#mz-c'), ctx = cv.getContext('2d');
    const sizeBtns = [...stage.querySelectorAll('#mz-size button')];
    let W = 1, H = 1, maze, at, pos, route = [], been, moves = 0, t0 = 0, done = false, queued = null, ticker = null;

    const xy = (cell) => [cell % maze.cols, Math.floor(cell / maze.cols)];
    function reset() {
      api.hideOverlay(); clearInterval(ticker);
      const size = SIZES[api.variant()] ? api.variant() : 'small';
      maze = makeMaze(...SIZES[size]);
      at = maze.start; pos = xy(at); route = []; been = new Uint8Array(maze.open.length); been[at] = 1;
      moves = 0; t0 = 0; done = false; queued = null;
      sizeBtns.forEach((b) => b.classList.toggle('on', b.dataset.s === size));
      api.score(0); api.status(`${maze.cols} × ${maze.rows} cells`);
    }
    function go(dir) {
      if (done) return;
      if (route.length) { queued = dir; return; } // still running: the push is kept for the next fork
      const path = walk(maze, at, dir);
      if (!path.length) return;
      if (!t0) { t0 = performance.now(); ticker = setInterval(() => api.score(Math.floor((performance.now() - t0) / 1000)), 250); }
      moves++; route = path;
      api.status(`${moves} move${moves === 1 ? '' : 's'}`);
    }
    function arrive() {
      if (at !== maze.exit) { if (queued) { const dir = queued; queued = null; go(dir); } return; }
      done = true; clearInterval(ticker);
      const seconds = Math.max(1, Math.round((performance.now() - t0) / 1000));
      api.score(seconds);
      api.finish(seconds, { endTitle: 'You are out', title: 'You are out', text: `${clock(seconds)} · ${moves} moves`, icon: 'door-open' });
    }

    function draw() {
      const cell = Math.min(W / maze.cols, H / maze.rows), ox = (W - cell * maze.cols) / 2, oy = (H - cell * maze.rows) / 2, t = performance.now() / 1000;
      const mid = (c) => [ox + (c[0] + 0.5) * cell, oy + (c[1] + 0.5) * cell];
      ctx.fillStyle = '#120a0a'; ctx.fillRect(0, 0, W, H);
      // where the devil has been
      ctx.fillStyle = 'rgba(255,122,61,.13)';
      for (let i = 0; i < been.length; i++) if (been[i]) { const [x, y] = xy(i); ctx.fillRect(ox + x * cell, oy + y * cell, cell + 0.5, cell + 0.5); }
      // the portal
      const [px, py] = mid(xy(maze.exit)), pulse = 0.5 + 0.5 * Math.sin(t * 4);
      const glow = ctx.createRadialGradient(px, py, 0, px, py, cell * 1.4);
      glow.addColorStop(0, 'rgba(163,230,53,.55)'); glow.addColorStop(1, 'rgba(163,230,53,0)');
      ctx.fillStyle = glow; ctx.fillRect(px - cell * 1.4, py - cell * 1.4, cell * 2.8, cell * 2.8);
      ctx.strokeStyle = '#a3e635'; ctx.lineWidth = Math.max(1.5, cell * 0.12);
      ctx.beginPath(); ctx.arc(px, py, cell * (0.26 + pulse * 0.08), 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ecfccb'; ctx.beginPath(); ctx.arc(px, py, cell * 0.1, 0, Math.PI * 2); ctx.fill();
      // the walls
      ctx.strokeStyle = '#8a4a3f'; ctx.lineWidth = Math.max(1.5, cell * 0.11); ctx.lineCap = 'round'; ctx.beginPath();
      for (let i = 0; i < maze.open.length; i++) {
        const [x, y] = xy(i), l = ox + x * cell, top = oy + y * cell;
        if (!(maze.open[i] & 1)) { ctx.moveTo(l, top); ctx.lineTo(l + cell, top); }
        if (!(maze.open[i] & 8)) { ctx.moveTo(l, top); ctx.lineTo(l, top + cell); }
        if (y === maze.rows - 1) { ctx.moveTo(l, top + cell); ctx.lineTo(l + cell, top + cell); }
        if (x === maze.cols - 1) { ctx.moveTo(l + cell, top); ctx.lineTo(l + cell, top + cell); }
      }
      ctx.stroke();
      // the devil: a red head with two horns
      const [dx, dy] = mid(pos), r = cell * 0.3;
      ctx.fillStyle = '#fde68a';
      for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(dx + side * r * 0.35, dy - r * 0.7); ctx.lineTo(dx + side * r * 1.05, dy - r * 1.35); ctx.lineTo(dx + side * r * 0.95, dy - r * 0.2); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(dx, dy, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#18090a'; ctx.beginPath(); ctx.arc(dx - r * 0.36, dy - r * 0.08, r * 0.16, 0, Math.PI * 2); ctx.arc(dx + r * 0.36, dy - r * 0.08, r * 0.16, 0, Math.PI * 2); ctx.fill();
    }
    function frame(dt) {
      let left = dt * SPEED; // cells the devil may cover in this frame
      while (route.length && left > 0) {
        const [tx, ty] = xy(route[0]), gap = Math.abs(tx - pos[0]) + Math.abs(ty - pos[1]);
        if (gap > left) { pos = [pos[0] + Math.sign(tx - pos[0]) * left, pos[1] + Math.sign(ty - pos[1]) * left]; left = 0; break; }
        left -= gap; pos = [tx, ty]; at = route.shift(); been[at] = 1;
        if (!route.length) arrive();
      }
      draw();
    }

    stage.querySelector('#mz-size').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { b.blur(); api.variant(b.dataset.s); reset(); } });
    noScroll(cv);
    reset();
    const stopFit = fitCanvas(cv, (w, h) => { W = w; H = h; draw(); });
    const stopLoop = loop(frame);
    const KEYS = { ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left', w: 'up', d: 'right', s: 'down', a: 'left' };
    return {
      restart: reset,
      key(e) { if (KEYS[e.key]) { if (!e.repeat) go(KEYS[e.key]); return true; } },
      swipe: go,
      destroy() { stopFit(); stopLoop(); clearInterval(ticker); },
    };
  },
};
