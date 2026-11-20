// Beat Maker and Sandbox.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEMO, MAX_BPM, MIN_BPM, ROWS, STEPS, randomSong, readSong, soundOf, writeSong } from '../../js/games/beats.js';
import * as sand from '../../js/games/sand.js';
import { seeded } from './seeded.mjs';

// ---------------------------------------------------------------- Beat Maker
test('Beat Maker: the rows', () => {
  assert.equal(new Set(ROWS.map((r) => r.id)).size, ROWS.length, 'no row twice');
  const scale = new Set([9, 0, 2, 4, 7]); // A C D E G: the five notes that never clash
  for (const r of ROWS) if (r.group !== 'drum') assert.ok(scale.has(r.midi % 12), `row ${r.id} is a note of the scale`);
  // every sound a row asks for is one the synth can make
  const synth = readFileSync(new URL('../../js/synth.js', import.meta.url), 'utf8');
  const kinds = new Set([...synth.matchAll(/s\.kind === '(\w+)'/g)].map((m) => m[1]));
  assert.ok(kinds.size >= 10, 'the kinds of sound were found in js/synth.js');
  for (const r of ROWS) {
    const sound = soundOf(r, 0.125);
    assert.ok(kinds.has(sound.kind), `row ${r.id}: the synth knows "${sound.kind}"`);
    assert.ok(sound.vel > 0 && (r.group === 'drum' || (sound.midi === r.midi && sound.dur > 0)));
  }
});

test('Beat Maker: a song is saved and read back unchanged', () => {
  const demo = readSong(DEMO);
  assert.equal(demo.bpm, DEMO.bpm);
  for (const r of ROWS) assert.equal(demo.rows[r.id].length, STEPS);
  assert.ok(demo.rows.kick[0] && !demo.rows.kick[1]);
  assert.deepEqual(readSong(JSON.parse(JSON.stringify(writeSong(demo)))), demo);
  assert.deepEqual(Object.keys(DEMO.rows).sort(), ROWS.map((r) => r.id).sort(), 'the first beat names every row');
  // whatever is found in the browser's storage, a song comes out
  for (const junk of [null, undefined, 7, 'x', {}, { bpm: 'fast', rows: 5 }, { rows: { kick: 12, nonsense: 'xxxx' } }]) {
    const song = readSong(junk);
    assert.equal(song.bpm, 110);
    assert.ok(ROWS.every((r) => song.rows[r.id].length === STEPS && !song.rows[r.id].includes(true)));
  }
  assert.deepEqual([readSong({ bpm: 5 }).bpm, readSong({ bpm: 999 }).bpm, readSong({ bpm: 121.4 }).bpm], [MIN_BPM, MAX_BPM, 121]);
  assert.equal(readSong({ rows: { kick: 'x'.repeat(40) } }).rows.kick.length, STEPS, 'a row that is too long is cut');
});

test('Beat Maker: a random beat is a beat', () => {
  const rnd = seeded(1), seen = new Set();
  for (let n = 0; n < 60; n++) {
    const song = randomSong(rnd), on = (id) => song.rows[id].filter(Boolean).length;
    assert.ok(song.bpm >= MIN_BPM && song.bpm <= MAX_BPM && song.bpm % 5 === 0);
    assert.ok(song.rows.kick[0], 'the bar starts with a kick');
    assert.ok(on('kick') >= 2 && on('hat') >= 4 && on('snare') + on('clap') >= 2, 'there are drums');
    for (let s = 0; s < STEPS; s++) {
      const playing = (group) => ROWS.filter((r) => r.group === group && song.rows[r.id][s]).length;
      assert.ok(playing('lead') <= 1 && playing('bass') <= 1, 'the melody and the bass play one note at a time');
    }
    assert.ok(ROWS.filter((r) => r.group === 'lead').reduce((sum, r) => sum + on(r.id), 0) >= 4, 'there is a melody');
    seen.add(JSON.stringify(writeSong(song)));
  }
  assert.ok(seen.size >= 59, 'and no two are alike');
});

