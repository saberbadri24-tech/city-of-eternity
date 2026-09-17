(()=>{'use strict';
const manifest='https://city-of-eternity.vercel.app/tonconnect-manifest.json';
function boot(){
 if(!window.TON_CONNECT_UI)return setTimeout(boot,300);
 const root=document.getElementById('ton-connect'); if(!root)return;
 const ui=new TON_CONNECT_UI.TonConnectUI({manifestUrl:manifest,buttonRootId:'ton-connect'});
 ui.uiOptions={language:'en',uiPreferences:{theme:TON_CONNECT_UI.THEME.DARK}};
 ui.onStatusChange(wallet=>{
  const out=document.getElementById('ton-wallet-status');
  if(!out)return;
  if(wallet){const a=wallet.account?.address||'';out.textContent='TON وصل شد · '+a.slice(0,6)+'…'+a.slice(-6);out.dataset.address=a;}
  else {out.textContent='کیف پول TON وصل نیست';out.dataset.address='';}
 });
 window.anilXTonConnect=ui;
}
boot();
})();
