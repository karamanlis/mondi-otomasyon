// Ürün tanıma — müşterinin yazdığı metinden hangi ürünü sorduğunu bulur.
// Tek doğruluk kaynağı: data/products.json (fiyat listesi, ürün kartları, AI prompt'u buradan üretilir)
import products from "../data/products.json" with { type: "json" };

// Marka (özel ad) token'ları — ürün adlarında geçen özgün isimler
const BRANDS = ["perissa", "olivia", "rosita", "japandi"];

const TR = { ç: "c", ğ: "g", ı: "i", İ: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u", é: "e" };

/** Türkçe normalize: küçük harf + aksan kaldırma */
export function normalizeTr(text) {
  return (text || "")
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşüâîûéİ]/g, (ch) => TR[ch] || ch);
}

/** Metini eşleştirmeye uygun token listesine çevirir */
function tokensOf(text) {
  return normalizeTr(text)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}

/**
 * Türkçe ek toleranslı token eşleşmesi: "takimi"~"takim", "konsepti"~"konsept"
 * Biri diğerinin başlangıcıysa ve ortak parça >= 4 karakterse eş sayılır.
 */
function tokenMatch(a, b) {
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4) {
    return a.startsWith(b) || b.startsWith(a);
  }
  return false;
}

// Ürün indeksi — her ürün için normalize token'lar ve marka
const CATALOG = Object.values(products).map((p) => {
  const toks = tokensOf(p.adName);
  return { ...p, tokens: toks, brand: BRANDS.find((b) => toks.some((t) => t === b)) || null };
});

const hasToken = (tokens, word) => tokens.some((t) => tokenMatch(t, word));

/** Marka içinde alt tür: konsept mi, koltuk takımı mı? */
function detectFamily(tokens) {
  if (hasToken(tokens, "konsept") || hasToken(tokens, "konsep")) return "konsept";
  if (hasToken(tokens, "koltuk") || hasToken(tokens, "kanepa") || hasToken(tokens, "takim"))
    return "koltuk";
  return null;
}

/** Markasız ama ayırt edici kelimelerle ürün eşleştirme (halı, yatak/baza, bahar temizliği) */
function matchGeneric(tokens) {
  if (hasToken(tokens, "hali")) return CATALOG.find((p) => hasToken(p.tokens, "hali")) || null;
  if (hasToken(tokens, "yatak") || hasToken(tokens, "baza") || hasToken(tokens, "baslik"))
    return CATALOG.find((p) => hasToken(p.tokens, "yatak")) || null;
  if (hasToken(tokens, "temizlik") || (hasToken(tokens, "bahar") && hasToken(tokens, "kampanya")))
    return CATALOG.find((p) => hasToken(p.tokens, "bahar")) || null;
  return null;
}

/**
 * Mesaj metninden ürünü çözer.
 * @param {string} text - müşterinin mesajı
 * @param {{pendingBrand?: string|null}} opts - önceki turda sorulan "hangisi?" sorusunun markası
 * @returns {{product: object|null, ambiguous: {brand: string, candidates: object[]}|null}}
 */
export function resolveProduct(text, { pendingBrand = null } = {}) {
  const tokens = tokensOf(text);
  if (tokens.length === 0) return { product: null, ambiguous: null };

  const explicitBrand = BRANDS.find((b) => hasToken(tokens, b));
  const brand = explicitBrand || pendingBrand;
  const family = detectFamily(tokens);

  if (brand) {
    const cands = CATALOG.filter((p) => p.brand === brand);
    if (cands.length === 1) return { product: cands[0], ambiguous: null };
    if (cands.length > 1) {
      if (family === "konsept") {
        const k = cands.find((p) => hasToken(p.tokens, "konsept"));
        if (k) return { product: k, ambiguous: null };
      }
      if (family === "koltuk") {
        const k = cands.find((p) => !hasToken(p.tokens, "konsept"));
        if (k) return { product: k, ambiguous: null };
      }
      // "rosita" tek başına — marka net ama ürün belirsiz.
      // Marka SADECE pendingBrand'dan geliyorsa müşteri netleştirme kelimesi söylememiş demektir;
      // aynı soruyu tekrar sormamak için belirsizliği yok say.
      if (explicitBrand) return { product: null, ambiguous: { brand: explicitBrand, candidates: cands } };
    }
    // pendingBrand markalı ürün listeden silinmişse genel eşleştirmeye düş
  }

  const generic = matchGeneric(tokens);
  if (generic) return { product: generic, ambiguous: null };

  return { product: null, ambiguous: null };
}

/** products.json kaydını marka/token bilgisiyle birlikte döndürür (context kontrolü için) */
export function findProduct(adCode) {
  if (!adCode) return null;
  return CATALOG.find((p) => p.adCode === String(adCode)) || products[adCode] || null;
}

const priceLine = (p) =>
  p.priceHint && !/canlı/i.test(p.priceHint)
    ? `${p.priceHint}${p.priceHint.includes("TL") ? "" : " TL"}`
    : null;

/** Ürün adı yazıp soru sormayan müşteriye gönderilen kısa tanıtım kartı */
export function getProductCard(product) {
  const pl = priceLine(product);
  const lines = [`🛋️ ${product.adName}`];
  if (pl) lines.push(`💰 Fiyatı: ${pl}`);
  lines.push("Fiyat, içerik, kargo gibi konularda istediğinizi sorabilirsiniz 🙏");
  return lines.join("\n");
}

/** "Rosita" gibi belirsiz markada müşterine hangisini sorduğunu netleştiren soru */
export function getAmbiguityQuestion({ candidates }) {
  const list = candidates
    .map((p) => {
      const pl = priceLine(p);
      return `• ${p.adName}${pl ? ` — ${pl}` : ""}`;
    })
    .join("\n");
  return `Bu isimle birden fazla ürünümüz var:\n${list}\n\nHangisi hakkında bilgi almak istersiniz? 🛋️`;
}

/** AI sistem prompt'u + raporlama için fiyat listesi (canlı temsilci ürünleri hariç) */
export function priceListLines() {
  return CATALOG.filter((p) => priceLine(p)).map((p) => `${p.adName}: ${priceLine(p)}`);
}
