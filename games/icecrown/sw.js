// Ice Crown offline worker. Bump VERSION on every release.
// Silent updates: the game page and manifest are fetched network-first, so the next open after a release
// shows the new version with no prompt. Everything else is cache-first for speed and offline play.
const VERSION = '1.3.0';
const CACHE = 'icecrown-' + VERSION;
const ASSETS = ['./', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
  './fonts/cinzel-latin-600-normal.woff2', './fonts/cinzel-latin-800-normal.woff2',
  './fonts/alegreya-sans-latin-500-normal.woff2', './fonts/alegreya-sans-latin-700-normal.woff2', './fonts/alegreya-sans-latin-800-normal.woff2',
  './fonts/montserrat-latin-500-normal.woff2', './fonts/montserrat-latin-600-normal.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k.startsWith('icecrown-') && k !== CACHE).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});
function fresh(req) {           // network first (4s), fall back to cache
  return new Promise(resolve => {
    let done = false;
    const fallback = () => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html'));
    const t = setTimeout(() => { if (!done) { done = true; fallback().then(resolve); } }, 4000);
    fetch(req, { cache: 'no-store' }).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req.mode === 'navigate' ? './index.html' : req, copy)); }
      if (!done) { done = true; clearTimeout(t); resolve(res); }
    }).catch(() => { if (!done) { done = true; clearTimeout(t); fallback().then(resolve); } });
  });
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('.webmanifest')) {
    e.respondWith(fresh(req));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  })));
});
