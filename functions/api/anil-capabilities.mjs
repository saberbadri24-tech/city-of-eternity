const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

const envFlag=(env,...keys)=>keys.some(k=>Boolean(env?.[k]));
export function handleAnilCapabilities(req,env){
  if(req.method!=='GET') return json({ok:false,error:'method_not_allowed'},405);
  return json({
    ok:true,
    generatedAt:new Date().toISOString(),
    capabilities:{
      ai:{openai:envFlag(env,'OPENAI_API_KEY'),anthropic:envFlag(env,'ANTHROPIC_API_KEY'),gemini:envFlag(env,'GEMINI_API_KEY')},
      github:{workflowOidc:true,repository:'saberbadri24-tech/city-of-eternity',writePath:'controlled-change-request -> GitHub Actions -> branch/PR -> tests',tokenDirect:false},
      gitlab:{configured:envFlag(env,'GITLAB_TOKEN'),writePath:'api-adapter-when-configured'},
      browser:{playwrightSmoke:true,remoteBrowser:envFlag(env,'BROWSERBASE_API_KEY','BROWSERLESS_TOKEN','BROWSER_AUTOMATION_TOKEN')},
      database:{productionDatabase:envFlag(env,'DATABASE_URL','POSTGRES_URL','POSTGRES_CONNECTION_STRING'),mode:envFlag(env,'DATABASE_URL','POSTGRES_URL','POSTGRES_CONNECTION_STRING')?'configured':'not_configured'},
      payments:{
        variza:envFlag(env,'VARIZA_API_KEY','VARIA_API_KEY','VARIZA_TOKEN','VARIZA_KEY'),
        stripe:envFlag(env,'STRIPE_SECRET_KEY'),
        paypal:envFlag(env,'PAYPAL_CLIENT_ID','PAYPAL_CLIENT_SECRET')
      },
      deployment:{renderAutoDeploy:true,githubActions:true},
      ownerAssistant:{
        liveControlPlane:true,
        controlledChangeQueue:true,
        autonomousRecovery:true,
        superTeam:true,
        guardRadar:true,
        revenueCycle:true,
        postChangeQA:true,
        rollbackGate:true,
        mutationBoundary:'owner-approved controlled GitHub workflow'
      }
    },
    executionBoundary:{
      productionMutation:'PR/review path',
      irreversibleActions:'owner approval required',
      secrets:'environment variables only',
      payments:'provider webhook + settled order',
      browser:'verification/automation only; no credential bypass'
    }
  });
}
