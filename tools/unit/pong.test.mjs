// Hell Pong.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HALF, LEN, LEVELS, WIN, createPong } from '../../js/games/pong.js';
import { seeded } from './seeded.mjs';

// A match against the computer. The player's paddle follows the ball and never misses; where on the
// paddle the ball lands changes from hit to hit, so the returns go off at different angles.
function match(level, rnd, limit = 900) {
  const g = createPong(level, rnd), seen = { across: [1, 0], along: [LEN, 0], fastest: 0, serves: [] };
  let off = 0, t = 0, through = 0, came = 0, wasServing = true;
  while (g.winner === null && t < limit) {
    g.step(1 / 120, [g.ball.a + off]); t += 1 / 120;
    seen.across = [Math.min(seen.across[0], g.ball.a), Math.max(seen.across[1], g.ball.a)];
    seen.along = [Math.min(seen.along[0], g.ball.l), Math.max(seen.along[1], g.ball.l)];
    seen.fastest = Math.max(seen.fastest, g.speed);
    if (wasServing && g.serveIn <= 0) seen.serves.push(g.speed);
    wasServing = g.serveIn > 0;
    for (const e of g.events.splice(0)) {
      if (e.kind === 'hit') off = (rnd() * 2 - 1) * HALF * 0.8;
      if (e.kind === 'hit' && e.by === 1) came++;
      if (e.kind === 'goal' && e.by === 0) { came++; through++; }
    }
  }
  return { g, t, seen, share: through / came };
}

test('Hell Pong: a match ends at seven points and the ball stays on the table', () => {
  const { g, t, seen } = match('easy', seeded(3));
  assert.equal(g.winner, 0, 'a player who never misses wins');
  assert.deepEqual(g.score, [WIN, 0]);
  assert.ok(t < 300, `the match does not drag on (${t.toFixed(0)} s)`);
  assert.ok(seen.across[0] >= 0 && seen.across[1] <= 1, 'the ball never leaves through a side wall');
  assert.ok(seen.along[0] > -0.2 && seen.along[1] < LEN + 0.2, 'and not far past the ends');
  assert.ok(seen.serves.length >= WIN && seen.serves.every((v) => v === seen.serves[0]), 'every serve starts at the same speed');
  assert.ok(seen.fastest > seen.serves[0] && seen.fastest <= 2.5, 'hits speed the ball up, up to a limit');
  const before = JSON.stringify([g.score, g.ball, g.pads]);
  g.step(1, [0.2]);
  assert.equal(JSON.stringify([g.score, g.ball, g.pads]), before, 'nothing moves once the match is over');
});

test('Hell Pong: each level of the computer is stronger than the one before', () => {
  const rnd = seeded(11), share = {};
  for (const level of Object.keys(LEVELS)) {
    let sum = 0;
    for (let n = 0; n < 12; n++) { const m = match(level, rnd); assert.notEqual(m.g.winner, null, `${level}: the match ends`); sum += m.share; }
    share[level] = sum / 12; // the share of balls the computer lets through
  }
  assert.ok(share.easy > share.normal + 0.1 && share.normal > share.hard + 0.03, JSON.stringify(share));
  assert.ok(share.easy < 0.5, 'even the easy one returns most balls');
  assert.ok(share.hard > 0.03, 'and the hard one can be beaten');
});

test('Hell Pong: paddles stay on the table, and in a game for two nobody moves them but the players', () => {
  const g = createPong(null, seeded(5));
  g.step(1 / 60, [-5, 7]);
  assert.deepEqual(g.pads, [HALF, 1 - HALF]);
  g.step(1 / 60, [0.5, 0.5]);
  let t = 0;
  while (g.winner === null && t < 600) { g.step(1 / 60); t += 1 / 60; }
  assert.deepEqual(g.pads, [0.5, 0.5], 'the paddles were left alone');
  assert.notEqual(g.winner, null, 'the match still ends');
  assert.equal(Math.max(...g.score), WIN);
});
