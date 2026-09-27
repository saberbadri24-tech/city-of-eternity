// ANIL X Autonomous Revenue Orchestrator
import {state,now,clean,id,json as runtimeJson} from './runtime-state.mjs';

const serviceMap={
  website:{name:'AI Website Build',price:149,keywords:['website','site','سایت','web']},
  teaser:{name:'Marketing Teaser',price:49,keywords:['teaser','video','تیزر','ویدیو']},
  fix:{name:'Website Fix',price:39,keywords:['fix','bug','error','خطا','ارور']},
  growth:{name:'Growth & SEO',price:79,keywords:['seo','growth','سئو','رشد','traffic','فروش']},
  automation:{name:'Business Automation',price:99,keywords:['automation','workflow','خودکار','اتوماسیون']},
  'ai-agent':{name:'AI Agent Integration',price:129,keywords:['agent','ai','هوش مصنوعی','ایجنت']}
};

function classify(text){
  const t=String(text||'').toLowerCase();
  let best={id:'website',score:0};
  for(const [id,s] of Object.entries(serviceMap)){
    const score=s.keywords.reduce((n,k)=>n+(t.includes(k)?20:0),0);
    if(score>best.score)best={id,score};
  }
  return {...best,service:serviceMap[best.id]};
}

async function listStore(env,prefix,limit=500){if(!env.PAYMENTS)return[];try{const q=await env.PAYMENTS.list({prefix});const keys=(q?.keys||[]).slice(-limit);return (await Promise.all(keys.map(k=>env.PAYMENTS.get(k.name,'json').catch(()=>null)))).filter(Boolean)}catch{return[]}}
async function putStore(env,key,value){if(env.PAYMENTS)await env.PAYMENTS.put(key,JSON.stringify(value));return value}

export async function runAutopilot(env,{force=false}={}){
  const started=now();
  let promoted=0,qualified=0,offers=0;
  const persistedLeads=await listStore(env,'lead/',500);
  const persistedRevenue=await listStore(env,'revenue-leads/',500);
  for(const x of [...state.freeRequests.values(),...persistedLeads]){
    if(!x?.id||[...state.revenueLeads.values()].some(l=>l.id===x.id)||persistedRevenue.some(l=>l.id===x.id))continue;
    const c=classify(x.request);
    const lead={id:x.id,name:x.name,email:x.email,company:x.company||'',request:x.request,source:x.source||'website',status:'new',score:0,recommendedService:c.id,recommendedPrice:c.service.price,createdAt:x.createdAt||started,updatedAt:started};
    state.revenueLeads.set(lead.id,lead);await putStore(env,'revenue-leads/'+lead.id,lead);promoted++;
  }
  const all=[...state.revenueLeads.values(),...persistedRevenue];
  const seen=new Set();
  for(const l of all){
    if(!l?.id||seen.has(l.id))continue;seen.add(l.id);
    const c=classify(l.request);
    const score=Math.min(100,30+(l.email?15:0)+(String(l.request||'').length>80?20:0)+c.score+(l.company?5:0));
    const next={...l,score,status:score>=70?'qualified':'new',recommendedService:c.id,recommendedPrice:c.service.price,updatedAt:started};
    if(next.status==='qualified')qualified++;
    if(next.status==='qualified' && !next.offerId){
      next.offerId=id();next.offer={service:c.id,name:c.service.name,price:c.service.price,currency:'USD',createdAt:started};offers++;
    }
    state.revenueLeads.set(next.id,next);await putStore(env,'revenue-leads/'+next.id,next);
  }
  const report={ok:true,startedAt:started,finishedAt:now(),promoted,qualified,offers,mode:'autonomous-persistent',forced:!!force,safety:{no_bulk_spam:true,no_sensitive_actions:true,owner_approval_for_irreversible:true}};
  await putStore(env,'autopilot/latest',report);
  return report;
}

export default async function autopilot(req,env){
  if(req.method!=='POST' && req.method!=='GET')return runtimeJson({ok:false,error:'method_not_allowed'},405);
  return runtimeJson(await runAutopilot(env,{force:req.method==='POST'}));
}
