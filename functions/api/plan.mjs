const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST,OPTIONS',
  'access-control-allow-headers': 'content-type'
};

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
const text = (v) => String(v || '').trim();

function localPlan(input) {
  const t = text(input).toLowerCase();
  const rules = [
    [['site','website','سایت','وب سایت','وب‌سایت','فروشگاه','landing'], 'website', 'ساخت و راه‌اندازی سایت'],
    [['video','teaser','تیزر','ویدیو','فیلم','کلیپ'], 'video', 'تولید محتوای ویدیویی'],
    [['bug','error','fix','خطا','خراب','مشکل','ارور','کند','کار نمی','رفع'], 'fix', 'تشخیص و رفع مشکل'],
    [['sales','growth','seo','فروش','مشتری','رشد','تبلیغ','سئو','بازدید','درآمد'], 'growth', 'موتور رشد کسب‌وکار']
  ];
  const hit = rules.find(([keys]) => keys.some((k) => t.includes(k)));
  const title = hit?.[2] || 'مسیر اختصاصی ANIL X';
  if (/نه|نمیخوام|اشتباه|این نیست|عوضش|بیخیال|لغو|cancel|\bno\b/.test(t)) {
    return { title: 'مسیر دوباره تنظیم شد', desc: 'اصلاح ثبت شد؛ مسیر قبلی مبنا نیست.', moves: ['خواسته جدید','اقدام مناسب','اجرا یا پیش‌نمایش','بررسی نتیجه'] };
  }
  if (/فوری|سریع|الان|همین|فقط/.test(t)) {
    return { title: 'اقدام مستقیم', desc: 'مسیر کوتاه شده و فقط اقدام‌های ضروری باقی مانده‌اند.', moves: ['اقدام بعدی','اجرا','تأیید نتیجه'] };
  }
  return { title, desc: 'مسیر بر اساس خواسته فعلی ساخته می‌شود و با هر اصلاح دوباره تنظیم می‌شود.', moves: ['فهم نتیجه مطلوب','انتخاب اقدام بعدی','اجرا','بررسی و اصلاح'] };
}

async function openAI(env, prompt) {
  if (!env.OPENAI_API_KEY) return null;
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: env.ASTRA_MODEL || 'gpt-5-mini',
      messages: [
        { role: 'system', content: 'You are Astra, the central ANIL X orchestrator. Adapt to the user. Return concise JSON with keys title, desc, moves, reply, confidence. Never claim an action was completed without evidence.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2
    })
  });
  if (!response.ok) throw new Error(`openai_${response.status}`);
  const data = await response.json();
  const raw = data?.choices?.[0]?.message?.content || '';
  try { return JSON.parse(raw); } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  }
}

async function claudeCheck(env, prompt) {
  if (!env.ANTHROPIC_API_KEY) return null;
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: env.CLAUDE_MODEL || 'claude-sonnet-4-5',
      max_tokens: 700,
      system: 'You are ANIL X engineering and safety reviewer. Check the proposed plan for contradictions, unsupported completion claims, unsafe actions, and needless fixed steps. Return JSON with ok, corrections, confidence.',
      messages: [{ role: 'user', content: prompt }]
    })
  });
  if (!response.ok) throw new Error(`anthropic_${response.status}`);
  const data = await response.json();
  const raw = data?.content?.map((x) => x.text || '').join('') || '';
  try { return JSON.parse(raw); } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  }
}

async function council(body, env) {
  const requestText = text(body?.text || body?.request);
  if (!requestText) return { ok: false, error: 'missing_request' };
  const fallback = localPlan(requestText);
  const prompt = JSON.stringify({ request: requestText, profile: body?.profile || {}, previousRoute: body?.previousRoute || 'custom', conversation: Array.isArray(body?.turns) ? body.turns.slice(-8) : [], fallback });
  let astra = null;
  let review = null;
  try { astra = await openAI(env, prompt); } catch {}
  if (astra) {
    try { review = await claudeCheck(env, JSON.stringify({ request: requestText, plan: astra })); } catch {}
    if (review && review.ok === false && Array.isArray(review.corrections)) {
      astra.desc = `${astra.desc || ''} ${review.corrections.join(' ')}`.trim();
      astra.confidence = Math.min(Number(astra.confidence) || 0.7, Number(review.confidence) || 0.7);
    }
    return { ok: true, source: 'ai-council', orchestrator: 'astra', reviewer: review ? 'claude' : 'local', plan: { title: astra.title || fallback.title, desc: astra.desc || fallback.desc, moves: Array.isArray(astra.moves) && astra.moves.length ? astra.moves.slice(0, 6) : fallback.moves }, reply: astra.reply || `گرفتم: ${astra.title || fallback.title}`, confidence: Number(astra.confidence) || 0.75 };
  }
  return { ok: true, source: 'local-fallback', orchestrator: 'local', reviewer: 'local', plan: fallback, reply: `گرفتم: ${fallback.title}`, confidence: 0.55 };
}

export default async (request, context) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: JSON_HEADERS });
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  try { return json(await council(await request.json(), Netlify.env)); }
  catch (error) { return json({ ok: false, error: 'engine_failure', message: String(error?.message || error) }, 502); }
};

export const config = { path: '/api/plan' };
