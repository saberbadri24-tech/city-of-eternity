import {state,now} from './runtime-state.mjs';
import {getUsdTomanConfig,getUsdTomanRate,getLiveUsdTomanConfig} from './currency.mjs';

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});
const first = (env, keys) => keys.map(key => env?.[key]).find(value => value !== undefined && value !== null && String(value).trim() !== '') || '';
const id = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function safeReturnUrl(value, requestOrigin, env, orderId) {
  const fallback = first(env, ['VARIZA_RETURN_URL']) || `${requestOrigin}/payment.html?order=${encodeURIComponent(orderId)}`;
  const raw = String(value || fallback).trim();
  try {
    const url = new URL(raw);
    const allowedOrigins = new Set([requestOrigin]);
    for (const candidate of [env?.ANIL_PUBLIC_ORIGIN, env?.VARIZA_RETURN_URL]) {
      if (!candidate) continue;
      try { allowedOrigins.add(new URL(candidate).origin); } catch {}
    }
    if (url.protocol !== 'https:' || !allowedOrigins.has(url.origin)) return null;
    return url.href;
  } catch {
    return null;
  }
}

function expectedProviderAmount(order, env, rate = getUsdTomanRate(env)) {
  const currency = String(order?.currency || order?.orderCurrency || 'USD').toUpperCase();
  const amount = Number(order?.orderAmount ?? order?.amount);
  if (!Number.isFinite(amount) || amount <= 0) return NaN;
  if (currency === 'USD') return Math.round(amount * Number(rate));
  if (currency === 'TOMAN' || currency === 'IRT') return Math.round(amount);
  if (currency === 'IRR') return Math.round(amount / 10);
  return NaN;
}

export async function onRequestPost({ request, env }) {
  const durableAccounting = !!env.PAYMENTS && String(env.PAYMENTS_DURABLE || "false").toLowerCase() === "true";
  if (!durableAccounting) return json({ ok: false, error: "durable_payment_storage_required" }, 503);

  const apiKey = first(env, ['VARIZA_API_KEY','VARIA_API_KEY','VARIZA_TOKEN','VARIZA_KEY','VARIZA_API_TOKEN','VARIZA_SECRET','VARIZA_API','VARIZA_ACCESS_TOKEN','VARIZA_BEARER_TOKEN']);
  if (!apiKey) return json({ ok: false, error: "payment_not_configured" }, 503);

  try {
    const body = await request.json();
    const amount = Number(body?.amount);
    if (!Number.isSafeInteger(amount) || amount < 1000) {
      return json({ ok: false, error: "invalid_amount" }, 400);
    }

    const orderId = String(body?.orderId || '').trim().slice(0, 120);
    if (!orderId) return json({ ok: false, error: "order_required" }, 400);

    const existing = await env.PAYMENTS.get(`orders/${orderId}`, "json").catch(() => null);
    if (!existing) return json({ ok: false, error: "order_not_found" }, 404);
    if (existing.status !== "pending") return json({ ok: false, error: "order_not_payable" }, 409);

    const orderCurrency = String(existing.currency || existing.orderCurrency || 'USD').toUpperCase();
    const fxConfig = await getLiveUsdTomanConfig(env);
    if (orderCurrency === 'USD' && fxConfig.source === 'runtime-default') {
      return json({ ok: false, error: 'fx_unavailable' }, 503);
    }
    const expectedAmount = expectedProviderAmount(existing, env, fxConfig.rate);
    if (!Number.isSafeInteger(expectedAmount) || expectedAmount < 1000 || amount !== expectedAmount) {
      return json({ ok: false, error: "order_amount_mismatch" }, 409);
    }

    const priorPayUrl = String(existing.payUrl || '');
    const priorBaseAmount = Number(existing.providerBaseAmount ?? existing.providerAmount);
    if (priorPayUrl && priorBaseAmount === amount) {
      return json({ ok: true, orderId, amount, status: "pending", payUrl: priorPayUrl, reused: true });
    }

    const client = String(body?.client || existing.email || existing.client || "مشتری ANIL X").trim().slice(0, 120);
    const description = String(body?.description || existing.description || "پرداخت ANIL X").trim().slice(0, 240);
    const origin = new URL(request.url).origin;
    const returnUrl = safeReturnUrl(body?.returnUrl, origin, env, orderId);
    if (!returnUrl) return json({ ok: false, error: "invalid_return_url" }, 400);

    const response = await fetch("https://variza.ir/api/v1/pay", {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount,
        return_url: returnUrl,
        title: description,
        expires_in: "1h",
        ...(env.VARIZA_SETTLEMENT_TO_WALLET === "true" ? { card_last_4: "variza" } : {})
      })
    });

    const result = await response.json().catch(() => null);
    let payUrl = '';
    try {
      const parsed = new URL(String(result?.pay_url || ''));
      if (parsed.protocol === 'https:' && (parsed.hostname === 'variza.ir' || parsed.hostname.endsWith('.variza.ir'))) payUrl = parsed.href;
    } catch {}

    if (!response.ok || !payUrl) {
      return json({
        ok: false,
        error: "variza_create_payment_failed",
        providerStatus: response.status
      }, 502);
    }

    const record = {
      ...existing,
      orderId,
      client,
      description,
      amount,
      providerAmount: amount,
      providerBaseAmount: amount,
      providerCurrency: "TOMAN",
      providerAmountUnit: "toman",
      orderAmount: Number(existing.orderAmount ?? existing.amount),
      orderCurrency: String(existing.currency || existing.orderCurrency || "USD"),
      service: String(existing.service || ""),
      plan: existing.plan || null,
      status: "pending",
      payUrl,
      slug: result.slug || null,
      updatedAt: now(),
      provider: "variza"
    };

    await env.PAYMENTS.put(`orders/${orderId}`, JSON.stringify(record));
    state.orders.set(orderId, record);
    if (record.slug) {
      await env.PAYMENTS.put(`slugs/${record.slug}`, JSON.stringify({ orderId }));
    }

    return json({ ok: true, orderId, amount, status: "pending", payUrl });
  } catch (error) {
    return json({
      ok: false,
      error: "payment_create_error",
      message: String(error?.message || error).slice(0, 180)
    }, 500);
  }
}
