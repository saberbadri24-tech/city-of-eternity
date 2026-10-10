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

function jalaliToday() {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return String(p.year) + '/' + String(p.month).padStart(2, '0') + '/' + String(p.day).padStart(2, '0');
}
function tehranMinuteOfDay() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return Number(p.hour) * 60 + Number(p.minute);
}

export async function getLiveUsdTomanConfig(env = {}) {
  const configured = configuredRate(env);
  if (configured) return configured;
  const cached = cachedLiveRate();
  if (cached) return cached;
  try {
    const response = await fetch('https://nerkh.jahankhahan.shop/data/live.json', {
      headers: { accept: 'application/json', 'user-agent': 'ANIL-X-Payment-FX/1.0' },
      signal: AbortSignal.timeout(3500)
    });
    if (!response.ok) throw new Error('fx_source_unavailable');
    const data = await response.json();
    const rate = Number(data?.rates?.dollar);
    const date = String(data?.date || '').replace(/-/g, '/');
    const time = String(data?.time || '');
    if (!Number.isFinite(rate) || rate < 10000 || rate > 1000000) throw new Error('fx_rate_out_of_range');
    if (!/^\d{4}\/\d{2}\/\d{2}$/.test(date) || date !== jalaliToday()) throw new Error('fx_quote_stale');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('fx_timestamp_invalid');
    const [hh, mm] = time.split(':').map(Number);
    const age = tehranMinuteOfDay() - (hh * 60 + mm);
    if (age > 180 || age < -5) throw new Error('fx_quote_stale');
    const config = { rate: Math.round(rate), source: 'live-market-api', unit: 'toman', observedAt: date + ' ' + time };
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
