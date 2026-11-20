// The casino: one purse of souls for three games, bets, wins and losses that add up to the soul, and a new
// purse for a player who has lost everything. Chance is fixed where the test needs a certain outcome.
import { sleep } from '../lib.mjs';

export default async function ({ t, open }) {
  const page = await open('#slots');
  await sleep(500);
  const text = (sel) => page.$eval(sel, (e) => e.textContent.trim());
  const purse = () => page.evaluate(() => Number(localStorage.getItem('arcade:souls') ?? 1000));
  const shown = async () => Number((await text('#g-score')).replace(/,/g, ''));
  const bet = async () => Number((await text('.bet output')).replace(/,/g, ''));
  // The next numbers the page gets when it asks for a random one; after them chance is chance again.
  const fix = (...values) => page.evaluate((list) => { const real = window.realRandom ||= Math.random; let i = 0; Math.random = () => (i < list.length ? list[i++] : real()); }, values);
  const go = async (id) => { await page.evaluate((h) => { location.hash = h; }, id); await sleep(450); };

  // ---- Soul Slots
  t.equal([await shown(), await text('#g-best-label'), await text('#g-best'), await bet()], [1000, 'Top win', '–', 50], 'a new player has 1,000 souls and bets 50');
  await page.click('.bet button[data-b="up"]');
  t.equal(await bet(), 100, 'the bet goes up');
  await page.keyboard.press('ArrowDown');
  t.equal(await bet(), 50, 'and down, with the keys too');
  const stopAt = (...symbols) => page.evaluate(async (list) => { const { REELS } = await import('./js/games/slots.js'); return list.map((s, i) => (REELS[i].indexOf(s) + 0.5) / REELS[i].length); }, symbols);

  await fix(...await stopAt('cherry', 'citrus', 'grape'));
  await page.click('#sl-spin');
  await sleep(300);
  t.equal([await shown(), await page.$eval('#sl-spin', (b) => b.disabled), await page.$eval('.bet button', (b) => b.disabled)], [950, true, true], 'the bet leaves the purse at once, and nothing can be changed while the reels turn');
  await page.keyboard.press('Space');
  await sleep(1900);
  t.equal([await text('#sl-msg'), await shown(), await purse()], ['No match', 950, 950], 'three different symbols: the bet is lost, and a second press during the spin did not bet again');

  await fix(...await stopAt('cherry', 'bell', 'cherry'));
  await page.keyboard.press('Space');
  await sleep(2200);
  t.equal([await text('#sl-msg'), await shown(), await text('#g-best')], ['A pair of cherries: your bet is back', 950, '–'], 'a pair gives the bet back, which is no win to remember');
  t.equal(await page.$$eval('.sl-cell.win', (l) => l.map((c) => c.dataset.s)), ['cherry', 'cherry'], 'the pair is lit');

  await fix(...await stopAt('flame', 'flame', 'flame'));
  await page.click('#sl-spin');
  await sleep(2200);
  t.equal([await text('#sl-msg'), await shown(), await purse(), await text('#g-best')], ['Three flames! +9,950', 10900, 10900, '9,950'], 'three flames pay 200 times the bet');
  await page.click('.bet button[data-b="max"]');
  t.equal(await bet(), 10900, 'Max bets the whole purse');
  await page.click('.bet button[data-b="down"]');
  t.equal(await bet(), 10000, 'and one step down from there is the nearest round sum');
  await page.click('.bet button[data-b="up"]');
  t.equal(await bet(), 10000, 'the next step up would be more than the purse holds, so it is not taken');
  t.problems(page, 'slots');

  // ---- Soul Dice: the same purse
  await go('dice');
  t.equal([await shown(), await bet(), await text('#g-best')], [10900, 50, '–'], 'the purse came along; the bet and the top win are the game\'s own');
  t.equal([await text('#dc-at'), await text('#dc-chance'), await text('#dc-times'), await text('#dc-win')], ['under 50', '50%', '×1.98', '+49'], 'the odds of the middle line');
  await fix(0.1234);
  await page.keyboard.press('Space');
  await sleep(900);
  t.equal([await text('#dc-roll'), await text('#dc-msg'), await shown()], ['12.34', '12.34 wins: +49', 10949], 'a roll under the line wins');
  await page.click('#dc-side button[data-o="1"]');
  t.equal(await text('#dc-at'), '50 or more', 'the other side of the line');
  await fix(0.1234);
  await page.click('#dc-go');
  await sleep(900);
  t.equal([await text('#dc-msg'), await shown(), await purse()], ['12.34 loses', 10899, 10899], 'the same roll loses a bet on "over"');
  for (let i = 0; i < 25; i++) await page.keyboard.press('ArrowRight');
  t.equal([await text('#dc-at'), await text('#dc-chance'), await text('#dc-times')], ['75 or more', '25%', '×3.96'], 'the arrow keys move the line, and a smaller chance pays more');
  await fix(0.75);
  await page.keyboard.press('Enter');
  await sleep(900);
  t.equal([await text('#dc-msg'), await shown(), await text('#g-best')], ['75.00 wins: +148', 11047, '148'], 'a roll right on the line counts as "or more"');
  t.equal(await page.$$eval('#dc-past span', (l) => l.map((s) => `${s.textContent} ${s.className}`)), ['75.00 good', '12.34 bad', '12.34 good'], 'the earlier rolls, the newest first');
  t.problems(page, 'dice');

  // ---- Soul Mines
  await go('soulmines');
  t.equal([await shown(), await text('#sm-go')], [11047, 'Start'], 'the purse came along again');
  await fix(...Array(24).fill(0.9999)); // the skulls stay where they are dealt: under the first three tiles
  await page.click('#sm-go');
  t.equal([await shown(), await text('#sm-go'), await page.$eval('#sm-go', (b) => b.disabled)], [10997, 'Pick a tile', true], 'the round starts and there is nothing to take yet');
  await page.click('#sm-grid button[data-i="10"]');
  t.equal(await text('#sm-go'), 'Cash out 56', 'one safe tile: 50 souls became 56');
  await page.click('#sm-grid button[data-i="11"]');
  t.equal([await text('#sm-go'), await text('#sm-msg')], ['Cash out 64', 'Next tile makes it ×1.48 · 20 safe tiles left'], 'two safe tiles: 64');
  await page.keyboard.press('c');
  t.equal([await text('#sm-msg'), await shown(), await purse(), await text('#g-best'), await text('#sm-go')], ['You took 64: +14', 11061, 11061, '14', 'Start'], 'C takes the prize');
  t.equal(await page.$$eval('#sm-grid button.skull', (l) => l.map((b) => b.dataset.i)), ['0', '1', '2'], 'the field shows where the skulls were');
  await fix(...Array(24).fill(0.9999));
  await page.keyboard.press('Space');
  await page.click('#sm-grid button[data-i="1"]');
  t.equal([await text('#sm-msg'), await shown(), await text('#sm-go')], ['A skull on the first tile', 11011, 'Start'], 'a skull takes the bet');
  await page.click('#sm-grid button[data-i="12"]', { force: true }).catch(() => {});
  t.equal(await shown(), 11011, 'the tiles do nothing between rounds');

  // leaving in the middle of a round
  await fix(...Array(24).fill(0.9999));
  await page.click('#sm-go');
  await page.keyboard.press('Escape');
  await sleep(300);
  t.equal(await purse(), 11011, 'leaving before a tile was opened gives the bet back');
  await go('soulmines');
  await fix(...Array(24).fill(0.9999));
  await page.click('#sm-go');
  await page.click('#sm-grid button[data-i="20"]');
  await page.keyboard.press('Escape');
  await sleep(300);
  t.equal(await purse(), 11011 - 50 + 56, 'leaving later takes the prize as it stands');
  t.equal(await page.$$eval('#grid .card', (cards) => cards.filter((c) => /slots|dice|soulmines/.test(c.getAttribute('href'))).map((c) => c.querySelector('.best').textContent.replace(/\s+/g, ' ').trim())),
    ['Top win 9,950', 'Top win 148', 'Top win 14'], 'the cards on the home page show the biggest win of each game');
  t.problems(page, 'soul mines');

  // ---- a player who has lost everything is handed a new purse
  await page.evaluate(() => localStorage.setItem('arcade:souls', '30'));
  await go('dice');
  t.equal([await shown(), await bet()], [30, 30], 'nobody can bet more than they have');
  await page.click('.bet button[data-b="up"]');
  t.equal(await bet(), 30, 'not with the plus button either');
  await fix(0.9999);
  await page.click('#dc-side button[data-o="0"]');
  await page.keyboard.press('Space');
  await sleep(900);
  const overlay = async () => (await page.$eval('#overlay', (o) => !o.classList.contains('hidden'))) && [await text('#ov-title'), await text('#ov-btn')];
  t.equal([await purse(), await overlay()], [0, ['Out of souls', 'Take 1,000 souls']], 'the last souls are lost, and the game offers more');
  await sleep(400);
  await page.click('#ov-btn');
  await sleep(200);
  t.equal([await purse(), await shown(), await overlay(), await bet()], [1000, 1000, false, 50], 'a fresh purse of 1,000, and the bet is the one the player chose in better days');
  t.problems(page, 'broke');
  await page.close();

  // ---- on a phone everything fits the screen
  const phone = await open('#slots', { mobile: true });
  for (const id of ['slots', 'dice', 'soulmines']) {
    await phone.evaluate((h) => { location.hash = h; }, id);
    await sleep(500);
    const fit = await phone.evaluate(() => ({ wide: document.documentElement.scrollWidth <= innerWidth, button: document.querySelector('#stage .btn-primary').getBoundingClientRect().bottom <= innerHeight }));
    t.check(fit.wide && fit.button, `phone, ${id}: the game and its main button are on the screen without scrolling`);
  }
  t.problems(phone, 'phone');
  await phone.close();
}
