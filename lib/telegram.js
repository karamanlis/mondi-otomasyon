// Telegram handoff notification
import { env } from "../api/env.js";

const TELEGRAM_API = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;

export async function notifyAgent(customerName, psid, message, productName) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    console.warn("[telegram] not configured, skipping notification");
    return;
  }

  const text = [
    "🆘 **Temsilci Yönlendirme Talebi**",
    `👤 Müşteri: ${customerName || "Bilinmiyor"} (PSID: ${psid})`,
    productName ? `📦 Ürün: ${productName}` : "",
    `💬 Mesaj: ${message}`,
    "",
    `➡️ Hemen müşteriyle ilgilenin!`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text,
        parse_mode: "Markdown",
      }),
    });
    console.log(`[telegram] agent notified for PSID ${psid}`);
  } catch (err) {
    console.error("[telegram] send error:", err);
  }
}