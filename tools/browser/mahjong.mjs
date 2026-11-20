// Mahjong: which tiles can be taken, pairs, undo, hint, shuffle, and a whole table cleared through the page.
import { sleep } from '../lib.mjs';

export default async function ({ t, open }) {
  const page = await open('#mahjong');
  await sleep(600);
  const text = (sel) => page.$eval(sel, (e) => e.textContent);
  const left = () => page.$$eval('.mj-tile:not(.gone)', (l) => l.length);
  const seconds = async () => { const [m, s] = (await text('#g-score')).split(':').map(Number); return m * 60 + s; };
  // Two free tiles with the same picture, and two with different ones.
  const pick = () => page.evaluate(() => {
    const free = [...document.querySelectorAll('.mj-tile:not(.stuck):not(.gone)')], byFace = {};
    for (const el of free) (byFace[el.getAttribute('aria-label')] ||= []).push(el.dataset.i);
    const faces = Object.values(byFace);
    return { pair: faces.find((l) => l.length >= 2).slice(0, 2), odd: [faces[0][0], faces[1][0]], stuck: document.querySelector('.mj-tile.stuck').dataset.i };
  });
  const tile = (i) => `.mj-tile[data-i="${i}"]`;
  const has = (i, name) => page.$eval(tile(i), (el, n) => el.classList.contains(n), name);

  // ---- a wide screen starts with the big layout
  t.equal([await page.$eval('#mj-layout .on', (b) => b.dataset.l), await left()], ['turtle', 144], 'a wide screen starts with the turtle: 144 tiles');
  t.check(/^144 tiles · \d+ moves?$/.test(await text('#g-status')), 'the status counts the tiles and the moves');
  t.equal(await page.$$eval('.mj-tile', (l) => l.every((el) => el.querySelector('svg') && el.getAttribute('aria-label').length >= 3)), true, 'every tile has a picture and a name');
  let now = await pick();

  await page.evaluate((i) => document.querySelector(`.mj-tile[data-i="${i}"]`).click(), now.stuck); // it may lie under another tile, out of the mouse's reach
  t.equal([await has(now.stuck, 'sel'), await has(now.stuck, 'nope'), await page.$$eval('.mj-tile.sel', (l) => l.length)], [false, true, 0], 'a tile that is shut in cannot be picked up, and shakes its head');

  await page.click(tile(now.odd[0]));
  t.equal(await has(now.odd[0], 'sel'), true, 'a free tile is picked up');
  await page.click(tile(now.odd[1]));
  t.equal([await has(now.odd[0], 'sel'), await has(now.odd[1], 'sel'), await left()], [false, true, 144], 'a tile with another picture takes its place in the hand');
  await page.click(tile(now.odd[1]));
  t.equal(await page.$$eval('.mj-tile.sel', (l) => l.length), 0, 'a second click puts it down');

  await page.click(tile(now.pair[0])); await page.click(tile(now.pair[1]));
  t.equal([await left(), await has(now.pair[0], 'gone'), await has(now.pair[1], 'gone')], [142, true, true], 'two free tiles with the same picture leave the table');
  t.check((await text('#g-status')).startsWith('142 tiles'), 'and the count follows');
  await page.keyboard.press('u');
  t.equal([await left(), await page.$eval('#mj-undo', (b) => b.disabled)], [144, true], 'U brings them back');

  const before = await seconds();
  await page.keyboard.press('h');
  const hinted = await page.$$eval('.mj-tile.hint', (l) => l.map((el) => [el.getAttribute('aria-label'), el.classList.contains('stuck')]));
  t.check(hinted.length === 2 && hinted[0][0] === hinted[1][0] && !hinted[0][1] && !hinted[1][1], 'H shows two free tiles with the same picture');
  t.check(await seconds() >= before + 15, 'and costs fifteen seconds');
  const faces = () => page.$$eval('.mj-tile', (l) => l.map((el) => el.getAttribute('aria-label')));
  const facesBefore = await faces(), timeBefore = await seconds();
  await page.click('#mj-shuffle');
  const facesAfter = await faces();
  t.check(await left() === 144 && facesAfter.join() !== facesBefore.join() && [...facesAfter].sort().join() === [...facesBefore].sort().join(), 'Shuffle hands the same pictures out anew');
  t.check(await seconds() >= timeBefore + 60, 'and costs a minute');

  // ---- the small layout, cleared from the first tile to the last
  await page.click('#mj-layout button[data-l="pyramid"]');
  await sleep(200);
  t.equal([await left(), await text('#g-score'), await text('#g-best')], [80, '0:00', '–'], 'the pyramid: 80 tiles and a clock at zero');
  const order = await page.evaluate(async () => {
    const { LAYOUTS, freeTiles } = await import('./js/games/mahjong.js');
    const start = LAYOUTS.pyramid.places.map((p, i) => ({ ...p, face: document.querySelector(`.mj-tile[data-i="${i}"]`).getAttribute('aria-label'), gone: false }));
    for (let game = 0; game < 3000; game++) { // take pairs at random until one game clears the table
      const tiles = start.map((x) => ({ ...x })), taken = [];
      for (;;) {
        const byFace = {};
        for (const i of freeTiles(tiles)) (byFace[tiles[i].face] ||= []).push(i);
        const pairs = Object.values(byFace).filter((l) => l.length >= 2);
        if (!pairs.length) break;
        const l = pairs[Math.floor(Math.random() * pairs.length)], a = l.splice(Math.floor(Math.random() * l.length), 1)[0], b = l[Math.floor(Math.random() * l.length)];
        tiles[a].gone = tiles[b].gone = true; taken.push(a, b);
      }
      if (tiles.every((x) => x.gone)) return taken;
    }
    return null;
  });
  t.check(order && order.length === 80, 'the deal can be cleared');
  for (const i of order || []) await page.click(tile(i));
  await sleep(400);
  t.equal([await left(), await page.$eval('#overlay', (o) => !o.classList.contains('hidden')), await text('#ov-title')], [0, true, 'New best!'], 'taking the last pair wins the game');
  const time = await text('#g-score');
  t.equal([await text('#ov-text'), await text('#g-best')], ['Your time: ' + time, time], 'the time is the score, and the best one is kept');
  await sleep(700);
  await page.keyboard.press('Enter');
  await sleep(300);
  t.equal([await left(), await text('#g-score')], [80, '0:00'], 'Play again deals a new table');
  t.problems(page);
  await page.close();

  // ---- a phone starts with the small layout, and its tiles are big enough for a finger
  const phone = await open('', { mobile: true });
  await phone.evaluate(() => { localStorage.clear(); location.hash = 'mahjong'; });
  await sleep(700);
  t.equal([await phone.$eval('#mj-layout .on', (b) => b.dataset.l), await phone.$$eval('.mj-tile', (l) => l.length)], ['pyramid', 80], 'phone: a narrow screen starts with the pyramid');
  const size = await phone.evaluate(() => {
    const tiles = [...document.querySelectorAll('.mj-tile')].map((el) => el.getBoundingClientRect());
    return { w: tiles[0].width, left: Math.min(...tiles.map((r) => r.left)), right: Math.max(...tiles.map((r) => r.right)), bottom: Math.max(...tiles.map((r) => r.bottom)) };
  });
  t.check(size.w >= 40 && size.left >= 0 && size.right <= 390 && size.bottom <= 780, `phone: the whole table is on the screen and a tile is ${size.w.toFixed(0)} px wide`);
  const pair = await phone.evaluate(() => {
    const byFace = {};
    for (const el of document.querySelectorAll('.mj-tile:not(.stuck)')) (byFace[el.getAttribute('aria-label')] ||= []).push(el.dataset.i);
    return Object.values(byFace).find((l) => l.length >= 2).slice(0, 2);
  });
  for (const i of pair) { const b = await (await phone.$(tile(i))).boundingBox(); await phone.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await sleep(80); }
  t.equal(await phone.$$eval('.mj-tile:not(.gone)', (l) => l.length), 78, 'phone: two taps take a pair');
  await phone.click('#mj-layout button[data-l="turtle"]');
  await sleep(300);
  const turtle = await phone.evaluate(() => { const tiles = [...document.querySelectorAll('.mj-tile')].map((el) => el.getBoundingClientRect()); return { n: tiles.length, w: tiles[0].width, right: Math.max(...tiles.map((r) => r.right)), wide: document.documentElement.scrollWidth <= innerWidth }; });
  t.check(turtle.n === 144 && turtle.right <= 390 && turtle.wide, `phone: the turtle fits the width too (tiles of ${turtle.w.toFixed(0)} px)`);
  t.problems(phone, 'phone');
  await phone.close();
}
