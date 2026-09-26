const state=globalThis.__ANILX_RUNTIME_STATE||(globalThis.__ANILX_RUNTIME_STATE={accounts:new Map(),sessions:new Map(),orders:new Map(),freeRequests:new Map(),queue:new Map()});
const now=()=>new Date().toISOString();
const clean=(v,n=100)=>String(v??'').trim().slice(0,n);
const id=()=>crypto.randomUUID?.()||('ax-'+Date.now()+'-'+Math.random().toString(36).slice(2));
const json=(d,s=200,h={})=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...h}});
export {state,now,clean,id,json};