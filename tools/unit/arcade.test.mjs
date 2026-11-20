// Hell Run and Brimstone. (Hell Pong has a file of its own; Helltris, Hell-Man and the others are in rules.test.mjs.)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as runner from '../../js/games/run.js';
import * as brimstone from '../../js/games/rain.js';
import { seeded } from './seeded.mjs';

// ---------------------------------------------------------------- Hell Run
const { DEVIL, KINDS, createRun } = runner;
// A player by rule: jump when something on the ground is close, duck under a low fireball, let a high one pass.
function runBot(run) {
  const ahead = run.obstacles.filter((o) => o.x + o.w > DEVIL.x).sort((a, b) => a.x - b.x)[0];
  run.duck(false);
  if (!ahead) return;
  const gap = ahead.x - (DEVIL.x + DEVIL.w);
  if (ahead.kind === 'low') run.duck(gap < run.speed * 0.12);
  else if (ahead.kind !== 'high' && gap <= run.speed * 0.14) run.jump();
}
// One obstacle of our own on an empty course; the run ends before the game sends its first.
function meet(kind, act) {
  const run = createRun(() => 0.5), o = { kind, x: 190, ...KINDS[kind] };
  run.obstacles.push(o);
  for (let t = 0; t < 0.9 && !run.dead; t += 1 / 120) { act(run, o); run.step(1 / 120); }
  return !run.dead;
}

test('Hell Run: the course can always be run', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const run = createRun(seeded(seed)), kinds = new Set();
    let speed = run.speed;
    for (let t = 0; t < 150 && !run.dead; t += 1 / 120) {
      runBot(run); run.step(1 / 120);
      for (const o of run.obstacles) kinds.add(o.kind);
      assert.ok(run.speed >= speed && run.speed <= 720, 'it only gets faster, up to a point'); speed = run.speed;
      assert.ok(run.y >= 0 && run.y < 130, 'the devil stays between the ground and the top of its jump');
    }
    assert.ok(!run.dead, `seed ${seed}: a player who jumps and ducks in time is still running after two and a half minutes (${run.hit?.kind} at ${run.score})`);
    assert.deepEqual([...kinds].sort(), Object.keys(KINDS).sort(), `seed ${seed}: every kind of obstacle turned up`);
    assert.equal(run.speed, 720, 'top speed is reached');
    assert.equal(run.score, Math.floor(run.dist / 10), 'ten units of the way are a point');
  }
});

test('Hell Run: what the devil has to do about each obstacle', () => {
  const close = (run, o) => o.x - (DEVIL.x + DEVIL.w) <= run.speed * 0.14;
  for (const kind of ['flame', 'flames', 'fire', 'spike']) {
    assert.equal(meet(kind, () => {}), false, `${kind}: running into it ends the run`);
    assert.equal(meet(kind, (run) => run.duck(true)), false, `${kind}: ducking does not help`);
    assert.equal(meet(kind, (run, o) => { if (close(run, o)) run.jump(); }), true, `${kind}: a jump in time clears it`);
  }
  assert.equal(meet('low', () => {}), false, 'a low fireball hits a devil that stands upright');
  assert.equal(meet('low', (run) => run.duck(true)), true, 'ducking lets it pass');
  assert.equal(meet('low', (run, o) => { if (close(run, o)) run.jump(); }), true, 'and so does a jump over it');
  assert.equal(meet('high', () => {}), true, 'a high fireball passes over a devil that keeps running');
  assert.equal(meet('high', (run, o) => { if (o.x - (DEVIL.x + DEVIL.w) <= run.speed * 0.08) run.jump(); }), false, 'but not over one that jumps up into it');
  assert.equal(meet('high', (run, o) => { if (o.x - (DEVIL.x + DEVIL.w) <= run.speed * 0.3) run.jump(); }), true, 'a jump at its very top goes over even that one');
});

test('Hell Run: a run without a player, and the jump itself', () => {
  const idle = createRun(seeded(1));
  let t = 0;
  for (; t < 30 && !idle.dead; t += 1 / 120) idle.step(1 / 120);
  assert.ok(idle.dead && t > 1.5 && t < 4 && idle.score > 40, `the first obstacle ends it after a few seconds (${t.toFixed(2)} s, ${idle.score} points)`);
  const before = idle.score;
  idle.step(1); assert.equal(idle.score, before, 'and then nothing moves any more');

  const run = createRun(() => 0.99);
  run.jump();
  let top = 0, air = 0;
  for (let k = 0; k < 200; k++) { run.step(1 / 240); top = Math.max(top, run.y); if (run.y > 0) air += 1 / 240; }
  assert.ok(top > 115 && top < 128 && air > 0.58 && air < 0.65, `a jump is about 123 units high and lasts about 0.62 s (${top.toFixed(0)}, ${air.toFixed(2)} s)`);
  run.jump(); run.step(1 / 240); run.duck(true);
  let quick = 0;
  for (let k = 0; k < 240 && (run.y > 0 || k < 2); k++) { run.step(1 / 240); quick += 1 / 240; }
  assert.ok(quick < air * 0.75, `ducking in the air brings the devil down sooner (${quick.toFixed(2)} s)`);
});

