import { getStore } from '@netlify/blobs';

const store = () => getStore({ name: 'anil-x-worker', consistency: 'strong' });
const now = () => new Date().toISOString();

async function runTask(task, baseUrl) {
  if (task.type === 'plan') {
    const response = await fetch(`${baseUrl}/api/plan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(task.payload || {})
    });
    const result = await response.json().catch(() => ({ ok: false, error: 'invalid_worker_response' }));
    if (!response.ok) throw new Error(result?.error || `plan_${response.status}`);
    return result;
  }
  if (task.type === 'health') {
    return { ok: true, service: 'ANIL X worker', checkedAt: now() };
  }
  throw new Error('unsupported_task_type');
}

export default async () => {
  const blobs = store();
  const startedAt = now();
  const heartbeat = { ok: true, startedAt, lastRunAt: startedAt, status: 'running', processed: 0, failed: 0 };
  await blobs.setJSON('system/heartbeat', heartbeat);

  const baseUrl = String(Netlify.env.get('URL') || Netlify.env.get('DEPLOY_PRIME_URL') || '').replace(/\/$/, '');
  if (!baseUrl) {
    await blobs.setJSON('system/heartbeat', { ...heartbeat, status: 'degraded', error: 'site_url_missing', finishedAt: now() });
    return;
  }

  const { blobs: queued } = await blobs.list({ prefix: 'queue/' });
  for (const item of queued.slice(0, 8)) {
    const task = await blobs.get(item.key, { type: 'json' });
    if (!task || task.status !== 'queued') continue;
    task.status = 'running';
    task.attempts = Number(task.attempts || 0) + 1;
    task.updatedAt = now();
    await blobs.setJSON(item.key, task);
    try {
      const result = await runTask(task, baseUrl);
      await blobs.setJSON(`result/${task.id}`, { ok: true, taskId: task.id, completedAt: now(), result });
      await blobs.delete(item.key);
      heartbeat.processed += 1;
    } catch (error) {
      task.status = task.attempts >= 3 ? 'failed' : 'queued';
      task.error = String(error?.message || error);
      task.updatedAt = now();
      await blobs.setJSON(item.key, task);
      heartbeat.failed += 1;
    }
  }

  await blobs.setJSON('system/heartbeat', { ...heartbeat, status: 'idle', finishedAt: now() });
};

export const config = { schedule: '*/5 * * * *' };
