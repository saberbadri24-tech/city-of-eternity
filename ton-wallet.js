(()=>{'use strict';
const manifest='https://city-of-eternity.vercel.app/tonconnect-manifest.json';
function boot(){
 if(!window.TON_CONNECT_UI)return setTimeout(boot,300);
 const root=document.getElementById('ton-connect'); if(!root)return;
 const ui=new TON_CONNECT_UI.TonConnectUI({manifestUrl:manifest});
 ui.uiOptions={language:'en',uiPreferences:{theme:TON_CONNECT_UI.THEME.DARK}};
 const fallback=document.getElementById('ton-connect-fallback');
 if(fallback)fallback.onclick=()=>ui.openModal();
 root.innerHTML='';
 ui.onStatusChange(wallet=>{
  const out=document.getElementById('ton-wallet-status');
  const btn=document.getElementById('ton-connect-fallback');
  if(!out)return;
  if(wallet){const a=wallet.account?.address||'';out.textContent='TON وصل شد · '+a.slice(0,6)+'…'+a.slice(-6);out.dataset.address=a;if(btn)btn.textContent='کیف پول متصل است';}
  else {out.textContent='کیف پول TON وصل نیست';out.dataset.address='';if(btn)btn.textContent='اتصال کیف پول TON';}
 });
 window.anilXTonConnect=ui;
}
boot();
})();
