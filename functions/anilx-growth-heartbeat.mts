import { getStore } from "@netlify/blobs";

const store = getStore({ name: "anilx-growth", consistency: "strong" });

const now = new Date().toISOString();

const payload = {
  heartbeatAt: now,
  status: "alive",
  version: "growth-loop-v1",
  nextResearch: "daily",
  nextHealthCheck: "5-minute",
  safeAutonomy: {
    research: true,
    propose: true,
    sandbox: true,
    test: true,
    productionMutation: false,
    payments: false,
    secrets: false
  }
};

await store.setJSON("heartbeat/latest.json", payload);
await store.setJSON(`heartbeats/${now}.json`, payload);

console.log("ANIL X growth heartbeat:", payload);

export default async () =>
  new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json; charset=utf-8" }
  });

export const config = {
  schedule: "*/5 * * * *"
};
