import { fitCanvas, loop, noScroll } from '../util.js';

// ---------------------------------------------------------------- the rules (nothing is drawn here)
// Catching somebody who runs across a gap, as in a tactical shooter. The sights do not move: they stay in
// the middle of the gap at the height of a head, and all there is to get right is the moment. Everybody
// who runs across is worth one bullet.
// Lengths are measured in heads: a head is 1 wide and the sights are at 0. A runner's place `s` is the
// middle of its head, counted in the direction it runs in, so every runner starts at a negative `s`.
export const RUNNERS = 20;
export const WIDTHS = { narrow: 6, medium: 9, wide: 12 };            // how wide the gap is
export const SPEEDS = { slow: 7, normal: 11, fast: 16, hell: 21 };   // heads a second; somebody who runs in a shooter does a little over twenty
const PAUSE = { slow: [1.1, 2.6], normal: [1, 2.3], fast: [0.9, 2], hell: [0.8, 1.8] }; // seconds of nothing before the next one
export const RELOAD = 0.45;   // seconds until the next bullet is in: a second click right after a shot does not waste it
export const AHEAD = 0.9;     // how far a figure reaches in front of the middle of its head (the shoulder, a hand)
export const BEHIND = 1.25;   // and how far behind it (the foot it pushes off with)

// How much time a combination leaves, in milliseconds: `warning` from the first glimpse of a runner to the
// moment a shot begins to kill, and `open` for how long the head then stays on the sights.
export const timing = (width, speed) => ({ warning: (WIDTHS[width] / 2 + AHEAD - 0.5) / SPEEDS[speed] * 1000, open: 1000 / SPEEDS[speed] });

export function createCrossing(width = 'medium', speed = 'normal', rnd = Math.random) {
  const gap = WIDTHS[width], v = SPEEDS[speed];
  const from = -(gap / 2 + AHEAD), to = gap / 2 + BEHIND; // out of sight behind the one wall, and behind the other
  const span = (to - from) / v;                           // seconds a runner takes from the one to the other
  // `perfect`: so many seconds after a runner shows, the middle of its head is on the sights
  const d = { gap, v, perfect: -from / v, n: 0, wait: 0, runner: null, loaded: true, heads: 0, shots: 0, results: [], events: [], over: false };
  const pause = () => PAUSE[speed][0] + rnd() * (PAUSE[speed][1] - PAUSE[speed][0]);
  let fired = false, reload = 0; // the bullet for this runner has been fired; seconds until the next one is in
  let lastDir = 0, streak = 0;
  // From which side the next one comes: 1 from the left, -1 from the right, and never four in a row from the same side.
  function side() {
    let dir = rnd() < 0.5 ? 1 : -1;
    if (dir === lastDir && streak >= 3) dir = -dir;
    streak = dir === lastDir ? streak + 1 : 1; lastDir = dir;
    return dir;
  }
  function nextRunner() {
    d.runner = null; d.n++;
    if (d.n >= RUNNERS) { d.over = true; return; }
    d.wait = pause(); fired = false; reload = RELOAD; d.loaded = false;
  }
  // How it went with a runner: 'head', 'early', 'late', or 'none' when nobody fired. `seen` says whether the
  // runner was in sight when the shot was fired; for the picture, `s` is where its head was.
  const note = (kind, ms) => {
    const r = d.runner;
    d.results.push({ kind, ms, seen: !!r });
    d.events.push({ kind, ms, dir: r ? r.dir : 0, s: r ? r.s : null });
  };
  // Time passes. A long step is taken in pieces, up to each moment a runner shows or is gone, so that a
  // round goes the same way whatever the length of the steps (a slow screen takes longer ones).
  const pass = (time) => { if (reload > 0 && (reload -= time) <= 0) d.loaded = !fired; };
  d.step = (dt) => {
    while (!d.over && dt > 0) {
      const r = d.runner, left = r ? span - r.t : d.wait; // seconds until the next thing happens
      if (dt < left) {
        if (r) { r.t += dt; r.s = from + v * r.t; } else d.wait -= dt;
        pass(dt); return;
      }
      pass(left); dt -= left;
      if (r) { r.t = span; r.s = to; if (!fired) note('none', null); nextRunner(); } // behind the other wall: with the bullet unused, nobody fired at it
      else { d.wait = 0; d.runner = { dir: side(), t: 0, s: from }; }
    }
  };
  // Fires the bullet. Answers 'head' or 'miss', or 'empty' when the bullet for this runner is gone already
  // or the next one is not in yet. What is noted with it: by how many milliseconds the shot came before (-)
  // or after (+) the moment the middle of the head is on the sights.
  d.shoot = () => {
    if (d.over || !d.loaded) return 'empty';
    d.loaded = false; fired = true; d.shots++;
    const r = d.runner, ms = Math.round(((r ? r.t : -d.wait) - d.perfect) * 1000);
    if (r && Math.abs(r.s) <= 0.5) { d.heads++; note('head', ms); nextRunner(); return 'head'; }
    note(ms < 0 ? 'early' : 'late', ms); // whoever was missed runs on, and gets away
    return 'miss';
  };
  // By how much the shots at somebody in sight were off on average: negative means too early.
  d.offset = () => {
    const shots = d.results.filter((r) => r.seen && r.kind !== 'none');
    return shots.length ? Math.round(shots.reduce((sum, r) => sum + r.ms, 0) / shots.length) : null;
  };
  d.wait = pause();
  return d;
}

