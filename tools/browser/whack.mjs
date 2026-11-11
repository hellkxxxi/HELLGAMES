// Whack-a-Mole: devils rise from the pits, a click or a number key bops them, an empty pit scores nothing.
import { sleep } from '../lib.mjs';

export default async function ({ t, open }) {
  const page = await open('#whack');
  await sleep(500);
  const score = async () => Number(await page.$eval('#g-score', (e) => e.textContent));
  t.equal(await page.$$eval('.wgrid .hole', (list) => list.length), 9, 'nine pits');
  t.check(await page.$$eval('.hole .critter svg', (list) => list.length === 9 && list.every((s) => s.querySelector('.eyes') && s.querySelector('.eyes-hit'))), 'a devil waits in every pit');
  t.equal(await page.$$eval('.hole.up', (list) => list.length), 0, 'nobody is up before the start');
  await page.click('#ov-btn');

  // an empty pit: no points
  await sleep(150);
  const empty = await page.$('.hole:not(.up)');
  const e = await empty.boundingBox();
  await page.mouse.click(e.x + e.width / 2, e.y + e.height / 2);
  t.equal(await score(), 0, 'clicking an empty pit scores nothing');

  // bop every devil that shows up for four seconds, by mouse and by number key in turn
  const KEYS = '789456123'; // the number pad laid over the pits
  let bopped = 0, sawHit = false;
  const until = Date.now() + 4000;
  while (Date.now() < until) {
    const up = await page.$('.hole.up:not(.hit)');
    if (up) {
      const before = await score();
      if (bopped % 2) await page.keyboard.press(KEYS[await up.evaluate((h) => Number(h.dataset.i))]);
      else { const b = await up.boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); }
      if (await score() === before + 1) {
        bopped++;
        const look = await up.evaluate((h) => h.classList.contains('hit') && { eyes: getComputedStyle(h.querySelector('.eyes')).display, crosses: getComputedStyle(h.querySelector('.eyes-hit')).display });
        if (look && look.eyes === 'none' && look.crosses === 'block') sawHit = true;
      }
    }
    await sleep(40);
  }
  t.check(bopped >= 4, `devils were bopped with the mouse and the keyboard (${bopped})`);
  t.equal(await score(), bopped, 'one point for every devil');
  t.check(sawHit, 'a bopped devil gets crosses for eyes');
  t.check(/^\d+s left$/.test(await page.$eval('#g-status', (el) => el.textContent)), 'the clock is running');
  t.problems(page);
  await page.close();
}
