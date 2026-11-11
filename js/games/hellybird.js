import { fitCanvas, loop, clamp, noScroll } from '../util.js';

// The world is 360 x 480 units and is scaled to whatever size the canvas has on screen.
const VW = 360, VH = 480, GROUND = 56, FLOOR = VH - GROUND;
const BIRD_X = 100, BIRD_R = 13.5;
const GRAVITY = 1150, FLAP = -335, MAX_FALL = 520;       // units per second (squared)
const SPEED = 140, PIPE_W = 58, GAP = 128, SPACING = 195;
const STEP = 1 / 120;                                    // physics runs in fixed steps: same feel on 60 Hz and 240 Hz screens
const FLAP_KEYS = new Set([' ', 'ArrowUp', 'w']);
const TAU = Math.PI * 2;

// Small repeatable random generator, used for scenery that must look the same every frame.
function seeded(seed) {
  return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export default {
  id: 'hellybird', name: 'Helly Bird', icon: 'bird', color: '#ef4444', tag: 'Arcade',
  desc: 'Flap a little devil between the pillars of hell. One touch and it’s over.',
  help: 'Click, tap or press Space to flap',
  create(stage, api) {
    stage.innerHTML = `<canvas class="hellybird" id="hb-c"></canvas>`;
    const cv = stage.querySelector('#hb-c'), ctx = cv.getContext('2d');
    let W = 1;
    let state = 'ready', score = 0, t = 0, acc = 0, scroll = 0, flash = 0, wing = 1, endTimer = null, landed = false;
    const bird = { y: VH * 0.45, vy: 0 };
    let pipes = [];

    // Scenery. It is generated once from a fixed seed, so hell looks the same on every visit.
    const rnd = seeded(7);
    const embers = Array.from({ length: 44 }, () => ({ x: rnd() * VW, y: rnd() * FLOOR, r: 0.6 + rnd() * 1.1, p: rnd() * TAU, v: 6 + rnd() * 16 }));
    const RANGE = 720; // the rock spires on the horizon and the teeth of the ceiling repeat every 720 units
    const spires = []; for (let x = 0; x < RANGE;) { const w = 24 + rnd() * 30; spires.push({ x, w, h: 30 + rnd() * 84, lit: rnd() }); x += w + 2; }
    const teeth = []; for (let x = 0; x < RANGE;) { const w = 14 + rnd() * 22; teeth.push({ x, w, h: 6 + rnd() * 13 }); x += w; }
    const crust = Array.from({ length: 16 }, (_, i) => ({ x: i * 45 + rnd() * 20, y: 14 + rnd() * 30, w: 16 + rnd() * 22, h: 3 + rnd() * 4 }));

    function addPipe() {
      const last = pipes[pipes.length - 1];
      const lo = 48 + GAP / 2, hi = FLOOR - 48 - GAP / 2;
      let y = lo + Math.random() * (hi - lo);
      if (last) y = clamp(y, last.y - 150, last.y + 150); // never an impossible climb between two pipes
      pipes.push({ x: last ? last.x + SPACING : VW + 110, y, passed: false });
    }

    function flap() {
      if (state === 'dead') return;
      if (state === 'ready') { state = 'play'; for (let i = 0; i < 3; i++) addPipe(); }
      bird.vy = FLAP; wing = 0;
    }

    function touchesPipe(p) {
      const r = BIRD_R * 0.9; // slightly forgiving
      const hits = (ry, rh) => { const cx = clamp(BIRD_X, p.x, p.x + PIPE_W), cy = clamp(bird.y, ry, ry + rh); return (BIRD_X - cx) ** 2 + (bird.y - cy) ** 2 < r * r; };
      return hits(-1000, 1000 + p.y - GAP / 2) || hits(p.y + GAP / 2, 1000);
    }

    function die() { state = 'dead'; flash = 1; bird.vy = Math.max(bird.vy, 0); }

    function step(h) {
      t += h; wing = Math.min(1, wing + h * 4); flash = Math.max(0, flash - h * 4);
      if (state === 'ready') { bird.y = VH * 0.45 + Math.sin(t * 6) * 5; scroll += SPEED * h; return; }
      bird.vy = Math.min(MAX_FALL, bird.vy + GRAVITY * h);
      bird.y += bird.vy * h;
      if (state === 'play') {
        scroll += SPEED * h;
        for (const p of pipes) {
          p.x -= SPEED * h;
          if (!p.passed && p.x + PIPE_W / 2 < BIRD_X) { p.passed = true; score++; api.score(score); }
        }
        if (pipes[0].x + PIPE_W < -8) { pipes.shift(); addPipe(); }
        if (bird.y < BIRD_R) { bird.y = BIRD_R; bird.vy = Math.max(0, bird.vy); }
        if (pipes.some(touchesPipe) || bird.y + BIRD_R >= FLOOR) die();
      }
      if (bird.y + BIRD_R >= FLOOR) {
        bird.y = FLOOR - BIRD_R; bird.vy = 0;
        if (state === 'dead' && !landed) { landed = true; endTimer = setTimeout(() => api.finish(score), 450); }
      }
    }

    // A pillar of dark rock; its end towards the gap is a wider slab with a glowing edge.
    function drawPillar(p) {
      const body = ctx.createLinearGradient(p.x, 0, p.x + PIPE_W, 0);
      body.addColorStop(0, '#1d0a09'); body.addColorStop(0.28, '#6b2a1e'); body.addColorStop(0.6, '#34120f'); body.addColorStop(1, '#120505');
      const part = (y, h, slabAtBottom) => {
        ctx.fillStyle = body; ctx.strokeStyle = '#080202'; ctx.lineWidth = 2;
        ctx.fillRect(p.x, y, PIPE_W, h); ctx.strokeRect(p.x, y, PIPE_W, h);
        ctx.strokeStyle = 'rgba(8,2,2,.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); // the joints between the blocks
        for (let jy = slabAtBottom ? y + h - 46 : y + 46; jy > y + 6 && jy < y + h - 6; jy += slabAtBottom ? -22 : 22) { ctx.moveTo(p.x + 1, jy); ctx.lineTo(p.x + PIPE_W - 1, jy); }
        ctx.stroke();
        const sy = slabAtBottom ? y + h - 24 : y, sx = p.x - 4, sw = PIPE_W + 8;
        const slab = ctx.createLinearGradient(sx, 0, sx + sw, 0);
        slab.addColorStop(0, '#240c0a'); slab.addColorStop(0.28, '#8a3a26'); slab.addColorStop(0.6, '#45170f'); slab.addColorStop(1, '#170606');
        ctx.fillStyle = slab; ctx.strokeStyle = '#080202'; ctx.lineWidth = 2;
        ctx.fillRect(sx, sy, sw, 24); ctx.strokeRect(sx, sy, sw, 24);
        const edge = slabAtBottom ? sy + 24 : sy;
        ctx.fillStyle = 'rgba(255,110,40,.3)'; ctx.fillRect(sx, slabAtBottom ? edge - 7 : edge, sw, 7);
        ctx.fillStyle = '#ff7a2e'; ctx.fillRect(sx, slabAtBottom ? edge - 3 : edge, sw, 3);
      };
      part(-4, p.y - GAP / 2 + 4, true);
      part(p.y + GAP / 2, FLOOR - (p.y + GAP / 2), false);
    }

    const WING = new Path2D('M1 -3 L-13 -17 Q-10 -11 -18 -8 Q-11 -6 -15 2 Q-8 -1 -1 4 Z');
    function drawWing(x, y, angle, color) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
      ctx.fillStyle = color; ctx.fill(WING); ctx.stroke(WING);
      ctx.restore();
    }

    // The hero: a small devil with bat wings. It fits the same circle (BIRD_R) that the collisions use.
    function drawImp() {
      const tilt = state === 'ready' ? 0 : clamp(bird.vy / 420, -0.45, 1.35);
      const beat = state === 'dead' ? 0.25 : Math.sin(state === 'ready' ? t * 14 : (1 - wing) * Math.PI); // 1: wings fully down
      const OUTLINE = '#3b0a0a';
      ctx.save(); ctx.translate(BIRD_X, bird.y); ctx.rotate(tilt);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.6;

      drawWing(1, -6, 0.5 - beat * 1.15, '#7f1d1d'); // the far wing

      ctx.strokeStyle = '#b91c1c'; ctx.lineWidth = 3; // the tail and its arrowhead
      ctx.beginPath(); ctx.moveTo(-9, 7); ctx.quadraticCurveTo(-21, 14, -23, 3); ctx.stroke();
      ctx.fillStyle = '#b91c1c'; ctx.beginPath(); ctx.moveTo(-23.5, -5); ctx.lineTo(-28, 4); ctx.lineTo(-18.5, 4); ctx.closePath(); ctx.fill();

      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.6;
      ctx.fillStyle = '#b91c1c'; // feet
      ctx.beginPath(); ctx.ellipse(-4, 12.5, 3.4, 2.2, 0.3, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(4, 13, 3.4, 2.2, -0.1, 0, TAU); ctx.fill(); ctx.stroke();

      ctx.fillStyle = '#fde68a'; ctx.lineWidth = 1.3; // horns
      ctx.beginPath(); ctx.moveTo(-6, -10.5); ctx.quadraticCurveTo(-8, -17, -3, -22); ctx.quadraticCurveTo(-1.5, -16, 0.5, -12.5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(4.5, -12); ctx.quadraticCurveTo(5, -18, 11, -21); ctx.quadraticCurveTo(10.5, -15, 10.5, -8.5); ctx.closePath(); ctx.fill(); ctx.stroke();

      ctx.lineWidth = 1.6; // body
      ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(0, 0, 13.2, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f87171'; ctx.beginPath(); ctx.ellipse(-3.5, -5.5, 5.5, 3.6, -0.5, 0, TAU); ctx.fill();

      drawWing(-5, -1, 0.3 - beat * 1.15, '#991b1b'); // the near wing

      if (state === 'dead') { // knocked out: a cross instead of the eye
        ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(3.5, -6.5); ctx.lineTo(9.5, -0.5); ctx.moveTo(9.5, -6.5); ctx.lineTo(3.5, -0.5); ctx.stroke();
      } else {
        ctx.fillStyle = '#fff7ed'; ctx.beginPath(); ctx.ellipse(6.4, -3.2, 4.3, 4.7, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#18090a'; ctx.beginPath(); ctx.arc(7.9, -2.8, 1.9, 0, TAU); ctx.fill();
        ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(1.6, -9.2); ctx.lineTo(10.8, -6.2); ctx.stroke(); // an angry brow
      }
      ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(3.2, 4.6); ctx.quadraticCurveTo(8, 9.8, 12, 3.4); ctx.stroke(); // a grin with one fang
      ctx.fillStyle = '#fff7ed'; ctx.beginPath(); ctx.moveTo(5.6, 6.6); ctx.lineTo(8, 7.4); ctx.lineTo(6.3, 10); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    function label(text, x, y, size, color = '#fff') {
      ctx.font = `800 ${size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.lineWidth = size * 0.22; ctx.strokeStyle = 'rgba(13,4,4,.85)'; ctx.strokeText(text, x, y);
      ctx.fillStyle = color; ctx.fillText(text, x, y);
    }

    function draw() {
      const s = W / VW;
      ctx.setTransform(s, 0, 0, s, 0, 0);
      const cave = ctx.createLinearGradient(0, 0, 0, FLOOR);
      cave.addColorStop(0, '#0c0304'); cave.addColorStop(0.45, '#2b0707'); cave.addColorStop(0.8, '#741508'); cave.addColorStop(1, '#d1470d');
      ctx.fillStyle = cave; ctx.fillRect(0, 0, VW, VH);

      ctx.fillStyle = '#e03a1c'; ctx.beginPath(); ctx.arc(292, 74, 21, 0, TAU); ctx.fill();            // a blood moon…
      ctx.fillStyle = cave; ctx.beginPath(); ctx.arc(283, 67, 18, 0, TAU); ctx.fill();                 // …cut down to a crescent

      for (const e of embers) { // sparks drift up from the lava
        const y = FLOOR - ((FLOOR - e.y + t * e.v) % FLOOR), x = e.x + Math.sin(t * 0.9 + e.p) * 7;
        ctx.globalAlpha = (0.35 + 0.35 * Math.sin(t * 2.3 + e.p)) * Math.min(1, y / 70);
        ctx.fillStyle = e.r > 1.2 ? '#ffd27a' : '#ff8a3c'; ctx.beginPath(); ctx.arc(x, y, e.r, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;

      const far = (scroll * 0.25) % RANGE;
      for (let rep = 0; rep < 2; rep++) for (const b of spires) {
        const x = b.x - far + rep * RANGE; if (x > VW || x + b.w < 0) continue;
        const top = FLOOR - b.h, shoulder = top + Math.min(26, b.h * 0.4);
        ctx.fillStyle = '#1c0606';
        ctx.beginPath(); ctx.moveTo(x, FLOOR); ctx.lineTo(x, shoulder); ctx.lineTo(x + b.w * (0.3 + b.lit * 0.4), top); ctx.lineTo(x + b.w, shoulder); ctx.lineTo(x + b.w, FLOOR); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,150,50,.55)'; // somebody lives in there
        for (let wy = shoulder + 6, k = 0; wy < FLOOR - 10; wy += 13, k++) if ((b.lit * 97 + k * 31) % 7 < 2.2) ctx.fillRect(x + 5 + ((k * 7) % Math.max(1, b.w - 14)), wy, 4, 5);
      }
      const near = (scroll * 0.5) % RANGE;
      ctx.fillStyle = '#070202';
      for (let rep = 0; rep < 2; rep++) for (const k of teeth) {
        const x = k.x - near + rep * RANGE; if (x > VW || x + k.w < 0) continue;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + k.w * 0.5, k.h); ctx.lineTo(x + k.w, 0); ctx.closePath(); ctx.fill();
      }
      const heat = ctx.createLinearGradient(0, FLOOR - 70, 0, FLOOR);
      heat.addColorStop(0, 'rgba(255,120,30,0)'); heat.addColorStop(1, 'rgba(255,140,40,.4)');
      ctx.fillStyle = heat; ctx.fillRect(0, FLOOR - 70, VW, 70);

      pipes.forEach(drawPillar);

      // The lava lake: touching it ends the flight.
      const lava = ctx.createLinearGradient(0, FLOOR, 0, VH);
      lava.addColorStop(0, '#ffb23e'); lava.addColorStop(0.22, '#ff5a1f'); lava.addColorStop(0.7, '#a31a12'); lava.addColorStop(1, '#4a0a0a');
      ctx.fillStyle = lava; ctx.fillRect(0, FLOOR, VW, GROUND);
      ctx.fillStyle = 'rgba(46,8,6,.6)';
      for (const c of crust) { const x = ((c.x - scroll) % RANGE + RANGE) % RANGE - 40; if (x < VW) { ctx.beginPath(); ctx.ellipse(x, FLOOR + c.y, c.w, c.h, 0, 0, TAU); ctx.fill(); } }
      ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.moveTo(0, FLOOR + 5);
      for (let x = 0; x <= VW; x += 6) ctx.lineTo(x, FLOOR + 1.6 + Math.sin((x + scroll) * 0.07) * 1.5);
      ctx.lineTo(VW, FLOOR + 5);
      for (let x = VW; x >= 0; x -= 6) ctx.lineTo(x, FLOOR + 5 + Math.sin((x + scroll) * 0.07 + 1) * 1.5);
      ctx.closePath(); ctx.fill();

      drawImp();

      if (state === 'ready') {
        label('Get ready', VW / 2, VH * 0.26, 34);
        label('Click, tap or press Space', VW / 2, VH * 0.26 + 34, 15, '#f1dcd3');
      } else label(String(score), VW / 2, 54, 46);

      if (flash > 0) { ctx.fillStyle = `rgba(255,226,190,${flash * 0.75})`; ctx.fillRect(0, 0, VW, VH); }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    cv.addEventListener('pointerdown', (e) => { if (e.button > 0) return; e.preventDefault(); flap(); });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    noScroll(cv);
    const unfit = fitCanvas(cv, (w) => { W = w; });
    const stop = loop((dt) => {
      acc += dt;
      while (acc >= STEP) { step(STEP); acc -= STEP; }
      draw();
    });

    return {
      key(e) { if (FLAP_KEYS.has(e.key)) { if (!e.repeat) flap(); return true; } },
      destroy() { stop(); unfit(); clearTimeout(endTimer); },
    };
  },
};
