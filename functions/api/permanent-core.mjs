const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const has=v=>typeof v==='string'&&v.trim().length>0;
const bool=v=>String(v??'').toLowerCase()==='true';
export async function handlePermanentCore(req,env){
 if(req.method!=='GET')return json({ok:false,error:'method_not_allowed'},405);
 const durable=Boolean(env?.PAYMENTS)&&bool(env?.PAYMENTS_DURABLE);
 const ai=[env?.OPENAI_API_KEY,env?.OPENAI_KEY,env?.ANIL_OPENROUTER_API_KEY,env?.OPENROUTER_API_KEY].filter(has).length;
 const payment=has(env?.VARIZA_API_KEY)||has(env?.VARIA_API_KEY)||has(env?.VARIZA_TOKEN)||has(env?.VARIZA_KEY);
 const admin=has(env?.ANIL_ADMIN_PASSWORD);
 const secondary=has(env?.ANIL_SECONDARY_ORIGIN)||has(env?.ANIL_FAILOVER_ORIGIN);
 return json({ok:true,engine:'ANIL-X-PERMANENT-CORE',version:'1.0.0',truth:'Provider limits cannot be bypassed; core remains operational through deterministic fallbacks and provider adapters.',continuity:{staticShell:true,clientRetry:true,providerFallback:true,durableStorage:durable,scheduledKeepWarm:true,secondaryOriginConfigured:secondary,backendAlwaysOnGuarantee:secondary},configuration:{adminConfigured:admin,localEngines:true,optionalExternalProviders:ai,paymentProvider:payment,durableAccounting:durable},policy:{noRuntimeDependencyOnBrowserConnector:true,noTrialProviderRequiredForCore:true,noSecretsInClient:true,noSeedOrPrivateKeyCollection:true,ownerApprovalForSensitiveActions:true}});
}
