// Last Hit and Hold the Angle. Both are played here the way a person plays them, by looking: the test
// reads the picture, strikes when a health bar turns yellow, and shoots when a head shows.
import { sleep } from '../lib.mjs';

export default async function ({ t, open }) {
  const text = (page, sel) => page.$eval(sel, (e) => e.textContent.trim());
  const overlay = async (page) => (await page.$eval('#overlay', (o) => !o.classList.contains('hidden'))) && [await text(page, '#ov-title'), await text(page, '#ov-text')];

  // ---------------------------------------------------------------- Last Hit
  let page = await open('#lasthit');
  await sleep(500);
  t.equal([await text(page, '#g-status'), await text(page, '#g-score'), await page.$$eval('#lh-kind button', (l) => l.map((b) => b.textContent))], ['20 creeps in 5 waves', '0', ['Melee', 'Ranged']], 'Last Hit: twenty creeps wait, with a sword or with a bow');
  await sleep(700);
  t.equal(await text(page, '#g-status'), '20 creeps in 5 waves', 'Last Hit: nothing happens before the first click');
  // A whole game: every frame the health bars of the enemy creeps are looked at, and a creep whose bar has turned yellow is hit.
  const blows = await page.evaluate(() => new Promise((done) => {
    const cv = document.querySelector('#lh-c'), ctx = cv.getContext('2d'), W = cv.width, H = cv.height, r = Math.min(W, H) * 0.06, box = cv.getBoundingClientRect();
    const creeps = [0.2, 0.4, 0.6, 0.8].flatMap((slot) => [0.33, 0.16].map((row) => [slot * W, row * H])); // the front row of the enemy, and the row behind it
    const click = (x, y) => cv.dispatchEvent(new PointerEvent('pointerdown', { clientX: box.left + x / W * box.width, clientY: box.top + y / H * box.height, pointerType: 'mouse', bubbles: true, cancelable: true }));
    let sent = 0;
    click(W / 2, H / 2); // starts the game
    const watch = () => {
      if (!document.querySelector('#overlay').classList.contains('hidden')) { done(sent); return; }
      for (const [x, y] of creeps) {
        const [red, green, blue] = ctx.getImageData(Math.round(x - r * 1.4 + 2), Math.round(y - r * 2.05 + Math.max(6, r * 0.4) / 2), 1, 1).data; // the left end of its bar
        if (red > 240 && green > 200 && blue < 120) { click(x, y); sent++; break; }
      }
      requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  }));
  const end = await overlay(page), got = end && end[1].match(/^(\d+) of 20 last hits \((\d+)%\) · (\d+) denied · (\d+) blows$/);
  t.check(end && end[0] === 'New best!' && got && Number(got[1]) >= 14 && Number(got[2]) === Number(got[1]) * 5 && got[3] === '0', `Last Hit: a player who strikes when a bar turns yellow gets most of the creeps (${end}; ${blows} clicks)`);
  t.equal([await text(page, '#g-score'), await text(page, '#g-best')], [got ? got[1] : '', got ? got[1] : ''], 'Last Hit: the last hits are the score');
  await sleep(700);
  await page.click('#ov-btn');
  await sleep(200);
  await page.click('#lh-kind button[data-k="ranged"]');
  await sleep(200);
  t.equal([await page.$eval('#lh-kind .on', (b) => b.dataset.k), await text(page, '#g-best')], ['ranged', '–'], 'Last Hit: the bow has a best score of its own');
  t.problems(page, 'lasthit');
  await page.close();

  // ---------------------------------------------------------------- Hold the Angle
  page = await open('#peek');
  await sleep(500);
  t.equal([await text(page, '#g-status'), await text(page, '#g-score'), await text(page, '#g-score-label')], ['12 duels', '–', 'Avg'], 'Angle: twelve duels wait');
  // Looks at every place an enemy can lean out of; `shoot` says where to fire once a head is seen there (as a share of the head's size: 0, 0 is its middle).
  const duel = (shoot, count) => page.evaluate((offset, wanted) => new Promise((done) => {
    const cv = document.querySelector('#pk-c'), ctx = cv.getContext('2d'), W = cv.width, box = cv.getBoundingClientRect();
    import('./js/games/peek.js').then(({ SPOTS, LEVELS }) => {
      const r = LEVELS.normal.head, fire = (x, y) => cv.dispatchEvent(new PointerEvent('pointerdown', { clientX: box.left + x * box.width, clientY: box.top + y * box.width, pointerType: 'mouse', bubbles: true, cancelable: true }));
      let fired = 0, seen = 0;
      const watch = () => {
        if (!document.querySelector('#overlay').classList.contains('hidden') || seen >= wanted) { done(fired); return; }
        for (const s of SPOTS) {
          const [red, green, blue] = ctx.getImageData(Math.round((s.x + r * 0.45) * W), Math.round((s.y + r * 0.45) * W), 1, 1).data; // a spot of the face beside the sights
          if (red > 225 && green > 55 && green < 85 && blue > 55 && blue < 85) { for (const [dx, dy] of offset) { fire(s.x + dx * r, s.y + dy * r); fired++; } seen++; break; }
        }
        requestAnimationFrame(watch);
      };
      requestAnimationFrame(watch);
    });
  }), shoot, count);
  const box = await (await page.$('#pk-c')).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  t.equal(await text(page, '#g-status'), 'Duel 1 of 12', 'Angle: a click starts the first duel');
  await duel([[0, 0]], 99);
  await sleep(700);
  const won = await overlay(page), avg = won && won[1].match(/^Average (\d+) ms · 12 headshots of 12 kills · 0 lost · 100% of the shots hit$/);
  t.check(won && won[0] === 'New best!' && avg && Number(avg[1]) < 300, `Angle: twelve heads shot the moment they show (${won})`);
  t.equal(await text(page, '#g-best'), avg ? `${avg[1]} ms` : '', 'Angle: the average time is the score, and the less the better');
  await sleep(300);
  await page.click('#ov-btn');
  await sleep(200);
  // a duel that is lost, then one that is won by two shots in the body
  await page.mouse.click(box.x + 8, box.y + 8);
  for (let k = 0; k < 60 && await text(page, '#g-status') !== 'Duel 2 of 12'; k++) await sleep(100);
  t.equal([await text(page, '#g-status'), await text(page, '#g-score')], ['Duel 2 of 12', '1650 ms'], 'Angle: whoever does not shoot is shot, and that duel counts as 1650 ms');
  const shots = await duel([[0, 2.5], [0, 2.5]], 1);
  await sleep(200);
  const mixed = Number((await text(page, '#g-score')).replace(' ms', ''));
  t.check(shots === 2 && await text(page, '#g-status') === 'Duel 3 of 12' && mixed > 825 && mixed < 1000, `Angle: two shots in the body win a duel as well (${await text(page, '#g-status')}, average ${mixed} ms)`);
  await page.click('#pk-level button[data-l="hard"]');
  await sleep(200);
  t.equal([await text(page, '#g-status'), await text(page, '#g-best')], ['12 duels', '–'], 'Angle: the hard level starts afresh with a best time of its own');
  t.problems(page, 'peek');
  await page.close();

  // ---------------------------------------------------------------- on a phone
  const phone = await open('', { mobile: true });
  for (const [id, sel, status] of [['lasthit', '#lh-c', 'Wave 1 of 5 · 0 lost'], ['peek', '#pk-c', 'Duel 1 of 12']]) {
    await phone.evaluate((h) => { location.hash = h; }, id);
    await sleep(500);
    const r = await (await phone.$(sel)).boundingBox();
    t.check(r.x >= 0 && r.x + r.width <= 390 && r.y + r.height <= 780 && r.width > 300, `phone, ${id}: the picture fits the screen (${Math.round(r.width)}x${Math.round(r.height)})`);
    await phone.touchscreen.tap(r.x + r.width / 2, r.y + r.height * 0.9);
    await sleep(300);
    t.equal(await text(phone, '#g-status'), status, `phone, ${id}: a tap starts the game`);
  }
  t.problems(phone, 'phone');
  await phone.close();
}
