import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Props {
  atanmisFirmaIds: string[];
  isDark: boolean;
}

interface Firma {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  is_active?: boolean;
  created_at?: string;
  personelCount?: number;
  ekipmanCount?: number;
}

const ACCENT = '#0EA5E9';

export default function UzmanFirmalar({ atanmisFirmaIds, isDark }: Props) {
  const [firmalar, setFirmalar] = useState<Firma[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Firma | null>(null);
  const [firmaStats, setFirmaStats] = useState<Record<string, { personel: number; ekipman: number }>>({});
  const [searchQuery, setSearchQuery] = useState('');

  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : '#ffffff';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = isDark ? '#64748b' : '#94a3b8';
  const textSecondary = isDark ? '#94a3b8' : '#475569';

  useEffect(() => {
    if (atanmisFirmaIds.length === 0) { setLoading(false); return; }
    const fetch = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('organizations')
          .select('id, name, created_at, is_active')
          .in('id', atanmisFirmaIds);

        const list: Firma[] = (data ?? []).map(o => ({
          id: o.id,
          name: o.name,
          is_active: o.is_active,
          created_at: o.created_at,
        }));
        setFirmalar(list);

        // Her firma için istatistik çek
        const statsMap: Record<string, { personel: number; ekipman: number }> = {};
        await Promise.all(list.map(async f => {
          const [{ count: p }, { count: e }] = await Promise.all([
            supabase.from('personeller').select('*', { count: 'exact', head: true }).eq('organization_id', f.id).eq('silinmis', false),
            supabase.from('ekipmanlar').select('*', { count: 'exact', head: true }).eq('organization_id', f.id).eq('silinmis', false),
          ]);
          statsMap[f.id] = { personel: p ?? 0, ekipman: e ?? 0 };
        }));
        setFirmaStats(statsMap);
      } catch (err) {
        console.error('[UzmanFirmalar]', err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [atanmisFirmaIds.join(',')]);

  const filtered = firmalar.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: cardBg, border: `1px solid ${border}` }} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Başlık + Arama */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color: textPrimary, letterSpacing: '-0.02em' }}>Atanmış Firmalar</h2>
          <p className="text-sm mt-0.5" style={{ color: textMuted }}>{firmalar.length} firma atanmış (sadece görüntüleme)</p>
        </div>
        <div className="relative">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: textMuted }} />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Firma ara..."
            className="pl-9 pr-4 py-2 rounded-xl text-sm outline-none w-full sm:w-56"
            style={{
              background: cardBg,
              border: `1px solid ${border}`,
              color: textPrimary,
            }}
          />
        </div>
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ background: cardBg, border: `1px solid ${border}` }}>
          <i className="ri-building-3-line text-4xl mb-3" style={{ color: isDark ? '#334155' : '#cbd5e1', display: 'block' }} />
          <p className="text-sm font-medium" style={{ color: textMuted }}>
            {searchQuery ? 'Arama sonucu bulunamadı' : 'Henüz firma atanmamış'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(firma => {
            const stats = firmaStats[firma.id] ?? { personel: 0, ekipman: 0 };
            return (
              <button
                key={firma.id}
                onClick={() => setSelected(firma)}
                className="text-left rounded-2xl p-5 cursor-pointer transition-all duration-200"
                style={{
                  background: cardBg,
                  border: `1px solid ${border}`,
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = `rgba(14,165,233,0.3)`;
                  (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(14,165,233,0.06)' : 'rgba(14,165,233,0.03)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = border;
                  (e.currentTarget as HTMLElement).style.background = cardBg;
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-11 h-11 flex items-center justify-center rounded-xl text-base font-bold text-white"
                    style={{ background: `linear-gradient(135deg, ${ACCENT}, #38BDF8)` }}>
                    {firma.name.charAt(0).toUpperCase()}
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-1 rounded-full"
                    style={{
                      background: firma.is_active ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.1)',
                      color: firma.is_active ? '#34D399' : '#F87171',
                      border: `1px solid ${firma.is_active ? 'rgba(52,211,153,0.2)' : 'rgba(239,68,68,0.2)'}`,
                    }}
                  >
                    {firma.is_active ? 'Aktif' : 'Pasif'}
                  </span>
                </div>
                <p className="text-[13px] font-bold mb-1 truncate" style={{ color: textPrimary }}>{firma.name}</p>
                <p className="text-xs mb-4" style={{ color: textMuted }}>
                  {firma.created_at ? new Date(firma.created_at).toLocaleDateString('tr-TR') + ' tarihinde eklendi' : '—'}
                </p>
                <div className="flex items-center gap-4 pt-3" style={{ borderTop: `1px solid ${border}` }}>
                  <div className="flex items-center gap-1.5">
                    <i className="ri-group-line text-xs" style={{ color: ACCENT }} />
                    <span className="text-xs font-semibold" style={{ color: textSecondary }}>{stats.personel} personel</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <i className="ri-tools-line text-xs" style={{ color: '#818CF8' }} />
                    <span className="text-xs font-semibold" style={{ color: textSecondary }}>{stats.ekipman} ekipman</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Detay Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl p-6"
            style={{
              background: isDark ? '#1a2235' : '#ffffff',
              border: `1px solid ${border}`,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 flex items-center justify-center rounded-2xl text-lg font-bold text-white"
                  style={{ background: `linear-gradient(135deg, ${ACCENT}, #38BDF8)` }}>
                  {selected.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-base font-bold" style={{ color: textPrimary }}>{selected.name}</p>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: selected.is_active ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.1)',
                      color: selected.is_active ? '#34D399' : '#F87171',
                    }}
                  >
                    {selected.is_active ? 'Aktif' : 'Pasif'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer"
                style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)', color: textMuted }}
              >
                <i className="ri-close-line text-sm" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.15)' }}>
                  <p className="text-2xl font-bold" style={{ color: ACCENT }}>{firmaStats[selected.id]?.personel ?? 0}</p>
                  <p className="text-xs mt-1" style={{ color: textMuted }}>Personel</p>
                </div>
                <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.15)' }}>
                  <p className="text-2xl font-bold" style={{ color: '#818CF8' }}>{firmaStats[selected.id]?.ekipman ?? 0}</p>
                  <p className="text-xs mt-1" style={{ color: textMuted }}>Ekipman</p>
                </div>
              </div>

              {selected.created_at && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)', border: `1px solid ${border}` }}>
                  <i className="ri-calendar-line text-sm" style={{ color: ACCENT }} />
                  <div>
                    <p className="text-xs font-medium" style={{ color: textMuted }}>Kayıt Tarihi</p>
                    <p className="text-sm font-semibold" style={{ color: textPrimary }}>{new Date(selected.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.12)' }}>
                <i className="ri-information-line text-xs" style={{ color: ACCENT }} />
                <p className="text-xs" style={{ color: '#64748b' }}>Bu firma OSGB admin tarafından size atanmıştır. Firma bilgilerini düzenleyemezsiniz.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
