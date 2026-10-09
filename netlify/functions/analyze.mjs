import { buildCorePlan, parseModelJson } from "../../functions/api/anil-core-engine.mjs";

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const normalize=v=>String(v||"").trim().toLowerCase().replace(/[يى]/g,"ی").replace(/ك/g,"ک").replace(/[\u200c\u200d]/g," ").replace(/\s+/g," ");
const routes=[
{id:"video",keys:["video","teaser","تیزر","ویدیو","فیلم","کلیپ"],title:"Video creation path",desc:"From idea to a publish-ready video.",steps:["Goal","Script","Visual direction","Production","Audio and versions","Publish and grow"]},
{id:"website",keys:["site","website","store","landing","سایت","فروشگاه","لندینگ","صفحه اینترنتی"],title:"Website build path",desc:"Audience, structure, design, build, launch and growth in one path.",steps:["Audience and goal","Structure and content","Design","Development","QA and launch","SEO and growth"]},
{id:"prototype",keys:["prototype","mockup","preview","پیش نمایش","پیش‌نمایش","پروتوتایپ","ماکت"],title:"Prototype path",desc:"See it before committing to the full build.",steps:["Define idea","Prototype","Preview","Feedback","Refine","Approve"]},
{id:"fix",keys:["bug","error","fix","broken","slow","خطا","خراب","مشکل","ارور","کند","رفع"],title:"Problem-solving path",desc:"Diagnose, repair and verify the result.",steps:["Capture problem","Diagnose","Prioritize","Fix","Test","Deliver"]},
{id:"growth",keys:["sales","customers","growth","seo","traffic","revenue","فروش","مشتری","رشد","سئو","بازدید","درآمد"],title:"Growth path",desc:"Turn a business goal into acquisition, conversion and measurement.",steps:["Goal","Audience","Offer","Acquisition","Conversion","Measurement"]}];
const fallback={id:"custom",title:"Adaptive ANIL X path",desc:"ANIL X turns the desired outcome into an executable path.",steps:["Understand outcome","Discover related needs","Build the path","Preview","Execute","Continue and grow"]};
const parseJSON=parseModelJson;
const getEnv=(env,key)=>String((env||process.env)[key]||"").trim();
const timeoutFetch=async(url,options={},ms=1650)=>{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),ms);
  try{return await fetch(url,{...options,signal:controller.signal});}
  finally{clearTimeout(timer);}
};
const systemPrompt="You are Astra, the central ANIL X orchestrator. Produce a practical, concise plan. Never claim actions were executed. Prefer the user's language. Return ONLY JSON: {title,desc,steps,reply,confidence}.";
async function providerOpenAI(prompt,env){
  const key=getEnv(env,"OPENAI_API_KEY"); if(!key)return null;
  const model=getEnv(env,"ASTRA_MODEL")||"gpt-5-mini";
  const r=await timeoutFetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${key}`},body:JSON.stringify({model,messages:[{role:"system",content:systemPrompt},{role:"user",content:prompt}],temperature:.2})});
  if(!r.ok)throw Error("openai_"+r.status);
  const d=await r.json(); const out=parseJSON(d?.choices?.[0]?.message?.content);
  if(!out||typeof out!=="object")throw Error("openai_invalid_json"); return out;
}
async function providerGemini(prompt,env){
  const key=getEnv(env,"GEMINI_API_KEY"); if(!key)return null;
  const model=getEnv(env,"GEMINI_MODEL")||"gemini-2.5-flash";
  const r=await timeoutFetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({contents:[{role:"user",parts:[{text:`${systemPrompt}\n${prompt}`}]}],generationConfig:{responseMimeType:"application/json",temperature:.2}})});
  if(!r.ok)throw Error("gemini_"+r.status);
  const d=await r.json(); const out=parseJSON(d?.candidates?.[0]?.content?.parts?.map(x=>x.text||"").join(""));
  if(!out||typeof out!=="object")throw Error("gemini_invalid_json"); return out;
}
async function providerClaude(prompt,env){
  const key=getEnv(env,"ANTHROPIC_API_KEY"); if(!key)return null;
  const model=getEnv(env,"CLAUDE_MODEL")||"claude-sonnet-4-5";
  const r=await timeoutFetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"content-type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01"},body:JSON.stringify({model,max_tokens:900,system:systemPrompt,messages:[{role:"user",content:prompt}]})});
  if(!r.ok)throw Error("anthropic_"+r.status);
  const d=await r.json(); const out=parseJSON(d?.content?.map(x=>x.text||"").join(""));
  if(!out||typeof out!=="object")throw Error("anthropic_invalid_json"); return out;
}
async function providerOpenRouter(prompt,env){
  const key=getEnv(env,"ANIL_OPENROUTER_API_KEY")||getEnv(env,"OPENROUTER_API_KEY"); if(!key)return null;
  const model=getEnv(env,"ANIL_OPENROUTER_MODEL")||getEnv(env,"OPENROUTER_MODEL")||"openrouter/free";
  const r=await timeoutFetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${key}`,"HTTP-Referer":"https://anil-x-live.onrender.com","X-Title":"ANIL X"},body:JSON.stringify({model,messages:[{role:"system",content:systemPrompt},{role:"user",content:prompt}],temperature:.2})});
  if(!r.ok)throw Error("openrouter_"+r.status);
  const d=await r.json(); const out=parseJSON(d?.choices?.[0]?.message?.content);
  if(!out||typeof out!=="object")throw Error("openrouter_invalid_json"); return out;
}
const PROVIDERS={openai:providerOpenAI,gemini:providerGemini,claude:providerClaude,openrouter:providerOpenRouter};
function providerOrder(env){
  const configured=getEnv(env,"ANIL_PROVIDER_ORDER");
  const requested=(configured||"openai,gemini,claude,openrouter").split(",").map(x=>x.trim().toLowerCase()).filter(x=>PROVIDERS[x]);
  return [...new Set([...requested,...Object.keys(PROVIDERS)])];
}
function validModelResult(value,local){
  if(!value||typeof value!=="object")return local;
  const steps=Array.isArray(value.steps)?value.steps.filter(x=>typeof x==="string"&&x.trim()).slice(0,8):[];
  return {title:String(value.title||local.title).slice(0,180),desc:String(value.desc||local.desc).slice(0,500),steps:steps.length?steps:local.steps,reply:String(value.reply||local.reply).slice(0,2500),confidence:Math.max(.25,Math.min(1,Number(value.confidence)||.6))};
}
export default async (req,env)=>{
  if(req.method!=="POST")return json({ok:false,error:"method_not_allowed"},405);
  try{
    const body=await req.json();
    const input=String(body?.text||"").trim().slice(0,4000);
    if(!input)return json({ok:false,error:"empty_request"},400);
    const text=normalize(input);
    const scored=routes.map(route=>({route,score:route.keys.reduce((n,key)=>n+(text.includes(normalize(key))?1:0),0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
    const legacyRoute=scored[0]?.route||fallback;
    const local=buildCorePlan(input,body);
    const localResult={title:local.title,desc:local.desc,steps:local.steps,reply:local.reply,confidence:local.confidence};
    const language=local.language;
    const prompt=JSON.stringify({request:input,language,localPlan:localResult,profile:body?.profile||{},conversation:Array.isArray(body?.turns)?body.turns.slice(-4):[]});
    let result=localResult,providerUsed="ANIL-Core";
    const attempts=[];
    // Bounded sequential rotation: a failed/empty/quota-limited provider never blocks the local engine.
    const started=Date.now(),budgetMs=6500;
    for(const name of providerOrder(env)){
      if(Date.now()-started>=budgetMs)break;
      try{
        const candidate=await PROVIDERS[name](prompt,env);
        if(candidate){result=validModelResult(candidate,localResult);providerUsed=name;attempts.push({provider:name,status:"ok"});break;}
        attempts.push({provider:name,status:"not_configured"});
      }catch(error){
        const message=String(error?.message||error);
        const match=message.match(/_(401|402|403|404|408|413|429|500|502|503|504)$/);
        const status=match?Number(match[1]):0;
        attempts.push({provider:name,status:status===429?"rate_limited":status===402?"credits_exhausted":status===401||status===403?"auth_or_access_error":status?"http_error":"timeout_or_invalid",httpStatus:status||undefined});
      }
    }
    // Optional council verification only when explicitly requested; never slow down every normal chat turn.
    let council={claude:false,gemini:false};
    if(body?.verify===true){
      const verifyPrompt=JSON.stringify({request:input,answer:result});
      const checks=await Promise.all(["claude","gemini"].map(async name=>{
        try{const keyName=name==="claude"?"ANTHROPIC_API_KEY":"GEMINI_API_KEY";if(!getEnv(env,keyName))return [name,false];const fn=name==="claude"?providerClaude:providerGemini;const r=await fn(verifyPrompt,env);return [name,!!r];}catch{return [name,false];}
      }));
      council=Object.fromEntries(checks);
    }
    return json({ok:true,input,route:{id:local.routeId||legacyRoute.id,title:result.title||local.title,desc:result.desc||local.desc,steps:Array.isArray(result.steps)&&result.steps.length?result.steps.slice(0,8):local.steps},reply:result.reply||local.reply,confidence:Math.max(.25,Math.min(1,Number(result.confidence)||.55)),meta:{engine:"ANIL-Core+Provider-Rotation",version:"3.0-owned-core",internationalFirst:true,orchestrator:providerUsed,providerAttempts:attempts,specialists:council,verification:body?.verify===true?"requested":"on-demand",fallback:providerUsed==="ANIL-Core",localCoreAvailable:true,externalProviderRequired:false,controls:local.controls}});
  }catch(error){return json({ok:false,error:"engine_failure",message:String(error?.message||error)},502)}
};
export const config={path:"/api/analyze"};
