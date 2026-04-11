import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface FirmaRow {
  id: string;
  name: string;
  personelSayisi: number;
  sonMuayene: string | null;
  tehlikeSinifi: string | null;
}

interface HekimFirmalarTabProps {
  orgId: string;
  atanmisFirmaIds: string[];
  isDark: boolean;
}

export default function HekimFirmalarTab({ orgId, atanmisFirmaIds, isDark }: HekimFirmalarTabProps) {
  const [firmalar, setFirmalar] = useState<FirmaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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
    if (!orgId || atanmisFirmaIds.length === 0) {
      setFirmalar([]);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        // GÜVENLİK: Sadece atanmisFirmaIds içindeki firmalara erişim — başka ID ile sorgu yapılamaz
        const safeIds = atanmisFirmaIds.filter(id => typeof id === 'string' && id.length > 0);
        if (safeIds.length === 0) { setFirmalar([]); setLoading(false); return; }

        const { data: orgs } = await supabase
          .from('organizations')
          .select('id, name')
          .in('id', safeIds);

        // Her firma için personel sayısını çek (app_data üzerinden)
        const firmaRows: FirmaRow[] = await Promise.all(
          (orgs ?? []).map(async (org) => {
            // Personel sayısı
            const { count: personelCount } = await supabase
              .from('personeller')
              .select('id', { count: 'exact', head: true })
              .eq('organization_id', org.id)
              .is('deleted_at', null);

            // Son muayene
            const { data: lastMuayene } = await supabase
              .from('muayeneler')
              .select('data')
              .eq('organization_id', org.id)
              .is('deleted_at', null)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            let sonMuayeneTarih: string | null = null;
            if (lastMuayene?.data) {
              const d = lastMuayene.data as Record<string, unknown>;
              sonMuayeneTarih = (d.muayeneTarihi as string) ?? null;
            }

            return {
              id: org.id,
              name: org.name,
              personelSayisi: personelCount ?? 0,
              sonMuayene: sonMuayeneTarih,
              tehlikeSinifi: null,
            };
          })
        );

        setFirmalar(firmaRows);
      } catch (err) {
        console.error('[HekimFirmalarTab] load error:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [orgId, atanmisFirmaIds]);

  const filtered = firmalar.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getDaysDiff = (dateStr: string | null): number | null => {
    if (!dateStr) return null;
    return Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold" style={{ color: textPrimary, letterSpacing: '-0.02em' }}>Firmalar</h2>
          <p className="text-xs mt-0.5" style={{ color: textSecondary }}>
            Size atanmış {firmalar.length} firma
          </p>
        </div>

        <div className="relative min-w-[220px]">
          <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-sm" style={{ color: textSecondary }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Firma ara..."
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl outline-none transition-all"
            style={{
              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)',
              border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.09)'}`,
              color: textPrimary,
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = '#0EA5E9';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.1)';
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.09)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl p-4 animate-pulse" style={card}>
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)' }} />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 rounded" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)' }} />
                  <div className="h-3 w-32 rounded" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)' }} />
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
            <i className="ri-building-2-line text-2xl" style={{ color: '#0EA5E9' }} />
          </div>
          <div className="text-center">
            <p className="text-base font-bold mb-2" style={{ color: textPrimary }}>
              {search ? `"${search}" için sonuç bulunamadı` : 'Henüz firma atanmamış'}
            </p>
            <p className="text-sm" style={{ color: textSecondary }}>
              {search ? 'Farklı bir arama terimi deneyin' : 'OSGB admininizin size firma ataması yapmasını bekleyin.'}
            </p>
          </div>
        </div>
      )}

      {/* ── Firma listesi ── */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((firma, idx) => {
            const days = getDaysDiff(firma.sonMuayene);

            return (
              <div
                key={firma.id}
                className="rounded-2xl p-4"
                style={{
                  ...card,
                  cursor: 'default',
                  animation: `fadeSlideIn 0.3s ease ${idx * 0.04}s both`,
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
                  {/* İkon */}
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.15), rgba(14,165,233,0.06))' }}
                  >
                    <i className="ri-building-2-fill text-base" style={{ color: '#0EA5E9' }} />
                  </div>

                  {/* Bilgiler */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold" style={{ color: textPrimary }}>{firma.name}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-[11px]" style={{ color: textSecondary }}>
                        <i className="ri-group-line mr-1 text-[10px]" />
                        {firma.personelSayisi} personel
                      </span>
                      {firma.sonMuayene && (
                        <>
                          <span style={{ color: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(15,23,42,0.2)', fontSize: '10px' }}>·</span>
                          <span className="text-[11px]" style={{ color: textSecondary }}>
                            <i className="ri-stethoscope-line mr-1 text-[10px]" />
                            Son muayene: {formatDate(firma.sonMuayene)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Sağ: muayene badge */}
                  <div className="flex-shrink-0">
                    {days === null ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(100,116,139,0.1)', color: '#94A3B8', border: '1px solid rgba(100,116,139,0.15)' }}>
                        <i className="ri-time-line" />
                        Muayene yok
                      </span>
                    ) : days <= 30 ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(14,165,233,0.1)', color: '#0EA5E9', border: '1px solid rgba(14,165,233,0.2)' }}>
                        <i className="ri-check-line" />
                        {days}g önce
                      </span>
                    ) : days <= 90 ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}>
                        <i className="ri-alert-line" />
                        {days}g önce
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                        <i className="ri-error-warning-line" />
                        {days}g önce
                      </span>
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
