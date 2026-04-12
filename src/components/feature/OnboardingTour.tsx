import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import { supabase } from '../../lib/supabase';

interface TourStep {
  title: string;
  description: string;
  icon: string;
  accent: string;
  features?: { icon: string; text: string }[];
  targetId?: string;
  tip?: string;
  badge?: string;
}

const A = {
  green:   '#10B981',
  teal:    '#14B8A6',
  emerald: '#059669',
  slate:   '#64748B',
  sky:     '#0EA5E9',
  rose:    '#F43F5E',
  amber:   '#F59E0B',
  indigo:  '#6366F1',
  cyan:    '#06B6D4',
  violet:  '#8B5CF6',
};

// ─── ADMIN ────────────────────────────────────────────────────────────────────
const ADMIN_STEPS: TourStep[] = [
  {
    title: 'ISG Denetim\'e Hoş Geldiniz!',
    description: 'Firmanızın tüm iş güvenliği süreçlerini tek platformdan yönetiyorsunuz. Sistemi birlikte keşfedelim.',
    icon: 'ri-shield-star-fill',
    accent: A.green,
    badge: 'Admin',
    features: [
      { icon: 'ri-building-2-line',     text: 'Firma & personel yönetimi' },
      { icon: 'ri-map-pin-user-line',   text: 'Saha denetim & DÖF' },
      { icon: 'ri-team-line',           text: 'Ekip ve rol yönetimi' },
    ],
  },
  {
    title: 'Genel Bakış Paneli',
    description: 'Tüm sisteminizin anlık özetini, süresi yaklaşan görevleri ve AI destekli risk analizini buradan takip edin.',
    icon: 'ri-dashboard-3-fill',
    accent: A.teal,
    targetId: 'sidebar-dashboard',
    tip: 'Yapay zeka özetleri her gün otomatik olarak güncellenir',
    features: [
      { icon: 'ri-bar-chart-2-line',    text: 'Anlık istatistikler' },
      { icon: 'ri-robot-line',          text: 'AI destekli risk özeti' },
      { icon: 'ri-notification-3-line', text: 'Akıllı bildirimler' },
    ],
  },
  {
    title: 'Firma & Personel Yönetimi',
    description: 'Sınırsız firma ve personel kaydı oluşturun. Evrak sürelerini otomatik takip edin, uyarı alın.',
    icon: 'ri-building-2-fill',
    accent: A.emerald,
    targetId: 'sidebar-firmalar',
    tip: 'Evrak süresi dolmadan 30 gün önce otomatik bildirim alırsınız',
    features: [
      { icon: 'ri-building-line',       text: 'Sınırsız firma kaydı' },
      { icon: 'ri-id-card-line',        text: 'Dijital kartvizit' },
      { icon: 'ri-alarm-warning-line',  text: 'Otomatik uyarı sistemi' },
    ],
  },
  {
    title: 'Eğitim & Sağlık Durumu',
    description: 'Personel eğitimlerini planlayın, katılım oranlarını ve periyodik muayene tarihlerini takip edin.',
    icon: 'ri-graduation-cap-fill',
    accent: A.sky,
    targetId: 'sidebar-egitimler',
    tip: 'Eğitim katılım raporunu Excel olarak tek tıkla indirebilirsiniz',
    features: [
      { icon: 'ri-team-line',           text: 'Katılım takibi' },
      { icon: 'ri-heart-pulse-line',    text: 'Muayene yönetimi' },
      { icon: 'ri-file-excel-2-line',   text: 'Excel raporu' },
    ],
  },
  {
    title: 'Ekipman & İş İzni',
    description: 'Ekipman periyodik kontrollerini QR kod ile kaydedin. Tehlikeli işler için dijital iş izni oluşturun.',
    icon: 'ri-tools-fill',
    accent: A.amber,
    targetId: 'sidebar-ekipmanlar',
    tip: 'QR kod ile ekipmana telefon kamerasıyla anında erişebilirsiniz',
    features: [
      { icon: 'ri-qr-code-line',        text: 'QR kod desteği' },
      { icon: 'ri-file-text-line',      text: 'Dijital iş izni' },
      { icon: 'ri-calendar-check-line', text: 'Periyodik kontrol' },
    ],
  },
  {
    title: 'Saha Denetim & DÖF',
    description: 'Uygunsuzlukları fotoğrafla kaydedin, DÖF açın, kapatma süreçlerini ve tutanakları yönetin.',
    icon: 'ri-map-pin-user-fill',
    accent: A.rose,
    targetId: 'sidebar-uygunsuzluklar',
    tip: 'Fotoğraflı DÖF ve otomatik PDF rapor oluşturma özelliği mevcuttur',
    features: [
      { icon: 'ri-camera-line',         text: 'Fotoğraflı kayıt' },
      { icon: 'ri-file-pdf-line',       text: 'Otomatik PDF rapor' },
      { icon: 'ri-article-line',        text: 'Tutanak yönetimi' },
    ],
  },
  {
    title: 'Ekip & Kullanıcı Yönetimi',
    description: 'Ayarlar menüsünden ekip üyelerini davet edin, rol atayın ve aktivite geçmişini inceleyin.',
    icon: 'ri-group-fill',
    accent: A.indigo,
    targetId: 'sidebar-ayarlar',
    tip: 'Admin, Üye, Saha Personeli ve Firma Yetkilisi rolleri mevcuttur',
    features: [
      { icon: 'ri-user-add-line',       text: 'Kullanıcı davet et' },
      { icon: 'ri-shield-user-line',    text: 'Rol bazlı yetki' },
      { icon: 'ri-history-line',        text: 'Aktivite geçmişi' },
    ],
  },
  {
    title: 'Her Şey Hazır!',
    description: 'Sistemi kullanmaya başlayabilirsiniz. Herhangi bir sorunuzda destek ekibimize ulaşabilirsiniz.',
    icon: 'ri-rocket-2-fill',
    accent: A.green,
    features: [
      { icon: 'ri-customer-service-2-line', text: '7/24 destek hattı' },
      { icon: 'ri-book-open-line',          text: 'Kullanım kılavuzu' },
      { icon: 'ri-refresh-line',            text: 'Düzenli güncellemeler' },
    ],
  },
];

