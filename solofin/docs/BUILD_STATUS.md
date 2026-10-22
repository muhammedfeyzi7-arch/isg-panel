# SOLOFIN — Build Status

Son güncelleme: 2026-10-22

## Doğrulama sonuçları (bu ortamda gerçekten çalıştırıldı)

### Mobil — `apps/mobile` (Expo SDK 58, React Native 0.88)

| Komut | Sonuç |
|---|---|
| `npm run typecheck` | ✅ hata yok |
| `npm run lint` (eslint-config-expo) | ✅ 0 hata, 0 uyarı |
| `npm test` (Jest + expo-router testing-library, gerçek ekranlar) | ✅ **4/4** |
| `npm run export:web` + `npm run test:e2e` (Playwright, iPhone 14 + Pixel 7 görüntü alanı) | ✅ **12/12** (6 senaryo × 2 cihaz) |
| `npx expo export --platform ios --platform android` | ✅ iOS (2979 modül) ve Android (2995 modül) paketleri Hermes bytecode'a derlendi |
| `npx expo-doctor` | ⚠️ 18/20. Kalan 2 kontrol Expo sunucusuna (exp.host, React Native Directory) erişim gerektiriyor; bu ortamın ağ politikası bunu engelliyor. `expo config` yerel olarak sorunsuz yükleniyor. |
| Görsel kontrol | ✅ Tüm ekranlar 390×844 telefon görüntü alanında (açık + koyu tema) incelendi; yatay taşma ve konsol hatası yok |

**Bu ortamda yapılamayanlar:** gerçek iPhone/Android cihazda veya simülatörde çalıştırma (Xcode / Android SDK yok).
Kamera, sistem paylaşım sayfası (expo-sharing), PDF üretimi (expo-print) ve cihaz dosya sistemi yalnızca native
cihazda çalışır; bu yollar tip kontrolünden ve native paketlemeden geçti, ancak cihaz üzerinde **test edilmedi**.

### Motor — `packages/core`

| Komut | Sonuç |
|---|---|
| `npm run typecheck` | ✅ |
| `npm test` (Vitest) | ✅ **71/71** |

### Web — `apps/web` (Next.js 15.5)

| Komut | Sonuç |
|---|---|
| lint / typecheck | ✅ |
| Vitest | ✅ 3/3 |
| `next build` | ✅ |
| Playwright (masaüstü + mobil) | ✅ 16/16 |

## Tamamlanan özellikler

### Mobil uygulama
- [x] 5 sekme (Ana Sayfa, Gelir/Gider, Simülasyon, Belgeler, Profil) + yığın ekranları (işlem formu, senaryo,
      fatura, nakit akışı, emeklilik, raporlar, ayarlar)
- [x] Tasarım: koyu lacivert ana ekran, açık/koyu/sistem teması, doğrulanmış grafik paleti, ≥44pt dokunma hedefleri,
      erişilebilirlik rolleri/etiketleri, güvenli alan (çentik / ana çubuk) desteği
- [x] Ana ekran: güvenle kullanılabilir tutar + döküm ve "Nasıl hesaplandı?", gelir/gider/vergi rezervi ve önceki aya
      göre değişim, yıl sonu net kazanç, 6 aylık çubuk grafik, 30 günlük bakiye, öncelikli 3 uyarı, yaklaşan ödemeler,
      son işlemler
- [x] Gelir/Gider: dönem, arama, filtre (durum, vergisel durum, kategori), sıralama, ekle/düzenle/sil (onaylı),
      CSV içe aktarma (satır bazlı hata raporu) ve dışa aktarma (paylaşım sayfası)
- [x] Vergi simülatörü: matrah, dilim dağılımı, stopaj/geçici vergi mahsubu, KDV ayrı, geçici vergi dönemleri,
      kümülatif grafik, "gider kabul edilirse" (net maliyetle), kural kaynakları ve doğrulama durumu
- [x] Senaryo karşılaştırma: 7 hazır senaryo, kaldıraçlar, Mevcut/Senaryo tablosu, net kazanç farkı, nakit grafiği,
      varsayımlar/belirsizlikler, kaydet/aç/güncelle/sil
