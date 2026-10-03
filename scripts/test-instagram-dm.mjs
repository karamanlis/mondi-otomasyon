// Instagram DM Simülasyon Testi — Dry-Run
// Instagram DM, Messenger ile AYNI webhook endpoint'ini kullanır
// ve AYNI entry.messaging yapısında gelir.
// Bu test, Instagram'dan gelmiş gibi mesaj göndererek tüm pipeline'ı çalıştırır.

import { env } from "../api/env.js";
env.DRY_RUN = "true";
env.META_VERIFY_TOKEN = "my_verify_token_123";

// Mock fetch — gerçek API çağrısı yapma
globalThis.fetch = async (url, opts) => {
  console.log(`[mock-fetch] ${opts?.method || "GET"} ${url}`);
  if (opts?.body) {
    const body = JSON.parse(opts.body);
    if (body?.message?.text) console.log(`  → 📤 GÖNDERİLECEK: "${body.message.text.slice(0, 120)}"`);
  }
  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
};

console.log("═══════���═══════════════════════════════════════════");
console.log("  INSTAGRAM DM SİMÜLASYON TESTİ");
console.log("  (Messenger ile aynı webhook, aynı pipeline)");
console.log("═══════════════════════════════════════════════════\n");

const scenarios = [
  {
    name: "🎯 IG DM: Selamlama (reklam tıklaması sonrası)",
    note: "Instagram reklamından gelen kullanıcı 'merhaba' yazıyor",
    payload: {
      entry: [{
        messaging: [{
          sender: { id: "ig_user_1" },
          message: { text: "merhaba" },
          referral: { ref: "52559403956656" }, // Perissa Koltuk reklamı
        }]
      }]
    },
  },
  {
    name: "🎯 IG DM: Fiyat sorusu (reklam sonrası)",
    note: "Instagram reklamından gelen kullanıcı fiyat soruyor",
    payload: {
      entry: [{
        messaging: [{
          sender: { id: "ig_user_2" },
          message: { text: "fiyatı ne kadar?" },
          referral: { ref: "52559469930656" }, // Olivia Koltuk
        }]
      }]
    },
  },
  {
    name: "🎯 IG DM: Konsept içeriği sorusu",
    note: "Instagram DM'den Olivia Konsept içeriğini soruyor",
    payload: {
      entry: [{
        messaging: [{
          sender: { id: "ig_user_3" },
          message: { text: "içinde neler var?" },
          referral: { ref: "52559464364256" }, // Olivia Konsept
        }]
      }]
    },
  },
  {
    name: "🎯 IG DM: Kargo sorusu",
    note: "Instagram DM'den teslimat soruyor",
    payload: {
      entry: [{
        messaging: [{
          sender: { id: "ig_user_4" },
          message: { text: "kargo ücretli mi?" },
        }]
      }]
    },
  },
  {
    name: "🎯 IG DM: Temsilci talebi",
    note: "Instagram DM'den canlı temsilci istiyor",
    payload: {
      entry: [{
        messaging: [{
          sender: { id: "ig_user_5" },
          message: { text: "temsilciyle konuşabilir miyim?" },
        }]
      }]
    },
  },
  {
    name: "🎯 IG DM: Adres sorusu",
    note: "Instagram DM'den mağaza adresini soruyor",
    payload: {
      entry: [{
        messaging: [{
          sender: { id: "ig_user_6" },
          message: { text: "mağazanız nerede?" },
        }]
      }]
    },
  },
  {
    name: "🎯 IG DM: Doğal dil sorusu (AI fallback)",
    note: "Instagram DM'den bilinmeyen bir soru → AI devreye girecek",
    payload: {
      entry: [{
        messaging: [{
          sender: { id: "ig_user_7" },
          message: { text: "bu koltuk hangi renk seçenekleri var?" },
          referral: { ref: "52559471816256" }, // Japandi Koltuk
        }]
      }]
    },
  },
  {
    name: "🎯 IG DM: Halı fiyatı",
    note: "Instagram DM'den halı kampanyası fiyatı",
    payload: {
      entry: [{
        messaging: [{
          sender: { id: "ig_user_8" },
          message: { text: "halı fiyatları nedir?" },
          referral: { ref: "52559470506856" },
        }]
      }]
    },
  },
  {
    name: "🎯 IG DM: Taksit sorusu",
    note: "Instagram DM'den ödeme/taksit sorusu",
    payload: {
      entry: [{
        messaging: [{
          sender: { id: "ig_user_9" },
          message: { text: "taksit imkanı var mı?" },
          referral: { ref: "52559466887056" },
        }]
      }]
    },
  },
  {
    name: "🎯 IG DM: Bahar Temizliği kampanyası",
    note: "Instagram DM'den özel kampanya sorusu",
    payload: {
      entry: [{
        messaging: [{
          sender: { id: "ig_user_10" },
          message: { text: "indirim var mı?" },
          referral: { ref: "52559468646456" }, // Bahar Temizliği
        }]
      }]
    },
  },
];

async function runScenario(scenario) {
  console.log(`\n┌─ ${scenario.name}`);
  console.log(`│  📝 ${scenario.note}`);
  console.log(`└───────────────────────────────────────`);

  const { POST } = await import("../api/webhook.js");
  const req = new Request("http://localhost/api/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(scenario.payload),
  });

  await POST(req);
}

async function main() {
  for (const s of scenarios) {
    await runScenario(s);
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  ✅ Tüm Instagram DM test senaryoları tamamlandı!");
  console.log("  📌 Not: Instagram DM ve Messenger aynı pipeline");
  console.log("═══════════════════════════════════════════════════\n");
}

main().catch(e => console.error("Test hatası:", e));
