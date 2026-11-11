import { fitCanvas, loop, noScroll } from '../util.js';

const DURATION = 30; // seconds
const HIT = 100, MISS = 50; // points
// count: targets on screen at once · r: target radius as a share of the field's shorter side
// gap: how far from the previous target a new one appears, as a share of the field's diagonal
const MODES = {
  grid: { count: 3, r: 0.055, gap: 0.12 },
  flick: { count: 1, r: 0.045, gap: 0.3 },
  tiny: { count: 1, r: 0.022, gap: 0.2 },
};
const TAU = Math.PI * 2;

export default {
  id: 'aim', name: 'Aim Trainer', icon: 'crosshair', color: '#34d399', tag: 'Aim',
  desc: 'Flick to the targets and click them as fast as you can. 30 seconds on the clock.',
  help: 'Click or tap the targets · a miss costs points · the clock starts with your first hit',
  variants: { grid: 'Gridshot', flick: 'Flick', tiny: 'Precision' },
  create(stage, api) {
    stage.innerHTML = `
      <div class="seg mb-4" id="aim-mode">
        <button data-m="grid">Gridshot</button><button data-m="flick">Flick</button><button data-m="tiny">Precision</button>
      </div>
      <div class="timebar wide"><div id="aim-tb" style="width:100%"></div></div>
      <canvas class="aim-field" id="aim-c"></canvas>`;
    const cv = stage.querySelector('#aim-c'), ctx = cv.getContext('2d');
    const bar = stage.querySelector('#aim-tb');
    const modeBtns = [...stage.querySelectorAll('#aim-mode button')];
    let W = 1, H = 1, dpr = 1, now = 0;
    let mode = MODES[api.variant()] ? api.variant() : 'grid';
    let state, left, hits, misses, score, targets, fx, lastPos, shownStatus;

    const radius = () => Math.max(7 * dpr, MODES[mode].r * Math.min(W, H));

    function spawn() {
      const R = radius(), m = R + 8 * dpr, minGap = MODES[mode].gap * Math.hypot(W, H);
      let x = W / 2, y = H / 2;
      for (let tries = 0; tries < 300; tries++) {
        x = m + Math.random() * Math.max(1, W - 2 * m); y = m + Math.random() * Math.max(1, H - 2 * m);
        const clear = targets.every((t) => Math.hypot(t.x * W - x, t.y * H - y) > R * 2.6);
        const far = !lastPos || Math.hypot(lastPos.x * W - x, lastPos.y * H - y) > minGap;
        if (clear && far) break;
      }
      targets.push({ x: x / W, y: y / H, born: now });
    }

    function reset() {
      state = 'ready'; left = DURATION; hits = 0; misses = 0; score = 0;
      targets = []; fx = []; lastPos = null; shownStatus = '';
      for (let i = 0; i < MODES[mode].count; i++) spawn();
      bar.style.width = '100%';
      api.score(0); api.status('Hit any target to start');
    }

    function setMode(m) {
      if (m === mode && state !== undefined) return;
      mode = m; api.variant(m);
      modeBtns.forEach((b) => b.classList.toggle('on', b.dataset.m === m));
      reset();
    }

    const accuracy = () => (hits + misses ? Math.round(hits / (hits + misses) * 100) : 100);

    function shoot(e) {
      if (state === 'done' || e.button > 0) return;
      e.preventDefault();
      const box = cv.getBoundingClientRect();
      const x = (e.clientX - box.left) * (W / box.width), y = (e.clientY - box.top) * (H / box.height);
      const R = radius() + (e.pointerType === 'touch' ? 10 * dpr : 0); // fingers get a little slack
      let hit = -1, nearest = Infinity;
      targets.forEach((t, i) => { const d = Math.hypot(t.x * W - x, t.y * H - y); if (d <= R && d < nearest) { nearest = d; hit = i; } });
      if (hit >= 0) {
        const t = targets.splice(hit, 1)[0];
        if (state === 'ready') state = 'running';
        hits++; score += HIT; lastPos = t;
        fx.push({ hit: true, x: t.x, y: t.y, t: now, life: 0.28 });
        spawn();
      } else if (state === 'running') {
        misses++; score = Math.max(0, score - MISS);
        fx.push({ hit: false, x: x / W, y: y / H, t: now, life: 0.4 });
      }
      api.score(score);
    }

    function finish() {
      state = 'done'; left = 0; bar.style.width = '0%';
      const per = hits ? Math.round(DURATION * 1000 / hits) : 0;
      api.status(`${hits} hits · ${accuracy()}% on target`);
      api.finish(score, { endTitle: 'Time is up', text: `${score} points · ${hits} hits · ${accuracy()}% accuracy${hits ? ` · ${per} ms per target` : ''}` });
    }

    function draw() {
      ctx.fillStyle = '#11141c'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,.035)'; ctx.lineWidth = dpr; ctx.beginPath();
      const step = 44 * dpr;
      for (let x = (W % step) / 2; x < W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = (H % step) / 2; y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();

      const R = radius();
      for (const t of targets) {
        const age = (now - t.born) / 0.11, k = age >= 1 ? 1 : 1 - Math.pow(1 - Math.max(0, age), 3);
        const x = t.x * W, y = t.y * H, r = R * (0.35 + 0.65 * k);
        ctx.save();
        ctx.globalAlpha = 0.4 + 0.6 * k;
        ctx.shadowColor = 'rgba(52,211,153,.5)'; ctx.shadowBlur = r * 0.7;
        const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r);
        g.addColorStop(0, '#ecfdf5'); g.addColorStop(0.4, '#34d399'); g.addColorStop(1, '#047857');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
        ctx.restore();
      }

      fx = fx.filter((f) => now - f.t < f.life);
      for (const f of fx) {
        const p = (now - f.t) / f.life, x = f.x * W, y = f.y * H;
        ctx.globalAlpha = 1 - p;
        if (f.hit) {
          ctx.strokeStyle = '#a7f3d0'; ctx.lineWidth = Math.max(1, R * 0.16 * (1 - p));
          ctx.beginPath(); ctx.arc(x, y, R * (0.9 + p * 0.9), 0, TAU); ctx.stroke();
        } else {
          const s = 6 * dpr;
          ctx.strokeStyle = '#f87171'; ctx.lineWidth = 2 * dpr; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    cv.addEventListener('pointerdown', shoot);
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    noScroll(cv);
    modeBtns.forEach((b) => b.addEventListener('click', () => { b.blur(); setMode(b.dataset.m); }));

    const unfit = fitCanvas(cv, (w, h, d) => { W = w; H = h; dpr = d; });
    setMode(mode);
    const stop = loop((dt) => {
      now += dt;
      if (state === 'running') {
        left -= dt;
        if (left <= 0) finish();
        else {
          bar.style.width = (left / DURATION * 100) + '%';
          const s = `${Math.ceil(left)}s · ${accuracy()}% on target`;
          if (s !== shownStatus) { shownStatus = s; api.status(s); }
        }
      }
      draw();
    });

    return { destroy() { stop(); unfit(); } };
  },
};
