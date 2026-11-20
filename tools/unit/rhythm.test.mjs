// Circles of Hell, Soul Catcher and the scoring they share with each other. (Key Mania is in rules.test.mjs.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSong } from '../../js/games/mania.js';
import { MAX_SCORE, createTally, grade } from '../../js/rhythm.js';
import * as circles from '../../js/games/circles.js';
import * as catcher from '../../js/games/catcher.js';
import { seeded } from './seeded.mjs';

const MODES = ['easy', 'normal', 'hard', 'hell'];

test('rhythm games: how a run is scored', () => {
  const all = createTally(4);
  for (let i = 0; i < 4; i++) all.add('perfect');
  assert.deepEqual([all.score, all.accuracy, all.maxCombo, grade(all.accuracy)], [MAX_SCORE, 1, 4, 'SS']);
  const none = createTally(4);
  for (let i = 0; i < 4; i++) none.add('miss');
  assert.deepEqual([none.score, none.accuracy, none.maxCombo, none.counts.miss], [0, 0, 0, 4]);
  const mixed = createTally(4);
  for (const kind of ['perfect', 'miss', 'great', 'good']) mixed.add(kind);
  assert.deepEqual([mixed.combo, mixed.maxCombo, mixed.judged], [2, 2, 4]);
  assert.equal(mixed.score, Math.round(MAX_SCORE * (0.8 * (1 + 0.75 + 0.4) + 0.2 * 2) / 4), 'four fifths for accuracy, one fifth for the longest chain');
  assert.match(mixed.summary(), /Grade D · 53\.8% · best combo 2 · 1 missed/);
});

// ---------------------------------------------------------------- Circles of Hell
test('Circles of Hell: the circles of a tune', () => {
  for (const mode of MODES) for (const seed of [1, 2, 3]) {
    const rnd = seeded(seed), song = makeSong(mode, rnd), chart = circles.makeChart(song, mode, rnd), m = circles.MODES[mode];
    assert.ok(chart.length > 40 && chart.length <= song.notes.length, `${mode} ${seed}: ${chart.length} circles`);
    assert.ok(chart.some((o) => o.len), `${mode} ${seed}: there are sliders`);
    chart.forEach((o, i) => {
      const points = o.path || [[o.x, o.y]];
      assert.ok(points.every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1), `${mode} ${seed}: circle ${i} is on the field`);
      assert.equal(!!o.path, o.len > 0, 'a path for every long note and for nothing else');
      if (o.path) assert.deepEqual(o.path[0], [o.x, o.y], 'a slider starts at its circle');
      assert.ok(o.number >= 1 && (i === 0 || o.number === 1 || o.number === chart[i - 1].number + 1), 'the numbers count up and start again');
      if (i) assert.ok(o.t >= chart[i - 1].t + chart[i - 1].len + m.gap - 1e-6, `${mode} ${seed}: time to get from circle ${i - 1} to ${i}`);
      assert.ok(o.t + o.len < song.length, 'everything ends before the tune does');
      if (o.chain) { // a circle of a quick chain lies half over the one before it
        const prev = chart[i - 1];
        assert.ok(!o.len && !prev.len && o.t - prev.t < 0.135, `${mode} ${seed}: only quick circles make a chain (circle ${i})`);
        assert.ok(Math.abs(Math.hypot(o.x - prev.x, o.y - prev.y) - m.radius * 1.2) < 1e-9, `${mode} ${seed}: the circles of a chain are 1.2 radii apart (circle ${i})`);
      }
    });
    const chained = chart.filter((o) => o.chain).length;
    if (mode === 'easy' || mode === 'normal') assert.equal(chained, 0, `${mode} ${seed}: no chains`);
    else assert.ok(chained > chart.length * 0.4, `${mode} ${seed}: ${chained} of ${chart.length} circles are in chains`);
  }
});

test('Circles of Hell: the hard levels are harder', () => {
  const stats = MODES.map((mode) => {
    const rnd = seeded(7), song = makeSong(mode, rnd), chart = circles.makeChart(song, mode, rnd);
    return { perSecond: chart.length / (chart.at(-1).t - chart[0].t), ...circles.MODES[mode] };
  });
  for (let i = 1; i < stats.length; i++) {
    const a = stats[i - 1], b = stats[i];
    assert.ok(b.perSecond > a.perSecond * 1.3, `${MODES[i]}: more circles in a second than ${MODES[i - 1]} (${b.perSecond.toFixed(1)} against ${a.perSecond.toFixed(1)})`);
    assert.ok(b.radius < a.radius && b.approach < a.approach && b.flow > a.flow && b.windows.every((w, k) => w < a.windows[k]), `${MODES[i]}: smaller, quicker, wider apart and stricter`);
  }
});

