// Soul Slots, Soul Dice, Soul Mines and the purse of souls they share.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GRANT, MIN_BET, souls, wallet } from '../../js/casino.js';
import { PAIR, PAYS, REELS, payout as slotPays, returnToPlayer } from '../../js/games/slots.js';
import * as dice from '../../js/games/dice.js';
import * as mines from '../../js/games/soulmines.js';
import * as blackjack from '../../js/games/blackjack.js';
import { seeded } from './seeded.mjs';

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

// ---------------------------------------------------------------- Blackjack
const hand = (...ranks) => ranks.map((rank) => ({ rank: String(rank), suit: 'spades' }));

test('Blackjack: what a hand counts', () => {
  const { total, isBlackjack } = blackjack;
  assert.deepEqual(total(hand('K', 9)), { sum: 19, soft: false });
  assert.deepEqual(total(hand('J', 'Q', 'K')), { sum: 30, soft: false }, 'pictures count ten');
  assert.deepEqual(total(hand('A', 6)), { sum: 17, soft: true }, 'an ace counts eleven while that fits');
  assert.deepEqual(total(hand('A', 6, 9)), { sum: 16, soft: false }, 'and one when it does not');
  assert.deepEqual(total(hand('A', 'A')), { sum: 12, soft: true }, 'only one of two aces can count eleven');
  assert.deepEqual(total(hand('A', 'A', 9)), { sum: 21, soft: true });
  assert.deepEqual(total(hand('A', 'A', 'A', 'K', 8)), { sum: 21, soft: false });
  assert.deepEqual(total([]), { sum: 0, soft: false });
  assert.equal(isBlackjack(hand('A', 'K')) && isBlackjack(hand(10, 'A')), true, 'an ace and a ten or a picture');
  assert.equal(isBlackjack(hand(7, 7, 7)) || isBlackjack(hand('A', 5, 5)) || isBlackjack(hand('K', 'Q')), false, 'twenty-one with three cards is no blackjack');
});

test('Blackjack: who wins, and what it pays', () => {
  const { outcome, payout } = blackjack;
  assert.equal(outcome(hand('K', 9), hand(10, 8)), 'win');
  assert.equal(outcome(hand('K', 7), hand(10, 8)), 'lose');
  assert.equal(outcome(hand('K', 8), hand(9, 9)), 'push', 'the same count is a draw');
  assert.equal(outcome(hand('K', 6), hand(10, 6, 9)), 'win', 'the dealer went over 21');
  assert.equal(outcome(hand('K', 6, 9), hand(10, 6, 9)), 'bust', 'the player went over first: lost, whatever the dealer has');
  assert.equal(outcome(hand('A', 'K'), hand(7, 7, 7)), 'blackjack', 'a blackjack beats a twenty-one of three cards');
  assert.equal(outcome(hand(7, 7, 7), hand('A', 'K')), 'lose', 'on either side of the table');
  assert.equal(outcome(hand('A', 'K'), hand('Q', 'A')), 'push', 'two blackjacks are a draw');
  assert.deepEqual(['blackjack', 'win', 'push', 'lose', 'bust'].map((r) => payout(r, 100)), [250, 200, 100, 0, 0], 'three to two for a blackjack, even money for a win, the bet back for a draw');
  for (const bet of BETS) for (const r of ['blackjack', 'win', 'push', 'lose', 'bust']) assert.ok(Number.isInteger(payout(r, bet)) && payout(r, bet) >= 0, 'whole souls only');
  assert.equal(payout('blackjack', 30), 75);
});

test('Blackjack: the dealer draws to seventeen and the shoe is fair', () => {
  const rnd = seeded(1), ranks = {}, suits = {};
  for (let i = 0; i < 52000; i++) { const card = blackjack.draw(rnd); ranks[card.rank] = (ranks[card.rank] || 0) + 1; suits[card.suit] = (suits[card.suit] || 0) + 1; }
  assert.deepEqual(Object.keys(ranks).sort(), [...blackjack.RANKS].sort(), 'every rank is dealt');
  for (const n of Object.values(ranks)) assert.ok(n > 3700 && n < 4300, `every rank about as often as any other (${n} of 52,000)`);
  for (const n of Object.values(suits)) assert.ok(n > 12500 && n < 13500, 'and every suit');
  for (let i = 0; i < 3000; i++) {
    const cards = blackjack.dealerPlays([blackjack.draw(rnd), blackjack.draw(rnd)], rnd), { sum } = blackjack.total(cards);
    assert.ok(sum >= 17 && sum <= 26, `the dealer ends between 17 and 26 (${sum})`);
    assert.ok(blackjack.total(cards.slice(0, -1)).sum < 17 || cards.length === 2, 'and takes no card once at 17');
  }
  assert.equal(blackjack.dealerPlays(hand('A', 6), rnd).length, 2, 'the dealer stands on a soft 17 too');
});

test('Blackjack: played sensibly, nearly everything comes back in the long run', () => {
  // A player who follows the textbook for the count of the hand and the dealer's open card.
  const { draw, total, isBlackjack, dealerPlays, outcome, payout } = blackjack, rnd = seeded(2);
  const ten = (c) => (c.rank === 'A' ? 11 : 'JQK'.includes(c.rank) ? 10 : Number(c.rank));
  let staked = 0, back = 0;
  for (let round = 0; round < 300000; round++) {
    const player = [draw(rnd), draw(rnd)], dealer = [draw(rnd), draw(rnd)], up = ten(dealer[0]);
    let stake = 10;
    if (!isBlackjack(player) && !isBlackjack(dealer)) {
      const first = total(player);
      if (!first.soft && (first.sum === 11 || (first.sum === 10 && up < 10) || (first.sum === 9 && up >= 3 && up <= 6))) { stake = 20; player.push(draw(rnd)); }
      else for (;;) {
        const { sum, soft } = total(player);
        const hit = soft ? sum <= 17 || (sum === 18 && up >= 9) : sum <= 11 || (sum === 12 && (up < 4 || up > 6)) || (sum >= 13 && sum <= 16 && up >= 7);
        if (!hit) break;
        player.push(draw(rnd));
      }
      if (total(player).sum <= 21) dealerPlays(dealer, rnd);
    }
    staked += stake; back += payout(outcome(player, dealer), stake);
  }
  const share = back / staked;
  assert.ok(share > 0.98 && share < 1.002, `${(share * 100).toFixed(2)}% of the bets come back: the house keeps about one per cent, as in a real casino`);
});
