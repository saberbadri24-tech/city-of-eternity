import { chromium } from "playwright";

const base = process.env.ANIL_BASE_URL || "https://city-of-eternity.onrender.com";
const blocked = /pay|payment|wallet|connect|ton|claim|transfer|admin|login|checkout|buy|خرید|پرداخت|کیف|برداشت|ادمین|ورود/i;

const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:390,height:844}});
const failures = [];
page.on("console", m => { if (m.type() === "error") failures.push({type:"console", text:m.text()}); });
page.on("pageerror", e => failures.push({type:"pageerror", text:String(e?.message||e)}));

const response = await page.goto(base,{waitUntil:"domcontentloaded",timeout:30000});
if (!response || !response.ok()) throw new Error(`homepage_http_${response?.status()||"no_response"}`);
await page.waitForLoadState("networkidle",{timeout:15000}).catch(()=>{});

const title = await page.title();
const buttons = await page.locator("button").evaluateAll(btns => btns.map((b,i)=>({
  i,text:(b.innerText||b.getAttribute("aria-label")||"").trim().replace(/\\s+/g," ").slice(0,120),
  disabled:b.disabled
})).filter(x=>x.text));

const safe = buttons.filter(b=>!blocked.test(b.text) && !b.disabled).slice(0,20);
const tested=[];
for(const b of safe){
  const beforeUrl=page.url();
  const beforeText=(await page.locator("body").innerText()).slice(0,3000);
  try{
    await page.locator("button").nth(b.i).click({timeout:3000});
    await page.waitForTimeout(400);
    const afterUrl=page.url();
    const afterText=(await page.locator("body").innerText()).slice(0,3000);
    tested.push({text:b.text,urlChanged:afterUrl!==beforeUrl,stateChanged:afterText!==beforeText,afterUrl});
    if(afterUrl!==base) await page.goto(base,{waitUntil:"domcontentloaded",timeout:15000}).catch(()=>{});
  }catch(e){ tested.push({text:b.text,error:String(e?.message||e)}); }
}

const links = await page.locator("a[href]").evaluateAll(as=>as.map(a=>({text:(a.innerText||"").trim().slice(0,100),href:a.href})).filter(x=>x.text).slice(0,30));
console.log(JSON.stringify({ok:failures.length===0,title,base,buttonCount:buttons.length,safeTested:safe.length,tested,links,errors:failures},null,2));
await browser.close();
if(failures.length) process.exitCode=1;
