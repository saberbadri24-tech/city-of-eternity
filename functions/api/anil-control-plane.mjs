const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const has=v=>typeof v==='string'&&v.trim().length>0;
const ton=a=>/^(?:EQ|UQ)[A-Za-z0-9_-]{46}$/.test(String(a||''));
const first=(e,ks)=>ks.map(k=>e?.[k]).find(has)||'';
export async function handleControlPlane(req,env){
 if(req.method!=='GET'&&req.method!=='POST')return json({ok:false,error:'method_not_allowed'},405);
 const renderKey=first(env,['RENDER_API_KEY','RENDER_TOKEN']),githubKey=first(env,['GITHUB_TOKEN','GH_TOKEN']);
 const wallet=first(env,['TON_MAIN_WALLET','TON_MAIN_WALLET_ADDRESS','TON_PERMANENT_WALLET_ADDRESS','TON_MAIN_ADDRESS','TON_WALLET_ADDRESS']);
 const payment=first(env,['VARIZA_API_KEY','VARIA_API_KEY','VARIZA_TOKEN','VARIZA_KEY']);
 const adapters={
  liveState:{configured:true,mode:'runtime'},
  github:{configured:has(githubKey),mode:has(githubKey)?'direct-api':'github-actions-controlled'},
  render:{configured:has(renderKey),mode:has(renderKey)?'direct-api':'render-health-via-runtime'},
  fileChanges:{configured:true,mode:'owner-approved-queue + GitHub Actions'},
  commit:{configured:true,mode:'GitHub Actions controlled workflow'},
  test:{configured:true,mode:'CI Playwright + contract + syntax'},
  deploy:{configured:true,mode:'Render auto-deploy from main'},
  logs:{configured:has(renderKey),mode:has(renderKey)?'Render API':'health/deploy evidence'},
  health:{configured:true,mode:'runtime + CI'},
  guard:{configured:true,mode:'GitHub radar + watchdog'},
  payment:{configured:has(payment),mode:'Variza'},
  wallet:{configured:ton(wallet),mode:'TON public-address monitoring'},
  rollback:{configured:true,mode:'known-good Git/Render rollback'},
  qaStop:{configured:true,mode:'final gate + regression stop'}
 };
 return json({ok:true,engine:'ANIL-CONTROL-PLANE',version:'1.0.0',mode:'owner-gated-operational-control',chain:['ANIL','Astra','Claude','Gemini','Immortal Guard','Revenue Fleet','QA Sentinel'],adapters,operations:['read_live_state','inspect_github','change_files','commit','test','deploy','read_render_logs','health_check','inspect_guard','inspect_payment','inspect_wallet','rollback','post_change_qa','stop_on_regression'],policy:{sensitiveActionsOwnerApproval:true,noPrivateKeys:true,noSeedPhrases:true,noAutoSigning:true,noUnapprovedFundTransfer:true,noFakeExecution:true,noFakeRevenue:true},truth:{directGitHub:has(githubKey),directRender:has(renderKey),walletAddressConfigured:ton(wallet),paymentProviderConfigured:has(payment)}});
}