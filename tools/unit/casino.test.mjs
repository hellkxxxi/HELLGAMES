// Soul Slots, Soul Dice, Soul Mines and the purse of souls they share.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GRANT, MIN_BET, souls, wallet } from '../../js/casino.js';
import { PAIR, PAYS, REELS, payout as slotPays, returnToPlayer } from '../../js/games/slots.js';
import * as dice from '../../js/games/dice.js';
import * as mines from '../../js/games/soulmines.js';

const BETS = [10, 20, 50, 100, 500, 1000, 12345, 1000000];

test('the purse starts with a grant and never goes below zero', () => {
  assert.equal(wallet.balance, GRANT, 'a new player has the grant');
  assert.equal(wallet.add(-300), GRANT - 300);
  assert.equal(wallet.balance, GRANT - 300, 'the purse remembers');
  assert.equal(wallet.add(-5000), 0, 'it cannot be overdrawn');
  assert.equal(wallet.add(12.6), 13, 'whole souls only');
  assert.ok(wallet.add(1e15) < 1e12, 'and there is a ceiling');
  assert.ok(MIN_BET > 0 && MIN_BET <= GRANT, 'the grant is enough for a bet');
});

test('sums of souls are written out short', () => {
  assert.deepEqual([0, 999, 12345, 999999, 1000000, 1234567, 10000000, 2500000000].map(souls), ['0', '999', '12,345', '999,999', '1M', '1.23M', '10M', '2.5B']);
});

test('Soul Slots: the reels and what they pay', () => {
  const count = (reel) => { const c = {}; for (const s of reel) c[s] = (c[s] || 0) + 1; return c; };
  const onReel = count(REELS[0]);
  for (const reel of REELS) {
    assert.equal(reel.length, 20);
    assert.deepEqual(count(reel), onReel, 'every reel carries the same symbols');
  }
  assert.deepEqual(Object.keys(onReel).sort(), Object.keys(PAYS).sort(), 'every symbol has a prize');
  for (const a of Object.keys(PAYS)) for (const b of Object.keys(PAYS)) {
    if (onReel[a] < onReel[b]) assert.ok(PAYS[a] > PAYS[b], `${a} is rarer than ${b}, so it pays more`);
  }
  assert.equal(slotPays(['flame', 'flame', 'flame']), 200);
  assert.equal(slotPays(['cherry', 'cherry', 'cherry']), 10);
  for (const line of [['cherry', 'cherry', 'bell'], ['bell', 'cherry', 'cherry'], ['cherry', 'bell', 'cherry']]) assert.equal(slotPays(line), PAIR, 'any pair gives the bet back');
  assert.equal(slotPays(['cherry', 'bell', 'gem']), 0);
  const back = returnToPlayer();
  assert.ok(back > 0.95 && back < 0.975, `the machine gives back a little less than it takes (${(back * 100).toFixed(2)}%)`);
});

test('Soul Dice: the chance is what the game says, and the house keeps one percent at any odds', () => {
  assert.deepEqual([dice.chanceOf(30, false), dice.chanceOf(30, true)], [30, 70]);
  assert.deepEqual([dice.wins(29.99, 30, false), dice.wins(30, 30, false), dice.wins(30, 30, true), dice.wins(29.99, 30, true)], [true, false, true, false]);
  for (let line = dice.MIN_LINE; line <= dice.MAX_LINE; line++) for (const over of [false, true]) {
    let won = 0;
    for (let roll = 0; roll < 10000; roll++) if (dice.wins(roll / 100, line, over)) won++; // every roll there is, from 0.00 to 99.99
    const chance = dice.chanceOf(line, over);
    assert.equal(won / 100, chance, `line ${line}, ${over ? 'over' : 'under'}`);
    assert.ok(Math.abs(chance / 100 * dice.multiplier(chance) - dice.EDGE) < 1e-12);
    for (const bet of BETS) {
      assert.equal(dice.payout(bet, chance), Number(BigInt(bet) * 99n / BigInt(chance)), 'the prize is rounded down and not a soul more is lost');
      assert.ok(dice.payout(bet, chance) >= bet, 'a win never pays less than the bet');
    }
  }
  assert.deepEqual([dice.payout(100, 50), dice.payout(100, 2), dice.payout(100, 98)], [198, 4950, 101]);
});

test('Soul Mines: the prize grows by exactly the risk taken', () => {
  for (const skulls of mines.MINE_CHOICES) {
    assert.ok(Math.abs(mines.multiplier(0, skulls) - mines.EDGE) < 1e-12);
    let chance = 1, top = 99n, bottom = 100n; // the chance of opening this many safe tiles in a row; the prize as an exact fraction
    for (let opened = 1; opened <= mines.TILES - skulls; opened++) {
      chance *= (mines.TILES - skulls - (opened - 1)) / (mines.TILES - (opened - 1));
      top *= BigInt(mines.TILES - (opened - 1)); bottom *= BigInt(mines.TILES - skulls - (opened - 1));
      assert.ok(Math.abs(chance * mines.multiplier(opened, skulls) - mines.EDGE) < 1e-9, `${skulls} skulls, ${opened} opened: the house keeps one percent`);
      assert.ok(mines.multiplier(opened, skulls) > mines.multiplier(opened - 1, skulls), 'every tile raises the prize');
      for (const bet of BETS) assert.equal(BigInt(mines.prize(bet, opened, skulls)), BigInt(bet) * top / bottom, 'the prize is rounded down and not a soul more is lost');
    }
  }
  assert.deepEqual([mines.prize(100, 1, 24), mines.prize(20, 10, 1), mines.prize(100, 1, 1)], [2475, 33, 103]);
});
