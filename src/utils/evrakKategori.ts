/**
 * Evrak Kategori Sistemi
 *
 * Tüm modüllerde (CategorizedEvraklar, PersonelDetayModal vb.) aynı
 * kategori mantığının kullanılmasını garanti eder.
 *
 * Öncelik sırası:
 *  1. Doğrudan tur → kategori eşleştirmesi  (en güvenilir)
 *  2. Keyword tabanlı fallback               (bilinmeyen türler için)
 */

export type EvrakKategoriId = 'kimlik' | 'saglik' | 'egitim' | 'sertifika' | 'diger';

export interface EvrakKategoriMeta {
  id: EvrakKategoriId;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

/** Mevcut EVRAK_TURLERI listesiyle bire bir eşleşen direkt mapping */
export const TUR_TO_KATEGORI: Record<string, EvrakKategoriId> = {
  // Kimlik
  'Kimlik': 'kimlik',
  // Sağlık
  'EK-2': 'saglik',
  'Sağlık Raporu': 'saglik',
  // Sürücü / Lisans / Sertifika
  'Sürücü Belgesi': 'sertifika',
  'SRC': 'sertifika',
  'Sertifika / MYK / Diploma': 'sertifika',
  // Eğitim
  'Oryantasyon Eğitimi': 'egitim',
  'İşbaşı Eğitimi': 'egitim',
  // Diğer
  'İş Sözleşmesi': 'diger',
  'Diğer': 'diger',
};

/** Bilinmeyen türler için keyword tabanlı fallback */
const KEYWORD_MAP: Array<{ id: EvrakKategoriId; keywords: string[] }> = [
  {
    id: 'kimlik',
    keywords: ['kimlik', 'tc', 'nüfus', 'nufus', 'pasaport', 'ehliyet', 'vatandaşlık', 'vatandaslik'],
  },
  {
    id: 'saglik',
    keywords: [
      'sağlık', 'saglik', 'muayene', 'rapor', 'periyodik',
      'tıbbi', 'tibbi', 'ek-2', 'ek2', 'hekim', 'muayene formu',
      'isg sağlık', 'sağlık raporu', 'işe giriş muayene',
    ],
  },
  {
    id: 'egitim',
    keywords: [
      'eğitim', 'egitim', 'kurs', 'seminer', 'oryantasyon',
      'training', 'işbaşı', 'isbaşı',
    ],
  },
  {
    id: 'sertifika',
    keywords: [
      'sertifika', 'lisans', 'yetki', 'izin', 'sts', 'src',
      'forklift', 'belge', 'myk', 'diploma', 'sürücü', 'suruc',
      'operatör belgesi',
    ],
  },
];

/**
 * Bir evrakın hangi kategoriye ait olduğunu döner.
 * @param tur   Evrak türü (örn: 'EK-2', 'Sağlık Raporu')
 * @param ad    Evrak adı (fallback arama için)
 */
export function getEvrakKategori(tur: string, ad = ''): EvrakKategoriId {
  // 1. Direkt eşleşme — en güvenilir
  const direct = TUR_TO_KATEGORI[tur];
  if (direct) return direct;

  // 2. Keyword eşleşmesi — tur veya ad'dan
  const text = `${tur} ${ad}`.toLowerCase();
  for (const { id, keywords } of KEYWORD_MAP) {
    if (keywords.some(kw => text.includes(kw))) return id;
  }

  return 'diger';
}

/** Kategori görsel meta verisi */
export const KATEGORI_META: Record<EvrakKategoriId, EvrakKategoriMeta> = {
  kimlik: {
    id: 'kimlik',
    label: 'Kimlik Belgeleri',
    icon: 'ri-id-card-line',
    color: '#60A5FA',
    bgColor: 'rgba(59,130,246,0.12)',
    borderColor: 'rgba(59,130,246,0.2)',
  },
  saglik: {
    id: 'saglik',
    label: 'Sağlık Evrakları',
    icon: 'ri-heart-pulse-line',
    color: '#F87171',
    bgColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.2)',
  },
  egitim: {
    id: 'egitim',
    label: 'Eğitim Belgeleri',
    icon: 'ri-graduation-cap-line',
    color: '#FCD34D',
    bgColor: 'rgba(245,158,11,0.12)',
    borderColor: 'rgba(245,158,11,0.2)',
  },
  sertifika: {
    id: 'sertifika',
    label: 'Sertifikalar',
    icon: 'ri-award-line',
    color: '#34D399',
    bgColor: 'rgba(16,185,129,0.12)',
    borderColor: 'rgba(16,185,129,0.2)',
  },
  diger: {
    id: 'diger',
    label: 'Diğer Belgeler',
    icon: 'ri-file-list-3-line',
    color: '#A78BFA',
    bgColor: 'rgba(139,92,246,0.12)',
    borderColor: 'rgba(139,92,246,0.2)',
  },
};

/** Sıralı kategori listesi (render sırası) */
export const KATEGORI_SIRASI: EvrakKategoriId[] = ['kimlik', 'saglik', 'egitim', 'sertifika', 'diger'];
