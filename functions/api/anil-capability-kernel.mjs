const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const has=v=>typeof v==='string'&&v.trim().length>0;
const now=()=>new Date().toISOString();

const DOMAINS={
 code:['inspect_github','search_code','read_file','change_files','create_files','commit','ci'],
 infra:['read_live_state','health_check','read_render_logs','deploy','rollback'],
 qa:['test','post_change_qa','stop_on_regression'],
 revenue:['inspect_payment','payment_monitoring','write_audit_event','build_evidence_ledger'],
 guard:['inspect_guard','guard','radar','opportunity_analysis'],
 security:['audit','owner_approval','dry_run','change_impact_analysis'],
 planning:['observe','reason','plan','change_plan','failure_recovery']
};
const READ_ONLY=new Set(['read_live_state','inspect_github','search_code','read_file','read_render_logs','health_check','inspect_guard','inspect_payment','inspect_wallet','build_evidence_ledger']);
const MUTATING=new Set(['change_files','create_files','change_plan','commit','test','deploy','rollback','write_audit_event','request_owner_approval']);

function capabilities(env){
 const providers={openai:has(env.OPENAI_API_KEY)||has(env.OPENAI_KEY),anthropic:has(env.ANTHROPIC_API_KEY)||has(env.ANTHROPIC_KEY),gemini:has(env.GEMINI_API_KEY)||has(env.GOOGLE_GEMINI_API_KEY)||has(env.GOOGLE_API_KEY),openrouter:has(env.ANIL_OPENROUTER_API_KEY)||has(env.OPENROUTER_API_KEY)};
 const adapters={
  github:{configured:has(env.GITHUB_TOKEN)||has(env.GH_TOKEN),fallback:'github-actions'},
  render:{configured:has(env.RENDER_API_KEY)||has(env.RENDER_TOKEN),fallback:'runtime-health'},
  appdeploy:{configured:has(env.APPDEPLOY_TOKEN)||has(env.APPDEPLOY_API_KEY),fallback:'manual-provider-boundary'},
  variza:{configured:has(env.VARIZA_API_KEY)||has(env.VARIA_API_KEY)||has(env.VARIZA_TOKEN)||has(env.VARIZA_KEY),mode:'provider-webhook'},
  browser:{configured:has(env.TINYFISH_API_KEY)||has(env.BROWSER_AUTOMATION_KEY),fallback:'owner/browser-connector'},
  ai:{providers,liveCount:Object.values(providers).filter(Boolean).length}
 };
 return {adapters,domains:DOMAINS,readOnly:[...READ_ONLY],mutating:[...MUTATING]};
}

export async function handleCapabilityKernel(req,env){
 if(req.method!=='GET'&&req.method!=='POST')return json({ok:false,error:'method_not_allowed'},405);
 let body={};if(req.method==='POST')body=await req.json().catch(()=>({}));
 const task=String(body.task||'').slice(0,4000);
 const operation=String(body.operation||'read_live_state');
 const caps=capabilities(env);
 const plan={
  id:'ANIL-'+Date.now().toString(36).toUpperCase(),
  createdAt:now(),
  task:task||'inspect current ANIL X state',
  operation,
  stages:['OBSERVE','PLAN','IMPACT','APPROVE_IF_SENSITIVE','EXECUTE','VERIFY','QA','EVIDENCE','LEARN'],
  selectedDomain:Object.entries(DOMAINS).find(([,ops])=>ops.includes(operation))?.[0]||'planning',
  stopConditions:['missing_evidence','regression','security_boundary_violation','unverified_payment','stale_state','unknown_operation'],
  evidenceRequired:true
 };
 if(!READ_ONLY.has(operation)&&!MUTATING.has(operation)&&!DOMAINS.planning.includes(operation))
   return json({ok:false,error:'unknown_operation',plan,capabilities:caps},400);
 const approvalRequired=MUTATING.has(operation);
 return json({
  ok:true,engine:'ANIL-CAPABILITY-KERNEL',version:'1.0.0',
  truth:{executionIsNeverClaimedWithoutEvidence:true,providerAccessIsNeverInferred:true},
  capabilityLevel:{target:100,design:100,configured:Math.round((Object.values(caps.adapters).filter(x=>x.configured).length/Object.keys(caps.adapters).length)*100),runtimeVerified:null},
  capabilities:caps,plan,
  execution:{status:approvalRequired?'owner_approval_required':'read_only_ready',approvalRequired},
  next:{controlPlane:'/api/anil/control-plane',superTeam:'/api/anil/super-team',kernel:'/api/anil/capability-kernel'}
 });
}