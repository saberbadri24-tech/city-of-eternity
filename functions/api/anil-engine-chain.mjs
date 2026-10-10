const clean = value => String(value ?? '').trim();
const includesAny = (text, words) => words.some(word => text.includes(word));

const ENGINES = [
  {
    id: 'payment-integrity',
    name: 'Payment Integrity Engine',
    keywords: ['variza','payment','checkout','wallet','ton','webhook','settlement','کیف پول','واریزا','پرداخت','تسویه','تراکنش'],
    title: 'بررسی یکپارچگی پرداخت و کیف پول',
    desc: 'مسیر پرداخت، تطبیق مبلغ، امضای وب‌هوک، ثبت پایدار و رسید تسویه را به‌صورت مرحله‌ای بررسی کن.',
    moves: ['بررسی تنظیمات واریزا و کیف پول بدون نمایش اسرار','آزمون ساخت سفارش و تولید لینک پرداخت','اعتبارسنجی امضای وب‌هوک و تطبیق دقیق مبلغ','بررسی ثبت پایدار سفارش و جلوگیری از رویداد تکراری','تأیید درآمد فقط با رسید معتبر تسویه']
  },
  {
    id: 'guard-security',
    name: 'Guard Security Engine',
    keywords: ['guard','airdrop','opportunity','claim','radar','گارد','ایردراپ','فرصت','توکن'],
    title: 'بررسی Guard جاویدان و فرصت‌ها',
    desc: 'منبع رسمی، کیفیت فرصت، خطرات و صف بازبینی مالک را بررسی کن؛ کشف به‌تنهایی درآمد محسوب نمی‌شود.',
    moves: ['کشف فرصت از منبع رسمی و ثبت زمان بررسی','تطبیق شناسه و حذف موارد تکراری یا منقضی','ارزیابی ریسک و شواهد مستقل','انتقال موارد واجد شرایط به صف بازبینی مالک','توقف پیش از امضا، مطالبه یا انتقال وجه تا تأیید مالک']
  },
  {
    id: 'code-quality',
    name: 'Code Quality Engine',
    keywords: ['code','bug','error','fix','syntax','test','deploy','github','render','کد','خطا','خراب','رفع','آزمون','دیپلوی','گیتهاب'],
    title: 'تشخیص، اصلاح و آزمون کد',
    desc: 'به‌جای ادعای اصلاح، ابتدا خطا را بازتولید کن، دامنه تغییر را محدود نگه دار و بعد آزمون و بازبینی انجام بده.',
    moves: ['بازبینی نسخه فعلی و آخرین تغییر مرتبط','تولید بازتولید حداقلی خطا و شناسایی علت ریشه‌ای','اعمال کوچک‌ترین اصلاح سازگار با نسخه سالم','اجرای آزمون نحوی، آزمون مسیر حیاتی و بررسی رگرسیون','انتشار فقط پس از موفقیت آزمون‌ها و بررسی وضعیت استقرار']
  },
  {
    id: 'revenue-operations',
    name: 'Revenue Operations Engine',
    keywords: ['revenue','sales','lead','customer','order','growth','seo','درآمد','فروش','سرنخ','مشتری','سفارش','رشد','سئو'],
    title: 'تحلیل ناوگان درآمد و فروش',
    desc: 'سرنخ، پیشنهاد، سفارش و پرداخت را از هم جدا نگه دار و فقط نتایج دارای شواهد را درآمد واقعی ثبت کن.',
    moves: ['پاک‌سازی و امتیازدهی سرنخ‌ها','ساخت پیشنهاد متناسب با خدمت و نیاز مشتری','تهیه پیش‌نویس پیگیری بدون ارسال انبوه خودکار','تطبیق سفارش با وضعیت پرداخت واقعی','محاسبه درآمد فقط از سفارش تسویه‌شده و ثبت شواهد']
  },
  {
    id: 'research-verification',
    name: 'Research Verification Engine',
    keywords: ['research','search','compare','verify','source','latest','تحقیق','جستجو','مقایسه','راستی‌آزمایی','منبع','جدیدترین'],
    title: 'تحقیق و راستی‌آزمایی شواهد',
    desc: 'ادعاها را از واقعیت‌های تأییدشده جدا کن و برای اطلاعات نامطمئن، منبع و محدودیت را مشخص کن.',
    moves: ['تبدیل درخواست به پرسش‌های قابل بررسی','تفکیک داده موجود از فرضیه و داده مفقود','بررسی اعتبار، تاریخ و استقلال منابع','مقایسه شواهد متعارض و ثبت سطح اطمینان','ارائه نتیجه همراه با محدودیت‌های قابل‌اثبات']
  },
  {
    id: 'website-operations',
    name: 'Website Operations Engine',
    keywords: ['website','site','ui','admin','dashboard','page','سایت','وب‌سایت','پنل','داشبورد','صفحه','دکمه'],
    title: 'بررسی تجربه کاربری و عملیات سایت',
    desc: 'مسیر کاربر را از صفحه تا اقدام نهایی بررسی کن و تغییرات را با آزمون رگرسیون محافظت کن.',
    moves: ['شناسایی مسیر کاربر و نتیجه مورد انتظار','بررسی مسیرهای فارسی و انگلیسی به‌صورت مستقل','آزمون دکمه‌ها، APIها، ورود و ذخیره‌سازی','بررسی موبایل و خطاهای کنسول','تأیید نهایی فقط با آزمون قابل تکرار']
  }
];

