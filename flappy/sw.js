'use strict';
const CACHE = 'flappy-sky-club-nightmare-1';
const FILES = ['./', './index.html', './styles.css?v=nightmare-1', './core.js?v=nightmare-1', './audio.js?v=nightmare-1', './game.js?v=nightmare-1', './manifest.webmanifest?v=nightmare-1', './assets/bird.png', './assets/sky.webp', './assets/icon-192.png', './assets/icon-512.png', './assets/blood-moon.webp', './assets/bat.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('flappy-sky-club-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // HTML checks for updates; versioned code always stays a coherent set.
    if (event.request.mode === 'navigate') {
      try {
        const response = await fetch(event.request);
        if (response.ok) { event.waitUntil(cache.put('./index.html', response.clone())); return response; }
        return await cache.match('./index.html') || response;
      } catch (_) { return await cache.match('./index.html') || Response.error(); }
    }
    const cached = await cache.match(event.request);
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok && response.type === 'basic') event.waitUntil(cache.put(event.request, response.clone()));
      return response;
    } catch (_) { return Response.error(); }
  })());
});
