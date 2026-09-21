const H={'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'content-type'};
const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:H});
const str=v=>String(v??'').trim().slice(0,12000);
const HOSTS=Object.freeze(new Set(['boundless.network','soniclabs.com','dappos.com','rate-x.io','pharosnetwork.xyz','lighter.xyz','infinex.xyz','rainbow.me']));
const safeHost=h=>{const x=String(h||'').toLowerCase().replace(/^www\./,'');return [...HOSTS].some(v=>x===v||x.endsWith('.'+v))};
const safeInput=x=>({kind:str(x?.kind||'opportunity'),title:str(x?.title),url:str(x?.url),domain:str(x?.domain),network:str(x?.network),contract:str(x?.contract),calldata:str(x?.calldata),reward:str(x?.reward),cost:str(x?.cost),deadline:str(x?.deadline),officialVerified:false,evidencePass:false,riskFlags:Array.isArray(x?.riskFlags)?x.riskFlags.slice(0,30):[]});
const extract=raw=>{try{return JSON.parse(raw)}catch{const m=String(raw||'').match(/\{[\s\S]*\}/);try{return m?JSON.parse(m[0]):null}catch{return null}}};
async function verifyOfficial(url){
 try{
  const u=new URL(String(url||'')); if(u.protocol!=='https:'||!safeHost(u.hostname))return {pass:false,reason:'unverified_domain',status:null,finalUrl:'',retrievedAt:new Date().toISOString()};
  const c=new AbortController(),t=setTimeout(()=>c.abort(),8000);
  try{
   const r=await fetch(u.toString(),{method:'GET',redirect:'follow',headers:{accept:'text/html,application/xhtml+xml,application/json,text/plain;q=.9,*/*;q=.5'},signal:c.signal});
   const final=new URL(r.url||u.toString());
   const ct=String(r.headers.get('content-type')||'');
   const textBody=(await r.text()).slice(0,200000);
   const notFound=/\b(404|page not found|not found|does not exist)\b/i.test(textBody.slice(0,8000))&&r.status===404;
   const pass=r.status>=200&&r.status<400&&safeHost(final.hostname)&&!notFound&&textBody.length>80;
   return {pass,status:r.status,contentType:ct,finalUrl:final.toString(),host:final.hostname,bytes:textBody.length,retrievedAt:new Date().toISOString(),reason:pass?'official_page_reachable':'official_page_unverified'};
  }finally{clearTimeout(t)}
 }catch(e){return {pass:false,reason:'official_fetch_failed',error:String(e?.message||e),status:null,finalUrl:'',retrievedAt:new Date().toISOString()}}
}
async function openai(env,prompt){
 if(!env.OPENAI_API_KEY)return null;
 const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+env.OPENAI_API_KEY},body:JSON.stringify({model:env.ASTRA_MODEL||'gpt-5-mini',messages:[{role:'system',content:'You are Astra, one brain of Javidan Trinity. Analyze crypto opportunities and transaction metadata. Return JSON only: verdict (ALLOW|REVIEW|BLOCK), risk (0-100), confidence (0-1), reasons (array), actions (array). Never request or infer seed/private key. Missing or contradictory evidence is risk.'},{role:'user',content:prompt}],temperature:.1})});
 if(!r.ok)throw Error('astra_'+r.status);const d=await r.json();return extract(d?.choices?.[0]?.message?.content);
}
async function claude(env,prompt){
 if(!env.ANTHROPIC_API_KEY)return null;
 const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:env.CLAUDE_MODEL||'claude-sonnet-4-5',max_tokens:700,system:'You are Claude, the independent adversarial security brain of Javidan Trinity. Hunt phishing, drainer, approval, fake-airdrop and evidence failures. Return JSON only: verdict, risk, confidence, reasons, actions.',messages:[{role:'user',content:prompt}]})});
 if(!r.ok)throw Error('claude_'+r.status);const d=await r.json();return extract(d?.content?.map(x=>x.text||'').join(''));
}
async function gemini(env,prompt){
 if(!env.GEMINI_API_KEY)return null;
 const model=env.GEMINI_MODEL||'gemini-2.5-flash',url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent?key='+encodeURIComponent(env.GEMINI_API_KEY);
 const schema={type:'object',properties:{verdict:{type:'string',enum:['ALLOW','REVIEW','BLOCK']},risk:{type:'integer',minimum:0,maximum:100},confidence:{type:'number',minimum:0,maximum:1},reasons:{type:'array',items:{type:'string'}},actions:{type:'array',items:{type:'string'}}},required:['verdict','risk','confidence','reasons','actions']};
 const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:'You are Gemini, the verification and evidence brain of Javidan Trinity. Independently verify the supplied metadata. Missing or contradictory evidence means REVIEW or BLOCK. Never ask for secrets. '+prompt}]}],generationConfig:{responseMimeType:'application/json',responseSchema:schema}})});
 if(!r.ok)throw Error('gemini_'+r.status);const d=await r.json();return extract(d?.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join(''));
}
function gate(input,brains,evidence){
 const vals=brains.filter(Boolean),hard=['seed_phrase','private_key','unlimited_approval','arbitrary_recipient','undecodable_calldata','unknown_contract_function'],flags=input.riskFlags||[];
 if(!evidence?.pass||flags.some(f=>hard.includes(f)))return {verdict:'BLOCK',reason:evidence?.pass?'deterministic_javidan_gate':'official_evidence_gate',risk:100};
 if(!vals.length)return {verdict:'REVIEW',reason:'no_brain_available',risk:100};
 const blocked=vals.filter(x=>x.verdict==='BLOCK').length,review=vals.filter(x=>x.verdict==='REVIEW').length,risk=Math.max(...vals.map(x=>Number(x.risk)||0));
 if(blocked>0)return {verdict:'BLOCK',reason:'one_brain_blocked',risk};
 if(review>0||risk>=70)return {verdict:'REVIEW',reason:'independent_review_required',risk};
 return {verdict:'ALLOW',reason:'three_brain_consensus',risk};
}
export default async(request)=>{if(request.method==='OPTIONS')return new Response(null,{status:204,headers:H});if(request.method!=='POST')return json({ok:false,error:'method_not_allowed'},405);try{
 const body=await request.json();const input=safeInput(body?.opportunity||body);const evidence=await verifyOfficial(input.url);const secured={...input,officialVerified:evidence.pass,evidencePass:evidence.pass,officialEvidence:evidence};
 const prompt=JSON.stringify(secured);
 const [a,c,g]=await Promise.allSettled([openai(Netlify.env,prompt),claude(Netlify.env,prompt),gemini(Netlify.env,prompt)]);
 const pick=x=>x.status==='fulfilled'?x.value:null;
 const brains={astra:pick(a),claude:pick(c),gemini:pick(g)};
 const errors=[a,c,g].filter(x=>x.status==='rejected').map(x=>String(x.reason?.message||x.reason)).slice(0,3);
 const decision=gate(secured,Object.values(brains),evidence);
 return json({ok:true,engine:'JAVIDAN-TRINITY',version:'1.1.0',decision,evidence,brains,errors,safety:{readOnly:true,noPrivateKeys:true,noSeedPhrase:true,noAutoSign:true,userApprovalRequired:true}});
}catch(e){return json({ok:false,error:'trinity_failure',message:String(e?.message||e)},502)}};
export const config={path:'/api/javidan/trinity'};