const DEFAULT_ENGINE = {
  id: 'general-reasoning',
  name: 'ANIL Core Reasoning Engine',
  title: 'تحلیل و برنامه‌ریزی مسئله',
  desc: 'درخواست به گام‌های قابل بررسی تبدیل می‌شود؛ اجرای واقعی فقط پس از دسترسی به ابزار مناسب و وجود شواهد گزارش خواهد شد.',
  moves: ['تعریف نتیجه مطلوب و معیار موفقیت','تفکیک اطلاعات قطعی از موارد نامشخص','ساخت چند اقدام کم‌خطر و اولویت‌بندی آن‌ها','بررسی نتیجه هر اقدام و اصلاح مسیر','گزارش وضعیت واقعی و گام بعدی']
};

const IRREVERSIBLE = /\b(delete|transfer|withdraw|sign|claim|purchase|charge|deploy to production|send to all)\b|حذف دائمی|انتقال وجه|برداشت|امضای تراکنش|مطالبه خودکار|ارسال انبوه/i;

export function runLocalEngineChain(request) {
  const original = clean(request);
  const normalized = original.toLowerCase();
  const matched = ENGINES.filter(engine => includesAny(normalized, engine.keywords));
  const selected = matched[0] || DEFAULT_ENGINE;
  const operational = /\b(fix|deploy|execute|change|commit|payment|wallet|guard|revenue|order|customer|website|code|test|audit)\b|رفع|اجرا|تغییر|کامیت|پرداخت|کیف پول|گارد|درآمد|سفارش|مشتری|سایت|کد|آزمون|بررسی عملی/i.test(normalized);
  const requiresOwnerApproval = IRREVERSIBLE.test(normalized) || matched.some(x => ['payment-integrity','guard-security'].includes(x.id));
  const engines = [
    {id:'sense',name:'Sense Engine',status:'completed'},
    {id:'intent',name:'Intent Router',status:'completed'},
    {id:selected.id,name:selected.name,status:'planned'},
    {id:'risk',name:'Risk and Policy Gate',status:'completed'},
    {id:'verification',name:'Evidence Verification Engine',status:'planned'},
    {id:'recovery',name:'Repair and Recovery Engine',status:'ready'},
    {id:'release',name:'Release Gate',status:'blocked_until_evidence'}
  ];
  const plan = {
    title: selected.title,
    desc: selected.desc,
    moves: selected.moves.slice(0, 6),
    engines: matched.map(x => ({id:x.id,name:x.name})).concat(matched.length ? [] : [{id:DEFAULT_ENGINE.id,name:DEFAULT_ENGINE.name}]),
    executionStatus: 'plan_only',
    requiresOwnerApproval,
    evidenceRequired: true
  };
  const languageFa = /[\u0600-\u06FF]/.test(original);
  const reply = languageFa
    ? (operational
      ? 'زنجیره داخلی ANIL فعال است: درخواست دسته‌بندی شد، موتور تخصصی انتخاب شد و کنترل ریسک اعمال شد. این پاسخ برنامه و کنترل‌ها را مشخص می‌کند؛ هنوز اجرای بیرونی یا تغییر زنده‌ای انجام‌شده تلقی نمی‌شود. گام‌ها: ' + selected.moves.slice(0, 3).join('؛ ') + (requiresOwnerApproval ? '؛ اقدام حساس تا تأیید مالک متوقف می‌ماند.' : '؛ پس از اجرا باید آزمون و شواهد ثبت شود.')
      : selected.desc + ' مسیر پیشنهادی: ' + selected.moves.slice(0, 3).join('؛ ') + '.')
    : (operational
      ? 'ANIL internal engine chain is active: intent was routed, a specialist engine was selected, and the risk gate was applied. This is a plan, not proof of external execution or a live change. Next steps: ' + selected.moves.slice(0, 3).join('; ') + (requiresOwnerApproval ? '; sensitive actions remain blocked until owner approval.' : '; tests and evidence are required after execution.')
      : selected.desc + ' Suggested path: ' + selected.moves.slice(0, 3).join('; ') + '.');
  return {
    engine: 'ANIL-INDEPENDENT-ENGINE-CHAIN',
    version: '1.0.0',
    mode: operational ? 'operational-plan' : 'reasoning-plan',
    plan,
    reply,
    selectedEngine: selected.name,
    confidence: matched.length ? 0.72 : 0.56,
    requiresOwnerApproval,
    execution: {performed:false, status:'not_executed', reason:'provider-independent planning does not fabricate tool execution'},
    chain: engines,
    orchestration: {
      required: true,
      mode: operational ? 'EXECUTABLE_OPERATION' : 'CONVERSATIONAL',
      stages: ['SENSE','UNDERSTAND','PLAN','DELEGATE','EXECUTE','VERIFY','REPAIR','TEST','RELEASE','OBSERVE','LEARN'],
      providerIndependent: true,
      externalProviderRequired: false,
      executionEvidenceRequired: true
    }
  };
}
