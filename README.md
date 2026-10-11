# Mondi Home — Messenger & Instagram DM AI Otomatik Yanıtlama Sistemi 🛋️

Meta Business Manager reklamlarından gelen **Messenger ve Instagram DM** mesajlarını 7/24 otomatik yanıtlayan, hibrit (kural tabanlı + Deepseek AI) yapay zeka ajanı.

> 📌 **Kurulum tamamlandı ve sistem canlı.** Yapılan her şeyin adım adım kaydı için → [`KURULUM-OZETI.md`](KURULUM-OZETI.md)
> Üretim URL: https://mondi-otomasyon.vercel.app · Kalan tek büyük adım: Meta **App Review** (kullanıcılara açılmak için)

## Özellikler

- ✅ Excel'deki ürün verisine göre **fiyat, ödeme, ölçü, adres** sorularını anında yanıtlar
- ✅ Müşterinin yazdığı **ürün adını metinden tanır** ("rosita koltuk" = "Rosita koltuk takımı"); reklam bağlamından bağımsız doğru ürünü cevaplar, belirsiz isimde netleştirme sorar (`lib/catalog.js`)
- ✅ **İş kuralı:** Konsept ürünler (adında "konsept" geçen — Rosita/Olivia Konsept) hakkında hiçbir soruyu bot cevaplamaz; fiyat/içerik gösterilmez, doğrudan **canlı temsilciye** yönlendirir + Telegram bildirimi gider (istisna: selamlama)
- ✅ Fiyat listesi ve AI prompt'u **tek kaynaktan** (products.json) üretilir — veri/cevap uyumsuzluğu oluşmaz
- ✅ Bilinmeyen soruları **Deepseek AI** (OpenRouter) ile anlayıp yanıtlar
- ✅ Fiyatı "canlı temsilci" olan ürünler için otomatik yönlendirme
- ✅ Canlı temsilci taleplerini **Telegram**'a bildirir
- ✅ Müşteriye bağlı son reklam/ürün bilgisini **Upstash Redis**'te tutar (ücretsiz)
- ✅ **Vercel** üzerinde çalışır — ücretsiz plan yeterli

## Mimari

```
Reklam → Messenger/IG DM → Meta Webhook → Vercel /api/webhook
                              ├─ 1. Ürün bağlamı: metinde anılan ürün (lib/catalog.js)
                              │    > önceki turun ürünü > reklam kodu
                              │    Belirsiz marka ("rosita") → "hangisi?" netleştirme sorusu
                              ├─ 2. Kural tabanlı yanıt (fiyat/ödeme/ölçü/adres/temsilci)
                              ├─ 3. Eşleşmezse → OpenRouter Deepseek AI
                              │    (fiyat listesi + konsept içerikleri products.json'dan üretilir)
                              ├─ 4. Temsilci gerekli → Telegram bildirimi
                              └─ 5. Graph API ile yanıt gönder
```

**Testler:** `node scripts/test-product-matching.mjs` (ürün tanıma matrisi) · `DRY_RUN=true node scripts/test-dryrun.mjs` · `DRY_RUN=true node scripts/test-extra.mjs`

## Kurulum

### 1. Gereksinimler

