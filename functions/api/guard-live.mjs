const LOCAL={
 status:'guard-status.json',
 opportunities:'guard-opportunities.json',
 value:'guard-high-value.json',
 ledger:'guard-evidence-ledger.json',
 transfer:'guard-approvals.json',
 receipts:'guard-receipts.json',
 ai:'guard-capabilities.json'
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
async function read(env,key,req){
  const local=await readLocal(env,LOCAL[key],req);
  if(local)return {data:local,source:'anilx-local'};
  const remote=await readRemote(LOCAL[key]);
  return {data:remote,source:remote?'anilx-github':'unavailable'};
}
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
  const oppItems=Array.isArray(opportunities.items)?opportunities.items:Array.isArray(opportunities.opportunities)?opportunities.opportunities:[];
  const highItems=Array.isArray(value.items)?value.items:Array.isArray(value.opportunities)?value.opportunities:[];
  const receiptItems=Array.isArray(receipts.items)?receipts.items:[];
  const approvalItems=Array.isArray(transfer.approvals)?transfer.approvals:Array.isArray(transfer.items)?transfer.items:[];
  const out={
    ok:true,source:'ANIL-X-local-guard-state',
    updatedAt:status.updatedAt||status.lastScan||opportunities.updatedAt||null,
    guard:status,
    opportunities:{count:Number(status.discoveryCount||status.counts?.opportunities||oppItems.length||0),items:oppItems.slice(0,12),source:data.opportunities.source},
    valueHunter:{count:Number(status.highValueCandidates||status.counts?.incomePriority||highItems.length||0),items:highItems.slice(0,12),source:data.value.source},
    revenue:{ledger,confirmedIncome:Number(ledger.confirmedIncome||ledger.totalReceived||0),source:data.ledger.source},
    transfer:{status:transfer.status||'OWNER_APPROVAL_REQUIRED',temporaryConfigured:Boolean(status.temporaryWallet==='configured'),permanentConfigured:Boolean(status.permanentWallet||status.permanentAddress),pendingApprovals:approvalItems.length,receipts:receiptItems.slice(0,12)},
    ai:{live:Boolean(ai.live||ai.healthy||ai.overall==='healthy'),configured:Boolean(ai.configured||ai.providers),successfulCalls:Number(ai.successfulCalls||0),missingProviders:ai.missingProviders||[]},
    safety:{autoClaim:false,autoSigning:false,autoTransfer:false,secretStorage:false,bypassControls:false,ownerApprovalRequired:true}
  };
  cache={at:now,data:out};
  return json(out);
}