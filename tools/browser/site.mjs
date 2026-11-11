// The whole site: the home page, every game opening, starting and closing, on a desktop and on a phone.
import { sleep } from '../lib.mjs';

const GAMES = [
  ['aim', 'Aim Trainer'], ['mania', 'Key Mania'], ['helltype', 'Helltype'], ['helltris', 'Helltris'], ['hellman', 'Hell-Man'],
  ['hellybird', 'Helly Bird'], ['lines', 'Lines 98'], ['sudoku', 'Sudoku'], ['draw', 'Sketchpad'], ['snake', 'Snake'],
  ['2048', '2048'], ['mines', 'Minesweeper'], ['memory', 'Memory Match'], ['reaction', 'Reaction Test'], ['whack', 'Whack-a-Mole'],
];
const SITE = 'hellgames by hellkai', REPO = 'https://github.com/hellkxxxi/hellgames';
const OLD_NAMES = /tetris|pac-?man|flappy/i;

const overlayOpen = (page) => page.$eval('#overlay', (o) => !o.classList.contains('hidden'));
const visible = (page, sel) => page.$eval(sel, (e) => !e.classList.contains('hidden'));

// Opens each game in turn on the given page, starts it, lets it run for a moment and goes back.
async function playThrough(page, t, where) {
  for (const [id, name] of GAMES) {
    await page.evaluate((h) => { location.hash = h; }, id);
    await sleep(450);
    t.check(await visible(page, '#play') && !(await visible(page, '#home')), `${where} ${id}: the game page is shown`);
    t.equal(await page.$eval('#g-title', (e) => e.textContent), name, `${where} ${id}: title`);
    t.equal(await page.title(), `${name} — ${SITE}`, `${where} ${id}: tab title`);
    t.check((await page.$eval('#g-help', (e) => e.textContent)).length > 10, `${where} ${id}: has a line of help`);
    t.check(await page.$eval('#stage', (s) => s.children.length > 0), `${where} ${id}: something is on the stage`);
    if (await overlayOpen(page)) {
      await sleep(350); // a fresh overlay ignores clicks for a moment
      await page.click('#ov-btn');
      await sleep(150);
      t.check(!(await overlayOpen(page)), `${where} ${id}: the Start button starts the game`);
    }
    await sleep(700);
    const canvases = await page.$$eval('#stage canvas', (list) => list.map((c) => ({ w: c.width, h: c.height, bytes: c.toDataURL().length })));
    for (const c of canvases) t.check(c.w > 100 && c.h > 100 && c.bytes > 1500, `${where} ${id}: the canvas is painted (${c.w}x${c.h}, ${c.bytes} bytes)`);
    t.check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${where} ${id}: nothing sticks out sideways`);
    t.check(!OLD_NAMES.test(await page.$eval('#app', (e) => e.innerText)), `${where} ${id}: no old game names on the page`);
    t.problems(page, `${where} ${id}`);
    await page.keyboard.press('Escape');
    await sleep(200);
    t.check(await visible(page, '#home') && (await page.evaluate(() => location.hash)) === '', `${where} ${id}: Escape goes back to the home page`);
  }
}

export default async function ({ t, open, url }) {
  // ---- the home page
  const page = await open();
  await sleep(500);
  t.equal(await page.title(), SITE, 'tab title of the home page');
  const cards = await page.$$eval('#grid .card', (list) => list.map((c) => ({
    id: c.getAttribute('href').slice(1), name: c.querySelector('h3').textContent, tag: c.querySelector('.tag').textContent,
    text: c.querySelector('p').textContent, icon: !!c.querySelector('.card-icon svg'), best: c.querySelector('.best')?.textContent.replace(/\s+/g, ' ').trim(),
  })));
  t.equal(cards.map((c) => [c.id, c.name]), GAMES, 'the games on the home page, in order');
  for (const c of cards) {
    t.check(c.icon, `${c.id}: the card has its icon`);
    t.check(c.text.length > 20 && c.tag.length > 2, `${c.id}: the card has a description and a tag`);
    t.check(c.id === 'draw' ? c.best === undefined : /^Best –/.test(c.best), `${c.id}: no best score yet (${c.best})`);
  }
  t.check(!OLD_NAMES.test(await page.$eval('#app', (e) => e.innerText)), 'no old game names on the home page');

  const links = await page.$$eval(`a[href="${REPO}"]`, (list) => list.map((a) => ({ target: a.target, rel: a.rel, shown: a.getClientRects().length > 0, label: (a.getAttribute('aria-label') || a.textContent).trim() })));
  t.equal(links.length, 2, 'links to GitHub: one in the header, one in the footer');
  for (const a of links) t.check(a.shown && a.target === '_blank' && /noopener/.test(a.rel) && /GitHub/.test(a.label), `GitHub link "${a.label}" is visible and opens in a new tab`);
  t.check(/^v\d+\.\d+\.\d+$/.test(await page.$eval('#version', (e) => e.textContent)), 'the footer shows the version');
  t.check(await page.$eval('header img', (i) => i.complete && i.naturalWidth === 512), 'the logo in the header is the 512 px icon');

  // ---- what search engines, messengers and "add to home screen" read
  const head = await page.evaluate(() => {
    const meta = (q) => document.querySelector(q)?.getAttribute('content');
    return {
      description: meta('meta[name="description"]'), ogTitle: meta('meta[property="og:title"]'), ogImage: meta('meta[property="og:image"]'),
      ogUrl: meta('meta[property="og:url"]'), card: meta('meta[name="twitter:card"]'), theme: meta('meta[name="theme-color"]'),
      canonical: document.querySelector('link[rel="canonical"]')?.href, lang: document.documentElement.lang,
    };
  });
  t.check(/Helltype/.test(head.description) && /Helltris/.test(head.description) && /Hell-Man/.test(head.description) && /Helly Bird/.test(head.description) && !OLD_NAMES.test(head.description), 'the description names the games by their new names');
  t.equal(head.ogTitle, SITE, 'og:title');
  t.check(/^https:\/\/.+\/$/.test(head.ogUrl) && head.ogImage === head.ogUrl + 'og.png' && head.canonical === head.ogUrl, 'og:url, og:image and the canonical address are complete and agree');
  t.equal(head.card, 'summary_large_image', 'twitter:card');
  const files = await page.evaluate(async () => {
    const out = {};
    for (const f of ['og.png', 'icon.png', 'manifest.json', 'sw.js', 'LICENSE', 'README.md']) { const r = await fetch(f); out[f] = r.status; }
    out.manifest = await (await fetch('manifest.json')).json();
    const size = async (f) => { try { const b = await createImageBitmap(await (await fetch(f)).blob()); return `${b.width}x${b.height}`; } catch { return 'not a picture'; } };
    out.ogSize = await size('og.png'); out.iconSize = await size('icon.png');
    return out;
  });
  for (const f of ['og.png', 'icon.png', 'manifest.json', 'sw.js', 'LICENSE', 'README.md']) t.equal(files[f], 200, `${f} is there`);
  t.equal(files.ogSize, '1200x630', 'size of the sharing picture');
  t.equal(files.iconSize, '512x512', 'size of the icon');
  t.equal([files.manifest.name, files.manifest.short_name, files.manifest.description], [SITE, 'hellgames', head.description], 'the manifest agrees with the page');
  t.equal([files.manifest.theme_color, files.manifest.background_color], [head.theme, head.theme], 'the manifest colours match the page');
  t.equal(files.manifest.icons.map((i) => `${i.src} ${i.sizes}`), ['icon.png 512x512'], 'the manifest icon');
  t.problems(page, 'home');

  // ---- every game, with a mouse and a keyboard
  await playThrough(page, t, 'desktop');
  await page.close();

  // ---- every game on a phone-sized touch screen
  const phone = await open('', { mobile: true });
  await sleep(500);
  t.check(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'phone: the home page fits the screen');
  await playThrough(phone, t, 'phone');
  await phone.close();

  // ---- three games were renamed: old links and old saved scores still work
  const old = await open('#tetris');
  await sleep(500);
  t.equal([await old.evaluate(() => location.hash), await old.$eval('#g-title', (e) => e.textContent)], ['#helltris', 'Helltris'], 'an old link opens the renamed game');
  await old.evaluate(() => { localStorage.clear(); localStorage.setItem('arcade:best:pacman', '4321'); localStorage.setItem('arcade:best:flappy', '17'); });
  await old.goto(url, { waitUntil: 'load' });
  await sleep(500);
  const best = (id) => old.$eval(`#grid .card[href="#${id}"] .best b`, (e) => e.textContent);
  t.equal([await best('hellman'), await best('hellybird'), await best('helltris')], ['4321', '17', '–'], 'scores saved under the old names moved to the new ones');
  t.equal(await old.evaluate(() => Object.keys(localStorage).filter((k) => /pacman|flappy|tetris/.test(k))), [], 'the old entries are gone');
  t.problems(old, 'renamed games');
  await old.close();
}
