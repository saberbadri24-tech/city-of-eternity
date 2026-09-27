// ANIL X Revenue Flywheel — discovery -> qualification -> offer -> follow-up -> retention
import {state,now,clean,id,json as runtimeJson} from './runtime-state.mjs';

const serviceMap={
  website:{name:'AI Website Build',setup:149,monthly:49,keywords:['website','site','سایت','web']},
  teaser:{name:'Marketing Teaser',setup:49,monthly:0,keywords:['teaser','video','تیزر','ویدیو']},
  fix:{name:'Website Fix',setup:39,monthly:0,keywords:['fix','bug','error','خطا','ارور']},
  growth:{name:'Growth & SEO',setup:79,monthly:99,keywords:['seo','growth','سئو','رشد','traffic','فروش']},
  automation:{name:'Business Automation',setup:149,monthly:149,keywords:['automation','workflow','خودکار','اتوماسیون']},
  'ai-agent':{name:'AI Agent Integration',setup:299,monthly:199,keywords:['agent','ai','هوش مصنوعی','ایجنت']}
};

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

function classify(text){
  const t=String(text||'').toLowerCase();
  let best={id:'website',score:0};
  for(const [id,s] of Object.entries(serviceMap)){
    const score=s.keywords.reduce((n,k)=>n+(t.includes(k)?20:0),0);
    if(score>best.score)best={id,score};
  }
  return {...best,service:serviceMap[best.id]};
}

async function listStore(env,prefix,limit=1000){
  if(!env.PAYMENTS)return[];
  try{
    const q=await env.PAYMENTS.list({prefix});
    const keys=(q?.keys||[]).slice(-limit);
    return (await Promise.all(keys.map(k=>env.PAYMENTS.get(k.name,'json').catch(()=>null)))).filter(Boolean);
  }catch{return[]}
}
async function putStore(env,key,value){
  if(env.PAYMENTS)await env.PAYMENTS.put(key,JSON.stringify(value));
  return value;
}

function qualifyLead(l,c){
  const text=String(l?.request||'');
  let score=25;
  if(l?.email)score+=15;
  if(l?.company)score+=10;
  if(text.length>80)score+=15;
  score+=c.score;
  if(/urgent|asap|today|quote|budget|price|hire|pay|فوری|قیمت|بودجه|سفارش/.test(text.toLowerCase()))score+=15;
  return clamp(score,0,100);
}

function buildOffer(c,score){
  const highIntent=score>=85;
  const setup=highIntent?Math.round(c.service.setup*1.25):c.service.setup;
  const monthly=c.service.monthly;
  return {
    service:c.id,
    name:c.service.name,
    currency:'USD',
    setupUsd:setup,
    monthlyUsd:monthly,
    totalFirstMonthUsd:setup+monthly,
    model:monthly?'setup_plus_recurring':'one_off',
    closePath:monthly?'diagnostic -> setup -> monthly retainer':'diagnostic -> fixed delivery -> payment'
  };
}

export async function runAutopilot(env,{force=false}={}){
  const started=now();
  let promoted=0,qualified=0,newOffers=0,followups=0,retention=0;
  const persistedLeads=await listStore(env,'lead/',1000);
  const persistedRevenue=await listStore(env,'revenue-leads/',1000);
  const allLeads=[...state.freeRequests.values(),...persistedLeads,...persistedRevenue];
  const seen=new Set();

  for(const x of allLeads){
    if(!x?.id||seen.has(x.id))continue;
    seen.add(x.id);
    const c=classify(x.request);
    const score=qualifyLead(x,c);
    const previous=state.revenueLeads.get(x.id)||persistedRevenue.find(v=>v?.id===x.id)||{};
    const next={...previous,...x,id:x.id,recommendedService:c.id,recommendedPrice:c.service.setup,score,status:score>=70?'qualified':'new',updatedAt:started};
    if(next.status==='qualified')qualified++;

    if(next.status==='qualified'&&!next.offer){
      next.offerId=id();
      next.offer=buildOffer(c,score);
      next.offerCreatedAt=started;
      newOffers++;
    }

    if(next.status==='qualified'){
      const existing=Array.isArray(next.followups)?next.followups:[];
      if(!existing.length){
        next.followups=[
          {step:1,channel:'draft',delayHours:0,status:'ready',purpose:'send tailored diagnostic + offer'},
          {step:2,channel:'draft',delayHours:24,status:'queued',purpose:'answer objections + show concrete outcome'},
          {step:3,channel:'draft',delayHours:72,status:'queued',purpose:'close or ask for a better-fit scope'}
        ];
        followups++;
      }
    }

    state.revenueLeads.set(next.id,next);
    await putStore(env,'lead/'+next.id,next);
    await putStore(env,'revenue-leads/'+next.id,next);
  }

  const paid=await listStore(env,'orders/',1000);
  const paidCustomers=new Map();
  for(const order of paid.filter(x=>x?.status==='paid')){
    const customer=clean(order.client||order.email||order.accountId||'unknown',160);
    const prev=paidCustomers.get(customer)||[];
    prev.push(order);paidCustomers.set(customer,prev);
  }
  for(const [customer,orders] of paidCustomers){
    if(orders.length<1||customer==='unknown')continue;
    const last=orders.map(x=>x.paidAt||x.createdAt).sort().pop();
    const key='retention/'+btoa(unescape(encodeURIComponent(customer))).replace(/[^A-Za-z0-9_-]/g,'_').slice(0,120);
    const existing=env.PAYMENTS?await env.PAYMENTS.get(key,'json').catch(()=>null):null;
    const rec={customer,orders:orders.length,lastPaidAt:last,nextOffer:orders.length>=2?'growth_retainer':'maintenance_retainer',status:'ready',updatedAt:started};
    if(!existing)retention++;
    await putStore(env,key,rec);
  }

  const report={
    ok:true,
    startedAt:started,
    finishedAt:now(),
    mode:'revenue-flywheel',
    stages:['DISCOVER','QUALIFY','PACKAGE','OFFER','FOLLOW_UP','PAY','DELIVER','RETAIN','UPSELL','LEARN'],
    metrics:{promoted,qualified,newOffers,followups,retention,paidOrders:paid.filter(x=>x?.status==='paid').length},
    persistence:!!env.PAYMENTS,
    paymentReady:!!(env.VARIZA_API_KEY||env.VARIA_API_KEY||env.VARIZA_TOKEN||env.VARIZA_KEY),
    safety:{
      no_bulk_spam:true,
      no_fake_revenue:true,
      no_sensitive_actions:true,
      no_credentials_or_seeds:true,
      owner_approval_for_irreversible:true,
      followups_are_drafts_until_a_real_messaging_channel_is_connected:true
    },
    forced:!!force
  };
  await putStore(env,'autopilot/latest',report);
  return report;
}

export default async function autopilot(req,env){
  if(req.method!=='POST'&&req.method!=='GET')return runtimeJson({ok:false,error:'method_not_allowed'},405);
  return runtimeJson(await runAutopilot(env,{force:req.method==='POST'}));
}
