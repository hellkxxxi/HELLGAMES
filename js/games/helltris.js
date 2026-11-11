import { fitCanvas, loop, noScroll } from '../util.js';

const COLS = 10, ROWS = 20, HIDDEN = 2;              // two spare rows above the visible field
const VW = 15, VH = 20;                               // canvas size in cells: the field plus a side panel
const DAS = 0.16, ARR = 0.035;                        // holding left / right: delay before it repeats, then seconds per step
const SOFT = 0.03;                                    // soft drop: seconds per row
const LOCK_DELAY = 0.5, MAX_RESETS = 15;              // a landed piece can still be slid around for a moment
const CLEAR_TIME = 0.24;                              // length of the line-clear flash
const LINE_SCORE = [0, 100, 300, 500, 800];           // times the level
const TYPES = 'IJLOSTZ';
const COLOR = { I: '#22d3ee', J: '#60a5fa', L: '#fb923c', O: '#facc15', S: '#4ade80', T: '#c084fc', Z: '#f87171' };

// Each piece in its starting position: box size and the four blocks inside the box.
const SHAPES = {
  I: [4, [[0, 1], [1, 1], [2, 1], [3, 1]]], J: [3, [[0, 0], [0, 1], [1, 1], [2, 1]]], L: [3, [[2, 0], [0, 1], [1, 1], [2, 1]]],
  O: [2, [[0, 0], [1, 0], [0, 1], [1, 1]]], S: [3, [[1, 0], [2, 0], [0, 1], [1, 1]]], T: [3, [[1, 0], [0, 1], [1, 1], [2, 1]]],
  Z: [3, [[0, 0], [1, 0], [1, 1], [2, 1]]],
};
// CELLS[type][rotation] = the four blocks; every next rotation is a clockwise quarter turn of the box.
const CELLS = {};
for (const t of TYPES) {
  const [n, base] = SHAPES[t], rots = [base];
  for (let r = 1; r < 4; r++) rots.push(rots[r - 1].map(([x, y]) => [n - 1 - y, x]));
  CELLS[t] = rots;
}
// Wall kicks of the standard rotation system (SRS): when a turn doesn't fit, these shifts are tried in order.
// Key = rotation before + after; values are [right, up].
const KICKS = {
  '01': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], '10': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '12': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]], '21': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '23': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]], '32': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '30': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]], '03': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};
const KICKS_I = {
  '01': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]], '10': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '12': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]], '21': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '23': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]], '32': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '30': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]], '03': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};
// Seconds a piece takes to fall one row at each level.
export const gravity = (level) => { const l = Math.min(level, 15); return Math.pow(0.8 - (l - 1) * 0.007, l - 1); };

