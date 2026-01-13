
self.addEventListener('install', (event) => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  clients.claim();
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  event.respondWith((async () => {
    const cache = await caches.open('posecraft-v1');
    const cached = await cache.match(event.request);
    if (cached) return cached;
    try {
      const res = await fetch(event.request);
      if (res.ok && (url.origin === location.origin)) {
        cache.put(event.request, res.clone());
      }
      return res;
    } catch (e) {
      return cached || Response.error();
    }
  })());
});
