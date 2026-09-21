/* ANIL X — Javidan Crypto Guard
 * Read-only crypto discovery. No trading, withdrawal, private keys or automatic signing.
 * v1.2: correct metric semantics and defensive source-row validation.
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
    min24hVolumeChange: null,
    blacklist: ["wrapped", "bridged", "testnet", "fake", "scam"],
    timeoutMs: 9000,
    cacheMs: 300000
  });

  const API = "https://api.coingecko.com/api/v3/coins/markets";
  let cache = { at: 0, key: "", data: null };

  function num(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function config(input) {
    const x = Object.assign({}, DEFAULTS, input || {});
    x.perPage = Math.max(1, Math.min(250, Math.floor(num(x.perPage, 100))));
    x.maxRank = Math.max(1, Math.floor(num(x.maxRank, 250)));
    x.minVolumeUsd24h = Math.max(0, num(x.minVolumeUsd24h));
    x.minMarketCapUsd = Math.max(0, num(x.minMarketCapUsd));
    x.minLiquidityRatio = Math.max(0, num(x.minLiquidityRatio));
    x.max24hLoss = Math.min(0, num(x.max24hLoss, -25));
    x.min24hVolumeChange = null;
    x.timeoutMs = Math.max(3000, Math.min(20000, num(x.timeoutMs, 9000)));
    x.cacheMs = Math.max(0, Math.min(1800000, num(x.cacheMs, 300000)));
    x.blacklist = Array.isArray(x.blacklist) ? x.blacklist.map(String).filter(Boolean) : DEFAULTS.blacklist.slice();
    return x;
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
    const volumeChange = NaN; // CoinGecko field is price-change-in-currency, not volume-change.
    const liquidityRatio = cap > 0 ? volume / cap : 0;
    const reasons = [];

    if (!coin || typeof coin !== "object") reasons.push("invalid_source_row");
    if (blocked(coin || {}, cfg.blacklist)) reasons.push("blacklist");
    if (rank > cfg.maxRank) reasons.push("rank");
    if (volume < cfg.minVolumeUsd24h) reasons.push("low_volume");
    if (cap < cfg.minMarketCapUsd) reasons.push("low_market_cap");
    if (liquidityRatio < cfg.minLiquidityRatio) reasons.push("thin_liquidity");
    if (change < cfg.max24hLoss) reasons.push("excessive_24h_drop");
    // Do not treat price_change_percentage_24h_in_currency as volume change.

    return { passed: reasons.length === 0, reasons, price, volume, cap, rank, change, volumeChange, liquidityRatio };
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
      const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" }, signal: controller.signal, cache: "no-store" });
      if (res.status === 429) throw new Error("market_source_rate_limited");
      if (!res.ok) throw new Error("market_source_http_" + res.status);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("market_source_invalid_payload");
      return data;
    } finally { clearTimeout(timer); }
  }

  async function scan(options) {
    const cfg = config(options);
    const key = JSON.stringify(cfg);
    if (cache.data && cache.key === key && Date.now() - cache.at < cfg.cacheMs) return cache.data;

    const url = new URL(API);
    url.searchParams.set("vs_currency", cfg.vsCurrency);
    url.searchParams.set("order", "market_cap_desc");
    url.searchParams.set("per_page", String(cfg.perPage));
    url.searchParams.set("page", "1");
    url.searchParams.set("sparkline", "false");
    url.searchParams.set("price_change_percentage", "24h");

    let raw;
    try { raw = await fetchJson(url.toString(), cfg.timeoutMs); }
    catch (error) {
      if (cache.data) return Object.assign({}, cache.data, { stale: true, error: String(error.message || error) });
      throw error;
    }

    const checked = raw.map(coin => {
      const market = gates(coin, cfg);
      return {
        id: String(coin.id || ""),
        symbol: String(coin.symbol || "").toUpperCase(),
        name: String(coin.name || ""),
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

    const result = {
      guard: "JAVIDAN",
      version: "1.2.0",
      mode: "READ_ONLY_DISCOVERY",
      generatedAt: new Date().toISOString(),
      stale: false,
      scanned: checked.length,
      candidates: checked.filter(x => x.passed).sort((a, b) => b.score - a.score),
      rejected: checked.filter(x => !x.passed)
    };
    cache = { at: Date.now(), key, data: result };
    return result;
  }

  function safeSummary(result) {
    if (!result || !Array.isArray(result.candidates)) throw new Error("invalid_guard_result");
    return {
      guard: result.guard,
      version: result.version,
      mode: result.mode,
      generatedAt: result.generatedAt,
      stale: Boolean(result.stale),
      scanned: num(result.scanned),
      candidates: result.candidates.slice(0, 10).map(x => ({
        symbol: x.symbol, name: x.name, score: x.score, rank: x.rank,
        volume24hUsd: x.volume24hUsd, change24hPct: x.change24hPct, riskGatesPassed: x.passed
      }))
    };
  }

  window.JavidanCryptoGuard = Object.freeze({ version: "1.2.0", config: DEFAULTS, scan, safeSummary });
})();
