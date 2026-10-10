const clean = value => String(value ?? '').trim();
const has = (text, words) => words.some(word => text.includes(word));

const ENGINES = [
  {
    id: 'security-governance', name: 'Security & Governance Engine', weight: 110,
    keywords: ['security','threat','fraud','risk','privacy','secret','auth','permission','امنیت','تهدید','تقلب','ریسک','حریم خصوصی','رمز','مجوز'],
    title: 'امنیت، کنترل دسترسی و سیاست‌ها',
    desc: 'درخواست از نظر مجوز، افشای اطلاعات، اثر جانبی و امکان بازگشت بررسی می‌شود.',
    moves: ['طبقه‌بندی داده و سطح دسترسی لازم','شناسایی اثرهای جانبی و مسیر سوءاستفاده','اعمال اصل حداقل دسترسی و fail-closed','ثبت شواهد و دلیل تصمیم','توقف اقدام حساس تا تأیید مالک']
  },
  {
    id: 'payment-integrity', name: 'Payment Integrity Engine', weight: 105,
    keywords: ['variza','payment','checkout','wallet','ton','webhook','settlement','کیف پول','واریزا','پرداخت','تسویه','تراکنش'],
    title: 'یکپارچگی پرداخت و کیف پول',
    desc: 'سفارش، مبلغ، وب‌هوک، ذخیره پایدار و رسید تسویه باید مستقل و دقیق تطبیق داده شوند.',
    moves: ['بررسی تنظیمات بدون افشای اسرار','آزمون ساخت سفارش و لینک پرداخت','اعتبارسنجی امضای وب‌هوک و تطبیق مبلغ','کنترل تکرار رویداد و ثبت پایدار','ثبت درآمد فقط با مدرک تسویه معتبر']
  },
  {
    id: 'guard-security', name: 'Guard Opportunity & Safety Engine', weight: 100,
    keywords: ['guard','airdrop','opportunity','claim','radar','token','گارد','ایردراپ','فرصت','مطالبه','توکن'],
    title: 'گارد جاویدان و ارزیابی فرصت',
    desc: 'فرصت‌ها از منبع رسمی بررسی می‌شوند؛ کشف فرصت به‌تنهایی اثبات سود یا مجوز تراکنش نیست.',
    moves: ['بررسی منبع رسمی و زمان انتشار','حذف موارد تکراری، منقضی یا مشکوک','امتیازدهی شواهد و ریسک قرارداد','ثبت مورد در صف بازبینی مالک','توقف پیش از امضا، مطالبه یا انتقال وجه']
  },
  {
    id: 'code-quality', name: 'Code Quality & Repair Engine', weight: 95,
    keywords: ['code','bug','error','fix','syntax','test','deploy','github','render','کد','خطا','خراب','رفع','آزمون','دیپلوی','گیتهاب'],
    title: 'تشخیص علت ریشه‌ای، اصلاح و آزمون کد',
    desc: 'اصلاح باید محدود، قابل بازبینی و تحت آزمون باشد؛ ثبت کامیت به‌تنهایی اثبات سلامت نیست.',
    moves: ['بازبینی نسخه و تغییرات مرتبط','ساخت بازتولید حداقلی خطا','اعمال کوچک‌ترین اصلاح سازگار','اجرای آزمون نحوی و رگرسیون مسیرهای حیاتی','بررسی وضعیت استقرار و امکان بازگشت']
  },
  {
    id: 'revenue-operations', name: 'Revenue & Sales Engine', weight: 90,
    keywords: ['revenue','sales','lead','customer','order','growth','seo','درآمد','فروش','سرنخ','مشتری','سفارش','رشد','سئو'],
    title: 'عملیات درآمد، فروش و رشد',
    desc: 'سرنخ، پیشنهاد، سفارش، پرداخت و درآمد وصول‌شده جداگانه اندازه‌گیری می‌شوند.',
    moves: ['امتیازدهی سرنخ بر اساس تناسب و قصد خرید','پیشنهاد خدمت و قیمت متناسب','آماده‌سازی پیگیری بدون ارسال انبوه خودکار','تطبیق سفارش با وضعیت پرداخت واقعی','اندازه‌گیری تبدیل و درآمد تسویه‌شده']
  },
  {
    id: 'research-verification', name: 'Research & Evidence Engine', weight: 85,
    keywords: ['research','search','compare','verify','source','latest','تحقیق','جستجو','مقایسه','راستی‌آزمایی','منبع','جدیدترین'],
    title: 'تحقیق و راستی‌آزمایی',
    desc: 'پاسخ بر اساس شواهد موجود ساخته می‌شود و مجهولات، تاریخ منبع و تعارض داده‌ها صریح می‌مانند.',
    moves: ['تعریف پرسش‌های قابل بررسی','تفکیک واقعیت، فرضیه و داده مفقود','بررسی اعتبار و تازگی منابع','مقایسه شواهد متعارض','ارائه نتیجه با محدودیت و سطح اطمینان']
  },
  {
    id: 'website-operations', name: 'Website UX & Operations Engine', weight: 80,
    keywords: ['website','site','ui','admin','dashboard','page','button','سایت','وب‌سایت','پنل','داشبورد','صفحه','دکمه'],
    title: 'عملیات سایت و تجربه کاربری',
    desc: 'مسیر کاربر، رفتار دکمه‌ها، API، زبان، موبایل و خطاهای رابط باید قابل آزمون باشند.',
    moves: ['تعریف مسیر و نتیجه مورد انتظار کاربر','بررسی فارسی و انگلیسی به‌صورت مستقل','آزمون دکمه‌ها، API، ورود و ذخیره‌سازی','بررسی موبایل و خطاهای کنسول','تأیید فقط با آزمون قابل تکرار']
  },
  {
    id: 'writing-communication', name: 'Writing & Communication Engine', weight: 60,
    keywords: ['write','writing','email','message','copy','proposal','caption','نوشتن','ایمیل','پیام','متن','پیشنهادنامه','کپشن'],
    title: 'نگارش و ارتباط حرفه‌ای',
    desc: 'متن بر اساس مخاطب، هدف، لحن و اقدام مورد انتظار ساخته و از نظر وضوح بازبینی می‌شود.',
    moves: ['تشخیص مخاطب و هدف','انتخاب ساختار و لحن مناسب','تولید پیش‌نویس قابل استفاده','بازبینی وضوح، دقت و اختصار','تطبیق نسخه نهایی با محدودیت‌های کاربر']
  },
  {
    id: 'data-analysis', name: 'Data & Calculation Engine', weight: 65,
    keywords: ['data','spreadsheet','excel','csv','calculate','analysis','داده','اکسل','جدول','محاسبه','تحلیل داده','آمار'],
    title: 'تحلیل داده و محاسبات',
    desc: 'فرض‌ها، واحدها، کیفیت داده و روش محاسبه باید آشکار باشند و نتیجه قابل بازبینی بماند.',
    moves: ['شناسایی ورودی، واحد و داده مفقود','اعتبارسنجی دامنه و سازگاری داده','انتخاب روش محاسبه متناسب','کنترل مستقل نتیجه و خطاهای مرزی','ارائه نتیجه همراه با فرض‌ها']
  },
  {
    id: 'workflow-automation', name: 'Workflow & Automation Engine', weight: 70,
    keywords: ['automation','workflow','automate','cron','schedule','اتوماسیون','گردش کار','خودکارسازی','زمان‌بندی','جاب'],
    title: 'طراحی گردش‌کار و اتوماسیون',
    desc: 'گردش‌کار با ورودی/خروجی روشن، تکرارپذیری، ثبت رویداد و مسیر بازیابی طراحی می‌شود.',
    moves: ['تعریف trigger و معیار موفقیت','تقسیم کار به مراحل کوچک و قابل تکرار','افزودن idempotency، timeout و retry محدود','ثبت نتیجه و هشدار شکست','آزمون مسیر موفق، شکست و بازیابی']
  },
  {
    id: 'customer-support', name: 'Customer Support Engine', weight: 55,
    keywords: ['support','customer service','faq','ticket','پشتیبانی','سوال مشتری','تیکت','راهنمای مشتری'],
    title: 'پشتیبانی و راهنمای مشتری',
    desc: 'پاسخ بر اساس اطلاعات تأییدشده ارائه می‌شود و مسائل نیازمند دسترسی داخلی به مالک ارجاع می‌شوند.',
    moves: ['تشخیص مسئله و فوریت','بررسی اطلاعات معتبر موجود','ارائه راه‌حل مرحله‌ای و قابل پیگیری','ارجاع درخواست حساس یا نامشخص','ثبت وضعیت و اقدام بعدی']
  },
  {
    id: 'learning-explanation', name: 'Learning & Explanation Engine', weight: 50,
    keywords: ['learn','study','education','explain','tutorial','یادگیری','آموزش','توضیح','آموزش گام به گام'],
    title: 'آموزش و توضیح مرحله‌ای',
    desc: 'موضوع به پیش‌نیازها، مثال‌ها، تمرین و بررسی فهم تقسیم می‌شود.',
    moves: ['تعیین سطح و هدف یادگیری','شرح مفهوم از ساده به پیشرفته','ارائه مثال عملی','تمرین کوتاه برای سنجش فهم','اصلاح توضیح بر اساس خطاهای رایج']
  },
  {
    id: 'content-strategy', name: 'Content & Product Strategy Engine', weight: 45,
    keywords: ['content','marketing','brand','product','strategy','محتوا','بازاریابی','برند','محصول','راهبرد'],
    title: 'راهبرد محصول و محتوا',
    desc: 'پیشنهادها بر اساس مخاطب، ارزش پیشنهادی، هزینه اجرا و معیار سنجش اولویت‌بندی می‌شوند.',
    moves: ['تعریف مخاطب و نیاز اصلی','تعیین ارزش پیشنهادی روشن','مقایسه گزینه‌ها با هزینه و اثر','تعریف معیار موفقیت قابل اندازه‌گیری','ساخت برنامه آزمایش و بازبینی']
  }
];

