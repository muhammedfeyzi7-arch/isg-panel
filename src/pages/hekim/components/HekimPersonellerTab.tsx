import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import HekimMuayeneModal from './HekimMuayeneModal';

interface PersonelRow {
  id: string;
  adSoyad: string;
  gorev: string;
  firmaAd: string;
  firmaId: string;
  durum: string;
  sonMuayene: string | null;
  sonMuayeneSonuc: string | null;
}

interface HekimPersonellerTabProps {
  atanmisFirmaIds: string[];
  isDark: boolean;
}

export default function HekimPersonellerTab({ atanmisFirmaIds, isDark }: HekimPersonellerTabProps) {
  const [personeller, setPersoneller] = useState<PersonelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [firmaFilter, setFirmaFilter] = useState<string>('');
  const [firmaAdMap, setFirmaAdMap] = useState<Record<string, string>>({});
  const [muayeneModalOpen, setMuayeneModalOpen] = useState(false);
  const [selectedPersonelId, setSelectedPersonelId] = useState<string | null>(null);

  const ACCENT = '#0EA5E9';
  const textPrimary = 'var(--text-primary)';
  const textMuted = 'var(--text-muted)';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';

  const card: React.CSSProperties = {
    background: 'var(--bg-card-solid)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '16px',
  };

  useEffect(() => {
    if (atanmisFirmaIds.length === 0) {
      setPersoneller([]);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const safeIds = atanmisFirmaIds.filter(id => typeof id === 'string' && id.length > 0);
        if (safeIds.length === 0) { setPersoneller([]); setLoading(false); return; }

        const { data: orgs } = await supabase
          .from('organizations')
          .select('id, name')
          .in('id', safeIds);

        const adMap: Record<string, string> = {};
        (orgs ?? []).forEach(o => { adMap[o.id] = o.name; });
        setFirmaAdMap(adMap);

        const allPersonel: PersonelRow[] = [];

        await Promise.all(
          safeIds.map(async (firmaId) => {
            const { data: rows } = await supabase
              .from('personeller')
              .select('id, data')
              .eq('organization_id', firmaId)
              .is('deleted_at', null);

            (rows ?? []).forEach(r => {
              const d = r.data as Record<string, unknown>;
              allPersonel.push({
                id: r.id,
                adSoyad: (d.adSoyad as string) ?? '',
                gorev: (d.gorev as string) ?? '',
                firmaAd: adMap[firmaId] ?? firmaId,
                firmaId,
                durum: (d.durum as string) ?? 'Aktif',
                sonMuayene: null,
                sonMuayeneSonuc: null,
              });
            });

            const { data: muayeneler } = await supabase
              .from('muayeneler')
              .select('data')
              .eq('organization_id', firmaId)
              .is('deleted_at', null)
              .order('created_at', { ascending: false });

            const muayeneMap: Record<string, { tarih: string; sonuc: string }> = {};
            (muayeneler ?? []).forEach(m => {
              const md = m.data as Record<string, unknown>;
              const pid = md.personelId as string;
              if (pid && !muayeneMap[pid]) {
                muayeneMap[pid] = {
                  tarih: (md.muayeneTarihi as string) ?? '',
                  sonuc: (md.sonuc as string) ?? '',
                };
              }
            });

            allPersonel.forEach(p => {
              if (p.firmaId === firmaId && muayeneMap[p.id]) {
                p.sonMuayene = muayeneMap[p.id].tarih;
                p.sonMuayeneSonuc = muayeneMap[p.id].sonuc;
              }
            });
          })
        );

        setPersoneller(allPersonel);
      } catch (err) {
        console.error('[HekimPersonellerTab] load error:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [atanmisFirmaIds]);

  const filtered = personeller.filter(p => {
    const matchSearch = p.adSoyad.toLowerCase().includes(search.toLowerCase()) ||
      p.gorev.toLowerCase().includes(search.toLowerCase());
    const matchFirma = !firmaFilter || p.firmaId === firmaFilter;
    return matchSearch && matchFirma;
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getSonucBadge = (sonuc: string | null) => {
    if (!sonuc) return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(100,116,139,0.1)', color: '#94A3B8', border: '1px solid rgba(100,116,139,0.15)' }}>
        —
      </span>
    );
    if (sonuc === 'Çalışabilir') return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(14,165,233,0.1)', color: ACCENT, border: `1px solid rgba(14,165,233,0.2)` }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }} />
        {sonuc}
      </span>
    );
    if (sonuc === 'Kısıtlı Çalışabilir') return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#F59E0B' }} />
        {sonuc}
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#EF4444' }} />
        {sonuc}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* ── Filtre bar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-lg">
          <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-sm" style={{ color: textSecondary }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Ad, TC kimlik veya görev ara..."
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl outline-none transition-all"
            style={{
              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)',
              border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.09)'}`,
              color: textPrimary,
            }}
            onFocus={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.1)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.09)'; e.currentTarget.style.boxShadow = 'none'; }}
          />
        </div>

        {Object.keys(firmaAdMap).length > 1 && (
          <select
            value={firmaFilter}
            onChange={e => setFirmaFilter(e.target.value)}
            className="py-2.5 px-3 rounded-xl text-sm outline-none cursor-pointer"
            style={{
              background: firmaFilter ? 'rgba(14,165,233,0.08)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)'),
              border: `1.5px solid ${firmaFilter ? 'rgba(14,165,233,0.25)' : (isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.09)')}`,
              color: firmaFilter ? ACCENT : textPrimary,
            }}
          >
            <option value="">Tüm Firmalar</option>
            {Object.entries(firmaAdMap).map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        )}

        <span className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg ml-auto"
          style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', color: textSecondary }}>
          ≡ {filtered.length} sonuç
        </span>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="rounded-2xl p-12 flex flex-col items-center gap-3" style={card}>
          <i className="ri-loader-4-line text-2xl animate-spin" style={{ color: ACCENT }} />
          <p className="text-sm" style={{ color: textMuted }}>Yükleniyor...</p>
        </div>
      )}

      {/* ── Boş state ── */}
      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl p-14 flex flex-col items-center gap-5" style={card}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(14,165,233,0.08)', border: '1.5px solid rgba(14,165,233,0.15)' }}>
            <i className="ri-group-line text-2xl" style={{ color: ACCENT }} />
          </div>
          <div className="text-center">
            <p className="text-base font-bold mb-2" style={{ color: textPrimary }}>
              {search ? `"${search}" için sonuç bulunamadı` : 'Henüz personel yok'}
            </p>
            <p className="text-sm" style={{ color: textSecondary }}>
              Atanmış firmalarınızda kayıtlı personel bulunmuyor.
            </p>
          </div>
        </div>
      )}

      {/* ── Liste ── */}
      {!loading && filtered.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={card}>
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              <div className="grid px-4 py-2.5"
                style={{
                  gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1fr',
                  background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.025)',
                  borderBottom: '1px solid var(--border-subtle)',
                }}>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: textSecondary }}>PERSONEL</span>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: textSecondary }}>FİRMA</span>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: textSecondary }}>GÖREV / DEPARTMAN</span>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: textSecondary }}>SON MUAYENE</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-right" style={{ color: textSecondary }}>SONUÇ</span>
              </div>

              <div className="space-y-1.5 p-2">
                {filtered.map((p) => (
                  <div
                    key={p.id}
                    className="grid px-4 py-3 rounded-xl cursor-default transition-all duration-200"
                    style={{
                      gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1fr',
                      background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.02)',
                      border: '1px solid var(--border-subtle)',
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = isDark ? 'rgba(14,165,233,0.07)' : 'rgba(14,165,233,0.05)';
                      el.style.borderColor = 'rgba(14,165,233,0.3)';
                      el.style.transform = 'translateX(2px)';
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.02)';
                      el.style.borderColor = 'var(--border-subtle)';
                      el.style.transform = 'translateX(0)';
                    }}
                  >
                    {/* Personel */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                        style={{ background: `linear-gradient(135deg, ${ACCENT}, #0284C7)` }}>
                        {p.adSoyad.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: textPrimary }}>{p.adSoyad}</p>
                        {p.durum !== 'Aktif' ? (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(100,116,139,0.1)', color: '#64748B', border: '1px solid rgba(100,116,139,0.15)' }}>
                            {p.durum}
                          </span>
                        ) : (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#22C55E' }} />
                            <p className="text-[10px] font-semibold" style={{ color: '#22C55E' }}>Aktif</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Firma */}
                    <div className="flex items-center min-w-0">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap truncate"
                        style={{ background: 'rgba(14,165,233,0.1)', color: ACCENT, border: '1px solid rgba(14,165,233,0.2)' }}>
                        <i className="ri-building-2-line text-[9px] flex-shrink-0" />
                        <span className="truncate">{p.firmaAd}</span>
                      </span>
                    </div>

                    {/* Görev */}
                    <div className="flex items-center min-w-0">
                      <span className="text-xs truncate" style={{ color: p.gorev ? textPrimary : textSecondary }}>
                        {p.gorev || '—'}
                      </span>
                    </div>

                    {/* Son muayene */}
                    <div className="flex items-center">
                      <span className="text-xs" style={{ color: p.sonMuayene ? textPrimary : textSecondary }}>
                        {formatDate(p.sonMuayene)}
                      </span>
                    </div>

                    {/* Sonuç */}
                    <div className="flex items-center justify-end gap-2">
                      {getSonucBadge(p.sonMuayeneSonuc)}
                      <button
                        onClick={() => { setSelectedPersonelId(p.id); setMuayeneModalOpen(true); }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all flex-shrink-0"
                        style={{ background: isDark ? 'rgba(14,165,233,0.1)' : 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.25)', color: ACCENT }}
                        title="Muayene Ekle"
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.2)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(14,165,233,0.1)' : 'rgba(14,165,233,0.08)'; }}
                      >
                        <i className="ri-stethoscope-line text-xs" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <HekimMuayeneModal
        open={muayeneModalOpen}
        onClose={() => { setMuayeneModalOpen(false); setSelectedPersonelId(null); }}
        onSaved={() => setMuayeneModalOpen(false)}
        atanmisFirmaIds={atanmisFirmaIds}
        isDark={isDark}
        editData={null}
        preselectedPersonelId={selectedPersonelId}
      />
    </div>
  );
}
