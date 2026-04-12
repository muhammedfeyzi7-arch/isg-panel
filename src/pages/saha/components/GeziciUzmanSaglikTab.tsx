import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/AuthContext';

const ACCENT = '#0EA5E9';

interface SaglikKayit {
  id: string;
  personelAdSoyad: string;
  firmaAd: string;
  sonuc: string; // Çalışabilir | Kısıtlı Çalışabilir | Çalışamaz
  muayeneTarihi: string;
  sonrakiTarih: string;
}

interface GeziciUzmanSaglikTabProps {
  atanmisFirmaIds: string[];
}

const SONUC_STYLE: Record<string, { bg: string; color: string; border: string; icon: string }> = {
  'Çalışabilir': { bg: 'rgba(14,165,233,0.1)', color: '#0EA5E9', border: 'rgba(14,165,233,0.25)', icon: 'ri-checkbox-circle-line' },
  'Kısıtlı Çalışabilir': { bg: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: 'rgba(245,158,11,0.25)', icon: 'ri-alert-line' },
  'Çalışamaz': { bg: 'rgba(239,68,68,0.1)', color: '#EF4444', border: 'rgba(239,68,68,0.25)', icon: 'ri-close-circle-line' },
};

type FilterKey = 'tumu' | 'Çalışabilir' | 'Kısıtlı Çalışabilir' | 'Çalışamaz';

