import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Props {
  atanmisFirmaIds: string[];
  isDark: boolean;
}

interface Firma {
  id: string;
  name: string;
  is_active?: boolean;
  created_at?: string;
}

interface FirmaStats {
  personel: number;
  ekipman: number;
  evrak: number;
  egitim: number;
}

interface PersonelRow {
  id: string;
  ad: string;
  gorev: string;
  durum: string;
}

interface EkipmanRow {
  id: string;
  ad: string;
  tur: string;
  durum: string;
}

interface DetailData {
  firma: Firma;
  stats: FirmaStats;
  personeller: PersonelRow[];
  ekipmanlar: EkipmanRow[];
}

const ACCENT = '#0EA5E9';

function getDurumColor(durum: string): string {
  if (['Aktif', 'Çalışıyor', 'Uygun', 'Onaylandı', 'Tamamlandı'].includes(durum)) return '#34D399';
  if (['Bakımda', 'Kısıtlı', 'Onay Bekliyor'].includes(durum)) return '#FBBF24';
  return '#F87171';
}

export default function UzmanFirmalar({ atanmisFirmaIds, isDark }: Props) {
  const [firmalar, setFirmalar] = useState<Firma[]>([]);
  const [firmaStats, setFirmaStats] = useState<Record<string, FirmaStats>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<DetailData | null>(null);
  const [detailTab, setDetailTab] = useState<'genel' | 'personel' | 'ekipman'>('genel');

  const card: React.CSSProperties = {
    background: isDark
      ? 'linear-gradient(145deg, rgba(30,41,59,0.95) 0%, rgba(15,23,42,0.98) 100%)'
      : 'linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.95) 100%)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)'}`,
    borderRadius: '20px',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  };

  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const subBorder = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)';
  const rowHover = isDark ? 'rgba(14,165,233,0.05)' : 'rgba(14,165,233,0.03)';

  const loadData = useCallback(async () => {
    if (atanmisFirmaIds.length === 0) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data: firmData } = await supabase
        .from('organizations')
        .select('id, name, created_at, is_active')
        .in('id', atanmisFirmaIds)
        .is('deleted_at', null)
        .eq('is_active', true);
      const list: Firma[] = (firmData ?? []).map(o => ({ id: o.id, name: o.name, is_active: o.is_active, created_at: o.created_at }));
      setFirmalar(list);

      const statsMap: Record<string, FirmaStats> = {};
      await Promise.all(list.map(async f => {
        const [{ count: p }, { count: e }, { count: ev }, { count: eg }] = await Promise.all([
          supabase.from('personeller').select('*', { count: 'exact', head: true }).eq('organization_id', f.id).is('deleted_at', null),
          supabase.from('ekipmanlar').select('*', { count: 'exact', head: true }).eq('organization_id', f.id).is('deleted_at', null),
          supabase.from('evraklar').select('*', { count: 'exact', head: true }).eq('organization_id', f.id).is('deleted_at', null),
          supabase.from('egitimler').select('*', { count: 'exact', head: true }).eq('organization_id', f.id).is('deleted_at', null),
        ]);
        statsMap[f.id] = { personel: p ?? 0, ekipman: e ?? 0, evrak: ev ?? 0, egitim: eg ?? 0 };
      }));
      setFirmaStats(statsMap);
    } catch (err) {
      console.error('[UzmanFirmalar]', err);
    } finally {
      setLoading(false);
    }
  }, [atanmisFirmaIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void loadData(); }, [loadData]);

  const openDetail = async (firma: Firma) => {
    setDetailData(null);
    setDetailTab('genel');
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const [{ data: pRaw }, { data: eRaw }, { count: evC }, { count: egC }] = await Promise.all([
        supabase.from('personeller').select('id, data').eq('organization_id', firma.id).is('deleted_at', null).limit(50),
        supabase.from('ekipmanlar').select('id, data').eq('organization_id', firma.id).is('deleted_at', null).limit(50),
        supabase.from('evraklar').select('*', { count: 'exact', head: true }).eq('organization_id', firma.id).is('deleted_at', null),
        supabase.from('egitimler').select('*', { count: 'exact', head: true }).eq('organization_id', firma.id).is('deleted_at', null),
      ]);
      const personeller: PersonelRow[] = (pRaw ?? []).map(r => {
        const d = (r.data ?? {}) as Record<string, unknown>;
        return { id: r.id as string, ad: (d.adSoyad as string) ?? '—', gorev: (d.gorev as string) ?? '—', durum: (d.durum as string) ?? '—' };
      });
      const ekipmanlar: EkipmanRow[] = (eRaw ?? []).map(r => {
        const d = (r.data ?? {}) as Record<string, unknown>;
        return { id: r.id as string, ad: (d.ad as string) ?? '—', tur: (d.tur as string) ?? '—', durum: (d.durum as string) ?? '—' };
      });
      setDetailData({
        firma,
        stats: { personel: pRaw?.length ?? 0, ekipman: eRaw?.length ?? 0, evrak: evC ?? 0, egitim: egC ?? 0 },
        personeller,
        ekipmanlar,
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const filtered = firmalar.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl animate-pulse" style={{ ...card, height: '320px' }} />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Ana Firma Tablosu ── */}
      <div className="rounded-2xl overflow-hidden" style={card}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4" style={{ borderBottom: `1px solid ${subBorder}` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.2), rgba(14,165,233,0.06))' }}>
              <i className="ri-building-2-fill text-sm" style={{ color: ACCENT }} />
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: textPrimary }}>Firmalar</h3>
              <p className="text-[10px]" style={{ color: textSecondary }}>
                {firmalar.length} firma · yalnızca görüntüleme yetkisi
              </p>
            </div>
          </div>
          {/* Arama */}
          <div className="relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: textSecondary }} />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Firma ara..."
              className="pl-9 pr-4 py-2 rounded-xl text-xs outline-none w-40 sm:w-52"
              style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)', border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'}`, color: textPrimary }}
              onFocus={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.1)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>
        </div>

        {/* Boş state */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-4 px-5">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.12)' }}>
              <i className="ri-building-2-line text-2xl" style={{ color: ACCENT }} />
            </div>
            <p className="text-sm font-bold" style={{ color: textPrimary }}>
              {searchQuery ? `"${searchQuery}" için sonuç yok` : 'Henüz firma atanmamış'}
            </p>
            <p className="text-xs text-center" style={{ color: textSecondary }}>
              OSGB admininizden firma ataması bekleniyor
            </p>
          </div>
        )}

        {/* Sütun başlıkları — desktop */}
        {filtered.length > 0 && (
          <>
            <div
              className="hidden md:grid grid-cols-[2.5fr_1fr_1fr_1fr_1fr_100px] items-center px-4 py-2"
              style={{ borderBottom: `1px solid ${subBorder}`, background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)' }}
            >
              {['FİRMA', 'PERSONEL', 'EKİPMAN', 'EVRAK', 'EĞİTİM', 'DETAY'].map(h => (
                <span key={h} className="text-[9px] font-bold tracking-wider uppercase" style={{ color: textSecondary }}>{h}</span>
              ))}
            </div>

            {/* Satırlar */}
            <div className="divide-y" style={{ borderColor: subBorder }}>
              {filtered.map(firma => {
                const stats = firmaStats[firma.id] ?? { personel: 0, ekipman: 0, evrak: 0, egitim: 0 };

                return (
                  <div key={firma.id}>
                    {/* Desktop satır */}
                    <div
                      className="hidden md:grid grid-cols-[2.5fr_1fr_1fr_1fr_1fr_100px] items-center px-4 py-3 transition-all"
                      style={{ background: 'transparent' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = rowHover; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      {/* Firma */}
                      <div className="flex items-center gap-2.5 min-w-0 pr-2 cursor-pointer" onClick={() => void openDetail(firma)}>
                        <div className="relative flex-shrink-0">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold text-white"
                            style={{ background: `linear-gradient(135deg, ${ACCENT}, #0284C7)` }}
                          >
                            {firma.name.charAt(0).toUpperCase()}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate" style={{ color: textPrimary }}>{firma.name}</p>
                          <span className="text-[9px]" style={{ color: firma.is_active ? '#22C55E' : textSecondary }}>
                            {firma.is_active ? 'Aktif firma' : 'Pasif firma'}
                          </span>
                        </div>
                      </div>

                      {/* Personel */}
                      <div className="cursor-pointer" onClick={() => void openDetail(firma)}>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', color: textSecondary, border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)'}` }}>
                          <i className="ri-group-line text-[9px]" />{stats.personel}
                        </span>
                      </div>

                      {/* Ekipman */}
                      <div className="cursor-pointer" onClick={() => void openDetail(firma)}>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', color: textSecondary, border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)'}` }}>
                          <i className="ri-tools-line text-[9px]" />{stats.ekipman}
                        </span>
                      </div>

                      {/* Evrak */}
                      <div className="cursor-pointer" onClick={() => void openDetail(firma)}>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', color: textSecondary, border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)'}` }}>
                          <i className="ri-file-list-3-line text-[9px]" />{stats.evrak}
                        </span>
                      </div>

                      {/* Eğitim */}
                      <div className="cursor-pointer" onClick={() => void openDetail(firma)}>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', color: textSecondary, border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)'}` }}>
                          <i className="ri-graduation-cap-line text-[9px]" />{stats.egitim}
                        </span>
                      </div>

                      {/* Detay butonu */}
                      <div className="flex justify-end">
                        <button
                          onClick={() => void openDetail(firma)}
                          title="Detay Gör"
                          className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all"
                          style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)'}`, color: textSecondary }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.1)'; (e.currentTarget as HTMLElement).style.color = ACCENT; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.25)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)'; (e.currentTarget as HTMLElement).style.color = textSecondary; (e.currentTarget as HTMLElement).style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)'; }}
                        >
                          <i className="ri-eye-line text-[10px]" />
                        </button>
                      </div>
                    </div>

                    {/* Mobil kart */}
                    <div
                      className="md:hidden flex items-start gap-3 px-4 py-4 transition-all cursor-pointer"
                      onClick={() => void openDetail(firma)}
                      style={{ background: 'transparent' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = rowHover; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-extrabold text-white"
                          style={{ background: `linear-gradient(135deg, ${ACCENT}, #0284C7)` }}>
                          {firma.name.charAt(0).toUpperCase()}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-sm font-bold truncate" style={{ color: textPrimary }}>{firma.name}</p>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                            style={{ background: firma.is_active ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: firma.is_active ? '#22C55E' : '#EF4444' }}>
                            {firma.is_active ? 'Aktif' : 'Pasif'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-[10px]" style={{ color: textSecondary }}><i className="ri-group-line mr-1" />{stats.personel} personel</span>
                          <span className="text-[10px]" style={{ color: textSecondary }}><i className="ri-tools-line mr-1" />{stats.ekipman} ekipman</span>
                          <span className="text-[10px]" style={{ color: textSecondary }}><i className="ri-file-list-3-line mr-1" />{stats.evrak} evrak</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Detay Modal ──────────────────────────────────────── */}
      {detailOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
          onClick={() => setDetailOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-3xl overflow-hidden flex flex-col"
            style={{ ...card, maxHeight: '90vh', borderRadius: '24px' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${subBorder}` }}>
              {detailData ? (
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 flex items-center justify-center rounded-2xl text-base font-bold text-white flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${ACCENT}, #0284C7)` }}
                  >
                    {detailData.firma.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: textPrimary }}>{detailData.firma.name}</p>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: detailData.firma.is_active ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)',
                        color: detailData.firma.is_active ? '#34D399' : '#F87171',
                      }}
                    >
                      {detailData.firma.is_active ? 'Aktif' : 'Pasif'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="h-11 w-48 rounded-xl animate-pulse" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }} />
              )}
              <button
                onClick={() => setDetailOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer transition-all flex-shrink-0"
                style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', color: textSecondary }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLElement).style.color = '#EF4444'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)'; (e.currentTarget as HTMLElement).style.color = textSecondary; }}
              >
                <i className="ri-close-line text-sm" />
              </button>
            </div>

            {/* Yalnızca görüntüleme bandı */}
            <div className="flex items-center gap-2 px-5 py-2" style={{ background: 'rgba(14,165,233,0.06)', borderBottom: `1px solid rgba(14,165,233,0.1)` }}>
              <i className="ri-information-line text-xs" style={{ color: ACCENT }} />
              <p className="text-[10.5px]" style={{ color: '#64748b' }}>Bu firma size atanmıştır — yalnızca görüntüleme yetkisine sahipsiniz.</p>
            </div>

            {/* Loading */}
            {detailLoading && (
              <div className="flex-1 flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: 'rgba(14,165,233,0.3)', borderTopColor: ACCENT }} />
                  <p className="text-xs" style={{ color: textSecondary }}>Firma detayı yükleniyor...</p>
                </div>
              </div>
            )}

            {/* İçerik */}
            {!detailLoading && detailData && (
              <>
                {/* Tab seçici */}
                <div className="flex gap-1.5 px-5 pt-4 flex-shrink-0">
                  {(['genel', 'personel', 'ekipman'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setDetailTab(tab)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
                      style={detailTab === tab
                        ? { background: 'rgba(14,165,233,0.1)', border: '1.5px solid rgba(14,165,233,0.25)', color: ACCENT }
                        : { background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)', border: `1px solid ${subBorder}`, color: textSecondary }}
                    >
                      <i className={`${tab === 'genel' ? 'ri-dashboard-3-line' : tab === 'personel' ? 'ri-group-line' : 'ri-tools-line'} text-xs`} />
                      {tab === 'genel' ? 'Genel Bilgi' : tab === 'personel' ? `Personel (${detailData.stats.personel})` : `Ekipman (${detailData.stats.ekipman})`}
                    </button>
                  ))}
                </div>

                {/* Tab içerikleri */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

                  {/* Genel */}
                  {detailTab === 'genel' && (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { label: 'Personel', val: detailData.stats.personel, icon: 'ri-group-line', color: ACCENT, bg: 'rgba(14,165,233,0.08)' },
                          { label: 'Ekipman',  val: detailData.stats.ekipman,  icon: 'ri-tools-line',            color: '#818CF8', bg: 'rgba(129,140,248,0.08)' },
                          { label: 'Evrak',    val: detailData.stats.evrak,    icon: 'ri-file-list-3-line',      color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
                          { label: 'Eğitim',   val: detailData.stats.egitim,   icon: 'ri-graduation-cap-line',   color: '#34D399', bg: 'rgba(52,211,153,0.08)' },
                        ].map(item => (
                          <div key={item.label} className="rounded-2xl p-4 text-center"
                            style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.02)', border: `1px solid ${subBorder}` }}>
                            <div className="w-8 h-8 flex items-center justify-center rounded-xl mx-auto mb-2" style={{ background: item.bg }}>
                              <i className={`${item.icon} text-sm`} style={{ color: item.color }} />
                            </div>
                            <p className="text-2xl font-black" style={{ color: item.color }}>{item.val}</p>
                            <p className="text-xs mt-0.5 font-medium" style={{ color: textSecondary }}>{item.label}</p>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${subBorder}` }}>
                        <div className="px-4 py-3 flex items-center gap-2" style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)', borderBottom: `1px solid ${subBorder}` }}>
                          <div className="w-6 h-6 flex items-center justify-center rounded-lg" style={{ background: 'rgba(14,165,233,0.1)' }}>
                            <i className="ri-building-3-line text-[10px]" style={{ color: ACCENT }} />
                          </div>
                          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: textSecondary }}>Firma Bilgileri</p>
                        </div>
                        <div className="divide-y" style={{ borderColor: subBorder }}>
                          <div className="flex items-center gap-3 px-4 py-3">
                            <i className="ri-building-3-line text-xs flex-shrink-0" style={{ color: ACCENT }} />
                            <div>
                              <p className="text-[10px]" style={{ color: textSecondary }}>Firma Adı</p>
                              <p className="text-sm font-semibold" style={{ color: textPrimary }}>{detailData.firma.name}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 px-4 py-3">
                            <i className="ri-checkbox-circle-line text-xs flex-shrink-0" style={{ color: detailData.firma.is_active ? '#34D399' : '#F87171' }} />
                            <div>
                              <p className="text-[10px]" style={{ color: textSecondary }}>Durum</p>
                              <p className="text-sm font-semibold" style={{ color: detailData.firma.is_active ? '#34D399' : '#F87171' }}>
                                {detailData.firma.is_active ? 'Aktif' : 'Pasif'}
                              </p>
                            </div>
                          </div>
                          {detailData.firma.created_at && (
                            <div className="flex items-center gap-3 px-4 py-3">
                              <i className="ri-calendar-line text-xs flex-shrink-0" style={{ color: ACCENT }} />
                              <div>
                                <p className="text-[10px]" style={{ color: textSecondary }}>Sisteme Eklenme</p>
                                <p className="text-sm font-semibold" style={{ color: textPrimary }}>
                                  {new Date(detailData.firma.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Personel tab */}
                  {detailTab === 'personel' && (
                    detailData.personeller.length === 0 ? (
                      <div className="text-center py-12 rounded-2xl" style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)', border: `1px solid ${subBorder}` }}>
                        <i className="ri-group-line text-3xl mb-2" style={{ color: textSecondary, display: 'block' }} />
                        <p className="text-sm font-medium" style={{ color: textSecondary }}>Bu firmada kayıtlı personel yok</p>
                      </div>
                    ) : (
                      <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${subBorder}` }}>
                        <div className="px-4 py-3 flex items-center justify-between" style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)', borderBottom: `1px solid ${subBorder}` }}>
                          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: textSecondary }}>Personel Listesi</p>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(14,165,233,0.1)', color: ACCENT }}>{detailData.personeller.length}</span>
                        </div>
                        <div className="divide-y" style={{ borderColor: subBorder }}>
                          {detailData.personeller.map(p => {
                            const dc = getDurumColor(p.durum);
                            return (
                              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                  style={{ background: `linear-gradient(135deg, ${ACCENT}, #0284C7)` }}>
                                  {p.ad.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold truncate" style={{ color: textPrimary }}>{p.ad}</p>
                                  <p className="text-xs" style={{ color: textSecondary }}>{p.gorev}</p>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                                  style={{ background: `${dc}18`, color: dc, border: `1px solid ${dc}30` }}>
                                  {p.durum}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )
                  )}

                  {/* Ekipman tab */}
                  {detailTab === 'ekipman' && (
                    detailData.ekipmanlar.length === 0 ? (
                      <div className="text-center py-12 rounded-2xl" style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)', border: `1px solid ${subBorder}` }}>
                        <i className="ri-tools-line text-3xl mb-2" style={{ color: textSecondary, display: 'block' }} />
                        <p className="text-sm font-medium" style={{ color: textSecondary }}>Bu firmada kayıtlı ekipman yok</p>
                      </div>
                    ) : (
                      <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${subBorder}` }}>
                        <div className="px-4 py-3 flex items-center justify-between" style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)', borderBottom: `1px solid ${subBorder}` }}>
                          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: textSecondary }}>Ekipman Listesi</p>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(129,140,248,0.1)', color: '#818CF8' }}>{detailData.ekipmanlar.length}</span>
                        </div>
                        <div className="divide-y" style={{ borderColor: subBorder }}>
                          {detailData.ekipmanlar.map(ek => {
                            const dc = getDurumColor(ek.durum);
                            return (
                              <div key={ek.id} className="flex items-center gap-3 px-4 py-3">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                  style={{ background: 'rgba(129,140,248,0.1)' }}>
                                  <i className="ri-tools-line text-xs" style={{ color: '#818CF8' }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold truncate" style={{ color: textPrimary }}>{ek.ad}</p>
                                  <p className="text-xs" style={{ color: textSecondary }}>{ek.tur}</p>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                                  style={{ background: `${dc}18`, color: dc, border: `1px solid ${dc}30` }}>
                                  {ek.durum}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