// ---------------------------------------------------------------- the game on screen
const wall = () => performance.now() / 1000;
const WIDTH_NAMES = { narrow: 'Narrow', medium: 'Medium', wide: 'Wide' }, SPEED_NAMES = { slow: 'Slow', normal: 'Normal', fast: 'Fast', hell: 'Hell' };
// The picture is nine heads high; how many heads wide it is follows from its shape (twenty on a desktop, fourteen on a phone).
const TALL = 9, LINTEL = 0.9, EYES = 3.1, FEET = 7.4, SILL = 7.75; // from the top: under the lintel, the middle of a head, the feet, where the walls stand

export default {
  id: 'onetap', name: 'One Tap', icon: 'door-open', color: '#a3e635', tag: 'Skill', since: '1.1',
  desc: 'For shooter players: your sights hold a gap at head height, and somebody runs across. One bullet for each.',
  help: 'Click, tap or press Space to fire · the sights stay where they are, only the moment counts · one bullet for each runner · the width of the gap and the speed are up to you',
  scoreLabel: 'Heads',
  // every width with every speed, each with a best score of its own
  variants: Object.fromEntries(Object.entries(WIDTH_NAMES).flatMap(([w, wide]) => Object.entries(SPEED_NAMES).map(([s, fast]) => [`${w}-${s}`, `${wide} · ${fast}`]))),
  defaultVariant: () => 'medium-normal',
  create(stage, api) {
    const seg = (id, title, names) => `<div class="ot-set"><span>${title}</span><div class="seg" id="${id}">${Object.entries(names).map(([key, name]) => `<button data-v="${key}">${name}</button>`).join('')}</div></div>`;
    stage.innerHTML = `
      <div class="ot-top">${seg('ot-width', 'Gap', WIDTH_NAMES)}${seg('ot-speed', 'Speed', SPEED_NAMES)}</div>
      <canvas class="onetap" id="ot-c"></canvas>`;
    const cv = stage.querySelector('#ot-c'), ctx = cv.getContext('2d');
    const font = getComputedStyle(document.body).fontFamily;
    let W = 1, H = 1, width, speed, game, state = 'ready', last = wall(), shown = 0, pops = [], ghosts = [], fallen = [], firedAt = -9, endTimer = null;

    function reset() {
      clearTimeout(endTimer); api.hideOverlay();
      [width, speed] = String(api.variant()).split('-');
      if (!WIDTHS[width] || !SPEEDS[speed]) [width, speed] = ['medium', 'normal'];
      for (const b of stage.querySelectorAll('#ot-width button')) b.classList.toggle('on', b.dataset.v === width);
      for (const b of stage.querySelectorAll('#ot-speed button')) b.classList.toggle('on', b.dataset.v === speed);
      game = createCrossing(width, speed); state = 'ready'; pops = []; ghosts = []; fallen = [];
      api.score(0); api.status(`${RUNNERS} runners`);
    }
    function begin() { state = 'play'; last = wall(); shown = 0; api.status(`Runner 1 of ${RUNNERS}`); }

    // ------------------------------------------------------------ what is drawn
    // A little devil seen from the front, the middle of its head at x. `dir` is the side it runs to, `stride`
    // how far it has come, which moves the legs, and `fall` goes from 0 to 1 once it has been shot.
    function figure(x, dir, stride, fall = 0) {
      const u = H / TALL, r = u / 2, edge = Math.max(1.5, u * 0.06), step = stride * 2.6;
      ctx.save();
      ctx.translate(x, EYES * u);
      if (fall) { ctx.globalAlpha = Math.max(0, 1 - fall * fall); ctx.translate(0, fall * u * 0.9); ctx.rotate(-dir * fall * 1.2); }
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.save();
      ctx.transform(1, 0, -dir * 0.08, 1, 0, 0); // it leans into the run: the feet come a little behind the head
      const limb = (x1, y1, x2, y2, thick, colour) => {
        for (const [w, c] of [[thick + edge * 2, '#150707'], [thick, colour]]) { ctx.lineWidth = w; ctx.strokeStyle = c; ctx.beginPath(); ctx.moveTo(x1 * u, y1 * u); ctx.lineTo(x2 * u, y2 * u); ctx.stroke(); }
      };
      // it runs sideways, as somebody does who keeps facing the gap: the feet go apart and together, and the one that moves is off the floor
      const apart = 0.3 + 0.28 * (0.5 - 0.5 * Math.cos(step));
      for (const leg of [-1, 1]) limb(leg * 0.28, 2.6, leg * apart, FEET - EYES - 0.17 - 0.2 * Math.max(0, leg * Math.sin(step)), u * 0.34, '#7f1d1d');
      ctx.lineWidth = edge; ctx.strokeStyle = '#150707'; ctx.fillStyle = '#991b1b';
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-0.65 * u, 0.45 * u, 1.3 * u, 2.35 * u, 0.35 * u); else ctx.rect(-0.65 * u, 0.45 * u, 1.3 * u, 2.35 * u); ctx.fill(); ctx.stroke();
      for (const arm of [-1, 1]) limb(arm * 0.62, 0.95, arm * (0.66 + 0.2 * (0.5 + 0.5 * arm * Math.sin(step))), 1.9, u * 0.26, '#b91c1c'); // the arms swing a little
      ctx.restore();
      // the head stands straight, so that it is exactly as wide as the rules take it to be
      ctx.lineWidth = edge; ctx.strokeStyle = '#150707';
      ctx.fillStyle = '#fde68a';
      for (const horn of [-1, 1]) { ctx.beginPath(); ctx.moveTo(horn * r * 0.4, -r * 0.75); ctx.lineTo(horn * r * 1.05, -r * 1.5); ctx.lineTo(horn * r * 0.92, -r * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff7ed'; for (const eye of [-1, 1]) { ctx.beginPath(); ctx.arc(eye * r * 0.36, -r * 0.05, r * 0.2, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#18090a'; for (const eye of [-1, 1]) { ctx.beginPath(); ctx.arc(eye * r * 0.36 + dir * r * 0.08, -r * 0.03, r * 0.09, 0, Math.PI * 2); ctx.fill(); } // it looks where it is running
      ctx.restore();
    }
    function draw() {
      const t = wall(), u = H / TALL, cx = W / 2, half = game.gap / 2 * u, hy = EYES * u, thin = Math.max(1, u * 0.04);
      // the room behind the gap and whoever is in it
      ctx.fillStyle = '#0b0606'; ctx.fillRect(0, 0, W, H);
      const glow = ctx.createLinearGradient(0, LINTEL * u, 0, 6.6 * u);
      glow.addColorStop(0, '#2a0f0c'); glow.addColorStop(1, '#6b1f12');
      ctx.fillStyle = glow; ctx.fillRect(cx - half, LINTEL * u, half * 2, (6.6 - LINTEL) * u);
      ctx.fillStyle = '#35130e'; ctx.fillRect(cx - half, 6.6 * u, half * 2, (SILL - 6.6) * u);
      fallen = fallen.filter((f) => t - f.at < 0.45);
      for (const f of fallen) figure(cx + f.x * u, f.dir, f.stride, (t - f.at) / 0.45);
      const r = game.runner;
      if (r) figure(cx + r.dir * r.s * u, r.dir, r.s);
      // where the head was when a shot missed it
      ghosts = ghosts.filter((g) => t - g.at < 0.7);
      for (const g of ghosts) {
        ctx.globalAlpha = 1 - (t - g.at) / 0.7; ctx.strokeStyle = '#fca5a5'; ctx.lineWidth = Math.max(1.5, u * 0.05); ctx.setLineDash([u * 0.16, u * 0.12]);
        ctx.beginPath(); ctx.arc(cx + g.x * u, hy, u / 2, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      }
      // the two walls in front, and the light that falls through the gap on the floor
      ctx.fillStyle = '#21110f'; ctx.fillRect(0, SILL * u, W, H - SILL * u);
      const spill = ctx.createLinearGradient(0, SILL * u, 0, H);
      spill.addColorStop(0, 'rgba(107,31,18,.6)'); spill.addColorStop(1, 'rgba(107,31,18,0)');
      ctx.fillStyle = spill; ctx.beginPath(); ctx.moveTo(cx - half, SILL * u); ctx.lineTo(cx + half, SILL * u); ctx.lineTo(cx + half + u * 1.2, H); ctx.lineTo(cx - half - u * 1.2, H); ctx.closePath(); ctx.fill();
      for (const side of [-1, 1]) {
        const x0 = side < 0 ? 0 : cx + half, w = cx - half, high = (SILL - LINTEL) / 6 * u;
        ctx.fillStyle = '#2b1614'; ctx.fillRect(x0, LINTEL * u, w, (SILL - LINTEL) * u);
        ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = thin; ctx.beginPath();
        for (let row = 0; row < 6; row++) { // the stones of the wall, laid out from the edge of the gap
          const y = LINTEL * u + row * high;
          if (row) { ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y); }
          for (let k = row % 2 ? 1.1 : 2.2; k * u < w; k += 2.2) { const x = cx + side * (half + k * u); ctx.moveTo(x, y); ctx.lineTo(x, y + high); }
        }
        ctx.stroke();
        ctx.fillStyle = '#5b3424'; ctx.fillRect(cx + side * half - (side < 0 ? u * 0.12 : 0), LINTEL * u, u * 0.12, (SILL - LINTEL) * u); // the edge of the gap catches the light
      }
      ctx.fillStyle = '#1b0e0d'; ctx.fillRect(0, 0, W, LINTEL * u);
      // how it went so far: a dot for every runner
      for (let k = 0; k < RUNNERS; k++) {
        const res = game.results[k];
        ctx.fillStyle = !res ? 'rgba(255,255,255,.18)' : res.kind === 'head' ? '#4ade80' : res.kind === 'none' ? '#a8a29e' : '#ef4444';
        ctx.beginPath(); ctx.arc(cx + (k - (RUNNERS - 1) / 2) * u * 0.5, LINTEL * u / 2, u * 0.13, 0, Math.PI * 2); ctx.fill();
      }
      pops = pops.filter((p) => t - p.at < 1);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 ${Math.max(12, u * 0.42)}px ${font}`;
      for (const p of pops) {
        const k = t - p.at, y = (EYES - 1.45 - k * 0.3) * u;
        ctx.globalAlpha = 1 - k * k;
        ctx.lineWidth = Math.max(3, u * 0.1); ctx.strokeStyle = 'rgba(11,6,6,.85)'; ctx.strokeText(p.text, cx, y);
        ctx.fillStyle = p.color; ctx.fillText(p.text, cx, y);
      }
      ctx.globalAlpha = 1;
      // the sights: green while the bullet is in, pale once it has been fired (and after the last runner, when there is none left)
      const kick = Math.max(0, 1 - (t - firedAt) / 0.12) * u * 0.2, open = u * 0.14 + kick, len = u * 0.3, bullet = state === 'ready' || (state === 'play' && game.loaded);
      for (const [w, colour] of [[Math.max(3.5, u * 0.11), 'rgba(5,20,10,.75)'], [Math.max(1.5, u * 0.055), bullet ? '#4ade80' : 'rgba(255,255,255,.45)']]) {
        ctx.strokeStyle = colour; ctx.lineWidth = w; ctx.lineCap = 'butt'; ctx.beginPath();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(cx + dx * open, hy + dy * open); ctx.lineTo(cx + dx * (open + len), hy + dy * (open + len)); }
        ctx.stroke();
        ctx.fillStyle = colour; ctx.fillRect(cx - w / 2, hy - w / 2, w, w);
      }
      if (state === 'ready') {
        ctx.fillStyle = 'rgba(10,6,6,.6)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#f6f1ef'; ctx.font = `700 ${Math.max(15, u * 0.62)}px ${font}`; ctx.fillText('Click or tap to start', cx, H * 0.6);
        ctx.fillStyle = '#aca09f'; ctx.font = `500 ${Math.max(11, u * 0.38)}px ${font}`; ctx.fillText('Fire when the head is on the sights.', cx, H * 0.6 + Math.max(20, u * 0.8));
      }
    }

    // ------------------------------------------------------------ the round
    const off = (ms) => (Math.abs(ms) < 1000 ? `${Math.abs(ms)} ms` : `${(Math.abs(ms) / 1000).toFixed(1)} s`) + (ms < 0 ? ' early' : ' late');
    // The time that has passed since the last look goes into the rules first, so that a shot is judged by the
    // very moment of the click and not by the picture before it.
    function advance() {
      const now = wall();
      game.step(Math.min(0.05, Math.max(0, now - last)));
      last = now;
      for (const ev of game.events.splice(0)) {
        if (ev.kind === 'head') { fallen.push({ at: now, x: ev.dir * ev.s, dir: ev.dir, stride: ev.s }); pops.push({ at: now, text: Math.abs(ev.ms) <= 4 ? 'HEADSHOT' : `HEADSHOT · ${off(ev.ms)}`, color: '#fde047' }); }
        else if (ev.kind === 'none') pops.push({ at: now, text: 'no shot', color: '#d6d3d1' });
        else {
          if (ev.s !== null) ghosts.push({ at: now, x: ev.dir * ev.s });
          pops.push({ at: now, text: off(ev.ms), color: '#f87171' });
        }
        api.score(game.heads);
      }
      if (game.over) {
        state = 'over';
        const count = (kind) => game.results.filter((res) => res.kind === kind).length, avg = game.offset();
        const misses = [count('early') && `${count('early')} early`, count('late') && `${count('late')} late`, count('none') && `${count('none')} without a shot`].filter(Boolean).join(', ');
        const text = [`${game.heads} of ${RUNNERS} heads`, misses, avg !== null && game.shots >= 3 && `on average ${off(avg)}`].filter(Boolean).join(' · ');
        endTimer = setTimeout(() => api.finish(game.heads, { text, endTitle: 'Round over' }), 600);
      } else if (game.n !== shown) { shown = game.n; api.status(`Runner ${game.n + 1} of ${RUNNERS}`); }
    }
    function fire() {
      if (state === 'ready') { begin(); return; }
      if (state !== 'play') return;
      advance();
      if (state !== 'play') return;
      if (game.shoot() !== 'empty') firedAt = wall();
      advance();
    }
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); fire(); });
    noScroll(cv);
    stage.querySelector('.ot-top').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      b.blur();
      api.variant(b.closest('#ot-width') ? `${b.dataset.v}-${speed}` : `${width}-${b.dataset.v}`);
      reset();
    });
    reset();
    const stopFit = fitCanvas(cv, (w, h) => { W = w; H = h; draw(); });
    const stopLoop = loop(() => { if (state === 'play') advance(); draw(); });
    return {
      restart: reset,
      key(e) { if (e.key === ' ' || e.key === 'Enter') { if (!e.repeat) fire(); return true; } },
      destroy() { stopFit(); stopLoop(); clearTimeout(endTimer); },
    };
  },
};
