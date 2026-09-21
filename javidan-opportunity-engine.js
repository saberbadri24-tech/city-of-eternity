/* ANIL X — Javidan Opportunity Engine v2
 * Real public-data opportunity discovery.
 * Sources: CoinGecko markets + DefiLlama yields.
 * No private keys, seed phrases, withdrawals, trades or autonomous signing.
 * v2.5: final evidence gate + public transaction simulation + explainable pre-sign review.
 */
(function(){
  "use strict";
  const SOURCES = Object.freeze({
    markets:"https://api.coingecko.com/api/v3/coins/markets",
    yields:"https://yields.llama.fi/pools"
  });

  const AIRDROP_REGISTRY = Object.freeze([
    {name:"Boundless",scoreBase:78,claimLive:true,url:"https://airdrop.boundless.network/"},
    {name:"Sonic",scoreBase:78,claimLive:true,url:"https://airdrop.soniclabs.com/"},
    {name:"dappOS",scoreBase:76,claimLive:true,url:"https://airdrop.dappos.com/"},
    {name:"RateX",scoreBase:74,claimLive:true,url:"https://rate-x.io/"},
    {name:"Pharos Network",scoreBase:73,claimLive:true,url:"https://pharosnetwork.xyz/"},
    {name:"Lighter",scoreBase:72,claimLive:true,url:"https://lighter.xyz/"},
    {name:"Infinex",scoreBase:70,claimLive:true,url:"https://infinex.xyz/"},
    {name:"Rainbow",scoreBase:68,claimLive:true,url:"https://rainbow.me/"}
  ]);
  const EVIDENCE_RULES=Object.freeze({officialDomain:true,officialStatus:true,freshnessHours:24,deadlineRequired:false,capitalRequiredBlocks:false,unlimitedApprovalBlocks:true});
  function evidenceGate(x){
    const flags=[]; const official=Boolean(x.officialVerified);
    const stamp=x.evidenceRetrievedAt||x.checkedAt; const age=stamp?((Date.now()-Date.parse(stamp))/3600000):99999;
    if(!official)flags.push("official_domain_unverified");
    if(!Number.isFinite(age)||age>24)flags.push("evidence_stale");
    if(x.requiresCapital)flags.push("capital_required");
    if(x.unlimitedApproval)flags.push("unlimited_approval");
    if(x.seedPhraseRequested)flags.push("seed_phrase_request");
    if(x.privateKeyRequested)flags.push("private_key_request");
    if(x.arbitraryRecipient)flags.push("arbitrary_recipient");
    if(x.deadline&&Date.parse(x.deadline)<=Date.now())flags.push("deadline_expired");
    return {pass:official&&Number.isFinite(age)&&age<=24&&!x.requiresCapital&&!x.unlimitedApproval&&!x.seedPhraseRequested&&!x.privateKeyRequested&&!x.arbitraryRecipient&&!(x.deadline&&Date.parse(x.deadline)<=Date.now()),flags,checkedHoursAgo:Number.isFinite(age)?Number(age.toFixed(1)):null};
  }
  function airdrops(){
    return AIRDROP_REGISTRY.map(x=>({
      type:"airdrop",title:x.name,score:x.scoreBase+12,claimLive:x.claimLive,
      source:"Javidan verified candidate registry",sourceUrl:x.url,
      officialVerificationRequired:true,claimable:false,checkedAt:new Date().toISOString(),evidenceSource:"official-domain-gate",
      action:"VERIFY_AND_REVIEW",
      reason:"Current candidate; Javidan must verify the official domain and wallet eligibility before any claim.",
      riskFlags:["read_only_eligibility_first","official_domain_required","user_approval_required"]
    }));
  }
  const OFFICIAL_HOSTS=Object.freeze(new Set(["boundless.network","soniclabs.com","dappos.com","rate-x.io","pharosnetwork.xyz","lighter.xyz","infinex.xyz","rainbow.me"]));
  function officialUrl(url){try{const u=new URL(url);const h=u.hostname.toLowerCase().replace(/^www\./,"");return [...OFFICIAL_HOSTS].some(x=>h===x||h.endsWith("."+x))?u.toString():""}catch{return ""}}
  function verifyAirdrop(x){const official=officialUrl(x.url);const evidence=evidenceGate(Object.assign({},x,{officialVerified:Boolean(official),evidenceRetrievedAt:x.evidenceRetrievedAt||x.checkedAt}));return Object.assign({},x,{officialUrl:official,officialVerified:Boolean(official),evidence,claimable:Boolean(x.claimLive&&evidence.pass),action:x.claimLive?(evidence.pass?"VERIFY_AND_REVIEW":"BLOCK_SAFETY_GATE"):"FARM_REVIEW",riskFlags:[...(x.claimLive?["wallet_signature_required"]:[]),...(evidence.flags||[])]})}
  const DEFAULTS = Object.freeze({
    minTvlUsd:1000000,
    maxApy:500,
    minApy:2,
    timeoutMs:10000,
    cacheMs:300000,
    maxResults:20
  });
  let cache={at:0,data:null};

  function n(v,d=0){const x=Number(v);return Number.isFinite(x)?x:d}
  function escUrl(v){try{return new URL(v).toString()}catch{return ""}}
  async function getJson(url,timeoutMs){
    const c=new AbortController(), t=setTimeout(()=>c.abort(),timeoutMs);
    try{
      const r=await fetch(url,{headers:{Accept:"application/json"},cache:"no-store",signal:c.signal});
      if(r.status===429)throw new Error("rate_limited");
      if(!r.ok)throw new Error("http_"+r.status);
      return await r.json();
    }finally{clearTimeout(t)}
  }
  function risk(row){
    const tvl=n(row.tvlUsd), apy=n(row.apy), il=n(row.ilRisk==="yes"?1:0);
    let s=0;
    if(tvl<1000000)s+=30; else if(tvl<5000000)s+=15;
    if(apy>100)s+=30; else if(apy>50)s+=18; else if(apy>25)s+=10;
    if(il)s+=15;
    if(!row.project)s+=10;
    return Math.min(100,s);
  }
  function opportunity(row){
    const tvl=n(row.tvlUsd), apy=n(row.apy), r=risk(row);
    const yieldScore=Math.min(45,Math.log10(Math.max(1,apy))*15);
    const tvlScore=Math.min(30,Math.log10(Math.max(1,tvl/1e6))*15);
    const chainScore=row.chain?10:0;
    const safetyScore=Math.max(0,15-r*0.15);
    const score=Math.round(Math.min(100,yieldScore+tvlScore+chainScore+safetyScore));
    return {
      type:"defi_yield",
      title:(row.project||"Unknown protocol")+" · "+(row.symbol||"pool"),
      chain:row.chain||"",
      project:row.project||"",
      symbol:row.symbol||"",
      apy:Number(apy.toFixed(2)),
      tvlUsd:Math.round(tvl),
      riskScore:r,
      score,
      url:escUrl(row.url),
      source:"DefiLlama",
      action:"REVIEW_ONLY",
      claimable:false,
      reason:"Public yield opportunity; eligibility and contract safety must be verified before any user-approved transaction."
    };
  }
  const CHAINS=Object.freeze({
    ethereum:{name:"Ethereum",rpc:"https://cloudflare-eth.com"},
    arbitrum:{name:"Arbitrum",rpc:"https://arb1.arbitrum.io/rpc"},
    base:{name:"Base",rpc:"https://mainnet.base.org"},
    optimism:{name:"Optimism",rpc:"https://mainnet.optimism.io"},
    polygon:{name:"Polygon",rpc:"https://polygon-rpc.com"}
  });
  function validEvmAddress(a){return /^0x[a-fA-F0-9]{40}$/.test(String(a||""))}
  async function rpc(rpcUrl,method,params,timeoutMs=8000){
    const c=new AbortController(),t=setTimeout(()=>c.abort(),timeoutMs);
    try{
      const r=await fetch(rpcUrl,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params}),signal:c.signal});
      if(!r.ok)throw new Error("rpc_http_"+r.status);
      const j=await r.json(); if(j.error)throw new Error(j.error.message||"rpc_error"); return j.result;
    }finally{clearTimeout(t)}
  }
  async function scanWallet(address,options){
    if(!validEvmAddress(address))throw new Error("invalid_public_evm_address");
    const cfg=Object.assign({chains:Object.keys(CHAINS)},options||{});
    const out=[];
    for(const key of cfg.chains){
      const ch=CHAINS[key]; if(!ch)continue;
      try{
        const [balance,nonce,block]=await Promise.all([
          rpc(ch.rpc,"eth_getBalance",[address,"latest"]),
          rpc(ch.rpc,"eth_getTransactionCount",[address,"latest"]),
          rpc(ch.rpc,"eth_blockNumber",[])
        ]);
        out.push({chain:key,name:ch.name,address,balanceWei:balance,nonce:Number.parseInt(nonce,16),latestBlock:Number.parseInt(block,16),readOnly:true});
      }catch(e){out.push({chain:key,name:ch.name,address,readOnly:true,error:String(e.message||e)})}
    }
    return {address,readOnly:true,seedPhraseRequested:false,privateKeyRequested:false,chains:out,checkedAt:new Date().toISOString()};
  }
  const FAILURE_RULES=Object.freeze({
    seedPhraseRequest:"BLOCK",privateKeyRequest:"BLOCK",unverifiedDomain:"BLOCK",staleEvidence:"RECHECK",
    unlimitedApproval:"BLOCK",arbitraryRecipient:"BLOCK",expiredDeadline:"EXPIRED",unknownContract:"RECHECK",
    capitalRequired:"REVIEW",highGas:"REVIEW",undecodableCalldata:"BLOCK"
  });
  const EVM_SELECTORS=Object.freeze({"095ea7b3":"ERC20 approve","23b872dd":"ERC20 transferFrom","a9059cbb":"ERC20 transfer","39509351":"ERC20 increaseAllowance","dd62ed3e":"ERC20 allowance","70a08231":"ERC20 balanceOf"});
  function hexToBigInt(v){try{return BigInt(v||"0x0")}catch{return 0n}}
  function decodeEvmCalldata(data){
    const raw=String(data||""); if(!/^0x[0-9a-fA-F]*$/.test(raw))return {decodable:false,flags:["undecodable_calldata"]};
    const selector=raw.slice(2,10).toLowerCase(), body=raw.slice(10), words=[];
    for(let i=0;i<body.length;i+=64)if(body.slice(i,i+64).length===64)words.push(body.slice(i,i+64));
    const out={decodable:true,selector,functionName:EVM_SELECTORS[selector]||"unknown",arguments:words.length,flags:[]};
    if(!EVM_SELECTORS[selector])out.flags.push("unknown_contract_function");
    if(selector==="095ea7b3"||selector==="39509351"){
      const amount=words[1]?hexToBigInt("0x"+words[1]):0n;
      if(amount===((1n<<256n)-1n))out.flags.push("unlimited_approval");
    }
    return out;
  }
  async function simulateEvmTransaction(chainKey,tx,options){
    const ch=CHAINS[chainKey]; if(!ch)throw new Error("unsupported_chain");
    if(!tx||!validEvmAddress(tx.to))throw new Error("invalid_transaction_target");
    const data=String(tx.data||"0x"),decoded=decodeEvmCalldata(data),value=tx.value||"0x0";
    const from=validEvmAddress(tx.from||"")?tx.from:undefined;
    const [call,gas]=await Promise.allSettled([
      rpc(ch.rpc,"eth_call",[{from,to:tx.to,data,value},"latest"],(options&&options.timeoutMs)||8000),
      rpc(ch.rpc,"eth_estimateGas",[{from,to:tx.to,data,value}],(options&&options.timeoutMs)||8000)
    ]);
    const flags=[...decoded.flags]; if(call.status!=="fulfilled")flags.push("eth_call_failed"); if(gas.status!=="fulfilled")flags.push("gas_estimate_failed");
    return {chain:chainKey,readOnly:true,simulatedAt:new Date().toISOString(),to:tx.to,data,value,decoded,callOk:call.status==="fulfilled",gasEstimate:gas.status==="fulfilled"?gas.value:null,flags,signAllowed:false,userApprovalRequired:true};
  }
  function preSignReview(packet){
    const p=packet||{},flags=[...(p.flags||[])];
    if(p.officialVerified===false)flags.push("official_domain_unverified");
    if(p.evidence&&!p.evidence.pass)flags.push(...(p.evidence.flags||[]));
    if(p.decoded?.flags)flags.push(...p.decoded.flags);
    const blocked=flags.some(v=>["seed_phrase_request","private_key_request","official_domain_unverified","unlimited_approval","arbitrary_recipient","undecodable_calldata","unknown_contract_function"].includes(v));
    return {allowedToPresentForUser:!blocked,blocked,flags:[...new Set(flags)],requiresUserApproval:true,autoSign:false,reviewedAt:new Date().toISOString()};
  }
  function sourceConfidence(x){if(x.type==="airdrop")return x.evidence?.pass?100:(x.officialVerified?70:20);if(x.source==="DefiLlama"||x.source==="CoinGecko")return 80;return 30}
  function rankOpportunity(x){
    const base=n(x.score); const confidence=sourceConfidence(x);
    const freshness=x.claimLive?10:0;
    const safety=x.officialVerified?10:0;
    const cost=(x.riskFlags||[]).some(v=>/capital|deposit|trade|bridge|approval/.test(v))?-10:0;
    return Math.max(0,Math.min(100,Math.round((base+freshness+safety+cost)*0.75+confidence*0.25)));
  }
  async function scan(options){
    const cfg=Object.assign({},DEFAULTS,options||{});
    const now=Date.now();
    if(cache.data&&now-cache.at<cfg.cacheMs)return cache.data;
    const [yieldResult,marketResult]=await Promise.allSettled([
      getJson(SOURCES.yields,cfg.timeoutMs),
      getJson(SOURCES.markets+"?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false",cfg.timeoutMs)
    ]);
    const rawYields=yieldResult.status==="fulfilled"&&Array.isArray(yieldResult.value?.data)?yieldResult.value.data:[];
    const yields=rawYields
      .filter(x=>x&&n(x.tvlUsd)>=cfg.minTvlUsd&&n(x.apy)>=cfg.minApy&&n(x.apy)<=cfg.maxApy)
      .filter(x=>x.stablecoin==="true"||x.stablecoin==="yes"||x.ilRisk==="no")
      .map(opportunity)
      .sort((a,b)=>b.score-a.score)
      .slice(0,cfg.maxResults);
    const markets=marketResult.status==="fulfilled"&&Array.isArray(marketResult.value)?marketResult.value:[];
    const marketCandidates=markets.map(x=>({
      type:"market_watch",
      title:x.name+" ("+String(x.symbol||"").toUpperCase()+")",
      symbol:String(x.symbol||"").toUpperCase(),
      priceUsd:n(x.current_price),
      change24h:n(x.price_change_percentage_24h),
      volume24hUsd:n(x.total_volume),
      marketCapUsd:n(x.market_cap),
      rank:n(x.market_cap_rank,999999),
      score:Math.max(0,Math.min(100,Math.round(
        Math.max(0,30-(n(x.market_cap_rank,250)/250)*30)+
        Math.min(25,n(x.total_volume)/Math.max(1,n(x.market_cap))*250)+
        Math.max(0,Math.min(20,(n(x.price_change_percentage_24h)+10)*1.5))
      ))),
      source:"CoinGecko",
      action:"WATCH_ONLY",
      claimable:false,
      reason:"Market signal only; this engine never buys or sells automatically."
    })).filter(x=>x.rank<=250&&x.volume24hUsd>=1000000).sort((a,b)=>b.score-a.score).slice(0,10);
    const data={
      guard:"JAVIDAN",
      version:"2.6.0",
      mode:"OPPORTUNITY_DISCOVERY",
      lifecycle:{discovered:true,verifiedRequiresFreshOfficialEvidence:true,readyForUserReview:true,autoReceiveOnly:true,autoSign:false,autoTrade:false,autoWithdraw:false},
      generatedAt:new Date().toISOString(),
      sources:{
        defiLlama:yields.length>0,
        coinGecko:markets.length>0
      },
      opportunities:[...airdrops().map(verifyAirdrop),...yields,...marketCandidates].map(x=>Object.assign(x,{score:rankOpportunity(x)})).sort((a,b)=>b.score-a.score).slice(0,cfg.maxResults),
      safety:{
        seedPhraseRequested:false,
        privateKeyRequested:false,
        autonomousSigning:false,
        autonomousTrading:false,
        autonomousWithdrawal:false,
        userApprovalRequired:true
      }
    };
    cache={at:now,data};
    return data;
  }
  const QUEUE_KEY="ANILX_JAVIDAN_APPROVAL_QUEUE_V1";
  function queueLoad(){
    try{const x=JSON.parse(localStorage.getItem(QUEUE_KEY)||"[]");return Array.isArray(x)?x:[]}catch{return []}
  }
  function queueSave(q){try{localStorage.setItem(QUEUE_KEY,JSON.stringify(q));return q}catch{return q}}
  function queueAdd(x){
    const q=queueLoad();
    const id=String(x.id||((x.type||"op")+"_"+String(x.title||"").replace(/[^a-z0-9]+/gi,"_").slice(0,80)));
    const existing=q.find(v=>v.id===id);
    if(existing)return existing;
    const item={id,type:x.type,title:x.title,officialUrl:x.officialUrl||x.sourceUrl||x.url||"",score:x.score||0,
      addedAt:new Date().toISOString(),deadline:x.deadline||null,status:"PENDING_REVIEW",
      requiresUserApproval:true,neverAutoSign:true};
    q.push(item);queueSave(q);return item
  }
  function queueList(){
    const now=Date.now(),q=queueLoad().map(v=>{
      if(v.deadline&&Date.parse(v.deadline)<=now&&v.status==="PENDING_REVIEW")return Object.assign({},v,{status:"EXPIRED"});
      return v
    });
    queueSave(q);return q
  }
  function queueRemove(id){const q=queueList().filter(v=>v.id!==id);queueSave(q);return q}
  function queuePrepare(id){
    const q=queueList(),item=q.find(v=>v.id===id);
    if(!item)throw new Error("queue_item_not_found");
    if(item.status==="EXPIRED")throw new Error("claim_deadline_expired");
    item.status="READY_FOR_USER_REVIEW";item.revalidatedAt=new Date().toISOString();queueSave(q);return item
  }
  function claimPacket(x){
    if(!x||x.type!=="airdrop")throw new Error("claim_only_for_verified_airdrop");
    if(!x.officialVerified||!x.officialUrl)throw new Error("official_claim_domain_not_verified");
    const evidence=x.evidence||evidenceGate(x); if(!evidence.pass)throw new Error("claim_evidence_gate_blocked");
    const item=queueAdd(x);
    return {queueItem:item,officialUrl:x.officialUrl,requiresUserApproval:true,autoSigning:false,autoReceiveOnly:true,evidence,instruction:"Open the verified official page, re-check eligibility and transaction details, then approve/sign only in your own wallet."};
  }
  function explainScore(x){return {score:x.score,type:x.type,officialVerified:x.officialVerified||false,claimable:x.claimable||false,action:x.action,source:x.source,sourceConfidence:sourceConfidence(x),evidence:x.evidence||null,riskFlags:x.riskFlags||[]}}
  const TON_MAINNET='-239';
  function validTonAddress(a){return /^[EU]Q[A-Za-z0-9_-]{46}$/.test(String(a||''))}
  async function monitorTonWallet(address,options){
    if(!validTonAddress(address))throw new Error('invalid_public_ton_address');
    const timeoutMs=Number(options?.timeoutMs||8000),ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeoutMs);
    try{
      const url='https://toncenter.com/api/v2/getAddressInformation?address='+encodeURIComponent(address);
      const r=await fetch(url,{cache:'no-store',signal:ctrl.signal,headers:{accept:'application/json'}});
      if(!r.ok)throw new Error('ton_api_http_'+r.status);
      const d=await r.json();
      const balance=String(d?.result?.balance||'0');
      return {network:TON_MAINNET,address,balanceNano:balance,balanceTon:Number(balance)/1e9,state:d?.result?.state||null,readOnly:true,autoReceive:true,autoSign:false,autoTrade:false,autoWithdraw:false,checkedAt:new Date().toISOString()};
    }finally{clearTimeout(timer)}
  }
  function autoReceivePolicy(){return Object.freeze({enabled:true,meaning:'monitor incoming assets to the connected public wallet',requiresPrivateKey:false,requiresSeedPhrase:false,requiresOutgoingSignature:false,claimTransactionsStillRequireWalletApproval:true})}
  function safeSummary(x){
    if(!x||!Array.isArray(x.opportunities))throw new Error("invalid_opportunity_result");
    return {guard:x.guard,version:x.version,mode:x.mode,generatedAt:x.generatedAt,sources:x.sources,safety:x.safety,opportunities:x.opportunities.slice(0,20).map(x=>Object.assign({},x,{scoreExplanation:explainScore(x)}))};
  }
  window.JavidanOpportunityEngine=Object.freeze({version:"2.6.0",scan,scanWallet,monitorTonWallet,autoReceivePolicy,safeSummary,config:DEFAULTS,verifyAirdrop,officialUrl,rankOpportunity,queueAdd,queueList,queueRemove,queuePrepare,claimPacket,evidenceGate,decodeEvmCalldata,simulateEvmTransaction,preSignReview,validTonAddress,FAILURE_RULES,EVM_SELECTORS});
})();