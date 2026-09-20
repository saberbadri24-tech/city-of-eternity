import { getStore } from '@netlify/blobs';

const H={'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'content-type'};
const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:H});
const text=v=>String(v||'').trim();
const memory=()=>getStore('anil-x-memory');

function localPlan(input){
 const t=text(input).toLowerCase();
 const rules=[
  [['site','website','سایت','وب سایت','وب‌سایت','فروشگاه','landing'],'website','ساخت و راه‌اندازی سایت'],
  [['video','teaser','تیزر','ویدیو','فیلم','کلیپ'],'video','تولید محتوای ویدیویی'],
  [['bug','error','fix','خطا','خراب','مشکل','ارور','کند','کار نمی','رفع'],'fix','تشخیص و رفع مشکل'],
  [['sales','growth','seo','فروش','مشتری','رشد','تبلیغ','سئو','بازدید','درآمد'],'growth','موتور رشد کسب‌وکار'],
  [['preview','prototype','پیش‌نمایش','ماکت'],'preview','پیش‌نمایش قبل از اجرا']
 ];
 const hit=rules.find(([keys])=>keys.some(k=>t.includes(k)));
 if(/نه|نمیخوام|اشتباه|این نیست|عوضش|بیخیال|لغو|cancel|\bno\b/.test(t))return{title:'مسیر دوباره تنظیم شد',desc:'اصلاح ثبت شد؛ مسیر قبلی مبنا نیست.',moves:['خواسته جدید','اقدام مناسب','اجرا یا پیش‌نمایش','بررسی نتیجه']};
 if(/فوری|سریع|الان|همین|فقط/.test(t))return{title:'اقدام مستقیم',desc:'مسیر کوتاه شده و فقط اقدام‌های ضروری باقی مانده‌اند.',moves:['اقدام بعدی','اجرا','تأیید نتیجه']};
 return{title:hit?.[2]||'مسیر اختصاصی ANIL X',desc:'مسیر بر اساس خواسته فعلی ساخته می‌شود و با هر اصلاح دوباره تنظیم می‌شود.',moves:hit?.[0]?['فهم نتیجه مطلوب','انتخاب متخصص','اجرا','بررسی و اصلاح']:['شفاف‌کردن نتیجه','کشف بهترین اقدام','پیش‌نمایش','اجرا']};
}

async function providerOpenAI(env,prompt){
 if(!env.OPENAI_API_KEY)return null;
 const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+env.OPENAI_API_KEY},body:JSON.stringify({model:env.ASTRA_MODEL||'gpt-5-mini',messages:[{role:'system',content:'You are Astra, the central ANIL X orchestrator. Return JSON only: title, desc, moves, reply, confidence, specialist. Be concise. Never claim an action was completed without evidence.'},{role:'user',content:prompt}],temperature:.2})});
 if(!r.ok)throw Error('openai_'+r.status);const d=await r.json(),raw=d?.choices?.[0]?.message?.content||'';try{return JSON.parse(raw)}catch{const m=raw.match(/\{[\s\S]*\}/);return m?JSON.parse(m[0]):null}
}
async function providerClaude(env,prompt){
 if(!env.ANTHROPIC_API_KEY)return null;
 const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:env.CLAUDE_MODEL||'claude-sonnet-4-5',max_tokens:700,system:'You are ANIL X engineering reviewer. Return JSON only with ok, corrections, confidence.',messages:[{role:'user',content:prompt}]})});
 if(!r.ok)throw Error('claude_'+r.status);const d=await r.json(),raw=d?.content?.map(x=>x.text||'').join('')||'';try{return JSON.parse(raw)}catch{const m=raw.match(/\{[\s\S]*\}/);return m?JSON.parse(m[0]):null}
}
async function providerGemini(env,prompt){
 if(!env.GEMINI_API_KEY)return null;
 const model=env.GEMINI_MODEL||'gemini-2.5-flash',url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent?key='+encodeURIComponent(env.GEMINI_API_KEY);
 const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:'You are ANIL X research verifier. Return JSON only with ok, corrections, confidence. '+prompt}]}]})});
 if(!r.ok)throw Error('gemini_'+r.status);const d=await r.json(),raw=d?.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('')||'';try{return JSON.parse(raw)}catch{const m=raw.match(/\{[\s\S]*\}/);return m?JSON.parse(m[0]):null}
}
async function saveMemory(sessionId,body,reply){
 if(!sessionId)return;
 const key=String(sessionId).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,100);if(!key)return;
 try{const old=await memory().getJSON('sessions/'+key)||{};const turns=Array.isArray(old.turns)?old.turns:[];turns.push({role:'user',text:text(body?.text||body?.request),at:new Date().toISOString()},{role:'assistant',text:reply,at:new Date().toISOString()});await memory().setJSON('sessions/'+key,{turns:turns.slice(-30),profile:body?.profile||old.profile||{},updatedAt:new Date().toISOString()})}catch{}
}
async function council(body,env){
 const requestText=text(body?.text||body?.request);if(!requestText)return{ok:false,error:'missing_request'};
 const fallback=localPlan(requestText),sessionId=text(body?.sessionId),turns=Array.isArray(body?.turns)?body.turns.slice(-8):[];
 let stored=null;if(sessionId){try{stored=await memory().getJSON('sessions/'+sessionId.replace(/[^a-zA-Z0-9_-]/g,'').slice(0,100))}catch{}}
 const prompt=JSON.stringify({request:requestText,profile:body?.profile||stored?.profile||{},conversation:(stored?.turns||turns).slice(-8),fallback});
 let astra=null,claude=null,gemini=null,errors=[];
 try{astra=await providerOpenAI(env,prompt)}catch(e){errors.push(String(e.message))}
 if(!astra&&env.ANTHROPIC_API_KEY){try{astra=await providerClaude(env,prompt)}catch(e){errors.push(String(e.message))}}
 if(astra){
  try{claude=await providerClaude(env,JSON.stringify({request:requestText,plan:astra}))}catch(e){errors.push(String(e.message))}
  try{gemini=await providerGemini(env,JSON.stringify({request:requestText,plan:astra}))}catch(e){errors.push(String(e.message))}
 }
 const specialist=String(astra?.specialist||fallback.title);
 const reply=astra?.reply||('گرفتم: '+(astra?.title||fallback.title));
 await saveMemory(sessionId,body,reply);
 return{ok:true,source:astra?'ai-council':'local-fallback',orchestrator:astra?'astra':'local',reviewer:claude?'claude':'local',research:gemini?'gemini':'local',specialists:{astra:{live:!!astra},claude:{live:!!claude},gemini:{live:!!gemini},vision:{live:false,endpoint:'/api/vision'},voice:{live:false,endpoint:'/api/voice'},fallback:{live:true}},router:{selected:specialist,failover:errors.length>0||!astra,providerErrors:errors.slice(0,4)},memory:{enabled:true,sessionId:sessionId||null},plan:{title:astra?.title||fallback.title,desc:astra?.desc||fallback.desc,moves:Array.isArray(astra?.moves)&&astra.moves.length?astra.moves.slice(0,6):fallback.moves},reply,confidence:Number(astra?.confidence)||.55};
}
export default async(request)=>{if(request.method==='OPTIONS')return new Response(null,{status:204,headers:H});if(request.method!=='POST')return json({ok:false,error:'method_not_allowed'},405);try{return json(await council(await request.json(),Netlify.env))}catch(e){return json({ok:false,error:'engine_failure',message:String(e?.message||e)},502)}};
export const config={path:'/api/plan'};
