// The newer puzzles: Labyrinth, Lava Pipes, Untangle and Hellgems. (Mahjong has a file of its own; the older puzzles are in rules.test.mjs.)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as labyrinth from '../../js/games/maze.js';
import * as pipes from '../../js/games/pipes.js';
import * as untangle from '../../js/games/untangle.js';
import * as gems from '../../js/games/gems.js';
import { seeded } from './seeded.mjs';

// ---------------------------------------------------------------- Labyrinth
const { DIRS, SIZES, makeMaze, solve, walk } = labyrinth;
const step = (maze, at, d) => at + d.dx + d.dy * maze.cols;
const openings = (maze, at) => Object.values(DIRS).filter((d) => maze.open[at] & d.bit);

test('Labyrinth: one way, and only one, leads from any cell to any other', () => {
  for (const [name, [cols, rows]] of Object.entries(SIZES)) for (const seed of [1, 2, 3, 4]) {
    const maze = makeMaze(cols, rows, seeded(seed));
    assert.deepEqual([maze.cols, maze.rows, maze.open.length, maze.start, maze.exit], [cols, rows, cols * rows, 0, cols * rows - 1], `${name}: from the top left to the bottom right`);
    let doors = 0;
    for (let at = 0; at < maze.open.length; at++) {
      const x = at % cols, y = Math.floor(at / cols);
      for (const d of openings(maze, at)) {
        assert.ok(x + d.dx >= 0 && x + d.dx < cols && y + d.dy >= 0 && y + d.dy < rows, `${name} ${seed}: no opening leads off the field (cell ${at})`);
        assert.ok(maze.open[step(maze, at, d)] & d.back, `${name} ${seed}: an opening is open from both sides (cell ${at})`);
        doors++;
      }
    }
    assert.equal(doors / 2, cols * rows - 1, `${name} ${seed}: as few openings as it takes to join all cells, so there are no loops`);
    const reached = new Set([0]);
    for (const queue = [0]; queue.length;) { const at = queue.pop(); for (const d of openings(maze, at)) { const to = step(maze, at, d); if (!reached.has(to)) { reached.add(to); queue.push(to); } } }
    assert.equal(reached.size, cols * rows, `${name} ${seed}: every cell can be reached`);
    const forks = [...maze.open.keys()].filter((at) => openings(maze, at).length >= 3).length;
    assert.ok(forks >= cols * rows / 16, `${name} ${seed}: there are forks to choose at (${forks})`);
  }
  assert.notDeepEqual([...makeMaze(10, 10, seeded(1)).open], [...makeMaze(10, 10, seeded(2)).open], 'another maze every time');
});

test('Labyrinth: the way out, and running along it', () => {
  for (const [name, [cols, rows]] of Object.entries(SIZES)) for (const seed of [5, 6, 7]) {
    const maze = makeMaze(cols, rows, seeded(seed)), path = solve(maze);
    assert.equal(path.at(-1), maze.exit, 'the way out ends at the exit');
    assert.ok(path.length >= cols + rows - 2, 'and is no shorter than the straight way there');
    [maze.start, ...path].forEach((at, k, all) => { if (k) assert.ok(openings(maze, all[k - 1]).some((d) => step(maze, all[k - 1], d) === at), `${name} ${seed}: step ${k} of the way out goes through an opening`); });
    assert.equal(new Set(path).size, path.length, 'it never passes a cell twice');
    // a player who always pushes towards the next cell of the way out
    let at = maze.start, k = 0, pushes = 0;
    while (at !== maze.exit) {
      const dir = Object.keys(DIRS).find((name) => step(maze, at, DIRS[name]) === path[k]), ran = walk(maze, at, dir);
      assert.ok(ran.length > 0, 'a push along the way out moves the devil');
      assert.deepEqual(ran, path.slice(k, k + ran.length), `${name} ${seed}: the devil runs along the way out and never past a fork`);
      const end = ran.at(-1), ways = openings(maze, end).length;
      assert.ok(end === maze.exit || ways !== 2, `${name} ${seed}: a run ends at a fork, a dead end or the exit (cell ${end} has ${ways} openings)`);
      at = end; k += ran.length; pushes++;
    }
    assert.ok(pushes >= 2 && pushes < path.length, `${name} ${seed}: ${pushes} pushes for a way of ${path.length} cells`);
  }
});

test('Labyrinth: walls stop the devil', () => {
  const maze = makeMaze(10, 10, seeded(8));
  for (let at = 0; at < 100; at++) for (const [name, d] of Object.entries(DIRS)) {
    const ran = walk(maze, at, name);
    assert.equal(ran.length > 0, !!(maze.open[at] & d.bit), 'a push against a wall goes nowhere, a push through an opening goes somewhere');
    [at, ...ran].forEach((cell, k, all) => { if (k) assert.ok(openings(maze, all[k - 1]).some((o) => step(maze, all[k - 1], o) === cell), 'every step of a run goes through an opening'); });
    assert.equal(new Set([at, ...ran]).size, ran.length + 1, 'a run never turns back on itself');
  }
  assert.deepEqual(solve(maze, 37, 37), [], 'the way from a cell to itself is empty');
});

