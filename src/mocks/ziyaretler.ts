export interface MockZiyaret {
  id: string;
  uzman_id: string;
  uzman_ad: string;
  uzman_email: string;
  firma_id: string;
  firma_ad: string;
  giris_saati: string; // ISO
  cikis_saati: string | null;
  durum: 'aktif' | 'tamamlandi';
  konum_lat: number | null;
  konum_lng: number | null;
  notlar: string;
  qr_ile_giris: boolean;
}

const now = new Date();
const today = now.toISOString().split('T')[0];

function dt(hh: number, mm: number, daysAgo = 0): string {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}

export const mockZiyaretler: MockZiyaret[] = [
  {
    id: 'z1',
    uzman_id: 'u1',
    uzman_ad: 'Ahmet Yılmaz',
    uzman_email: 'ahmet@osgb.com',
    firma_id: 'f1',
    firma_ad: 'ABC Tekstil A.Ş.',
    giris_saati: dt(8, 15),
    cikis_saati: null,
    durum: 'aktif',
    konum_lat: 41.015137,
    konum_lng: 28.979530,
    notlar: 'Makine güvenlik kontrolleri yapılıyor. Acil çıkış kapıları denetlendi.',
    qr_ile_giris: true,
  },
  {
    id: 'z2',
    uzman_id: 'u2',
    uzman_ad: 'Fatma Kaya',
    uzman_email: 'fatma@osgb.com',
    firma_id: 'f2',
    firma_ad: 'Güneş Metal San.',
    giris_saati: dt(9, 0),
    cikis_saati: null,
    durum: 'aktif',
    konum_lat: 41.032337,
    konum_lng: 28.901543,
    notlar: 'Yeni işe başlayan personellerin oryantasyon eğitimi. 12 kişi katıldı.',
    qr_ile_giris: false,
  },
  {
    id: 'z3',
    uzman_id: 'u3',
    uzman_ad: 'Mehmet Demir',
    uzman_email: 'mehmet@osgb.com',
    firma_id: 'f3',
    firma_ad: 'Delta Lojistik Ltd.',
    giris_saati: dt(7, 30),
    cikis_saati: dt(11, 45),
    durum: 'tamamlandi',
    konum_lat: 40.987654,
    konum_lng: 29.012340,
    notlar: 'Depo yangın söndürme sistemleri kontrol edildi. 3 adet bozuk söndürücü tespit edildi ve rapor hazırlandı.',
    qr_ile_giris: true,
  },
  {
    id: 'z4',
    uzman_id: 'u1',
    uzman_ad: 'Ahmet Yılmaz',
    uzman_email: 'ahmet@osgb.com',
    firma_id: 'f4',
    firma_ad: 'Yıldız Gıda A.Ş.',
    giris_saati: dt(8, 0, 1),
    cikis_saati: dt(14, 30, 1),
    durum: 'tamamlandi',
    konum_lat: 41.05,
    konum_lng: 28.95,
    notlar: 'Üretim hattı ISG denetimi tamamlandı. Kişisel koruyucu donanım eksiklikleri giderildi.',
    qr_ile_giris: true,
  },
  {
    id: 'z5',
    uzman_id: 'u2',
    uzman_ad: 'Fatma Kaya',
    uzman_email: 'fatma@osgb.com',
    firma_id: 'f1',
    firma_ad: 'ABC Tekstil A.Ş.',
    giris_saati: dt(9, 30, 1),
    cikis_saati: dt(12, 0, 1),
    durum: 'tamamlandi',
    konum_lat: 41.015137,
    konum_lng: 28.979530,
    notlar: 'Periyodik sağlık muayeneleri organize edildi. Hekim ziyareti planlandı.',
    qr_ile_giris: false,
  },
  {
    id: 'z6',
    uzman_id: 'u3',
    uzman_ad: 'Mehmet Demir',
    uzman_email: 'mehmet@osgb.com',
    firma_id: 'f5',
    firma_ad: 'Mavi Kimya San.',
    giris_saati: dt(10, 0, 1),
    cikis_saati: dt(15, 30, 1),
    durum: 'tamamlandi',
    konum_lat: 40.921,
    konum_lng: 29.133,
    notlar: 'Kimyasal madde depolama alanı denetlendi. MSDS formları güncellendi.',
    qr_ile_giris: false,
  },
  {
    id: 'z7',
    uzman_id: 'u2',
    uzman_ad: 'Fatma Kaya',
    uzman_email: 'fatma@osgb.com',
    firma_id: 'f3',
    firma_ad: 'Delta Lojistik Ltd.',
    giris_saati: dt(8, 45, 2),
    cikis_saati: dt(13, 15, 2),
    durum: 'tamamlandi',
    konum_lat: 40.987654,
    konum_lng: 29.012340,
    notlar: 'Forklift operatörü güvenlik eğitimi. Sertifika yenileme süreçleri tamamlandı.',
    qr_ile_giris: true,
  },
  {
    id: 'z8',
    uzman_id: 'u1',
    uzman_ad: 'Ahmet Yılmaz',
    uzman_email: 'ahmet@osgb.com',
    firma_id: 'f2',
    firma_ad: 'Güneş Metal San.',
    giris_saati: dt(7, 0, 2),
    cikis_saati: dt(12, 30, 2),
    durum: 'tamamlandi',
    konum_lat: 41.032337,
    konum_lng: 28.901543,
    notlar: 'Elektrik panoları ve topraklama sistemleri kontrol edildi. Uygunsuzluk raporu düzenlendi.',
    qr_ile_giris: false,
  },
];

export const mockUzmanlar = [
  { id: 'u1', ad: 'Ahmet Yılmaz' },
  { id: 'u2', ad: 'Fatma Kaya' },
  { id: 'u3', ad: 'Mehmet Demir' },
];

export const mockFirmalar = [
  { id: 'f1', ad: 'ABC Tekstil A.Ş.' },
  { id: 'f2', ad: 'Güneş Metal San.' },
  { id: 'f3', ad: 'Delta Lojistik Ltd.' },
  { id: 'f4', ad: 'Yıldız Gıda A.Ş.' },
  { id: 'f5', ad: 'Mavi Kimya San.' },
];
