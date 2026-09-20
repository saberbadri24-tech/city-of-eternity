import { getStore } from '@netlify/blobs';
const store=()=>getStore('anil-x-orders');
const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*'}});
export default async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204});
 try{
  if(req.method==='POST'){const b=await req.json();const id=crypto.randomUUID();const order={id,accountId:String(b.accountId||'guest').slice(0,100),service:String(b.service||'custom').slice(0,120),description:String(b.description||'').slice(0,1000),currency:String(b.currency||'USD').slice(0,8),amount:Number(b.amount||0),status:'pending',createdAt:new Date().toISOString()};if(!Number.isFinite(order.amount)||order.amount<0)return json({ok:false,error:'invalid_amount'},400);await store().setJSON('orders/'+id,order);return json({ok:true,order})}
  const id=new URL(req.url).searchParams.get('id');if(!id)return json({ok:false,error:'id_required'},400);const order=await store().getJSON('orders/'+id);return order?json({ok:true,order}):json({ok:false,error:'not_found'},404);
 }catch(e){return json({ok:false,error:'order_error',message:String(e?.message||e)},500)}
};
export const config={path:'/api/order'};
