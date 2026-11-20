import { drawIcons } from '../util.js';

// ---------------------------------------------------------------- the rules (nothing is shown here)
// A tile is a piece of pipe: the sum of 1 (an arm upwards), 2 (to the right), 4 (downwards) and
// 8 (to the left). Lava starts at the well in the middle and runs through every tile that is joined to it.
export const SIZES = { small: 5, medium: 7, large: 9 };
const STEP = [[1, 0, -1, 4], [2, 1, 0, 8], [4, 0, 1, 1], [8, -1, 0, 2]]; // an arm, where it leads, and the arm it meets there
// A quarter turn clockwise.
export const turn = (tile) => ((tile << 1) | (tile >> 3)) & 15;
export const turned = (tile, times) => { for (let k = 0; k < (times & 3); k++) tile = turn(tile); return tile; };

// Lays pipes so that lava reaches every tile and nothing is joined twice: it starts at the well and
// keeps adding a tile next to one that already has lava, most often next to the newest one.
export function layPipes(n, rnd = Math.random) {
  const tiles = new Uint8Array(n * n), well = Math.floor(n * n / 2), joined = new Uint8Array(n * n), live = [well];
  joined[well] = 1;
  while (live.length) {
    const k = rnd() < 0.45 ? Math.floor(rnd() * live.length) : live.length - 1, at = live[k], x = at % n, y = Math.floor(at / n);
    const ways = STEP.filter(([, dx, dy]) => x + dx >= 0 && x + dx < n && y + dy >= 0 && y + dy < n && !joined[at + dx + dy * n]);
    if (!ways.length || (tiles[at] && [1, 2, 4, 8].filter((b) => tiles[at] & b).length >= 3)) { live.splice(k, 1); continue; } // no pipe with four arms: it could not be turned
    const [arm, dx, dy, back] = ways[Math.floor(rnd() * ways.length)], to = at + dx + dy * n;
    tiles[at] |= arm; tiles[to] |= back; joined[to] = 1; live.push(to);
  }
  if (!joined.every((on) => on)) return layPipes(n, rnd); // a tile was walled in by pipes that could take no more arms: once more
  return { n, well, tiles };
}
// Which tiles the lava reaches: two tiles are joined when each has an arm towards the other.
export function flow({ n, well, tiles }) {
  const lit = new Uint8Array(n * n), queue = [well];
  lit[well] = 1;
  while (queue.length) {
    const at = queue.pop(), x = at % n, y = Math.floor(at / n);
    for (const [arm, dx, dy, back] of STEP) {
      const to = at + dx + dy * n;
      if (tiles[at] & arm && x + dx >= 0 && x + dx < n && y + dy >= 0 && y + dy < n && tiles[to] & back && !lit[to]) { lit[to] = 1; queue.push(to); }
    }
  }
  return lit;
}
export const solved = (board) => flow(board).every((on) => on);
// A puzzle: pipes that were laid properly, then every tile turned at random. It is never solved to begin with.
export function makePuzzle(n, rnd = Math.random) {
  const laid = layPipes(n, rnd);
  for (;;) {
    const board = { ...laid, tiles: laid.tiles.map((tile) => turned(tile, Math.floor(rnd() * 4))) };
    if (!solved(board)) return board;
  }
}

