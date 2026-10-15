'use strict';
const CACHE = 'flappy-sky-club-club-3.0.0';
const FILES = ['./', './index.html', './styles.css?v=club-3.0.0', './core.js?v=club-3.0.0', './audio.js?v=club-3.0.0', './club.js?v=club-3.0.0', './updates.js?v=club-3.0.0', './game.js?v=club-3.0.0', './manifest.webmanifest?v=club-3.0.0', './assets/bird.png', './assets/sky.webp', './assets/icon-192.png', './assets/icon-512.png', './assets/blood-moon.webp', './assets/bat.png', './assets/skins/mint.svg', './assets/skins/rose.svg', './assets/skins/ice.svg', './assets/skins/prism.svg', './assets/skins/aurora.svg', './assets/skins/neon.svg', './assets/skins/batman.svg', './assets/skins/spiderman.svg', './assets/skins/superman.svg', './assets/skins/captain.svg', './assets/skins/ironman.svg', './assets/skins/thor.svg', './assets/skins/panther.svg', './assets/skins/strange.svg'];
self.addEventListener('install', event => {
  // A complete release (including every costume) must download before activation.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(file => new Request(file, { cache: 'reload' })))));
});
self.addEventListener('message', event => {
  // Activation is requested by the update button, never in the middle of a flight.
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('flappy-sky-club-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    // Release checks must reach the network, even when older files are cached.
    if (url.pathname.endsWith('/version.json') || url.pathname.endsWith('/sw.js')) {
      try { return await fetch(new Request(event.request, { cache: 'no-store' })); } catch (_) { return Response.error(); }
    }
    const cache = await caches.open(CACHE);
    // HTML checks for updates; versioned code always stays a coherent set.
    if (event.request.mode === 'navigate') {
      try {
        const response = await fetch(new Request(event.request, { cache: 'no-store' }));
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
