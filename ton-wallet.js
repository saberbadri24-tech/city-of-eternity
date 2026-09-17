(()=>{'use strict';
const manifest='https://city-of-eternity.vercel.app/tonconnect-manifest.json';
function boot(){
 if(!window.TON_CONNECT_UI)return setTimeout(boot,300);
 const root=document.getElementById('ton-connect'); if(!root)return;
 const ui=new TON_CONNECT_UI.TonConnectUI({manifestUrl:manifest,buttonRootId:'ton-connect'});
 ui.uiOptions={language:'en',uiPreferences:{theme:TON_CONNECT_UI.THEME.DARK}};
 root.innerHTML='<button id="anil-ton-connect-btn" type="button" style="padding:14px 24px;border:0;border-radius:14px;background:#d8b45a;color:#17130b;font-weight:800;font-size:16px;cursor:pointer">اتصال کیف پول TON</button>';
 document.getElementById('anil-ton-connect-btn').onclick=()=>ui.openModal();
 ui.onStatusChange(wallet=>{
  const out=document.getElementById('ton-wallet-status');
  const btn=document.getElementById('anil-ton-connect-btn');
  if(!out)return;
  if(wallet){const a=wallet.account?.address||'';out.textContent='TON وصل شد · '+a.slice(0,6)+'…'+a.slice(-6);out.dataset.address=a;if(btn)btn.textContent='کیف پول متصل است';}
  else {out.textContent='کیف پول TON وصل نیست';out.dataset.address='';if(btn)btn.textContent='اتصال کیف پول TON';}
 });
 window.anilXTonConnect=ui;
}
boot();
})();
