// Hellword: a round in English on the keyboard, a round in Russian on the keys of the screen, the streaks,
// a round that carries on after the page was closed, and giving up.
import { sleep } from '../lib.mjs';

const TURN = 1500; // a guess turns over letter by letter, then the keys take their colours

export default async function ({ t, open }) {
  const page = await open('#hellword');
  await sleep(800);
  const text = (sel) => page.$eval(sel, (e) => e.textContent);
  const answer = (lang) => page.evaluate((l) => JSON.parse(localStorage.getItem('arcade:hellword:round:' + l)).answer, lang);
  const row = (n) => page.$$eval(`.hw-row:nth-child(${n + 1}) .hw-tile`, (tiles) => tiles.map((el) => [el.textContent, ['hit', 'near', 'miss'].find((c) => el.classList.contains(c)) || '']));
  const marks = (guess, word) => page.evaluate(async (g, w) => (await import('./js/games/hellword.js')).judge(g, w), guess, word);
  const type = async (word) => { for (const ch of word) await page.keyboard.press(ch); };
  const overlay = async () => (await page.$eval('#overlay', (o) => !o.classList.contains('hidden'))) && [await text('#ov-title'), await text('#ov-text')];

  // ---- English, typed on the keyboard
  t.equal(await page.$eval('#hw-lang .on', (b) => b.dataset.l), 'en', 'a browser set to English starts in English');
  t.equal([await page.$$eval('.hw-tile', (l) => l.length), await page.$$eval('#hw-keys button', (l) => l.length)], [30, 28], 'six rows of five, and a key for every letter, Enter and Delete');
  t.equal(await text('#g-status'), 'Guess 1 of 6', 'the round is ready');
  const word = await answer('en');
  t.check(/^[a-z]{5}$/.test(word), 'a word was picked');

  await type('ab'); await page.keyboard.press('Enter');
  t.equal([await text('#hw-note'), await text('#g-status')], ['Not enough letters', 'Guess 1 of 6'], 'a word that is too short is not taken');
  await type('cde'); await page.keyboard.press('Enter');
  t.equal([await text('#hw-note'), await text('#g-status')], ['Not in the word list', 'Guess 1 of 6'], 'nor is something that is not a word');
  t.equal((await row(0)).map((c) => c[0]).join(''), 'abcde', 'and it stays in its row to be corrected');
  for (let i = 0; i < 5; i++) await page.keyboard.press('Backspace');
  t.equal((await row(0)).map((c) => c[0]).join(''), '', 'Backspace wipes it');

  const guess = word === 'crane' ? 'pilot' : 'crane';
  await type(guess + 'x'); await page.keyboard.press('Enter');
  await sleep(TURN);
  const expected = await marks(guess, word);
  t.equal(await row(0), [...guess].map((ch, i) => [ch, expected[i]]), `"${guess}" is marked against "${word}"`);
  t.equal(await page.$$eval('#hw-keys button[data-k]', (keys, g) => keys.filter((k) => g.includes(k.dataset.k)).every((k) => /hit|near|miss/.test(k.className)), guess), true, 'the keys of its letters took their colours');
  t.equal(await text('#g-status'), 'Guess 2 of 6', 'on to the second try');

  // the round is still there after the page was closed
  await page.reload({ waitUntil: 'load' });
  await sleep(800);
  t.equal([await answer('en'), await text('#g-status'), (await row(0)).map((c) => c[0]).join('')], [word, 'Guess 2 of 6', guess], 'after a reload the round carries on where it stopped');

  await type(word); await page.keyboard.press('Enter');
  await sleep(TURN + 500);
  const won = await overlay();
  t.check(won && won[1] === `${word.toUpperCase()} in 2 tries · 1 in a row`, `guessing the word wins the round (${won})`);
  t.equal([await text('#g-score'), await text('#g-best')], ['1', '1'], 'the streak is one, and so is the best');
  t.check((await row(1)).every((c) => c[1] === 'hit'), 'the winning row is all green');

  await sleep(700);
  await page.keyboard.press('Enter'); // Play again
  await sleep(300);
  const second = await answer('en');
  t.check(second !== word && await text('#g-status') === 'Guess 1 of 6' && (await row(0)).every((c) => c[0] === ''), 'the next round has another word and an empty board');

  // ---- Russian, tapped on the keys of the screen
  await page.click('#hw-lang button[data-l="ru"]');
  await sleep(300);
  t.equal(await page.$$eval('#hw-keys button', (l) => l.length), 34, 'the Russian keyboard: 32 letters, Enter and Delete');
  t.equal([await text('#g-score'), await text('#g-best')], ['0', '–'], 'Russian has a streak of its own');
  const slovo = await answer('ru');
  t.check(/^[а-я]{5}$/.test(slovo), 'a Russian word was picked');
  const tap = async (w) => { for (const ch of w) await page.click(`#hw-keys button[data-k="${ch}"]`); await page.click('#hw-keys button[data-k="Enter"]'); };
  const other = slovo === 'книга' ? 'спорт' : 'книга';
  await tap(other);
  await sleep(TURN);
  const expectedRu = await marks(other, slovo);
  t.equal(await row(0), [...other].map((ch, i) => [ch, expectedRu[i]]), `"${other}" is marked against "${slovo}"`);
  await page.click('#hw-keys button[data-k="я"]'); await page.click('#hw-keys button[data-k="Backspace"]');
  t.equal((await row(1)).map((c) => c[0]).join(''), '', 'the Delete key of the screen works');

  // giving up shows the word and ends the streak
  await page.click('#g-restart');
  await sleep(200);
  const gaveUp = await overlay();
  t.equal(gaveUp, ['The word was ' + slovo.toUpperCase(), 'You gave up. The streak starts again.'], 'Restart in the middle of a round gives it up');
  await sleep(700);
  await page.click('#ov-btn');
  await sleep(300);
  await tap(await answer('ru'));
  await sleep(TURN + 500);
  t.check(/ in 1 try · 1 in a row$/.test((await overlay())[1]), 'a word guessed at the first try');
  await sleep(700);
  await page.click('#ov-btn');
  await sleep(300);

  // ---- back to English: its unfinished round and its streak are as they were
  await page.click('#hw-lang button[data-l="en"]');
  await sleep(300);
  t.equal([await answer('en'), await text('#g-score')], [second, '1'], 'English kept its word and its streak');
  for (const w of ['crane', 'pilot', 'sound', 'might', 'bloke', 'jumpy'].filter((w) => w !== second)) { await type(w); await page.keyboard.press('Enter'); await sleep(TURN); }
  await sleep(600);
  t.equal(await overlay(), ['The word was ' + second.toUpperCase(), 'Out of tries. The streak starts again.'], 'six wrong tries lose the round');
  t.equal([await text('#g-score'), await text('#g-best')], ['0', '1'], 'the streak is gone, the best stays');
  t.problems(page);
  await page.close();

  // ---- a browser set to Russian starts in Russian, and a phone shows the whole game without scrolling
  const phone = await open('', { mobile: true });
  await phone.evaluateOnNewDocument(() => { Object.defineProperty(navigator, 'language', { get: () => 'ru-RU' }); });
  await phone.evaluate(() => localStorage.clear()); // a new player: no language chosen yet
  await phone.reload({ waitUntil: 'load' });        // from here on the page believes the browser is Russian
  await phone.evaluate(() => { location.hash = 'hellword'; });
  await sleep(800);
  t.equal(await phone.$eval('#hw-lang .on', (b) => b.dataset.l), 'ru', 'a browser set to Russian starts in Russian');
  const fits = await phone.evaluate(() => {
    const keys = [...document.querySelectorAll('#hw-keys button')].map((b) => b.getBoundingClientRect());
    return { sideways: document.documentElement.scrollWidth <= innerWidth, keysOnScreen: keys.every((r) => r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight), narrowest: Math.min(...keys.map((r) => r.width)) };
  });
  t.check(fits.sideways && fits.keysOnScreen, 'phone: the board and every key are on the screen at once');
  t.check(fits.narrowest >= 24, `phone: the Russian keys are wide enough for a finger (${fits.narrowest.toFixed(1)} px)`);
  t.problems(phone, 'phone');
  await phone.close();
}