// ─── MEMBER (Evrak/Dok. Denetçi) ──────────────────────────────────────────────
const MEMBER_STEPS: TourStep[] = [
  {
    title: 'Hoş Geldiniz!',
    description: 'Üye olarak iş güvenliği süreçlerini yönetme yetkiniz aktif. Modülleri birlikte keşfedelim.',
    icon: 'ri-user-star-fill',
    accent: A.teal,
    badge: 'Üye',
    features: [
      { icon: 'ri-file-list-3-line',    text: 'Evrak & belge yönetimi' },
      { icon: 'ri-graduation-cap-line', text: 'Eğitim takibi' },
      { icon: 'ri-heart-pulse-line',    text: 'Sağlık durumu' },
    ],
  },
  {
    title: 'Evrak & Belge Takibi',
    description: 'Personel evraklarını yönetin. Süresi dolmak üzere olanlar için otomatik bildirim alırsınız.',
    icon: 'ri-file-list-3-fill',
    accent: A.emerald,
    targetId: 'sidebar-evraklar',
    tip: 'Toplu evrak yükleme özelliği ile tüm personel evraklarını tek seferde yükleyebilirsiniz',
    features: [
      { icon: 'ri-upload-cloud-line',   text: 'Toplu yükleme' },
      { icon: 'ri-alarm-warning-line',  text: 'Süre uyarıları' },
      { icon: 'ri-search-line',         text: 'Gelişmiş arama' },
    ],
  },
  {
    title: 'Eğitim Takibi',
    description: 'Personel eğitimlerini planlayın, katılım listelerini oluşturun ve raporlayın.',
    icon: 'ri-graduation-cap-fill',
    accent: A.sky,
    targetId: 'sidebar-egitimler',
    tip: 'Eğitim sertifikalarını sisteme yükleyerek dijital arşiv oluşturun',
    features: [
      { icon: 'ri-calendar-check-line', text: 'Eğitim takvimi' },
      { icon: 'ri-team-line',           text: 'Katılım takibi' },
      { icon: 'ri-file-excel-2-line',   text: 'Excel raporu' },
    ],
  },
  {
    title: 'Sağlık Durumu',
    description: 'Personellerin periyodik muayene tarihlerini takip edin. Süresi yaklaşanlar için uyarı alın.',
    icon: 'ri-heart-pulse-fill',
    accent: A.rose,
    targetId: 'sidebar-muayeneler',
    tip: 'Muayene sonuçlarını (Çalışabilir / Kısıtlı / Çalışamaz) sisteme kaydedin',
    features: [
      { icon: 'ri-alarm-warning-line',  text: 'Süre uyarıları' },
      { icon: 'ri-file-text-line',      text: 'Muayene belgesi' },
      { icon: 'ri-bar-chart-2-line',    text: 'Durum analizi' },
    ],
  },
  {
    title: 'Her Şey Hazır!',
    description: 'Görevlerinize başlayabilirsiniz. Sol menüden istediğiniz modüle geçin.',
    icon: 'ri-rocket-2-fill',
    accent: A.green,
    features: [
      { icon: 'ri-customer-service-2-line', text: 'Destek hattı' },
      { icon: 'ri-refresh-line',            text: 'Düzenli güncellemeler' },
      { icon: 'ri-shield-check-line',       text: 'Güvenli platform' },
    ],
  },
];

// ─── DENETÇİ (Saha Personeli) ─────────────────────────────────────────────────
const DENETCI_STEPS: TourStep[] = [
  {
    title: 'Hoş Geldiniz!',
    description: 'Saha Personeli olarak saha denetim araçlarına erişiminiz hazır. Modülleri birlikte keşfedelim.',
    icon: 'ri-map-pin-user-fill',
    accent: A.teal,
    badge: 'Saha Personeli',
    features: [
      { icon: 'ri-map-pin-user-line',   text: 'Saha denetim' },
      { icon: 'ri-tools-line',          text: 'Ekipman kontrol' },
      { icon: 'ri-file-shield-2-line',  text: 'İş izni yönetimi' },
    ],
  },
  {
    title: 'Saha Denetim & DÖF',
    description: 'Sahada tespit ettiğiniz uygunsuzlukları fotoğrafla kaydedin, DÖF açın ve takip edin.',
    icon: 'ri-map-pin-user-fill',
    accent: A.rose,
    targetId: 'sidebar-uygunsuzluklar',
    tip: 'Fotoğraflı DÖF kaydı ve otomatik PDF rapor oluşturma özelliği mevcuttur',
    features: [
      { icon: 'ri-camera-line',         text: 'Fotoğraflı kayıt' },
      { icon: 'ri-file-pdf-line',       text: 'PDF rapor' },
      { icon: 'ri-article-line',        text: 'Tutanak oluştur' },
    ],
  },
  {
    title: 'Ekipman Kontrolleri',
    description: 'Ekipmanların periyodik kontrollerini kaydedin. QR kod ile hızlı erişim sağlayın.',
    icon: 'ri-tools-fill',
    accent: A.amber,
    targetId: 'sidebar-ekipmanlar',
    tip: 'Ekipman QR kodlarını yazdırarak sahaya asabilirsiniz',
    features: [
      { icon: 'ri-qr-code-line',        text: 'QR kod oluştur' },
      { icon: 'ri-calendar-check-line', text: 'Periyodik kontrol' },
      { icon: 'ri-alarm-warning-line',  text: 'Bakım uyarıları' },
    ],
  },
  {
    title: 'İş İzni Yönetimi',
    description: 'Tehlikeli işler için dijital iş izni oluşturun ve onay süreçlerini takip edin.',
    icon: 'ri-file-shield-2-fill',
    accent: A.sky,
    targetId: 'sidebar-is-izinleri',
    tip: 'İş izni PDF olarak indirilebilir ve sahada imzalatılabilir',
    features: [
      { icon: 'ri-fire-line',           text: 'Sıcak çalışma izni' },
      { icon: 'ri-arrow-up-line',       text: 'Yüksekte çalışma' },
      { icon: 'ri-file-pdf-line',       text: 'PDF çıktı' },
    ],
  },
  {
    title: 'Her Şey Hazır!',
    description: 'Saha çalışmalarınıza başlayabilirsiniz. İyi çalışmalar!',
    icon: 'ri-rocket-2-fill',
    accent: A.green,
    features: [
      { icon: 'ri-customer-service-2-line', text: 'Destek hattı' },
      { icon: 'ri-shield-check-line',       text: 'Güvenli platform' },
      { icon: 'ri-refresh-line',            text: 'Düzenli güncellemeler' },
    ],
  },
];

