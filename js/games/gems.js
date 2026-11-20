// Match three: swap two neighbours so that three or more of a kind line up. They burst, the ones above
// fall, new ones drop in, and whatever lines up by itself after that counts double, then treble.

// ---------------------------------------------------------------- the rules (nothing is shown here)
// The board is a list of COLS × ROWS gems, row after row from the top; a gem is a number from 0 to
// KINDS - 1, and -1 is a hole.
export const COLS = 8, ROWS = 8, KINDS = 6;
export const MOVES = 30, SECONDS = 60; // how long a game is: so many swaps, or so many seconds
const kindOf = (rnd) => Math.floor(rnd() * KINDS);

// The gems that lie three or more in a row, across or down: their places, in order.
export function matches(board) {
  const hit = new Set();
  for (let i = 0; i < board.length; i++) {
    const k = board[i], col = i % COLS;
    if (k < 0) continue;
    if (col + 2 < COLS && board[i + 1] === k && board[i + 2] === k) { hit.add(i); hit.add(i + 1); hit.add(i + 2); }
    if (i + 2 * COLS < board.length && board[i + COLS] === k && board[i + 2 * COLS] === k) { hit.add(i); hit.add(i + COLS); hit.add(i + 2 * COLS); }
  }
  return [...hit].sort((a, b) => a - b);
}
export const neighbours = (a, b) => Math.abs((a % COLS) - (b % COLS)) + Math.abs(Math.floor(a / COLS) - Math.floor(b / COLS)) === 1;
// Would swapping these two gems line anything up? Only such swaps are allowed.
export function canSwap(board, a, b) {
  if (!neighbours(a, b) || board[a] === board[b]) return false;
  [board[a], board[b]] = [board[b], board[a]];
  const ok = matches(board).length > 0;
  [board[a], board[b]] = [board[b], board[a]];
  return ok;
}
// A swap that is allowed, or null when the board is stuck.
export function findMove(board) {
  for (let i = 0; i < board.length; i++) {
    if (i % COLS < COLS - 1 && canSwap(board, i, i + 1)) return [i, i + 1];
    if (i + COLS < board.length && canSwap(board, i, i + COLS)) return [i, i + COLS];
  }
  return null;
}
// A full board with nothing lined up yet and at least one swap to make.
export function makeBoard(rnd = Math.random) {
  for (;;) {
    const board = [];
    for (let i = 0; i < COLS * ROWS; i++) {
      let k;
      do k = kindOf(rnd); while ((i % COLS >= 2 && board[i - 1] === k && board[i - 2] === k) || (i >= 2 * COLS && board[i - COLS] === k && board[i - 2 * COLS] === k));
      board.push(k);
    }
    if (findMove(board)) return board;
  }
}
// The same gems in new places, again with nothing lined up and a swap to make. For a board that is stuck.
export function reshuffle(board, rnd = Math.random) {
  for (let tries = 0; tries < 500; tries++) {
    const mixed = board.slice();
    for (let i = mixed.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [mixed[i], mixed[j]] = [mixed[j], mixed[i]]; }
    if (!matches(mixed).length && findMove(mixed)) return mixed;
  }
  return makeBoard(rnd); // these gems cannot be laid out to play on: a fresh board
}
// Closes the holes: gems fall straight down, and new ones come in from above. Changes the board and
// tells what moved: falls are { from, to }, births are { to, kind, above }: the new gem starts `above`
// rows over the top of the board.
export function collapse(board, rnd = Math.random) {
  const falls = [], births = [];
  for (let col = 0; col < COLS; col++) {
    let free = ROWS - 1; // the lowest row of this column that is not settled yet
    for (let row = ROWS - 1; row >= 0; row--) {
      const from = row * COLS + col;
      if (board[from] < 0) continue;
      const to = free * COLS + col;
      if (to !== from) { board[to] = board[from]; board[from] = -1; falls.push({ from, to }); }
      free--;
    }
    for (let row = free, n = free + 1; row >= 0; row--) { const kind = kindOf(rnd); board[row * COLS + col] = kind; births.push({ to: row * COLS + col, kind, above: n }); }
  }
  return { falls, births };
}
// What bursting so many gems is worth in the given link of a chain (1 for the swap itself, 2 for what falls into place after it, …).
export const points = (gems, chain) => gems * 10 * chain;

