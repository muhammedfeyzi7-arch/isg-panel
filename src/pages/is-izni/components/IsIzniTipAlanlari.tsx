import type { IsIzniTip } from '@/types';

interface Props {
  tip: IsIzniTip;
  form: Record<string, string | boolean | number>;
  onChange: (field: string, value: string | boolean | number) => void;
  inp: string;
}

// Tip bazlı ek alanlar
const TIP_ALANLARI: Record<IsIzniTip, { field: string; label: string; placeholder: string; type?: string }[]> = {
  'Sıcak Çalışma': [
    { field: 'atesBolgesi', label: 'Ateş / Kıvılcım Bölgesi', placeholder: 'Çalışma yapılacak alan...' },
    { field: 'yanginSondurme', label: 'Yangın Söndürme Ekipmanı', placeholder: 'Yangın tüpü, hortum...' },
    { field: 'gazOlcum', label: 'Gaz Ölçüm Sonucu', placeholder: 'LEL %, O2 %, CO ppm...' },
    { field: 'nobetci', label: 'Nöbetçi Kişi', placeholder: 'Yangın nöbetçisi adı...' },
  ],
  'Yüksekte Çalışma': [
    { field: 'yukseklik', label: 'Çalışma Yüksekliği (m)', placeholder: '5.5', type: 'number' },
    { field: 'iskeleTipi', label: 'İskele / Platform Tipi', placeholder: 'Seyyar iskele, merdiven...' },
    { field: 'emniyet', label: 'Emniyet Kemeri Tipi', placeholder: 'Tam vücut emniyet kemeri...' },
    { field: 'ankraj', label: 'Ankraj Noktası', placeholder: 'Bağlantı noktası konumu...' },
  ],
  'Kapalı Alan': [
    { field: 'alanBoyutu', label: 'Alan Boyutu / Hacmi', placeholder: 'Uzunluk x Genişlik x Yükseklik...' },
    { field: 'havalandirma', label: 'Havalandırma Yöntemi', placeholder: 'Mekanik havalandırma, fan...' },
    { field: 'oksijen', label: 'Oksijen Seviyesi (%)', placeholder: '20.9', type: 'number' },
    { field: 'kurtarmaEkip', label: 'Kurtarma Ekibi', placeholder: 'Dışarıda bekleyen kişiler...' },
  ],
  'Elektrikli Çalışma': [
    { field: 'gerilim', label: 'Gerilim Seviyesi (V)', placeholder: '380', type: 'number' },
    { field: 'devreDisi', label: 'Devre Dışı Bırakma Yöntemi', placeholder: 'Kilit-etiket prosedürü...' },
    { field: 'yalitim', label: 'Yalıtım Ekipmanı', placeholder: 'Yalıtımlı eldiven, mat...' },
    { field: 'elektrikci', label: 'Yetkili Elektrikçi', placeholder: 'Ad Soyad...' },
  ],
  'Kazı': [
    { field: 'kazıDerinligi', label: 'Kazı Derinliği (m)', placeholder: '2.5', type: 'number' },
    { field: 'zeminTipi', label: 'Zemin Tipi', placeholder: 'Kil, kum, kaya...' },
    { field: 'iksa', label: 'İksa / Destekleme Yöntemi', placeholder: 'Ahşap iksa, çelik boru...' },
    { field: 'altyapi', label: 'Altyapı Tespiti', placeholder: 'Boru, kablo konumları...' },
  ],
  'Genel': [],
};

export default function IsIzniTipAlanlari({ tip, form, onChange, inp }: Props) {
  const alanlar = TIP_ALANLARI[tip] ?? [];
  if (alanlar.length === 0) return null;

  const tipConfig: Record<IsIzniTip, { color: string; bg: string; icon: string }> = {
    'Sıcak Çalışma':      { color: '#F97316', bg: 'rgba(249,115,22,0.08)', icon: 'ri-fire-line' },
    'Yüksekte Çalışma':   { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', icon: 'ri-arrow-up-line' },
    'Kapalı Alan':        { color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)', icon: 'ri-door-closed-line' },
    'Elektrikli Çalışma': { color: '#EAB308', bg: 'rgba(234,179,8,0.08)',  icon: 'ri-flashlight-line' },
    'Kazı':               { color: '#A16207', bg: 'rgba(161,98,7,0.08)',   icon: 'ri-tools-line' },
    'Genel':              { color: '#64748B', bg: 'rgba(100,116,139,0.08)', icon: 'ri-file-shield-2-line' },
  };

  const cfg = tipConfig[tip];

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ background: cfg.bg, border: `1px solid ${cfg.color}25` }}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: `${cfg.color}20` }}>
          <i className={`${cfg.icon} text-sm`} style={{ color: cfg.color }} />
        </div>
        <p className="text-[12px] font-bold" style={{ color: cfg.color }}>{tip} — Özel Alanlar</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {alanlar.map(alan => (
          <div key={alan.field}>
            <label className="form-label">{alan.label}</label>
            <input
              type={alan.type ?? 'text'}
              value={String(form[alan.field] ?? '')}
              onChange={e => onChange(alan.field, e.target.value)}
              placeholder={alan.placeholder}
              className={inp}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
