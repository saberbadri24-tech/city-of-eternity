import {state,now,clean,id,json as runtimeJson} from './functions/api/runtime-state.mjs';
import autopilot from './functions/api/autopilot.mjs';
import {handlePlan} from './functions/api/plan.mjs';
import analyze from './netlify/functions/analyze.mjs';
import vision from './functions/api/vision.mjs';
import voice from './functions/api/voice.mjs';import tonApi from './functions/api/ton.mjs';import {handleJavidan} from './functions/api/javidan-trinity.mjs';
import {handleAnilCapabilities} from './functions/api/anil-capabilities.mjs';import {onRequestPost as pay} from './functions/api/pay.js';import {onRequestPost as webhook} from './functions/api/variza-webhook.js';
const json=(d,s=200,h={})=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json','cache-control':'no-store',...h}});
const rjson=(d,s=200,h={})=>runtimeJson(d,s,h);
async function kvGet(env,key,fallback=null){if(!env.PAYMENTS)return fallback;try{const v=await env.PAYMENTS.get(key,'json');return v??fallback}catch{return fallback}}
async function kvPut(env,key,value){if(env.PAYMENTS)await env.PAYMENTS.put(key,JSON.stringify(value))}
async function kvList(env,prefix,limit=100){if(!env.PAYMENTS)return[];try{const x=await env.PAYMENTS.list({prefix});const keys=(x?.keys||[]).slice(-limit);return (await Promise.all(keys.map(k=>env.PAYMENTS.get(k.name,'json').catch(()=>null)))).filter(Boolean)}catch{return[]}}
async function runAutopilotSafe(env){return await autopilot(new Request('https://internal/api/autopilot',{method:'POST'}),env).then(async r=>await r.json()).catch(e=>({ok:false,error:String(e?.message||e)}))}
const V90_DEFAULTS={pricesUsd:{FIX:19,START:29,BUILD:79,GROW:199},permissions:{autoReports:true,autoMessaging:true,autoSeo:true,autoPaymentDiagnostics:true,autoBenchmark:true,autoLeadReview:true}};
const REVENUE_FLEET=[
{id:'ai-automation-agency',name:'AI Automation Agency',mode:'service',status:'ACTIVE',monetization:'project+retainer',prereq:'ANIL-X lead/order/payment'},
{id:'ai-integration-agents',name:'AI Integration & Agents',mode:'service',status:'ACTIVE',monetization:'project+maintenance',prereq:'ANIL-X lead/order/payment'},
{id:'ai-ugc-video-studio',name:'AI UGC / Video Studio',mode:'service',status:'ACTIVE',monetization:'per-project+retainer',prereq:'ANIL-X lead/order/payment'},
{id:'short-video-production',name:'Short-form Video Production',mode:'service',status:'ACTIVE',monetization:'per-project+retainer',prereq:'ANIL-X lead/order/payment'},
{id:'data-pdf-excel',name:'Data / PDF / Excel Automation',mode:'service',status:'ACTIVE',monetization:'per-project',prereq:'ANIL-X lead/order/payment'},
{id:'shopify-build',name:'Shopify Build & Optimization',mode:'service',status:'ACCOUNT_REQUIRED',monetization:'project+partner',prereq:'Shopify partner/account'},
{id:'seo-growth-retainer',name:'SEO / Growth Retainers',mode:'recurring',status:'ACTIVE',monetization:'monthly-retainer',prereq:'ANIL-X lead/order/payment'},
{id:'lead-generation',name:'B2B Lead Generation',mode:'service',status:'ACTIVE',monetization:'per-lead+retainer',prereq:'compliant prospecting channels'},
{id:'digital-products',name:'Digital Products / Templates',mode:'product',status:'PRODUCT_REQUIRED',monetization:'per-sale',prereq:'real product assets + storefront'},
{id:'micro-saas-api',name:'Micro-SaaS / API',mode:'recurring',status:'PRODUCT_REQUIRED',monetization:'subscription+usage',prereq:'deployed product + billing'},
{id:'paid-research',name:'Paid Research / Reports',mode:'service',status:'ACTIVE',monetization:'per-report+retainer',prereq:'ANIL-X lead/order/payment'},
{id:'ai-support-desk',name:'AI Customer Support Desk',mode:'recurring',status:'ACTIVE',monetization:'monthly-retainer',prereq:'ANIL-X lead/order/payment'},
{id:'website-build-fixes',name:'Website Build / Fix / Conversion',mode:'service',status:'ACTIVE',monetization:'project+maintenance',prereq:'ANIL-X lead/order/payment'},
{id:'agent-commerce',name:'Agent Commerce',mode:'agent',status:'ACTIVE',monetization:'paid-api/order',prereq:'ANIL-X catalog+payment'},
{id:'affiliate-engine',name:'Affiliate / Referral Engine',mode:'affiliate',status:'PARTNER_REQUIRED',monetization:'commission',prereq:'approved partner programs'},
{id:'creator-media',name:'Creator / YouTube Media',mode:'media',status:'ACCOUNT_REQUIRED',monetization:'ads+partners',prereq:'channel+platform eligibility'},
{id:'newsletter-community',name:'Paid Newsletter / Community',mode:'subscription',status:'PRODUCT_REQUIRED',monetization:'subscription',prereq:'audience+paid product'},
{id:'licensing-assets',name:'Digital Asset / API Licensing',mode:'license',status:'PRODUCT_REQUIRED',monetization:'license+subscription',prereq:'licensable asset'},
{id:'marketplace-services',name:'Marketplace Service Acquisition',mode:'acquisition',status:'ACCOUNT_REQUIRED',monetization:'client projects',prereq:'approved marketplace account'},
{id:'bug-bounty',name:'Legitimate Bug Bounty',mode:'bounty',status:'ACCOUNT_REQUIRED',monetization:'accepted bounty',prereq:'authorized scope+platform account'},
{id:'guard-opportunities',name:'Immortal Guard',mode:'opportunity',status:'OWNER_GATED',monetization:'verified opportunity',prereq:'official verification+owner approval for sensitive actions'}
];
async function revenueFleetStatus(env){
 const configured={
   ton:!!env.TON_RECEIVING_ADDRESS,
   variza:!!(env.VARIZA_API_KEY||env.VARIA_API_KEY||env.VARIZA_TOKEN||env.VARIZA_KEY),
   ai:!!(env.OPENAI_API_KEY||env.GEMINI_API_KEY||env.ANTHROPIC_API_KEY),
   persistence:!!env.PAYMENTS
 };
 return {
   ok:true,
   truth:{
     paymentReady:configured.variza,
     persistentAccounting:configured.persistence,
     aiReady:configured.ai,
     tonReady:configured.ton
   },
   engines:REVENUE_FLEET.map(x=>({
     ...x,
     state:x.status==='OWNER_GATED'
       ? (configured.ton?'READY_OWNER_APPROVAL':'BLOCKED_MISSING_TON')
       : x.status==='ACTIVE'
         ? (configured.variza&&configured.persistence?'LIVE_REVENUE_PATH':configured.variza?'PAYMENT_READY_NO_DURABLE_STORAGE':'BLOCKED_PAYMENT')
         : 'DEPENDENCY_REQUIRED',
     collectsToTreasury:configured.ton&&configured.variza,
     countsAsRevenueOnlyWhenPaid:true
   })),
   policy:'فقط پرداخت تسویه‌شده درآمد واقعی است؛ وجود موتور، لید یا پیشنهاد فروش درآمد محسوب نمی‌شود.'
 };
}async function runRevenueFleet(env){
  const started=now();
  const autopilotCycle=await runAutopilotSafe(env);
  const persistedLeads=await kvList(env,'lead/',500);
  const revenueLeads=await kvList(env,'revenue-leads/',500);
  const leadCount=new Set([...persistedLeads,...revenueLeads].map(x=>x?.id).filter(Boolean)).size;
  const paidOrders=(await kvList(env,'orders/',500)).filter(x=>x?.status==='paid');
  const configured={ton:!!env.TON_RECEIVING_ADDRESS,variza:!!(env.VARIZA_API_KEY||env.VARIA_API_KEY||env.VARIZA_TOKEN||env.VARIZA_KEY),ai:!!(env.OPENAI_API_KEY||env.GEMINI_API_KEY||env.ANTHROPIC_API_KEY)};
  const states=[];
  for(const engine of REVENUE_FLEET){
    let operational=(engine.status==='OWNER_GATED'&&configured.ton)||(engine.status==='ACTIVE'&&configured.variza);
    let nextAction='monitor';
    if(engine.status==='ACTIVE'&&!configured.variza) nextAction='configure_payment_gateway';
    if(engine.id==='lead-generation') nextAction=leadCount?'qualify_and_route_leads':'await_compliant_inbound_or_authorized_prospecting';
    if(engine.id==='micro-saas-api'||engine.id==='digital-products'||engine.id==='newsletter-community'||engine.id==='licensing-assets') nextAction='build_or_attach_real_product_before_sales';
    if(engine.status==='ACCOUNT_REQUIRED') nextAction='connect_required_platform_account';
    if(engine.status==='PARTNER_REQUIRED') nextAction='connect_approved_partner_program';
    if(engine.status==='PRODUCT_REQUIRED') nextAction='attach_verified_product_asset';
    if(engine.status==='OWNER_GATED') nextAction='verify_then_queue_owner_approval';
    states.push({id:engine.id,status:engine.status,operational,prereq:engine.prereq,nextAction,lastRun:started,kpi:{leads:leadCount,paidOrders:paidOrders.length}});
    await kvPut(env,'revenue-engine/'+engine.id,{id:engine.id,status:engine.status,operational,nextAction,lastRun:started,kpi:{leads:leadCount,paidOrders:paidOrders.length}});
  }
  const report={ok:true,startedAt:started,finishedAt:now(),cycle:autopilotCycle,engines:states,treasury:{tonConfigured:configured.ton,varizaConfigured:configured.variza},accounting:{paidOrders:paidOrders.length,rule:'only settled/paid orders count as revenue'},safety:{no_bulk_spam:true,no_credentials_or_seeds:true,no_captcha_or_kyc_bypass:true,no_sensitive_actions:true,owner_approval_for_irreversible:true}};
  await kvPut(env,'revenue-fleet/latest',report);
  return report;
}
async function revenueFleetState(env){
  const latest=await kvGet(env,'revenue-fleet/latest',null);
  return {ok:true,latest,persistence:!!env.PAYMENTS,engines:await Promise.all(REVENUE_FLEET.map(async e=>await kvGet(env,'revenue-engine/'+e.id,{id:e.id,status:e.status,operational:(e.status==='OWNER_GATED'&&!!env.TON_RECEIVING_ADDRESS)||(e.status==='ACTIVE'&&!!(env.VARIZA_API_KEY||env.VARIA_API_KEY||env.VARIZA_TOKEN||env.VARIZA_KEY))})))};
}

