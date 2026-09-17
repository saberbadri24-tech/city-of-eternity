(()=>{'use strict';
const MANIFEST='https://saberbadri24-tech.github.io/city-of-eternity/tonconnect-manifest.json';
const CDN='https://unpkg.com/@tonconnect/ui@latest/dist/tonconnect-ui.min.js';
function init(){
 const button=document.getElementById('ton-connect-fallback');
 if(!button||!window.TON_CONNECT_UI?.TonConnectUI)return false;
 if(window.anilXTonConnect)return true;
 try{
  const ui=new TON_CONNECT_UI.TonConnectUI({manifestUrl:MANIFEST});
  window.anilXTonConnect=ui;
  const root=document.getElementById('ton-connect');
  if(root)root.style.display='none';
  button.onclick=()=>ui.openModal();
  ui.onStatusChange(wallet=>{
   const out=document.getElementById('ton-wallet-status');
   const address=wallet?.account?.address||'';
   if(out){out.textContent=address?'TON وصل شد · '+address.slice(0,6)+'…'+address.slice(-6):'کیف پول TON وصل نیست';out.dataset.address=address;}
   button.textContent=address?'کیف پول TON متصل است':'اتصال کیف پول TON';
  });
  return true;
 }catch(e){console.error('ANIL X TON Connect:',e);button.textContent='خطا در اتصال کیف پول';return false;}
}
function load(){
 if(init())return;
 if(document.querySelector('script[data-tonconnect-loader]'))return;
 const s=document.createElement('script');s.src=CDN;s.async=true;s.dataset.tonconnectLoader='1';
 s.onload=()=>{if(!init())console.error('ANIL X: TON Connect UI failed to initialize');};
 s.onerror=()=>console.error('ANIL X: TON Connect UI CDN failed');
 document.head.appendChild(s);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();