// ---------------------------------------------------------------- Lava Pipes
test('Lava Pipes: turning a piece', () => {
  assert.deepEqual([1, 2, 4, 8].map(pipes.turn), [2, 4, 8, 1], 'an arm that points up points to the right after a quarter turn, and so on round');
  assert.deepEqual([pipes.turn(1 | 4), pipes.turn(1 | 2), pipes.turn(1 | 2 | 4)], [2 | 8, 2 | 4, 2 | 4 | 8], 'a straight piece, a bend and a fork');
  for (let tile = 0; tile < 16; tile++) {
    assert.equal(pipes.turned(tile, 4), tile, 'four quarter turns bring a piece back');
    assert.equal(pipes.turned(pipes.turned(tile, 1), 3), tile, 'three turns undo one');
    assert.equal([1, 2, 4, 8].filter((b) => pipes.turned(tile, 1) & b).length, [1, 2, 4, 8].filter((b) => tile & b).length, 'a turn keeps the number of arms');
  }
});

test('Lava Pipes: where the lava goes', () => {
  // three pieces in a row, the well in the middle: ╺ ━ ╸ joined, then the right one turned away
  const row = { n: 3, well: 4, tiles: Uint8Array.from([0, 0, 0, 2, 2 | 8, 8, 0, 0, 0]) };
  assert.deepEqual([...pipes.flow(row)], [0, 0, 0, 1, 1, 1, 0, 0, 0], 'the lava runs through pieces that are joined');
  row.tiles[5] = 1;
  assert.deepEqual([...pipes.flow(row)], [0, 0, 0, 1, 1, 0, 0, 0, 0], 'an arm that meets no arm joins nothing');
  row.tiles[5] = 8; row.tiles[4] = 1 | 4;
  assert.deepEqual([...pipes.flow(row)], [0, 0, 0, 0, 1, 0, 0, 0, 0], 'both pieces have to reach for each other');
  assert.equal(pipes.solved(row), false);
});

test('Lava Pipes: every puzzle can be solved, and none is solved to begin with', () => {
  for (const [name, n] of Object.entries(pipes.SIZES)) for (const seed of [1, 2, 3, 4, 5]) {
    const laid = pipes.layPipes(n, seeded(seed));
    assert.deepEqual([laid.n, laid.tiles.length, laid.well], [n, n * n, (n * n - 1) / 2], `${name}: a square field with the well in the middle`);
    assert.ok(pipes.solved(laid), `${name} ${seed}: as the pipes were laid, the lava reaches every piece`);
    const arms = [...laid.tiles].map((tile) => [1, 2, 4, 8].filter((b) => tile & b).length);
    assert.equal(arms.reduce((a, b) => a + b, 0), 2 * (n * n - 1), `${name} ${seed}: no pipe is joined twice, so there is no loop`);
    assert.ok(arms.every((a) => a >= 1 && a <= 3), `${name} ${seed}: every piece has one, two or three arms: one with four could not be turned`);
    assert.ok(arms.filter((a) => a === 3).length >= n / 2, `${name} ${seed}: there are forks`);

    const puzzle = pipes.makePuzzle(n, seeded(seed));
    assert.ok(!pipes.solved(puzzle), `${name} ${seed}: the puzzle starts unsolved`);
    assert.deepEqual([...puzzle.tiles].map((tile, i) => [0, 1, 2, 3].some((k) => pipes.turned(tile, k) === laid.tiles[i])), Array(n * n).fill(true), `${name} ${seed}: every piece is one of the laid ones, turned`);
    // turning every piece back to how it was laid solves it
    const back = { ...puzzle, tiles: puzzle.tiles.map((tile, i) => pipes.turned(tile, [0, 1, 2, 3].find((k) => pipes.turned(tile, k) === laid.tiles[i]))) };
    assert.ok(pipes.solved(back), `${name} ${seed}: turned back, the lava flows everywhere`);
  }
});

// ---------------------------------------------------------------- Untangle
test('Untangle: which lines cross', () => {
  const { cross, tangled } = untangle;
  assert.equal(cross([0, 0], [1, 1], [0, 1], [1, 0]), true, 'the two strokes of an X cross');
  assert.equal(cross([0, 0], [1, 0], [0, 1], [1, 1]), false, 'two lines side by side do not');
  assert.equal(cross([0, 0], [1, 1], [1, 1], [2, 0]), false, 'nor do lines that only meet at an end');
  assert.equal(cross([0, 0], [1, 0], [0.5, 0.1], [0.5, 1]), false, 'nor a line that stops short of the other');
  const square = [[0, 0], [1, 0], [1, 1], [0, 1]];
  assert.deepEqual(tangled(square, [[0, 1], [1, 2], [2, 3], [3, 0]]), [], 'a square is not tangled');
  assert.deepEqual(tangled(square, [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [1, 3]]), [4, 5], 'its two diagonals cross each other and nothing else');
  assert.deepEqual(tangled(square, [[0, 2], [0, 1], [0, 3]]), [], 'lines out of one point never count as crossing');
});

