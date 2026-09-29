const BASE='https://raw.githubusercontent.com/saberbadri24-tech/immortal-guard/main/data/';
const FILES=['guard_status.json','opportunities.json','value_hunt.json','revenue_ledger.json','transfer_state.json','ai_reviews.json'];
let cache={at:0,data:null};
const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'public,max-age=60,stale-while-revalidate=300'}});
export async function handleGuardLive(){
  const now=Date.now();
  if(cache.data&&now-cache.at<60000)return json(cache.data);
  const entries=await Promise.all(FILES.map(async f=>{
    try{const r=await fetch(BASE+f,{headers:{accept:'application/json'}});if(!r.ok)throw Error('HTTP '+r.status);return [f,await r.json()]}catch(e){return [f,{error:String(e.message||e)}]}
  }));
  const data=Object.fromEntries(entries);
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
    safety:{autoClaim:false,autoSigning:false,autoTransfer:false,secretStorage:false,bypassControls:false}};
  cache={at:now,data:out};
  return json(out);
}
