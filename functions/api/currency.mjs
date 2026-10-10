const first = (env, keys) => keys
  .map(key => env?.[key])
  .find(value => value !== undefined && value !== null && String(value).trim() !== '') ?? '';

let liveCache = null;
const CACHE_MS = 60_000;
const FALLBACK_RATE = 268760;

function configuredRate(env = {}) {
  const tomanRaw = Number(first(env, ['USD_TOMAN_RATE', 'USD_TO_TOMAN', 'USD_TOMAN']) || 0);
  if (Number.isFinite(tomanRaw) && tomanRaw > 0) {
    return { rate: tomanRaw, source: 'environment-toman', unit: 'toman' };
  }
  const rialRaw = Number(first(env, ['USD_IRR_RATE', 'USD_TO_IRR']) || 0);
  if (Number.isFinite(rialRaw) && rialRaw > 0) {
    return { rate: rialRaw / 10, source: 'environment-irr-converted-to-toman', unit: 'toman' };
  }
  return null;
}

function cachedLiveRate() {
  return liveCache && Date.now() - liveCache.fetchedAt <= CACHE_MS ? liveCache.config : null;
}

export function getUsdTomanConfig(env = {}) {
  const configured = configuredRate(env);
  if (configured) return configured;
  const cached = cachedLiveRate();
  if (cached) return cached;
  return { rate: FALLBACK_RATE, source: 'runtime-default', unit: 'toman' };
}

export async function getLiveUsdTomanConfig(env = {}) {
  const configured = configuredRate(env);
  if (configured) return configured;
  const cached = cachedLiveRate();
  if (cached) return cached;
  try {
    const response = await fetch('https://nerkhara.com/rates.json', {
      headers: { accept: 'application/json', 'user-agent': 'ANIL-X-Payment-FX/1.0' },
      signal: AbortSignal.timeout(3500)
    });
    if (!response.ok) throw new Error('fx_source_unavailable');
    const data = await response.json();
    const quote = data?.usd;
    // Nerkhara's public rates.json schema uses usd.price, top-level stale,
    // and generated_utc; retain compatibility with the older value schema.
    const rate = Number(quote?.value ?? quote?.price);
    const observedAt = String(quote?.updatedTime || quote?.timestamp_utc || data?.generated_utc || '');
    const stale = quote?.stale ?? data?.stale;
    if (stale !== false) throw new Error('fx_quote_stale');
    if (!Number.isFinite(rate) || rate < 10000 || rate > 1000000) throw new Error('fx_rate_out_of_range');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:?\d{2})?$/.test(observedAt)) throw new Error('fx_timestamp_invalid');
    const timestamp = Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/.test(observedAt) ? observedAt : observedAt + 'Z');
    const ageMs = Date.now() - timestamp;
    if (!Number.isFinite(timestamp) || ageMs < -5 * 60_000 || ageMs > 6 * 60 * 60_000) throw new Error('fx_quote_stale');
    const config = { rate: Math.round(rate), source: 'live-market-api', unit: 'toman', observedAt, stale: false, contributors: Array.isArray(quote?.sources) ? quote.sources.length : 0 };
    liveCache = { config, fetchedAt: Date.now() };
    return config;
  } catch {
    return { rate: FALLBACK_RATE, source: 'runtime-default', unit: 'toman' };
  }
}

export function getUsdTomanRate(env = {}) {
  return getUsdTomanConfig(env).rate;
}

export function usdToToman(amount, env = {}) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) return NaN;
  return Math.round(value * getUsdTomanRate(env));
}
