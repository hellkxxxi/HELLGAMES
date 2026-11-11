// Helpers shared by the browser tests and the artwork scripts.
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { createServer } from './serve.mjs';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Serves the project folder (or another folder) on a free local port. Returns { url, close }.
export function startServer(port = 0, root) {
  return new Promise((ok, fail) => {
    const server = createServer(root);
    server.once('error', fail);
    server.listen(port, '127.0.0.1', () => ok({
      url: `http://localhost:${server.address().port}/`,
      close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }),
    }));
  });
}

// Uses the Chrome or Chromium installed on this computer (set CHROME_PATH if it lives somewhere unusual).
// On a Linux machine without a browser it falls back to the headless build from @sparticuz/chromium.
async function findBrowser() {
  const local = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].find((p) => p && existsSync(p));
  if (local) return { executablePath: local, args: ['--no-sandbox'] };
  process.env.AWS_LAMBDA_JS_RUNTIME ??= 'nodejs22.x'; // the package refuses to unpack itself without this
  const { default: chromium } = await import('@sparticuz/chromium');
  return { executablePath: await chromium.executablePath(), args: chromium.args };
}

export async function launch() {
  const { executablePath, args } = await findBrowser();
  return puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      ...args,
      // Without a graphics card the accelerated canvas is far slower than the plain one.
      '--disable-accelerated-2d-canvas',
      // A headless desktop browser reports "no pointer"; the site would then show its touch controls.
      '--blink-settings=primaryPointerType=4,availablePointerTypes=4,primaryHoverType=2,availableHoverTypes=2',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
}

const IGNORED = [/willReadFrequently/];

// Opens a page and collects everything that should never happen (script errors, console errors and
// warnings, files that failed to load) in page.problems.
export async function openPage(browser, url, { viewport = { width: 1280, height: 800 }, mobile = false } = {}) {
  const page = await browser.newPage();
  if (mobile) await page.setViewport({ width: 390, height: 780, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  else await page.setViewport({ deviceScaleFactor: 1, ...viewport });
  page.problems = [];
  const note = (text) => { if (!IGNORED.some((re) => re.test(text))) page.problems.push(text); };
  page.on('pageerror', (e) => note('script error: ' + (e.stack || e.message || e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warn') note(`console ${m.type()}: ${m.text()}`); });
  page.on('requestfailed', (r) => note(`failed to load ${r.url()} (${r.failure()?.errorText})`));
  page.on('response', (r) => { if (r.status() >= 400) note(`${r.status()} for ${r.url()}`); });
  await page.goto(url, { waitUntil: 'load' });
  return page;
}

// A minimal test harness: check(condition, message) records a result, done() prints the verdict.
export function checker(name) {
  let failed = 0, passed = 0;
  return {
    check(ok, message) {
      if (ok) passed++; else { failed++; console.log(`  FAIL  ${message}`); }
      return !!ok;
    },
    equal(actual, expected, message) {
      const ok = JSON.stringify(actual) === JSON.stringify(expected);
      if (ok) passed++; else { failed++; console.log(`  FAIL  ${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
      return ok;
    },
    problems(page, where = '') {
      for (const p of page.problems.splice(0)) { failed++; console.log(`  FAIL  ${where ? where + ': ' : ''}${p}`); }
    },
    done() {
      console.log(`${failed ? 'FAILED' : 'ok'}  ${name}  (${passed} passed${failed ? `, ${failed} failed` : ''})`);
      return failed === 0;
    },
  };
}
