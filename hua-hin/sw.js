const CACHE='hh-trip-v1';
const FILES=['./','./index.html','./styles.css','./app.mjs','./core.mjs','./trip-data.mjs','./routes.json','./photo-credits.json','./train-times.ics','./manifest.webmanifest','./vendor/leaflet.js','./vendor/leaflet.css','./assets/plex-0.ttf','./assets/plex-1.ttf','./assets/plex-2.ttf','./assets/beach.webp','./assets/beach-evening.webp','./assets/hotel.webp','./assets/station.webp','./assets/hualamphong.webp','./assets/takiab.webp','./assets/cicada.webp','./assets/tamarind.webp','./assets/night-market.webp','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(FILES);await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('hh-trip-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();for(const c of await self.clients.matchAll())c.postMessage({type:'HH_CACHE_READY'});})()));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url),scope=new URL(self.registration.scope);
 // Never cache third-party map tiles, directions, or anything outside this app.
 if(req.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 const known=new Set(FILES.map(p=>new URL(p,scope).pathname));if(!known.has(url.pathname)&&req.mode!=='navigate')return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE),key=new Request(url.origin+url.pathname);
  try{const response=await fetch(req);if(response.ok)await cache.put(key,response.clone());return response;}
  catch{const cached=await cache.match(key);if(cached)return cached;if(req.mode==='navigate')return (await cache.match(new URL('./index.html',scope).href))??Response.error();return Response.error();}
 })());
});
