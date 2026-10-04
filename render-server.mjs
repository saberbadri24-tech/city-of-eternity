import http from 'node:http';
import {promises as fs,readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHmac} from 'node:crypto';
import {handleExecutionReadiness} from './functions/api/execution-readiness.mjs';
import {adminLogin,adminConfigured,adminSelfTest} from './functions/api/admin-auth.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
let guardFastCache=null;
try{
  const read=(name)=>JSON.parse(readFileSync(path.join(root,name),'utf8'));
  const status=read('guard-status.json'),radar=read('guard-super-radar.json'),ledger=read('guard-evidence-ledger.json');
  guardFastCache={status,radar,ledger,loadedAt:Date.now()};
}catch{}
let workerPromise=null;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8','.webp':'image/webp','.mp3':'audio/mpeg'};

const getWorker=()=>workerPromise||(workerPromise=import('./worker.js').then(m=>m.default));

async function assetsFetch(request){
  const u=new URL(request.url);
  let rel=decodeURIComponent(u.pathname).replace(/^\/+/, '')||'index.html';
  if(rel.includes('..'))return new Response('Not Found',{status:404});
  let file=path.join(root,rel);
  if(!path.extname(file))file=path.join(root,'index.html');
  try{
    const data=await fs.readFile(file);
    const ext=path.extname(file).toLowerCase();
    const isAdmin=path.basename(file)==='admin.html';
    const cache=isAdmin?'no-store':ext==='.html'?'public,max-age=300,stale-while-revalidate=1800':ext==='.xml'?'public,max-age=300,stale-while-revalidate=1800':'public,max-age=86400,stale-while-revalidate=604800';
    return new Response(data,{status:200,headers:{'content-type':mime[ext]||'application/octet-stream','cache-control':cache}});
  }catch{return new Response('Not Found',{status:404})}
}

