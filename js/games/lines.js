import { randInt, shuffle } from '../util.js';

const N = 9, COLORS = 7, START = 5, PER_TURN = 3, MIN_LINE = 5;
const STEP_MS = 28; // how fast a ball travels from cell to cell
const POINTS = { 5: 10, 6: 12, 7: 18, 8: 28, 9: 42 }; // the classic table
const points = (n) => POINTS[n] ?? 42 + (n - 9) * 16;
const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
const ARROWS = { ArrowUp: -N, ArrowDown: N, ArrowLeft: -1, ArrowRight: 1 };

// Shortest path for a ball through empty cells (it moves up, down, left and right only).
// Returns the cells to step through, ending with `to`, or null when the way is blocked.
export function findPath(grid, from, to) {
  const prev = new Int16Array(N * N).fill(-1);
  const queue = [from]; prev[from] = from;
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q];
    if (c === to) {
      const path = [];
      for (let p = to; p !== from; p = prev[p]) path.push(p);
      return path.reverse();
    }
    const x = c % N, y = (c - x) / N;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, n = ny * N + nx;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N || prev[n] >= 0 || grid[n] >= 0) continue;
      prev[n] = c; queue.push(n);
    }
  }
  return null;
}

// Every ball that belongs to a line of five or more passing through one of the given cells.
export function findLines(grid, cells) {
  const out = new Set();
  for (const c of cells) {
    const color = grid[c];
    if (color < 0) continue;
    const x = c % N, y = (c - x) / N;
    for (const [dx, dy] of DIRS) {
      const line = [c];
      for (const s of [1, -1]) {
        for (let k = 1; ; k++) {
          const nx = x + dx * k * s, ny = y + dy * k * s;
          if (nx < 0 || ny < 0 || nx >= N || ny >= N || grid[ny * N + nx] !== color) break;
          line.push(ny * N + nx);
        }
      }
      if (line.length >= MIN_LINE) line.forEach((i) => out.add(i));
    }
  }
  return out;
}

export default {
  id: 'lines', name: 'Lines 98', icon: 'ellipsis', color: '#fb7185', tag: 'Puzzle',
  desc: 'Move balls to line up five of one colour. Three more drop in after every move.',
  help: 'Click a ball, then a free cell it can reach · five or more in a row, column or diagonal clear',
  create(stage, api) {
    stage.innerHTML = `
      <div class="lnext" id="ln-next"></div>
      <div class="lboard" id="ln-b">${Array.from({ length: N * N }, (_, i) => `<button class="lc" data-i="${i}" aria-label="Cell"></button>`).join('')}</div>`;
    const board = stage.querySelector('#ln-b'), nextEl = stage.querySelector('#ln-next');
    const cells = [...board.children];
    const grid = new Array(N * N).fill(-1);
    let next = [], sel = -1, score = 0, busy = false, over = false, alive = true;

    const wait = (ms) => new Promise((res) => setTimeout(() => alive && res(), ms)); // never resolves once the game is closed
    const empties = () => grid.map((v, i) => (v < 0 ? i : -1)).filter((i) => i >= 0);
    const roll = () => Array.from({ length: PER_TURN }, () => randInt(COLORS));

    function paint(i, anim) {
      const el = cells[i];
      el.className = 'lc' + (anim ? ' ' + anim : '') + (i === sel ? ' sel' : '');
      el.innerHTML = grid[i] >= 0 ? `<i class="lball c${grid[i]}"></i>` : '';
    }
    function showNext() {
      nextEl.innerHTML = `<span>Next</span>${next.map((c) => `<i class="lball c${c}"></i>`).join('')}`;
    }
    function status() { api.status(`${empties().length} free cells`); }

    function spawn(colors) {
      const free = shuffle(empties()), placed = [];
      for (const c of colors) {
        if (!free.length) break;
        const i = free.pop();
        grid[i] = c; placed.push(i); paint(i, 'new');
      }
      return placed;
    }

    async function clear(set) {
      score += points(set.size); api.score(score);
      set.forEach((i) => { cells[i].classList.remove('new'); cells[i].classList.add('pop'); });
      await wait(210);
      set.forEach((i) => { grid[i] = -1; paint(i); });
    }

    function select(i) {
      const old = sel;
      sel = old === i ? -1 : i;
      if (old >= 0) paint(old);
      if (sel >= 0) paint(sel);
    }

    async function moveTo(target) {
      const path = findPath(grid, sel, target);
      if (!path) {
        const el = cells[target];
        el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope'); // restart the "no way" flash
        return;
      }
      busy = true;
      const color = grid[sel];
      let at = sel; sel = -1;
      for (const stepTo of path) {
        grid[at] = -1; paint(at);
        grid[stepTo] = color; paint(stepTo);
        at = stepTo;
        await wait(STEP_MS);
      }
      const made = findLines(grid, [target]);
      if (made.size) await clear(made); // a line earns another move: no new balls
      if (!made.size || !grid.some((v) => v >= 0)) {
        const placed = spawn(next);
        next = roll(); showNext();
        await wait(190);
        const lucky = findLines(grid, placed);
        if (lucky.size) await clear(lucky);
      }
      status();
      busy = false;
      if (!empties().length) { over = true; api.status('No free cells left'); await wait(350); api.finish(score); }
    }

    board.addEventListener('click', (e) => {
      const el = e.target.closest('.lc');
      if (!el || busy || over) return;
      const i = +el.dataset.i;
      if (grid[i] >= 0) select(i);
      else if (sel >= 0) moveTo(i);
    });

    spawn(roll().concat(roll()).slice(0, START));
    next = roll(); showNext(); status();

    return {
      // Arrow keys walk the focus across the board; Enter / Space press the focused cell as usual.
      key(e) {
        const d = ARROWS[e.key];
        if (d === undefined) return;
        const cur = cells.indexOf(document.activeElement);
        if (cur < 0) { cells[sel >= 0 ? sel : 40].focus(); return true; }
        const x = cur % N, to = cur + d;
        if (to < 0 || to >= N * N || (d === -1 && x === 0) || (d === 1 && x === N - 1)) return true;
        cells[to].focus();
        return true;
      },
      destroy() { alive = false; },
    };
  },
};
