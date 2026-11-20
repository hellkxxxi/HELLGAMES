import { drawIcons, loop, noScroll } from '../util.js';

// ---------------------------------------------------------------- the world (nothing is drawn here)
// A grid of cells. Every cell holds one material, and every step each cell moves or changes by a few
// simple rules of its own. Everything you see comes out of those rules.
export const EMPTY = 0, SAND = 1, WATER = 2, STONE = 3, WOOD = 4, OIL = 5, FIRE = 6, LAVA = 7, STEAM = 8, SMOKE = 9, EMBER = 10;
const isGas = (c) => c === STEAM || c === SMOKE || c === FIRE;
const isLiquid = (c) => c === WATER || c === OIL;

export function createWorld(w, h, rnd = Math.random) {
  const n = w * h;
  const cell = new Uint8Array(n);    // the material
  const life = new Uint8Array(n);    // how much longer a flame, a burning log, steam or smoke lasts
  const tone = new Uint8Array(n);    // a random number each grain keeps, used for its shade
  const moved = new Uint32Array(n);  // the step in which the cell last moved, so nothing moves twice in a step
  let tick = 0;
  const world = { w, h, cell, life, tone };

  const lifeOf = (type) => (type === FIRE ? 10 + rnd() * 22 : type === EMBER ? 70 + rnd() * 150 : type === STEAM ? 140 + rnd() * 110 : type === SMOKE ? 50 + rnd() * 80 : 0);
  function put(i, type) { cell[i] = type; life[i] = lifeOf(type); tone[i] = rnd() * 256; moved[i] = tick; }
  function swap(i, j) {
    let t = cell[i]; cell[i] = cell[j]; cell[j] = t;
    t = life[i]; life[i] = life[j]; life[j] = t;
    t = tone[i]; tone[i] = tone[j]; tone[j] = t;
    moved[i] = moved[j] = tick;
  }

  // Sand falls straight down or slides down a slope, and sinks through water and oil.
  function sand(x, y, i) {
    if (y + 1 >= h) return;
    const below = i + w, b = cell[below];
    if (b === EMPTY || isGas(b) || (isLiquid(b) && rnd() < 0.7)) { swap(i, below); return; }
    const d = rnd() < 0.5 ? 1 : -1;
    for (let k = 0; k < 2; k++) {
      const dx = k ? -d : d, nx = x + dx;
      if (nx < 0 || nx >= w) continue;
      const c = cell[below + dx];
      if (c === EMPTY || isGas(c) || (isLiquid(c) && rnd() < 0.4)) { swap(i, below + dx); return; }
    }
  }
  // A liquid falls, runs down slopes, and otherwise spreads sideways until it lies flat. `reach` is how
  // far it can run in one step. Water is heavier than oil: it pushes through oil the same way, only
  // more slowly, and ends up under it.
  function liquid(x, y, i, type, reach) {
    const sinks = (c) => type === WATER && c === OIL;
    if (y + 1 < h) {
      const below = i + w, b = cell[below];
      if (b === EMPTY || isGas(b) || (sinks(b) && rnd() < 0.6)) { swap(i, below); return; }
      const d = rnd() < 0.5 ? 1 : -1;
      for (let k = 0; k < 2; k++) {
        const dx = k ? -d : d, nx = x + dx;
        if (nx < 0 || nx >= w) continue;
        const c = cell[below + dx];
        if (c === EMPTY || isGas(c) || (sinks(c) && rnd() < 0.6)) { swap(i, below + dx); return; }
      }
    }
    const dir = rnd() < 0.5 ? 1 : -1;
    let to = -1;
    for (let s = 1; s <= reach; s++) {
      const nx = x + dir * s;
      if (nx < 0 || nx >= w) break;
      const c = cell[i + dir * s];
      if (c === EMPTY) to = i + dir * s; else if (!sinks(c)) break;
    }
    if (to >= 0) swap(i, to);
    else if (x + dir >= 0 && x + dir < w && sinks(cell[i + dir]) && rnd() < 0.5) swap(i, i + dir); // shoulders its way through the oil beside it
  }
  // Steam and smoke rise, drift, and are gone after a while. Steam bubbles up through liquids, and some
  // of it turns back into water in the end.
  function gas(x, y, i, type) {
    if (rnd() < (type === STEAM ? 0.3 : 0.5) && --life[i] === 0) { put(i, type === STEAM && rnd() < 0.4 ? WATER : EMPTY); return; }
    if (rnd() < 0.25) return;
    const dx = rnd() < 0.5 ? 0 : rnd() < 0.5 ? 1 : -1, nx = x + dx;
    if (nx < 0 || nx >= w) return;
    if (y > 0) {
      const c = cell[i - w + dx];
      if (c === EMPTY || (dx === 0 && isLiquid(c)) || (c === SMOKE && type === STEAM)) { swap(i, i - w + dx); return; }
    }
    if (dx && cell[i + dx] === EMPTY) swap(i, i + dx);
  }
  // What a hot cell does to the cells next to it. Says true if water has put it out.
  function heat(x, y, i, wood, oil) {
    let quenched = false;
    for (let k = 0; k < 4; k++) {
      const nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0), ny = y + (k === 2 ? 1 : k === 3 ? -1 : 0);
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const j = ny * w + nx, c = cell[j];
      if (c === WOOD) { if (rnd() < wood) put(j, EMBER); }
      else if (c === OIL) { if (rnd() < oil) put(j, FIRE); }
      else if (c === WATER) { quenched = true; if (rnd() < 0.5) put(j, STEAM); }
    }
    return quenched;
  }
  // A flame lives for a moment, climbs, and sets fire to what burns.
  function fire(x, y, i) {
    if (--life[i] === 0) { put(i, rnd() < 0.3 ? SMOKE : EMPTY); return; }
    if (heat(x, y, i, 0.06, 0.4)) { put(i, STEAM); return; }
    if (y === 0 || rnd() < 0.35) return;
    const dx = rnd() < 0.6 ? 0 : rnd() < 0.5 ? 1 : -1, nx = x + dx;
    if (nx >= 0 && nx < w && cell[i - w + dx] === EMPTY) swap(i, i - w + dx);
  }
  // Burning wood stays where it is, throws up flames, and burns away. Water puts it out.
  function ember(x, y, i) {
    if (heat(x, y, i, 0.03, 0.4)) { put(i, WOOD); return; }
    if (--life[i] === 0) { put(i, rnd() < 0.5 ? SMOKE : EMPTY); return; }
    if (y > 0 && cell[i - w] === EMPTY && rnd() < 0.3) put(i - w, FIRE);
  }
  // Lava creeps like a thick liquid, sets fire to what burns, and turns to stone where it meets water.
  function lava(x, y, i) {
    if (heat(x, y, i, 0.12, 0.6)) { put(i, STONE); return; }
    if (y > 0 && cell[i - w] === EMPTY && rnd() < 0.004) put(i - w, FIRE);
    if (rnd() < 0.4) liquid(x, y, i, LAVA, 1);
  }

  world.step = () => {
    tick++;
    for (let y = h - 1; y >= 0; y--) {
      const flip = rnd() < 0.5;
      for (let k = 0; k < w; k++) {
        const x = flip ? w - 1 - k : k, i = y * w + x, c = cell[i];
        if (c === EMPTY || c === STONE || c === WOOD || moved[i] === tick) continue;
        if (c === SAND) sand(x, y, i);
        else if (c === WATER) liquid(x, y, i, WATER, 5);
        else if (c === OIL) liquid(x, y, i, OIL, 3);
        else if (c === FIRE) fire(x, y, i);
        else if (c === EMBER) ember(x, y, i);
        else if (c === LAVA) lava(x, y, i);
        else gas(x, y, i, c);
      }
    }
  };

  // Draws with a round brush. `share` is how much of the brush is filled: less than all of it for
  // things that are poured. A material only goes where there is room; EMPTY is the eraser. Fire also
  // lights the wood and the oil it touches.
  world.paint = (cx, cy, radius, type, share = 1) => {
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const x = cx + dx, y = cy + dy;
      if (dx * dx + dy * dy > radius * radius + radius * 0.8 || x < 0 || x >= w || y < 0 || y >= h) continue;
      const i = y * w + x, c = cell[i];
      if (type === EMPTY) { if (c !== EMPTY) put(i, EMPTY); }
      else if (c === EMPTY) { if (share >= 1 || rnd() < share) put(i, type); }
      else if (type === FIRE && (c === WOOD || c === OIL)) put(i, c === WOOD ? EMBER : FIRE);
    }
  };
  world.fill = (x0, y0, x1, y1, type) => { for (let y = Math.max(0, y0); y <= Math.min(h - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++) put(y * w + x, type); };
  world.at = (x, y) => cell[y * w + x];
  world.count = (type) => { let k = 0; for (let i = 0; i < n; i++) if (cell[i] === type) k++; return k; };
  world.clear = () => { cell.fill(0); life.fill(0); };
  Object.defineProperty(world, 'tick', { get: () => tick });
  return world;
}

