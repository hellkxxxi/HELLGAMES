import { clamp, fitCanvas, loop, noScroll } from '../util.js';
import { createTally, createTransport } from '../rhythm.js';

// ---------------------------------------------------------------- tuning
// gap: the shortest time between two circles · radius: of a circle, as a share of the shorter side of
// the field · approach: seconds a circle is on screen before its moment · flow: how far apart circles
// lie for every second between them · windows: how many seconds off still count as perfect, great, good
export const MODES = {
  easy: { gap: 0.28, radius: 0.088, approach: 1.3, flow: 0.5, windows: [0.07, 0.12, 0.17] },
  normal: { gap: 0.2, radius: 0.074, approach: 1.05, flow: 0.75, windows: [0.06, 0.105, 0.15] },
  hard: { gap: 0.1, radius: 0.06, approach: 0.75, flow: 1.25, windows: [0.045, 0.085, 0.125] },
  hell: { gap: 0.08, radius: 0.05, approach: 0.58, flow: 1.6, windows: [0.04, 0.075, 0.11] },
};
const STREAM = 0.135;     // circles that follow each other faster than this lie in a chain, each half over the one before
const LINK = 1.2;         // how many radii lie between two circles of a chain
const FOLLOW = 2.3;       // while a slider is held, the pointer may stray this many radii from the ball
const LET_GO = 0.14;      // a slider may be let go this long before its end
const STRAY = 0.2;        // and the pointer may be off the ball for this long before the slider is lost

// ---------------------------------------------------------------- where the circles go (nothing is drawn here)
// Turns the notes of a tune into circles and sliders on a field that is 1 wide and 1 high. Every circle
// lies a step away from the one before, a longer step after a longer pause, so the hand flows from one
// to the next. Very quick notes make a chain of circles that bends gently to one side: a stream.
// A long note becomes a slider: a path the pointer has to follow while the note sounds.
export function makeChart(song, modeId, rnd = Math.random) {
  const mode = MODES[modeId], chart = [], inside = (x, y) => x >= 0 && x <= 1 && y >= 0 && y <= 1;
  let x = 0.5, y = 0.5, heading = rnd() * Math.PI * 2, freeAt = -Infinity, endOfLast = -1, group = 0, number = 0, lastPart = -1, bend = 0;
  for (const n of song.notes) {
    if (n.t < freeAt - 1e-6) continue; // too soon after the one before (or at the very same moment)
    const len = n.len >= 0.3 ? n.len : 0;
    const room = mode.radius * 2.9; // two circles this far apart do not cover each other
    const dist = clamp((n.t - endOfLast) * mode.flow, room, 0.55);
    const recent = chart.slice(-3, -1); // the circles before the last one are still on screen too
    const before = chart[chart.length - 1];
    let spot = null;
    if (before && !before.len && !len && n.t - before.t < STREAM) {
      // the next circle of a chain: a short step on, turning the way the chain bends and away from the edge
      if (!before.chain) bend = (rnd() - 0.5) * 1.1;
      for (let attempt = 0; attempt < 14 && !spot; attempt++) {
        const a = heading + bend + (attempt % 2 ? -1 : 1) * Math.ceil(attempt / 2) * 0.45;
        const nx = x + Math.cos(a) * mode.radius * LINK, ny = y + Math.sin(a) * mode.radius * LINK;
        if (inside(nx, ny)) { spot = { x: nx, y: ny, heading: a, chain: true }; if (attempt) bend = -bend; }
      }
    }
    for (let attempt = 0; attempt < 60 && !spot; attempt++) {
      const a = heading + (attempt < 3 ? (rnd() - 0.5) * 1.7 : rnd() * Math.PI * 2);
      const nx = x + Math.cos(a) * dist, ny = y + Math.sin(a) * dist;
      if (!inside(nx, ny)) continue;
      if (attempt < 40 && recent.some((o) => Math.hypot(o.x - nx, o.y - ny) < room * 0.85)) continue;
      if (!len) { spot = { x: nx, y: ny, heading: a }; break; }
      const reach = clamp(len * 0.32, 0.2, 0.42), b = a + (rnd() - 0.5) * 1.2;
      const ex = nx + Math.cos(b) * reach, ey = ny + Math.sin(b) * reach;
      if (!inside(ex, ey)) continue;
      const bend = (rnd() - 0.5) * 0.6 * reach; // the path bows to one side
      const mx = clamp((nx + ex) / 2 - Math.sin(b) * bend, 0, 1), my = clamp((ny + ey) / 2 + Math.cos(b) * bend, 0, 1);
      const path = Array.from({ length: 17 }, (_, k) => { const p = k / 16, q = 1 - p; return [q * q * nx + 2 * q * p * mx + p * p * ex, q * q * ny + 2 * q * p * my + p * p * ey]; });
      spot = { x: nx, y: ny, heading: b, path };
    }
    if (!spot) spot = { x: 0.5, y: 0.5, heading: rnd() * Math.PI * 2, path: len ? Array.from({ length: 17 }, (_, k) => [0.5 + 0.25 * k / 16, 0.5]) : null };
    const part = Math.floor((n.t - song.firstBar) / (song.beat * 8) + 1e-6); // the numbers start again every two bars
    if (part !== lastPart) { lastPart = part; group++; number = 0; }
    number++;
    chart.push({ t: n.t, len, x: spot.x, y: spot.y, path: spot.path || null, group, number, ...(spot.chain ? { chain: true } : {}) });
    [x, y] = spot.path ? spot.path[spot.path.length - 1] : [spot.x, spot.y];
    heading = spot.heading; endOfLast = n.t + len; freeAt = n.t + len + mode.gap;
  }
  return chart;
}
// Where the ball of a slider is at time t.
export function ballAt(o, t) {
  const p = clamp((t - o.t) / o.len, 0, 1) * (o.path.length - 1), k = Math.min(o.path.length - 2, Math.floor(p)), f = p - k;
  return [o.path[k][0] + (o.path[k + 1][0] - o.path[k][0]) * f, o.path[k][1] + (o.path[k + 1][1] - o.path[k][1]) * f];
}