// Admin authentication is implemented once in functions/api/admin-auth.mjs.
let paymentsStorePromise=null;
const getPaymentsStore=()=>paymentsStorePromise||(paymentsStorePromise=process.env.REDIS_URL?import('./functions/api/render-payments-store.mjs').then(m=>m.createPaymentsStore(process.env.REDIS_URL)):Promise.resolve(null));
const env={...process.env,ASSETS:{fetch:assetsFetch},PAYMENTS:null};
const server=http.createServer(async(req,res)=>{
  try{
    const host=req.headers.host||'localhost';
    const origin='http://'+host;
    const u=new URL(origin+(req.url||'/'));

    if(u.pathname==='/api/health'&&req.method==='GET'){
      return res.end(await (async()=>{const mainTon=process.env.TON_MAIN_WALLET||process.env.TON_MAIN_WALLET_ADDRESS||process.env.TON_PERMANENT_WALLET_ADDRESS;const out={ok:true,ready:adminConfigured(env),service:'ANIL X',runtime:'render-static-gateway',configured:{admin:adminConfigured(env),openai:Boolean(process.env.OPENAI_API_KEY),anthropic:Boolean(process.env.ANTHROPIC_API_KEY),gemini:Boolean(process.env.GEMINI_API_KEY),variza:Boolean(process.env.VARIZA_API_KEY||process.env.VARIA_API_KEY||process.env.VARIZA_TOKEN||process.env.VARIZA_KEY||process.env.VARIZA_API||process.env.VARIZA_ACCESS_TOKEN||process.env.VARIZA_BEARER_TOKEN),payments:Boolean(process.env.PAYMENTS||process.env.REDIS_URL),assets:true},revenue:{storageConfigured:Boolean(process.env.REDIS_URL),durableAccounting:String(process.env.PAYMENTS_DURABLE||'false').toLowerCase()==='true',variza:Boolean(process.env.VARIZA_API_KEY||process.env.VARIA_API_KEY||process.env.VARIZA_TOKEN||process.env.VARIZA_KEY),ton:Boolean(mainTon),guardCatchQueue:true,temporaryWalletUsed:false}};res.statusCode=200;res.setHeader('content-type','application/json; charset=utf-8');return JSON.stringify(out)})());
    }
    if(u.pathname==='/api/guard/live'&&req.method==='GET'){
      const snap=guardFastCache||{status:{},radar:{},ledger:{}};
      const status=snap.status||{},radar=snap.radar||{},ledger=snap.ledger||{};
      const body={ok:true,source:'ANIL-X-local-guard-state',updatedAt:status.updatedAt||status.lastScan||radar.generatedAt||null,freshness:{stale:false,requiredMaxMinutes:15},guard:{status:String(status.status||status.mode||'NORMAL'),discoveryCount:Number(status.discoveryCount||status.counts?.opportunities||0),sourcesScanned:Number(status.sourcesScanned||0),sourcesReachable:Number(status.sourcesReachable||0),waitingOwner:Number(status.waitingOwner||0),highValueCandidates:Number(status.highValueCandidates||status.counts?.incomePriority||0)},radar:{candidates:Number(radar?.summary?.totalCandidates||0),officialCandidates:Number(radar?.summary?.officialCandidates||0),actionableOfficial:Number(radar?.summary?.actionableOfficial||0),highPriority:Number(radar?.summary?.highPriority||0)},revenue:{confirmedIncome:Number(ledger.confirmedIncome||ledger.totalReceived||0),status:String(ledger.status||'UNCONFIRMED')},transfer:{status:'OWNER_APPROVAL_REQUIRED',temporaryWalletUsed:false},safety:{autoClaim:false,autoSigning:false,autoTransfer:false,secretStorage:false,ownerApprovalRequired:true}};
      res.statusCode=200;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(body));
      void (async()=>{try{const read=async name=>JSON.parse(await fs.readFile(path.join(root,name),'utf8'));guardFastCache={status:await read('guard-status.json'),radar:await read('guard-super-radar.json'),ledger:await read('guard-evidence-ledger.json'),loadedAt:Date.now()};}catch{}})();
      return;
    }
    if(u.pathname==='/api/anil/super-team'&&req.method==='GET'){
      const body={ok:true,engine:'ANIL-SUPER-TEAM',version:'2.0.0-frontier-aware',generatedAt:new Date().toISOString(),task:'read-only live QA snapshot',chain:['ANIL','Astra','Claude','Gemini','Guard','Revenue Fleet','QA Sentinel'],executionMode:'local-safe',evidence:{providerKeys:{astra:Boolean(env.OPENAI_API_KEY||env.OPENAI_KEY),claude:Boolean(env.ANTHROPIC_API_KEY||env.ANTHROPIC_KEY),gemini:Boolean(env.GEMINI_API_KEY||env.GOOGLE_GEMINI_API_KEY||env.GOOGLE_API_KEY)}},safety:{finalCommand:'ANIL',irreversibleActions:'OWNER_APPROVAL',moneyMovement:'OWNER_APPROVAL',privateKeys:false,seedPhrases:false,autoSigning:false,captchaBypass:false,kycBypass:false},truth:{revenueCountsOnlyWhenSettled:true,providerConfigurationIsNotRuntimeProof:true,modelCatalogIsNotRuntimeProof:true}};
      res.statusCode=200;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(body));return;
    }
    if(u.pathname==='/api/anil/super-team'&&req.method==='POST'){
      const hasProvider=Boolean(env.OPENAI_API_KEY||env.OPENAI_KEY||env.ANTHROPIC_API_KEY||env.ANTHROPIC_KEY||env.GEMINI_API_KEY||env.GOOGLE_GEMINI_API_KEY||env.GOOGLE_API_KEY);
      if(!hasProvider){
        const body={ok:true,engine:'ANIL-SUPER-TEAM',version:'2.0.0-frontier-aware',generatedAt:new Date().toISOString(),executionMode:'local-safe',command:'DISCOVER -> VERIFY -> SCORE -> QUALIFY -> TEST -> SHIP -> MEASURE -> LEARN -> IMPROVE',providers:{astra:{live:false,reason:'runtime_secret_missing'},claude:{live:false,reason:'runtime_secret_missing'},gemini:{live:false,reason:'runtime_secret_missing'}},safety:{finalCommand:'ANIL',irreversibleActions:'OWNER_APPROVAL',moneyMovement:'OWNER_APPROVAL',privateKeys:false,seedPhrases:false,autoSigning:false},truth:{noFakeExecution:true,noFakeRevenue:true}};
        res.statusCode=200;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(body));return;
      }
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const body=chunks.length?Buffer.concat(chunks):undefined;
      const request=new Request(origin+(req.url||'/'),{method:'POST',headers:req.headers,body});
      const {handleSuperTeam}=await import('./functions/api/anil-super-team.mjs');
      const rr=await handleSuperTeam(request,env,{});
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
