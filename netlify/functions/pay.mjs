import { getStore } from '@netlify/blobs';

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

const store = () => getStore({ name: 'anilx-payments', consistency: 'strong' });
const id = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  const apiKey = process.env.VARIZA_API_KEY || process.env.VARIA_API_KEY;
  if (!apiKey) return json({ ok: false, error: 'payment_not_configured' }, 503);
  try {
    const body = await req.json();
    const amount = Math.round(Number(body?.amount));
    if (!Number.isFinite(amount) || amount < 1000) return json({ ok: false, error: 'invalid_amount' }, 400);
    const orderId = String(body?.orderId || id()).slice(0, 120);
    const client = String(body?.client || 'مشتری ANIL X').trim().slice(0, 120);
    const description = String(body?.description || 'پرداخت ANIL X').trim().slice(0, 240);
    const origin = new URL(req.url).origin;
    const returnUrl = String(body?.returnUrl || process.env.VARIZA_RETURN_URL || `${origin}/payment.html?order=${encodeURIComponent(orderId)}`).slice(0, 500);

    const response = await fetch('https://variza.ir/api/v1/pay', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, return_url: returnUrl })
    });
    const raw = await response.text();
    let result; try { result = JSON.parse(raw); } catch { result = { raw }; }
    if (!response.ok || !result?.pay_url) {
      return json({ ok: false, error: 'variza_create_payment_failed', providerStatus: response.status, details: result }, 502);
    }

    const record = {
      orderId, client, description, amount, status: 'pending',
      payUrl: result.pay_url, slug: result.slug || null,
      createdAt: new Date().toISOString(), provider: 'variza'
    };
    const db = store();
    await db.setJSON(`orders/${orderId}`, record);
    if (record.slug) await db.setJSON(`slugs/${record.slug}`, { orderId });
    return json({ ok: true, orderId, amount, status: 'pending', payUrl: result.pay_url });
  } catch (error) {
    return json({ ok: false, error: 'payment_create_error', message: String(error?.message || error) }, 500);
  }
};

export const config = { path: '/api/pay' };
