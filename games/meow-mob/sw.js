// Meow Mob offline cache. Bump VERSION on every deploy so players get the update.
const VERSION = 'meowmob-v4';
const FILES = ['./','index.html','manifest.webmanifest',
  'fonts/fredoka-latin-400-normal.woff2','fonts/fredoka-latin-500-normal.woff2','fonts/fredoka-latin-600-normal.woff2','fonts/fredoka-latin-700-normal.woff2',
  'icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png','icons/apple-touch-icon.png','icons/favicon-32.png','icons/cover.jpg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('meowmob-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// Network first for the page (so updates show up), cache first for everything else.
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const isPage = req.mode === 'navigate' || req.url.endsWith('/index.html');
  if (isPage) { e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(VERSION).then(x => x.put('index.html', c)); return r; }).catch(() => caches.match('index.html'))); return; }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
