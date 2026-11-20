import { fitCanvas, loop, noScroll } from '../util.js';

// ---------------------------------------------------------------- the rules (nothing is drawn here)
// Two rows of creeps wear each other down. A blow of yours that finishes an enemy creep is a last hit
// (that is where the gold is in a MOBA); one that finishes a creep of your own side, once it is below
// half its health, is a deny. Your blow takes a moment to land, so it has to be sent a little early.
// Every creep is hit by the other row at a pace of its own, so the creeps of a wave fall one after another.
export const WAVES = 5, WAVE_EVERY = 11, WAVE_SIZE = 4; // so many waves, so many seconds apart, so many creeps a side in each
export const HEALTH = 220, DAMAGE = 50;        // of a creep, and of one blow of yours
const PACE = [0.9, 1.6];                       // a creep takes so many hits a second, somewhere between these two
export const KINDS = {
  melee: { windup: 0.3, flight: 0, rest: 0.9 },   // a blow lands so long after the click; then the hero needs a rest
  ranged: { windup: 0.35, flight: 0.3, rest: 1 }, // an arrow has to fly as well
};
export const STUMBLE = 1.5; // a blow that finishes nothing throws the hero off balance for so long: hitting away at random gets nowhere
const SLOTS = [0.2, 0.4, 0.6, 0.8]; // where the creeps of a row stand, from left to right

export function createLane(kind = 'melee', rnd = Math.random) {
  const { windup, flight, rest } = KINDS[kind];
  const lane = { time: 0, creeps: [], lastHits: 0, denies: 0, lost: 0, left: WAVES * WAVE_SIZE, sent: 0, waves: 0, over: false, events: [], blow: null, ready: 0 };
  let nextId = 1;
  const alive = (side) => lane.creeps.filter((c) => c.side === side && c.hp > 0);
  // A new wave lines up; where a creep of the wave before still stands, the newcomer waits behind it (`back` rows behind).
  function wave() {
    lane.waves++;
    for (const side of ['enemy', 'ally']) for (let k = 0; k < WAVE_SIZE; k++) {
      const back = alive(side).filter((c) => c.slot === SLOTS[k]).length;
      lane.creeps.push({ id: nextId++, side, slot: SLOTS[k], back, hp: HEALTH, every: 1 / (PACE[0] + rnd() * (PACE[1] - PACE[0])), wait: 0.3 + rnd() * 0.8, hurt: 0 });
    }
  }
  // What a click on a creep would do: 'go' sends a blow; 'busy' while the hero rests or a blow is under
  // way; 'healthy' for a creep of one's own side that is not below half yet; 'gone' for a dead one.
  lane.aim = (id) => {
    const creep = lane.creeps.find((c) => c.id === id);
    if (!creep || creep.hp <= 0) return 'gone';
    if (lane.blow || lane.time < lane.ready) return 'busy';
    return creep.side === 'ally' && creep.hp >= HEALTH / 2 ? 'healthy' : 'go';
  };
  lane.attack = (id) => {
    const answer = lane.aim(id);
    if (answer === 'go') { lane.blow = { id, lands: lane.time + windup + flight, sent: lane.time }; lane.sent++; }
    return answer;
  };
  lane.step = (dt) => {
    if (lane.over) return;
    lane.time += dt;
    if (lane.waves * WAVE_EVERY <= lane.time && lane.waves < WAVES) wave();
    // the creeps are hit by the other row, each at its own pace and never quite evenly
    for (const c of lane.creeps) {
      if (c.hp <= 0) continue;
      c.hurt = Math.max(0, c.hurt - dt);
      c.wait -= dt;
      if (c.wait > 0) continue;
      c.wait += c.every * (0.8 + rnd() * 0.4);
      c.hp -= 19 + Math.floor(rnd() * 5); c.hurt = 0.15;
      if (c.hp <= 0) { c.hp = 0; if (c.side === 'enemy') lane.lost++; lane.events.push({ kind: 'died', id: c.id, side: c.side, slot: c.slot, back: c.back }); }
    }
    for (const c of lane.creeps) if (c.hp > 0 && c.back) c.back = alive(c.side).filter((o) => o.slot === c.slot && o.id < c.id).length; // step forward when the one in front is gone
    // the hero's blow lands
    if (lane.blow && lane.time >= lane.blow.lands) {
      const creep = lane.creeps.find((c) => c.id === lane.blow.id);
      lane.ready = lane.blow.sent + rest; lane.blow = null;
      if (creep.hp <= 0) { lane.ready = lane.time + STUMBLE; lane.events.push({ kind: 'late', id: creep.id, side: creep.side, slot: creep.slot, back: creep.back }); } // the creeps were quicker
      else {
        creep.hp = Math.max(0, creep.hp - DAMAGE); creep.hurt = 0.15;
        if (creep.hp > 0) { lane.ready = lane.time + STUMBLE; lane.events.push({ kind: 'early', id: creep.id, side: creep.side, slot: creep.slot, back: creep.back }); }
        else if (creep.side === 'enemy') { lane.lastHits++; lane.events.push({ kind: 'lasthit', id: creep.id, side: creep.side, slot: creep.slot, back: creep.back }); }
        else { lane.denies++; lane.events.push({ kind: 'deny', id: creep.id, side: creep.side, slot: creep.slot, back: creep.back }); }
      }
    }
    lane.left = WAVES * WAVE_SIZE - lane.lastHits - lane.lost; // enemy creeps still to fall
    if (!lane.blow && lane.left === 0) lane.over = true;
  };
  return lane;
}
// How many enemy creeps there are to be had in a game.
export const CREEPS = WAVES * WAVE_SIZE;

