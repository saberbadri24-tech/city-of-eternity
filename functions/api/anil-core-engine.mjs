// ANIL X owned core engine — deterministic, dependency-free fallback.
// This is an orchestration/planning engine, not a claim of a trained foundation model.
const norm = value => String(value ?? "").trim().toLowerCase()
  .replace(/[يى]/g, "ی").replace(/ك/g, "ک")
  .replace(/[\u200c\u200d]/g, " ").replace(/\s+/g, " ");

const ROUTES = [
  { id:"website", keys:["سایت","وبسایت","وب‌سایت","website","web app","landing","فروشگاه اینترنتی"], titleFa:"ساخت و بهبود سایت", titleEn:"Website build and improvement", stepsFa:["هدف و مشتری هدف را مشخص کن","صفحه‌ها و جریان کار را طراحی کن","پیاده‌سازی را به بخش‌های کوچک تقسیم کن","نسخه قابل مشاهده بساز","لینک‌ها، فرم‌ها، موبایل و امنیت را تست کن","فقط پس از تست، منتشر و پایش کن"], stepsEn:["Define the outcome and audience","Map pages and user flows","Implement in small verifiable slices","Create a reviewable preview","Test links, forms, mobile and security","Deploy only after checks, then monitor"] },
  { id:"debug", keys:["خطا","ارور","خراب","کار نمی‌کنه","کار نمیکنه","bug","error","broken","debug","fix","کند","slow","stuck","لود"], titleFa:"عیب‌یابی و تعمیر", titleEn:"Diagnosis and repair", stepsFa:["نشانه و مسیر بازتولید مشکل را ثبت کن","لاگ و درخواست شبکه را بررسی کن","علت اصلی را از نشانه جدا کن","کوچک‌ترین اصلاح امن را اعمال کن","تست رگرسیون و مسیر اصلی را اجرا کن","نتیجه را با شواهد گزارش کن"], stepsEn:["Capture symptoms and reproduction steps","Inspect logs and network requests","Separate root cause from symptoms","Apply the smallest safe fix","Run regression and critical-path tests","Report results with evidence"] },
  { id:"business", keys:["کسب‌وکار","فروش","مشتری","درآمد","بازاریابی","سئو","business","sales","customer","revenue","marketing","seo","growth","lead"], titleFa:"رشد کسب‌وکار", titleEn:"Business growth", stepsFa:["هدف قابل اندازه‌گیری تعیین کن","مشتری و مسئله واقعی را مشخص کن","پیشنهاد و کانال جذب را انتخاب کن","آزمایش کوچک و کم‌هزینه اجرا کن","تبدیل و هزینه را اندازه بگیر","فقط روش‌های اثبات‌شده را توسعه بده"], stepsEn:["Set a measurable outcome","Identify the customer and real problem","Choose an offer and acquisition channel","Run a small low-cost experiment","Measure conversion and cost","Scale only what evidence supports"] },
  { id:"code", keys:["کد","برنامه‌نویسی","اسکریپت","api","کدنویسی","code","coding","program","script","repository","github"], titleFa:"مهندسی و توسعه نرم‌افزار", titleEn:"Software engineering", stepsFa:["نیازمندی و قرارداد ورودی/خروجی را مشخص کن","وابستگی‌ها و فایل‌های مرتبط را پیدا کن","تغییر محدود و قابل بازگشت طراحی کن","کد را با خطاهای قابل‌تشخیص بنویس","سینتکس و تست‌های مرتبط را اجرا کن","دیپلوی و سلامت زنده را جداگانه تأیید کن"], stepsEn:["Define requirements and I/O contracts","Inspect dependencies and affected files","Design a small reversible change","Implement explicit error handling","Run syntax and relevant tests","Verify deployment and live health separately"] },
  { id:"research", keys:["تحقیق","مقایسه","منبع","بررسی","اطلاعات","research","compare","sources","verify","latest","current"], titleFa:"تحقیق و راستی‌آزمایی", titleEn:"Research and verification", stepsFa:["سؤال دقیق را به چند ادعا تقسیم کن","منابع اولیه و تاریخ انتشار را پیدا کن","ادعاها را با منبع مستقل تطبیق بده","ابهام‌ها و داده‌های متناقض را جدا کن","نتیجه و سطح اطمینان را بیان کن","موارد تأییدنشده را صریح علامت بزن"], stepsEn:["Break the question into testable claims","Find primary sources and publication dates","Cross-check claims independently","Separate ambiguity and conflicting evidence","State conclusions and confidence","Label anything not verified"] },
  { id:"automation", keys:["خودکار","اتومات","زمان‌بندی","ربات","workflow","automate","automation","scheduler","agent","bot"], titleFa:"اتوماسیون کنترل‌شده", titleEn:"Controlled automation", stepsFa:["ورودی، خروجی و شرط توقف را تعریف کن","عملیات کم‌خطر را از حساس جدا کن","اجرای آزمایشی بدون اثر واقعی انجام بده","ثبت رویداد و جلوگیری از تکرار بساز","برای پرداخت، حذف و تغییر حساس تأیید بگیر","شکست را مهار کن و مسیر بازگشت داشته باش"], stepsEn:["Define inputs, outputs and stop conditions","Separate low-risk from sensitive actions","Dry-run before real side effects","Add audit logs and idempotency","Require approval for payments, deletion and sensitive changes","Contain failures and provide rollback"] },
  { id:"general", keys:[], titleFa:"حل مسئله تطبیقی", titleEn:"Adaptive problem solving", stepsFa:["نتیجه مورد انتظار را روشن کن","اطلاعات موجود و کمبودها را تفکیک کن","چند مسیر ممکن را با هزینه و ریسک بسنج","کوچک‌ترین گام قابل‌آزمایش را انتخاب کن","نتیجه را بررسی و مسیر را اصلاح کن","فقط کار انجام‌شده و تأییدشده را گزارش کن"], stepsEn:["Clarify the desired outcome","Separate known facts from missing information","Compare approaches by cost and risk","Choose the smallest testable next step","Inspect the result and adapt","Report only actions actually completed and verified"] }
];

