import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

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
    if (atanmisFirmaIds.length === 0) {
      setPersoneller([]);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        // GÜVENLİK: Sadece atanmisFirmaIds içindeki firma ID'leri kullanılır
        const safeIds = atanmisFirmaIds.filter(id => typeof id === 'string' && id.length > 0);
        if (safeIds.length === 0) { setPersoneller([]); setLoading(false); return; }

        const { data: orgs } = await supabase
          .from('organizations')
          .select('id, name')
          .in('id', safeIds);

        const adMap: Record<string, string> = {};
        (orgs ?? []).forEach(o => { adMap[o.id] = o.name; });
        setFirmaAdMap(adMap);

        // Tüm firmaların personellerini çek
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

            // Muayene bilgilerini çek
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

            // Muayene bilgilerini personellere ekle
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
    if (!sonuc) return null;
    if (sonuc === 'Çalışabilir') return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#10B981' }} />
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
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold" style={{ color: textPrimary, letterSpacing: '-0.02em' }}>Personeller</h2>
          <p className="text-xs mt-0.5" style={{ color: textSecondary }}>
            Tüm atanmış firmalardan {personeller.length} personel
          </p>
        </div>
      </div>

      {/* ── Filtre bar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-sm" style={{ color: textSecondary }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="İsim veya görev ara..."
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl outline-none transition-all"
            style={{
              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)',
              border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.09)'}`,
              color: textPrimary,
            }}
            onFocus={e => { e.currentTarget.style.borderColor = '#0EA5E9'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.1)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.09)'; e.currentTarget.style.boxShadow = 'none'; }}
          />
        </div>

        {Object.keys(firmaAdMap).length > 1 && (
          <select
            value={firmaFilter}
            onChange={e => setFirmaFilter(e.target.value)}
            className="py-2.5 px-3 rounded-xl text-sm outline-none cursor-pointer"
            style={{
              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)',
              border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.09)'}`,
              color: textPrimary,
            }}
          >
            <option value="">Tüm Firmalar</option>
            {Object.entries(firmaAdMap).map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        )}

        <span className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
          style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', color: textSecondary }}>
          {filtered.length} personel
        </span>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-2xl p-4 animate-pulse" style={card}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)' }} />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 rounded" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)' }} />
                  <div className="h-3 w-28 rounded" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)' }} />
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
            <i className="ri-group-line text-2xl" style={{ color: '#0EA5E9' }} />
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
        <div className="space-y-2">
          {filtered.map((p, idx) => (
            <div
              key={p.id}
              className="rounded-2xl p-4"
              style={{
                ...card,
                animation: `fadeSlideIn 0.3s ease ${idx * 0.03}s both`,
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
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}
                >
                  {p.adSoyad.charAt(0).toUpperCase()}
                </div>

                {/* Bilgiler */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold" style={{ color: textPrimary }}>{p.adSoyad}</p>
                    {p.durum !== 'Aktif' && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                        style={{ background: 'rgba(100,116,139,0.1)', color: '#64748B', border: '1px solid rgba(100,116,139,0.15)' }}>
                        {p.durum}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-[11px]" style={{ color: textSecondary }}>
                      <i className="ri-briefcase-line mr-1 text-[10px]" />
                      {p.gorev || '—'}
                    </span>
                    <span style={{ color: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(15,23,42,0.2)', fontSize: '10px' }}>·</span>
                    <span className="text-[11px]" style={{ color: '#0EA5E9', fontWeight: 600 }}>
                      <i className="ri-building-3-line mr-1 text-[10px]" />
                      {p.firmaAd}
                    </span>
                  </div>
                </div>

                {/* Muayene bilgisi */}
                <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                  {p.sonMuayene ? (
                    <span className="text-[10px]" style={{ color: textSecondary }}>
                      {formatDate(p.sonMuayene)}
                    </span>
                  ) : (
                    <span className="text-[10px]" style={{ color: textSecondary }}>Muayene yok</span>
                  )}
                  {getSonucBadge(p.sonMuayeneSonuc)}
                </div>
              </div>
            </div>
          ))}
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