test('Circles of Hell: judging', () => {
  for (const mode of MODES) {
    const rnd = seeded(4), song = makeSong(mode, rnd), chart = circles.makeChart(song, mode, rnd), radius = circles.MODES[mode].radius;
    // a player who clicks every circle at its moment and follows every slider
    const run = circles.createRun(chart, mode); run.setField(1, 1, radius);
    let k = 0, x = 0.5, y = 0.5;
    for (let t = 0; t < song.length; t += 1 / 120) {
      const o = run.objs[k];
      if (run.held) [x, y] = circles.ballAt(run.held, t);
      if (o && !run.held && t >= o.t) { x = o.x; y = o.y; assert.equal(run.press(t, x, y), 'perfect'); k++; }
      run.update(t, x, y, !!run.held);
    }
    assert.deepEqual([run.tally.score, run.tally.judged, run.tally.counts.perfect], [MAX_SCORE, run.tally.total, run.tally.total], `${mode}: a flawless run`);
    assert.equal(run.tally.total, chart.length + chart.filter((o) => o.len).length, 'a slider is judged twice');

    // a player who does nothing
    const idle = circles.createRun(chart, mode); idle.setField(1, 1, radius);
    for (let t = 0; t < song.length; t += 1 / 30) idle.update(t, 0.5, 0.5, false);
    assert.deepEqual([idle.tally.score, idle.tally.counts.miss], [0, idle.tally.total], `${mode}: an idle run`);

    // a player who clicks the start of every slider and lets go at once
    const lazy = circles.createRun(chart, mode); lazy.setField(1, 1, radius);
    k = 0;
    for (let t = 0; t < song.length; t += 1 / 120) {
      const o = lazy.objs[k];
      if (o && t >= o.t) { lazy.press(t, o.x, o.y); k++; }
      lazy.update(t, -1, -1, false);
    }
    assert.equal(lazy.tally.counts.miss, chart.filter((o) => o.len).length, `${mode}: a slider that is not followed is lost`);
  }
});

test('Circles of Hell: what a click can hit', () => {
  const chart = [{ t: 2, len: 0, x: 0.2, y: 0.2, path: null, group: 1, number: 1 }, { t: 3, len: 0, x: 0.8, y: 0.8, path: null, group: 1, number: 2 }];
  const run = circles.createRun(chart, 'easy'); run.setField(400, 300, 30); // a field of 400 by 300 pixels, circles of 30
  const [perfect, great, good] = circles.MODES.easy.windows;
  assert.equal(run.press(2, 0.8, 0.8), null, 'the second circle cannot be hit before the first');
  assert.equal(run.press(2, 0.2 + 31 / 400, 0.2), null, 'a click just outside the circle hits nothing');
  assert.equal(run.press(2 - good - 0.05, 0.2, 0.2), 'early', 'a click on the circle long before its time is not judged');
  assert.equal(run.tally.judged, 0);
  assert.equal(run.press(2 + great - 0.001, 0.2 + 29 / 400, 0.2), 'great', 'inside the circle, a little late');
  assert.equal(run.press(3 - good + 0.001, 0.8, 0.8 - 29 / 300), 'good', 'the circle is round on screen, not on the field');
  assert.deepEqual([run.tally.judged, run.tally.combo], [2, 2]);
  assert.ok(perfect < great && great < good);

  const late = circles.createRun(chart, 'easy'); late.setField(400, 300, 30);
  assert.equal(late.press(2 + good + 0.01, 0.2, 0.2), null, 'too late: the circle is already lost');
  assert.deepEqual([late.tally.counts.miss, late.objs[0].state], [1, 'missed']);

  // a quick chain: a click on the second circle gives the first one up, but only once its moment has come
  const quick = [{ t: 2, len: 0, x: 0.2, y: 0.2, path: null, group: 1, number: 1 }, { t: 2.1, len: 0, x: 0.4, y: 0.2, path: null, group: 1, number: 2 }, { t: 2.2, len: 0, x: 0.6, y: 0.2, path: null, group: 1, number: 3 }];
  const chain = circles.createRun(quick, 'hard'); chain.setField(400, 300, 30);
  assert.equal(chain.press(1.99, 0.4, 0.2), null, 'the second circle cannot be hit before the moment of the first');
  assert.equal(chain.tally.judged, 0);
  assert.equal(chain.press(2.1, 0.4, 0.2), 'perfect', 'after it, a click on the second circle counts');
  assert.deepEqual([chain.objs[0].state, chain.objs[1].state, chain.tally.counts.miss, chain.tally.counts.perfect, chain.tally.combo], ['missed', 'done', 1, 1, 1], 'and the first is lost');
  assert.equal(chain.press(2.2, 0.6, 0.2), 'perfect');
  const skip = circles.createRun(quick, 'hard'); skip.setField(400, 300, 30);
  assert.equal(skip.press(2.05, 0.6, 0.2), null, 'the third circle cannot be hit while the first two wait');
  assert.equal(skip.press(2.06, 0.2, 0.2), 'great', 'and the first is still there to be hit');
});

