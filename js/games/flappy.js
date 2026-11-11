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
  id: 'flappy', name: 'Flappy Bird', icon: 'bird', color: '#38bdf8', tag: 'Arcade',
  desc: 'Tap to flap and squeeze through the pipes. One touch and it’s over.',
  help: 'Click, tap or press Space to flap',
  create(stage, api) {
    stage.innerHTML = `<canvas class="flappy" id="fl-c"></canvas>`;
    const cv = stage.querySelector('#fl-c'), ctx = cv.getContext('2d');
    let W = 1;
    let state = 'ready', score = 0, t = 0, acc = 0, scroll = 0, flash = 0, wing = 1, endTimer = null, landed = false;
    const bird = { y: VH * 0.45, vy: 0 };
    let pipes = [];

    const rnd = seeded(7);
    const stars = Array.from({ length: 46 }, () => ({ x: rnd() * VW, y: rnd() * FLOOR * 0.62, r: 0.5 + rnd() * 0.9, p: rnd() * TAU }));
    const SKYLINE = 720; // the skyline pattern repeats every 720 units
    const towers = []; for (let x = 0; x < SKYLINE;) { const w = 22 + rnd() * 30; towers.push({ x, w, h: 26 + rnd() * 78, lit: rnd() }); x += w + 2; }

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

    function drawPipe(p) {
      const body = ctx.createLinearGradient(p.x, 0, p.x + PIPE_W, 0);
      body.addColorStop(0, '#3f6212'); body.addColorStop(0.3, '#a3e635'); body.addColorStop(0.55, '#65a30d'); body.addColorStop(1, '#365314');
      const part = (y, h, capAtBottom) => {
        ctx.fillStyle = body; ctx.strokeStyle = '#1a2e05'; ctx.lineWidth = 2;
        ctx.fillRect(p.x, y, PIPE_W, h); ctx.strokeRect(p.x, y, PIPE_W, h);
        const cy = capAtBottom ? y + h - 24 : y;
        ctx.save(); ctx.translate(-4, 0); // the cap is a little wider than the pipe
        const cap = ctx.createLinearGradient(p.x, 0, p.x + PIPE_W + 8, 0);
        cap.addColorStop(0, '#3f6212'); cap.addColorStop(0.3, '#bef264'); cap.addColorStop(0.55, '#65a30d'); cap.addColorStop(1, '#365314');
        ctx.fillStyle = cap; ctx.fillRect(p.x, cy, PIPE_W + 8, 24); ctx.strokeRect(p.x, cy, PIPE_W + 8, 24);
        ctx.restore();
      };
      part(-4, p.y - GAP / 2 + 4, true);
      part(p.y + GAP / 2, FLOOR - (p.y + GAP / 2), false);
    }

    function drawBird() {
      const tilt = state === 'ready' ? 0 : clamp(bird.vy / 420, -0.45, 1.35);
      ctx.save(); ctx.translate(BIRD_X, bird.y); ctx.rotate(tilt); ctx.scale(1.12, 1.12);
      ctx.lineWidth = 1.8; ctx.strokeStyle = '#422006';
      ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.ellipse(0, 0, 15.5, 12, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fef08a'; ctx.beginPath(); ctx.ellipse(-2, 5, 9, 5, 0, 0, TAU); ctx.fill();
      const flapUp = state === 'dead' ? 0 : Math.sin((state === 'ready' ? t * 14 : (1 - wing) * Math.PI));
      ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.ellipse(-6, 1 - flapUp * 4, 7.5, 4.5 + Math.abs(flapUp) * 1.5, -0.25, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(7, -4.5, 4.6, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#18181b'; ctx.beginPath(); ctx.arc(8.4, -4.2, 1.9, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fb923c'; ctx.beginPath(); ctx.moveTo(11, -1); ctx.lineTo(22, 2.5); ctx.lineTo(11, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    function label(text, x, y, size, color = '#fff') {
      ctx.font = `800 ${size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.lineWidth = size * 0.22; ctx.strokeStyle = 'rgba(11,13,18,.85)'; ctx.strokeText(text, x, y);
      ctx.fillStyle = color; ctx.fillText(text, x, y);
    }

    function draw() {
      const s = W / VW;
      ctx.setTransform(s, 0, 0, s, 0, 0);
      const sky = ctx.createLinearGradient(0, 0, 0, FLOOR);
      sky.addColorStop(0, '#0b1024'); sky.addColorStop(0.65, '#1c2a55'); sky.addColorStop(1, '#3b3b7a');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, VW, VH);
      for (const st of stars) { ctx.globalAlpha = 0.45 + 0.4 * Math.sin(t * 1.7 + st.p); ctx.fillStyle = '#e0e7ff'; ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fef9c3'; ctx.beginPath(); ctx.arc(292, 70, 21, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0f162f'; ctx.beginPath(); ctx.arc(283, 63, 18, 0, TAU); ctx.fill(); // sky-coloured disc: turns the moon into a crescent

      const off = (scroll * 0.25) % SKYLINE;
      for (let rep = 0; rep < 2; rep++) for (const b of towers) {
        const x = b.x - off + rep * SKYLINE; if (x > VW || x + b.w < 0) continue;
        ctx.fillStyle = '#121a36'; ctx.fillRect(x, FLOOR - b.h, b.w, b.h);
        ctx.fillStyle = 'rgba(253,224,71,.5)';
        for (let wy = FLOOR - b.h + 8, k = 0; wy < FLOOR - 10; wy += 13, k++) if ((b.lit * 97 + k * 31) % 7 < 2.4) ctx.fillRect(x + 5 + ((k * 7) % Math.max(1, b.w - 14)), wy, 4, 5);
      }

      pipes.forEach(drawPipe);

      ctx.fillStyle = '#161a24'; ctx.fillRect(0, FLOOR, VW, GROUND);
      ctx.save(); ctx.beginPath(); ctx.rect(0, FLOOR + 4, VW, 14); ctx.clip();
      ctx.strokeStyle = '#2a3145'; ctx.lineWidth = 6;
      for (let x = -(scroll % 22) - 22; x < VW + 22; x += 22) { ctx.beginPath(); ctx.moveTo(x, FLOOR + 20); ctx.lineTo(x + 14, FLOOR + 2); ctx.stroke(); }
      ctx.restore();
      ctx.fillStyle = '#a3e635'; ctx.fillRect(0, FLOOR, VW, 4);

      drawBird();

      if (state === 'ready') {
        label('Get ready', VW / 2, VH * 0.26, 34);
        label('Click, tap or press Space', VW / 2, VH * 0.26 + 34, 15, '#cbd5e1');
      } else label(String(score), VW / 2, 54, 46);

      if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.75})`; ctx.fillRect(0, 0, VW, VH); }
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
