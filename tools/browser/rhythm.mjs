// Circles of Hell and Soul Catcher: the tune starts with the first click, a flawless player gets every
// note, an idle one loses them all, and a pause stops the clock. Chance is fixed, so the test knows the
// notes of the tune and can play them.
import { sleep } from '../lib.mjs';

const SEED = 6;

async function openGame(browser, url, id) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  page.problems = [];
  page.on('pageerror', (e) => page.problems.push('script error: ' + (e.stack || e.message || e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warn') page.problems.push(`console ${m.type()}: ${m.text()}`); });
  await page.evaluateOnNewDocument((seed) => {
    window.chance = (s) => () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    Math.random = window.chance(seed);
  }, SEED);
  await page.goto(url + '#' + id, { waitUntil: 'load' });
  await sleep(600);
  return page;
}
const text = (page, sel) => page.$eval(sel, (e) => e.textContent);
const state = async (page) => {
  const m = (await text(page, '#g-status')).match(/^Combo (\d+) · ([\d.]+)%$/);
  return { score: Number(await text(page, '#g-score')), combo: m ? Number(m[1]) : null, accuracy: m ? Number(m[2]) : null };
};
const overlayTitle = async (page) => (await page.$eval('#overlay', (o) => !o.classList.contains('hidden'))) && text(page, '#ov-title');

export default async function ({ t, browser, url }) {
  // ---------------------------------------------------------------- Circles of Hell
  let page = await openGame(browser, url, 'circles');
  t.check(/^\d+ BPM · \d+ circles$/.test(await text(page, '#g-status')), 'Circles: the tune is ready and waits');
  await sleep(500);
  t.equal((await state(page)).score, 0, 'Circles: nothing happens before the first click');
  // The first click starts the tune. Then the first seconds are played without a mistake.
  let plan = await page.evaluate(async (seed, seconds) => {
    const { makeSong } = await import('./js/games/mania.js');
    const { makeChart, ballAt, MODES } = await import('./js/games/circles.js');
    const rnd = window.chance(seed), song = makeSong('easy', rnd), chart = makeChart(song, 'easy', rnd);
    const cv = document.querySelector('#cr-c'), r = cv.getBoundingClientRect(), pad = (MODES.easy.radius + 0.035) * Math.min(r.width, r.height);
    const at = (x, y) => ({ clientX: r.left + pad + x * (r.width - 2 * pad), clientY: r.top + pad + y * (r.height - 2 * pad) });
    const fire = (type, x, y) => cv.dispatchEvent(new PointerEvent(type, { ...at(x, y), pointerId: 1, pointerType: 'mouse', button: 0, bubbles: true, cancelable: true }));
    fire('pointerdown', 0.5, 0.5); fire('pointerup', 0.5, 0.5);
    const started = performance.now(), wait = (s) => s * 1000 - (performance.now() - started);
    const mine = chart.filter((o) => o.t + o.len < seconds);
    for (const o of mine) {
      setTimeout(() => fire('pointerdown', o.x, o.y), wait(o.t));
      if (o.len) for (let k = 1; k <= 30; k++) setTimeout(() => fire('pointermove', ...ballAt(o, o.t + o.len * k / 30)), wait(o.t + o.len * k / 30));
      setTimeout(() => fire('pointerup', ...(o.len ? o.path.at(-1) : [o.x, o.y])), wait(o.t + (o.len || 0.05)));
    }
    const next = chart[mine.length];
    return { judged: mine.reduce((n, o) => n + (o.len ? 2 : 1), 0), sliders: mine.filter((o) => o.len).length, wait: wait(Math.min(seconds, next.t - 0.25)), total: chart.length, nextAt: next.t };
  }, SEED, 9);
  await sleep(600);
  t.equal(await text(page, '#g-status'), 'Get ready…', 'Circles: the first click starts the tune');
  await sleep(plan.wait - 600);
  let now = await state(page);
  t.check(plan.judged > 8 && now.combo === plan.judged && now.accuracy === 100 && now.score > 0, `Circles: a flawless player hits everything (${plan.judged} hits, ${plan.sliders} of them sliders held to the end; the game says ${JSON.stringify(now)})`);

  await page.keyboard.press('p');
  await sleep(200);
  t.equal(await overlayTitle(page), 'Paused', 'Circles: P pauses');
  await sleep(1500); // long enough for several circles to pass, if the clock were still running
  await page.keyboard.press('Enter');
  await sleep(150);
  t.equal([await overlayTitle(page), (await state(page)).combo], [false, plan.judged], 'Circles: nothing was missed during the pause');
  await sleep(2600);
  now = await state(page);
  t.check(now.combo === 0 && now.accuracy < 100, `Circles: circles that are not clicked are lost (${JSON.stringify(now)})`);

  await page.click('#cr-mode button[data-m="hard"]');
  await sleep(200);
  t.check((await state(page)).score === 0 && /^\d+ BPM · \d+ circles$/.test(await text(page, '#g-status')), 'Circles: another level starts over with a new tune');
  t.equal(await page.$eval('#cr-snd', (b) => b.title), 'Sound is on', 'Circles: the sound is on');
  await page.click('#cr-snd');
  t.equal([await page.$eval('#cr-snd', (b) => b.title), await page.evaluate(() => localStorage.getItem('arcade:mute'))], ['Sound is off', '1'], 'Circles: the sound button switches it off');
  const LEVELS = ['Easy', 'Normal', 'Hard', 'Hell'];
  const levels = (sel) => page.$$eval(`${sel} button`, (list) => list.map((b) => b.textContent));
  t.equal(await levels('#cr-mode'), LEVELS, 'Circles: four levels');
  await page.click('#cr-mode button[data-m="hell"]');
  await sleep(200);
  t.check(/^172 BPM · [45]\d\d circles$/.test(await text(page, '#g-status')), `Circles: Hell has the quickest tune and the most circles (${await text(page, '#g-status')})`);
  await page.evaluate(() => { location.hash = 'mania'; });
  await sleep(500);
  t.equal(await page.$eval('#mn-snd', (b) => b.title), 'Sound is off', 'and Key Mania follows the same switch');
  await page.click('#mn-snd');
  t.equal(await levels('#mn-mode'), LEVELS, 'Key Mania: four levels');
  await page.click('#mn-mode button[data-m="hell"]');
  await sleep(200);
  t.check(/^172 BPM · \d+ notes$/.test(await text(page, '#g-status')), `Key Mania: Hell has the quickest tune (${await text(page, '#g-status')})`);
  t.problems(page, 'circles');
  await page.close();

  // ---------------------------------------------------------------- Soul Catcher
  page = await openGame(browser, url, 'catcher');
  t.check(/^\d+ BPM · \d+ squares$/.test(await text(page, '#g-status')), 'Catcher: the tune is ready and waits');
  // Space starts the tune. The first seconds are played with the mouse, the next ones with the keys.
  plan = await page.evaluate(async (seed, mouseUntil, keysUntil) => {
    const { makeSong } = await import('./js/games/mania.js');
    const { makeChart } = await import('./js/games/catcher.js');
    const rnd = window.chance(seed), song = makeSong('easy', rnd), chart = makeChart(song, 'easy', rnd);
    const cv = document.querySelector('#ct-c'), r = cv.getBoundingClientRect(), cell = Math.min(r.width, r.height) * 0.9 / 3;
    const move = (col, row) => window.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + r.width / 2 + (col - 1) * cell, clientY: r.top + r.height / 2 + (row - 1) * cell, pointerId: 1, pointerType: 'mouse', bubbles: true }));
    const key = (col, row) => { const k = '789456123'[row * 3 + col]; document.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: 'Numpad' + k, bubbles: true })); };
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
    const started = performance.now(), wait = (s) => s * 1000 - (performance.now() - started);
    const mine = chart.filter((n) => n.t < keysUntil);
    for (const n of mine) setTimeout(() => (n.t < mouseUntil ? move : key)(n.col, n.row), wait(n.t - 0.06));
    const last = mine.at(-1), next = chart[mine.length];
    setTimeout(() => move(2 - last.col || 2, 2 - last.row), wait(last.t + 0.2)); // then the cursor is parked far from the squares that follow
    return { caught: mine.length, byMouse: mine.filter((n) => n.t < mouseUntil).length, wait: wait(Math.min(keysUntil, next.t - 0.2)) };
  }, SEED, 6, 10);
  await sleep(600);
  t.equal(await text(page, '#g-status'), 'Get ready…', 'Catcher: Space starts the tune');
  await sleep(plan.wait - 600);
  now = await state(page);
  t.check(plan.byMouse > 4 && plan.caught - plan.byMouse > 4 && now.combo === plan.caught && now.accuracy === 100, `Catcher: every square is caught, ${plan.byMouse} with the mouse and ${plan.caught - plan.byMouse} with the keys (the game says ${JSON.stringify(now)})`);
  await page.keyboard.press('p');
  await sleep(200);
  t.equal(await overlayTitle(page), 'Paused', 'Catcher: P pauses');
  await sleep(1500);
  await page.keyboard.press('Space');
  await sleep(150);
  t.equal([await overlayTitle(page), (await state(page)).combo], [false, plan.caught], 'Catcher: nothing was missed during the pause');
  await sleep(4000);
  now = await state(page);
  t.check(now.accuracy < 100, `Catcher: squares that fly past an idle cursor are lost (${JSON.stringify(now)})`);

  // Hard has snakes: rows of quick squares, each in the cell beside the one before. A cursor that is
  // dragged along them catches every square.
  t.equal(await page.$$eval('#ct-mode button', (list) => list.map((b) => b.textContent)), ['Easy', 'Normal', 'Hard', 'Hell'], 'Catcher: four levels');
  await page.click('#ct-mode button[data-m="hard"]');
  await sleep(300);
  plan = await page.evaluate(async (seed, until) => {
    const { makeSong } = await import('./js/games/mania.js');
    const { makeChart } = await import('./js/games/catcher.js');
    // the page has used up some chance since it was opened: a tune of our own is put in its place
    const rnd = window.chance(seed);
    Math.random = window.chance(seed);
    document.querySelector('#g-restart').click();
    const song = makeSong('hard', rnd), chart = makeChart(song, 'hard', rnd);
    const cv = document.querySelector('#ct-c'), r = cv.getBoundingClientRect(), cell = Math.min(r.width, r.height) * 0.9 / 3;
    const move = (col, row) => window.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + r.width / 2 + (col - 1) * cell, clientY: r.top + r.height / 2 + (row - 1) * cell, pointerId: 1, pointerType: 'mouse', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
    const started = performance.now(), wait = (s) => s * 1000 - (performance.now() - started);
    const mine = chart.filter((n) => n.t < until), next = chart[mine.length];
    for (const n of mine) setTimeout(() => move(n.col, n.row), wait(n.t - 0.05));
    const snakes = new Set(mine.filter((n) => n.snake).map((n) => n.snake));
    return { caught: mine.length, snakes: snakes.size, inSnakes: mine.filter((n) => n.snake).length, squares: chart.length, wait: wait(next.t - 0.02), status: document.querySelector('#g-status').textContent };
  }, SEED + 1, 7);
  await sleep(Math.max(0, plan.wait));
  now = await state(page);
  t.check(plan.snakes >= 3 && plan.inSnakes > 15 && now.combo === plan.caught && now.accuracy === 100, `Catcher, hard: ${plan.caught} squares are caught, ${plan.inSnakes} of them in ${plan.snakes} snakes (the game says ${JSON.stringify(now)})`);
  t.check(/^146 BPM · 3\d\d squares$/.test(plan.status), `Catcher, hard: about twice the squares of the level before (${plan.status})`);
  t.problems(page, 'catcher');
  await page.close();

  // ---------------------------------------------------------------- on a phone: a tap starts, the field fits
  for (const [id, canvas] of [['circles', '#cr-c'], ['catcher', '#ct-c']]) {
    const phone = await browser.newPage();
    await phone.setViewport({ width: 390, height: 780, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    phone.problems = [];
    phone.on('pageerror', (e) => phone.problems.push('script error: ' + (e.stack || e.message || e)));
    await phone.goto(url + '#' + id, { waitUntil: 'load' });
    await sleep(600);
    const box = await (await phone.$(canvas)).boundingBox();
    t.check(box.width > 300 && box.x >= 0 && box.x + box.width <= 390 && box.y + box.height <= 780, `phone, ${id}: the field fills the width and fits the screen (${Math.round(box.width)}x${Math.round(box.height)})`);
    await phone.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await sleep(500);
    t.equal(await text(phone, '#g-status'), 'Get ready…', `phone, ${id}: a tap starts the tune`);
    t.problems(phone, 'phone ' + id);
    await phone.close();
  }
}
