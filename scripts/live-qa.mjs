#!/usr/bin/env node
const base=(process.env.ANILX_LIVE_URL||'https://city-of-eternity.onrender.com').replace(/\/$/,'');
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
assert(health.data.service==='ANIL X','wrong live service identity');
assert(health.data.configured?.admin===true,'admin secret is not configured');
assert(health.data.revenue?.storageConfigured===true,'persistent storage binding missing');
assert(health.data.revenue?.durableAccounting===true,'durable accounting is disabled');
assert(health.data.revenue?.ton===true,'main TON wallet is not configured');

const oidcUrl=process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
const oidcToken=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
assert(oidcUrl&&oidcToken,'GitHub OIDC token environment is unavailable');
const u=new URL(oidcUrl);u.searchParams.set('audience','anil-x');
const ot=await fetch(u,{headers:{authorization:'bearer '+oidcToken,accept:'application/json'}});
assert(ot.ok,'GitHub OIDC token request failed');
const oj=await ot.json();
const bearer=oj.value;
assert(bearer,'GitHub OIDC token missing');

const self=await get('/api/admin/auth-self-test',{authorization:'Bearer '+bearer});
assert(self.status===200,'admin auth self-test HTTP '+self.status);
assert(self.data?.ok===true,'admin auth self-test failed');
assert(self.data?.secretExposed===false,'admin self-test exposed a secret');

const readiness=await get('/api/execution-readiness');
assert(readiness.status===200&&readiness.data?.execution?.runtime?.ready===true,'execution runtime readiness failed');
assert(readiness.data?.providers?.tonMain===true,'execution readiness does not see main TON wallet');
assert(readiness.data?.providers?.durableStore===true,'execution readiness does not see durable store');

const payment=await get('/api/payment-config');
assert(payment.status===200&&payment.data?.ton?.mainConfigured===true,'payment config main wallet failed');
assert(payment.data?.guard?.temporaryWalletConfigured!==true,'temporary wallet must not equal an unverified permanent wallet');

const customer=await get('/api/revenue/customer-ready');
assert(customer.status===200&&customer.data?.customerPath?.storageConfigured===true,'customer path storage failed');

const home=await get('/');
assert(home.status===200&&/ANIL X/i.test(home.text),'live homepage failed');

console.log(JSON.stringify({
  ok:true,
  live:base,
  adminAuthSelfTest:true,
  durableAccounting:true,
  mainTonConfigured:true,
  temporaryWalletSeparated:false,
  runtimeReady:true,
  homepage:true
}));
