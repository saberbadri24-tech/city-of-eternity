const clean = value => String(value ?? '').trim();
const normalize = value => clean(value).toLowerCase().normalize('NFKC')
  .replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\u200d]/g,' ')
  .replace(/\s+/g,' ').trim();
const has = (text, words) => words.some(word => text.includes(normalize(word)));

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
    keywords: ['website','site','ui','admin','dashboard','page','button','anil','anil x','بهبود','ارتقا','ارتقاء','بهینه‌سازی','بهینه سازی','عملکرد','کارکرد','پنل مدیریت','دستیار مدیر','چت مدیر','آنیل','انیل','سایت','وب‌سایت','پنل','داشبورد','صفحه','دکمه'],
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

const EN_COPY = {
  'security-governance': {title:'Security, access control and policy',desc:'Check permissions, side effects, and rollback before acting.',moves:['Classify data and required access','Identify side effects and abuse paths','Apply least privilege and fail-closed controls','Record evidence and decision rationale','Pause sensitive actions for owner approval']},
  'payment-integrity': {title:'Payment and wallet integrity',desc:'Reconcile orders, amounts, webhooks, durable storage, and settlement receipts.',moves:['Inspect configuration without exposing secrets','Test order and checkout creation','Verify webhook signatures and exact amounts','Enforce idempotency and durable records','Count revenue only after verified settlement']},
  'guard-security': {title:'Guard opportunity and safety',desc:'Verify opportunities from official sources; discovery is not proof of profit or permission to transact.',moves:['Check official source and publication time','Remove duplicates, expired, and suspicious items','Score evidence and contract risk','Queue items for owner review','Stop before signing, claiming, or transferring funds']},
  'code-quality': {title:'Root-cause diagnosis and code repair',desc:'Keep changes small, reversible, tested, and supported by live evidence.',moves:['Inspect version and related changes','Create a minimal reproduction','Apply the smallest compatible fix','Run syntax and critical-path regression tests','Verify deployment and rollback readiness']},
  'revenue-operations': {title:'Revenue, sales and growth operations',desc:'Track leads, offers, orders, payments, and settled revenue separately.',moves:['Score leads by fit and purchase intent','Match service offers and prices','Prepare follow-up without bulk auto-messaging','Reconcile orders with real payment state','Measure conversion and settled revenue']},
  'research-verification': {title:'Research and evidence verification',desc:'Separate verified facts, assumptions, missing data, and conflicting sources.',moves:['Define testable questions','Separate facts from assumptions and unknowns','Check source quality and freshness','Compare conflicting evidence','Report findings and uncertainty']},
  'website-operations': {title:'Website UX and operations',desc:'Test user flows, buttons, APIs, language, mobile behavior, and errors.',moves:['Define the user path and expected outcome','Test Persian and English separately','Verify buttons, APIs, login, and storage','Inspect mobile layout and browser errors','Confirm only with reproducible tests']},
  'writing-communication': {title:'Writing and professional communication',desc:'Shape the message around its audience, goal, tone, and desired action.',moves:['Identify audience and objective','Choose the right structure and tone','Draft usable copy','Review clarity, accuracy, and brevity','Adapt the final version to constraints']},
  'data-analysis': {title:'Data analysis and calculation',desc:'Make assumptions, units, data quality, and calculations auditable.',moves:['Identify inputs, units, and missing data','Validate ranges and consistency','Choose an appropriate method','Independently check results and edge cases','Present results with assumptions']},
  'workflow-automation': {title:'Workflow and automation',desc:'Use explicit triggers, idempotency, bounded retries, audit logs, and recovery paths.',moves:['Define trigger and success criteria','Split work into repeatable stages','Add timeouts, bounded retries, and idempotency','Record outcomes and failure alerts','Test success, failure, and recovery']},
  'customer-support': {title:'Customer support',desc:'Answer from verified information and route private or sensitive issues to the owner.',moves:['Identify issue and urgency','Check available verified information','Give a trackable step-by-step solution','Escalate sensitive or unclear requests','Record status and next action']},
  'learning-explanation': {title:'Learning and explanation',desc:'Break a topic into prerequisites, examples, practice, and understanding checks.',moves:['Set learning level and goal','Explain from simple to advanced','Give a practical example','Check understanding with a short exercise','Correct common misunderstandings']},
  'content-strategy': {title:'Product and content strategy',desc:'Prioritize ideas by audience value, execution cost, and measurable outcomes.',moves:['Define audience and core need','Clarify the value proposition','Compare options by cost and impact','Set measurable success criteria','Run a small experiment and review']},
  'general-reasoning': {title:'Problem solving',desc:'Break the request into explicit assumptions, low-risk steps, and verifiable outcomes.',moves:['Define the desired outcome and success measure','Separate facts from assumptions and unknowns','Prioritize low-risk actions','Review results and adapt','Report only verified completion']}
};

const IRREVERSIBLE = /\b(delete|transfer|withdraw|sign|claim|purchase|charge|send to all|production deploy)\b|حذف دائمی|انتقال(?:\s+وجه)?|برداشت|امضا(?:ی)?(?:\s+تراکنش)?|مطالبه(?:\s+خودکار)?|پرداخت واقعی|تسویه واقعی|ارسال وجه|ارسال انبوه|انتشار نهایی/i;

export function runLocalEngineChain(request) {
  const original = clean(request);
  const normalized = normalize(original);
  const scored = ENGINES.map(engine => ({
    engine,
    score: engine.weight * engine.keywords.filter(word => normalized.includes(normalize(word))).length
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
  const languageFa = /[\u0600-\u06FF]/.test(original);
  const copy = languageFa ? {title:selected.title,desc:selected.desc,moves:selected.moves} : (EN_COPY[selected.id] || EN_COPY['general-reasoning']);
  const plan = {
    title: copy.title,
    desc: copy.desc,
    moves: copy.moves.slice(0,6),
    engines: specialists.map(engine => ({id:engine.id,name:engine.name})),
    executionStatus: 'plan_only',
    requiresOwnerApproval,
    evidenceRequired: true
  };
  const next = copy.moves.slice(0,4).join(languageFa ? ' ← ' : ' → ');
  const selectedNames = specialists.map(x => x.name).join(languageFa ? '، ' : ', ');
  const reply = languageFa
    ? 'گرفتم. برای این درخواست، ' + selectedNames + ' را وارد مسیر بررسی کردم. اولویت کار این است: ' + next + '؛ نتیجه را فقط بعد از آزمون و مدرک قابل بررسی تأیید می‌کنم.' + (requiresOwnerApproval ? ' اقدام حساس تا تأیید مالک متوقف می‌ماند.' : ' هنوز تغییری بیرونی اجرا نشده است.')
    : 'Got it. I routed this request through ' + selectedNames + '. The practical sequence is: ' + next + '. I will only mark the result complete after tests and reviewable evidence.' + (requiresOwnerApproval ? ' Sensitive actions remain blocked until owner approval.' : ' No external change has been executed yet.');
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
