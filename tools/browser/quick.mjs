// The sensitivity converter and the quick games of eye and hand: Stroop Test, Odd One Out, Rock Paper Scissors.
import { sleep } from '../lib.mjs';

export default async function ({ t, open }) {
  const text = (page, sel) => page.$eval(sel, (e) => e.textContent);
  const overlay = async (page) => (await page.$eval('#overlay', (o) => !o.classList.contains('hidden'))) && [await text(page, '#ov-title'), await text(page, '#ov-text')];
  // The clock of a page can be pushed forward, so that nobody has to wait thirty seconds for a round to end.
  const loosen = (page) => page.evaluate(() => { const real = performance.now.bind(performance); window.ahead = 0; performance.now = () => real() + window.ahead; });
  const skip = (page, seconds) => page.evaluate((ms) => { window.ahead += ms; }, seconds * 1000);

  // ---------------------------------------------------------------- Sens Converter
  let page = await open('#sens');
  await sleep(500);
  const rows = () => page.$$eval('#sn-list button', (list) => Object.fromEntries(list.map((b) => [b.dataset.n, b.dataset.v])));
  const facts = () => page.$$eval('#sn-facts b', (list) => list.map((b) => b.textContent));
  const fields = () => page.evaluate(() => ['#sn-game', '#sn-sens', '#sn-dpi'].map((sel) => document.querySelector(sel).value));
  const set = (sel, value) => page.$eval(sel, (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, value);
  t.equal(await fields(), ['valorant', '0.4', '800'], 'Sens: a new visitor starts with Valorant, 0.4 and 800 DPI');
  t.equal(await rows(), { Valorant: '0.4', 'Counter-Strike 2': '1.273', 'Apex Legends': '1.273', Fortnite: '5%', 'Overwatch 2': '4.24', 'Call of Duty': '4.24', 'Rainbow Six Siege': '5', 'Team Fortress 2': '1.273' }, 'Sens: Valorant 0.4 in every other game');
  t.equal(await facts(), ['40.8 cm', '16.1 in', '320'], 'Sens: the way of the mouse for a full turn, and the eDPI');
  t.equal(await page.$$eval('#sn-list li.from button', (l) => l.map((b) => b.dataset.n)), ['Valorant'], 'Sens: the game one comes from is marked');
  t.check(await page.$eval('#play', (p) => p.classList.contains('no-score')) && !(await page.$eval('#g-restart', (b) => b.getClientRects().length > 0)), 'Sens: no score and no Restart button: there is nothing to count or to start over');
  await page.select('#sn-game', 'cs2');
  await set('#sn-sens', '2');
  t.equal([(await rows()).Valorant, (await rows())['Overwatch 2'], (await facts())[0]], ['0.629', '6.67', '26.0 cm'], 'Sens: Counter-Strike 2.0 is 0.629 in Valorant and takes 26 cm');
  await set('#sn-sens', '1,5');
  t.equal([(await rows()).Valorant, (await rows())['Rainbow Six Siege']], ['0.471', '6'], 'Sens: a comma works as a decimal point');
  t.check(/exactly 5\.76/.test(await text(page, '#sn-list li:nth-child(7)')), 'Sens: where a game takes whole numbers only, the exact one is shown beside them');
  await set('#sn-dpi', '');
  t.check((await facts()).length === 0 && /DPI/.test(await text(page, '#sn-facts')) && (await rows()).Valorant === '0.471', 'Sens: without the DPI the numbers are still converted, only the way of the mouse is unknown');
  await set('#sn-dpi', '1600');
  await set('#sn-sens', 'fast');
  t.check(/Type the sensitivity/.test(await text(page, '#sn-list')) && await page.$eval('#sn-sens', (i) => i.classList.contains('bad')), 'Sens: something that is no number is pointed out');
  await set('#sn-sens', '1.5');
  await page.click('#sn-list li:nth-child(1) button');
  await sleep(200);
  t.equal(await text(page, '#sn-msg'), 'Copied 0.471 for Valorant', 'Sens: a click on a result copies it');
  await page.reload({ waitUntil: 'load' });
  await sleep(500);
  t.equal(await fields(), ['cs2', '1.5', '1600'], 'Sens: the numbers are still there after a reload');
  t.problems(page, 'sens');
  await page.close();

  // ---------------------------------------------------------------- Stroop Test
  page = await open('#stroop');
  await sleep(500);
  await loosen(page);
  const card = () => page.evaluate(() => {
    const word = document.querySelector('#st-word'), keys = [...document.querySelectorAll('#st-keys button')];
    return { word: word.textContent, names: keys.map((b) => b.querySelector('b').textContent), ink: keys.findIndex((b) => getComputedStyle(b).backgroundColor === getComputedStyle(word).color) };
  });
  let c = await card();
  t.equal([await overlay(page), c.word, c.names[c.ink], await text(page, '#g-status')], [false, 'GREEN', 'RED', 'The clock starts with your first answer'], 'Stroop: the first card is GREEN written in red, and it waits');
  await skip(page, 40);
  await sleep(300);
  t.equal(await overlay(page), false, 'Stroop: no time passes before the first answer');
  let lies = 0;
  for (let n = 0; n < 8; n++) {
    const c = await card();
    if (!n) t.equal(c.names, ['RED', 'GREEN', 'BLUE', 'YELLOW'], 'Stroop: four colours to choose from');
    t.check(c.ink >= 0 && c.names.includes(c.word), `Stroop: card ${n + 1} is the name of a colour written in one of the four inks (${c.word}, ink ${c.ink})`);
    if (c.word !== c.names[c.ink]) lies++;
    if (n % 2) await page.keyboard.press(String(c.ink + 1)); else await page.click(`#st-keys button[data-k="${c.ink}"]`);
  }
  t.check(lies >= 2, `Stroop: most cards name one colour and show another (${lies} of 8)`);
  t.equal(await text(page, '#g-score'), '8', 'Stroop: eight right answers, by key and by click, are eight points');
  c = await card();
  await page.keyboard.press(String((c.ink + 1) % 4 + 1));
  t.equal(await text(page, '#g-score'), '7', 'Stroop: a wrong answer costs a point');
  c = await card();
  await page.keyboard.press(String(c.names.indexOf(c.word) === c.ink ? (c.ink + 2) % 4 + 1 : c.names.indexOf(c.word) + 1));
  t.equal(await text(page, '#g-score'), '6', 'Stroop: so does picking the colour that the word names');
  await skip(page, 31);
  await sleep(300);
  t.equal(await overlay(page), ['New best!', '8 right, 2 wrong · 3000 ms a card'], 'Stroop: after thirty seconds the round is over');
  t.equal(await text(page, '#g-best'), '6', 'Stroop: the best score is kept');
  await sleep(700);
  await page.click('#ov-btn');
  await sleep(200);
  await page.click('#st-lang button[data-l="ru"]');
  await sleep(200);
  t.equal([(await card()).names, await text(page, '#g-best'), await page.evaluate(() => localStorage.getItem('arcade:variant:stroop'))], [['КРАСНЫЙ', 'ЗЕЛЁНЫЙ', 'СИНИЙ', 'ЖЁЛТЫЙ'], '–', 'ru'], 'Stroop: Russian has words and a best score of its own');
  c = await card();
  await page.keyboard.press(String(c.ink + 1));
  t.check(c.word === 'ЗЕЛЁНЫЙ' && c.names[c.ink] === 'КРАСНЫЙ' && await text(page, '#g-score') === '1', 'Stroop: and is played the same way');
  t.problems(page, 'stroop');
  await page.close();

  // ---------------------------------------------------------------- Odd One Out
  page = await open('#odd');
  await sleep(500);
  await loosen(page);
  // Which tile is the odd one: the only one of its colour, or of its sign.
  const field = () => page.evaluate(() => {
    const tiles = [...document.querySelectorAll('#od-grid button')], look = tiles.map((b) => b.textContent || b.style.background);
    return { tiles: tiles.length, odd: look.findIndex((x) => look.filter((y) => y === x).length === 1), kinds: new Set(look).size, sample: look[0] };
  });
  const seconds = async () => Number((await text(page, '#g-status')).match(/^(\d+)s/)[1]);
  await skip(page, 40);
  await sleep(300);
  t.equal([await overlay(page), await text(page, '#g-status')], [false, 'The clock starts with your first tile'], 'Odd: the first field waits for the first click');
  let f = await field();
  t.equal([f.tiles, f.kinds, f.odd >= 0, /^(hsl|rgb)/.test(f.sample)], [4, 2, true, true], 'Odd: the first field has four coloured tiles, one of them a shade off');
  const sizes = [];
  for (let n = 0; n < 7; n++) { f = await field(); sizes.push(f.tiles); await page.click(`#od-grid button[data-i="${f.odd}"]`); }
  t.equal(sizes, [4, 9, 9, 16, 16, 25, 25], 'Odd: every find brings the next field, bigger every other time');
  t.equal(await text(page, '#g-score'), '7', 'Odd: seven finds are seven points');
  f = await field();
  const before = await seconds();
  await page.click(`#od-grid button[data-i="${(f.odd + 1) % f.tiles}"]`);
  await sleep(150);
  const after = await seconds();
  t.check(before - after >= 3 && before - after <= 4 && await text(page, '#g-score') === '7', `Odd: a wrong tile costs three seconds and brings nothing (${before} s, then ${after} s)`);
  await skip(page, 31);
  await sleep(300);
  t.equal(await overlay(page), ['New best!', '7 found · 1 wrong'], 'Odd: the round ends when the time is up');
  await sleep(700);
  await page.click('#ov-btn');
  await sleep(200);
  await page.click('#od-kind button[data-k="letters"]');
  await sleep(200);
  t.equal(await text(page, '#g-best'), '–', 'Odd: the letters have a best score of their own');
  f = await field();
  t.check(f.tiles === 4 && f.kinds === 2 && /^[A-Za-z0-9]$/.test(f.sample), `Odd: the other kind shows signs instead of colours (${f.sample})`);
  await page.click(`#od-grid button[data-i="${f.odd}"]`);
  t.equal(await text(page, '#g-score'), '1', 'Odd: and the odd sign is found the same way');
  t.problems(page, 'odd');
  await page.close();

  // ---------------------------------------------------------------- Rock Paper Scissors
  page = await open('#rps');
  await sleep(500);
  // The devil's hand is fixed by fixing chance: 0.99 is scissors, 0.4 paper, 0.1 rock. The game is started over so that it uses this chance.
  const fate = (value) => page.evaluate((v) => { window.fate = v; }, value);
  await page.evaluate(() => { window.fate = 0.99; Math.random = () => window.fate; document.querySelector('#g-restart').click(); });
  await sleep(200);
  const round = async (how) => { await how(); await sleep(850); return [await text(page, '#rp-msg'), await text(page, '#g-score'), await text(page, '#g-best'), await page.evaluate(() => [document.querySelector('#rp-you').dataset.hand, document.querySelector('#rp-devil').dataset.hand])]; };
  t.equal(await round(() => page.keyboard.press('1')), ['Rock beats scissors: you win', '1', '1', ['rock', 'scissors']], 'RPS: rock beats scissors');
  await fate(0.1);
  t.equal(await round(() => page.click('#rp-keys button[data-h="rock"]')), ['Rock twice: a draw', '1', '1', ['rock', 'rock']], 'RPS: a draw keeps the streak');
  t.equal(await round(() => page.keyboard.press('p')), ['Paper beats rock: you win', '2', '2', ['paper', 'rock']], 'RPS: paper beats rock, two wins in a row');
  await fate(0.99);
  t.equal(await round(() => page.keyboard.press('2')), ['Scissors beat paper: the devil wins', '0', '2', ['paper', 'scissors']], 'RPS: a lost round ends the streak, the best stays');
  await fate(0.4);
  t.equal(await round(() => page.keyboard.press('s')), ['Scissors beat paper: you win', '1', '2', ['scissors', 'paper']], 'RPS: scissors beat paper');
  t.equal(await text(page, '#g-status'), '3 won · 1 drawn · 1 lost', 'RPS: the rounds are counted');
  await fate(0.99);
  await page.keyboard.press('3'); await page.keyboard.press('1'); // a second hand while the fists are still coming down is ignored
  await sleep(850);
  t.equal(await text(page, '#g-status'), '3 won · 2 drawn · 1 lost', 'RPS: one hand at a time');
  t.problems(page, 'rps');
  await page.close();

  // ---------------------------------------------------------------- on a phone everything fits without scrolling sideways
  const phone = await open('', { mobile: true });
  for (const [id, sel] of [['sens', '#sn-list'], ['stroop', '#st-keys'], ['odd', '#od-grid'], ['rps', '#rp-keys']]) {
    await phone.evaluate((h) => { location.hash = h; }, id);
    await sleep(500);
    const box = await phone.$eval(sel, (el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, wide: document.documentElement.scrollWidth }; });
    t.check(box.left >= 0 && box.right <= 390 && box.wide <= 390 && box.top < 780, `phone, ${id}: fits the width of the screen`);
  }
  t.equal(await phone.$eval('#g-title', (el) => [el.textContent, el.scrollWidth <= el.clientWidth]), ['Rock Paper Scissors', true], 'phone: a long name is not cut short in the header');
  t.problems(phone, 'phone');
  await phone.close();
}