// ---------------------------------------------------------------- judging (nothing is drawn here either)
// The field is told its size on screen (setField), because a circle is round on screen, not on the
// 1 by 1 field. The pointer is given in field units. A slider is judged twice: for the click on its
// start and for following it to its end.
export function createRun(chart, modeId) {
  const [PERFECT, GREAT, GOOD] = MODES[modeId].windows;
  const objs = chart.map((o) => ({ ...o, state: 'wait' })); // wait → done | missed, a slider: wait → held → done | dropped
  const tally = createTally(objs.reduce((sum, o) => sum + (o.len ? 2 : 1), 0));
  const run = { objs, tally, events: [], held: null };
  let next = 0, sx = 1, sy = 1, radius = 0.08, strayed = 0, lastT = 0;
  const far = (ax, ay, bx, by) => Math.hypot((ax - bx) * sx, (ay - by) * sy);
  const judge = (kind, o, x = o.x, y = o.y) => { tally.add(kind); run.events.push({ kind, x, y }); };
  const lose = (o, t) => { // a circle that was not hit; a slider loses its second half with it
    o.state = 'missed'; o.goneAt = t; judge('miss', o);
    if (o.len) judge('miss', o, ...o.path[o.path.length - 1]);
  };

  run.setField = (width, height, r) => { sx = width; sy = height; radius = r; };
  // Call on every frame with the time, where the pointer is and whether it is pressed.
  run.update = (t, px, py, down) => {
    const o = run.held;
    if (o) {
      const [bx, by] = ballAt(o, t), end = o.t + o.len;
      const on = down && far(px, py, bx, by) <= radius * FOLLOW;
      strayed = on ? 0 : strayed + (t - lastT);
      if (t >= end || (!on && t >= end - LET_GO)) { o.state = 'done'; run.held = null; judge('perfect', o, ...o.path[o.path.length - 1]); }
      else if (strayed > STRAY) { o.state = 'dropped'; run.held = null; judge('miss', o, bx, by); }
    }
    lastT = t;
    for (let n = objs[next]; n && n.state === 'wait' && t > n.t + GOOD; n = objs[++next]) lose(n, n.t + GOOD);
  };
  // A click, a tap or a key at time t with the pointer at (px, py). Only the earliest circle that is
  // still waiting can be hit, with one exception: once its moment has come, a click on the circle
  // after it gives the earlier one up, so that one slip in a quick chain costs one circle and no more.
  // Answers how good the hit was, 'early' for a click on a circle before its time, or null when the
  // click hit nothing.
  run.press = (t, px, py) => {
    run.update(t, px, py, true);
    let o = objs[next];
    if (!o || o.state !== 'wait') return null;
    if (far(px, py, o.x, o.y) > radius) {
      const after = objs[next + 1];
      if (!after || t < o.t || t < after.t - GOOD || far(px, py, after.x, after.y) > radius) return null;
      lose(o, t); next++; o = after;
    }
    if (t < o.t - GOOD) return 'early';
    const off = Math.abs(t - o.t), kind = off <= PERFECT ? 'perfect' : off <= GREAT ? 'great' : 'good';
    next++;
    if (o.len) { o.state = 'held'; run.held = o; strayed = 0; } else o.state = 'done';
    o.hitAt = t;
    judge(kind, o);
    return kind;
  };
  return run;
}

