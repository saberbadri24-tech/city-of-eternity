const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*'}});
export default async(req,env={})=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204});
 if(req.method!=='POST')return json({ok:false,error:'method_not_allowed'},405);
 if(!env.OPENAI_API_KEY)return json({ok:false,error:'voice_not_configured'},503);
 try{const b=await req.json();const input=String(b.text||'').trim().slice(0,4000);if(!input)return json({ok:false,error:'text_required'},400);const r=await fetch('https://api.openai.com/v1/audio/speech',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+env.OPENAI_API_KEY},body:JSON.stringify({model:env.VOICE_MODEL||'gpt-4o-mini-tts',voice:env.VOICE_NAME||'alloy',input,format:'mp3'})});if(!r.ok)return json({ok:false,error:'voice_provider_failed',providerStatus:r.status},502);const bytes=new Uint8Array(await r.arrayBuffer());let s='';for(const x of bytes)s+=String.fromCharCode(x);return new Response(JSON.stringify({ok:true,mimeType:'audio/mpeg',audioBase64:btoa(s)}),{headers:{'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*'}})}catch(e){return json({ok:false,error:'voice_error',message:String(e?.message||e)},500)}
};
export const config={path:'/api/voice'};
