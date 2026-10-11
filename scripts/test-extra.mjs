// Ek senaryo testleri — tek yanıt + yeni kurallar
// Run from project root: node scripts/test-extra.mjs
import { env } from "../api/env.js";

env.DRY_RUN = "false";
env.META_PAGE_ACCESS_TOKEN = "mock_token";
env.OPENROUTER_API_KEY = "";

const sent = [];
globalThis.fetch = async (url, opts) => {
  const urlStr = String(url);
  const body = opts?.body ? (() => { try { return JSON.parse(opts.body); } catch { return {}; } })() : {};
  if (body?.messaging_type === "RESPONSE" || urlStr.includes("me/messages")) {
    sent.push(body?.message?.text || "");
  }
  if (urlStr.includes("api.telegram.org")) return new Response("{}", { status: 200 });
  if (urlStr.includes("graph.facebook.com")) return new Response(JSON.stringify({ message_id: "mock" }), { status: 200, headers: { "Content-Type": "application/json" } });
  if (urlStr.includes("openrouter")) return new Response(JSON.stringify({ choices: [{ message: { content: "Mock AI yanıtı" } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  return origFetch(url, opts);
};

const { POST } = await import("../api/webhook.js");

async function simulate(senderId, text, referral) {
  const payload = { entry: [{ messaging: [{ sender: { id: senderId }, message: { text }, ...(referral ? { referral: { ref: referral } } : {}) }] }] };
  const req = new Request("http://localhost/api/webhook", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const before = sent.length;
  await POST(req);
  return sent.slice(before);
}

// 1. Karşılama
let r = await simulate("u_greet", "merhaba");
console.log("1. Karşılama:", JSON.stringify(r), r.length === 1 ? "✅" : `❌ ${r.length} mesaj`);

// 2. Temsilci → WhatsApp
r = await simulate("u_agent", "beni müşteri temsilcisine bağla");
console.log("2. Temsilci:", r.length === 1 && r[0].includes("0553 923 29 11") ? "✅" : `❌ ${JSON.stringify(r)}`);

// 3. Kampanya → WhatsApp
r = await simulate("u_camp", "yılsonu %50 indirim var mı?");
console.log("3. Kampanya:", r.length === 1 && r[0].includes("0553 923 29 11") ? "✅" : `❌ ${JSON.stringify(r)}`);

// 4. Ölçü → WhatsApp
r = await simulate("u_dim", "olivia koltuk ölçüleri nedir?");
console.log("4. Ölçü:", r.length === 1 && r[0].includes("0553 923 29 11") ? "✅" : `❌ ${JSON.stringify(r)}`);

// 5. Halı fiyatı (4m2 ve 6m2) — taksit bilgisi OLMAMALI
r = await simulate("u_hali", "fiyat nedir?", "52559470506856");
const haliOk = r.length === 1 && r[0].includes("2.950") && r[0].includes("7.450") && !r[0].includes("taksit");
console.log("5. Halı:", haliOk ? "✅" : `❌ ${JSON.stringify(r)}`);

// 6. Japandi fiyatı = 90.000 TL (düzeltme) — taksit bilgisi OLMAMALI
r = await simulate("u_jap", "fiyat?", "52559471816256");
const japOk = r.length === 1 && r[0].includes("90.000") && !r[0].includes("taksit");
console.log("6. Japandi:", japOk ? "✅" : `❌ ${JSON.stringify(r)}`);

// 7. Bahar Temizliği fiyat sorusu → özel temsilci mesajı
r = await simulate("u_bahar", "fiyat nedir?", "52559468646456");
const baharOk = r.length === 1 && r[0].includes("temsilcimize") && r[0].includes("%50");
console.log("7. Bahar Temizliği:", baharOk ? "✅" : `❌ ${JSON.stringify(r)}`);

// 8. Adres güncel mi?
r = await simulate("u_addr", "mağazanız nerede?");
console.log("8. Adres:", r.length === 1 && r[0].includes("Kazancıoğlu") && r[0].includes("KİLİS") ? "✅" : `❌ ${JSON.stringify(r)}`);

// 9. Yatak baza fiyatı
r = await simulate("u_baza", "kaç para bu?", "52559466887056");
console.log("9. Baza:", r.length === 1 && r[0].includes("28.500") ? "✅" : `❌ ${JSON.stringify(r)}`);

// 9b. Ödeme sorusu → temsilci yönlendirme
r = await simulate("u_pay", "taksit yapıyor musunuz?");
console.log("9b. Ödeme:", r.length === 1 && r[0].includes("canlı temsilcimize") ? "✅" : `❌ ${JSON.stringify(r)}`);

// 10. Dedup
await simulate("u_dup", "fiyat nedir?", "52559403956656");
const afterFirst = sent.length;
await simulate("u_dup", "fiyat nedir?", "52559403956656");
const afterSecond = sent.length;
console.log("10. Dedup:", afterFirst === afterSecond ? "✅" : "❌");

// 11. Her turda 1 mesaj
let allGood = true;
for (const [id, txt] of [["greet", "selam"], ["agent", "yetkili ile konuşmak istiyorum"], ["camp", "kampanyanız var mı"]]) {
  const n = (await simulate("s_" + id, txt)).length;
  if (n !== 1) { console.log(`11. ❌ ${id}: ${n} mesaj!`); allGood = false; }
}
if (allGood) console.log("11. Tek yanıt ✅");

// 12. İŞ KURALI: Olivia Konsept hakkındaki sorular → canlı temsilci (liste/fiyat YOK)
r = await simulate("u_olivia", "detayları neler?", "52559464364256");
const oliviaOk = r.length === 1 && r[0].includes("0553 923 29 11") && !r[0].includes("Gardrop") && !r[0].includes("299.950");
console.log("12. Olivia Konsept detay → temsilci:", oliviaOk ? "✅" : `❌ ${JSON.stringify(r)}`);

// 12b. Konsept reklamından gelen FİYAT sorusu da temsilciye (fiyat sızmasın)
r = await simulate("u_olivia_fiyat", "fiyatı ne kadar?", "52559464364256");
const oliviaFiyatOk = r.length === 1 && r[0].includes("0553 923 29 11") && !r[0].includes("299.950");
console.log("12b. Olivia Konsept fiyat → temsilci:", oliviaFiyatOk ? "✅" : `❌ ${JSON.stringify(r)}`);

// 13. Rosita Konsept — metinde adı geçiyor (referralsız) → temsilci
r = await simulate("u_rosita", "rosita konsept içinde neler var?");
const rositaOk = r.length === 1 && r[0].includes("0553 923 29 11") && !r[0].includes("Gardırop");
console.log("13. Rosita Konsept içerik → temsilci:", rositaOk ? "✅" : `❌ ${JSON.stringify(r)}`);

// 13b. Karşılama istisna: konsept reklamından gelip sadece "merhaba" yazan boş çevrilmez
r = await simulate("u_olivia_greet", "merhaba", "52559464364256");
const greetOk = r.length === 1 && r[0].includes("Mondihome'a hoş geldiniz");
console.log("13b. Konsept bağlamında selamlama serbest:", greetOk ? "✅" : `❌ ${JSON.stringify(r)}`);

// 14. Olivia Koltuk takımına içerik sorulursa → konsept listesi ASLA sızmaz (konsept intent → yönlendirme)
r = await simulate("u_olivia_koltuk", "detay nedir?", "52559469930656");
const olivKoltOk = r.length === 1 && !r[0].includes("Berjer");
console.log("14. Olivia Koltuk takımı (konsept değil):", olivKoltOk ? "✅" : `❌ ${JSON.stringify(r)}`);

// 15. Ücretsiz kargo sorusu
r = await simulate("u_kargo", "kargo ücretsiz mi?");
const kargoOk = r.length === 1 && r[0].includes("ücretsiz teslimat") && r[0].includes("şehre");
console.log("15. Ücretsiz kargo:", kargoOk ? "✅" : `❌ ${JSON.stringify(r)}`);

// 16. Teslimat sorusu
r = await simulate("u_teslimat", "teslimat nasıl oluyor?");
const teslimatOk = r.length === 1 && r[0].includes("ücretsiz teslimat");
console.log("16. Teslimat:", teslimatOk ? "✅" : `❌ ${JSON.stringify(r)}`);

console.log(`\nToplam Graph API mesajı: ${sent.length}`);
process.exit(0);