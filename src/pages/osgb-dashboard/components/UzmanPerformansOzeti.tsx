import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/store/AppContext';

interface UzmanPerfRow {
  user_id: string;
  display_name: string;
  email: string;
  is_active: boolean;
  active_firm_ids: string[] | null;
  osgb_role: string | null;
}

interface ZiyaretStat {
  uzman_user_id: string;
  toplam: number;
  buHafta: number;
  buAy: number;
  aktif: number;
  ortalamaSureDk: number | null;
  ihlalSayisi: number;
  ihlalOrani: number;
  sonZiyaretAt: string | null;
}

interface UzmanPerformansOzetiProps {
  uzmanlar: UzmanPerfRow[];
  isDark: boolean;
  onUzmanClick?: (userId: string) => void;
}

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

export default function UzmanPerformansOzeti({ uzmanlar, isDark, onUzmanClick }: UzmanPerformansOzetiProps) {
  const { org } = useApp();
  const [stats, setStats] = useState<Record<string, ZiyaretStat>>({});
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'toplam' | 'buAy' | 'ihlalOrani' | 'ortalamaSure'>('buAy');

  const fetchStats = useCallback(async () => {
    if (!org?.id || uzmanlar.length === 0) return;
    setLoading(true);
    try {
      const since = new Date();
      since.setDate(since.getDate() - 90);

      const { data } = await supabase
        .from('osgb_ziyaretler')
        .select('uzman_user_id, giris_saati, cikis_saati, sure_dakika, gps_status, durum')
        .eq('osgb_org_id', org.id)
        .gte('giris_saati', since.toISOString())
        .order('giris_saati', { ascending: false });

      const now = Date.now();
      const weekMs = 7 * 86400000;
      const monthMs = 30 * 86400000;

      const map: Record<string, ZiyaretStat> = {};
      uzmanlar.forEach(u => {
        map[u.user_id] = {
          user_id: u.user_id,
          toplam: 0, buHafta: 0, buAy: 0, aktif: 0,
          ortalamaSureDk: null, ihlalSayisi: 0, ihlalOrani: 0, sonZiyaretAt: null,
        };
      });

      const sureMap: Record<string, number[]> = {};

      (data ?? []).forEach(z => {
        const uid = z.uzman_user_id;
        if (!map[uid]) return;
        const s = map[uid];
        const gMs = new Date(z.giris_saati).getTime();
        const diff = now - gMs;

        s.toplam++;
        if (diff <= weekMs) s.buHafta++;
        if (diff <= monthMs) s.buAy++;
        if (z.durum === 'aktif') s.aktif++;
        if (!s.sonZiyaretAt || z.giris_saati > s.sonZiyaretAt) s.sonZiyaretAt = z.giris_saati;

        if (z.gps_status === 'too_far' || z.gps_status === 'no_permission') s.ihlalSayisi++;

        const dk = z.sure_dakika ?? (z.cikis_saati
          ? Math.round((new Date(z.cikis_saati).getTime() - gMs) / 60000)
          : null);
        if (dk && dk > 0) {
          if (!sureMap[uid]) sureMap[uid] = [];
          sureMap[uid].push(dk);
        }
      });

      // Ortalama süre ve ihlal oranı
      uzmanlar.forEach(u => {
        const s = map[u.user_id];
        if (sureMap[u.user_id]?.length) {
          const arr = sureMap[u.user_id];
          s.ortalamaSureDk = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
        }
        if (s.toplam > 0) {
          s.ihlalOrani = Math.round((s.ihlalSayisi / s.toplam) * 100);
        }
      });

      setStats(map);
    } finally {
      setLoading(false);
    }
  }, [org?.id, uzmanlar]);

  useEffect(() => { void fetchStats(); }, [fetchStats]);

  const sortedUzmanlar = [...uzmanlar].sort((a, b) => {
    const sa = stats[a.user_id];
    const sb = stats[b.user_id];
    if (!sa || !sb) return 0;
    switch (sortBy) {
      case 'toplam': return sb.toplam - sa.toplam;
      case 'buAy': return sb.buAy - sa.buAy;
      case 'ihlalOrani': return sb.ihlalOrani - sa.ihlalOrani;
      case 'ortalamaSure': return (sb.ortalamaSureDk ?? 0) - (sa.ortalamaSureDk ?? 0);
    }
  });

  const textPrimary = 'var(--text-primary)';
  const textMuted = 'var(--text-muted)';
  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-card-solid)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '16px',
  };

  return (
    <div className="space-y-4">
      {/* Başlık + Sıralama */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-bold" style={{ color: textPrimary }}>Uzman Performans Özeti</h3>
          <p className="text-xs mt-0.5" style={{ color: textMuted }}>Son 30 günlük ziyaret aktivitesi</p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl"
          style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)' }}>
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

      {loading ? (
        <div className="rounded-2xl p-10 flex items-center justify-center gap-3" style={cardStyle}>
          <i className="ri-loader-4-line text-xl animate-spin" style={{ color: '#0EA5E9' }} />
          <span className="text-sm" style={{ color: textMuted }}>Yükleniyor...</span>
        </div>
      ) : uzmanlar.length === 0 ? (
        <div className="rounded-2xl p-10 flex flex-col items-center gap-3" style={cardStyle}>
          <i className="ri-user-star-line text-3xl" style={{ color: 'var(--text-faint)' }} />
          <p className="text-sm" style={{ color: textMuted }}>Henüz uzman eklenmemiş</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {sortedUzmanlar.map(u => {
            const s = stats[u.user_id];
            if (!s) return null;
            const ihlalColor = s.ihlalOrani > 20 ? '#EF4444' : s.ihlalOrani > 5 ? '#F59E0B' : '#22C55E';
            const performansScore = Math.min(100, (s.buAy / Math.max(1, 8)) * 100);
            return (
              <div key={u.user_id}
                className="rounded-2xl overflow-hidden cursor-pointer transition-all"
                style={cardStyle}
                onClick={() => onUzmanClick?.(u.user_id)}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}>
                <div className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-extrabold text-white"
                        style={{ background: u.is_active ? 'linear-gradient(135deg, #0EA5E9, #0284C7)' : 'linear-gradient(135deg, #64748b, #475569)' }}>
                        {(u.display_name ?? u.email ?? '?').charAt(0).toUpperCase()}
                      </div>
                      {s.aktif > 0 && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 animate-pulse"
                          style={{ background: '#22C55E', borderColor: 'var(--bg-card-solid)' }} />
                      )}
                    </div>

                    {/* İsim + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold truncate" style={{ color: textPrimary }}>{u.display_name}</p>
                        {s.aktif > 0 && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: 'rgba(34,197,94,0.1)', color: '#16A34A', border: '1px solid rgba(34,197,94,0.2)' }}>
                            ● Sahada
                          </span>
                        )}
                        {u.osgb_role === 'isyeri_hekimi' && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: 'rgba(14,165,233,0.08)', color: '#0EA5E9', border: '1px solid rgba(14,165,233,0.18)' }}>
                            Hekim
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] mt-0.5" style={{ color: textMuted }}>{u.email}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
                        Son: {gunOnce(s.sonZiyaretAt)}
                      </p>
                    </div>

                    {/* Ort. süre */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-base font-extrabold" style={{ color: '#6366F1' }}>{formatSure(s.ortalamaSureDk)}</p>
                      <p className="text-[9px] mt-0.5" style={{ color: textMuted }}>ort. süre</p>
                    </div>
                  </div>

                  {/* Metrik row */}
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {[
                      { label: 'Bu Ay', value: s.buAy, color: '#0EA5E9', bg: 'rgba(14,165,233,0.08)' },
                      { label: 'Bu Hafta', value: s.buHafta, color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
                      { label: 'Toplam (90g)', value: s.toplam, color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
                      { label: 'İhlal', value: `%${s.ihlalOrani}`, color: ihlalColor, bg: `${ihlalColor}14` },
                    ].map(m => (
                      <div key={m.label} className="text-center p-2 rounded-xl"
                        style={{ background: m.bg }}>
                        <p className="text-base font-extrabold leading-none" style={{ color: m.color }}>{m.value}</p>
                        <p className="text-[9px] mt-1" style={{ color: textMuted }}>{m.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Performans bar */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px]" style={{ color: textMuted }}>Bu ay aktivite</span>
                      <span className="text-[10px] font-bold" style={{ color: '#0EA5E9' }}>{s.buAy} ziyaret</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden"
                      style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0' }}>
                      <div className="h-full rounded-full transition-all"
                        style={{
                          width: `${performansScore}%`,
                          background: s.buAy >= 8 ? '#0EA5E9' : s.buAy >= 4 ? '#F59E0B' : '#EF4444',
                        }} />
                    </div>
                  </div>

                  {/* İhlal varsa uyarı */}
                  {s.ihlalSayisi > 0 && (
                    <div className="flex items-center gap-1.5 mt-2.5 p-2 rounded-lg"
                      style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                      <i className="ri-error-warning-line text-xs flex-shrink-0" style={{ color: '#EF4444' }} />
                      <p className="text-[10px]" style={{ color: '#DC2626' }}>
                        {s.ihlalSayisi} ziyarette GPS ihlali (%{s.ihlalOrani})
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