// ---------------------------------------------------------------- the rules (nothing is drawn in this part)
export function createHelltris(random = Math.random) {
  const grid = Array.from({ length: ROWS + HIDDEN }, () => new Array(COLS).fill(null));
  let bag = [], acc = 0, lockT = 0, resets = 0, lowest = 0;
  const s = { grid, cur: null, hold: null, canHold: true, queue: [], score: 0, lines: 0, level: 1, over: false, soft: false, clearing: null, locked: null };

  const fits = (type, rot, x, y) => CELLS[type][rot].every(([cx, cy]) => {
    const gx = x + cx, gy = y + cy;
    return gx >= 0 && gx < COLS && gy < ROWS + HIDDEN && (gy < 0 || !grid[gy][gx]);
  });
  const grounded = () => !fits(s.cur.type, s.cur.rot, s.cur.x, s.cur.y + 1);
  // Pieces come in shuffled sets of all seven, so no shape stays away for long.
  function refill() {
    while (s.queue.length < 5) {
      if (!bag.length) {
        bag = [...TYPES];
        for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
      }
      s.queue.push(bag.pop());
    }
  }
  const next = () => { refill(); const t = s.queue.shift(); refill(); return t; };

  function spawn(type) {
    s.cur = { type, rot: 0, x: Math.floor((COLS - SHAPES[type][0]) / 2), y: type === 'I' ? HIDDEN - 1 : HIDDEN };
    acc = 0; lockT = 0; resets = 0; lowest = s.cur.y;
    if (!fits(type, 0, s.cur.x, s.cur.y)) s.over = true; // no room for a new piece
  }
  // A piece that has landed gets its lock timer reset by every successful move, but only so many times.
  function moved() { if (lockT > 0 && resets < MAX_RESETS) { lockT = 0; resets++; } }

  function lock() {
    const { type, rot, x, y } = s.cur;
    const cells = CELLS[type][rot].map(([cx, cy]) => [x + cx, y + cy]);
    for (const [gx, gy] of cells) if (gy >= 0) grid[gy][gx] = type;
    s.locked = cells; s.cur = null; s.canHold = true;
    if (cells.every(([, gy]) => gy < HIDDEN)) { s.over = true; return; } // locked completely above the field
    const rows = [];
    for (let r = 0; r < ROWS + HIDDEN; r++) if (grid[r].every(Boolean)) rows.push(r);
    if (!rows.length) { spawn(next()); return; }
    s.score += LINE_SCORE[rows.length] * s.level;
    s.lines += rows.length;
    s.level = 1 + Math.floor(s.lines / 10);
    s.clearing = { rows, t: 0 };
  }

  Object.assign(s, {
    start() { spawn(next()); },
    spawn,
    move(dx) {
      const c = s.cur;
      if (!c || s.over || !fits(c.type, c.rot, c.x + dx, c.y)) return false;
      c.x += dx; moved(); return true;
    },
    rotate(dir) {
      const c = s.cur;
      if (!c || s.over || c.type === 'O') return false;
      const to = (c.rot + dir + 4) % 4;
      for (const [kx, ky] of (c.type === 'I' ? KICKS_I : KICKS)['' + c.rot + to]) {
        if (!fits(c.type, to, c.x + kx, c.y - ky)) continue;
        c.x += kx; c.y -= ky; c.rot = to; moved();
        return true;
      }
      return false;
    },
    hardDrop() {
      const c = s.cur;
      if (!c || s.over) return false;
      const to = s.ghostY();
      s.score += 2 * (to - c.y); c.y = to;
      lock();
      return true;
    },
    holdPiece() {
      if (!s.cur || s.over || !s.canHold) return false;
      const t = s.cur.type;
      spawn(s.hold || next());
      s.hold = t; s.canHold = false;
      return true;
    },
    // Row the current piece would land on (used for the ghost outline).
    ghostY() { const c = s.cur; let y = c.y; while (fits(c.type, c.rot, c.x, y + 1)) y++; return y; },
    step(dt) {
      if (s.over) return;
      if (s.clearing) {
        s.clearing.t += dt;
        if (s.clearing.t < CLEAR_TIME) return;
        for (const r of s.clearing.rows) { grid.splice(r, 1); grid.unshift(new Array(COLS).fill(null)); }
        s.clearing = null;
        spawn(next());
        return;
      }
      const c = s.cur;
      if (!c) return;
      const g = gravity(s.level);
      acc += dt / (s.soft ? Math.min(SOFT, g) : g);
      while (acc >= 1) {
        if (grounded()) { acc = 0; break; }
        c.y++; acc -= 1; lockT = 0;
        if (s.soft) s.score += 1;
        if (c.y > lowest) { lowest = c.y; resets = 0; }
      }
      if (grounded()) { lockT += dt; if (lockT >= LOCK_DELAY) lock(); } else lockT = 0;
    },
  });
  return s;
}

// ---------------------------------------------------------------- the game on screen
const KEYS = {
  ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowDown: 'soft', s: 'soft',
  ArrowUp: 'cw', w: 'cw', x: 'cw', z: 'ccw', ' ': 'drop', c: 'hold', Shift: 'hold',
};

