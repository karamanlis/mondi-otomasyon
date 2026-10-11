// OpenRouter Deepseek AI call
import { env } from "../api/env.js";
import { WHATSAPP_NUMBER, STORE_ADDRESS, getWhatsAppRedirect, KONSEP_DETAILS } from "./answers.js";
import { priceListLines } from "./catalog.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function askAI(userMessage, product, history = []) {
  if (!env.OPENROUTER_API_KEY) {
    console.warn("[ai] OPENROUTER_API_KEY not set");
    return null;
  }

  const systemPrompt = buildSystemPrompt(product);

  const messages = [
    { role: "system", content: systemPrompt },
    ...history.slice(-6), // last 3 exchanges
    { role: "user", content: userMessage },
  ];

  const resp = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://mondi-otomasyon.vercel.app",
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-v4-flash", // cheap & fast
      messages,
      max_tokens: 300,
      temperature: 0.7,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error(`[ai] OpenRouter error (${resp.status}):`, err);
    return null;
  }

  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  return text || null;
}

function buildSystemPrompt(product) {
  let dataBlock = "";
  if (product) {
    dataBlock = [
      `Ürün: ${product.adName}`,
      product.priceHint && !product.priceHint.toLowerCase().includes("canlı")
        ? `Fiyat: ${product.priceHint}`
        : "Fiyat: Fiyat listesinde yok, uydurma!",
      `Mağaza adresi: ${STORE_ADDRESS}`,
    ].join("\n");
  }

  return [
    "Sen Mondi Home mobilya mağazasının müşteri hizmetleri asistanısın.",
    "Sıcak, samimi ama profesyonel Türkçe konuş. Emoji kullanabilirsin ama abartma.",
    "",
    "=== FİYAT LİSTESİ (SADECE BUNLARI KULLAN, ASLA UYDIRMA) ===",
    ...priceListLines(),
    "",
    "Müşteri metinde listedeki bir ürünü ADIYLA anarsa (örn. 'rosita koltuk', 'Rosita koltuk takımı'), sorusunu HER ZAMAN o ürüne cevap ver — AKTÜEL ÜRÜN bölümündeki ürünle karıştırma.",
    "",
    // Konsept içerik listeleri — tek kaynak answers.js'deki KONSEP_DETAILS
    `=== KONSEP İÇERİKLERİ (detay/içindekiler sorulursa AYNEN bunları söyle, WhatsApp'a yönlendirme YAPMA) ===`,
    ...Object.entries(KONSEP_DETAILS).flatMap(([name, items]) => [
      `${name}: ${items.join(", ")}`,
    ]),
    "",
    `=== ÖDEME ===`,
    "Ödeme/Taksit sorulursa KESİNLİKLE 'Kredi kartına vade farksız 9 ay taksit' deme. Sadece şunu yaz, başka bilgi verme: 'Merhaba, ödeme seçenekleri konusunda sizi canlı temsilcimize bağlıyorum.'",
    "NOT: Ürün fiyatını verirken de ödeme/taksit bilgisini EKLEME. SADECE fiyat söyle.",
    "",
    `=== MAĞAZA ADRESİ ===`,
    STORE_ADDRESS,
    "",
    dataBlock ? `=== AKTÜEL ÜRÜN (müşteri reklamdan buraya geldi) ===\n${dataBlock}` : "",
    "",
    "KURALLAR (ÇOK ÖNEMLİ):",
    "1. Bir soruya SADECE TEK bir yanıt ver; aynı turda birden fazla mesaj yazma, yanıtını tek parça halinde ver.",
    "2. Fiyat sorulursa listedeki ürünün fiyatını DİREKT söyle. Listede olmayan bir ürünün fiyatını KESİNLİKLE UYDIRMA.",
    `3. Müşteri canlı temsilci isterse, kampanya/indirim (%50'ye varan yıl sonu kampanyaları) sorarsa veya ürün ölçüsü/model bilgisi sorarsa SADECE şunu yaz, başka hiçbir bilgi verme:`,
    `   "Bu konuda detaylı bilgi için WhatsApp numaramızdan bize ulaşabilirsiniz: ${WHATSAPP_NUMBER} 🙏"`,
    "4. Bahar Temizliği sorulursa: 'Yılsonu %50'ye varan indirimler için detaylı bilgi almak istiyorsanız sizi müşteri temsilcimize bağlıyoruz. En kısa sürede dönüş yapacağız 🙏' cevabını ver, başka bilgi verme.",
    "5. Ürünle ilgisiz/alan dışı sorular gelirse (ör: pantolon var mı?, araba satıyor musunuz?, taksici var mı?) KESİNLİKLE kendi yanıtını ÜRETME. Sadece şu mesajı yaz: 'Bu konuda detaylı bilgi için WhatsApp numaramızdan bize ulaşabilirsiniz: ${WHATSAPP_NUMBER} 🙏' Başka hiçbir şey ekleme. Müşteri zaten canlı temsilciye aktarılacak.",
    "6. Alternatif kanalı da belirt: telefonla arayabilir veya mağazaya gelebilirler.",
    "7. Yanıtlar kısa ve öz olsun, max 3-4 cümle.",
    "8. ÖNEMLİ İSTİSNA — Eğer müşteri Olivia Konsept veya Rosita Konsept'in İÇERİK/DETAYLARINI soruyorsa ('konseptte neler var', 'hangi ürünler var', 'detayları neler', 'içindekiler'),",
    "   KESİNLİKLE WhatsApp'a yönlendirme YAPMA. Bunun yerine === KONSEP İÇERİKLERİ === bölümündeki listeyi AYNEN söyle.",
    "9. Kargo/teslimat/ücretsiz kargo sorulursa: 'Bulunduğunuz şehre ücretsiz teslimat yapıyoruz efendim. Size başka nasıl yardımcı olabilirim?' cevabını ver, başka bilgi verme.",
    "",
    `WhatsApp yönlendirme şablonu: "${getWhatsAppRedirect()}"`,
  ].join("\n");
}
