/* ANIL X — Javidan Opportunity Engine v2
 * Real public-data opportunity discovery.
 * Sources: CoinGecko markets + DefiLlama yields.
 * No private keys, seed phrases, withdrawals, trades or autonomous signing.\n * v2.1: current airdrop discovery registry with explicit verification gates.
 */
(function(){
  "use strict";
  const SOURCES = Object.freeze({
    markets:"https://api.coingecko.com/api/v3/coins/markets",
    yields:"https://yields.llama.fi/pools"
  });

  const AIRDROP_REGISTRY = Object.freeze([
    {name:"Laptop",slug:"laptop",confirmed:true,claimLive:true,scoreBase:88,actions:["eligibility","claim"],url:"https://airdrops.io/laptop/"},
    {name:"Beldex",slug:"beldex",confirmed:true,claimLive:false,scoreBase:72,actions:["tasks","referrals","check-in"],url:"https://airdrops.io/beldex/"},
    {name:"Gyndore",slug:"gyndore",confirmed:true,claimLive:false,scoreBase:76,actions:["wallet-verification","registration"],url:"https://airdrops.io/gyndore/"},
    {name:"Flop Labs",slug:"flop-labs",confirmed:true,claimLive:false,scoreBase:70,actions:["social","network-role","testnet"],url:"https://airdrops.io/flop-labs/"},
    {name:"TBook",slug:"tbook",confirmed:true,claimLive:false,scoreBase:69,actions:["score","campaigns","deposit"],url:"https://airdrops.io/tbook/"},
    {name:"Omega",slug:"omega",confirmed:true,claimLive:false,scoreBase:68,actions:["testnet-token","trade","predict"],url:"https://airdrops.io/omega/"},
    {name:"MINT",slug:"mint",confirmed:true,claimLive:false,scoreBase:67,actions:["fund","games","stake"],url:"https://airdrops.io/mint/"},
    {name:"HertzFlow",slug:"hertzflow",confirmed:true,claimLive:false,scoreBase:65,actions:["deposit","hold","perps"],url:"https://airdrops.io/hertzflow/"},
    {name:"Nowa",slug:"nowa",confirmed:true,claimLive:false,scoreBase:67,actions:["social","trade","stake","referral"],url:"https://airdrops.io/nowa/"},
    {name:"Sweep Finance",slug:"sweep-finance",confirmed:true,claimLive:false,scoreBase:66,actions:["tasks","XP","competition"],url:"https://airdrops.io/sweep-finance/"},
    {name:"Wager Predict",slug:"wager-predict",confirmed:true,claimLive:false,scoreBase:64,actions:["testnet-USDC","trade","referral"],url:"https://airdrops.io/wager-predict/"},
    {name:"AlloX",slug:"allox",confirmed:true,claimLive:false,scoreBase:64,actions:["AI-portfolio","bonus","tasks"],url:"https://airdrops.io/allox/"},
    {name:"Push Chain",slug:"push-chain",confirmed:true,claimLive:false,scoreBase:63,actions:["signup","social","quests","referral"],url:"https://airdrops.io/push-chain/"},
    {name:"Brownian",slug:"brownian",confirmed:true,claimLive:false,scoreBase:61,actions:["signup","deposit","perps"],url:"https://airdrops.io/brownian/"},
    {name:"Perpl",slug:"perpl",confirmed:true,claimLive:false,scoreBase:60,actions:["fund","perps","referral"],url:"https://airdrops.io/perpl/"},
    {name:"MoonPay",slug:"moonpay",confirmed:true,claimLive:false,scoreBase:58,actions:["signup","PayBox","X-connect"],url:"https://airdrops.io/moonpay/"},
    {name:"WheelX",slug:"wheelx",confirmed:true,claimLive:false,scoreBase:59,actions:["bridge","swap","quests","referral"],url:"https://airdrops.io/wheelx/"},
    {name:"Kryvora Network",slug:"kryvora-network",confirmed:true,claimLive:false,scoreBase:57,actions:["testnet","tasks","referral"],url:"https://airdrops.io/kryvora-network/"},
    {name:"Memebook",slug:"memebook",confirmed:true,claimLive:false,scoreBase:55,actions:["mint-pass","app","social"],url:"https://airdrops.io/memebook/"}
  ]);
  function airdrops(){
    return AIRDROP_REGISTRY.map(x=>{
      const claim=x.claimLive?12:0;
      const confirmation=x.confirmed?15:0;
      const costPenalty=x.actions.some(a=>/deposit|perps|fund|trade|stake|bridge|swap/.test(a))?12:0;
      const referralPenalty=x.actions.includes("referral")?5:0;
      const score=Math.max(0,Math.min(100,x.scoreBase+claim+confirmation-costPenalty-referralPenalty));
      return {type:"airdrop",title:x.name,score,confirmed:x.confirmed,claimLive:x.claimLive,actions:x.actions,source:"Airdrops.io discovery feed",sourceUrl:x.url,officialVerificationRequired:true,claimable:x.claimLive,action:x.claimLive?"REVIEW_CLAIM":"FARM_REVIEW",reason:x.claimLive?"Claim is reported live by the discovery source; verify the project's official claim domain and wallet eligibility before signing.":"Confirmed listing; eligibility and official claim path still require verification.",riskFlags:[...(costPenalty?["capital_or_trading_required"]:[]),...(referralPenalty?["referral_dependency"]:[])]};
    }).sort((a,b)=>b.score-a.score);
  }

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
      version:"2.1.0",
      mode:"OPPORTUNITY_DISCOVERY",
      generatedAt:new Date().toISOString(),
      sources:{
        defiLlama:yields.length>0,
        coinGecko:markets.length>0
      },
      opportunities:[...airdrops(),...yields,...marketCandidates].sort((a,b)=>b.score-a.score).slice(0,cfg.maxResults),
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
  window.JavidanOpportunityEngine=Object.freeze({version:"2.0.0",scan,safeSummary,config:DEFAULTS});
})();