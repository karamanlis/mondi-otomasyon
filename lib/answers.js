// Rule-based intent detection + answer templates
import { isKonseptProduct } from "./catalog.js";

export const WHATSAPP_NUMBER = "0553 923 29 11";
export const STORE_ADDRESS =
  "Mehmet Rıfat Kazancıoğlu Mahallesi, Org. Safter Nacioğlu Blv. Kadirbeyoğlu Petrol Yanı No:52, Merkez / KİLİS";

const GREETING_TEXT =
  "Mondihome'a hoş geldiniz. Size nasıl yardımcı olabilirim? Hangi ürünümüz hakkında bilgi almak istersiniz?";

/**
 * İŞ KURALI (2026-10-11): Konsept ürünleri (adında "konsept" geçen — Rosita/Olivia Konsept)
 * hakkında bot HİÇBİR detay/fiyat/ürün içeriği vermez; tüm sorular canlı temsilciye
 * yönlendirilir. Eski konsept içerik listeleri (düzeltme2.txt / KONSEP_DETAILS) kaldırıldı;
 * gereken olursa git geçmişinden (commit 93273e1 ve öncesi) ulaşılabilir.
 */

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
      if (isKonseptProduct(product)) return getWhatsAppRedirect(); // konsept fiyatı bot'tan sorulmaz
      if (!product?.priceHint) return null; // kural eşleşmedi → AI
      if (product.priceHint.toLowerCase().includes("canlı")) return getWhatsAppRedirect();
      const tl = product.priceHint.includes("TL") ? "" : " TL";
      return `✅ ${product.adName} fiyatı: ${product.priceHint}${tl}`;
    }
    case "konsept":
      // Konsept ürün sorusu webhooks tarafında zaten canlı temsilciye yönlendirilir;
      // burası savunma katmanı: içeriğe dair her soru (ürün fark etmeksizin) temsilciye.
      return getWhatsAppRedirect();
    case "payment":
      return "Merhaba, ödeme seçenekleri konusunda sizi canlı temsilcimize bağlıyorum.";
    case "address":
      return `📍 Mağaza Adresi: ${STORE_ADDRESS}`;
    default:
      // "other" — artık burada yargılamıyoruz: ürün eşleşmesi webhook tarafında çözüldü.
      // Ürün adı geçiyorsa ürün kartı, geçmiyorsa AI denemesi için null döner.
      return null;
  }
}
