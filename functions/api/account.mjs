import { getStore } from '@netlify/blobs';
const store=()=>getStore('anil-x-accounts');
const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*'}});
const clean=v=>String(v??'').trim().slice(0,160);
export default async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204});
 try{
  const b=req.method==='POST'?await req.json():{};
  const id=clean(b.id||new URL(req.url).searchParams.get('id')).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,100);
  if(!id)return json({ok:false,error:'id_required'},400);
  const old=await store().getJSON('users/'+id)||{};
  const profile={...old.profile,...(b.profile||{})};
  const record={id,profile,createdAt:old.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
  await store().setJSON('users/'+id,record);
  return json({ok:true,account:record});
 }catch(e){return json({ok:false,error:'account_error',message:String(e?.message||e)},500)}
};
export const config={path:'/api/account'};
