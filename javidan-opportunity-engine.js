/* ANIL X — Javidan Opportunity Engine v2
 * Real public-data opportunity discovery.
 * Sources: CoinGecko markets + DefiLlama yields.
 * No private keys, seed phrases, withdrawals, trades or autonomous signing.
 * v2.2: current airdrop discovery registry with explicit verification gates.
 */
(function(){
  "use strict";
  const SOURCES = Object.freeze({
    markets:"https://api.coingecko.com/api/v3/coins/markets",
    yields:"https://yields.llama.fi/pools"
  });

  const AIRDROP_REGISTRY = Object.freeze([
    {name:"Laptop",slug:"laptop",confirmed:true,claimLive:true,scoreBase:88,actions:["eligibility","claim"],url:"https://airdrops.io/laptop/"},
    {name:"Boundless",slug:"boundless",confirmed:true,claimLive:true,scoreBase:78,actions:["eligibility","claim"],url:"https://airdrop.boundless.network/"},
    {name:"Sonic",slug:"sonic",confirmed:true,claimLive:true,scoreBase:78,actions:["eligibility","claim"],url:"https://airdrop.soniclabs.com/"},
    {name:"dappOS",slug:"dappos",confirmed:true,claimLive:true,scoreBase:76,actions:["eligibility","claim"],url:"https://airdrop.dappos.com/"},
    {name:"RateX",slug:"ratex",confirmed:true,claimLive:true,scoreBase:74,actions:["eligibility","claim"],url:"https://rate-x.io/"},
    {name:"Pharos Network",slug:"pharos-network",confirmed:true,claimLive:true,scoreBase:73,actions:["eligibility","claim"],url:"https://pharosnetwork.xyz/"},
    {name:"Lighter",slug:"lighter",confirmed:true,claimLive:true,scoreBase:72,actions:["eligibility","claim"],url:"https://lighter.xyz/"},
    {name:"Infinex",slug:"infinex",confirmed:true,claimLive:true,scoreBase:70,actions:["eligibility","claim"],url:"https://infinex.xyz/"},
    {name:"Rainbow",slug:"rainbow",confirmed:true,claimLive:true,scoreBase:68,actions:["eligibility","claim"],url:"https://rainbow.me/"},
    {name:"Beldex",slug:"beldex",confirmed:true,claimLive:false,scoreBase:72,actions:["social","referrals","check-in"],url:"https://airdrops.io/beldex/"},
    {name:"Gyndore",slug:"gyndore",confirmed:true,claimLive:false,scoreBase:76,actions:["wallet-verification","registration"],url:"https://airdrops.io/gyndore/"}
  ]);
  function airdrops(){
    return AIRDROP_REGISTRY.map(x=>{
      const claim=x.claimLive?12:0;
      const score=Math.max(0,Math.min(100,x.scoreBase+claim));
      return {
        type:"airdrop",title:x.name,score,confirmed:x.confirmed,claimLive:x.claimLive,
        actions:x.actions,source:"current discovery registry",sourceUrl:x.url,
        officialVerificationRequired:true,claimable:x.claimLive,
        action:x.claimLive?"VERIFY_OFFICIAL_CLAIM":"FARM_REVIEW",
        reason:x.claimLive?"Claim/checker is reported open by a current discovery source; official-domain verification is mandatory before signing.":"Current campaign listing; eligibility and official claim path still require verification.",
        riskFlags:x.claimLive?["official_domain_must_match","wallet_signature_required"]:["eligibility_unverified"]
      };
    });
  }
  const OFFICIAL_HOSTS=Object.freeze(new Set(["boundless.network","soniclabs.com","dappos.com","rate-x.io","pharosnetwork.xyz","lighter.xyz","infinex.xyz","rainbow.me"]));
  function officialUrl(url){try{const u=new URL(url);const h=u.hostname.toLowerCase().replace(/^www\./,"");return [...OFFICIAL_HOSTS].some(x=>h===x||h.endsWith("."+x))?u.toString():""}catch{return ""}}
  function verifyAirdrop(x){const official=officialUrl(x.url);return Object.assign({},x,{officialUrl:official,officialVerified:Boolean(official),claimable:Boolean(x.claimLive&&official),action:x.claimLive?(official?"VERIFY_AND_REVIEW":"BLOCK_UNVERIFIED_DOMAIN"):"FARM_REVIEW",riskFlags:[...(x.claimLive?["wallet_signature_required"]:[]),...(official?[]:["official_domain_unverified"])]})}
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
      version:"2.2.0",
      mode:"OPPORTUNITY_DISCOVERY",
      generatedAt:new Date().toISOString(),
      sources:{
        defiLlama:yields.length>0,
        coinGecko:markets.length>0
      },
      opportunities:[...airdrops().map(verifyAirdrop),...yields,...marketCandidates].sort((a,b)=>b.score-a.score).slice(0,cfg.maxResults),
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
  function safeSummary(x){
    if(!x||!Array.isArray(x.opportunities))throw new Error("invalid_opportunity_result");
    return {guard:x.guard,version:x.version,mode:x.mode,generatedAt:x.generatedAt,sources:x.sources,safety:x.safety,opportunities:x.opportunities.slice(0,20)};
  }
  window.JavidanOpportunityEngine=Object.freeze({version:"2.2.0",scan,safeSummary,config:DEFAULTS,verifyAirdrop,officialUrl});
})();