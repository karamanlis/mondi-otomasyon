// Environment loader — works in Vercel runtime and local dev
export const env = {
  // Meta
  META_PAGE_ID: process.env.META_PAGE_ID || "",
  META_PAGE_ACCESS_TOKEN: process.env.META_PAGE_ACCESS_TOKEN || "",
  META_APP_SECRET: process.env.META_APP_SECRET || "",
  META_VERIFY_TOKEN: process.env.META_VERIFY_TOKEN || "",

  // OpenRouter
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",

  // Telegram
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || "",

  // Upstash Redis (Vercel KV_* veya doğrudan Upstash UPSTASH_* adları)
  KV_REST_API_URL: process.env.KV_REST_API_URL || "",
  KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN || "",
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || "",
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || "",

  // Dev mode
  DRY_RUN: process.env.DRY_RUN || "true",
};