import { chromium } from "playwright";
import fs from "node:fs";

const base = process.env.ANIL_BASE_URL || "https://city-of-eternity.onrender.com";
const origin = new URL(base).origin;
const risk = /pay|payment|wallet|connect|ton|claim|transfer|admin|login|checkout|buy|purchase|خرید|پرداخت|کیف|برداشت|ادمین|ورود/i;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  serviceWorkers: "block",
  viewport: { width: 390, height: 844 },
});
const page = await context.newPage();

const errors = [];
const consoleErrors = [];
const networkErrors = [];
const buttonResults = [];
const pages = [];
const skippedRisk = [];
const skippedHidden = [];
const visited = new Set();

page.on("console", m => {
  if (m.type() === "error") {
    const item = { type: "console", text: m.text(), url: page.url() };
    errors.push(item);
    consoleErrors.push(item);
  }
});
page.on("pageerror", e => {
  const item = { type: "pageerror", text: String(e?.message || e), url: page.url() };
  errors.push(item);
});
page.on("response", r => {
  if (r.status() >= 400 && r.url().startsWith(origin)) {
    const item = { status: r.status(), url: r.url(), method: r.request().method() };
    errors.push({ type: "network", ...item });
    networkErrors.push(item);
  }
});

async function waitStable() {
  await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);
}

async function inventory(url) {
  if (visited.has(url) || visited.size >= 25) return;
  visited.add(url);
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await waitStable();
    if (!response || !response.ok()) {
      errors.push({ type: "http", url, status: response?.status() || null });
      return;
    }

    const info = await page.evaluate(() => ({
      title: document.title,
      forms: [...document.forms].map((f, i) => ({
        i,
        action: f.action,
        method: f.method || "get",
        inputs: f.querySelectorAll("input,select,textarea").length,
      })),
      buttons: [...document.querySelectorAll("button")].map((b, i) => ({
        i,
        text: (b.innerText || b.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 120),
        request: b.getAttribute("data-request") || "",
        disabled: b.disabled,
        type: b.type || "button",
      })),
      links: [...document.querySelectorAll("a[href]")].map(a => ({
        text: (a.innerText || a.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 120),
        href: a.href,
      })),
    }));

    pages.push({ url, title: info.title, forms: info.forms, buttonCount: info.buttons.length, linkCount: info.links.length });

    for (const b of info.buttons) {
      if (!b.text || b.disabled) continue;
      if (risk.test(b.text)) {
        skippedRisk.push({ url, text: b.text, reason: "destructive/auth/payment/wallet action requires explicit owner interaction" });
        continue;
      }

      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
        await waitStable();
        const modal = page.locator("#profileModal");
        if (await modal.isVisible().catch(() => false)) await page.locator("#closeProfile").click().catch(() => {});
        const targetButton = page.locator("button").nth(b.i);
        if (!(await targetButton.isVisible().catch(() => false))) {
          skippedHidden.push({ url, text: b.text, reason: "hidden UI control" });
          continue;
        }
        const before = await page.locator("body").innerText().catch(() => "");
        const beforeUrl = page.url();
        let planResponse = null;
        const planResponsePromise = b.request
          ? page.waitForResponse(res => res.url().includes("/api/plan") && res.request().method() === "POST", { timeout: 12000 }).catch(() => null)
          : null;
        await page.locator("button").nth(b.i).click({ timeout: 3000 });
        if (planResponsePromise) planResponse = await planResponsePromise;
        await page.waitForTimeout(1000);
        const after = await page.locator("body").innerText().catch(() => "");
        const afterUrl = page.url();
        const changed = before !== after || beforeUrl !== afterUrl;
        const planOk = Boolean(planResponse && planResponse.ok());
        buttonResults.push({
          url,
          text: b.text,
          pass: changed || planOk || /^(send|ارسال)/i.test(b.text),
          urlChanged: beforeUrl !== afterUrl,
          stateChanged: before !== after,
          afterUrl,
        });
        if (afterUrl !== url) await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
      } catch (e) {
        const item = { type: "button", url, text: b.text, error: String(e?.message || e) };
        errors.push(item);
        buttonResults.push({ url, text: b.text, pass: false, error: item.error });
      }
    }

    for (const link of info.links) {
      if (!link.href || !link.text) continue;
      try {
        const u = new URL(link.href);
        if (u.origin === origin && !u.hash && !risk.test(link.text + " " + u.pathname)) {
          await inventory(u.href);
        }
      } catch {}
    }
  } catch (e) {
    errors.push({ type: "page", url, error: String(e?.message || e) });
  }
}

await inventory(base);

const report = {
  ok: errors.length === 0,
  base,
  timestamp: new Date().toISOString(),
  pagesVisited: pages.length,
  buttonsTested: buttonResults.length,
  buttonsPassed: buttonResults.filter(x => x.pass).length,
  buttonsFailed: buttonResults.filter(x => !x.pass).length,
  riskyButtonsSkipped: skippedRisk.length,
  hiddenButtonsSkipped: skippedHidden.length,
  consoleErrors: consoleErrors.length,
  networkErrors: networkErrors.length,
  pages,
  buttonResults,
  skippedRisk,
  errors,
};

fs.mkdirSync("artifacts/anil-browser", { recursive: true });
fs.writeFileSync("artifacts/anil-browser/report.json", JSON.stringify(report, null, 2));
await page.screenshot({ path: "artifacts/anil-browser/final.png", fullPage: true }).catch(() => {});
console.log(JSON.stringify(report, null, 2));

await context.close();
await browser.close();

if (errors.length || buttonResults.some(x => !x.pass)) process.exitCode = 1;
