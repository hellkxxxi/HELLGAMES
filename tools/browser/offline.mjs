// Offline support (sw.js): after one visit the site opens without a connection, and whoever is online
// always gets the newest files.
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openPage, sleep, startServer } from '../lib.mjs';
import { ROOT } from '../serve.mjs';

export default async function ({ t, browser }) {
  // The test works on a copy of the site, which it can change and switch off without touching the real files.
  const copy = mkdtempSync(join(tmpdir(), 'hellgames-'));
  for (const f of ['index.html', 'styles.css', 'tailwind.css', 'manifest.json', 'icon.png', 'sw.js', 'js']) cpSync(join(ROOT, f), join(copy, f), { recursive: true });
  let server = await startServer(0, copy);
  const port = Number(new URL(server.url).port), url = server.url;
  try {
    // ---- the first visit: everything the site consists of ends up on the device
    const page = await openPage(browser, url);
    const expected = ['/', '/styles.css', '/tailwind.css', '/manifest.json', '/icon.png', '/js/app.js', '/js/util.js', '/js/vendor/lucide.js', '/js/data/words.js',
      ...readdirSync(join(ROOT, 'js/games')).map((f) => '/js/games/' + f)];
    const kept = () => page.evaluate(async () => (await (await caches.open('hellgames')).keys()).map((r) => new URL(r.url).pathname));
    let have = [];
    for (let i = 0; i < 50; i++) { have = await kept(); if (expected.every((f) => have.includes(f))) break; await sleep(200); }
    t.equal(expected.filter((f) => !have.includes(f)), [], 'every file of the site is kept for offline use after the first visit');
    t.check(await page.evaluate(() => !!navigator.serviceWorker.controller), 'the service worker is in charge of the page');
    t.problems(page, 'first visit');

    // ---- no connection: the server is gone
    await server.close();
    await page.reload({ waitUntil: 'load' });
    await sleep(600);
    t.equal(await page.$$eval('#grid .card', (list) => list.length), 15, 'offline: the home page opens with all its games');
    t.check(await page.$eval('header img', (i) => i.complete && i.naturalWidth > 0), 'offline: the icon is there');
    t.check(await page.$eval('#grid .card-icon svg', (s) => s.childElementCount > 0), 'offline: the game icons are drawn');
    await page.evaluate(() => { location.hash = 'helltype'; });
    await sleep(500);
    t.check(await page.$$eval('#ht-words .w', (list) => list.length) > 50, 'offline: Helltype has its words');
    await page.evaluate(() => { location.hash = 'hellybird'; });
    await sleep(600);
    t.check(await page.$eval('#hb-c', (c) => c.toDataURL().length > 3000), 'offline: Helly Bird draws its scene');
    t.problems(page, 'offline');
    const tab = await openPage(browser, url + '#snake');
    await sleep(500);
    t.equal(await tab.$eval('#g-title', (e) => e.textContent), 'Snake', 'offline: a link to a game opens in a new tab');
    t.problems(tab, 'offline, new tab');
    await tab.close();

    // ---- back online with a newer version of the site: it is shown at once, and kept for the next time offline
    const html = readFileSync(join(copy, 'index.html'), 'utf8');
    t.check(html.includes('>Pick a game<'), 'the page has the heading this test changes');
    writeFileSync(join(copy, 'index.html'), html.replace('>Pick a game<', '>Pick a newer game<'));
    writeFileSync(join(copy, 'styles.css'), readFileSync(join(copy, 'styles.css'), 'utf8') + '\nh1 { text-decoration-line: underline; }\n');
    server = await startServer(port, copy);
    await page.goto(url, { waitUntil: 'load' });
    await sleep(600);
    const look = () => page.$eval('h1', (h) => [h.textContent, getComputedStyle(h).textDecorationLine]);
    t.equal(await look(), ['Pick a newer game', 'underline'], 'online: the newest version is shown, not the kept one');
    await sleep(400);
    await server.close();
    await page.reload({ waitUntil: 'load' });
    await sleep(600);
    t.equal(await look(), ['Pick a newer game', 'underline'], 'offline again: the newer version was kept');
    t.problems(page, 'after the update');
    await page.close();
  } finally {
    await server.close().catch(() => {});
    rmSync(copy, { recursive: true, force: true });
  }
}
