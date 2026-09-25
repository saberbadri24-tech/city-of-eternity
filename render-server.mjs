import http from 'node:http';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import worker from './worker.js';

const root=path.dirname(fileURLToPath(import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8','.webp':'image/webp','.mp3':'audio/mpeg'};

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
    const data=await fs.readFile(file);
    const headers={'content-type':mime[path.extname(file).toLowerCase()]||'application/octet-stream'};
    return new Response(data,{status:200,headers});
  }catch{
    return new Response('Not Found',{status:404});
  }
}

const env={...process.env,ASSETS:{fetch:assetsFetch}};
const server=http.createServer(async(req,res)=>{
  try{
    const host=req.headers.host||'localhost';
    const origin='http://'+host;
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