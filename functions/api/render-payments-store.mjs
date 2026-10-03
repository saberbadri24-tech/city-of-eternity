import Redis from 'ioredis';

const cache = new Map();

function client(url) {
  if (!url) return null;
  if (cache.has(url)) return cache.get(url);
  const redis = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
    connectTimeout: 5000,
    retryStrategy: times => Math.min(times * 250, 2000)
  });
  redis.on('error', err => console.error('ANIL X storage redis error:', err?.message || err));
  cache.set(url, redis);
  return redis;
}

export function createPaymentsStore(url) {
  const redis = client(url);
  if (!redis) return null;
  const ensure = async () => {
    if (redis.status === 'wait') await redis.connect();
    if (redis.status !== 'ready') throw new Error('payments_store_unavailable');
  };
  return {
    async get(key, type) {
      await ensure();
      const value = await redis.get(String(key));
      if (value == null) return null;
      return type === 'json' ? JSON.parse(value) : value;
    },
    async put(key, value) {
      await ensure();
      await redis.set(String(key), typeof value === 'string' ? value : JSON.stringify(value));
    },
    async list({prefix = ''} = {}) {
      await ensure();
      const keys = [];
      let cursor = '0';
      do {
        const [next, found] = await redis.scan(cursor, 'MATCH', String(prefix) + '*', 'COUNT', '200');
        cursor = next;
        keys.push(...found.map(name => ({name})));
      } while (cursor !== '0');
      return {keys};
    }
  };
}
