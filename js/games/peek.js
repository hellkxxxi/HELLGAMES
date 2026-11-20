import { fitCanvas, loop, noScroll } from '../util.js';

// ---------------------------------------------------------------- the rules (nothing is drawn here)
// Holding an angle, as in a tactical shooter: somebody leans out from behind cover, and whoever shoots
// first wins the duel. A shot in the head ends it at once; the body takes two. The score is the time
// from the moment the enemy shows until it falls, averaged over the duels.
// Places are measured in widths of the picture: x runs from 0 to 1, y from 0 downwards.
export const DUELS = 12;
export const LEVELS = {
  normal: { show: 1.15, head: 0.034 }, // how long the enemy gives you before it shoots, and how big its head is
  hard: { show: 0.72, head: 0.026 },
};
export const LOST = 500; // a lost duel counts as the time the enemy gave, plus so many milliseconds
// Where enemies lean out: the place of the head once it is out, and from which side it comes ('left', 'right' or 'up').
export const SPOTS = [
  { x: 0.455, y: 0.3, from: 'left' },   // out of the left side of the doorway
  { x: 0.545, y: 0.3, from: 'right' },  // out of the right side of it
  { x: 0.5, y: 0.31, from: 'up' },      // up from behind the barrel in the doorway
  { x: 0.17, y: 0.33, from: 'up' },     // up from behind the crate on the left
  { x: 0.83, y: 0.33, from: 'up' },     // and on the right
  { x: 0.285, y: 0.4, from: 'left' },   // round the crate on the left
  { x: 0.715, y: 0.4, from: 'right' },  // round the crate on the right
];
const BEHIND_WALL = 3; // the first so many spots are in the room behind the doorway; the others are on this side of the wall
// The body under a head: a box, in the same measure.
export const bodyOf = (enemy) => ({ x: enemy.x - enemy.r * 1.5, y: enemy.y + enemy.r * 0.9, w: enemy.r * 3, h: enemy.r * 3.4 });

// `grow` makes the enemies bigger: a finger on a phone is blunter than a mouse.
export function createDuels(level = 'normal', rnd = Math.random, grow = 1) {
  const { show } = LEVELS[level], head = LEVELS[level].head * grow;
  const d = { duel: 0, phase: 'wait', wait: 0.8 + rnd() * 1.2, enemy: null, times: [], heads: 0, lost: 0, shots: 0, hits: 0, over: false, events: [] };
  let last = -1;
  function next(ms, how) {
    d.times.push(ms); d.events.push({ kind: how, ms, x: d.enemy.x, y: d.enemy.y });
    d.enemy = null; d.duel++;
    if (d.duel >= DUELS) { d.over = true; d.phase = 'done'; } else { d.phase = 'wait'; d.wait = 0.7 + rnd() * 1.6; }
  }
  d.step = (dt) => {
    if (d.over) return;
    if (d.phase === 'wait') {
      d.wait -= dt;
      if (d.wait > 0) return;
      let spot;
      do spot = Math.floor(rnd() * SPOTS.length); while (spot === last); // never twice from the same place
      last = spot;
      d.enemy = { ...SPOTS[spot], spot, r: head, seen: 0, health: 2 };
      d.phase = 'peek';
    } else {
      d.enemy.seen += dt;
      if (d.enemy.seen >= show) { d.lost++; next(show * 1000 + LOST, 'lost'); } // too slow: the enemy shot first
    }
  };
  // A shot at a place in the picture. Answers 'head', 'body' (the first of two), 'down' (the second),
  // 'miss', or 'early' when nobody is there to shoot at.
  d.shoot = (x, y, slack = 0) => {
    if (d.over) return 'early';
    d.shots++;
    if (d.phase !== 'peek') return 'early';
    const e = d.enemy, body = bodyOf(e), ms = Math.round(e.seen * 1000);
    if (Math.hypot(x - e.x, y - e.y) <= e.r + slack) { d.hits++; d.heads++; next(ms, 'head'); return 'head'; }
    if (x >= body.x - slack && x <= body.x + body.w + slack && y >= body.y - slack && y <= body.y + body.h + slack) {
      d.hits++;
      if (--e.health > 0) return 'body';
      next(ms, 'down'); return 'down';
    }
    return 'miss';
  };
  d.average = () => (d.times.length ? Math.round(d.times.reduce((a, b) => a + b, 0) / d.times.length) : 0);
  return d;
}

// ---------------------------------------------------------------- the game on screen
const wall = () => performance.now() / 1000;
const FLOOR = 0.5; // where the wall meets the floor
// What the enemies hide behind, drawn over them: boxes [x, y, w, h].
const COVER = [[0, 0.08, 0.42, FLOOR - 0.08], [0.58, 0.08, 0.42, FLOOR - 0.08], [0.1, 0.36, 0.14, 0.2], [0.76, 0.36, 0.14, 0.2], [0.445, 0.345, 0.11, 0.155]];