- [x] Belgeler: kamera/galeri, görüntüyü uygulama belge dizinine kalıcı kopyalama, alanları girme, tek dokunuşla gider
      kaydı oluşturma, silme
- [x] Nakit akışı (90 gün, tahsilat gecikmesi), dayanma süresi, acil durum fonu, yıl sonu aylık projeksiyon,
      tekrarlayan kalemler (ekle/düzenle/sil)
- [x] Emeklilik: 3 varsayımsal getiri profili, nominal ve reel ayrı, gereken aylık katkı
- [x] Raporlar: ay seçimi, özet/döküm/vergi/senaryo/yıl sonu; PDF ve CSV olarak paylaşma; veri kaynağı etiketi
- [x] Ayarlar: veri modu, bakiye ve varsayımlar, vergi profili, tema, bildirim tercihleri, JSON/CSV dışa aktarma,
      "SİL" onaylı kalıcı silme
- [x] EAS derleme profilleri (`eas.json`), iOS bundle id / Android paket adı, kamera/fotoğraf izin metinleri

### Ortak motor (`packages/core`)
- [x] Kuruş tabanlı para, sürümlü vergi kuralları (kaynak/yürürlük/doğrulama), artan oranlı gelir vergisi,
      KDV/stopaj/geçici vergi ayrı, amortisman, tahsil/tahakkuk esası
- [x] Güvenli harcanabilir tutar, vergi rezervi, nakit akışı, dayanıklılık, uyarılar
- [x] Senaryo motoru (girdiyi değiştirmez) ve sade dil özeti; emeklilik (Fisher, reel/nominal)
- [x] CSV içe/dışa aktarma (enjeksiyon koruması), Zod şemaları, kullanıcıya bağlı Repository (izolasyon testli),
      belgeler veri modeli, demo verisi (deterministik)

### Güvenlik ve veri
- [x] Supabase migration: 11 tablo, tümünde RLS, `auth.uid()` sahiplik politikaları (statik testli)
- [x] İstemci kodunda gizli anahtar olmadığını kontrol eden test (web + mobil + core)

## Henüz çalışmayan veya doğrulanmamış

| Konu | Durum |
|---|---|
| **Gerçek cihazda test** | Yapılmadı (bu ortamda simülatör/cihaz yok). Kamera, paylaşım, PDF ve dosya sistemi cihazda doğrulanmalı. |
| **Vergi kuralları** | Resmî kaynakla birebir doğrulanmadı; tüm sonuçlar "Demo tahmini" etiketli (bkz. `TAX_RULES_LIMITATIONS.md`). |
| **OCR / otomatik fatura okuma** | Yok. Alanlar elle girilir; ekranda açıkça belirtilir. |
| **Supabase canlı modu / giriş** | Şema + RLS hazır; istemci adaptörü ve giriş ekranı yok. Veriler cihazda kalır. |
| **Bulut yedekleme / cihazlar arası eşitleme** | Yok (JSON dışa aktarma var). |
| **Bildirim gönderimi** | Tercihler kaydedilir; push bildirim yok. |
| **Tarih seçici** | Tarihler YYYY-AA-GG metin alanı + "Bugün/Dün" kısayollarıyla girilir; native tarih seçici eklenmedi. |
| **Çoklu para birimi** | İşlemler para birimiyle saklanır; hesaplar TL varsayar. |
| **Yapay zekâ** | Uygulanmadı; uygulama onsuz tam çalışır. |
| **Mağaza yayını** | EAS profilleri hazır; derleme ve gönderim Expo hesabı gerektirir. |

## Sonraki adımlar

1. Expo Go veya `eas build --profile preview` ile gerçek cihazda test (kamera, paylaşım, PDF).
2. Vergi kurallarını resmî metinlerle doğrulamak.
3. Supabase Auth + `SupabaseRepository` + iki kullanıcıyla canlı RLS izolasyon testi; cihazlar arası eşitleme.
4. Native tarih seçici, push bildirimleri (yaklaşan ödeme / vergi hatırlatma).
5. Sunucu tarafı OCR / AI ile fatura alanı çıkarımı (kullanıcı onaylı).