// ---------------------------------------------------------------- the game on the page
const SHAPES = [ // one shape and one colour for every kind, so that neither alone has to tell them apart
  ['#ef4444', '<circle cx="50" cy="50" r="35"/>'],
  ['#fb923c', '<path d="M50 15 L87 80 L13 80 Z"/>'],
  ['#facc15', '<path d="M50 12 L61 38 L89 40 L67 58 L74 86 L50 71 L26 86 L33 58 L11 40 L39 38 Z"/>'],
  ['#22c55e', '<rect x="18" y="18" width="64" height="64" rx="10"/>'],
  ['#3b82f6', '<path d="M50 12 L83 31 L83 69 L50 88 L17 69 L17 31 Z"/>'],
  ['#a855f7', '<path d="M50 9 L86 50 L50 91 L14 50 Z"/>'],
];
const gemHTML = (kind) => `<svg viewBox="0 0 100 100" aria-hidden="true"><g class="gm-body" fill="${SHAPES[kind][0]}" stroke="${SHAPES[kind][0]}">${SHAPES[kind][1]}</g><g class="gm-shine" transform="translate(14 12) scale(.62)">${SHAPES[kind][1]}</g></svg>`;
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

export default {
  id: 'gems', name: 'Hellgems', icon: 'gem', color: '#c084fc', tag: 'Puzzle', since: '1.1',
  desc: 'Match three. Swap two gems to line up three of a kind; what falls into place afterwards counts double.',
  help: 'Drag a gem onto its neighbour, or click one and then the other · only swaps that line up three count · chains multiply the points',
  variants: { moves: '30 moves', time: '60 seconds' },
  create(stage, api) {
    stage.innerHTML = `
      <div class="gems">
        <div class="mn-top"><div class="seg" id="gm-mode">${Object.entries(this.variants).map(([id, name]) => `<button data-m="${id}">${name}</button>`).join('')}</div></div>
        <div class="timebar wide"><div id="gm-bar" style="width:100%"></div></div>
        <div class="gm-board" id="gm-board"><p class="gm-note" id="gm-note" role="status"></p></div>
      </div>`;
    const $ = (id) => stage.querySelector('#' + id);
    const boardEl = $('gm-board'), bar = $('gm-bar'), note = $('gm-note'), modeBtns = [...stage.querySelectorAll('#gm-mode button')];
    let mode, board, els, score, left, t0, busy, over, picked, drag, alive = true, ticker = null, noteTimer = null, round = 0;

    const place = (el, cell, above = 0) => { el.style.setProperty('--x', cell % COLS); el.style.setProperty('--y', Math.floor(cell / COLS) - above); };
    function gem(kind, cell, above = 0) {
      const el = document.createElement('div');
      el.className = 'gm-gem'; el.innerHTML = gemHTML(kind); place(el, cell, above);
      boardEl.append(el);
      return el;
    }
    function say(text) { clearTimeout(noteTimer); note.textContent = text; noteTimer = setTimeout(() => { note.textContent = ''; }, 900); }
    function show() {
      api.score(score);
      if (mode === 'time') { const s = t0 ? Math.max(0, SECONDS - (performance.now() - t0) / 1000) : SECONDS; bar.style.width = s / SECONDS * 100 + '%'; api.status(`${Math.ceil(s)}s left`); }
      else { bar.style.width = left / MOVES * 100 + '%'; api.status(`${left} move${left === 1 ? '' : 's'} left`); }
    }
    function reset() {
      api.hideOverlay(); clearInterval(ticker); round++;
      mode = api.variant() === 'time' ? 'time' : 'moves';
      modeBtns.forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
      boardEl.querySelectorAll('.gm-gem').forEach((el) => el.remove());
      board = makeBoard(); els = board.map((kind, cell) => gem(kind, cell));
      score = 0; left = MOVES; t0 = 0; busy = false; over = false; picked = -1; drag = null;
      show();
    }
    const timeUp = () => mode === 'time' && t0 && performance.now() - t0 >= SECONDS * 1000;
    function finish() {
      over = true; clearInterval(ticker); show();
      api.finish(score, { endTitle: mode === 'time' ? 'Time is up' : 'Out of moves' });
    }
    function pick(cell) {
      if (picked >= 0) els[picked].classList.remove('picked');
      picked = cell;
      if (cell >= 0) els[cell].classList.add('picked');
    }
    // Swaps two gems and, if that lines something up, lets everything burst and fall until the board is calm again.
    async function swap(a, b) {
      if (busy || over || !neighbours(a, b)) return;
      const mine = round; // if the game is started over meanwhile, this swap is forgotten
      busy = true; pick(-1);
      const turn = () => { [els[a], els[b]] = [els[b], els[a]]; place(els[a], a); place(els[b], b); };
      turn();
      await wait(170);
      if (mine !== round || !alive) return;
      if (!canSwap(board, a, b)) { turn(); await wait(170); if (mine === round) busy = false; return; }
      [board[a], board[b]] = [board[b], board[a]];
      if (mode === 'time' && !t0) { t0 = performance.now(); ticker = setInterval(() => { show(); if (timeUp() && !busy && !over) finish(); }, 200); }
      if (mode === 'moves') left--;
      for (let chain = 1; ; chain++) {
        const hit = matches(board);
        if (!hit.length) break;
        score += points(hit.length, chain);
        if (chain > 1) say(`Chain ×${chain}`);
        show();
        for (const cell of hit) els[cell].classList.add('pop');
        await wait(190);
        if (mine !== round || !alive) return;
        for (const cell of hit) { els[cell].remove(); els[cell] = null; board[cell] = -1; }
        const { falls, births } = collapse(board);
        for (const { from, to } of falls) { els[to] = els[from]; els[from] = null; place(els[to], to); }
        const fresh = births.map(({ to, kind, above }) => { els[to] = gem(kind, to, above); return [els[to], to]; });
        void boardEl.offsetWidth; // the new gems are above the board now; from here they fall
        for (const [el, to] of fresh) place(el, to);
        await wait(270);
        if (mine !== round || !alive) return;
      }
      if (!findMove(board)) { // stuck: the same gems are laid out anew
        say('No moves left: shuffled');
        board = reshuffle(board);
        boardEl.querySelectorAll('.gm-gem').forEach((el) => el.remove());
        els = board.map((kind, cell) => gem(kind, cell));
      }
      busy = false;
      if ((mode === 'moves' && left <= 0) || timeUp()) finish();
    }

    // ---- input: drag a gem towards a neighbour, or click one and then the other
    const cellOf = (target) => els.indexOf(target.closest('.gm-gem'));
    boardEl.addEventListener('pointerdown', (e) => {
      const cell = e.target.closest('.gm-gem') ? cellOf(e.target) : -1;
      if (cell < 0 || busy || over) return;
      e.preventDefault();
      drag = { cell, x: e.clientX, y: e.clientY, size: boardEl.getBoundingClientRect().width / COLS };
      try { boardEl.setPointerCapture(e.pointerId); } catch { /* not vital */ }
    });
    boardEl.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < drag.size * 0.38) return;
      const { cell } = drag, col = cell % COLS, to = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? (col < COLS - 1 ? cell + 1 : -1) : (col > 0 ? cell - 1 : -1)) : cell + (dy > 0 ? COLS : -COLS);
      drag = null;
      if (to >= 0 && to < board.length) swap(cell, to);
    });
    boardEl.addEventListener('pointerup', () => {
      if (!drag) return;
      const { cell } = drag;
      drag = null;
      if (picked >= 0 && neighbours(picked, cell)) swap(picked, cell); else pick(picked === cell ? -1 : cell);
    });
    boardEl.addEventListener('pointercancel', () => { drag = null; });
    boardEl.addEventListener('touchmove', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    $('gm-mode').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { b.blur(); api.variant(b.dataset.m); reset(); } });
    reset();
    return { restart: reset, destroy() { alive = false; clearInterval(ticker); clearTimeout(noteTimer); } };
  },
};
