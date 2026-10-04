const CACHE='anilx-v17-fast-admin';
const CORE=['./','./index.html','./style.css','./script.js','./unified-i18n-v3.js','./admin.html','./admin.js'];
const OPTIONAL=['./completion-layer.js','./experience-dna.js','./adaptive-shell.js','./manifest.webmanifest','./icon.png','./robots.txt','./sitemap.xml','./sw.js','./settlement.html','./privacy.html','./terms.html','./support.html'];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE).then(cache=>Promise.allSettled(
      CORE.map(async x=>{try{const r=await fetch(new Request(x,{cache:'reload'}));if(r.ok)await cache.put(x,r.clone())}catch{}})
    )).then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
  event.respondWith((async()=>{
    const isHtml=request.destination==='document'||url.pathname.endsWith('.html')||url.pathname==='/';
    const key=request;
    const cached=await caches.match(key);
    if(isHtml){
      if(cached){
        fetch(request,{cache:'no-store'}).then(response=>{
          if(response.ok)caches.open(CACHE).then(c=>c.put(key,response.clone())).catch(()=>{});
        }).catch(()=>{});
        return cached;
      }
      try{
        const fresh=await fetch(request,{cache:'no-store'});
        if(fresh.ok)caches.open(CACHE).then(c=>c.put(key,fresh.clone())).catch(()=>{});
        return fresh;
      }catch{
        return cached||await caches.match('./index.html');
      }
    }
    if(cached)return cached;
    try{
      const response=await fetch(request);
      if(response.ok)caches.open(CACHE).then(c=>c.put(key,response.clone())).catch(()=>{});
      return response;
    }catch{
      return await caches.match('./index.html');
    }
  })());
});