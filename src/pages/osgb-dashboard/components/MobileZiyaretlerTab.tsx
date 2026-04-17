import { useState, useEffect, useCallback } from 'react';
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
  gps_status: 'ok' | 'too_far' | 'no_permission' | null;
  check_in_distance_m: number | null;
  qr_ile_giris: boolean;
}

type FilterType = 'tumu' | 'aktif' | 'bugun' | 'bu_hafta';

function ElapsedTimer({ since }: { since: string }) {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    const update = () => {
      const diff = Date.now() - new Date(since).getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(`${h > 0 ? h + 's ' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [since]);
  return <span className="font-mono font-black text-sm" style={{ color: '#22C55E' }}>{elapsed}</span>;
}

function formatSure(dakika: number | null, giris: string, cikis: string | null): string {
  if (dakika != null && dakika > 0) {
    const h = Math.floor(dakika / 60);
    const m = dakika % 60;
    return h > 0 ? `${h}s ${m}dk` : `${m}dk`;
  }
  if (giris && cikis) {
    const dk = Math.round((new Date(cikis).getTime() - new Date(giris).getTime()) / 60000);
    if (dk <= 0) return '<1dk';
    const h = Math.floor(dk / 60);
    const m = dk % 60;
    return h > 0 ? `${h}s ${m}dk` : `${m}dk`;
  }
  return '—';
}

function formatSaat(iso: string): string {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function formatTarih(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Bugün';
  if (d.toDateString() === yesterday.toDateString()) return 'Dün';
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
}

const GRADIENT_COLORS = [
  { from: '#FF6B35', to: '#FF8C42' },
  { from: '#7C3AED', to: '#9F67FF' },
  { from: '#0EA5E9', to: '#38BDF8' },
  { from: '#10B981', to: '#34D399' },
  { from: '#F59E0B', to: '#FCD34D' },
  { from: '#EF4444', to: '#F87171' },
];

interface MobileZiyaretlerTabProps {
  isDark: boolean;
}

export default function MobileZiyaretlerTab({ isDark }: MobileZiyaretlerTabProps) {
  const { org } = useApp();
  const [ziyaretler, setZiyaretler] = useState<Ziyaret[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('tumu');
  const [search, setSearch] = useState('');

  const fetchZiyaretler = useCallback(async () => {
    if (!org?.id) return;
    setLoading(true);
    try {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data } = await supabase
        .from('osgb_ziyaretler')
        .select('id,firma_ad,uzman_ad,uzman_email,giris_saati,cikis_saati,durum,sure_dakika,gps_status,check_in_distance_m,qr_ile_giris')
        .eq('osgb_org_id', org.id)
        .gte('giris_saati', since.toISOString())
        .order('giris_saati', { ascending: false })
        .limit(100);
      const sorted = ((data ?? []) as Ziyaret[]).sort((a, b) => {
        if (a.durum === 'aktif' && b.durum !== 'aktif') return -1;
        if (a.durum !== 'aktif' && b.durum === 'aktif') return 1;
        return new Date(b.giris_saati).getTime() - new Date(a.giris_saati).getTime();
      });
      setZiyaretler(sorted);
    } finally {
      setLoading(false);
    }
  }, [org?.id]);

  useEffect(() => { void fetchZiyaretler(); }, [fetchZiyaretler]);

  // Realtime
  useEffect(() => {
    if (!org?.id) return;
    const channel = supabase
      .channel(`mobile_ziyaret_${org.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'osgb_ziyaretler', filter: `osgb_org_id=eq.${org.id}` },
        () => { void fetchZiyaretler(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [org?.id, fetchZiyaretler]);

  const todayStr = new Date().toDateString();
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);

  const aktifCount = ziyaretler.filter(z => z.durum === 'aktif').length;
  const bugunCount = ziyaretler.filter(z => new Date(z.giris_saati).toDateString() === todayStr).length;

  const filtered = ziyaretler.filter(z => {
    const matchSearch = !search ||
      (z.uzman_ad ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (z.firma_ad ?? '').toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filter === 'aktif') return z.durum === 'aktif';
    if (filter === 'bugun') return new Date(z.giris_saati).toDateString() === todayStr;
    if (filter === 'bu_hafta') return new Date(z.giris_saati) >= weekAgo;
    return true;
  });

  const FILTERS: { id: FilterType; label: string; count: number }[] = [
    { id: 'tumu', label: 'Tümü', count: ziyaretler.length },
    { id: 'aktif', label: 'Aktif', count: aktifCount },
    { id: 'bugun', label: 'Bugün', count: bugunCount },
    { id: 'bu_hafta', label: 'Bu Hafta', count: ziyaretler.filter(z => new Date(z.giris_saati) >= weekAgo).length },
  ];

  return (
    <div className="space-y-4">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <h2 className="text-[22px] font-black" style={{ color: 'var(--text-primary)' }}>
          Ziyaretler
        </h2>
        <button
          onClick={() => void fetchZiyaretler()}
          className="w-9 h-9 flex items-center justify-center rounded-full cursor-pointer active:scale-90 transition-transform"
          style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-subtle)' }}
        >
          <i className="ri-refresh-line text-base" style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>

      {/* Stat kartları */}
      <div className="grid grid-cols-3 gap-2.5">
        <div
          className="rounded-2xl p-3 text-center"
          style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(16,185,129,0.06))', border: '1px solid rgba(34,197,94,0.2)' }}
        >
          <p className="text-[26px] font-black leading-none" style={{ color: '#22C55E' }}>{aktifCount}</p>
          <p className="text-[10px] font-semibold mt-1" style={{ color: '#16A34A' }}>Aktif</p>
        </div>
        <div
          className="rounded-2xl p-3 text-center"
          style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.1), rgba(2,132,199,0.04))', border: '1px solid rgba(14,165,233,0.2)' }}
        >
          <p className="text-[26px] font-black leading-none" style={{ color: '#0EA5E9' }}>{bugunCount}</p>
          <p className="text-[10px] font-semibold mt-1" style={{ color: '#0284C7' }}>Bugün</p>
        </div>
        <div
          className="rounded-2xl p-3 text-center"
          style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(217,119,6,0.04))', border: '1px solid rgba(245,158,11,0.2)' }}
        >
          <p className="text-[26px] font-black leading-none" style={{ color: '#F59E0B' }}>{ziyaretler.length}</p>
          <p className="text-[10px] font-semibold mt-1" style={{ color: '#D97706' }}>30 Gün</p>
        </div>
      </div>

      {/* Arama */}
      <div className="relative">
        <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-base" style={{ color: 'var(--text-muted)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Uzman veya firma ara..."
          className="w-full pl-11 pr-4 py-3 rounded-2xl text-sm outline-none"
          style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
        />
      </div>

      {/* Pill filter bar */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-bold whitespace-nowrap cursor-pointer flex-shrink-0 transition-all active:scale-95"
            style={{
              background: filter === f.id
                ? (f.id === 'aktif' ? '#22C55E' : '#0EA5E9')
                : 'var(--bg-card-solid)',
              color: filter === f.id ? '#fff' : 'var(--text-muted)',
              border: filter === f.id ? 'none' : '1px solid var(--border-subtle)',
            }}
          >
            {f.id === 'aktif' && filter === f.id && (
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            )}
            {f.label}
            {f.count > 0 && (
              <span
                className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                style={{
                  background: filter === f.id ? 'rgba(255,255,255,0.25)' : 'rgba(14,165,233,0.1)',
                  color: filter === f.id ? '#fff' : '#0EA5E9',
                }}
              >
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <i className="ri-loader-4-line text-2xl animate-spin" style={{ color: '#0EA5E9' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Yükleniyor...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-2xl p-10 flex flex-col items-center gap-4 text-center"
          style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(14,165,233,0.1)' }}>
            <i className="ri-map-pin-2-line text-2xl" style={{ color: '#0EA5E9' }} />
          </div>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Ziyaret bulunamadı</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {filter !== 'tumu' ? 'Farklı bir filtre deneyin' : 'Henüz ziyaret kaydı yok'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((z, i) => {
            const isAktif = z.durum === 'aktif';
            const colorIdx = i % GRADIENT_COLORS.length;
            const uzmanAd = z.uzman_ad ?? z.uzman_email ?? '?';

            return (
              <div
                key={z.id}
                className="rounded-2xl p-4"
                style={{
                  background: 'var(--bg-card-solid)',
                  border: isAktif ? '1.5px solid rgba(34,197,94,0.3)' : '1px solid var(--border-subtle)',
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-black text-white"
                      style={{
                        background: isAktif
                          ? 'linear-gradient(135deg, #22C55E, #16A34A)'
                          : `linear-gradient(135deg, ${GRADIENT_COLORS[colorIdx].from}, ${GRADIENT_COLORS[colorIdx].to})`,
                      }}
                    >
                      {uzmanAd.charAt(0).toUpperCase()}
                    </div>
                    {isAktif && (
                      <span
                        className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 animate-pulse"
                        style={{ background: '#22C55E', borderColor: 'var(--bg-card-solid)' }}
                      />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-[14px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                        {uzmanAd}
                      </p>
                      {z.qr_ile_giris && (
                        <span
                          className="text-[9px] font-black px-1.5 py-0.5 rounded-md flex-shrink-0"
                          style={{ background: 'rgba(14,165,233,0.1)', color: '#0284C7' }}
                        >
                          QR
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] truncate" style={{ color: 'var(--text-muted)' }}>
                      <i className="ri-building-2-line mr-1" />{z.firma_ad ?? '—'}
                    </p>

                    {/* Alt bilgi satırı */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: 'var(--border-subtle)', color: 'var(--text-muted)' }}
                      >
                        {formatTarih(z.giris_saati)} {formatSaat(z.giris_saati)}
                      </span>

                      {isAktif ? (
                        <ElapsedTimer since={z.giris_saati} />
                      ) : (
                        <span
                          className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(99,102,241,0.08)', color: '#6366F1' }}
                        >
                          {formatSure(z.sure_dakika, z.giris_saati, z.cikis_saati)}
                        </span>
                      )}

                      {/* GPS badge */}
                      {z.gps_status === 'ok' && (
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(34,197,94,0.1)', color: '#16A34A' }}
                        >
                          <i className="ri-map-pin-2-fill mr-0.5" />GPS ✓
                        </span>
                      )}
                      {z.gps_status === 'too_far' && (
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}
                        >
                          <i className="ri-error-warning-line mr-0.5" />Uzakta
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Durum badge */}
                  <div className="flex-shrink-0">
                    {isAktif ? (
                      <span
                        className="flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(34,197,94,0.12)', color: '#16A34A' }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        Aktif
                      </span>
                    ) : (
                      <span
                        className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(148,163,184,0.1)', color: '#94A3B8' }}
                      >
                        Bitti
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
