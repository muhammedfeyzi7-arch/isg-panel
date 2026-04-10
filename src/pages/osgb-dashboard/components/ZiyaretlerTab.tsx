import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/store/AppContext';
import ZiyaretDetayPanel from './ZiyaretDetayPanel';

interface Ziyaret {
  id: string;
  osgb_org_id: string;
  firma_org_id: string;
  firma_ad: string | null;
  uzman_user_id: string;
  uzman_ad: string | null;
  uzman_email: string | null;
  giris_saati: string;
  cikis_saati: string | null;
  durum: 'aktif' | 'tamamlandi';
  konum_lat: number | null;
  konum_lng: number | null;
  konum_adres: string | null;
  qr_ile_giris: boolean;
  notlar: string | null;
  sure_dakika: number | null;
}

interface ZiyaretlerTabProps {
  isDark: boolean;
}

function formatSure(dakika: number | null): string {
  if (!dakika || dakika < 0) return '—';
  const h = Math.floor(dakika / 60);
  const m = dakika % 60;
  if (h > 0) return `${h}s ${m}d`;
  return `${m}d`;
}

function formatSaat(iso: string): string {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}
function formatTarih(iso: string): string {
  return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

type FilterTarih = 'bugun' | 'bu_hafta' | 'ozel';

export default function ZiyaretlerTab({ isDark }: ZiyaretlerTabProps) {
  const { org, addToast } = useApp();
  const [ziyaretler, setZiyaretler] = useState<Ziyaret[]>([]);
  const [loading, setLoading] = useState(true);
  const [secilenZiyaret, setSecilenZiyaret] = useState<Ziyaret | null>(null);

  // Filtreler
  const [filterTarih, setFilterTarih] = useState<FilterTarih>('bugun');
  const [filterOzelBaslangic, setFilterOzelBaslangic] = useState('');
  const [filterOzelBitis, setFilterOzelBitis] = useState('');
  const [filterUzman, setFilterUzman] = useState('');
  const [filterFirma, setFilterFirma] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  // CSS vars
  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-card-solid)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '16px',
  };
  const textPrimary = 'var(--text-primary)';
  const textMuted = 'var(--text-muted)';

  const fetchZiyaretler = useCallback(async () => {
    if (!org?.id) return;
    setLoading(true);
    try {
      let query = supabase
        .from('osgb_ziyaretler')
        .select('*')
        .eq('osgb_org_id', org.id)
        .order('giris_saati', { ascending: false });

      // Tarih filtresi
      const now = new Date();
      if (filterTarih === 'bugun') {
        const start = new Date(now); start.setHours(0, 0, 0, 0);
        const end = new Date(now); end.setHours(23, 59, 59, 999);
        query = query.gte('giris_saati', start.toISOString()).lte('giris_saati', end.toISOString());
      } else if (filterTarih === 'bu_hafta') {
        const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1;
        const start = new Date(now); start.setDate(now.getDate() - dayOfWeek); start.setHours(0, 0, 0, 0);
        const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
        query = query.gte('giris_saati', start.toISOString()).lte('giris_saati', end.toISOString());
      } else if (filterTarih === 'ozel' && filterOzelBaslangic) {
        const start = new Date(filterOzelBaslangic); start.setHours(0, 0, 0, 0);
        query = query.gte('giris_saati', start.toISOString());
        if (filterOzelBitis) {
          const end = new Date(filterOzelBitis); end.setHours(23, 59, 59, 999);
          query = query.lte('giris_saati', end.toISOString());
        }
      }

      if (filterUzman) query = query.ilike('uzman_ad', `%${filterUzman}%`);
      if (filterFirma) query = query.ilike('firma_ad', `%${filterFirma}%`);

      const { data, error } = await query.limit(200);
      if (error) throw error;

      // Aktifler önce, sonra tarih sırası
      const sorted = (data ?? []).sort((a, b) => {
        if (a.durum === 'aktif' && b.durum !== 'aktif') return -1;
        if (a.durum !== 'aktif' && b.durum === 'aktif') return 1;
        return new Date(b.giris_saati).getTime() - new Date(a.giris_saati).getTime();
      });
      setZiyaretler(sorted as Ziyaret[]);
    } catch (err) {
      console.error('[Ziyaretler] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [org?.id, filterTarih, filterOzelBaslangic, filterOzelBitis, filterUzman, filterFirma]);

  useEffect(() => { fetchZiyaretler(); }, [fetchZiyaretler]);

  const handleBitir = async (ziyaretId: string) => {
    try {
      const cikis = new Date().toISOString();
      const { error } = await supabase
        .from('osgb_ziyaretler')
        .update({ durum: 'tamamlandi', cikis_saati: cikis, updated_at: cikis })
        .eq('id', ziyaretId);
      if (error) throw error;
      addToast('Ziyaret tamamlandı!', 'success');
      setSecilenZiyaret(null);
      await fetchZiyaretler();
    } catch (err) {
      addToast(`Hata: ${String(err)}`, 'error');
    }
  };

  // KPI hesapları
  const bugunZiyaret = ziyaretler.filter(z => {
    const d = new Date(z.giris_saati);
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  }).length;
  const aktifSahaUzman = [...new Set(ziyaretler.filter(z => z.durum === 'aktif').map(z => z.uzman_user_id))].length;
  const toplamZiyaret = ziyaretler.length;
  const tamamlananlar = ziyaretler.filter(z => z.sure_dakika && z.sure_dakika > 0);
  const ortalamaSure = tamamlananlar.length > 0
    ? Math.round(tamamlananlar.reduce((s, z) => s + (z.sure_dakika ?? 0), 0) / tamamlananlar.length)
    : 0;

  // Benzersiz uzman ve firma listesi (filtre dropdown için)
  const uzmanListesi = [...new Set(ziyaretler.map(z => z.uzman_ad).filter(Boolean))];
  const firmaListesi = [...new Set(ziyaretler.map(z => z.firma_ad).filter(Boolean))];

  const aktifFilterSayisi = [filterUzman, filterFirma].filter(Boolean).length;

  return (
    <div className="space-y-4 page-enter">
      {/* ── HEADER + FİLTRELER ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-base font-bold" style={{ color: textPrimary }}>Ziyaretler</h2>
          <p className="text-xs mt-0.5" style={{ color: textMuted }}>Saha ziyaret takibi ve yönetimi</p>
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {/* Tarih filtresi tab */}
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)' }}>
            {([
              { id: 'bugun', label: 'Bugün' },
              { id: 'bu_hafta', label: 'Bu Hafta' },
              { id: 'ozel', label: 'Özel' },
            ] as { id: FilterTarih; label: string }[]).map(opt => (
              <button
                key={opt.id}
                onClick={() => setFilterTarih(opt.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
                style={{
                  background: filterTarih === opt.id ? 'rgba(16,185,129,0.12)' : 'transparent',
                  color: filterTarih === opt.id ? '#10B981' : textMuted,
                  border: filterTarih === opt.id ? '1px solid rgba(16,185,129,0.25)' : '1px solid transparent',
                }}>
                {opt.label}
              </button>
            ))}
          </div>

          {/* Özel tarih alanları */}
          {filterTarih === 'ozel' && (
            <div className="flex items-center gap-2">
              <input type="date" value={filterOzelBaslangic} onChange={e => setFilterOzelBaslangic(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl outline-none"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: textPrimary, colorScheme: isDark ? 'dark' : 'light' }} />
              <span className="text-xs" style={{ color: textMuted }}>—</span>
              <input type="date" value={filterOzelBitis} onChange={e => setFilterOzelBitis(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl outline-none"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: textPrimary, colorScheme: isDark ? 'dark' : 'light' }} />
            </div>
          )}

          {/* Filtre toggle */}
          <div className="relative">
            <button
              onClick={() => setFilterOpen(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
              style={{
                background: aktifFilterSayisi > 0 ? 'rgba(16,185,129,0.1)' : 'var(--bg-item)',
                border: `1px solid ${aktifFilterSayisi > 0 ? 'rgba(16,185,129,0.25)' : 'var(--border-subtle)'}`,
                color: aktifFilterSayisi > 0 ? '#10B981' : textMuted,
              }}>
              <i className="ri-filter-3-line text-xs" />
              Filtrele
              {aktifFilterSayisi > 0 && (
                <span className="w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-bold text-white"
                  style={{ background: '#10B981' }}>
                  {aktifFilterSayisi}
                </span>
              )}
            </button>

            {filterOpen && (
              <div className="absolute right-0 top-10 z-50 w-64 p-4 rounded-2xl"
                style={{ background: 'var(--modal-bg)', border: '1px solid var(--modal-border)', boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.5)' : '0 16px 40px rgba(15,23,42,0.12)' }}>
                <p className="text-xs font-bold mb-3" style={{ color: textPrimary }}>Filtreler</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-semibold mb-1.5" style={{ color: textMuted }}>Uzman</label>
                    <select value={filterUzman} onChange={e => setFilterUzman(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl cursor-pointer outline-none"
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: textPrimary }}>
                      <option value="">Tüm Uzmanlar</option>
                      {uzmanListesi.map(u => <option key={u} value={u ?? ''}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold mb-1.5" style={{ color: textMuted }}>Firma</label>
                    <select value={filterFirma} onChange={e => setFilterFirma(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl cursor-pointer outline-none"
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: textPrimary }}>
                      <option value="">Tüm Firmalar</option>
                      {firmaListesi.map(f => <option key={f} value={f ?? ''}>{f}</option>)}
                    </select>
                  </div>
                  {aktifFilterSayisi > 0 && (
                    <button onClick={() => { setFilterUzman(''); setFilterFirma(''); setFilterOpen(false); }}
                      className="w-full py-2 rounded-xl text-xs font-semibold cursor-pointer"
                      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}>
                      <i className="ri-close-line mr-1" />Filtreleri Temizle
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Yenile */}
          <button onClick={fetchZiyaretler}
            className="w-9 h-9 flex items-center justify-center rounded-xl cursor-pointer transition-all"
            style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', color: textMuted }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.1)'; (e.currentTarget as HTMLElement).style.color = '#10B981'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-item)'; (e.currentTarget as HTMLElement).style.color = textMuted; }}>
            <i className="ri-refresh-line text-sm" />
          </button>
        </div>
      </div>

      {/* ── KPI KARTLAR ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Bugünkü Ziyaret', value: bugunZiyaret, icon: 'ri-calendar-check-line', color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.15)', pulse: false },
          { label: 'Aktif Sahadaki Uzman', value: aktifSahaUzman, icon: 'ri-map-pin-user-line', color: '#22C55E', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.15)', pulse: aktifSahaUzman > 0 },
          { label: 'Toplam Ziyaret', value: toplamZiyaret, icon: 'ri-bar-chart-2-line', color: '#06B6D4', bg: 'rgba(6,182,212,0.1)', border: 'rgba(6,182,212,0.15)', pulse: false },
          { label: 'Ortalama Süre', value: formatSure(ortalamaSure), icon: 'ri-time-line', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.15)', pulse: false },
        ].map((kpi, i) => (
          <div key={kpi.label} className="rounded-2xl p-4" style={cardStyle}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ background: kpi.bg, border: `1px solid ${kpi.border}` }}>
                <i className={`${kpi.icon} text-base`} style={{ color: kpi.color }} />
              </div>
              {kpi.pulse && (
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#22C55E' }} />
                  <span className="text-[9px] font-bold" style={{ color: '#22C55E' }}>CANLI</span>
                </div>
              )}
            </div>
            <p className="text-2xl font-extrabold leading-none" style={{ color: textPrimary }}>{kpi.value}</p>
            <p className="text-[11px] font-medium mt-1.5" style={{ color: textMuted }}>{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* ── ANA LİSTE ── */}
      {loading ? (
        <div className="rounded-2xl p-12 flex flex-col items-center gap-3" style={cardStyle}>
          <i className="ri-loader-4-line text-2xl animate-spin" style={{ color: '#10B981' }} />
          <p className="text-sm" style={{ color: textMuted }}>Ziyaretler yükleniyor...</p>
        </div>
      ) : ziyaretler.length === 0 ? (
        <div className="rounded-2xl p-12 flex flex-col items-center gap-4" style={cardStyle}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
            <i className="ri-map-pin-2-line text-2xl" style={{ color: '#10B981' }} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold" style={{ color: textPrimary }}>
              {filterTarih === 'bugun' ? 'Bugün henüz ziyaret yok' : 'Ziyaret bulunamadı'}
            </p>
            <p className="text-xs mt-1" style={{ color: textMuted }}>
              {filterTarih === 'bugun'
                ? 'Uzmanlar QR kod veya manuel giriş ile ziyaret başlatabilir.'
                : 'Seçili dönemde veya filtre koşullarında ziyaret kaydı yok.'}
            </p>
          </div>
          {aktifFilterSayisi > 0 && (
            <button onClick={() => { setFilterUzman(''); setFilterFirma(''); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}>
              <i className="ri-close-line" />Filtreleri Temizle
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={cardStyle}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--table-head-bg)' }}>
                  {['Uzman', 'Firma', 'Giriş', 'Çıkış', 'Süre', 'Durum', 'Konum', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: textMuted }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ziyaretler.map((z, i) => {
                  const isAktif = z.durum === 'aktif';
                  return (
                    <tr
                      key={z.id}
                      onClick={() => setSecilenZiyaret(z)}
                      className="cursor-pointer transition-all"
                      style={{
                        borderBottom: i < ziyaretler.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        background: isAktif ? (isDark ? 'rgba(16,185,129,0.04)' : 'rgba(16,185,129,0.025)') : 'transparent',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isAktif ? (isDark ? 'rgba(16,185,129,0.09)' : 'rgba(16,185,129,0.06)') : 'var(--bg-row-hover)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isAktif ? (isDark ? 'rgba(16,185,129,0.04)' : 'rgba(16,185,129,0.025)') : 'transparent'; }}
                    >
                      {/* Uzman */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                            style={{ background: isAktif ? 'linear-gradient(135deg, #10B981, #059669)' : 'linear-gradient(135deg, #64748b, #475569)' }}>
                            {(z.uzman_ad ?? z.uzman_email ?? '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate max-w-[120px]" style={{ color: 'var(--text-primary)' }}>{z.uzman_ad ?? '—'}</p>
                            <p className="text-[10px] truncate max-w-[120px]" style={{ color: textMuted }}>{z.uzman_email ?? ''}</p>
                          </div>
                        </div>
                      </td>
                      {/* Firma */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(16,185,129,0.08)' }}>
                            <i className="ri-building-2-line text-[10px]" style={{ color: '#059669' }} />
                          </div>
                          <span className="text-xs font-medium truncate max-w-[110px]" style={{ color: 'var(--text-secondary)' }}>{z.firma_ad ?? '—'}</span>
                        </div>
                      </td>
                      {/* Giriş */}
                      <td className="px-4 py-3">
                        <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{formatSaat(z.giris_saati)}</p>
                        <p className="text-[10px]" style={{ color: textMuted }}>{formatTarih(z.giris_saati)}</p>
                      </td>
                      {/* Çıkış */}
                      <td className="px-4 py-3">
                        {z.cikis_saati ? (
                          <>
                            <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{formatSaat(z.cikis_saati)}</p>
                            <p className="text-[10px]" style={{ color: textMuted }}>{formatTarih(z.cikis_saati)}</p>
                          </>
                        ) : (
                          <span className="text-xs" style={{ color: textMuted }}>—</span>
                        )}
                      </td>
                      {/* Süre */}
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                          style={{
                            background: z.sure_dakika ? 'rgba(6,182,212,0.1)' : 'var(--bg-item)',
                            color: z.sure_dakika ? '#06B6D4' : textMuted,
                          }}>
                          {z.sure_dakika ? formatSure(z.sure_dakika) : isAktif ? '...' : '—'}
                        </span>
                      </td>
                      {/* Durum */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {isAktif ? (
                            <>
                              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#22C55E' }} />
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.2)' }}>
                                Aktif
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="w-2 h-2 rounded-full" style={{ background: '#94A3B8' }} />
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{ background: 'rgba(148,163,184,0.1)', color: '#94A3B8', border: '1px solid rgba(148,163,184,0.2)' }}>
                                Tamamlandı
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                      {/* Konum */}
                      <td className="px-4 py-3">
                        {z.konum_lat && z.konum_lng ? (
                          <div className="w-7 h-7 flex items-center justify-center rounded-lg"
                            style={{ background: 'rgba(16,185,129,0.1)' }}
                            title={z.konum_adres ?? 'Konum mevcut'}>
                            <i className="ri-map-pin-2-line text-xs" style={{ color: '#10B981' }} />
                          </div>
                        ) : (
                          <div className="w-7 h-7 flex items-center justify-center rounded-lg"
                            style={{ background: 'var(--bg-item)' }}>
                            <i className="ri-map-pin-line text-xs" style={{ color: textMuted }} />
                          </div>
                        )}
                      </td>
                      {/* Detay */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {z.qr_ile_giris && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap"
                              style={{ background: 'rgba(139,92,246,0.1)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.2)' }}>
                              QR
                            </span>
                          )}
                          <button
                            className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all"
                            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}
                            title="Detay">
                            <i className="ri-arrow-right-s-line text-sm" style={{ color: '#059669' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detay Panel */}
      {secilenZiyaret && (
        <ZiyaretDetayPanel
          ziyaret={secilenZiyaret}
          isDark={isDark}
          onClose={() => setSecilenZiyaret(null)}
          onBitir={handleBitir}
        />
      )}
    </div>
  );
}