// ─── FİRMA_USER (Firma Yetkilisi) ─────────────────────────────────────────────
const FIRMA_USER_STEPS: TourStep[] = [
  {
    title: 'Firma Panelinize Hoş Geldiniz!',
    description: 'Firmanıza ait personel, evrak, eğitim ve uygunsuzluk süreçlerini bu panel üzerinden takip edebilirsiniz.',
    icon: 'ri-building-4-fill',
    accent: A.cyan,
    badge: 'Firma Yetkilisi',
    features: [
      { icon: 'ri-team-line',           text: 'Personel takibi' },
      { icon: 'ri-file-list-3-line',    text: 'Evrak yönetimi' },
      { icon: 'ri-graduation-cap-line', text: 'Eğitim kayıtları' },
    ],
  },
  {
    title: 'Personel Takibi',
    description: 'Firmanızdaki çalışanları görüntüleyin, evrak durumlarını ve eğitim bilgilerini takip edin.',
    icon: 'ri-team-fill',
    accent: A.green,
    targetId: 'sidebar-personeller',
    tip: 'Personel detay sayfasından tüm evrak ve eğitim geçmişine ulaşabilirsiniz',
    features: [
      { icon: 'ri-id-card-line',        text: 'Personel bilgileri' },
      { icon: 'ri-file-list-3-line',    text: 'Evrak durumu' },
      { icon: 'ri-graduation-cap-line', text: 'Eğitim geçmişi' },
    ],
  },
  {
    title: 'Evrak & Belge Takibi',
    description: 'Firmanıza ait evrakları görüntüleyin. Süresi dolmak üzere olanlar için otomatik bildirim alırsınız.',
    icon: 'ri-file-list-3-fill',
    accent: A.amber,
    targetId: 'sidebar-evraklar',
    tip: 'Evrakların süresi dolmadan 30 gün önce bildirim alırsınız',
    features: [
      { icon: 'ri-alarm-warning-line',  text: 'Süre uyarıları' },
      { icon: 'ri-file-text-line',      text: 'Belge görüntüleme' },
      { icon: 'ri-search-line',         text: 'Hızlı arama' },
    ],
  },
  {
    title: 'Uygunsuzluk Takibi',
    description: 'Firmanızdaki saha denetim bulgularını ve DÖF süreçlerini buradan takip edebilirsiniz.',
    icon: 'ri-alert-fill',
    accent: A.rose,
    targetId: 'sidebar-uygunsuzluklar',
    tip: 'Kapatılan ve açık DÖF kayıtlarını buradan görüntüleyebilirsiniz',
    features: [
      { icon: 'ri-map-pin-user-line',   text: 'DÖF kayıtları' },
      { icon: 'ri-camera-line',         text: 'Fotoğraflı belgeler' },
      { icon: 'ri-article-line',        text: 'Tutanaklar' },
    ],
  },
  {
    title: 'Her Şey Hazır!',
    description: 'Firmanızın iş güvenliği süreçlerini takip etmeye başlayabilirsiniz.',
    icon: 'ri-rocket-2-fill',
    accent: A.cyan,
    features: [
      { icon: 'ri-customer-service-2-line', text: 'Destek hattı' },
      { icon: 'ri-shield-check-line',       text: 'Güvenli platform' },
      { icon: 'ri-refresh-line',            text: 'Düzenli güncellemeler' },
    ],
  },
];

