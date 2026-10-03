const BASE='https://raw.githubusercontent.com/saberbadri24-tech/immortal-guard/main/data/';
const API='https://api.github.com/repos/saberbadri24-tech/immortal-guard/contents/';
const FILES=['guard_status.json','opportunities.json','value_hunt.json','revenue_ledger.json','transfer_state.json','ai_reviews.json'];
const API_FILES=new Set(['guard_status.json','revenue_ledger.json','transfer_state.json','ai_reviews.json']);
let cache={at:0,data:null};
const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'public,max-age=60,stale-while-revalidate=300'}});
async function fromGithub(name){
  const r=await fetch(API+name+'?ref=main',{headers:{accept:'application/vnd.github+json','user-agent':'ANIL-X-Guard-Live'}});
  if(!r.ok)throw Error('github_'+r.status);
  const d=await r.json();if(!d?.content)throw Error('github_no_content');
  return JSON.parse(Buffer.from(String(d.content).replace(/\\s/g,''),'base64').toString('utf8'));
}
async function fetchJson(name){
  if(API_FILES.has(name)){
    try{return {data:await fromGithub(name),source:'github-api'}}catch(apiError){return {data:{error:String(apiError.message||apiError),source:'error'},source:'error'}}
  }
  try{const r=await fetch(BASE+name,{headers:{accept:'application/json'}});if(!r.ok)throw Error('raw_'+r.status);return {data:await r.json(),source:'raw'}}
  catch(e){return {data:{error:String(e.message||e),source:'error'},source:'error'}}
}
export async function handleGuardLive(){
  const now=Date.now();
  if(cache.data&&now-cache.at<60000)return json(cache.data);
  const entries=await Promise.all(FILES.map(async f=>[f,await fetchJson(f)]));
  const data=Object.fromEntries(entries.map(([f,x])=>[f,x.data]));
  const status=data.guard_status?.error?null:data.guard_status;
  const ledger=data.revenue_ledger?.error?null:data.revenue_ledger;
  const transfer=data.transfer_state?.error?null:data.transfer_state;
  const opportunities=data.opportunities?.error?null:data.opportunities;
  const value=data.value_hunt?.error?null:data.value_hunt;
  const ai=data.ai_reviews?.error?null:data.ai_reviews;
  const out={ok:true,source:'immortal-guard/main',updatedAt:status?.updatedAt||ledger?.updatedAt||null,
    guard:status,
    opportunities:{count:Array.isArray(opportunities?.items)?opportunities.items.length:Number(status?.counts?.opportunities||0),data:opportunities},
    valueHunter:value,
    revenue:ledger,
    transfer:{status:transfer?.status||'UNKNOWN',temporaryConfigured:transfer?.temporaryAddress!=null,permanentConfigured:transfer?.permanentAddress!=null},
    ai:{live:Boolean(ai?.live),configured:Boolean(ai?.configured),successfulCalls:Number(ai?.successfulCalls||0),missingProviders:ai?.missingProviders||[]},
    sources:Object.fromEntries(entries.map(([f,x])=>[f,x.source])),
    safety:{autoClaim:false,autoSigning:false,autoTransfer:false,secretStorage:false,bypassControls:false}};
  cache={at:now,data:out};
  return json(out);
}
