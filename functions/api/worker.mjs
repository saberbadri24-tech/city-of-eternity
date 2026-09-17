import { getStore } from '@netlify/blobs';

const store = () => getStore({ name: 'anil-x-worker', consistency: 'strong' });
const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers });
const id = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function ownerKey(request) {
  const key = request.headers.get('x-anil-worker-key');
  const expected = Netlify.env.get('ANIL_WORKER_KEY');
  return Boolean(expected && key && key === expected);
}

export default async (request) => {
  if (!ownerKey(request)) return json({ ok: false, error: 'unauthorized' }, 401);
  const blobs = store();
  if (request.method === 'GET') {
    const { blobs: items } = await blobs.list({ prefix: 'queue/' });
    const tasks = [];
    for (const item of items.slice(-50)) {
      const value = await blobs.get(item.key, { type: 'json' });
      if (value) tasks.push(value);
    }
    const heartbeat = await blobs.get('system/heartbeat', { type: 'json' });
    return json({ ok: true, heartbeat, tasks });
  }
  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const type = String(body?.type || 'internal').slice(0, 40);
    const payload = body?.payload && typeof body.payload === 'object' ? body.payload : {};
    const task = { id: id(), type, payload, status: 'queued', attempts: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await blobs.setJSON(`queue/${task.id}`, task);
    return json({ ok: true, task });
  }
  return json({ ok: false, error: 'method_not_allowed' }, 405);
};

export const config = { path: '/api/worker', method: ['GET', 'POST'] };
