// Renders the artwork from its sources in tools/art:  npm run art
//   art/icon.svg  ->  icon.png   (512 x 512: favicon, home-screen icon and the logo in the header)
//   art/og.html   ->  og.png     (1200 x 630: the picture shown when the link is shared)
// and takes the screenshots used in the README (docs/*.png) from the site itself.
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './serve.mjs';
import { launch, sleep, startServer } from './lib.mjs';

const browser = await launch();

async function icon() {
  const page = await browser.newPage();
  await page.setViewport({ width: 512, height: 512, deviceScaleFactor: 1 });
  await page.setContent(`<body style="margin:0">${readFileSync(join(ROOT, 'tools/art/icon.svg'), 'utf8')}</body>`);
  await page.screenshot({ path: join(ROOT, 'icon.png') });
  await page.close();
}

async function og() {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(join(ROOT, 'tools/art/og.html')).href, { waitUntil: 'load' });
  await page.screenshot({ path: join(ROOT, 'og.png') });
  await page.close();
}

// README screenshots: the home page and a few games in the middle of a round.
// Chance is replaced by a fixed sequence of numbers, so the pictures come out the same every time.
async function screenshots() {
  mkdirSync(join(ROOT, 'docs'), { recursive: true });
  const server = await startServer();
  const shoot = async (file, hash, { width = 800, height = 640, seed = 1, play, clip } = {}) => {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument((seed) => {
      window.chance = (seed) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      Math.random = window.chance(seed);
    }, seed);
    await page.goto(server.url + hash, { waitUntil: 'load' });
    await sleep(700);
    if (await page.$eval('#overlay', (o) => !o.classList.contains('hidden'))) { await page.click('#ov-btn'); await sleep(200); }
    if (play) await play(page);
    await page.screenshot({ path: join(ROOT, 'docs', file), ...(clip ? { clip } : {}) });
    await page.close();
  };
  const press = async (page, keys, pause = 70) => { for (const key of keys) { await page.keyboard.press(key); await sleep(pause); } };

  await shoot('home.png', '', { width: 1200, height: 800 });
  await shoot('helltype.png', '#helltype', { seed: 4, play: async (page) => {
    const words = await page.$$eval('#ht-words .w', (list) => list.slice(0, 12).map((w) => w.textContent));
    for (const [i, word] of words.slice(0, 9).entries()) await page.keyboard.type((i === 5 ? word.slice(0, -1) + 'r' : word) + ' ', { delay: 60 });
    await page.keyboard.type(words[9].slice(0, 2), { delay: 60 });
  } });
  await shoot('hellybird.png', '#hellybird', { seed: 18, play: async (page) => {
    // With this seed the first gap is at flying height. A flap every 0.58 seconds keeps the devil level;
    // the time is counted frame by frame, the way the game counts it, so a slow computer changes nothing.
    await page.evaluate(() => new Promise((done) => {
      const flap = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
      let clock = 0, last = 0, flaps = 0;
      const frame = (now) => {
        if (last) clock += Math.min(0.05, (now - last) / 1000);
        last = now;
        if (clock >= flaps * 0.58) { flap(); flaps++; }
        if (clock >= 2.92) done(); else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }));
  } });
  await shoot('whack.png', '#whack', { seed: 2, play: async (page) => {
    await sleep(2600);
    await page.evaluate(() => { // a full house for the picture, one of them freshly bopped
      const holes = [...document.querySelectorAll('.hole')];
      for (const i of [1, 3, 8]) holes[i].classList.add('up');
      holes[4].classList.add('up', 'hit');
      document.querySelector('#g-score').textContent = '7';
    });
    await sleep(250);
  } });
  await shoot('hellman.png', '#hellman', { seed: 5, play: async (page) => {
    await sleep(2600); await page.keyboard.press('ArrowUp'); await sleep(1500); await page.keyboard.press('ArrowLeft'); await sleep(2300);
  } });
  await shoot('helltris.png', '#helltris', { seed: 8, play: async (page) => {
    const L = 'ArrowLeft', R = 'ArrowRight', UP = 'ArrowUp', DROP = 'Space';
    for (const moves of [[L, L, L, L, DROP], [R, R, R, R, DROP], [L, DROP], [UP, R, R, DROP], [L, L, L, DROP], [R, R, R, R, DROP], [UP, L, L, DROP], [DROP], [R, R, DROP]]) await press(page, moves);
    await sleep(900);
  } });
  await shoot('mania.png', '#mania', { seed: 6, play: async (page) => {
    // The tune is made by chance, and chance is fixed here: the same tune is worked out a second time
    // and its first ten seconds are played without a mistake.
    const wait = await page.evaluate(async (seed) => {
      const { makeSong } = await import('./js/games/mania.js');
      const song = makeSong('easy', window.chance(seed));
      const key = (type, lane) => document.dispatchEvent(new KeyboardEvent(type, { key: 'dfjk'[lane], code: 'Key' + 'DFJK'[lane], bubbles: true }));
      key('keydown', 0); key('keyup', 0); // any key starts the tune
      const started = performance.now(), at = (seconds) => seconds * 1000 - (performance.now() - started);
      const last = song.notes.find((n) => n.t > 10 && !n.len);
      for (const n of song.notes) {
        if (n.t > last.t) break;
        setTimeout(() => key('keydown', n.lane), at(n.t));
        setTimeout(() => key('keyup', n.lane), at(n.t + (n.len || 0.07)));
      }
      return at(last.t) + 60;
    }, 6);
    await sleep(wait);
  } });
  await server.close();
}

const jobs = { icon, og, screenshots };
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(jobs);
for (const name of wanted) {
  if (!jobs[name]) { console.log(`unknown job "${name}" (there are: ${Object.keys(jobs).join(', ')})`); continue; }
  await jobs[name]();
  console.log('rendered', name);
}
await browser.close();
