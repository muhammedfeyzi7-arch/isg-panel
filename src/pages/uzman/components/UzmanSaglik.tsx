import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Props {
  atanmisFirmaIds: string[];
  isDark: boolean;
}

interface MuayeneKayit {
  id: string;
  personel_id: string;
  personel_adi?: string;
  muayene_tarihi: string;
  sonuc: string;
  organization_id: string;
  firma_adi?: string;
}

const ACCENT = '#0EA5E9';

export default function UzmanSaglik({ atanmisFirmaIds, isDark }: Props) {
  const [kayitlar, setKayitlar] = useState<MuayeneKayit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [firmaFilter, setFirmaFilter] = useState('');
  const [firmaMap, setFirmaMap] = useState<Record<string, string>>({});

  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : '#ffffff';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = isDark ? '#64748b' : '#94a3b8';

  useEffect(() => {
    if (atanmisFirmaIds.length === 0) { setLoading(false); return; }
    const fetchData = async () => {
      setLoading(true);
      try {
        // Firma isimlerini çek
        const { data: orgs } = await supabase
          .from('organizations')
          .select('id, name')
          .in('id', atanmisFirmaIds);
        const fMap: Record<string, string> = {};
        (orgs ?? []).forEach(o => { fMap[o.id] = o.name; });
        setFirmaMap(fMap);

        // Muayene kayıtlarını çek
        const { data: muayeneler } = await supabase
          .from('muayeneler')
          .select('id, personel_id, muayene_tarihi, sonuc, organization_id, silinmis')
          .in('organization_id', atanmisFirmaIds)
          .eq('silinmis', false)
          .order('muayene_tarihi', { ascending: false });

        if (!muayeneler || muayeneler.length === 0) {
          setKayitlar([]);
          return;
        }

        // Personel isimlerini çek
        const personelIds = [...new Set(muayeneler.map(m => m.personel_id).filter(Boolean))];
        const { data: personeller } = await supabase
          .from('personeller')
          .select('id, ad, soyad')
          .in('id', personelIds);

        const personelMap: Record<string, string> = {};
        (personeller ?? []).forEach(p => {
          personelMap[p.id] = `${p.ad ?? ''} ${p.soyad ?? ''}`.trim();
        });

        const list: MuayeneKayit[] = muayeneler.map(m => ({
          id: m.id,
          personel_id: m.personel_id,
          personel_adi: personelMap[m.personel_id] ?? 'Bilinmiyor',
          muayene_tarihi: m.muayene_tarihi,
          sonuc: m.sonuc,
          organization_id: m.organization_id,
          firma_adi: fMap[m.organization_id] ?? 'Bilinmiyor',
        }));

        setKayitlar(list);
      } catch (err) {
        console.error('[UzmanSaglik]', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [atanmisFirmaIds.join(',')]);

  const filtered = kayitlar.filter(k => {
    const matchSearch = searchQuery === '' || (k.personel_adi ?? '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchFirma = firmaFilter === '' || k.organization_id === firmaFilter;
    return matchSearch && matchFirma;
  });

  const sonucConfig: Record<string, { color: string; bg: string; icon: string }> = {
    'Çalışabilir': { color: '#34D399', bg: 'rgba(52,211,153,0.12)', icon: 'ri-checkbox-circle-line' },
    'Çalışamaz': { color: '#F87171', bg: 'rgba(248,113,113,0.12)', icon: 'ri-close-circle-line' },
    'Kısıtlı Çalışabilir': { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)', icon: 'ri-alert-line' },
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: cardBg, border: `1px solid ${border}` }} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Başlık */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color: textPrimary, letterSpacing: '-0.02em' }}>Sağlık Durumu</h2>
          <p className="text-sm mt-0.5" style={{ color: textMuted }}>Atanmış firmaların muayene kayıtları</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: textMuted }} />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Personel ara..."
              className="pl-9 pr-4 py-2 rounded-xl text-sm outline-none"
              style={{ background: cardBg, border: `1px solid ${border}`, color: textPrimary, width: '180px' }}
            />
          </div>
          {atanmisFirmaIds.length > 1 && (
            <select
              value={firmaFilter}
              onChange={e => setFirmaFilter(e.target.value)}
              className="py-2 px-3 rounded-xl text-sm outline-none cursor-pointer"
              style={{ background: cardBg, border: `1px solid ${border}`, color: textPrimary }}
            >
              <option value="">Tüm Firmalar</option>
              {atanmisFirmaIds.map(id => (
                <option key={id} value={id}>{firmaMap[id] ?? id}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Özet kartları */}
      <div className="grid grid-cols-3 gap-3">
        {(['Çalışabilir', 'Çalışamaz', 'Kısıtlı Çalışabilir'] as const).map(sonuc => {
          const cnt = kayitlar.filter(k => k.sonuc === sonuc).length;
          const cfg = sonucConfig[sonuc] ?? { color: '#64748b', bg: 'rgba(100,116,139,0.1)', icon: 'ri-question-line' };
          return (
            <div key={sonuc} className="rounded-2xl p-4 text-center" style={{ background: cfg.bg, border: `1px solid ${cfg.color}30` }}>
              <div className="w-8 h-8 flex items-center justify-center rounded-xl mx-auto mb-2" style={{ background: cfg.bg }}>
                <i className={`${cfg.icon} text-sm`} style={{ color: cfg.color }} />
              </div>
              <p className="text-xl font-bold" style={{ color: cfg.color }}>{cnt}</p>
              <p className="text-[10px] mt-0.5 font-medium" style={{ color: textMuted }}>{sonuc}</p>
            </div>
          );
        })}
      </div>

      {/* Tablo */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ background: cardBg, border: `1px solid ${border}` }}>
          <i className="ri-heart-pulse-line text-4xl mb-3" style={{ color: isDark ? '#334155' : '#cbd5e1', display: 'block' }} />
          <p className="text-sm font-medium" style={{ color: textMuted }}>
            {searchQuery || firmaFilter ? 'Filtrelere uygun kayıt bulunamadı' : 'Muayene kaydı bulunamadı'}
          </p>
          {!searchQuery && !firmaFilter && (
            <p className="text-xs mt-1" style={{ color: isDark ? '#334155' : '#cbd5e1' }}>Veriler hekim tarafından girildikçe burada görünecek</p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${border}` }}>
          {/* Tablo başlığı */}
          <div
            className="hidden sm:grid grid-cols-4 gap-4 px-5 py-3 text-[11px] font-bold uppercase tracking-wider"
            style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)', color: textMuted, borderBottom: `1px solid ${border}` }}
          >
            <div>Ad Soyad</div>
            <div>Firma</div>
            <div>Muayene Tarihi</div>
            <div>Durum</div>
          </div>

          <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
            {filtered.map(k => {
              const cfg = sonucConfig[k.sonuc] ?? { color: '#64748b', bg: 'rgba(100,116,139,0.1)', icon: 'ri-question-line' };
              return (
                <div
                  key={k.id}
                  className="grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-4 px-5 py-4"
                  style={{
                    background: cardBg,
                    borderColor: border,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0 text-[11px] font-bold text-white"
                      style={{ background: `linear-gradient(135deg, ${ACCENT}, #38BDF8)` }}
                    >
                      {(k.personel_adi ?? '?').charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold truncate" style={{ color: textPrimary }}>{k.personel_adi}</span>
                  </div>
                  <div className="text-xs truncate" style={{ color: textMuted }}>
                    <span className="sm:hidden font-semibold" style={{ color: textPrimary }}>Firma: </span>{k.firma_adi}
                  </div>
                  <div className="text-sm" style={{ color: textMuted }}>
                    <span className="sm:hidden font-semibold" style={{ color: textPrimary }}>Tarih: </span>
                    {k.muayene_tarihi ? new Date(k.muayene_tarihi).toLocaleDateString('tr-TR') : '—'}
                  </div>
                  <div>
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full"
                      style={{ background: cfg.bg, color: cfg.color }}
                    >
                      <i className={`${cfg.icon} text-xs`} />
                      {k.sonuc}
                    </span>
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
