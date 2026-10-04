import http from 'node:http';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzip} from 'node:zlib';
import {promisify} from 'node:util';
import {createHmac} from 'node:crypto';
import {createPaymentsStore} from './functions/api/render-payments-store.mjs';
import {handleExecutionReadiness} from './functions/api/execution-readiness.mjs';
import {adminLogin,adminConfigured,adminSelfTest} from './functions/api/admin-auth.mjs';
import {handleGuardLive} from './functions/api/guard-live.mjs';
import {handleSuperTeam} from './functions/api/anil-super-team.mjs';

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

// Admin authentication is implemented once in functions/api/admin-auth.mjs.
const env={...process.env,ASSETS:{fetch:assetsFetch},PAYMENTS:createPaymentsStore(process.env.REDIS_URL)};
const server=http.createServer(async(req,res)=>{
  try{
    const host=req.headers.host||'localhost';
    const origin='http://'+host;
    const u=new URL(origin+(req.url||'/'));

    if(u.pathname==='/api/health'&&req.method==='GET'){
      return res.end(await (async()=>{const mainTon=process.env.TON_MAIN_WALLET||process.env.TON_MAIN_WALLET_ADDRESS||process.env.TON_PERMANENT_WALLET_ADDRESS;const out={ok:true,ready:adminConfigured(env),service:'ANIL X',runtime:'render-static-gateway',configured:{admin:adminConfigured(env),openai:Boolean(process.env.OPENAI_API_KEY),anthropic:Boolean(process.env.ANTHROPIC_API_KEY),gemini:Boolean(process.env.GEMINI_API_KEY),variza:Boolean(process.env.VARIZA_API_KEY||process.env.VARIA_API_KEY||process.env.VARIZA_TOKEN||process.env.VARIZA_KEY||process.env.VARIZA_API||process.env.VARIZA_ACCESS_TOKEN||process.env.VARIZA_BEARER_TOKEN),payments:Boolean(process.env.PAYMENTS||process.env.REDIS_URL),assets:true},revenue:{storageConfigured:Boolean(process.env.REDIS_URL),durableAccounting:String(process.env.PAYMENTS_DURABLE||'false').toLowerCase()==='true',variza:Boolean(process.env.VARIZA_API_KEY||process.env.VARIA_API_KEY||process.env.VARIZA_TOKEN||process.env.VARIZA_KEY),ton:Boolean(mainTon),guardCatchQueue:true,temporaryWalletUsed:false}};res.statusCode=200;res.setHeader('content-type','application/json; charset=utf-8');return JSON.stringify(out)})());
    }
    if(u.pathname==='/api/guard/live'&&req.method==='GET'){
      const readJson=async name=>{try{return JSON.parse(await fs.readFile(path.join(root,name),'utf8'));}catch{return null;}};
      const status=await readJson('guard-status.json')||{};
      const opportunities=await readJson('guard-opportunities.json')||{};
      const high=await readJson('guard-high-value.json')||{};
      const ledger=await readJson('guard-evidence-ledger.json')||{};
      const oppItems=Array.isArray(opportunities.items)?opportunities.items:Array.isArray(opportunities.opportunities)?opportunities.opportunities:[];
      const highItems=Array.isArray(high.items)?high.items:Array.isArray(high.opportunities)?high.opportunities:[];
      const body={ok:true,source:'ANIL-X-local-guard-state',updatedAt:status.updatedAt||status.lastScan||opportunities.updatedAt||null,freshness:{stale:false,requiredMaxMinutes:15},guard:{status:String(status.status||status.mode||'NORMAL'),discoveryCount:Number(status.discoveryCount||status.counts?.opportunities||oppItems.length||0),sourcesScanned:Number(status.sourcesScanned||0),sourcesReachable:Number(status.sourcesReachable||0),waitingOwner:Number(status.waitingOwner||0),highValueCandidates:Number(status.highValueCandidates||status.counts?.incomePriority||highItems.length||0)},opportunities:{count:oppItems.length,items:oppItems.slice(0,5).map(x=>({id:x?.id||null,title:String(x?.title||x?.name||'فرصت').slice(0,100),source:String(x?.source||x?.resolvedDomain||'').slice(0,100),status:String(x?.status||x?.verification||'').slice(0,50)}))},valueHunter:{count:highItems.length,items:highItems.slice(0,5).map(x=>({id:x?.id||null,title:String(x?.title||x?.name||'فرصت').slice(0,100),source:String(x?.source||x?.resolvedDomain||'').slice(0,100),status:String(x?.status||x?.verification||'').slice(0,50)}))},revenue:{confirmedIncome:Number(ledger.confirmedIncome||ledger.totalReceived||0),status:String(ledger.status||'UNCONFIRMED')},transfer:{status:'OWNER_APPROVAL_REQUIRED',temporaryConfigured:false,temporaryWalletUsed:false,catchQueueConfigured:Boolean(process.env.REDIS_URL),catchQueuePending:Number(status.waitingOwner||0)},ai:{live:false,configured:false,successfulCalls:0,providers:{}},safety:{autoClaim:false,autoSigning:false,autoTransfer:false,secretStorage:false,bypassControls:false,ownerApprovalRequired:true}};
      res.statusCode=200;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(body));return;
    }
    if((u.pathname==='/api/anil/super-team')&&(req.method==='GET'||req.method==='POST')){
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const body=chunks.length?Buffer.concat(chunks):undefined;
      const request=new Request(origin+(req.url||'/'),{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:body});
      const rr=await handleSuperTeam(request,env,{guardHandler:handleGuardLive});
      res.statusCode=rr.status;rr.headers.forEach((v,k)=>res.setHeader(k,v));res.end(Buffer.from(await rr.arrayBuffer()));return;
    }
    if(u.pathname==='/api/execution-readiness'){
      const rr=await handleExecutionReadiness(req,env);res.statusCode=rr.status;rr.headers.forEach((v,k)=>res.setHeader(k,v));res.end(Buffer.from(await rr.arrayBuffer()));return;
    }
    if((u.pathname==='/api/admin/self-test'||u.pathname==='/api/admin/auth-self-test')&&req.method==='GET'){
      const out=await adminSelfTest(env);
      res.statusCode=200;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(out));return;
    }
    if(u.pathname==='/api/admin/password/login'&&req.method==='POST'){
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const body=chunks.length?Buffer.concat(chunks):undefined;
      const request=new Request(origin+(req.url||'/'),{method:req.method,headers:req.headers,body});
      const rr=await adminLogin(request,env);
      res.statusCode=rr.status;rr.headers.forEach((v,k)=>res.setHeader(k,v));res.end(Buffer.from(await rr.arrayBuffer()));return;
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
