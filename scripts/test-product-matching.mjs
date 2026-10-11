// Ürün tanıma test matrisi — offline, ağ çağrısı yapmaz
// Çalıştır: node scripts/test-product-matching.mjs
import {
  resolveProduct,
  findProduct,
  isKonseptProduct,
  getProductCard,
  getAmbiguityQuestion,
  priceListLines,
} from "../lib/catalog.js";
import { detectIntent, getAnswer } from "../lib/answers.js";

let pass = 0,
  fail = 0;
function t(name, cond, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    console.log(`  ❌ ${name}${detail ? `  → ${detail}` : ""}`);
  }
}

console.log("\n=== 1. İfade varyantları AYNI ürüne düşmeli ===");
for (const variant of [
  "rosita koltuk",
  "Rosita koltuk takımı",
  "Rosita Koltuk takımının fiyatı ne kadar",
  "rositanın koltuk takımı",
  "Rosita koltuklar kaç TL",
]) {
  const { product, ambiguous } = resolveProduct(variant);
  t(
    `"${variant}" → Rosita Koltuk takımı`,
    product?.adName === "Rosita Koltuk takımı",
    `goten: ${product?.adName ?? (ambiguous ? "BELİRSİZ" : "yok")}`,
  );
}

for (const variant of ["rosita konsept", "Rosita Konsept içeriği", "Rosita konsepti fiyatı"]) {
  const { product } = resolveProduct(variant);
  t(`"${variant}" → Rosita Konsept`, product?.adName === "Rosita Konsept", `got: ${product?.adName}`);
}

console.log("\n=== 2. Diğer markalar ve markasız ürünler ===");
t("olivia konsept neler var → Olivia Konsept", resolveProduct("olivia konsept neler var").product?.adName === "Olivia Konsept");
t("perissa fiyatı → Perissa Koltuk takımı", resolveProduct("perissa fiyatı").product?.adName === "Perissa Koltuk takımı");
t("japandi koltuk ne kadar → Japandi Koltuk", resolveProduct("japandi koltuk ne kadar").product?.adName === "Japandi Koltuk");
t("halı fiyatı → Halı Kampanyası", resolveProduct("halı fiyatı").product?.adName === "Halı Kampanyası");
t("yatak baza kaç tl → yatak ürünü", resolveProduct("yatak baza kaç tl").product?.adName?.includes("yatak"));
t("bahar temizliği → Bahar Temizliği", resolveProduct("bahar temizliği kampanyası var mı").product?.adName === "Bahar Temizliği");

console.log("\n=== 3. Markasız genellemeler BAĞLAMI bozmamalı ===");
for (const variant of ["merhaba", "fiyatı ne kadar", "koltuk takımı fiyatları", "teşekkürler", "adres nedir"]) {
  const { product, ambiguous } = resolveProduct(variant);
  t(`"${variant}" → ürün atlaması YOK`, !product && !ambiguous, `got: ${product?.adName || "BELİRSİZ"}`);
}

console.log("\n=== 4. Belirsiz marka → netleştirme sorusu ===");
const amb = resolveProduct("rosita");
t("bare 'rosita' → ambiguous", amb.ambiguous?.brand === "rosita" && amb.candidates === undefined && amb.ambiguous.candidates.length === 2);
const qText = getAmbiguityQuestion(amb.ambiguous);
t("soru iki ürünü listeler; konsept fiyatı GİZLİ", qText.includes("Rosita Koltuk takımı") && qText.includes("79.950") && qText.includes("Rosita Konsept") && !qText.includes("229.950"), qText);

console.log("\n=== 5. pendingBrand ile yarım cevap → çözülür ===");
t("'takım' + pendingBrand=rosita → Koltuk takımı", resolveProduct("takım", { pendingBrand: "rosita" }).product?.adName === "Rosita Koltuk takımı");
t("'konsept ol' + pendingBrand=rosita → Konsept", resolveProduct("konsept ol", { pendingBrand: "rosita" }).product?.adName === "Rosita Konsept");
t("'merhaba' + pendingBrand → belirsizlik SORUSU TEKRARLANMAZ", (() => { const r = resolveProduct("merhaba", { pendingBrand: "rosita" }); return !r.ambiguous; })());

