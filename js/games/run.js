import { fitCanvas, loop, noScroll } from '../util.js';

// ---------------------------------------------------------------- the rules (nothing is drawn here)
// Everything is measured in units; WORLD of them fit on the screen from left to right. The ground is at
// height 0 and up is positive. An obstacle is a box: x and w along the ground, y and h above it.
export const WORLD = 440;
export const DEVIL = { x: 56, w: 30, h: 46, low: 24 }; // where the devil runs, how wide and tall it is, and how tall when it ducks
const GRAVITY = 2600, JUMP = 760;                      // a jump is 111 units high and lasts 0.58 s
const START_SPEED = 300, TOP_SPEED = 720, SPEED_UP = 7; // units a second, and how much is added every second
const BUFFER = 0.12;                                   // a jump asked for this long before landing still happens
export const KINDS = {
  flame: { w: 22, h: 36, y: 0 },
  flames: { w: 46, h: 36, y: 0 },
  fire: { w: 70, h: 38, y: 0 },
  spike: { w: 24, h: 60, y: 0 },
  low: { w: 30, h: 24, y: 30 },   // a fireball to duck under or to jump over
  high: { w: 30, h: 24, y: 60 },  // a fireball that passes overhead: just do not jump
};

export function createRun(rnd = Math.random) {
  const r = { y: 0, vy: 0, ducking: false, speed: START_SPEED, dist: 0, score: 0, obstacles: [], dead: false, hit: null };
  let nextAt = 380, wanted = 0;
  r.jump = () => { wanted = BUFFER; };
  r.duck = (on) => { r.ducking = on; };
  r.step = (dt) => {
    if (r.dead) return;
    r.speed = Math.min(TOP_SPEED, r.speed + SPEED_UP * dt);
    r.dist += r.speed * dt; r.score = Math.floor(r.dist / 10);
    if (wanted > 0) { if (r.y === 0) { r.vy = JUMP; wanted = 0; } else wanted -= dt; }
    if (r.y > 0 || r.vy > 0) {
      r.vy -= GRAVITY * (r.ducking ? 2.4 : 1) * dt; // ducking in the air brings the devil down sooner
      r.y = Math.max(0, r.y + r.vy * dt);
      if (r.y === 0) r.vy = 0;
    }
    for (const o of r.obstacles) o.x -= r.speed * dt;
    r.obstacles = r.obstacles.filter((o) => o.x + o.w > -60);
    if (r.dist >= nextAt) {
      // fireballs turn up once the run is under way; the further, the more of them
      const far = Math.min(1, r.score / 1500), roll = rnd();
      const kind = r.score > 150 && roll < 0.12 + far * 0.2 ? (rnd() < 0.55 ? 'low' : 'high') : ['flame', 'flame', 'flames', 'spike', 'fire'][Math.floor(rnd() * (r.score > 80 ? 5 : 3))];
      r.obstacles.push({ kind, x: WORLD + 30, ...KINDS[kind] });
      // the next one comes no sooner than a jump takes, and sooner the faster the run is
      nextAt = r.dist + KINDS[kind].w + r.speed * (1.05 - far * 0.33 + rnd() * 0.8);
    }
    const tall = r.ducking && r.y === 0 ? DEVIL.low : DEVIL.h;
    for (const o of r.obstacles) { // the boxes are a little smaller than the pictures: a close shave is not a hit
      if (o.x + 4 < DEVIL.x + DEVIL.w - 5 && o.x + o.w - 4 > DEVIL.x + 5 && o.y + 3 < r.y + tall - 4 && o.y + o.h - 3 > r.y) { r.dead = true; r.hit = o; }
    }
  };
  return r;
}

// ---------------------------------------------------------------- the game on screen
const wall = () => performance.now() / 1000;

