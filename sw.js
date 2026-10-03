const CACHE='anilx-v16-unified-lang';
const ASSETS=['./','./index.html','./style.css','./script.js','./completion-layer.js','./unified-i18n-v3.js','./experience-dna.js','./adaptive-shell.js','./manifest.webmanifest','./icon.png','./robots.txt','./sitemap.xml','./sw.js','./settlement.html','./privacy.html','./terms.html','./support.html'];

self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(async cache=>{await Promise.allSettled(ASSETS.map(async x=>{try{const r=await fetch(new Request(x,{cache:'reload'}));if(r.ok)await cache.put(x,r.clone())}catch{}}))}).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 event.respondWith((async()=>{
   const isHtml=request.destination==='document'||url.pathname.endsWith('.html')||url.pathname==='/';
   if(isHtml){try{const fresh=await fetch(request,{cache:'no-store'});if(fresh.ok){caches.open(CACHE).then(c=>c.put(request,fresh.clone())).catch(()=>{});return fresh}}catch{} }
   const cached=await caches.match(request);
   const network=fetch(request).then(response=>{
     if(response.ok)caches.open(CACHE).then(c=>c.put(request,response.clone())).catch(()=>{});
     return response;
   }).catch(()=>null);
   return cached||await network||await caches.match('./index.html');
 })());
});
