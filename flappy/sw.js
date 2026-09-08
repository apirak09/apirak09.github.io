'use strict';
const CACHE = 'flappy-sky-club-v1';
const FILES = ['./', './index.html', './styles.css', './core.js', './audio.js', './game.js', './manifest.webmanifest', './assets/bird.png', './assets/sky.webp', './assets/icon-192.png', './assets/icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('flappy-sky-club-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith(caches.match(event.request).then(cached => {
    const fresh = fetch(event.request).then(response => {
      if (response.ok && response.type === 'basic') { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy))); }
      return response;
    });
    if (cached) { event.waitUntil(fresh.catch(() => {})); return cached; }
    return fresh.catch(() => { if (event.request.mode === 'navigate') return caches.match('./index.html'); return Response.error(); });
  }));
});