// ─── GEZİCİ UZMAN ─────────────────────────────────────────────────────────────
const GEZICI_UZMAN_STEPS: TourStep[] = [
  {
    title: 'Hoş Geldiniz!',
    description: 'Gezici Uzman olarak size atanmış firmaların tüm iş güvenliği süreçlerini bu panel üzerinden yönetebilirsiniz.',
    icon: 'ri-shield-user-fill',
    accent: A.emerald,
    badge: 'Gezici Uzman',
    features: [
      { icon: 'ri-building-2-line',     text: 'Atanmış firmalar' },
      { icon: 'ri-map-pin-user-line',   text: 'Saha denetim' },
      { icon: 'ri-team-line',           text: 'Personel yönetimi' },
    ],
  },
  {
    title: 'Atanmış Firmalarınız',
    description: 'Firmalar menüsünden size atanmış tüm firmaları görüntüleyebilirsiniz. Bu alanda yalnızca görüntüleme yetkisine sahipsiniz.',
    icon: 'ri-building-2-fill',
    accent: A.sky,
    targetId: 'sidebar-firmalar',
    tip: 'Birden fazla firmaya atandıysanız üst menüdeki firma seçiciden geçiş yapabilirsiniz',
    features: [
      { icon: 'ri-eye-line',            text: 'Firma detay görüntüleme' },
      { icon: 'ri-team-line',           text: 'Personel listesi' },
      { icon: 'ri-building-2-line',     text: 'Çoklu firma erişimi' },
    ],
  },
  {
    title: 'Personel & Evrak Yönetimi',
    description: 'Atanmış firmalarınızdaki personelleri yönetin, evrak sürelerini takip edin.',
    icon: 'ri-team-fill',
    accent: A.emerald,
    targetId: 'sidebar-personeller',
    tip: 'Personel evraklarının süresi dolmadan 30 gün önce otomatik bildirim alırsınız',
    features: [
      { icon: 'ri-user-line',           text: 'Personel yönetimi' },
      { icon: 'ri-file-list-3-line',    text: 'Evrak takibi' },
      { icon: 'ri-alarm-warning-line',  text: 'Otomatik uyarılar' },
    ],
  },
  {
    title: 'Saha Denetim & DÖF',
    description: 'Sahada tespit ettiğiniz uygunsuzlukları fotoğrafla kaydedin, DÖF açın ve kapatma süreçlerini takip edin.',
    icon: 'ri-map-pin-user-fill',
    accent: A.rose,
    targetId: 'sidebar-uygunsuzluklar',
    tip: 'Saha modülüne mobil cihazdan da erişerek QR kod ile çek-in yapabilirsiniz',
    features: [
      { icon: 'ri-camera-line',         text: 'Fotoğraflı DÖF' },
      { icon: 'ri-file-pdf-line',       text: 'Otomatik PDF rapor' },
      { icon: 'ri-qr-code-line',        text: 'QR ile çek-in' },
    ],
  },
  {
    title: 'Eğitim & Sağlık Durumu',
    description: 'Firmalardaki personel eğitimlerini planlayın, katılım oranlarını ve muayene tarihlerini takip edin.',
    icon: 'ri-graduation-cap-fill',
    accent: A.amber,
    targetId: 'sidebar-egitimler',
    tip: 'Eğitim katılım listesini Excel olarak indirebilirsiniz',
    features: [
      { icon: 'ri-team-line',           text: 'Katılım takibi' },
      { icon: 'ri-heart-pulse-line',    text: 'Muayene yönetimi' },
      { icon: 'ri-file-excel-2-line',   text: 'Excel raporu' },
    ],
  },
  {
    title: 'Her Şey Hazır!',
    description: 'Saha çalışmalarınıza başlayabilirsiniz. Herhangi bir sorunuzda destek ekibimize ulaşın.',
    icon: 'ri-rocket-2-fill',
    accent: A.emerald,
    features: [
      { icon: 'ri-customer-service-2-line', text: '7/24 destek hattı' },
      { icon: 'ri-shield-check-line',       text: 'Güvenli platform' },
      { icon: 'ri-refresh-line',            text: 'Düzenli güncellemeler' },
    ],
  },
];

// ─── İŞYERİ HEKİMİ ────────────────────────────────────────────────────────────
const ISYERI_HEKIMI_STEPS: TourStep[] = [
  {
    title: 'Hekim Panelinize Hoş Geldiniz!',
    description: 'İşyeri Hekimi olarak size atanmış firmaların sağlık süreçlerini ve iş kazası kayıtlarını bu panel üzerinden yönetebilirsiniz.',
    icon: 'ri-heart-pulse-fill',
    accent: A.sky,
    badge: 'İşyeri Hekimi',
    features: [
      { icon: 'ri-stethoscope-line',    text: 'Muayene yönetimi' },
      { icon: 'ri-alert-line',          text: 'İş kazası takibi' },
      { icon: 'ri-building-3-line',     text: 'Firma bazlı görünüm' },
    ],
  },
  {
    title: 'Atanmış Firmalar',
    description: 'Size atanmış firmaları Firmalar sekmesinde görüntüleyebilirsiniz. Bu alanda yalnızca görüntüleme yetkisine sahipsiniz.',
    icon: 'ri-building-3-fill',
    accent: A.cyan,
    tip: 'Üst menüdeki firma seçiciden atanmış firmalar arasında geçiş yapabilirsiniz',
    features: [
      { icon: 'ri-eye-line',            text: 'Firma detay görüntüleme' },
      { icon: 'ri-group-line',          text: 'Firma personel listesi' },
      { icon: 'ri-calendar-check-line', text: 'Muayene takvimi' },
    ],
  },
  {
    title: 'Sağlık Durumu & Muayeneler',
    description: 'Personellerin periyodik muayene tarihlerini takip edin, sonuçları kaydedin ve rapor oluşturun.',
    icon: 'ri-stethoscope-line',
    accent: A.sky,
    tip: 'Muayene sonuçlarını (Çalışabilir / Kısıtlı / Çalışamaz) kaydedin',
    features: [
      { icon: 'ri-alarm-warning-line',  text: 'Süre uyarıları' },
      { icon: 'ri-file-text-line',      text: 'Muayene belgesi' },
      { icon: 'ri-bar-chart-2-line',    text: 'Durum analizi' },
    ],
  },
  {
    title: 'İş Kazası Yönetimi',
    description: 'İş kazalarını kaydedin, gerekli resmi raporları oluşturun ve kaza analizlerini takip edin.',
    icon: 'ri-alert-fill',
    accent: A.rose,
    tip: 'İş kazası raporu Türkiye mevzuatına uygun formatta PDF olarak oluşturulur',
    features: [
      { icon: 'ri-file-pdf-line',       text: 'Resmi kaza raporu' },
      { icon: 'ri-time-line',           text: 'Kaza zaman çizelgesi' },
      { icon: 'ri-bar-chart-2-line',    text: 'Kaza istatistikleri' },
    ],
  },
  {
    title: 'Her Şey Hazır!',
    description: 'Sağlık takibi çalışmalarınıza başlayabilirsiniz. İyi çalışmalar!',
    icon: 'ri-rocket-2-fill',
    accent: A.sky,
    features: [
      { icon: 'ri-customer-service-2-line', text: '7/24 destek hattı' },
      { icon: 'ri-shield-check-line',       text: 'Güvenli platform' },
      { icon: 'ri-refresh-line',            text: 'Düzenli güncellemeler' },
    ],
  },
];

