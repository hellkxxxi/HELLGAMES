// Helly Bird: the devil falls into the lava without flapping, stays up while flapping, and hell looks like hell.
import { sleep } from '../lib.mjs';

export default async function ({ t, open }) {
  const page = await open('#hellybird');
  await sleep(600);
  const overlayOpen = () => page.$eval('#overlay', (o) => !o.classList.contains('hidden'));
  const untilOverlay = async (ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await overlayOpen()) return Date.now() - t0; await sleep(40); } return null; };
  // The average colour of a horizontal band of the picture; `from` and `to` go from 0 (top) to 1 (bottom).
  const colour = (from, to) => page.$eval('#hb-c', (c, from, to) => {
    const d = c.getContext('2d').getImageData(0, Math.floor(c.height * from), c.width, Math.max(1, Math.floor(c.height * (to - from)))).data;
    const sum = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) { sum[0] += d[i]; sum[1] += d[i + 1]; sum[2] += d[i + 2]; }
    return sum.map((v) => Math.round(v / (d.length / 4)));
  }, from, to);

  t.check(!(await overlayOpen()), 'no start screen: the first flap starts the game');
  const [lr, lg, lb] = await colour(0.89, 1), [sr, sg, sb] = await colour(0.1, 0.3);
  t.check(lr > 130 && lr > lg * 2 && lg > lb, `a lake of lava at the bottom (rgb ${lr}, ${lg}, ${lb})`);
  t.check(sr < 110 && sr > sb && sg < 60 && sb < 60, `a dark red sky, no blue left (rgb ${sr}, ${sg}, ${sb})`);

  // one flap, then nothing: down into the lava
  await page.keyboard.press('Space');
  const fell = await untilOverlay(4000);
  t.check(fell !== null && fell > 800 && fell < 2600, `without flapping the devil drops into the lava (${fell} ms)`);
  t.equal([await page.$eval('#ov-title', (e) => e.textContent), await page.$eval('#ov-text', (e) => e.textContent)], ['Game over', 'Score: 0'], 'the result');

  // flapping keeps it in the air: still alive when the plunge would long be over
  await sleep(750);
  await page.keyboard.press('Enter');
  await sleep(200);
  t.check(!(await overlayOpen()), 'Enter starts again');
  const box = await (await page.$('#hb-c')).boundingBox();
  for (let i = 0; i < 5; i++) { // the keyboard and the mouse in turn
    if (i % 2) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); else await page.keyboard.press('Space');
    await sleep(400);
  }
  t.check(!(await overlayOpen()), 'flapping keeps the devil in the air');
  t.check((await untilOverlay(6000)) !== null, 'flying blind ends at a pillar');
  t.problems(page);
  await page.close();
}
