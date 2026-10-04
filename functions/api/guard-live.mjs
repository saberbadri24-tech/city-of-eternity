const LOCAL={
 status:'guard-status.json',
 opportunities:'guard-opportunities.json',
 value:'guard-high-value.json',
 ledger:'guard-evidence-ledger.json',
 transfer:'guard-approvals.json',
 receipts:'guard-receipts.json',
 ai:'guard-capabilities.json',
 radar:'guard-super-radar.json',
 sourceHealth:'guard-source-health.json'
};
const REMOTE='https://raw.githubusercontent.com/saberbadri24-tech/city-of-eternity/main/';
let cache={at:0,data:null};
const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-anilx-guard-cache':'server-60s'}});
async function readLocal(env,name,req){
  if(!env?.ASSETS?.fetch)return null;
  try{
    const u=new URL('/'+name,req.url);
    const r=await env.ASSETS.fetch(new Request(u,{headers:{accept:'application/json'}}));
    if(!r.ok)return null;
    return await r.json();
  }catch{return null}
}
async function readRemote(name){
  try{
    const r=await fetch(REMOTE+name+'?v='+Math.floor(Date.now()/60000),{headers:{accept:'application/json','cache-control':'no-cache'}});
    if(!r.ok)return null;
    return await r.json();
  }catch{return null}
}
async function readCatchQueue(env){
  if(!env?.PAYMENTS)return [];
  try{const q=await env.PAYMENTS.list({prefix:'guard/catch/'});const keys=(q?.keys||[]).slice(-100);return (await Promise.all(keys.map(k=>env.PAYMENTS.get(k.name,'json').catch(()=>null)))).filter(Boolean)}catch{return []}
}
async function read(env,key,req){
  const local=await readLocal(env,LOCAL[key],req);
  return {data:local,source:local?'anilx-local':'unavailable'};
}
function outdatedMinutes(value,now){const t=Date.parse(String(value||''));return Number.isFinite(t)?Math.max(0,Math.round((now-t)/60000)):null}
export async function handleGuardLive(req,env){
  const now=Date.now();
  if(cache.data&&now-cache.at<60000)return json(cache.data);
  const keys=Object.keys(LOCAL);
  const entries=await Promise.all(keys.map(async key=>[key,await read(env,key,req)]));
  const data=Object.fromEntries(entries);
  const status=data.status.data||{};
  const opportunities=data.opportunities.data||{};
  const value=data.value.data||{};
  const ledger=data.ledger.data||{};
  const transfer=data.transfer.data||{};
  const receipts=data.receipts.data||{};
  const ai=data.ai.data||{};
  const radar=data.radar.data||{};
  const sourceHealth=data.sourceHealth.data||{};
  // Public live radar must never wait on the owner catch queue/storage. The admin panel reads that queue directly.
  const ageMinutes=outdatedMinutes(status.updatedAt||status.lastScan||opportunities.updatedAt||null,now);
  const oppItems=Array.isArray(opportunities.items)?opportunities.items:Array.isArray(opportunities.opportunities)?opportunities.opportunities:[];
  const highItems=Array.isArray(value.items)?value.items:Array.isArray(value.opportunities)?value.opportunities:[];
  const receiptItems=Array.isArray(receipts.items)?receipts.items:[];
  const approvalItems=Array.isArray(transfer.approvals)?transfer.approvals:Array.isArray(transfer.items)?transfer.items:[];
  const compact=(x)=>({id:x?.id||x?.opportunityId||null,title:String(x?.title||x?.name||'فرصت').slice(0,100),source:String(x?.source||x?.resolvedDomain||'').slice(0,80),status:String(x?.status||x?.verification||'').slice(0,40),value:Number(x?.value||x?.rewardUsd||x?.estimatedValueUsd||0)||0});
  const temporaryConfigured=String(status.temporaryWallet||'').toLowerCase()==='configured';
  const permanentConfigured=Boolean(status.permanentWallet||status.permanentAddress);
  const out={
    ok:true,source:'ANIL-X-local-guard-state',
    updatedAt:status.updatedAt||status.lastScan||opportunities.updatedAt||null,
    freshness:{minutesSinceUpdate:ageMinutes,stale:ageMinutes===null||ageMinutes>15,requiredMaxMinutes:15},
    guard:{
      status:String(status.status||status.mode||'NORMAL').slice(0,40),
      discoveryCount:Number(status.discoveryCount||status.counts?.opportunities||oppItems.length||0),
      sourcesScanned:Number(status.sourcesScanned||0),
      sourcesReachable:Number(status.sourcesReachable||0),
      waitingOwner:Number(status.waitingOwner||0),
      highValueCandidates:Number(status.highValueCandidates||status.counts?.incomePriority||highItems.length||0)
    },
    opportunities:{count:Number(status.discoveryCount||status.counts?.opportunities||oppItems.length||0),items:oppItems.slice(0,5).map(compact)},
    valueHunter:{count:Number(status.highValueCandidates||status.counts?.incomePriority||highItems.length||0),items:highItems.slice(0,5).map(compact)},
    revenue:{confirmedIncome:Number(ledger.confirmedIncome||ledger.totalReceived||0),status:String(ledger.status||'UNCONFIRMED').slice(0,30)},
    transfer:{status:String(transfer.status||'OWNER_APPROVAL_REQUIRED').slice(0,40),temporaryConfigured,temporaryWalletUsed:false,catchQueueConfigured:Boolean(env?.PAYMENTS),catchQueuePending:0,permanentConfigured,pendingApprovals:Number(status.waitingOwner||0)},
    ai:{
      live:Boolean(ai.live||ai.healthy||ai.overall==='healthy'),
      configured:Boolean(ai.configured||ai.providers||Object.values(ai.providerAvailability||{}).some(Boolean)),
      successfulCalls:Number(ai.successfulCalls||0),
      providers:ai.providerAvailability||{},
    },
    radar:{
      candidates:Number(radar?.summary?.totalCandidates||0),
      officialCandidates:Number(radar?.summary?.officialCandidates||0),
      actionableOfficial:Number(radar?.summary?.actionableOfficial||0),
      highPriority:Number(radar?.summary?.highPriority||0),
      generatedAt:radar.generatedAt||null
    },
    sourceHealth:sourceHealth.summary||sourceHealth.counts||{},
    sources:Object.fromEntries(entries.map(([key,x])=>[key,x.source])),
    safety:{autoClaim:false,autoSigning:false,autoTransfer:false,secretStorage:false,bypassControls:false,ownerApprovalRequired:true}
  };
  cache={at:now,data:out};
  return json(out);
}
