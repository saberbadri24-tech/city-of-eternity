(()=>{'use strict';
const CDN='https://unpkg.com/@tonconnect/ui@3.0.2/dist/tonconnect-ui.min.js';
const MANIFEST=location.hostname.endsWith('onrender.com')
 ? location.origin+'/render-tonconnect-manifest.json'
 : 'https://saberbadri24-tech.github.io/city-of-eternity/tonconnect-manifest.json';
function start(){
 if(!window.TON_CONNECT_UI?.TonConnectUI)return false;
 let host=document.querySelector('#ton-connect');
 if(!host){host=document.createElement('div');host.id='ton-connect';const target=document.querySelector('.top-actions');if(target)target.prepend(host);else document.body.appendChild(host)}
 host.style.cssText='min-width:155px;display:flex;align-items:center;justify-content:center;direction:ltr';
 try{
  if(window.anilXTonConnect)return true;
  const ui=new window.TON_CONNECT_UI.TonConnectUI({manifestUrl:MANIFEST,buttonRootId:'ton-connect',analytics:{mode:'off'}});
  window.anilXTonConnect=ui;
  ui.setConnectionNetwork?.('-239');
  ui.onStatusChange?.(wallet=>{document.documentElement.dataset.tonWallet=wallet?.account?.address?'connected':'disconnected';window.dispatchEvent(new CustomEvent('anilx:wallet',{detail:wallet||null}));const button=host.querySelector('button');if(button)button.setAttribute('aria-label',wallet?.account?.address?'TON wallet connected':'Connect TON wallet')});
  ui.connectionRestored?.then(wallet=>{const w=ui.wallet||wallet;document.documentElement.dataset.tonWallet=w?.account?.address?'connected':'disconnected';window.dispatchEvent(new CustomEvent('anilx:wallet',{detail:w||null}))}).catch(e=>console.warn('TON connection restore',e));
  return true;
 }catch(e){console.error('ANIL X TON Connect',e);return false}
}
function load(){if(start())return;const s=document.createElement('script');s.src=CDN;s.async=true;s.onload=()=>{if(!start())console.error('TON Connect UI failed to initialize')};s.onerror=()=>console.error('TON Connect UI CDN failed');document.head.appendChild(s)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();