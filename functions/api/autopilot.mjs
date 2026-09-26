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

export async function runAutopilot(env,{force=false}={}){
  const started=now();
  let promoted=0,qualified=0,offers=0;
  for(const x of state.freeRequests.values()){
    if([...state.revenueLeads.values()].some(l=>l.id===x.id))continue;
    const c=classify(x.request);
    state.revenueLeads.set(x.id,{id:x.id,name:x.name,email:x.email,company:'',request:x.request,source:'free-request',status:'new',score:0,recommendedService:c.id,recommendedPrice:c.service.price,createdAt:x.createdAt||started,updatedAt:started});
    promoted++;
  }
  for(const l of state.revenueLeads.values()){
    const c=classify(l.request);
    const score=Math.min(100,30+(l.email?15:0)+(String(l.request||'').length>80?20:0)+c.score);
    const next={...l,score,status:score>=70?'qualified':'new',recommendedService:c.id,recommendedPrice:c.service.price,updatedAt:started};
    if(next.status==='qualified')qualified++;
    if(next.status==='qualified' && !next.offerId){
      next.offerId=id();next.offer={service:c.id,name:c.service.name,price:c.service.price,currency:'USD',createdAt:started};
      offers++;
    }
    state.revenueLeads.set(l.id,next);
    if(env.PAYMENTS)await env.PAYMENTS.put('revenue-leads/'+l.id,JSON.stringify(next));
  }
  const report={ok:true,startedAt:started,finishedAt:now(),promoted,qualified,offers,mode:'autonomous',safety:{no_bulk_spam:true,no_sensitive_actions:true,owner_approval_for_irreversible:true}};
  if(env.PAYMENTS)await env.PAYMENTS.put('autopilot/latest',JSON.stringify(report));
  return report;
}

export default async function autopilot(req,env){
  if(req.method!=='POST' && req.method!=='GET')return runtimeJson({ok:false,error:'method_not_allowed'},405);
  const expected=String(env.ANIL_WORKER_KEY||'');
  const supplied=req.headers.get('x-anil-worker-key')||'';
  if(!expected || supplied!==expected)return runtimeJson({ok:false,error:'worker_key_required'},401);
  return runtimeJson(await runAutopilot(env,{force:req.method==='POST'}));
}
