import fs from 'node:fs';
import { getUsdTomanConfig, usdToToman } from '../functions/api/currency.mjs';
import { onRequestPost as createVarizaPayment } from '../functions/api/pay.js';
import { onRequestPost as handleVarizaWebhook } from '../functions/api/variza-webhook.js';

const read = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const files = {
  pay: read('../functions/api/pay.js'),
  readiness: read('../functions/api/execution-readiness.mjs'),
  autopilot: read('../functions/api/autopilot.mjs'),
  server: read('../render-server.mjs'),
  webhook: read('../functions/api/variza-webhook.js'),
  worker: read('../worker.js'),
  paymentPage: read('../payment.html')
};
const aliases = [
  'VARIZA_API_KEY','VARIA_API_KEY','VARIZA_TOKEN','VARIZA_KEY',
  'VARIZA_API_TOKEN','VARIZA_SECRET','VARIZA_API',
  'VARIZA_ACCESS_TOKEN','VARIZA_BEARER_TOKEN'
];
const checks = [
  ['payment creation accepts every documented Variza API alias', aliases.every(k => files.pay.includes(k))],
  ['execution readiness accepts every documented Variza API alias', aliases.every(k => files.readiness.includes(k))],
  ['revenue autopilot reports every documented Variza API alias', aliases.every(k => files.autopilot.includes(k))],
  ['Render health reports every documented Variza API alias', aliases.every(k => files.server.includes(k))],
  ['Variza webhook verifies HMAC signatures', files.webhook.includes('invalid_signature') && files.webhook.includes('await hmac(secret, body)')],
  ['Variza webhook validates the documented base_amount and preserves actual paid amount', files.webhook.includes('payload.base_amount ?? payload.amount') && files.webhook.includes('baseAmount === expectedAmount') && files.webhook.includes('providerBaseAmount') && files.webhook.includes("providerCurrency: \"TOMAN\"")],
  ['payment creation requires durable accounting and a real pending order', files.pay.includes('durable_payment_storage_required') && files.pay.includes('order_required') && files.pay.includes('order_not_found') && files.pay.includes('order_amount_mismatch')],
  ['payment configuration distinguishes provider credentials from checkout readiness', files.worker.includes('providerConfigured:varizaConfigured') && files.worker.includes('checkoutEnabled:fiatReady') && files.worker.includes("fx.source==='runtime-default'") && files.paymentPage.includes('paymentConfig.fiat?.checkoutEnabled')],
  ['payment return URLs are HTTPS and restricted to approved origins', files.pay.includes('url.protocol !== \'https:\'') && files.pay.includes('allowedOrigins.has(url.origin)')],
  ['checkout catalog uses the same configured START/FIX/BUILD/GROW prices shown to customers', files.worker.includes("website:{name:'AI Website Build',plan:'BUILD'}") && files.worker.includes("teaser:{name:'Marketing Teaser',plan:'START'}") && files.worker.includes("fix:{name:'Website Fix',plan:'FIX'}") && files.worker.includes("growth:{name:'Growth & SEO',plan:'GROW'}") && files.worker.includes('const pricing=await getV90Config(env)')],
  ['TON checkout is gated on an eligible order and verified receipt support', files.paymentPage.includes('checkoutEnabled') && files.paymentPage.includes("String(od.currency||'').toUpperCase()!=='TON'") && files.worker.includes('ton_order_receipt_verification_not_enabled') && !files.paymentPage.includes('const DEST=')],
  ['USD to Toman conversion does not mistake Rials for Tomans', getUsdTomanConfig({USD_IRR_RATE:'2687600'}).rate === 268760 && getUsdTomanConfig({USD_TOMAN_RATE:'268760'}).rate === 268760 && getUsdTomanConfig({}).rate === 268760 && usdToToman(19,{USD_IRR_RATE:'2687600'}) === 5106440],
  ['payment readiness does not treat the fallback FX estimate as configured', getUsdTomanConfig({}).source === 'runtime-default' && getUsdTomanConfig({USD_IRR_RATE:'2687600'}).source !== 'runtime-default'],
  ['checkout and readiness fail closed without configured FX', files.worker.includes("fx.source==='runtime-default'") && files.pay.includes("getUsdTomanConfig(env).source === 'runtime-default'") && files.readiness.includes("fx:fxConfig.source!=='runtime-default'")]
];
const mockData = new Map();
const mockPayments = {
  get: async key => mockData.get(key) ?? null,
  put: async (key, value) => { mockData.set(key, JSON.parse(value)); }
};
const integrationEnv = {
  PAYMENTS: mockPayments,
  PAYMENTS_DURABLE: 'true',
  VARIZA_API_KEY: 'unit-test-api-key',
  VARIZA_WEBHOOK_SECRET: 'unit-test-webhook-secret',
  USD_IRR_RATE: '2687600'
};
mockData.set('orders/order-integration', {
  orderId: 'order-integration', status: 'pending', currency: 'USD',
  amount: 19, orderAmount: 19, service: 'fix', plan: 'FIX'
});
mockData.set('orders/order-external', {
  orderId: 'order-external', status: 'pending', currency: 'USD',
  amount: 19, orderAmount: 19, service: 'fix', plan: 'FIX'
});
const originalFetch = globalThis.fetch;
let providerCalls = 0;
try {
  globalThis.fetch = async (_url, options) => {
    providerCalls++;
    const sent = JSON.parse(options.body);
    return new Response(JSON.stringify({
      pay_url: 'https://variza.ir/pay/slug-integration',
      slug: 'slug-integration',
      amount: sent.amount
    }), { status: 201, headers: { 'content-type': 'application/json' } });
  };
  const expectedToman = usdToToman(19, integrationEnv);
  const payRequest = new Request('https://anil-x-live.onrender.com/api/pay', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      orderId: 'order-integration', amount: expectedToman,
      returnUrl: 'https://anil-x-live.onrender.com/payment.html?order=order-integration&amount='+expectedToman
    })
  });
  const payResponse = await createVarizaPayment({ request: payRequest, env: integrationEnv });
  const payResult = await payResponse.json();
  const createdOrder = mockData.get('orders/order-integration');
  checks.push([
    'payment creation uses the exact USD-to-Toman amount and persists a Variza order',
    payResponse.status === 200 && payResult.ok === true && providerCalls === 1 &&
      createdOrder?.providerBaseAmount === expectedToman &&
      createdOrder?.providerCurrency === 'TOMAN' &&
      mockData.get('slugs/slug-integration')?.orderId === 'order-integration'
  ]);

  const noFxEnv = { ...integrationEnv, USD_IRR_RATE: '' };
  const noFxResponse = await createVarizaPayment({
    request: new Request('https://anil-x-live.onrender.com/api/pay', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        orderId: 'order-external', amount: expectedToman,
        returnUrl: 'https://anil-x-live.onrender.com/payment.html?order=order-external'
      })
    }),
    env: noFxEnv
  });
  checks.push([
    'payment creation fails closed when FX is only a runtime estimate',
    noFxResponse.status === 503 && (await noFxResponse.json()).error === 'fx_unavailable' && providerCalls === 1
  ]);

  const mismatchResponse = await createVarizaPayment({
    request: new Request('https://anil-x-live.onrender.com/api/pay', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId: 'order-integration', amount: expectedToman + 1 })
    }),
    env: integrationEnv
  });
  checks.push([
    'payment creation blocks amounts that differ from the order',
    mismatchResponse.status === 409 && providerCalls === 1
  ]);

  const externalReturnResponse = await createVarizaPayment({
    request: new Request('https://anil-x-live.onrender.com/api/pay', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        orderId: 'order-external', amount: expectedToman,
        returnUrl: 'https://attacker.example/collect'
      })
    }),
    env: integrationEnv
  });
  checks.push([
    'payment creation rejects a third-party return URL before calling Variza',
    externalReturnResponse.status === 400 && providerCalls === 1
  ]);

  const rawWebhook = JSON.stringify({
    event: 'payment.paid', status: 'paid', slug: 'slug-integration',
    amount: expectedToman + 128, base_amount: expectedToman,
    attempt_code: 'attempt-integration', sent_at: '2026-10-10T20:00:00Z'
  });
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(integrationEnv.VARIZA_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signatureBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawWebhook));
  const signature = 'sha256=' + [...new Uint8Array(signatureBytes)].map(x => x.toString(16).padStart(2, '0')).join('');
  const webhookResponse = await handleVarizaWebhook({
    request: new Request('https://anil-x-live.onrender.com/api/variza-webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-event': 'payment.paid',
        'x-webhook-signature': signature, 'x-delivery-id': 'delivery-integration' },
      body: rawWebhook
    }),
    env: integrationEnv
  });
  const webhookResult = await webhookResponse.json();
  const settledOrder = mockData.get('orders/order-integration');
  checks.push([
    'signed Variza webhook accepts documented base_amount despite payment suffix',
    webhookResponse.status === 200 && webhookResult.status === 'paid' &&
      settledOrder?.status === 'paid' &&
      settledOrder?.providerBaseAmount === expectedToman &&
      settledOrder?.providerAmount === expectedToman + 128
  ]);

  const badSignatureResponse = await handleVarizaWebhook({
    request: new Request('https://anil-x-live.onrender.com/api/variza-webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-event': 'payment.paid',
        'x-webhook-signature': 'sha256=bad', 'x-delivery-id': 'delivery-bad-signature' },
      body: rawWebhook
    }),
    env: integrationEnv
  });
  checks.push([
    'Variza webhook rejects an invalid HMAC signature',
    badSignatureResponse.status === 400
  ]);
} catch (error) {
  checks.push(['payment and webhook integration harness executes', false]);
  console.error('Payment integration test error:', String(error?.message || error));
} finally {
  globalThis.fetch = originalFetch;
}

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log((ok ? 'PASS ' : 'FAIL ') + name);
if (failed.length) process.exit(1);
console.log('ANIL X payment-integrity gate: PASS (' + checks.length + ' checks)');
