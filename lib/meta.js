// Meta Graph API — message send + webhook signature verification
import crypto from "crypto";
import { env } from "../api/env.js";

const GRAPH_BASE = "https://graph.facebook.com/v22.0";

export function verifySignature(body, signature) {
  if (!env.META_APP_SECRET) return true; // skip in dev
  const expected = crypto
    .createHmac("sha256", env.META_APP_SECRET)
    .update(typeof body === "string" ? body : JSON.stringify(body))
    .digest("hex");
  const received = signature?.replace("sha256=", "");
  if (!received || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received))) {
    console.warn("[meta] webhook signature mismatch");
    return false;
  }
  return true;
}

export async function sendMessage(recipientId, text) {
  if (env.DRY_RUN === "true") {
    console.log(`[dry-run] To ${recipientId}: "${text}"`);
    return { dryRun: true };
  }
  if (!env.META_PAGE_ACCESS_TOKEN) {
    console.warn("[meta] META_PAGE_ACCESS_TOKEN not set, skipping send");
    return null;
  }

  const url = `${GRAPH_BASE}/me/messages?access_token=${env.META_PAGE_ACCESS_TOKEN}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      messaging_type: "RESPONSE",
      message: { text },
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    console.error(`[meta] send error (${resp.status}):`, err);
    return null;
  }
  return resp.json();
}