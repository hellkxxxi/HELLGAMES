// The newer puzzles: Labyrinth, Lava Pipes, Untangle and Hellgems. (Mahjong has a file of its own; the older puzzles are in rules.test.mjs.)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as labyrinth from '../../js/games/maze.js';
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
