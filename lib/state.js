// Upstash Redis REST client — conversation state per user
import { env } from "../api/env.js";

// Vercel'de Upstash Redis "KV_*" adlarıyla bağlanır; doğrudan Upstash'te "UPSTASH_*"
const BASE = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
const TOKEN = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;

export async function redisCommand(command, ...args) {
  if (!BASE || !TOKEN) {
    console.warn("[state] Redis not configured, using in-memory fallback");
    return null;
  }
  const resp = await fetch(`${BASE}/${command}/${args.map(encodeURIComponent).join("/")}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!resp.ok) throw new Error(`Redis ${command} failed: ${resp.status}`);
  return resp.json();
}

export async function getUserState(psid) {
  const key = `mondi:${psid}`;
  const val = await redisCommand("GET", key);
  // Upstash REST boş anahtar için {"result":null} döner; hem bunu hem dev fallback'i ele al
  const raw = val && typeof val.result === "string" ? val.result : null;
  return raw ? JSON.parse(raw) : { lastAdCode: null, history: [] };
}

export async function setUserState(psid, state) {
  const key = `mondi:${psid}`;
  await redisCommand("SET", key, JSON.stringify(state));
}