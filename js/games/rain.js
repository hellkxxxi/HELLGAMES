import { clamp, fitCanvas, loop, noScroll } from '../util.js';

// ---------------------------------------------------------------- the rules (nothing is drawn here)
// The field is 100 units wide and 140 high, with y growing downwards. The devil stands at the bottom
// and moves left and right. Souls are worth a point, golden ones five; a burning rock costs a life;
// a heart gives one back.
export const FIELD = { w: 100, h: 140 };
export const DEVIL = { w: 18, y: 120, reach: 7 }; // how wide its bowl is, how high up it is held, and how far up and down it catches
export const LIVES = 3;
const RADIUS = { soul: 4, gold: 4, rock: 5.5, heart: 4 };
const POINTS = { soul: 1, gold: 5 };

export function createRain(rnd = Math.random) {
  const r = { x: FIELD.w / 2, lives: LIVES, score: 0, time: 0, items: [], events: [], over: false, safe: 0 };
  let until = 0.6; // seconds until the next thing falls
  r.step = (dt, target) => {
    if (r.over) return;
    r.time += dt; r.safe = Math.max(0, r.safe - dt);
    // the devil goes where it is sent, quickly but not in no time
    const want = clamp(target, DEVIL.w / 2, FIELD.w - DEVIL.w / 2), reach = 260 * dt;
    r.x += clamp(want - r.x, -reach, reach);
    const heat = Math.min(1, r.time / 75); // it all gets worse for a minute and a quarter, then stays as bad as it is
    until -= dt;
    if (until <= 0) {
      until = (0.72 - heat * 0.42) * (0.7 + rnd() * 0.6);
      const roll = rnd();
      const kind = roll < 0.26 + heat * 0.3 ? 'rock' : roll > 0.985 && r.lives < LIVES ? 'heart' : roll > 0.93 ? 'gold' : 'soul';
      r.items.push({ kind, x: RADIUS[kind] + rnd() * (FIELD.w - 2 * RADIUS[kind]), y: -6, v: (40 + heat * 62) * (0.85 + rnd() * 0.3) * (kind === 'rock' ? 1.15 : 1), r: RADIUS[kind], spin: rnd() * 6 });
    }
    for (const it of r.items) {
      it.y += it.v * dt;
      if (it.gone || Math.abs(it.y - DEVIL.y) > DEVIL.reach || Math.abs(it.x - r.x) > DEVIL.w / 2 + it.r * 0.5) continue;
      it.gone = true;
      if (it.kind === 'rock') {
        if (r.safe > 0) continue; // just hit: for a moment nothing hurts
        r.lives--; r.safe = 1.2; r.events.push({ kind: 'hurt', x: it.x });
        if (r.lives <= 0) r.over = true;
      } else if (it.kind === 'heart') { r.lives = Math.min(LIVES, r.lives + 1); r.events.push({ kind: 'heart', x: it.x }); }
      else { r.score += POINTS[it.kind]; r.events.push({ kind: it.kind, x: it.x }); }
    }
    r.items = r.items.filter((it) => !it.gone && it.y < FIELD.h + 10);
  };
  return r;
}

// ---------------------------------------------------------------- the game on screen
const wall = () => performance.now() / 1000;

