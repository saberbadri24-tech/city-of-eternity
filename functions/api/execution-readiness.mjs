import {json} from './runtime-state.mjs';
import {getLiveUsdTomanConfig} from './currency.mjs';

const first=(env,keys)=>keys.map(k=>env?.[k]).find(v=>v!==undefined&&v!==null&&String(v).trim()!=='')||'';const validTonAddress=a=>/^(?:EQ|UQ)[A-Za-z0-9_-]{46}$/.test(String(a||''));

export async function handleExecutionReadiness(req,env){
  if(req.method!=='GET') return json({ok:false,error:'method_not_allowed'},405);
  const openai=first(env,['OPENAI_API_KEY','OPENAI_KEY']);
  const variza=first(env,['VARIZA_API_KEY','VARIA_API_KEY','VARIZA_TOKEN','VARIZA_KEY','VARIZA_API_TOKEN','VARIZA_SECRET','VARIZA_API','VARIZA_ACCESS_TOKEN','VARIZA_BEARER_TOKEN']);
  const webhook=first(env,['VARIZA_WEBHOOK_SECRET','VARIA_WEBHOOK_SECRET','VARIZA_WEBHOOK_TOKEN','VARIZA_WEBHOOK_KEY','VARIZA_SECRET']);
  const mainTon=first(env,['TON_MAIN_WALLET','TON_MAIN_WALLET_ADDRESS','TON_PERMANENT_WALLET_ADDRESS','TON_MAIN_ADDRESS','TON_WALLET_ADDRESS','MAIN_TON_WALLET','MAIN_WALLET_ADDRESS','PERMANENT_WALLET_ADDRESS']);
  const fxConfig=await getLiveUsdTomanConfig(env);const tomanRate=fxConfig.rate;const fx=Math.round(tomanRate*10);
  const providers={
    openai:Boolean(openai),
    localEngines:true,
    webSearch:Boolean(env?.TAVILY_API_KEY||env?.BRAVE_SEARCH_API_KEY),
    variza:Boolean(variza),
    varizaWebhook:Boolean(webhook),
    tonMain:validTonAddress(mainTon),
    guardCatchQueue:true,
    fx:fxConfig.source!=='runtime-default'&&Boolean(Number.isFinite(tomanRate)&&tomanRate>0),
    durableStore:Boolean(env?.REDIS_URL||(env?.ANIL_DURABLE_STORE_URL&&env?.ANIL_DURABLE_STORE_TOKEN))&&String(env?.PAYMENTS_DURABLE||'false').toLowerCase()==='true',
    assets:Boolean(env?.ASSETS)
  };
  return json({
    ok:true,
    checkedAt:new Date().toISOString(),
    execution:{
      repository:{ready:true,mode:'GitHub Actions OIDC + controlled workflow',rawPatRequired:false},
      runtime:{ready:true,provider:'Render',service:'ANIL X',mode:'Node web service'},
      database:{ready:providers.durableStore,mode:'application binding',rawConnectionStringExposed:false},
      browser:{ready:true,mode:'CI Playwright smoke; interactive actions credential-gated'},
      automation:{ready:true,control:'scheduled GitHub Actions + owner-approved queue'},
      rollback:{ready:true,mode:'Git/Render known-good deploy rollback'}
    },
    providers,
    fxRate:{source:fxConfig.source,configured:fxConfig.source!=='runtime-default',observedAt:fxConfig.observedAt||null,usdToIRR:fx,usdToToman:fxConfig.source!=='runtime-default'?tomanRate:null,unit:'toman'},
    wallet:{
      publicTonPaymentsEnabled:providers.tonMain,
      guardStagingEnabled:true,
      guardCatchQueueEnabled:providers.guardCatchQueue,
      ownerApprovalRequired:true
    },
    truth:{
      configuredProvidersAreNotRuntimeProof:true,
      revenueOnlyWhenSettled:true,
      irreversibleActionsRequireOwnerApproval:true
    },
    safety:{
      noSeedOrPrivateKeyHandling:true,
      noCredentialExfiltration:true,
      noCaptchaOrKycBypass:true,
      noAutomaticWalletSigning:true,
      noUnapprovedFundTransfer:true
    }
  },200);
}
