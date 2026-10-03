import {state,now} from './runtime-state.mjs';
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

const safeEqual = (a, b) => {
  const aa = new TextEncoder().encode(a), bb = new TextEncoder().encode(b);
  if (aa.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
  return diff === 0;
};

const hmac = async (secret, body) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, body);
  return "sha256=" + [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
};

export async function onRequestPost({ request, env }) {
  const secret = env.VARIZA_WEBHOOK_SECRET || env.VARIA_WEBHOOK_SECRET || env.VARIZA_WEBHOOK_TOKEN || env.VARIZA_WEBHOOK_KEY || env.VARIZA_SECRET;
  if (!secret) return json({ ok: false, error: "webhook_not_configured" }, 503);

  try {
    const body = new Uint8Array(await request.arrayBuffer());
    const signature = request.headers.get("x-webhook-signature") || "";
    const eventHeader = request.headers.get("x-event") || "payment.paid";

    if (eventHeader !== "payment.paid") return json({ ok: true, ignored: true });

    const expected = await hmac(secret, body);
    if (!safeEqual(expected, signature)) {
      return json({ ok: false, error: "invalid_signature" }, 400);
    }

    const payload = JSON.parse(new TextDecoder().decode(body));
    if (payload?.event !== "payment.paid" || payload?.status !== "paid") {
      return json({ ok: true, ignored: true });
    }

    if (!env.PAYMENTS) {
      const local = payload.slug ? [...state.orders.values()].find(x => x.slug === payload.slug) : null;
      if (!local) return json({ ok: true, status: 'received_unmatched' });
      const paidAmount = Number(payload.amount);
      const expectedAmount = Number(local.providerAmount ?? local.amount);
      if (!Number.isFinite(paidAmount) || !Number.isFinite(expectedAmount) || paidAmount < expectedAmount) {
        local.status = 'amount_mismatch';
        local.updatedAt = now();
        local.providerAmount = Number.isFinite(paidAmount) ? paidAmount : null;
        state.orders.set(local.orderId, local);
        return json({ ok: true, orderId: local.orderId, status: 'amount_mismatch' }, 200);
      }
      local.status = 'paid';
      local.paidAt = now();
      local.attemptCode = payload.attempt_code || null;
      local.providerAmount = paidAmount;
      local.updatedAt = now();
      state.orders.set(local.orderId, local);
      return json({ ok: true, orderId: local.orderId, status: 'paid' });
    }

    const deliveryId =
      request.headers.get("x-delivery-id") ||
      payload.attempt_code ||
      `${payload.slug}:${payload.sent_at}`;
    const deliveryKey = `deliveries/${deliveryId}`;

    if (await env.PAYMENTS.get(deliveryKey)) {
      return json({ ok: true, duplicate: true });
    }

    const map = payload.slug
      ? await env.PAYMENTS.get(`slugs/${payload.slug}`, "json")
      : null;
    const orderId = map?.orderId;
    const order = orderId
      ? await env.PAYMENTS.get(`orders/${orderId}`, "json")
      : null;

    if (order) {
      const paid =
        Number.isFinite(Number(payload.amount)) &&
        Number(payload.amount) >= Number(order.providerAmount ?? order.amount);

      const updated = {
        ...order,
        status: paid ? "paid" : "amount_mismatch",
        ...(paid ? { paidAt: now() } : {}),
        providerAmount: Number(payload.amount),
        providerCurrency: "IRR",
        providerAmountUnit: "toman",
        attemptCode: payload.attempt_code || null,
        deliveryId,
        webhook: payload
      };

      await env.PAYMENTS.put(`orders/${orderId}`, JSON.stringify(updated)); state.orders.set(orderId,updated);
      await env.PAYMENTS.put(
        deliveryKey,
        JSON.stringify({ orderId, receivedAt: new Date().toISOString() })
      );

      return json({ ok: true, orderId, status: updated.status });
    }

    await env.PAYMENTS.put(
      deliveryKey,
      JSON.stringify({
        orderId: null,
        slug: payload.slug || null,
        receivedAt: now(),
        orphan: true
      })
    );

    return json({ ok: true, status: "received_unmatched" });
  } catch (error) {
    return json({
      ok: false,
      error: "webhook_processing_error",
      message: String(error?.message || error)
    }, 500);
  }
}
