import { clamp, fitCanvas, loop, noScroll } from '../util.js';
import { createTally, createTransport } from '../rhythm.js';

// ---------------------------------------------------------------- tuning
// The grid is three cells wide and three high; places on it are measured in cells, from 0 to 3.
// gap: the shortest time between two squares · approach: seconds a square flies before it arrives ·
// reach: how far from the middle of a cell the cursor may be and still catch its square (half a cell
// is the edge of the cell) · late: for how long after its moment a square can still be caught
export const MODES = {
  easy: { gap: 0.3, approach: 1.25, reach: 0.74, late: 0.11 },
  normal: { gap: 0.2, approach: 1, reach: 0.68, late: 0.09 },
  hard: { gap: 0.13, approach: 0.8, reach: 0.62, late: 0.07 },
};
const EARLY = 0.02; // a cursor that was on the spot this long before the moment and has just left still counts: about one frame
const RING = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [0, 1]]; // the eight outer cells, clockwise
const CELLS = [0, 1, 2].flatMap((row) => [0, 1, 2].map((col) => [col, row]));

// ---------------------------------------------------------------- where the squares go (nothing is drawn here)
// Turns the notes of a tune into squares on the grid. Quick notes run around the outer cells, so the
// hand draws circles; slower ones step to a cell nearby; after a pause a square may land anywhere.
export function makeChart(song, modeId, rnd = Math.random) {
  const mode = MODES[modeId], chart = [], pick = (list) => list[Math.floor(rnd() * list.length)];
  let col = 1, row = 1, spin = rnd() < 0.5 ? 1 : -1, last = -Infinity, same = 0;
  for (const n of song.notes) {
    if (n.t < last + mode.gap - 1e-6) continue; // too soon after the one before (or at the very same moment)
    const since = n.t - last, at = RING.findIndex(([c, r]) => c === col && r === row);
    let next;
    if (since < 0.27) {
      const roll = rnd();
      if (roll < 0.12 && same < 2) next = [col, row];        // twice on the same spot
      else if (at < 0) next = pick(RING);                    // out of the middle
      else if (roll < 0.2) next = [1, 1];                    // through the middle
      else { if (roll > 0.9) spin = -spin; next = RING[(at + spin + 8) % 8]; }
    } else {
      const near = since < 0.55;
      next = pick(CELLS.filter(([c, r]) => (c !== col || r !== row) && (!near || (Math.abs(c - col) <= 1 && Math.abs(r - row) <= 1))));
    }
    same = next[0] === col && next[1] === row ? same + 1 : 0;
    [col, row] = next; last = n.t;
    chart.push({ t: n.t, col, row });
  }
  return chart;
}

// ---------------------------------------------------------------- judging (nothing is drawn here either)
// A square is caught if the cursor is within reach of its cell at its moment or shortly after.
// Nothing is pressed: only where the cursor is counts.
export function createRun(chart, modeId) {
  const { reach, late } = MODES[modeId];
  const notes = chart.map((n) => ({ ...n, state: 'wait' })); // wait → hit | missed
  const tally = createTally(notes.length);
  const run = { notes, tally, events: [] };
  let next = 0, lastX = null, lastY = null, lastT = 0;
  // Call on every frame and whenever the cursor moves: the time of the song and where the cursor is.
  run.update = (t, x, y) => {
    if (lastX === null) { lastX = x; lastY = y; lastT = t; }
    for (let i = next; i < notes.length && notes[i].t <= t; i++) {
      const n = notes[i];
      if (n.state !== 'wait') continue;
      // The way the cursor went since the last look counts too, so a quick sweep across a square is
      // not lost. Every point of that way has a time of its own, and it has to be the square's time.
      let caught = false;
      for (let k = 0; k <= 4 && !caught; k++) {
        const when = lastT + (t - lastT) * k / 4;
        if (when < n.t - EARLY || when > n.t + late) continue;
        const px = lastX + (x - lastX) * k / 4, py = lastY + (y - lastY) * k / 4;
        caught = Math.abs(px - n.col - 0.5) <= reach && Math.abs(py - n.row - 0.5) <= reach;
      }
      if (!caught && t <= n.t + late) continue;
      n.state = caught ? 'hit' : 'missed'; n.at = t;
      tally.add(caught ? 'perfect' : 'miss');
      run.events.push({ kind: n.state, col: n.col, row: n.row });
    }
    while (next < notes.length && notes[next].state !== 'wait') next++;
    lastX = x; lastY = y; lastT = t;
  };
  return run;
}