const REVENUE_PROGRAMS=[
{id:'ai-service-studio',name:'AI Service Studio',type:'service',status:'LIVE',description:'فروش ساخت سایت، رفع مشکل، رشد، اتوماسیون و اتصال AI Agent با سفارش و پرداخت واقعی.',engine:'sales-conversion'},
{id:'ai-automation',name:'AI Automation & Agents',type:'service',status:'LIVE',description:'پیاده‌سازی اتوماسیون، workflow و AI agent برای کسب‌وکارها.',engine:'business-automation'},
{id:'seo-growth-retainer',name:'SEO + Growth Retainer',type:'recurring',status:'LIVE',description:'ممیزی، بهبود و نگهداری رشد با پیشنهادهای دوره‌ای و فروش مجدد.',engine:'growth-seo'},
{id:'content-video',name:'AI Content & Video',type:'service',status:'LIVE',description:'تولید محتوای ویدیویی، کوتاه و تبلیغاتی با کنترل کیفیت انسانی/هوش مصنوعی.',engine:'content-engine'},
{id:'data-automation',name:'Data / PDF / Excel Automation',type:'service',status:'READY',description:'پاک‌سازی داده، تبدیل PDF به Excel و اتوماسیون کارهای تکراری؛ تحویل پس از سفارش.',engine:'business-automation'},
{id:'ecommerce-build',name:'E-commerce / Shopify Build',type:'service',status:'READY_ACCOUNT',description:'ساخت و بهینه‌سازی فروشگاه و اجرای پروژه؛ اتصال حساب پلتفرم مشتری لازم است.',engine:'sales-conversion'},
{id:'digital-products',name:'Digital Products & Templates',type:'product',status:'READY_ASSET',description:'فروش فایل، قالب، گزارش و ابزار دیجیتال؛ نیازمند محصول واقعی قبل از فروش.',engine:'sales-conversion'},
{id:'paid-research',name:'Paid Research & Reports',type:'service',status:'READY',description:'گزارش تحقیق بازار، رقبا و فرصت‌ها با خروجی قابل تحویل.',engine:'content-engine'},
{id:'micro-saas',name:'Micro-SaaS / API Access',type:'recurring',status:'READY_PRODUCT',description:'فروش دسترسی به ابزار یا API تخصصی؛ نیازمند endpoint و quota واقعی محصول.',engine:'agent-commerce'},
{id:'agent-commerce',name:'Agent Commerce',type:'agent',status:'LIVE',description:'کاتالوگ قابل کشف برای AI Agentها و سفارش API؛ پرداخت قبل از اجرای خدمت.',engine:'agent-commerce'},
{id:'creator-content',name:'Creator / YouTube Content',type:'media',status:'READY_ACCOUNT',description:'تولید و بسته‌بندی محتوای کانال؛ درآمد پلتفرم فقط بعد از احراز شرایط و تأیید خود پلتفرم.',engine:'content-engine'},
{id:'affiliate-referrals',name:'Affiliate / Referral',type:'affiliate',status:'READY_PARTNER',description:'سیستم ثبت و اندازه‌گیری referral؛ فقط با برنامه رسمی و لینک اختصاصی شریک.',engine:'growth-seo'},
{id:'guard-opportunities',name:'Immortal Guard Opportunities',type:'opportunity',status:'OWNER_GATED',description:'کشف و راستی‌آزمایی فرصت‌های قانونی؛ عملیات حساس و انتقال نهایی با تأیید مالک.',engine:'immortal-guard'},
{id:'recurring-maintenance',name:'Maintenance & Support Retainer',type:'recurring',status:'LIVE',description:'قرارداد نگهداری، مانیتورینگ و رفع مشکل دوره‌ای پس از سفارش.',engine:'retention'}
];
async function getV90Config(env){const x=await kvGet(env,'admin/config',null);return {pricesUsd:{...V90_DEFAULTS.pricesUsd,...(x?.pricesUsd||{})},permissions:{...V90_DEFAULTS.permissions,...(x?.permissions||{})},updatedAt:x?.updatedAt||new Date(0).toISOString()}}
async function saveV90Config(env,next){const x={pricesUsd:next.pricesUsd,permissions:next.permissions,updatedAt:new Date().toISOString()};await kvPut(env,'admin/config',x);return x}
async function v90Approval(env,title,category,details){const rec={id:id(),title:String(title).slice(0,180),category:String(category).slice(0,80),details:String(details||'').slice(0,1500),status:'pending',createdAt:now()};await kvPut(env,'admin/approval/'+rec.id,rec);return rec}
async function v90Audit(env,action,success,details=''){await kvPut(env,'admin/action/'+id(),{action,success,details:String(details).slice(0,1000),createdAt:now()})}
async function v90SiteConfig(env){return await kvGet(env,'site/config',{headlineEn:'Tell us what you need.\\nWe turn it into a real result.',headlineFa:'بگو چه می‌خواهی.\\nما آن را به نتیجه واقعی تبدیل می‌کنیم.',leadEn:'One place for websites, creative production, digital fixes and business growth.',leadFa:'یک مسیر برای ساخت سایت، تولید خلاقانه، رفع مشکلات دیجیتال و رشد کسب‌وکار.',ctaEn:'Start a project',ctaFa:'شروع پروژه',trustEn:'One brief. One clear route. A real next step.',trustFa:'یک درخواست. یک مسیر روشن. یک قدم واقعی.',updatedAt:new Date(0).toISOString()})}
async function v90AdminRoutes(req,env,u){
  const p=u.pathname;
  if(p==='/api/site-config'&&req.method==='GET')return rjson({...await v90SiteConfig(env),pricesUsd:(await getV90Config(env)).pricesUsd});
  if(p==='/api/admin/overview'&&req.method==='POST'){
    if(!(await adminAuth(req,env)))return rjson({ok:false,error:'admin_login_required'},401);
    const [leads,orders,approvals,actions,business]=await Promise.all([kvList(env,'lead/',500),kvList(env,'orders/',500),kvList(env,'admin/approval/',100),kvList(env,'admin/action/',30),getV90Config(env)]);
    const paid=orders.filter(x=>x?.status==='paid'),pending=orders.filter(x=>x?.status==='pending'),failed=orders.filter(x=>x?.status==='failed');
    return rjson({owner:{name:'مدیر صابر بدری'},counts:{leads:leads.length,orders:orders.length,paidOrders:paid.length,pendingOrders:pending.length},revenue:{toman:paid.reduce((s,x)=>s+Number(x.providerAmount ?? (x.currency==='IRR' ? x.amount : 0) ?? 0),0),sourceUsd:paid.reduce((s,x)=>s+Number(x.orderAmount ?? (x.currency==='USD' ? x.amount : 0) ?? 0),0)},payment:{variza:!!(env.VARIZA_API_KEY||env.VARIA_API_KEY||env.VARIZA_TOKEN||env.VARIZA_KEY),international:!!env.STRIPE_SECRET_KEY},security:{passwordOnly:true,session:'signed-httpOnly-cookie'},business,approvals:approvals.filter(x=>x.status==='pending').slice(-20),recentActions:actions.slice(-10)});
  }
  if((p==='/api/admin/controls'||p==='/api/admin/controls/')&&req.method==='GET'){
    if(!(await adminAuth(req,env)))return rjson({ok:false,error:'admin_login_required'},401);
    const approvals=(await kvList(env,'admin/approval/',100)).filter(x=>x.status==='pending').slice(-20);return rjson({ok:true,business:await getV90Config(env),approvals});
  }
  if(p==='/api/admin/controls'&&req.method==='POST'){
    if(!(await adminAuth(req,env)))return rjson({ok:false,error:'admin_login_required'},401);
    const b=await req.json().catch(()=>({})),cur=await getV90Config(env),prices={...cur.pricesUsd},permissions={...cur.permissions,...(b.permissions||{})};
    for(const k of ['FIX','START','BUILD','GROW'])if(b.pricesUsd?.[k]!==undefined){const n=Number(b.pricesUsd[k]);if(!Number.isFinite(n)||n<1||n>100000)return rjson({ok:false,error:'invalid_price'},400);prices[k]=Math.round(n*100)/100}
    if(JSON.stringify(prices)!==JSON.stringify(cur.pricesUsd)){const a=await v90Approval(env,'تغییر قیمت‌های ANIL X','pricing',JSON.stringify(prices));return rjson({ok:true,success:true,approvalRequired:true,approvalId:a.id,business:cur})}
    const next=await saveV90Config(env,{pricesUsd:prices,permissions,updatedAt:now()});await v90Audit(env,'update_permissions',true,permissions);return rjson({ok:true,success:true,approvalRequired:false,business:next});
  }
  if(p==='/api/admin/approval'&&req.method==='POST'){
    if(!(await adminAuth(req,env)))return rjson({ok:false,error:'admin_login_required'},401);
    const b=await req.json().catch(()=>({})),idv=clean(b.approvalId,120),decision=b.decision==='approved'?'approved':b.decision==='rejected'?'rejected':'';
    if(!idv||!decision)return rjson({ok:false,error:'approval_required'},400);
    const a=await kvGet(env,'admin/approval/'+idv,null);if(!a)return rjson({ok:false,error:'approval_not_found'},404);
    if(decision==='approved'&&a.category==='pricing'){let parsed={};try{parsed=JSON.parse(a.details||'{}')}catch{return rjson({ok:false,error:'invalid_approval_details'},400)}const cur=await getV90Config(env);const prices={FIX:Number(parsed.FIX),START:Number(parsed.START),BUILD:Number(parsed.BUILD),GROW:Number(parsed.GROW)};if(!Object.values(prices).every(n=>Number.isFinite(n)&&n>=1&&n<=100000))return rjson({ok:false,error:'invalid_price'},400);await saveV90Config(env,{...cur,pricesUsd:prices});a.status='approved';a.executed=true;a.decidedAt=now();await kvPut(env,'admin/approval/'+idv,a);await v90Audit(env,'approved_price_change',true,prices);return rjson({ok:true,success:true,status:'approved',executed:true,pricesUsd:prices})}
    a.status=decision;a.executed=false;a.decidedAt=now();await kvPut(env,'admin/approval/'+idv,a);await v90Audit(env,'approval_'+decision,true,idv);return rjson({ok:true,success:true,status:decision,executed:false});
  }
  if(p==='/api/currency/rates'&&req.method==='GET'){const rate=Number(env.USD_IRR_RATE||0);if(!Number.isFinite(rate)||rate<=0)return rjson({ok:false,error:'fx_unavailable'},503);return rjson({base:'USD',currencies:{USD:1,IRR:rate},tomanPerUsd:Math.round(rate/10),supported:['USD','EUR','GBP','CAD','AUD','AED','TRY','CNY','JPY']})}
  if(p==='/api/me'&&req.method==='GET'){return rjson({ok:true,mode:'guest',userId:null,name:'',email:'',orders:0,requests:0})}
  if((p==='/api/chat/memory'||p==='/api/memory')&&['GET','POST'].includes(req.method)){const sid=clean(u.searchParams.get('sessionId'),100).replace(/[^a-zA-Z0-9_-]/g,'');if(!sid)return rjson({ok:false,error:'session_required'},400);const key='chat/'+sid;if(req.method==='POST'){const b=await req.json().catch(()=>({}));const rec={sessionId:sid,turns:Array.isArray(b.turns)?b.turns.slice(-30):[],profile:b.profile&&typeof b.profile==='object'?b.profile:{},updatedAt:now()};await kvPut(env,key,rec);return rjson({ok:true,sessionId:sid,count:rec.turns.length})}const rec=await kvGet(env,key,{sessionId:sid,turns:[],profile:{}});return rjson({ok:true,...rec})}
  if(p==='/api/leads'&&req.method==='POST'){const b=await req.json().catch(()=>({})),email=clean(b.email,160),request=clean(b.request,4000);if(!/^\\S+@\\S+\\.\\S+$/.test(email)||!request)return rjson({ok:false,error:'invalid_request'},400);const lead={id:id(),email,request,language:b.language==='fa'?'fa':'en',recommendedPlan:['FIX','START','BUILD','GROW'].includes(b.recommendedPlan)?b.recommendedPlan:null,createdAt:now()};await kvPut(env,'lead/'+lead.id,lead);return rjson({ok:true,saved:true,leadId:lead.id})}
  if((p==='/api/payment/status'||p==='/api/payment-status')&&req.method==='GET'){const oid=clean(u.searchParams.get('order')||u.searchParams.get('orderId'),120);if(!oid)return rjson({ok:false,error:'order_required'},400);const order=await kvGet(env,'orders/'+oid,null)||state.orders.get(oid);if(!order)return rjson({ok:false,error:'order_not_found'},404);return rjson({ok:true,orderId:oid,plan:order.plan||null,status:order.status,amount:order.amount,providerAmount:order.providerAmount,currency:order.currency||order.providerCurrency||'IRR',paidAt:order.paidAt||null})}
  return null;
}
const ANIL_CHANGE_SCHEMA={allowedRoots:['src/','functions/','scripts/','.github/workflows/','public/'],blockedFragments:['.env','secret','private-key','seed','credentials']};
async function anilChangeRequest(req,env){
  if(req.method==='POST'){
    if(!(await adminAuth(req,env)))return rjson({ok:false,error:'owner_auth_required'},401);
    const b=await req.json().catch(()=>({}));
    const path=clean(b.path,240);
    const content=typeof b.content==='string'?b.content:null;
    const message=clean(b.message||'ANIL X controlled change',160);
    if(!path||!content)return rjson({ok:false,error:'path_and_content_required'},400);
    if(!/^[A-Za-z0-9_./-]+$/.test(path)||path.startsWith('.git/')||path.includes('..'))return rjson({ok:false,error:'invalid_path'},400);
    const request={id:id(),path,content,message,status:'queued',createdAt:now(),updatedAt:now()};
    await kvPut(env,'anil/change/'+request.id,request);
    return rjson({ok:true,request});
  }
  if(req.method==='GET'){
    if(!(await githubActionsAuth(req,env)))return rjson({ok:false,error:'github_actions_auth_required'},401);
    if(!env.PAYMENTS)return rjson({ok:true,request:null,reason:'persistence_not_configured'});
    const q=await env.PAYMENTS.list({prefix:'anil/change/'});
    for(const k of (q?.keys||[])){
      const item=await env.PAYMENTS.get(k.name,'json').catch(()=>null);
      if(item?.status==='queued')return rjson({ok:true,request:item});
    }
    return rjson({ok:true,request:null});
  }
  return rjson({ok:false,error:'method_not_allowed'},405);
}

