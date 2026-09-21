/* ANIL X — Javidan Crypto Guard
 * Read-only discovery guard. No trading, no private keys, no automatic signing.
 * Sample v1: market discovery + risk gates + deterministic scoring.
 */
(function () {
  "use strict";

  const DEFAULTS = Object.freeze({
    vsCurrency: "usd",
    perPage: 100,
    minVolumeUsd24h: 1000000,
    minMarketCapUsd: 10000000,
    minLiquidityRatio: 0.02,
    maxRank: 250,
    max24hLoss: -25,
    min24hVolumeChange: -80,
    blacklist: ["wrapped", "bridged", "testnet", "fake", "scam"],
    timeoutMs: 9000
  });

  const API = "https://api.coingecko.com/api/v3/coins/markets";

  function num(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function blocked(coin, blacklist) {
    const hay = [coin.id, coin.symbol, coin.name].join(" ").toLowerCase();
    return blacklist.some(word => hay.includes(String(word).toLowerCase()));
  }

  function gates(coin, cfg) {
    const price = num(coin.current_price);
    const volume = num(coin.total_volume);
    const cap = num(coin.market_cap);
    const rank = num(coin.market_cap_rank, 999999);
    const change = num(coin.price_change_percentage_24h);
    const liquidityRatio = cap > 0 ? volume / cap : 0;

    const reasons = [];
    if (blocked(coin, cfg.blacklist)) reasons.push("blacklist");
    if (rank > cfg.maxRank) reasons.push("rank");
    if (volume < cfg.minVolumeUsd24h) reasons.push("low_volume");
    if (cap < cfg.minMarketCapUsd) reasons.push("low_market_cap");
    if (liquidityRatio < cfg.minLiquidityRatio) reasons.push("thin_liquidity");
    if (change < cfg.max24hLoss) reasons.push("excessive_24h_drop");

    return {
      passed: reasons.length === 0,
      reasons,
      price,
      volume,
      cap,
      rank,
      change,
      liquidityRatio
    };
  }

  function score(m) {
    if (!m.passed) return 0;

    const rankScore = Math.max(0, 30 - (m.rank / 250) * 30);
    const liquidityScore = Math.min(25, m.liquidityRatio * 250);
    const volumeScore = Math.min(25, Math.log10(Math.max(1, m.volume / 1e6)) * 12);
    const momentumScore = Math.max(0, Math.min(20, (m.change + 10) * 1.5));

    return Math.round(Math.min(100, rankScore + liquidityScore + volumeScore + momentumScore));
  }

  async function fetchJson(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal
      });
      if (!res.ok) throw new Error("market_source_http_" + res.status);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function scan(options) {
    const cfg = Object.assign({}, DEFAULTS, options || {});
    const url = new URL(API);
    url.searchParams.set("vs_currency", cfg.vsCurrency);
    url.searchParams.set("order", "market_cap_desc");
    url.searchParams.set("per_page", String(cfg.perPage));
    url.searchParams.set("page", "1");
    url.searchParams.set("sparkline", "false");
    url.searchParams.set("price_change_percentage", "24h");

    const raw = await fetchJson(url.toString(), cfg.timeoutMs);
    const checked = raw.map(coin => {
      const market = gates(coin, cfg);
      return {
        id: coin.id,
        symbol: String(coin.symbol || "").toUpperCase(),
        name: coin.name,
        price: market.price,
        marketCapUsd: market.cap,
        volume24hUsd: market.volume,
        rank: market.rank,
        change24hPct: market.change,
        liquidityRatio: Number(market.liquidityRatio.toFixed(4)),
        passed: market.passed,
        reasons: market.reasons,
        score: score(market),
        source: "CoinGecko"
      };
    });

    return {
      guard: "JAVIDAN",
      mode: "READ_ONLY_DISCOVERY",
      generatedAt: new Date().toISOString(),
      scanned: checked.length,
      candidates: checked
        .filter(x => x.passed)
        .sort((a, b) => b.score - a.score),
      rejected: checked.filter(x => !x.passed)
    };
  }

  function safeSummary(result) {
    return {
      guard: result.guard,
      mode: result.mode,
      generatedAt: result.generatedAt,
      scanned: result.scanned,
      candidates: result.candidates.slice(0, 10).map(x => ({
        symbol: x.symbol,
        name: x.name,
        score: x.score,
        rank: x.rank,
        volume24hUsd: x.volume24hUsd,
        change24hPct: x.change24hPct,
        riskGatesPassed: x.passed
      }))
    };
  }

  window.JavidanCryptoGuard = Object.freeze({
    version: "1.0.0",
    config: DEFAULTS,
    scan,
    safeSummary
  });
})();
