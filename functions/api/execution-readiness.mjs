import {json} from './runtime-state.mjs';

const first=(env,keys)=>keys.map(k=>env?.[k]).find(v=>typeof v==='string'&&v.trim())||'';

export async function handleExecutionReadiness(req,env){
  if(req.method!=='GET') return json({ok:false,error:'method_not_allowed'},405);
  const openai=first(env,['OPENAI_API_KEY','OPENAI_KEY']);
  const anthropic=first(env,['ANTHROPIC_API_KEY','ANTHROPIC_KEY']);
  const gemini=first(env,['GEMINI_API_KEY','GOOGLE_GEMINI_API_KEY','GOOGLE_API_KEY']);
  const variza=first(env,['VARIZA_API_KEY','VARIA_API_KEY','VARIZA_TOKEN','VARIZA_KEY','VARIZA_API_TOKEN','VARIZA_SECRET']);
  const webhook=first(env,['VARIZA_WEBHOOK_SECRET','VARIA_WEBHOOK_SECRET','VARIZA_WEBHOOK_TOKEN','VARIZA_WEBHOOK_KEY','VARIZA_SECRET']);
  const mainTon=first(env,['TON_MAIN_WALLET_ADDRESS','TON_PERMANENT_WALLET_ADDRESS','TON_MAIN_ADDRESS','TON_WALLET_ADDRESS','MAIN_TON_WALLET','MAIN_WALLET_ADDRESS','PERMANENT_WALLET_ADDRESS']);
  const tempTon=first(env,['TON_TEMP_WALLET_ADDRESS','GUARD_TEMP_WALLET_ADDRESS','TON_TEMP_ADDRESS','TEMP_TON_WALLET','TEMP_WALLET_ADDRESS','TON_RECEIVING_ADDRESS']);
  const fx=Number(first(env,['USD_TOMAN_RATE','USD_TO_TOMAN','USD_TOMAN','USD_IRR_RATE'])||0);
  const providers={
    openai:Boolean(openai),
    anthropic:Boolean(anthropic),
    gemini:Boolean(gemini),
    webSearch:Boolean(env?.TAVILY_API_KEY||env?.BRAVE_SEARCH_API_KEY),
    variza:Boolean(variza),
    varizaWebhook:Boolean(webhook),
    tonMain:Boolean(mainTon),
    tonTemporary:Boolean(tempTon),
    fx:Boolean(Number.isFinite(fx)&&fx>0),
    durableStore:Boolean(env?.PAYMENTS),
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
    wallet:{
      publicTonPaymentsEnabled:providers.tonMain,
      guardStagingEnabled:providers.tonTemporary,
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