// ---------------------------------------------------------------- the game on the page
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
// The picture of a tile, drawn for the way it lies at first; turning it is left to the browser.
function picture(tile, well) {
  const ends = { 1: '50,0', 2: '100,50', 4: '50,100', 8: '0,50' };
  const arms = [1, 2, 4, 8].filter((b) => tile & b).map((b) => `M50,50 L${ends[b]}`).join(' ');
  const knob = well ? 21 : tile === 1 || tile === 2 || tile === 4 || tile === 8 ? 17 : 0; // the well and the dead ends have a bulb
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><path class="pp-case" d="${arms}"/>${knob ? `<circle class="pp-case-knob" cx="50" cy="50" r="${knob + 6}"/>` : ''}<path class="pp-lava" d="${arms}"/>${knob ? `<circle class="pp-knob" cx="50" cy="50" r="${knob}"/>` : ''}</svg>`;
}

export default {
  id: 'pipes', name: 'Lava Pipes', icon: 'workflow', color: '#fb7185', tag: 'Puzzle', since: '1.1',
  desc: 'Turn the pieces of pipe until the lava from the well in the middle reaches every one of them.',
  help: 'Click or tap a piece to turn it · right-click turns it the other way · pieces the lava reaches glow · the clock starts with the first turn',
  scoreLabel: 'Time', lowerBetter: true,
  format: clock,
  variants: { small: 'Small', medium: 'Medium', large: 'Large' },
  create(stage, api) {
    stage.innerHTML = `
      <div class="pipes">
        <div class="mn-top"><div class="seg" id="pp-size">${Object.entries(this.variants).map(([id, name]) => `<button data-s="${id}">${name}</button>`).join('')}</div></div>
        <div class="pp-grid" id="pp-grid"></div>
      </div>`;
    const grid = stage.querySelector('#pp-grid'), sizeBtns = [...stage.querySelectorAll('#pp-size button')];
    let board, angle = [], moves = 0, t0 = 0, done = false, ticker = null, endTimer = null, cells = [];

    function light() {
      const lit = flow(board);
      cells.forEach((el, i) => el.classList.toggle('lit', !!lit[i]));
      return lit.every((on) => on);
    }
    function reset() {
      api.hideOverlay(); clearInterval(ticker); clearTimeout(endTimer);
      const size = SIZES[api.variant()] ? api.variant() : 'small';
      board = makePuzzle(SIZES[size]);
      angle = Array.from(board.tiles, () => 0); moves = 0; t0 = 0; done = false;
      sizeBtns.forEach((b) => b.classList.toggle('on', b.dataset.s === size));
      grid.style.setProperty('--n', board.n);
      grid.innerHTML = Array.from(board.tiles, (tile, i) => `<button class="pp-tile${i === board.well ? ' well' : ''}" data-i="${i}" aria-label="Piece of pipe">${picture(tile, i === board.well)}</button>`).join('');
      cells = [...grid.children];
      light();
      api.score(0); api.status(`${board.n} × ${board.n} pieces`);
    }
    function rotate(i, back) {
      if (done) return;
      if (!t0) { t0 = performance.now(); ticker = setInterval(() => api.score(Math.floor((performance.now() - t0) / 1000)), 250); }
      board.tiles[i] = turned(board.tiles[i], back ? 3 : 1);
      angle[i] += back ? -90 : 90;
      cells[i].firstElementChild.style.transform = `rotate(${angle[i]}deg)`;
      moves++;
      api.status(`${moves} turn${moves === 1 ? '' : 's'}`);
      if (!light()) return;
      done = true; clearInterval(ticker);
      const seconds = Math.max(1, Math.round((performance.now() - t0) / 1000));
      api.score(seconds);
      endTimer = setTimeout(() => api.finish(seconds, { title: 'The lava flows', text: `${clock(seconds)} · ${moves} turns`, icon: 'flame' }), 450);
    }
    grid.addEventListener('click', (e) => { const b = e.target.closest('.pp-tile'); if (b) { b.blur(); rotate(Number(b.dataset.i), e.shiftKey); } });
    grid.addEventListener('contextmenu', (e) => { const b = e.target.closest('.pp-tile'); e.preventDefault(); if (b) rotate(Number(b.dataset.i), true); });
    stage.querySelector('#pp-size').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { b.blur(); api.variant(b.dataset.s); reset(); } });
    reset();
    drawIcons();
    return { restart: reset, destroy() { clearInterval(ticker); clearTimeout(endTimer); } };
  },
};
