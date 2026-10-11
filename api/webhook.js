// Meta Messenger/IG Webhook handler
// GET  → hub.challenge verification
// POST → message event processing
import { env } from "./env.js";
import { verifySignature, sendMessage } from "../lib/meta.js";
import { detectIntent, getAnswer, getWhatsAppRedirect } from "../lib/answers.js";
import { resolveProduct, findProduct, getProductCard, getAmbiguityQuestion } from "../lib/catalog.js";
import { askAI } from "../lib/ai.js";
import { getUserState, setUserState } from "../lib/state.js";
import { notifyAgent } from "../lib/telegram.js";

/** GET — webhook verification */
export async function GET(request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === env.META_VERIFY_TOKEN && challenge) {
    console.log("[webhook] verified!");
    return new Response(challenge, { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

/** POST — incoming messages */
export async function POST(request) {
  // Verify signature
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256") || "";

  if (!verifySignature(rawBody, signature)) {
    console.warn("[webhook] invalid signature, ignoring");
    return new Response("OK", { status: 200 }); // return 200 to avoid Meta retries
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  // Process each entry
  for (const entry of body.entry || []) {
    // Handle Messenger events
    for (const msg of entry.messaging || []) {
      // Skip if it's a delivery/read/echo
      if (msg.message?.is_echo || msg.delivery || msg.read) continue;

      const senderId = msg.sender?.id;
      const text = msg.message?.text?.trim();
      if (!senderId || !text) continue;

      console.log(`[webhook] MSG from ${senderId}: "${text.slice(0, 80)}"`);

      // Extract referral ad ID
      const referralRef = msg.referral?.ref || msg.message?.referral?.ref || null;

      await handleMessage(senderId, text, referralRef)
        .catch((err) => console.error(`[webhook] handleMessage error for ${senderId}:`, err));
    }
  }

  // Return 200 immediately — Meta expects fast response
  return new Response("OK", { status: 200 });
}

// Bellek içi dedup map (Redis yoksa da çalışsın diye)
const dedupMap = new Map();

/** Main message handler — her turda müşteriye SADECE TEK yanıt gönderir */
async function handleMessage(senderId, text, referralRef) {
  // Load products
  const { default: products } = await import("../data/products.json", { with: { type: "json" } });

  // Dedup — Meta bazen aynı webhook'u tekrar gönderir; 30 sn içindeki aynı mesaj yanıtlanmaz
  const now = Date.now();
  const dedupKey = `${senderId}:${text}`;
  const lastAt = dedupMap.get(dedupKey);
  if (lastAt && now - lastAt < 30000) {
    console.log(`[webhook] duplicate message from ${senderId}, skipping (in-memory dedup)`);
    return;
  }
  dedupMap.set(dedupKey, now);
  // eski kayıtları temizle (1 saatten eski)
  for (const [k, v] of dedupMap) { if (now - v > 3600000) dedupMap.delete(k); }

  // Get user state (savunmacı: state null dönerse varsayılana düş)
  const state = (await getUserState(senderId)) || { lastAdCode: null, history: [] };
  state.lastMsg = text;
  state.lastAt = now;

  let lastAdCode = state.lastAdCode || null;
  let history = state.history || [];

  // If referral comes with this message, update lastAdCode
  let currentProductCode = state.currentProductCode || null;
  let pendingBrand = state.pendingBrand || null;
  if (referralRef && products[referralRef]) {
    lastAdCode = referralRef;
    currentProductCode = referralRef; // yeni reklam = yeni ürün bağlamı
    pendingBrand = null;
    history = []; // new product → fresh context (ad click)
  }

  // 1) Ürün bağlamı: metinde adı geçen ürün > önceki turun ürünü > reklam ürünü
  const { product: textProduct, ambiguous } = resolveProduct(text, { pendingBrand });
  const contextProduct = findProduct(currentProductCode || lastAdCode);

  // "rosita" tek başına belirsiz ama oturumda zaten o markanın bir ürünü konuşuluyor → boşuna sorma;
  // markasız devam sorusu ("fiyatı ne kadar") gibi muamele görür, bağlam ürünü kullanılır.
  const askBrand = ambiguous && contextProduct?.brand !== ambiguous.brand;

  if (askBrand) {
    // 2) Gerçekten belirsiz → hangisini kastediyorsun, netleştir
    const q = getAmbiguityQuestion(ambiguous);
    pendingBrand = ambiguous.brand;
    await sendMessage(senderId, q);
    await saveState(senderId, state, lastAdCode, history, text, q, { currentProductCode, pendingBrand });
    return;
  }
  pendingBrand = null;

  const product = textProduct || contextProduct;
  if (textProduct) currentProductCode = textProduct.adCode;

  // 3) Detect intent + rule-based answer
  let intent = detectIntent(text);
  // "modelini beğendim" tipi mesajlar ölçü sorusu SAYILMAZ → ürün kartına düşsün
  if (textProduct && intent === "dimensions" && !/ölç|boyut|ebat|cm\b|santim|geniş/i.test(text)) {
    intent = "other";
  }
  let answer = getAnswer(intent, product, text);

  // 4) "other": metinde ürün geçiyorsa kısa ürün kartı (eski davranış: direkt WhatsApp'a kaçış)
  if (!answer && intent === "other" && textProduct) answer = getProductCard(textProduct);

  if (answer) {
    await sendMessage(senderId, answer);
    await saveState(senderId, state, lastAdCode, history, text, answer, { currentProductCode, pendingBrand });
    if (intent === "liveAgent") {
      await notifyAgent("Müşteri temsilci istedi", senderId, text, product?.adName);
    }
    return;
  }

  // 5) Kural/ürün kartı eşleşmedi → AI (tek yanıt)
  const aiReply = await askAI(text, product, history);
  const reply = aiReply || getWhatsAppRedirect(); // AI başarısızsa tek WhatsApp yönlendirmesi
  await sendMessage(senderId, reply);
  await saveState(senderId, state, lastAdCode, history, text, reply, { currentProductCode, pendingBrand });

  if (!aiReply) {
    await notifyAgent("Müşteri (AI başarısız, fallback)", senderId, text, product?.adName);
  } else if (/temsilci|yönlendir|whatsapp/i.test(aiReply)) {
    await notifyAgent("Alan dışı soru → temsilciye aktarıldı", senderId, text, product?.adName);
  }
}

/** Konuşma durumunu kaydet (geçmiş + ürün bağlamı tek seferde) */
async function saveState(senderId, state, lastAdCode, history, userText, assistantText, extra = {}) {
  await setUserState(senderId, {
    lastAdCode,
    // metinden çözülen ürün bağlamı + belirsiz marka (sonraki turda "fiyatı ne kadar" doğru ürüne gitsin)
    currentProductCode: extra.currentProductCode ?? state.currentProductCode ?? null,
    pendingBrand: extra.pendingBrand ?? null,
    history: [
      ...history.slice(-6),
      { role: "user", content: userText },
      { role: "assistant", content: assistantText },
    ],
    // dedup alanlarını koru
    lastMsg: state.lastMsg,
    lastAt: state.lastAt,
  });
}
