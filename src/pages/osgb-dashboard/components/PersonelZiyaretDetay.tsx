import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/store/AppContext';

interface PersonelRow {
  user_id: string;
  display_name: string;
  email: string;
  is_active: boolean;
  active_firm_ids: string[] | null;
  osgb_role: string | null;
}

interface PersonelStat {
  toplam: number;
  buHafta: number;
  buAy: number;
  aktif: number;
  ortalamaSureDk: number | null;
  ihlalSayisi: number;
  ihlalOrani: number;
  sonZiyaretAt: string | null;
}

interface ZiyaretRow {
  id: string;
  firma_ad: string | null;
  giris_saati: string;
  cikis_saati: string | null;
  sure_dakika: number | null;
  durum: string;
  gps_status: string | null;
}

interface PersonelZiyaretDetayProps {
  personeller: PersonelRow[];
  isDark: boolean;
}

const TR_MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

function formatSure(dk: number | null): string {
  if (!dk || dk <= 0) return '—';
  const h = Math.floor(dk / 60);
  const m = dk % 60;
  return h > 0 ? `${h}s ${m}dk` : `${m}dk`;
}

function gunOnce(iso: string | null): string {
  if (!iso) return 'Hiç';
  const diff = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (diff < 1 / 24) return 'Az önce';
  if (diff < 1) return `${Math.floor(diff * 24)}s önce`;
  if (diff < 2) return 'Dün';
  return `${Math.floor(diff)}g önce`;
}

