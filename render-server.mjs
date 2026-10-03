import http from 'node:http';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzip} from 'node:zlib';
import {promisify} from 'node:util';
import {createHmac} from 'node:crypto';
import {createPaymentsStore} from './functions/api/render-payments-store.mjs';
import {handleExecutionReadiness} from './functions/api/execution-readiness.mjs';

const gzipAsync=promisify(gzip);
const root=path.dirname(fileURLToPath(import.meta.url));
const assetCache=new Map();
const gzipCache=new Map();
let workerPromise=null;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8','.webp':'image/webp','.mp3':'audio/mpeg'};

const getWorker=()=>workerPromise||(workerPromise=import('./worker.js').then(m=>m.default));
const HOT_ASSETS=['index.html','style.css','script.js','completion-layer.js','anilx-enhance.js','experience-dna.js','adaptive-shell.js','site-guard-center.js','webmcp.js','tonconnect.js'];
void Promise.all(HOT_ASSETS.map(async name=>{try{const file=path.join(root,name);assetCache.set(file,await fs.readFile(file))}catch{}}));

async function assetsFetch(request){
  const u=new URL(request.url);
  let rel=decodeURIComponent(u.pathname).replace(/^\/+/, '')||'index.html';
  if(rel.includes('..'))return new Response('Not Found',{status:404});
  let file=path.join(root,rel);
  if(!path.extname(file))file=path.join(root,'index.html');
  try{
    let data=assetCache.get(file);
    if(!data){data=await fs.readFile(file);assetCache.set(file,data)}
    const ext=path.extname(file).toLowerCase();
    const isAdmin=path.basename(file)==='admin.html';
    const cache=isAdmin?'no-store':ext==='.html'?'public,max-age=300,stale-while-revalidate=1800':ext==='.xml'?'public,max-age=300,stale-while-revalidate=1800':'public,max-age=86400,stale-while-revalidate=604800';
    return new Response(data,{status:200,headers:{'content-type':mime[ext]||'application/octet-stream','cache-control':cache}});
  }catch{return new Response('Not Found',{status:404})}
}

const ADMIN_SECRET=String(process.env.ANIL_ADMIN_PASSWORD||'').normalize('NFKC').trim();
// Admin authentication is fail-closed at the login endpoint; a missing secret must never take the public ANIL X runtime offline.

const env={...process.env,ASSETS:{fetch:assetsFetch},PAYMENTS:createPaymentsStore(process.env.REDIS_URL)};
const loginAttempts=new Map();
const b64u=s=>Buffer.from(s).toString('base64').replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_');
const signNode=(v,secret)=>b64u(createHmac('sha256',secret).update(v).digest());
const jsonNode=(obj,status=200,extra={})=>new Response(JSON.stringify(obj),{status,headers:{'content-type':'application/json; charset=utf-8',...extra}});
async function directAdminLogin(req){
  if(req.method!=='POST')return jsonNode({ok:false,error:'method_not_allowed'},405);
  const secret=String(process.env.ANIL_ADMIN_PASSWORD||'').normalize('NFKC').trim();
  if(secret.length<8)return jsonNode({ok:false,error:'admin_password_not_configured'},503);
  const ip=String(req.headers['x-forwarded-for']||'unknown').split(',')[0].trim();
  const now=Date.now(),gate=loginAttempts.get(ip)||{count:0,until:0};
  if(gate.until>now)return jsonNode({ok:false,error:'too_many_attempts'},429);
  let body={};try{body=JSON.parse(await new Promise((resolve,reject)=>{let s='';req.on('data',c=>s+=c);req.on('end',()=>{try{resolve(s)}catch(e){reject(e)}});req.on('error',reject)}))||{}}catch{return jsonNode({ok:false,error:'invalid_json'},400)}
  const pass=String(body.password||'').normalize('NFKC').trim();
  if(pass!==secret){const count=gate.count+1;loginAttempts.set(ip,{count,until:count>=5?now+900000:0});return jsonNode({ok:false,error:'invalid_credentials'},401)}
  loginAttempts.delete(ip);
  const payload=b64u(JSON.stringify({sub:'admin',exp:now+43200000}));
  const sig=signNode(payload,secret);
  return jsonNode({ok:true,expiresAt:now+43200000},200,{'set-cookie':`session=${payload}.${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200`});
}