// ---------------------------------------------------------------- the game on the page
const TOOLS = [
  { type: SAND, name: 'Sand', color: '#e3c078', share: 0.5 }, { type: WATER, name: 'Water', color: '#3a8bea', share: 0.6 },
  { type: STONE, name: 'Stone', color: '#8a837e', share: 1 }, { type: WOOD, name: 'Wood', color: '#8a5630', share: 1 },
  { type: OIL, name: 'Oil', color: '#7a4fb0', share: 0.6 }, { type: FIRE, name: 'Fire', color: '#ff9a1f', share: 0.5 },
  { type: LAVA, name: 'Lava', color: '#ff4a12', share: 0.6 }, { type: EMPTY, name: 'Eraser', color: '#f6f1ef', share: 1 },
];
const SIZES = [['S', 1], ['M', 3], ['L', 6]];
const SHADES = {
  [SAND]: ['#e3c078', '#d9b56c', '#ecca85', '#cfa95f'], [WATER]: ['#2f7fe0', '#3a8bea', '#2a74d2', '#3585e4'], [STONE]: ['#7d7672', '#716a66', '#88817c', '#79726d'],
  [WOOD]: ['#7a4a26', '#6b3f1f', '#85532c', '#73441f'], [OIL]: ['#5b3a86', '#664394', '#523379', '#6e4a9c'], [FIRE]: ['#ffd24a', '#ff9a1f', '#ff5a1f', '#ffe98a'],
  [LAVA]: ['#ff5a1f', '#ff7a1a', '#ff3d12', '#ffa01e'], [STEAM]: ['#b9c7d6', '#a5b5c5', '#cbd7e3', '#aebdcc'], [SMOKE]: ['#4a4442', '#3d3836', '#57504d', '#433e3c'],
  [EMBER]: ['#ff7a1a', '#c2410c', '#ffb02e', '#8f2f0f'],
};
const FLICKERS = new Set([FIRE, LAVA, EMBER]);
const BACK = 0xff07070d; // the empty cell, written the way the canvas stores a pixel: alpha, blue, green, red
const pixel = (hex) => (0xff000000 | (parseInt(hex.slice(5, 7), 16) << 16) | (parseInt(hex.slice(3, 5), 16) << 8) | parseInt(hex.slice(1, 3), 16)) >>> 0;

