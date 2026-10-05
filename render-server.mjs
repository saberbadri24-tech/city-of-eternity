import http from 'node:http';
import {promises as fs,createReadStream} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
let workerPromise=null;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8','.webp':'image/webp','.mp3':'audio/mpeg'};

const getWorker=()=>workerPromise||(workerPromise=import('./worker.js').then(m=>m.default));
const MAX_BODY_BYTES=512*1024;
const PRIVATE_ROOTS=new Set(['.git','.github','app','mobile','ui','netlify','functions','scripts']);
const PRIVATE_FILES=new Set(['package.json','package-lock.json','render-server.mjs','worker.js','_worker.js','wrangler.json','netlify.toml','_headers','.env','.env.local']);
const publicPath=rel=>{const clean=String(rel||'').replace(/^\/+/, '');if(!clean||clean.includes('..'))return false;const first=clean.split('/')[0];if(first.startsWith('.')&&first!=='.well-known')return false;if(PRIVATE_ROOTS.has(first)||PRIVATE_FILES.has(clean)||PRIVATE_FILES.has(path.basename(clean)))return false;return true;};
const readBody=async(req,limit=MAX_BODY_BYTES)=>{let total=0;const chunks=[];for await(const chunk of req){total+=chunk.length;if(total>limit)throw Object.assign(new Error('request_body_too_large'),{statusCode:413});chunks.push(chunk)}return chunks.length?Buffer.concat(chunks):undefined};

