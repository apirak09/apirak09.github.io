const CACHE = 'cinematic-play-shell-v6.0.0';
const CORE = ['./index.html', './styles.css', './app.js', './shared.mjs', './stories.mjs', './storage.mjs', './sync.mjs', './ui.mjs', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png'];
const urls = new Set(CORE.map(file => new URL(file, self.registration.scope).href));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE.map(file => new Request(new URL(file, self.registration.scope), { cache: 'reload' })))));
});
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    // Other games on apirak09.github.io share this origin. Never delete their caches.
    await Promise.all(keys.filter(key => key !== CACHE && (/^cinematic-play-shell-v/.test(key) || /^cinematic-play-v\d+$/.test(key))).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  const shellNavigation = request.mode === 'navigate' && (url.pathname === new URL(self.registration.scope).pathname || url.pathname === new URL('./index.html', self.registration.scope).pathname);
  if (!shellNavigation && !urls.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(shellNavigation ? new URL('./index.html', self.registration.scope).href : request);
    // Serve a consistent shell version. A waiting worker exposes the update button.
    return cached || fetch(request);
  })());
});
