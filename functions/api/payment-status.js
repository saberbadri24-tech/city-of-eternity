const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
export async function onRequestGet({request,env}){
 const u=new URL(request.url),orderId=String(u.searchParams.get('orderId')||'').trim().slice(0,120);
 if(!orderId)return json({ok:false,error:'missing_order_id'},400);
 if(!env.PAYMENTS)return json({ok:false,error:'payment_storage_not_configured'},503);
 try{
  const order=await env.PAYMENTS.get('orders/'+orderId,'json');
  if(!order)return json({ok:false,error:'order_not_found'},404);
  return json({ok:true,orderId:order.orderId,status:order.status,amount:order.amount,provider:order.provider,createdAt:order.createdAt,paidAt:order.paidAt||null,payUrl:order.payUrl||null});
 }catch(e){return json({ok:false,error:'payment_status_error',message:String(e?.message||e)},500)}
}