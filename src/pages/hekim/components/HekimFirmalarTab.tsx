import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface FirmaRow {
  id: string;
  name: string;
  personelSayisi: number;
  sonMuayene: string | null;
  kazaSayisi: number;
  muayeneSayisi: number;
}

interface HekimFirmalarTabProps {
  orgId: string;
  atanmisFirmaIds: string[];
  isDark: boolean;
}

const ACCENT = '#0EA5E9';
const ACCENT_DARK = '#0284C7';

export default function HekimFirmalarTab({ orgId, atanmisFirmaIds, isDark }: HekimFirmalarTabProps) {
  const [firmalar, setFirmalar] = useState<FirmaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const borderColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)';

  const card: React.CSSProperties = {
    background: isDark
      ? 'linear-gradient(145deg, rgba(30,41,59,0.95) 0%, rgba(15,23,42,0.98) 100%)'
      : 'linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.95) 100%)',
    border: `1px solid ${borderColor}`,
    borderRadius: '20px',
  };

  const subtleBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.02)';

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

        const { data: orgs } = await supabase.from('organizations').select('id, name').in('id', safeIds);

        const [muayeneAll, kazaAll] = await Promise.all([
          supabase.from('muayeneler').select('organization_id, data').in('organization_id', safeIds).is('deleted_at', null),
          supabase.from('is_kazalari').select('organization_id').in('organization_id', safeIds).is('deleted_at', null),
        ]);

        const allMuayeneler = muayeneAll.data ?? [];
        const allKazalar = kazaAll.data ?? [];

        const firmaRows: FirmaRow[] = await Promise.all(
          (orgs ?? []).map(async (org) => {
            const { count: personelCount } = await supabase
              .from('personeller').select('id', { count: 'exact', head: true })
              .eq('organization_id', org.id).is('deleted_at', null);

            const orgMuayeneler = allMuayeneler.filter(m => m.organization_id === org.id);
            const orgKazalar = allKazalar.filter(k => k.organization_id === org.id);

            const tarihler = orgMuayeneler
              .map(m => (m.data as Record<string, unknown>)?.muayeneTarihi as string | undefined)
              .filter((t): t is string => !!t)
              .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

            return {
              id: org.id,
              name: org.name,
              personelSayisi: personelCount ?? 0,
              sonMuayene: tarihler[0] ?? null,
              kazaSayisi: orgKazalar.length,
              muayeneSayisi: orgMuayeneler.length,
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
        style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}>
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
              border: `1.5px solid ${borderColor}`,
              color: textPrimary,
            }}
            onFocus={e => { e.currentTarget.style.borderColor = ACCENT; }}
            onBlur={e => { e.currentTarget.style.borderColor = borderColor; }}
          />
        </div>
        <span className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg ml-auto"
          style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', color: textSecondary }}>
          ≡ {filtered.length} firma
        </span>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="rounded-2xl p-12 flex flex-col items-center gap-3" style={card}>
          <i className="ri-loader-4-line text-2xl animate-spin" style={{ color: ACCENT }} />
          <p className="text-sm" style={{ color: textSecondary }}>Yükleniyor...</p>
        </div>
      )}

      {/* ── Boş state ── */}
      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl p-14 flex flex-col items-center gap-5" style={card}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(14,165,233,0.08)', border: '1.5px solid rgba(14,165,233,0.15)' }}>
            <i className="ri-building-2-line text-2xl" style={{ color: ACCENT }} />
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
        <div className="rounded-[20px] overflow-hidden" style={card}>
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              {/* Sütun başlıkları */}
              <div
                className="grid px-5 py-3"
                style={{
                  gridTemplateColumns: '2fr 1fr 1.2fr 1fr 1fr 1fr',
                  background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.025)',
                  borderBottom: `1px solid ${borderColor}`,
                }}
              >
                {['FİRMA', 'PERSONEL', 'MUAYENE', 'KAZA', 'SON MUAYENE', 'DURUM'].map(h => (
                  <span key={h} className="text-[10px] font-bold uppercase tracking-wider" style={{ color: textSecondary }}>
                    {h}
                  </span>
                ))}
              </div>

              {/* Satırlar */}
              <div className="divide-y" style={{ borderColor }}>
                {filtered.map((firma) => {
                  const days = getDaysDiff(firma.sonMuayene);
                  return (
                    <div
                      key={firma.id}
                      className="grid px-5 py-3.5 cursor-default transition-all duration-200"
                      style={{
                        gridTemplateColumns: '2fr 1fr 1.2fr 1fr 1fr 1fr',
                        background: subtleBg,
                      }}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.background = isDark ? 'rgba(14,165,233,0.06)' : 'rgba(14,165,233,0.04)';
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.background = subtleBg;
                      }}
                    >
                      {/* Firma adı */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-extrabold text-white"
                          style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DARK})` }}
                        >
                          {firma.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: textPrimary }}>{firma.name}</p>
                          <p className="text-[10px]" style={{ color: textSecondary }}>Müşteri Firma</p>
                        </div>
                      </div>

                      {/* Personel */}
                      <div className="flex items-center">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: textPrimary }}>
                          <i className="ri-group-line text-[10px]" style={{ color: textSecondary }} />
                          {firma.personelSayisi}
                        </span>
                      </div>

                      {/* Muayene */}
                      <div className="flex items-center">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: '#10B981' }}>
                          <i className="ri-stethoscope-line text-[10px]" />
                          {firma.muayeneSayisi}
                        </span>
                      </div>

                      {/* Kaza */}
                      <div className="flex items-center">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold"
                          style={{ color: firma.kazaSayisi > 0 ? '#EF4444' : textSecondary }}>
                          <i className="ri-alert-line text-[10px]" />
                          {firma.kazaSayisi}
                        </span>
                      </div>

                      {/* Son muayene tarihi */}
                      <div className="flex items-center">
                        <span className="text-xs" style={{ color: firma.sonMuayene ? textPrimary : textSecondary }}>
                          {formatDate(firma.sonMuayene) ?? '—'}
                        </span>
                      </div>

                      {/* Durum badge */}
                      <div className="flex items-center">
                        {getMuayeneBadge(days)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