export default {
  id: 'peek', name: 'Hold the Angle', icon: 'scan-eye', color: '#f87171', tag: 'Skill', since: '1.1',
  desc: 'For shooter players: somebody leans out of cover, and whoever fires first wins. Go for the head. Twelve duels.',
  help: 'Aim with the mouse and click, or tap · a shot in the head wins at once, the body takes two · too slow and the enemy fires first · the average time counts',
  scoreLabel: 'Avg', lowerBetter: true, initialScore: '–',
  format: (v) => `${Math.round(v)} ms`,
  variants: { normal: 'Normal', hard: 'Hard' },
  create(stage, api) {
    stage.innerHTML = `
      <div class="mn-top"><div class="seg" id="pk-level">${Object.entries(this.variants).map(([id, name]) => `<button data-l="${id}">${name}</button>`).join('')}</div></div>
      <canvas class="peek" id="pk-c"></canvas>`;
    const cv = stage.querySelector('#pk-c'), ctx = cv.getContext('2d');
    const levelBtns = [...stage.querySelectorAll('#pk-level button')];
    const font = getComputedStyle(document.body).fontFamily;
    let W = 1, H = 1, level, duels, state = 'ready', aim = [0.5, 0.3], pops = [], flashAt = -9, hurtAt = -9, endTimer = null;
    const grow = window.matchMedia && window.matchMedia('(pointer: coarse)').matches ? 1.3 : 1;

    function reset() {
      clearTimeout(endTimer); api.hideOverlay();
      level = LEVELS[api.variant()] ? api.variant() : 'normal';
      levelBtns.forEach((b) => b.classList.toggle('on', b.dataset.l === level));
      duels = createDuels(level, Math.random, grow); state = 'ready'; pops = [];
      api.score('–'); api.status(`${DUELS} duels`);
    }
    function enemy(e) {
      // it slides out from behind its cover in a tenth of a second
      const out = Math.min(1, e.seen / 0.1), hide = (1 - out) * e.r * 3.2;
      const x = (e.x + (e.from === 'left' ? -hide : e.from === 'right' ? hide : 0)) * W, y = (e.y + (e.from === 'up' ? hide : 0)) * W, r = e.r * W, body = bodyOf(e);
      const bx = x - (e.x - body.x) * W, by = y + (body.y - e.y) * W;
      ctx.lineWidth = Math.max(1.5, r * 0.12); ctx.strokeStyle = '#150707'; ctx.lineJoin = 'round';
      ctx.fillStyle = e.health < 2 ? '#7f1d1d' : '#991b1b'; // the body, darker once it has been hit
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx, by, body.w * W, body.h * W, r * 0.7); else ctx.rect(bx, by, body.w * W, body.h * W); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fde68a';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + s * r * 0.4, y - r * 0.75); ctx.lineTo(x + s * r * 1.05, y - r * 1.5); ctx.lineTo(x + s * r * 0.92, y - r * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff7ed'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x + s * r * 0.36, y - r * 0.05, r * 0.2, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#18090a'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x + s * r * 0.36, y - r * 0.02, r * 0.09, 0, Math.PI * 2); ctx.fill(); }
    }
    function draw() {
      const t = wall(), box = ([x, y, w, h]) => [x * W, y * W, w * W, h * W];
      // the room behind the doorway, then whoever is leaning out, then the wall and the crates in front
      ctx.fillStyle = '#0b0606'; ctx.fillRect(0, 0, W, H);
      const glow = ctx.createLinearGradient(0, 0.1 * W, 0, FLOOR * W);
      glow.addColorStop(0, '#2a0f0c'); glow.addColorStop(1, '#6b1f12');
      ctx.fillStyle = glow; ctx.fillRect(0.42 * W, 0.08 * W, 0.16 * W, (FLOOR - 0.08) * W);
      ctx.fillStyle = '#21110f'; ctx.fillRect(0, FLOOR * W, W, H - FLOOR * W); // the floor
      const e = duels.enemy;
      if (e && e.spot < BEHIND_WALL) enemy(e);
      ctx.fillStyle = '#2b1614'; ctx.strokeStyle = '#4a2a22'; ctx.lineWidth = Math.max(1, W * 0.003);
      for (const c of COVER.slice(0, 2)) { ctx.fillRect(...box(c)); ctx.strokeRect(...box(c)); }
      ctx.fillStyle = '#1b0e0d'; ctx.fillRect(0, 0, W, 0.08 * W); // the ceiling
      if (e && e.spot >= BEHIND_WALL) enemy(e);
      for (const c of COVER.slice(2)) { // crates and the barrel
        ctx.fillStyle = '#4a2a1c'; ctx.fillRect(...box(c)); ctx.strokeStyle = '#754a2e'; ctx.strokeRect(...box(c));
        ctx.beginPath(); ctx.moveTo(c[0] * W, c[1] * W); ctx.lineTo((c[0] + c[2]) * W, (c[1] + c[3]) * W); ctx.moveTo((c[0] + c[2]) * W, c[1] * W); ctx.lineTo(c[0] * W, (c[1] + c[3]) * W); ctx.stroke();
      }
      // how the duels went: a dot for each
      for (let k = 0; k < DUELS; k++) {
        const ms = duels.times[k];
        ctx.fillStyle = ms === undefined ? 'rgba(255,255,255,.18)' : ms >= LEVELS[level].show * 1000 ? '#ef4444' : '#4ade80';
        ctx.beginPath(); ctx.arc(W / 2 + (k - (DUELS - 1) / 2) * W * 0.03, 0.04 * W, W * 0.008, 0, Math.PI * 2); ctx.fill();
      }
      pops = pops.filter((p) => t - p.at < 0.9);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 ${Math.max(12, W * 0.03)}px ${font}`;
      for (const p of pops) { const k = (t - p.at) / 0.9; ctx.globalAlpha = 1 - k * k; ctx.fillStyle = p.color; ctx.fillText(p.text, p.x * W, (p.y - 0.07 - k * 0.03) * W); }
      ctx.globalAlpha = 1;
      const hurt = Math.max(0, 1 - (t - hurtAt) / 0.35);
      if (hurt) { ctx.fillStyle = `rgba(239,68,68,${0.4 * hurt})`; ctx.fillRect(0, 0, W, H); }
      // the sights
      const [ax, ay] = [aim[0] * W, aim[1] * W], gap = W * 0.008, len = W * 0.018, kick = Math.max(0, 1 - (t - flashAt) / 0.12) * W * 0.012;
      ctx.strokeStyle = '#4ade80'; ctx.lineWidth = Math.max(1.5, W * 0.003); ctx.beginPath();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(ax + dx * (gap + kick), ay + dy * (gap + kick)); ctx.lineTo(ax + dx * (gap + kick + len), ay + dy * (gap + kick + len)); }
      ctx.stroke();
      ctx.fillStyle = '#4ade80'; ctx.fillRect(ax - 1, ay - 1, 2, 2);
      if (state === 'ready') {
        ctx.fillStyle = 'rgba(10,6,6,.6)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#f6f1ef'; ctx.font = `700 ${Math.max(15, W * 0.04)}px ${font}`; ctx.fillText('Click or tap to start', W / 2, H * 0.42);
        ctx.fillStyle = '#aca09f'; ctx.font = `500 ${Math.max(11, W * 0.024)}px ${font}`; ctx.fillText('Watch the doorway and the crates. Shoot the head.', W / 2, H * 0.42 + Math.max(20, W * 0.05));
      }
    }
    function frame(dt) {
      if (state === 'play') {
        duels.step(dt);
        for (const ev of duels.events.splice(0)) {
          if (ev.kind === 'lost') hurtAt = wall();
          pops.push({ at: wall(), x: ev.x, y: ev.y, text: ev.kind === 'lost' ? 'too slow' : `${ev.kind === 'head' ? 'HEADSHOT ' : ''}${ev.ms} ms`, color: ev.kind === 'lost' ? '#f87171' : ev.kind === 'head' ? '#fde047' : '#e8e0df' });
          api.score(duels.average()); api.status(`Duel ${Math.min(DUELS, duels.duel + 1)} of ${DUELS}`);
        }
        if (duels.over) {
          state = 'over';
          const kills = DUELS - duels.lost, hit = duels.shots ? Math.round(duels.hits / duels.shots * 100) : 0;
          endTimer = setTimeout(() => api.finish(duels.average(), { text: `Average ${duels.average()} ms · ${duels.heads} headshots of ${kills} kills · ${duels.lost} lost · ${hit}% of the shots hit` }), 500);
        }
      }
      draw();
    }
    const point = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.width]; };
    cv.addEventListener('pointermove', (e) => { aim = point(e); });
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault(); aim = point(e);
      if (state === 'ready') { state = 'play'; api.status(`Duel 1 of ${DUELS}`); return; }
      if (state !== 'play') return;
      flashAt = wall();
      const answer = duels.shoot(aim[0], aim[1], e.pointerType === 'mouse' ? 0 : 0.012); // a finger is blunter than a mouse
      if (answer === 'body') pops.push({ at: wall(), x: aim[0], y: aim[1], text: 'body', color: '#e8e0df' });
    });
    noScroll(cv);
    stage.querySelector('#pk-level').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { b.blur(); api.variant(b.dataset.l); reset(); } });
    reset();
    const stopFit = fitCanvas(cv, (w, h) => { W = w; H = h; draw(); });
    const stopLoop = loop(frame);
    return {
      restart: reset,
      key(e) { if ((e.key === ' ' || e.key === 'Enter') && state === 'ready') { state = 'play'; api.status(`Duel 1 of ${DUELS}`); return true; } },
      destroy() { stopFit(); stopLoop(); clearTimeout(endTimer); },
    };
  },
};
