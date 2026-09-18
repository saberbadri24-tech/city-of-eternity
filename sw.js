const CACHE='anilx-v13';
const ASSETS=['./','./index.html','./en.html','./services.html','./style.css','./script.js','./anilx-enhance.js','./experience-dna.js','./adaptive-shell.js','./webmcp.js','./manifest.webmanifest','./icon.png','./robots.txt','./sitemap.xml','./tonconnect-manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
      }
      return response;
    }).catch(() => caches.match(request).then(cached => cached || caches.match('./index.html')))
  );
});
