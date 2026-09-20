import { getStore } from '@netlify/blobs';
const store=()=>getStore('anil-x-memory');
const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*'}});
const sid=v=>String(v||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,100);
export default async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204});
 const u=new URL(req.url),id=sid(u.searchParams.get('sessionId'));
 if(!id)return json({ok:false,error:'session_required'},400);
 try{
  if(req.method==='GET'){const x=await store().getJSON('sessions/'+id);return json({ok:true,sessionId:id,turns:Array.isArray(x?.turns)?x.turns.slice(-30):[],profile:x?.profile||{}})}
  if(req.method==='POST'){const b=await req.json();const old=await store().getJSON('sessions/'+id)||{};const turns=Array.isArray(b.turns)?b.turns.slice(-30):Array.isArray(old.turns)?old.turns.slice(-30):[];const profile=b.profile||old.profile||{};await store().setJSON('sessions/'+id,{turns,profile,updatedAt:new Date().toISOString()});return json({ok:true,sessionId:id,count:turns.length})}
  return json({ok:false,error:'method_not_allowed'},405)
 }catch(e){return json({ok:false,error:'memory_error',message:String(e?.message||e)},500)}
};
export const config={path:'/api/memory'};
