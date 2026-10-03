const H={'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'content-type'};
const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:H});
const text=v=>String(v||'').trim();
const firstEnv=(env,keys)=>keys.map(k=>env?.[k]).find(v=>typeof v==='string'&&v.trim())||'';
const localPlan=input=>{const t=text(input).toLowerCase();const rules=[[['site','website','سایت','وب سایت','وب‌سایت','فروشگاه'],'website','ساخت و راه‌اندازی سایت'],[['video','teaser','تیزر','ویدیو'],'video','تولید محتوای ویدیویی'],[['bug','error','fix','خطا','خراب','مشکل','ارور'],'fix','تشخیص و رفع مشکل'],[['sales','growth','seo','فروش','مشتری','رشد','سئو'],'growth','موتور رشد کسب‌وکار'],[['preview','prototype','پیش‌نمایش','ماکت'],'preview','پیش‌نمایش قبل از اجرا']];const hit=rules.find(([keys])=>keys.some(k=>t.includes(k)));return {title:hit?.[2]||'مسیر اختصاصی ANIL X',desc:'مسیر بر اساس خواسته فعلی ساخته می‌شود.',moves:hit?['فهم نتیجه','انتخاب متخصص','اجرا','بررسی و اصلاح']:['شفاف‌کردن نتیجه','کشف بهترین اقدام','پیش‌نمایش','اجرا']};};
async function toolWebSearch(env,query){
  if(!env.TAVILY_API_KEY&&!env.BRAVE_SEARCH_API_KEY)return {ok:false,error:'web_search_key_not_configured'};
  try{
    if(env.TAVILY_API_KEY){
      const r=await fetch('https://api.tavily.com/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({api_key:env.TAVILY_API_KEY,query:String(query).slice(0,500),max_results:5,search_depth:'basic'})});
      return {ok:r.ok,provider:'tavily',data:await r.json().catch(()=>null)};
    }
    const r=await fetch('https://api.search.brave.com/res/v1/web/search?q='+encodeURIComponent(String(query).slice(0,500))+'&count=5',{headers:{accept:'application/json','X-Subscription-Token':env.BRAVE_SEARCH_API_KEY}});
    return {ok:r.ok,provider:'brave',data:await r.json().catch(()=>null)};
  }catch(e){return {ok:false,error:String(e?.message||e)}}
}
async function executePlannedTool(env,call){
  const tool=String(call?.tool||'');
  const a=call?.args||{};
  try{
    if(tool==='web_search')return await toolWebSearch(env,a.query);
    if(tool==='fetch_url')return await toolFetchUrl(env,a.url);
    if(tool==='calculate'){const x=String(a.expression||'').slice(0,200);if(!x||!Array.from(x).every(ch=>'0123456789+-*/().% \\t'.includes(ch)))return {ok:false,error:'expression_not_allowed'};try{const value=Function('"use strict";return ('+x+')')();return Number.isFinite(value)?{ok:true,value}:{ok:false,error:'non_finite'}}catch{return {ok:false,error:'invalid_expression'}}}
    if(tool==='github'){
      if(!env.GITHUB_TOKEN)return {ok:false,error:'github_token_not_configured'};
      const path=String(a.path||'').replace(/^\//,'');
      if(!/^(repos|search|user|rate_limit)\\b/.test(path))return {ok:false,error:'github_path_not_allowed'};
      const rr=await fetch('https://api.github.com/'+path,{headers:{accept:'application/vnd.github+json',authorization:'Bearer '+env.GITHUB_TOKEN,'user-agent':'ANIL-X-Agent/1.0'}});
      return {ok:rr.ok,status:rr.status,data:await rr.json().catch(()=>null)};
    }
    return {ok:false,error:'tool_not_allowed'};
  }catch(e){return {ok:false,error:String(e?.message||e)}}
}
async function toolFetchUrl(env,url){
  try{
    const u=new URL(url);
    if(!/^https?:$/.test(u.protocol)||/localhost$|^127\\.|^10\\.|^192\\.168\\.|^169\\.254\\.|^172\\.(1[6-9]|2\\d|3[0-1])\\./i.test(u.hostname))return {ok:false,error:'url_not_allowed'};
    const r=await fetch(u,{redirect:'follow',headers:{'user-agent':'ANIL-X-Agent/1.0'}});
    const ct=r.headers.get('content-type')||'';
    const raw=(await r.text()).slice(0,30000);
    const body=ct.includes('html')?raw.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,10000):raw.slice(0,10000);
    return {ok:r.ok,status:r.status,url:r.url,title:(raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'').trim().slice(0,200),body};
  }catch(e){return {ok:false,error:String(e?.message||e)}}
}
const extract=raw=>{try{return JSON.parse(raw)}catch{const m=String(raw||'').match(/\\{[\s\S]*\\}/);try{return m?JSON.parse(m[0]):null}catch{return null}}};
async function openai(env,prompt){const key=firstEnv(env,['OPENAI_API_KEY','OPENAI_KEY']);if(!key)return null;const model=firstEnv(env,['ASTRA_MODEL','ANIL_OPENAI_MODEL'])||'gpt-6-astra';const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:AbortSignal.timeout(5500),headers:{'content-type':'application/json',authorization:'Bearer '+key},body:JSON.stringify({model,instructions:'You are Astra, central ANIL X orchestrator. Return JSON only: title,desc,moves,reply,confidence,specialist,toolCalls. toolCalls is an array of at most 5 objects {tool,args}; allowed tools: web_search(query), fetch_url(url), calculate(expression), github(path). Use tools only when they materially help. Never claim a tool ran unless execution results are supplied. Never claim execution without evidence.',input:prompt,reasoning:{effort:env.ASTRA_REASONING_EFFORT||'high'}})});if(!r.ok)throw Error('openai_'+r.status);const d=await r.json();return extract(d?.output_text)}
async function claude(env,prompt){const key=firstEnv(env,['ANTHROPIC_API_KEY','ANTHROPIC_KEY']);if(!key)return null;const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',signal:AbortSignal.timeout(5500),headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:env.CLAUDE_MODEL||env.ANIL_ANTHROPIC_MODEL||'claude-sonnet-4-5',max_tokens:700,system:'You are Claude, ANIL X engineering reviewer. Return JSON only with ok,corrections,confidence.',messages:[{role:'user',content:prompt}]})});if(!r.ok)throw Error('claude_'+r.status);const d=await r.json();return extract(d?.content?.map(x=>x.text||'').join(''))}
async function gemini(env,prompt){const key=firstEnv(env,['GEMINI_API_KEY','GOOGLE_GEMINI_API_KEY','GOOGLE_API_KEY']);if(!key)return null;const model=env.GEMINI_MODEL||env.ANIL_GEMINI_MODEL||'gemini-3.8-flash';const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent?key='+encodeURIComponent(key),{method:'POST',signal:AbortSignal.timeout(5500),headers:{'content-type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:'You are Gemini, ANIL X research verifier. Return JSON only with ok,corrections,confidence. '+prompt}]}]})});if(!r.ok)throw Error('gemini_'+r.status);const d=await r.json();return extract(d?.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join(''))}
export async function handlePlan(request,env){if(request.method==='OPTIONS')return new Response(null,{status:204,headers:H});if(request.method!=='POST')return json({ok:false,error:'method_not_allowed'},405);let requestText='';try{const body=await request.json();requestText=text(body?.text||body?.request||body?.prompt);if(!requestText)return json({ok:false,error:'missing_request'},400);const fallback=localPlan(requestText);const urls=requestText.split(/\\s+/).map(x=>x.replace(/[),.;]+$/,'')).filter(x=>x.startsWith('http://')||x.startsWith('https://')).slice(0,3);
const searchIntent=/(latest|today|news|current|price|research|search|تحقیق|جستجو|جدیدترین|امروز|قیمت|اخبار|بررسی)/i.test(requestText);
const searchPromise=searchIntent?toolWebSearch(env,requestText):Promise.resolve(null);
const toolPromise=urls.length?Promise.all(urls.map(u=>toolFetchUrl(env,u))):Promise.resolve([]);
const promptBase={request:requestText,profile:body?.profile||{},conversation:body?.turns||[],fallback};
const [searchResults,toolResults]=await Promise.all([searchPromise,toolPromise]);
const prompt=JSON.stringify({...promptBase,toolResults,searchResults});
const reviewPrompt=JSON.stringify({...promptBase,context:body?.profile||{}});
let astra=null,claude=null,gemini=null,errors=[];
const providerResults=await Promise.allSettled([openai(env,prompt),claude(env,reviewPrompt),gemini(env,reviewPrompt)]);
if(providerResults[0].status==='fulfilled')astra=providerResults[0].value;else if(providerResults[0].reason)errors.push(String(providerResults[0].reason?.message||providerResults[0].reason||'astra_error'));
if(providerResults[1].status==='fulfilled')claude=providerResults[1].value;else if(providerResults[1].reason)errors.push(String(providerResults[1].reason?.message||providerResults[1].reason||'claude_error'));
if(providerResults[2].status==='fulfilled')gemini=providerResults[2].value;else if(providerResults[2].reason)errors.push(String(providerResults[2].reason?.message||providerResults[2].reason||'gemini_error'));
if(!astra&&claude){astra={title:fallback.title,desc:claude.corrections||fallback.desc,moves:fallback.moves,reply:claude.reply||('گرفتم؛ '+fallback.title),confidence:Number(claude.confidence)||.45,specialist:'Claude'};}
if(!astra&&gemini){astra={title:fallback.title,desc:gemini.corrections||fallback.desc,moves:fallback.moves,reply:gemini.reply||('گرفتم؛ '+fallback.title),confidence:Number(gemini.confidence)||.45,specialist:'Gemini'};}
let toolExecutions=[];
const calls=Array.isArray(astra?.toolCalls)?astra.toolCalls.slice(0,5):[];
for(const call of calls){toolExecutions.push({tool:call?.tool,result:await executePlannedTool(env,call)});}
if(toolExecutions.length&&astra){
  try{
    const finalPrompt=JSON.stringify({request:requestText,initialPlan:astra,toolExecutions,context:body?.profile||{}});
    const finalAstra=await openai(env,finalPrompt);
    if(finalAstra)astra={...astra,...finalAstra,toolCalls:toolExecutions.map(x=>({tool:x.tool,executed:true}))};
  }catch(e){errors.push(String(e?.message||e))}
}
const reply=astra?.reply||('گرفتم: '+(astra?.title||fallback.title)); const text=reply;return json({ok:true,source:astra?'ai-council':'local-fallback',orchestrator:astra?'astra':'local',reviewer:claude?'claude':'local',research:gemini?'gemini':'local',specialists:{astra:{live:!!astra,provider:'openai'},claude:{live:!!claude,provider:'anthropic'},gemini:{live:!!gemini,provider:'google'},vision:{live:false,endpoint:'/api/vision'},voice:{live:false,endpoint:'/api/voice'}},router:{selected:astra?.specialist||fallback.title,providerErrors:errors.slice(0,4),tools:{urls:toolResults.length,used:toolResults.some(x=>x?.ok),webSearch:Boolean(searchResults?.ok),searchProvider:searchResults?.provider||null,planned:toolExecutions.map(x=>({tool:x.tool,ok:!!x.result?.ok}))}},plan:{title:astra?.title||fallback.title,desc:astra?.desc||fallback.desc,moves:Array.isArray(astra?.moves)&&astra.moves.length?astra.moves.slice(0,6):fallback.moves},reply,text,answer:reply,confidence:Number(astra?.confidence)||.55})}catch(e){const fallback=localPlan(requestText);return json({ok:true,source:'local-fallback',orchestrator:'local',reviewer:'local',research:'local',specialists:{astra:{live:false,provider:'local'},claude:{live:false,provider:'local'},gemini:{live:false,provider:'local'},vision:{live:false,endpoint:'/api/vision'},voice:{live:false,endpoint:'/api/voice'}},router:{selected:fallback.title,providerErrors:[String(e?.message||e).slice(0,240)],tools:{urls:0,used:false,webSearch:false,searchProvider:null,planned:[]}},plan:fallback,reply:'گرفتم؛ '+fallback.title+'. مسیر پایه ANIL X آماده است.',text:'گرفتم؛ '+fallback.title+'. مسیر پایه ANIL X آماده است.',answer:'گرفتم؛ '+fallback.title+'. مسیر پایه ANIL X آماده است.',confidence:.25})}}