# SOLOFIN Mobil (iOS + Android)

Expo SDK 58 · React Native 0.88 · TypeScript · expo-router. Hesaplamalar `@solofin/core` paketindeki
deterministik motorla yapılır (web uygulamasıyla aynı motor).

## Telefonda çalıştırma

```bash
cd solofin/apps/mobile
npm install
npx expo start          # QR kodu Expo Go (SDK 58) ile okut
```

- iOS simülatör: `npx expo start --ios` (macOS + Xcode gerekir)
- Android emülatör: `npx expo start --android`
- Kurulabilir derleme (APK / TestFlight): `npx eas-cli@latest build --profile preview --platform android`
  veya `--platform ios` (Expo hesabı gerekir; `eas.json` hazır)

## Ekranlar

| Sekme | İçerik |
|---|---|
| Ana Sayfa | Güvenle kullanılabilir tutar + döküm, gelir/gider/vergi rezervi, yıl sonu net kazanç, 6 aylık grafik, 30 günlük bakiye, öncelikli uyarılar, yaklaşan ödemeler, son işlemler |
| Gelir/Gider | Gelir/gider listesi, dönem, arama, filtre ve sıralama, ekle/düzenle/sil, CSV içe/dışa aktarma (paylaşım sayfası) |
| Simülasyon | Vergi simülatörü (dilim dağılımı, KDV, geçici vergi, kural kaynakları), "gider kabul edilirse", senaryo karşılaştırma (kaydet/aç/sil) |
| Belgeler | Fatura fotoğrafı çek / galeriden seç, alanları doldur, gider olarak ekle. Görüntüler cihazın belge dizininde saklanır. **OCR yok** |
| Profil | Veri modu (demo / kendi verim), Nakit Akışı, Emeklilik, Raporlar (PDF/CSV paylaş), Ayarlar |

Veriler cihazda AsyncStorage ile saklanır; demo ve kullanıcı verisi ayrı anahtarlardadır.

## Komutlar

| Komut | Açıklama |
|---|---|
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint (eslint-config-expo, uyarı toleransı 0) |
| `npm test` | Jest + expo-router testing-library (gerçek ekranlar üzerinde) |
| `npm run export:web && npm run test:e2e` | Web dışa aktarımı üzerinde telefon görüntü alanında Playwright (iPhone 14 + Pixel 7) |
| `npx expo export --platform ios --platform android` | Native JS paketlerini (Hermes) derler |

## Notlar

- `@solofin/core`, `file:../../packages/core` ile bağlanan TypeScript kaynak paketidir. Metro (`metro.config.js`),
  TypeScript (`tsconfig.json`) ve Jest, core'un `zod` bağımlılığını bu uygulamanın kopyasından çözer.
- Web dışa aktarımı yalnızca test/önizleme içindir; hedef platformlar iOS ve Android'dir.
