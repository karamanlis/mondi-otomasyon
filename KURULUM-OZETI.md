# Mondi Home Otomasyon — Kurulum Özeti ve Günlüğü

**Tarih:** 30 Eylül 2026
**Proje:** NOVA MONDİ HOME (mobilya mağazası) — Meta reklamlarından gelen Messenger/Instagram DM mesajlarını 7/24 otomatik yanıtlayan AI ajan sistemi
**Durum:** 🟢 **CANLI** — uçtan uca pipeline çalışıyor, App Review bekliyor

---

## 1. Amaç ve Mimari Kararlar

Meta Business Manager reklamlarından gelen mesajlar; Excel'deki ürün tablosuna (reklam kodu → fiyat/ölçü/ödeme/adres) göre yanıtlanır. Bilinmeyen sorular canlı temsilciye yönlendirilir.

| Karar | Seçim | Gerekçe |
|---|---|---|
| AI motoru | **Hibrit** (kural tabanlı + Deepseek) | Bilinen sorular ücretsiz yanıtlanır; sadece doğal dil soruları LLM'e gider |
| Barındırma | **Vercel ücretsiz plan** | 7/24 HTTPS webhook, sunucu yönetimi yok |
| Temsilci bildirimi | **Telegram botu** | Anında bildirim, tamamen ücretsiz |
| Durum saklama | **Upstash Redis** (Vercel Marketplace, ücretsiz) | Serverless'ta konuşma hafızası |
| LLM sağlayıcı | **OpenRouter → deepseek/deepseek-v4-flash** | Çok düşük maliyet, mevcut anahtar |

## 2. Proje Yapısı

```
C:\Users\MOROFİS\minimax-workspace\mondi-otomasyon\
├── api/
│   ├── env.js          # Ortam değişkenleri
│   └── webhook.js      # GET (hub.challenge) + POST (mesaj akışı)
├── data/
│   └── products.json   # Excel'den üretilen 9 ürünlük tablo
├── lib/
│   ├── ai.js           # OpenRouter Deepseek çağrısı + sistem promptu
│   ├── answers.js      # Türkçe intent eşleştirme + yanıt şablonları
│   ├── meta.js         # Graph API gönderim + HMAC imza doğrulama
│   ├── state.js        # Upstash Redis REST (KV_* değişkenleri)
│   └── telegram.js     # Temsilci bildirimi
├── scripts/
│   ├── build-products.mjs  # Excel → products.json
│   └── test-dryrun.mjs    # Lokal dry-run testi
├── KURULUM-OZETI.md   # Bu dosya
├── README.md          # Kurulum rehberi
├── .env.example
├── package.json
└── vercel.json
```

## 3. Yapılan Adımlar (Sırayla)

### A) Kod tarafı
1. Plan onaylandı (hibrit AI + Vercel + Telegram + minimax-workspace konumu)
2. Excel (`Nova-Mondi-Home-şehirdışı-Reklamlar-...xlsx`) okundu → `scripts/build-products.mjs` ile `data/products.json`'a dönüştürüldü (9 ürün)
3. Tüm modüller yazıldı: webhook, meta, answers, ai, state, telegram
4. Lokal dry-run testleri geçti:
   - `fiyatı ne kadar?` + reklam kodu `52559403956656` → "Perissa koltuk: 89950 TL, 9 ay taksit" ✓
   - `pantolon var mı?` → karşılama + AI yanıtı ✓
5. Tespit edilen bug: Upstash REST boş anahtarda `{"result":null}` döndüğünde `getUserState` null döndürüyordu → `lib/state.js` + savunmacı fallback `api/webhook.js`'de düzeltildi
6. Üretim deploy'ları: 3 kez (`READY` her seferinde)

### B) Vercel kurulumu
1. `vercel login` (OAuth cihaz akışı) ✓
2. Proje oluşturuldu: `cenkemre/mondi-otomasyon`
3. **Üretim URL:** https://mondi-otomasyon.vercel.app
4. Webhook adresi: `https://mondi-otomasyon.vercel.app/api/webhook`
5. Tüm env değişkenleri 3 ortama (Production/Preview/Development) eklendi
6. Upstash Redis Vercel Marketplace'ten oluşturuldu → `KV_REST_API_URL` / `KV_REST_API_TOKEN` otomatik bağlandı; `lib/state.js` bu adları kullanacak şekilde güncellendi
7. `DRY_RUN=false` (production/preview), `true` (development)