const server=http.createServer(async(req,res)=>{
  try{
    const host=req.headers.host||'localhost';
    const origin='http://'+host;
    const u=new URL(origin+(req.url||'/'));

    if(u.pathname==='/api/health'&&req.method==='GET'){
      return res.end(await (async()=>{const out={ok:true,ready:true,service:'ANIL X',runtime:'render-static-gateway',configured:{admin:Boolean(process.env.ANIL_ADMIN_PASSWORD),openai:Boolean(process.env.OPENAI_API_KEY),anthropic:Boolean(process.env.ANTHROPIC_API_KEY),gemini:Boolean(process.env.GEMINI_API_KEY),variza:Boolean(process.env.VARIZA_API_KEY||process.env.VARIA_API_KEY||process.env.VARIZA_TOKEN||process.env.VARIZA_KEY),payments:Boolean(process.env.PAYMENTS||process.env.REDIS_URL),assets:true},revenue:{storageConfigured:Boolean(process.env.REDIS_URL),durableAccounting:String(process.env.PAYMENTS_DURABLE||'false').toLowerCase()==='true',variza:Boolean(process.env.VARIZA_API_KEY||process.env.VARIA_API_KEY||process.env.VARIZA_TOKEN||process.env.VARIZA_KEY),ton:Boolean(process.env.TON_MAIN_WALLET_ADDRESS||process.env.TON_PERMANENT_WALLET_ADDRESS),guardTemporaryTon:Boolean(process.env.TON_TEMP_WALLET_ADDRESS||process.env.GUARD_TEMP_WALLET_ADDRESS||process.env.TON_RECEIVING_ADDRESS)}};res.statusCode=200;res.setHeader('content-type','application/json; charset=utf-8');return JSON.stringify(out)})());
    }
    if(u.pathname==='/api/execution-readiness'){
      const rr=await handleExecutionReadiness(req,env);res.statusCode=rr.status;rr.headers.forEach((v,k)=>res.setHeader(k,v));res.end(Buffer.from(await rr.arrayBuffer()));return;
    }
    if(u.pathname==='/api/admin/password/login'&&req.method==='POST'){
      const rr=await directAdminLogin(req);res.statusCode=rr.status;rr.headers.forEach((v,k)=>res.setHeader(k,v));res.end(Buffer.from(await rr.arrayBuffer()));return;
    }
    if((req.method==='GET'||req.method==='HEAD')&&!u.pathname.startsWith('/api/')){
      const response=await assetsFetch(new Request(u,{method:req.method,headers:req.headers}));
      res.statusCode=response.status;
      response.headers.forEach((v,k)=>res.setHeader(k,v));
      if(req.method==='HEAD'){res.end();return}
      let buf=Buffer.from(await response.arrayBuffer());
      const ae=String(req.headers['accept-encoding']||'');
      const type=response.headers.get('content-type')||'';
      if(buf.length>1024&&/gzip/i.test(ae)&&/(text|javascript|json|svg|xml)/i.test(type)){
        const cachedGzip=gzipCache.get(String(u.pathname));
        if(cachedGzip)buf=cachedGzip;else{buf=await gzipAsync(buf,{level:4});gzipCache.set(String(u.pathname),buf);}
        res.setHeader('content-encoding','gzip');
        res.setHeader('vary','Accept-Encoding');
      }
      res.setHeader('content-length',String(buf.length));
      res.end(buf);
      return;
    }

    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const body=chunks.length?Buffer.concat(chunks):undefined;
    const request=new Request(origin+(req.url||'/'),{
      method:req.method,headers:req.headers,
      body:['GET','HEAD'].includes(req.method)?undefined:body
    });
    const worker=await getWorker();
    const response=await worker.fetch(request,env,{});
    res.statusCode=response.status;
    response.headers.forEach((v,k)=>res.setHeader(k,v));
    const buf=Buffer.from(await response.arrayBuffer());
    res.setHeader('content-length',String(buf.length));
    res.end(buf);
  }catch(err){
    res.statusCode=500;
    res.setHeader('content-type','application/json');
    res.end(JSON.stringify({ok:false,error:'render_runtime_error',message:String(err?.message||err)}));
  }
});

const port=Number(process.env.PORT||10000);
server.listen(port,'0.0.0.0',()=>{ 
  console.log('ANIL X Render runtime listening on '+port);
});