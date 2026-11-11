import { shuffle } from '../util.js';

// ---------------------------------------------------------------- making puzzles (nothing is drawn in this part)
const CLUES = { easy: 42, medium: 34, hard: 27 };   // how many numbers are given at the start
const HINT_PENALTY = 30;                             // seconds added to the time for every hint
const ROW = [], COL = [], BOX = [], PEERS = [], UNITS = [];
for (let i = 0; i < 81; i++) { ROW.push(Math.floor(i / 9)); COL.push(i % 9); BOX.push(Math.floor(i / 27) * 3 + Math.floor((i % 9) / 3)); }
for (let i = 0; i < 81; i++) PEERS.push([...Array(81).keys()].filter((j) => j !== i && (ROW[j] === ROW[i] || COL[j] === COL[i] || BOX[j] === BOX[i])));
for (const of of [ROW, COL, BOX]) for (let u = 0; u < 9; u++) UNITS.push([...Array(81).keys()].filter((i) => of[i] === u));
const bits = (m) => { let n = 0; for (; m; m &= m - 1) n++; return n; };

// Depth-first search over a grid (0 = empty cell). `visit` is called for every solution found and
// returns true to stop the search. Digits are tried in random order when `random` is set.
function search(grid, visit, random) {
  const g = grid.slice(), rows = new Array(9).fill(0), cols = new Array(9).fill(0), boxes = new Array(9).fill(0);
  for (let i = 0; i < 81; i++) {
    if (!g[i]) continue;
    const bit = 1 << g[i];
    if ((rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]) & bit) return; // the grid already breaks the rules
    rows[ROW[i]] |= bit; cols[COL[i]] |= bit; boxes[BOX[i]] |= bit;
  }
  const solve = () => {
    let cell = -1, mask = 0, fewest = 10;
    for (let i = 0; i < 81; i++) { // continue with the cell that has the fewest possible digits
      if (g[i]) continue;
      const m = ~(rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]) & 0x3fe, n = bits(m);
      if (n < fewest) { fewest = n; cell = i; mask = m; if (n < 2) break; }
    }
    if (cell < 0) return visit(g);
    if (!fewest) return false;
    const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => mask & (1 << d));
    for (const d of random ? shuffle(digits) : digits) {
      const bit = 1 << d;
      g[cell] = d; rows[ROW[cell]] |= bit; cols[COL[cell]] |= bit; boxes[BOX[cell]] |= bit;
      const stop = solve();
      rows[ROW[cell]] &= ~bit; cols[COL[cell]] &= ~bit; boxes[BOX[cell]] &= ~bit;
      if (stop) return true;
      g[cell] = 0;
    }
    return false;
  };
  solve();
}

// Number of solutions a grid has, counted up to `limit`.
export function countSolutions(grid, limit = 2) {
  let n = 0;
  search(grid, () => ++n >= limit);
  return n;
}

// True when the puzzle can be finished with the two basic steps only: "this cell can hold just one
// digit" and "this digit fits in just one cell of a row, column or box". No guessing, no tricks.
export function needsOnlyBasics(puzzle) {
  const g = puzzle.slice();
  for (let moved = true; moved;) {
    moved = false;
    const can = g.map((v, i) => { if (v) return 0; let m = 0x3fe; for (const j of PEERS[i]) m &= ~(1 << g[j]); return m; });
    for (let i = 0; i < 81 && !moved; i++) {
      if (!g[i] && bits(can[i]) === 1) { g[i] = Math.log2(can[i]); moved = true; }
    }
    for (let u = 0; u < 27 && !moved; u++) {
      for (let d = 1; d <= 9 && !moved; d++) {
        const spots = UNITS[u].filter((i) => can[i] & (1 << d));
        if (spots.length === 1) { g[spots[0]] = d; moved = true; }
      }
    }
  }
  return g.every(Boolean);
}

