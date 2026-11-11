// Regenerates tailwind.css:  npm run css
// The site has no build step. tailwind.css is simply the set of Tailwind utility classes that appear in
// index.html and js/, generated once and committed. Run this again after using a class that is not in it yet.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './serve.mjs';

const out = join(ROOT, 'tailwind.css');
const cli = join(ROOT, 'tools/node_modules/tailwindcss/lib/cli.js');

// Only what stands in a class attribute (class="...") or is handed to classList counts as a class name.
// Left to itself, Tailwind takes every word of the code that happens to be the name of a utility
// (blur, filter, table, transform...) and writes a rule for it.
const config = `
const attribute = /class(?:Name)?\\s*=\\s*\\\\?(["'\`])([\\s\\S]*?)\\1/g;
const classList = /classList\\.(?:add|remove|toggle|contains)\\(([^)]*)\\)/g;
module.exports = {
  content: {
    files: ['./index.html', './js/*.js', './js/games/*.js'],
    extract: (text) => [
      ...[...text.matchAll(attribute)].flatMap((m) => m[2].split(/[\\s"'\`\${}()]+/)),
      ...[...text.matchAll(classList)].flatMap((m) => m[1].split(/[\\s"'\`,]+/)),
    ].filter(Boolean),
  },
};
`;
const scratch = mkdtempSync(join(tmpdir(), 'hellgames-css-'));
try {
  writeFileSync(join(scratch, 'tailwind.config.cjs'), config);
  execFileSync(process.execPath, [cli, '--config', join(scratch, 'tailwind.config.cjs'), '-o', out], { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'] });
} catch (error) {
  console.error(String(error.stderr || error));
  process.exit(1);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

const version = JSON.parse(readFileSync(join(ROOT, 'tools/node_modules/tailwindcss/package.json'), 'utf8')).version;
const header = `/* Generated file - do not edit by hand. New styles belong in styles.css.
   The Tailwind CSS v${version} utility classes used in index.html and js/ (tailwindcss.com, MIT License).
   To regenerate after adding Tailwind classes to the markup (needs Node.js):  cd tools && npm install && npm run css */
`;
writeFileSync(out, header + readFileSync(out, 'utf8').replace(/^\/\*[\s\S]*?\*\/\s*/, ''));
console.log(`tailwind.css: ${readFileSync(out).length} bytes`);
