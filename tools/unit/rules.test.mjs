// The rules of the games, tested without a browser:  node --test tools/unit
import test from 'node:test';
import assert from 'node:assert/strict';
import { WORDS } from '../../js/data/words.js';
import { LANGS, createTest, makeWords } from '../../js/games/helltype.js';
import { createHelltris, gravity } from '../../js/games/helltris.js';
import { MAP, createHellman, frightTime, speeds } from '../../js/games/hellman.js';
import { findLines, findPath } from '../../js/games/lines.js';
import { countSolutions, makePuzzle, needsOnlyBasics } from '../../js/games/sudoku.js';
import { MAX_SCORE, createRun, grade, makeSong } from '../../js/games/mania.js';
import { floodFill } from '../../js/games/draw.js';

// The same "random" numbers on every run, so a failure can be repeated.
const seeded = (seed) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// ---------------------------------------------------------------- Helltype
test('word lists are clean', () => {
  assert.deepEqual(Object.keys(WORDS).sort(), Object.keys(LANGS).sort(), 'every language has a name and a word list');
  for (const [lang, list] of Object.entries(WORDS)) {
    assert.ok(list.length >= 150, `${lang}: enough words for a test without constant repeats`);
    assert.equal(new Set(list).size, list.length, `${lang}: no word twice`);
    assert.ok(list.every((w) => w === w.toLowerCase() && /^\p{L}+$/u.test(w)), `${lang}: lower-case letters only`);
    assert.ok(list.every((w) => w.length <= 12), `${lang}: no word too long for a phone screen`);
  }
  assert.ok(WORDS.en.every((w) => /^[a-z]+$/.test(w)), 'English words are plain Latin letters');
  assert.ok(WORDS.ru.every((w) => /^[а-я]+$/.test(w)), 'Russian words are Cyrillic letters without ё');
});

test('makeWords never repeats a word within three', () => {
  const words = makeWords(WORDS.en, 2000, seeded(1), ['the', 'be']);
  const all = ['the', 'be', ...words];
  for (let i = 2; i < all.length; i++) assert.ok(all[i] !== all[i - 1] && all[i] !== all[i - 2], `repeat at ${i}`);
  assert.ok(words.every((w) => WORDS.en.includes(w)));
});

test('a clean run: speed counts five characters as a word', () => {
  const t = createTest(['hello', 'world', 'again']);
  assert.equal(t.input('hello'), 'hello');
  assert.equal(t.input('hello '), '');                // the space finished the word, the box is empty again
  t.input('world '); t.input('ag');
  assert.equal(t.index, 2);
  // "hello " + "world " + "ag" = 14 characters in 12 seconds = 70 characters a minute = 14 words a minute
  assert.deepEqual(t.result(12), { wpm: 14, raw: 14, accuracy: 100, wrong: 0 });
});

test('mistakes: wrong words do not count, corrected slips still cost accuracy', () => {
  const t = createTest(['one', 'two', 'three', 'four']);
  t.input('o'); t.input('ox'); t.input('o'); t.input('on'); t.input('one'); t.input('one ');  // a slip, fixed
  t.input('twx '); // a wrong word, left as it is
  t.input('three ');
  const r = t.result(60);
  assert.equal(r.wrong, 1);
  assert.equal(r.wpm, Math.round((4 + 6) / 5));       // "one " and "three "
  assert.equal(r.raw, Math.round((4 + 4 + 6) / 5));
  // keys: o x n e space | t w x space | t h r e e space = 15, of which x, x and the space after "twx" were wrong
  assert.equal(t.keys, 15);
  assert.equal(r.accuracy, 80);
});

test('space, extra letters and going back', () => {
  const t = createTest(['ab', 'cd', 'ef']);
  assert.equal(t.input(' '), '', 'a space before the first letter does nothing');
  assert.equal(t.index, 0);
  assert.equal(t.input('abxxxxxxxxxxxx').length, 2 + 8, 'only eight extra letters are kept');
  t.input('ab '); assert.equal(t.back(), null, 'no going back into a correct word');
  t.input('cx '); assert.equal(t.index, 2);
  assert.equal(t.back(), 'cx', 'backspace returns into a word with a mistake');
  assert.equal(t.index, 1);
  t.input('cd '); t.input('e');
  assert.equal(t.back(), null, 'no going back from the middle of a word');
  assert.equal(t.result(60).wrong, 0);
  const many = createTest(['ab', 'cd', 'ef']);
  assert.equal(many.input('ab cd e'), 'e', 'several words at once (swipe typing, a paste)');
  assert.equal(many.index, 2);
  const last = createTest(['ab']);
  assert.equal(last.input('ab '), 'ab', 'the test never runs past its last word');
});