// ─── OSGB ADMİN ───────────────────────────────────────────────────────────────
const OSGB_ADMIN_STEPS: TourStep[] = [
  {
    title: 'OSGB Panelinize Hoş Geldiniz!',
    description: 'Müşteri firmalarınızı ve uzman personelinizi tek platformdan yönetin. Paneli birlikte keşfedelim.',
    icon: 'ri-hospital-fill',
    accent: A.cyan,
    badge: 'OSGB Admin',
    features: [
      { icon: 'ri-building-2-line',     text: 'Müşteri firma yönetimi' },
      { icon: 'ri-user-star-line',      text: 'Uzman personel yönetimi' },
      { icon: 'ri-links-line',          text: 'Uzman-firma ataması' },
    ],
  },
  {
    title: 'Müşteri Firma Ekleme',
    description: '"Müşteri Firmalar" sekmesinden yeni firma ekleyin ve sözleşme bilgilerini kaydedin.',
    icon: 'ri-building-2-fill',
    accent: A.sky,
    tip: 'Firma eklendikten sonra otomatik davet kodu oluşturulur — firmaya bu kodla katılım sağlanır',
    features: [
      { icon: 'ri-add-circle-line',     text: 'Hızlı firma ekleme' },
      { icon: 'ri-qr-code-line',        text: 'Davet kodu sistemi' },
      { icon: 'ri-bar-chart-2-line',    text: 'Firma bazlı raporlar' },
    ],
  },
  {
    title: 'Personel Yönetimi',
    description: '"Gezici Uzmanlar" sekmesinden uzman veya işyeri hekimi ekleyin, atamalar yapın.',
    icon: 'ri-user-star-fill',
    accent: A.emerald,
    tip: 'Bir uzmanı birden fazla firmaya aynı anda atayabilirsiniz',
    features: [
      { icon: 'ri-user-add-line',       text: 'Uzman & Hekim ekle' },
      { icon: 'ri-links-line',          text: 'Çoklu firma atama' },
      { icon: 'ri-shield-user-line',    text: 'Rol bazlı erişim' },
    ],
  },
  {
    title: 'Ziyaret & Raporlama',
    description: 'Uzmanların saha ziyaretlerini takip edin, dönemsel performans ve uygunsuzluk raporları oluşturun.',
    icon: 'ri-file-chart-fill',
    accent: A.amber,
    tip: 'Raporlar sayfasından PDF ve Excel formatında dönem raporu indirebilirsiniz',
    features: [
      { icon: 'ri-map-pin-user-line',   text: 'Ziyaret takibi' },
      { icon: 'ri-file-pdf-line',       text: 'PDF rapor' },
      { icon: 'ri-file-excel-2-line',   text: 'Excel export' },
    ],
  },
  {
    title: 'Her Şey Hazır!',
    description: 'Platformu kullanmaya başlayabilirsiniz. Herhangi bir sorunuzda destek ekibimize ulaşın.',
    icon: 'ri-rocket-2-fill',
    accent: A.cyan,
    features: [
      { icon: 'ri-customer-service-2-line', text: '7/24 destek hattı' },
      { icon: 'ri-shield-check-line',       text: 'Güvenli platform' },
      { icon: 'ri-refresh-line',            text: 'Düzenli güncellemeler' },
    ],
  },
];

const TOUR_STORAGE_KEY = 'isg_tour_completed';

function getTourSteps(role: string, osgbRole?: string | null): TourStep[] {
  // osgbRole kontrolü her zaman önce gelir — OSGB rolleri role değerine bakmaz
  if (osgbRole === 'osgb_admin')    return OSGB_ADMIN_STEPS;
  if (osgbRole === 'gezici_uzman')  return GEZICI_UZMAN_STEPS;
  if (osgbRole === 'isyeri_hekimi') return ISYERI_HEKIMI_STEPS;
  // Standart rol kontrolü
  if (role === 'admin')      return ADMIN_STEPS;
  if (role === 'denetci')    return DENETCI_STEPS;
  if (role === 'firma_user') return FIRMA_USER_STEPS;
  // member veya bilinmeyen
  return MEMBER_STEPS;
}

