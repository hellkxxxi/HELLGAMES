// Offline support for hellgames.
// The network always comes first, so anyone who is online gets the newest version of the site. Every file
// that arrives is also kept on the device, and that copy is used when there is no connection.
const CACHE = 'hellgames';
const ALWAYS = ['./', 'manifest.json', 'icon.png'];

const here = (url) => new URL(url, self.location).origin === self.location.origin;
const worthKeeping = (response) => response.status === 200 && response.type === 'basic';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !here(request.url)) return;
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (worthKeeping(response)) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {}));
      }
      return response;
    } catch (offline) {
      const page = request.mode === 'navigate';
      const saved = await caches.match(request, { ignoreSearch: page }) || (page && await caches.match('./', { ignoreSearch: true }));
      if (saved) return saved;
      throw offline;
    }
  })());
});

// The page sends the list of files it loaded before this worker took over ({ keep: [addresses] }).
self.addEventListener('message', (event) => {
  const urls = event.data && event.data.keep;
  if (!Array.isArray(urls)) return;
  event.waitUntil(caches.open(CACHE).then((cache) => Promise.all(
    [...new Set([...ALWAYS, ...urls.filter(here)])].map(async (url) => {
      try {
        if (await cache.match(url)) return;
        const response = await fetch(url);
        if (worthKeeping(response)) await cache.put(url, response);
      } catch { /* not reachable right now: it will be kept on a later visit */ }
    }),
  )));
});
