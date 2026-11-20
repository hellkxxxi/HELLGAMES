// Blackjack: the cards are fixed, so every round goes the way the test wants: a win, a blackjack, a bust,
// a doubled bet, a draw, the dealer's blackjack, and a hand that is left in the middle.
import { sleep } from '../lib.mjs';

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
// The numbers that make the page deal these cards ("10h" is the ten of hearts): one for the rank, one for the suit.
const numbers = (...cards) => cards.flatMap((c) => [(RANKS.indexOf(c.slice(0, -1)) + 0.5) / 13, ('shdc'.indexOf(c.slice(-1)) + 0.5) / 4]);

export default async function ({ t, open }) {
  const page = await open('#blackjack');
  await sleep(500);
  const text = (sel) => page.$eval(sel, (e) => e.textContent.trim());
  const purse = () => page.evaluate(() => Number(localStorage.getItem('arcade:souls') ?? 1000));
  const shown = async () => Number((await text('#g-score')).replace(/,/g, ''));
  const visible = (sel) => page.$eval(sel, (e) => e.getClientRects().length > 0);
  // The cards the page deals next, in the order player, dealer, player, dealer, and then whoever draws.
  const next = (...cards) => page.evaluate((list) => { const real = window.realRandom ||= Math.random; let i = 0; Math.random = () => (i < list.length ? list[i++] : real()); }, numbers(...cards));
  const hands = () => page.evaluate(() => ['#bj-player', '#bj-dealer'].map((sel) => [...document.querySelectorAll(sel + ' .pc')].map((c) => (c.classList.contains('back') ? '?' : c.dataset.rank + c.dataset.suit[0])).join(' ')));
  const sums = async () => [await text('#bj-player-sum'), await text('#bj-dealer-sum')];
  const DEALT = 1150, DRAWN = 600; // the four cards are on the table; the dealer has taken one more

  t.equal([await shown(), await text('#g-best-label'), await text('#bj-msg'), await visible('#bj-deal'), await visible('#bj-acts')], [1000, 'Top win', 'Place your bet', true, false], 'a table with nothing on it but the bet');

  // ---- a plain win: 19 against the dealer's 17
  await next('Ks', '10h', '9d', '7c');
  await page.keyboard.press('Space');
  await sleep(100);
  t.equal([await shown(), await purse()], [950, 950], 'the bet leaves the purse when the cards are dealt');
  await sleep(DEALT);
  t.equal([await hands(), await sums(), await text('#bj-msg')], [['Ks 9d', '10h ?'], ['19', '10'], 'Hit or stand?'], 'two cards each, one of the dealer’s face down');
  t.equal([await visible('#bj-acts'), await visible('#bj-bet-bar')], [true, false], 'the buttons of the hand take the place of the bet');
  await page.keyboard.press('s');
  await sleep(DRAWN);
  t.equal([await hands(), await sums(), await text('#bj-msg'), await purse(), await text('#g-best')], [['Ks 9d', '10h 7c'], ['19', '17'], 'You win +50', 1050, '50'], 'standing on 19 beats the dealer’s 17 and pays even money');

  // ---- a blackjack pays three to two
  await next('As', '9h', 'Kd', '7c');
  await page.click('#bj-deal');
  await sleep(DEALT);
  t.equal([await hands(), await text('#bj-msg'), await purse(), await text('#g-best')], [['As Kd', '9h 7c'], 'Blackjack! +75', 1125, '75'], 'an ace and a king: blackjack, paid at once');

  // ---- over 21
  await next('Ks', '9h', '6d', '7c', 'Qh');
  await page.keyboard.press('Enter');
  await sleep(DEALT);
  await page.click('#bj-hit');
  await sleep(200);
  t.equal([await hands(), await sums(), await text('#bj-msg'), await purse()], [['Ks 6d Qh', '9h 7c'], ['26', '16'], 'Over 21: bust', 1075], 'a card too many loses the bet, and the dealer need not draw');

  // ---- doubling: one more card for twice the bet
  await next('5s', '6h', '6d', '10c', '10s', 'Kh');
  await page.keyboard.press('Space');
  await sleep(DEALT);
  t.equal(await page.$eval('#bj-double', (b) => b.disabled), false, 'with two cards the bet can be doubled');
  await page.keyboard.press('d');
  await sleep(100);
  t.equal([await shown(), (await hands())[0]], [975, '5s 6d 10s'], 'doubling takes the bet a second time and deals one card');
  await sleep(DRAWN + 500);
  t.equal([await hands(), await text('#bj-msg'), await purse(), await text('#g-best')], [['5s 6d 10s', '6h 10c Kh'], 'You win +100', 1175, '100'], 'the dealer draws to 26, and the doubled bet wins double');

  // ---- a draw
  await next('10s', '9h', '8d', '9c');
  await page.keyboard.press('Space');
  await sleep(DEALT);
  await page.click('#bj-stand');
  await sleep(DRAWN);
  t.equal([await sums(), await text('#bj-msg'), await purse()], [['18', '18'], 'A draw: the bet comes back', 1175], '18 against 18: nobody wins');

  // ---- the dealer's blackjack ends the round before the player can act
  await next('10s', 'Ah', '9d', 'Kc');
  await page.keyboard.press('Space');
  await sleep(DEALT);
  t.equal([await hands(), await text('#bj-msg'), await purse(), await visible('#bj-acts')], [['10s 9d', 'Ah Kc'], 'The dealer wins', 1125, false], 'the dealer’s blackjack beats 19');

  // ---- an ace counts eleven or one; the dealer draws up to 17
  await next('As', '9h', '6d', '7c', 'Kh', '5s');
  await page.keyboard.press('Space');
  await sleep(DEALT);
  t.equal(await sums(), ['7 or 17', '9'], 'an ace and a six are 7 or 17');
  await page.keyboard.press('h');
  await sleep(200);
  t.equal([await sums(), await visible('#bj-acts')], [['17', '9'], true], 'with a king on top the ace counts one');
  await page.keyboard.press('Space'); // while a hand is played, Space takes a card as H does
  await sleep(200);
  t.equal([(await hands())[0], await sums(), await text('#bj-msg'), await visible('#bj-deal')], ['As 6d Kh 5s', ['22', '16'], 'Over 21: bust', true], 'a five on top of that is one too many');

  // ---- leaving in the middle of a hand counts as standing
  const before = await purse();
  await next('Ks', '10h', '9d', '7c');
  await page.keyboard.press('Space');
  await sleep(DEALT);
  t.equal(await purse(), before - 50, 'a hand is being played');
  await page.keyboard.press('Escape');
  await sleep(400);
  t.equal(await purse(), before + 50, 'the hand that was left is played out: 19 stands and wins against 17');
  t.equal(await text('#grid .card[href="#blackjack"] .best'), 'Top win 100', 'the home page shows the biggest win');
  t.problems(page, 'blackjack');
  await page.close();

  // ---- on a phone the table and its buttons fit the screen
  const phone = await open('#blackjack', { mobile: true });
  await sleep(500);
  await phone.evaluate((list) => { let i = 0; const real = Math.random; Math.random = () => (i < list.length ? list[i++] : real()); }, numbers('2s', '10h', '3d', '7c', '2h', '2c', '2d'));
  await phone.touchscreen.tap(...Object.values(await phone.$eval('#bj-deal', (b) => { const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })));
  await sleep(DEALT);
  for (let n = 0; n < 3; n++) { await phone.touchscreen.tap(...Object.values(await phone.$eval('#bj-hit', (b) => { const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }))); await sleep(250); }
  const fit = await phone.evaluate(() => {
    const cards = [...document.querySelectorAll('#bj-player .pc')].map((c) => c.getBoundingClientRect()), acts = document.querySelector('#bj-acts').getBoundingClientRect();
    return { cards: cards.length, inside: cards.every((r) => r.left >= 0 && r.right <= innerWidth), buttons: acts.bottom <= innerHeight && acts.left >= 0 && acts.right <= innerWidth, wide: document.documentElement.scrollWidth <= innerWidth };
  });
  t.check(fit.cards === 5 && fit.inside && fit.buttons && fit.wide, `phone: five cards and the three buttons fit the screen (${JSON.stringify(fit)})`);
  t.problems(phone, 'phone');
  await phone.close();
}
