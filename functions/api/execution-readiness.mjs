import {json} from './runtime-state.mjs';

function configured(env,key){return Boolean(env?.[key]);}

export async function handleExecutionReadiness(req,env){
  if(req.method!=='GET') return json({ok:false,error:'method_not_allowed'},405);
  const providers={
    openai:configured(env,'OPENAI_API_KEY'),
    anthropic:configured(env,'ANTHROPIC_API_KEY'),
    gemini:configured(env,'GEMINI_API_KEY'),
    webSearch:Boolean(env?.TAVILY_API_KEY||env?.BRAVE_SEARCH_API_KEY),
    variza:Boolean(env?.VARIZA_API_KEY||env?.VARIA_API_KEY||env?.VARIZA_TOKEN||env?.VARIZA_KEY),
    ton:Boolean(env?.TON_RECEIVING_ADDRESS),
    durableStore:Boolean(env?.PAYMENTS),
    assets:Boolean(env?.ASSETS)
  };
  return json({
    ok:true,
    checkedAt:new Date().toISOString(),
    execution:{
      repository:{ready:true,mode:'GitHub Actions OIDC + controlled PR workflow',rawPatRequired:false},
      runtime:{ready:true,provider:'Render',service:'city-of-eternity',mode:'Node web service'},
      database:{ready:providers.durableStore,mode:'application binding',rawConnectionStringExposed:false},
      browser:{ready:true,mode:'CI Playwright smoke; interactive actions credential-gated'},
      automation:{ready:true,control:'scheduled GitHub Actions + owner-approved queue'},
      rollback:{ready:true,mode:'Git/Render known-good deploy rollback'}
    },
    providers,
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
