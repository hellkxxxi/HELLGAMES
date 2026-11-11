import { drawIcons } from '../util.js';

const N = 10, MINES = 15;
const NUM_COLORS = ['', '#60a5fa', '#4ade80', '#f87171', '#c084fc', '#fbbf24', '#22d3ee', '#f472b6', '#e8e3e3'];

export default {
  id: 'mines', name: 'Minesweeper', icon: 'bomb', color: '#f87171', tag: 'Logic',
  desc: 'Clear the field without hitting a mine. Numbers show nearby mines.',
  help: 'Click to dig · right-click, long-press or Flag mode to mark mines',
  scoreLabel: 'Time', lowerBetter: true,
  format: (v) => `${v}s`,
  create(stage, api) {
    stage.innerHTML = `
      <div class="seg mb-4" id="mode">
        <button data-m="dig" class="on"><i data-lucide="shovel" style="width:15px;height:15px"></i> Dig</button>
        <button data-m="flag"><i data-lucide="flag" style="width:15px;height:15px"></i> Flag</button>
      </div>
      <div class="mines" id="mf" style="grid-template-columns:repeat(${N},1fr)"></div>`;
    const field = stage.querySelector('#mf');
    let cells, started = false, over = false, flagMode = false, t0 = 0, timer = null, opened = 0;

    cells = Array.from({ length: N * N }, (_, i) => ({ i, mine: false, open: false, flag: false, n: 0 }));
    field.innerHTML = cells.map((c) => `<button class="mc" data-i="${c.i}" aria-label="Cell"></button>`).join('');
    const els = [...field.children];

    const nbrs = (i) => {
      const x = i % N, y = Math.floor(i / N), r = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < N && ny < N) r.push(ny * N + nx);
      }
      return r;
    };

    function plant(safe) {
      const banned = new Set([safe, ...nbrs(safe)]);
      let placed = 0;
      while (placed < MINES) {
        const i = Math.floor(Math.random() * N * N);
        if (banned.has(i) || cells[i].mine) continue;
        cells[i].mine = true; placed++;
      }
      cells.forEach((c) => { c.n = nbrs(c.i).filter((j) => cells[j].mine).length; });
    }

    function paint(i) {
      const c = cells[i], el = els[i];
      el.className = 'mc' + (c.open ? ' open' : '') + (c.boom ? ' boom' : '');
      if (c.open && c.mine) el.innerHTML = '<i data-lucide="bomb"></i>';
      else if (c.open) { el.textContent = c.n || ''; el.style.color = NUM_COLORS[c.n]; }
      else if (c.flag) { el.innerHTML = '<i data-lucide="flag" style="color:#f87171"></i>'; }
      else el.innerHTML = '';
    }
    const status = () => api.status(`${MINES - cells.filter((c) => c.flag).length} mines left`);

    function reveal(i) {
      const stack = [i];
      while (stack.length) {
        const j = stack.pop(), c = cells[j];
        if (c.open || c.flag) continue;
        c.open = true; opened++; paint(j);
        if (!c.mine && c.n === 0) nbrs(j).forEach((k) => !cells[k].open && stack.push(k));
      }
    }

    function dig(i) {
      if (over) return;
      const c = cells[i];
      if (c.flag) return;
      if (!started) {
        started = true; plant(i); t0 = Date.now();
        timer = setInterval(() => api.score(Math.floor((Date.now() - t0) / 1000)), 250);
      }
      if (c.open) { // chord
        const ns = nbrs(i);
        if (c.n && ns.filter((k) => cells[k].flag).length === c.n) ns.forEach((k) => { if (!cells[k].open && !cells[k].flag) openCell(k); });
      } else openCell(i);
      drawIcons();
      if (!over && opened === N * N - MINES) win();
    }
    function openCell(i) {
      if (over) return;
      if (cells[i].mine) return lose(i);
      reveal(i);
    }
    function toggleFlag(i) {
      if (over || cells[i].open) return;
      cells[i].flag = !cells[i].flag; paint(i); drawIcons(); status();
    }
    function lose(i) {
      over = true; clearInterval(timer);
      cells[i].boom = true;
      cells.forEach((c) => { if (c.mine) { c.open = true; paint(c.i); } });
      drawIcons();
      setTimeout(() => api.finish(undefined, { title: 'Boom!', text: 'You hit a mine. Try again?', icon: 'bomb' }), 600);
    }
    function win() {
      over = true; clearInterval(timer);
      const secs = Math.max(1, Math.round((Date.now() - t0) / 1000));
      api.score(secs);
      cells.forEach((c) => { if (c.mine && !c.flag) { c.flag = true; paint(c.i); } });
      drawIcons();
      setTimeout(() => api.finish(secs, { text: `Field cleared in ${secs}s` }), 400);
    }

    let press = null, longFired = false;
    field.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const el = e.target.closest('.mc');
      if (el && !longFired) toggleFlag(+el.dataset.i);
    });
    field.addEventListener('pointerdown', (e) => {
      const el = e.target.closest('.mc'); if (!el || e.button !== 0) return;
      longFired = false;
      if (e.pointerType !== 'mouse') press = setTimeout(() => { longFired = true; toggleFlag(+el.dataset.i); navigator.vibrate?.(20); }, 380);
    });
    const cancel = () => clearTimeout(press);
    field.addEventListener('pointerup', cancel);
    field.addEventListener('pointerleave', cancel);
    field.addEventListener('click', (e) => {
      const el = e.target.closest('.mc'); if (!el) return;
      if (longFired) { longFired = false; return; }
      const i = +el.dataset.i;
      (flagMode && !cells[i].open) ? toggleFlag(i) : dig(i);
    });
    stage.querySelectorAll('#mode button').forEach((b) => b.addEventListener('click', () => {
      flagMode = b.dataset.m === 'flag';
      stage.querySelectorAll('#mode button').forEach((x) => x.classList.toggle('on', x === b));
    }));

    api.score(0); status();
    return {
      key(e) { if (e.key === 'f' || e.key === 'F') { stage.querySelector(`#mode [data-m="${flagMode ? 'dig' : 'flag'}"]`).click(); return true; } },
      destroy() { clearInterval(timer); clearTimeout(press); },
    };
  },
};
