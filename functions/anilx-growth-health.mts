import { getStore } from "@netlify/blobs";

const store = getStore({ name: "anilx-growth", consistency: "strong" });

const now = new Date().toISOString();
const existing = await store.get("heartbeat/latest.json", { type: "json" });

const report = {
  checkedAt: now,
  heartbeatPresent: Boolean(existing),
  heartbeatAt: existing?.heartbeatAt ?? null,
  status: existing?.status ?? "unknown",
  version: existing?.version ?? null,
  safeAutonomy: existing?.safeAutonomy ?? null,
  action: "observe-only"
};

await store.setJSON("health/latest.json", report);

export default async () =>
  new Response(JSON.stringify(report), {
    headers: { "content-type": "application/json; charset=utf-8" }
  });

export const config = {
  schedule: "0 * * * *"
};
