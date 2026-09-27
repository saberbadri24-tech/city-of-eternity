(()=>{'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const MANIFEST=location.hostname.endsWith('onrender.com')?location.origin+'/render-tonconnect-manifest.json':'https://saberbadri24-tech.github.io/city-of-eternity/tonconnect-manifest.json';
let tonUI=null,wallet=null,temporaryWalletAddress='',guardStatus={},opportunities=[],displayLimit=100;

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fa=n=>String(n??0).replace(/\d/g,x=>'۰۱۲۳۴۵۶۷۸۹'[x]);
const normAddr=a=>String(a||'').replace(/-/g,'_').replace(/=/g,'').toUpperCase();
const validTon=a=>/^[EU]Q[A-Za-z0-9_-]{46}$/.test(String(a||''));

function go(id){$('.section').forEach(x=>x.classList.toggle('active',x.id===id));$('.nav').forEach(x=>x.classList.toggle('active',x.dataset.section===id));history.replaceState(null,'','#'+id);if(id==='opportunities')renderOpp();if(id==='receipts')loadTx();if(id==='wallets')renderWalletDetail();if(id==='reports')loadReport()}
$$('.nav').forEach(b=>b.addEventListener('click',()=>go(b.dataset.section)));
$$('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
window.goGuardSection=go;

function initTon(){
 if(tonUI||!window.TonConnectUI)return;
 tonUI=new TonConnectUI({manifestUrl:MANIFEST,buttonRootId:'tonRoot',analytics:{mode:'off'}});
 tonUI.setConnectionNetwork?.('-239');
 tonUI.onStatusChange(a=>{wallet=a||null;renderWallet();loadTx();updateTransferState()});
 tonUI.connectionRestored?.then(()=>{wallet=tonUI.wallet||wallet;renderWallet();loadAccount();loadTx();updateTransferState()}).catch(()=>{});
}
async function connect(){initTon();if(!tonUI){alert('TON Connect بارگذاری نشده است.');return}if(wallet)await tonUI.disconnect();else await tonUI.openModal()}
function addr(){return String(wallet?.account?.address||'')}
function mainWallet(){return String(localStorage.getItem('anilx.mainWallet')||'')}

async function loadJson(path){
 const r=await fetch(path+'?t='+Date.now(),{cache:'no-store'});
 if(!r.ok)throw Error(path+' HTTP '+r.status);
 return r.json();
}
async function loadGuardWalletConfig(){
 try{const d=await loadJson('guard-wallet.json');temporaryWalletAddress=String(d.temporaryWalletAddress||'');renderWallet();updateTransferState()}catch(_){}
}
async function api(kind,address){
 const r=await fetch('/api/ton/'+kind+'?address='+encodeURIComponent(address),{cache:'no-store'});
 const j=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(j.error||'TON API HTTP '+r.status);
 if(kind==='account')return {ok:true,balance:String(j.balance||0),raw:j};
 const txs=Array.isArray(j.transactions)?j.transactions:[];
 return {ok:true,transactions:txs.map(t=>({hash:t.hash||'',utime:t.utime||0,amount:Number(t.amount||0)}))};
}
async function loadAccount(){
 const m=mainWallet();
 try{
  const [temp,main]=await Promise.all([
   temporaryWalletAddress?api('account',temporaryWalletAddress):Promise.resolve({balance:'0'}),
   m?api('account',m):Promise.resolve({balance:'0'})
  ]);
  $('#tempBalance').textContent=(Number(temp.balance||0)/1e9).toFixed(4);
  $('#mainBalance').textContent=(Number(main.balance||0)/1e9).toFixed(4);
  $('#lastCheck').textContent='آخرین بررسی: '+new Date().toLocaleTimeString('fa-IR');
  renderWalletDetail(addr()?await api('account',addr()):null);
  updateTransferState(Number(temp.balance||0)/1e9);
 }catch(e){$('#lastCheck').textContent='خطا در خواندن موجودی: '+e.message}
}
function renderWallet(){
 const a=addr(),m=mainWallet();
 $('#tempAddress').textContent=temporaryWalletAddress||'کیف دریافت تنظیم نشده';
 $('#mainAddress').textContent=m||'کیف اصلی هنوز ثبت نشده';
 $$('#connectBtn,#connectBtn2').forEach(b=>b.textContent=a?'قطع/اتصال مجدد کیف':'اتصال کیف پول');
 if(a)loadAccount();else{$('#tempBalance').textContent='0.00';$('#mainBalance').textContent='0.00';$('#txRows').innerHTML='<div class="muted">کیف متصل نیست.</div>'}
 updateTransferState();
}
function renderWalletDetail(d){
 if(!$('#walletDetail'))return;
 const a=addr();
 $('#walletDetail').innerHTML=a?'<div class="wallet" style="margin-top:14px"><b>آدرس عمومی متصل</b><div class="address">'+esc(a)+'</div><div class="balance">'+(Number(d?.balance||0)/1e9).toFixed(4)+' TON</div><p class="muted">خواندن فقط‌خواندنی؛ کلید خصوصی در ANIL X وجود ندارد.</p></div>':'<p class="muted">هنوز کیف متصل نشده است.</p>';
}
async function loadTx(){
 const box=$('#txRows');
 if(!box||!addr()){if(box)box.innerHTML='<div class="muted">ابتدا کیف را متصل کن.</div>';return}
 box.innerHTML='<div class="muted">در حال خواندن زنجیره…</div>';
 try{
  const d=await api('transactions',addr()),rows=Array.isArray(d.transactions)?d.transactions:[];
  const html=rows.slice(0,30).map(x=>{const ts=x.utime?new Date(x.utime*1000).toLocaleString('fa-IR'):'—';const amount=Number(x.amount||0)/1e9;return '<div class="row"><span>'+esc(ts)+'<br><small>'+esc(x.hash||'')+'</small></span><b class="'+(amount>=0?'ok':'warn')+'">'+(amount>=0?'+':'')+amount.toFixed(4)+' TON</b></div>'}).join('');
  box.innerHTML=html||'<div class="muted">تراکنشی پیدا نشد.</div>';if($('#receiptRows'))$('#receiptRows').innerHTML=box.innerHTML;
 }catch(e){box.innerHTML='<div class="err">خواندن تراکنش‌ها ناموفق بود: '+esc(e.message)+'</div>'}
}
function renderMetrics(){
 const c=guardStatus.counts||{},a=guardStatus.automation||{};
 const set=(id,v)=>{if($(id))$(id).textContent=fa(v)};
 set('#gOpps',c.opportunities||opportunities.length);set('#gVerified',c.verificationChecked||0);set('#gAligned',c.verificationReachableAligned||0);set('#gNew',guardStatus.newOrChangedCount||0);
 if($('#gAi'))$('#gAi').innerHTML=['Astra','Claude','Gemini'].map(n=>'<span class="'+((a['liveExternal'+n]||false)?'ok':'warn')+'">'+n+': '+((a['liveExternal'+n]||false)?'LIVE':'fallback/off')+'</span>').join(' · ');
 if($('#gBlockers'))$('#gBlockers').textContent=(guardStatus.blockers||[]).length?guardStatus.blockers.map(x=>typeof x==='string'?x:(x.source+' '+(x.httpStatus??''))).join(' · '):'بدون blocker ثبت‌شده';
 if($('#gSecurity'))$('#gSecurity').textContent=(a.automaticSigning||a.automaticTransfer||a.privateKeyStorage)?'هشدار امنیتی':'مرز مالک فعال · بدون امضای خودکار';
}
async function loadStatus(){
 try{guardStatus=await loadJson('guard-status.json');renderMetrics()}catch(e){if($('#gBlockers'))$('#gBlockers').textContent='وضعیت Guard در دسترس نیست.'}
}
async function loadOpp(){
 try{
  const sources=['guard-opportunities.json','guard-high-value.json','guard-discovery.json'];
  let best=null;
  for(const p of sources){try{const d=await loadJson(p);if(Array.isArray(d.items)&&d.items.length){best=d;break}if(Array.isArray(d.ranked)&&d.ranked.length){best=d;break}}catch(_){}}
  const rows=Array.isArray(best?.items)?best.items:Array.isArray(best?.ranked)?best.ranked:[];
  opportunities=rows.slice().sort((a,b)=>Number(b.score||0)-Number(a.score||0));
  renderOpp();renderMetrics();
 }catch(e){if($('#opportunityRows'))$('#opportunityRows').innerHTML='<div class="err">داده Guard خوانده نشد: '+esc(e.message)+'</div>'}
}
function oppCard(x,i){
 const link=x.resolvedUrl||x.officialUrl||x.url||x.sourceUrl||'';
 const id=x.id||x.opportunityId||('opp-'+i);
 const official=x.officialVerified||x.executionGate==='OWNER_APPROVAL_REQUIRED'||x.ownerApprovalRequired;
 return '<div class="row"><span><b>'+fa(i+1)+'. '+esc(x.title||x.name||'فرصت')+'</b><br><small>'+esc(x.resolvedDomain||x.officialDomain||x.publisher||x.source||'منبع')+' · امتیاز '+fa(x.score||0)+'</small>'+(x.reward?'<br><small>پاداش: '+esc(x.reward)+'</small>':'')+(x.deadline?'<br><small>مهلت: '+esc(x.deadline)+'</small>':'')+(link?'<br><a target="_blank" rel="noopener noreferrer" href="'+esc(link)+'" style="color:#e9bc4c">منبع رسمی ↗</a>':'')+'<br><button class="btn guard-approve" data-oid="'+esc(id)+'" data-url="'+esc(link)+'">صف تأیید مالک</button></span><b class="'+(official?'warn':'ok')+'">'+esc(x.executionGate||x.action||'REVIEW')+'</b></div>';
}
function renderOpp(){
 const box=$('#opportunityRows');if(!box)return;
 let rows=opportunities.slice();
 const q=String($('#oppSearch')?.value||'').toLowerCase();
 const f=$('#oppFilter')?.value||'all';
 rows=rows.filter(x=>(String(x.title||x.name||'')+' '+String(x.domain||x.publisher||x.source||'')).toLowerCase().includes(q));
 rows=rows.filter(x=>f==='all'||(f==='high'&&Number(x.score||0)>=70)||(f==='official'&&x.officialVerified)||(f==='ton'&&/ton/i.test(JSON.stringify(x))));
 if(displayLimit!=='all')rows=rows.slice(0,Number(displayLimit));
 box.innerHTML=rows.length?rows.map(oppCard).join(""):'<div class="muted">فعلاً موردی برای نمایش نیست.</div>';
 if($('#oppCount'))$('#oppCount').textContent=fa(rows.length)+' مورد';
}
async function loadReport(){
 try{const r=await fetch('/api/guard/report',{cache:'no-store'});const d=await r.json();if(d.ok&&$('#reportBox'))$('#reportBox').textContent='صف بررسی مالک: '+d.counts.approvals+' · صف فعال: '+d.counts.queued+' · امضای خودکار: خاموش · انتقال خودکار: خاموش';}
 catch(_){if($('#reportBox'))$('#reportBox').textContent='گزارش زنده API در دسترس نیست؛ وضعیت فایل Guard نمایش داده می‌شود.'}
}
async function queueApproval(oid,url){
 try{
  const r=await fetch('/api/guard/approval',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({opportunityId:oid,url,action:'VERIFY_AND_REVIEW'})});
  const d=await r.json().catch(()=>({}));
  if(r.status===401){localStorage.setItem('anilx.pendingGuardApproval',JSON.stringify({opportunityId:oid,url}));location.href='admin.html#approvalGrid';return}
  if(!r.ok)throw Error(d.error||'ثبت بررسی ناموفق بود');
  alert('فرصت در صف بررسی مالک ثبت شد.');await loadReport();
 }catch(e){alert(e.message||'خطا')}
}
function updateTransferState(balance){
 const main=mainWallet(),connected=addr(),same=!!temporaryWalletAddress&&!!connected&&normAddr(temporaryWalletAddress)===normAddr(connected);
 const amount=Number($('#amountInput')?.value||0);
 const n=Math.round(amount*1e9);
 let msg='برای انتقال از کیف موقت، همان آدرس موقت را با TON Connect وصل کن؛ کیف اصلی ذخیره‌شده مقصد خواهد بود.';
 if(!temporaryWalletAddress)msg='کیف موقت Guard تنظیم نشده است.';
 else if(!main)msg='ابتدا کیف اصلی را ثبت کن.';
 else if(connected&&!same)msg='کیف متصل فعلاً با کیف موقت یکسان نیست.';
 else if(same)msg='کیف موقت متصل است؛ انتقال فقط با امضای مالک انجام می‌شود.';
 if($('#transferState'))$('#transferState').textContent=msg;
 const b=$('#transferBtn');if(b)b.disabled=!(same&&validTon(main)&&Number.isFinite(amount)&&amount>0&&Number.isSafeInteger(n));
}
async function transfer(){
 initTon();
 const to=mainWallet(),amount=Number($('#amountInput').value),n=Math.round(amount*1e9);
 if(!validTon(to)){$('#transferNotice').textContent='ابتدا یک آدرس TON اصلی معتبر ثبت کن.';return}
 if(!temporaryWalletAddress||!validTon(temporaryWalletAddress)){$('#transferNotice').textContent='آدرس کیف موقت معتبر تنظیم نشده است.';return}
 if(!wallet||normAddr(addr())!==normAddr(temporaryWalletAddress)){$('#transferNotice').textContent='ابتدا خود کیف موقت را با TON Connect وصل کن.';return}
 if(!Number.isFinite(amount)||amount<=0||!Number.isSafeInteger(n)){$('#transferNotice').textContent='مقدار TON معتبر نیست.';return}
 try{
  const info=await api('account',temporaryWalletAddress),available=Number(info.balance||0)/1e9;
  if(available>0&&amount>Math.max(0,available-0.05)){$('#transferNotice').textContent='مقدار انتقال از موجودی کیف موقت پس از ذخیره کارمزد بیشتر است.';return}
 }catch(_){}
 if(!confirm('انتقال از کیف موقت به کیف اصلی برگشت‌پذیر نیست. مقصد و مقدار را بررسی کن؛ کیف موقت برای امضا باز شود؟'))return;
 $('#transferNotice').textContent='در انتظار تأیید کیف پول…';
 try{
  const res=await tonUI.sendTransaction({validUntil:Math.floor(Date.now()/1000)+300,messages:[{address:to,amount:String(n)}],network:'-239'});
  $('#transferNotice').innerHTML='<span class="ok">درخواست انتقال به کیف پول ارسال شد.</span> '+(res?.boc?'BOC دریافت شد؛ نهایی‌شدن شبکه را بررسی کن.':'پاسخ کیف پول دریافت شد.');
  await loadAccount();
 }catch(e){$('#transferNotice').innerHTML='<span class="err">انتقال لغو شد/ناموفق بود: '+esc(e.message||e)+'</span>'}
}
function saveMain(){
 if(!validTon(addr())){alert('ابتدا کیف اصلی را با TON Connect وصل کن.');return}
 localStorage.setItem('anilx.mainWallet',addr());renderWallet();alert('کیف متصل به‌عنوان کیف اصلی ثبت شد.');updateTransferState()
}
$('#connectBtn')?.addEventListener('click',connect);$('#connectBtn2')?.addEventListener('click',connect);$('#connectTempBtn')?.addEventListener('click',connect);$('#saveMainBtn')?.addEventListener('click',saveMain);
$('#historyBtn')?.addEventListener('click',loadTx);$('#historyBtn2')?.addEventListener('click',loadTx);$('#scanBtn')?.addEventListener('click',loadOpp);
$('#transferBtn')?.addEventListener('click',transfer);$('#amountInput')?.addEventListener('input',()=>updateTransferState());
$('#displayLimit')?.addEventListener('change',e=>{displayLimit=e.target.value;renderOpp()});$('#oppSearch')?.addEventListener('input',renderOpp);$('#oppFilter')?.addEventListener('change',renderOpp);
document.addEventListener('click',e=>{const b=e.target.closest('.guard-approve');if(b)queueApproval(b.dataset.oid,b.dataset.url||'')});
$('#clearLocal')?.addEventListener('click',()=>{localStorage.removeItem('anilx_admin_chat');localStorage.removeItem('anilx.pendingGuardApproval');alert('وضعیت محلی رابط پاک شد.')});
if(location.hash&&document.getElementById(location.hash.slice(1)))go(location.hash.slice(1));
initTon();loadGuardWalletConfig();loadStatus();loadOpp();setInterval(()=>{loadStatus();if(addr()){loadAccount();loadTx()}},30000);
})();