export default function OnboardingTour() {
  const { org, theme } = useApp();
  const { user } = useAuth();
  const isDark = theme === 'dark';

  const stepIndexRef = useRef(0);
  const [stepIndex, setStepIndexState] = useState(0);
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [targetEl, setTargetEl] = useState<HTMLElement | null>(null);
  const [, forceRender] = useState(0);
  const checkedUserIdRef = useRef<string | null>(null);

  const setStepIndex = useCallback((i: number, dir: 'next' | 'prev' = 'next') => {
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      stepIndexRef.current = i;
      setStepIndexState(i);
      setAnimating(false);
    }, 180);
  }, []);

  const role = org?.role ?? 'member';
  const osgbRole = org?.osgbRole ?? null;
  const steps = getTourSteps(role, osgbRole);
  const currentStep = steps[stepIndex];
  const isLast  = stepIndex === steps.length - 1;
  const isFirst = stepIndex === 0;
  const progress = ((stepIndex + 1) / steps.length) * 100;
  const accent = currentStep?.accent ?? A.green;

  useEffect(() => {
    // orgLoading bitene kadar bekle — osgbRole henüz gelmemiş olabilir
    if (!org?.id || !user?.id) return;
    // org yüklenmiş ama role/osgbRole henüz settled değilse bekle
    if (!org.role) return;
    if (checkedUserIdRef.current === user.id) return;
    checkedUserIdRef.current = user.id;

    const sessionKey = `${TOUR_STORAGE_KEY}_${user.id}`;
    let cancelled = false;
    let showTimer: ReturnType<typeof setTimeout> | null = null;

    try {
      if (sessionStorage.getItem(sessionKey) === '1') return;
    } catch { /* ignore */ }

    supabase
      .from('profiles')
      .select('tour_completed')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error) return;
        if (data?.tour_completed === true) {
          try { sessionStorage.setItem(sessionKey, '1'); } catch { /* ignore */ }
          return;
        }
        showTimer = setTimeout(() => { if (!cancelled) setVisible(true); }, 600);
      })
      .catch(() => { /* ignore */ });

    return () => {
      cancelled = true;
      if (showTimer) clearTimeout(showTimer);
    };
  }, [org?.id, user?.id]);

  useEffect(() => {
    if (!visible) return;
    if (!currentStep?.targetId) { setTargetEl(null); return; }
    const t = setTimeout(() => {
      const el = document.getElementById(currentStep.targetId!);
      setTargetEl(el);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      forceRender(n => n + 1);
    }, 100);
    return () => clearTimeout(t);
  }, [visible, stepIndex, currentStep?.targetId]);

  const completeTour = useCallback(async () => {
    if (!user?.id) return;
    setVisible(false);
    try { sessionStorage.setItem(`${TOUR_STORAGE_KEY}_${user.id}`, '1'); } catch { /* ignore */ }
    try { localStorage.removeItem(`${TOUR_STORAGE_KEY}_${user.id}`); } catch { /* ignore */ }
    try {
      await supabase
        .from('profiles')
        .upsert({ user_id: user.id, tour_completed: true }, { onConflict: 'user_id' });
    } catch { /* ignore */ }
  }, [user?.id]);

  const handleNext = useCallback(() => {
    const next = stepIndexRef.current + 1;
    if (next < steps.length) setStepIndex(next, 'next');
    else completeTour();
  }, [steps.length, setStepIndex, completeTour]);

  const handlePrev = useCallback(() => {
    const prev = stepIndexRef.current - 1;
    if (prev >= 0) setStepIndex(prev, 'prev');
  }, [setStepIndex]);

  const handleSkip = useCallback(() => completeTour(), [completeTour]);

  if (!visible || !currentStep) return null;

  // ── design tokens ──
  const bg      = isDark ? '#0D1526' : '#ffffff';
  const bgSub   = isDark ? 'rgba(255,255,255,0.035)' : 'rgba(15,23,42,0.025)';
  const border  = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.09)';
  const primary = isDark ? '#E2E8F0' : '#0F172A';
  const muted   = isDark ? '#64748B' : '#94A3B8';
  const sub     = isDark ? '#94A3B8' : '#475569';

  const slideStyle: React.CSSProperties = {
    opacity:   animating ? 0 : 1,
    transform: animating ? `translateX(${direction === 'next' ? '16px' : '-16px'})` : 'translateX(0)',
    transition: 'opacity 0.18s ease, transform 0.18s ease',
  };

  // ── target element & tooltip positioning ──
  const hasTarget = !!currentStep.targetId;
  const isCenter  = !hasTarget || !targetEl;

  let tooltipStyle: React.CSSProperties = {};
  let arrowSide: 'left' | 'right' | null = null;
  let highlightStyle: React.CSSProperties = {};

  if (!isCenter && targetEl) {
    const rect = targetEl.getBoundingClientRect();
    const tooltipWidth = 310;
    const spaceRight = window.innerWidth - rect.right;
    const placeRight = spaceRight >= tooltipWidth + 20;
    const placeLeft  = !placeRight && rect.left >= tooltipWidth + 20;
    const tooltipTop = Math.max(12, Math.min(rect.top + rect.height / 2 - 120, window.innerHeight - 280));

    if (placeRight) {
      tooltipStyle = { position: 'fixed', top: tooltipTop, left: rect.right + 14, width: tooltipWidth, zIndex: 99999 };
      arrowSide = 'left';
    } else if (placeLeft) {
      tooltipStyle = { position: 'fixed', top: tooltipTop, left: rect.left - tooltipWidth - 14, width: tooltipWidth, zIndex: 99999 };
      arrowSide = 'right';
    } else {
      tooltipStyle = { position: 'fixed', top: tooltipTop, left: Math.min(rect.right + 14, window.innerWidth - tooltipWidth - 14), width: tooltipWidth, zIndex: 99999 };
      arrowSide = 'left';
    }

    highlightStyle = {
      position: 'fixed', zIndex: 99999,
      top: rect.top - 5, left: rect.left - 5,
      width: rect.width + 10, height: rect.height + 10,
      borderRadius: '12px',
      border: `2px solid ${accent}`,
      boxShadow: `0 0 0 4px ${accent}22, 0 0 28px ${accent}35`,
      pointerEvents: 'none',
      transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CENTER MODAL
  // ─────────────────────────────────────────────────────────────────────────
  if (isCenter) {
    return createPortal(
      <>
        <style>{`
          @keyframes onb-float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-6px); }
          }
          @keyframes onb-pulse {
            0%, 100% { opacity: 0.6; transform: scale(1); }
            50% { opacity: 0; transform: scale(1.15); }
          }
          @keyframes onb-shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
          .onb-icon-float { animation: onb-float 3s ease-in-out infinite; }
        `}</style>

        {/* Backdrop */}
        <div className="fixed inset-0" style={{ zIndex: 99998, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }} />

        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
          <div
            className="w-full max-w-[440px] rounded-[24px] overflow-hidden"
            style={{
              background: bg,
              border,
              boxShadow: isDark
                ? `0 0 0 1px ${accent}20, 0 40px 100px rgba(0,0,0,0.7), 0 0 60px ${accent}10`
                : `0 0 0 1px ${accent}18, 0 30px 70px rgba(15,23,42,0.2), 0 0 40px ${accent}08`,
            }}
          >
            {/* Top accent bar — shimmer */}
            <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${accent}00, ${accent}, ${accent}00)` }} />

            {/* Progress line */}
            <div className="h-[2px] w-full" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)' }}>
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${accent}80, ${accent})` }}
              />
            </div>

            {/* Hero section */}
            <div
              className="relative flex flex-col items-center pt-8 pb-6 px-8"
              style={{ background: `linear-gradient(180deg, ${accent}0d 0%, transparent 100%)` }}
            >
              {/* Step counter + badge */}
              <div className="absolute top-4 right-5 flex items-center gap-2">
                {currentStep.badge && (
                  <span
                    className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}30`, letterSpacing: '0.06em' }}
                  >
                    {currentStep.badge.toUpperCase()}
                  </span>
                )}
                <span
                  className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                  style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}25` }}
                >
                  {stepIndex + 1} / {steps.length}
                </span>
              </div>

              {/* Floating icon */}
              <div className="relative mb-6 onb-icon-float">
                {/* Glow ring */}
                <div
                  className="absolute inset-0 rounded-2xl"
                  style={{
                    background: `${accent}18`,
                    filter: `blur(14px)`,
                    transform: 'scale(1.3)',
                  }}
                />
                {/* Pulse ring */}
                <div
                  className="absolute inset-0 rounded-2xl"
                  style={{
                    border: `1.5px solid ${accent}30`,
                    animation: 'onb-pulse 2.5s ease-in-out infinite',
                  }}
                />
                <div
                  className="relative w-[76px] h-[76px] rounded-2xl flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${accent}20, ${accent}10)`,
                    border: `1.5px solid ${accent}40`,
                  }}
                >
                  <i className={`${currentStep.icon} text-[38px]`} style={{ color: accent }} />
                </div>
              </div>

              {/* Title + description */}
              <div style={slideStyle} className="text-center">
                <h2
                  className="text-[18px] font-extrabold mb-2.5 leading-snug"
                  style={{ color: primary, letterSpacing: '-0.03em' }}
                >
                  {currentStep.title}
                </h2>
                <p className="text-[13px] leading-relaxed" style={{ color: sub }}>
                  {currentStep.description}
                </p>
              </div>
            </div>

            {/* Feature grid */}
            {currentStep.features && currentStep.features.length > 0 && (
              <div className="px-6 pt-1 pb-3" style={slideStyle}>
                <div className="grid grid-cols-3 gap-2">
                  {currentStep.features.map((f, i) => (
                    <div
                      key={i}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl text-center"
                      style={{ background: bgSub, border }}
                    >
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `${accent}12` }}
                      >
                        <i className={`${f.icon} text-sm`} style={{ color: accent }} />
                      </div>
                      <span className="text-[10px] font-semibold leading-tight" style={{ color: sub }}>
                        {f.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tip */}
            {currentStep.tip && (
              <div className="px-6 pb-3" style={slideStyle}>
                <div
                  className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl"
                  style={{ background: `${accent}0a`, border: `1px solid ${accent}22` }}
                >
                  <i className="ri-lightbulb-flash-line text-sm flex-shrink-0 mt-0.5" style={{ color: accent }} />
                  <p className="text-[11.5px] leading-relaxed" style={{ color: sub }}>
                    <strong style={{ color: accent }}>İpucu:</strong> {currentStep.tip}
                  </p>
                </div>
              </div>
            )}

            {/* Step dots */}
            <div className="flex items-center justify-center gap-1.5 py-3">
              {steps.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setStepIndex(i, i > stepIndex ? 'next' : 'prev')}
                  className="rounded-full transition-all duration-300 cursor-pointer"
                  style={{
                    width: i === stepIndex ? 22 : 6,
                    height: 6,
                    background: i === stepIndex
                      ? s.accent
                      : i < stepIndex
                        ? `${s.accent}50`
                        : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.09)',
                  }}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex items-center gap-2.5">
              {!isFirst ? (
                <button
                  onClick={handlePrev}
                  className="w-9 h-9 flex items-center justify-center rounded-xl cursor-pointer flex-shrink-0 transition-all duration-150"
                  style={{ background: bgSub, border, color: muted }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = bgSub; }}
                >
                  <i className="ri-arrow-left-s-line text-base" />
                </button>
              ) : (
                <button
                  onClick={handleSkip}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap transition-all duration-150"
                  style={{ background: bgSub, border, color: muted }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = isDark ? '#94a3b8' : '#475569'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = muted; }}
                >
                  Atla
                </button>
              )}

              <button
                onClick={handleNext}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer whitespace-nowrap transition-all duration-150 flex items-center justify-center gap-2"
                style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, boxShadow: `0 4px 18px ${accent}45` }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 24px ${accent}60`;
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 18px ${accent}45`;
                  (e.currentTarget as HTMLElement).style.transform = 'none';
                }}
              >
                {isLast
                  ? <><i className="ri-rocket-line text-sm" />Hadi Başlayalım!</>
                  : <>Devam Et <i className="ri-arrow-right-s-line text-sm" /></>}
              </button>
            </div>
          </div>
        </div>
      </>,
      document.body
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TOOLTIP (sidebar yanında)
  // ─────────────────────────────────────────────────────────────────────────
  return createPortal(
    <>
      <style>{`
        @keyframes onb-highlight-pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0; transform: scale(1.08); }
        }
      `}</style>

      <div className="fixed inset-0"
        style={{ zIndex: 99998, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
        onClick={handleSkip}
      />

      {/* Highlight ring */}
      <div style={highlightStyle} />
      <div style={{
        ...highlightStyle,
        border: `2px solid ${accent}`,
        boxShadow: 'none',
        animation: 'onb-highlight-pulse 1.8s ease-in-out infinite',
      }} />

      {/* Tooltip card */}
      <div style={tooltipStyle} onClick={e => e.stopPropagation()}>
        {arrowSide === 'left' && (
          <div style={{
            position: 'absolute', left: -7, top: '50%', transform: 'translateY(-50%)',
            width: 0, height: 0,
            borderTop: '7px solid transparent', borderBottom: '7px solid transparent',
            borderRight: `7px solid ${isDark ? '#0D1526' : '#ffffff'}`, zIndex: 1,
          }} />
        )}
        {arrowSide === 'right' && (
          <div style={{
            position: 'absolute', right: -7, top: '50%', transform: 'translateY(-50%)',
            width: 0, height: 0,
            borderTop: '7px solid transparent', borderBottom: '7px solid transparent',
            borderLeft: `7px solid ${isDark ? '#0D1526' : '#ffffff'}`, zIndex: 1,
          }} />
        )}

        <div
          className="rounded-[20px] overflow-hidden"
          style={{
            background: bg, border,
            boxShadow: isDark
              ? `0 0 0 1px ${accent}20, 0 24px 60px rgba(0,0,0,0.6)`
              : `0 0 0 1px ${accent}15, 0 20px 50px rgba(15,23,42,0.15)`,
          }}
        >
          {/* Top bar */}
          <div className="h-[2px] w-full" style={{ background: `linear-gradient(90deg, ${accent}00, ${accent}, ${accent}00)` }} />

          {/* Progress */}
          <div className="h-[2px] w-full" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)' }}>
            <div className="h-full transition-all duration-500"
              style={{ width: `${progress}%`, background: accent }} />
          </div>

          {/* Header */}
          <div className="p-4 pb-3" style={{ background: `${accent}08` }}>
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${accent}18`, border: `1px solid ${accent}35` }}
              >
                <i className={`${currentStep.icon} text-lg`} style={{ color: accent }} />
              </div>
              <div className="flex-1 min-w-0" style={slideStyle}>
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="text-[13px] font-bold" style={{ color: primary }}>{currentStep.title}</h4>
                  {currentStep.badge && (
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}30` }}>
                      {currentStep.badge}
                    </span>
                  )}
                </div>
                <p className="text-[11.5px] leading-relaxed" style={{ color: sub }}>{currentStep.description}</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                style={{ background: `${accent}15`, color: accent }}>
                {stepIndex + 1}/{steps.length}
              </span>
            </div>
          </div>

          {/* Features list */}
          {currentStep.features && currentStep.features.length > 0 && (
            <div className="px-4 py-3" style={slideStyle}>
              <div className="space-y-1.5">
                {currentStep.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${accent}12` }}>
                      <i className={`${f.icon} text-[10px]`} style={{ color: accent }} />
                    </div>
                    <span className="text-[11.5px]" style={{ color: sub }}>{f.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tip */}
          {currentStep.tip && (
            <div className="px-4 pb-3" style={slideStyle}>
              <div className="flex items-start gap-2 px-3 py-2 rounded-xl"
                style={{ background: `${accent}08`, border: `1px solid ${accent}18` }}>
                <i className="ri-lightbulb-flash-line text-[10px] flex-shrink-0 mt-0.5" style={{ color: accent }} />
                <p className="text-[10.5px] leading-relaxed" style={{ color: sub }}>
                  <strong style={{ color: accent }}>İpucu:</strong> {currentStep.tip}
                </p>
              </div>
            </div>
          )}

          {/* Dots */}
          <div className="flex items-center justify-center gap-1 pb-3">
            {steps.map((s, i) => (
              <button key={i}
                onClick={() => setStepIndex(i, i > stepIndex ? 'next' : 'prev')}
                className="rounded-full transition-all duration-300 cursor-pointer"
                style={{
                  width: i === stepIndex ? 16 : 5, height: 5,
                  background: i === stepIndex
                    ? s.accent
                    : i < stepIndex
                      ? `${s.accent}45`
                      : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.09)',
                }} />
            ))}
          </div>

          {/* Actions */}
          <div className="px-4 pb-4 flex items-center gap-2">
            {!isFirst ? (
              <button
                onClick={handlePrev}
                className="w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer flex-shrink-0 transition-all"
                style={{ background: bgSub, border, color: muted }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = bgSub; }}
              >
                <i className="ri-arrow-left-s-line text-xs" />
              </button>
            ) : (
              <button
                onClick={handleSkip}
                className="flex-1 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                style={{ background: bgSub, border, color: muted }}
              >
                Atla
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex-1 py-2 rounded-xl text-xs font-bold text-white cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 transition-all duration-150"
              style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, boxShadow: `0 3px 12px ${accent}40` }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px ${accent}55`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 3px 12px ${accent}40`; }}
            >
              {isLast
                ? <><i className="ri-rocket-line" />Başlayalım!</>
                : <>Devam Et <i className="ri-arrow-right-s-line" /></>}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
