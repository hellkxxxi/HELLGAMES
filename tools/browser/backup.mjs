// The scores can be saved to a file and loaded from one: the way to carry them to another browser,
// since the site has no accounts.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sleep } from '../lib.mjs';

export default async function ({ t, open }) {
  const page = await open();
  await sleep(500);
  const text = (sel) => page.$eval(sel, (e) => e.textContent.trim());
  const best = (id) => page.$eval(`#grid .card[href="#${id}"] .best b`, (e) => e.textContent);
  // the file the page offers for download is caught instead of being written to disk
  await page.evaluate(() => { window.offered = []; const make = URL.createObjectURL.bind(URL); URL.createObjectURL = (blob) => { blob.text().then((body) => window.offered.push(body)); return make(blob); }; });

  await page.click('#bk-save');
  t.equal([await text('#bk-msg'), await page.evaluate(() => window.offered.length)], ['Nothing has been saved yet: play something first.', 0], 'a new visitor has nothing to save');

  await page.evaluate(() => {
    localStorage.setItem('arcade:best:snake', '42'); localStorage.setItem('arcade:best:aim:grid', '77'); localStorage.setItem('arcade:souls', '1234');
    localStorage.setItem('somebody-else', 'not ours');
  });
  await page.click('#bk-save');
  await sleep(300);
  const file = JSON.parse(await page.evaluate(() => window.offered[0]));
  t.check(/^Saved 3 entries to hellgames-\d{4}-\d\d-\d\d\.json\.$/.test(await text('#bk-msg')), `the page says what it saved (${await text('#bk-msg')})`);
  t.equal([file.app, /^\d+\.\d+\.\d+$/.test(file.version), !Number.isNaN(Date.parse(file.saved)), file.data], ['hellgames', true, true, { 'arcade:best:aim:grid': '77', 'arcade:best:snake': '42', 'arcade:souls': '1234' }], 'the file holds everything the site remembers, in order, and nothing else');

  // another browser: nothing is remembered there until the file is loaded
  const folder = mkdtempSync(join(tmpdir(), 'hellgames-'));
  const good = join(folder, 'progress.json'), other = join(folder, 'other.json'), broken = join(folder, 'broken.json'), sneaky = join(folder, 'sneaky.json');
  writeFileSync(good, JSON.stringify(file));
  writeFileSync(other, JSON.stringify({ app: 'something else', data: { 'arcade:best:snake': '999' } }));
  writeFileSync(broken, '{ not json');
  writeFileSync(sneaky, JSON.stringify({ app: 'hellgames', data: { 'arcade:best:snake': '999', 'not-ours': 'x' } }));
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await sleep(500);
  t.equal([await best('snake'), await best('aim')], ['–', '–'], 'a browser that knows nothing shows no scores');
  const input = await page.$('#bk-file');
  for (const [path, why] of [[other, 'a file of another program'], [broken, 'a file that cannot be read'], [sneaky, 'a file with entries that are not the site’s']]) {
    await input.uploadFile(path);
    await sleep(300);
    t.equal([await text('#bk-msg'), await best('snake'), await page.evaluate(() => localStorage.length)], ['That is not a file saved from hellgames. Nothing was changed.', '–', 0], `${why} is refused`);
  }
  await input.uploadFile(good);
  await sleep(300);
  t.equal([await text('#bk-msg'), await best('snake'), await best('aim'), await page.evaluate(() => localStorage.getItem('arcade:souls'))], ['Loaded 3 entries. The scores below are the ones from the file.', '42', '77', '1234'], 'the saved file brings the scores back');
  await input.uploadFile(good);
  await sleep(300);
  t.equal(await text('#bk-msg'), 'Loaded 3 entries. The scores below are the ones from the file.', 'the same file can be loaded twice');
  t.check(await page.$eval('.backup', (el) => el.getBoundingClientRect().width <= innerWidth), 'the line about files fits the page');
  t.problems(page, 'backup');
  await page.close();
}
