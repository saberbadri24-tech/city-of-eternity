const first = (env, keys) => keys
  .map(key => env?.[key])
  .find(value => value !== undefined && value !== null && String(value).trim() !== '') ?? '';

export function getUsdTomanConfig(env = {}) {
  const tomanRaw = Number(first(env, ['USD_TOMAN_RATE', 'USD_TO_TOMAN', 'USD_TOMAN']) || 0);
  if (Number.isFinite(tomanRaw) && tomanRaw > 0) {
    return { rate: tomanRaw, source: 'environment-toman', unit: 'toman' };
  }

  const rialRaw = Number(first(env, ['USD_IRR_RATE', 'USD_TO_IRR']) || 0);
  if (Number.isFinite(rialRaw) && rialRaw > 0) {
    return { rate: rialRaw / 10, source: 'environment-irr-converted-to-toman', unit: 'toman' };
  }

  // Keep the previous default's economic value, but express it in the unit
  // accepted by Variza (Toman), not Rial.
  return { rate: 268760, source: 'runtime-default', unit: 'toman' };
}

export function getUsdTomanRate(env = {}) {
  return getUsdTomanConfig(env).rate;
}

export function usdToToman(amount, env = {}) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) return NaN;
  return Math.round(value * getUsdTomanRate(env));
}
