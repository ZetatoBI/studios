// DeadBow service worker: cache-first app shell, version-keyed so phones detect updates.
// Bump VERSION on every release.
const VERSION = '1.6.0';
const CACHE = 'deadbow-' + VERSION;
const SHELL = [
  './', './index.html', './manifest.json',
  './fonts/gabarito-latin-600-normal.woff2', './fonts/gabarito-latin-700-normal.woff2', './fonts/gabarito-latin-800-normal.woff2',
  './fonts/karla-latin-500-normal.woff2', './fonts/karla-latin-700-normal.woff2',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png'
];
self.addEventListener('install', (e) => {
  // cache: 'reload' so the new version's files come from the network, not the browser's HTTP cache
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))));
});
self.addEventListener('activate', (e) => {
  // Only ever remove DeadBow's own old caches; other games on the site keep theirs.
  e.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((k) => k.startsWith('deadbow-') && k !== CACHE).map((k) => caches.delete(k)))));
});
self.addEventListener('message', (e) => { if (e.data === 'skip') self.skipWaiting(); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // Always read from THIS version's cache. (Looking across all caches could serve the previous
  // version's files during an update, before the old cache is cleared.)
  const mine = () => caches.open(CACHE);
  if (new URL(req.url).pathname.endsWith('/manifest.json')) {   // network-first, so install metadata stays current
    e.respondWith(fetch(req).then((res) => {
      if (res && res.ok) { const copy = res.clone(); mine().then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => mine().then((c) => c.match(req, { ignoreSearch: true }))));
    return;
  }
  e.respondWith(mine().then((c) => c.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
    if (res && res.ok) c.put(req, res.clone());
    return res;
  }).catch(() => c.match('./index.html')))));
});
