const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const roles=[
 {id:'anil',name:'ANIL',role:'central-orchestrator',authority:'final-operational-command',can:['coordinate','prioritize','route','approve_reversible_changes','stop_on_regression']},
 {id:'reasoning',name:'Core Reasoning Engine',role:'problem-decomposition-and-planning',authority:'plan_and_route',can:['problem_decomposition','planning','architecture','decision_support']},
 {id:'review',name:'Independent Review Engine',role:'adversarial-quality-review',authority:'review_only',can:['risk_review','code_review','failure_analysis']},
 {id:'verify',name:'Evidence Verification Engine',role:'research-and-evidence-verifier',authority:'verify_only',can:['research','cross_check','evidence_validation']},
 {id:'guard',name:'Immortal Guard',role:'security-and-opportunity-controller',authority:'safety_gate',can:['opportunity_scan','official_source_verification','risk_gate','owner_queue']},
 {id:'revenue',name:'Revenue Fleet',role:'revenue-execution-layer',authority:'bounded_execution',can:['lead_qualification','offer_packaging','delivery_tracking','retention']},
 {id:'qa',name:'QA Sentinel',role:'regression-and-live-test',authority:'block_on_failure',can:['health_checks','contract_checks','regression_checks','freshness_checks']}
];
function localCommand(guard,task){
 const blockers=[];
 if(guard?.freshness?.stale)blockers.push('guard_state_stale');
 if(!guard?.ok)blockers.push('guard_runtime_evidence_unavailable');
 return {command:'DISCOVER -> VERIFY -> SCORE -> QUALIFY -> TEST -> SHIP -> MEASURE -> LEARN -> IMPROVE',priorities:['verify_live_state','protect_revenue_integrity','improve_highest_value_engine','run_regression_tests','only_then_ship_reversible_change'],tests:['health','execution-readiness','guard-freshness','revenue-contract','browser-smoke'],stopConditions:['regression','unverified_revenue','security_boundary_violation','missing_evidence'],blockers,task,source:'first-party-independent-engines'};
}
export async function handleSuperTeam(req,env,{guardHandler}={}){
 if(req.method!=='GET'&&req.method!=='POST')return json({ok:false,error:'method_not_allowed'},405);
 let body={};if(req.method==='POST')body=await req.json().catch(()=>({}));
 const task=String(body.task||'advance ANIL X toward verified revenue and quality').slice(0,2000);
 let guard=null;
 if(typeof guardHandler==='function'){try{const r=await guardHandler(new Request(new URL('/api/guard/live',req.url),{method:'GET'}),env);guard=await r.json()}catch{}}
 const command=localCommand(guard,task);
 const evidence={engineChainActive:true,providerIndependent:true,guardFresh:guard?.freshness?.stale===false,guardAvailable:Boolean(guard?.ok),externalModelCalls:0};
 return json({ok:true,engine:'ANIL-SUPER-TEAM',version:'3.0.0-independent-engines',generatedAt:new Date().toISOString(),task,chain:['ANIL','Core Reasoning Engine','Independent Review Engine','Evidence Verification Engine','Immortal Guard','Revenue Fleet','QA Sentinel'],team:roles,command,evidence,guard:{freshness:guard?.freshness||null,snapshot:guard?.guard||null,radar:guard?.radar||null},safety:{finalCommand:'ANIL',irreversibleActions:'OWNER_APPROVAL',moneyMovement:'OWNER_APPROVAL',privateKeys:false,seedPhrases:false,autoSigning:false,captchaBypass:false,kycBypass:false},truth:{revenueCountsOnlyWhenSettled:true,executionRequiresRuntimeEvidence:true,modelCatalogIsNotRuntimeProof:true}});
}
