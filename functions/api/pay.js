import {state,now} from './runtime-state.mjs';
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

const id = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export async function onRequestPost({ request, env }) {
  const durableAccounting = !!env.PAYMENTS && String(env.PAYMENTS_DURABLE || "false").toLowerCase() === "true";
  if (!durableAccounting) return json({ ok: false, error: "durable_payment_storage_required" }, 503);

  const apiKey = env.VARIZA_API_KEY || env.VARIA_API_KEY || env.VARIZA_TOKEN || env.VARIZA_KEY || env.VARIZA_API_TOKEN || env.VARIZA_SECRET;
  if (!apiKey) return json({ ok: false, error: "payment_not_configured" }, 503);

  try {
    const body = await request.json();
    const amount = Math.round(Number(body?.amount));
    if (!Number.isFinite(amount) || amount < 1000) {
      return json({ ok: false, error: "invalid_amount" }, 400);
    }

    const orderId = String(body?.orderId || id()).slice(0, 120);
    const existing = env.PAYMENTS
      ? await env.PAYMENTS.get(`orders/${orderId}`, "json").catch(() => null)
      : state.orders.get(orderId) || null;
    if (existing?.status === "pending" && existing?.payUrl) {
      return json({ ok: true, orderId, amount: existing.amount, status: "pending", payUrl: existing.payUrl, reused: true });
    }
    const client = String(body?.client || "مشتری ANIL X").trim().slice(0, 120);
    const description = String(body?.description || "پرداخت ANIL X").trim().slice(0, 240);
    const origin = new URL(request.url).origin;
    const returnUrl = String(
      body?.returnUrl ||
      env.VARIZA_RETURN_URL ||
      `${origin}/payment.html?order=${encodeURIComponent(orderId)}`
    ).slice(0, 500);

    if (!/^https:\/\//i.test(returnUrl)) {
      return json({ ok: false, error: "invalid_return_url" }, 400);
    }

    const response = await fetch("https://variza.ir/api/v1/pay", {
      method: "POST",
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

    const raw = await response.text();
    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      result = { raw };
    }

    if (!response.ok || !result?.pay_url) {
      return json({
        ok: false,
        error: "variza_create_payment_failed",
        providerStatus: response.status,
        details: result
      }, 502);
    }

    const sourceOrder = orderId
      ? ((env.PAYMENTS && await env.PAYMENTS.get(`orders/${orderId}`, "json").catch(() => null)) || state.orders.get(orderId) || null)
      : null;
    const record = {
      orderId,
      client,
      description,
      amount,
      providerAmount: amount,
      providerCurrency: "IRR",
      providerAmountUnit: "toman",
      orderAmount: Number(sourceOrder?.amount || 0),
      orderCurrency: String(sourceOrder?.currency || "USD"),
      service: String(sourceOrder?.service || ""),
      status: "pending",
      payUrl: result.pay_url,
      slug: result.slug || null,
      createdAt: now(),
      provider: "variza"
    };

    state.orders.set(orderId,record);

    if (env.PAYMENTS) {
      await env.PAYMENTS.put(`orders/${orderId}`, JSON.stringify(record));
      if (record.slug) {
        await env.PAYMENTS.put(`slugs/${record.slug}`, JSON.stringify({ orderId }));
      }
    }

    return json({
      ok: true,
      orderId,
      amount,
      status: "pending",
      payUrl: result.pay_url
    });
  } catch (error) {
    return json({
      ok: false,
      error: "payment_create_error",
      message: String(error?.message || error)
    }, 500);
  }
}
