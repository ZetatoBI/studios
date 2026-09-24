// DeadBow service worker: cache-first app shell, version-keyed so phones detect updates.
// Bump VERSION on every release.
const VERSION = '1.3.0';
const CACHE = 'deadbow-' + VERSION;
const SHELL = [
  './', './index.html', './manifest.json',
  './fonts/gabarito-latin-600-normal.woff2', './fonts/gabarito-latin-700-normal.woff2', './fonts/gabarito-latin-800-normal.woff2',
  './fonts/karla-latin-500-normal.woff2', './fonts/karla-latin-700-normal.woff2',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
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
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match('./index.html'))));
});
