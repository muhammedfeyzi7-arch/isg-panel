# ISG Mobile (Native)

Bu klasör mevcut web projesinden bağımsız Expo + React Native mobil uygulama iskeletidir.

## Kurulum

1. `mobile` dizinine geç:
```bash
cd mobile
```

2. Ortam değişkenlerini tanımla:
```bash
cp .env.example .env
```

3. `.env` içine gerçek Supabase değerlerini yaz:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

4. Bağımlılıkları kur:
```bash
npm install
```

5. Uygulamayı başlat:
```bash
npm run start
```

## Mevcut Durum

- Supabase auth ile giriş/çıkış
- Oturum saklama (`AsyncStorage`)
- Rol bazlı yönlendirme:
  - `osgb_admin` -> `/(app)/osgb-dashboard`
  - `gezici_uzman` -> `/(app)/uzman`
  - `isyeri_hekimi` -> `/(app)/hekim`
  - diğer -> `/(app)/firma`

## Sonraki Adım Önerisi

1. Alt tab navigasyonu (panel içi modüller)
2. Firma panelinden `dashboard + personeller + uygunsuzluklar` ekranlarını mobil uyarlama
3. QR/kamera ve offline queue