test('Untangle: every puzzle starts in a tangle and can be untangled', () => {
  for (const [name, n] of Object.entries(untangle.LEVELS)) for (const seed of [1, 2, 3, 4, 5, 6]) {
    const { points, lines, home } = untangle.makePuzzle(n, seeded(seed));
    assert.deepEqual([points.length, home.length], [n, n], `${name}: ${n} knots`);
    assert.ok(lines.length >= n * 1.5 && lines.length <= n * 2.2, `${name} ${seed}: about two lines for every knot (${lines.length})`);
    assert.equal(new Set(lines.map(([a, b]) => Math.min(a, b) * 100 + Math.max(a, b))).size, lines.length, 'no line twice');
    const degree = Array(n).fill(0);
    for (const [a, b] of lines) { assert.ok(a !== b && a >= 0 && b >= 0 && a < n && b < n, 'a line joins two different knots'); degree[a]++; degree[b]++; }
    assert.ok(Math.min(...degree) >= 2, `${name} ${seed}: every knot has two lines or more`);
    const seen = new Set([0]);
    for (const stack = [0]; stack.length;) { const p = stack.pop(); for (const [a, b] of lines) { const q = a === p ? b : b === p ? a : -1; if (q >= 0 && !seen.has(q)) { seen.add(q); stack.push(q); } } }
    assert.equal(seen.size, n, `${name} ${seed}: the web is in one piece`);
    assert.ok(untangle.tangled(points, lines).length >= n, `${name} ${seed}: it starts well tangled (${untangle.tangled(points, lines).length} lines cross)`);
    assert.deepEqual(untangle.tangled(home, lines), [], `${name} ${seed}: and there is a way to lay it out with no line crossing`);
    for (const p of [...points, ...home]) assert.ok(p[0] > 0.05 && p[0] < 0.95 && p[1] > 0.05 && p[1] < 0.95, 'every knot is on the field');
    assert.equal(new Set(points.map((p) => p.map((v) => v.toFixed(4)).join())).size, n, 'no two knots start on the same spot');
  }
});

// ---------------------------------------------------------------- Hellgems
const { COLS, ROWS, KINDS } = gems;
const boardOf = (rows) => rows.join('').split('').map((ch) => (ch === '.' ? -1 : Number(ch)));
// A board on which nothing lines up, however two neighbours are swapped: stripes of four kinds, shifted by two in every other pair of rows.
const STUCK = boardOf(['01230123', '01230123', '23012301', '23012301', '01230123', '01230123', '23012301', '23012301']);

test('Hellgems: what lines up', () => {
  assert.deepEqual(gems.matches(STUCK), [], 'nothing on the striped board');
  const b = STUCK.slice();
  b[2] = 0; b[3] = 0; // row 0 is now 0 1 0 0 0 1 2 3
  assert.deepEqual(gems.matches(b), [2, 3, 4], 'three in a row across');
  b[5] = 0;
  assert.deepEqual(gems.matches(b), [2, 3, 4, 5], 'four in a row are taken whole');
  const c = STUCK.slice();
  c[16] = 0; // column 0 is now 0 0 0 2 …
  assert.deepEqual(gems.matches(c), [0, 8, 16], 'three in a row down');
  c[17] = 0; c[18] = 0;
  assert.deepEqual(gems.matches(c), [0, 8, 16, 17, 18], 'an L counts every gem once');
  const edge = STUCK.slice();
  edge[6] = 0; edge[7] = 0; // … 0 0 at the end of row 0, and row 1 starts with 0
  assert.deepEqual(gems.matches(edge), [], 'a row does not run on into the next line');
  const hole = boardOf(['...01230', '01230123', '23012301', '23012301', '01230123', '01230123', '23012301', '23012301']);
  assert.deepEqual(gems.matches(hole), [], 'holes are not a kind');
});

