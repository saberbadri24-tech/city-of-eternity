const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

const id = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const safeEqual = (a, b) => {
  const aa = new TextEncoder().encode(a), bb = new TextEncoder().encode(b);
  if (aa.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
  return diff === 0;
};

const hmac = async (secret, body) => {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, body);
  return 'sha256=' + [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
};

async function createPayment(request, env) {
  const apiKey = env.VARIZA_API_KEY || env.VARIA_API_KEY;
  if (!apiKey) return json({ ok: false, error: 'payment_not_configured' }, 503);
  try {
    const body = await request.json();
    const amount = Math.round(Number(body?.amount));
    if (!Number.isFinite(amount) || amount < 1000) return json({ ok: false, error: 'invalid_amount' }, 400);
    const orderId = String(body?.orderId || id()).slice(0, 120);
    const client = String(body?.client || 'مشتری ANIL X').trim().slice(0, 120);
    const description = String(body?.description || 'پرداخت ANIL X').trim().slice(0, 240);
    const origin = new URL(request.url).origin;
    const returnUrl = String(body?.returnUrl || env.VARIZA_RETURN_URL || `${origin}/payment.html?order=${encodeURIComponent(orderId)}`).slice(0, 500);

    const response = await fetch('https://variza.ir/api/v1/pay', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, return_url: returnUrl })
    });
    const raw = await response.text();
    let result; try { result = JSON.parse(raw); } catch { result = { raw }; }
    if (!response.ok || !result?.pay_url) return json({ ok: false, error: 'variza_create_payment_failed', providerStatus: response.status, details: result }, 502);

    const record = { orderId, client, description, amount, status: 'pending', payUrl: result.pay_url, slug: result.slug || null, createdAt: new Date().toISOString(), provider: 'variza' };
    if (env.PAYMENTS) {
      await env.PAYMENTS.put(`orders/${orderId}`, JSON.stringify(record));
      if (record.slug) await env.PAYMENTS.put(`slugs/${record.slug}`, JSON.stringify({ orderId }));
    }
    return json({ ok: true, orderId, amount, status: 'pending', payUrl: result.pay_url });
  } catch (error) {
    return json({ ok: false, error: 'payment_create_error', message: String(error?.message || error) }, 500);
  }
}

async function webhook(request, env) {
  const secret = env.VARIZA_WEBHOOK_SECRET || env.VARIA_WEBHOOK_SECRET;
  if (!secret) return json({ ok: false, error: 'webhook_not_configured' }, 503);
  try {
    const body = new Uint8Array(await request.arrayBuffer());
    const signature = request.headers.get('x-webhook-signature') || '';
    const expected = await hmac(secret, body);
    if (!safeEqual(expected, signature)) return json({ ok: false, error: 'invalid_signature' }, 400);
    const payload = JSON.parse(new TextDecoder().decode(body));
    if (payload?.event !== 'payment.paid' || payload?.status !== 'paid') return json({ ok: true, ignored: true });
    if (!env.PAYMENTS) return json({ ok: true, status: 'received_no_storage' });

    const deliveryId = request.headers.get('x-delivery-id') || payload.attempt_code || `${payload.slug}:${payload.sent_at}`;
    const deliveryKey = `deliveries/${deliveryId}`;
    if (await env.PAYMENTS.get(deliveryKey)) return json({ ok: true, duplicate: true });
    const map = payload.slug ? await env.PAYMENTS.get(`slugs/${payload.slug}`, 'json') : null;
    const orderId = map?.orderId;
    const order = orderId ? await env.PAYMENTS.get(`orders/${orderId}`, 'json') : null;
    if (order) {
      const paid = Number(payload.amount) === Number(order.amount);
      const updated = { ...order, status: paid ? 'paid' : 'amount_mismatch', paidAt: new Date().toISOString(), attemptCode: payload.attempt_code || null, deliveryId, webhook: payload };
      await env.PAYMENTS.put(`orders/${orderId}`, JSON.stringify(updated));
      await env.PAYMENTS.put(deliveryKey, JSON.stringify({ orderId, receivedAt: new Date().toISOString() }));
      return json({ ok: true, orderId, status: updated.status });
    }
    await env.PAYMENTS.put(deliveryKey, JSON.stringify({ orderId: null, slug: payload.slug || null, receivedAt: new Date().toISOString(), orphan: true }));
    return json({ ok: true, status: 'received_unmatched' });
  } catch (error) {
    return json({ ok: false, error: 'webhook_processing_error', message: String(error?.message || error) }, 500);
  }
}

async function orderStatus(request, env) {
  const order = new URL(request.url).searchParams.get('order');
  if (!order || !env.PAYMENTS) return json({ ok: false, error: 'order_not_found' }, 404);
  const record = await env.PAYMENTS.get(`orders/${order}`, 'json');
  return record ? json({ ok: true, order: record }) : json({ ok: false, error: 'order_not_found' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') return json({ ok: true, service: 'ANIL X', runtime: 'cloudflare-pages-worker' });
    if (url.pathname === '/api/pay' && request.method === 'POST') return createPayment(request, env);
    if (url.pathname === '/api/variza-webhook' && request.method === 'POST') return webhook(request, env);
    if (url.pathname === '/api/order' && request.method === 'GET') return orderStatus(request, env);
    return env.ASSETS.fetch(request);
  }
};