// What a new player finds: sand pouring into a heap, a stone basin of water, and a wooden hut with a
// cup of lava hanging over its roof.
export function scene(world) {
  const { w, h } = world, X = (f) => Math.round(f * (w - 1)), Y = (f) => Math.round(f * (h - 1));
  world.clear();
  world.fill(X(0.06), Y(0.72), X(0.075), h - 1, STONE); world.fill(X(0.36), Y(0.72), X(0.375), h - 1, STONE); // the basin
  world.fill(X(0.075), Y(0.8), X(0.36), h - 1, WATER);
  world.paint(X(0.5), Y(0.2), Math.round(w * 0.085), SAND);                                                    // sand in the air
  world.fill(X(0.66), Y(0.7), X(0.675), h - 1, WOOD); world.fill(X(0.88), Y(0.7), X(0.895), h - 1, WOOD);       // the hut
  world.fill(X(0.62), Y(0.67), X(0.935), Y(0.7), WOOD);
  world.fill(X(0.72), Y(0.82), X(0.83), Y(0.835), WOOD);
  world.fill(X(0.7), Y(0.3), X(0.86), Y(0.32), STONE);                                                          // the cup with a hole in it
  world.fill(X(0.7), Y(0.2), X(0.715), Y(0.3), STONE); world.fill(X(0.845), Y(0.2), X(0.86), Y(0.3), STONE);
  world.fill(X(0.715), Y(0.23), X(0.845), Y(0.3) - 1, LAVA);
  world.fill(X(0.775), Y(0.3), X(0.785), Y(0.32), EMPTY);
}

