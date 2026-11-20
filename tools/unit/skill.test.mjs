// The games of eye and hand: Stroop Test, Odd One Out, Rock Paper Scissors, the three trainers (Last Hit,
// Hold the Angle and One Tap), and the sensitivity converter.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as sens from '../../js/games/sens.js';
import * as stroop from '../../js/games/stroop.js';
import * as odd from '../../js/games/odd.js';
import * as rps from '../../js/games/rps.js';
import * as lasthit from '../../js/games/lasthit.js';
import * as peek from '../../js/games/peek.js';
import * as onetap from '../../js/games/onetap.js';
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
  assert.ok(sens.GAMES.length >= 25 && ['valorant', 'cs2', 'apex', 'fortnite'].every((id) => sens.GAMES.slice(0, sens.POPULAR).includes(sens.gameOf(id))), 'the four games that were asked for come first, and there are many more');
  assert.deepEqual(sens.GAMES.slice(sens.POPULAR).map((game) => game.name), sens.GAMES.slice(sens.POPULAR).map((game) => game.name).sort((a, b) => a.localeCompare(b, 'en')), 'after the most played ones the games are in the order of the alphabet');
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

test('Sens Converter: the yaw values are the published ones', () => {
  // sensitivitymatch.com/methodology gives, beside the yaw of every game, the centimetres a full turn takes
  // at sensitivity 1 and 800 DPI. A yaw that was mistyped here would not give these. Every row of that table
  // is here under its name (the Counter-Strike ones written shorter), as a game or as one that shares a row.
  const published = {
    'Counter-Strike 2': 52, Valorant: 16.3, 'Apex Legends': 52, 'Overwatch 2': 173.2, 'Call of Duty': 173.2, Fortnite: 205.8, 'Rainbow Six Siege': 199.5,
    'Quake Champions': 52, 'Team Fortress 2': 52, 'Titanfall 2': 52, Aimlabs: 22.9, Deadlock: 52, 'Destiny 2': 173.2, 'KovaaK’s': 52, 'CS 1.6': 52, 'CS: Source': 52,
    'Left 4 Dead 2': 52, 'Garry’s Mod': 52, 'Quake Live': 52, 'Marvel Rivals': 65.3, 'THE FINALS': 1143, 'Call of Duty BO6': 173.2, 'Call of Duty MW3': 173.2,
    'Call of Duty MW2 (2022)': 173.2, 'Call of Duty BO7': 173.2, 'Half-Life 2': 52, 'Portal 2': 52, 'Left 4 Dead': 52, 'Black Mesa': 52, 'CS: Condition Zero': 52,
    'Day of Defeat: Source': 52, 'Quake III Arena': 52, Titanfall: 52, 'ARC Raiders': 839.8, Rust: 10.2, 'Battlefield 6': 282.1, 'Escape from Tarkov': 9.1,
    'Roblox RIVALS': 228.6, Roblox: 2.9, 'Halo Infinite': 51.4, 'Call of Duty MW4': 173.2, 'Half-Life': 52, 'Farlight 84': 52,
  };
  assert.equal(Object.keys(published).length, 43);
  // two names more than the table has: Warzone, which shares its row there with Call of Duty, and CS:GO, which is the Source engine as well
  assert.deepEqual(sens.NAMES.map((n) => n.name).filter((name) => !['Warzone', 'CS:GO'].includes(name)).sort(), Object.keys(published).sort(), 'every game of the published table can be picked, and nothing else');
  assert.equal(new Set(sens.NAMES.map((n) => n.name)).size, sens.NAMES.length, 'no name twice');
  assert.equal(new Set(sens.NAMES.map((n) => n.key)).size, sens.NAMES.length, 'no key twice');
  const card = sens.default.desc.match(/: (.+) and (\d+) more\.$/);
  assert.equal(card[1].split(', ').length + Number(card[2]), sens.NAMES.length, 'the card counts the games as the list does');
  for (const { name, game } of sens.NAMES) if (name in published) assert.equal(Number(sens.turn(1, game, 800).toFixed(1)), published[name], `${name}: ${published[name]} cm for a full turn`);
  assert.deepEqual(sens.NAMES.filter((n) => ['Warzone', 'CS:GO'].includes(n.name)).map((n) => n.game.id), ['cs2', 'cod']);
  assert.deepEqual(sens.NAMES.filter((n) => n.measured).map((n) => n.name).sort(), ['ARC Raiders', 'Battlefield 6', 'Call of Duty BO7', 'Call of Duty MW4', 'Escape from Tarkov', 'Farlight 84', 'Halo Infinite', 'Marvel Rivals', 'Roblox', 'Roblox RIVALS', 'Rust', 'THE FINALS'], 'the twelve that the page calls community-measured say so');
  assert.ok(sens.NAMES.every((n) => !/≈/.test(n.name) && !/≈/.test(n.key)), 'the mark is not part of a name');
  const to = (value, from, game) => sens.show(sens.convert(value, sens.gameOf(from), sens.gameOf(game)), sens.gameOf(game));
  assert.deepEqual([to(0.4, 'valorant', 'rivals'), to(1.5, 'cs2', 'finals'), to(2, 'cs2', 'deadlock'), to(1, 'cs2', 'aimlabs')], ['1.6', '33', '2', '0.44'], 'Valorant times four in Marvel Rivals, Counter-Strike times 22 in THE FINALS');
});

