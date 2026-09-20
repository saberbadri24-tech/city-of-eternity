const JSON_HEADERS = {'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'content-type'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});
const text=v=>String(v||'').trim();
const id=()=>crypto.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2);

function localPlan(input){
 const t=text(input).toLowerCase();
 const rules=[
  [['site','website','سایت','وب سایت','وب‌سایت','فروشگاه','landing'],'website','ساخت و راه‌اندازی سایت'],
  [['video','teaser','تیزر','ویدیو','فیلم','کلیپ'],'video','تولید محتوای ویدیویی'],
  [['bug','error','fix','خطا','خراب','مشکل','ارور','کند','کار نمی','رفع'],'fix','تشخیص و رفع مشکل'],
  [['sales','growth','seo','فروش','مشتری','رشد','تبلیغ','سئو','بازدید','درآمد'],'growth','موتور رشد کسب‌وکار'],
  [['preview','prototype','پیش‌نمایش','نمونه','ماکت'],'prototype','پیش‌نمایش قبل از اجرا']
 ];
 const hit=rules.find(([keys])=>keys.some(k=>t.includes(k)));
 if(/نه|نمیخوام|اشتباه|این نیست|عوضش|بیخیال|لغو|cancel|\\bno\\b/.test(t))return{title:'مسیر دوباره تنظیم شد',desc:'اصلاح ثبت شد؛ مسیر قبلی مبنا نیست.',moves:['خواسته جدید','اقدام مناسب','اجرا یا پیش‌نمایش','بررسی نتیجه']};
 if(/فوری|سریع|الان|همین|فقط/.test(t))return{title:'اقدام مستقیم',desc:'مسیر کوتاه شده و فقط اقدام‌های ضروری باقی مانده‌اند.',moves:['اقدام بعدی','اجرا','تأیید نتیجه']};
 return{title:hit?.[2]||'مسیر اختصاصی ANIL X',desc:'مسیر بر اساس خواسته فعلی ساخته می‌شود و با هر اصلاح دوباره تنظیم می‌شود.',moves:['فهم نتیجه مطلوب','انتخاب اقدام بعدی','اجرا','بررسی و اصلاح']};
}

function parseJSON(raw){
 const s=String(raw||'').trim();
 try{return JSON.parse(s)}catch{}
 const m=s.match(/\{[\s\S]*\}/);
 try{return m?JSON.parse(m[0]):null}catch{return null}
}

async function openAI(env,prompt){
 if(!env.OPENAI_API_KEY)return null;
 const response=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${env.OPENAI_API_KEY}`},body:JSON.stringify({model:env.ASTRA_MODEL||'gpt-5-mini',messages:[{role:'system',content:'You are Astra, the central ANIL X orchestrator. Adapt to the user. Return concise JSON: title, desc, moves, reply, confidence, specialist, nextAction. Never claim an action was completed without evidence.'},{role:'user',content:prompt}],temperature:.2})});
 if(!response.ok)throw Error('openai_'+response.status);
 const data=await response.json();return parseJSON(data?.choices?.[0]?.message?.content);
}

async function claudeCheck(env,prompt){
 if(!env.ANTHROPIC_API_KEY)return null;
 const response=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:env.CLAUDE_MODEL||'claude-sonnet-4-5',max_tokens:700,system:'You are the ANIL X engineering and safety reviewer. Check the plan for contradictions, unsupported completion claims, missing assumptions and unsafe actions. Return JSON with ok, corrections, confidence.',messages:[{role:'user',content:prompt}]})});
 if(!response.ok)throw Error('anthropic_'+response.status);
 const data=await response.json();return parseJSON(data?.content?.map(x=>x.text||'').join(''));
}

async function geminiCheck(env,prompt){
 if(!env.GEMINI_API_KEY)return null;
 const model=env.GEMINI_MODEL||'gemini-2.5-flash';
 const url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent?key='+encodeURIComponent(env.GEMINI_API_KEY);
 const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:'You are the ANIL X research verifier. Check this plan for factual overreach, missing assumptions and unsupported claims. Return JSON with ok, corrections, confidence.'+'\\n\\n'+prompt}]}]})});
 if(!response.ok)throw Error('gemini_'+response.status);
 const data=await response.json();return parseJSON(data?.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join(''));
}

async function council(body,env){
 const requestText=text(body?.text||body?.request);
 if(!requestText)return{ok:false,error:'missing_request'};
 const fallback=localPlan(requestText);
 const turns=Array.isArray(body?.turns)?body.turns.slice(-8):[];
 const prompt=JSON.stringify({request:requestText,profile:body?.profile||{},previousRoute:body?.previousRoute||'custom',conversation:turns,fallback});
 let astra=null,claude=null,gemini=null,providerErrors=[];
 try{astra=await openAI(env,prompt)}catch(e){providerErrors.push(String(e?.message||e))}
 if(!astra && env.ANTHROPIC_API_KEY){
  try{const alt=await claudeCheck(env,JSON.stringify({request:requestText,fallback}));if(alt?.plan||alt?.title){astra=alt;astra._fallbackProvider='claude'}}catch(e){providerErrors.push(String(e?.message||e))}
 }
 if(astra){
  try{claude=await claudeCheck(env,JSON.stringify({request:requestText,plan:astra}))}catch(e){providerErrors.push(String(e?.message||e))}
  try{gemini=await geminiCheck(env,JSON.stringify({request:requestText,plan:astra}))}catch(e){providerErrors.push(String(e?.message||e))}
  let desc=astra.desc||fallback.desc;
  const corrections=[...(claude?.corrections||[]),...(gemini?.corrections||[])].filter(Boolean).slice(0,3);
  if(corrections.length)desc=(desc+' '+corrections.join(' ')).trim();
  const specialist=astra.specialist||fallback.title;
  return{ok:true,source:'ai-council',orchestrator:astra._fallbackProvider?'claude':'astra',reviewer:claude?'claude':'local',research:gemini?'gemini':'local',specialist,nextAction:astra.nextAction||'review',providers:{openai:Boolean(env.OPENAI_API_KEY),anthropic:Boolean(env.ANTHROPIC_API_KEY),gemini:Boolean(env.GEMINI_API_KEY)},specialists:{astra:{live:!astra._fallbackProvider&&Boolean(env.OPENAI_API_KEY)},claude:{live:!!claude},gemini:{live:!!gemini},vision:{live:false,reason:'vision endpoint not configured'},voice:{live:false,reason:'voice endpoint not configured'}},plan:{title:astra.title||fallback.title,desc,moves:Array.isArray(astra.moves)&&astra.moves.length?astra.moves.slice(0,6):fallback.moves},reply:astra.reply||`گرفتم: ${astra.title||fallback.title}`,confidence:Number(astra.confidence)||.75,providerErrors:providerErrors.slice(0,4),requestId:id()};
 }
 return{ok:true,source:'local-fallback',orchestrator:'local',reviewer:'local',research:'local',specialists:{astra:{live:false},claude:{live:false},gemini:{live:false},vision:{live:false},voice:{live:false}},plan:fallback,reply:`گرفتم: ${fallback.title}`,confidence:.55,providerErrors:providerErrors.slice(0,4),requestId:id()};
}

export default async(request,context)=>{
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:JSON_HEADERS});
 if(request.method!=='POST')return json({ok:false,error:'method_not_allowed'},405);
 try{return json(await council(await request.json(),Netlify.env));}
 catch(error){return json({ok:false,error:'engine_failure',message:String(error?.message||error)},502);}
};
export const config={path:'/api/plan'};