test('Hellgems: which swaps are allowed', () => {
  const b = STUCK.slice();
  b[2] = 0; b[11] = 0; // row 0 is now 0 1 0 3 0 1 2 3 and row 1 is 0 1 2 0 0 1 2 3: the 3 between two 0s has a 0 right below it
  assert.equal(gems.canSwap(b, 3, 11), true, 'a swap that lines up three');
  assert.equal(gems.canSwap(b, 11, 3), true, 'whichever of the two is named first');
  assert.equal(gems.canSwap(b, 3, 12), false, 'not across a corner');
  assert.equal(gems.canSwap(b, 3, 19), false, 'not over a gem');
  assert.equal(gems.canSwap(b, 7, 8), false, 'not from the end of one row to the start of the next');
  assert.equal(gems.canSwap(b, 30, 31), false, 'not a swap that lines up nothing');
  assert.deepEqual(b.slice(0, 12), [0, 1, 0, 3, 0, 1, 2, 3, 0, 1, 2, 0], 'asking changes nothing');
  const found = gems.findMove(b);
  assert.ok(found && gems.canSwap(b, ...found), 'a swap is found');
  assert.equal(gems.findMove(STUCK), null, 'and none is found where there is none');
  assert.equal(gems.neighbours(0, 1) && gems.neighbours(0, 8) && !gems.neighbours(0, 9) && !gems.neighbours(7, 8), true);
});

test('Hellgems: a fresh board', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const board = gems.makeBoard(seeded(seed));
    assert.equal(board.length, COLS * ROWS);
    assert.ok(board.every((k) => Number.isInteger(k) && k >= 0 && k < KINDS), 'every place holds a gem');
    assert.equal(new Set(board).size, KINDS, 'all six kinds are there');
    assert.deepEqual(gems.matches(board), [], `seed ${seed}: nothing lines up before the first swap`);
    const move = gems.findMove(board);
    assert.ok(move && gems.canSwap(board, ...move), `seed ${seed}: there is a swap to make`);
  }
  const mixed = gems.reshuffle(STUCK, seeded(6));
  assert.deepEqual([...mixed].sort(), [...STUCK].sort(), 'a shuffle keeps the gems');
  assert.ok(!gems.matches(mixed).length && gems.findMove(mixed), 'and leaves a board that can be played');
});

test('Hellgems: gems fall and new ones come in', () => {
  const board = boardOf(['01230123', '0.230123', '2.012301', '23012301', '0.230123', '01230123', '2301230.', '23012301']);
  const before = board.slice(), { falls, births } = gems.collapse(board, seeded(7));
  assert.ok(board.every((k) => k >= 0 && k < KINDS), 'no holes are left');
  // column 1 had 1 . . 3 . 1 3 3 from the top: the three gems above holes come down past them
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map((row) => board[row * 8 + 1]).slice(3), [1, 3, 1, 3, 3], 'the gems of a column keep their order and sink to the bottom');
  assert.deepEqual(falls.filter((f) => f.from % 8 === 1).map((f) => [f.from, f.to]), [[25, 33], [1, 25]], 'each fall says where a gem was and where it is now');
  assert.deepEqual(births.filter((b) => b.to % 8 === 1).map((b) => [b.to, b.above]), [[17, 3], [9, 3], [1, 3]], 'three new gems for three holes, starting three rows over the board');
  assert.deepEqual(births.filter((b) => b.to % 8 === 7).map((b) => [b.to, b.above]), [[7, 1]], 'one new gem for the hole in the last column');
  assert.equal(falls.filter((f) => f.from % 8 === 7).length, 6, 'and the six gems above that hole all come down one row');
  for (const b of births) assert.equal(board[b.to], b.kind, 'a birth says which gem came in');
  for (const col of [0, 2, 3, 4, 5, 6]) for (let row = 0; row < 8; row++) assert.equal(board[row * 8 + col], before[row * 8 + col], 'columns without holes stay as they are');
  assert.deepEqual([gems.points(3, 1), gems.points(4, 1), gems.points(3, 2), gems.points(5, 3)], [30, 40, 60, 150], 'ten points a gem, times the link of the chain');
});

test('Hellgems: a whole game played by taking the first swap every time', () => {
  const rnd = seeded(8);
  let board = gems.makeBoard(rnd), score = 0, longest = 0, shuffles = 0;
  for (let move = 0; move < 300; move++) {
    let swap = gems.findMove(board);
    if (!swap) { board = gems.reshuffle(board, rnd); shuffles++; swap = gems.findMove(board); }
    [board[swap[0]], board[swap[1]]] = [board[swap[1]], board[swap[0]]];
    let chain = 0;
    for (let hit = gems.matches(board); hit.length; hit = gems.matches(board)) {
      chain++; score += gems.points(hit.length, chain);
      for (const cell of hit) board[cell] = -1;
      gems.collapse(board, rnd);
      assert.ok(board.every((k) => k >= 0 && k < KINDS), 'the board is full again after every fall');
    }
    assert.ok(chain >= 1, 'an allowed swap always bursts something');
    longest = Math.max(longest, chain);
  }
  assert.ok(score > 300 * 30 && longest >= 3, `three hundred swaps bring points and chains (${score} points, a chain of ${longest}, ${shuffles} shuffles)`);
});
