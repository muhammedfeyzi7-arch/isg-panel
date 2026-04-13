import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Props {
  atanmisFirmaIds: string[];
  isDark: boolean;
}

interface MuayeneKayit {
  id: string;
  personelId: string;
  personelAdi?: string;
  muayeneTarihi: string;
  sonrakiTarih?: string;
  sonuc: string;
  organizationId: string;
  firmaAdi?: string;
  ek2?: boolean;
  doktor?: string;
  hastane?: string;
}

const ACCENT = '#0EA5E9';
const ACCENT_DARK = '#0284C7';

const SONUC_MAP: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  uygun:       { label: 'Çalışabilir',         color: '#34D399', bg: 'rgba(52,211,153,0.12)',   icon: 'ri-checkbox-circle-line' },
  kisitli:     { label: 'Kısıtlı Çalışabilir', color: '#FBBF24', bg: 'rgba(251,191,36,0.12)',   icon: 'ri-alert-line' },
  uygun_degil: { label: 'Çalışamaz',           color: '#F87171', bg: 'rgba(248,113,113,0.12)',   icon: 'ri-close-circle-line' },
  // Geriye dönük uyumluluk (eski değerler)
  'Çalışabilir':         { label: 'Çalışabilir',         color: '#34D399', bg: 'rgba(52,211,153,0.12)',   icon: 'ri-checkbox-circle-line' },
  'Kısıtlı Çalışabilir': { label: 'Kısıtlı Çalışabilir', color: '#FBBF24', bg: 'rgba(251,191,36,0.12)',   icon: 'ri-alert-line' },
  'Çalışamaz':           { label: 'Çalışamaz',           color: '#F87171', bg: 'rgba(248,113,113,0.12)',   icon: 'ri-close-circle-line' },
};

function getSonucCfg(sonuc: string) {
  return SONUC_MAP[sonuc] ?? { label: sonuc ?? '—', color: '#64748b', bg: 'rgba(100,116,139,0.1)', icon: 'ri-question-line' };
}

function isSonakiTarihGecmis(tarih?: string) {
  if (!tarih) return false;
  return new Date(tarih) < new Date();
}

