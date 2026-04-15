import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/store/AppContext';

interface Ziyaret {
  id: string;
  firma_ad: string | null;
  uzman_ad: string | null;
  uzman_email: string | null;
  giris_saati: string;
  cikis_saati: string | null;
  durum: 'aktif' | 'tamamlandi';
  sure_dakika: number | null;
  qr_ile_giris: boolean;
  gps_status: 'ok' | 'too_far' | 'no_permission' | null;
  check_in_distance_m: number | null;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function fmtSure(dk: number | null, giris: string, cikis: string | null): string {
  const minutes = dk ?? (cikis ? Math.round((new Date(cikis).getTime() - new Date(giris).getTime()) / 60000) : null);
  if (minutes == null) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}s ${m}d` : `${m}d`;
}

// Renkler — uzman başına renk ata
const UZMAN_COLORS = [
  { bg: 'rgba(14,165,233,0.15)', border: '#0EA5E9', text: '#0284C7' },
  { bg: 'rgba(52,211,153,0.15)', border: '#34D399', text: '#059669' },
  { bg: 'rgba(245,158,11,0.15)', border: '#F59E0B', text: '#D97706' },
  { bg: 'rgba(248,113,113,0.15)', border: '#F87171', text: '#DC2626' },
  { bg: 'rgba(167,139,250,0.15)', border: '#A78BFA', text: '#7C3AED' },
  { bg: 'rgba(244,114,182,0.15)', border: '#F472B6', text: '#DB2777' },
];

type ViewMode = 'ay' | 'hafta' | 'liste';

export default function ZiyaretTakvimiPage() {
  const { org } = useApp();
  const [ziyaretler, setZiyaretler] = useState<Ziyaret[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('ay');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterUzman, setFilterUzman] = useState('');
  const [filterFirma, setFilterFirma] = useState('');
  const [secilenGun, setSecilenGun] = useState<string | null>(null);

  // Takvim başlangıcı
  const calStart = useMemo(() => {
    if (viewMode === 'ay') {
      const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      return d;
    }
    if (viewMode === 'hafta') {
      const d = new Date(currentDate);
      const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
      d.setDate(d.getDate() - dow - 7);
      return d;
    }
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 30);
    return d;
  }, [currentDate, viewMode]);

  const calEnd = useMemo(() => {
    if (viewMode === 'ay') {
      return new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0);
    }
    if (viewMode === 'hafta') {
      const d = new Date(currentDate);
      const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
      d.setDate(d.getDate() - dow + 13);
      return d;
    }
    return new Date();
  }, [currentDate, viewMode]);

  const fetchZiyaretler = useCallback(async () => {
    if (!org?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('osgb_ziyaretler')
        .select('id,firma_ad,uzman_ad,uzman_email,giris_saati,cikis_saati,durum,sure_dakika,qr_ile_giris,gps_status,check_in_distance_m')
        .eq('osgb_org_id', org.id)
        .gte('giris_saati', calStart.toISOString())
        .lte('giris_saati', calEnd.toISOString())
        .order('giris_saati', { ascending: false })
        .limit(500);
      setZiyaretler((data ?? []) as Ziyaret[]);
    } finally {
      setLoading(false);
    }
  }, [org?.id, calStart, calEnd]);

  useEffect(() => { void fetchZiyaretler(); }, [fetchZiyaretler]);

  // Uzman listesi (renk için)
  const uzmanlar = useMemo(() => {
    const map = new Map<string, typeof UZMAN_COLORS[0]>();
    ziyaretler.forEach(z => {
      const key = z.uzman_ad ?? z.uzman_email ?? '?';
      if (!map.has(key)) {
        map.set(key, UZMAN_COLORS[map.size % UZMAN_COLORS.length]);
      }
    });
    return map;
  }, [ziyaretler]);

  const filtered = useMemo(() => ziyaretler.filter(z =>
    (!filterUzman || (z.uzman_ad ?? '').toLowerCase().includes(filterUzman.toLowerCase()) || (z.uzman_email ?? '').toLowerCase().includes(filterUzman.toLowerCase())) &&
    (!filterFirma || (z.firma_ad ?? '').toLowerCase().includes(filterFirma.toLowerCase()))
  ), [ziyaretler, filterUzman, filterFirma]);

  // Gün bazında ziyaret map
  const gunMap = useMemo(() => {
    const map = new Map<string, Ziyaret[]>();
    filtered.forEach(z => {
      const dateKey = z.giris_saati.split('T')[0];
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(z);
    });
    return map;
  }, [filtered]);

  // Ay takvimi günleri
  const monthDays = useMemo(() => {
    if (viewMode !== 'ay') return [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const days: (Date | null)[] = [];
    for (let i = 0; i < startDow; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [currentDate, viewMode]);

  // Haftalık görünüm günleri
  const weekDays = useMemo(() => {
    if (viewMode !== 'hafta') return [];
    const d = new Date(currentDate);
    const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
    d.setDate(d.getDate() - dow);
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(d);
      day.setDate(d.getDate() + i);
      return day;
    });
  }, [currentDate, viewMode]);

  const goNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'ay') d.setMonth(d.getMonth() + 1);
    else if (viewMode === 'hafta') d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };
  const goPrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'ay') d.setMonth(d.getMonth() - 1);
    else if (viewMode === 'hafta') d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };

  const dayKey = (d: Date) => d.toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];
  const isToday = (d: Date) => dayKey(d) === today;

  const DOW_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

  const secilenGunZiyaretler = useMemo(() => secilenGun ? (gunMap.get(secilenGun) ?? []) : [], [secilenGun, gunMap]);

  const periodLabel = useMemo(() => {
    if (viewMode === 'ay') {
      return currentDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
    }
    if (viewMode === 'hafta' && weekDays.length) {
      return `${weekDays[0].toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })} – ${weekDays[6].toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    }
    return 'Son 30 Gün';
  }, [viewMode, currentDate, weekDays]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl overflow-hidden isg-card">
        <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, #0EA5E9, #38BDF8, #7DD3FC)' }} />
        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #0284C7, #0EA5E9)' }}>
              <i className="ri-calendar-check-line text-white text-sm" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                Ziyaret Takvimi
              </h1>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Hekim ve uzman saha ziyaretleri — takvim görünümü
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* View mode switcher */}
            <div className="flex items-center gap-0.5 p-1 rounded-xl" style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)' }}>
              {([
                { id: 'ay' as ViewMode, icon: 'ri-calendar-2-line', label: 'Ay' },
                { id: 'hafta' as ViewMode, icon: 'ri-calendar-view', label: 'Hafta' },
                { id: 'liste' as ViewMode, icon: 'ri-list-check', label: 'Liste' },
              ]).map(opt => (
                <button key={opt.id} onClick={() => setViewMode(opt.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
                  style={{
                    background: viewMode === opt.id ? 'rgba(14,165,233,0.12)' : 'transparent',
                    color: viewMode === opt.id ? '#0EA5E9' : 'var(--text-muted)',
                    border: viewMode === opt.id ? '1px solid rgba(14,165,233,0.25)' : '1px solid transparent',
                  }}>
                  <i className={opt.icon} />{opt.label}
                </button>
              ))}
            </div>
            <button onClick={() => void fetchZiyaretler()}
              className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all"
              style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#0EA5E9'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}>
              <i className="ri-refresh-line text-sm" />
            </button>
          </div>
        </div>
      </div>

      {/* Filtreler */}
      <div className="flex flex-wrap gap-3 px-4 py-3 rounded-2xl isg-card">
        <div className="relative min-w-[160px]">
          <i className="ri-user-line absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--text-muted)' }} />
          <input value={filterUzman} onChange={e => setFilterUzman(e.target.value)}
            placeholder="Uzman filtrele..." className="isg-input pl-8" />
        </div>
        <div className="relative min-w-[160px]">
          <i className="ri-building-2-line absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--text-muted)' }} />
          <input value={filterFirma} onChange={e => setFilterFirma(e.target.value)}
            placeholder="Firma filtrele..." className="isg-input pl-8" />
        </div>
        {(filterUzman || filterFirma) && (
          <button onClick={() => { setFilterUzman(''); setFilterFirma(''); }} className="btn-secondary text-xs whitespace-nowrap">
            <i className="ri-filter-off-line mr-1" />Temizle
          </button>
        )}
        <div className="ml-auto flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <i className="ri-calendar-check-line text-xs" />
          {filtered.length} ziyaret
        </div>
      </div>

      {/* Navigasyon + Dönem */}
      {viewMode !== 'liste' && (
        <div className="flex items-center justify-between px-1">
          <button onClick={goPrev} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all isg-card"
            style={{ border: '1px solid var(--border-subtle)' }}>
            <i className="ri-arrow-left-s-line text-sm" style={{ color: 'var(--text-muted)' }} />
          </button>
          <h2 className="text-sm font-bold capitalize" style={{ color: 'var(--text-primary)' }}>{periodLabel}</h2>
          <button onClick={goNext} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all isg-card"
            style={{ border: '1px solid var(--border-subtle)' }}>
            <i className="ri-arrow-right-s-line text-sm" style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="isg-card rounded-xl py-16 flex items-center justify-center gap-3">
          <i className="ri-loader-4-line text-xl animate-spin" style={{ color: '#0EA5E9' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Ziyaretler yükleniyor...</p>
        </div>
      ) : (
        <>
          {/* Ay görünümü */}
          {viewMode === 'ay' && (
            <div className="isg-card rounded-2xl overflow-hidden">
              {/* Gün başlıkları */}
              <div className="grid grid-cols-7" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {DOW_LABELS.map(d => (
                  <div key={d} className="py-2 text-center text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: 'var(--text-muted)', borderRight: '1px solid var(--border-subtle)' }}>
                    {d}
                  </div>
                ))}
              </div>
              {/* Günler */}
              <div className="grid grid-cols-7">
                {monthDays.map((day, idx) => {
                  const key = day ? dayKey(day) : `empty-${idx}`;
                  const dayZiyaretler = day ? (gunMap.get(dayKey(day)) ?? []) : [];
                  const isCurMonth = day ? day.getMonth() === currentDate.getMonth() : false;
                  const isTdy = day ? isToday(day) : false;
                  return (
                    <div key={key}
                      onClick={() => { if (day && dayZiyaretler.length > 0) setSecilenGun(dayKey(day)); }}
                      className="min-h-[80px] p-1.5 transition-all"
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        borderRight: '1px solid var(--border-subtle)',
                        background: isTdy ? 'rgba(14,165,233,0.04)' : !isCurMonth ? 'var(--bg-item)' : 'transparent',
                        cursor: dayZiyaretler.length > 0 ? 'pointer' : 'default',
                        opacity: !day ? 0.3 : 1,
                      }}
                      onMouseEnter={e => { if (dayZiyaretler.length > 0) (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.06)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isTdy ? 'rgba(14,165,233,0.04)' : !isCurMonth ? 'var(--bg-item)' : 'transparent'; }}
                    >
                      {day && (
                        <>
                          <div className={`w-6 h-6 flex items-center justify-center rounded-full text-[11px] font-bold mb-1 ${isTdy ? 'text-white' : ''}`}
                            style={{ background: isTdy ? '#0EA5E9' : 'transparent', color: isTdy ? '#fff' : isCurMonth ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {day.getDate()}
                          </div>
                          <div className="space-y-0.5">
                            {dayZiyaretler.slice(0, 2).map(z => {
                              const uKey = z.uzman_ad ?? z.uzman_email ?? '?';
                              const color = uzmanlar.get(uKey) ?? UZMAN_COLORS[0];
                              return (
                                <div key={z.id} className="rounded px-1 py-0.5 text-[9px] font-semibold truncate"
                                  style={{ background: color.bg, color: color.text, border: `1px solid ${color.border}30` }}>
                                  {z.uzman_ad?.split(' ')[0] ?? 'Uzman'} · {z.firma_ad?.slice(0, 8) ?? ''}
                                </div>
                              );
                            })}
                            {dayZiyaretler.length > 2 && (
                              <div className="text-[9px] font-bold px-1 py-0.5 rounded"
                                style={{ background: 'rgba(14,165,233,0.1)', color: '#0EA5E9' }}>
                                +{dayZiyaretler.length - 2} daha
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Haftalık görünüm */}
          {viewMode === 'hafta' && (
            <div className="isg-card rounded-2xl overflow-hidden">
              <div className="grid grid-cols-7" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {weekDays.map(day => {
                  const isTdy = isToday(day);
                  return (
                    <div key={dayKey(day)} className="py-3 text-center"
                      style={{ borderRight: '1px solid var(--border-subtle)', background: isTdy ? 'rgba(14,165,233,0.06)' : 'transparent' }}>
                      <p className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                        {DOW_LABELS[day.getDay() === 0 ? 6 : day.getDay() - 1]}
                      </p>
                      <div className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold mx-auto mt-0.5 ${isTdy ? 'text-white' : ''}`}
                        style={{ background: isTdy ? '#0EA5E9' : 'transparent', color: isTdy ? '#fff' : 'var(--text-primary)' }}>
                        {day.getDate()}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-7 min-h-[300px]">
                {weekDays.map(day => {
                  const dayZiyaretler = gunMap.get(dayKey(day)) ?? [];
                  const isTdy = isToday(day);
                  return (
                    <div key={dayKey(day)} className="p-2 space-y-1.5"
                      style={{ borderRight: '1px solid var(--border-subtle)', background: isTdy ? 'rgba(14,165,233,0.02)' : 'transparent' }}>
                      {dayZiyaretler.map(z => {
                        const uKey = z.uzman_ad ?? z.uzman_email ?? '?';
                        const color = uzmanlar.get(uKey) ?? UZMAN_COLORS[0];
                        const sure = fmtSure(z.sure_dakika, z.giris_saati, z.cikis_saati);
                        return (
                          <div key={z.id} className="rounded-lg p-2 cursor-pointer"
                            style={{ background: color.bg, border: `1px solid ${color.border}40` }}
                            onClick={() => setSecilenGun(dayKey(day))}>
                            <p className="text-[10px] font-bold truncate" style={{ color: color.text }}>
                              {z.uzman_ad?.split(' ')[0] ?? 'Uzman'}
                            </p>
                            <p className="text-[9px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{z.firma_ad ?? '—'}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{fmtTime(z.giris_saati)}</span>
                              {sure && <span className="text-[9px] font-bold" style={{ color: color.text }}>{sure}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Liste görünümü */}
          {viewMode === 'liste' && (
            <div className="space-y-1.5">
              {filtered.length === 0 ? (
                <div className="isg-card rounded-xl py-16 text-center">
                  <i className="ri-calendar-2-line text-3xl" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm mt-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Ziyaret bulunamadı</p>
                </div>
              ) : (
                filtered.map(z => {
                  const uKey = z.uzman_ad ?? z.uzman_email ?? '?';
                  const color = uzmanlar.get(uKey) ?? UZMAN_COLORS[0];
                  const sure = fmtSure(z.sure_dakika, z.giris_saati, z.cikis_saati);
                  const isAktif = z.durum === 'aktif';
                  return (
                    <div key={z.id} className="isg-card rounded-xl px-4 py-3 flex items-center gap-4"
                      style={{ borderLeft: `3px solid ${color.border}` }}>
                      <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0 text-sm font-bold"
                        style={{ background: color.bg, color: color.text }}>
                        {(z.uzman_ad ?? '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{z.uzman_ad ?? z.uzman_email ?? '—'}</p>
                          {isAktif && (
                            <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.2)' }}>
                              <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: '#22C55E' }} />
                              Aktif
                            </span>
                          )}
                          {z.qr_ile_giris && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                              style={{ background: 'rgba(14,165,233,0.1)', color: '#0EA5E9' }}>QR</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            <i className="ri-building-2-line mr-0.5" />{z.firma_ad ?? '—'}
                          </span>
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            {new Date(z.giris_saati).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {fmtTime(z.giris_saati)}{z.cikis_saati ? ` – ${fmtTime(z.cikis_saati)}` : ''}
                        </p>
                        {sure && (
                          <p className="text-[10px] font-bold mt-0.5" style={{ color: color.text }}>{sure}</p>
                        )}
                        {z.gps_status && (
                          <p className="text-[9px] mt-0.5"
                            style={{ color: z.gps_status === 'ok' ? '#22C55E' : z.gps_status === 'too_far' ? '#EF4444' : '#F59E0B' }}>
                            {z.gps_status === 'ok' ? 'GPS OK' : z.gps_status === 'too_far' ? 'GPS İhlal' : 'GPS Yok'}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}

      {/* Seçilen gün detay panel */}
      {secilenGun && secilenGunZiyaretler.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSecilenGun(null)}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden"
            style={{ background: 'var(--modal-bg)', border: '1px solid var(--modal-border)' }}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 flex items-center justify-center rounded-xl"
                  style={{ background: 'rgba(14,165,233,0.1)' }}>
                  <i className="ri-calendar-check-line text-sm" style={{ color: '#0EA5E9' }} />
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    {new Date(secilenGun).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{secilenGunZiyaretler.length} ziyaret</p>
                </div>
              </div>
              <button onClick={() => setSecilenGun(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                <i className="ri-close-line text-sm" />
              </button>
            </div>
            {/* Liste */}
            <div className="max-h-96 overflow-y-auto divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {secilenGunZiyaretler.map(z => {
                const uKey = z.uzman_ad ?? z.uzman_email ?? '?';
                const color = uzmanlar.get(uKey) ?? UZMAN_COLORS[0];
                const sure = fmtSure(z.sure_dakika, z.giris_saati, z.cikis_saati);
                return (
                  <div key={z.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{ background: color.bg, color: color.text }}>
                      {(z.uzman_ad ?? '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{z.uzman_ad ?? z.uzman_email ?? '—'}</p>
                      <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                        {z.firma_ad ?? '—'} · {fmtTime(z.giris_saati)}{z.cikis_saati ? ` – ${fmtTime(z.cikis_saati)}` : ''}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      {sure && <p className="text-xs font-bold" style={{ color: color.text }}>{sure}</p>}
                      <p className="text-[9px]" style={{ color: z.durum === 'aktif' ? '#22C55E' : 'var(--text-muted)' }}>
                        {z.durum === 'aktif' ? 'Aktif' : 'Tamamlandı'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Uzman renk legend */}
      {uzmanlar.size > 0 && (
        <div className="isg-card rounded-xl p-4">
          <p className="text-[10px] font-bold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Uzmanlar</p>
          <div className="flex flex-wrap gap-2">
            {[...uzmanlar.entries()].map(([name, color]) => (
              <div key={name} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
                style={{ background: color.bg, color: color.text, border: `1px solid ${color.border}30` }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color.border }} />
                {name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