**Env değişkenleri (hepsi Vercel'de kayıtlı, secret değerler dosyaya yazılmaz):**

| Değişken | Not |
|---|---|
| `META_APP_SECRET` | Meta app secret (secret olarak saklanıyor) |
| `META_PAGE_ACCESS_TOKEN` | Uzun ömürlü sayfa token'ı (secret) |
| `META_VERIFY_TOKEN` | `mondi_secret_2026` |
| `META_PAGE_ID` | `445371545321023` (NOVA MONDİ HOME) |
| `OPENROUTER_API_KEY` | OpenRouter anahtarı (secret) |
| `TELEGRAM_BOT_TOKEN` | @nova79_bot token'ı (secret) |
| `TELEGRAM_CHAT_ID` | `1543631133` (Emre Cenk) |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Upstash (Vercel otomatik) |
| `DRY_RUN` | production: false |

### C) Meta kurulumu
1. Meta Developer Business app oluşturuldu — **App ID:** `2263259087568024`
2. Graph API Explorer'dan user token üretildi (izinler: `pages_show_list`, `business_management`, `pages_messaging`, `pages_manage_metadata`)
3. Kısa token → 60 günlük uzun ömürlü token'a çevrildi (`fb_exchange_token` ile)
4. `/me/accounts` ile sayfalardan **NOVA MONDİ HOME** seçildi → uzun ömürlü Page Token alındı
5. Eski (süresi dolmuş) token Vercel'den silinip yenisi yazıldı
6. App seviyesinde webhook aboneliği kaydedildi:
   `POST /2263259087568024/subscriptions` → object=page, fields=`messages,messaging_referrals`, callback=`https://mondi-otomasyon.vercel.app/api/webhook`, verify_token=`mondi_secret_2026` → **success:true**
7. Sayfa app'e abone edildi:
   `POST /445371545321023/subscribed_apps?subscribed_fields=messages,messaging_referrals` → **success:true**

### D) Telegram kurulumu
1. @BotFather ile **@nova79_bot** oluşturuldu
2. `getUpdates` ile chat ID alındı: `1543631133`
3. Test mesajı telefona ulaştı ✓

## 4. Canlı Testler

| Test | Sonuç |
|---|---|
| `GET` webhook doğrulama (doğru token) | ✅ challenge döndü, HTTP 200 |
| `GET` webhook (yanlış token) | ✅ 403 (beklenen) |
| İmzalı POST (HMAC-sha256, gerçek app secret ile) | ✅ imza geçti, mesaj işlendi |
| Reklam eşleştirme + fiyat yanıtı + Graph API gönderimi | ✅ gönderime kadar geldi (sahte PSID hatası normal) |
| Telegram bildirimi | ✅ telefona ulaştı |

## 5. Maliyet

| Kalem | Maliyet |
|---|---|
| Vercel Hobby | 0 ₺ |
| Upstash Redis (Free) | 0 ₺ |
| Telegram | 0 ₺ |
| Meta Developer app | 0 ₺ |
| Deepseek (OpenRouter) | ~1-5 ₺/AY (düşük trafik) |
| **Toplam** | **~1-5 ₺/ay** |

## 6. Kalan Adımlar ⚠️

1. **App Review (EN KRİTİK):** Meta Developer → App Review → `pages_messaging` için **Advanced Access** başvurusu. Onaylanana kadar bot **sadece app admin/developer/tester** hesaplara yanıt verir (Development Mode kısıtı) — yani normal müşteriler yanıt almaz. Onay genelde 1-3 gün.
2. **Instagram DM:** IG hesabı profesyonel olmalı + NOVA MONDİ HOME sayfasına bağlanmalı; `instagram_manage_messages` izni App Review'ya eklenmeli.
3. **Gerçek kullanıcı testi:** Sayfaya Messenger'dan "merhaba" ve "temsilciyle konuşabilir miyim" atıp yanıtları + Telegram bildirimini doğrulamak.
4. **Reklam → ref eşleştirme kontrolü:** İlk gerçek reklam mesajlarında webhook `referral.ref` değerinin Excel'deki Reklam Kodu ile eşleşip eşleşmediği loglardan doğrulanmalı (eşleşmezse haritalama düzeltilecek: `data/products.json` anahtarları).
5. **Token yenileme takvimi:** Uzun ömürlü user token ~60 günde bir; Page Token süresizdir ama şifre değişimi/izin iptali olursa yenilenmeli.
6. (Opsiyonel) `README.md`'deki telefon/mesai bilgileri `lib/answers.js` içindeki `[telefon numarası]` / `[saatler]` yer tutucularına yazılmalı.

## 7. Faydalı Komutlar

```bash
# Yeniden deploy
vercel deploy --prod --yes

# Logları izle (canlı test sırasında)
vercel logs https://mondi-otomasyon.vercel.app

# Env değişkenlerini listele
vercel env ls

# Excel güncellenirse ürün tablosunu yenile
node scripts/build-products.mjs

# Lokal dry-run testi
node scripts/test-dryrun.mjs
```

## 8. Webhook Akışı (Tekrarlayan Referans)

```
Müşteri (reklam → DM)
  → Meta webhook POST https://mondi-otomasyon.vercel.app/api/webhook
  → HMAC imza kontrolü (META_APP_SECRET)
  → referral.ref → Excel eşleşmesi → Redis'e "son reklam" olarak kaydet
  → Intent: fiyat/ödeme/ölçü/adres/temsilci?
      ├─ Evet → hazır yanıt (0 maliyet)
      ├─ Hayır → Deepseek AI (OpenRouter)
      └─ Temsilci gerekli → müşteriye yönlendirme mesajı + Telegram bildirimi
  → Graph API POST /me/messages ile yanıt gönderilir
```