# Feyzi OSGB Yönetim Paneli

## 1. Proje Açıklaması
OSGB (Ortak Sağlık ve Güvenlik Birimi) firmalarının iş süreçlerini dijital ortamda yönetmelerine olanak tanıyan modern bir SaaS yönetim paneli. Hedef kullanıcılar OSGB yöneticileri ve uzmanlarıdır. Tamamen UI odaklı, mock data ile çalışan bir prototip.

## 2. Sayfa Yapısı
- `/` - Genel Bakış (Dashboard)
- `/firmalar` - Firmalar listesi ve yönetimi
- `/personel` - Personel (uzman + hekim) yönetimi
- `/ziyaretler` - Ziyaret kayıtları
- `/raporlar` - Firma ve ziyaret raporları
- `/ayarlar` - OSGB bilgileri ve kullanıcı yönetimi

## 3. Temel Özellikler
- [x] 2 katmanlı üst navigasyon (Topbar + NavTabs)
- [x] Genel Bakış dashboard
- [x] Firmalar CRUD UI (drawer ile)
- [x] Personel yönetimi UI
- [x] Ziyaret kayıtları UI
- [x] Raporlar UI
- [x] Ayarlar UI
- [x] Dark/Light mode toggle
- [x] Sağdan açılan Drawer paneli
- [x] Tablo bileşeni
- [x] Form Stepper (Firma ekleme)

## 4. Veri Modeli
Tüm veriler mock/placeholder - backend yok.

## 5. Entegrasyonlar
- Supabase: Yok
- Shopify: Yok
- Stripe: Yok

## 6. Geliştirme Fazları

### Faz 1: Temel Altyapı + Tüm Sayfalar (Mevcut)
- Hedef: Tüm sayfaların UI'ını oluştur
- Çıktı: Çalışan, mock data ile dolu tam panel
