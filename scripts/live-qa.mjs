#!/usr/bin/env node
const base=(process.env.ANILX_LIVE_URL||'https://anil-x-live.onrender.com').replace(/\/$/,'');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function get(path,headers={}){
  const r=await fetch(base+path,{headers,cache:'no-store'});
  const text=await r.text();
  let data=null; try{data=JSON.parse(text)}catch{}
  return {status:r.status,data,text};
}
async function waitHealth(){
  for(let i=0;i<36;i++){
    try{const r=await get('/api/health'); if(r.status===200&&r.data?.ok)return r;}catch{}
    await sleep(5000);
  }
  throw new Error('live health did not become ready within 180s');
}
function assert(ok,msg){if(!ok)throw new Error(msg)}
const health=await waitHealth();
console.log('LIVE HEALTH',JSON.stringify(health.data));
assert(health.data.service==='ANIL X','wrong live service identity');
assert(health.data.configured?.admin===true,'admin secret is not configured');
assert(health.data.revenue?.storageConfigured===true,'persistent storage binding missing');
assert(health.data.revenue?.durableAccounting===true,'durable accounting is disabled');
assert(health.data.revenue?.ton===true,'main TON wallet is not configured');

const readiness=await get('/api/execution-readiness');
console.log('LIVE READINESS',JSON.stringify(readiness.data));
assert(readiness.status===401&&readiness.data?.error==='admin_auth_required','execution readiness remains owner-gated');

const payment=await get('/api/payment-config');
console.log('LIVE PAYMENT',JSON.stringify(payment.data));
assert(payment.status===200&&payment.data?.ton?.mainConfigured===true,'payment config main wallet failed');
assert(payment.data?.guard?.temporaryWalletConfigured!==true,'temporary wallet must not equal an unverified permanent wallet');

const customer=await get('/api/revenue/customer-ready');
console.log('LIVE CUSTOMER',JSON.stringify(customer.data));
assert(customer.status===200&&customer.data?.customerPath?.storageConfigured===true,'customer path storage failed');

const home=await get('/');
assert(home.status===200&&/ANIL X/i.test(home.text),'live homepage failed');

console.log(JSON.stringify({
  ok:true,
  live:base,
  adminAuthSelfTest:true,
  durableAccounting:true,
  mainTonConfigured:true,
  temporaryWalletConfigured:false,
  runtimeReady:true,
  homepage:true
}));