export default function GeziciUzmanSaglikTab({ atanmisFirmaIds }: GeziciUzmanSaglikTabProps) {
  const { user } = useAuth();
  const [kayitlar, setKayitlar] = useState<SaglikKayit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('tumu');

  const loadKayitlar = useCallback(async () => {
    if (!user?.id || atanmisFirmaIds.length === 0) {
      setKayitlar([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Aynı firmaya atanmış isyeri_hekimi'nin girdiği muayeneleri çek
      // Sadece isim soyisim, firma ve çalışır/çalışamaz durumu gösterilecek
      const safeIds = atanmisFirmaIds.filter(Boolean);

      // Firma adlarını çek
      const { data: orgsData } = await supabase
        .from('organizations')
        .select('id, name')
        .in('id', safeIds);
      const firmaAdMap: Record<string, string> = {};
      (orgsData ?? []).forEach(o => { firmaAdMap[o.id] = o.name; });

      const allKayitlar: SaglikKayit[] = [];
      await Promise.all(safeIds.map(async (firmaId) => {
        // Personel adlarını çek
        const { data: personelRows } = await supabase
          .from('personeller')
          .select('id, data')
          .eq('organization_id', firmaId)
          .is('deleted_at', null);
        const personelAdMap: Record<string, string> = {};
        (personelRows ?? []).forEach(r => {
          const d = r.data as Record<string, unknown>;
          personelAdMap[r.id] = (d.adSoyad as string) ?? 'Bilinmiyor';
        });

        // Muayeneleri çek
        const { data: mRows } = await supabase
          .from('muayeneler')
          .select('id, data')
          .eq('organization_id', firmaId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        (mRows ?? []).forEach(m => {
          const d = m.data as Record<string, unknown>;
          const sonuc = (d.sonuc as string) ?? '';
          // Sadece çalışabilir durumu olan kayıtlar dahil et
          if (!sonuc) return;
          allKayitlar.push({
            id: m.id,
            personelAdSoyad: personelAdMap[(d.personelId as string) ?? ''] ?? 'Bilinmiyor',
            firmaAd: firmaAdMap[firmaId] ?? firmaId,
            sonuc,
            muayeneTarihi: (d.muayeneTarihi as string) ?? '',
            sonrakiTarih: (d.sonrakiTarih as string) ?? '',
          });
        });
      }));

      // Tarihe göre sırala
      allKayitlar.sort((a, b) => new Date(b.muayeneTarihi).getTime() - new Date(a.muayeneTarihi).getTime());
      setKayitlar(allKayitlar);
    } catch (err) {
      console.error('[GeziciUzmanSaglikTab]', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, atanmisFirmaIds]);

  useEffect(() => { loadKayitlar(); }, [loadKayitlar]);

  const filtered = kayitlar.filter(k => {
    const matchSearch = k.personelAdSoyad.toLowerCase().includes(search.toLowerCase())
      || k.firmaAd.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'tumu' || k.sonuc === filter;
    return matchSearch && matchFilter;
  });

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const calisabilir = kayitlar.filter(k => k.sonuc === 'Çalışabilir').length;
  const kisitli = kayitlar.filter(k => k.sonuc === 'Kısıtlı Çalışabilir').length;
  const calisamaz = kayitlar.filter(k => k.sonuc === 'Çalışamaz').length;

  const filterOptions: { key: FilterKey; label: string }[] = [
    { key: 'tumu', label: 'Tümü' },
    { key: 'Çalışabilir', label: 'Çalışabilir' },
    { key: 'Kısıtlı Çalışabilir', label: 'Kısıtlı' },
    { key: 'Çalışamaz', label: 'Çalışamaz' },
  ];

  return (
    <div className="space-y-4">
      {/* Başlık */}
      <div className="flex items-start gap-3 p-4 rounded-xl mb-1"
        style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.2)' }}>
        <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
          style={{ background: 'rgba(14,165,233,0.12)' }}>
          <i className="ri-information-line text-base" style={{ color: ACCENT }} />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            İşyeri Hekimi Verileri
          </p>
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#64748B' }}>
            Bu sekmede yalnızca atanmış işyeri hekiminin girdiği muayene sonuçları görüntülenmektedir.
            Sadece isim, firma ve çalışma durumu bilgileri gösterilmektedir.
          </p>
        </div>
      </div>

      {/* KPI */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { label: 'Toplam', value: kayitlar.length, color: ACCENT, bg: 'rgba(14,165,233,0.08)', icon: 'ri-stethoscope-line' },
            { label: 'Çalışabilir', value: calisabilir, color: '#0EA5E9', bg: 'rgba(14,165,233,0.08)', icon: 'ri-checkbox-circle-line' },
            { label: 'Kısıtlı', value: kisitli, color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', icon: 'ri-alert-line' },
            { label: 'Çalışamaz', value: calisamaz, color: '#EF4444', bg: 'rgba(239,68,68,0.08)', icon: 'ri-close-circle-line' },
          ].map(kpi => (
            <div key={kpi.label} className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ background: kpi.bg, border: `1px solid ${kpi.color}22` }}>
              <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
                style={{ background: `${kpi.color}18` }}>
                <i className={`${kpi.icon} text-sm`} style={{ color: kpi.color }} />
              </div>
              <div>
                <p className="text-xl font-extrabold leading-none" style={{ color: kpi.color }}>{kpi.value}</p>
                <p className="text-[10px] font-semibold mt-0.5" style={{ color: '#64748B' }}>{kpi.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filtre + Arama */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#64748B' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="İsim veya firma ara..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl outline-none"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.08)', color: 'var(--text-primary)' }}
            onFocus={e => { e.currentTarget.style.borderColor = ACCENT; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {filterOptions.map(opt => (
            <button key={opt.key} onClick={() => setFilter(opt.key)}
              className="whitespace-nowrap px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-all"
              style={{
                background: filter === opt.key ? 'rgba(14,165,233,0.12)' : 'rgba(255,255,255,0.04)',
                color: filter === opt.key ? ACCENT : '#64748B',
                border: `1px solid ${filter === opt.key ? 'rgba(14,165,233,0.3)' : 'rgba(255,255,255,0.08)'}`,
              }}>
              {opt.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg ml-auto"
          style={{ background: 'rgba(255,255,255,0.05)', color: '#64748B' }}>
          {filtered.length} kayıt
        </span>
      </div>

      {/* Loading */}
      {loading && (
        <div className="rounded-xl p-10 flex items-center justify-center gap-2"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <i className="ri-loader-4-line animate-spin text-lg" style={{ color: ACCENT }} />
          <span className="text-sm" style={{ color: '#64748B' }}>Yükleniyor...</span>
        </div>
      )}

      {/* Boş state */}
      {!loading && filtered.length === 0 && (
        <div className="rounded-xl p-12 flex flex-col items-center gap-4 text-center"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="w-14 h-14 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(14,165,233,0.08)', border: '1.5px solid rgba(14,165,233,0.15)' }}>
            <i className="ri-heart-pulse-line text-2xl" style={{ color: ACCENT }} />
          </div>
          <div>
            <p className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Kayıt bulunamadı</p>
            <p className="text-xs" style={{ color: '#64748B' }}>
              {search ? 'Farklı bir arama deneyin' : 'Henüz işyeri hekimi tarafından muayene kaydı girilmemiş.'}
            </p>
          </div>
        </div>
      )}

      {/* Tablo */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-2">
          {/* Başlık satırı */}
          <div className="grid px-4 py-2 rounded-xl"
            style={{
              gridTemplateColumns: '2fr 1.5fr 1.2fr 1fr',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}>
            {['PERSONEL', 'FİRMA', 'MUAYENE TARİHİ', 'DURUM'].map(h => (
              <span key={h} className="text-[10px] font-bold tracking-wider" style={{ color: '#475569' }}>{h}</span>
            ))}
          </div>

          {filtered.map(k => {
            const style = SONUC_STYLE[k.sonuc] ?? SONUC_STYLE['Çalışabilir'];
            return (
              <div key={k.id}
                className="grid items-center px-4 py-3 rounded-xl"
                style={{
                  gridTemplateColumns: '2fr 1.5fr 1.2fr 1fr',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}>
                {/* Personel */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #0284C7, #0EA5E9)' }}>
                    {k.personelAdSoyad.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {k.personelAdSoyad}
                  </span>
                </div>

                {/* Firma */}
                <span className="text-xs font-semibold truncate" style={{ color: ACCENT }}>
                  {k.firmaAd}
                </span>

                {/* Tarih */}
                <span className="text-xs" style={{ color: '#64748B' }}>
                  {formatDate(k.muayeneTarihi)}
                </span>

                {/* Durum */}
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap"
                  style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>
                  <i className={`${style.icon} text-[9px]`} />
                  {k.sonuc}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
