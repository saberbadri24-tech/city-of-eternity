import http from 'node:http';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import worker from './worker.js';

const root=path.dirname(fileURLToPath(import.meta.url));
const assetCache=new Map();
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8','.webp':'image/webp','.mp3':'audio/mpeg'};

async function assetsFetch(request){
  const u=new URL(request.url);
  let rel=decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'index.html';
  if(rel.includes('..')) return new Response('Not Found',{status:404});
  let file=path.join(root,rel);
  try{
    let st=await fs.stat(file);
    if(st.isDirectory()) file=path.join(file,'index.html');
  }catch{
    if(!path.extname(file)) file=path.join(root,'index.html');
  }
  try{
    let data=assetCache.get(file);
    if(!data){ data=await fs.readFile(file); assetCache.set(file,data); }
    const ext=path.extname(file).toLowerCase(); const headers={'content-type':mime[ext]||'application/octet-stream','cache-control':ext==='.html'||ext==='.xml'?'public, max-age=60, stale-while-revalidate=300':'public, max-age=86400, stale-while-revalidate=604800'};
    return new Response(data,{status:200,headers});
  }catch{
    return new Response('Not Found',{status:404});
  }
}

const ADMIN_SECRET=String(process.env.ANIL_ADMIN_PASSWORD||'');
if(ADMIN_SECRET.length<8){
  console.error('FATAL: ANIL_ADMIN_PASSWORD is missing or too short; refusing to start.');
  process.exit(1);
}
const env={...process.env,ASSETS:{fetch:assetsFetch}};
const server=http.createServer(async(req,res)=>{
  // Keep the hot process path cheap: static assets are cached in memory after first read.
  try{
    const host=req.headers.host||'localhost';
    const origin='http://'+host;
    if(req.method==='GET'||req.method==='HEAD'){
      const u=new URL(origin+(req.url||'/'));
      if(!u.pathname.startsWith('/api/')){
        const response=await worker.fetch(new Request(u,{method:req.method,headers:req.headers}),env,{});
        res.statusCode=response.status;
        response.headers.forEach((v,k)=>res.setHeader(k,v));
        if(req.method==='HEAD'){res.end();return;}
        res.end(Buffer.from(await response.arrayBuffer()));
        return;
      }
    }
    const chunks=[];
    for await(const chunk of req) chunks.push(chunk);
    const body=chunks.length?Buffer.concat(chunks):undefined;
    const request=new Request(origin+(req.url||'/'),{
      method:req.method,
      headers:req.headers,
      body:['GET','HEAD'].includes(req.method)?undefined:body,
    });
    const response=await worker.fetch(request,env,{});
    res.statusCode=response.status;
    response.headers.forEach((v,k)=>res.setHeader(k,v));
    const buf=Buffer.from(await response.arrayBuffer());
    res.end(buf);
  }catch(err){
    res.statusCode=500;
    res.setHeader('content-type','application/json');
    res.end(JSON.stringify({ok:false,error:'render_runtime_error',message:String(err?.message||err)}));
  }
});
const port=Number(process.env.PORT||10000);
server.listen(port,'0.0.0.0',()=>console.log('ANIL X Render runtime listening on '+port));