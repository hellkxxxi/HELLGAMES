// One Tap, played the way a person plays it, by looking: the test reads the picture and fires when the
// head of a runner is on the sights. The clock is in the hands of the test, so that a busy machine cannot
// make it miss.
import { sleep } from '../lib.mjs';

export default async function ({ t, open }) {
  const text = (page, sel) => page.$eval(sel, (e) => e.textContent.trim());
  const overlay = async (page) => (await page.$eval('#overlay', (o) => !o.classList.contains('hidden'))) && [await text(page, '#ov-title'), await text(page, '#ov-text')];

  const page = await open('#onetap');
  await sleep(500);
  const on = () => page.$$eval('.ot-top .seg', (l) => l.map((seg) => seg.querySelector('.on').dataset.v));
  t.equal([await text(page, '#g-status'), await text(page, '#g-score'), await text(page, '#g-score-label'), await text(page, '#g-best'), await on()], ['20 runners', '0', 'Heads', '–', ['medium', 'normal']], 'One Tap: twenty runners wait at the medium gap and at normal speed');
  t.equal(await page.$$eval('.ot-set', (l) => l.map((set) => [set.querySelector('span').textContent, ...[...set.querySelectorAll('button')].map((b) => b.textContent)])), [['Gap', 'Narrow', 'Medium', 'Wide'], ['Speed', 'Slow', 'Normal', 'Fast', 'Hell', 'Random']], 'One Tap: the width of the gap and the speed can be chosen, and the speed can be left to chance');
  // Time is in the hands of the test from here on: it moves the clock a little, lets the game draw, and looks.
  await page.evaluate(() => { window.clock = performance.now(); performance.now = () => window.clock; });
  // How wide the gap is in the picture: the red glow of the room behind it is followed along a line, to the right of the
  // sights, until the wall begins (a wall is brown rather than red, also while the picture is dimmed before a round).
  const gapWidth = () => page.evaluate(() => {
    const cv = document.querySelector('#ot-c'), ctx = cv.getContext('2d'), u = cv.height / 9, row = ctx.getImageData(0, Math.round(4.5 * u), cv.width, 1).data;
    let x = Math.round(cv.width / 2 + u * 0.6);
    while (x < cv.width && row[x * 4] > 30 && row[x * 4] > row[x * 4 + 1] * 2.2) x++;
    return Math.round((x - cv.width / 2) / u * 20) / 10;
  });
  // The player. Every picture it looks for the face of a runner on a line through the heads, and at the colour of
  // the sights; `aim` says when it fires: 'head' with the head on the sights, 'early' while it is still on its way,
  // 'nobody' into the empty gap, 'never' not at all. It stops when the status line reads `until`, or at the result.
  // On the way it notes where each runner was and when (in window.seen), from which their speeds are worked out.
  const player = (aim, until = '') => page.evaluate((aim, until) => new Promise((done) => {
    const cv = document.querySelector('#ot-c'), ctx = cv.getContext('2d'), W = cv.width, u = cv.height / 9, cx = W / 2;
    const status = document.querySelector('#g-status'), seen = window.seen = {};
    const head = () => { // where the middle of a head is, in heads from the sights
      const row = ctx.getImageData(0, Math.round(3.35 * u), W, 1).data;
      let lo = -1, hi = -1;
      for (let x = 0; x < W; x++) { const r = row[x * 4], g = row[x * 4 + 1], b = row[x * 4 + 2]; if (r > 225 && g > 55 && g < 85 && b > 55 && b < 85) { if (lo < 0) lo = x; hi = x; } }
      return lo < 0 ? null : ((lo + hi) / 2 - cx) / u;
    };
    const loaded = () => { // the sights are green while the bullet is in
      const px = ctx.getImageData(Math.round(cx + 0.3 * u), Math.round(3.1 * u) - 2, 1, 5).data;
      for (let k = 0; k < 5; k++) if (px[k * 4 + 1] > 110 && px[k * 4 + 1] > px[k * 4] * 1.4 && px[k * 4 + 1] > px[k * 4 + 2] * 1.3) return true;
      return false;
    };
    let fired = 0, frames = 0;
    const fire = () => { cv.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse', bubbles: true, cancelable: true })); fired++; };
    const look = () => {
      if (!document.querySelector('#overlay').classList.contains('hidden') || status.textContent === until || ++frames > 30000) { done(fired); return; }
      const at = head(), far = at === null ? null : Math.abs(at), bullet = loaded();
      // a runner is measured while the whole of its face is in the gap, and while the bullet is in: after a shot the one in the picture is falling
      if (bullet && at !== null && far <= 2.4) (seen[status.textContent] ||= []).push([window.clock, at]);
      if (bullet && ((aim === 'head' && at !== null && far <= 0.3) || (aim === 'early' && at !== null && far >= 0.8 && far <= 1.6) || (aim === 'nobody' && at === null && !fired))) fire();
      // the clock moves in big steps while there is nothing to do, and in small ones when a head comes near the sights
      window.clock += at === null || !bullet || aim === 'never' ? 45 : far > 1.1 ? 25 : 6;
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  }), aim, until);
  // The dots above the gap say how it went with each runner.
  const dots = (count) => page.evaluate((count) => {
    const cv = document.querySelector('#ot-c'), ctx = cv.getContext('2d'), u = cv.height / 9;
    return Array.from({ length: count }, (_, k) => {
      const [r, g, b] = ctx.getImageData(Math.round(cv.width / 2 + (k - 9.5) * u * 0.5), Math.round(0.45 * u), 1, 1).data;
      return g > 200 && r < 120 ? 'head' : r > 220 && g < 90 ? 'miss' : r > 150 && g > 150 && b > 140 ? 'no shot' : 'to come';
    });
  }, count);
  const frame = (ms) => page.evaluate((ms) => new Promise((done) => { window.clock += ms; requestAnimationFrame(() => requestAnimationFrame(done)); }), ms);
  // How fast the runners of the last player() were, in heads a second: the way between the first and the last look at each of them.
  const speeds = () => page.evaluate(() => Object.values(window.seen).filter((looks) => looks.length > 1).map((looks) => Math.abs(looks.at(-1)[1] - looks[0][1]) / (looks.at(-1)[0] - looks[0][0]) * 1000));
  const tenths = (list) => list.map((v) => v.toFixed(1)).join(' ');
  t.equal(await gapWidth(), 9, 'One Tap: the medium gap is nine heads wide');
  const tapBox = await (await page.$('#ot-c')).boundingBox();
  await page.mouse.click(tapBox.x + tapBox.width / 2, tapBox.y + tapBox.height / 2);
  t.equal([await text(page, '#g-status'), await text(page, '#g-score')], ['Runner 1 of 20', '0'], 'One Tap: a click starts the round, and is no shot yet');
  // a whole round by somebody who fires when the head is on the sights
  const clicks = await player('head');
  await frame(1000);
  const all = await overlay(page);
  t.check(all && all[0] === 'New best!' && /^20 of 20 heads · on average \d+ ms (early|late)$/.test(all[1]) && clicks === 20, `One Tap: twenty heads with twenty bullets (${all}; ${clicks} clicks)`);
  const normal = await speeds();
  t.check(normal.length === 20 && normal.every((v) => Math.abs(v - 11) < 0.25), `One Tap: at normal speed everybody does eleven heads a second (${tenths(normal)})`);
  t.equal([await text(page, '#g-score'), await text(page, '#g-best'), (await dots(20)).join(' ')], ['20', '20', Array(20).fill('head').join(' ')], 'One Tap: the heads are the score, and every dot is green');
  await page.click('#ov-btn');
  await frame(50);
  t.equal([await text(page, '#g-status'), await text(page, '#g-score'), await text(page, '#g-best')], ['20 runners', '0', '20'], 'One Tap: the next round waits for a click again');
  // a round of mistakes: nobody fired at, one shot too early, one into the empty gap, and then a head
  await page.keyboard.press('Space');
  t.equal(await text(page, '#g-status'), 'Runner 1 of 20', 'One Tap: Space starts a round as well');
  t.equal([await player('never', 'Runner 2 of 20'), await text(page, '#g-score'), (await dots(2)).join(', ')], [0, '0', 'no shot, to come'], 'One Tap: whoever is not fired at gets away');
  t.equal([await player('early', 'Runner 3 of 20'), await text(page, '#g-score'), (await dots(3)).join(', ')], [1, '0', 'no shot, miss, to come'], 'One Tap: a shot before the head is there misses, and there is no second bullet');
  t.equal([await player('nobody', 'Runner 4 of 20'), await text(page, '#g-score'), (await dots(4)).join(', ')], [1, '0', 'no shot, miss, miss, to come'], 'One Tap: a shot into the empty gap is the bullet of the one who comes next');
  t.equal([await player('head', 'Runner 5 of 20'), await text(page, '#g-score'), (await dots(5)).join(', ')], [1, '1', 'no shot, miss, miss, head, to come'], 'One Tap: and a shot in time is a head');
  // the settings: every width with every speed has a best score of its own
  await page.click('#ot-width button[data-v="narrow"]');
  await frame(50);
  t.equal([await text(page, '#g-status'), await text(page, '#g-score'), await text(page, '#g-best'), await on(), await gapWidth()], ['20 runners', '0', '–', ['narrow', 'normal'], 6], 'One Tap: the narrow gap is six heads wide and starts afresh, with a best score of its own');
  await page.click('#ot-speed button[data-v="hell"]');
  await page.click('#ot-width button[data-v="wide"]');
  await frame(50);
  t.equal([await on(), await gapWidth(), await page.evaluate(() => [localStorage.getItem('arcade:variant:onetap'), localStorage.getItem('arcade:best:onetap:medium-normal'), localStorage.getItem('arcade:best:onetap:wide-hell')])], [['wide', 'hell'], 12, ['wide-hell', '20', null]], 'One Tap: the wide gap in hell, and what is remembered');
  await page.keyboard.press('Space');
  const hell = await player('head', 'Runner 4 of 20');
  t.equal([hell, await text(page, '#g-score'), (await dots(4)).join(', ')], [3, '3', 'head, head, head, to come'], 'One Tap: at the speed of hell the head is still shot when it is on the sights');
  const fastest = await speeds();
  t.check(fastest.length === 3 && fastest.every((v) => Math.abs(v - 21) < 0.45), `One Tap: and does twenty-one heads a second (${tenths(fastest)})`);
  // Random: every runner has a speed of its own. A whole round, with each of them measured in the picture.
  await page.click('#ot-speed button[data-v="random"]');
  await page.click('#ot-width button[data-v="medium"]');
  await frame(50);
  t.equal([await on(), await gapWidth(), await text(page, '#g-status'), await text(page, '#g-best'), await page.evaluate(() => localStorage.getItem('arcade:variant:onetap'))], [['medium', 'random'], 9, '20 runners', '–', 'medium-random'], 'One Tap: Random is a setting like the speeds, with a best score of its own');
  await page.keyboard.press('Space');
  const mixedClicks = await player('head');
  await frame(1000);
  const mixed = await overlay(page), own = await speeds(), inOrder = [...own].sort((a, b) => a - b);
  t.check(mixed && mixed[0] === 'New best!' && /^20 of 20 heads · on average \d+ ms (early|late)$/.test(mixed[1]) && mixedClicks === 20, `One Tap: twenty heads at twenty speeds (${mixed}; ${mixedClicks} clicks)`);
  t.check(own.length === 20 && inOrder.every((v, k) => v > 7 + 0.7 * k - 0.45 && v < 7 + 0.7 * (k + 1) + 0.45), `One Tap: one runner out of each twentieth of the way from slow to hell (${tenths(inOrder)})`);
  t.check(own.some((v, k) => k && v > own[k - 1] + 3) && own.some((v, k) => k && v < own[k - 1] - 3), `One Tap: now a faster one, now a slower one (${tenths(own)})`);
  t.equal(await page.evaluate(() => [localStorage.getItem('arcade:best:onetap:medium-random'), localStorage.getItem('arcade:best:onetap:medium-normal'), localStorage.getItem('arcade:best:onetap:wide-hell')]), ['20', '20', null], 'One Tap: the best score of Random is kept beside the others');
  await page.click('#ov-btn');
  await frame(50);
  await page.click('#ot-speed button[data-v="normal"]');
  await page.click('#ot-width button[data-v="medium"]');
  await frame(50);
  t.equal([await on(), await text(page, '#g-best')], [['medium', 'normal'], '20'], 'One Tap: back at the first setting its best score is there');
  await page.evaluate(() => { location.hash = ''; });
  await sleep(300);
  t.equal(await page.$eval('a.card[href="#onetap"] .best', (el) => el.textContent.replace(/\s+/g, ' ').trim()), 'Best 20· Medium · Normal', 'One Tap: the home page shows the best score of the setting played last');
  t.problems(page, 'onetap');
  await page.close();

  // ---------------------------------------------------------------- on a phone
  const phone = await open('#onetap', { mobile: true });
  await sleep(500);
  const r = await (await phone.$('#ot-c')).boundingBox();
  t.check(r.x >= 0 && r.x + r.width <= 390 && r.y + r.height <= 780 && r.width > 300, `phone: the picture fits the screen (${Math.round(r.width)}x${Math.round(r.height)})`);
  t.check(await phone.$$eval('.ot-set', (l) => l.length === 2 && l.every((set) => { const box = set.getBoundingClientRect(); return box.left >= 0 && box.right <= 390; }) && l[1].getBoundingClientRect().top > l[0].getBoundingClientRect().bottom - 1) && await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'phone: the two rows of settings fit the screen, one above the other');
  t.equal(await phone.evaluate(() => { const cv = document.querySelector('#ot-c'); return Math.round(cv.width / cv.height * 9); }), 14, 'phone: the picture shows fourteen heads from side to side, so that a head is big enough');
  await phone.touchscreen.tap(r.x + r.width / 2, r.y + r.height * 0.9);
  await sleep(300);
  t.equal(await text(phone, '#g-status'), 'Runner 1 of 20', 'phone: a tap starts the round');
  await phone.tap('#ot-speed button[data-v="fast"]');
  await sleep(200);
  t.equal([await text(phone, '#g-status'), await phone.$$eval('.ot-top .seg', (l) => l.map((seg) => seg.querySelector('.on').dataset.v))], ['20 runners', ['medium', 'fast']], 'phone: the speed is chosen with a tap');
  // a smaller phone: the five speeds still stand side by side, and nothing sticks out of the screen
  for (const width of [360, 320]) {
    await phone.setViewport({ width, height: 640, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await sleep(250);
    const row = await phone.evaluate(() => {
      const boxes = [...document.querySelectorAll('#ot-speed button')].map((b) => b.getBoundingClientRect());
      return { rows: new Set(boxes.map((b) => Math.round(b.top))).size, left: Math.round(Math.min(...boxes.map((b) => b.left))), right: Math.round(Math.max(...boxes.map((b) => b.right))), smallest: Math.round(Math.min(...boxes.map((b) => Math.min(b.width, b.height)))), screen: window.innerWidth, page: document.documentElement.scrollWidth };
    });
    t.check(row.rows === 1 && row.left >= 0 && row.right <= width && row.screen === width && row.page <= width && row.smallest >= 30, `phone, ${width} wide: the five speeds are in one row, on the screen, and big enough for a finger (${JSON.stringify(row)})`);
  }
  t.problems(phone, 'phone');
  await phone.close();
}
