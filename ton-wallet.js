(()=>{'use strict';
const MANIFEST='https://saberbadri24-tech.github.io/city-of-eternity/tonconnect-manifest.json';
const CDN='https://unpkg.com/@tonconnect/ui@latest/dist/tonconnect-ui.min.js';
function start(){
 const root=document.getElementById('ton-connect');
 if(!root)return false;
 if(!window.TON_CONNECT_UI?.TonConnectUI)return false;
 if(window.anilXTonConnect)return true;
 try{
  const ui=new TON_CONNECT_UI.TonConnectUI({manifestUrl:MANIFEST,buttonRootId:'ton-connect'});
  window.anilXTonConnect=ui;
  ui.onStatusChange(wallet=>{
   const out=document.getElementById('ton-wallet-status');
   const button=document.getElementById('ton-connect-fallback');
   const address=wallet?.account?.address||'';
   if(out){out.textContent=address?'TON وصل شد · '+address.slice(0,6)+'…'+address.slice(-6):'کیف پول TON وصل نیست';out.dataset.address=address;}
   if(button)button.textContent=address?'کیف پول TON متصل است':'اتصال کیف پول TON';
  });
  return true;
 }catch(e){console.error('ANIL X TON Connect:',e);return false;}
}
function load(){
 if(start())return;
 if(document.querySelector('script[data-tonconnect]'))return;
 const s=document.createElement('script');s.src=CDN;s.async=true;s.dataset.tonconnect='1';
 s.onload=()=>{if(!start())console.error('ANIL X: TON Connect UI failed to initialize');};
 s.onerror=()=>console.error('ANIL X: TON Connect UI CDN failed');
 document.head.appendChild(s);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();
