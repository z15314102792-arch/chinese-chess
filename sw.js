const CACHE_NAME = 'chinese-chess-v1';
const FILES_TO_CACHE = [
  './',
  './index.html',
  './css/style.css',
  './js/board.js',
  './js/ai.js',
  './js/p2p.js',
  './js/ui.js',
  './js/main.js',
  './manifest.json',
  './assets/icon.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.url.includes('peerjs') || event.request.url.includes('unpkg')) return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