// ---------------------------------------------------------------- Sandbox
const { EMPTY, SAND, WATER, STONE, WOOD, OIL, FIRE, LAVA, STEAM, SMOKE, EMBER } = sand;
const run = (world, steps) => { for (let i = 0; i < steps; i++) world.step(); };
const cells = (world, type) => { const out = []; for (let y = 0; y < world.h; y++) for (let x = 0; x < world.w; x++) if (world.at(x, y) === type) out.push([x, y]); return out; };

test('Sandbox: sand falls into a heap and none of it is lost', () => {
  const world = sand.createWorld(40, 30, seeded(1));
  world.fill(18, 0, 22, 4, SAND);
  run(world, 300);
  const grains = cells(world, SAND);
  assert.equal(grains.length, 25);
  assert.ok(grains.every(([x, y]) => y === 29 || world.at(x, y + 1) !== EMPTY), 'no grain hangs in the air');
  assert.ok(grains.some(([, y]) => y === 29) && Math.min(...grains.map(([, y]) => y)) >= 25, 'the heap lies on the floor and is wider than the column was');
  const before = JSON.stringify(grains);
  run(world, 50);
  assert.equal(JSON.stringify(cells(world, SAND)), before, 'and it comes to rest');
});

test('Sandbox: water finds its level, stone and wood stay put', () => {
  const world = sand.createWorld(40, 30, seeded(2));
  world.fill(0, 0, 3, 19, WATER);                    // a column of 80 drops
  world.fill(20, 10, 22, 10, STONE); world.fill(30, 12, 31, 12, WOOD);
  run(world, 2500);
  const water = cells(world, WATER);
  assert.equal(water.length, 80);
  assert.ok(water.every(([, y]) => y >= 28), 'two full rows at the bottom');
  assert.deepEqual(cells(world, STONE), [[20, 10], [21, 10], [22, 10]]);
  assert.deepEqual(cells(world, WOOD), [[30, 12], [31, 12]]);
});

test('Sandbox: sand sinks in water and oil floats on it', () => {
  const world = sand.createWorld(30, 30, seeded(3));
  world.fill(0, 10, 29, 19, OIL); world.fill(0, 0, 29, 9, WATER); world.fill(10, 20, 19, 22, SAND);
  run(world, 4000);
  assert.deepEqual([world.count(OIL), world.count(WATER), world.count(SAND)], [300, 300, 30]);
  assert.ok(cells(world, SAND).every(([x, y]) => y === 29 || world.at(x, y + 1) === SAND), 'the sand lies at the very bottom, in a heap');
  assert.ok(cells(world, WATER).every(([x, y]) => y === 29 || world.at(x, y + 1) !== OIL), 'no water rests on oil');
  const lowestOil = Math.max(...cells(world, OIL).map(([, y]) => y)), highestWater = Math.min(...cells(world, WATER).map(([, y]) => y));
  assert.ok(lowestOil <= highestWater, `all the oil lies above all the water, with a level line between them (oil down to row ${lowestOil}, water up to row ${highestWater})`);

  // water poured into a pool of oil from one side spreads out under it
  const pool = sand.createWorld(30, 20, seeded(4));
  pool.fill(0, 12, 29, 19, OIL);
  for (let i = 0; i < 3000; i++) { if (i < 300) pool.paint(3, 2, 1, WATER, 0.6); pool.step(); }
  const top = (x) => { for (let y = 0; y < pool.h; y++) if (pool.at(x, y) === WATER) return y; return pool.h; };
  const tops = Array.from({ length: pool.w }, (_, x) => top(x));
  assert.ok(Math.max(...tops) - Math.min(...tops) <= 1, `the water lies flat under the oil (its top, column by column: ${tops.join(' ')})`);
});