// ---------------------------------------------------------------- Brimstone
const { FIELD, LIVES, createRain } = brimstone;
const drop = (kind, x, y = brimstone.DEVIL.y - 12) => ({ kind, x, y, v: 60, r: 4, spin: 0 });
// A rain of our own: nothing falls by itself for the first half second, which is all these checks need.
function fall(items, x = 50, seconds = 0.45) {
  const rain = createRain(() => 0.5);
  rain.x = x; rain.items.push(...items);
  for (let t = 0; t < seconds; t += 1 / 120) rain.step(1 / 120, x);
  return rain;
}

test('Brimstone: what falls into the bowl', () => {
  assert.deepEqual([fall([drop('soul', 50)]).score, fall([drop('gold', 50)]).score], [1, 5], 'a soul is a point, a golden one five');
  assert.equal(fall([drop('soul', 50), drop('soul', 53), drop('gold', 47)]).score, 7, 'several at once all count');
  assert.equal(fall([drop('soul', 80)]).score, 0, 'a soul that falls beside the devil is lost');
  assert.equal(fall([drop('soul', 50 + brimstone.DEVIL.w / 2 + 1)]).score, 1, 'the rim of the bowl still catches');
  const hurt = fall([drop('rock', 50)]);
  assert.deepEqual([hurt.lives, hurt.over, hurt.score, hurt.events.map((e) => e.kind)], [LIVES - 1, false, 0, ['hurt']], 'a rock costs a life');
  assert.ok(hurt.safe > 0.5, 'and for a moment after it nothing hurts');
  assert.equal(fall([drop('rock', 50), drop('rock', 52, brimstone.DEVIL.y - 20)]).lives, LIVES - 1, 'a second rock right behind the first does no harm');
  assert.equal(fall([drop('rock', 80)]).lives, LIVES, 'a rock that falls beside the devil does none either');
  const healed = fall([drop('rock', 50), drop('heart', 50, brimstone.DEVIL.y - 40)], 50, 0.9);
  assert.equal(healed.lives, LIVES, 'a heart gives a life back');
  assert.equal(fall([drop('heart', 50)]).lives, LIVES, 'but never more than three');
});

test('Brimstone: the devil and the end', () => {
  const rain = createRain(() => 0.5);
  rain.step(0.1, 0);
  assert.ok(rain.x < 50 && rain.x > 20, 'the devil runs to where it is sent, but takes its time');
  for (let k = 0; k < 30; k++) rain.step(0.1, -500);
  assert.equal(rain.x, brimstone.DEVIL.w / 2, 'and stops at the edge of the field');
  for (let k = 0; k < 30; k++) rain.step(0.1, 500);
  assert.equal(rain.x, FIELD.w - brimstone.DEVIL.w / 2);

  const doomed = createRain(() => 0.5);
  doomed.x = 50;
  for (let n = 0; n < LIVES; n++) { doomed.items.push(drop('rock', 50)); for (let t = 0; t < 1.6 && !doomed.over; t += 1 / 120) doomed.step(1 / 120, 50); }
  assert.deepEqual([doomed.lives, doomed.over], [0, true], 'three rocks end the game');
  const score = doomed.score, time = doomed.time;
  doomed.items.push(drop('soul', 50)); doomed.step(0.5, 50);
  assert.deepEqual([doomed.score, doomed.time], [score, time], 'and then nothing moves any more');
});

test('Brimstone: a whole game', () => {
  // a player who goes for the nearest soul unless a rock is about to land there
  for (const seed of [1, 2, 3]) {
    const rain = createRain(seeded(seed)), kinds = new Set();
    let fastest = 0;
    for (let t = 0; t < 90 && !rain.over; t += 1 / 60) {
      const danger = (x) => rain.items.some((it) => it.kind === 'rock' && it.y > brimstone.DEVIL.y - 45 && it.y < brimstone.DEVIL.y + 8 && Math.abs(it.x - x) < brimstone.DEVIL.w / 2 + it.r + 3);
      const wanted = rain.items.filter((it) => it.kind !== 'rock' && it.y < brimstone.DEVIL.y && !danger(it.x)).sort((a, b) => b.y - a.y)[0];
      let target = wanted ? wanted.x : rain.x;
      if (danger(target)) target = [...Array(21).keys()].map((k) => k * 5).filter((x) => !danger(x)).sort((a, b) => Math.abs(a - rain.x) - Math.abs(b - rain.x))[0] ?? target;
      rain.step(1 / 60, target);
      for (const it of rain.items) { kinds.add(it.kind); fastest = Math.max(fastest, it.v); assert.ok(it.x >= it.r && it.x <= FIELD.w - it.r, 'everything falls inside the field'); }
    }
    assert.ok(rain.score > 25, `seed ${seed}: a careful player catches plenty of souls (${rain.score} in ${rain.time.toFixed(0)} s)`);
    assert.ok(kinds.has('soul') && kinds.has('rock') && kinds.has('gold'), `seed ${seed}: souls, golden souls and rocks all fell`);
    assert.ok(fastest > 80, 'and they fall faster as time goes by');
  }
  const idle = createRain(seeded(4));
  for (let t = 0; t < 600 && !idle.over; t += 1 / 60) idle.step(1 / 60, 50);
  assert.ok(idle.over, 'a devil that never moves is hit three times sooner or later');
});
