const CACHE='anilx-v18-nonblocking';

self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting());});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.registration.navigationPreload?.enable?.().catch(()=>{}))
      .then(()=>self.clients.claim())
  );
});

async function putCached(request,response){
  if(!response||!response.ok)return;
  try{const cache=await caches.open(CACHE);await cache.put(request,response.clone());}catch{}
}

self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
  event.respondWith((async()=>{
    const isHtml=request.destination==='document'||url.pathname.endsWith('.html')||url.pathname==='/';
    const cached=await caches.match(request);
    if(isHtml){
      try{
        const fresh=await fetch(request,{cache:'no-store'});
        void putCached(request,fresh);
        return fresh;
      }catch{return cached||await caches.match('./index.html');}
    }
    if(cached)return cached;
    try{
      const response=await fetch(request);
      void putCached(request,response);
      return response;
    }catch{return await caches.match('./index.html');}
  })());
});