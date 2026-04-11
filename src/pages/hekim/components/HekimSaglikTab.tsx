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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const textPrimary = 'var(--text-primary)';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const tableBg = isDark ? 'rgba(20,30,50,0.98)' : '#ffffff';
  const tableHeadBg = isDark ? 'rgba(15,23,42,0.8)' : '#f8fafc';
  const borderColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)';
  const rowHoverBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(16,185,129,0.03)';

  useEffect(() => {
    if (atanmisFirmaIds.length === 0) { setMuayeneler([]); setLoading(false); return; }
    const load = async () => {
      setLoading(true);
      try {
        const safeIds = atanmisFirmaIds.filter(id => typeof id === 'string' && id.length > 0);
        if (safeIds.length === 0) { setMuayeneler([]); setLoading(false); return; }

        const { data: orgs } = await supabase.from('organizations').select('id, name').in('id', safeIds);
        const firmaAdMap: Record<string, string> = {};
        (orgs ?? []).forEach(o => { firmaAdMap[o.id] = o.name; });

        const allMuayeneler: MuayeneRow[] = [];
        await Promise.all(safeIds.map(async (firmaId) => {
          const { data: personelRows } = await supabase.from('personeller').select('id, data').eq('organization_id', firmaId).is('deleted_at', null);
          const personelAdMap: Record<string, string> = {};
          (personelRows ?? []).forEach(r => {
            const d = r.data as Record<string, unknown>;
            personelAdMap[r.id] = (d.adSoyad as string) ?? 'Bilinmiyor';
          });
          const { data: mRows } = await supabase.from('muayeneler').select('id, data').eq('organization_id', firmaId).is('deleted_at', null).order('created_at', { ascending: false });
          (mRows ?? []).forEach(m => {
            const d = m.data as Record<string, unknown>;
            allMuayeneler.push({
              id: m.id, personelId: (d.personelId as string) ?? '',
              personelAd: personelAdMap[(d.personelId as string) ?? ''] ?? 'Bilinmiyor',
              firmaAd: firmaAdMap[firmaId] ?? firmaId, firmaId,
              muayeneTarihi: (d.muayeneTarihi as string) ?? '',
              sonrakiTarih: (d.sonrakiTarih as string) ?? '',
              sonuc: (d.sonuc as string) ?? '',
              hastane: (d.hastane as string) ?? '',
              doktor: (d.doktor as string) ?? '',
              notlar: (d.notlar as string) ?? '',
            });
          });
        }));
        allMuayeneler.sort((a, b) => new Date(b.muayeneTarihi).getTime() - new Date(a.muayeneTarihi).getTime());
        setMuayeneler(allMuayeneler);
      } catch (err) { console.error('[HekimSaglikTab] load error:', err); }
      finally { setLoading(false); }
    };
    load();
  }, [atanmisFirmaIds]);

  const filtered = muayeneler.filter(m => {
    const matchSearch = m.personelAd.toLowerCase().includes(search.toLowerCase()) || m.firmaAd.toLowerCase().includes(search.toLowerCase()) || m.hastane.toLowerCase().includes(search.toLowerCase());
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

  const getSonucStyle = (sonuc: string) => {
    if (sonuc === 'Çalışabilir') return { bg: 'rgba(16,185,129,0.12)', color: '#10B981', border: 'rgba(16,185,129,0.25)' };
    if (sonuc === 'Kısıtlı Çalışabilir') return { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: 'rgba(245,158,11,0.25)' };
    return { bg: 'rgba(239,68,68,0.12)', color: '#EF4444', border: 'rgba(239,68,68,0.25)' };
  };

  const totalMuayene = muayeneler.length;
  const calisabilir = muayeneler.filter(m => m.sonuc === 'Çalışabilir').length;
  const kisitli = muayeneler.filter(m => m.sonuc === 'Kısıtlı Çalışabilir').length;
  const yaklasiyor = muayeneler.filter(m => { const d = getDaysUntil(m.sonrakiTarih); return d !== null && d >= 0 && d <= 30; }).length;

  const filterOptions: { key: FilterKey; label: string }[] = [
    { key: 'tumu', label: 'Tümü' },
    { key: 'Çalışabilir', label: 'Çalışabilir' },
    { key: 'Kısıtlı Çalışabilir', label: 'Kısıtlı' },
    { key: 'Çalışamaz', label: 'Çalışamaz' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold" style={{ color: textPrimary, letterSpacing: '-0.02em' }}>Sağlık Takibi</h2>
        <p className="text-xs mt-0.5" style={{ color: textSecondary }}>Tüm firmalardaki periyodik muayene kayıtları</p>
      </div>

      {/* KPI Satırı */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { label: 'Toplam', value: totalMuayene, color: '#10B981', bg: 'rgba(16,185,129,0.08)', icon: 'ri-stethoscope-line' },
            { label: 'Çalışabilir', value: calisabilir, color: '#10B981', bg: 'rgba(16,185,129,0.08)', icon: 'ri-checkbox-circle-line' },
            { label: 'Kısıtlı', value: kisitli, color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', icon: 'ri-alert-line' },
            { label: 'Yaklaşan (30g)', value: yaklasiyor, color: '#EF4444', bg: 'rgba(239,68,68,0.08)', icon: 'ri-calendar-event-line' },
          ].map(kpi => (
            <div key={kpi.label} className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ background: kpi.bg, border: `1px solid ${kpi.color}22` }}>
              <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: `${kpi.color}18` }}>
                <i className={`${kpi.icon} text-sm`} style={{ color: kpi.color }} />
              </div>
              <div>
                <p className="text-xl font-extrabold leading-none" style={{ color: kpi.color }}>{kpi.value}</p>
                <p className="text-[10px] font-semibold mt-0.5" style={{ color: textSecondary }}>{kpi.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filtre + Arama */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: textSecondary }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ara..." className="w-full pl-9 pr-3 py-2 text-sm rounded-xl outline-none"
            style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)', border: `1.5px solid ${borderColor}`, color: textPrimary }}
            onFocus={e => { e.currentTarget.style.borderColor = '#10B981'; }}
            onBlur={e => { e.currentTarget.style.borderColor = borderColor; }} />
        </div>
        <div className="flex items-center gap-1">
          {filterOptions.map(opt => (
            <button key={opt.key} onClick={() => setFilter(opt.key)}
              className="whitespace-nowrap px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-all"
              style={{
                background: filter === opt.key ? 'rgba(16,185,129,0.12)' : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)'),
                color: filter === opt.key ? '#10B981' : textSecondary,
                border: `1px solid ${filter === opt.key ? 'rgba(16,185,129,0.3)' : borderColor}`,
              }}>
              {opt.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg ml-auto"
          style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', color: textSecondary }}>
          {filtered.length} kayıt
        </span>
      </div>

      {/* Loading */}
      {loading && (
        <div className="rounded-xl p-10 flex items-center justify-center gap-2"
          style={{ background: tableBg, border: `1px solid ${borderColor}` }}>
          <i className="ri-loader-4-line animate-spin text-lg" style={{ color: '#10B981' }} />
          <span className="text-sm" style={{ color: textSecondary }}>Yükleniyor...</span>
        </div>
      )}

      {/* Boş state */}
      {!loading && filtered.length === 0 && (
        <div className="rounded-xl p-12 flex flex-col items-center gap-4 text-center"
          style={{ background: tableBg, border: `1px solid ${borderColor}` }}>
          <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.08)', border: '1.5px solid rgba(16,185,129,0.15)' }}>
            <i className="ri-heart-pulse-line text-2xl" style={{ color: '#10B981' }} />
          </div>
          <div>
            <p className="text-sm font-bold mb-1" style={{ color: textPrimary }}>Kayıt bulunamadı</p>
            <p className="text-xs" style={{ color: textSecondary }}>{search ? 'Farklı bir arama deneyin' : 'Henüz muayene kaydı yok.'}</p>
          </div>
        </div>
      )}

      {/* Tablo */}
      {!loading && filtered.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: tableBg, border: `1px solid ${borderColor}` }}>
          <div className="overflow-x-auto">
          {/* Tablo başlığı */}
          <div className="grid gap-0 min-w-[700px]"
            style={{ gridTemplateColumns: '2fr 1.2fr 1.2fr 1.2fr 1fr 80px', background: tableHeadBg, borderBottom: `1px solid ${borderColor}` }}>
            {['PERSONEL', 'FİRMA', 'MUAYENE TARİHİ', 'SONRAKİ TARİH', 'SONUÇ', 'İŞLEM'].map(h => (
              <div key={h} className="px-4 py-2.5">
                <span className="text-[10px] font-bold tracking-wider" style={{ color: textSecondary }}>{h}</span>
              </div>
            ))}
          </div>

          {/* Satırlar */}
          <div>
            {filtered.map((m, idx) => {
              const sonucStyle = getSonucStyle(m.sonuc);
              const daysUntil = getDaysUntil(m.sonrakiTarih);
              const isYaklasiyor = daysUntil !== null && daysUntil >= 0 && daysUntil <= 30;
              const isGecmis = daysUntil !== null && daysUntil < 0;
              const isExpanded = expandedId === m.id;

              return (
                <div key={m.id} style={{ borderBottom: idx < filtered.length - 1 ? `1px solid ${borderColor}` : 'none' }}>
                  <div
                    className="grid grid-cols-[2fr_1.2fr_1.2fr_1.2fr_1fr_80px] items-center cursor-pointer transition-all"
                    style={{ background: isExpanded ? (isDark ? 'rgba(16,185,129,0.05)' : 'rgba(16,185,129,0.03)') : 'transparent' }}
                    onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = rowHoverBg; }}
                    onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    onClick={() => setExpandedId(isExpanded ? null : m.id)}
                  >
                    {/* Personel */}
                    <div className="px-4 py-3 flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                        style={{ background: `linear-gradient(135deg, ${sonucStyle.color}, ${sonucStyle.color}cc)` }}>
                        {m.personelAd.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs font-semibold truncate" style={{ color: textPrimary }}>{m.personelAd}</span>
                    </div>

                    {/* Firma */}
                    <div className="px-4 py-3">
                      <span className="text-xs truncate" style={{ color: '#10B981', fontWeight: 600 }}>{m.firmaAd}</span>
                    </div>

                    {/* Muayene Tarihi */}
                    <div className="px-4 py-3">
                      <span className="text-xs" style={{ color: textSecondary }}>{formatDate(m.muayeneTarihi)}</span>
                    </div>

                    {/* Sonraki Tarih */}
                    <div className="px-4 py-3">
                      {m.sonrakiTarih ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={isGecmis
                            ? { background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }
                            : isYaklasiyor
                            ? { background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }
                            : { background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', color: textSecondary, border: `1px solid ${borderColor}` }
                          }>
                          {isGecmis ? <><i className="ri-error-warning-line text-[9px]" /> Geçti</> : formatDate(m.sonrakiTarih)}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: textSecondary }}>—</span>
                      )}
                    </div>

                    {/* Sonuç */}
                    <div className="px-4 py-3">
                      <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ background: sonucStyle.bg, color: sonucStyle.color, border: `1px solid ${sonucStyle.border}` }}>
                        {m.sonuc || '—'}
                      </span>
                    </div>

                    {/* İşlem */}
                    <div className="px-4 py-3 flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : m.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all"
                        style={{ background: isExpanded ? 'rgba(16,185,129,0.1)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'), border: `1px solid ${isExpanded ? 'rgba(16,185,129,0.3)' : borderColor}` }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.12)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(16,185,129,0.3)'; }}
                        onMouseLeave={e => { if (!isExpanded) { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'; (e.currentTarget as HTMLElement).style.borderColor = borderColor; } }}>
                        <i className={`${isExpanded ? 'ri-arrow-up-s-line' : 'ri-eye-line'} text-xs`} style={{ color: isExpanded ? '#10B981' : textSecondary }} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-5 py-3 flex flex-wrap gap-4"
                      style={{ background: isDark ? 'rgba(16,185,129,0.04)' : 'rgba(16,185,129,0.02)', borderTop: `1px solid rgba(16,185,129,0.12)` }}>
                      {[
                        { label: 'Hastane', value: m.hastane, icon: 'ri-hospital-line' },
                        { label: 'Doktor', value: m.doktor, icon: 'ri-user-heart-line' },
                        { label: 'Notlar', value: m.notlar, icon: 'ri-sticky-note-line' },
                      ].filter(f => f.value).map(f => (
                        <div key={f.label} className="flex items-center gap-2">
                          <div className="w-6 h-6 flex items-center justify-center rounded-lg" style={{ background: 'rgba(16,185,129,0.1)' }}>
                            <i className={`${f.icon} text-[10px]`} style={{ color: '#10B981' }} />
                          </div>
                          <div>
                            <p className="text-[9px] font-semibold" style={{ color: textSecondary }}>{f.label}</p>
                            <p className="text-xs font-medium" style={{ color: textPrimary }}>{f.value}</p>
                          </div>
                        </div>
                      ))}
                      {!m.hastane && !m.doktor && !m.notlar && (
                        <p className="text-xs" style={{ color: textSecondary }}>Ek bilgi bulunmuyor.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
