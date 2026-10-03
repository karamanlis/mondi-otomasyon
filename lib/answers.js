// Rule-based intent detection + answer templates

export const WHATSAPP_NUMBER = "0553 923 29 11";
export const STORE_ADDRESS =
  "Mehmet Rıfat Kazancıoğlu Mahallesi, Org. Safter Nacioğlu Blv. Kadirbeyoğlu Petrol Yanı No:52, Merkez / KİLİS";

const GREETING_TEXT =
  "Mondihome'a hoş geldiniz. Size nasıl yardımcı olabilirim? Hangi ürünümüz hakkında bilgi almak istersiniz?";

// düzeltme2.txt — Konsept ürünlerin detay/içerik sorularına verilecek TEK doğru liste
export const KONSEP_DETAILS = {
  "Olivia Konsept": [
    "6 Kapaklı Gardrop",
    "Makyaj Aynası",
    "Makyaj Masası",
    "2 Adet Komodin",
    "160'lık Başlık",
    "Baza",
    "Yatak",
    "Konsol",
    "Konsol Aynası",
    "Açılır Masa",
    "6 Sandalye",
    "2 Üçlü Koltuk",
    "2 Berjer",
  ],
  "Rosita Konsept": [
    "2 Adet Üçlü",
    "Konsol Aynası",
    "2 Adet Berjer",
    "Masa",
    "6 Adet Sandalye",
    "6 Kapaklı Gardırop",
    "Makyaj Masası",
    "Makyaj Aynası",
    "2 Adet Komodin",
    "Baza + Başlık + Yatak",
  ],
};

/** Metinden/ürün adından hangi konseptin kastedildiğini bulur (Koltuk takımı ≠ Konsept) */
function matchKonsept(name) {
  const n = (name || "").toLocaleLowerCase("tr");
  if (!n.includes("konsept")) return null;
  if (n.includes("olivia")) return "Olivia Konsept";
  if (n.includes("rosita")) return "Rosita Konsept";
  return null;
}

function formatKonsept(key) {
  const items = KONSEP_DETAILS[key].map((i) => `• ${i}`).join("\n");
  return `🛋️ ${key} içeriği:\n${items}\n\nBaşka bir sorunuz olursa yardımcı olmaktan memnuniyet duyarız 🙏`;
}

const INTENTS = {
  greeting: [
    /^merhaba[\s!.?]*$/i,
    /^selam[\s!.?]*$/i,
    /^selamlar[\s!.?]*$/i,
    /^günaydın[\s!.?]*$/i,
    /^iyi\s+(günler|akşamlar)[\s!.?]*$/i,
    /^hello[\s!.?]*$/i,
    /^hi[\s!.?]*$/i,
    /^hey[\s!.?]*$/i,
    /^(merhaba|selam)[\s,.!]+(yardım|bilgi|nasıls)/i,
  ],
  liveAgent: [/temsilci/i, /yetkili/i, /müdür/i, /operatör/i, /insan/i, /bağla/i, /konuşabil/i],
  campaign: [/indirim/i, /kampanya/i, /%\s?50/i, /yıl\s?sonu/i],
  shipping: [/kargo/i, /teslimat/i, /ücretsiz/i],
  price: [/fiyat\b/i, /kaç para/i, /ücret\b/i, /ne kadar/i, /pahal[ıi]/i, /ucuz/i, /\btl\b/i, /lira/i],
  payment: [/taksit/i, /ödeme/i, /vade/i, /kredi kartı/i, /nakit/i, /kapora/i, /kapar[aı]/i],
  dimensions: [/ölç[üu]/i, /boyut/i, /ebat/i, /kaç cm/i, /santim/i, /geniş/i, /model/i],
  konsept: [/konsept/i, /içerik/i, /içindekiler/i, /içinde\s+ne/i, /ne\s+var\b/i, /hangi\s+ürün(ler)?/i, /kaç\s+parça/i, /detay/i, /komple\s+set/i, /takımın\s+içinde/i],
  address: [/adres/i, /nerede/i, /konum/i, /mağaza/i, /dükkan/i, /gidebilirim/i, /ulaş/i],
};
const INTENT_ORDER = ["greeting", "liveAgent", "campaign", "shipping", "price", "payment", "dimensions", "konsept", "address"];

export function detectIntent(text) {
  for (const intent of INTENT_ORDER) {
    for (const re of INTENTS[intent]) {
      if (re.test(text)) return intent;
    }
  }
  return "other";
}

/** Temsilci/kampanya/ölçü-model soruları için TEK ve SON cevap: WhatsApp yönlendirmesi */
export function getWhatsAppRedirect() {
  return `Bu konuda detaylı bilgi için WhatsApp numaramızdan bize ulaşabilirsiniz: ${WHATSAPP_NUMBER} 🙏 Mondi Home ❤️`;
}

export function getAnswer(intent, product, text = "") {
  // Bahar Temizliği için özel yanıt — %50'ye varan indirimler
  if (product?.adName && /bahar\s*temizliği/i.test(product.adName)) {
    return "Yılsonu %50'ye varan indirimler için detaylı bilgi almak istiyorsanız sizi müşteri temsilcimize bağlıyoruz. En kısa sürede dönüş yapacağız 🙏";
  }

  switch (intent) {
    case "greeting":
      return GREETING_TEXT;
    case "liveAgent":
    case "campaign":
    case "dimensions":
      return getWhatsAppRedirect();
    case "shipping":
      return "Bulunduğunuz şehre ücretsiz teslimat yapıyoruz efendim. Size başka nasıl yardımcı olabilirim?";
    case "price": {
      if (!product?.priceHint) return null; // kural eşleşmedi → AI
      if (product.priceHint.toLowerCase().includes("canlı")) return getWhatsAppRedirect();
      const tl = product.priceHint.includes("TL") ? "" : " TL";
      return `✅ ${product.adName} fiyatı: ${product.priceHint}${tl}`;
    }
    case "konsept": {
      // Önce metinde adı geçiyor mu bak, sonra product.adName'e düş
      const key = matchKonsept(text) || (product && matchKonsept(product.adName));
      if (key && KONSEP_DETAILS[key]) return formatKonsept(key);
      return null; // → AI fallback (sistem prompt'unda da konsept içerikleri var)
    }
    case "payment":
      return "Ödeme seçenekleri konusunda sizi müşteri temsilcimize yönlendiriyorum.";
    case "address":
      return `📍 Mağaza Adresi: ${STORE_ADDRESS}`;
    default:
      return null;
  }
}
