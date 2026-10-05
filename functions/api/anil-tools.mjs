const H={'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*'};
const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:H});
const clean=(v,n=200)=>String(v??'').trim().slice(0,n);
const blocked=/^(javascript|data|file|chrome|chrome-extension):/i;
const isPrivateHost=h=>{const x=h.toLowerCase();return x==='localhost'||x.endsWith('.localhost')||/^127\./.test(x)||/^10\./.test(x)||/^192\.168\./.test(x)||/^169\.254\./.test(x)||/^172\.(1[6-9]|2\d|3[0-1])\./.test(x)||x==='::1'};
async function publicFetch(url){const u=new URL(url);if(blocked.test(u.protocol)||isPrivateHost(u.hostname))throw Error('url_not_allowed');const r=await fetch(u,{redirect:'follow',headers:{'user-agent':'ANIL-X-Agent/1.0'}});const ct=r.headers.get('content-type')||'';const body=(await r.text()).slice(0,30000);return {ok:r.ok,status:r.status,url:r.url,contentType:ct,title:(body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'').replace(/\s+/g,' ').trim().slice(0,300),body:ct.includes('html')?body.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,12000):body.slice(0,12000)}}
async function webSearch(env,query){
  const q=clean(query,500);
  if(!q)return {ok:false,error:'query_required'};
  if(env.TAVILY_API_KEY){
    const r=await fetch('https://api.tavily.com/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({api_key:env.TAVILY_API_KEY,query:q,max_results:5,search_depth:'basic',include_answer:false})});
    return {ok:r.ok,provider:'tavily',status:r.status,data:await r.json().catch(()=>null)};
  }
  if(env.BRAVE_SEARCH_API_KEY){
    const r=await fetch('https://api.search.brave.com/res/v1/web/search?q='+encodeURIComponent(q)+'&count=5',{headers:{accept:'application/json','X-Subscription-Token':env.BRAVE_SEARCH_API_KEY}});
    return {ok:r.ok,provider:'brave',status:r.status,data:await r.json().catch(()=>null)};
  }
  return {ok:false,configured:false,error:'web_search_key_not_configured'};
}
function calculate(expr){
  const x=clean(expr,200);
  if(!x||!Array.from(x).every(ch=>'0123456789+-*/().% \\t'.includes(ch)))return {ok:false,error:'expression_not_allowed'};
  try{
    const value=Function('"use strict";return ('+x+')')();
    return Number.isFinite(value)?{ok:true,value}:{ok:false,error:'non_finite'};
  }catch{return {ok:false,error:'invalid_expression'}}
}
async function github(env,path){if(!env.GITHUB_TOKEN)return {ok:false,configured:false,error:'github_token_not_configured'};const p=path.replace(/^\//,'');if(!/^(repos|search|user|rate_limit)\b/.test(p))return {ok:false,error:'github_path_not_allowed'};const r=await fetch('https://api.github.com/'+p,{headers:{accept:'application/vnd.github+json',authorization:'Bearer '+env.GITHUB_TOKEN,'user-agent':'ANIL-X-Agent/1.0'}});return {ok:r.ok,status:r.status,data:await r.json().catch(()=>null)}}
export async function anilTool(req,env){if(req.method!=='POST')return json({ok:false,error:'method_not_allowed'},405);try{const b=await req.json();const tool=clean(b.tool,40);if(tool==='fetch_url'){return json({ok:true,tool,result:await publicFetch(clean(b.url,2000))})}if(tool==='web_search'){return json({ok:true,tool,result:await webSearch(env,b.query)})}if(tool==='calculate'){return json({ok:true,tool,result:calculate(b.expression)})}if(tool==='github'){return json({ok:true,tool,result:await github(env,clean(b.path,500))})}if(tool==='capabilities'){return json({ok:true,tool,capabilities:{url_fetch:true,github:!!env.GITHUB_TOKEN,render_api:!!env.RENDER_API_KEY,openai:!!env.OPENAI_API_KEY,claude:!!env.ANTHROPIC_API_KEY,gemini:!!env.GEMINI_API_KEY,variza:!!(env.VARIZA_API_KEY||env.VARIZA_TOKEN),stripe:!!env.STRIPE_SECRET_KEY,paypal:!!env.PAYPAL_CLIENT_SECRET,browser_smoke:true,web_search:!!(env.TAVILY_API_KEY||env.BRAVE_SEARCH_API_KEY),calculator:true,owner_assistant:{control_plane:true,controlled_change_queue:true,autonomous_recovery:true,super_team:true,guard_radar:true,revenue_cycle:true,post_change_qa:true,rollback_gate:true}}})}return json({ok:false,error:'unknown_tool'},400)}catch(e){return json({ok:false,error:'tool_failed',message:String(e?.message||e)},502)}}
