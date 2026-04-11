import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface MuayeneRow {
  id: string;
  personelAd: string;
  personelId: string;
  firmaAd: string;
  firmaId: string;
  muayeneTarihi: string;
  sonrakiTarih: string;
  sonuc: string;
  hastane: string;
  doktor: string;
  notlar: string;
}

interface HekimSaglikTabProps {
  atanmisFirmaIds: string[];
  isDark: boolean;
}

type FilterKey = 'tumu' | 'Çalışabilir' | 'Kısıtlı Çalışabilir' | 'Çalışamaz';

export default function HekimSaglikTab({ atanmisFirmaIds, isDark }: HekimSaglikTabProps) {
  const [muayeneler, setMuayeneler] = useState<MuayeneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('tumu');

  const textPrimary = 'var(--text-primary)';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';

  const card: React.CSSProperties = {
    background: isDark
      ? 'linear-gradient(145deg, rgba(30,41,59,0.95), rgba(15,23,42,0.98))'
      : 'linear-gradient(145deg, rgba(255,255,255,0.98), rgba(248,250,252,0.95))',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)'}`,
    borderRadius: '20px',
  };

  useEffect(() => {
    if (atanmisFirmaIds.length === 0) {
      setMuayeneler([]);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        // GÜVENLİK: Sadece atanmisFirmaIds içindeki firma ID'leri kullanılır
        const safeIds = atanmisFirmaIds.filter(id => typeof id === 'string' && id.length > 0);
        if (safeIds.length === 0) { setMuayeneler([]); setLoading(false); return; }

        const { data: orgs } = await supabase
          .from('organizations')
          .select('id, name')
          .in('id', safeIds);

        const firmaAdMap: Record<string, string> = {};
        (orgs ?? []).forEach(o => { firmaAdMap[o.id] = o.name; });

        const allMuayeneler: MuayeneRow[] = [];

        await Promise.all(
          safeIds.map(async (firmaId) => {
            // Personel isimlerini çek
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
              allMuayeneler.push({
                id: m.id,
                personelId: (d.personelId as string) ?? '',
                personelAd: personelAdMap[(d.personelId as string) ?? ''] ?? 'Bilinmiyor',
                firmaAd: firmaAdMap[firmaId] ?? firmaId,
                firmaId,
                muayeneTarihi: (d.muayeneTarihi as string) ?? '',
                sonrakiTarih: (d.sonrakiTarih as string) ?? '',
                sonuc: (d.sonuc as string) ?? '',
                hastane: (d.hastane as string) ?? '',
                doktor: (d.doktor as string) ?? '',
                notlar: (d.notlar as string) ?? '',
              });
            });
          })
        );

        // Tarihe göre sırala (yeniden eskiye)
        allMuayeneler.sort((a, b) =>
          new Date(b.muayeneTarihi).getTime() - new Date(a.muayeneTarihi).getTime()
        );

        setMuayeneler(allMuayeneler);
      } catch (err) {
        console.error('[HekimSaglikTab] load error:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [atanmisFirmaIds]);

  const filtered = muayeneler.filter(m => {
    const matchSearch =
      m.personelAd.toLowerCase().includes(search.toLowerCase()) ||
      m.firmaAd.toLowerCase().includes(search.toLowerCase()) ||
      m.hastane.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'tumu' || m.sonuc === filter;
    return matchSearch && matchFilter;
  });

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getDaysUntil = (dateStr: string): number | null => {
    if (!dateStr) return null;
    return Math.ceil((new Date(dateStr).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  };

  const getSonucStyle = (sonuc: string): { bg: string; color: string; border: string } => {
    if (sonuc === 'Çalışabilir') return { bg: 'rgba(16,185,129,0.1)', color: '#10B981', border: 'rgba(16,185,129,0.2)' };
    if (sonuc === 'Kısıtlı Çalışabilir') return { bg: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: 'rgba(245,158,11,0.2)' };
    return { bg: 'rgba(239,68,68,0.1)', color: '#EF4444', border: 'rgba(239,68,68,0.2)' };
  };

  // KPI
  const totalMuayene = muayeneler.length;
  const calisabilir = muayeneler.filter(m => m.sonuc === 'Çalışabilir').length;
  const kisitli = muayeneler.filter(m => m.sonuc === 'Kısıtlı Çalışabilir').length;
  const calisamaz = muayeneler.filter(m => m.sonuc === 'Çalışamaz').length;

  const yaklasiyor = muayeneler.filter(m => {
    const d = getDaysUntil(m.sonrakiTarih);
    return d !== null && d >= 0 && d <= 30;
  }).length;

  const filterOptions: { key: FilterKey; label: string }[] = [
    { key: 'tumu', label: 'Tümü' },
    { key: 'Çalışabilir', label: 'Çalışabilir' },
    { key: 'Kısıtlı Çalışabilir', label: 'Kısıtlı' },
    { key: 'Çalışamaz', label: 'Çalışamaz' },
  ];

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div>
        <h2 className="text-lg font-bold" style={{ color: textPrimary, letterSpacing: '-0.02em' }}>Sağlık Takibi</h2>
        <p className="text-xs mt-0.5" style={{ color: textSecondary }}>
          Tüm firmalardaki periyodik muayene kayıtları
        </p>
      </div>

      {/* ── KPI Kartları ── */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Toplam Muayene', value: totalMuayene, color: '#0EA5E9', bg: 'rgba(14,165,233,0.08)', icon: 'ri-stethoscope-line' },
            { label: 'Çalışabilir', value: calisabilir, color: '#10B981', bg: 'rgba(16,185,129,0.08)', icon: 'ri-checkbox-circle-line' },
            { label: 'Kısıtlı', value: kisitli, color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', icon: 'ri-alert-line' },
            { label: 'Yaklaşan (30g)', value: yaklasiyor, color: '#EF4444', bg: 'rgba(239,68,68,0.08)', icon: 'ri-calendar-event-line' },
          ].map(kpi => (
            <div
              key={kpi.label}
              className="rounded-2xl p-4"
              style={{ background: kpi.bg, border: `1px solid ${kpi.color}22` }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
                  style={{ background: `${kpi.color}18` }}>
                  <i className={`${kpi.icon} text-sm`} style={{ color: kpi.color }} />
                </div>
              </div>
              <p className="text-2xl font-extrabold" style={{ color: kpi.color, letterSpacing: '-0.04em' }}>{kpi.value}</p>
              <p className="text-[10px] font-semibold mt-0.5" style={{ color: textSecondary }}>{kpi.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Filtre + Arama ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-sm" style={{ color: textSecondary }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Personel, firma, hastane..."
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl outline-none transition-all"
            style={{
              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)',
              border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.09)'}`,
              color: textPrimary,
            }}
            onFocus={e => { e.currentTarget.style.borderColor = '#0EA5E9'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.1)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.09)'; e.currentTarget.style.boxShadow = 'none'; }}
          />
        </div>

        {/* Sonuç filtreleri */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {filterOptions.map(opt => (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              className="whitespace-nowrap px-3 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer transition-all"
              style={{
                background: filter === opt.key ? 'rgba(14,165,233,0.15)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)'),
                color: filter === opt.key ? '#0EA5E9' : textSecondary,
                border: `1px solid ${filter === opt.key ? 'rgba(14,165,233,0.3)' : (isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.09)')}`,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <span className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg ml-auto"
          style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', color: textSecondary }}>
          {filtered.length} kayıt
        </span>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-2xl p-4 animate-pulse" style={card}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)' }} />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 rounded" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)' }} />
                  <div className="h-3 w-28 rounded" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Boş state ── */}
      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl p-14 flex flex-col items-center gap-5" style={card}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(14,165,233,0.08)', border: '1.5px solid rgba(14,165,233,0.15)' }}>
            <i className="ri-heart-pulse-line text-2xl" style={{ color: '#0EA5E9' }} />
          </div>
          <div className="text-center">
            <p className="text-base font-bold mb-2" style={{ color: textPrimary }}>Muayene kaydı bulunamadı</p>
            <p className="text-sm" style={{ color: textSecondary }}>
              {search ? 'Farklı bir arama terimi deneyin' : 'Atanmış firmalarınızda henüz muayene kaydı yok.'}
            </p>
          </div>
        </div>
      )}

      {/* ── Liste ── */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((m, idx) => {
            const sonucStyle = getSonucStyle(m.sonuc);
            const daysUntil = getDaysUntil(m.sonrakiTarih);
            const isYaklasiyor = daysUntil !== null && daysUntil >= 0 && daysUntil <= 30;
            const isGecmis = daysUntil !== null && daysUntil < 0;

            return (
              <div
                key={m.id}
                className="rounded-2xl p-4"
                style={{
                  ...card,
                  animation: `fadeSlideIn 0.3s ease ${idx * 0.03}s both`,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateX(3px)';
                  (e.currentTarget as HTMLElement).style.borderColor = isDark ? 'rgba(14,165,233,0.2)' : 'rgba(14,165,233,0.25)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateX(0)';
                  (e.currentTarget as HTMLElement).style.borderColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)';
                }}
              >
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-white"
                    style={{ background: `linear-gradient(135deg, ${sonucStyle.color}, ${sonucStyle.color}cc)` }}
                  >
                    {m.personelAd.charAt(0).toUpperCase()}
                  </div>

                  {/* Bilgiler */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold" style={{ color: textPrimary }}>{m.personelAd}</p>
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: sonucStyle.bg, color: sonucStyle.color, border: `1px solid ${sonucStyle.border}` }}
                      >
                        {m.sonuc}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-[11px]" style={{ color: '#0EA5E9', fontWeight: 600 }}>
                        <i className="ri-building-3-line mr-1 text-[10px]" />
                        {m.firmaAd}
                      </span>
                      {m.hastane && (
                        <>
                          <span style={{ color: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(15,23,42,0.2)', fontSize: '10px' }}>·</span>
                          <span className="text-[11px]" style={{ color: textSecondary }}>
                            <i className="ri-hospital-line mr-1 text-[10px]" />
                            {m.hastane}
                          </span>
                        </>
                      )}
                      <span style={{ color: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(15,23,42,0.2)', fontSize: '10px' }}>·</span>
                      <span className="text-[11px]" style={{ color: textSecondary }}>
                        <i className="ri-calendar-line mr-1 text-[10px]" />
                        {formatDate(m.muayeneTarihi)}
                      </span>
                    </div>
                  </div>

                  {/* Sonraki muayene */}
                  <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                    <p className="text-[10px] font-medium" style={{ color: textSecondary }}>Sonraki</p>
                    {m.sonrakiTarih ? (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full"
                        style={
                          isGecmis
                            ? { background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }
                            : isYaklasiyor
                            ? { background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }
                            : { background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', color: textSecondary, border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)'}` }
                        }
                      >
                        {isGecmis ? <><i className="ri-error-warning-line" /> Geçti</> : formatDate(m.sonrakiTarih)}
                      </span>
                    ) : (
                      <span className="text-[10px]" style={{ color: textSecondary }}>—</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateX(-6px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
