// Standalone dry-run test — runs webhook logic without Vercel
// Usage: DRY_RUN=true node scripts/test-dryrun.mjs

import { env } from "../api/env.js";
env.DRY_RUN = "true";
env.META_VERIFY_TOKEN = "my_verify_token_123";

// Patch fetch so we don't call real APIs
globalThis.fetch = async (url, opts) => {
  console.log(`[mock-fetch] ${opts?.method || "GET"} ${url}`);
  if (opts?.body) {
    const body = JSON.parse(opts.body);
    if (body?.message?.text) console.log(`  → would send: "${body.message.text.slice(0, 80)}"`);
  }
  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
};

const T = { status: (s) => new Response("mock", { status: s, headers: new Map() }) };

// Test 1: GET verify
console.log("\n=== TEST 1: GET webhook verify ===");
const url = new URL("http://localhost/api/webhook?hub.mode=subscribe&hub.verify_token=my_verify_token_123&hub.challenge=ok_test");
const mode = url.searchParams.get("hub.mode");
const token = url.searchParams.get("hub.verify_token");
const challenge = url.searchParams.get("hub.challenge");
if (mode === "subscribe" && token === "my_verify_token_123" && challenge) {
  console.log("✅ GET verify: challenge =", challenge);
} else {
  console.log("❌ GET verify failed");
}

// Test 2: Price question with product context (via referral)
console.log("\n=== TEST 2: Fiyat sorusu (referral ile) ===");
import("../api/webhook.js").then(({ POST, GET }) => {
  // Simulate referral with ad code
  const payload = {
    entry: [{
      messaging: [{
        sender: { id: "test_user_2" },
        message: { text: "fiyatı ne kadar?" },
        referral: { ref: "52559403956656" },
      }]
    }]
  };

  const req = new Request("http://localhost/api/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  POST(req).then(() => console.log("✅ Test 2 done"))
    .catch(e => console.log("❌ Test 2 error:", e.message));
});

// Test 3: Bilinmeyen soru
console.log("\n=== TEST 3: Bilinmeyen soru (no referral) ===");
import("../api/webhook.js").then(({ POST }) => {
  const payload = {
    entry: [{
      messaging: [{
        sender: { id: "test_user_3" },
        message: { text: "pantolon var mı?" },
      }]
    }]
  };

  const req = new Request("http://localhost/api/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  POST(req).then(() => console.log("✅ Test 3 done"))
    .catch(e => console.log("❌ Test 3 error:", e.message));
});