console.log("\n=== 6. Fiyat cevabı artık DOĞRU üründen (asıl şikâyet) ===");
// Rosita Konsept reklamına tıklayıp "rosita koltuk fiyatı" soran müşteri:
const rk = resolveProduct("rosita koltuk fiyatı").product;
const priceAns = getAnswer(detectIntent("rosita koltuk fiyatı"), rk, "rosita koltuk fiyatı");
t("→ 79.950 TL verilir", priceAns?.includes("79.950"), `cevap: ${priceAns}`);
t("→ 229.950 TL SIZMAZ", !priceAns?.includes("229.950"), `cevap: ${priceAns}`);

console.log("\n=== 7. YENİ İŞ KURALI: konsept ürünler → canlı temsilci ===");
const konseptAns = getAnswer(detectIntent("içinde neler var"), resolveProduct("rosita konsept").product, "içinde neler var");
t("konsept içerik sorusu → WhatsApp yönlendirme, liste YOK", konseptAns?.includes("0553 923 29 11") && !/\bGardrop|Berjer\b/.test(konseptAns || ""), `cevap: ${konseptAns?.slice(0, 70)}`);
const konseptFiyat = getAnswer(detectIntent("olivia konsept fiyatı ne kadar"), resolveProduct("olivia konsept").product, "olivia konsept fiyatı ne kadar");
t("konsept FİYAT sorusu → yönlendirme, fiyat YOK", konseptFiyat?.includes("0553 923 29 11") && !konseptFiyat?.includes("299.950"), `cevap: ${konseptFiyat}`);
t("isKonseptProduct: konseptler ✓, koltuk/yatak/halı ✗", isKonseptProduct(resolveProduct("rosita konsept").product) && isKonseptProduct(resolveProduct("olivia konsept").product) && !isKonseptProduct(resolveProduct("rosita koltuk").product) && !isKonseptProduct(findProduct("52559466887056")) && !isKonseptProduct(findProduct("52559470506856")));
const koltukIcerik = getAnswer(detectIntent("Rosita koltuk takımının içinde ne var"), resolveProduct("Rosita koltuk takımı").product, "Rosita koltuk takımının içinde ne var");
t("koltuk takımı içerik sorusu da yönlendirme (konsept intent kuralı)", koltukIcerik?.includes("0553 923 29 11"), `cevap: ${koltukIcerik?.slice(0, 70)}`);

console.log("\n=== 8. 'other' intent artık WhatsApp'a kaçmaz, AI'a düşer ===");
t("'pantolon var mı?' → getAnswer null (AI denenir)", getAnswer(detectIntent("pantolon var mı"), null, "pantolon var mı") === null);
t("ürün adı + 'other' → ürün kartı", getProductCard(findProduct("52559471816256")).includes("Japandi Koltuk"));
t("ürün kartında fiyat var", getProductCard(findProduct("52559471816256")).includes("90.000"));

console.log("\n=== 9. AI fiyat listesi: tek kaynak + konsept dışlama ===");
const pl = priceListLines();
t("Japandi prompt listesinde", pl.some((l) => l.includes("Japandi")), pl.join(" | "));
t("Bahar Temizliği (canlı fiyat) listede YOK", !pl.some((l) => l.includes("Bahar")));
t("KONSEPT ÜRÜNLERİ listede YOK (AI fiyat uyduramaz)", !pl.some((l) => /konsept/i.test(l)), pl.join(" | "));
t("6 fiyatlanabilir ürün (2 konsept düştü)", pl.length === 6, `sayı: ${pl.length} → ${pl.join(" | ")}`);

console.log(`\n${fail === 0 ? "✅ TÜM TESTLER GEÇTİ" : "❌ FAIL: " + fail}  (${pass} passed, ${fail} failed)\n`);
process.exit(fail === 0 ? 0 : 1);
