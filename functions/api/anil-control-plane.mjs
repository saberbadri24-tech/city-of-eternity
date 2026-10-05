const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const has=v=>typeof v==='string'&&v.trim().length>0;
const ton=a=>/^(?:EQ|UQ)[A-Za-z0-9_-]{46}$/.test(String(a||''));
const first=(e,ks)=>ks.map(k=>e?.[k]).find(has)||'';

const CAPABILITIES=[
 'observe','reason','plan','inspect','search','edit_files','create_files','validate',
 'commit','ci','deploy','health','logs','rollback','guard','radar','opportunity_analysis',
 'payment_monitoring','wallet_monitoring','audit','evidence_ledger','regression_stop',
 'owner_approval','dry_run','idempotency','retry','timeout_control','failure_recovery',
 'change_impact_analysis','post_change_qa','truth_reporting'
];

const OPERATIONS=[
 'read_live_state','inspect_github','search_code','read_file','change_files','create_files',
 'change_plan','impact_analysis','commit','test','deploy','read_render_logs','health_check',
 'inspect_guard','inspect_payment','inspect_wallet','rollback','post_change_qa',
 'stop_on_regression','write_audit_event','build_evidence_ledger','request_owner_approval'
];

const SAFETY={
 sensitiveActionsOwnerApproval:true,
 noPrivateKeys:true,noSeedPhrases:true,noAutoSigning:true,
 noUnapprovedFundTransfer:true,noFakeExecution:true,noFakeRevenue:true,
 failClosedOnUnknownAction:true,rollbackOnRegression:true
};

function adapter(configured,mode,extra={}){return {configured,mode,...extra};}

export async function handleControlPlane(req,env){
 if(req.method!=='GET'&&req.method!=='POST')return json({ok:false,error:'method_not_allowed'},405);

 const renderKey=first(env,['RENDER_API_KEY','RENDER_TOKEN']);
 const githubKey=first(env,['GITHUB_TOKEN','GH_TOKEN']);
 const wallet=first(env,['TON_MAIN_WALLET','TON_MAIN_WALLET_ADDRESS','TON_PERMANENT_WALLET_ADDRESS','TON_MAIN_ADDRESS','TON_WALLET_ADDRESS']);
 const payment=first(env,['VARIZA_API_KEY','VARIA_API_KEY','VARIZA_TOKEN','VARIZA_KEY','VARIZA_API_TOKEN','VARIZA_SECRET']);

 const adapters={
  liveState:adapter(true,'runtime'),
  github:adapter(has(githubKey),has(githubKey)?'direct-api':'github-actions-controlled'),
  render:adapter(has(renderKey),has(renderKey)?'direct-api':'render-health-via-runtime'),
  fileChanges:adapter(true,'owner-approved-queue + GitHub Actions'),
  commit:adapter(true,'GitHub Actions controlled workflow'),
  test:adapter(true,'syntax + contract + browser QA'),
  deploy:adapter(true,'main -> Render auto-deploy'),
  logs:adapter(has(renderKey),has(renderKey)?'Render API':'health/deploy evidence'),
  health:adapter(true,'runtime + CI'),
  guard:adapter(true,'GitHub radar + watchdog'),
  payment:adapter(has(payment),'Variza'),
  wallet:adapter(ton(wallet),'TON public-address monitoring'),
  rollback:adapter(true,'known-good Git/Render rollback'),
  qaStop:adapter(true,'final gate + regression stop'),
  audit:adapter(true,'immutable-by-commit evidence trail'),
  recovery:adapter(true,'retry + fail-closed + rollback'),
  planner:adapter(true,'intent -> dependency graph -> execution plan')
 };

 const result={
  ok:true,
  engine:'ANIL-CONTROL-PLANE',
  version:'2.0.0',
  mode:'owner-gated-operational-agent',
  identity:'ANIL OWNER OPERATING SYSTEM',
  chain:['ANIL','Astra','Claude','Gemini','Immortal Guard','Revenue Fleet','QA Sentinel'],
  capabilities:CAPABILITIES,
  adapters,
  operations:OPERATIONS,
  executionModel:[
   'understand_request',
   'inspect_current_state',
   'build_plan_and_dependencies',
   'calculate_change_impact',
   'request_approval_when_sensitive',
   'execute_smallest_safe_change',
   'validate_locally',
   'commit_with_evidence',
   'deploy',
   'verify_live',
   'run_post_change_qa',
   'rollback_on_regression',
   'write_complete_audit'
  ],
  intelligence:{
   adaptivePlanning:true,
   multiAgentCrossCheck:true,
   evidenceFirst:true,
   contradictionDetection:true,
   uncertaintyReporting:true,
   noClaimWithoutEvidence:true,
   contextAwareToolSelection:true
  },
  reliability:{
   idempotentOperations:true,
   retryTransientFailures:true,
   boundedRetries:true,
   timeoutAware:true,
   checkpointBeforeMutation:true,
   knownGoodRollback:true,
   regressionGate:true,
   staleStateDetection:true
  },
  audit:{
   recordsRequest:true,
   recordsFiles:true,
   recordsCommits:true,
   recordsWorkflows:true,
   recordsDeploys:true,
   recordsTests:true,
   recordsHealth:true,
   recordsGuard:true,
   recordsPaymentAndWalletEvidence:true,
   recordsFailuresAndRollbacks:true,
   humanReadableFinalReport:true
  },
  policy:SAFETY,
  truth:{
   directGitHub:has(githubKey),
   directRender:has(renderKey),
   walletAddressConfigured:ton(wallet),
   paymentProviderConfigured:has(payment),
   modelApisAreNotAssumedLive:true
  }
 };
 return json(result);
}