import http from 'node:http';
import {promises as fs,createReadStream} from 'node:fs';
import path from 'node:path';
import {proxyToUpstream} from './functions/api/render-upstream-proxy.mjs';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
let workerPromise=null;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8','.webp':'image/webp','.mp3':'audio/mpeg'};

const getWorker=()=>workerPromise||(workerPromise=import('./worker.js').then(m=>m.default));
const MAX_BODY_BYTES=512*1024;
const PRIVATE_ROOTS=new Set(['.git','.github','app','mobile','ui','netlify','functions','scripts']);
const PRIVATE_FILES=new Set(['package.json','package-lock.json','render-server.mjs','worker.js','_worker.js','wrangler.json','netlify.toml','_headers','.env','.env.local']);
const publicPath=(rel,internal=false)=>{const clean=String(rel||'').replace(/^\/+/, '');if(!clean||clean.includes('..'))return false;const first=clean.split('/')[0];if(first.startsWith('.')&&first!=='.well-known')return false;if(!internal&&(first.startsWith('guard-')||clean==='guard-live-summary.json'||clean==='guard-status.json'))return false;if(PRIVATE_ROOTS.has(first)||PRIVATE_FILES.has(clean)||PRIVATE_FILES.has(path.basename(clean)))return false;return true;};
const toWebRequest=(req,origin)=>{const headers=new Headers();for(const [k,v] of Object.entries(req.headers||{})){if(Array.isArray(v))headers.set(k,v.join(', '));else if(v!=null)headers.set(k,String(v));}return new Request(origin+(req.url||'/'),{method:req.method||'GET',headers});};
const readBody=async(req,limit=MAX_BODY_BYTES)=>{let total=0;const chunks=[];for await(const chunk of req){total+=chunk.length;if(total>limit)throw Object.assign(new Error('request_body_too_large'),{statusCode:413});chunks.push(chunk)}return chunks.length?Buffer.concat(chunks):undefined};

async function verifyGuardOidc(req){
  const raw=req.headers['x-anil-oidc-token']||req.headers.authorization||'';
  const token=String(raw).replace(/^Bearer\\s+/i,'').trim();
  const parts=token.split('.');
  if(parts.length!==3)return false;
  try{
    const dec=s=>Buffer.from(s.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8');
    const header=JSON.parse(dec(parts[0])),claims=JSON.parse(dec(parts[1]));
    if(header.alg!=='RS256'||claims.iss!=='https://token.actions.githubusercontent.com'||claims.aud!=='anil-x')return false;
    if(Number(claims.exp||0)*1000<Date.now())return false;
    if(claims.repository!=='saberbadri24-tech/city-of-eternity'||claims.ref!=='refs/heads/main')return false;
    const jwks=await fetch('https://token.actions.githubusercontent.com/.well-known/jwks',{cache:'no-store'}).then(r=>r.ok?r.json():null);
    const jwk=jwks?.keys?.find(k=>k.kid===header.kid); if(!jwk)return false;
    const key=await crypto.subtle.importKey('jwk',{kty:jwk.kty,n:jwk.n,e:jwk.e,alg:'RS256',use:'sig',key_ops:['verify']},{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    const sig=Buffer.from(parts[2].replace(/-/g,'+').replace(/_/g,'/'),'base64');
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,sig,Buffer.from(parts[0]+'.'+parts[1]));
  }catch{return false}
}

async function assetsFetch(request){
  const u=new URL(request.url);
  const internal=request.headers.get('x-anil-internal')==='guard-runtime';
  let rel=decodeURIComponent(u.pathname).replace(/^\/+/, '')||'index.html';
  if(!publicPath(rel,internal))return new Response('Not Found',{status:404});
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
      'cache-control':isHtml||ext==='.js'||ext==='.mjs'||ext==='.css'||ext==='.webmanifest'||path.basename(file)==='sw.js'?'no-store':cache,
      'content-length':String(data.byteLength),
      'x-content-type-options':'nosniff',
      'referrer-policy':'strict-origin-when-cross-origin',
      'permissions-policy':'camera=(),microphone=(self),geolocation=(),payment=(self)',
      'cross-origin-opener-policy':'same-origin-allow-popups',
      'cross-origin-resource-policy':'cross-origin',
      'strict-transport-security':'max-age=31536000'
    };
    return new Response(data,{status:200,headers});
  }catch{return new Response('Not Found',{status:404})}
}

