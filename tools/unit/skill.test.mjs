// The quick games of eye and hand: Stroop Test, Odd One Out, Rock Paper Scissors, and the sensitivity converter.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as sens from '../../js/games/sens.js';
import * as stroop from '../../js/games/stroop.js';
import * as odd from '../../js/games/odd.js';
import * as rps from '../../js/games/rps.js';
import { seeded } from './seeded.mjs';

const near = (a, b, slack) => Math.abs(a - b) <= slack;

// ---------------------------------------------------------------- Sens Converter
test('Sens Converter: the conversions that everybody quotes', () => {
  const g = sens.gameOf, to = (value, from, game) => sens.show(sens.convert(value, g(from), g(game)), g(game));
  assert.equal(to(0.4, 'valorant', 'cs2'), '1.273', 'Valorant 0.4 is 1.273 in Counter-Strike');
  assert.equal(to(2, 'cs2', 'valorant'), '0.629', 'Counter-Strike 2.0 is 0.629 in Valorant');
  assert.equal(to(1.5, 'cs2', 'valorant'), '0.471');
  assert.equal(to(1.5, 'cs2', 'overwatch'), '5', 'three and a third times the Counter-Strike number in Overwatch');
  assert.equal(to(1.5, 'cs2', 'fortnite'), '5.9', 'Fortnite takes one digit after the point');
  assert.equal(to(1.5, 'cs2', 'r6'), '6', 'Rainbow Six takes whole numbers (5.76 exactly)');
  assert.ok(near(sens.convert(1.5, g('cs2'), g('r6')), 5.76, 0.001));
  assert.equal(to(0.4, 'valorant', 'overwatch'), '4.24', 'Valorant times 10.6 in Overwatch');
  assert.equal(to(1.273, 'cs2', 'apex'), '1.273', 'Apex Legends counts as Counter-Strike does');
  assert.equal(to(4.24, 'overwatch', 'cod'), '4.24', 'and Call of Duty as Overwatch');
  assert.ok(near(sens.turn(0.4, g('valorant'), 800), 40.82, 0.01), 'Valorant 0.4 at 800 DPI: 40.8 cm for a full turn');
  assert.ok(near(sens.turn(2, g('cs2'), 800), 25.98, 0.01), 'Counter-Strike 2.0 at 800 DPI: 26 cm');
});

test('Sens Converter: a conversion keeps the way the mouse travels', () => {
  assert.equal(new Set(sens.GAMES.map((game) => game.id)).size, sens.GAMES.length, 'no game twice');
  assert.ok(sens.GAMES.length >= 6 && ['valorant', 'cs2', 'apex', 'fortnite'].every((id) => sens.gameOf(id)), 'the four games that were asked for, and more');
  for (const from of sens.GAMES) {
    assert.ok(from.yaw > 0 && from.yaw < 1 && from.digits >= 0 && from.digits <= 3 && from.name.length > 3, `${from.id}: a yaw, a name and a number of digits`);
    for (const to of sens.GAMES) {
      const there = sens.convert(1.7, from, to);
      assert.ok(near(sens.turn(1.7, from, 1600), sens.turn(there, to, 1600), 1e-9), `${from.id} → ${to.id}: a full turn takes the same way`);
      assert.ok(near(sens.convert(there, to, from), 1.7, 1e-12), `${from.id} → ${to.id} → ${from.id} comes back to the start`);
    }
  }
  assert.ok(near(sens.turn(1, sens.gameOf('cs2'), 400), 2 * sens.turn(1, sens.gameOf('cs2'), 800), 1e-9), 'half the DPI, twice the way');
  assert.deepEqual([sens.show(1.2000001, sens.gameOf('cs2')), sens.show(0.35, sens.gameOf('valorant')), sens.show(7.96, sens.gameOf('fortnite'))], ['1.2', '0.35', '8'], 'no more digits than the game takes, no zeros at the end');
});

// ---------------------------------------------------------------- Stroop Test
test('Stroop Test: the cards', () => {
  const rnd = seeded(1), n = stroop.INKS.length, seen = new Set();
  let prev = null, lies = 0;
  for (let i = 0; i < 4000; i++) {
    const card = stroop.nextCard(prev, rnd);
    assert.ok(Number.isInteger(card.word) && card.word >= 0 && card.word < n && Number.isInteger(card.ink) && card.ink >= 0 && card.ink < n, 'a word and an ink that exist');
    if (prev) assert.ok(card.word !== prev.word || card.ink !== prev.ink, 'never the same card twice in a row');
    if (card.word !== card.ink) lies++;
    seen.add(card.word * n + card.ink); prev = card;
  }
  assert.equal(seen.size, n * n, 'every word turns up in every ink');
  assert.ok(lies > 2800 && lies < 3200, `about three cards in four lie about their colour (${lies} of 4000)`);
  for (const lang of ['en', 'ru']) assert.equal(new Set(stroop.INKS.map((ink) => ink[lang])).size, n, `${lang}: every colour has a name of its own`);
  assert.equal(new Set(stroop.INKS.map((ink) => ink.hex)).size, n, 'and an ink of its own');
});

