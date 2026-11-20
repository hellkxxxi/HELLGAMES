import { clamp, fitCanvas, loop, noScroll } from '../util.js';

// ---------------------------------------------------------------- rules
// The table is measured in its own units: 1 across (the direction the paddles move in) and LEN along
// (from one player to the other). Player 0 guards the end at 0, player 1 the end at LEN.
export const LEN = 1.5, WIN = 7;
export const HALF = 0.1;                    // half the width of a paddle
const FACE = 0.07;                          // how far a paddle stands from its end of the table
const BALL = 0.017;                         // radius of the ball
const START_SPEED = 0.95, FASTER = 1.045, TOP_SPEED = 2.5; // units a second; every hit speeds the ball up
const MAX_ANGLE = 55 * Math.PI / 180;       // the edge of a paddle sends the ball off at this angle
const KEY_SPEED = 1.35;                     // paddle speed when it is moved with keys
// How the computer plays: how fast its paddle moves, how far off its aim can be, and how far the ball
// has to come (as a share of the table) before it starts to react.
export const LEVELS = {
  easy: { speed: 0.6, error: 0.19, wakes: 0.45 },
  normal: { speed: 0.9, error: 0.14, wakes: 0.2 },
  hard: { speed: 1.2, error: 0.126, wakes: 0 },
};

// A match. `level` is a key of LEVELS, or null when both paddles belong to people.
export function createPong(level, rnd = Math.random) {
  const ai = level ? LEVELS[level] : null;
  const g = {
    ball: { a: 0.5, l: LEN / 2, va: 0, vl: 0 }, pads: [0.5, 0.5], score: [0, 0], winner: null,
    serveIn: 0.9, serveTo: rnd() < 0.5 ? 0 : 1, speed: START_SPEED, events: [],
  };
  let aim = 0; // where on its paddle the computer means to take the next ball, off by its error

  function serve() {
    const angle = (rnd() * 2 - 1) * 0.42;
    g.speed = START_SPEED;
    g.ball.va = Math.sin(angle) * g.speed;
    g.ball.vl = Math.cos(angle) * g.speed * (g.serveTo === 0 ? -1 : 1);
    aim = (rnd() * 2 - 1) * (ai ? ai.error : 0);
  }
  // Where across the table the ball will be when it reaches player 1, bounces off the sides included.
  function landing() {
    const { a, l, va, vl } = g.ball;
    const t = (LEN - FACE - BALL - l) / vl, span = 1 - 2 * BALL;
    let x = (a - BALL + va * t) % (2 * span);
    if (x < 0) x += 2 * span;
    return BALL + (x > span ? 2 * span - x : x);
  }
  function think(dt) {
    const coming = g.ball.vl > 0 && g.ball.l > LEN * ai.wakes;
    const target = coming ? landing() + aim : 0.5;
    const reach = ai.speed * (coming ? 1 : 0.5) * dt;
    g.pads[1] = clamp(g.pads[1] + clamp(target - g.pads[1], -reach, reach), HALF, 1 - HALF);
  }
  function point(to) {
    g.score[to]++;
    g.events.push({ kind: 'goal', by: to });
    if (g.score[to] >= WIN) { g.winner = to; return; }
    g.ball = { a: 0.5, l: LEN / 2, va: 0, vl: 0 };
    g.serveIn = 0.9; g.serveTo = 1 - to; // the one who lost the point receives
  }
  function move(dt) {
    const b = g.ball, before = b.l;
    b.a += b.va * dt; b.l += b.vl * dt;
    if (b.a < BALL) { b.a = 2 * BALL - b.a; b.va = Math.abs(b.va); g.events.push({ kind: 'wall' }); }
    if (b.a > 1 - BALL) { b.a = 2 * (1 - BALL) - b.a; b.va = -Math.abs(b.va); g.events.push({ kind: 'wall' }); }
    for (const p of [0, 1]) {
      const face = p === 0 ? FACE + BALL : LEN - FACE - BALL, towards = p === 0 ? b.vl < 0 : b.vl > 0;
      const crossed = p === 0 ? before >= face && b.l < face : before <= face && b.l > face;
      if (!towards || !crossed || Math.abs(b.a - g.pads[p]) > HALF + BALL) continue;
      g.speed = Math.min(TOP_SPEED, g.speed * FASTER);
      const angle = clamp((b.a - g.pads[p]) / HALF, -1, 1) * MAX_ANGLE;
      b.l = face; b.va = Math.sin(angle) * g.speed; b.vl = Math.cos(angle) * g.speed * (p === 0 ? 1 : -1);
      if (ai) aim = (rnd() * 2 - 1) * ai.error;
      g.events.push({ kind: 'hit', by: p });
    }
    if (b.l < -3 * BALL) point(1); else if (b.l > LEN + 3 * BALL) point(0);
  }

  // Moves the match on by dt seconds. `pads` holds the new place of every paddle a person moves.
  g.step = (dt, pads = []) => {
    if (g.winner !== null) return;
    for (const p of [0, 1]) if (typeof pads[p] === 'number') g.pads[p] = clamp(pads[p], HALF, 1 - HALF);
    for (let left = dt; left > 0 && g.winner === null; left -= 1 / 240) {
      const h = Math.min(left, 1 / 240);
      if (ai) think(h);
      if (g.serveIn > 0) { g.serveIn -= h; if (g.serveIn <= 0) serve(); } else move(h);
    }
  };
  return g;
}

