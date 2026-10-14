'use strict';
const CACHE = 'apirak-flappy2-v1';
const FILES = ['./', './index.html', './styles.css', './app.mjs', './engine.mjs', './renderer.mjs', './audio.mjs', './manifest.webmanifest', './assets/icon.svg', './assets/icon-192.png', './assets/icon-512.png', './assets/fonts/chakra-petch-bold.woff2', './assets/fonts/manrope.woff2'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))); });
// A new worker waits for existing flights to close. Never replace scripts mid-run.
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('apirak-flappy2-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => { if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {}); } return response; }).catch(() => event.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())));
});