test('Sandbox: fire burns wood and oil away and then goes out', () => {
  const world = sand.createWorld(40, 30, seeded(4));
  world.fill(10, 22, 30, 29, WOOD); world.fill(0, 28, 9, 29, OIL);
  world.paint(20, 21, 2, FIRE);
  assert.ok(world.count(FIRE) > 0);
  let steps = 0;
  while (world.count(WOOD) + world.count(EMBER) + world.count(OIL) + world.count(FIRE) + world.count(SMOKE) > 0 && steps < 30000) { world.step(); steps++; }
  assert.ok(steps < 30000, 'everything burns down in the end');
  assert.deepEqual([world.count(WOOD), world.count(OIL), world.count(FIRE), world.count(SMOKE)], [0, 0, 0, 0]);
  const alone = sand.createWorld(20, 20, seeded(5));
  alone.fill(5, 15, 14, 19, FIRE);
  run(alone, 1500);
  assert.equal(alone.cell.some((c) => c !== EMPTY), false, 'a fire with nothing to burn dies and its smoke clears');
});

test('Sandbox: lava turns to stone in water, and water puts a burning log out', () => {
  const world = sand.createWorld(40, 30, seeded(6));
  world.fill(0, 26, 39, 29, WATER); world.fill(15, 0, 24, 5, LAVA);
  run(world, 2000);
  assert.ok(world.count(STONE) > 30, 'most of the lava became stone');
  assert.ok(world.count(LAVA) < 15);
  assert.ok(world.count(WATER) < 160, 'and some of the water boiled away');

  const log = sand.createWorld(20, 20, seeded(7));
  log.fill(8, 10, 11, 10, WOOD); log.paint(9, 10, 0, FIRE);
  assert.equal(log.at(9, 10), EMBER, 'fire lights the wood it touches');
  log.fill(0, 0, 19, 8, WATER);
  run(log, 600);
  assert.equal(log.count(EMBER) + log.count(FIRE), 0);
  assert.ok(log.count(WOOD) >= 1, 'some of the log is left');
});

test('Sandbox: the brush', () => {
  const world = sand.createWorld(20, 20, seeded(8));
  world.fill(0, 10, 19, 10, STONE);
  world.paint(10, 10, 3, SAND);
  assert.equal(world.count(STONE), 20, 'a material goes only where there is room');
  assert.ok(world.count(SAND) > 20);
  world.paint(10, 10, 3, EMPTY);
  assert.deepEqual([world.count(SAND), world.count(STONE)], [0, 13], 'the eraser takes everything under it');
  world.paint(-3, -3, 2, WATER); world.paint(25, 25, 2, WATER); world.paint(19, 0, 2, WATER);
  assert.ok(world.count(WATER) > 0 && world.count(WATER) < 13, 'drawing over the edge is cut off, not wrapped around');
  const thin = sand.createWorld(20, 20, seeded(9));
  thin.paint(10, 10, 6, SAND, 0.5);
  const full = sand.createWorld(20, 20, seeded(9));
  full.paint(10, 10, 6, SAND);
  assert.ok(thin.count(SAND) > full.count(SAND) * 0.3 && thin.count(SAND) < full.count(SAND) * 0.7, 'a poured material fills about half the brush');
});

test('Sandbox: the first scene has a bit of everything and runs without trouble', () => {
  for (const [w, h] of [[200, 120], [112, 136]]) {
    const world = sand.createWorld(w, h, seeded(10));
    sand.scene(world);
    for (const type of [SAND, WATER, STONE, WOOD, LAVA]) assert.ok(world.count(type) > 20, `${w}x${h}: material ${type} is there`);
    const stone = world.count(STONE);
    run(world, 400);
    assert.ok(world.cell.every((c) => c >= EMPTY && c <= EMBER));
    assert.ok(world.count(STONE) >= stone, 'the stone walls stand');
    assert.ok(world.count(EMBER) + world.count(FIRE) > 0 || world.count(WOOD) < 50, `${w}x${h}: the lava has reached the hut`);
    assert.ok(world.count(STEAM) >= 0 && world.tick === 400);
  }
});
