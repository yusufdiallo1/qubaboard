// SW v8 — nuclear self-destruct. Never caches anything. Unregisters itself immediately.
// This file exists ONLY to clean up any previously registered service workers.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))),
      self.clients.claim(),
    ])
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .then((clients) => {
        clients.forEach((c) => c.postMessage({ type: 'SW_SELF_DESTRUCT' }));
      })
  );
});

// Never intercept any fetch
self.addEventListener('fetch', () => {});
