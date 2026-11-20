// Chess and Durak. (Rock Paper Scissors is in skill.test.mjs, Blackjack in casino.test.mjs.)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as chess from '../../js/chess.js';
import * as durak from '../../js/games/durak.js';
import { deckOf } from '../../js/cards.js';
import { seeded } from './seeded.mjs';

// ---------------------------------------------------------------- Chess
// A clock of the test's own, so that the computer plays the same on a fast machine and on a slow one:
// it moves on by four milliseconds every time it is looked at, which is once in a thousand positions.
const steady = () => { let t = 0; return () => (t += 4); };
const at = chess.squareOf;
// Finds the legal move that is written this way ("Nf3", "exd5", "O-O") and plays it.
function go(p, ...texts) {
  for (const text of texts) {
    const m = chess.legalMoves(p).find((x) => chess.notation(p, x) === text);
    assert.ok(m, `${text} is a legal move in ${chess.toFEN(p)}`);
    chess.play(p, m);
  }
  return p;
}
const written = (p) => chess.legalMoves(p).map((m) => chess.notation(p, m)).sort();

test('Chess: the number of ways to play on from well-known positions', () => {
  // The standard check of a move generator: these counts are published, and one wrong rule changes them.
  const cases = [
    ['the starting position', chess.START, [20, 400, 8902, 197281]],
    ['castling, pins and discovered checks', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
    ['taking in passing that would uncover a check', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
    ['promotions on both sides', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
    ['a pawn that promotes with a capture', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
    ['a quiet middlegame', 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', [46, 2079, 89890]],
  ];
  for (const [name, fen, counts] of cases) {
    const p = chess.fromFEN(fen);
    assert.deepEqual(counts.map((_, depth) => chess.perft(p, depth + 1)), counts, name);
    assert.equal(chess.toFEN(p), fen, `${name}: playing moves and taking them back leaves the position as it was`);
  }
});

test('Chess: positions are written down and read back', () => {
  assert.equal(chess.toFEN(chess.fromFEN()), chess.START);
  const p = go(chess.fromFEN(), 'e4', 'c5', 'Nf3');
  assert.equal(chess.toFEN(p), 'rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2');
  assert.deepEqual([at('a8'), at('h8'), at('a1'), at('h1'), at('e4')], [0, 7, 56, 63, 36]);
  assert.deepEqual([0, 7, 56, 63, 36].map(chess.squareName), ['a8', 'h8', 'a1', 'h1', 'e4']);
  assert.equal(chess.toFEN(go(chess.fromFEN(), 'e4')).split(' ')[3], 'e3', 'the square a pawn has jumped over is noted');
});

test('Chess: castling', () => {
  const ready = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';
  assert.ok(written(chess.fromFEN(ready)).includes('O-O') && written(chess.fromFEN(ready)).includes('O-O-O'), 'both ways when nothing stands between king and rook');
  assert.equal(chess.toFEN(go(chess.fromFEN(ready), 'O-O')).split(' ')[0], 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R4RK1', 'short: the king goes to g1, the rook to f1');
  assert.equal(chess.toFEN(go(chess.fromFEN(ready), 'O-O-O')).split(' ')[0], 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/2KR3R', 'long: the king goes to c1, the rook to d1');
  assert.equal(chess.toFEN(go(chess.fromFEN(ready), 'O-O')).split(' ')[2], 'kq', 'after castling White may not castle again');
  assert.equal(chess.toFEN(go(chess.fromFEN(ready), 'Rg1', 'Rb8', 'Rh1', 'Ra8')).split(' ')[2], 'Qk', 'a rook that has moved cannot castle, even when it is back');
  assert.equal(chess.toFEN(go(chess.fromFEN(ready), 'Kf1', 'Kd8')).split(' ')[2], '-', 'nor a king that has moved');
  const none = (fen, why) => assert.ok(!written(chess.fromFEN(fen)).some((t) => t.startsWith('O-O')), why);
  none('r3k2r/8/8/8/4r3/8/8/R3K2R w KQkq - 0 1', 'not out of check');
  assert.deepEqual(written(chess.fromFEN('r3k2r/8/8/8/5r2/8/8/R3K2R w KQkq - 0 1')).filter((t) => t.startsWith('O')), ['O-O-O'], 'not across a square that is attacked');
  assert.deepEqual(written(chess.fromFEN('r3k2r/8/8/8/1r6/8/8/R3K2R w KQkq - 0 1')).filter((t) => t.startsWith('O')), ['O-O', 'O-O-O'], 'but the rook may cross one');
  none('r3k2r/8/8/8/8/8/8/RN2KB1R w KQkq - 0 1', 'not with a piece in between');
  assert.equal(chess.toFEN(go(chess.fromFEN('r3k2r/8/8/8/8/8/6B1/R3K2R w KQkq - 0 1'), 'Bxa8')).split(' ')[2], 'KQk', 'a rook that is taken on its corner takes its right to castle with it');
});

test('Chess: pawns', () => {
  const p = go(chess.fromFEN(), 'e4', 'a6', 'e5', 'd5');
  assert.ok(written(p).includes('exd6'), 'a pawn that jumps past another may be taken in passing');
  assert.equal(chess.toFEN(go(p, 'exd6')).split(' ')[0], 'rnbqkbnr/1pp1pppp/p2P4/8/8/8/PPPP1PPP/RNBQKBNR', 'the pawn that jumped is gone');
  const late = go(chess.fromFEN(), 'e4', 'a6', 'e5', 'd5', 'h3', 'h6');
  assert.ok(!written(late).includes('exd6'), 'but only at once');
  const last = chess.fromFEN('3n4/4P3/8/8/8/8/k7/7K w - - 0 1');
  assert.deepEqual(written(last).filter((t) => t.includes('=')), ['e8=B', 'e8=N', 'e8=Q', 'e8=R', 'exd8=B', 'exd8=N', 'exd8=Q', 'exd8=R'].sort(), 'on the last row a pawn becomes a queen, a rook, a bishop or a knight');
  assert.equal(chess.toFEN(go(last, 'e8=N')).split(' ')[0], '3nN3/8/8/8/8/8/k7/7K');
  assert.deepEqual(written(chess.fromFEN('8/8/8/8/8/4p3/4P3/K6k w - - 0 1')).filter((t) => t.startsWith('e')), [], 'a blocked pawn does not move');
});

test('Chess: how a game ends', () => {
  const mate = go(chess.fromFEN(), 'f3', 'e5', 'g4', 'Qh4#');
  assert.equal(chess.standing(mate), 'mate', 'the fool’s mate');
  assert.equal(chess.legalMoves(mate).length, 0);
  assert.equal(chess.standing(chess.fromFEN('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')), 'stalemate', 'no move and no check');
  assert.equal(chess.standing(go(chess.fromFEN(), 'e4', 'e5', 'Qh5', 'Nc6', 'Qxf7+')), 'check');
  assert.equal(chess.standing(chess.fromFEN()), '');
  assert.equal(chess.standing(chess.fromFEN('4k3/8/8/8/8/8/4R3/4K3 w - - 100 80')), 'fifty', 'fifty moves each without a pawn move or a capture');
  assert.equal(chess.standing(chess.fromFEN('4k3/8/8/8/8/8/4R3/4K3 w - - 99 80')), '');
  // the knights go out and back, twice: the starting position stands for the third time
  const p = chess.fromFEN(), seen = [chess.positionKey(p)];
  for (const text of ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1']) { go(p, text); seen.push(chess.positionKey(p)); assert.equal(chess.standing(p, seen), '', 'not yet'); }
  go(p, 'Ng8'); seen.push(chess.positionKey(p));
  assert.equal(chess.standing(p, seen), 'repeat', 'the same position for the third time');
  const bare = (fen) => chess.standing(chess.fromFEN(fen)) === 'bare';
  assert.ok(bare('4k3/8/8/8/8/8/8/4K3 w - - 0 1') && bare('4k3/8/8/8/8/8/8/4KB2 w - - 0 1') && bare('4k1n1/8/8/8/8/8/8/4K3 w - - 0 1'), 'two kings, alone or with one knight or bishop, cannot win');
  assert.ok(bare('4kb2/8/8/8/8/8/8/4K1B1 w - - 0 1'), 'nor with bishops that stand on the same colour');
  assert.ok(!bare('4kb2/8/8/8/8/8/8/4KB2 w - - 0 1') && !bare('4k3/8/8/8/8/8/8/4KNN1 w - - 0 1') && !bare('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1') && !bare('4k3/8/8/8/8/8/8/4KR2 w - - 0 1'), 'anything more is enough to play on');
});

test('Chess: how moves are written', () => {
  assert.deepEqual(written(chess.fromFEN()), ['Na3', 'Nc3', 'Nf3', 'Nh3', 'a3', 'a4', 'b3', 'b4', 'c3', 'c4', 'd3', 'd4', 'e3', 'e4', 'f3', 'f4', 'g3', 'g4', 'h3', 'h4'].sort());
  const twins = chess.fromFEN('4k3/8/8/8/8/8/8/RN1K1N1R w - - 0 1');
  assert.ok(written(twins).includes('Nbd2') && written(twins).includes('Nfd2'), 'two knights that can go to one square are told apart by their file');
  const stacked = chess.fromFEN('7k/8/R7/8/8/8/8/R3K3 w - - 0 1');
  assert.ok(written(stacked).includes('R1a4') && written(stacked).includes('R6a4'), 'and two rooks on one file by their row');
  assert.ok(written(chess.fromFEN('8/7k/8/8/8/2Q1Q3/8/K1Q5 w - - 0 1')).includes('Qc3e1'), 'and by both when neither is enough');
  assert.ok(written(chess.fromFEN('3n4/4P3/8/8/8/8/7k/K7 w - - 0 1')).includes('e8=Q') && written(chess.fromFEN('3n3k/4P3/8/8/8/8/8/K7 w - - 0 1')).includes('exd8=Q+'), 'a pawn that becomes a queen, and gives check with it');
  assert.ok(written(go(chess.fromFEN(), 'e4', 'd5')).includes('exd5'), 'a pawn that takes names its file');
  assert.ok(written(chess.fromFEN('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1')).includes('Ra8#'), 'mate is marked');
});

test('Chess: the computer sees what is in front of it', () => {
  const pick = (fen, level, seed = 1) => { const p = chess.fromFEN(fen); return chess.notation(p, chess.bestMove(p, level, seeded(seed), steady())); };
  for (const level of Object.keys(chess.LEVELS)) {
    assert.equal(pick('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', level), 'Ra8#', `${level}: mate in one on the back row`);
    assert.equal(pick('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', level), 'Qxf7#', `${level}: the scholar’s mate`);
    assert.equal(pick('rnb1kbnr/pppp1ppp/8/4p1q1/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3', level), 'Bxg5', `${level}: a queen left unguarded is taken`);
    assert.equal(chess.bestMove(chess.fromFEN('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'), level, seeded(1), steady()), null, `${level}: no move where there is none`);
  }
  for (const level of ['normal', 'hard']) for (const seed of [1, 2, 3]) {
    const reply = pick('rnbqkbnr/pppp1ppp/8/4p3/4P3/5Q2/PPPP1PPP/RNB1KBNR b KQkq - 1 2', level, seed);
    assert.ok(!['Qh4', 'Qg5', 'Ba3', 'Nh6'].includes(reply) || reply === 'Nh6', `${level}: no piece is thrown away (${reply})`);
    const p = go(chess.fromFEN('rnbqkbnr/pppp1ppp/8/4p3/4P3/5Q2/PPPP1PPP/RNB1KBNR b KQkq - 1 2'), reply);
    assert.ok(!written(p).includes('Qxf7#'), `${level}: the mate on f7 is seen and stopped (${reply})`);
  }
  // king and queen against a bare king: the hard level mates in two moves from here, whatever Black does
  const p = chess.fromFEN('7k/8/5K2/8/8/8/8/1Q6 w - - 0 1');
  chess.play(p, chess.bestMove(p, 'hard', seeded(1), steady()));
  for (const answer of chess.legalMoves(p)) {
    const undo = chess.play(p, answer), m = chess.bestMove(p, 'hard', seeded(1), steady());
    assert.ok(chess.notation(p, m).endsWith('#'), 'mate in two is found');
    chess.unplay(p, answer, undo);
  }
});

test('Chess: every level beats the one below it', () => {
  function game(white, black, seed) {
    const p = chess.fromFEN(), rnd = seeded(seed), seen = [chess.positionKey(p)];
    for (let n = 0; n < 240; n++) {
      const state = chess.standing(p, seen);
      if (state && state !== 'check') return state === 'mate' ? (p.white ? 'black' : 'white') : state;
      chess.play(p, chess.bestMove(p, p.white ? white : black, rnd, steady())); seen.push(chess.positionKey(p));
    }
    return 'unfinished';
  }
  assert.deepEqual([game('normal', 'easy', 1), game('easy', 'normal', 2), game('normal', 'easy', 3)], ['white', 'black', 'white'], 'normal against easy, with either colour');
  const { easy, normal, hard } = chess.LEVELS;
  assert.ok(easy.depth < normal.depth && normal.depth < hard.depth && easy.blur > normal.blur && normal.blur > hard.blur, 'each level looks further ahead and misjudges less');
  assert.equal(chess.evaluate(chess.fromFEN()), 0, 'the starting position is even');
  assert.equal(chess.evaluate(chess.fromFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBN1 w Qkq - 0 1')), chess.evaluate(chess.fromFEN('rnbqkbn1/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQq - 0 1')), 'a rook down is as bad for White as for Black');
  assert.equal(chess.evaluate(chess.fromFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBN1 w Qkq - 0 1')), -chess.evaluate(chess.fromFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBN1 b Qkq - 0 1')), 'and what is bad for the one is as good for the other');
  assert.ok(chess.evaluate(chess.fromFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBN1 w Qkq - 0 1')) < -400);
});

// ---------------------------------------------------------------- Durak
const SUIT = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' };
const card = (name) => ({ rank: name.slice(0, -1), suit: SUIT[name.slice(-1)] });
const names = (cards) => cards.map((c) => c.rank + c.suit[0]).join(' ');
// A game with the cards the test wants. Player 0 is "me", player 1 the devil.
function table({ trump = 'hearts', mine, devil, deck = [], attacker = 0 }) {
  const g = durak.createGame(seeded(1));
  Object.assign(g, { trump, hands: [mine.map(card), devil.map(card)], deck: deck.map(card), table: [], attacker, turn: attacker, taking: false });
  g.limit = Math.min(durak.HAND, g.hands[1 - attacker].length);
  return g;
}
const can = (g, p) => g.options(p).map((o) => (o.card ? `${o.type} ${o.card.rank}${o.card.suit[0]}` : o.type));
const play = (g, p, what) => { const [type, name] = what.split(' '); return g.act(p, name ? { type, card: card(name) } : { type }); };

test('Durak: which card beats which', () => {
  const beats = (a, b, trump = 'hearts') => durak.beats(card(a), card(b), trump);
  assert.equal(beats('9s', '7s'), true, 'a higher card of the same suit');
  assert.equal(beats('7s', '9s'), false, 'not a lower one');
  assert.equal(beats('As', '6c'), false, 'not a card of another plain suit, however high');
  assert.equal(beats('6h', 'As'), true, 'the smallest trump beats any plain card');
  assert.equal(beats('As', '6h'), false, 'and no plain card beats a trump');
  assert.equal(beats('Jh', '9h') && !beats('9h', 'Jh'), true, 'among trumps the higher one wins');
  assert.equal(beats('10s', '9s') && beats('Js', '10s') && beats('As', 'Ks'), true, 'ten is above nine, the ace above all');
  assert.ok(durak.worth(card('6h'), 'hearts') > durak.worth(card('As'), 'hearts'), 'any trump is dearer than any plain card');
});

test('Durak: the deal', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const g = durak.createGame(seeded(seed)), all = [...g.deck, ...g.hands[0], ...g.hands[1]];
    assert.deepEqual([g.hands[0].length, g.hands[1].length, g.deck.length], [6, 6, 24], 'six cards each out of thirty-six');
    assert.equal(new Set(all.map((c) => c.rank + c.suit)).size, 36, 'every card once');
    assert.equal(g.trump, g.deck[0].suit, 'the card at the bottom of the deck names the trump');
    const lowest = (p) => Math.min(...g.hands[p].filter((c) => c.suit === g.trump).map((c) => durak.RANKS.indexOf(c.rank)), 99);
    assert.equal(g.attacker, lowest(1) < lowest(0) ? 1 : 0, `seed ${seed}: whoever holds the lowest trump leads`);
    assert.deepEqual([g.turn, g.table.length, g.over], [g.attacker, 0, false]);
  }
  assert.equal(deckOf(durak.RANKS, seeded(1)).length, 36);
});

test('Durak: a bout that is beaten', () => {
  const g = table({ mine: ['7s', '7c', '9d', 'Ks'], devil: ['8s', '9c', '6h', 'Ad'], deck: ['6s', '6c', '6d', '8h'] });
  assert.deepEqual(can(g, 0), ['attack 7s', 'attack 7c', 'attack 9d', 'attack Ks'], 'the attacker leads any card; with nothing on the table there is nothing to be done with');
  assert.deepEqual(can(g, 1), [], 'the other one waits');
  assert.equal(play(g, 1, 'attack 8s'), false, 'and cannot play out of turn');
  assert.equal(play(g, 0, 'attack 7s'), true);
  assert.deepEqual(can(g, 1), ['defend 8s', 'defend 6h', 'take'], 'the defender beats the seven with a higher spade or a trump, or takes');
  assert.equal(play(g, 1, 'defend 9c'), false, 'a card that does not beat it is refused');
  play(g, 1, 'defend 8s');
  assert.deepEqual(can(g, 0), ['attack 7c', 'done'], 'now only ranks that are on the table may be thrown in: the other seven, but no nine or king');
  play(g, 0, 'attack 7c');
  play(g, 1, 'defend 9c');
  assert.deepEqual(can(g, 0), ['attack 9d', 'done'], 'the nine that beat the seven lets a nine in');
  assert.equal(g.stuck(), false);
  play(g, 0, 'done');
  assert.deepEqual([g.table.length, g.gone, g.attacker, g.turn], [0, 4, 1, 1], 'beaten: the four cards are out of the game and the defender leads next');
  assert.deepEqual([names(g.hands[0]), names(g.hands[1]), names(g.deck)], ['9d Ks 8h 6d 6c 6s', '6h Ad', ''], 'the one who attacked draws first, up to six cards, and here that leaves nothing for the other');
  const even = table({ mine: ['7s', '9d', 'Ks', 'Kc', 'Kd'], devil: ['8s', '9c', '6h', 'Ad', 'Ac'], deck: ['6s', '6c', '6d', '8h'] });
  play(even, 0, 'attack 7s'); play(even, 1, 'defend 8s'); play(even, 0, 'done');
  assert.deepEqual([names(even.hands[0]), names(even.hands[1]), names(even.deck)], ['9d Ks Kc Kd 8h 6d', '9c 6h Ad Ac 6c 6s', ''], 'with enough cards in the deck both hands are filled up to six');
});

test('Durak: a bout that is taken', () => {
  const g = table({ mine: ['7s', '7c', '7d', 'Ks'], devil: ['6s', '9c', '10d'], deck: ['6c', '6d', '8h', '9h'] });
  assert.equal(g.limit, 3, 'no more cards are led than the defender holds');
  play(g, 0, 'attack 7s');
  assert.deepEqual(can(g, 1), ['take'], 'nothing in the hand beats the seven of spades');
  play(g, 1, 'take');
  assert.deepEqual([g.taking, g.turn, can(g, 0)], [true, 0, ['attack 7c', 'attack 7d', 'done']], 'the attacker may throw more sevens after it');
  play(g, 0, 'attack 7c'); play(g, 0, 'attack 7d');
  assert.deepEqual(can(g, 0), ['done'], 'three cards for a hand of three: the table is full');
  assert.equal(g.stuck(), true, 'and the bout cannot go on');
  g.endBout();
  assert.deepEqual([names(g.hands[1]), g.attacker, g.turn, g.gone, g.limit], ['6s 9c 10d 7s 7c 7d', 0, 0, 0, 6], 'the defender picks everything up, and the attacker leads again');
  assert.equal(names(g.hands[0]), 'Ks 9h 8h 6d 6c', 'only the attacker draws: the defender holds six already');
});

test('Durak: when a bout cannot go on', () => {
  const g = table({ mine: ['7s', 'Kd'], devil: ['8s', '9c'], deck: ['6c'] });
  play(g, 0, 'attack 7s'); play(g, 1, 'defend 8s');
  assert.deepEqual([can(g, 0), g.stuck()], [['done'], true], 'no seven and no eight left to throw in');
  const h = table({ mine: ['7s', '7d', 'Kd'], devil: ['8s'], deck: [] });
  play(h, 0, 'attack 7s'); play(h, 1, 'defend 8s');
  assert.equal(h.stuck(), true, 'a defender without cards cannot be attacked any further');
  h.endBout();
  assert.deepEqual([h.over, h.fool], [true, 0], 'the deck is gone and the devil has no cards: the one left holding cards is the fool');
});

test('Durak: the end of the game', () => {
  const win = table({ mine: ['Ks'], devil: ['7c', '8c'], deck: [] });
  play(win, 0, 'attack Ks'); play(win, 1, 'take');
  assert.equal(win.stuck(), true);
  win.endBout();
  assert.deepEqual([win.over, win.fool, win.options(0), win.options(1)], [true, 1, [], []], 'my last card is taken: the devil is the fool, and nobody moves any more');
  const draw = table({ mine: ['Ks'], devil: ['As'], deck: [] });
  play(draw, 0, 'attack Ks'); play(draw, 1, 'defend As'); draw.endBout();
  assert.deepEqual([draw.over, draw.fool], [true, null], 'the last card is beaten with the last card: nobody is the fool');
  const on = table({ mine: ['Ks'], devil: ['As', '6c'], deck: ['9d'] });
  play(on, 0, 'attack Ks'); play(on, 1, 'defend As'); on.endBout();
  assert.deepEqual([on.over, names(on.hands[0]), on.attacker], [false, '9d', 1], 'while there are cards in the deck the game goes on');
});

test('Durak: the devil plays by the rules and to the end', () => {
  const tally = { 0: 0, 1: 0, draw: 0 };
  for (let seed = 1; seed <= 300; seed++) {
    const g = durak.createGame(seeded(seed));
    for (let n = 0; n < 2000 && !g.over; n++) {
      if (g.stuck()) { g.endBout(); continue; }
      const move = durak.devilMove(g, g.turn);
      assert.ok(g.act(g.turn, move), `seed ${seed}: the move is allowed (${JSON.stringify(move)})`);
      const count = g.deck.length + g.hands[0].length + g.hands[1].length + g.gone + g.table.reduce((k, pair) => k + (pair.defence ? 2 : 1), 0);
      assert.equal(count, 36, 'no card is lost and none is made');
      assert.ok(g.table.length <= durak.HAND, 'never more than six cards are led in one bout');
    }
    assert.ok(g.over && g.deck.length === 0, `seed ${seed}: the game ends, and only once the deck is gone`);
    assert.equal(g.fool === null ? g.hands[0].length + g.hands[1].length : g.hands[1 - g.fool].length, 0, 'whoever is not the fool has no cards left');
    tally[g.fool === null ? 'draw' : g.fool]++;
  }
  assert.ok(tally[0] > 100 && tally[1] > 100, `played against itself, either side is the fool about as often (${JSON.stringify(tally)})`);
  // it does not lead a trump while it holds a plain card, and takes rather than give up a high trump early
  const lead = table({ mine: ['7s'], devil: ['6h', 'Ac', '9d'], deck: ['6c', '6d', '8s', '9s', '10s', 'Js', 'Qs', 'Kc'], attacker: 1 });
  assert.deepEqual(durak.devilMove(lead), { type: 'attack', card: card('9d') }, 'the cheapest plain card is led');
  const save = table({ mine: ['7s', '8d'], devil: ['Ah', 'Kc', '9d'], deck: ['6c', '6d', '8s', '9s', '10s', 'Js', 'Qs', 'Kd'], attacker: 0 });
  play(save, 0, 'attack 7s');
  assert.deepEqual(durak.devilMove(save), { type: 'take' }, 'a seven is not worth the ace of trumps while the deck is thick');
  save.deck.length = 0;
  assert.deepEqual(durak.devilMove(save), { type: 'defend', card: card('Ah') }, 'with the deck gone it is');
});