// ---------------------------------------------------------------- Helltris
test('Helltris: gravity speeds up, pieces lock, rows clear', () => {
  assert.equal(gravity(1), 1);
  for (let l = 1; l < 15; l++) assert.ok(gravity(l + 1) < gravity(l));
  const g = createHelltris(seeded(2));
  const bottom = g.grid.length - 1;
  for (let x = 0; x < 10; x++) if (x !== 4 && x !== 5) g.grid[bottom][x] = 'J';
  g.spawn('O');                                       // lands in the gap and completes the bottom row
  assert.ok(g.hardDrop());
  assert.equal(g.lines, 1);
  assert.ok(g.score >= 100);
  assert.ok(g.clearing, 'the full row is being cleared');
  for (let i = 0; i < 120; i++) g.step(1 / 60);
  assert.equal(g.clearing, null);
  assert.equal(g.grid[bottom].filter(Boolean).length, 2, 'what was above the cleared row has come down');
  assert.ok(g.cur, 'a new piece has appeared');
});

test('Helltris: a game played by dropping everything in the middle ends', () => {
  const g = createHelltris(seeded(3));
  g.start();
  let drops = 0;
  while (!g.over && drops < 500) { if (g.cur) { g.hardDrop(); drops++; } else g.step(1 / 60); }
  assert.ok(g.over, 'the pile reached the top');
  assert.ok(drops > 5 && drops < 60);
  assert.equal(g.move(1), false); assert.equal(g.hardDrop(), false);
});

// ---------------------------------------------------------------- Hell-Man
test('Hell-Man: the maze is sound and a random walk never breaks the rules', () => {
  assert.ok(MAP.every((row) => row.length === MAP[0].length));
  assert.equal(speeds(1).pac, 6.4); assert.ok(speeds(5).ghost > speeds(1).ghost);
  assert.equal(frightTime(1), 6); assert.equal(frightTime(9), 1.5);
  const random = seeded(4), g = createHellman(random);
  const dots = g.dotsLeft;
  assert.ok(dots > 100);
  let score = 0;
  for (let i = 0; i < 120 * 240 && g.phase !== 'over'; i++) { // up to four minutes of play
    if (i % 30 === 0) g.turn(['up', 'left', 'down', 'right'][Math.floor(random() * 4)]);
    g.step(1 / 120);
    assert.ok(g.open(g.pac.x, g.pac.y), 'Hell-Man is never inside a wall');
    assert.ok(g.score >= score, 'the score never goes down'); score = g.score;
    assert.ok(g.lives >= 0 && g.lives <= 4);
    for (const ghost of g.ghosts) assert.ok(Number.isFinite(g.pos(ghost).x) && Number.isFinite(g.pos(ghost).y));
  }
  assert.ok(g.score > 0, 'a random walk eats at least a few dots');
  assert.ok(g.dotsLeft < dots || g.level > 1);
});

// ---------------------------------------------------------------- Lines 98
test('Lines 98: paths and lines', () => {
  const grid = new Int8Array(81).fill(-1);
  assert.equal(findPath(grid, 0, 80).length, 16, 'the shortest way across an empty board');
  for (let y = 0; y < 9; y++) grid[y * 9 + 4] = 0;    // a wall of balls down the middle
  assert.equal(findPath(grid, 0, 8), null);
  grid[4 * 9 + 4] = -1;                               // one gap in the wall
  const path = findPath(grid, 0, 8);
  assert.ok(path && path.includes(4 * 9 + 4) && path[path.length - 1] === 8);
  const board = new Int8Array(81).fill(-1);
  for (let x = 2; x < 7; x++) board[3 * 9 + x] = 5;   // five in a row
  board[3 * 9 + 7] = 1;
  assert.deepEqual([...findLines(board, [3 * 9 + 4])].sort((a, b) => a - b), [29, 30, 31, 32, 33]);
  board[3 * 9 + 2] = 1;                               // only four of them left
  assert.equal([...findLines(board, [3 * 9 + 4])].length, 0);
});

// ---------------------------------------------------------------- Sudoku
test('Sudoku: every puzzle has exactly one solution and the promised difficulty', () => {
  const valid = (s) => [...Array(9).keys()].every((i) => {
    const row = new Set(s.slice(i * 9, i * 9 + 9)), col = new Set(), box = new Set();
    for (let j = 0; j < 9; j++) { col.add(s[j * 9 + i]); box.add(s[(Math.floor(i / 3) * 3 + Math.floor(j / 3)) * 9 + (i % 3) * 3 + (j % 3)]); }
    return row.size === 9 && col.size === 9 && box.size === 9 && !row.has(0);
  });
  for (const level of ['easy', 'medium', 'hard']) {
    const { puzzle, solution } = makePuzzle(level);
    assert.ok(valid(solution), `${level}: the solution is a valid grid`);
    assert.ok(puzzle.every((v, i) => v === 0 || v === solution[i]));
    assert.equal(countSolutions(puzzle), 1, `${level}: one solution`);
    assert.equal(needsOnlyBasics(puzzle), level !== 'hard', `${level}: difficulty`);
  }
});

