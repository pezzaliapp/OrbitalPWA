const CACHE='orbital-pwa-v7';
const ASSETS=['./','index.html','readme.html','app.v7.js','manifest.json','icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))))});

self.addEventListener('fetch', e=>{
  const req = e.request;
  const url = new URL(req.url);
  if(url.origin !== location.origin){ return; }

  // HTML pages: network-first (so new readme/index load), fallback to cache
  const isHTML = req.mode === 'navigate' || (req.headers.get('accept')||'').includes('text/html');
  if(isHTML){
    e.respondWith(fetch(req).then(r=>{
      const copy = r.clone(); caches.open(CACHE).then(c=>c.put(req, copy)); return r;
    }).catch(()=>caches.match(req).then(r=>r||caches.match('index.html'))));
    return;
  }

  // Other assets: cache-first
  e.respondWith(caches.match(req).then(r=> r || fetch(req)));
});