- Node.js 20+
- Vercel hesabı (ücretsiz — https://vercel.com/signup)
- Meta Developer hesabı (https://developers.facebook.com)
- Telegram bot token (https://t.me/BotFather)
- OpenRouter API anahtarı (https://openrouter.ai/keys)

### 2. Projeyi hazırla

```bash
cd C:\Users\MOROFİS\minimax-workspace\mondi-otomasyon
npm install
```

### 3. Ortam değişkenlerini ayarla

`.env.example` dosyasını kopyala, `.env` olarak kaydet ve doldur:

| Değişken | Nereden Alınır |
|---|---|
| `META_PAGE_ID` | Facebook Sayfası → Ayarlar → Sayfa Bilgisi |
| `META_PAGE_ACCESS_TOKEN` | Meta Developer → App → Tools → Graph API Explorer → Sayfayı seç → `pages_show_list` izni → Token'ı al → `{sayfa_id}\|{token}` |
| `META_APP_SECRET` | Meta Developer → App → Settings → Basic → App Secret |
| `META_VERIFY_TOKEN` | Kendin belirle (rastgele bir string) |
| `OPENROUTER_API_KEY` | OpenRouter hesabın → API Keys |
| `TELEGRAM_BOT_TOKEN` | @BotFather → `/newbot` → token al |
| `TELEGRAM_CHAT_ID` | Bot'a mesaj at → `https://api.telegram.org/bot{TOKEN}/getUpdates` → `chat.id` |
| `UPSTASH_REDIS_*` | Vercel Dashboard → Storage → Upstash Redis → Create (ücretsiz) |

### 4. Ürün verisini güncelle

```bash
node scripts/build-products.mjs
```

### 5. Lokal test

```bash
vercel dev          # http://localhost:3000 açılır
```

**Webhook doğrulama:** Tarayıcıdan şu URL'i aç:
```
http://localhost:3000/api/webhook?hub.mode=subscribe&hub.verify_token=my_verify_token_123&hub.challenge=ok_test
```
Cevap: `ok_test` ✅

**Mesaj testi (dry-run):** Şu komutu çalıştır:
```bash
curl -X POST http://localhost:3000/api/webhook ^
  -H "Content-Type: application/json" ^
  -d "{\"entry\":[{\"messaging\":[{\"sender\":{\"id\":\"test_user\"},\"message\":{\"text\":\"fiyat nedir?\"}}]}]}"
```
Log'da "[dry-run] To test_user: ..." yazısını görmelisin ✅

### 6. Vercel'e deploy

```bash
vercel --prod
```

Çıktıdaki Production URL'i not al: `https://mondi-otomasyon-xxx.vercel.app`

### 7. Meta Webhook bağlantısı

1. **Meta Developer** → App → **Webhooks** ürünü
2. **Edit Subscription** → **Page** seç
3. Callback URL: `https://mondi-otomasyon-xxx.vercel.app/api/webhook`
4. Verify Token: `.env`'deki `META_VERIFY_TOKEN` değeri
5. Abone olunacak alanlar: `messages`, `messaging_referrals`
6. **Test** butonuna bas → webhook'a test mesajı gelir (log kontrol)
7. Aynı işlemi **Instagram** için de yap (alan: `messages`)

### 8. Canlı test

Facebook Sayfana  veya Instagram profiline bir test hesabından reklam linkiyle mesaj at → yanıt gelmeli + Telegram bildirimi doğru çalışıyor mu kontrol et.

## Excel'deki ürünler

| Ürün | Fiyat | Ödeme |
|---|---|---|
| Perissa Koltuk | 89.950 TL | 9 ay taksit |
| Olivia Konsept | Canlı temsilci | 9 ay taksit |
| Rosita Konsept | Canlı temsilci | 9 ay taksit |
| Yatak Baza | 28.500 TL | 9 ay taksit |
| Bahar Temizliği | Canlı temsilci | 9 ay taksit |
| Rosita Koltuk | Canlı temsilci | 9 ay taksit |
| Olivia Koltuk | Canlı temsilci | 9 ay taksit |
| Halı Kampanyası | Canlı temsilci | 9 ay taksit |
| Japandi Koltuk | 90.000 TL | 9 ay taksit |

## Maliyetler

| Kalem | Maliyet |
|---|---|
| Vercel ücretsiz plan | 0 TL |
| Upstash Redis (ücretsiz) | 0 TL |
| Telegram bot | 0 TL |
| Deepseek API (OpenRouter) | ~1-5 TL/ay (çok düşük yoğunluk) |
| Meta Developer | 0 TL (sadece app açma ücretsiz) |
| **Toplam** | **~1-5 TL/ay** |

## Geliştirme Notları

- `DRY_RUN=true` iken mesajlar Graph API'ye gönderilmez, log'a yazılır
- Webhook signature doğrulaması `META_APP_SECRET` boşken atlanır (lokal test)
- Upstash Redis bağlantısı yoksa in-memory fallback kullanılır (Vercel'de tutarlı değil; prod'ta Redis lazım)
- Reklam kodu eşleştirme için webhook `referral.ref` alanı kullanılır; hangi ID formatı geldiğini canlı testte görüp Excel'deki kodlarla eşleştireceğiz