function formatTarih(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${TR_MONTHS[d.getMonth()]} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

export default function PersonelZiyaretDetay({ personeller, isDark }: PersonelZiyaretDetayProps) {
  const { org } = useApp();
  const [stats, setStats] = useState<Record<string, PersonelStat>>({});
  const [loadingStats, setLoadingStats] = useState(true);
  const [sortBy, setSortBy] = useState<'buAy' | 'toplam' | 'ihlalOrani' | 'ortalamaSure'>('buAy');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelZiyaretler, setPanelZiyaretler] = useState<ZiyaretRow[]>([]);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelPage, setPanelPage] = useState(0);
  const PAGE_SIZE = 10;

  const fetchStats = useCallback(async () => {
    if (!org?.id || personeller.length === 0) { setLoadingStats(false); return; }
    setLoadingStats(true);
    try {
      const since = new Date();
      since.setDate(since.getDate() - 90);

      const { data } = await supabase
        .from('osgb_ziyaretler')
        .select('uzman_user_id, giris_saati, cikis_saati, sure_dakika, gps_status, durum')
        .eq('osgb_org_id', org.id)
        .gte('giris_saati', since.toISOString());

      const now = Date.now();
      const weekMs = 7 * 86400000;
      const monthMs = 30 * 86400000;

      const map: Record<string, PersonelStat> = {};
      personeller.forEach(p => {
        map[p.user_id] = { toplam: 0, buHafta: 0, buAy: 0, aktif: 0, ortalamaSureDk: null, ihlalSayisi: 0, ihlalOrani: 0, sonZiyaretAt: null };
      });
      const sureMap: Record<string, number[]> = {};

      (data ?? []).forEach(z => {
        const uid = z.uzman_user_id;
        if (!map[uid]) return;
        const s = map[uid];
        const diff = now - new Date(z.giris_saati).getTime();
        s.toplam++;
        if (diff <= weekMs) s.buHafta++;
        if (diff <= monthMs) s.buAy++;
        if (z.durum === 'aktif') s.aktif++;
        if (!s.sonZiyaretAt || z.giris_saati > s.sonZiyaretAt) s.sonZiyaretAt = z.giris_saati;
        if (z.gps_status === 'too_far' || z.gps_status === 'no_permission') s.ihlalSayisi++;
        const dk = z.sure_dakika ?? (z.cikis_saati ? Math.round((new Date(z.cikis_saati).getTime() - new Date(z.giris_saati).getTime()) / 60000) : null);
        if (dk && dk > 0) { if (!sureMap[uid]) sureMap[uid] = []; sureMap[uid].push(dk); }
      });

      personeller.forEach(p => {
        const s = map[p.user_id];
        if (sureMap[p.user_id]?.length) {
          const arr = sureMap[p.user_id];
          s.ortalamaSureDk = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
        }
        if (s.toplam > 0) s.ihlalOrani = Math.round((s.ihlalSayisi / s.toplam) * 100);
      });

      setStats(map);
    } finally {
      setLoadingStats(false);
    }
  }, [org?.id, personeller]);

  useEffect(() => { void fetchStats(); }, [fetchStats]);

  const fetchPanelZiyaretler = useCallback(async (userId: string, page: number) => {
    if (!org?.id) return;
    setPanelLoading(true);
    try {
      const { data } = await supabase
        .from('osgb_ziyaretler')
        .select('id, firma_ad, giris_saati, cikis_saati, sure_dakika, durum, gps_status')
        .eq('osgb_org_id', org.id)
        .eq('uzman_user_id', userId)
        .order('giris_saati', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (page === 0) {
        setPanelZiyaretler((data ?? []) as ZiyaretRow[]);
      } else {
        setPanelZiyaretler(prev => [...prev, ...(data ?? []) as ZiyaretRow[]]);
      }
    } finally {
      setPanelLoading(false);
    }
  }, [org?.id]);

  const openPanel = (userId: string) => {
    setSelectedId(userId);
    setPanelPage(0);
    void fetchPanelZiyaretler(userId, 0);
  };

  const closePanel = () => setSelectedId(null);

  const loadMore = () => {
    if (!selectedId) return;
    const next = panelPage + 1;
    setPanelPage(next);
    void fetchPanelZiyaretler(selectedId, next);
  };

  const sorted = [...personeller].sort((a, b) => {
    const sa = stats[a.user_id];
    const sb = stats[b.user_id];
    if (!sa || !sb) return 0;
    switch (sortBy) {
      case 'buAy': return sb.buAy - sa.buAy;
      case 'toplam': return sb.toplam - sa.toplam;
      case 'ihlalOrani': return sb.ihlalOrani - sa.ihlalOrani;
      case 'ortalamaSure': return (sb.ortalamaSureDk ?? 0) - (sa.ortalamaSureDk ?? 0);
    }
  });

  const selectedPersonel = personeller.find(p => p.user_id === selectedId);
  const selectedStat = selectedId ? stats[selectedId] : null;

  const textPrimary = 'var(--text-primary)';
  const textMuted = 'var(--text-muted)';
  const cardBg = 'var(--bg-card-solid)';
  const border = 'var(--border-subtle)';

  return (
    <div className="space-y-4">
      {/* Başlık + sıralama */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-bold" style={{ color: textPrimary }}>Personel Ziyaret Detay</h3>
          <p className="text-xs mt-0.5" style={{ color: textMuted }}>Son 90 günlük ziyaret aktivitesi · Detay için satıra tıklayın</p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl"
          style={{ background: 'var(--bg-item)', border: `1px solid ${border}` }}>
          {([
            { id: 'buAy', label: 'Bu Ay' },
            { id: 'toplam', label: 'Toplam' },
            { id: 'ihlalOrani', label: 'İhlal' },
            { id: 'ortalamaSure', label: 'Süre' },
          ] as { id: typeof sortBy; label: string }[]).map(s => (
            <button key={s.id} onClick={() => setSortBy(s.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap transition-all"
              style={{
                background: sortBy === s.id ? 'rgba(14,165,233,0.12)' : 'transparent',
                color: sortBy === s.id ? '#0EA5E9' : textMuted,
                border: sortBy === s.id ? '1px solid rgba(14,165,233,0.25)' : '1px solid transparent',
              }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tablo */}
      <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${border}` }}>
        {/* Sütun başlıkları */}
        <div className="grid px-4 py-2.5"
          style={{ gridTemplateColumns: '2fr 80px 80px 80px 80px 80px 100px', borderBottom: `1px solid ${border}` }}>
          {['PERSONEL', 'BU AY', 'BU HAFTA', 'TOPLAM', 'ORT. SÜRE', 'İHLAL', 'SON ZİYARET'].map(h => (
            <span key={h} className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>{h}</span>
          ))}
        </div>

        {loadingStats ? (
          <div className="flex items-center justify-center py-12 gap-2">
            <i className="ri-loader-4-line text-lg animate-spin" style={{ color: '#0EA5E9' }} />
            <span className="text-xs" style={{ color: textMuted }}>Yükleniyor...</span>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <i className="ri-team-line text-2xl" style={{ color: 'var(--text-faint)' }} />
            <p className="text-sm" style={{ color: textMuted }}>Henüz personel eklenmemiş</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: border }}>
            {sorted.map(p => {
              const s = stats[p.user_id];
              const ihlalColor = !s || s.ihlalOrani === 0 ? '#22C55E' : s.ihlalOrani > 20 ? '#EF4444' : '#F59E0B';
              const isSelected = selectedId === p.user_id;

              return (
                <div
                  key={p.user_id}
                  onClick={() => isSelected ? closePanel() : openPanel(p.user_id)}
                  className="grid px-4 py-3 cursor-pointer transition-all"
                  style={{
                    gridTemplateColumns: '2fr 80px 80px 80px 80px 80px 100px',
                    background: isSelected
                      ? 'rgba(14,165,233,0.08)'
                      : 'transparent',
                    borderLeft: isSelected ? '3px solid #0EA5E9' : '3px solid transparent',
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)'; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  {/* Personel */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative flex-shrink-0">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-extrabold text-white"
                        style={{ background: p.is_active ? 'linear-gradient(135deg, #0EA5E9, #0284C7)' : 'linear-gradient(135deg, #64748b, #475569)' }}>
                        {(p.display_name ?? p.email ?? '?').charAt(0).toUpperCase()}
                      </div>
                      {s?.aktif > 0 && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 animate-pulse"
                          style={{ background: '#22C55E', borderColor: cardBg }} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: textPrimary }}>{p.display_name ?? p.email}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{
                            background: p.osgb_role === 'isyeri_hekimi' ? 'rgba(14,165,233,0.1)' : 'rgba(14,165,233,0.08)',
                            color: '#0EA5E9',
                          }}>
                          {p.osgb_role === 'isyeri_hekimi' ? 'Hekim' : 'Uzman'}
                        </span>
                        {s?.aktif > 0 && (
                          <span className="text-[9px] font-bold" style={{ color: '#22C55E' }}>● Sahada</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bu Ay */}
                  <div className="flex items-center">
                    <span className="text-sm font-extrabold" style={{ color: '#0EA5E9' }}>{s?.buAy ?? 0}</span>
                  </div>

                  {/* Bu Hafta */}
                  <div className="flex items-center">
                    <span className="text-sm font-extrabold" style={{ color: '#10B981' }}>{s?.buHafta ?? 0}</span>
                  </div>

                  {/* Toplam */}
                  <div className="flex items-center">
                    <span className="text-sm font-extrabold" style={{ color: '#F59E0B' }}>{s?.toplam ?? 0}</span>
                  </div>

                  {/* Ort. Süre */}
                  <div className="flex items-center">
                    <span className="text-xs font-bold" style={{ color: '#6366F1' }}>{formatSure(s?.ortalamaSureDk ?? null)}</span>
                  </div>

                  {/* İhlal */}
                  <div className="flex items-center">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: `${ihlalColor}18`,
                        color: ihlalColor,
                        border: `1px solid ${ihlalColor}33`,
                      }}>
                      %{s?.ihlalOrani ?? 0}
                    </span>
                  </div>

                  {/* Son Ziyaret */}
                  <div className="flex items-center">
                    <span className="text-[10px]" style={{ color: textMuted }}>{gunOnce(s?.sonZiyaretAt ?? null)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Slide-over panel */}
      {selectedId && selectedPersonel && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }}
            onClick={closePanel}
          />

          {/* Panel */}
          <div
            className="fixed right-0 top-0 h-full z-50 flex flex-col overflow-hidden"
            style={{
              width: '420px',
              maxWidth: '95vw',
              background: isDark ? 'var(--bg-card-solid)' : '#ffffff',
              borderLeft: `1px solid ${border}`,
              animation: 'slideInRight 0.25s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            <style>{`
              @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
              }
            `}</style>

            {/* Panel header */}
            <div className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
              style={{ borderBottom: `1px solid ${border}` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-extrabold text-white flex-shrink-0"
                style={{ background: selectedPersonel.is_active ? 'linear-gradient(135deg, #0EA5E9, #0284C7)' : 'linear-gradient(135deg, #64748b, #475569)' }}>
                {(selectedPersonel.display_name ?? selectedPersonel.email ?? '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: textPrimary }}>
                  {selectedPersonel.display_name ?? selectedPersonel.email}
                </p>
                <p className="text-[10px] mt-0.5 truncate" style={{ color: textMuted }}>{selectedPersonel.email}</p>
              </div>
              <button
                onClick={closePanel}
                className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer flex-shrink-0 transition-all"
                style={{ background: 'var(--bg-item)', color: textMuted }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLElement).style.color = '#EF4444'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-item)'; (e.currentTarget as HTMLElement).style.color = textMuted; }}
              >
                <i className="ri-close-line text-sm" />
              </button>
            </div>

            {/* Stat özet satırı */}
            {selectedStat && (
              <div className="grid grid-cols-4 gap-2 px-5 py-3 flex-shrink-0"
                style={{ borderBottom: `1px solid ${border}` }}>
                {[
                  { label: 'Bu Ay', value: selectedStat.buAy, color: '#0EA5E9' },
                  { label: 'Toplam', value: selectedStat.toplam, color: '#F59E0B' },
                  { label: 'İhlal', value: `%${selectedStat.ihlalOrani}`, color: selectedStat.ihlalOrani > 20 ? '#EF4444' : selectedStat.ihlalOrani > 5 ? '#F59E0B' : '#22C55E' },
                  { label: 'Ort. Süre', value: formatSure(selectedStat.ortalamaSureDk), color: '#6366F1' },
                ].map(m => (
                  <div key={m.label} className="text-center p-2 rounded-xl"
                    style={{ background: `${m.color}10` }}>
                    <p className="text-base font-extrabold leading-none" style={{ color: m.color }}>{m.value}</p>
                    <p className="text-[9px] mt-1" style={{ color: textMuted }}>{m.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* GPS ihlal uyarısı */}
            {selectedStat && selectedStat.ihlalSayisi > 0 && (
              <div className="mx-5 mt-3 flex items-center gap-2 px-3 py-2 rounded-xl flex-shrink-0"
                style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <i className="ri-error-warning-line text-sm flex-shrink-0" style={{ color: '#EF4444' }} />
                <p className="text-[10.5px]" style={{ color: '#DC2626' }}>
                  {selectedStat.ihlalSayisi} ziyarette GPS ihlali tespit edildi (%{selectedStat.ihlalOrani})
                </p>
              </div>
            )}

            {/* Ziyaret listesi */}
            <div className="flex items-center justify-between px-5 py-2.5 flex-shrink-0"
              style={{ borderBottom: `1px solid ${border}` }}>
              <p className="text-xs font-bold" style={{ color: textPrimary }}>Ziyaret Geçmişi</p>
              <span className="text-[10px]" style={{ color: textMuted }}>Son güncelleme: az önce</span>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
              {panelLoading && panelZiyaretler.length === 0 ? (
                <div className="flex items-center justify-center py-10 gap-2">
                  <i className="ri-loader-4-line text-lg animate-spin" style={{ color: '#0EA5E9' }} />
                  <span className="text-xs" style={{ color: textMuted }}>Ziyaretler yükleniyor...</span>
                </div>
              ) : panelZiyaretler.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <i className="ri-map-pin-2-line text-2xl" style={{ color: 'var(--text-faint)' }} />
                  <p className="text-xs" style={{ color: textMuted }}>Henüz ziyaret kaydı yok</p>
                </div>
              ) : (
                <>
                  {panelZiyaretler.map(z => {
                    const isAktif = z.durum === 'aktif';
                    const dk = z.sure_dakika ?? (z.cikis_saati ? Math.round((new Date(z.cikis_saati).getTime() - new Date(z.giris_saati).getTime()) / 60000) : null);
                    const gpsOk = !z.gps_status || z.gps_status === 'ok';
                    const gpsColor = z.gps_status === 'too_far' ? '#EF4444' : z.gps_status === 'no_permission' ? '#F59E0B' : '#22C55E';

                    return (
                      <div key={z.id}
                        className="flex items-center gap-3 p-3 rounded-xl"
                        style={{
                          background: isAktif ? 'rgba(34,197,94,0.06)' : isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)',
                          border: `1px solid ${isAktif ? 'rgba(34,197,94,0.2)' : border}`,
                        }}>
                        {/* Tarih */}
                        <div className="w-[60px] flex-shrink-0 text-right">
                          <p className="text-[10px] font-bold" style={{ color: '#0EA5E9' }}>
                            {formatTarih(z.giris_saati)}
                          </p>
                        </div>

                        {/* Firma */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: textPrimary }}>
                            {z.firma_ad ?? '—'}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {isAktif && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{ background: 'rgba(34,197,94,0.1)', color: '#16A34A' }}>● Aktif</span>
                            )}
                            {dk && (
                              <span className="text-[9px] font-semibold" style={{ color: '#6366F1' }}>{formatSure(dk)}</span>
                            )}
                          </div>
                        </div>

                        {/* GPS */}
                        <div className="flex-shrink-0">
                          {z.gps_status ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{
                                background: `${gpsColor}18`,
                                color: gpsColor,
                                border: `1px solid ${gpsColor}33`,
                              }}>
                              {gpsOk ? 'GPS ✓' : z.gps_status === 'too_far' ? 'İhlal' : 'GPS yok'}
                            </span>
                          ) : (
                            <span className="text-[9px]" style={{ color: 'var(--text-faint)' }}>—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Daha fazla yükle */}
                  {panelZiyaretler.length % PAGE_SIZE === 0 && (
                    <button
                      onClick={loadMore}
                      disabled={panelLoading}
                      className="w-full py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                      style={{
                        background: 'var(--bg-item)',
                        border: `1px solid ${border}`,
                        color: panelLoading ? textMuted : '#0EA5E9',
                      }}>
                      {panelLoading ? (
                        <span className="flex items-center justify-center gap-1.5">
                          <i className="ri-loader-4-line animate-spin" /> Yükleniyor...
                        </span>
                      ) : 'Daha Fazla Yükle'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
