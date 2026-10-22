# SOLOFIN — Build Status

Son güncelleme: 2026-10-22

## Doğrulama sonuçları (bu ortamda gerçekten çalıştırıldı)

| Komut | Sonuç |
|---|---|
| `npm run lint` | ✅ 0 hata, 0 uyarı |
| `npm run typecheck` | ✅ hata yok |
| `npm test` (Vitest) | ✅ 6 dosya, **69/69 test** geçti |
| `npm run build` (Next.js 15.5.6) | ✅ 8 sayfa statik olarak derlendi |
| `npm run test:e2e` (Playwright 1.56, Chromium) | ✅ **16/16** (8 senaryo × masaüstü 1440px + mobil Pixel 7) |
| Görsel kontrol | ✅ Tüm sayfalar masaüstü/açık ve mobil/koyu temada ekran görüntüsüyle incelendi; yatay taşma ve konsol hatası yok |

## Tamamlanan özellikler

### Faz 1–2: Mimari, tasarım sistemi, dashboard
- [x] Bağımsız `solofin/` paketi (mevcut İSG paneline dokunulmadı)
- [x] Tasarım token'ları (CSS değişkenleri), açık/koyu/sistem teması, ilk boyamada tema (yanıp sönme yok)
- [x] Inter (latin-ext — Türkçe karakterler), tabular rakamlar
- [x] Masaüstü kenar çubuğu + mobil alt gezinme + "Daha fazla" menüsü, "İçeriğe geç" bağlantısı
- [x] Dashboard: güvenle kullanılabilir tutar + döküm + "Nasıl hesaplandı?", vergi rezervi (gelir vergisi/KDV ayrı),
      aylık gelir/gider ve önceki döneme göre değişim, 30 günlük bakiye, yıl sonu net kazanç, öncelikli 3 uyarı,
      yaklaşan ödemeler, son işlemler
- [x] Deterministik demo verisi (tohumlu üreteç), demo/yerel mod ayrımı, her sayfada demo uyarısı

### Faz 3: Gelir-gider
- [x] Ekle / düzenle / sil (doğrulamalı form, onaylı silme)
- [x] Arama, tür/kategori/durum/vergisel durum/tarih filtreleri, sıralama, sayfalama
- [x] CSV içe aktarma (`;`/`,` ayırıcı, tırnaklı alan, TR sayı biçimi, satır bazlı hata raporu, 2 MB sınırı)
- [x] CSV dışa aktarma (UTF-8 BOM, formül enjeksiyonu koruması)
- [x] Vergisel sınıflandırma kategoriden ayrı (`unknown / assumed / confirmed / non_deductible`)
- [x] Tekrarlayan işlem veri modeli + yönetim arayüzü (Nakit Akışı sayfasında); çift sayım koruması

### Faz 4: Hesaplama motoru ve What-if
- [x] Kuruş tabanlı tamsayı aritmetiği
- [x] Senaryo motoru: ekipman (doğrudan gider / amortisman), fiyat değişimi, gelir kaybı, yeni müşteri,
      tahsilat gecikmesi (kesirli ay kayması), gider artışı, ek emeklilik birikimi
- [x] Yan yana karşılaştırma, nakit grafiği, varsayımlar ve belirsizlikler; kaydet / aç / güncelle / sil
- [x] Girdinin değişmediği ve farkların tutarlı olduğu testlerle doğrulandı

### Faz 5: Vergi
- [x] Sürümlü kural setleri (TR 2025, TR 2026); her kuralda kaynak, yürürlük, son doğrulama, doğrulama düzeyi
- [x] Artan oranlı gelir vergisi (dilim bazlı), stopaj ve geçici vergi mahsubu, KDV ayrı hesap, geçici vergi dönemleri
- [x] Genç girişimci istisnası, Bağ-Kur indirimi (ayarlanabilir varsayımlar), amortisman
- [x] Tahsil esası (serbest meslek) / tahakkuk esası (ticari) ayrımı
- [x] "Gider kabul edilirse" aracı — vergi farkı ile birlikte net maliyeti gösterir (harcamaya teşvik etmez)
- [x] Tüm sonuçlar "Demo tahmini" etiketli; `docs/TAX_RULES_LIMITATIONS.md`