// ---------------------------------------------------------------- the game on screen
const COLORS = ['#ff7a3d', '#fbbf24', '#f43f5e', '#a78bfa'];
const JUDGE = { perfect: ['PERFECT', '#fde047'], great: ['GREAT', '#4ade80'], good: ['GOOD', '#60a5fa'], miss: ['MISS', '#f87171'] };
const wall = () => performance.now() / 1000;

export default {
  id: 'circles', name: 'Circles of Hell', icon: 'circle-dot', color: '#fb7185', tag: 'Rhythm', since: '1.1',
  desc: 'Circles light up to the music: click each one on the beat and follow the sliders. A new tune every round.',
  help: 'Aim with the mouse and click, or press Z or X · on a phone tap the circles · hold and follow a slider to its end · P to pause',
  variants: { easy: 'Easy', normal: 'Normal', hard: 'Hard', hell: 'Hell' },
  create(stage, api) {
    stage.innerHTML = `
      <div class="mn-top">
        <div class="seg" id="cr-mode">${Object.entries(this.variants).map(([id, name]) => `<button data-m="${id}">${name}</button>`).join('')}</div>
        <button class="btn-icon" id="cr-snd" aria-label="Sound on or off"></button>
      </div>
      <canvas class="circles" id="cr-c"></canvas>`;
    const cv = stage.querySelector('#cr-c'), ctx = cv.getContext('2d');
    const modeBtns = [...stage.querySelectorAll('#cr-mode button')];
    const font = getComputedStyle(document.body).fontFamily;
    let W = 1, H = 1, R = 10, pad = 10, mode, song, run, endTimer = null, shown = '';
    const pointer = { x: 0.5, y: 0.5, holds: new Set() }; // where the pointer is on the field, and what is pressing: mouse, fingers, keys
    let marks = [], shake = 0;
    const tr = createTransport(api, stage.querySelector('#cr-snd'), () => pointer.holds.clear());

    function field() { // how the 1 by 1 field lies on the canvas
      R = MODES[mode].radius * Math.min(W, H); pad = R + Math.min(W, H) * 0.035;
      if (run) run.setField(W - 2 * pad, H - 2 * pad, R);
    }
    const X = (x) => pad + x * (W - 2 * pad), Y = (y) => pad + y * (H - 2 * pad);
    function reset() {
      clearTimeout(endTimer); api.hideOverlay();
      mode = MODES[api.variant()] ? api.variant() : 'easy';
      song = tr.load(mode);
      run = createRun(makeChart(song, mode), mode);
      marks = []; shown = ''; pointer.holds.clear(); field();
      modeBtns.forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
      api.score(0);
      api.status(`${song.bpm} BPM · ${run.objs.length} circles`);
    }
    function press(source) {
      pointer.holds.add(source);
      tr.wake();
      if (tr.state === 'idle') { tr.begin(); return; }
      if (tr.state === 'play' && run.press(tr.now(), pointer.x, pointer.y) === 'early') shake = wall();
    }
    const release = (source) => pointer.holds.delete(source);

    // ---- drawing
    function label(text, x, y, size, color, weight = 700) {
      ctx.font = `${weight} ${size}px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = color; ctx.fillText(text, x, y);
    }
    function ring(x, y, r, color, width, alpha = 1) {
      ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width;
      ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    }
    function disc(o, x, y, alpha, color) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#1a0f0e'; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = color; ctx.globalAlpha = alpha * 0.28; ctx.beginPath(); ctx.arc(x, y, R * 0.9, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = alpha;
      ring(x, y, R * 0.93, color, R * 0.14, alpha);
      ring(x, y, R * 0.75, '#fff', R * 0.03, alpha * 0.45);
      if (o) label(String(o.number), x, y + R * 0.04, R * 0.82, '#fff');
      ctx.globalAlpha = 1;
    }
    function draw() {
      const t = tr.now(), approach = MODES[mode].approach, now = wall();
      ctx.fillStyle = '#120a0a'; ctx.fillRect(0, 0, W, H);
      const glow = ctx.createRadialGradient(W / 2, H * 1.1, 0, W / 2, H * 1.1, H);
      glow.addColorStop(0, 'rgba(255,90,40,.13)'); glow.addColorStop(1, 'rgba(255,90,40,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

      // the circles, the latest first so that the next one to hit lies on top
      const seen = run.objs.filter((o) => o.t - approach <= t && t <= o.t + o.len + 0.4);
      for (const o of seen.reverse()) {
        const color = COLORS[o.group % COLORS.length], x = X(o.x), y = Y(o.y);
        const fadeIn = clamp((t - (o.t - approach)) / 0.3, 0, 1);
        const gone = o.state === 'missed' || o.state === 'dropped' || o.state === 'done';
        const since = o.state === 'missed' ? t - o.goneAt : o.state === 'done' && !o.len ? t - o.hitAt : 0;
        const alpha = o.state === 'missed' ? clamp(1 - since / 0.25, 0, 1) * 0.5 : fadeIn;
        if (o.len) {
          const bodyAlpha = (o.state === 'done' || o.state === 'dropped' ? clamp(1 - (t - (o.t + o.len)) / 0.25, 0, 0.5) : alpha) * (o.state === 'dropped' ? 0.4 : 1);
          if (bodyAlpha > 0.01) {
            ctx.globalAlpha = bodyAlpha; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            const trace = () => { ctx.beginPath(); o.path.forEach(([px, py], k) => (k ? ctx.lineTo(X(px), Y(py)) : ctx.moveTo(X(px), Y(py)))); ctx.stroke(); };
            ctx.strokeStyle = color; ctx.lineWidth = R * 2; trace();
            ctx.strokeStyle = '#1a0f0e'; ctx.lineWidth = R * 1.72; trace();
            ctx.globalAlpha = 1;
          }
          if (o.state === 'held' || (o.state === 'wait' && t >= o.t)) {
            const [bx, by] = ballAt(o, t);
            if (o.state === 'held') ring(X(bx), Y(by), R * FOLLOW * 0.82, color, R * 0.07, 0.6);
            ctx.fillStyle = color; ctx.beginPath(); ctx.arc(X(bx), Y(by), R * 0.72, 0, Math.PI * 2); ctx.fill();
            ring(X(bx), Y(by), R * 0.72, '#fff', R * 0.08, 0.9);
          }
        }
        if (o.state === 'wait' || o.state === 'missed') {
          if (alpha > 0.01) disc(o, x, y, alpha, o.state === 'missed' ? '#7f4a48' : color);
          if (o.state === 'wait' && t < o.t) ring(x, y, R * (1 + 2.3 * (o.t - t) / approach), color, R * 0.07, fadeIn * 0.9);
        } else if (!gone || (o.state === 'done' && !o.len && since < 0.22)) {
          const k = clamp((t - o.hitAt) / 0.22, 0, 1); // the burst of a hit
          ring(x, y, R * (1 + k * 0.55), color, R * 0.16 * (1 - k), 1 - k);
        }
      }
      // what the last hits were judged
      marks = marks.filter((m) => now - m.at < 0.55);
      for (const m of marks) {
        const k = (now - m.at) / 0.55;
        ctx.globalAlpha = 1 - k * k;
        label(JUDGE[m.kind][0], X(m.x), Y(m.y) - R * (1.25 + k * 0.5), Math.max(11, R * 0.42), JUDGE[m.kind][1], 800);
        ctx.globalAlpha = 1;
      }
      if (now - shake < 0.18) ring(X(pointer.x), Y(pointer.y), R * 0.5, '#f87171', 2, 1 - (now - shake) / 0.18);

      if (tr.state === 'idle') {
        ctx.fillStyle = 'rgba(18,10,10,.6)'; ctx.fillRect(0, 0, W, H);
        const s = Math.min(W, H);
        label('Click or tap to start', W / 2, H * 0.45, s * 0.062, '#f6f1ef');
        label('Hit every circle when the ring closes on it', W / 2, H * 0.45 + s * 0.075, s * 0.036, '#aca09f', 500);
      } else { // how far into the tune we are
        ctx.fillStyle = '#2b1b1a'; ctx.fillRect(0, 0, W, Math.max(2, H * 0.007));
        ctx.fillStyle = '#fb7185'; ctx.fillRect(0, 0, W * Math.min(1, t / song.length), Math.max(2, H * 0.007));
        if (run.tally.combo > 1) { ctx.globalAlpha = 0.85; ctx.textAlign = 'left'; ctx.font = `800 ${Math.min(W, H) * 0.06}px ${font}`; ctx.fillStyle = '#f6f1ef'; ctx.textBaseline = 'alphabetic'; ctx.fillText(run.tally.combo + '×', pad * 0.5, H - pad * 0.45); ctx.globalAlpha = 1; }
      }
    }

    function frame() {
      if (tr.state === 'play') run.update(tr.now(), pointer.x, pointer.y, pointer.holds.size > 0);
      if (tr.tick()) {
        endTimer = setTimeout(() => api.finish(run.tally.score, { endTitle: 'Song finished', text: run.tally.summary() }), 300);
      }
      for (const ev of run.events.splice(0)) marks.push({ ...ev, at: wall() });
      const line = `${run.tally.score}|${run.tally.combo}|${run.tally.judged}|${tr.state}`;
      if (line !== shown && tr.state !== 'idle') {
        shown = line; api.score(run.tally.score);
        api.status(run.tally.judged ? `Combo ${run.tally.combo} · ${(run.tally.accuracy * 100).toFixed(1)}%` : 'Get ready…');
      }
      draw();
    }

    // ---- input
    const aim = (e) => {
      const r = cv.getBoundingClientRect(), k = W / r.width;
      pointer.x = ((e.clientX - r.left) * k - pad) / (W - 2 * pad); pointer.y = ((e.clientY - r.top) * k - pad) / (H - 2 * pad);
    };
    cv.addEventListener('pointerdown', (e) => {
      aim(e);
      try { cv.setPointerCapture(e.pointerId); } catch { /* not vital */ }
      press('p' + e.pointerId);
      e.preventDefault();
    });
    cv.addEventListener('pointermove', aim);
    const lift = (e) => release('p' + e.pointerId);
    cv.addEventListener('pointerup', lift); cv.addEventListener('pointercancel', lift);
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    noScroll(cv);
    stage.querySelector('#cr-mode').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      b.blur();
      if (b.dataset.m !== api.variant() || tr.state !== 'idle') { api.variant(b.dataset.m); reset(); }
    });
    const onBlur = () => { tr.pause(); pointer.holds.clear(); };
    const onHide = () => { if (document.hidden) onBlur(); };
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onHide);

    reset();
    const stopFit = fitCanvas(cv, (w, h) => { W = w; H = h; field(); draw(); });
    const stopLoop = loop(frame);
    return {
      restart: reset,
      key(e) {
        if (e.key === 'p') { if (!e.repeat) tr.pause(); return true; }
        if (e.key === 'z' || e.key === 'x') { if (!e.repeat) press('k' + e.key); return true; }
        if (e.key === ' ' && tr.state === 'idle') { press('space'); release('space'); return true; }
      },
      keyup(e) { release('k' + e.key); },
      destroy() {
        stopFit(); stopLoop(); clearTimeout(endTimer); tr.close();
        window.removeEventListener('blur', onBlur);
        document.removeEventListener('visibilitychange', onHide);
      },
    };
  },
};
