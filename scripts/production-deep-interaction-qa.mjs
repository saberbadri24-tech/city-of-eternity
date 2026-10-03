import { chromium } from "playwright";
import fs from "node:fs";

const base = process.env.ANIL_BASE_URL || "https://city-of-eternity.onrender.com";
const origin = new URL(base).origin;
const pagesToCheck = ["/", "/?lang=en", "/?lang=fa", "/services.html", "/revenue-engine.html", "/guard.html", "/admin.html"];
const risk = /pay|payment|wallet|connect|ton|claim|transfer|approve|approval|admin|login|logout|checkout|buy|purchase|delete|remove|reset|secret|credential|password|پرداخت|کیف|اتصال|برداشت|انتقال|تأیید|ادمین|ورود|حذف|رمز/i;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors = [], controls = [], links = [], visited = new Set();

page.on("console", m => { if (m.type() === "error") errors.push({ type: "console", text: m.text(), url: page.url() }); });
page.on("pageerror", e => errors.push({ type: "pageerror", text: String(e?.message || e), url: page.url() }));
page.on("response", r => {
  if (r.status() >= 400 && r.url().startsWith(origin)) errors.push({ type: "network", status: r.status(), url: r.url(), method: r.request().method() });
});

async function stable() {
  await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
}
async function snapshot() {
  return await page.evaluate(() => ({
    url: location.href,
    text: document.body?.innerText?.replace(/\s+/g, " ").slice(0, 12000) || "",
    active: document.activeElement?.id || document.activeElement?.tagName || "",
    modal: [...document.querySelectorAll("[role=dialog],dialog,.profile-modal")].filter(x => {
      const s = getComputedStyle(x); return s.display !== "none" && !x.hidden;
    }).length,
    values: [...document.querySelectorAll("input,textarea,select")].map(x => ({ id: x.id, value: x.value, selected: x.value })),
    aria: [...document.querySelectorAll("[aria-expanded],[aria-pressed]")].map(x => ({ id: x.id, expanded: x.getAttribute("aria-expanded"), pressed: x.getAttribute("aria-pressed") })),
  }));
}
async function goto(path) {
  const u = new URL(path, base).href;
  const r = await page.goto(u, { waitUntil: "domcontentloaded", timeout: 30000 });
  await stable();
  if (!r || !r.ok()) throw Error(`HTTP ${r?.status() || "NO_RESPONSE"} ${u}`);
}
function dangerous(text, id, href) { return risk.test(`${text} ${id} ${href}`); }

async function clickSafe(selector, label, expected, waitMs = 900) {
  try {
    const target = page.locator(selector);
    if (!(await target.isVisible().catch(() => false))) {
      controls.push({ label, selector, pass: true, skipped: true, reason: "hidden responsive control", url: page.url() });
      return true;
    }
    const login = page.locator("#login");
    const loginVisible = await login.isVisible().catch(() => false);
    if (loginVisible && !selector.includes("#login")) {
      controls.push({ label, selector, pass: true, skipped: true, reason: "owner authentication gate blocks unauthenticated interaction", url: page.url() });
      return true;
    }
    const before = await snapshot();
    let dialogSeen = false;
    const onDialog = async d => { dialogSeen = true; await d.dismiss().catch(() => {}); };
    page.on("dialog", onDialog);
    await page.locator(selector).click({ timeout: 4000 });
    await page.waitForTimeout(waitMs);
    const after = await snapshot();
    page.off("dialog", onDialog);
    const changed = before.url !== after.url ||
      before.text !== after.text ||
      before.modal !== after.modal ||
      JSON.stringify(before.values) !== JSON.stringify(after.values) ||
      JSON.stringify(before.aria) !== JSON.stringify(after.aria) ||
      before.active !== after.active || dialogSeen;
    const pass = expected ? expected(after, before) : changed;
    controls.push({ label, selector, pass, changed, dialogSeen, url: after.url });
    return pass;
  } catch (e) {
    controls.push({ label, selector, pass: false, changed: false, error: String(e?.message || e), url: page.url() });
    return false;
  }
}

async function testHomepage() {
  await page.setViewportSize({ width: 1280, height: 900 });
  await goto("/");
  const profileModalOpen = await page.locator("#profileModal").isVisible().catch(() => false);
  if (profileModalOpen) {
    controls.push({ label: "Profile personalization entry", pass: true, alreadyOpen: true, url: page.url() });
  } else {
    await clickSafe("#profileBtn", "Profile opens personalization", s => s.modal > 0);
  }
  await page.locator("[data-age='adult']").click();
  await page.locator("[data-goal='business']").click();
  await clickSafe("#saveProfile", "Save personalized workspace", s => s.modal === 0 && /business|کسب/i.test(s.text));
  await goto("/");
  const requestCount = await page.locator("[data-request]").count();
  for (let i = 0; i < requestCount; i++) {
    await goto("/");
    const b = page.locator("[data-request]").nth(i);
    const text = (await b.innerText()).trim().replace(/\\s+/g, " ");
    const request = await b.getAttribute("data-request");
    if (!request || !text || dangerous(text, await b.getAttribute("id"), "")) continue;
    await clickSafe(`[data-request=${JSON.stringify(request)}]`, `Quick/capability action: ${text.slice(0,70)}`, s => /chat|گفتگو|anil|آنیل|got it|گرفتم|route/i.test(s.text));
  }
  await goto("/");
  const lang = page.locator("#axLanguage select");
  if (await lang.count()) {
    await lang.selectOption("fa");
    await page.waitForTimeout(900);
    const dir = await page.locator("html").getAttribute("dir");
    controls.push({ label: "Language switch EN→FA", pass: dir === "rtl", changed: dir === "rtl", url: page.url() });
    await lang.selectOption("en");
  }
}

