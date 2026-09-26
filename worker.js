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
    if(req.method==='POST'){const b=await req.json().catch(()=>({})),amount=Number(b.amount||0);if(!Number.isFinite(amount)||amount<0)return rjson({ok:false,error:'invalid_amount'},400);const order={id:id(),accountId:clean(b.accountId||'guest'),service:clean(b.service||'custom',120),description:clean(b.description||'',1000),currency:clean(b.currency||'USD',8),amount,status:'pending',createdAt:now()};state.orders.set(order.id,order);return rjson({ok:true,order},201)}
    if(req.method==='GET'){const oid=clean(u.searchParams.get('id'),120),order=state.orders.get(oid);return order?rjson({ok:true,order}):rjson({ok:false,error:'not_found'},404)}
    return rjson({ok:false,error:'method_not_allowed'},405);
  }
  if(p==='/api/fx'){
    const rate=Number(env.USD_IRR_RATE||0);
    if(!Number.isFinite(rate)||rate<=0)return rjson({ok:false,error:'usd_irr_rate_not_configured',currency:'USD',target:'IRR',source:'environment'});
    return rjson({ok:true,from:'USD',to:'IRR',rate,source:'environment',tomanRate:rate/10});
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
    const rec={id:id(),name,email,country,request,status:'pending',createdAt:now(),decidedAt:null,decidedBy:null};state.freeRequests.set(rec.id,rec);return rjson({ok:true,id:rec.id,status:rec.status},201);
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
  return null;
}
async function sign(v,secret){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const b=await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(v));return btoa(String.fromCharCode(...new Uint8Array(b))).replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_')}
async function adminLogin(req,env){if(req.method!=='POST')return json({ok:false,error:'method_not_allowed'},405);const secret=BUILTIN_ADMIN_PASSWORD||String(env.ANIL_ADMIN_PASSWORD||'');const b=await req.json().catch(()=>({})),pass=String(b.password||'');if(pass!==secret)return json({ok:false,error:'invalid_credentials'},401);const body=btoa(JSON.stringify({sub:'admin',exp:Date.now()+43200000})).replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_');const sig=await sign(body,secret);return json({ok:true},200,{ 'set-cookie':`session=${body+'.'+sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200` })}
async function adminAuth(req,env){const secret=BUILTIN_ADMIN_PASSWORD||String(env.ANIL_ADMIN_PASSWORD||'');if(!secret)return false;const m=(req.headers.get('cookie')||'').match(/(?:^|; )session=([^;]+)/);if(!m)return false;const [body,sig]=m[1].split('.');if(!body||!sig||sig!==(await sign(body,secret)))return false;try{return JSON.parse(atob(body.replace(/-/g,'+').replace(/_/g,'/'))).exp>Date.now()}catch{return false}}
async function secretary(req,env){if(!(await adminAuth(req,env)))return json({ok:false,error:'unauthorized'},401);const b=await req.json().catch(()=>({})),c=String(b.command||'').slice(0,12000);if(!env.OPENAI_API_KEY)return json({ok:true,text:'درخواست دریافت شد؛ موتور هوش مصنوعی مدیر در انتظار کلید API است.',action:'بررسی'});const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+env.OPENAI_API_KEY},body:JSON.stringify({model:env.ASTRA_MODEL||'gpt-5-mini',messages:[{role:'system',content:'تو بدرخان، دستیار اجرایی خصوصی ANIL X هستی. فارسی پاسخ بده. هرگز اجرای واقعی را بدون نتیجه ابزار ادعا نکن. برای گارد جاویدان هرگز seed/private key نخواه و برای امضای تراکنش تأیید مالک لازم است.'},{role:'user',content:c}],temperature:.15})});if(!r.ok)return json({ok:false,error:'assistant_provider_'+r.status},502);const d=await r.json();return json({ok:true,text:d?.choices?.[0]?.message?.content||'بررسی انجام شد.',action:'گزارش'})}
export default{async fetch(req,env,ctx){const u=new URL(req.url);if(u.pathname==='/api/health'||u.pathname==='/api/_healthcheck')return json({ok:true,service:'ANIL X',runtime:'unified-worker',configured:{admin:!!(BUILTIN_ADMIN_PASSWORD||env.ANIL_ADMIN_PASSWORD),openai:!!env.OPENAI_API_KEY,anthropic:!!env.ANTHROPIC_API_KEY,gemini:!!env.GEMINI_API_KEY,variza:!!env.VARIZA_API_KEY,payments:!!env.PAYMENTS,assets:!!env.ASSETS},routes:['/api/plan','/api/analyze','/api/vision','/api/voice','/api/ton/account','/api/ton/transactions','/api/javidan/trinity','/api/account','/api/memory','/api/order','/api/fx','/api/discovery','/api/free-request','/api/free-admin','/api/payment-status','/api/worker','/api/pay','/api/variza-webhook']});const runtime=await runtimeRoutes(req,env,u);if(runtime)return runtime;if(u.pathname==='/api/analyze')return analyze(req,env);if(u.pathname==='/api/vision')return vision(req,env);if(u.pathname==='/api/voice')return voice(req,env);if(u.pathname==='/api/ton/account'||u.pathname==='/api/ton/transactions')return tonApi(req);if(u.pathname==='/api/plan')return handlePlan(req,env);if(u.pathname==='/api/javidan/trinity')return handleJavidan(req,env);if(u.pathname==='/api/admin/password/login')return adminLogin(req,env);if(u.pathname==='/api/admin/secretary')return secretary(req,env);if(u.pathname==='/api/pay')return pay({request:req,env});if(u.pathname==='/api/variza-webhook')return webhook({request:req,env});if(u.pathname.startsWith('/api/'))return json({ok:false,error:'not_found'},404);return env.ASSETS.fetch(req)}};