const DEFAULT_ENGINE = {
  id: 'general-reasoning', name: 'ANIL Core Reasoning Engine',
  title: 'تحلیل و حل مسئله',
  desc: 'درخواست به مسئله‌های کوچک‌تر، فرض‌های آشکار و گام‌های قابل بررسی تبدیل می‌شود.',
  moves: ['تعریف نتیجه مطلوب و معیار موفقیت','تفکیک واقعیت از فرضیه و مجهول','اولویت‌بندی اقدام‌های کم‌خطر','بررسی نتیجه و اصلاح مسیر','گزارش دقیق وضعیت و گام بعدی']
};

const IRREVERSIBLE = /\b(delete|transfer|withdraw|sign|claim|purchase|charge|send to all|production deploy)\b|حذف دائمی|انتقال وجه|برداشت|امضای تراکنش|مطالبه خودکار|ارسال انبوه|انتشار نهایی/i;

export function runLocalEngineChain(request) {
  const original = clean(request);
  const normalized = original.toLowerCase();
  const scored = ENGINES.map(engine => ({
    engine,
    score: engine.weight * engine.keywords.filter(word => normalized.includes(word)).length
  })).filter(item => item.score > 0).sort((a,b) => b.score - a.score);
  const selected = scored[0]?.engine || DEFAULT_ENGINE;
  const matched = scored.map(item => item.engine);
  const operational = /\b(fix|deploy|execute|change|commit|payment|wallet|guard|revenue|order|customer|website|code|test|audit|build|create|automation)\b|رفع|اجرا|تغییر|کامیت|پرداخت|کیف پول|گارد|درآمد|سفارش|مشتری|سایت|کد|آزمون|بررسی عملی|بساز|ایجاد|خودکار/i.test(normalized);
  const requiresOwnerApproval = IRREVERSIBLE.test(normalized) || matched.some(x => ['payment-integrity','guard-security','security-governance'].includes(x.id));
  const specialists = matched.length ? matched.slice(0,4) : [DEFAULT_ENGINE];
  const chain = [
    {id:'sense',name:'Sense Engine',status:'completed'},
    {id:'intent-router',name:'Intent & Priority Router',status:'completed'},
    ...specialists.map(engine => ({id:engine.id,name:engine.name,status:'selected'})),
    {id:'planner',name:'Task Decomposition Engine',status:'planned'},
    {id:'policy-gate',name:'Security & Owner Approval Gate',status:'checked'},
    {id:'tool-router',name:'Read-only Tool Router',status:'available_when_configured'},
    {id:'execution',name:'Execution Adapter',status:'not_run'},
    {id:'independent-qa',name:'Independent QA Engine',status:'pending_execution'},
    {id:'evidence-verifier',name:'Evidence & Claim Verifier',status:'pending_evidence'},
    {id:'recovery',name:'Repair & Recovery Engine',status:'standby'},
    {id:'release-gate',name:'Release Gate',status:'blocked_until_evidence'}
  ];
  const plan = {
    title: selected.title,
    desc: selected.desc,
    moves: selected.moves.slice(0,6),
    engines: specialists.map(engine => ({id:engine.id,name:engine.name})),
    executionStatus: 'plan_only',
    requiresOwnerApproval,
    evidenceRequired: true
  };
  const languageFa = /[\u0600-\u06FF]/.test(original);
  const next = selected.moves.slice(0,3).join(languageFa ? '؛ ' : '; ');
  const reply = languageFa
    ? 'زنجیره تخصصی مستقل ANIL درخواست را دسته‌بندی کرد و ' + specialists.map(x=>x.name).join('، ') + ' را برای بررسی انتخاب کرد. این مرحله برنامه‌ریزی است، نه اثبات اجرای بیرونی. گام‌های بعدی: ' + next + (requiresOwnerApproval ? '؛ اقدام حساس تا تأیید مالک متوقف می‌ماند.' : '؛ نتیجه فقط با آزمون و شواهد تأیید می‌شود.')
    : 'ANIL independent specialist chain routed this request to ' + specialists.map(x=>x.name).join(', ') + '. This is planning, not proof of external execution. Next: ' + next + (requiresOwnerApproval ? '; sensitive actions remain blocked pending owner approval.' : '; results require tests and evidence.');
  return {
    engine:'ANIL-INDEPENDENT-ENGINE-COUNCIL',
    version:'2.0.0',
    mode:operational?'operational-plan':'reasoning-plan',
    plan, reply, selectedEngine:selected.name,
    confidence:scored.length ? Math.min(0.88,0.55 + scored[0].score/500) : 0.5,
    requiresOwnerApproval,
    execution:{performed:false,status:'not_executed',reason:'planning does not fabricate external tool execution'},
    chain,
    specialists:specialists.map(engine=>({id:engine.id,name:engine.name,selected:true})),
    orchestration:{
      required:true,mode:operational?'EXECUTABLE_OPERATION':'CONVERSATIONAL',
      stages:['SENSE','UNDERSTAND','SCORE','PLAN','DELEGATE','POLICY_GATE','EXECUTE','VERIFY','REPAIR','TEST','RELEASE','OBSERVE','LEARN'],
      providerIndependent:true,externalProviderRequired:false,executionEvidenceRequired:true
    }
  };
}