// ---------------------------------------------------------------- Soul Catcher
test('Soul Catcher: the squares of a tune', () => {
  for (const mode of MODES) for (const seed of [1, 2, 3]) {
    const rnd = seeded(seed), song = makeSong(mode, rnd), chart = catcher.makeChart(song, mode, rnd);
    const m = catcher.MODES[mode];
    assert.ok(chart.length > 40, `${mode} ${seed}: ${chart.length} squares`);
    let same = 0;
    chart.forEach((n, i) => {
      assert.ok([0, 1, 2].includes(n.col) && [0, 1, 2].includes(n.row), 'on the grid');
      assert.ok(n.t < song.length, 'before the tune ends');
      if (!i) return;
      const prev = chart[i - 1], since = n.t - prev.t, step = Math.max(Math.abs(n.col - prev.col), Math.abs(n.row - prev.row));
      assert.ok(since >= m.gap - 1e-6, `${mode} ${seed}: time to get to square ${i}`);
      if (since < 0.55 && !m.jump) assert.ok(step <= 1 || (prev.col === 1 && prev.row === 1), `${mode} ${seed}: a quick note is one step away (square ${i})`);
      if (since < 0.15) assert.ok(step <= 1 || (prev.col === 1 && prev.row === 1), `${mode} ${seed}: no leap across the grid in a sixteenth (square ${i})`);
      same = step === 0 ? same + 1 : 0;
      assert.ok(same <= 2, 'no more than three in a row on one spot');
    });
    assert.ok(new Set(chart.map((n) => n.row * 3 + n.col)).size === 9, `${mode} ${seed}: every cell is used`);

    // the snakes: rows of quick squares, each in the cell beside the one before
    const snakes = new Map();
    chart.forEach((n, i) => {
      assert.equal(!!n.link, !!n.snake && snakes.has(n.snake), 'every square of a snake but its head is a link');
      if (!n.snake) return;
      if (!snakes.has(n.snake)) snakes.set(n.snake, []);
      const body = snakes.get(n.snake), prev = chart[i - 1];
      if (n.link) {
        assert.equal(prev.snake, n.snake, 'a snake has no gaps');
        assert.equal(Math.abs(n.col - prev.col) + Math.abs(n.row - prev.row), 1, `${mode} ${seed}: square ${i} of a snake is beside the one before`);
        if (body.length > 1) assert.ok(body.at(-2).col !== n.col || body.at(-2).row !== n.row, `${mode} ${seed}: a snake never turns straight back (square ${i})`);
      }
      body.push(n);
    });
    const lengths = [...snakes.values()].map((body) => body.length);
    assert.ok(lengths.every((n) => n >= 3), 'a snake has three squares or more');
    if (mode === 'easy') assert.equal(lengths.length, 0, 'easy: no snakes');
    else if (mode === 'normal') assert.ok(lengths.length >= 3 && lengths.every((n) => n === 5), `normal ${seed}: a snake of five with every fill of the drums (${lengths})`);
    else assert.ok(lengths.length > 20 && Math.max(...lengths) >= 9, `${mode} ${seed}: many snakes, some of them long (${lengths.length}, up to ${Math.max(...lengths)})`);
  }
});