// ---------------------------------------------------------------- Key Mania
test('Key Mania: a perfect run scores the maximum, an idle one scores nothing', () => {
  for (const mode of ['easy', 'normal', 'hard']) {
    const song = makeSong(mode, seeded(5));
    assert.ok(song.notes.length > 40, `${mode}: enough notes`);
    assert.ok(song.notes.every((n, i) => n.lane >= 0 && n.lane < 4 && (!i || n.t >= song.notes[i - 1].t)), `${mode}: notes are in order`);
    const perfect = createRun(song.notes);
    const moves = song.notes.flatMap((n) => [{ t: n.t, lane: n.lane, down: true }, ...(n.len ? [{ t: n.t + n.len, lane: n.lane, down: false }] : [])]).sort((a, b) => a.t - b.t);
    for (const m of moves) { if (m.down) perfect.press(m.lane, m.t); else perfect.release(m.lane, m.t); }
    perfect.update(song.length);
    assert.equal(perfect.score, MAX_SCORE, `${mode}: maximum score`);
    assert.equal(grade(perfect.accuracy), 'SS');
    const idle = createRun(song.notes);
    idle.update(song.length);
    assert.equal(idle.score, 0); assert.equal(idle.counts.miss, idle.total); assert.equal(grade(idle.accuracy), 'D');
  }
});

// ---------------------------------------------------------------- Sketchpad
test('Sketchpad: the paint bucket stays inside the lines', () => {
  const w = 20, h = 20, data = new Uint8ClampedArray(w * h * 4).fill(255);
  const paint = (x, y, c) => data.set([c, c, c, 255], (y * w + x) * 4);
  for (let i = 5; i <= 14; i++) { paint(i, 5, 0); paint(i, 14, 0); paint(5, i, 0); paint(14, i, 0); } // a black square outline
  const changed = floodFill(data, w, h, 10, 10, [255, 0, 0]);
  assert.ok(changed, 'something was filled');
  const at = (x, y) => [...data.slice((y * w + x) * 4, (y * w + x) * 4 + 3)];
  assert.deepEqual(at(10, 10), [255, 0, 0], 'inside is red');
  assert.deepEqual(at(6, 6), [255, 0, 0], 'right up to the line');
  assert.deepEqual(at(2, 2), [255, 255, 255], 'outside is untouched');
  assert.deepEqual(at(5, 10), [0, 0, 0], 'the line itself is untouched');
  assert.equal(floodFill(data, w, h, 10, 10, [255, 0, 0]), null, 'filling with the same colour again does nothing');
});

// ---------------------------------------------------------------- the files of the site
test('every icon the pages ask for is in the bundled icon set', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  const { icons } = await import('../../js/vendor/lucide.js');
  const root = new URL('../../', import.meta.url);
  const files = ['index.html', 'js/app.js', ...readdirSync(new URL('js/games/', root)).map((f) => 'js/games/' + f)];
  const asked = new Set(['trophy', 'flag', 'play']); // the icons of the start and result screens
  for (const file of files) {
    const text = readFileSync(new URL(file, root), 'utf8');
    for (const m of text.matchAll(/data-lucide="([a-z0-9-]+)"|\bicon: '([a-z0-9-]+)'/g)) asked.add(m[1] || m[2]);
  }
  const pascal = (name) => name.replace(/(\w)(\w*)(_|-|\s*)/g, (all, first, rest) => first.toUpperCase() + rest.toLowerCase());
  assert.ok(asked.size > 30, 'the icon names were found in the sources');
  assert.deepEqual([...asked].filter((name) => !icons[pascal(name)]), [], 'icons that do not exist');
});

test('the version is the same everywhere', async () => {
  const { readFileSync } = await import('node:fs');
  const read = (file) => readFileSync(new URL('../../' + file, import.meta.url), 'utf8');
  const version = read('js/app.js').match(/const VERSION = '(\d+\.\d+\.\d+)'/)?.[1];
  assert.ok(version, 'js/app.js has a VERSION');
  assert.ok(read('CHANGELOG.md').includes(`## ${version}`), 'CHANGELOG.md has an entry for this version');
});
