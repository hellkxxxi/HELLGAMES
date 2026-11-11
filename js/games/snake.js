import { randInt } from '../util.js';

const N = 20;
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const KEYS = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };

export default {
  id: 'snake', name: 'Snake', icon: 'worm', color: '#a3e635', tag: 'Arcade',
  desc: 'Eat, grow, and don’t bite your own tail. Gets faster as you go.',
  help: 'Arrow keys / WASD or swipe to steer · Space to pause',
  swipe: true,
  create(stage, api) {
    stage.innerHTML = `
      <canvas class="board-canvas" id="sn-c"></canvas>
      <div class="dpad mt-4 sm:hidden">
        <span></span><button data-d="up" aria-label="Up"><i data-lucide="chevron-up"></i></button><span></span>
        <button data-d="left" aria-label="Left"><i data-lucide="chevron-left"></i></button>
        <button data-d="down" aria-label="Down"><i data-lucide="chevron-down"></i></button>
        <button data-d="right" aria-label="Right"><i data-lucide="chevron-right"></i></button>
      </div>`;
    const cv = stage.querySelector('#sn-c');
    const ctx = cv.getContext('2d');
    let snake, dir, queue, food, score, timer, running = false, paused = false, dead = false;

    function size() {
      const r = cv.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = cv.width;
      draw();
    }

    function reset() {
      snake = [[10, 10], [9, 10], [8, 10]];
      dir = 'right'; queue = []; score = 0; dead = false;
      placeFood(); api.score(0);
    }
    function placeFood() {
      do { food = [randInt(N), randInt(N)]; } while (snake.some((s) => s[0] === food[0] && s[1] === food[1]));
    }
    const speed = () => Math.max(55, 130 - score * 3);

    function step() {
      if (queue.length) dir = queue.shift();
      const [dx, dy] = DIRS[dir];
      const head = [snake[0][0] + dx, snake[0][1] + dy];
      const willEat = head[0] === food[0] && head[1] === food[1];
      const body = willEat ? snake : snake.slice(0, -1);
      if (head[0] < 0 || head[1] < 0 || head[0] >= N || head[1] >= N || body.some((s) => s[0] === head[0] && s[1] === head[1])) {
        dead = true; running = false; draw();
        api.finish(score);
        return;
      }
      snake.unshift(head);
      if (willEat) { score++; api.score(score); placeFood(); } else snake.pop();
      draw();
      timer = setTimeout(step, speed());
    }

    function draw() {
      const W = cv.width, c = W / N;
      ctx.fillStyle = '#11141c'; ctx.fillRect(0, 0, W, W);
      ctx.fillStyle = '#161a24';
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if ((x + y) % 2) ctx.fillRect(x * c, y * c, c, c);
      if (!snake) return;
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath(); ctx.arc(food[0] * c + c / 2, food[1] * c + c / 2, c * 0.34, 0, Math.PI * 2); ctx.fill();
      snake.forEach((s, i) => {
        const t = i / snake.length;
        ctx.fillStyle = dead ? '#71717a' : (i === 0 ? '#d9f99d' : `hsl(84, ${80 - t * 30}%, ${55 - t * 18}%)`);
        const p = c * 0.08;
        roundRect(s[0] * c + p, s[1] * c + p, c - p * 2, c - p * 2, c * 0.28);
      });
      const [hx, hy] = snake[0], [dx, dy] = DIRS[dir];
      ctx.fillStyle = '#1a2e05';
      const cx = hx * c + c / 2 + dx * c * 0.15, cy = hy * c + c / 2 + dy * c * 0.15;
      const ox = dy * c * 0.18, oy = dx * c * 0.18;
      [1, -1].forEach((m) => { ctx.beginPath(); ctx.arc(cx + ox * m, cy + oy * m, c * 0.08, 0, Math.PI * 2); ctx.fill(); });
    }
    function roundRect(x, y, w, h, r) {
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.fill();
    }

    function turn(d) {
      if (dead) return;
      if (!running) { api.hideOverlay(); begin(); }
      if (paused) return;
      const last = queue.length ? queue[queue.length - 1] : dir;
      const [lx, ly] = DIRS[last], [nx, ny] = DIRS[d];
      if (lx + nx === 0 && ly + ny === 0) return;
      if (last === d || queue.length > 2) return;
      queue.push(d);
    }
    function begin() {
      if (running || dead) return;
      running = true; paused = false; api.status('');
      timer = setTimeout(step, speed());
    }
    function togglePause() {
      if (!running) return;
      paused = !paused;
      if (paused) { clearTimeout(timer); api.status('Paused'); api.overlay({ title: 'Paused', icon: 'pause', button: 'Resume', onClick: togglePause }); }
      else { api.status(''); timer = setTimeout(step, speed()); }
    }

    stage.querySelectorAll('.dpad button').forEach((b) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); turn(b.dataset.d); }));
    const ro = new ResizeObserver(size); ro.observe(cv);
    reset(); size();
    api.overlay({ title: 'Snake', text: 'Use arrow keys, WASD or swipe to steer.', icon: 'play', button: 'Start', onClick: begin });

    return {
      key(e) {
        if (e.key === ' ' || e.key === 'p' || e.key === 'P') { togglePause(); return true; }
        const d = KEYS[e.key]; if (d) { turn(d); return true; }
      },
      swipe: turn,
      destroy() { clearTimeout(timer); ro.disconnect(); },
    };
  },
};
