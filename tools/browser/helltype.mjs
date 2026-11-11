// Helltype: typing, mistakes, going back, the clock, the result, both languages, a phone.
import { sleep } from '../lib.mjs';

export default async function ({ t, open, url, browser }) {
  const page = await open('#helltype');
  await sleep(500);
  const text = (sel) => page.$eval(sel, (e) => e.textContent);
  const on = (sel) => page.$$eval(`${sel} button.on`, (list) => list.map((b) => b.textContent));
  // The words to type, as the page shows them (letters typed past the end of a word are not part of it).
  const words = () => page.$$eval('#ht-words .w', (list) => list.map((w) => [...w.children].filter((i) => i.className !== 'x').map((i) => i.textContent).join('')));
  const marks = (i) => page.$eval(`#ht-words .w:nth-of-type(${i + 1})`, (w) => (w.classList.contains('err') ? 'err:' : '') + [...w.children].map((c) => ({ ok: 'o', no: 'n', x: 'x' })[c.className] || '.').join(''));
  const focused = () => page.evaluate(() => document.activeElement && document.activeElement.id);
  const overlayOpen = () => page.$eval('#overlay', (o) => !o.classList.contains('hidden'));
  const type = (s, delay = 25) => page.keyboard.type(s, { delay });

  // ---- a fresh page
  t.check(!(await overlayOpen()), 'no start screen: the test begins with the first key');
  t.equal(await focused(), 'ht-in', 'the input box is focused straight away');
  t.equal([await on('#ht-time'), await on('#ht-lang')], [['30 s'], ['English']], 'starts with 30 seconds and English');
  t.equal([await text('#g-score-label'), await text('#g-score'), await text('#g-status')], ['WPM', '0', 'Type to start the clock'], 'the header before the start');
  let ws = await words();
  t.check(ws.length >= 100 && ws.every((w) => /^[a-z]+$/.test(w)), 'English words are shown');
  const view = await page.evaluate(() => {
    const box = document.querySelector('.ht-view').getBoundingClientRect(), first = document.querySelector('#ht-words .w');
    return { lines: Math.round(box.height / first.offsetHeight), caret: getComputedStyle(document.querySelector('#ht-caret')).display };
  });
  t.equal(view, { lines: 3, caret: 'block' }, 'three lines of words and a caret');
  await sleep(600);
  t.equal(await page.$eval('#ht-tb', (b) => b.style.width), '100%', 'the clock waits for the first key');

  // ---- typing: right letters, a wrong one, extra ones
  await type(ws[0] + ' ');
  t.equal(await marks(0), 'o'.repeat(ws[0].length), 'a word typed right');
  await sleep(300);
  t.check(parseFloat(await page.$eval('#ht-tb', (b) => b.style.width)) < 100, 'the clock is running');
  await type(ws[1].slice(0, -1) + (ws[1].endsWith('q') ? 'w' : 'q'));
  t.equal(await marks(1), 'o'.repeat(ws[1].length - 1) + 'n', 'a wrong letter is marked');
  await type('zz');
  t.equal(await marks(1), 'o'.repeat(ws[1].length - 1) + 'nxx', 'letters past the end of the word are shown as extra');
  await type('zzzzzzzzzzzz', 5);
  t.equal((await marks(1)).length, ws[1].length + 8, 'no more than eight extra letters');
  await type(' ');
  t.check((await marks(1)).startsWith('err:'), 'a word left with a mistake is underlined');
  t.equal((await words())[1], ws[1], 'the word itself is unchanged');

  // ---- Backspace at the start of a word goes back into a word with a mistake, and only then
  await page.keyboard.press('Backspace');
  t.check(!(await marks(1)).startsWith('err:') && (await marks(1)).endsWith('x'), 'Backspace returns into the wrong word');
  for (let i = 0; i < 9; i++) await page.keyboard.press('Backspace');
  await type(ws[1].slice(-1) + ' ');
  t.equal(await marks(1), 'o'.repeat(ws[1].length), 'the mistake is fixed');
  await page.keyboard.press('Backspace');
  await type(ws[2].slice(0, 2));
  t.equal([await marks(1), (await marks(2)).slice(0, 2)], ['o'.repeat(ws[1].length), 'oo'], 'no going back into a word that is right');
  // Ctrl+Backspace deletes the whole word
  await page.keyboard.down('Control'); await page.keyboard.press('Backspace'); await page.keyboard.up('Control');
  t.equal(await marks(2), '.'.repeat(ws[2].length), 'Ctrl+Backspace clears the word');
  await type(ws[2].slice(0, 1) + 'ZZ ');             // a wrong word again
  await page.keyboard.down('Control'); await page.keyboard.press('Backspace'); await page.keyboard.up('Control');
  t.equal(await marks(2), '.'.repeat(ws[2].length), 'Ctrl+Backspace at the start of a word clears the wrong word before it');
  // a space before the first letter of a word does nothing; arrows cannot move the caret
  await type('  ');
  await type(ws[2].slice(0, 2));
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('Home');
  await type(ws[2].slice(2) + ' ');
  t.equal(await marks(2), 'o'.repeat(ws[2].length), 'stray spaces and arrow keys change nothing');
  // a click into the box keeps the caret at the end
  const box = await (await page.$('#ht-box')).boundingBox();
  await type(ws[3].slice(0, 2));
  await page.mouse.click(box.x + 3, box.y + box.height / 2);
  await type(ws[3].slice(2) + ' ');
  t.equal(await marks(3), 'o'.repeat(ws[3].length), 'clicking the box does not move the caret into the word');
  t.check(/^\d+s · \d+% accuracy$/.test(await text('#g-status')), `status while typing (${await text('#g-status')})`);

  // ---- Tab: new words, the clock is back at the start
  await page.keyboard.press('Tab');
  await sleep(350);
  const fresh = await words();
  t.check(fresh.slice(0, 6).join(' ') !== ws.slice(0, 6).join(' '), 'Tab brings new words');
  t.equal([await text('#g-status'), await page.$eval('#ht-tb', (b) => b.style.width), await focused(), await marks(0)], ['Type to start the clock', '100%', 'ht-in', '.'.repeat(fresh[0].length)], 'Tab resets the test');

  // ---- a key pressed while the box is not focused still lands in it
  await page.evaluate(() => document.activeElement.blur());
  await sleep(250);
  const dimmed = await page.evaluate(() => ({ words: getComputedStyle(document.querySelector('#ht-words')).opacity, hint: getComputedStyle(document.querySelector('.ht-hint')).opacity, caret: getComputedStyle(document.querySelector('#ht-caret')).display }));
  t.equal(dimmed, { words: '0.2', hint: '1', caret: 'none' }, 'without focus the words fade and a hint says to click');
  await type(fresh[0].slice(0, 1));
  t.equal([await focused(), await marks(0)], ['ht-in', 'o' + '.'.repeat(fresh[0].length - 1)], 'typing brings the focus back and the letter counts');
  await page.keyboard.press('Tab');

  // ---- a whole 15-second test, typed by a steady robot with a mistake in every seventh word
  await page.click('#ht-time button[data-m="t15"]');
  await sleep(200);
  t.equal([await on('#ht-time'), await focused()], [['15 s'], 'ht-in'], 'switched to 15 seconds');
  ws = await words();
  const started = Date.now();
  for (let i = 0; Date.now() - started < 17000 && !(await overlayOpen()); i++) {
    const w = (await words())[i];
    await type((i % 7 === 6 ? w.slice(0, -1) + (w.endsWith('q') ? 'w' : 'q') : w) + ' ', 45);
  }
  await sleep(300);
  t.check(await overlayOpen(), 'the result appears when the time is up');
  const took = Date.now() - started;
  t.check(took > 14500 && took < 16500, `the test lasted 15 seconds (${took} ms)`);
  // Work the speed out again from what the page shows: correct words count with the space after them.
  const counted = await page.evaluate(() => {
    const list = [...document.querySelectorAll('#ht-words .w')];
    const typedInto = (w) => [...w.children].some((c) => c.className);
    let current = list.length - 1;
    while (current > 0 && !typedInto(list[current])) current--;
    // an untouched word after the last finished one is the current word
    let chars = 0, wrong = 0;
    list.slice(0, current + 1).forEach((w, i) => {
      const kids = [...w.children], ok = kids.filter((c) => c.className === 'ok').length, clean = kids.every((c) => c.className === 'ok' || c.className === '');
      const finished = kids.length && kids.every((c) => c.className !== '') || w.classList.contains('err');
      if (w.classList.contains('err')) wrong++;
      else if (finished) chars += ok + 1;
      else if (clean) chars += ok;
    });
    return { chars, wrong };
  });
  const score = Number(await text('#g-score'));
  t.check(Math.abs(score - Math.round(counted.chars * 60 / 15 / 5)) <= 1, `speed: ${score} WPM for ${counted.chars} correct characters`);
  t.check(score > 60 && score < 260, `a believable speed for the robot (${score})`);
  const result = await text('#ov-text');
  const m = result.match(/^(\d+) WPM · (\d+)% accuracy · raw (\d+)(?: · (\d+) wrong words?)?$/);
  t.check(!!m, `the result text (${result})`);
  if (m) {
    t.equal(Number(m[1]), score, 'the result shows the same speed as the header');
    t.check(Number(m[2]) >= 85 && Number(m[2]) < 100, `accuracy reflects the mistakes (${m[2]}%)`);
    t.check(Number(m[3]) > score, 'raw speed counts the wrong words too');
    t.equal(Number(m[4] || 0), counted.wrong, 'wrong words are counted');
  }
  t.equal([await text('#ov-title'), await text('#g-best'), await page.evaluate(() => localStorage.getItem('arcade:best:helltype:t15'))], ['New best!', String(score), String(score)], 'the best speed is saved for this mode');
  t.equal(await page.$eval('#ht-in', (i) => i.disabled), true, 'typing after the end changes nothing');
  await page.keyboard.press('Space');
  await sleep(200);
  t.check(await overlayOpen(), 'a Space typed just after the end does not skip the result');
  await sleep(1400);
  await page.keyboard.press('Enter');
  await sleep(300);
  t.equal([await overlayOpen(), await focused(), await text('#g-status'), await text('#g-score')], [false, 'ht-in', 'Type to start the clock', '0'], 'Enter starts a new test');
  // pretend a far better speed was reached earlier; the checks below look for this number
  await page.evaluate(() => localStorage.setItem('arcade:best:helltype:t15', '999'));

  // ---- Russian
  await page.click('#ht-lang button[data-l="ru"]');
  await sleep(200);
  ws = await words();
  t.check(ws.length >= 100 && ws.every((w) => /^[а-я]+$/.test(w)), 'Russian words are shown');
  await type(ws[0] + ' ');
  t.equal(await marks(0), 'o'.repeat(ws[0].length), 'Cyrillic letters are accepted');
  t.equal(await text('#ht-note'), '', 'no hint while the layout is right');
  await type('ghj');
  t.check(/раскладку/.test(await text('#ht-note')), 'Latin letters where Russian ones are expected: a hint to switch the layout');
  await page.keyboard.press('Backspace'); await page.keyboard.press('Backspace'); await page.keyboard.press('Backspace');
  await type(ws[1].slice(0, 3));
  t.equal(await text('#ht-note'), '', 'the hint goes away again');
  await page.reload({ waitUntil: 'load' });
  await sleep(500);
  t.equal([await on('#ht-lang'), await on('#ht-time')], [['Русский'], ['15 s']], 'the language and the time are remembered');
  t.equal(await text('#g-best'), '999', 'the best speed of the mode is shown');
  t.problems(page, 'desktop');
  await page.close();

  // ---- the home page shows the best speed of the mode played last
  const home = await open('');
  await sleep(400);
  t.equal(await home.$eval('#grid .card[href="#helltype"] .best', (e) => e.textContent.replace(/\s+/g, ' ').trim()), 'Best 999· 15 s', 'the card on the home page');
  await home.close();

  // ---- with no language chosen yet, a browser set to Russian starts with Russian words
  const ru = await browser.newPage();
  await ru.evaluateOnNewDocument(() => { localStorage.removeItem('arcade:type:lang'); Object.defineProperty(navigator, 'language', { get: () => 'ru-RU' }); });
  await ru.goto(url + '#helltype', { waitUntil: 'load' });
  await sleep(500);
  t.equal(await ru.$$eval('#ht-lang button.on', (list) => list.map((b) => b.textContent)), ['Русский'], 'a Russian browser starts in Russian');
  await ru.close();

  // ---- a phone
  const phone = await open('#helltype', { mobile: true });
  await sleep(500);
  await phone.evaluate(() => { localStorage.clear(); document.activeElement.blur(); });
  await sleep(250);
  const p = await phone.evaluate(() => {
    const r = document.querySelector('#ht-box').getBoundingClientRect(), hint = [...document.querySelectorAll('.ht-hint span')].filter((s) => getComputedStyle(s).display !== 'none').map((s) => s.textContent);
    return { fits: r.left >= 0 && r.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth, bottom: r.bottom, hint, font: parseFloat(getComputedStyle(document.querySelector('#ht-in')).fontSize) };
  });
  t.check(p.fits, 'phone: the box fits the screen');
  t.check(p.bottom < 400, `phone: the words stay above the on-screen keyboard (box ends at ${Math.round(p.bottom)} px)`);
  t.equal(p.hint, ['Tap here to type'], 'phone: the hint says to tap');
  t.check(p.font >= 16, 'phone: the input box is at least 16 px, or iPhones would zoom in on it');
  const r = await (await phone.$('#ht-box')).boundingBox();
  await phone.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
  await sleep(300);
  t.equal(await phone.evaluate(() => document.activeElement.id), 'ht-in', 'phone: a tap on the words opens the keyboard');
  const pw = await phone.$$eval('#ht-words .w', (list) => list.slice(0, 3).map((w) => w.textContent));
  // A phone keyboard that inserts a whole word and its space at once (swipe typing, suggestions)
  await phone.evaluate((word) => { const i = document.querySelector('#ht-in'); i.value += word + ' '; i.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: word + ' ' })); }, pw[0]);
  await phone.keyboard.type(pw[1].slice(0, 2), { delay: 25 });
  const state = await phone.$$eval('#ht-words .w', (list) => list.slice(0, 2).map((w) => [...w.children].filter((c) => c.className === 'ok').length));
  t.equal(state, [pw[0].length, 2], 'phone: a word inserted in one go is accepted');
  t.problems(phone, 'phone');
  await phone.close();
}