export default {
  id: 'run', name: 'Hell Run', icon: 'footprints', color: '#f97316', tag: 'Arcade', since: '1.1',
  desc: 'A little devil runs through hell and never stops. Jump the flames, duck under the fireballs.',
  help: 'Space, the up arrow or a tap jumps · the down arrow ducks, and in the air it brings you down sooner · it gets faster all the time',
  create(stage, api) {
    stage.innerHTML = `
      <canvas class="run" id="rn-c"></canvas>
      <div class="rn-keys touch-only"><button id="rn-duck">Duck</button><button id="rn-jump">Jump</button></div>`;
    const cv = stage.querySelector('#rn-c'), ctx = cv.getContext('2d');
    const font = getComputedStyle(document.body).fontFamily;
    let W = 1, H = 1, run = createRun(), state = 'ready', endTimer = null, shown = -1, deadAt = 0;
    const embers = Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random(), s: 0.4 + Math.random() * 0.8 }));
    const hills = [0, 1].map((layer) => Array.from({ length: 40 }, () => 0.35 + Math.random() * 0.65 * (layer ? 0.7 : 1)));

    function jump() {
      if (state === 'ready') { state = 'run'; api.status(''); }
      if (state === 'run') run.jump();
    }
    function over() {
      state = 'dead'; deadAt = wall();
      endTimer = setTimeout(() => api.finish(run.score), 550);
    }

    // ---- drawing: u is one unit in pixels, gy the ground line
    function devil(x, y, u, t, low, air, dead) {
      const tall = low && !air ? DEVIL.low : DEVIL.h, wide = low && !air ? DEVIL.w + 10 : DEVIL.w;
      const X = (k) => x + k * u, Y = (k) => y - k * u;
      ctx.lineWidth = Math.max(1.5, 2 * u); ctx.strokeStyle = '#3b0a0a'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      const step = air ? 0.6 : Math.sin(t * 22), legs = Y(low && !air ? 6 : 12);
      // tail
      ctx.beginPath(); ctx.moveTo(X(4), Y(tall * 0.35)); ctx.quadraticCurveTo(X(-12), Y(tall * 0.3), X(-10), Y(tall * 0.75)); ctx.strokeStyle = '#b91c1c'; ctx.lineWidth = Math.max(2, 3 * u); ctx.stroke();
      ctx.fillStyle = '#b91c1c'; ctx.beginPath(); ctx.moveTo(X(-10), Y(tall * 0.75 + 7)); ctx.lineTo(X(-14.5), Y(tall * 0.75 - 2)); ctx.lineTo(X(-5.5), Y(tall * 0.75 - 2)); ctx.closePath(); ctx.fill();
      // legs: two, swinging against each other; tucked up in the air
      ctx.strokeStyle = '#7f1d1d'; ctx.lineWidth = Math.max(2, 4 * u);
      for (const side of [-1, 1]) {
        const swing = air ? side * 5 : side * step * 8;
        ctx.beginPath(); ctx.moveTo(X(wide * 0.45 + side * 4), legs); ctx.lineTo(X(wide * 0.45 + side * 4 + swing), Y(air ? 4 : 0)); ctx.stroke();
      }
      // body and head in one rounded shape
      ctx.strokeStyle = '#3b0a0a'; ctx.lineWidth = Math.max(1.5, 2 * u); ctx.fillStyle = dead ? '#fca5a5' : '#ef4444';
      const top = Y(tall), bottom = legs, r = Math.min(wide, tall - 10) * 0.45 * u;
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(X(1), top, (wide - 2) * u, bottom - top, r); else ctx.rect(X(1), top, (wide - 2) * u, bottom - top); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f87171'; ctx.beginPath(); ctx.ellipse(X(wide * 0.38), top + (bottom - top) * 0.26, wide * 0.16 * u, 2.6 * u, -0.4, 0, Math.PI * 2); ctx.fill();
      // horns
      ctx.fillStyle = '#fde68a';
      for (const k of [0.3, 0.72]) { ctx.beginPath(); ctx.moveTo(X(wide * k - 4), top + 2 * u); ctx.lineTo(X(wide * k + 1), top - 9 * u); ctx.lineTo(X(wide * k + 4.5), top + 2 * u); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      // the eye looks ahead; a cross when the run is over
      const ex = X(wide * 0.68), ey = top + Math.min(13, tall * 0.36) * u;
      if (dead) { ctx.lineWidth = Math.max(1.5, 2.2 * u); ctx.beginPath(); ctx.moveTo(ex - 3.5 * u, ey - 3.5 * u); ctx.lineTo(ex + 3.5 * u, ey + 3.5 * u); ctx.moveTo(ex + 3.5 * u, ey - 3.5 * u); ctx.lineTo(ex - 3.5 * u, ey + 3.5 * u); ctx.stroke(); }
      else {
        ctx.fillStyle = '#fff7ed'; ctx.beginPath(); ctx.ellipse(ex, ey, 5 * u, 5.6 * u, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#18090a'; ctx.beginPath(); ctx.arc(ex + 1.8 * u, ey + 0.4 * u, 2.3 * u, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = Math.max(1.5, 2.4 * u); ctx.beginPath(); ctx.moveTo(ex - 6 * u, ey - 8 * u); ctx.lineTo(ex + 5 * u, ey - 5 * u); ctx.stroke(); // a stern brow
      }
    }
    function flame(x, base, w, h, u, t, seed) {
      const tongues = Math.max(1, Math.round(w / 22));
      for (let k = 0; k < tongues; k++) {
        const cx = x + (k + 0.5) * (w / tongues) * u, wave = Math.sin(t * 13 + seed + k * 2.1), hh = h * (0.86 + 0.14 * wave) * u, ww = (w / tongues) * 0.58 * u;
        for (const [scale, color] of [[1, '#f0531c'], [0.66, '#fb923c'], [0.36, '#fde047']]) {
          ctx.fillStyle = color; ctx.beginPath();
          ctx.moveTo(cx - ww * scale, base);
          ctx.quadraticCurveTo(cx - ww * scale * 1.25, base - hh * scale * 0.5, cx + wave * 2.5 * u, base - hh * scale);
          ctx.quadraticCurveTo(cx + ww * scale * 1.25, base - hh * scale * 0.5, cx + ww * scale, base);
          ctx.closePath(); ctx.fill();
        }
      }
    }
    function draw() {
      const t = wall(), u = W / WORLD, gy = H - Math.max(26 * u, H * 0.17), far = run.dist;
      const sky = ctx.createLinearGradient(0, 0, 0, gy);
      sky.addColorStop(0, '#0d0606'); sky.addColorStop(0.7, '#2a0c0a'); sky.addColorStop(1, '#5a1a10');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      // two rows of crags that slide by slower than the ground
      hills.forEach((row, layer) => {
        const wide = (layer ? 46 : 70) * u, shift = (far * (layer ? 0.3 : 0.12) * u) % (wide * row.length), tall = (layer ? 50 : 86) * u;
        ctx.fillStyle = layer ? '#230b0a' : '#190808'; ctx.beginPath(); ctx.moveTo(0, gy);
        for (let i = -1; i * wide - (shift % wide) < W + wide; i++) {
          const k = (((i + Math.floor(shift / wide)) % row.length) + row.length) % row.length, x = i * wide - (shift % wide);
          ctx.lineTo(x, gy - tall * row[k] * 0.35); ctx.lineTo(x + wide * 0.5, gy - tall * row[k]);
        }
        ctx.lineTo(W, gy); ctx.closePath(); ctx.fill();
      });
      for (const e of embers) { // sparks rising
        const y = ((e.y - t * 0.05 * e.s) % 1 + 1) % 1, x = ((e.x - far * 0.0004 * e.s) % 1 + 1) % 1;
        ctx.globalAlpha = 0.25 + 0.5 * y; ctx.fillStyle = '#fb923c'; ctx.fillRect(x * W, y * gy, Math.max(1, 1.6 * u * e.s), Math.max(1, 1.6 * u * e.s));
      }
      ctx.globalAlpha = 1;
      // the ground: scorched rock with a glowing rim and cracks that rush by
      ctx.fillStyle = '#1a0908'; ctx.fillRect(0, gy, W, H - gy);
      const rim = ctx.createLinearGradient(0, gy, 0, gy + 7 * u);
      rim.addColorStop(0, '#ff7a3d'); rim.addColorStop(1, 'rgba(240,83,28,0)');
      ctx.fillStyle = rim; ctx.fillRect(0, gy, W, 7 * u);
      ctx.strokeStyle = '#4a1711'; ctx.lineWidth = Math.max(1, 1.5 * u); ctx.beginPath();
      for (let x = -((far * u) % (64 * u)); x < W; x += 64 * u) { ctx.moveTo(x, gy + 12 * u); ctx.lineTo(x + 16 * u, gy + 12 * u); ctx.moveTo(x + 34 * u, gy + 21 * u); ctx.lineTo(x + 42 * u, gy + 21 * u); }
      ctx.stroke();

      for (const o of run.obstacles) {
        const x = o.x * u, base = gy - o.y * u;
        if (o.kind === 'spike') {
          ctx.fillStyle = '#34110e'; ctx.strokeStyle = '#7f1d1d'; ctx.lineWidth = Math.max(1, 1.5 * u);
          ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x + o.w * 0.38 * u, base - o.h * 0.55 * u); ctx.lineTo(x + o.w * 0.5 * u, base - o.h * u); ctx.lineTo(x + o.w * 0.68 * u, base - o.h * 0.45 * u); ctx.lineTo(x + o.w * u, base); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#ff7a3d'; ctx.beginPath(); ctx.arc(x + o.w * 0.5 * u, base - o.h * u, 2.2 * u, 0, Math.PI * 2); ctx.fill();
        } else if (o.y > 0) { // a fireball with its tail behind it
          const cx = x + o.w * 0.42 * u, cy = base - o.h * 0.5 * u, rad = o.h * 0.5 * u;
          for (let k = 3; k >= 1; k--) { ctx.globalAlpha = 0.22 * (4 - k); ctx.fillStyle = '#f0531c'; ctx.beginPath(); ctx.ellipse(cx + k * rad * 0.8, cy + Math.sin(t * 18 + k) * rad * 0.15, rad * (1 - k * 0.2), rad * (0.8 - k * 0.18), 0, 0, Math.PI * 2); ctx.fill(); }
          ctx.globalAlpha = 1;
          const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
          glow.addColorStop(0, '#fff7c2'); glow.addColorStop(0.45, '#fbbf24'); glow.addColorStop(1, '#ea580c');
          ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
        } else flame(x, base, o.w, o.h, u, t, o.w);
      }
      const shake = state === 'dead' ? Math.max(0, 1 - (t - deadAt) / 0.3) * 4 * u : 0;
      devil(DEVIL.x * u + Math.sin(t * 90) * shake, gy - run.y * u, u, state === 'run' ? t : 0, run.ducking, run.y > 0, state === 'dead');

      if (state === 'ready') {
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#f6f1ef'; ctx.font = `700 ${Math.max(15, 22 * u)}px ${font}`; ctx.fillText('Press Space or tap to run', W / 2, gy * 0.4);
        ctx.fillStyle = '#aca09f'; ctx.font = `500 ${Math.max(11, 13 * u)}px ${font}`; ctx.fillText('Jump the flames, duck under the fireballs', W / 2, gy * 0.4 + Math.max(20, 28 * u));
      }
    }
    function frame(dt) {
      if (state === 'run') {
        for (let left = dt; left > 0; left -= 1 / 120) run.step(Math.min(left, 1 / 120)); // small steps: nothing slips through at speed
        if (run.score !== shown) { shown = run.score; api.score(shown); }
        if (run.dead) over();
      }
      draw();
    }

    // ---- input
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); jump(); });
    const duckBtn = stage.querySelector('#rn-duck'), jumpBtn = stage.querySelector('#rn-jump');
    jumpBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); jump(); });
    duckBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); run.duck(true); });
    for (const type of ['pointerup', 'pointercancel', 'pointerleave']) duckBtn.addEventListener(type, () => run.duck(false));
    noScroll(cv, duckBtn, jumpBtn);
    api.status('Ready when you are');
    const stopFit = fitCanvas(cv, (w, h) => { W = w; H = h; draw(); });
    const stopLoop = loop(frame);
    return {
      key(e) {
        if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') { if (!e.repeat) jump(); return true; }
        if (e.key === 'ArrowDown' || e.key === 's') { run.duck(true); return true; }
      },
      keyup(e) { if (e.key === 'ArrowDown' || e.key === 's') run.duck(false); },
      destroy() { stopFit(); stopLoop(); clearTimeout(endTimer); },
    };
  },
};
