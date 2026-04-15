import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/store/AppContext';

interface TakvimZiyaret {
  id: string;
  firma_ad: string | null;
  firma_org_id: string;
  uzman_ad: string | null;
  giris_saati: string;
  cikis_saati: string | null;
  durum: 'aktif' | 'tamamlandi';
  sure_dakika: number | null;
  gps_status: 'ok' | 'too_far' | 'no_permission' | null;
  tip: 'gercek';
}

interface PlanlıZiyaret {
  id: string;
  firma_org_id: string;
  firma_name: string;
  gunler: number[];
  uzmanlar: string[];
  gun: number; // bu haftaki gün (1-7)
  tip: 'planli';
}

type TakvimItem = TakvimZiyaret | PlanlıZiyaret;

interface Plan {
  id: string;
  firma_org_id: string;
  gunler: number[];
  hedef_uzman_user_ids: string[];
  aktif: boolean;
}

interface ZiyaretTakvimiProps {
  isDark: boolean;
  onFirmaClick?: (firmaId: string) => void;
}

const TR_DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const TR_MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

function getWeekDays(weekOffset: number): Date[] {
  const now = new Date();
  const day = now.getDay() === 0 ? 7 : now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + 1 + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function formatSaat(iso: string) {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function formatSure(dk: number | null, giris: string, cikis: string | null) {
  const d = dk ?? (cikis ? Math.round((new Date(cikis).getTime() - new Date(giris).getTime()) / 60000) : null);
  if (!d || d <= 0) return null;
  const h = Math.floor(d / 60);
  const m = d % 60;
  return h > 0 ? `${h}s ${m}dk` : `${m}dk`;
}

// Tarih'ten 1-7 arası gün (1=Pazartesi)
function getDow(d: Date): number {
  const dow = d.getDay();
  return dow === 0 ? 7 : dow;
}

export default function ZiyaretTakvimi({ isDark, onFirmaClick }: ZiyaretTakvimiProps) {
  const { org } = useApp();
  const [weekOffset, setWeekOffset] = useState(0);
  const [ziyaretler, setZiyaretler] = useState<TakvimZiyaret[]>([]);
  const [planlar, setPlanlar] = useState<Plan[]>([]);
  const [firmaNames, setFirmaNames] = useState<Record<string, string>>({});
  const [uzmanNames, setUzmanNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [filterFirma, setFilterFirma] = useState('');
  const [showPlanli, setShowPlanli] = useState(true);

  const weekDays = getWeekDays(weekOffset);
  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];

  const fetchAll = useCallback(async () => {
    if (!org?.id) return;
    setLoading(true);
    try {
      const start = new Date(weekDays[0]); start.setHours(0, 0, 0, 0);
      const end = new Date(weekDays[6]); end.setHours(23, 59, 59, 999);

      const [{ data: zData }, { data: pData }, { data: orgData }, { data: uData }] = await Promise.all([
        supabase
          .from('osgb_ziyaretler')
          .select('id, firma_ad, firma_org_id, uzman_ad, giris_saati, cikis_saati, durum, sure_dakika, gps_status')
          .eq('osgb_org_id', org.id)
          .gte('giris_saati', start.toISOString())
          .lte('giris_saati', end.toISOString())
          .order('giris_saati', { ascending: true }),
        supabase
          .from('osgb_ziyaret_planlari')
          .select('id, firma_org_id, gunler, hedef_uzman_user_ids, aktif')
          .eq('osgb_org_id', org.id)
          .eq('aktif', true),
        supabase
          .from('organizations')
          .select('id, name')
          .eq('parent_org_id', org.id)
          .eq('org_type', 'firma')
          .is('deleted_at', null),
        supabase
          .from('user_organizations')
          .select('user_id, display_name')
          .eq('organization_id', org.id),
      ]);

      const fMap: Record<string, string> = {};
      (orgData ?? []).forEach(f => { fMap[f.id] = f.name; });
      setFirmaNames(fMap);

      const uMap: Record<string, string> = {};
      (uData ?? []).forEach(u => { if (u.display_name) uMap[u.user_id] = u.display_name; });
      setUzmanNames(uMap);

      setZiyaretler(((zData ?? []) as TakvimZiyaret[]).map(z => ({ ...z, tip: 'gercek' as const })));
      setPlanlar((pData ?? []) as Plan[]);
    } finally {
      setLoading(false);
    }
  }, [org?.id, weekOffset]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const dateRangeLabel = `${weekStart.getDate()} ${TR_MONTHS[weekStart.getMonth()]} — ${weekEnd.getDate()} ${TR_MONTHS[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`;
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const textPrimary = 'var(--text-primary)';
  const textMuted = 'var(--text-muted)';

  // Planlı ziyaretleri haftalık günlere dağıt
  const planliItems: PlanlıZiyaret[] = [];
  planlar.forEach(p => {
    weekDays.forEach((d, i) => {
      const dow = i + 1; // 1=Pzt
      if (!p.gunler.includes(dow)) return;
      const uzmanlar = p.hedef_uzman_user_ids.map(uid => uzmanNames[uid]).filter(Boolean);
      planliItems.push({
        id: `plan-${p.id}-${dow}`,
        firma_org_id: p.firma_org_id,
        firma_name: firmaNames[p.firma_org_id] ?? '—',
        gunler: p.gunler,
        uzmanlar,
        gun: dow,
        tip: 'planli',
      });
    });
  });

  // Gerçek ziyareti olan planlar için planlı olanı gizle (aynı gün + firma çakışma)
  const realFirmaGun = new Set(
    ziyaretler.map(z => `${z.firma_org_id}-${getDow(new Date(z.giris_saati))}`)
  );
  const filteredPlanliItems = planliItems.filter(p => !realFirmaGun.has(`${p.firma_org_id}-${p.gun}`));

  const getGpsColor = (s: string | null) => {
    if (s === 'ok') return '#22C55E';
    if (s === 'too_far') return '#EF4444';
    if (s === 'no_permission') return '#F59E0B';
    return 'var(--text-faint)';
  };

  const getItemsForDay = (d: Date): TakvimItem[] => {
    const dow = getDow(d);
    const gercek = ziyaretler.filter(z => sameDay(new Date(z.giris_saati), d));
    const planli = showPlanli ? filteredPlanliItems.filter(p => p.gun === dow) : [];
    return [...gercek, ...planli];
  };

  const allItems: TakvimItem[] = selectedDay
    ? getItemsForDay(selectedDay)
    : weekDays.flatMap(d => getItemsForDay(d));

  const filteredItems = allItems.filter(item => {
    if (!filterFirma) return true;
    const name = item.tip === 'gercek' ? (item.firma_ad ?? '') : item.firma_name;
    return name.toLowerCase().includes(filterFirma.toLowerCase());
  });

  return (
    <div className="space-y-4">
      {/* Başlık */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-bold" style={{ color: textPrimary }}>Ziyaret Takvimi</h3>
          <p className="text-xs mt-0.5" style={{ color: textMuted }}>{dateRangeLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Planlı toggle */}
          <button
            onClick={() => setShowPlanli(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
            style={{
              background: showPlanli ? 'rgba(245,158,11,0.1)' : 'var(--bg-item)',
              border: `1px solid ${showPlanli ? 'rgba(245,158,11,0.3)' : 'var(--border-subtle)'}`,
              color: showPlanli ? '#D97706' : textMuted,
            }}>
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#F59E0B' }} />
            Planlı
          </button>
          {/* Firma ara */}
          <div className="relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: textMuted }} />
            <input value={filterFirma} onChange={e => setFilterFirma(e.target.value)}
              placeholder="Firma ara..."
              className="pl-8 pr-3 py-2 text-xs rounded-xl outline-none"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: textPrimary, width: '140px' }} />
          </div>
          {/* Hafta nav */}
          <div className="flex items-center gap-1">
            <button onClick={() => { setWeekOffset(v => v - 1); setSelectedDay(null); }}
              className="w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer transition-all"
              style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', color: textMuted }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#0EA5E9'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = textMuted; }}>
              <i className="ri-arrow-left-s-line text-sm" />
            </button>
            {weekOffset !== 0 && (
              <button onClick={() => { setWeekOffset(0); setSelectedDay(null); }}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap"
                style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)', color: '#0EA5E9' }}>
                Bu Hafta
              </button>
            )}
            <button onClick={() => { setWeekOffset(v => v + 1); setSelectedDay(null); }}
              className="w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer transition-all"
              style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', color: textMuted }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#0EA5E9'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = textMuted; }}>
              <i className="ri-arrow-right-s-line text-sm" />
            </button>
          </div>
        </div>
      </div>

      {/* Haftalık grid */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-subtle)' }}>
        <div className="grid grid-cols-7" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          {weekDays.map((d, i) => {
            const isToday = sameDay(d, today);
            const isSelected = selectedDay ? sameDay(d, selectedDay) : false;
            const dayItems = getItemsForDay(d);
            const gercekItems = dayItems.filter(x => x.tip === 'gercek') as TakvimZiyaret[];
            const planliItemsDay = dayItems.filter(x => x.tip === 'planli');
            const hasIhlal = gercekItems.some(z => z.gps_status === 'too_far' || z.gps_status === 'no_permission');

            return (
              <button key={i}
                onClick={() => setSelectedDay(isSelected ? null : d)}
                className="flex flex-col items-center py-3 px-1 cursor-pointer transition-all"
                style={{
                  background: isSelected ? 'rgba(14,165,233,0.12)' : isToday ? 'rgba(14,165,233,0.05)' : 'transparent',
                  borderRight: i < 6 ? '1px solid var(--border-subtle)' : 'none',
                  borderBottom: isSelected ? '2px solid #0EA5E9' : '2px solid transparent',
                }}>
                <span className="text-[10px] font-semibold mb-1" style={{ color: textMuted }}>{TR_DAYS[i]}</span>
                <div className="w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold transition-all"
                  style={{
                    background: isToday ? '#0EA5E9' : 'transparent',
                    color: isToday ? 'white' : isSelected ? '#0EA5E9' : textPrimary,
                  }}>
                  {d.getDate()}
                </div>
                {/* Noktalar: gerçek = renkli, planlı = turuncu */}
                <div className="flex items-center gap-0.5 mt-1.5 flex-wrap justify-center">
                  {gercekItems.slice(0, 3).map((z, zi) => (
                    <span key={zi} className="w-1.5 h-1.5 rounded-full"
                      style={{ background: z.durum === 'aktif' ? '#22C55E' : getGpsColor(z.gps_status) }} />
                  ))}
                  {planliItemsDay.slice(0, 2).map((_, pi) => (
                    <span key={`p${pi}`} className="w-1.5 h-1.5 rounded-full"
                      style={{ background: '#F59E0B', opacity: 0.7 }} />
                  ))}
                  {dayItems.length > 5 && (
                    <span className="text-[8px] font-bold" style={{ color: textMuted }}>+{dayItems.length - 5}</span>
                  )}
                </div>
                {dayItems.length > 0 && (
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {gercekItems.length > 0 && (
                      <span className="text-[9px] font-bold"
                        style={{ color: hasIhlal ? '#EF4444' : '#0EA5E9' }}>
                        {gercekItems.length}
                      </span>
                    )}
                    {planliItemsDay.length > 0 && (
                      <span className="text-[9px] font-bold" style={{ color: '#F59E0B' }}>
                        {gercekItems.length > 0 ? `+${planliItemsDay.length}p` : `${planliItemsDay.length}p`}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Liste */}
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2">
              <i className="ri-loader-4-line text-lg animate-spin" style={{ color: '#0EA5E9' }} />
              <span className="text-xs" style={{ color: textMuted }}>Yükleniyor...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <i className="ri-calendar-2-line text-2xl" style={{ color: 'var(--text-faint)' }} />
              <p className="text-xs" style={{ color: textMuted }}>
                {selectedDay
                  ? `${selectedDay.getDate()} ${TR_MONTHS[selectedDay.getMonth()]}'de ziyaret yok`
                  : 'Bu haftada kayıt yok'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedDay && (
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold" style={{ color: textPrimary }}>
                    {selectedDay.getDate()} {TR_MONTHS[selectedDay.getMonth()]} — {filteredItems.length} kayıt
                  </p>
                  <button onClick={() => setSelectedDay(null)}
                    className="text-[10px] cursor-pointer" style={{ color: '#64748B' }}>
                    <i className="ri-close-line" /> Tümünü gör
                  </button>
                </div>
              )}

              {/* Legend */}
              <div className="flex items-center gap-4 mb-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: '#0EA5E9' }} />
                  <span className="text-[10px]" style={{ color: textMuted }}>Gerçekleşen</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: '#F59E0B' }} />
                  <span className="text-[10px]" style={{ color: textMuted }}>Planlı (henüz yapılmadı)</span>
                </div>
              </div>

              {filteredItems.map(item => {
                if (item.tip === 'gercek') {
                  const z = item as TakvimZiyaret;
                  const isAktif = z.durum === 'aktif';
                  const sureStr = formatSure(z.sure_dakika, z.giris_saati, z.cikis_saati);
                  const tarihD = new Date(z.giris_saati);
                  return (
                    <div key={z.id}
                      className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                      style={{
                        background: isAktif ? 'rgba(34,197,94,0.05)' : isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)',
                        border: `1px solid ${isAktif ? 'rgba(34,197,94,0.2)' : 'var(--border-subtle)'}`,
                      }}
                      onClick={() => onFirmaClick?.(z.firma_org_id)}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.25)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = isAktif ? 'rgba(34,197,94,0.2)' : 'var(--border-subtle)'; }}>
                      <div className="w-10 flex-shrink-0 text-center">
                        {!selectedDay && (
                          <p className="text-[9px] font-bold" style={{ color: textMuted }}>
                            {TR_DAYS[tarihD.getDay() === 0 ? 6 : tarihD.getDay() - 1]}
                          </p>
                        )}
                        <p className="text-xs font-bold" style={{ color: '#0EA5E9' }}>{formatSaat(z.giris_saati)}</p>
                      </div>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: isAktif ? 'rgba(34,197,94,0.1)' : 'rgba(14,165,233,0.08)' }}>
                        {isAktif
                          ? <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#22C55E' }} />
                          : <i className="ri-building-2-line text-xs" style={{ color: '#0EA5E9' }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: textPrimary }}>{z.firma_ad ?? '—'}</p>
                        <p className="text-[10px] truncate" style={{ color: textMuted }}>
                          {z.uzman_ad ?? '—'}{z.cikis_saati && ` · ${formatSaat(z.cikis_saati)}'e kadar`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {sureStr && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(99,102,241,0.1)', color: '#6366F1', border: '1px solid rgba(99,102,241,0.2)' }}>
                            {sureStr}
                          </span>
                        )}
                        {z.gps_status && z.gps_status !== 'ok' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{
                              background: z.gps_status === 'too_far' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                              color: z.gps_status === 'too_far' ? '#EF4444' : '#D97706',
                              border: `1px solid ${z.gps_status === 'too_far' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
                            }}>
                            {z.gps_status === 'too_far' ? 'İhlal' : 'GPS yok'}
                          </span>
                        )}
                        {isAktif && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(34,197,94,0.1)', color: '#16A34A', border: '1px solid rgba(34,197,94,0.2)' }}>
                            ● Aktif
                          </span>
                        )}
                      </div>
                    </div>
                  );
                } else {
                  // Planlı ziyaret
                  const p = item as PlanlıZiyaret;
                  return (
                    <div key={p.id}
                      className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                      style={{
                        background: 'rgba(245,158,11,0.04)',
                        border: '1.5px dashed rgba(245,158,11,0.35)',
                      }}
                      onClick={() => onFirmaClick?.(p.firma_org_id)}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(245,158,11,0.08)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(245,158,11,0.04)'; }}>
                      <div className="w-10 flex-shrink-0 text-center">
                        {!selectedDay && (
                          <p className="text-[9px] font-bold" style={{ color: '#D97706' }}>{TR_DAYS[p.gun - 1]}</p>
                        )}
                        <div className="w-6 h-6 flex items-center justify-center rounded-full mx-auto"
                          style={{ background: 'rgba(245,158,11,0.12)' }}>
                          <i className="ri-calendar-2-line text-[9px]" style={{ color: '#F59E0B' }} />
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(245,158,11,0.1)' }}>
                        <i className="ri-time-line text-xs" style={{ color: '#F59E0B' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: textPrimary }}>{p.firma_name}</p>
                        <p className="text-[10px] truncate" style={{ color: textMuted }}>
                          {p.uzmanlar.length > 0 ? p.uzmanlar.join(', ') : 'Sorumlu atanmamış'}
                        </p>
                      </div>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: 'rgba(245,158,11,0.12)', color: '#D97706', border: '1px solid rgba(245,158,11,0.25)' }}>
                        Planlandı
                      </span>
                    </div>
                  );
                }
              })}
            </div>
          )}
        </div>
      </div>

      {/* Haftalık özet */}
      {!loading && (ziyaretler.length > 0 || filteredPlanliItems.length > 0) && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Gerçekleşen', value: ziyaretler.length, color: '#0EA5E9', bg: 'rgba(14,165,233,0.08)' },
            { label: 'Planlı', value: filteredPlanliItems.length, color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
            { label: 'GPS İhlali', value: ziyaretler.filter(z => z.gps_status === 'too_far').length, color: '#EF4444', bg: 'rgba(239,68,68,0.08)' },
            { label: 'Aktif Devam', value: ziyaretler.filter(z => z.durum === 'aktif').length, color: '#22C55E', bg: 'rgba(34,197,94,0.08)' },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-3 flex items-center gap-3"
              style={{ background: s.bg, border: `1px solid ${s.color}25` }}>
              <p className="text-xl font-extrabold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] font-semibold" style={{ color: textMuted }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