export default {
  id: 'helltris', name: 'Helltris', icon: 'blocks', color: '#c084fc', tag: 'Puzzle',
  desc: 'Stack the falling blocks and clear full rows. It speeds up every ten lines.',
  help: 'Arrow keys: move, rotate, soft drop · Z rotates back · Space drops · C holds · P pauses',
  create(stage, api) {
    stage.innerHTML = `
      <canvas class="helltris" id="tt-c"></canvas>
      <div class="pad touch-only" id="tt-pad">
        <button data-a="left" aria-label="Move left"><i data-lucide="chevron-left"></i></button>
        <button data-a="right" aria-label="Move right"><i data-lucide="chevron-right"></i></button>
        <button data-a="hold" aria-label="Hold piece"><i data-lucide="replace"></i></button>
        <button data-a="soft" aria-label="Soft drop"><i data-lucide="chevron-down"></i></button>
        <button data-a="cw" aria-label="Rotate"><i data-lucide="rotate-cw"></i></button>
        <button data-a="drop" aria-label="Hard drop"><i data-lucide="chevrons-down"></i></button>
      </div>`;
    const cv = stage.querySelector('#tt-c'), ctx = cv.getContext('2d'), pad = stage.querySelector('#tt-pad');
    const font = getComputedStyle(document.body).fontFamily;
    const game = createHelltris();
    let W = 1, state = 'ready', endTimer = null;
    let shiftDir = 0, shiftT = 0, flash = 0, flashCells = null, shownScore = -1, shownLines = -1;
    const held = { left: false, right: false };

    function letGo() { held.left = held.right = false; shiftDir = 0; game.soft = false; }
    function press(a) {
      if (state !== 'play') return;
      if (a === 'left' || a === 'right') { held[a] = true; shiftDir = a === 'left' ? -1 : 1; shiftT = 0; game.move(shiftDir); }
      else if (a === 'soft') game.soft = true;
      else if (a === 'cw') game.rotate(1);
      else if (a === 'ccw') game.rotate(-1);
      else if (a === 'drop') game.hardDrop();
      else if (a === 'hold') game.holdPiece();
    }
    function release(a) {
      if (a === 'soft') game.soft = false;
      if (a !== 'left' && a !== 'right') return;
      held[a] = false;
      const other = a === 'left' ? 'right' : 'left', d = other === 'left' ? -1 : 1;
      if (!held[other]) shiftDir = 0;
      else if (shiftDir !== d) { shiftDir = d; shiftT = 0; }
    }
    function begin() { state = 'play'; game.start(); }
    function pause() {
      if (state !== 'play') return;
      state = 'paused'; letGo();
      api.overlay({ title: 'Paused', text: 'Enter or Space to continue', icon: 'pause', button: 'Resume', onClick: () => { state = 'play'; } });
    }

    // ---- drawing (everything is measured in cells; c = size of one cell in canvas pixels)
    const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
    function block(px, py, sz, color, alpha = 1) {
      const g = Math.max(1, sz * 0.045), w = sz - g * 2;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color; rr(px + g, py + g, w, w, sz * 0.17); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.26)'; rr(px + g + w * 0.1, py + g + w * 0.1, w * 0.8, w * 0.22, sz * 0.09); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.2)'; rr(px + g, py + g + w * 0.74, w, w * 0.26, sz * 0.12); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // A small picture of a piece, centred inside a box of the side panel.
    function mini(type, cx, cy, sz, alpha = 1) {
      const cells = CELLS[type][0];
      const xs = cells.map((p) => p[0]), ys = cells.map((p) => p[1]);
      const ox = cx - (Math.min(...xs) + Math.max(...xs) + 1) / 2 * sz, oy = cy - (Math.min(...ys) + Math.max(...ys) + 1) / 2 * sz;
      for (const [x, y] of cells) block(ox + x * sz, oy + y * sz, sz, COLOR[type], alpha);
    }
    function label(text, x, y, c) {
      ctx.fillStyle = '#7e6e6d'; ctx.font = `600 ${c * 0.42}px ${font}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(text, x, y);
    }
    function panelBox(x, y, w, h, c) { ctx.fillStyle = '#19100f'; rr(x, y, w, h, c * 0.4); ctx.fill(); }

    function draw() {
      const c = W / VW, bw = COLS * c, bh = ROWS * c;
      ctx.clearRect(0, 0, cv.width, cv.height);
      // the field
      ctx.fillStyle = '#150d0d'; rr(0, 0, bw, bh, c * 0.45); ctx.fill();
      ctx.save(); rr(0, 0, bw, bh, c * 0.45); ctx.clip();
      ctx.fillStyle = '#1b1110';
      for (let x = 1; x < COLS; x++) ctx.fillRect(Math.round(x * c), 0, 1, bh);
      for (let y = 1; y < ROWS; y++) ctx.fillRect(0, Math.round(y * c), bw, 1);
      const clearing = game.clearing, p = clearing ? Math.min(1, clearing.t / CLEAR_TIME) : 0;
      const dim = state === 'over' ? 0.4 : 1;
      for (let r = HIDDEN; r < ROWS + HIDDEN; r++) {
        const going = clearing && clearing.rows.includes(r);
        for (let x = 0; x < COLS; x++) {
          const t = game.grid[r][x];
          if (t) block(x * c, (r - HIDDEN) * c, c, COLOR[t], going ? 1 - p : dim);
        }
        if (going) { ctx.fillStyle = `rgba(255,255,255,${0.85 * (1 - p)})`; ctx.fillRect(bw / 2 * p, (r - HIDDEN) * c, bw * (1 - p), c); }
      }
      const cur = game.cur;
      if (cur && state !== 'ready') {
        const cells = CELLS[cur.type][cur.rot], gy = game.ghostY();
        if (!game.over && gy !== cur.y) {
          ctx.strokeStyle = COLOR[cur.type]; ctx.lineWidth = Math.max(1, c * 0.07);
          for (const [x, y] of cells) {
            const px = (cur.x + x) * c, py = (gy + y - HIDDEN) * c, g = c * 0.1;
            ctx.globalAlpha = 0.14; ctx.fillStyle = COLOR[cur.type]; rr(px + g, py + g, c - g * 2, c - g * 2, c * 0.15); ctx.fill();
            ctx.globalAlpha = 0.55; ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
        for (const [x, y] of cells) block((cur.x + x) * c, (cur.y + y - HIDDEN) * c, c, COLOR[cur.type], game.over ? 0.8 : 1);
      }
      if (flash > 0 && flashCells) {
        ctx.fillStyle = `rgba(255,255,255,${flash * 0.55})`;
        for (const [x, y] of flashCells) { rr(x * c + 1, (y - HIDDEN) * c + 1, c - 2, c - 2, c * 0.17); ctx.fill(); }
      }
      ctx.restore();
      ctx.strokeStyle = '#2b1b1a'; ctx.lineWidth = 1; rr(0.5, 0.5, bw - 1, bh - 1, c * 0.45); ctx.stroke();

      // the side panel: hold, next pieces, level and lines
      const px = bw + c * 0.5, pw = W - px, m = c * 0.74;
      label('HOLD', px + c * 0.1, c * 0.62, c);
      panelBox(px, c * 0.9, pw, c * 2.7, c);
      if (game.hold) mini(game.hold, px + pw / 2, c * 2.25, m, game.canHold ? 1 : 0.35);
      label('NEXT', px + c * 0.1, c * 4.52, c);
      panelBox(px, c * 4.8, pw, c * 7.9, c);
      if (state !== 'ready') game.queue.slice(0, 3).forEach((t, i) => mini(t, px + pw / 2, c * (6.2 + i * 2.5), m));
      [['LEVEL', game.level, 13.6], ['LINES', game.lines, 16.4]].forEach(([name, value, y]) => {
        label(name, px + c * 0.1, c * (y + 0.02), c);
        panelBox(px, c * (y + 0.3), pw, c * 1.7, c);
        ctx.fillStyle = '#f6f4f3'; ctx.font = `700 ${c * 0.84}px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(value), px + pw / 2, c * (y + 1.2));
      });
    }

    function frame(dt) {
      if (state === 'play') {
        if (shiftDir) {
          shiftT += dt;
          while (shiftT >= DAS) { if (!game.move(shiftDir)) { shiftT = DAS; break; } shiftT -= ARR; }
        }
        game.step(dt);
        if (game.over) {
          state = 'over'; letGo();
          endTimer = setTimeout(() => api.finish(game.score, { text: `Score: ${game.score} · ${game.lines} line${game.lines === 1 ? '' : 's'} · level ${game.level}` }), 650);
        }
      }
      if (game.locked !== flashCells) { flashCells = game.locked; flash = 1; } // a piece has just landed: flash it
      flash = Math.max(0, flash - dt * 7);
      if (game.score !== shownScore) { shownScore = game.score; api.score(shownScore); }
      if (game.lines !== shownLines) { shownLines = game.lines; api.status(`Level ${game.level} · ${game.lines} line${game.lines === 1 ? '' : 's'}`); }
      draw();
    }

    // ---- touch buttons: holding left, right or down repeats, just like holding a key
    const onDown = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      e.preventDefault();
      if (b.setPointerCapture) b.setPointerCapture(e.pointerId); // so the release is noticed even if the finger slides off
      press(b.dataset.a);
    };
    const onUp = (e) => { const b = e.target.closest('button'); if (b) release(b.dataset.a); };
    pad.addEventListener('pointerdown', onDown);
    pad.addEventListener('pointerup', onUp);
    pad.addEventListener('pointercancel', onUp);
    pad.addEventListener('contextmenu', (e) => e.preventDefault());
    noScroll(pad);
    const onHide = () => { if (document.hidden) pause(); };
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', onHide);

    const stopFit = fitCanvas(cv, (w) => { W = w; draw(); });
    const stopLoop = loop(frame);
    api.overlay({ title: 'Helltris', text: 'Arrows move and rotate, Space drops, C holds a piece.', icon: 'play', button: 'Start', onClick: begin });

    return {
      key(e) {
        if (e.key === 'p') { pause(); return true; }
        const a = KEYS[e.key];
        if (!a) return;
        if (!e.repeat) press(a); // the game does its own auto-repeat
        return true;
      },
      keyup(e) { const a = KEYS[e.key]; if (a) release(a); },
      destroy() {
        stopFit(); stopLoop(); clearTimeout(endTimer);
        window.removeEventListener('blur', pause);
        document.removeEventListener('visibilitychange', onHide);
      },
    };
  },
};