test('Soul Catcher: the hard levels are harder', () => {
  const stats = MODES.map((mode) => {
    const rnd = seeded(7), song = makeSong(mode, rnd), chart = catcher.makeChart(song, mode, rnd);
    let way = 0;
    chart.forEach((n, i) => { if (i) way += Math.hypot(n.col - chart[i - 1].col, n.row - chart[i - 1].row); });
    return { cellsPerSecond: way / (chart.at(-1).t - chart[0].t), ...catcher.MODES[mode] };
  });
  for (let i = 1; i < stats.length; i++) {
    const a = stats[i - 1], b = stats[i];
    assert.ok(b.cellsPerSecond > a.cellsPerSecond * 1.2, `${MODES[i]}: the cursor has further to go in a second than in ${MODES[i - 1]} (${b.cellsPerSecond.toFixed(1)} cells against ${a.cellsPerSecond.toFixed(1)})`);
    assert.ok(b.reach < a.reach && b.approach < a.approach && b.late < a.late, `${MODES[i]}: closer, quicker and stricter`);
  }
});

test('Soul Catcher: judging', () => {
  for (const mode of MODES) {
    const rnd = seeded(5), song = makeSong(mode, rnd), chart = catcher.makeChart(song, mode, rnd);
    // the cursor goes to the cell of the next square and waits there
    const run = catcher.createRun(chart, mode);
    let k = 0;
    for (let t = 0; t < song.length; t += 1 / 120) {
      while (k < chart.length - 1 && run.notes[k].state !== 'wait') k++;
      run.update(t, run.notes[k].col + 0.5, run.notes[k].row + 0.5);
    }
    assert.deepEqual([run.tally.score, run.tally.counts.perfect], [MAX_SCORE, chart.length], `${mode}: a flawless run`);
    // a cursor left in the middle catches the squares of the middle cell and no others
    const idle = catcher.createRun(chart, mode);
    for (let t = 0; t < song.length; t += 1 / 60) idle.update(t, 1.5, 1.5);
    assert.equal(idle.tally.counts.perfect, chart.filter((n) => n.col === 1 && n.row === 1).length, `${mode}: an idle run`);
    assert.equal(idle.tally.judged, chart.length);
  }
});

test('Soul Catcher: when a square is caught', () => {
  const chart = [{ t: 2, col: 0, row: 0 }], { reach, late } = catcher.MODES.normal;
  const at = (...looks) => { const run = catcher.createRun(chart, 'normal'); for (const [t, x, y] of looks) run.update(t, x, y); return run.notes[0].state; };
  assert.equal(at([1.9, 0.5, 0.5], [1.95, 2.5, 2.5], [2.2, 2.5, 2.5]), 'missed', 'being there before its moment is not enough');
  assert.equal(at([1.9, 2.5, 2.5], [2.01, 0.5, 0.5]), 'hit');
  assert.equal(at([1.9, 2.5, 2.5], [2.01, 0.5 + reach - 0.01, 0.5]), 'hit', 'the edge of its reach still counts');
  assert.equal(at([1.9, 2.5, 2.5], [2.01, 0.5 + reach + 0.01, 0.5], [2.3, 2.5, 2.5]), 'missed', 'just outside does not');
  assert.equal(at([1.9, 2.5, 2.5], [2 + late - 0.01, 0.5, 0.5]), 'hit', 'a little late is fine');
  assert.equal(at([1.9, 2.5, 2.5], [2 + late + 0.005, 2.5, 2.5], [2 + late + 0.01, 0.5, 0.5]), 'missed', 'too late is not');
  assert.equal(at([1.9, 0.5, 2.5], [2 + late + 0.5, 0.5, 0.5]), 'missed', 'nor is turning up long after, even if nobody looked in between');
  assert.equal(at([1.99, 0.5, 0.5], [2.01, 2.5, 2.5]), 'hit', 'leaving in the very moment the square arrives still counts');
  assert.equal(at([1.99, 2.9, 0.5], [2.01, 0.1, 0.5]), 'hit', 'a quick sweep across the square between two looks is not lost');
  assert.equal(at([1.99, 2.9, 2.9], [2.01, 2.9, 2.0]), 'wait', 'nothing is decided while there is still time');
});
