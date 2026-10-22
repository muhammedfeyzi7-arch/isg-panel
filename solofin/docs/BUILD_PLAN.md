# SOLOFIN — Build Plan

## Güncelleme — mobil uygulama (2026-10-22)

Kullanıcı ürünün **mobil uygulama** olması gerektiğini belirtti (ilk talimatta "ilk aşamada web, native
uygulama oluşturma" yazıyordu). Karar:

- **Expo SDK 58 (React Native 0.88, expo-router)** ile iOS + Android uygulaması: `apps/mobile`.
  Expo Go'nun desteklediği güncel SDK seçildi; EAS ile mağaza derlemesi yapılabilir.
- Hesaplama motoru `packages/core`'a ayrıldı; web (`apps/web`) ve mobil aynı motoru kullanır.
- Mobil veriler AsyncStorage'da (cihazda) tutulur; web localStorage kullanır. Demo/kullanıcı verisi ayrı.
- Tasarım, kullanıcının paylaştığı ekran görüntülerini izler: koyu lacivert ana ekran, açık diğer ekranlar,
  5 sekme (Ana Sayfa, Gelir/Gider, Simülasyon, Belgeler, Profil).
- Belge tarama: kamera/galeri + elle alan girişi. OCR yok (açıkça belirtilir).

## Ortam tespiti (FAZ 1)
- Repo (`isg-panel`) mevcut bir Vite/React İSG paneli içeriyor. SOLOFIN onunla **ilgisiz** olduğu için
  mevcut dosyalara dokunulmadı; uygulama bağımsız bir paket olarak `solofin/` dizininde kuruldu.
- Node 22, npm 10, Linux. Chromium `/opt/pw-browsers` altında hazır (Playwright 1.56 ile uyumlu).
- Supabase yapılandırması yok → uygulama **yerel demo modu** ile çalışır; canlı mod için şema/RLS
  migration'ları ve `.env.example` hazırlanır.

## Mimari
```
src/
  app/                 Next.js App Router sayfaları (yalnızca sunum)
  components/ui        Erişilebilir temel bileşenler (Button, Card, Dialog, Field, Tabs, Switch...)
  components/layout    Kenar çubuğu, mobil alt gezinme, sayfa başlığı, demo bandı
  components/charts    Recharts sarmalayıcıları (veriyi hesaplama motorundan alır)
  lib/finance          SAF, deterministik hesaplama motoru (UI'dan bağımsız, birim testli)
    money.ts           Kuruş tabanlı tamsayı para aritmetiği ve biçimlendirme
    tax/               Vergi kural sürümleri + motor (gelir vergisi, KDV, stopaj, geçici vergi ayrı)
    summary.ts         Dönem özetleri, gelir/gider kırılımı
    safeToSpend.ts     "Bugün güvenle kullanabileceğin tutar"
    cashflow.ts        Nakit akışı projeksiyonu, dayanma süresi
    scenarios.ts       What-if senaryo motoru (girdiyi kopyalar, mutasyon yok)
    retirement.ts      Emeklilik projeksiyonu (nominal + reel)
    csv.ts             CSV içe/dışa aktarma + doğrulama
  lib/data             Zod şemaları, demo veri üreticisi, depo (repository) katmanı, React store
supabase/migrations    PostgreSQL şeması + Row Level Security
tests/unit             Vitest
tests/e2e              Playwright
```

## İlkeler
- Para birimleri **kuruş (integer)** olarak saklanır; kayan nokta hatası yok.
- Hesaplamalar saf fonksiyonlardır; senaryolar girdinin kopyası üzerinde çalışır.
- Vergi kuralları sürümlüdür; her kuralda kaynak, yürürlük ve son doğrulama tarihi bulunur.
  Resmî doğrulama yapılmamış kurallar UI'da **"Demo tahmini"** olarak işaretlenir.
- Gelir vergisi, KDV, stopaj ve geçici vergi ayrı modellenir.
- Demo verisi `demo` kaynağıyla etiketlenir, gerçek veriyle karıştırılmaz.
- Yapay zekâ katmanı opsiyonel; aritmetik daima motor tarafından yapılır.

## Fazlar
1. İnceleme, mimari, tasarım sistemi, iskelet
2. Dashboard, gezinme, mobil uyum, demo veri
3. Gelir-gider CRUD, veri modeli, CSV
4. Hesaplama motoru + What-if
5. Vergi simülatörü + kural sürümleme + sınırlamalar dokümanı
6. Nakit akışı, emeklilik, raporlar
7. Kimlik doğrulama yapısı, güvenlik (RLS), testler
8. Son build/lint/test, README, durum raporu

## Varsayımlar
- Varsayılan vergi yılı 2026, ülke Türkiye, mükellefiyet: serbest meslek (gerçek usul).
- "Bugün" referansı istemcinin sistem tarihidir; demo verisi bugüne göre üretilir.
- Banka bakiyesi kullanıcı tarafından girilir (banka entegrasyonu yok).