// A new puzzle with exactly one solution. Numbers are taken away in mirrored pairs, which gives the
// classic symmetric look. Easy and Medium never need more than the two basic steps; Hard always does.
export function makePuzzle(level) {
  for (let attempt = 0; ; attempt++) {
    let solution;
    search(new Array(81).fill(0), (g) => { solution = g.slice(); return true; }, true);
    const puzzle = solution.slice();
    let left = 81;
    for (const i of shuffle([...Array(41).keys()])) {
      if (left <= CLUES[level]) break;
      const j = 80 - i, a = puzzle[i], b = puzzle[j];
      puzzle[i] = puzzle[j] = 0;
      if (countSolutions(puzzle) === 1) left -= i === j ? 1 : 2;
      else { puzzle[i] = a; puzzle[j] = b; }
    }
    if (attempt < 60 && (left > CLUES[level] + 2 || needsOnlyBasics(puzzle) === (level === 'hard'))) continue;
    return { puzzle, solution };
  }
}

// ---------------------------------------------------------------- the game on screen
const MOVES = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
const clock = (v) => `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;

export default {
  id: 'sudoku', name: 'Sudoku', icon: 'grid-3x3', color: '#2dd4bf', tag: 'Logic',
  desc: 'Every row, column and box needs the numbers 1 to 9. Three levels, notes and hints.',
  help: 'Pick a cell, then a number · N switches notes · Backspace erases · Ctrl+Z takes a step back',
  scoreLabel: 'Time', lowerBetter: true, format: clock,
  variants: { easy: 'Easy', medium: 'Medium', hard: 'Hard' },
  create(stage, api) {
    stage.innerHTML = `
      <div class="seg mb-3" id="sd-mode">${Object.entries(this.variants).map(([id, name]) => `<button data-m="${id}">${name}</button>`).join('')}</div>
      <div class="sdk-wrap">
        <div class="sdk" id="sd-b">${Array.from({ length: 81 }, (_, i) => `<button class="sc" data-i="${i}" aria-label="Row ${ROW[i] + 1}, column ${COL[i] + 1}"></button>`).join('')}</div>
        <div class="sdk-pad" id="sd-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<button data-d="${d}">${d}</button>`).join('')}</div>
        <div class="sdk-tools">
          <button id="sd-undo"><i data-lucide="undo-2"></i><span>Undo</span></button>
          <button id="sd-erase"><i data-lucide="eraser"></i><span>Erase</span></button>
          <button id="sd-notes"><i data-lucide="pencil"></i><span>Notes</span></button>
          <button id="sd-hint"><i data-lucide="lightbulb"></i><span>Hint</span></button>
        </div>
      </div>`;
    const $ = (sel) => stage.querySelector(sel);
    const cells = [...$('#sd-b').children], padButtons = [...$('#sd-pad').children], modeButtons = [...$('#sd-mode').children];
    let solution, given, val, notes, hinted, history, sel, noteMode, t0, timer, penalty, done, endTimer;

    const elapsed = () => (t0 ? Math.floor((Date.now() - t0) / 1000) : 0) + penalty;
    function startClock() {
      if (t0 || done) return;
      t0 = Date.now();
      timer = setInterval(() => api.score(elapsed()), 250);
    }

    function newGame() {
      clearInterval(timer); clearTimeout(endTimer); api.hideOverlay();
      const p = makePuzzle(api.variant());
      solution = p.solution; val = p.puzzle.slice(); given = p.puzzle.map(Boolean);
      notes = new Array(81).fill(0); hinted = new Array(81).fill(false); history = [];
      sel = -1; noteMode = false; t0 = 0; timer = null; penalty = 0; done = false;
      modeButtons.forEach((b) => b.classList.toggle('on', b.dataset.m === api.variant()));
      api.score(0);
      paint();
    }

    function paint() {
      const v = sel >= 0 ? val[sel] : 0;
      cells.forEach((el, i) => {
        const bad = val[i] && PEERS[i].some((j) => val[j] === val[i]);
        el.className = 'sc' + (given[i] ? ' given' : hinted[i] ? ' hint' : ' user') + (bad ? ' bad' : '')
          + (i === sel ? ' sel' : v && val[i] === v ? ' same' : sel >= 0 && PEERS[sel].includes(i) ? ' peer' : '');
        if (val[i]) el.textContent = val[i];
        else if (notes[i]) el.innerHTML = `<div class="sn">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<span>${notes[i] & (1 << d) ? d : ''}</span>`).join('')}</div>`;
        else el.textContent = '';
      });
      padButtons.forEach((b) => b.classList.toggle('done', val.filter((x) => x === +b.dataset.d).length >= 9));
      $('#sd-notes').classList.toggle('on', noteMode);
      const left = val.filter((x) => !x).length;
      api.status(done ? 'Solved!' : left ? `${left} cell${left === 1 ? '' : 's'} to fill` : 'Fix the red numbers');
    }

    const locked = (i) => i < 0 || given[i] || hinted[i];
    const remember = () => { history.push({ val: val.slice(), notes: notes.slice() }); if (history.length > 300) history.shift(); };

    function checkSolved() {
      if (!val.every((x, i) => x === solution[i])) return;
      done = true; clearInterval(timer);
      const time = elapsed();
      api.score(time); paint();
      endTimer = setTimeout(() => api.finish(time, { endTitle: 'Solved!', text: `Solved in ${clock(time)}${penalty ? ` (hints: +${penalty}s)` : ''}`, icon: 'trophy' }), 500);
    }

    function enter(d, asNote = noteMode) {
      if (done || locked(sel)) return;
      if (asNote) {
        if (val[sel]) return;
        remember(); notes[sel] ^= 1 << d;
      } else {
        remember();
        val[sel] = val[sel] === d ? 0 : d;
        if (val[sel]) { notes[sel] = 0; for (const j of PEERS[sel]) notes[j] &= ~(1 << d); } // tidy up notes that no longer apply
      }
      startClock(); paint(); checkSolved();
    }
    function erase() {
      if (done || locked(sel) || (!val[sel] && !notes[sel])) return;
      remember(); val[sel] = 0; notes[sel] = 0; paint();
    }
    function undo() {
      if (done || !history.length) return;
      const h = history.pop();
      val = h.val; notes = h.notes;
      hinted.forEach((on, i) => { if (on) { val[i] = solution[i]; notes[i] = 0; } }); // hints stay
      paint();
    }
    function hint() {
      if (done) return;
      const open = (i) => !locked(i) && val[i] !== solution[i];
      const pool = [...Array(81).keys()].filter(open);
      if (!pool.length) return;
      const i = sel >= 0 && open(sel) ? sel : pool[Math.floor(Math.random() * pool.length)];
      val[i] = solution[i]; notes[i] = 0; hinted[i] = true; sel = i;
      for (const j of PEERS[i]) notes[j] &= ~(1 << solution[i]);
      penalty += HINT_PENALTY;
      startClock(); api.score(elapsed()); paint(); checkSolved();
    }
    function select(i) { sel = i; paint(); }

    $('#sd-b').addEventListener('click', (e) => { const el = e.target.closest('.sc'); if (el) select(+el.dataset.i); });
    $('#sd-pad').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { b.blur(); enter(+b.dataset.d); } });
    $('#sd-mode').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.dataset.m === api.variant()) return;
      b.blur(); api.variant(b.dataset.m); newGame();
    });
    const tool = (id, fn) => $(id).addEventListener('click', (e) => { e.currentTarget.blur(); fn(); });
    tool('#sd-undo', undo); tool('#sd-erase', erase); tool('#sd-hint', hint);
    tool('#sd-notes', () => { noteMode = !noteMode; paint(); });

    newGame();

    return {
      key(e) {
        if (MOVES[e.key] !== undefined) {
          const d = MOVES[e.key];
          if (sel < 0) select(40);
          else if (!((d === -1 && COL[sel] === 0) || (d === 1 && COL[sel] === 8) || sel + d < 0 || sel + d > 80)) select(sel + d);
          return true;
        }
        if (/^[1-9]$/.test(e.key)) { if (!e.repeat) enter(+e.key, noteMode !== e.shiftKey); return true; } // Shift = the other mode, once
        if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') { erase(); return true; }
        if (e.key === 'n') { if (!e.repeat) { noteMode = !noteMode; paint(); } return true; }
        if (e.key === 'u') { undo(); return true; }
      },
      shortcut(e) { if (e.key === 'z' && e.ctrlKey && !e.altKey) { undo(); return true; } },
      restart: newGame,
      destroy() { clearInterval(timer); clearTimeout(endTimer); },
    };
  },
};