### Faz 6: Nakit akışı, emeklilik, raporlar
- [x] 90 günlük bakiye, tahsilat gecikmesi seçenekleri, KDV ve geçici vergi ödeme tahminleri
- [x] Dayanma süresi (%0/30/50/100 gelir düşüşü), acil durum fonu kapsamı, yıl sonuna kadar aylık projeksiyon
- [x] Emeklilik: 3 varsayımsal getiri profili, nominal ve reel ayrı, gereken aylık katkı, açık
- [x] Raporlar: aylık özet, döküm, vergi özeti, senaryo karşılaştırması, yıl sonu tahmini, CSV, yazdırılabilir PDF,
      veri kaynağı etiketi

### Faz 7: Güvenlik ve veri
- [x] Supabase migration: 11 tablo (profiles, income/expense_transactions, tax_profiles, tax_rule_versions,
      scenarios, scenario_results, financial_goals, recurring_items, documents, app_settings), tüm tablolarda RLS,
      `auth.uid()` sahiplik politikaları, vergi kuralları istemciden yazılamaz
- [x] Kullanıcıya bağlı `Repository` katmanı (yerel RLS karşılığı) + izolasyon testleri
- [x] Zod ile tüm girdi doğrulaması; bozuk localStorage verisi temizlenerek yüklenir
- [x] Güvenlik başlıkları (nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy)
- [x] Kaynak kodda gizli anahtar olmadığını kontrol eden test; `.env.example`
- [x] Ayarlar: JSON/CSV dışa aktarma, "SİL" onaylı kalıcı veri silme

## Henüz çalışmayan veya doğrulanmamış

| Konu | Durum |
|---|---|
| **Vergi kuralları** | Resmî kaynakla birebir doğrulanmadı. 2026 tarifesi ikincil kaynaklardan; diğerleri doğrulanmamış veya türetilmiş. |
| **Supabase canlı modu** | Şema + RLS hazır, ancak istemci adaptörü (`@supabase/supabase-js`) ve giriş ekranı **uygulanmadı**. Env tanımlansa bile veriler yerelde kalır (Ayarlar'da açıkça belirtiliyor). |
| **RLS izolasyon testi (canlı DB)** | Yapılmadı (canlı Supabase yok). Yerine: depo katmanı izolasyon testleri + migration statik analizi. |
| **Kimlik doğrulama** | Yok. Yerel mod tek kullanıcılı ve tek tarayıcılık. |
| **Yapay zekâ katmanı** | Uygulanmadı; yalnızca durum göstergesi ve env yapısı var. Uygulama AI olmadan tam çalışır. |
| **Belge tarama / OCR** | Uygulanmadı (`documents` tablosu ve `documentRef` alanı hazır). |
| **Bildirim gönderimi** | Tercihler kaydedilir; e-posta/push gönderimi yok. |
| **Çoklu para birimi** | İşlemler para birimiyle saklanır, ancak hesaplar TL varsayar; kur çevrimi yok. |
| **Dil** | Yalnızca Türkçe; metinler henüz i18n sözlüğüne taşınmadı (Ayarlar'da dil alanı hazır). |
| **PDF** | Tarayıcının yazdır → "PDF olarak kaydet" özelliğine dayanır; sunucu tarafı PDF üretimi yok. |

## Sonraki adımlar

1. Vergi kurallarını Resmî Gazete / GİB metinleriyle doğrulamak; `verification: "official"` işaretlemek.
2. Supabase adaptörü: `Repository` arayüzünü uygulayan `SupabaseRepository`, Auth (e-posta magic link),
   iki test kullanıcısıyla canlı RLS izolasyon testi (Supabase CLI + yerel Postgres).
3. Zarar mahsubu, yıllık beyan/ödeme takvimi, döviz çevrimi.
4. Sunucu tarafı AI uç noktası: motor çıktısını açıklama ve doğal dil → senaryo kaldıraçları (yapılandırılmış çıktı).
5. Belge yükleme + OCR ile alan çıkarımı (kullanıcı onaylı).
6. i18n sözlüğü ve ikinci dil.
