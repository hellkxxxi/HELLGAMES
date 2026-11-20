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
  await sleep(700);
  await page.click('#ov-btn');
  await sleep(300);

  // ---- a word of one's own, sent to a friend as a link
  const shown = (sel) => page.$eval(sel, (e) => e.getClientRects().length > 0);
  await type(await answer('en')); await page.keyboard.press('Enter'); // a streak of one, to see that a friend's word leaves it alone
  await sleep(TURN + 1200);
  await page.click('#ov-btn');
  await sleep(300);
  t.equal(await text('#g-score'), '1', 'a streak of one before the friend’s word');
  await page.click('#hw-make');
  t.equal([await shown('#hw-own'), await shown('#hw-board'), await shown('#hw-keys')], [true, false, false], 'the link button opens a page for a word of one’s own in place of the board');
  await page.type('#hw-own-in', 'abc'); await page.keyboard.press('Enter');
  t.equal([await text('#hw-own-msg'), await text('#hw-own-link')], ['It takes exactly five English letters.', ''], 'three letters make no link');
  await page.type('#hw-own-in', 'de');
  await page.click('#hw-own-copy');
  await sleep(200);
  t.equal(await text('#hw-own-msg'), 'Link copied. Send it to a friend. The game does not know this word, so your friend may try any letters.', 'five letters do, and the game says what it did');
  const link = await text('#hw-own-link');
  t.check(/#hellword\?w=[\w-]{11}$/.test(link) && !/abcde/i.test(link), `the link does not show the word (${link})`);
  await page.click('#hw-own-back');
  t.equal([await shown('#hw-own'), await shown('#hw-board'), (await row(0)).map((c) => c[0]).join('')], [false, true, ''], 'back to the game: nothing of this was typed on the board');

  await page.goto(link);
  await sleep(900);
  t.equal([await text('#g-status'), await text('#hw-note'), await text('#g-score')], ['A friend’s word · 1 of 6', 'A friend’s word: it may be a name, so any letters go', '1'], 'the link opens a round with the friend’s word');
  await type('qwxyz'); await page.keyboard.press('Enter');
  await sleep(TURN);
  t.equal(await text('#g-status'), 'A friend’s word · 2 of 6', 'the word is not one the game knows, so any five letters are taken');
  await page.reload({ waitUntil: 'load' });
  await sleep(900);
  t.equal([await text('#g-status'), (await row(0)).map((c) => c[0]).join('')], ['A friend’s word · 2 of 6', 'qwxyz'], 'after a reload the friend’s round carries on');
  await type('abcde'); await page.keyboard.press('Enter');
  await sleep(TURN + 500);
  t.equal(await overlay(), ['Got it!', 'ABCDE in 2 tries. Your friend’s word is solved.'], 'the friend’s word is guessed');
  t.equal([await text('#g-score'), await page.evaluate(() => localStorage.getItem('arcade:hellword:streak:en'))], ['1', '1'], 'the streak is neither longer nor lost');
  await sleep(700);
  await page.click('#ov-btn');
  await sleep(400);
  t.equal([await page.evaluate(() => location.hash), await text('#g-status')], ['#hellword', 'Guess 1 of 6'], '"Play on" leads back to the words of the game');

  // a friend's word that the game knows: then only real words may be tried
  const pack = (w, l) => page.evaluate(async (word, lang) => (await import('./js/games/hellword.js')).packWord(word, lang), w, l);
  await page.evaluate((code) => { location.hash = 'hellword?w=' + code; }, await pack('crane', 'en'));
  await sleep(500);
  t.equal(await text('#hw-note'), 'A friend sent you this word', 'a friend’s word that is in the word list');
  await type('qwxyz'); await page.keyboard.press('Enter');
  t.equal([await text('#hw-note'), await text('#g-status')], ['Not in the word list', 'A friend’s word · 1 of 6'], 'only real words may be tried against it');
  for (let i = 0; i < 5; i++) await page.keyboard.press('Backspace');
  await type('pilot'); await page.keyboard.press('Enter');
  await sleep(TURN);
  await page.click('#g-restart');
  await sleep(200);
  t.equal(await overlay(), ['The word was CRANE', 'You gave up on your friend’s word.'], 'Restart gives a friend’s word up and shows it');
  t.equal(await text('#g-score'), '1', 'and that costs no streak either');
  await sleep(700);
  await page.keyboard.press('Enter');
  await sleep(400);
  t.equal(await page.evaluate(() => location.hash), '#hellword', 'and then the game goes on with its own words');

  // a Russian word opens the Russian game; choosing the other language leaves the friend's word
  await page.evaluate((code) => { location.hash = 'hellword?w=' + code; }, await pack('слово', 'ru'));
  await sleep(500);
  t.equal([await page.$eval('#hw-lang .on', (b) => b.dataset.l), await page.$$eval('#hw-keys button', (l) => l.length), await text('#g-status')], ['ru', 34, 'A friend’s word · 1 of 6'], 'a Russian word opens the Russian game');
  await page.click('#hw-lang button[data-l="en"]');
  await sleep(400);
  t.equal([await page.evaluate(() => location.hash), await page.$eval('#hw-lang .on', (b) => b.dataset.l), await text('#g-status')], ['#hellword', 'en', 'Guess 1 of 6'], 'the other language is a game of the usual kind');

  // a link that was cut short or mistyped
  await page.evaluate(() => { location.hash = 'hellword?w=nonsense'; });
  await sleep(500);
  t.equal([await text('#hw-note'), await text('#g-status'), await page.evaluate(() => location.hash)], ['That link is broken. Here is a word of the game instead.', 'Guess 1 of 6', '#hellword'], 'a broken link is said to be broken, and the game goes on');
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