export default {
  id: 'rain', name: 'Brimstone', icon: 'cloud-rain-wind', color: '#60a5fa', tag: 'Arcade', since: '1.1',
  desc: 'Souls rain down on hell, and so do burning rocks. Catch the souls, keep out of the way of the rocks.',
  help: 'Move the mouse or a finger, or use the arrow keys or A and D · blue souls are a point, golden ones five · a rock costs one of three lives',
  create(stage, api) {
    stage.innerHTML = '<canvas class="rain" id="ra-c"></canvas>';
    const cv = stage.querySelector('#ra-c'), ctx = cv.getContext('2d');
    const font = getComputedStyle(document.body).fontFamily;
    let W = 1, H = 1, rain = createRain(), state = 'ready', target = FIELD.w / 2, endTimer = null, shown = '', hurtAt = -9;
    const keys = { left: false, right: false };
    let pops = []; // "+1" and the like, floating up

    function begin() { if (state === 'ready') { state = 'play'; api.status(hearts()); } }
    const hearts = () => `${'♥'.repeat(rain.lives)}${'♡'.repeat(LIVES - rain.lives)}`;

    // ---- drawing
    function soul(x, y, r, color, core, t, k) {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
      glow.addColorStop(0, color); glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.35; ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = color; ctx.beginPath(); // a drop with its tail upwards, wagging as it falls
      ctx.moveTo(x - r, y); ctx.quadraticCurveTo(x - r * 0.9, y - r * 1.6, x + Math.sin(t * 7 + k) * r * 0.5, y - r * 2.7);
      ctx.quadraticCurveTo(x + r * 0.9, y - r * 1.6, x + r, y); ctx.arc(x, y, r, 0, Math.PI); ctx.closePath(); ctx.fill();
      ctx.fillStyle = core; ctx.beginPath(); ctx.arc(x, y - r * 0.1, r * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0b1220'; ctx.beginPath(); ctx.arc(x - r * 0.32, y - r * 0.05, r * 0.16, 0, Math.PI * 2); ctx.arc(x + r * 0.32, y - r * 0.05, r * 0.16, 0, Math.PI * 2); ctx.fill();
    }
    function rock(x, y, r, t, spin) {
      // a tail of fire above it, then the rock itself: dark, with a glowing rim and cracks
      for (let k = 3; k >= 1; k--) {
        ctx.fillStyle = k === 1 ? '#fb923c' : k === 2 ? '#ea580c' : '#9a3412';
        ctx.beginPath(); ctx.ellipse(x + Math.sin(t * 15 + spin + k) * r * 0.22, y - r * (0.35 + k * 0.8), r * (1 - k * 0.2), r * (1.25 - k * 0.14), 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.ellipse(x, y - r * 0.75, r * 0.5, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3d1610'; ctx.strokeStyle = '#ff7a3d'; ctx.lineWidth = Math.max(1.5, r * 0.2); ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let k = 0; k < 7; k++) { const a = spin + t * 2 + k * Math.PI * 2 / 7, rr = r * (0.84 + 0.2 * ((k * 37) % 5) / 4); ctx[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = Math.max(1, r * 0.12); ctx.beginPath();
      ctx.moveTo(x - r * 0.45, y - r * 0.25); ctx.lineTo(x - r * 0.05, y + r * 0.12); ctx.lineTo(x + r * 0.15, y - r * 0.3); ctx.moveTo(x - r * 0.05, y + r * 0.12); ctx.lineTo(x + r * 0.3, y + r * 0.42); ctx.stroke();
    }
    function heart(x, y, r) {
      ctx.fillStyle = '#f43f5e'; ctx.beginPath(); ctx.moveTo(x, y + r);
      ctx.bezierCurveTo(x - r * 1.9, y - r * 0.2, x - r * 0.9, y - r * 1.5, x, y - r * 0.5);
      ctx.bezierCurveTo(x + r * 0.9, y - r * 1.5, x + r * 1.9, y - r * 0.2, x, y + r); ctx.fill();
    }
    function devil(x, y, u, blink) {
      const w = DEVIL.w * u, hy = y + 10.6 * u, hr = 5.2 * u; // the head sits under the bowl
      ctx.globalAlpha = blink ? 0.45 : 1; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = '#3b0a0a'; ctx.lineWidth = Math.max(1.5, 0.5 * u);
      // feet, horns and head
      ctx.strokeStyle = '#7f1d1d'; ctx.lineWidth = Math.max(2, 1.3 * u);
      for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + side * hr * 0.45, hy + hr * 0.8); ctx.lineTo(x + side * hr * 0.6, hy + hr * 1.32); ctx.stroke(); }
      ctx.strokeStyle = '#3b0a0a'; ctx.lineWidth = Math.max(1.5, 0.5 * u);
      ctx.fillStyle = '#fde68a';
      for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + side * hr * 0.55, hy - hr * 0.6); ctx.lineTo(x + side * hr * 1.5, hy - hr * 1.15); ctx.lineTo(x + side * hr * 0.98, hy - hr * 0.05); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(x, hy, hr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff7ed';
      for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + side * hr * 0.4, hy - hr * 0.05, hr * 0.26, hr * 0.32, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#18090a';
      for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(x + side * hr * 0.4, hy - hr * 0.17, hr * 0.13, 0, Math.PI * 2); ctx.fill(); }
      ctx.beginPath(); ctx.arc(x, hy + hr * 0.25, hr * 0.42, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      // the bowl it carries on its head: whatever falls into it is caught
      ctx.fillStyle = '#2c1512'; ctx.beginPath(); ctx.moveTo(x - w / 2, y - 2.5 * u); ctx.bezierCurveTo(x - w * 0.42, y + 7.5 * u, x + w * 0.42, y + 7.5 * u, x + w / 2, y - 2.5 * u); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#fb923c'; ctx.lineWidth = Math.max(2, 0.9 * u); ctx.beginPath(); ctx.moveTo(x - w / 2, y - 2.5 * u); ctx.lineTo(x + w / 2, y - 2.5 * u); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    function draw() {
      const t = wall(), u = W / FIELD.w, ground = (FIELD.h - 2.5) * u;
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#0b0710'); sky.addColorStop(0.75, '#2a0c0a'); sky.addColorStop(1, '#6b1d10');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#150807'; ctx.beginPath(); ctx.moveTo(0, ground); // jagged ground
      for (let k = 0; k <= 10; k++) ctx.lineTo(k * W / 10, ground - (k % 2 ? 0 : 1.6 * u));
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
      const shake = Math.max(0, 1 - (t - hurtAt) / 0.3);
      if (shake) { ctx.fillStyle = `rgba(239,68,68,${0.28 * shake})`; ctx.fillRect(0, 0, W, H); }

      for (const it of rain.items) {
        const x = it.x * u, y = it.y * u, r = it.r * u;
        if (it.kind === 'rock') rock(x, y, r, t, it.spin);
        else if (it.kind === 'heart') heart(x, y, r);
        else if (it.kind === 'gold') soul(x, y, r, '#fbbf24', '#fef3c7', t, it.spin);
        else soul(x, y, r, '#60a5fa', '#dbeafe', t, it.spin);
      }
      devil(rain.x * u + Math.sin(t * 90) * shake * 0.8 * u, DEVIL.y * u, u, rain.safe > 0 && Math.floor(t * 12) % 2 === 0);
      pops = pops.filter((p) => t - p.at < 0.7);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 ${Math.max(12, 5.2 * u)}px ${font}`;
      for (const p of pops) { const k = (t - p.at) / 0.7; ctx.globalAlpha = 1 - k; ctx.fillStyle = p.color; ctx.fillText(p.text, p.x * u, (DEVIL.y - 8 - k * 12) * u); }
      ctx.globalAlpha = 1;
      // lives, top left
      for (let k = 0; k < LIVES; k++) { ctx.globalAlpha = k < rain.lives ? 1 : 0.2; heart((4.5 + k * 7) * u, 5 * u, 2.4 * u); }
      ctx.globalAlpha = 1;
      if (state === 'ready') {
        ctx.fillStyle = 'rgba(10,6,6,.5)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#f6f1ef'; ctx.font = `700 ${Math.max(15, 6.4 * u)}px ${font}`; ctx.fillText('Click, tap or press a key', W / 2, H * 0.42);
        ctx.fillStyle = '#aca09f'; ctx.font = `500 ${Math.max(11, 3.9 * u)}px ${font}`; ctx.fillText('Catch the souls, dodge the rocks', W / 2, H * 0.42 + Math.max(20, 8.5 * u));
      }
    }
    function frame(dt) {
      if (state === 'play') {
        if (keys.left !== keys.right) target = rain.x + (keys.left ? -1 : 1) * 135 * dt; // a held key walks the devil, at half the speed it can run
        rain.step(dt, target);
        for (const ev of rain.events.splice(0)) {
          if (ev.kind === 'hurt') hurtAt = wall();
          pops.push({ at: wall(), x: ev.x, text: { soul: '+1', gold: '+5', heart: '♥', hurt: '−1 life' }[ev.kind], color: { soul: '#93c5fd', gold: '#fde047', heart: '#fb7185', hurt: '#f87171' }[ev.kind] });
        }
        const line = `${rain.score}|${rain.lives}`;
        if (line !== shown) { shown = line; api.score(rain.score); api.status(hearts()); }
        if (rain.over) { state = 'over'; endTimer = setTimeout(() => api.finish(rain.score), 500); }
      }
      draw();
    }

    // ---- input
    const aim = (e) => { const r = cv.getBoundingClientRect(); target = (e.clientX - r.left) / r.width * FIELD.w; };
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); aim(e); begin(); try { cv.setPointerCapture(e.pointerId); } catch { /* not vital */ } });
    cv.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || e.buttons || e.pressure > 0) aim(e); });
    noScroll(cv);
    api.status('Ready when you are');
    const stopFit = fitCanvas(cv, (w, h) => { W = w; H = h; draw(); });
    const stopLoop = loop(frame);
    const side = (key) => (key === 'ArrowLeft' || key === 'a' ? 'left' : key === 'ArrowRight' || key === 'd' ? 'right' : null);
    return {
      key(e) {
        const s = side(e.key);
        if (s) { keys[s] = true; begin(); return true; }
        if (e.key === ' ') { begin(); return true; }
      },
      keyup(e) { const s = side(e.key); if (s) { keys[s] = false; if (!keys.left && !keys.right) target = rain.x; } },
      destroy() { stopFit(); stopLoop(); clearTimeout(endTimer); },
    };
  },
};
