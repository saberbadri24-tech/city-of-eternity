const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*'}});

function validAddress(a){return /^(?:EQ|UQ)[A-Za-z0-9_-]{46}$/.test(String(a||''));}

export default async function tonApi(req){
  const u=new URL(req.url);
  const address=String(u.searchParams.get('address')||'').trim();
  if(!validAddress(address)) return json({ok:false,error:'invalid_ton_address'},400);
  const mode=u.pathname.endsWith('/account')?'account':'transactions';
  const endpoint=mode==='account'
    ? 'https://tonapi.io/v2/accounts/'+encodeURIComponent(address)
    : 'https://tonapi.io/v2/blockchain/accounts/'+encodeURIComponent(address)+'/transactions?limit=20';
  try{
    const r=await fetch(endpoint,{headers:{accept:'application/json'}});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)return json({ok:false,error:'ton_provider_'+r.status},502);
    if(mode==='account')return json({ok:true,address,balance:String(d.balance||0),raw:d});
    const txs=Array.isArray(d.transactions)?d.transactions:[];
    return json({ok:true,address,transactions:txs.map(t=>{
      const incoming=BigInt(t?.in_msg?.value||0);
      const outgoing=Array.isArray(t?.out_msgs)?t.out_msgs.reduce((s,m)=>s+BigInt(m?.value||0),0n):0n;
      return {hash:t?.hash||'',utime:t?.utime||0,amount:(incoming-outgoing).toString()};
    })});
  }catch(e){return json({ok:false,error:'ton_provider_unreachable'},502)}
}
export const config={path:'/api/ton/:mode'};