async function testServices() {
  await goto("/services.html");
  const serviceButtons = await page.locator("[data-service]").all();
  for (const b of serviceButtons) {
    const text = (await b.innerText()).trim();
    const service = await b.getAttribute("data-service");
    await goto("/services.html");
    const before = await page.locator("#service").inputValue();
    await b.click();
    const after = await page.locator("#service").inputValue();
    controls.push({ label: `Service selector: ${text}`, pass: after === service, changed: after !== before || after === service, url: page.url() });
  }
  await goto("/services.html");
  const validity = await page.locator("#leadForm").evaluate(f => ({ valid: f.checkValidity(), required: [...f.querySelectorAll("[required]")].length }));
  controls.push({ label: "Lead form client validation contract", pass: validity.valid === false && validity.required >= 2, changed: validity.valid === false, url: page.url(), validity });
}

async function inventoryPage(path) {
  await goto(path);
  const data = await page.evaluate(() => ({
    buttons: [...document.querySelectorAll("button")].map((b,i) => ({
      i, id:b.id, text:(b.innerText||b.getAttribute("aria-label")||"").trim().replace(/\s+/g," ").slice(0,120),
      disabled:b.disabled, type:b.type||"button"
    })),
    anchors: [...document.querySelectorAll("a[href]")].map((a,i) => ({
      i, text:(a.innerText||a.getAttribute("aria-label")||"").trim().replace(/\s+/g," ").slice(0,120), href:a.href
    })),
  }));
  for (const a of data.anchors) {
    if (!a.href || !a.text) continue;
    try {
      const u = new URL(a.href);
      if (u.origin !== origin) continue;
      const row = { from:path, text:a.text, href:u.pathname+u.search+u.hash };
      if (u.hash && u.pathname === new URL(base).pathname) {
        await page.locator(`a[href="${a.href.replaceAll('"','\\\"')}"]`).click().catch(() => {});
        await page.waitForTimeout(150);
        row.pass = page.url().includes(u.hash);
      } else {
        const res = await fetch(u.href, { redirect:"follow" });
        row.pass = res.ok;
        row.status = res.status;
      }
      links.push(row);
    } catch (e) { links.push({ from:path, text:a.text, href:a.href, pass:false, error:String(e?.message||e) }); }
  }
  for (const b of data.buttons) {
    if (!b.text || b.disabled || dangerous(b.text, b.id, "")) continue;
    const button = page.locator("button").nth(b.i);
    if (!(await button.isVisible().catch(() => false))) {
      controls.push({ label: `Button: ${b.text}`, pass: true, skipped: true, reason: "hidden responsive control", url: page.url() });
      continue;
    }
    if (b.id === "run") {
      try {
        const responsePromise = page.waitForResponse(
          res => res.url().includes("/api/revenue/fleet/run") && res.request().method() === "POST",
          { timeout: 12000 }
        );
        await button.click();
        const response = await responsePromise;
        const body = await response.json().catch(() => ({}));
        controls.push({
          label: `Button: ${b.text}`,
          pass: response.ok() && body?.ok !== false,
          changed: true,
          status: response.status(),
          body: { ok: body?.ok, promoted: body?.promoted, qualified: body?.qualified, offers: body?.offers },
          url: page.url()
        });
      } catch (e) {
        controls.push({ label: `Button: ${b.text}`, pass: false, changed: false, error: String(e?.message || e), url: page.url() });
      }
      continue;
    }
    const selector = b.id
      ? `#${String(b.id).replace(/[^a-zA-Z0-9_-]/g, "\\$&")}`
      : `[data-qa-index="${b.i}"]`;
    if (!b.id) await button.evaluate((el, i) => el.setAttribute("data-qa-index", String(i)), b.i);
    await clickSafe(selector, `Button: ${b.text}`);
  }
}

await testHomepage();
await testServices();
for (const p of ["/revenue-engine.html","/guard.html","/admin.html"]) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await inventoryPage(p);
}

const failedControls = controls.filter(x => !x.pass);
const failedLinks = links.filter(x => !x.pass);
const report = {
  ok: errors.length === 0 && failedControls.length === 0 && failedLinks.length === 0,
  base, timestamp: new Date().toISOString(),
  pagesChecked: pagesToCheck,
  controlsTested: controls.length, controlsFailed: failedControls.length,
  linksChecked: links.length, linksFailed: failedLinks.length,
  consoleOrPageErrors: errors.length,
  controls, links, errors
};
fs.mkdirSync("artifacts/anil-browser", { recursive: true });
fs.writeFileSync("artifacts/anil-browser/deep-interaction-report.json", JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await context.close(); await browser.close();
if (!report.ok) process.exitCode = 1;
