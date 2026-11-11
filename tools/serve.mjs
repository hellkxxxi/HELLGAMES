// A tiny static file server for working on the site locally:  node tools/serve.mjs [port]
// It serves the project folder, never lets the browser cache anything and needs no dependencies.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.webmanifest': 'application/manifest+json',
};

export function createServer(root = ROOT) {
  return http.createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let file = normalize(join(root, path));
      if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end('Forbidden'); return; }
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    }
  });
}

// Started directly (not imported by the tests): listen and print the address.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.argv[2]) || 8080;
  createServer().listen(port, '0.0.0.0', () => console.log(`hellgames is running at http://localhost:${port}`));
}
