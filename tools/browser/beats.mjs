// Beat Maker: squares switch on and off, a stroke paints several, the loop plays, and the beat is kept.
import { sleep } from '../lib.mjs';

export default async function ({ t, open }) {
  const page = await open('#beats');
  await sleep(500);
  const on = () => page.$$eval('.bt-cell.on', (l) => l.map((c) => `${c.dataset.r}:${c.dataset.s}`));
  const cell = (row, step) => `.bt-cell[data-r="${row}"][data-s="${step}"]`;
  const isOn = (row, step) => page.$eval(cell(row, step), (c) => c.classList.contains('on'));
  const middle = async (row, step) => { const b = await (await page.$(cell(row, step))).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
  const demo = await page.evaluate(async () => { const { DEMO } = await import('./js/games/beats.js'); return Object.entries(DEMO.rows).flatMap(([row, steps]) => [...steps].map((c, s) => (c === 'x' ? `${row}:${s}` : null)).filter(Boolean)); });

  t.equal(await page.$$eval('.bt-cell', (l) => l.length), 14 * 16, 'fourteen rows of sixteen squares');
  t.equal((await on()).sort(), [...demo].sort(), 'a new player finds a beat to start from');
  t.equal(await page.$eval('#bt-bpm', (e) => e.textContent), '112 BPM', 'and its tempo');

  // ---- switching squares
  t.equal(await isOn('snare', 2), false, 'this square is off');
  await page.click(cell('snare', 2));
  t.equal(await isOn('snare', 2), true, 'a click switches it on');
  await page.click(cell('snare', 2));
  t.equal(await isOn('snare', 2), false, 'another click switches it off');
  const [x0, y0] = await middle('snare', 4), [x1, y1] = await middle('snare', 9);
  await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, { steps: 12 }); await page.mouse.up();
  t.equal((await on()).filter((c) => c.startsWith('snare:')), ['snare:4', 'snare:5', 'snare:6', 'snare:7', 'snare:8', 'snare:9'], 'a stroke across a row switches on every square it passes');
  await page.mouse.move(x1, y1); await page.mouse.down(); await page.mouse.move(x0, y0, { steps: 12 }); await page.mouse.up();
  t.equal((await on()).filter((c) => c.startsWith('snare:')), [], 'a stroke that starts on a lit square switches them off');
  await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control');
  t.equal((await on()).filter((c) => c.startsWith('snare:')).length, 6, 'Ctrl+Z takes back the whole stroke');
  await page.click('#bt-undo'); await page.click('#bt-undo'); await page.click('#bt-undo');
  t.equal([(await on()).sort().join(), await page.$eval('#bt-undo', (b) => b.disabled)], [[...demo].sort().join(), true], 'and the Undo button the ones before it');

  // ---- playing
  const playhead = () => page.$$eval('.bt-cell.now', (l) => [...new Set(l.map((c) => Number(c.dataset.s)))]);
  t.equal([await playhead(), await page.$eval('#bt-play', (b) => b.textContent.trim())], [[], 'Play'], 'silent at first');
  await page.keyboard.press('Space');
  const seen = new Set();
  for (let i = 0; i < 30; i++) { await sleep(60); const now = await playhead(); t.check(now.length <= 1, 'one column plays at a time'); if (now.length) seen.add(now[0]); }
  t.check(seen.size >= 8, `Space starts the loop and the playhead runs along it (columns seen: ${[...seen].join(' ')})`);
  t.equal(await page.$eval('#bt-play', (b) => b.textContent.trim()), 'Stop', 'the button now stops it');
  await page.click(cell('kick', 3));
  t.equal(await isOn('kick', 3), true, 'squares can be switched while it plays');
  await page.click('.bt-tempo button[data-d="5"]');
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
  t.equal(await page.$eval('#bt-bpm', (e) => e.textContent), '112 BPM', 'the tempo goes up and down, by button and by key');
  await page.click('#bt-play');
  await sleep(150);
  t.equal([await playhead(), await page.$eval('#bt-play', (b) => b.textContent.trim())], [[], 'Play'], 'and stops');

  // ---- clear, random, and what is kept
  await page.click('#bt-clear');
  t.equal(await on(), [], 'Clear switches everything off');
  await page.click('#bt-undo');
  t.equal((await on()).length, demo.length + 1, 'and can be undone');
  await page.click('#bt-rand');
  const random = await on();
  t.check(random.includes('kick:0') && random.join() !== [...demo, 'kick:3'].sort().join() && random.length > 15, 'Random makes another beat');
  await page.click('.bt-tempo button[data-d="-5"]');
  const tempo = await page.$eval('#bt-bpm', (e) => e.textContent);
  await page.reload({ waitUntil: 'load' });
  await sleep(500);
  t.equal([(await on()).join(), await page.$eval('#bt-bpm', (e) => e.textContent)], [random.join(), tempo], 'the beat and its tempo are still there after the page was closed');
  await page.click('#g-restart');
  t.equal((await on()).sort().join(), [...demo].sort().join(), 'Restart brings back the beat the game came with');
  t.problems(page);
  await page.close();

  // ---- on a phone
  const phone = await open('#beats', { mobile: true });
  await sleep(500);
  const box = await phone.evaluate(() => { const cells = [...document.querySelectorAll('.bt-cell')].map((c) => c.getBoundingClientRect()); return { w: Math.min(...cells.map((r) => r.width)), right: Math.max(...cells.map((r) => r.right)), bottom: Math.max(...cells.map((r) => r.bottom)) }; });
  t.check(box.right <= 390 && box.bottom <= 780 && box.w >= 15, `phone: all sixteen steps are on the screen (squares of ${box.w.toFixed(1)} px)`);
  const b = await (await phone.$(cell('snare', 6))).boundingBox();
  await phone.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  t.equal(await phone.$eval(cell('snare', 6), (c) => c.classList.contains('on')), true, 'phone: a tap switches a square');
  await phone.touchscreen.touchStart(b.x + b.width / 2, b.y + b.height / 2);
  for (let k = 1; k <= 8; k++) await phone.touchscreen.touchMove(b.x + b.width / 2 + k * (b.width + 3) * 0.5, b.y + b.height / 2);
  await phone.touchscreen.touchEnd();
  t.equal(await phone.$$eval('.bt-cell.on[data-r="snare"]', (l) => l.length), 0, 'phone: a finger dragged along a row paints it (here: off, since it started on a lit square)');
  t.equal(await phone.evaluate(() => scrollY), 0, 'phone: the page does not scroll under the finger');
  t.problems(phone, 'phone');
  await phone.close();
}