// ---------------------------------------------------------------- the game on screen
const wall = () => performance.now() / 1000;
const ROW = { enemy: 0.33, ally: 0.57 }, BEHIND = { enemy: -0.17, ally: 0.15 }, HERO = [0.5, 0.88];
const rowOf = (c) => ROW[c.side] + BEHIND[c.side] * c.back; // how far down the picture a creep stands, as a share of its height

export default {
  id: 'lasthit', name: 'Last Hit', icon: 'swords', color: '#facc15', tag: 'Skill', since: '1.1',
  desc: 'For MOBA players: strike the blow that finishes a creep. Too early is wasted, too late and the gold is gone.',
  help: 'Click or tap an enemy creep when one blow will finish it: its bar turns yellow · a blow that finishes nothing costs time · your own creeps below half can be denied',
  variants: { melee: 'Melee', ranged: 'Ranged' },
  create(stage, api) {
    stage.innerHTML = `
      <div class="mn-top"><div class="seg" id="lh-kind">${Object.entries(this.variants).map(([id, name]) => `<button data-k="${id}">${name}</button>`).join('')}</div></div>
      <div class="timebar wide lh-bar"><div id="lh-bar" style="width:100%"></div></div>
      <canvas class="lasthit" id="lh-c"></canvas>`;
    const cv = stage.querySelector('#lh-c'), ctx = cv.getContext('2d'), bar = stage.querySelector('#lh-bar');
    const kindBtns = [...stage.querySelectorAll('#lh-kind button')];
    const font = getComputedStyle(document.body).fontFamily;
    let W = 1, H = 1, kind, lane, state = 'ready', pops = [], shown = '', endTimer = null, swingAt = -9, swingTo = null;

    function reset() {
      clearTimeout(endTimer); api.hideOverlay();
      kind = KINDS[api.variant()] ? api.variant() : 'melee';
      kindBtns.forEach((b) => b.classList.toggle('on', b.dataset.k === kind));
      lane = createLane(kind); lane.step(0); // the first wave stands ready
      state = 'ready'; pops = []; shown = '';
      bar.style.width = '100%'; api.score(0); api.status(`${CREEPS} creeps in ${WAVES} waves`);
    }
    const spot = (c) => [c.slot * W, rowOf(c) * H];

    function creep(c, t) {
      const [x, y] = spot(c), r = Math.min(W, H) * 0.06, foe = c.side === 'enemy', dead = c.hp <= 0;
      if (dead) return;
      const bob = Math.sin(t * 6 + c.id) * r * 0.06, hit = c.hurt > 0 ? 1 : 0;
      ctx.lineWidth = Math.max(1.5, r * 0.09); ctx.strokeStyle = '#1a0b0a'; ctx.lineJoin = 'round';
      // body: a squat creature with horns for the enemy, a round helmet for one's own side
      ctx.fillStyle = hit ? '#fff' : foe ? '#dc2626' : '#16a34a';
      ctx.beginPath(); ctx.ellipse(x, y + bob, r, r * 0.92, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = foe ? '#fde68a' : '#bbf7d0';
      if (foe) for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + s * r * 0.45, y + bob - r * 0.7); ctx.lineTo(x + s * r * 0.95, y + bob - r * 1.35); ctx.lineTo(x + s * r * 0.85, y + bob - r * 0.4); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(x, y + bob - r * 0.25, r * 0.98, Math.PI * 1.08, Math.PI * 1.92); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = '#18090a';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x + s * r * 0.36, y + bob + r * 0.05 * (foe ? 1 : 3), r * 0.13, 0, Math.PI * 2); ctx.fill(); }
      // the bar: health left, and the mark below which one blow is enough
      const bw = r * 2.8, bh = Math.max(6, r * 0.4), bx = x - bw / 2, by = y - r * 2.05, part = c.hp / HEALTH, ripe = c.hp <= DAMAGE;
      ctx.fillStyle = '#0d0707'; ctx.fillRect(bx - 1.5, by - 1.5, bw + 3, bh + 3);
      ctx.fillStyle = '#3a1a17'; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = ripe ? '#fde047' : foe ? '#ef4444' : '#22c55e'; ctx.fillRect(bx, by, bw * part, bh);
      ctx.fillStyle = '#fff'; ctx.fillRect(bx + bw * DAMAGE / HEALTH - 1, by - 2, 2, bh + 4);
      if (!foe && part < 0.5) { ctx.strokeStyle = '#a3e635'; ctx.lineWidth = 1.5; ctx.strokeRect(bx - 2.5, by - 2.5, bw + 5, bh + 5); } // may be denied now
    }
    function draw() {
      const t = wall(), unit = Math.min(W, H);
      const ground = ctx.createLinearGradient(0, 0, 0, H);
      ground.addColorStop(0, '#1a0c0b'); ground.addColorStop(1, '#261310');
      ctx.fillStyle = ground; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#3a1c18'; ctx.lineWidth = 2; ctx.setLineDash([unit * 0.02, unit * 0.02]); // the line where the rows meet
      ctx.beginPath(); ctx.moveTo(0, (ROW.enemy + ROW.ally) / 2 * H); ctx.lineTo(W, (ROW.enemy + ROW.ally) / 2 * H); ctx.stroke(); ctx.setLineDash([]);
      for (const c of [...lane.creeps].sort((a, b) => rowOf(a) - rowOf(b))) creep(c, t); // the ones further up first, so that nobody hides a bar
      // the hero, and its blow on the way
      const [hx, hy] = [HERO[0] * W, HERO[1] * H], hr = unit * 0.06, resting = lane.time < lane.ready || lane.blow;
      ctx.lineWidth = Math.max(1.5, hr * 0.09); ctx.strokeStyle = '#1a0b0a';
      ctx.fillStyle = '#fde68a'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(hx + s * hr * 0.4, hy - hr * 0.75); ctx.lineTo(hx + s * hr * 1.05, hy - hr * 1.45); ctx.lineTo(hx + s * hr * 0.9, hy - hr * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = resting ? '#b45309' : '#f97316'; ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#18090a'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(hx + s * hr * 0.35, hy - hr * 0.1, hr * 0.13, 0, Math.PI * 2); ctx.fill(); }
      if (lane.blow) {
        const target = lane.creeps.find((c) => c.id === lane.blow.id), [tx, ty] = spot(target), k = Math.min(1, (lane.time - lane.blow.sent) / (lane.blow.lands - lane.blow.sent));
        if (kind === 'ranged') { const fly = Math.max(0, (lane.time - lane.blow.sent - KINDS.ranged.windup) / KINDS.ranged.flight); ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(hx + (tx - hx) * fly, hy + (ty - hy) * fly, hr * 0.22, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.strokeStyle = `rgba(253,224,71,${0.25 + 0.6 * k})`; ctx.lineWidth = Math.max(2, hr * 0.18); ctx.beginPath(); ctx.moveTo(hx, hy - hr); ctx.lineTo(hx + (tx - hx) * k, hy - hr + (ty + hr * 0.5 - hy) * k); ctx.stroke(); }
      }
      if (t - swingAt < 0.16 && swingTo) { ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, hr * 0.14); ctx.beginPath(); ctx.arc(swingTo[0], swingTo[1], hr * (0.9 + (t - swingAt) * 3), -2.4, -0.7); ctx.stroke(); }
      // what the last blows did
      pops = pops.filter((p) => t - p.at < 0.9);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 ${Math.max(12, unit * 0.04)}px ${font}`;
      for (const p of pops) { const k = (t - p.at) / 0.9; ctx.globalAlpha = 1 - k * k; ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y - unit * (0.11 + k * 0.05)); }
      ctx.globalAlpha = 1;
      if (lane.denies) { ctx.textAlign = 'left'; ctx.fillStyle = '#a3e635'; ctx.font = `600 ${Math.max(11, unit * 0.032)}px ${font}`; ctx.fillText(`${lane.denies} denied`, unit * 0.03, unit * 0.045); ctx.textAlign = 'center'; }
      if (state === 'ready') {
        ctx.fillStyle = 'rgba(10,6,6,.55)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#f6f1ef'; ctx.font = `700 ${Math.max(15, unit * 0.055)}px ${font}`; ctx.fillText('Click or tap to start', W / 2, H * 0.44);
        ctx.fillStyle = '#aca09f'; ctx.font = `500 ${Math.max(11, unit * 0.032)}px ${font}`; ctx.fillText('Hit a creep when its bar turns yellow', W / 2, H * 0.44 + Math.max(20, unit * 0.07));
      }
    }
    function frame(dt) {
      if (state === 'play') {
        lane.step(dt);
        for (const ev of lane.events.splice(0)) {
          const text = { lasthit: '+gold', deny: 'Denied!', early: 'too early', late: 'too late' }[ev.kind];
          if (ev.kind === 'lasthit' || ev.kind === 'deny' || ev.kind === 'early') { swingAt = wall(); swingTo = spot(ev); }
          if (text) pops.push({ at: wall(), x: spot(ev)[0], y: spot(ev)[1], text, color: { lasthit: '#fde047', deny: '#a3e635', early: '#aca09f', late: '#f87171' }[ev.kind] });
        }
        const line = `${lane.lastHits}|${lane.denies}|${lane.left}|${lane.waves}`;
        if (line !== shown) {
          shown = line; api.score(lane.lastHits);
          api.status(`Wave ${lane.waves} of ${WAVES} · ${lane.lost} lost`);
          bar.style.width = lane.left / CREEPS * 100 + '%';
        }
        if (lane.over) {
          state = 'over';
          const share = Math.round(lane.lastHits / CREEPS * 100);
          endTimer = setTimeout(() => api.finish(lane.lastHits, { endTitle: 'The lane is clear', text: `${lane.lastHits} of ${CREEPS} last hits (${share}%) · ${lane.denies} denied · ${lane.sent} blows` }), 400);
        }
      }
      draw();
    }
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (state === 'ready') { state = 'play'; return; }
      if (state !== 'play') return;
      const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height, reach = (e.pointerType === 'mouse' ? 0.085 : 0.11);
      // the creep nearest to the click, if it is close enough; its bar counts as part of it
      let best = null, gap = reach;
      for (const c of lane.creeps) { if (c.hp <= 0) continue; const d = Math.hypot((c.slot - x) * r.width, (rowOf(c) - 0.04 - y) * r.height) / Math.min(r.width, r.height); if (d < gap) { best = c; gap = d; } }
      if (!best) return;
      const answer = lane.attack(best.id);
      if (answer === 'healthy') pops.push({ at: wall(), x: spot(best)[0], y: spot(best)[1], text: 'not below half', color: '#aca09f' });
    });
    noScroll(cv);
    stage.querySelector('#lh-kind').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { b.blur(); api.variant(b.dataset.k); reset(); } });
    reset();
    const stopFit = fitCanvas(cv, (w, h) => { W = w; H = h; draw(); });
    const stopLoop = loop(frame);
    return {
      restart: reset,
      key(e) { if ((e.key === ' ' || e.key === 'Enter') && state === 'ready') { state = 'play'; return true; } },
      destroy() { stopFit(); stopLoop(); clearTimeout(endTimer); },
    };
  },
};