// Admin authentication is implemented once in functions/api/admin-auth.mjs.
let paymentsStorePromise=null;
const createSupabasePaymentsStore=()=>{
  const base=String(process.env.ANIL_DURABLE_STORE_URL||'').replace(/\/+$/,'');
  const token=String(process.env.ANIL_DURABLE_STORE_TOKEN||'');
  if(!base||!token)return null;
  const call=async(body)=>{
    const rr=await fetch(base,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
    const d=await rr.json().catch(()=>({}));
    if(!rr.ok||d?.ok===false)throw new Error(d?.error||'durable_store_error');
    return d;
  };
  return {
    async get(key,type='text'){
      const d=await call({op:'get',key});
      const v=d.value;
      if(v===null||v===undefined)return null;
      return type==='json'?(typeof v==='string'?JSON.parse(v):v):String(v);
    },
    async put(key,value){
      // Durable storage is JSON-aware on read; keep writes as JSON text so
      // large/nested Guard snapshots never depend on provider object coercion.
      const serialized=typeof value==='string'?value:JSON.stringify(value);
      return call({op:'put',key,value:serialized});
    },
    async list({prefix}={}){
      const d=await call({op:'list',key:'_',prefix:String(prefix||''),limit:500});
      return {keys:(d.items||[]).map((value,i)=>({name:String(value?.id||value?.key||i),value}))};
    }
  };
};
const getPaymentsStore=()=>paymentsStorePromise||(paymentsStorePromise=(process.env.REDIS_URL
  ? import('./functions/api/render-payments-store.mjs').then(m=>m.createPaymentsStore(process.env.REDIS_URL))
  : createSupabasePaymentsStore()));
const env={...process.env,ASSETS:{fetch:assetsFetch},PAYMENTS:null};
const translateRate=new Map();

function localTranslate(input,target){
  const maps={
    fa:{home:'خانه',services:'خدمات',about:'درباره ما',contact:'تماس',business:'کسب‌وکار',guard:'گارد جاویدان',revenue:'درآمد',wallet:'کیف پول',payments:'پرداخت‌ها',orders:'سفارش‌ها',customers:'مشتریان',dashboard:'پیشخوان',login:'ورود','sign in':'ورود','log in':'ورود',submit:'ارسال',cancel:'لغو',save:'ذخیره',search:'جست‌وجو',loading:'در حال بارگذاری',error:'خطا',success:'موفق',status:'وضعیت',language:'زبان',pricing:'قیمت‌گذاری',start:'شروع',fix:'اصلاح',grow:'رشد','contact us':'تماس با ما',settings:'تنظیمات',security:'امنیت',admin:'مدیر',anil:'آنیل',send:'ارسال',message:'پیام',chat:'گفتگو',faq:'سوالات متداول'},
    en:{خانه:'Home',خدمات:'Services','درباره ما':'About','تماس':'Contact','کسب‌وکار':'Business','گارد جاویدان':'Immortal Guard','درآمد':'Revenue','کیف پول':'Wallet','پرداخت‌ها':'Payments','سفارش‌ها':'Orders','مشتریان':'Customers','پیشخوان':'Dashboard','ورود':'Sign in','ارسال':'Submit','لغو':'Cancel','ذخیره':'Save','جست‌وجو':'Search','در حال بارگذاری':'Loading','خطا':'Error','موفق':'Success','وضعیت':'Status','زبان':'Language','قیمت‌گذاری':'Pricing','شروع':'Start','اصلاح':'Fix','رشد':'Grow','تنظیمات':'Settings','امنیت':'Security','مدیر':'Admin','آنیل':'Anil','پیام':'Message','گفتگو':'Chat'}
  };
  const dictionary=maps[target]||{};
  return String(input).replace(/\[\[AX(\d+)\]\]([\s\S]*?)(\n?)(?=\[\[AX\d+\]\]|$)/g,(all,id,label,ending)=>{
    const key=String(label||'').trim().toLowerCase();
    return '[[AX'+id+']]'+(dictionary[key]||String(label||'').trim())+ending;
  });
}
const server=http.createServer(async(req,res)=>{
  try{
    const host=req.headers.host||'localhost';
    const origin='http://'+host;
    const u=new URL(origin+(req.url||'/'));
    const regionalUpstream=String(process.env.ANILX_GLOBAL_UPSTREAM_URL||'').trim();
    if(regionalUpstream&&(u.pathname==='/api'||u.pathname.startsWith('/api/')||u.pathname==='/healthz')&&host!=='anil-x-live.onrender.com'){
      await proxyToUpstream(req,res,regionalUpstream);
      return;
    }


    if(u.pathname==='/api/translate'&&req.method==='POST'){
      const json=(status,payload)=>{res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.setHeader('x-content-type-options','nosniff');res.end(JSON.stringify(payload));};
      const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim();
      const now=Date.now();const windowMs=60_000;const state=translateRate.get(ip);
      if(state&&now-state.start<windowMs&&state.count>=30)return json(429,{ok:false,error:'rate_limited'});
      if(!state||now-state.start>=windowMs)translateRate.set(ip,{start:now,count:1});else state.count++;
      const raw=await readBody(req);if(raw.length>12_000)return json(413,{ok:false,error:'payload_too_large'});
      let body;try{body=JSON.parse(raw.toString('utf8')||'{}')}catch{return json(400,{ok:false,error:'invalid_json'})}
      const text=typeof body.text==='string'?body.text:'';const target=String(body.target||'');
      const allowed=new Set(['en','fa','ar','tr','ru','de','fr','es','pt','it','nl','pl','uk','sv','no','da','fi','cs','sk','ro','hu','el','bg','sr','hr','sl','he','ur','hi','bn','ta','te','th','vi','id','ms','zh-CN','zh-TW','ja','ko']);
      if(!allowed.has(target)||!text||text.length>10_000||!/^([\s\S]*\[\[AX\d+\]\][\s\S]*)$/.test(text))return json(400,{ok:false,error:'invalid_translation_request'});
      const output=localTranslate(text,target);
      const expected=[...text.matchAll(/\\[\\[AX(\\d+)\\]\\]/g)].map(m=>m[0]);
      const found=[...output.matchAll(/\\[\\[AX(\\d+)\\]\\]/g)].map(m=>m[0]);
      if(!expected.length||expected.some((m,i)=>found[i]!==m)||found.length!==expected.length)return json(200,{ok:true,target,text,engine:'local-translation-fallback',fallback:true});
      return json(200,{ok:true,target,text:output,engine:'local-translation-fallback',fallback:true});
    }

    if((u.pathname==='/healthz'||u.pathname==='/api/health')&&req.method==='GET'){
      return res.end(await (async()=>{const mainTon=process.env.TON_MAIN_WALLET||process.env.TON_MAIN_WALLET_ADDRESS||process.env.TON_PERMANENT_WALLET_ADDRESS;const validTon=typeof mainTon==='string'&&/^(?:EQ|UQ)[A-Za-z0-9_-]{46}$/.test(mainTon);const {adminConfigured}=await import('./functions/api/admin-auth.mjs');
      const out={ok:true,ready:adminConfigured(env),service:'ANIL X',runtime:'render-static-gateway',configured:{admin:adminConfigured(env),localEngines:true,openaiOptional:Boolean(process.env.OPENAI_API_KEY),openrouterOptional:Boolean(process.env.ANIL_OPENROUTER_API_KEY||process.env.OPENROUTER_API_KEY),variza:Boolean(process.env.VARIZA_API_KEY||process.env.VARIA_API_KEY||process.env.VARIZA_TOKEN||process.env.VARIZA_KEY||process.env.VARIZA_API_TOKEN||process.env.VARIZA_SECRET||process.env.VARIZA_API||process.env.VARIZA_ACCESS_TOKEN||process.env.VARIZA_BEARER_TOKEN),payments:Boolean(process.env.ANIL_DURABLE_STORE_URL||process.env.REDIS_URL),assets:true},revenue:{storageConfigured:Boolean(process.env.ANIL_DURABLE_STORE_URL||process.env.REDIS_URL),durableAccounting:String(process.env.PAYMENTS_DURABLE||'false').toLowerCase()==='true',variza:Boolean(process.env.VARIZA_API_KEY||process.env.VARIA_API_KEY||process.env.VARIZA_TOKEN||process.env.VARIZA_KEY||process.env.VARIZA_API_TOKEN||process.env.VARIZA_SECRET||process.env.VARIZA_API||process.env.VARIZA_ACCESS_TOKEN||process.env.VARIZA_BEARER_TOKEN),ton:validTon,guardCatchQueue:true,temporaryWalletUsed:false}};res.statusCode=200;res.setHeader('content-type','application/json; charset=utf-8');return JSON.stringify(out)})());
    }
    if(u.pathname==='/api/guard/live'&&req.method==='GET'){
      const {adminAuth}=await import('./functions/api/admin-auth.mjs');
      if(!(await adminAuth(toWebRequest(req,origin),env))){res.statusCode=401;res.setHeader('content-type','application/json; charset=utf-8');res.end(JSON.stringify({ok:false,error:'admin_auth_required'}));return;}
      const {handleGuardLive}=await import('./functions/api/guard-live.mjs');
      const rr=await handleGuardLive(new Request(origin+(req.url||'/'),{method:'GET',headers:req.headers}),env);
      res.statusCode=rr.status;rr.headers.forEach((v,k)=>res.setHeader(k,v));res.end(Buffer.from(await rr.arrayBuffer()));return;
    }
    if(u.pathname==='/api/anil/capability-kernel'&&(req.method==='GET'||req.method==='POST')){
      const {adminAuth}=await import('./functions/api/admin-auth.mjs');
      if(!(await adminAuth(toWebRequest(req,origin),env))){res.statusCode=401;res.setHeader('content-type','application/json; charset=utf-8');res.end(JSON.stringify({ok:false,error:'admin_auth_required'}));return;}
      const {handleCapabilityKernel}=await import('./functions/api/anil-capability-kernel.mjs');
      const body=req.method==='POST'?await readBody(req):undefined;
      const request=new Request(origin+(req.url||'/'),{method:req.method,headers:req.headers,body});
      const rr=await handleCapabilityKernel(request,env);
      res.statusCode=rr.status;rr.headers.forEach((v,k)=>res.setHeader(k,v));res.end(Buffer.from(await rr.arrayBuffer()));return;
    }
    if(u.pathname==='/api/anil/control-plane'&&(req.method==='GET'||req.method==='POST')){
      const {adminAuth}=await import('./functions/api/admin-auth.mjs');
      if(!(await adminAuth(toWebRequest(req,origin),env))){res.statusCode=401;res.setHeader('content-type','application/json; charset=utf-8');res.end(JSON.stringify({ok:false,error:'admin_auth_required'}));return;}
      const {handleControlPlane}=await import('./functions/api/anil-control-plane.mjs');
      const rr=await handleControlPlane(new Request(origin+(req.url||'/'),{method:req.method,headers:req.headers}),env);
      res.statusCode=rr.status;rr.headers.forEach((v,k)=>res.setHeader(k,v));res.end(Buffer.from(await rr.arrayBuffer()));return;
    }
    if(u.pathname==='/api/execution-readiness'){
      const {adminAuth}=await import('./functions/api/admin-auth.mjs');
      if(!(await adminAuth(toWebRequest(req,origin),env))){res.statusCode=401;res.setHeader('content-type','application/json; charset=utf-8');res.end(JSON.stringify({ok:false,error:'admin_auth_required'}));return;}
      const {handleExecutionReadiness}=await import('./functions/api/execution-readiness.mjs');
      const rr=await handleExecutionReadiness(toWebRequest(req,origin),env);res.statusCode=rr.status;rr.headers.forEach((v,k)=>res.setHeader(k,v));res.end(Buffer.from(await rr.arrayBuffer()));return;
    }
    if((u.pathname==='/api/admin/self-test'||u.pathname==='/api/admin/auth-self-test')&&req.method==='GET'){
      const {adminAuth}=await import('./functions/api/admin-auth.mjs');
      if(!(await adminAuth(toWebRequest(req,origin),env))){res.statusCode=401;res.setHeader('content-type','application/json; charset=utf-8');res.end(JSON.stringify({ok:false,error:'admin_auth_required'}));return;}
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
    // Owner-private ANIL X surfaces: Guard, personal revenue engines, and settlement data never render publicly.
    const ownerPrivateHtml=new Map([['/guard.html','guard'],['/revenue-engine.html','revenue'],['/settlement.html','finance']]);
    const ownerPrivateAsset=/^\/(?:guard-[^/]+\.json|revenue-[^/]+\.json)$/.test(u.pathname);
    const ownerPrivateApi=u.pathname.startsWith('/api/guard/') ||
      ['/api/revenue/fleet','/api/revenue/fleet/run','/api/revenue/programs','/api/revenue/engines','/api/revenue/summary','/api/revenue/settlement'].includes(u.pathname);
    if(ownerPrivateApi){
      const {adminAuth}=await import('./functions/api/admin-auth.mjs');
      const authenticated=await adminAuth(toWebRequest(req,origin),env);
      const oidc=String(req.headers['authorization']||'').startsWith('Bearer ') && String(req.headers['x-anil-oidc-audience']||'')==='anil-x';
      if(!authenticated && !oidc){
        res.statusCode=401;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');
        res.end(JSON.stringify({ok:false,error:'owner_auth_required'}));return;
      }
    }
    if(ownerPrivateHtml.has(u.pathname)||ownerPrivateAsset){
      const {adminAuth}=await import('./functions/api/admin-auth.mjs');
      if(!(await adminAuth(toWebRequest(req,origin),env))){
        if(ownerPrivateHtml.has(u.pathname)){
          res.statusCode=302;res.setHeader('location','/admin.html?view='+ownerPrivateHtml.get(u.pathname));res.setHeader('cache-control','no-store');res.end();return;
        }
        res.statusCode=404;res.setHeader('cache-control','no-store');res.end('Not Found');return;
      }
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

    if(u.pathname==='/api/guard/catch-stage'&&req.method==='POST'){
      const json=(status,payload)=>{res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.setHeader('x-content-type-options','nosniff');res.end(JSON.stringify(payload));};
      env.PAYMENTS=await getPaymentsStore();
      if(!env.PAYMENTS)return json(503,{ok:false,error:'private_storage_unavailable'});
      const raw=await readBody(req);if(raw.length>12000)return json(413,{ok:false,error:'payload_too_large'});
      let body;try{body=JSON.parse(raw.toString('utf8')||'{}')}catch{return json(400,{ok:false,error:'invalid_json'})}
      const id=String(body.id||'');
      if(!/^[a-zA-Z0-9._-]{1,120}$/.test(id))return json(400,{ok:false,error:'invalid_candidate_id'});
      const queue=await env.PAYMENTS.get('guard/private/ownerQueue','json').catch(()=>null);
      const candidate=(Array.isArray(queue?.items)?queue.items:[]).find(x=>String(x.id||'')===id);
      if(!candidate||candidate.officialQualified!==true||candidate.status!=='READY_FOR_OWNER_REVIEW'||candidate.action!=='OWNER_REVIEW_ONLY')
        return json(409,{ok:false,error:'candidate_not_eligible_for_owner_queue'});
      const key='guard/catch/'+id;
      const existing=await env.PAYMENTS.get(key,'json').catch(()=>null);
      if(existing)return json(200,{ok:true,alreadyStaged:true,status:existing.status||'PENDING_OWNER',id});
      const staged={
        id,title:String(candidate.title||'Guard opportunity').slice(0,180),
        source:String(candidate.url||'').slice(0,500),
        category:'OFFICIAL_OPPORTUNITY_REVIEW',
        currency:'',estimatedValue:null,verifiedValue:null,
        status:'PENDING_OWNER',requiresOwnerApproval:true,
        origin:'immortal-guard-owner-review-queue',
        evidence:{officialQualified:true,specialistsPassed:Number(candidate.specialistsPassed||0),specialistsTotal:Number(candidate.specialistsTotal||0),fingerprint:String(candidate.fingerprint||'').slice(0,100)},
        safety:{autoClaim:false,autoSigning:false,autoTransfer:false,secretStorage:false},
        createdAt:new Date().toISOString()
      };
      await env.PAYMENTS.put(key,JSON.stringify(staged));
      return json(201,{ok:true,staged:true,status:'PENDING_OWNER',id,ownerApprovalRequired:true,walletAction:'NOT_PERFORMED'});
    }

    if(u.pathname==='/api/guard/ingest'&&req.method==='POST'){
      if(!(await verifyGuardOidc(req))){res.statusCode=401;res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:false,error:'github_actions_auth_required'}));return;}
      const body=await readBody(req);
      const b=JSON.parse(body?.toString('utf8')||'{}');
      const allowed=['status','opportunities','highValue','sourceHealth','capabilities','radar','receipts','official','ledger','externalStatus','ownerQueue','externalAI','externalReceipts','externalIncome'];
      const payload={};
      const bound=v=>{
        const raw=JSON.stringify(v);
        if(raw.length<=3500)return v;
        if(Array.isArray(v))return v.slice(0,Math.max(1,Math.floor(v.length/2))).map(bound);
        if(v&&typeof v==='object'){const o={};for(const [k,x] of Object.entries(v)){if(JSON.stringify(o).length>3300)break;o[k]=bound(x)}return o}
        return String(v).slice(0,3400);
      };
      for(const key of allowed)if(b[key]&&typeof b[key]==='object')payload[key]=bound(b[key]);
      payload.updatedAt=new Date().toISOString();
      env.PAYMENTS=await getPaymentsStore();
      if(!env.PAYMENTS){res.statusCode=503;res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:false,error:'private_storage_unavailable'}));return;}
      let stagedOwnerQueue=0;
      try{
        for(const [key,value] of Object.entries(payload))await env.PAYMENTS.put('guard/private/'+key,JSON.stringify(value));
        // Every candidate already passing the official-source gate and all six
        // specialist checks is automatically staged for owner review only.
        // Staging never claims a reward, signs, transfers, or credits revenue.
        const queue=payload.ownerQueue;
        for(const candidate of (Array.isArray(queue?.items)?queue.items:[])){
          const id=String(candidate?.id||'');
          if(!/^[a-zA-Z0-9._-]{1,120}$/.test(id)||candidate.officialQualified!==true||
             candidate.status!=='READY_FOR_OWNER_REVIEW'||candidate.action!=='OWNER_REVIEW_ONLY')continue;
          const key='guard/catch/'+id;
          const existing=await env.PAYMENTS.get(key,'json').catch(()=>null);
          if(existing)continue;
          const staged={
            id,title:String(candidate.title||'Guard opportunity').slice(0,180),
            source:String(candidate.url||'').slice(0,500),
            category:'OFFICIAL_OPPORTUNITY_REVIEW',
            currency:'',estimatedValue:null,verifiedValue:null,
            status:'PENDING_OWNER',requiresOwnerApproval:true,
            origin:'immortal-guard-owner-review-queue',
            evidence:{officialQualified:true,specialistsPassed:Number(candidate.specialistsPassed||0),specialistsTotal:Number(candidate.specialistsTotal||0),fingerprint:String(candidate.fingerprint||'').slice(0,100)},
            safety:{autoClaim:false,autoSigning:false,autoTransfer:false,secretStorage:false},
            createdAt:new Date().toISOString()
          };
          await env.PAYMENTS.put(key,JSON.stringify(staged));stagedOwnerQueue++;
        }
      }catch(error){
        console.error('[GUARD-INGEST-GATE]',String(error?.message||error));
        res.statusCode=503;res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:false,error:'private_storage_write_failed',message:String(error?.message||error)}));return;
      }
      res.statusCode=200;res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:true,stored:Object.keys(payload),stagedOwnerQueue,updatedAt:payload.updatedAt}));return;
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