// ---------------------------------------------------------------- the game on the page
const COLORS = ['#ff8a3d', '#f43f5e'], NAMES = ['Orange', 'Red'];
const MINUS = { w: 0, a: 0, ArrowUp: 1, ArrowLeft: 1 }, PLUS = { s: 0, d: 0, ArrowDown: 1, ArrowRight: 1 }; // key -> whose paddle in a game for two

export default {
  id: 'pong', name: 'Hell Pong', icon: 'joystick', color: '#38bdf8', tag: 'Arcade', since: '1.1',
  desc: 'The oldest video game there is. First to seven, against the computer or a friend on the same screen.',
  help: 'Move your paddle with the mouse, a finger, W S or the arrow keys · two players: W S against the arrows, or a finger each · P pauses',
  scoreLabel: 'Streak',
  variants: { easy: 'Easy', normal: 'Normal', hard: 'Hard', duo: '2 players' },
  create(stage, api) {
    const { variants } = this;
    stage.innerHTML = `
      <div class="seg" id="pg-mode" style="margin-bottom:12px">${Object.entries(variants).map(([id, name]) => `<button data-m="${id}">${name}</button>`).join('')}</div>
      <canvas class="pong" id="pg-c"></canvas>`;
    const cv = stage.querySelector('#pg-c'), ctx = cv.getContext('2d');
    const modeBtns = [...stage.querySelectorAll('#pg-mode button')];
    const font = getComputedStyle(document.body).fontFamily;
    let W = 1, H = 1, wide = true, game, mode, state, endTimer = null;
    const held = new Set(), fingers = new Map(), want = [null, null]; // want: where a pointer asks each paddle to be
    let trail = [], sparks = [], flash = 0;

    const streakKey = () => 'arcade:pong:streak:' + mode;
    const streak = () => { try { return Number(localStorage.getItem(streakKey())) || 0; } catch { return 0; } };
    const saveStreak = (n) => { try { localStorage.setItem(streakKey(), String(n)); } catch { /* not vital */ } };

    function reset() {
      clearTimeout(endTimer); api.hideOverlay();
      mode = variants[api.variant()] ? api.variant() : 'easy';
      game = createPong(mode === 'duo' ? null : mode);
      state = 'ready'; trail = []; sparks = []; want[0] = want[1] = null; held.clear(); fingers.clear();
      modeBtns.forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
      api.score(mode === 'duo' ? '–' : streak());
      api.status(`First to ${WIN}`);
    }
    function begin() { if (state === 'ready') state = 'play'; }
    function pause() {
      if (state !== 'play') return;
      state = 'paused'; held.clear();
      api.overlay({ title: 'Paused', text: 'Enter or Space to continue', icon: 'pause', button: 'Resume', onClick: () => { state = 'play'; } });
    }
    function finish() {
      state = 'done';
      const [mine, theirs] = game.score, line = `${mine} : ${theirs}`;
      endTimer = setTimeout(() => {
        if (mode === 'duo') { api.finish(null, { title: `${NAMES[game.winner]} wins`, text: line, icon: 'trophy' }); return; }
        const won = game.winner === 0, now = won ? streak() + 1 : 0;
        saveStreak(now); api.score(now);
        api.finish(now, { title: won ? undefined : 'You lose', endTitle: 'You win', text: won ? `${line} · ${now} ${now === 1 ? 'win' : 'wins'} in a row` : line });
      }, 500);
    }

    // ---- drawing. Wide screens show the table lying down (you play on the left), narrow ones standing up (you play at the bottom).
    const px = (a, l) => (wide ? [l / LEN * W, a * H] : [a * W, (1 - l / LEN) * H]);
    function draw(now) {
      const U = wide ? H : W; // one unit across, in pixels
      ctx.fillStyle = '#0d0707'; ctx.fillRect(0, 0, W, H);
      const glow = ctx.createLinearGradient(0, 0, wide ? W : 0, wide ? 0 : H);
      glow.addColorStop(0, 'rgba(244,63,94,.10)'); glow.addColorStop(0.5, 'rgba(0,0,0,0)'); glow.addColorStop(1, 'rgba(255,138,61,.10)');
      if (wide) { ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1); ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H); ctx.restore(); } else { ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H); }

      // the net and the score of each side behind the play
      ctx.strokeStyle = '#3a2422'; ctx.lineWidth = Math.max(2, U * 0.008); ctx.setLineDash([U * 0.03, U * 0.03]);
      ctx.beginPath(); ctx.moveTo(...px(0, LEN / 2)); ctx.lineTo(...px(1, LEN / 2)); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = `800 ${U * 0.3}px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const p of [0, 1]) {
        ctx.fillStyle = p === 0 ? 'rgba(255,138,61,.16)' : 'rgba(244,63,94,.16)';
        ctx.fillText(String(game.score[p]), ...px(0.5, p === 0 ? LEN * 0.27 : LEN * 0.73));
      }
      if (flash > 0) { ctx.fillStyle = `rgba(255,120,60,${flash * 0.25})`; ctx.fillRect(0, 0, W, H); }

      // paddles
      for (const p of [0, 1]) {
        const [x, y] = px(game.pads[p], p === 0 ? FACE - 0.011 : LEN - FACE + 0.011);
        const long = HALF * 2 * U, thick = 0.022 * U * (wide ? W / (LEN * H) : H / (LEN * W));
        ctx.shadowColor = COLORS[p]; ctx.shadowBlur = U * 0.04; ctx.fillStyle = COLORS[p];
        ctx.beginPath();
        if (wide) ctx.roundRect(x - thick / 2, y - long / 2, thick, long, thick / 2); else ctx.roundRect(x - long / 2, y - thick / 2, long, thick, thick / 2);
        ctx.fill(); ctx.shadowBlur = 0;
      }
      // sparks where the ball was hit
      sparks = sparks.filter((s) => now - s.at < 0.3);
      for (const s of sparks) {
        const k = (now - s.at) / 0.3, [x, y] = px(s.a, s.l);
        ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = Math.max(1.5, U * 0.006);
        ctx.beginPath(); ctx.arc(x, y, U * (0.02 + k * 0.07), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      }
      // the ball with its tail of fire
      const heat = clamp((game.speed - START_SPEED) / (TOP_SPEED - START_SPEED), 0, 1);
      trail.forEach((t, i) => {
        const [x, y] = px(t.a, t.l), k = (i + 1) / trail.length;
        ctx.globalAlpha = k * 0.35; ctx.fillStyle = '#ff6a2a';
        ctx.beginPath(); ctx.arc(x, y, BALL * U * (0.4 + k * 0.6), 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
      const [bx, by] = px(game.ball.a, game.ball.l);
      ctx.shadowColor = '#ff7a2a'; ctx.shadowBlur = U * (0.04 + heat * 0.05);
      ctx.fillStyle = `rgb(255,${Math.round(205 + heat * 50)},${Math.round(120 + heat * 135)})`;
      ctx.beginPath(); ctx.arc(bx, by, BALL * U, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;

      if (state === 'ready') {
        ctx.fillStyle = 'rgba(13,7,7,.6)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#f6f1ef'; ctx.font = `700 ${U * 0.075}px ${font}`; ctx.fillText('Get ready', W / 2, H / 2 - U * 0.05);
        ctx.fillStyle = '#aca09f'; ctx.font = `500 ${U * 0.042}px ${font}`; ctx.fillText('Click, tap or press Space to serve', W / 2, H / 2 + U * 0.04);
      }
    }

    const wall = () => performance.now() / 1000;
    function frame(dt) {
      if (state === 'play') {
        const pads = [];
        for (const p of [0, 1]) {
          if (p === 1 && mode !== 'duo') continue;
          if (want[p] !== null) { pads[p] = want[p]; continue; }
          let dir = 0;
          for (const key of held) {
            const mine = mode !== 'duo' ? p === 0 : (MINUS[key] ?? PLUS[key]) === p;
            if (mine) dir += key in PLUS ? 1 : -1;
          }
          if (dir) pads[p] = game.pads[p] + Math.sign(dir) * KEY_SPEED * dt;
        }
        game.step(dt, pads);
        trail.push({ a: game.ball.a, l: game.ball.l }); if (trail.length > 12) trail.shift();
        for (const ev of game.events.splice(0)) {
          if (ev.kind === 'hit') sparks.push({ a: game.ball.a, l: game.ball.l, at: wall() });
          if (ev.kind === 'goal') { flash = 1; trail = []; api.status(mode === 'duo' ? `${NAMES[ev.by]} scores` : ev.by === 0 ? 'Your point' : 'Their point'); }
        }
        if (game.winner !== null) finish();
      }
      flash = Math.max(0, flash - dt * 3);
      draw(wall());
    }

    // ---- input
    const where = (e) => {
      const r = cv.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
      const along = wide ? fx : 1 - fy; // 0 at player 0's end
      return { a: wide ? fy : fx, who: mode === 'duo' && along > 0.5 ? 1 : 0 };
    };
    cv.addEventListener('pointerdown', (e) => {
      begin();
      const { a, who } = where(e);
      fingers.set(e.pointerId, who); want[who] = a;
      try { cv.setPointerCapture(e.pointerId); } catch { /* not vital */ }
      e.preventDefault();
    });
    cv.addEventListener('pointermove', (e) => {
      const { a, who } = where(e);
      if (fingers.has(e.pointerId)) want[fingers.get(e.pointerId)] = a; // a finger keeps the paddle it took
      else if (e.pointerType === 'mouse') want[who] = a;                // a mouse steers without a button held
    });
    const lift = (e) => {
      if (!fingers.has(e.pointerId)) return;
      const who = fingers.get(e.pointerId); fingers.delete(e.pointerId);
      if (e.pointerType !== 'mouse' && ![...fingers.values()].includes(who)) want[who] = null;
    };
    cv.addEventListener('pointerup', lift); cv.addEventListener('pointercancel', lift);
    cv.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !fingers.size) want[0] = want[1] = null; });
    noScroll(cv);
    stage.querySelector('#pg-mode').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      b.blur(); api.variant(b.dataset.m); reset();
    });
    const onHide = () => { if (document.hidden) pause(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('blur', pause);

    const stopFit = fitCanvas(cv, (w, h) => { W = w; H = h; wide = w >= h; });
    reset();
    const stopLoop = loop(frame);
    return {
      restart: reset,
      key(e) {
        if (e.key === 'p') { if (!e.repeat) pause(); return true; }
        if (e.key === ' ' || e.key === 'Enter') { begin(); return true; }
        if (!(e.key in MINUS) && !(e.key in PLUS)) return;
        begin(); held.add(e.key);
        want[mode === 'duo' ? (MINUS[e.key] ?? PLUS[e.key]) : 0] = null; // the keys take over from the mouse
        return true;
      },
      keyup(e) { held.delete(e.key); },
      destroy() {
        stopFit(); stopLoop(); clearTimeout(endTimer);
        document.removeEventListener('visibilitychange', onHide);
        window.removeEventListener('blur', pause);
      },
    };
  },
};