export default function UzmanSaglik({ atanmisFirmaIds, isDark }: Props) {
  const [kayitlar, setKayitlar] = useState<MuayeneKayit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [firmaFilter, setFirmaFilter] = useState('');
  const [firmaMap, setFirmaMap] = useState<Record<string, string>>({});

  const cardBg    = isDark ? 'rgba(255,255,255,0.04)' : '#ffffff';
  const border    = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
  const sectionBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.02)';
  const textPrimary   = isDark ? '#f1f5f9' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const textMuted     = isDark ? '#64748b' : '#94a3b8';

  useEffect(() => {
    if (atanmisFirmaIds.length === 0) { setLoading(false); return; }
    const fetchData = async () => {
      setLoading(true);
      try {
        const safeIds = atanmisFirmaIds.filter(id => typeof id === 'string' && id.length > 0);

        // Firma isimlerini çek
        const { data: orgs } = await supabase
          .from('organizations')
          .select('id, name')
          .in('id', safeIds);
        const fMap: Record<string, string> = {};
        (orgs ?? []).forEach(o => { fMap[o.id] = o.name; });
        setFirmaMap(fMap);

        // Muayene kayıtlarını çek — data JSON içinde tutuluyor
        const { data: muayeneler, error } = await supabase
          .from('muayeneler')
          .select('id, organization_id, data, created_at')
          .in('organization_id', safeIds)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[UzmanSaglik] muayeneler fetch error:', error);
          setKayitlar([]);
          return;
        }

        if (!muayeneler || muayeneler.length === 0) {
          setKayitlar([]);
          return;
        }

        // Personel isimlerini çek — personelId data.personelId içinde
        const personelIds = [...new Set(
          muayeneler
            .map(m => (m.data as Record<string, unknown>)?.personelId as string)
            .filter(Boolean)
        )];

        const personelMap: Record<string, string> = {};
        if (personelIds.length > 0) {
          const { data: personeller } = await supabase
            .from('personeller')
            .select('id, data')
            .in('id', personelIds);

          (personeller ?? []).forEach(p => {
            const d = p.data as Record<string, unknown>;
            personelMap[p.id] = (d?.adSoyad as string) ?? `${d?.ad ?? ''} ${d?.soyad ?? ''}`.trim() ?? 'Bilinmiyor';
          });
        }

        const list: MuayeneKayit[] = muayeneler.map(m => {
          const d = (m.data ?? {}) as Record<string, unknown>;
          const personelId = (d.personelId as string) ?? '';
          return {
            id: m.id,
            personelId,
            personelAdi: personelMap[personelId] ?? 'Bilinmiyor',
            muayeneTarihi: (d.muayeneTarihi as string) ?? '',
            sonrakiTarih: (d.sonrakiTarih as string) ?? '',
            sonuc: (d.sonuc as string) ?? '',
            organizationId: m.organization_id,
            firmaAdi: fMap[m.organization_id] ?? 'Bilinmiyor',
            ek2: (d.ek2 as boolean) ?? false,
            doktor: (d.doktor as string) ?? '',
            hastane: (d.hastane as string) ?? '',
          };
        });

        setKayitlar(list);
      } catch (err) {
        console.error('[UzmanSaglik] unexpected error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atanmisFirmaIds.join(',')]);

  const filtered = kayitlar.filter(k => {
    const matchSearch = searchQuery === '' || (k.personelAdi ?? '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchFirma  = firmaFilter === '' || k.organizationId === firmaFilter;
    return matchSearch && matchFirma;
  });

  const uygunSayisi  = kayitlar.filter(k => k.sonuc === 'uygun' || k.sonuc === 'Çalışabilir').length;
  const kisitliSayisi = kayitlar.filter(k => k.sonuc === 'kisitli' || k.sonuc === 'Kısıtlı Çalışabilir').length;
  const uygunDegil   = kayitlar.filter(k => k.sonuc === 'uygun_degil' || k.sonuc === 'Çalışamaz').length;

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
        {[
          { label: 'Çalışabilir',         count: uygunSayisi,   ...getSonucCfg('uygun') },
          { label: 'Kısıtlı',             count: kisitliSayisi, ...getSonucCfg('kisitli') },
          { label: 'Çalışamaz',           count: uygunDegil,    ...getSonucCfg('uygun_degil') },
        ].map(item => (
          <div key={item.label} className="rounded-2xl p-4 text-center" style={{ background: item.bg, border: `1px solid ${item.color}30` }}>
            <div className="w-8 h-8 flex items-center justify-center rounded-xl mx-auto mb-2" style={{ background: item.bg }}>
              <i className={`${item.icon} text-sm`} style={{ color: item.color }} />
            </div>
            <p className="text-xl font-bold" style={{ color: item.color }}>{item.count}</p>
            <p className="text-[10px] mt-0.5 font-medium" style={{ color: textMuted }}>{item.label}</p>
          </div>
        ))}
      </div>

      {/* Tablo */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ background: cardBg, border: `1px solid ${border}` }}>
          <i className="ri-heart-pulse-line text-4xl mb-3" style={{ color: isDark ? '#334155' : '#cbd5e1', display: 'block' }} />
          <p className="text-sm font-medium" style={{ color: textMuted }}>
            {searchQuery || firmaFilter ? 'Filtrelere uygun kayıt bulunamadı' : 'Muayene kaydı bulunamadı'}
          </p>
          {!searchQuery && !firmaFilter && (
            <p className="text-xs mt-1" style={{ color: isDark ? '#334155' : '#cbd5e1' }}>
              Veriler hekim tarafından girildikçe burada görünecek
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${border}` }}>
          {/* Tablo başlığı */}
          <div
            className="hidden sm:grid grid-cols-5 gap-4 px-5 py-3 text-[11px] font-bold uppercase tracking-wider"
            style={{ background: sectionBg, color: textSecondary, borderBottom: `1px solid ${border}` }}
          >
            <div>Ad Soyad</div>
            <div>Firma</div>
            <div>Muayene Tarihi</div>
            <div>Sonraki Muayene</div>
            <div>Durum</div>
          </div>

          <div>
            {filtered.map((k, idx) => {
              const cfg = getSonucCfg(k.sonuc);
              const gecmisUyari = isSonakiTarihGecmis(k.sonrakiTarih);
              return (
                <div
                  key={k.id}
                  className="grid grid-cols-1 sm:grid-cols-5 gap-2 sm:gap-4 px-5 py-4 transition-colors"
                  style={{
                    background: cardBg,
                    borderBottom: idx < filtered.length - 1 ? `1px solid ${border}` : 'none',
                  }}
                >
                  {/* Ad Soyad */}
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0 text-[11px] font-bold text-white"
                      style={{ background: `linear-gradient(135deg, ${ACCENT_DARK}, ${ACCENT})` }}
                    >
                      {(k.personelAdi ?? '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-sm font-semibold" style={{ color: textPrimary }}>{k.personelAdi}</span>
                      {k.ek2 && (
                        <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(14,165,233,0.12)', color: ACCENT }}>EK-2</span>
                      )}
                    </div>
                  </div>

                  {/* Firma */}
                  <div className="text-xs truncate self-center" style={{ color: textMuted }}>
                    <span className="sm:hidden font-semibold mr-1" style={{ color: textSecondary }}>Firma:</span>
                    {k.firmaAdi}
                  </div>

                  {/* Muayene Tarihi */}
                  <div className="text-sm self-center" style={{ color: textMuted }}>
                    <span className="sm:hidden font-semibold mr-1" style={{ color: textSecondary }}>Tarih:</span>
                    {k.muayeneTarihi ? new Date(k.muayeneTarihi).toLocaleDateString('tr-TR') : '—'}
                  </div>

                  {/* Sonraki Muayene */}
                  <div className="text-sm self-center flex items-center gap-1.5">
                    <span className="sm:hidden font-semibold mr-1" style={{ color: textSecondary }}>Sonraki:</span>
                    {k.sonrakiTarih ? (
                      <>
                        <span style={{ color: gecmisUyari ? '#F87171' : textMuted }}>
                          {new Date(k.sonrakiTarih).toLocaleDateString('tr-TR')}
                        </span>
                        {gecmisUyari && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(248,113,113,0.12)', color: '#F87171' }}>
                            Geçti
                          </span>
                        )}
                      </>
                    ) : (
                      <span style={{ color: isDark ? '#334155' : '#cbd5e1' }}>—</span>
                    )}
                  </div>

                  {/* Durum */}
                  <div className="self-center">
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full"
                      style={{ background: cfg.bg, color: cfg.color }}
                    >
                      <i className={`${cfg.icon} text-xs`} />
                      {cfg.label}
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
