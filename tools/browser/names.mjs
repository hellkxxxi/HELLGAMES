// Name Forge: batches of names in four kinds, copying one, keeping some for later.
import { sleep } from '../lib.mjs';

export default async function ({ t, open, browser, url }) {
  await browser.defaultBrowserContext().overridePermissions(new URL(url).origin, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']).catch(() => {});
  const page = await open('#names');
  await page.bringToFront();
  await sleep(700);
  const names = () => page.$$eval('#nm-list .nm-copy', (l) => l.map((b) => b.textContent));
  const kept = () => page.$$eval('#nm-kept .nm-copy', (l) => l.map((b) => b.textContent));
  const kind = () => page.$eval('#nm-style .on', (b) => b.dataset.s);

  const first = await names();
  t.equal([first.length, new Set(first).size, await kind()], [10, 10, 'nick'], 'ten different nicknames to start with');
  t.check(first.every((n) => /^[A-Za-z0-9_]{3,16}$/.test(n)), `nicknames are made of letters, digits and underscores (${first.join(' ')})`);
  await page.keyboard.press('Space');
  const second = await names();
  t.check(second.length === 10 && second.join() !== first.join(), 'Space makes another batch');
  await page.click('#nm-go');
  t.check((await names()).join() !== second.join(), 'and so does the button');

  // ---- the four kinds
  await page.click('#nm-style button[data-s="fantasy"]');
  t.check((await names()).every((n) => /^[A-Z][a-z]{3,9}$/.test(n)), `fantasy names (${(await names()).join(' ')})`);
  await page.keyboard.press('3');
  t.equal(await kind(), 'word', 'the key 3 switches to made-up words');
  t.check((await names()).every((n) => /^[a-z]{5,9}$/.test(n)), `English-looking words (${(await names()).join(' ')})`);
  await page.keyboard.press('4');
  const slova = await names();
  t.check(slova.every((n) => /^[а-я]{5,9}$/.test(n)) && await page.$eval('#nm-list', (l) => l.lang) === 'ru', `Russian-looking words (${slova.join(' ')})`);
  const real = await page.evaluate(async (list) => { const { HELLWORDS } = await import('./js/data/hellword.js'); const known = new Set(HELLWORDS.ru.guesses); return list.filter((w) => known.has(w)); }, slova);
  t.equal(real, [], 'none of them is a word of the game\'s own dictionary');

  // ---- copying and keeping
  await page.click('#nm-list li:nth-child(3) .nm-copy');
  await sleep(150);
  t.equal(await page.$eval('#nm-msg', (e) => e.textContent), `Copied “${slova[2]}”`, 'a click on a name says it was copied');
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch((e) => 'unreadable: ' + e.name));
  t.check(clip === slova[2] || clip.startsWith('unreadable'), `and it is on the clipboard (${clip})`);
  await page.click('#nm-list li:nth-child(1) .nm-star');
  await page.click('#nm-list li:nth-child(5) .nm-star');
  t.equal([await kept(), await page.$$eval('#nm-list .nm-star.on', (l) => l.length)], [[slova[4], slova[0]], 2], 'the star keeps a name, the newest first');
  await page.click('#nm-list li:nth-child(1) .nm-star');
  t.equal(await kept(), [slova[4]], 'a second click on the star lets it go');
  await page.keyboard.press('1');
  await page.click('#nm-list li:nth-child(2) .nm-star');
  const nick = (await names())[1];
  await page.reload({ waitUntil: 'load' });
  await sleep(700);
  t.equal([await kept(), await kind()], [[nick, slova[4]], 'nick'], 'the kept names and the kind are still there after the page was closed');
  await page.click('#nm-kept .nm-drop');
  t.equal(await kept(), [slova[4]], 'the cross removes a kept name');
  await page.click('#nm-kept .nm-copy');
  await sleep(150);
  t.equal(await page.$eval('#nm-msg', (e) => e.textContent), `Copied “${slova[4]}”`, 'a kept name can be copied too');
  t.problems(page);
  await page.close();
}
