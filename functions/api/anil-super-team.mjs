import {buildComplementaryCouncil} from './anil-team-council.mjs';
const firstEnv=(env,keys)=>keys.map(k=>env?.[k]).find(v=>typeof v==='string'&&v.trim())||'';
const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const roles=[
 {id:'anil',name:'ANIL',role:'central-orchestrator',authority:'final-operational-command',can:['coordinate','prioritize','route','approve_reversible_changes','stop_on_regression']},
 {id:'astra',name:'Astra',role:'chief-strategist',authority:'propose_and_sequence',can:['planning','tool_selection','architecture','growth']},
 {id:'claude',name:'Claude',role:'adversarial-reviewer',authority:'review_only',can:['risk_review','code_review','failure_analysis']},
 {id:'gemini',name:'Gemini',role:'research-verifier',authority:'verify_only',can:['research','cross_check','evidence_validation']},
 {id:'guard',name:'Immortal Guard',role:'security-and-opportunity-controller',authority:'safety_gate',can:['opportunity_scan','official_source_verification','risk_gate','owner_queue']},
 {id:'revenue',name:'Revenue Fleet',role:'revenue-execution-layer',authority:'bounded_execution',can:['lead_qualification','offer_packaging','delivery_tracking','retention']},
 {id:'qa',name:'QA Sentinel',role:'regression-and-live-test',authority:'block_on_failure',can:['health_checks','contract_checks','regression_checks','freshness_checks']},
 {id:'memory',name:'Memory & Learning Engine',role:'evidence-backed-learning',authority:'recommend_only',can:['outcome_tracking','pattern_detection','reversible_learning','no_secret_memory']},
 {id:'architect',name:'Systems Architect',role:'dependency-and-interface-design',authority:'propose_only',can:['dependency_mapping','contract_design','failure_isolation']},
 {id:'performance',name:'Performance Sentinel',role:'latency-and-resource-optimization',authority:'measure_then_recommend',can:['latency_budget','resource_budget','cache_review','load_risk']},
 {id:'incident',name:'Incident Commander',role:'fault-containment-and-recovery',authority:'stop_and_recover',can:['failure_classification','rollback_recommendation','degradation_mode']},
 {id:'product',name:'Product & UX Engine',role:'user-outcome-and-accessibility',authority:'recommend_only',can:['task_clarity','mobile_first','accessibility','conversion_friction']},
 {id:'research',name:'Market Research Engine',role:'source-backed-discovery',authority:'evidence_only',can:['source_quality','freshness_check','independent_cross_check']},
 {id:'data',name:'Data Integrity Auditor',role:'state-and-ledger-integrity',authority:'block_on_mismatch',can:['idempotency_review','ledger_reconciliation','settlement_proof']},
 {id:'redteam',name:'Red-Team Challenger',role:'adversarial-threat-modeling',authority:'block_on_critical_risk',can:['prompt_injection_review','auth_boundary_review','abuse_case_testing']},
 {id:'delivery',name:'Delivery & Release Manager',role:'release-readiness',authority:'release_gate_only',can:['change_scope','deployment_evidence','rollback_readiness']},
 {id:'cost',name:'Cost & Quota Optimizer',role:'provider-resilience-and-cost',authority:'recommend_only',can:['provider_fallback','quota_budget','timeout_budget','cost_visibility']},
 {id:'observability',name:'Observability Engine',role:'runtime-evidence-and-freshness',authority:'evidence_only',can:['health_evidence','staleness_detection','trace_correlation','claim_verification']}
];
const providerKey={astra:['OPENAI_API_KEY','OPENAI_KEY'],claude:['ANTHROPIC_API_KEY','ANTHROPIC_KEY'],gemini:['GEMINI_API_KEY','GOOGLE_GEMINI_API_KEY','GOOGLE_API_KEY']};
const modelKey={astra:['ASTRA_MODEL','ANIL_OPENAI_MODEL'],claude:['CLAUDE_MODEL','ANIL_ANTHROPIC_MODEL'],gemini:['GEMINI_MODEL','ANIL_GEMINI_MODEL']};
const extract=raw=>{try{return JSON.parse(raw)}catch{const m=String(raw||'').match(/\{[\s\S]*\}/);try{return m?JSON.parse(m[0]):null}catch{return null}}};
export const fallbackModels={
 astra:['gpt-6-astra','gpt-6.1-sol','gpt-6-luna','gpt-5.6-terra','gpt-5.6-luna'],
 claude:['claude-opus-5','claude-sonnet-5','claude-sonnet-4-6'],
 gemini:['gemini-3.8-flash','gemini-3.7-flash','gemini-3.6-flash']
};
async function brain(env,who,prompt){
 const key=firstEnv(env,providerKey[who]);
 const configured=firstEnv(env,modelKey[who]);
 const candidates=[...new Set([configured,...(fallbackModels[who]||[])].filter(Boolean))];
 if(!key)return {live:false,provider:who,model:configured||null,reason:'runtime_secret_missing'};
 let last={live:false,provider:who,model:candidates[0]||null,reason:'provider_unavailable'};
 let transientRetryUsed=false;
 for(let index=0;index<candidates.length;index++){
  const model=candidates[index];
  try{
   let r,d;
   if(who==='astra'){
    r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+key},body:JSON.stringify({model,instructions:'You are Astra, chief strategist inside ANIL X. Return JSON only with answer,command,priorities,tests,stopConditions. Ground claims only in supplied runtime evidence. ANIL is final orchestrator. Never claim execution without evidence.',input:prompt,reasoning:{effort:env.ASTRA_REASONING_EFFORT||'high'}}),signal:AbortSignal.timeout(12000)});
   }else if(who==='claude'){
    r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},body:JSON.stringify({model,max_tokens:700,system:'You are Claude, adversarial reviewer for ANIL X. Return JSON only with answer,risks,corrections,tests,blockers. Answer in the same language as the owner task.',messages:[{role:'user',content:prompt}]}),signal:AbortSignal.timeout(12000)});
   }else{
    r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent?key='+encodeURIComponent(key),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:'You are Gemini, evidence verifier for ANIL X. Return JSON only with answer,evidence,unknowns,tests,corrections. Answer in the same language as the owner task. '+prompt}]}],generationConfig:{responseMimeType:'application/json',temperature:0.2}}),signal:AbortSignal.timeout(12000)});
   }
   d=await r.json().catch(()=>({}));
   if(!r.ok){
    const detail=String(d?.error?.message||d?.error?.type||'').replace(/[\\r\\n\\t]/g,' ').slice(0,140);
    const invalidModel=[400,404,422].includes(r.status)&&/model|not found|does not exist|unsupported|not available/i.test(detail);
    last={live:false,provider:who,model,reason:who+'_'+r.status,...(detail?{detail}:{})};
    if(invalidModel&&index<candidates.length-1)continue;
    if([500,502,503,504].includes(r.status)&&!transientRetryUsed&&index<candidates.length-1){transientRetryUsed=true;continue;}
    return last;
   }
   const raw=who==='astra'?d?.output_text:who==='claude'?d?.content?.map(x=>x.text||'').join(''):d?.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('');
   const output=extract(raw);
   if(!output||typeof output!=='object')return {live:false,provider:who,model,reason:'provider_invalid_json'};
   return {live:true,provider:who,model,output};
  }catch(e){
   last={live:false,provider:who,model,reason:String(e?.name==='TimeoutError'?'provider_timeout':e?.message||e).slice(0,160)};
   const transient=e?.name==='TimeoutError'||/fetch failed|network|ECONNRESET|ECONNREFUSED|EAI_AGAIN|socket/i.test(String(e?.message||''));
   if(transient&&!transientRetryUsed&&index<candidates.length-1){transientRetryUsed=true;continue;}
   return last;
  }
 }
 return last;
}
export function synthesizeSpecialistAnswer(providers,language='en'){
 const rows=Object.entries(providers||{}).filter(([,v])=>v?.live&&v?.output&&typeof v.output==='object');
 if(!rows.length)return null;
 const parts=rows.map(([name,v])=>{
  const output=v.output;
  const answer=output.answer||output.response||output.summary;
  const detail=typeof answer==='string'?answer:JSON.stringify(output);
  return name.toUpperCase()+': '+String(detail||'Review completed; no concise answer field returned.').slice(0,1800);
 });
 const heading=language==='fa'?'جمع‌بندی آنیل از موتورهای تخصصی زنده (بدون ادعای اجرای عملیات):':'ANIL synthesis from live specialist engines (no execution claim):';
 return heading+'\\n\\n'+parts.join('\\n\\n');
}
function localCommand(state,guard,task){
 const blockers=[]; if(guard?.freshness?.stale)blockers.push('guard_state_stale'); if(!state.providers.astra.live)blockers.push('astra_runtime_not_ready');
 return {command:'DISCOVER -> VERIFY -> SCORE -> QUALIFY -> TEST -> SHIP -> MEASURE -> LEARN -> IMPROVE',priorities:['verify_live_state','protect_revenue_integrity','improve_highest_value_engine','run_regression_tests','only_then_ship_reversible_change'],tests:['health','execution-readiness','guard-freshness','revenue-contract','browser-smoke'],stopConditions:['regression','unverified_revenue','security_boundary_violation','missing_evidence'],blockers,task};
}
export async function handleSuperTeam(req,env,{guardHandler}={}){
 if(req.method!=='GET'&&req.method!=='POST')return json({ok:false,error:'method_not_allowed'},405);
 let body={};if(req.method==='POST')body=await req.json().catch(()=>({}));
 const task=String(body.task||'advance ANIL X toward verified revenue and quality').slice(0,2000);
 const keys=Object.fromEntries(Object.entries(providerKey).map(([k,v])=>[k,Boolean(firstEnv(env,v))]));
 const models=Object.fromEntries(Object.entries(modelKey).map(([k,v])=>[k,firstEnv(env,v)||null]));
 const state={providers:{astra:{live:false},claude:{live:false},gemini:{live:false}}}; let guard=null;
 if(typeof guardHandler==='function'){try{const r=await guardHandler(new Request(new URL('/api/guard/live',req.url),{method:'GET'}),env);guard=await r.json()}catch{}}
 const language=body.language==='fa'||/[\\u0600-\\u06FF]/.test(task)?'fa':'en';
 const prompt=JSON.stringify({task,language,guard,team:roles,principles:['ANIL has final command','specialists advise within role','agents may collaborate when dependency exists','irreversible money/security actions remain owner-gated','no fake execution','no fake revenue','every mutation requires test','model catalog presence is not runtime proof']});
 const [a,c,g]=await Promise.all([brain(env,'astra',prompt),brain(env,'claude',prompt),brain(env,'gemini',prompt)]);
 state.providers.astra=a;state.providers.claude=c;state.providers.gemini=g;
 const command=a.live&&a.output?.command?{...a.output,source:'astra'}:localCommand(state,guard,task);
 if(!command.answer&&!command.response){const synthesized=synthesizeSpecialistAnswer(state.providers,language);if(synthesized)command.answer=synthesized;}
 const evidence={guardFresh:guard?.freshness?.stale===false,guardAvailable:Boolean(guard?.ok),providerKeys:keys,configuredModels:models,liveProviders:[a,c,g].filter(x=>x.live).map(x=>x.provider)};
 const council=buildComplementaryCouncil({task,guard,providers:{astra:a,claude:c,gemini:g},command,evidence,roles});
 return json({ok:true,engine:'ANIL-SUPER-TEAM',version:'3.0.0-complementary-council',generatedAt:new Date().toISOString(),task,chain:council.chain,team:council.team,command:council.command,evidence,council:council.collaboration,qualityGates:council.qualityGates,guard:{freshness:guard?.freshness||null,snapshot:guard?.guard||null,radar:guard?.radar||null},safety:{finalCommand:'ANIL',irreversibleActions:'OWNER_APPROVAL',moneyMovement:'OWNER_APPROVAL',privateKeys:false,seedPhrases:false,autoSigning:false,captchaBypass:false,kycBypass:false},truth:{revenueCountsOnlyWhenSettled:true,providerConfigurationIsNotRuntimeProof:true,modelCatalogIsNotRuntimeProof:true,executionRequiresRuntimeEvidence:true,localFallbackIsNotEquivalentToFullLLM:true}});
}
