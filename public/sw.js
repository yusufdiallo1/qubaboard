// Service worker — always network-first for Next.js chunks, never cache them
const CACHE = 'quba-v6';

self.addEventListener('install', (e) => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Always go network-first for Next.js chunks — never serve stale
  if (url.pathname.startsWith('/_next/')) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }));
    return;
  }

  // Everything else: straight network pass-through
  e.respondWith(fetch(e.request));
});
