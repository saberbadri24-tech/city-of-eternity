const BUILTIN_ADMIN_PASSWORD='Sm*114411';
import {state,now,clean,id,json as runtimeJson} from './functions/api/runtime-state.mjs';
import {handlePlan} from './functions/api/plan.mjs';
import analyze from './netlify/functions/analyze.mjs';
import vision from './functions/api/vision.mjs';
import voice from './functions/api/voice.mjs';import tonApi from './functions/api/ton.mjs';import {handleJavidan} from './functions/api/javidan-trinity.mjs';import {onRequestPost as pay} from './functions/api/pay.js';import {onRequestPost as webhook} from './functions/api/variza-webhook.js';
const json=(d,s=200,h={})=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json','cache-control':'no-store',...h}});
const rjson=(d,s=200,h={})=>runtimeJson(d,s,h);
async function runtimeRoutes(req,env,u){
  const p=u.pathname;
  if(p==='/api/account'){
    if(!['GET','POST'].includes(req.method))return rjson({ok:false,error:'method_not_allowed'},405);
    const b=req.method==='POST'?await req.json().catch(()=>({})): {};
    const accountId=clean(b.id||u.searchParams.get('id'),100).replace(/[^a-zA-Z0-9_-]/g,'');
    if(!accountId)return rjson({ok:false,error:'id_required'},400);
    const old=state.accounts.get(accountId)||{};
    if(req.method==='POST'){
      const record={id:accountId,profile:{...(old.profile||{}),...(b.profile||{})},createdAt:old.createdAt||now(),updatedAt:now()};
      state.accounts.set(accountId,record);
      return rjson({ok:true,account:record});
    }
    return rjson({ok:true,account:old||null});
  }
  if(p==='/api/memory'){
    if(req.method==='OPTIONS')return rjson({},204);
    const sid=clean(u.searchParams.get('sessionId'),100).replace(/[^a-zA-Z0-9_-]/g,'');
    if(!sid)return rjson({ok:false,error:'session_required'},400);
    if(req.method==='GET'){const x=state.sessions.get(sid)||{};return rjson({ok:true,sessionId:sid,turns:Array.isArray(x.turns)?x.turns.slice(-30):[],profile:x.profile||{}})}
    if(req.method==='POST'){const b=await req.json().catch(()=>({})),old=state.sessions.get(sid)||{},turns=Array.isArray(b.turns)?b.turns.slice(-30):Array.isArray(old.turns)?old.turns.slice(-30):[],profile=b.profile||old.profile||{};state.sessions.set(sid,{turns,profile,updatedAt:now()});return rjson({ok:true,sessionId:sid,count:turns.length})}
    return rjson({ok:false,error:'method_not_allowed'},405);
  }
  if(p==='/api/order'){
    if(req.method==='POST'){const b=await req.json().catch(()=>({})),amount=Number(b.amount||0);if(!Number.isFinite(amount)||amount<0)return rjson({ok:false,error:'invalid_amount'},400);const order={id:id(),accountId:clean(b.accountId||'guest'),service:clean(b.service||'custom',120),description:clean(b.description||'',1000),currency:clean(b.currency||'USD',8),amount,status:'pending',createdAt:now()};state.orders.set(order.id,order);if(env.PAYMENTS)await env.PAYMENTS.put('orders/'+order.id,JSON.stringify(order));return rjson({ok:true,order},201)}
    if(req.method==='GET'){const oid=clean(u.searchParams.get('id'),120),order=state.orders.get(oid);return order?rjson({ok:true,order}):rjson({ok:false,error:'not_found'},404)}
    return rjson({ok:false,error:'method_not_allowed'},405);
  }
  if(p==='/api/fx'){
    const rate=Number(env.USD_IRR_RATE||0);
    if(!Number.isFinite(rate)||rate<=0)return rjson({ok:false,error:'usd_irr_rate_not_configured',currency:'USD',target:'IRR',source:'environment'});
    return rjson({ok:true,from:'USD',to:'IRR',rate,source:'environment',tomanRate:rate/10});
  }
  if(p==='/api/payment-config'){
    return rjson({ok:true,ton:{enabled:!!env.TON_RECEIVING_ADDRESS,address:env.TON_RECEIVING_ADDRESS||null},fiat:{provider:'variza',enabled:!!(env.VARIZA_API_KEY||env.VARIA_API_KEY)}});
  }
  if(p==='/api/revenue/catalog'){
    return rjson({ok:true,merchant:'ANIL X STUDIO',currency:'USD',services:[
      {id:'website',name:'AI Website Build',price:149},{id:'teaser',name:'Marketing Teaser',price:49},
      {id:'fix',name:'Website Fix',price:39},{id:'growth',name:'Growth & SEO',price:79},
      {id:'automation',name:'Business Automation',price:99},{id:'ai-agent',name:'AI Agent Integration',price:129}
    ]});
  }
  if(p==='/api/revenue/lead'){
    if(req.method!=='POST')return rjson({ok:false,error:'method_not_allowed'},405);
    const b=await req.json().catch(()=>({})),email=clean(b.email,160),request=clean(b.request||b.need,2000);
    if(!request)return rjson({ok:false,error:'request_required'},400);
    if(email&&!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email))return rjson({ok:false,error:'invalid_email'},400);
    const lead={id:id(),name:clean(b.name,100),email,company:clean(b.company,160),request,source:clean(b.source||'website',60),status:'new',score:0,createdAt:now(),updatedAt:now()};
    state.revenueLeads.set(lead.id,lead);return rjson({ok:true,lead},201);
  }
  if(p==='/api/revenue/summary'){
    const leads=[...state.revenueLeads.values()],orders=[...state.orders.values()],paid=orders.filter(x=>x.status==='paid');
    return rjson({ok:true,counts:{leads:leads.length,orders:orders.length,paid:paid.length},revenue:paid.reduce((s,x)=>s+Number(x.amount||0),0),currency:'USD',updatedAt:now()});
  }
  if(p==='/api/revenue/leads'){
    if(!(await adminAuth(req,env)))return rjson({ok:false,error:'admin_auth_required'},401);
    return rjson({ok:true,leads:[...state.revenueLeads.values()].slice(-500)});
  }
  if(p==='/api/revenue/run'){
    if(!(await adminAuth(req,env)))return rjson({ok:false,error:'admin_auth_required'},401);
    if(req.method!=='POST')return rjson({ok:false,error:'method_not_allowed'},405);
    let promoted=0;const nowIso=now();
    for(const x of state.freeRequests.values()){
      if([...state.revenueLeads.values()].some(l=>l.id===x.id))continue;
      state.revenueLeads.set(x.id,{id:x.id,name:x.name,email:x.email,company:'',request:x.request,source:'free-request',status:'new',score:0,createdAt:x.createdAt||nowIso,updatedAt:nowIso});promoted++;
    }
    for(const l of state.revenueLeads.values()){
      const t=String(l.request||'').toLowerCase(),score=Math.min(100,30+(t.length>80?20:0)+(l.email?15:0)+(/site|website|seo|sales|growth|automation|teaser|video|سایت|سئو|فروش|رشد|خودکار|تیزر|ویدیو/.test(t)?35:0));
      state.revenueLeads.set(l.id,{...l,score,status:score>=70?'qualified':'new',updatedAt:nowIso});
    }
    return rjson({ok:true,action:'revenue_cycle',promoted,qualified:[...state.revenueLeads.values()].filter(x=>x.status==='qualified').length});
  }
  if(p==='/api/discovery'){
    const q=clean(u.searchParams.get('q'),120).toLowerCase();
    const items=[['site','ساخت سایت',['site','website','فروشگاه','سایت']],['teaser','ساخت تیزر',['video','teaser','تیزر','ویدیو']],['fix','رفع مشکل',['fix','bug','error','خطا','ارور']],['growth','رشد کسب‌وکار',['growth','seo','فروش','مشتری','رشد']],['preview','پیش‌نمایش',['preview','prototype','پیش‌نمایش']],['global','Anil World',['global','world','بین‌المللی']]];
    const results=items.map(([id,title,tags])=>({id,title,tags,action:title})).filter(x=>!q||x.title.toLowerCase().includes(q)||x.tags.some(t=>q.includes(t)||t.includes(q)));
    return rjson({ok:true,source:'anil-x-unified-discovery',results});
  }
  if(p==='/api/free-request'){
    if(req.method!=='POST')return rjson({error:'POST required'},405);
    const b=await req.json().catch(()=>({})),name=clean(b.name,80),email=clean(b.email,160),country=clean(b.country,80),request=clean(b.request,2000);
    if(!name||!email||!country||!request||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return rjson({error:'Please complete all fields with a valid email.'},400);
    const rec={id:id(),name,email,country,request,status:'pending',createdAt:now(),decidedAt:null,decidedBy:null};state.freeRequests.set(rec.id,rec);state.revenueLeads.set(rec.id,{id:rec.id,name,email,company:'',request,source:'free-request',status:'new',score:0,createdAt:rec.createdAt,updatedAt:rec.createdAt});return rjson({ok:true,id:rec.id,status:rec.status},201);
  }
  if(p==='/api/free-admin'){
    if(!(await adminAuth(req,env)))return rjson({error:'Admin authentication required.'},401);
    if(req.method==='GET')return rjson({ok:true,requests:[...state.freeRequests.values()].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))});
    if(req.method==='POST'){const b=await req.json().catch(()=>({})),item=state.freeRequests.get(clean(b.id,120)),status=['approved','rejected','pending'].includes(b.status)?b.status:null;if(!item||!status)return rjson({error:'Invalid decision or request.'},400);const next={...item,status,decidedAt:now(),decidedBy:'admin'};state.freeRequests.set(next.id,next);return rjson({ok:true,request:next})}
    return rjson({error:'Method not allowed.'},405);
  }
  if(p==='/api/payment-status'){
    const oid=clean(u.searchParams.get('orderId'),120);
    if(env.PAYMENTS){try{const order=await env.PAYMENTS.get('orders/'+oid,'json');if(order)return rjson({ok:true,orderId:order.orderId,status:order.status,amount:order.amount,provider:order.provider,createdAt:order.createdAt,paidAt:order.paidAt||null,payUrl:order.payUrl||null});}catch{}}
    const order=state.orders.get(oid);return order?rjson({ok:true,orderId:order.id,status:order.status,amount:order.amount,provider:'runtime',createdAt:order.createdAt,paidAt:order.paidAt||null,payUrl:order.payUrl||null}):rjson({ok:false,error:'order_not_found'},404);
  }
  if(p==='/api/worker'){
    const expected=String(env.ANIL_WORKER_KEY||'');const supplied=req.headers.get('x-anil-worker-key')||'';if(!((expected&&supplied===expected)||await adminAuth(req,env)))return rjson({ok:false,error:'unauthorized'},401);
    if(req.method==='GET')return rjson({ok:true,tasks:[...state.queue.values()].slice(-50)});
    if(req.method==='POST'){const b=await req.json().catch(()=>({})),task={id:id(),type:clean(b.type||'internal',40),payload:b.payload&&typeof b.payload==='object'?b.payload:{},status:'queued',attempts:0,createdAt:now(),updatedAt:now()};state.queue.set(task.id,task);return rjson({ok:true,task})}
    return rjson({ok:false,error:'method_not_allowed'},405);
  }
  if(p==='/api/guard/state'){
    const readAsset=async name=>{try{const resp=await env.ASSETS.fetch(new Request(new URL('/'+name,req.url)));return await resp.json()}catch{return null}};
    const official=await readAsset('guard-official-discovery.json'), high=await readAsset('guard-high-value.json'), receipts=await readAsset('guard-receipts.json');
    const approvals=[...state.queue.values()].filter(x=>x.type==='guard_approval').slice(-50);
    return rjson({ok:true,updatedAt:now(),pipeline:['DISCOVERED','OFFICIAL_VERIFIED','ELIGIBILITY_CHECKED','ACTIONABLE','OWNER_APPROVAL','CLAIM_SUBMITTED','RECEIPT_VERIFIED','SETTLED'],official:official||{items:[]},highValue:high||{items:[]},receipts:receipts||{},approvals,safety:{autoSign:false,privateKeys:false,seedPhrases:false,kycBypass:false,captchaBypass:false}});
  }
  if(p==='/api/guard/approval'){
    if(!(await adminAuth(req,env)))return rjson({ok:false,error:'owner_auth_required'},401);
    if(req.method!=='POST')return rjson({ok:false,error:'method_not_allowed'},405);
    const b=await req.json().catch(()=>({}));const task={id:id(),type:'guard_approval',opportunityId:clean(b.opportunityId,120),action:clean(b.action||'VERIFY_AND_REVIEW',80),url:clean(b.url,1000),status:'OWNER_APPROVAL',createdAt:now(),updatedAt:now(),attempts:0};
    state.queue.set(task.id,task);return rjson({ok:true,task});
  }
  if(p==='/api/guard/report'){
    const approvals=[...state.queue.values()].filter(x=>x.type==='guard_approval');
    return rjson({ok:true,generatedAt:now(),counts:{approvals:approvals.length,queued:[...state.queue.values()].filter(x=>x.status==='queued').length},safety:{autoSign:false,autoTransfer:false,ownerApprovalRequired:true}});
  }
  return null;
}
async function sign(v,secret){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const b=await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(v));return btoa(String.fromCharCode(...new Uint8Array(b))).replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_')}
async function adminLogin(req,env){if(req.method!=='POST')return json({ok:false,error:'method_not_allowed'},405);const secret=BUILTIN_ADMIN_PASSWORD||String(env.ANIL_ADMIN_PASSWORD||'');const b=await req.json().catch(()=>({})),pass=String(b.password||'');if(pass!==secret)return json({ok:false,error:'invalid_credentials'},401);const body=btoa(JSON.stringify({sub:'admin',exp:Date.now()+43200000})).replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_');const sig=await sign(body,secret);return json({ok:true},200,{ 'set-cookie':`session=${body+'.'+sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200` })}
async function adminAuth(req,env){const secret=BUILTIN_ADMIN_PASSWORD||String(env.ANIL_ADMIN_PASSWORD||'');if(!secret)return false;const m=(req.headers.get('cookie')||'').match(/(?:^|; )session=([^;]+)/);if(!m)return false;const [body,sig]=m[1].split('.');if(!body||!sig||sig!==(await sign(body,secret)))return false;try{return JSON.parse(atob(body.replace(/-/g,'+').replace(/_/g,'/'))).exp>Date.now()}catch{return false}}
async function secretary(req,env){
  if(!(await adminAuth(req,env)))return json({ok:false,error:'unauthorized'},401);
  const b=await req.json().catch(()=>({})),command=String(b.command||'').slice(0,12000),q=command.toLowerCase();
  if(/گارد|guard/.test(q)&&/وضعیت|state|صف|approval/.test(q)){
    const u=new URL(req.url);u.pathname='/api/guard/state';const rr=await runtimeRoutes(new Request(u,{method:'GET',headers:{cookie:req.headers.get('cookie')||''}}),env,u);
    if(rr){const d=await rr.json();return json({ok:true,changed:false,action:'guard_state',text:'وضعیت زنده Guard:\n'+JSON.stringify(d,null,2),data:d});}
  }
  if(/گزارش گارد|guard report/.test(q)){
    const u=new URL(req.url);u.pathname='/api/guard/report';const rr=await runtimeRoutes(new Request(u,{method:'GET',headers:{cookie:req.headers.get('cookie')||''}}),env,u);
    if(rr){const d=await rr.json();return json({ok:true,changed:false,action:'guard_report',text:'گزارش زنده Guard:\n'+JSON.stringify(d,null,2),data:d});}
  }
  if(/سفارش|order/.test(q)){
    const u=new URL(req.url);u.pathname='/api/order';const rr=await runtimeRoutes(new Request(u,{method:'GET',headers:{cookie:req.headers.get('cookie')||''}}),env,u);
    if(rr){const d=await rr.json();return json({ok:true,changed:false,action:'orders',text:'سفارش جاری:\n'+JSON.stringify(d,null,2),data:d});}
  }
  const councilReq=new Request(new URL('/api/plan',req.url),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({prompt:command,profile:{role:'admin'},turns:b.messages||[]})});try{const rr=await handlePlan(councilReq,env);const cd=await rr.json();if(cd.ok)return json({ok:true,text:cd.reply||'بررسی شورای مدیر انجام شد.',action:'admin_council',council:cd});}catch(e){}
  const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+env.OPENAI_API_KEY},body:JSON.stringify({model:env.ASTRA_MODEL||'gpt-5-mini',messages:[{role:'system',content:'تو بدرخان، دستیار اجرایی خصوصی ANIL X هستی. فارسی پاسخ بده. هرگز اجرای واقعی را بدون نتیجه ابزار ادعا نکن. برای گارد جاویدان هرگز seed/private key نخواه و برای امضای تراکنش تأیید مالک لازم است. اگر ابزار مستقیم در دسترس نیست، فقط برنامه اقدام و وضعیت قابل اثبات را گزارش کن.'},{role:'user',content:command}],temperature:.15})});if(!r.ok)return json({ok:false,error:'assistant_provider_'+r.status},502);
  const d=await r.json();return json({ok:true,text:d?.choices?.[0]?.message?.content||'بررسی انجام شد.',action:'گزارش'});
}
export default{async fetch(req,env,ctx){const u=new URL(req.url);if(u.pathname==='/api/health'||u.pathname==='/api/_healthcheck')return json({ok:true,service:'ANIL X',runtime:'unified-worker',configured:{admin:!!(BUILTIN_ADMIN_PASSWORD||env.ANIL_ADMIN_PASSWORD),openai:!!env.OPENAI_API_KEY,anthropic:!!env.ANTHROPIC_API_KEY,gemini:!!env.GEMINI_API_KEY,variza:!!env.VARIZA_API_KEY,payments:!!env.PAYMENTS,assets:!!env.ASSETS},routes:['/api/plan','/api/analyze','/api/vision','/api/voice','/api/ton/account','/api/ton/transactions','/api/javidan/trinity','/api/account','/api/memory','/api/order','/api/fx','/api/discovery','/api/free-request','/api/free-admin','/api/payment-status','/api/worker','/api/pay','/api/variza-webhook']});const runtime=await runtimeRoutes(req,env,u);if(runtime)return runtime;if(u.pathname==='/api/analyze')return analyze(req,env);if(u.pathname==='/api/vision')return vision(req,env);if(u.pathname==='/api/voice')return voice(req,env);if(u.pathname==='/api/ton/account'||u.pathname==='/api/ton/transactions')return tonApi(req);if(u.pathname==='/api/plan')return handlePlan(req,env);if(u.pathname==='/api/javidan/trinity')return handleJavidan(req,env);if(u.pathname==='/api/admin/password/login')return adminLogin(req,env);if(u.pathname==='/api/admin/secretary')return secretary(req,env);if(u.pathname==='/api/pay')return pay({request:req,env});if(u.pathname==='/api/variza-webhook')return webhook({request:req,env});if(u.pathname.startsWith('/api/'))return json({ok:false,error:'not_found'},404);return env.ASSETS.fetch(req)}};
