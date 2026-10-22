# SOLOFIN

Freelancer, yazılımcı, tasarımcı, danışman, içerik üreticisi ve şahıs işletmesi sahipleri için
kişisel finans ve **karar destek** sistemi.

SOLOFIN yatırım veya vergi kararı vermez. Hesaplamaları, varsayımları ve belirsizlikleri açıkça gösterir.
Tüm aritmetik deterministik fonksiyonlarla (`src/lib/finance`) yapılır.

> Bu dizin, `isg-panel` deposunun içinde bağımsız bir paket olarak yer alır; depodaki İSG paneli ile ilgisi yoktur.

## Hızlı başlangıç

```bash
cd solofin
npm install
npm run dev          # http://localhost:3000
```

Üretim derlemesi:

```bash
npm run build
npm run start        # http://localhost:3000
```

Hiçbir ortam değişkeni gerekmez. Uygulama ilk açılışta **demo modunda** kurgusal verilerle açılır.
Ayarlar → Veri modu → **Kendi verim** ile boş, yalnızca bu tarayıcıda saklanan bir alana geçebilirsin.
Demo ve kendi verin ayrı depolama anahtarlarında tutulur; birbirine karışmaz.

## Komutlar

| Komut | Açıklama |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Üretim derlemesi (tip kontrolü dahil) |
| `npm run lint` | ESLint (uyarı toleransı 0) |
| `npm run typecheck` | TypeScript |
| `npm test` | Vitest birim/bileşen testleri |
| `npm run test:e2e` | Playwright (önce `npm run build`; masaüstü + mobil) |

## Sayfalar

- **Ana Sayfa**: bugün güvenle kullanılabilecek tutar (ve hesaplama dökümü), vergi rezervi, aylık gelir/gider,
  önceki döneme göre değişim, 30 günlük bakiye grafiği, yıl sonu net kazanç tahmini, öncelikli 3 uyarı,
  yaklaşan ödemeler, son işlemler.
- **Gelir / Gider**: ekleme, düzenleme, silme; arama, filtre (tür, kategori, durum, vergisel durum, tarih), sıralama;
  CSV içe/dışa aktarma (satır bazlı hata raporu).
- **Senaryolar**: ekipman alımı, fiyat değişimi, gelir kaybı, yeni müşteri, tahsilat gecikmesi, gider artışı,
  ek emeklilik birikimi. Yan yana karşılaştırma, nakit grafiği, varsayımlar ve belirsizlikler; kaydet/aç/sil.
- **Vergi**: gelir vergisi (artan oranlı), dilim dağılımı, stopaj ve geçici vergi mahsubu, KDV (ayrı hesap),
  geçici vergi dönemleri, "gider kabul edilirse" etkisi, kural kaynakları ve doğrulama durumu.
- **Nakit Akışı**: 90 günlük bakiye (tahsilat gecikmesi seçenekli), dayanma süresi tablosu, acil durum fonu,
  yıl sonuna kadar aylık projeksiyon, tekrarlayan kalemler yönetimi.
- **Emeklilik**: temkinli / orta / yüksek varsayımsal reel getiri; nominal ve enflasyondan arındırılmış tutarlar ayrı.
- **Raporlar**: aylık özet, döküm, vergi özeti, senaryo karşılaştırması, yıl sonu tahmini; CSV ve yazdırılabilir PDF
  (tarayıcının "PDF olarak kaydet" özelliği). Veri kaynağı (demo / kullanıcı) raporda belirtilir.
- **Ayarlar**: veri modu, banka bakiyesi, kişisel harcama, güvenlik payı, vergi yılı ve mükellefiyet türü, tema,
  bildirim tercihleri, JSON/CSV dışa aktarma, verileri kalıcı silme.

## Mimari

```
src/lib/finance   Saf hesaplama motoru (UI'dan bağımsız, birim testli)
src/lib/data      Zod şemaları, demo verisi, kullanıcıya bağlı depo (Repository), React store
src/components    Erişilebilir UI bileşenleri, grafikler, kabuk
src/app           Next.js App Router sayfaları
supabase/         PostgreSQL şeması + Row Level Security
docs/             Plan, durum raporu, vergi sınırlamaları
```

Önemli ilkeler: para birimleri kuruş tamsayısı; vergi kuralları sürümlü ve kaynaklı; KDV, stopaj, geçici vergi
gelir vergisinden ayrı modellenir; senaryolar girdiyi kopyalar ve değiştirmez.

## Ortam değişkenleri

`.env.example` dosyasına bakın. Hepsi opsiyoneldir. `SUPABASE_SERVICE_ROLE_KEY` ve AI anahtarları yalnızca
sunucu tarafında kullanılmalıdır; istemci koduna asla eklenmez.

## Uyarı

Vergi hesapları **demo tahminidir** (bkz. `docs/TAX_RULES_LIMITATIONS.md`). Genel bilgilendirme amaçlıdır;
vergi veya yatırım tavsiyesi değildir. Kesin durum için mali müşavirinize danışın.