// ---------------------------------------------------------------- the game on screen
const COLORS = ['#ff7a3d', '#a78bfa'];
const DEPTH = 5.5;   // a square that has just appeared is this many times smaller, plus one, than when it arrives
const EDGE = 0.13;   // the cursor stays this far inside the grid
// the number pad and the left of the keyboard are laid out like the grid
const KEYS = { 7: [0, 0], 8: [1, 0], 9: [2, 0], 4: [0, 1], 5: [1, 1], 6: [2, 1], 1: [0, 2], 2: [1, 2], 3: [2, 2], q: [0, 0], w: [1, 0], e: [2, 0], a: [0, 1], s: [1, 1], d: [2, 1], z: [0, 2], x: [1, 2], c: [2, 2] };
const wall = () => performance.now() / 1000;

export default {
  id: 'catcher', name: 'Soul Catcher', icon: 'scan', color: '#38bdf8', tag: 'Rhythm', since: '1.1',
  desc: 'Squares fly at you to the music: be on the right spot of the grid when each one arrives. Nothing to click.',
  help: 'Move the mouse or slide a finger over the grid · or jump from cell to cell with the number pad or Q W E, A S D, Z X C · P to pause',
  variants: { easy: 'Easy', normal: 'Normal', hard: 'Hard' },
  create(stage, api) {
    stage.innerHTML = `
      <div class="mn-top">
        <div class="seg" id="ct-mode">${Object.entries(this.variants).map(([id, name]) => `<button data-m="${id}">${name}</button>`).join('')}</div>
        <button class="btn-icon" id="ct-snd" aria-label="Sound on or off"></button>
      </div>
      <canvas class="catcher" id="ct-c"></canvas>`;
    const cv = stage.querySelector('#ct-c'), ctx = cv.getContext('2d');
    const modeBtns = [...stage.querySelectorAll('#ct-mode button')];
    const font = getComputedStyle(document.body).fontFamily;
    let W = 1, H = 1, mode, song, run, endTimer = null, shown = '';
    const cursor = { x: 1.5, y: 1.5 };
    let trail = [], bursts = [], missAt = -1;
    const tr = createTransport(api, stage.querySelector('#ct-snd'));

    function reset() {
      clearTimeout(endTimer); api.hideOverlay();
      mode = MODES[api.variant()] ? api.variant() : 'easy';
      song = tr.load(mode);
      run = createRun(makeChart(song, mode), mode);
      bursts = []; shown = ''; missAt = -1;
      modeBtns.forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
      api.score(0);
      api.status(`${song.bpm} BPM · ${run.notes.length} squares`);
    }
    function start() { tr.wake(); if (tr.state === 'idle') tr.begin(); }
    const look = () => { if (tr.state === 'play') run.update(tr.now(), cursor.x, cursor.y); };

    // ---- drawing
    function box(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
    function label(text, x, y, size, color, weight = 700) {
      ctx.font = `${weight} ${size}px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = color; ctx.fillText(text, x, y);
    }
    function draw() {
      const t = tr.now(), now = wall(), approach = MODES[mode].approach;
      const S = Math.min(W, H) * 0.9, cx = W / 2, cy = H / 2, cell = S / 3;
      const frame = (scale) => { const s = S * scale; box(cx - s / 2, cy - s / 2, s, s, s * 0.04); };
      ctx.fillStyle = '#120a0a'; ctx.fillRect(0, 0, W, H);

      // the tunnel: frames that come closer with every beat
      const phase = tr.state === 'idle' ? 0 : (((t - song.firstBar) / song.beat) % 1 + 1) % 1;
      ctx.lineWidth = 1; ctx.strokeStyle = '#4a2a27';
      for (let k = 0; k < 5; k++) {
        const z = (k + 1 - phase) / 5; // 0 is the grid, 1 is the far end
        ctx.globalAlpha = 0.75 * (1 - z) + 0.1;
        frame(1 / (1 + z * DEPTH)); ctx.stroke();
      }
      const far = 1 / (1 + DEPTH);
      ctx.globalAlpha = 0.45; ctx.beginPath();
      for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.moveTo(cx + dx * S * 0.49, cy + dy * S * 0.49); ctx.lineTo(cx + dx * S * far / 2, cy + dy * S * far / 2); }
      ctx.stroke(); ctx.globalAlpha = 1;
      if (run.tally.combo > 1) { ctx.globalAlpha = 0.2; label(String(run.tally.combo), cx, cy, S * 0.11, '#f6f1ef', 800); ctx.globalAlpha = 1; }

      // the grid
      ctx.strokeStyle = '#2c1b1a'; ctx.lineWidth = 1; ctx.beginPath();
      for (const k of [-0.5, 0.5]) { ctx.moveTo(cx + k * cell, cy - S / 2); ctx.lineTo(cx + k * cell, cy + S / 2); ctx.moveTo(cx - S / 2, cy + k * cell); ctx.lineTo(cx + S / 2, cy + k * cell); }
      ctx.stroke();
      const hurt = clamp(1 - (now - missAt) / 0.22, 0, 1);
      ctx.strokeStyle = hurt ? `rgba(248,113,113,${0.35 + hurt * 0.65})` : '#6b3f3a'; ctx.lineWidth = 2 + hurt * 2;
      frame(1); ctx.stroke();

      // the squares, the farthest first
      for (let i = run.notes.length - 1; i >= 0; i--) {
        const n = run.notes[i];
        if (n.t - approach > t || n.state === 'hit') continue;
        if (n.state === 'missed' && t - n.at > 0.25) { if (n.t < t - 2) break; continue; }
        const z = (n.t - t) / approach, scale = 1 / (1 + Math.max(z, -0.12) * DEPTH), side = cell * 0.8 * scale;
        const x = cx + (n.col - 1) * cell * scale, y = cy + (n.row - 1) * cell * scale;
        const color = n.state === 'missed' ? '#f87171' : COLORS[i % COLORS.length];
        ctx.globalAlpha = n.state === 'missed' ? clamp(1 - (t - n.at) / 0.25, 0, 1) * 0.6 : clamp((1 - z) / 0.2, 0, 1);
        box(x - side / 2, y - side / 2, side, side, side * 0.2);
        ctx.fillStyle = color; ctx.globalAlpha *= 0.22; ctx.fill(); ctx.globalAlpha /= 0.22;
        ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.5, side * 0.11); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // a square that was caught bursts
      bursts = bursts.filter((b) => now - b.at < 0.24);
      for (const b of bursts) {
        const k = (now - b.at) / 0.24, side = cell * (0.8 + k * 0.35);
        ctx.globalAlpha = 1 - k; ctx.strokeStyle = b.color; ctx.lineWidth = cell * 0.09 * (1 - k) + 1;
        box(cx + (b.col - 1) * cell - side / 2, cy + (b.row - 1) * cell - side / 2, side, side, side * 0.2); ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // the cursor and where it has just been
      const px = (p) => cx + (p.x - 1.5) * cell, py = (p) => cy + (p.y - 1.5) * cell, cs = cell * 0.26;
      trail.push({ x: cursor.x, y: cursor.y }); if (trail.length > 9) trail.shift();
      trail.forEach((p, k) => { ctx.globalAlpha = 0.05 * (k + 1); ctx.fillStyle = '#f6f1ef'; const s = cs * (0.35 + 0.06 * k); box(px(p) - s / 2, py(p) - s / 2, s, s, s * 0.25); ctx.fill(); });
      ctx.globalAlpha = 1; ctx.shadowColor = '#fff'; ctx.shadowBlur = cs * 0.6;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, cs * 0.16);
      box(px(cursor) - cs / 2, py(cursor) - cs / 2, cs, cs, cs * 0.25); ctx.stroke();
      ctx.shadowBlur = 0;

      if (tr.state === 'idle') {
        ctx.fillStyle = 'rgba(18,10,10,.62)'; ctx.fillRect(0, 0, W, H);
        label('Click or tap to start', cx, H * 0.45, S * 0.066, '#f6f1ef');
        label('Be on a square’s spot when it reaches the grid', cx, H * 0.45 + S * 0.08, S * 0.037, '#aca09f', 500);
      } else { // how far into the tune we are
        ctx.fillStyle = '#2b1b1a'; ctx.fillRect(0, 0, W, Math.max(2, H * 0.007));
        ctx.fillStyle = '#38bdf8'; ctx.fillRect(0, 0, W * Math.min(1, t / song.length), Math.max(2, H * 0.007));
      }
    }

    function frame() {
      look();
      if (tr.tick()) endTimer = setTimeout(() => api.finish(run.tally.score, { endTitle: 'Song finished', text: run.tally.summary() }), 300);
      for (const ev of run.events.splice(0)) {
        if (ev.kind === 'hit') bursts.push({ col: ev.col, row: ev.row, at: wall(), color: '#fde68a' }); else missAt = wall();
      }
      const line = `${run.tally.score}|${run.tally.combo}|${run.tally.judged}|${tr.state}`;
      if (line !== shown && tr.state !== 'idle') {
        shown = line; api.score(run.tally.score);
        api.status(run.tally.judged ? `Combo ${run.tally.combo} · ${(run.tally.accuracy * 100).toFixed(1)}%` : 'Get ready…');
      }
      draw();
    }

    // ---- input
    const aim = (e) => {
      const r = cv.getBoundingClientRect(), cell = Math.min(r.width, r.height) * 0.9 / 3;
      cursor.x = clamp((e.clientX - r.left - r.width / 2) / cell + 1.5, EDGE, 3 - EDGE);
      cursor.y = clamp((e.clientY - r.top - r.height / 2) / cell + 1.5, EDGE, 3 - EDGE);
      look();
    };
    cv.addEventListener('pointerdown', (e) => {
      aim(e);
      try { cv.setPointerCapture(e.pointerId); } catch { /* not vital */ }
      start();
      e.preventDefault();
    });
    // the mouse is followed over the whole page, so the cursor does not stop dead when it leaves the picture
    const follow = (e) => { if (e.pointerType === 'mouse' || e.target === cv) aim(e); };
    window.addEventListener('pointermove', follow);
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    noScroll(cv);
    stage.querySelector('#ct-mode').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      b.blur();
      if (b.dataset.m !== api.variant() || tr.state !== 'idle') { api.variant(b.dataset.m); reset(); }
    });
    const onBlur = () => tr.pause();
    const onHide = () => { if (document.hidden) tr.pause(); };
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onHide);

    reset();
    const stopFit = fitCanvas(cv, (w, h) => { W = w; H = h; draw(); });
    const stopLoop = loop(frame);
    return {
      restart: reset,
      key(e) {
        if (e.key === 'p') { if (!e.repeat) tr.pause(); return true; }
        if (KEYS[e.key]) { cursor.x = KEYS[e.key][0] + 0.5; cursor.y = KEYS[e.key][1] + 0.5; start(); look(); return true; }
        if (e.key === ' ' && tr.state === 'idle') { start(); return true; }
      },
      destroy() {
        stopFit(); stopLoop(); clearTimeout(endTimer); tr.close();
        window.removeEventListener('pointermove', follow);
        window.removeEventListener('blur', onBlur);
        document.removeEventListener('visibilitychange', onHide);
      },
    };
  },
};
