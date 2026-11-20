// The games of eye and hand: Stroop Test, Odd One Out, Rock Paper Scissors, the two trainers (Last Hit and
// Hold the Angle), and the sensitivity converter.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as sens from '../../js/games/sens.js';
import * as stroop from '../../js/games/stroop.js';
import * as odd from '../../js/games/odd.js';
import * as rps from '../../js/games/rps.js';
import * as lasthit from '../../js/games/lasthit.js';
import * as peek from '../../js/games/peek.js';
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

// ---------------------------------------------------------------- Last Hit
const { DAMAGE, HEALTH, CREEPS, STUMBLE } = lasthit;
// A lane in which the creeps do not hurt each other, so that only the hero's blows change anything.
function quietLane(kind = 'melee') {
  const lane = lasthit.createLane(kind, seeded(1));
  lane.step(0);
  for (const c of lane.creeps) c.wait = 999;
  return lane;
}
const run = (lane, seconds) => { for (let t = 0; t < seconds; t += 1 / 120) lane.step(1 / 120); return lane.events.splice(0).map((e) => e.kind); };

test('Last Hit: the blow that finishes a creep', () => {
  const lane = quietLane(), [foe, other] = lane.creeps.filter((c) => c.side === 'enemy'), friend = lane.creeps.find((c) => c.side === 'ally');
  assert.deepEqual([lane.creeps.filter((c) => c.side === 'enemy').length, lane.creeps.filter((c) => c.side === 'ally').length, lane.creeps.every((c) => c.hp === HEALTH)], [4, 4, true], 'the first wave: four creeps a side, all in full health');
  foe.hp = DAMAGE;
  assert.equal(lane.attack(foe.id), 'go');
  assert.equal(lane.attack(other.id), 'busy', 'one blow at a time');
  assert.deepEqual(run(lane, 0.2), [], 'the blow takes a moment to land');
  assert.deepEqual([run(lane, 0.2), lane.lastHits, foe.hp], [['lasthit'], 1, 0], 'a blow that takes the last of a creep’s health is a last hit');
  assert.equal(lane.attack(other.id), 'busy', 'then the hero needs a rest');
  run(lane, 0.6);
  // too early: the creep has more health than one blow takes
  other.hp = DAMAGE + 1;
  assert.equal(lane.attack(other.id), 'go');
  assert.deepEqual([run(lane, 0.4), other.hp, lane.lastHits], [['early'], 1, 1], 'a blow too early hurts the creep and finishes nothing');
  run(lane, STUMBLE - 0.2);
  assert.equal(lane.attack(other.id), 'busy', 'and throws the hero off balance for a while');
  run(lane, 0.3);
  assert.equal(lane.attack(other.id), 'go');
  assert.deepEqual([run(lane, 0.4), lane.lastHits], [['lasthit'], 2]);
  assert.equal(lane.attack(foe.id), 'gone', 'a creep that has fallen cannot be hit');
  // one's own creeps: only below half, and then it is a deny
  run(lane, 1);
  assert.equal(lane.attack(friend.id), 'healthy', 'a creep of one’s own side in good health is left alone');
  friend.hp = DAMAGE - 10;
  assert.equal(lane.attack(friend.id), 'go');
  assert.deepEqual([run(lane, 0.4), lane.denies, lane.lastHits], [['deny'], 1, 2], 'finishing one’s own creep is a deny, not a last hit');
});

test('Last Hit: too late, and the arrow that has to fly', () => {
  const lane = quietLane(), foe = lane.creeps.find((c) => c.side === 'enemy');
  foe.hp = 5; foe.wait = 0.1; // the other row gets there first
  lane.attack(foe.id);
  assert.deepEqual([run(lane, 0.4), lane.lastHits, lane.lost], [['died', 'late'], 0, 1], 'a creep that falls before the blow lands is lost');
  const bow = quietLane('ranged'), target = bow.creeps.find((c) => c.side === 'enemy');
  target.hp = DAMAGE;
  bow.attack(target.id);
  assert.deepEqual(run(bow, 0.5), [], 'an arrow takes longer than a sword');
  assert.deepEqual(run(bow, 0.25), ['lasthit']);
  assert.ok(lasthit.KINDS.ranged.windup + lasthit.KINDS.ranged.flight > lasthit.KINDS.melee.windup + 0.2);
});