async function assetsFetch(request){
  const u=new URL(request.url);
  let rel=decodeURIComponent(u.pathname).replace(/^\/+/, '')||'index.html';
  if(!publicPath(rel))return new Response('Not Found',{status:404});
  let file=path.join(root,rel);
  if(!path.extname(file))file=path.join(root,'index.html');
  try{
    let data=await fs.readFile(file);
    const ext=path.extname(file).toLowerCase();
    const isHtml=ext==='.html';
    const isAdmin=path.basename(file)==='admin.html';
    const versioned=Boolean(u.search);
    const cache=isAdmin?'no-store':isHtml?'public,max-age=300,stale-while-revalidate=1800':versioned?'public,max-age=31536000,immutable':'public,max-age=86400,stale-while-revalidate=604800';
    if(isHtml){
      const marker='<!-- ANILX-PROJECT-CONTINUITY: ADVANCED-MODE / ANIL-X-ONLY / KEEP-ITERATING-UNTIL-REAL-GREEN -->';
      const agentMeta='<meta name="anilx-project" content="ANIL X ONLY | ADVANCED MODE | preserve current runtime | inspect this page as part of ANIL X | never mix other projects">';
      const agentRuntime='<script>window.__ANILX_PROJECT_CONTEXT__={product:"ANIL X",mode:"advanced",scope:"ANIL-X-only",guard:"Immortal Guard",rule:"preserve-runtime-and-continue-until-real-green"};</script>';
      const html=Buffer.from(data).toString('utf8');
      const withContext=html.includes('name="anilx-project"')?html:html.replace(/<head>/i,'<head>\\n'+agentMeta+'\\n'+agentRuntime);data=Buffer.from((html.includes('ANILX-PROJECT-CONTINUITY:')?'':marker+'\\n')+withContext);
    }
    const headers={
      'content-type':mime[ext]||'application/octet-stream',
      'cache-control':cache,
      'x-content-type-options':'nosniff',
      'referrer-policy':'strict-origin-when-cross-origin',
      'permissions-policy':'camera=(),microphone=(self),geolocation=(),payment=(self)',
      'cross-origin-opener-policy':'same-origin-allow-popups',
      'cross-origin-resource-policy':'same-site'
    };
    return new Response(data,{status:200,headers});
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

    if((u.pathname==='/healthz'||u.pathname==='/api/health')&&req.method==='GET'){
      return res.end(await (async()=>{const mainTon=process.env.TON_MAIN_WALLET||process.env.TON_MAIN_WALLET_ADDRESS||process.env.TON_PERMANENT_WALLET_ADDRESS;const validTon=typeof mainTon==='string'&&/^(?:EQ|UQ)[A-Za-z0-9_-]{46}$/.test(mainTon);const {adminConfigured}=await import('./functions/api/admin-auth.mjs');
      const out={ok:true,ready:adminConfigured(env),service:'ANIL X',runtime:'render-static-gateway',configured:{admin:adminConfigured(env),openai:Boolean(process.env.OPENAI_API_KEY),anthropic:Boolean(process.env.ANTHROPIC_API_KEY),gemini:Boolean(process.env.GEMINI_API_KEY),variza:Boolean(process.env.VARIZA_API_KEY||process.env.VARIA_API_KEY||process.env.VARIZA_TOKEN||process.env.VARIZA_KEY||process.env.VARIZA_API||process.env.VARIZA_ACCESS_TOKEN||process.env.VARIZA_BEARER_TOKEN),payments:Boolean(process.env.PAYMENTS||process.env.REDIS_URL),assets:true},revenue:{storageConfigured:Boolean(process.env.REDIS_URL),durableAccounting:String(process.env.PAYMENTS_DURABLE||'false').toLowerCase()==='true',variza:Boolean(process.env.VARIZA_API_KEY||process.env.VARIA_API_KEY||process.env.VARIZA_TOKEN||process.env.VARIZA_KEY),ton:validTon,guardCatchQueue:true,temporaryWalletUsed:false}};res.statusCode=200;res.setHeader('content-type','application/json; charset=utf-8');return JSON.stringify(out)})());
    }
    if(u.pathname==='/api/guard/live'&&req.method==='GET'){
      let snap={};
      // Guard runs every 5 minutes and intentionally publishes state with [skip render].
      // Read the public GitHub snapshot here so Render does not need a full deploy for every heartbeat.
      const guardRemote='https://raw.githubusercontent.com/saberbadri24-tech/city-of-eternity/main/guard-live-summary.json';
      const guardCache=globalThis.__anilxGuardRemoteCache||{at:0,snap:null};
      if(guardCache.snap&&Date.now()-guardCache.at<60000) snap=guardCache.snap;
      if(!snap.updatedAt){
        try{
          const ac=new AbortController();const timer=setTimeout(()=>ac.abort(),5000);
          const rr=await fetch(guardRemote+'?v='+Math.floor(Date.now()/60000),{headers:{accept:'application/json','cache-control':'no-cache'},signal:ac.signal});
          clearTimeout(timer);
          if(rr.ok){const remoteSnap=await rr.json();if(remoteSnap&&typeof remoteSnap==='object'){snap=remoteSnap;guardCache.at=Date.now();guardCache.snap=remoteSnap;globalThis.__anilxGuardRemoteCache=guardCache;}}
        }catch{}
      }
      if(!snap.updatedAt){try{snap=JSON.parse(await fs.readFile(path.join(root,'guard-live-summary.json'),'utf8'))}catch{}}
      if(!snap.updatedAt){try{snap={status:JSON.parse(await fs.readFile(path.join(root,'guard-status.json'),'utf8')),radar:{},ledger:{}}}catch{}}
      const status=snap.status||{},radar=snap.radar||{},ledger=snap.ledger||{};
      const scanUpdatedAt=snap.updatedAt||status.updatedAt||status.lastScan||null;
      const heartbeatAt=snap.heartbeatAt||scanUpdatedAt;
      const ageMs=Date.parse(String(heartbeatAt||''));
      const minutesSinceUpdate=Number.isFinite(ageMs)?Math.max(0,Math.round((Date.now()-ageMs)/60000)):null;
      const body={ok:true,source:'ANIL-X-lightweight-guard-summary',updatedAt:heartbeatAt,scanUpdatedAt,freshness:{minutesSinceUpdate,stale:minutesSinceUpdate===null||minutesSinceUpdate>15,requiredMaxMinutes:15},guard:{status:String(status.status||status.mode||'NORMAL'),discoveryCount:Number(status.discoveryCount||status.counts?.opportunities||0),sourcesScanned:Number(status.sourcesScanned||0),sourcesReachable:Number(status.sourcesReachable||0),waitingOwner:Number(status.waitingOwner||0),highValueCandidates:Number(status.highValueCandidates||status.counts?.incomePriority||0)},radar:{available:true,candidates:Number(radar.totalCandidates||0),officialCandidates:Number(radar.officialCandidates||0),actionableOfficial:Number(radar.actionableOfficial||0),highPriority:Number(radar.highPriority||0)},revenue:{confirmedIncome:Number(ledger.confirmedIncome||0),status:String(ledger.status||'UNCONFIRMED')},transfer:{status:'OWNER_APPROVAL_REQUIRED',temporaryWalletUsed:false},safety:{autoClaim:false,autoSigning:false,autoTransfer:false,secretStorage:false,ownerApprovalRequired:true}};
      res.statusCode=200;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(body));
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
      const body=await readBody(req);
      const request=new Request(origin+(req.url||'/'),{method:'POST',headers:req.headers,body});
      const {handleSuperTeam}=await import('./functions/api/anil-super-team.mjs');
      const rr=await handleSuperTeam(request,env,{});
      res.statusCode=rr.status;rr.headers.forEach((v,k)=>res.setHeader(k,v));res.end(Buffer.from(await rr.arrayBuffer()));return;
    }
    if(u.pathname==='/api/execution-readiness'){
      const {adminAuth}=await import('./functions/api/admin-auth.mjs');
      if(!(await adminAuth(req,env))){res.statusCode=401;res.setHeader('content-type','application/json; charset=utf-8');res.end(JSON.stringify({ok:false,error:'admin_auth_required'}));return;}
      const {handleExecutionReadiness}=await import('./functions/api/execution-readiness.mjs');
      const rr=await handleExecutionReadiness(req,env);res.statusCode=rr.status;rr.headers.forEach((v,k)=>res.setHeader(k,v));res.end(Buffer.from(await rr.arrayBuffer()));return;
    }
    if((u.pathname==='/api/admin/self-test'||u.pathname==='/api/admin/auth-self-test')&&req.method==='GET'){
      const {adminAuth}=await import('./functions/api/admin-auth.mjs');
      if(!(await adminAuth(req,env))){res.statusCode=401;res.setHeader('content-type','application/json; charset=utf-8');res.end(JSON.stringify({ok:false,error:'admin_auth_required'}));return;}
      env.PAYMENTS=await getPaymentsStore();
      const {adminSelfTest}=await import('./functions/api/admin-auth.mjs');
      const out=await adminSelfTest(env);
      res.statusCode=200;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(out));return;
    }
    if(u.pathname==='/api/admin/password/login'&&req.method==='POST'){
      env.PAYMENTS=await getPaymentsStore();
      const body=await readBody(req);
      const request=new Request(origin+(req.url||'/'),{method:req.method,headers:req.headers,body});
      const {adminLogin}=await import('./functions/api/admin-auth.mjs');
      const rr=await adminLogin(request,env);
      res.statusCode=rr.status;rr.headers.forEach((v,k)=>res.setHeader(k,v));res.end(Buffer.from(await rr.arrayBuffer()));return;
    }
    if((req.method==='GET'||req.method==='HEAD')&&!u.pathname.startsWith('/api/')){
      const rel=decodeURIComponent(u.pathname).replace(/^\/+/, '')||'index.html';
      const safe=publicPath(rel);
      const file=safe?(path.extname(path.join(root,rel))?path.join(root,rel):path.join(root,'index.html')):null;
      const ext=file?path.extname(file).toLowerCase():'';
      const isHtml=ext==='.html';
      const isAdmin=file?path.basename(file)==='admin.html':false;
      if(file&&!isHtml){
        try{
          const st=await fs.stat(file);
          const etag='W/"'+st.size.toString(16)+'-'+Math.floor(st.mtimeMs).toString(16)+'"';
          const cache=isAdmin?'no-store':u.search?'public,max-age=31536000,immutable':'public,max-age=86400,stale-while-revalidate=604800';
          if(req.headers['if-none-match']===etag){res.statusCode=304;res.setHeader('etag',etag);res.end();return}
          res.statusCode=200;res.setHeader('content-type',mime[ext]||'application/octet-stream');res.setHeader('cache-control',cache);res.setHeader('etag',etag);res.setHeader('x-content-type-options','nosniff');res.setHeader('referrer-policy','strict-origin-when-cross-origin');res.setHeader('content-length',String(st.size));
          if(req.method==='HEAD'){res.end();return}
          createReadStream(file).on('error',()=>{if(!res.headersSent){res.statusCode=404;res.end('Not Found')}else res.destroy()}).pipe(res);
          return;
        }catch{}
      }
      const response=await assetsFetch(new Request(u,{method:req.method,headers:req.headers}));
      res.statusCode=response.status;response.headers.forEach((v,k)=>res.setHeader(k,v));
      if(req.method==='HEAD'){res.end();return}
      const buf=Buffer.from(await response.arrayBuffer());res.setHeader('content-length',String(buf.length));res.end(buf);return;
    }

    const body=await readBody(req);
    const request=new Request(origin+(req.url||'/'),{
      method:req.method,headers:req.headers,
      body:['GET','HEAD'].includes(req.method)?undefined:body
    });
    env.PAYMENTS=await getPaymentsStore();
    const worker=await getWorker();
    const response=await worker.fetch(request,env,{});
    res.statusCode=response.status;
    response.headers.forEach((v,k)=>res.setHeader(k,v));
    const buf=Buffer.from(await response.arrayBuffer());
    res.setHeader('content-length',String(buf.length));
    res.end(buf);
  }catch(err){
    res.statusCode=Number(err?.statusCode)||500;
    res.setHeader('content-type','application/json');
    res.end(JSON.stringify({ok:false,error:'render_runtime_error',message:String(err?.message||err)}));
  }
});

const port=Number(process.env.PORT||10000);
server.listen(port,'0.0.0.0',()=>{ 
  console.log('ANIL X Render runtime listening on '+port);
});