export default {
  id: 'sand', name: 'Sandbox', icon: 'hourglass', color: '#eab308', tag: 'Creative', since: '1.1', noScore: true,
  desc: 'Pour sand, water, oil and lava, build with stone and wood, set it all on fire and watch.',
  help: 'Draw with the mouse or a finger · keys 1 to 8 pick a material · [ and ] change the brush · Space pauses · Restart brings the first scene back',
  create(stage) {
    const narrow = stage.clientWidth < 560;
    const W = narrow ? 112 : 200, H = narrow ? 136 : 120;
    stage.innerHTML = `
      <div class="sandbox">
        <div class="sb-tools" id="sb-tools">${TOOLS.map((t, k) => `<button data-k="${k}" style="--c:${t.color}"><i></i>${t.name}</button>`).join('')}</div>
        <canvas class="sb-canvas" id="sb-c" width="${W}" height="${H}" style="aspect-ratio:${W}/${H}; --ratio:${(W / H).toFixed(3)}; --off:${narrow ? 325 : 290}px"></canvas>
        <div class="sb-bar">
          <div class="seg" id="sb-size">${SIZES.map(([name], k) => `<button data-k="${k}" aria-label="Brush ${name}">${name}</button>`).join('')}</div>
          <button class="bt-tool" id="sb-pause"></button>
          <button class="bt-tool" id="sb-clear"><i data-lucide="trash-2"></i><span>Clear</span></button>
        </div>
      </div>`;
    const cv = stage.querySelector('#sb-c'), ctx = cv.getContext('2d');
    const toolBtns = [...stage.querySelectorAll('#sb-tools button')], sizeBtns = [...stage.querySelectorAll('#sb-size button')], pauseBtn = stage.querySelector('#sb-pause');
    const world = createWorld(W, H);
    const image = ctx.createImageData(W, H), pixels = new Uint32Array(image.data.buffer);
    const shades = []; // shades[material] = eight ready-made pixels
    for (const [type, list] of Object.entries(SHADES)) shades[type] = Uint32Array.from({ length: 8 }, (_, k) => pixel(list[k % list.length]));
    let tool = 0, size = 1, paused = false, pen = null; // pen: the cell under the pointer while it is down

    function show() {
      toolBtns.forEach((b, k) => b.classList.toggle('on', k === tool));
      sizeBtns.forEach((b, k) => b.classList.toggle('on', k === size));
      pauseBtn.innerHTML = `<i data-lucide="${paused ? 'play' : 'pause'}"></i><span>${paused ? 'Resume' : 'Pause'}</span>`;
      drawIcons();
    }
    function draw() {
      const { cell, tone } = world, wave = world.tick >> 2;
      for (let i = 0; i < pixels.length; i++) {
        const c = cell[i];
        pixels[i] = c === EMPTY ? BACK : shades[c][(FLICKERS.has(c) ? tone[i] + wave + (c === FIRE && !paused ? (Math.random() * 4) | 0 : 0) : tone[i]) & 7]; // flames flicker, unless time stands still
      }
      ctx.putImageData(image, 0, 0);
    }
    const dab = (x, y) => world.paint(x, y, SIZES[size][1], TOOLS[tool].type, TOOLS[tool].share);
    const cellAt = (e) => { const r = cv.getBoundingClientRect(); return { x: Math.floor((e.clientX - r.left) / r.width * W), y: Math.floor((e.clientY - r.top) / r.height * H) }; };
    function line(a, b) { // a dab on every cell of the way, so a fast stroke leaves no gaps
      const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), 1);
      for (let s = 1; s <= steps; s++) dab(Math.round(a.x + (b.x - a.x) * s / steps), Math.round(a.y + (b.y - a.y) * s / steps));
    }

    cv.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      try { cv.setPointerCapture(e.pointerId); } catch { /* not vital */ }
      pen = cellAt(e); dab(pen.x, pen.y);
    });
    cv.addEventListener('pointermove', (e) => { if (pen) { const to = cellAt(e); line(pen, to); pen = to; } });
    const lift = () => { pen = null; };
    cv.addEventListener('pointerup', lift); cv.addEventListener('pointercancel', lift);
    noScroll(cv);
    stage.querySelector('#sb-tools').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { b.blur(); tool = Number(b.dataset.k); show(); } });
    stage.querySelector('#sb-size').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { b.blur(); size = Number(b.dataset.k); show(); } });
    pauseBtn.addEventListener('click', () => { pauseBtn.blur(); paused = !paused; show(); });
    stage.querySelector('#sb-clear').addEventListener('click', (e) => { e.currentTarget.blur(); world.clear(); });

    scene(world); show(); draw();
    const stop = loop(() => {
      if (pen) dab(pen.x, pen.y); // a pointer that is held still keeps pouring
      if (!paused) world.step();
      draw();
    });
    return {
      key(e) {
        if (/^[1-8]$/.test(e.key)) { tool = Number(e.key) - 1; show(); return true; }
        if (e.key === '[' || e.key === ']') { size = Math.max(0, Math.min(SIZES.length - 1, size + (e.key === ']' ? 1 : -1))); show(); return true; }
        if (e.key === ' ') { if (!e.repeat) { paused = !paused; show(); } return true; }
      },
      restart() { scene(world); paused = false; show(); },
      destroy() { stop(); },
    };
  },
};
