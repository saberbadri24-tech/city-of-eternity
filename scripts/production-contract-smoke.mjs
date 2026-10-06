import assert from "node:assert/strict";

const base = new URL(process.env.ANIL_BASE_URL || "https://anil-x-live.onrender.com");
const paths = [
  "/",
  "/en.html",
  "/fa.html",
  "/services.html",
  "/revenue-engine.html",
  "/guard.html",
  "/api/health",
  "/api/revenue/fleet",
  "/api/revenue/customer-ready",
];

const results = [];
for (const path of paths) {
  const url = new URL(path, base);
  const res = await fetch(url, { redirect: "follow" });
  const text = await res.text();
  const type = res.headers.get("content-type") || "";
  const row = { path, status: res.status, type, bytes: text.length, finalUrl: res.url };
  results.push(row);
  assert.ok(res.ok, `${path} returned HTTP ${res.status}`);
  assert.ok(text.length > 0, `${path} returned an empty body`);
  if (path.startsWith("/api/")) {
    assert.match(type, /json/i, `${path} is not JSON`);
    const data = JSON.parse(text);
    assert.equal(data.ok, true, `${path} did not report ok=true`);
  } else {
    assert.match(type, /html/i, `${path} is not HTML`);
  }
}

const planRes = await fetch(new URL("/api/plan", base), {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ request: "Smoke-test ANIL X with a harmless status request", language: "en", ageProfile: "adult" })
});
const planText = await planRes.text();
assert.ok(planRes.ok, "/api/plan returned HTTP " + planRes.status + ": " + planText.slice(0,300));
assert.match(planRes.headers.get("content-type") || "", /json/i, "/api/plan is not JSON");
const planData = JSON.parse(planText);
assert.equal(planData.ok, true, "/api/plan did not report ok=true: " + planText.slice(0,300));

console.log(JSON.stringify({ ok: true, base: base.origin, checked: results.length + 1, results, plan: { status: planRes.status, source: planData.source, orchestrator: planData.orchestrator } }, null, 2));
