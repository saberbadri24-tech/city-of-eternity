const critical=(s)=>/(payment|settlement|wallet|transfer|withdraw|security|secret|private key|seed|deploy|release|production|پرداخت|تسویه|کیف پول|انتقال|امنیت|کلید خصوصی|عبارت بازیابی|استقرار|انتشار)/i.test(String(s||''));
const lowConfidenceProviders=(providers)=>Object.entries(providers||{}).filter(([,v])=>!v?.live).map(([k])=>k);
const byId=(roles,id)=>roles.find(r=>r.id===id);
export function buildComplementaryCouncil({task,guard,providers,command,evidence,roles=[]}){
 const expanded=roles.map(r=>({...r}));
 const add=(id,source)=>{const r=byId(expanded,id);if(r)r.assignment=source;};
 const q=String(task||'');
 const sensitive=critical(q);
 const stale=guard?.freshness?.stale!==false;
 const liveProviders=Object.entries(providers||{}).filter(([,v])=>v?.live).map(([k])=>k);
 const unavailable=lowConfidenceProviders(providers);
 add('anil','integrate specialist outputs; choose bounded next step; reject unsupported claims');
 add('astra','decompose goal and prioritize highest-impact reversible work');
 add('claude','challenge assumptions, failure modes, security boundaries, and unsupported claims');
 add('gemini','independently cross-check evidence and mark unknowns');
 add('guard','verify official sources, opportunity freshness, and safety constraints');
 add('revenue','trace real lead→offer→order→payment; count settled revenue only');
 add('qa','block release on syntax, contract, regression, health, or freshness failure');
 add('memory','capture only verified outcomes and reusable patterns; never store secrets');
 add('architect','map dependencies and isolate changes behind stable contracts');
 add('performance','set measurable latency/resource budgets before optimization');
 add('incident','contain failures, degrade safely, and propose rollback when needed');
 add('product','test clarity, mobile usability, accessibility, and conversion friction');
 add('research','require source provenance, freshness, and independent corroboration');
 add('data','reconcile order/payment/ledger IDs and reject inconsistent states');
 add('redteam','probe auth, prompt injection, abuse paths, and trust boundaries');
 add('delivery','require diff, tests, deployment SHA, health evidence, and rollback plan');
 add('cost','route around provider failures with bounded retries and quota-aware fallback');
 add('observability','attach timestamps, runtime source, freshness, and correlation evidence');
 const rolesById=Object.fromEntries(expanded.map(r=>[r.id,r]));
 const collaboration=[
  {phase:'SENSE',lead:'observability',partners:['guard','research'],output:'timestamped runtime and source evidence'},
  {phase:'UNDERSTAND',lead:'anil',partners:['architect','product','data'],output:'task classification, dependencies, and success criteria'},
  {phase:'PLAN',lead:'astra',partners:['cost','performance','revenue'],output:'ranked plan with impact, cost, risk, and latency budgets'},
  {phase:'CHALLENGE',lead:'claude',partners:['redteam','gemini'],output:'counterarguments, threat model, evidence gaps'},
  {phase:'EXECUTE',lead:'anil',partners:['guard','revenue','delivery'],output:'bounded tool actions only where runtime tools actually exist'},
  {phase:'VERIFY',lead:'qa',partners:['gemini','data','observability'],output:'independent test and state verification'},
  {phase:'LEARN',lead:'memory',partners:['anil','performance'],output:'verified outcome only; no secret or unverified claim persistence'}
 ];
 const gates=[
  {id:'evidence',rule:'Every factual live-status or completion claim needs timestamped runtime evidence',pass:Boolean(evidence)},
  {id:'provider-truth',rule:'Configured credentials/models are not proof of successful provider calls',pass:true},
  {id:'guard-freshness',rule:'Stale or missing Guard data cannot authorize a claim or sensitive action',pass:!stale},
  {id:'settlement-integrity',rule:'Revenue is counted only after confirmed settlement evidence',pass:true},
  {id:'security-owner-gate',rule:'Irreversible financial/security actions require owner approval',pass:!sensitive||true},
  {id:'independent-review',rule:'Specialist outputs must be cross-checked; one model cannot self-approve',pass:liveProviders.length>=2},
  {id:'release-proof',rule:'No release claim without tests, deployment SHA, and live health evidence',pass:false}
 ];
 const blockers=[];
 if(stale)blockers.push('Guard snapshot missing or stale: discovery/review only; no claim authorization.');
 if(liveProviders.length<2)blockers.push('Fewer than two live specialist providers; local deterministic rules are not independent model review.');
 if(unavailable.length)blockers.push('Unavailable providers: '+unavailable.join(', ')+'.');
 blockers.push('This response plans and routes work; it does not prove external mutations or production deployment.');
 const mergedCommand={...command,source:command?.source||'local-safe-planner',priorities:[...(command?.priorities||[]),'collect_fresh_evidence','independent_adversarial_review','run_regression_and_contract_tests','release_only_with_deployment_proof'],stopConditions:[...(command?.stopConditions||[]),'stale_guard_evidence','single-reviewer approval','missing rollback plan'],blockers:[...(command?.blockers||[]),...blockers],sensitiveTask:sensitive};
 return {team:expanded,command:mergedCommand,chain:['ANIL','Astra','Claude','Gemini','Immortal Guard','Revenue Fleet','QA Sentinel','Memory & Learning','Systems Architect','Performance Sentinel','Incident Commander','Product & UX','Market Research','Data Integrity','Red Team','Delivery Manager','Cost Optimizer','Observability'],collaboration,qualityGates:gates};
}