const includesAny = (text, terms) => terms.some(term => text.includes(norm(term)));
const hasSensitiveIntent = text => includesAny(text, ["پرداخت","برداشت","انتقال وجه","کیف پول","حذف اطلاعات","حذف حساب","کلید خصوصی","عبارت بازیابی","transfer funds","withdraw","payment","delete account","private key","seed phrase"]);
const hasDeploymentIntent = text => includesAny(text, ["دیپلوی","انتشار","deploy","publish","production","پروداکشن"]);
const isPersian = text => /[\u0600-\u06ff]/.test(text);

export function buildCorePlan(input, body = {}) {
  const raw = String(input ?? "").trim().slice(0, 4000);
  const text = norm(raw);
  const language = isPersian(raw) ? "fa" : "en";
  const ranked = ROUTES.map(route => ({ route, score: route.keys.reduce((sum, key) => sum + (text.includes(norm(key)) ? 1 : 0), 0) }))
    .sort((a,b) => b.score - a.score);
  const route = ranked[0]?.score ? ranked[0].route : ROUTES[ROUTES.length - 1];
  const sensitive = hasSensitiveIntent(text);
  const deployment = hasDeploymentIntent(text);
  const profile = body?.profile && typeof body.profile === "object" ? body.profile : {};
  const steps = language === "fa" ? route.stepsFa : route.stepsEn;
  const title = language === "fa" ? route.titleFa : route.titleEn;
  const reply = language === "fa"
    ? `درخواستت را به مسیر «${title}» تبدیل کردم. قدم بعدی: ${steps[0]}. این برنامه محلی و فوری است؛ اجرای واقعی هر مرحله جداگانه باید تأیید شود.`
    : `I mapped your request to “${title}”. Next step: ${steps[0]}. This plan is generated locally; real execution must be verified separately.`;
  return {
    title, desc: language === "fa" ? "برنامه‌ریز داخلی ANIL X؛ بدون نیاز به سرویس مدل خارجی برای ساخت برنامه اولیه." : "ANIL X internal planner; no external model required for the initial plan.",
    steps, reply, confidence: ranked[0]?.score ? Math.min(0.78, 0.55 + ranked[0].score * 0.05) : 0.42,
    routeId: route.id, language,
    controls: { requiresOwnerApproval: sensitive || deployment, sensitiveIntent: sensitive, deploymentIntent: deployment },
    missingInputs: raw.length < 12 ? (language === "fa" ? ["نتیجه دقیق مورد انتظار"] : ["The exact desired outcome"]) : [],
    profileHint: typeof profile.audience === "string" ? profile.audience.slice(0,80) : undefined,
    engine: "ANIL-Core", mode: "deterministic-local", externalDependency: false
  };
}

export function parseModelJson(raw) {
  try { return JSON.parse(raw); } catch {}
  const match = String(raw ?? "").match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}
