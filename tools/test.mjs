// Runs the tests:  npm test   (from this folder), or  node tools/test.mjs
// First the rules of the games (tools/unit, no browser needed), then the whole site in a real browser
// (tools/browser). To run only some of them, name them:  npm test -- unit helltype
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checker, launch, openPage, startServer } from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const only = process.argv.slice(2);
const wanted = (name) => !only.length || only.includes(name);
let failed = false;

if (wanted('unit')) {
  const files = readdirSync(join(HERE, 'unit')).filter((f) => f.endsWith('.test.mjs')).map((f) => join(HERE, 'unit', f));
  const run = spawnSync(process.execPath, ['--test', '--test-reporter=spec', ...files], { stdio: 'inherit' });
  if (run.status !== 0) failed = true;
}

const names = readdirSync(join(HERE, 'browser')).filter((f) => f.endsWith('.mjs')).map((f) => f.slice(0, -4)).filter(wanted);
if (names.length) {
  const server = await startServer();
  for (const name of names) {
    const { default: run } = await import(`./browser/${name}.mjs`);
    const t = checker(name);
    // Every test gets a browser of its own: no saved scores or offline copies left over from another test.
    const browser = await launch();
    try {
      await run({ t, browser, url: server.url, open: (hash = '', options) => openPage(browser, server.url + hash, options) });
    } catch (error) {
      t.check(false, `the test stopped with an error: ${error.stack || error}`);
    }
    await browser.close().catch(() => {});
    if (!t.done()) failed = true;
  }
  await server.close();
}

console.log(failed ? '\nSOMETHING FAILED' : '\nEVERYTHING PASSED');
process.exit(failed ? 1 : 0);