test('Sens Converter: the search box', () => {
  const found = (text) => sens.find(text).map((game) => game.id);
  assert.equal(found('').length, sens.GAMES.length, 'nothing typed: every game');
  for (const [text, ids] of [
    ['val', ['valorant']], ['VALORANT', ['valorant']], ['apex legends', ['apex']], ['legends apex', ['apex']],
    ['csgo', ['cs2']], ['cs go', ['cs2']], ['CS:GO', ['cs2']], ['cs2', ['cs2']], ['counter-strike', ['cs2']], ['counterstrike', ['cs2']], ['1.6', ['cs2']], ['condition zero', ['cs2']],
    ['source', ['cs2', 'dods']], ['warzone', ['cod']], ['black ops', ['cod']], ['mw3', ['cod']], ['cod', ['cod']], ['r6', ['r6']], ['six siege', ['r6']],
    ['left 4', ['l4d2']], ['l4d', ['l4d2']], ['half-life', ['halflife']], ['black mesa', ['halflife']], ['quake', ['quake']], ['quake 3', ['quake']], ['titanfall', ['titanfall']],
    ['kovaaks', ['kovaaks']], ['kovaak’s', ['kovaaks']], ['garrys mod', ['gmod']], ['gmod', ['gmod']], ['tf2', ['tf2']], ['aim lab', ['aimlabs']], ['riv', ['rivals', 'robloxrivals']], ['roblox', ['roblox', 'robloxrivals']],
    ['eft', ['tarkov']], ['ow', ['overwatch']], ['the finals', ['finals']], ['zzz', []], ['valorant apex', []],
  ]) assert.deepEqual(found(text), ids, `“${text}”`);
  // a typed word has to begin a word of the name: no Left 4 Dead for "eft", no Rainbow for "ow"
  for (const game of sens.GAMES) for (const name of [game.name, ...(game.same || [])]) assert.ok(found(name).includes(game.id), `${name} is found by its own name`);
  // the games that were left out on purpose get a word of explanation instead of "nothing found"
  assert.deepEqual(['pubg', 'PUBG Mobile', 'battlegrounds', 'paladins', 'minecraft java', 'delta force', 'delta'].map((text) => sens.missing(text)?.name), ['PUBG', 'PUBG', 'PUBG', 'Paladins', 'Minecraft', 'Delta Force', 'Delta Force']);
  assert.deepEqual(['', 'pu', 'zzz', 'valorant', 'cs'].map((text) => sens.missing(text)), [undefined, undefined, undefined, undefined, undefined], 'and only those');
  for (const m of sens.MISSING) assert.ok(found(m.name).length === 0 && m.why.length > 10 && !/[.!]$/.test(m.why), `${m.name}: not among the games, and a reason that fits into the sentence`);
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

// ---------------------------------------------------------------- One Tap
const WIDTHS = Object.keys(onetap.WIDTHS), SPEEDS = Object.keys(onetap.SPEEDS);
const MS = 0.001;
// Lets time pass a millisecond at a time until `until` says so (or the round is over), and says how long that took.
function wait(d, until, limit = 600) {
  let t = 0;
  while (!d.over && !until(d) && t < limit) { d.step(MS); t += MS; }
  return t;
}
// A whole round. `fire` looks at the game every millisecond and says whether to pull the trigger.
function round(d, fire) {
  let t = 0;
  while (!d.over && t < 600) { d.step(MS); t += MS; if (fire(d)) d.shoot(); }
  assert.ok(d.over, 'the round ends');
  return d;
}

test('One Tap: the settings', () => {
  const g = onetap.default;
  assert.deepEqual([WIDTHS, SPEEDS], [['narrow', 'medium', 'wide'], ['slow', 'normal', 'fast', 'hell']]);
  assert.deepEqual(Object.keys(g.variants), WIDTHS.flatMap((w) => SPEEDS.map((s) => `${w}-${s}`)), 'every width with every speed, each with a best score of its own');
  assert.deepEqual([g.variants['narrow-hell'], g.variants['wide-slow'], g.variants[g.defaultVariant()]], ['Narrow · Hell', 'Wide · Slow', 'Medium · Normal']);
  // what a combination leaves: less with a narrower gap, less with more speed
  for (const s of SPEEDS) for (let k = 1; k < WIDTHS.length; k++) assert.ok(onetap.timing(WIDTHS[k], s).warning > onetap.timing(WIDTHS[k - 1], s).warning * 1.25, `${s}: a wider gap gives more warning`);
  for (const w of WIDTHS) for (let k = 1; k < SPEEDS.length; k++) {
    const slow = onetap.timing(w, SPEEDS[k - 1]), fast = onetap.timing(w, SPEEDS[k]);
    assert.ok(fast.warning < slow.warning * 0.8 && fast.open < slow.open * 0.8, `${w}: more speed gives less warning and less time on the sights`);
  }
  const whole = ({ warning, open }) => [Math.round(warning), Math.round(open)];
  assert.deepEqual([whole(onetap.timing('wide', 'slow')), whole(onetap.timing('medium', 'normal')), whole(onetap.timing('narrow', 'hell'))], [[914, 143], [445, 91], [162, 48]], 'from plenty of time to a reflex');
  for (const w of WIDTHS) for (const s of SPEEDS) {
    const { warning, open } = onetap.timing(w, s);
    assert.ok(warning >= 150 && open >= 45, `${w}, ${s}: never less than a quick reflex, and three pictures of a screen (${Math.round(warning)} ms, then ${Math.round(open)} ms)`);
    // the game itself keeps to those numbers
    const d = onetap.createCrossing(w, s, seeded(3));
    assert.ok(near(d.perfect * 1000, warning + open / 2, 1e-6), 'the best moment is the middle of the time the head is on the sights');
    for (let k = 0; k < 4; k++) {
      wait(d, (x) => x.runner);
      const shown = wait(d, (x) => !x.runner || Math.abs(x.runner.s) <= 0.5), on = wait(d, (x) => !x.runner || Math.abs(x.runner.s) > 0.5);
      assert.ok(near(shown * 1000, warning, 2), `${w}, ${s}: ${Math.round(shown * 1000)} ms from the first glimpse to the head on the sights`);
      assert.ok(near(on * 1000, open, 2), `${w}, ${s}: the head is on the sights for ${Math.round(on * 1000)} ms`);
      wait(d, (x) => !x.runner);
    }
  }
});

test('One Tap: the head and the moment', () => {
  for (const w of WIDTHS) for (const s of SPEEDS) {
    const v = onetap.SPEEDS[s], gap = onetap.WIDTHS[w];
    // a runner that is shot at when the middle of its head is at `where`
    const shot = (where) => {
      const d = onetap.createCrossing(w, s, seeded(5));
      wait(d, (x) => x.runner);
      assert.equal(d.runner.s, -(gap / 2 + onetap.AHEAD) + (d.runner.t * v), 'it starts just out of sight and runs at its speed');
      d.step((where - d.runner.s) / v);
      const n = d.n, answer = d.shoot();
      return { d, n, answer, result: d.results.at(-1), event: d.events.at(-1) };
    };
    for (const [where, kind] of [[0, 'head'], [-0.49, 'head'], [0.49, 'head'], [-0.51, 'early'], [0.51, 'late'], [-2, 'early'], [2, 'late']]) {
      const { d, n, answer, result, event } = shot(where);
      assert.equal(answer, kind === 'head' ? 'head' : 'miss', `${w}, ${s}: a shot with the head at ${where}`);
      assert.deepEqual([result.kind, result.seen], [kind, true]);
      assert.ok(near(result.ms, where / v * 1000, 1), `${w}, ${s}: ${result.ms} ms off the best moment at ${where}`);
      assert.ok(near(event.s, where, 1e-9) && [1, -1].includes(event.dir) && event.kind === kind, 'the picture is told where the head was');
      if (kind === 'head') assert.deepEqual([d.heads, d.runner, d.n], [1, null, n + 1], 'a head counts, and the runner is gone');
      else {
        assert.deepEqual([d.heads, d.n, d.loaded], [0, n, false], 'a miss counts for nothing, and the bullet is gone');
        const still = d.runner;
        wait(d, (x) => x.runner !== still);
        assert.deepEqual([d.n, d.results.length, d.heads], [n + 1, n + 1, 0], 'whoever was missed gets away, and that is all that is noted about it');
      }
    }
  }
});

test('One Tap: one bullet for each runner', () => {
  const d = onetap.createCrossing('medium', 'normal', seeded(11));
  assert.deepEqual([d.loaded, d.runner, d.n, d.over], [true, null, 0, false], 'the first bullet is in before anybody comes');
  // nobody fires: the runner comes and goes
  wait(d, (x) => x.runner);
  wait(d, (x) => !x.runner);
  assert.deepEqual([d.n, d.results, d.events.map((e) => e.kind), d.shots], [1, [{ kind: 'none', ms: null, seen: true }], ['none'], 0], 'no shot: it gets away');
  // straight after a runner the next bullet is not in yet: a second click does no harm
  assert.deepEqual([d.loaded, d.shoot(), d.shots, d.results.length], [false, 'empty', 0, 1], 'a click right after a runner is no shot');
  const reload = wait(d, (x) => x.loaded);
  assert.ok(near(reload, onetap.RELOAD, 0.002) && !d.runner, `the next bullet is in after ${reload.toFixed(2)} s, before the next runner shows`);
  // a shot into the empty gap: the bullet is gone, and the one who comes next cannot be stopped
  const early = d.wait + d.perfect;
  assert.deepEqual([d.shoot(), d.loaded, d.shots, d.results.length], ['miss', false, 1, 2]);
  const wasted = d.results[1];
  assert.deepEqual([wasted.kind, wasted.seen, d.events.at(-1).s], ['early', false, null], 'fired before anybody showed');
  assert.ok(near(wasted.ms, -early * 1000, 1) && wasted.ms < -500, `it says by how much: ${wasted.ms} ms`);
  wait(d, (x) => x.runner);
  d.step((0 - d.runner.s) / d.v);
  assert.deepEqual([Math.abs(d.runner.s) < 1e-9, d.shoot(), d.shoot(), d.shots, d.heads], [true, 'empty', 'empty', 1, 0], 'with the head on the sights and no bullet left');
  wait(d, (x) => !x.runner);
  assert.deepEqual([d.n, d.results.length], [2, 2], 'one note for every runner, never two');
  // and one who is shot at twice
  wait(d, (x) => x.runner);
  assert.deepEqual([d.shoot(), d.shoot(), d.shots], ['miss', 'empty', 2], 'the second click at the same runner is no shot');
  assert.equal(d.results.at(-1).kind, 'early');
  // the average is taken over the shots at somebody in sight: the one into the empty gap is left out, and so is the runner nobody fired at
  assert.equal(d.offset(), d.results.at(-1).ms);
  assert.equal(onetap.createCrossing().offset(), null, 'no shot, no average');
});

test('One Tap: who comes', () => {
  let runners = 0, left = 0;
  for (const w of WIDTHS) for (const s of SPEEDS) for (const k of [1, 2, 3, 4]) {
    const seed = WIDTHS.indexOf(w) * 100 + SPEEDS.indexOf(s) * 10 + k; // a round of its own for every setting
    const d = onetap.createCrossing(w, s, seeded(seed)), v = onetap.SPEEDS[s], gap = onetap.WIDTHS[w], hidden = gap / 2 + onetap.AHEAD, sides = [];
    while (!d.over) {
      const n = d.n, pause = d.wait;
      assert.ok(pause >= 0.8 && pause <= 2.6 && pause > onetap.RELOAD + 0.3, `${w}, ${s}: a pause of ${pause.toFixed(2)} s, long enough for the next bullet`);
      assert.ok(near(wait(d, (x) => x.runner), pause, 0.002), 'the runner shows when the pause is over');
      const r = d.runner;
      assert.ok(near(r.s, -hidden, v * MS * 1.01) && [1, -1].includes(r.dir), 'it sets off just out of sight, from the left or from the right');
      sides.push(r.dir); runners++; if (r.dir === 1) left++;
      let far = r.s, t = 0;
      while (d.runner === r) { assert.ok(r.s >= far, 'it never turns back'); far = r.s; d.step(MS); t += MS; }
      assert.ok(near(far, gap / 2 + onetap.BEHIND, v * MS * 1.01), `${w}, ${s}: it runs across, until all of it is behind the other wall (${far.toFixed(2)})`);
      assert.ok(near(t, (gap + onetap.AHEAD + onetap.BEHIND) / v, 0.003), `${w}, ${s}: which takes ${t.toFixed(2)} s`);
      assert.deepEqual([d.n, d.results.at(-1).kind], [n + 1, 'none']);
    }
    assert.deepEqual([d.n, d.results.length, d.runner, d.heads], [onetap.RUNNERS, onetap.RUNNERS, null, 0], 'twenty runners, then the round is over');
    assert.deepEqual([d.shoot(), d.shots], ['empty', 0], 'nothing to shoot at after the round');
    assert.ok(sides.every((side, i) => i < 3 || !(side === sides[i - 1] && side === sides[i - 2] && side === sides[i - 3])), `${w}, ${s}, ${seed}: never four in a row from the same side (${sides.join(' ')})`);
    if (seed === 1) assert.ok(sides.some((side, i) => i > 1 && side === sides[i - 1] && side === sides[i - 2]), 'but three times running does happen');
  }
  assert.ok(left / runners > 0.42 && left / runners < 0.58, `as many from the left as from the right (${left} of ${runners})`);
});

test('One Tap: whole rounds', () => {
  const all = (kind) => (d) => d.results.every((r) => r.kind === kind && r.seen);
  for (const w of WIDTHS) for (const s of SPEEDS) {
    // somebody who fires with the head in the middle of the sights
    const d = round(onetap.createCrossing(w, s, seeded(21)), (x) => x.loaded && x.runner && Math.abs(x.runner.s) <= 0.02);
    assert.deepEqual([d.heads, d.shots, all('head')(d)], [onetap.RUNNERS, onetap.RUNNERS, true], `${w}, ${s}: whoever fires at the right moment gets all twenty`);
    assert.ok(Math.abs(d.offset()) <= 3, `${w}, ${s}: on average ${d.offset()} ms off`);
    // somebody who fires at the first glimpse, and somebody who waits too long
    const jumpy = round(onetap.createCrossing(w, s, seeded(21)), (x) => x.loaded && x.runner);
    assert.ok(jumpy.heads === 0 && all('early')(jumpy) && near(jumpy.offset(), -jumpy.perfect * 1000, 2), `${w}, ${s}: a shot at the first glimpse is always too early (${jumpy.offset()} ms)`);
    const sleepy = round(onetap.createCrossing(w, s, seeded(21)), (x) => x.loaded && x.runner && x.runner.s >= 0.8);
    assert.ok(sleepy.heads === 0 && all('late')(sleepy) && near(sleepy.offset(), 0.8 / onetap.SPEEDS[s] * 1000, 2), `${w}, ${s}: and one behind the head too late (${sleepy.offset()} ms)`);
  }
  // Somebody who needs a quarter of a second to see a runner and to click, and from then on fires when the head
  // is where the sights are: there is time for that everywhere but at the narrow gap in hell, which takes a reflex.
  const human = (w, s, delay) => {
    const d = onetap.createCrossing(w, s, seeded(21));
    let t = 0, since = null;
    while (!d.over) {
      d.step(MS); t += MS;
      if (!d.runner) { since = null; continue; }
      if (since === null) since = t;
      if (d.loaded && t - since >= delay && Math.abs(d.runner.s) <= 0.3) d.shoot();
    }
    return d.heads;
  };
  for (const w of WIDTHS) for (const s of SPEEDS) assert.equal(human(w, s, 0.25), w === 'narrow' && s === 'hell' ? 0 : onetap.RUNNERS, `${w}, ${s}: with a quarter of a second to react`);
  assert.equal(human('narrow', 'hell', 0.18), onetap.RUNNERS, 'the narrow gap in hell takes a reflex of less than a fifth of a second');
});

test('One Tap: the same on any screen', () => {
  // The moments of the shots are taken from a round played a millisecond at a time: some too early, some in
  // time, some too late. Played again in steps as long as the pictures of a screen (and stepped up to the very
  // moment of each shot, as the page does it), every shot does the same.
  const aims = [-0.7, -0.3, 0.3, 0.45, 0.7];
  for (const [w, s] of [['narrow', 'hell'], ['medium', 'normal'], ['wide', 'fast']]) {
    const model = onetap.createCrossing(w, s, seeded(8)), shots = [];
    let t = 0;
    while (!model.over) { model.step(MS); t += MS; if (model.loaded && model.runner && model.runner.s >= aims[model.n % aims.length]) { shots.push(t); model.shoot(); } }
    assert.deepEqual([model.heads, shots.length, model.results.slice(0, 5).map((r) => r.kind)], [12, onetap.RUNNERS, ['early', 'head', 'head', 'head', 'late']], `${w}, ${s}: a round to compare with`);
    for (const frame of [1 / 30, 1 / 60, 1 / 144, 0.05]) {
      const d = onetap.createCrossing(w, s, seeded(8)), todo = [...shots];
      let now = 0;
      while (!d.over && now < 600) {
        const next = now + frame;
        while (todo.length && todo[0] <= next) { d.step(todo[0] - now); now = todo.shift(); d.shoot(); }
        d.step(next - now); now = next;
      }
      assert.deepEqual(d.results.map((r) => r.kind), model.results.map((r) => r.kind), `${w}, ${s}: the same round at ${Math.round(1 / frame)} pictures a second`);
      assert.ok(d.results.every((r, i) => near(r.ms, model.results[i].ms, 1)), 'with the same milliseconds');
    }
  }
});
