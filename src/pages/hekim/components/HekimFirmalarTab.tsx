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
  const textMuted = 'var(--text-muted)';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';

  const card: React.CSSProperties = {
    background: 'var(--bg-card-solid)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '16px',
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
        const safeIds = atanmisFirmaIds.filter(id => typeof id === 'string' && id.length > 0);
        if (safeIds.length === 0) { setFirmalar([]); setLoading(false); return; }

        const { data: orgs } = await supabase
          .from('organizations')
          .select('id, name')
          .in('id', safeIds);

        const firmaRows: FirmaRow[] = await Promise.all(
          (orgs ?? []).map(async (org) => {
            const { count: personelCount } = await supabase
              .from('personeller')
              .select('id', { count: 'exact', head: true })
              .eq('organization_id', org.id)
              .is('deleted_at', null);

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

  const getMuayeneBadge = (days: number | null) => {
    if (days === null) return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
        style={{ background: 'rgba(100,116,139,0.1)', color: '#94A3B8', border: '1px solid rgba(100,116,139,0.15)' }}>
        <i className="ri-time-line text-[9px]" />Muayene yok
      </span>
    );
    if (days <= 30) return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
        style={{ background: 'rgba(14,165,233,0.1)', color: '#0EA5E9', border: '1px solid rgba(14,165,233,0.2)' }}>
        <i className="ri-check-line text-[9px]" />{days}g önce
      </span>
    );
    if (days <= 90) return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
        style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}>
        <i className="ri-alert-line text-[9px]" />{days}g önce
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
        style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
        <i className="ri-error-warning-line text-[9px]" />{days}g önce
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* ── Filtre bar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-sm" style={{ color: textSecondary }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Firma adı ara..."
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
        <span className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg ml-auto"
          style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', color: textSecondary }}>
          ≡ {filtered.length} sonuç
        </span>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="rounded-2xl p-12 flex flex-col items-center gap-3" style={card}>
          <i className="ri-loader-4-line text-2xl animate-spin" style={{ color: '#0EA5E9' }} />
          <p className="text-sm" style={{ color: textMuted }}>Yükleniyor...</p>
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

      {/* ── Tablo ── */}
      {!loading && filtered.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={card}>
          {/* Başlık satırı */}
          <div className="grid px-4 py-2.5"
            style={{
              gridTemplateColumns: '2fr 1fr 1.5fr 1fr',
              borderBottom: '1px solid var(--border-subtle)',
              background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)',
            }}>
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: textSecondary }}>FİRMA</span>
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: textSecondary }}>PERSONEL</span>
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: textSecondary }}>SON MUAYENE</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-right" style={{ color: textSecondary }}>DURUM</span>
          </div>

          {/* Satırlar */}
          <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {filtered.map((firma, idx) => {
              const days = getDaysDiff(firma.sonMuayene);
              return (
                <div
                  key={firma.id}
                  className="grid px-4 py-3 transition-all cursor-default"
                  style={{
                    gridTemplateColumns: '2fr 1fr 1.5fr 1fr',
                    animationDelay: `${idx * 25}ms`,
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(14,165,233,0.03)' : 'rgba(14,165,233,0.025)';
                    (e.currentTarget as HTMLElement).style.paddingLeft = '18px';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.paddingLeft = '16px';
                  }}
                >
                  {/* Firma adı */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.15)' }}>
                      <i className="ri-building-2-fill text-xs" style={{ color: '#0EA5E9' }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: textPrimary }}>{firma.name}</p>
                    </div>
                  </div>

                  {/* Personel sayısı */}
                  <div className="flex items-center">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: textSecondary }}>
                      <i className="ri-group-line text-[10px]" />
                      {firma.personelSayisi}
                    </span>
                  </div>

                  {/* Son muayene tarihi */}
                  <div className="flex items-center">
                    <span className="text-xs" style={{ color: firma.sonMuayene ? textPrimary : textSecondary }}>
                      {formatDate(firma.sonMuayene) ?? '—'}
                    </span>
                  </div>

                  {/* Muayene durumu badge */}
                  <div className="flex items-center justify-end">
                    {getMuayeneBadge(days)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
