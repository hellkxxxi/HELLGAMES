// Chess and Durak. Chess is played by clicking squares; games that the test needs in a certain state are
// put into the saved game. Durak is dealt with fixed chance and played to the end against a copy of the
// rules that runs alongside, so every card the page shows can be checked.
import { sleep } from '../lib.mjs';

const sq = (name) => (8 - Number(name[1])) * 8 + 'abcdefgh'.indexOf(name[0]);
const code = (move) => `${sq(move.slice(0, 2))}-${sq(move.slice(2, 4))}-${{ q: 5, r: 4, b: 3, n: 2 }[move[4]] || 0}`; // "e2e4", "b7a8n"

export default async function ({ t, open }) {
  const text = (page, sel) => page.$eval(sel, (e) => e.textContent.trim());
  const overlay = async (page) => (await page.$eval('#overlay', (o) => !o.classList.contains('hidden'))) && [await text(page, '#ov-title'), await text(page, '#ov-text')];

  // ---------------------------------------------------------------- Chess
  let page = await open('#chess');
  await sleep(500);
  const on = (name) => page.$eval(`.ch-sq[data-s="${sq(name)}"]`, (b) => b.getAttribute('aria-label').split(', ')[1] || '');
  const click = (name) => page.click(`.ch-sq[data-s="${sq(name)}"]`);
  const move = async (...moves) => { for (const m of moves) { await click(m.slice(0, 2)); await click(m.slice(2, 4)); } };
  const marked = (cls) => page.$$eval(`.ch-sq.${cls}`, (l) => l.map((b) => b.getAttribute('aria-label').slice(0, 2)).sort());
  const pieces = () => page.$$eval('.ch-sq .ch-piece', (l) => [l.filter((p) => p.classList.contains('w')).length, l.filter((p) => p.classList.contains('b')).length]);
  const saveGame = (mode, moves, human = true) => page.evaluate((m, list, h) => localStorage.setItem('arcade:chess:game:' + m, JSON.stringify({ human: h, moves: list })), mode, moves.map(code), human);

  t.equal([await page.$$eval('.ch-sq', (l) => l.length), await pieces(), await text(page, '#g-status'), await page.$eval('#ch-mode .on', (b) => b.dataset.m)], [64, [16, 16], 'Move 1 · your move', 'easy'], 'Chess: the pieces are set up, White to move, against the easy computer');
  t.equal([await on('e1'), await on('d8'), await on('a2'), await on('g8'), await on('e4')], ['white king', 'black queen', 'white pawn', 'black knight', ''], 'Chess: every piece on its square');
  await click('e2');
  t.equal([await marked('picked'), await marked('go')], [['e2'], ['e3', 'e4']], 'Chess: a click on a pawn shows where it can go');
  await click('e5');
  t.equal([await marked('picked'), await on('e2')], [[], 'white pawn'], 'Chess: a click on a square it cannot reach puts it down again');
  await click('b1');
  t.equal(await marked('go'), ['a3', 'c3'], 'Chess: a knight has its two jumps');
  await click('e2'); await click('e4');
  t.equal([await on('e4'), await on('e2'), await marked('last')], ['white pawn', '', ['e2', 'e4']], 'Chess: a click on a marked square makes the move');
  await sleep(1500);
  const reply = await marked('last');
  t.check(await text(page, '#g-status') === 'Move 2 · your move' && reply.length === 2 && reply.some((s) => /[5-8]$/.test(s)), `Chess: the computer answers (${reply})`);
  await page.keyboard.press('u');
  await sleep(200);
  t.equal([await text(page, '#g-status'), await on('e2'), await on('e4'), await pieces()], ['Move 1 · your move', 'white pawn', '', [16, 16]], 'Chess: U takes back one’s own move and the answer to it');

  // two at one board: the fool's mate
  await page.click('#ch-mode button[data-m="duo"]');
  await sleep(200);
  t.equal([await text(page, '#g-status'), await text(page, '#g-score'), await page.$eval('#ch-side', (b) => b.hidden)], ['Move 1 · White to move', '–', true], 'Chess: two players take turns at one board');
  await move('f2f3', 'e7e5', 'g2g4');
  t.equal(await text(page, '#g-status'), 'Move 2 · Black to move', 'Chess: Black moves after White');
  await move('d8h4');
  await sleep(300);
  t.equal([await overlay(page), await marked('check')], [['Checkmate: Black wins', 'In 2 moves'], ['e1']], 'Chess: the fool’s mate ends the game');
  await sleep(700);
  await page.click('#ov-btn');
  await sleep(200);

  // castling
  await move('e2e4', 'e7e5', 'g1f3', 'g8f6', 'f1c4', 'f8c5');
  await click('e1');
  t.check((await marked('go')).includes('g1'), 'Chess: the king may castle once the squares beside it are empty');
  await click('g1');
  t.equal([await on('g1'), await on('f1'), await on('h1'), await on('e1')], ['white king', 'white rook', '', ''], 'Chess: castling moves the king and the rook');
  await move('e8g8');
  t.equal([await on('g8'), await on('f8')], ['black king', 'black rook'], 'Chess: Black castles too');
  // taking in passing
  await page.click('#g-restart');
  await sleep(200);
  await move('e2e4', 'a7a6', 'e4e5', 'd7d5');
  await click('e5');
  t.equal(await marked('take'), ['d6'], 'Chess: a pawn that has just jumped past can be taken in passing');
  await click('d6');
  t.equal([await on('d6'), await on('d5'), await pieces()], ['white pawn', '', [16, 15]], 'Chess: and it is gone from the square it jumped to');
  // a pawn on the last row
  await page.click('#g-restart');
  await sleep(200);
  await move('a2a4', 'b7b5', 'a4b5', 'a7a6', 'b5a6', 'c8b7', 'a6b7', 'b8c6');
  await click('b7'); await click('a8');
  t.equal([await page.$eval('#ch-promo', (p) => p.hidden), await page.$$eval('#ch-promo button', (l) => l.map((b) => b.getAttribute('aria-label'))), await on('b7')], [false, ['queen', 'knight', 'rook', 'bishop'], 'white pawn'], 'Chess: a pawn that reaches the last row asks what it is to become');
  await page.click('#ch-promo button[data-p="2"]');
  t.equal([await on('a8'), await on('b7'), await page.$eval('#ch-promo', (p) => p.hidden)], ['white knight', '', true], 'Chess: it becomes the piece that was chosen');
  t.equal(await page.$eval('.ch-sq', (b) => b.dataset.s), '0', 'Chess: White sits at the bottom');
  await page.keyboard.press('f');
  t.equal(await page.$eval('.ch-sq', (b) => b.dataset.s), '63', 'Chess: F turns the board round');
  await page.reload({ waitUntil: 'load' });
  await sleep(600);
  t.equal([await on('a8'), await text(page, '#g-status')], ['white knight', 'Move 5 · Black to move'], 'Chess: after a reload the game is where it was left');

  // against the computer: a game one move from mate, as White and as Black
  await saveGame('easy', ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6']);
  await page.click('#ch-mode button[data-m="easy"]');
  await sleep(300);
  t.equal([await text(page, '#g-status'), await on('h5')], ['Move 4 · your move', 'white queen'], 'Chess: a saved game against the computer is taken up again');
  await move('h5f7');
  await sleep(300);
  t.equal([await overlay(page), await text(page, '#g-score'), await text(page, '#g-best')], [['Checkmate: you win', 'In 4 moves · 1 win in a row'], '1', '1'], 'Chess: mating the computer counts as a win');
  await saveGame('easy', ['f2f3', 'e7e5', 'g2g4']);
  await sleep(700);
  await page.click('#ov-btn');
  await sleep(1200);
  t.equal([await overlay(page), await on('h4'), await text(page, '#g-score'), await text(page, '#g-best')], [['Checkmate', 'The computer wins. The streak starts again.'], 'black queen', '0', '1'], 'Chess: the computer does not miss a mate in one, and a lost game ends the streak');
  await sleep(700);
  await page.click('#ov-btn');
  await sleep(300);
  await page.click('#ch-side');
  await sleep(1500);
  t.equal([await page.$eval('.ch-sq', (b) => b.dataset.s), await text(page, '#g-status'), await text(page, '#ch-side-text'), (await marked('last')).length], ['63', 'Move 1 · your move', 'Play White', 2], 'Chess: playing Black turns the board, and the computer makes the first move');
  t.problems(page, 'chess');
  await page.close();

  // ---------------------------------------------------------------- Durak
  page = await open('#durak');
  await sleep(500);
  t.equal([await page.$$eval('#dk-hand .pc', (l) => l.length), await page.$$eval('#dk-devil .pc', (l) => l.length), /^Trump: (spades|hearts|diamonds|clubs) · 24 left$/.test(await text(page, '#g-status'))], [6, 6, true], 'Durak: six cards each, twenty-four in the deck');
  // The cards are dealt anew with chance of the test's own, and a second game with the same chance is kept
  // beside the page. Whatever the page shows has to be what this second game says.
  await page.evaluate(async (seed) => {
    const chance = (s) => () => { s = (s + 0x6D2B79F5) | 0; let x = Math.imul(s ^ (s >>> 15), 1 | s); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
    const { createGame, devilMove } = await import('./js/games/durak.js');
    Math.random = chance(seed);
    document.querySelector('#g-restart').click();
    const g = createGame(chance(seed));
    const name = (c) => c.rank + c.suit[0];
    window.twin = {
      g,
      // brings the second game to the point where the player at the screen has to do something, or to its end
      settle() { while (!g.over && (g.stuck() || g.turn === 1)) { if (g.stuck()) g.endBout(); else g.act(1, devilMove(g)); } },
      look() { return { over: g.over, fool: g.fool, hand: g.hands[0].map(name).sort().join(' '), devil: g.hands[1].length, deck: g.deck.length, table: g.table.map((p) => name(p.attack) + (p.defence ? '/' + name(p.defence) : '')).join(' '), trump: g.trump }; },
      // the move a careful player makes now, and the same move made in the second game
      choose() { const m = devilMove(g, 0); g.act(0, m); return m.card ? { ...m, card: name(m.card) } : m; },
    };
  }, 31);
  const shown = () => page.evaluate(() => ({
    hand: [...document.querySelectorAll('#dk-hand .pc')].map((c) => c.dataset.rank + c.dataset.suit[0]).sort().join(' '),
    devil: document.querySelectorAll('#dk-devil .pc').length,
    table: [...document.querySelectorAll('#dk-table .dk-pair')].map((p) => [...p.querySelectorAll('.pc')].map((c) => c.dataset.rank + c.dataset.suit[0]).join('/')).join(' '),
    status: document.querySelector('#g-status').textContent, msg: document.querySelector('#dk-msg').textContent,
    ready: !!document.querySelector('#dk-hand .pc.can') || !document.querySelector('#dk-take').disabled || !document.querySelector('#dk-done').disabled,
  }));
  // waits until the page wants something from the player, or the game is over
  const myTurn = async () => { for (let k = 0; k < 120; k++) { if ((await overlay(page)) || (await shown()).ready) return; await sleep(100); } };
  let steps = 0, mismatch = '', kinds = new Set(), refused = false;
  for (; steps < 150; steps++) {
    await page.evaluate(() => window.twin.settle());
    const want = await page.evaluate(() => window.twin.look());
    await myTurn();
    if (want.over) break;
    const see = await shown();
    if (!mismatch && (see.hand !== want.hand || see.devil !== want.devil || see.table !== want.table || see.status !== `Trump: ${want.trump} · ${want.deck} left`)) mismatch = `step ${steps}: the page shows ${JSON.stringify(see)}, the rules say ${JSON.stringify(want)}`;
    if (!refused && want.table && !want.table.endsWith('/')) { // once: a card that is not allowed now is refused
      const dud = await page.evaluate(() => { const c = document.querySelector('#dk-hand .pc:not(.can)'); if (c) c.click(); return !!c; });
      if (dud) { refused = true; await sleep(100); const after = await shown(); if (after.hand !== see.hand || after.table !== see.table) mismatch ||= `step ${steps}: a card that could not be played was played`; }
    }
    const m = await page.evaluate(() => window.twin.choose());
    kinds.add(m.type);
    if (m.card) await page.click(`#dk-hand .pc[data-rank="${m.card.slice(0, -1)}"][data-suit^="${m.card.slice(-1)}"]`);
    else if (m.type === 'take') await page.click('#dk-take');
    else await page.keyboard.press('d');
  }
  const end = await page.evaluate(() => window.twin.look());
  await sleep(900);
  const said = await overlay(page);
  t.equal(mismatch, '', 'Durak: through a whole game the page shows the hands, the table and the deck that the rules say');
  t.check(end.over && steps > 12 && kinds.has('attack') && kinds.has('defend'), `Durak: the game was played to its end in ${steps} moves of the player (${[...kinds]})`);
  t.check(refused, 'Durak: a card that may not be played is refused');
  const expected = end.fool === null ? 'A draw' : end.fool === 1 ? 'The devil is the fool' : 'You are the fool';
  t.equal([said && said[0], await text(page, '#g-score')], [expected, end.fool === 1 ? '1' : '0'], `Durak: the end is the one the rules say (${expected})`);
  t.problems(page, 'durak');
  await page.close();

  // ---------------------------------------------------------------- on a phone
  const phone = await open('#chess', { mobile: true });
  await sleep(500);
  let box = await (await phone.$('#ch-board')).boundingBox();
  t.check(box.x >= 0 && box.x + box.width <= 390 && box.y + box.height <= 780 && box.width > 300, `phone, chess: the board fits the screen (${Math.round(box.width)} px)`);
  await phone.touchscreen.tap(box.x + box.width * (4.5 / 8), box.y + box.height * (6.5 / 8));
  t.equal(await phone.$$eval('.ch-sq.go', (l) => l.length), 2, 'phone, chess: a tap picks a piece');
  await phone.evaluate(() => { location.hash = 'durak'; });
  await sleep(600);
  const fit = await phone.evaluate(() => {
    const cards = [...document.querySelectorAll('#dk-hand .pc')].map((c) => c.getBoundingClientRect()), done = document.querySelector('#dk-done').getBoundingClientRect();
    return { cards: cards.length, inside: cards.every((r) => r.left >= 0 && r.right <= innerWidth), narrowest: Math.min(...cards.map((r) => r.width)), button: done.bottom <= innerHeight, wide: document.documentElement.scrollWidth <= innerWidth };
  });
  t.check(fit.cards === 6 && fit.inside && fit.button && fit.wide && fit.narrowest >= 40, `phone, durak: the hand and the buttons fit the screen (${JSON.stringify(fit)})`);
  t.problems(phone, 'phone');
  await phone.close();
}
