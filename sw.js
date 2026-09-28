const CACHE='anilx-v10-fast';
const ASSETS=['./','./index.html','./en.html','./fa.html','./services.html','./revenue-engine.html','./payment.html','./guard.html','./admin.html','./style.css','./script.js','./anilx-enhance.js','./experience-dna.js','./adaptive-shell.js','./webmcp.js','./tonconnect.js','./sw.js','./manifest.webmanifest','./icon.png','./robots.txt','./sitemap.xml','./render-tonconnect-manifest.json'];

self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS.map(x=>new Request(x,{cache:'reload'}))).catch(()=>{})).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 event.respondWith((async()=>{
   const cached=await caches.match(request);
   const network=fetch(request).then(response=>{
     if(response.ok)caches.open(CACHE).then(c=>c.put(request,response.clone())).catch(()=>{});
     return response;
   }).catch(()=>null);
   return cached||await network||await caches.match('./index.html');
 })());
});
