// Sandbox: the first scene, drawing with the materials, things that fall and things that stay, pause and clear.
import { sleep } from '../lib.mjs';

// What is on the canvas: how many cells are not empty, and where the blue (water) and the grey (stone) ones are.
const look = (page) => page.$eval('#sb-c', (cv) => {
  const { width: w, height: h } = cv, d = cv.getContext('2d').getImageData(0, 0, w, h).data;
  const out = { w, h, filled: 0, water: 0, stone: 0, waterRows: [h, -1], stoneRows: [h, -1], sum: 0 };
  for (let i = 0; i < w * h; i++) {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], y = Math.floor(i / w);
    out.sum = (out.sum * 31 + r + g * 3 + b * 7) % 1000000007;
    if (r < 20 && g < 20 && b < 20) continue;
    out.filled++;
    if (b > r + 80) { out.water++; out.waterRows = [Math.min(out.waterRows[0], y), Math.max(out.waterRows[1], y)]; }
    else if (Math.abs(r - g) < 14 && Math.abs(g - b) < 14 && r > 90 && r < 150) { out.stone++; out.stoneRows = [Math.min(out.stoneRows[0], y), Math.max(out.stoneRows[1], y)]; }
  }
  return out;
});

export default async function ({ t, open }) {
  const page = await open('#sand');
  await sleep(600);
  const box = await (await page.$('#sb-c')).boundingBox();
  const at = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy];
  const stroke = async (from, to) => { await page.mouse.move(...at(...from)); await page.mouse.down(); await page.mouse.move(...at(...to), { steps: 10 }); await page.mouse.up(); };
  const tool = () => page.$eval('#sb-tools .on', (b) => b.textContent.trim());

  let now = await look(page);
  t.equal([now.w, now.h], [200, 120], 'a wide screen gets a field of 200 by 120 cells');
  t.check(now.filled > 2500 && now.water > 500 && now.stone > 50, `the first scene has things in it (${now.filled} cells, ${now.water} of water, ${now.stone} of stone)`);
  t.equal([await tool(), await page.$eval('#sb-size .on', (b) => b.textContent)], ['Sand', 'M'], 'sand and a middle brush to start with');
  t.equal(await page.$$eval('#sb-tools button', (l) => l.map((b) => b.textContent.trim())), ['Sand', 'Water', 'Stone', 'Wood', 'Oil', 'Fire', 'Lava', 'Eraser'], 'the materials');

  await page.click('#sb-clear');
  await sleep(150);
  t.equal((await look(page)).filled, 0, 'Clear empties the field');

  // ---- water falls and gathers at the bottom
  await page.keyboard.press('2');
  t.equal(await tool(), 'Water', 'the key 2 picks water');
  await stroke([0.3, 0.2], [0.7, 0.2]);
  await sleep(1500);
  now = await look(page);
  t.check(now.water > 80 && now.waterRows[0] > now.h * 0.8, `water drawn in the air ends up at the bottom (${now.water} cells, rows ${now.waterRows.join(' to ')})`);

  // ---- stone stays where it is drawn
  await page.click('#sb-tools button[data-k="2"]');
  t.equal(await tool(), 'Stone', 'a click picks stone');
  await stroke([0.2, 0.5], [0.8, 0.5]);
  await sleep(600);
  const stone = await look(page);
  t.check(stone.stone > 300 && stone.stoneRows[0] >= 55 && stone.stoneRows[1] <= 65, `stone stays in the air where it was drawn (${stone.stone} cells, rows ${stone.stoneRows.join(' to ')})`);
  // sand poured on it stays on top of it
  await page.keyboard.press('1');
  await stroke([0.45, 0.1], [0.55, 0.1]);
  await sleep(1200);
  const sand = await page.$eval('#sb-c', (cv) => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let above = 0, below = 0; for (let i = 0; i < cv.width * cv.height; i++) { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]; if (r > 190 && g > 150 && b > 80 && b < 150) { if (Math.floor(i / cv.width) < 60) above++; else below++; } } return { above, below }; });
  t.check(sand.above > 40 && sand.below === 0, `sand poured on the stone lies on it (${sand.above} grains above, ${sand.below} below)`);

  // ---- pause freezes the picture, the eraser rubs things out
  await page.keyboard.press('2'); await stroke([0.1, 0.1], [0.15, 0.1]); // some water on its way down
  await page.keyboard.press('Space');
  await sleep(100);
  const frozen = await look(page);
  await sleep(500);
  t.equal([(await look(page)).sum, await page.$eval('#sb-pause', (b) => b.textContent.trim())], [frozen.sum, 'Resume'], 'Space pauses: nothing moves');
  await page.keyboard.press('8');
  t.equal(await tool(), 'Eraser', 'the key 8 picks the eraser');
  await page.click('#sb-size button[data-k="2"]');
  await stroke([0.15, 0.5], [0.85, 0.5]);
  await sleep(150);
  t.check((await look(page)).stone < 20, 'the eraser with the big brush rubs the stone out, even while paused');
  await page.click('#sb-pause');
  await sleep(1200);
  now = await look(page);
  t.check(now.sum !== frozen.sum && await page.$eval('#sb-pause', (b) => b.textContent.trim()) === 'Pause', 'the button resumes');

  // ---- brush sizes
  await page.click('#sb-clear'); await page.keyboard.press('3'); await page.keyboard.press('Space');
  const dab = async (fx) => { const before = (await look(page)).stone; await page.mouse.click(...at(fx, 0.5)); await sleep(120); return (await look(page)).stone - before; };
  await page.keyboard.press('['); await page.keyboard.press('[');
  const small = await dab(0.2);
  await page.keyboard.press(']');
  const mid = await dab(0.5);
  await page.keyboard.press(']');
  const big = await dab(0.8);
  t.check(small > 0 && small < mid && mid < big, `[ and ] change the brush (${small}, ${mid} and ${big} cells for one click)`);

  await page.click('#g-restart');
  await sleep(300);
  now = await look(page);
  t.check(now.filled > 2500 && await page.$eval('#sb-pause', (b) => b.textContent.trim()) === 'Pause', 'Restart brings the first scene back, and running');
  t.problems(page);
  await page.close();

  // ---- on a phone: a field that stands upright, drawn on with a finger
  const phone = await open('#sand', { mobile: true });
  await sleep(600);
  const size = await look(phone), pb = await (await phone.$('#sb-c')).boundingBox();
  t.equal([size.w, size.h], [112, 136], 'phone: a narrow screen gets an upright field');
  t.check(pb.width > 250 && pb.x >= 0 && pb.x + pb.width <= 390 && await phone.evaluate(() => document.querySelector('#sb-clear').getBoundingClientRect().bottom <= innerHeight), `phone: the field and the buttons under it are on the screen (${Math.round(pb.width)} px wide)`);
  await phone.click('#sb-clear');
  await phone.click('#sb-tools button[data-k="2"]');
  await phone.touchscreen.touchStart(pb.x + pb.width * 0.2, pb.y + pb.height * 0.5);
  for (let k = 1; k <= 10; k++) await phone.touchscreen.touchMove(pb.x + pb.width * (0.2 + 0.06 * k), pb.y + pb.height * 0.5);
  await phone.touchscreen.touchEnd();
  await sleep(300);
  const drawn = await look(phone);
  t.check(drawn.stone > 100 && drawn.stoneRows[0] > 55 && drawn.stoneRows[1] < 80, `phone: a finger draws (${drawn.stone} cells of stone)`);
  t.problems(phone, 'phone');
  await phone.close();
}
