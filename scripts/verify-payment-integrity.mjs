import fs from 'node:fs';
import { getUsdTomanConfig, usdToToman } from '../functions/api/currency.mjs';

const read = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const files = {
  pay: read('../functions/api/pay.js'),
  readiness: read('../functions/api/execution-readiness.mjs'),
  autopilot: read('../functions/api/autopilot.mjs'),
  server: read('../render-server.mjs'),
  webhook: read('../functions/api/variza-webhook.js'),
  worker: read('../worker.js')
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
  ['payment return URLs are HTTPS and restricted to approved origins', files.pay.includes('url.protocol !== \'https:\'') && files.pay.includes('allowedOrigins.has(url.origin)')],
  ['checkout catalog uses the same configured START/FIX/BUILD/GROW prices shown to customers', files.worker.includes("website:{name:'AI Website Build',plan:'BUILD'}") && files.worker.includes("teaser:{name:'Marketing Teaser',plan:'START'}") && files.worker.includes("fix:{name:'Website Fix',plan:'FIX'}") && files.worker.includes("growth:{name:'Growth & SEO',plan:'GROW'}") && files.worker.includes('const pricing=await getV90Config(env)')],
  ['USD to Toman conversion does not mistake Rials for Tomans', getUsdTomanConfig({USD_IRR_RATE:'2687600'}).rate === 268760 && getUsdTomanConfig({USD_TOMAN_RATE:'268760'}).rate === 268760 && getUsdTomanConfig({}).rate === 268760 && usdToToman(19,{USD_IRR_RATE:'2687600'}) === 5106440]
];
const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log((ok ? 'PASS ' : 'FAIL ') + name);
if (failed.length) process.exit(1);
console.log('ANIL X payment-integrity gate: PASS (' + checks.length + ' checks)');
