# SOLOFIN

Freelancer, yazılımcı, tasarımcı, danışman, içerik üreticisi ve şahıs işletmesi sahipleri için
kişisel finans ve **karar destek** sistemi. Yatırım veya vergi kararı vermez; hesaplamaları,
varsayımları ve belirsizlikleri açıkça gösterir.

> Bu dizin `isg-panel` deposunun içinde bağımsız bir projedir; depodaki İSG paneliyle ilgisi yoktur.

## Yapı

```
solofin/
  apps/mobile     ← iOS + Android uygulaması (Expo SDK 58, React Native) — ana ürün
  apps/web        ← Web uygulaması (Next.js 15) — aynı motoru kullanır
  packages/core   ← Deterministik finans motoru + veri modeli (UI'dan bağımsız, testli)
  supabase/       ← PostgreSQL şeması + Row Level Security (canlı mod için hazır)
  docs/           ← Plan, durum raporu, vergi kuralı sınırlamaları
```

## Hızlı başlangıç — mobil

```bash
cd solofin/apps/mobile
npm install
npx expo start      # Telefonda Expo Go (SDK 58) ile QR kodu okut
```

Ayrıntılar: [`apps/mobile/README.md`](apps/mobile/README.md)

## Web

```bash
cd solofin/apps/web
npm install
npm run dev         # http://localhost:3000
```

## Motor testleri

```bash
cd solofin/packages/core
npm install
npm test
```

Her uygulama kendi klasöründe tek `npm install` ile çalışır; `@solofin/core` yerel `file:` bağımlılığıdır.

## Ortam değişkenleri

Hiçbiri zorunlu değil. Uygulama ilk açılışta **demo modunda** kurgusal verilerle açılır; Profil/Ayarlar'dan
**Kendi verim** moduna geçilebilir (ayrı depolama). Bkz. `apps/mobile/.env.example`, `apps/web/.env.example`.

## Uyarı

Vergi hesapları **demo tahminidir** (bkz. `docs/TAX_RULES_LIMITATIONS.md`). Genel bilgilendirme amaçlıdır;
vergi veya yatırım tavsiyesi değildir.
