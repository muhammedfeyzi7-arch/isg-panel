# Vergi kuralları — sınırlamalar ve doğrulama durumu

> **Özet:** SOLOFIN'deki vergi hesapları **demo tahminidir**. Hiçbir kural resmî mevzuat metniyle
> (Resmî Gazete / GİB) birebir doğrulanmamıştır. Uygulama bunu her vergi ekranında açıkça gösterir.
> Kural seti tamamen `official` olarak işaretlenmeden "Demo tahmini" etiketi kalkmaz
> (`isFullyVerified`, `src/lib/finance/tax/rules.ts`).

Son güncelleme: 2026-10-22

## Kural setleri

| Kural | 2026 değeri | Doğrulama | Not |
|---|---|---|---|
| Gelir vergisi tarifesi (ücret dışı) | 190.000 / 400.000 / 1.000.000 / 5.300.000 TL; %15/20/27/35/40 | **İkincil kaynak** | GVK Genel Tebliği Seri No: 332 (31.12.2025 RG) ikincil kaynaklardan alındı; birikimli vergi aritmetiği (28.500 / 70.500 / 232.500 / 1.737.500) tutarlı. Bir kaynakta 3. dilim 1.900.000 TL yazıyordu; aritmetik 1.000.000 TL'yi destekliyor. |
| Gelir vergisi tarifesi 2025 | 158.000 / 330.000 / 800.000 / 4.300.000 TL | **İkincil kaynak** | |
| Serbest meslek stopajı | %20 | Doğrulanmadı | GVK 94/2-b. İndirimli oranlar, istisnalar modellenmedi. |
| Geçici vergi | Kümülatif kazanç × %15, 3 dönem | Doğrulanmadı | 4. dönemin kaldırıldığı varsayıldı. Dönem sonu stok/amortisman düzeltmeleri, beyan ayrıntıları yok. |
| KDV oranları | %20 / %10 / %1 | Doğrulanmadı | Tevkifatlı KDV, istisnalar (hizmet ihracı koşulları), devreden KDV zinciri ayrıntılı değil. |
| Genç girişimci istisnası | 400.000 TL (2026, varsayım) | Doğrulanmadı | Tutarın 2. dilim üst sınırına eşit olduğu VARSAYILDI. Koşullar kullanıcı beyanına dayanır. Prim desteği modellenmedi. |
| Bağ-Kur primi indirimi | Matrahtan indirilir (varsayım) | Doğrulanmadı | Ayarlardan kapatılabilir. |
| Doğrudan gider yazma sınırı | 12.400 TL (2026, türetilmiş) | Doğrulanmadı | 2025 değeri 9.900 TL × %25,49 yeniden değerleme ile **türetildi**; resmî tutar değil. |
| Faydalı ömür (ekipman) | 4 yıl, doğrusal | Doğrulanmadı | Varlık türüne göre amortisman listesi modellenmedi. |

## Modellenmeyen konular

- Geçmiş yıl zararlarının mahsubu (zarar yalnızca "vergi doğmaz" olarak gösterilir).
- Damga vergisi, beyanname ve ödeme takviminin ayrıntıları (yıllık beyan Mart, 2 taksit).
- Ücret, kira, menkul sermaye gibi diğer gelir unsurları ve birleştirme kuralları.
- Bireysel emeklilik, eğitim/sağlık harcaması, bağış gibi özel indirimler.
- Kurumlar vergisi (şirketleşme senaryosu).
- Basit usul / kazanç istisnası, e-ticaret kazanç istisnası vb. özel rejimler.
- Döviz cinsinden işlemlerin TL'ye çevrimi (işlemler tutar ve para birimiyle saklanır; hesaplar TL varsayar).
- Fatura/makbuz kesim zorunlulukları, belge düzeni.

## Testler hakkında

- `tests/unit/tax.test.ts` iki tür test içerir ve bunlar ayrıdır:
  1. **Kurgusal tarife testleri** (`TEST_BRACKETS`): motorun aritmetiğini (dilim sınırının altı/kendisi/üstü,
     marjinal oranın tüm gelire uygulanmaması, sıfır/negatif matrah) doğrular. Mevzuat iddiası taşımaz.
  2. **2026 kural seti tutarlılık testleri**: kural setine girilmiş (ikincil kaynaklı) değerlerin
     tutarlı uygulandığını kontrol eder. Bu testlerin geçmesi kuralların **doğru** olduğunu göstermez.
- Kurallar resmî kaynaktan doğrulandığında: `verification: "official"`, `lastVerifiedAt` ve `sourceUrl`
  güncellenmeli; bu belge de güncellenmelidir.

## Kullanıcıya yönelik ilkeler

- Uygulama kullanıcıyı vergi dilimi düşürmek için harcamaya teşvik etmez. "Bir gider vergi açısından kabul
  edilirse" aracı, vergi farkının yanında **net maliyeti ve net kazanç kaybını** da gösterir.
- Vergisel sınıflandırma (indirilebilirlik) kullanıcı kategorisinden ayrı tutulur. Kategori varsayılanı
  yalnızca "varsayım" olarak işaretlenir ve vergi ekranında dahil edilip edilmeyeceği seçilebilir.
