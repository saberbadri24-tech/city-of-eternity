const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*'}});
export default async(req,env={})=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204});
 if(req.method!=='POST')return json({ok:false,error:'method_not_allowed'},405);
 if(!env.OPENAI_API_KEY)return json({ok:false,error:'vision_not_configured'},503);
 try{const b=await req.json();const dataUrl=String(b.dataUrl||'');if(!/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(dataUrl))return json({ok:false,error:'image_data_required'},400);const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+env.OPENAI_API_KEY},body:JSON.stringify({model:env.VISION_MODEL||'gpt-4.1-mini',messages:[{role:'system',content:'You are ANIL X Vision. Describe and analyze the user supplied image accurately. Do not invent unreadable details. Return concise Persian unless the user asks otherwise.'},{role:'user',content:[{type:'text',text:String(b.prompt||'این تصویر را برای من تحلیل کن.')} ,{type:'image_url',image_url:{url:dataUrl}}]}],max_tokens:900})});if(!r.ok)return json({ok:false,error:'vision_provider_failed',providerStatus:r.status},502);const d=await r.json();return json({ok:true,reply:d?.choices?.[0]?.message?.content||'',model:env.VISION_MODEL||'gpt-4.1-mini'})}catch(e){return json({ok:false,error:'vision_error',message:String(e?.message||e)},500)}
};
export const config={path:'/api/vision'};