async function runtimeRoutes(req,env,u){
  const p=u.pathname;
  if(p==='/api/autopilot')return autopilot(req,env);
  if(p==='/api/anil/capabilities')return handleAnilCapabilities(req,env);
  if(p==='/api/anil/automation/queue')return anilChangeRequest(req,env);
  const v90=await v90AdminRoutes(req,env,u);if(v90)return v90;
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
    if(req.method==='GET'){const oid=clean(u.searchParams.get('id'),120);if(env.PAYMENTS){const saved=await env.PAYMENTS.get('orders/'+oid,'json').catch(()=>null);if(saved)return rjson({ok:true,order:saved});}const order=state.orders.get(oid);return order?rjson({ok:true,order}):rjson({ok:false,error:'not_found'},404)}
    return rjson({ok:false,error:'method_not_allowed'},405);
  }
  if(p==='/api/fx'){
    const rate=Number(env.USD_IRR_RATE||0);
    if(!Number.isFinite(rate)||rate<=0)return rjson({ok:false,error:'usd_irr_rate_not_configured',currency:'USD',target:'IRR',source:'environment'});
    return rjson({ok:true,from:'USD',to:'IRR',rate,source:'environment',tomanRate:rate/10});
  }
  if(p==='/api/revenue/fleet'&&req.method==='GET')return rjson({...await revenueFleetStatus(env),state:await revenueFleetState(env)});
  if(p==='/api/revenue/fleet/run'&&req.method==='POST'){
    const result=await runRevenueFleet(env);
    return rjson(result);
  }
  if(p==='/api/revenue/customer-ready'&&req.method==='GET'){
    const payment=!!(env.VARIZA_API_KEY||env.VARIA_API_KEY||env.VARIZA_TOKEN||env.VARIZA_KEY);
    const fx=Number(env.USD_IRR_RATE||0)>0;
    const ai=!!(env.OPENAI_API_KEY||env.GEMINI_API_KEY||env.ANTHROPIC_API_KEY);
    const persistence=!!env.PAYMENTS;
    return rjson({ok:true,customerPath:{brief:true,leadCapture:true,qualification:true,offer:true,order:true,checkout:payment&&fx,paymentGateway:payment,fxConfigured:fx,persistentAccounting:persistence,aiReady:ai},blockers:[...(!payment?['VARIZA_API_KEY']:[]),...(!fx?['USD_IRR_RATE']:[])],truth:'customer arrival is external; everything inside this path is explicit and testable'});
  }
  if(p==='/api/revenue/programs'&&req.method==='GET'){
    const configured={variza:!!(env.VARIZA_API_KEY||env.VARIA_API_KEY||env.VARIZA_TOKEN||env.VARIZA_KEY),ton:!!env.TON_RECEIVING_ADDRESS,ai:!!(env.OPENAI_API_KEY||env.GEMINI_API_KEY||env.ANTHROPIC_API_KEY),gsc:!!(env.GSC_ACCESS_TOKEN||env.GSC_SERVICE_ACCOUNT_JSON)};
    return rjson({ok:true,programs:REVENUE_PROGRAMS.map(x=>({...x,operational:x.status==='LIVE',paymentRoute:configured.variza?'VARIZA':'CONFIG_REQUIRED'})),walletRouting:{tonConfigured:configured.ton,varizaConfigured:configured.variza,truth:'فقط پرداخت واقعی تسویه‌شده درآمد محسوب می‌شود.'},trendSource:'2026 demand signals are informational, not income guarantees'});
  }
  if(p==='/api/revenue/programs/lead'&&req.method==='POST'){
    const b=await req.json().catch(()=>({})),programId=clean(b.programId,80),program=REVENUE_PROGRAMS.find(x=>x.id===programId),email=clean(b.email,160),request=clean(b.request||program?.name||'',3000);
    if(!program)return rjson({ok:false,error:'program_not_found'},404);
    if(!request)return rjson({ok:false,error:'request_required'},400);
    const lead={id:id(),email,country:clean(b.country||'International',80),market:clean(b.market||'International',100),request,programId:program.id,program:program.name,source:'revenue-program',status:'new',score:30+(email?15:0),createdAt:now(),updatedAt:now()};
    state.revenueLeads.set(lead.id,lead);await kvPut(env,'lead/'+lead.id,lead);await kvPut(env,'revenue-leads/'+lead.id,lead);
    return rjson({ok:true,lead,program},201);
  }
  if(p==='/api/revenue/checkout'&&req.method==='POST'){
    const b=await req.json().catch(()=>({}));
    const leadId=clean(b.leadId,120),email=clean(b.email,160),service=clean(b.service||'custom',80);
    if(!/^\\S+@\\S+\\.\\S+$/.test(email))return rjson({ok:false,error:'valid_email_required'},400);
    const catalog={
      website:{name:'AI Website Build',price:149},
      teaser:{name:'Marketing Teaser',price:49},
      fix:{name:'Website Fix',price:39},
      growth:{name:'Growth & SEO',price:79},
      automation:{name:'Business Automation',price:99},
      'ai-agent':{name:'AI Agent Integration',price:129}
    };
    let lead=leadId?await kvGet(env,'revenue-leads/'+leadId,null):null;
    if(!lead&&leadId)lead=state.revenueLeads.get(leadId)||null;
    const selected=catalog[service]||catalog[String(lead?.recommendedService||'')];
    if(!selected)return rjson({ok:false,error:'service_not_available'},400);
    const amountUsd=Number(selected.price);
    const rate=Number(env.USD_IRR_RATE||0);
    const paymentConfigured=!!(env.VARIZA_API_KEY||env.VARIA_API_KEY||env.VARIZA_TOKEN||env.VARIZA_KEY);
    const order={id:id(),accountId:clean(lead?.id||'guest'),client:email,email,service:service||lead?.recommendedService||'custom',description:clean(b.description||lead?.request||selected.name,1000),currency:'USD',amount:amountUsd,orderAmount:amountUsd,status:'pending',leadId:lead?.id||null,createdAt:now()};
    state.orders.set(order.id,order);
    if(env.PAYMENTS)await env.PAYMENTS.put('orders/'+order.id,JSON.stringify(order));
    if(!paymentConfigured)return rjson({ok:true,order,payment:{ready:false,error:'payment_not_configured'},next:'configure_variza'},201);
    if(!Number.isFinite(rate)||rate<=0)return rjson({ok:true,order,payment:{ready:false,error:'fx_unavailable'},next:'configure_usd_irr_rate'},201);
    const providerAmount=Math.max(1000,Math.round(amountUsd*rate));
    const paymentReq=new Request(new URL('/api/pay',req.url),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({amount:providerAmount,orderId:order.id,client:email,description:order.description,returnUrl:new URL('/payment.html?order='+encodeURIComponent(order.id)+'&amount='+providerAmount,req.url).toString()})});
    const paymentResp=await pay({request:paymentReq,env});
    const payment=await paymentResp.json().catch(()=>({ok:false,error:'payment_response_invalid'}));
    if(!payment?.ok)return rjson({ok:true,order,payment:{ready:false,error:payment?.error||'payment_create_failed',providerStatus:payment?.providerStatus||paymentResp.status},next:'payment_retry'},201);
    const saved=await kvGet(env,'orders/'+order.id,order);
    return rjson({ok:true,order:saved||{...order,providerAmount},payment:{ready:true,payUrl:payment.payUrl,orderId:order.id,providerAmount},next:'pay'},201);
  }
  if(p==='/api/revenue/settlement'&&req.method==='GET'){
    return rjson({ok:true,providers:{variza:!!(env.VARIZA_API_KEY||env.VARIA_API_KEY||env.VARIZA_TOKEN||env.VARIZA_KEY),ton:!!env.TON_RECEIVING_ADDRESS},policy:{paidOnly:true,noSecretKeys:true,ownerApprovalForIrreversible:true}});
  }
  if(p==='/api/revenue/engines'&&req.method==='GET'){
    const configured={variza:!!(env.VARIZA_API_KEY||env.VARIA_API_KEY||env.VARIZA_TOKEN||env.VARIZA_KEY),ton:!!env.TON_RECEIVING_ADDRESS,gsc:!!(env.GSC_ACCESS_TOKEN||env.GSC_SERVICE_ACCOUNT_JSON),ai:!!(env.OPENAI_API_KEY||env.GEMINI_API_KEY||env.ANTHROPIC_API_KEY)};
    return rjson({ok:true,engines:[
      {id:'revenue-hunter',name:'Revenue Hunter',active:true,mode:'rule+lead-data'},
      {id:'offer-engine',name:'Offer Engine',active:true,mode:'catalog+scoring'},
      {id:'sales-conversion',name:'Sales / Conversion',active:true,mode:'lead→offer→order→payment'},
      {id:'customer-service',name:'AI Customer Service',active:true,mode:configured.ai?'ai-configured':'deterministic-fallback'},
      {id:'business-automation',name:'Business Automation',active:true,mode:'workflow-storage'},
      {id:'growth-seo',name:'Growth & SEO',active:true,mode:configured.gsc?'gsc-configured':'on-demand-audit'},
      {id:'content-engine',name:'Content Engine',active:true,mode:configured.ai?'ai-configured':'draft-template'},
      {id:'analytics',name:'Analytics Engine',active:true,mode:'persistent-ledger'},
      {id:'retention',name:'Retention Engine',active:true,mode:'customer-history'},
      {id:'agent-commerce',name:'Agent Commerce',active:true,mode:'draft-order-api'},
      {id:'immortal-guard',name:'Immortal Guard',active:true,mode:'owner-gated'},
      {id:'evolution',name:'Evolution Engine',active:true,mode:'scheduled-autopilot'},
    ],integrations:configured,truth:{revenueOnlyWhenPaid:true,noGuaranteedIncome:true}}
    );
  }
  if(p==='/api/revenue/hunt'&&req.method==='POST'){
    const b=await req.json().catch(()=>({})),request=clean(b.request||b.need,3000),email=clean(b.email,160),country=clean(b.country||'International',80),market=clean(b.market||country,100);
    if(!request)return rjson({ok:false,error:'request_required'},400);
    const c=(()=>{const t=request.toLowerCase();const map=[['website',['website','site','سایت'],149],['teaser',['teaser','video','تیزر','ویدیو'],49],['fix',['fix','bug','error','خطا','ارور'],39],['growth',['seo','growth','سئو','رشد','traffic','فروش'],79],['automation',['automation','workflow','اتوماسیون','خودکار'],99],['ai-agent',['agent','ایجنت','هوش مصنوعی'],129]];let best=map[0],score=0;for(const x of map){const s=x[1].reduce((n,k)=>n+(t.includes(k)?20:0),0);if(s>score){score=s;best=x}}const leadScore=Math.min(100,30+(email?15:0)+(request.length>80?20:0)+score);return {service:best[0],price:best[2],score:leadScore}})();
    const lead={id:id(),email,country,market,request,source:clean(b.source||'revenue-hunter',60),status:c.score>=70?'qualified':'new',score:c.score,recommendedService:c.service,recommendedPrice:c.price,createdAt:now(),updatedAt:now()};
    state.revenueLeads.set(lead.id,lead);await kvPut(env,'lead/'+lead.id,lead);await kvPut(env,'revenue-leads/'+lead.id,lead);
    return rjson({ok:true,lead,engine:'revenue-hunter'},201);
  }
  if(p==='/api/revenue/offer'&&req.method==='POST'){
    const b=await req.json().catch(()=>({})),leadId=clean(b.leadId,120),request=clean(b.request||'',3000);
    let lead=leadId?await kvGet(env,'revenue-leads/'+leadId,null):null;
    if(!lead&&leadId)lead=state.revenueLeads.get(leadId)||null;
    const textReq=lead?.request||request;if(!textReq)return rjson({ok:false,error:'lead_or_request_required'},400);
    const t=textReq.toLowerCase(),items=[['website',149,['website','site','سایت']],['teaser',49,['teaser','video','تیزر','ویدیو']],['fix',39,['fix','bug','error','خطا','ارور']],['growth',79,['seo','growth','سئو','رشد','traffic','فروش']],['automation',99,['automation','workflow','اتوماسیون','خودکار']],['ai-agent',129,['agent','ایجنت','هوش مصنوعی']]];
    let best=items[0],hits=0;for(const x of items){const n=x[2].reduce((s,k)=>s+(t.includes(k)?1:0),0);if(n>hits){hits=n;best=x}}
    const offer={id:id(),leadId:lead?.id||null,service:best[0],priceUsd:best[1],pricingPolicy:'ANIL-X-target-price; market benchmark not asserted',upsell:best[0]==='website'?['growth','automation']:best[0]==='growth'?['automation']:['growth'],createdAt:now(),status:'draft'};
    await kvPut(env,'offers/'+offer.id,offer);return rjson({ok:true,offer,engine:'offer-engine'},201);
  }
  if(p==='/api/customer-service'&&req.method==='POST'){
    const b=await req.json().catch(()=>({})),message=clean(b.message||b.request,3000);if(!message)return rjson({ok:false,error:'message_required'},400);
    const t=message.toLowerCase(),category=/payment|پرداخت|پول|واریز/.test(t)?'payment':/error|bug|خطا|ارور/.test(t)?'technical':/price|قیمت|هزینه/.test(t)?'sales':'general';
    const sensitive=/password|رمز|private key|seed|کارت بانکی|card number|identity|هویت/.test(t);
    const reply=sensitive?'این مورد به دلیل حساسیت باید توسط مدیر بررسی شود. لطفاً اطلاعات محرمانه مثل Seed، Private Key یا رمز را ارسال نکن.':category==='payment'?'درخواست پرداخت ثبت شد؛ وضعیت سفارش و پرداخت باید از مسیر رسمی ANIL X بررسی شود.':category==='technical'?'مشکل فنی دسته‌بندی شد و برای بررسی دقیق آماده است.':'درخواستت دریافت شد؛ سرویس مناسب و قدم بعدی را بررسی می‌کنیم.';
    const rec={id:id(),category,sensitive,reply,message,createdAt:now()};await kvPut(env,'support/'+rec.id,rec);return rjson({ok:true,ticket:rec,engine:'customer-service'});
  }
  if(p==='/api/automation/workflow'&&req.method==='POST'){
    const b=await req.json().catch(()=>({})),name=clean(b.name||'workflow',120),steps=Array.isArray(b.steps)?b.steps.slice(0,30):[];
    if(!steps.length)return rjson({ok:false,error:'steps_required'},400);
    const w={id:id(),name,steps,active:b.active!==false,createdAt:now(),requiresOwnerApproval:steps.some(s=>s?.sensitive||s?.payment||s?.externalWrite)};await kvPut(env,'automation/'+w.id,w);return rjson({ok:true,workflow:w,engine:'business-automation'},201);
  }
  if(p==='/api/growth/audit'&&req.method==='POST'){
    const b=await req.json().catch(()=>({})),pages=Array.isArray(b.pages)?b.pages.slice(0,100):[];if(!pages.length)return rjson({ok:false,error:'pages_required'},400);
    const findings=pages.map(x=>{const title=String(x.title||''),description=String(x.description||''),h1=String(x.h1||'');return {url:clean(x.url||'',500),issues:[!title&&'missing_title',!description&&'missing_meta_description',!h1&&'missing_h1',title.length>60&&'title_too_long'].filter(Boolean)}});return rjson({ok:true,findings,source:b.source||'provided_page_data',searchConsoleConfigured:!!env.GSC_ACCESS_TOKEN,engine:'growth-seo'});
  }
  if(p==='/api/content/draft'&&req.method==='POST'){
    const b=await req.json().catch(()=>({})),topic=clean(b.topic||b.request,500),market=clean(b.market||'International',100),format=clean(b.format||'landing-page',60);if(!topic)return rjson({ok:false,error:'topic_required'},400);
    const draft={id:id(),topic,market,format,title:topic,outline:['Problem','Solution','Proof / evidence','Offer','Call to action'],body:'Draft prepared for human/AI quality review before publication.',status:'draft',createdAt:now()};await kvPut(env,'content/'+draft.id,draft);return rjson({ok:true,draft,engine:'content-engine',aiConfigured:!!(env.OPENAI_API_KEY||env.GEMINI_API_KEY||env.ANTHROPIC_API_KEY)},201);
  }
  if(p==='/api/analytics'&&req.method==='GET'){
    const leads=await kvList(env,'revenue-leads/',1000),orders=await kvList(env,'orders/',1000),paid=orders.filter(x=>x?.status==='paid');return rjson({ok:true,metrics:{leads:leads.length,orders:orders.length,paid:paid.length,revenueUsd:paid.reduce((s,x)=>s+Number((x.orderAmount??(x.currency==='USD'?x.amount:0))||0),0),settlementIrr:paid.reduce((s,x)=>s+Number((x.providerAmount??(x.currency==='IRR'?x.amount:0))||0),0)},engine:'analytics'});
  }
  if(p==='/api/retention'&&req.method==='GET'){
    const orders=await kvList(env,'orders/',1000),byCustomer={};for(const o of orders.filter(x=>x?.status==='paid')){const k=clean(o.client||o.email||o.accountId||'unknown',160);(byCustomer[k]??=[]).push(o)}
    const items=Object.entries(byCustomer).map(([customer,os])=>({customer,orders:os.length,lastPaidAt:os.map(x=>x.paidAt||x.createdAt).sort().pop(),nextService:os.some(x=>x.service==='website')?'growth':os.some(x=>x.service==='growth')?'automation':'growth',upsellAllowed:true}));return rjson({ok:true,customers:items,engine:'retention'});
  }
  if(p==='/api/agent/catalog'&&req.method==='GET'){
    return rjson({ok:true,protocol:'ANIL-X-Agent-Commerce-v1',services:[
      {id:'website',name:'AI Website Build',priceUsd:149,currency:'USD'},{id:'teaser',name:'Marketing Teaser',priceUsd:49,currency:'USD'},{id:'fix',name:'Website Fix',priceUsd:39,currency:'USD'},{id:'growth',name:'Growth & SEO',priceUsd:79,currency:'USD'},{id:'automation',name:'Business Automation',priceUsd:99,currency:'USD'},{id:'ai-agent',name:'AI Agent Integration',priceUsd:129,currency:'USD'}],payment:{provider:'Variza',requiresCheckout:true},safety:{draftOrderOnly:true,no_secret_access:true}});
  }
  if(p==='/api/agent/orders'&&req.method==='POST'){
    const b=await req.json().catch(()=>({})),service=clean(b.service,80),cat={website:149,teaser:49,fix:39,growth:79,automation:99,'ai-agent':129};if(!cat[service])return rjson({ok:false,error:'service_not_found'},404);
    const order={id:id(),agentId:clean(b.agentId||'external-agent',120),service,amount:cat[service],currency:'USD',description:clean(b.description||'',1000),status:'draft',paymentRequired:true,createdAt:now(),source:'agent-commerce'};await kvPut(env,'orders/'+order.id,order);return rjson({ok:true,order},201);
  }
  if(p==='/api/agent/orders'&&req.method==='GET'){
    const oid=clean(u.searchParams.get('id'),120),o=await kvGet(env,'orders/'+oid,null);return o?rjson({ok:true,order:o}):rjson({ok:false,error:'not_found'},404);
  }
  if(p==='/api/evolution'&&req.method==='POST'){
    const report=await runAutopilotSafe(env);return rjson({ok:true,cycle:report,steps:['Discover','Analyze','Build','Sell','Get Paid','Measure','Learn','Improve']});
  }
