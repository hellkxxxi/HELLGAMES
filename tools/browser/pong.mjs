// Hell Pong on the page: the paddle follows the mouse and the keys, points are counted, two can play.
// (Whole matches and the levels of the computer are tested with the rules, without a browser.)
import { sleep } from '../lib.mjs';

// Where the paddles are: the middle of the orange and of the red one, as a share of the way across the table.
const paddles = (page) => page.$eval('#pg-c', (cv) => {
  const { width: w, height: h } = cv, d = cv.getContext('2d').getImageData(0, 0, w, h).data, wide = w >= h;
  const sums = { orange: [0, 0], red: [0, 0] };
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
    const i = (y * w + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
    const along = wide ? x / w : 1 - y / h, across = wide ? y / h : x / w; // 0 is the end of the first player
    if (r > 235 && g > 120 && g < 160 && b > 40 && b < 80 && along < 0.1) { sums.orange[0] += across; sums.orange[1]++; }
    if (r > 225 && g > 45 && g < 85 && b > 75 && b < 115 && along > 0.9) { sums.red[0] += across; sums.red[1]++; }
  }
  return { wide, orange: sums.orange[1] ? sums.orange[0] / sums.orange[1] : null, red: sums.red[1] ? sums.red[0] / sums.red[1] : null };
});

export default async function ({ t, open }) {
  const page = await open('#pong');
  await sleep(600);
  const text = (sel) => page.$eval(sel, (e) => e.textContent);
  const box = await (await page.$('#pg-c')).boundingBox();
  t.equal([await text('#g-status'), await text('#g-score'), await page.$eval('#pg-mode .on', (b) => b.dataset.m)], ['First to 7', '0', 'easy'], 'a match against the easy computer is ready');
  t.check((await paddles(page)).wide && box.width > box.height, 'a wide screen shows the table lying down');

  // ---- the mouse moves the paddle
  await page.keyboard.press('Space'); // serve; until then the table is dimmed
  await sleep(150);
  let now = await paddles(page);
  t.check(Math.abs(now.orange - 0.5) < 0.03 && Math.abs(now.red - 0.5) < 0.06, `both paddles start in the middle (${JSON.stringify(now)})`);
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.25);
  await sleep(250);
  now = await paddles(page);
  t.check(Math.abs(now.orange - 0.25) < 0.04, `the paddle goes where the mouse is (${now.orange?.toFixed(3)})`);
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.99);
  await sleep(250);
  now = await paddles(page);
  t.check(now.orange > 0.85 && now.orange <= 0.91, `and stops at the edge of the table (${now.orange?.toFixed(3)})`);

  // ---- the keys take over
  await page.keyboard.down('w');
  await sleep(400);
  await page.keyboard.up('w');
  await sleep(100);
  const up = (await paddles(page)).orange;
  t.check(up < now.orange - 0.3, `W moves it up (${up?.toFixed(3)})`);
  await page.keyboard.down('ArrowDown');
  await sleep(300);
  await page.keyboard.up('ArrowDown');
  await sleep(100);
  t.check((await paddles(page)).orange > up + 0.2, 'the arrow keys work as well');

  // ---- a paddle parked in a corner loses points
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.01);
  let point = '';
  for (let i = 0; i < 100 && !/point$/.test(point); i++) { await sleep(150); point = await text('#g-status'); }
  t.check(/^(Their|Your) point$/.test(point), `a point is scored and announced (${point})`);
  await page.keyboard.press('p');
  await sleep(200);
  t.equal([await page.$eval('#overlay', (o) => !o.classList.contains('hidden')), await text('#ov-title')], [true, 'Paused'], 'P pauses');
  await sleep(400);
  await page.keyboard.press('Enter');

  // ---- two players on one keyboard
  await page.click('#pg-mode button[data-m="duo"]');
  await sleep(200);
  t.equal([await text('#g-score'), await text('#g-status')], ['–', 'First to 7'], 'a game for two has no streak to count');
  await page.mouse.move(box.x + box.width / 2, box.y - 40); // the mouse is off the table
  await page.keyboard.press('Space');
  await page.keyboard.down('s'); await page.keyboard.down('ArrowUp');
  await sleep(350);
  await page.keyboard.up('s'); await page.keyboard.up('ArrowUp');
  await sleep(100);
  now = await paddles(page);
  t.check(now.orange > 0.7 && now.red < 0.3, `W and S move the orange paddle, the arrows the red one (${JSON.stringify(now)})`);
  t.problems(page);
  await page.close();

  // ---- a phone shows the table standing up, and each half belongs to a finger
  const phone = await open('#pong', { mobile: true });
  await sleep(600);
  const pb = await (await phone.$('#pg-c')).boundingBox();
  t.check(!(await paddles(phone)).wide && pb.height > pb.width && pb.y + pb.height <= 780, `phone: the table stands up and fits the screen (${Math.round(pb.width)}x${Math.round(pb.height)})`);
  await phone.touchscreen.touchStart(pb.x + pb.width * 0.2, pb.y + pb.height * 0.8); // the first touch serves
  await sleep(250);
  let seen = await paddles(phone);
  t.check(Math.abs(seen.orange - 0.2) < 0.05, `phone: a finger on the lower half moves the player's paddle (${seen.orange?.toFixed(3)})`);
  await phone.touchscreen.touchMove(pb.x + pb.width * 0.75, pb.y + pb.height * 0.8);
  await sleep(250);
  t.check(Math.abs((await paddles(phone)).orange - 0.75) < 0.05, 'phone: and drags it along');
  await phone.touchscreen.touchEnd();
  t.problems(phone, 'phone');
  await phone.close();
}