// ---------------------------------------------------------------- Odd One Out
test('Odd One Out: the field grows and the difference shrinks', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 11, 12, 13, 40].map(odd.sideOf), [2, 3, 3, 4, 4, 5, 5, 8, 8, 8, 8], 'two to a side at first, eight at most');
  for (let level = 1; level < 40; level++) assert.ok(odd.contrast(level) <= odd.contrast(level - 1) && odd.contrast(level) >= 3, 'the odd colour comes closer to the others, but stays apart');
  const rnd = seeded(2);
  for (const kind of ['colors', 'letters']) {
    const places = new Set();
    for (let level = 0; level < 30; level++) for (let n = 0; n < 20; n++) {
      const l = odd.makeLevel(level, kind, rnd);
      assert.ok(l.side === odd.sideOf(level) && Number.isInteger(l.odd) && l.odd >= 0 && l.odd < l.side * l.side, `${kind}: the odd tile is on the field`);
      assert.notEqual(l.most, l.other, `${kind}: the odd tile differs`);
      if (kind === 'letters') assert.ok(odd.PAIRS.some((p) => p === l.most + l.other || p === l.other + l.most), 'two signs of one pair');
      else {
        const [a, b] = [l.most, l.other].map((c) => c.match(/^hsl\((\d+) (\d+)% ([\d.]+)%\)$/).slice(1).map(Number));
        assert.deepEqual(a.slice(0, 2), b.slice(0, 2), 'the same colour');
        assert.ok(near(Math.abs(a[2] - b[2]), odd.contrast(level), 0.06) && b[2] > 5 && b[2] < 95, `a little lighter or darker (${l.most} against ${l.other})`);
      }
      if (level === 8) places.add(l.odd);
    }
    assert.ok(places.size > 10, `${kind}: the odd tile is not always in the same place`);
  }
  assert.ok(odd.PAIRS.every((p) => p.length === 2 && p[0] !== p[1]) && new Set(odd.PAIRS).size === odd.PAIRS.length, 'the pairs of signs are pairs');
});

// ---------------------------------------------------------------- Rock Paper Scissors
test('Rock Paper Scissors: what beats what', () => {
  const { duel, counter, HANDS } = rps;
  assert.deepEqual([duel('rock', 'scissors'), duel('scissors', 'paper'), duel('paper', 'rock')], [1, 1, 1]);
  assert.deepEqual([duel('scissors', 'rock'), duel('paper', 'scissors'), duel('rock', 'paper')], [-1, -1, -1]);
  for (const hand of HANDS) { assert.equal(duel(hand, hand), 0, 'the same hand is a draw'); assert.equal(duel(counter(hand), hand), 1, 'the counter of a hand beats it'); }
});

test('Rock Paper Scissors: the devil punishes habits and nothing else', () => {
  const play = (choose, rounds = 6000, seed = 3) => {
    const rnd = seeded(seed), mind = rps.createMind(rnd), mine = seeded(seed + 100);
    let won = 0, lost = 0, last = null;
    for (let i = 0; i < rounds; i++) {
      const theirs = mind.choose(), hand = choose(last, mine), outcome = rps.duel(hand, theirs);
      mind.learn(hand, outcome);
      if (outcome > 0) won++; else if (outcome < 0) lost++;
      last = { hand, outcome };
    }
    return { won: won / rounds, lost: lost / rounds };
  };
  const rock = play(() => 'rock');
  assert.ok(rock.lost > 0.6 && rock.won < 0.2, `always the same hand loses most rounds (${JSON.stringify(rock)})`);
  const copycat = play((last) => (last && last.outcome > 0 ? last.hand : last ? rps.counter(last.hand) : 'rock')); // stays after a win, moves on after anything else
  assert.ok(copycat.lost > copycat.won + 0.15, `a simple rule is seen through as well (${JSON.stringify(copycat)})`);
  const chance = play((last, mine) => rps.HANDS[Math.floor(mine() * 3)], 20000);
  assert.ok(near(chance.won, 1 / 3, 0.02) && near(chance.lost, 1 / 3, 0.02), `pure chance cannot be beaten, and does not lose either (${JSON.stringify(chance)})`);
  const fresh = rps.createMind(seeded(1));
  assert.equal(fresh.expects(), null, 'before anything was played the devil expects nothing');
});