if(p==='/api/payment-config'){
    return rjson({ok:true,ton:{enabled:!!env.TON_RECEIVING_ADDRESS,address:env.TON_RECEIVING_ADDRESS||null},fiat:{provider:'variza',enabled:!!(env.VARIZA_API_KEY||env.VARIA_API_KEY||env.VARIZA_TOKEN||env.VARIZA_KEY)}});
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
    state.revenueLeads.set(lead.id,lead);await kvPut(env,'lead/'+lead.id,lead);await kvPut(env,'revenue-leads/'+lead.id,lead);return rjson({ok:true,lead},201);
  }
  if(p==='/api/revenue/summary'){
    const leads=[...state.revenueLeads.values()];
    let orders=[...state.orders.values()];
    if(env.PAYMENTS){
      try{
        const keys=await env.PAYMENTS.list({prefix:'orders/'});
        const persisted=await Promise.all((keys?.keys||[]).map(async k=>env.PAYMENTS.get(k.name,'json').catch(()=>null)));
        const map=new Map(orders.map(x=>[x.orderId||x.id,x]));
        for(const x of persisted.filter(Boolean))map.set(x.orderId||x.id,x);
        orders=[...map.values()];
      }catch{}
    }
    const paid=orders.filter(x=>x.status==='paid');
    const revenue=paid.reduce((s,x)=>s+Number((x.orderAmount??(x.currency==='USD'?x.amount:0))||0),0);
    return rjson({ok:true,counts:{leads:leads.length,orders:orders.length,paid:paid.length},revenue,currency:'USD',settlement:paid.reduce((s,x)=>s+Number((x.providerAmount??(x.currency==='IRR'?x.amount:0))||0),0),settlementCurrency:'IRR',updatedAt:now()});
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
    const rec={id:id(),name,email,country,request,status:'pending',createdAt:now(),decidedAt:null,decidedBy:null};state.freeRequests.set(rec.id,rec);state.revenueLeads.set(rec.id,{id:rec.id,name,email,company:'',request,source:'free-request',status:'new',score:0,createdAt:rec.createdAt,updatedAt:rec.createdAt});await kvPut(env,'lead/'+rec.id,{...rec,source:'free-request'});await kvPut(env,'revenue-leads/'+rec.id,state.revenueLeads.get(rec.id));return rjson({ok:true,id:rec.id,status:rec.status},201);
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
async function githubActionsAuth(req,env){
  const auth=req.headers.get('authorization')||'';
  if(!auth.startsWith('Bearer '))return false;
  const token=auth.slice(7).trim();
  const parts=token.split('.');
  if(parts.length!==3)return false;
  const b64u=s=>s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4);
  try{
    const header=JSON.parse(atob(b64u(parts[0]))),payload=JSON.parse(atob(b64u(parts[1])));
    if(header.alg!=='RS256'||payload.iss!=='https://token.actions.githubusercontent.com'||payload.aud!=='anil-x')return false;
    if(payload.exp && Number(payload.exp)*1000<Date.now())return false;
    if(payload.repository!=='saberbadri24-tech/city-of-eternity'||payload.ref!=='refs/heads/main')return false;
    const jwks=globalThis.__ANILX_GH_JWKS||(globalThis.__ANILX_GH_JWKS=await fetch('https://token.actions.githubusercontent.com/.well-known/jwks').then(r=>r.json()).catch(()=>null));
    const jwk=jwks?.keys?.find(k=>k.kid===header.kid);
    if(!jwk)return false;
    const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    const data=new TextEncoder().encode(parts[0]+'.'+parts[1]);
    const sig=Uint8Array.from(atob(b64u(parts[2])),c=>c.charCodeAt(0));
    return await crypto.subtle.verify({name:'RSASSA-PKCS1-v1_5'},key,sig,data);
  }catch{return false}
}
async function adminLogin(req,env){if(req.method!=='POST')return json({ok:false,error:'method_not_allowed'},405);const secret=String(env.ANIL_ADMIN_PASSWORD??'').normalize('NFKC').trim();if(secret.length<8)return json({ok:false,error:'admin_password_not_configured'},503);const b=await req.json().catch(()=>({})),pass=String(b.password??'').normalize('NFKC').trim();const ip=req.headers.get('x-forwarded-for')||'unknown',key='admin/login/'+btoa(ip).replace(/=+$/,'');const gate=await kvGet(env,key,{count:0,blockedUntil:0});if(Number(gate.blockedUntil)>Date.now())return json({ok:false,error:'too_many_attempts'},429);if(pass!==secret){const count=Number(gate.count||0)+1;await kvPut(env,key,{count,blockedUntil:count>=5?Date.now()+900000:0});return json({ok:false,error:'invalid_credentials'},401)}await kvPut(env,key,{count:0,blockedUntil:0});const body=btoa(JSON.stringify({sub:'admin',exp:Date.now()+43200000})).replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_');const sig=await sign(body,secret);return json({ok:true,expiresAt:Date.now()+43200000},200,{ 'set-cookie':`session=${body+'.'+sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200` })}
async function adminAuth(req,env){const secret=String(env.ANIL_ADMIN_PASSWORD??'').normalize('NFKC').trim();if(!secret)return false;const m=(req.headers.get('cookie')||'').match(/(?:^|; )session=([^;]+)/);if(!m)return false;const [body,sig]=m[1].split('.');if(!body||!sig||sig!==(await sign(body,secret)))return false;try{return JSON.parse(atob(body.replace(/-/g,'+').replace(/_/g,'/'))).exp>Date.now()}catch{return false}}
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
export default{async fetch(req,env,ctx){const u=new URL(req.url);if(u.pathname==='/api/health'||u.pathname==='/api/_healthcheck'){const adminConfigured=String(env.ANIL_ADMIN_PASSWORD||'').length>=8;return json({ok:true,ready:adminConfigured,service:'ANIL X',runtime:'unified-worker',configured:{admin:adminConfigured,openai:!!env.OPENAI_API_KEY,anthropic:!!env.ANTHROPIC_API_KEY,gemini:!!env.GEMINI_API_KEY,variza:!!(env.VARIZA_API_KEY||env.VARIA_API_KEY||env.VARIZA_TOKEN||env.VARIZA_KEY),payments:!!env.PAYMENTS,assets:!!env.ASSETS},routes:['/api/plan','/api/analyze','/api/vision','/api/voice','/api/ton/account','/api/ton/transactions','/api/javidan/trinity','/api/account','/api/memory','/api/order','/api/fx','/api/discovery','/api/free-request','/api/free-admin','/api/payment-status','/api/worker','/api/pay','/api/variza-webhook','/api/revenue/fleet','/api/revenue/fleet/run','/api/revenue/programs'],revenue:{persistence:!!env.PAYMENTS,variza:!!(env.VARIZA_API_KEY||env.VARIA_API_KEY||env.VARIZA_TOKEN||env.VARIZA_KEY),ton:!!env.TON_RECEIVING_ADDRESS}},200);}const runtime=await runtimeRoutes(req,env,u);if(runtime)return runtime;if(u.pathname==='/api/analyze')return analyze(req,env);if(u.pathname==='/api/vision')return vision(req,env);if(u.pathname==='/api/voice')return voice(req,env);if(u.pathname==='/api/ton/account'||u.pathname==='/api/ton/transactions')return tonApi(req);if(u.pathname==='/api/plan')return handlePlan(req,env);if(u.pathname==='/api/javidan/trinity')return handleJavidan(req,env);if(u.pathname==='/api/admin/password/login')return adminLogin(req,env);if(u.pathname==='/api/admin/secretary')return secretary(req,env);if(u.pathname==='/api/pay')return pay({request:req,env});if(u.pathname==='/api/variza-webhook')return webhook({request:req,env});if(u.pathname.startsWith('/api/'))return json({ok:false,error:'not_found'},404);return env.ASSETS.fetch(req)}};