test('Last Hit: whole games', () => {
  // three players: one who strikes the moment a creep can be finished, one who hits whatever is weakest, one who does nothing
  const play = (pick, kind = 'melee') => {
    let hits = 0, lost = 0, longest = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const lane = lasthit.createLane(kind, seeded(seed));
      let crowd = 0;
      for (let n = 0; n < 120 * 120 && !lane.over; n++) {
        const c = pick(lane.creeps.filter((x) => x.side === 'enemy' && x.hp > 0).sort((a, b) => a.hp - b.hp)[0]);
        if (c) lane.attack(c.id);
        lane.step(1 / 120);
        crowd = Math.max(crowd, ...lane.creeps.filter((x) => x.hp > 0).map((x) => x.back));
      }
      assert.ok(lane.over && lane.time > 45 && lane.time < 75, `seed ${seed}: the game ends when the last enemy creep has fallen, after about a minute (${lane.time.toFixed(0)} s)`);
      assert.equal(lane.lastHits + lane.lost, CREEPS, 'every enemy creep was either finished by the hero or lost');
      assert.ok(crowd <= 1, 'never more than two creeps stand behind one another');
      hits += lane.lastHits; lost += lane.lost; longest = Math.max(longest, lane.time);
    }
    return hits / 12;
  };
  const careful = play((c) => (c && c.hp <= DAMAGE ? c : null)), wild = play((c) => c), idle = play(() => null);
  assert.equal(CREEPS, 20);
  assert.equal(idle, 0, 'no blows, no last hits');
  assert.ok(careful > 17, `striking at the right moment gets nearly every creep (${careful.toFixed(1)} of 20)`);
  assert.ok(wild < careful - 4, `hitting away at whatever is weakest gets far fewer (${wild.toFixed(1)})`);
  const bow = play((c) => (c && c.hp <= DAMAGE ? c : null), 'ranged');
  assert.ok(bow < careful - 1 && bow > 8, `with a bow the same timing is too late more often (${bow.toFixed(1)})`);
});

// ---------------------------------------------------------------- Hold the Angle
test('Hold the Angle: a duel', () => {
  const { show, head } = peek.LEVELS.normal;
  const fresh = () => { const d = peek.createDuels('normal', seeded(3)); while (!d.enemy) d.step(1 / 60); return d; };
  let d = peek.createDuels('normal', seeded(3));
  assert.equal(d.shoot(0.5, 0.3), 'early', 'nobody there yet');
  let waited = 0;
  while (!d.enemy) { d.step(1 / 60); waited += 1 / 60; }
  assert.ok(waited > 0.7 && waited < 2.2, `the enemy shows after a wait nobody can count on (${waited.toFixed(2)} s)`);
  const e = d.enemy, body = peek.bodyOf(e);
  assert.ok(e.r === head && body.y > e.y && body.w > e.r * 2, 'a head, and a body under it');
  for (let k = 0; k < 15; k++) d.step(1 / 60); // a quarter of a second to aim
  assert.equal(d.shoot(e.x + e.r * 3, e.y - e.r * 3), 'miss', 'a shot beside the enemy hits nothing');
  assert.equal(d.shoot(e.x + e.r * 0.9, e.y), 'head');
  assert.deepEqual([d.duel, d.heads, d.times, d.enemy, d.shots, d.hits], [1, 1, [250], null, 3, 1], 'a shot in the head ends the duel, and the time since the enemy showed is kept');

  d = fresh();
  const [bx, by] = [d.enemy.x, d.enemy.y + d.enemy.r * 2.5];
  assert.equal(d.shoot(bx, by), 'body', 'the body takes a first shot');
  assert.equal(d.duel, 0, 'and the duel goes on');
  assert.equal(d.shoot(bx, by), 'down', 'and falls to the second');
  assert.deepEqual([d.duel, d.heads, d.lost], [1, 0, 0]);

  d = fresh();
  for (let t = 0; t < show + 0.05; t += 1 / 60) d.step(1 / 60);
  assert.deepEqual([d.duel, d.lost, d.times], [1, 1, [show * 1000 + peek.LOST]], 'whoever waits too long is shot, and that counts as a slow duel');
});

test('Hold the Angle: twelve duels', () => {
  for (const level of Object.keys(peek.LEVELS)) {
    const d = peek.createDuels(level, seeded(4)), places = [];
    for (let n = 0; n < 60 * 120 && !d.over; n++) {
      d.step(1 / 60);
      if (d.enemy && d.enemy.seen >= 0.2) { places.push(d.enemy.spot); d.shoot(d.enemy.x, d.enemy.y); }
    }
    assert.deepEqual([d.over, d.duel, d.heads, d.lost, d.times.length], [true, peek.DUELS, peek.DUELS, 0, peek.DUELS], `${level}: twelve duels, all won with a shot in the head`);
    assert.ok(d.average() >= 200 && d.average() <= 220, `${level}: the average is the time it took to shoot (${d.average()} ms)`);
    assert.ok(places.every((s, i) => !i || s !== places[i - 1]) && new Set(places).size >= 4, `${level}: the enemy never leans out of the same place twice running (${places})`);
    assert.equal(d.shoot(0.5, 0.3), 'early', 'after the last duel nothing can be shot');
  }
  const { normal, hard } = peek.LEVELS;
  assert.ok(hard.show < normal.show && hard.head < normal.head, 'on the hard level the enemy is smaller and quicker to shoot');
  for (const spot of peek.SPOTS) {
    assert.ok(spot.x > 0.1 && spot.x < 0.9 && spot.y > 0.2 && spot.y < 0.45 && ['left', 'right', 'up'].includes(spot.from), 'every place is in the picture, at about the height of a head');
    const body = peek.bodyOf({ ...spot, r: normal.head });
    assert.ok(body.y + body.h < 0.6, 'and the body under it fits into the picture too');
  }
  const idle = peek.createDuels('normal', seeded(5));
  for (let n = 0; n < 60 * 200 && !idle.over; n++) idle.step(1 / 60);
  assert.deepEqual([idle.over, idle.lost, idle.average()], [true, peek.DUELS, normal.show * 1000 + peek.LOST], 'a player who never shoots loses every duel');
});
