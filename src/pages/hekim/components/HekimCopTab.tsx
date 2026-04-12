import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface DeletedItem {
  id: string;
  type: 'muayene';
  label: string;
  subLabel: string;
  firmaAd: string;
  deletedAt: string;
}

interface HekimCopTabProps {
  atanmisFirmaIds: string[];
  isDark: boolean;
}

export default function HekimCopTab({ atanmisFirmaIds, isDark }: HekimCopTabProps) {
  const [items, setItems] = useState<DeletedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<'tumu' | 'muayene'>('tumu');

  const ACCENT = '#0EA5E9';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const tableBg = isDark ? 'rgba(20,30,50,0.98)' : '#ffffff';
  const tableHeadBg = isDark ? 'rgba(15,23,42,0.8)' : '#f8fafc';
  const borderColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)';

  useEffect(() => {
    if (atanmisFirmaIds.length === 0) { setItems([]); setLoading(false); return; }
    const load = async () => {
      setLoading(true);
      try {
        const safeIds = atanmisFirmaIds.filter(id => typeof id === 'string' && id.length > 0);
        if (safeIds.length === 0) { setItems([]); setLoading(false); return; }

        const { data: orgs } = await supabase.from('organizations').select('id, name').in('id', safeIds);
        const firmaAdMap: Record<string, string> = {};
        (orgs ?? []).forEach(o => { firmaAdMap[o.id] = o.name; });

        const allItems: DeletedItem[] = [];
        await Promise.all(safeIds.map(async (firmaId) => {
          const { data: muayeneRows } = await supabase
            .from('muayeneler')
            .select('id, data, deleted_at')
            .eq('organization_id', firmaId)
            .not('deleted_at', 'is', null);
          const { data: personellerForMap } = await supabase
            .from('personeller')
            .select('id, data')
            .eq('organization_id', firmaId);
          const pAdMap: Record<string, string> = {};
          (personellerForMap ?? []).forEach(r => {
            const d = r.data as Record<string, unknown>;
            pAdMap[r.id] = (d.adSoyad as string) ?? 'Bilinmiyor';
          });

          (muayeneRows ?? []).forEach(r => {
            const d = r.data as Record<string, unknown>;
            const pid = (d.personelId as string) ?? '';
            const tarih = (d.muayeneTarihi as string) ?? '';
            allItems.push({
              id: r.id,
              type: 'muayene',
              label: pAdMap[pid] ?? 'Bilinmiyor',
              subLabel: tarih ? new Date(tarih).toLocaleDateString('tr-TR') : '—',
              firmaAd: firmaAdMap[firmaId] ?? firmaId,
              deletedAt: r.deleted_at ?? '',
            });
          });
        }));

        allItems.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
        setItems(allItems);
      } catch (err) {
        console.error('[HekimCopTab] load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [atanmisFirmaIds]);

  const filtered = items.filter(item => activeType === 'tumu' || item.type === activeType);
  const muayeneCount = items.filter(i => i.type === 'muayene').length;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const typeConfig = {
    muayene: { icon: 'ri-heart-pulse-line', color: '#F43F5E', bg: 'rgba(244,63,94,0.1)', label: 'Muayene' },
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold" style={{ color: textPrimary, letterSpacing: '-0.02em' }}>Çöp Kutusu</h2>
        <p className="text-xs mt-0.5" style={{ color: textSecondary }}>Silinen kayıtları görüntüleyin — yalnızca okuma yetkisi</p>
      </div>

      {/* Bilgi banneri */}
      <div className="rounded-xl p-3.5 flex items-start gap-2.5"
        style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.15)' }}>
        <i className="ri-information-line text-sm flex-shrink-0 mt-0.5" style={{ color: ACCENT }} />
        <p className="text-xs leading-relaxed" style={{ color: textSecondary }}>
          Bu bölümde yalnızca silinen kayıtları <strong style={{ color: textPrimary }}>görüntüleyebilirsiniz</strong>. Geri yükleme veya kalıcı silme için OSGB yöneticinizle iletişime geçin.
        </p>
      </div>

      {/* Filtre tabs */}
      <div className="flex items-center gap-1.5">
        {[
          { key: 'tumu' as const, label: `Tümü (${items.length})` },
          { key: 'muayene' as const, label: `Muayene (${muayeneCount})` },
        ].map(opt => (
          <button key={opt.key} onClick={() => setActiveType(opt.key)}
            className="whitespace-nowrap px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-all"
            style={{
              background: activeType === opt.key ? 'rgba(14,165,233,0.12)' : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)'),
              color: activeType === opt.key ? ACCENT : textSecondary,
              border: `1px solid ${activeType === opt.key ? 'rgba(14,165,233,0.3)' : borderColor}`,
            }}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="rounded-xl p-10 flex items-center justify-center gap-2" style={{ background: tableBg, border: `1px solid ${borderColor}` }}>
          <i className="ri-loader-4-line animate-spin text-lg" style={{ color: ACCENT }} />
          <span className="text-sm" style={{ color: textSecondary }}>Yükleniyor...</span>
        </div>
      )}

      {/* Boş state */}
      {!loading && filtered.length === 0 && (
        <div className="rounded-xl p-12 flex flex-col items-center gap-4 text-center" style={{ background: tableBg, border: `1px solid ${borderColor}` }}>
          <div className="w-14 h-14 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(100,116,139,0.08)', border: '1.5px solid rgba(100,116,139,0.15)' }}>
            <i className="ri-delete-bin-6-line text-2xl" style={{ color: '#94A3B8' }} />
          </div>
          <div>
            <p className="text-sm font-bold mb-1" style={{ color: textPrimary }}>Çöp kutusu boş</p>
            <p className="text-xs" style={{ color: textSecondary }}>Silinmiş kayıt bulunmuyor.</p>
          </div>
        </div>
      )}

      {/* Liste */}
      {!loading && filtered.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: tableBg, border: `1px solid ${borderColor}` }}>
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              <div className="grid items-center px-4 py-2.5"
                style={{ gridTemplateColumns: '2fr 1fr 1.2fr 1fr', background: tableHeadBg, borderBottom: `1px solid ${borderColor}` }}>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: textSecondary }}>KAYIT</span>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: textSecondary }}>TİP</span>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: textSecondary }}>FİRMA</span>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: textSecondary }}>SİLİNME</span>
              </div>

              <div className="space-y-1.5 p-2">
                {filtered.map((item) => {
                  const config = typeConfig[item.type];
                  return (
                    <div
                      key={`${item.type}-${item.id}`}
                      className="grid items-center px-4 py-3 rounded-xl transition-all duration-200 cursor-default"
                      style={{
                        gridTemplateColumns: '2fr 1fr 1.2fr 1fr',
                        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.02)',
                        border: `1px solid ${borderColor}`,
                      }}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.background = isDark ? 'rgba(14,165,233,0.07)' : 'rgba(14,165,233,0.04)';
                        el.style.borderColor = 'rgba(14,165,233,0.25)';
                        el.style.transform = 'translateX(2px)';
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.02)';
                        el.style.borderColor = borderColor;
                        el.style.transform = 'translateX(0)';
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: config.bg, border: `1px solid ${config.color}33` }}>
                          <i className={`${config.icon} text-sm`} style={{ color: config.color }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: textPrimary }}>{item.label}</p>
                          <p className="text-[10px] mt-0.5 truncate" style={{ color: textSecondary }}>{item.subLabel}</p>
                        </div>
                      </div>

                      <div>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
                          style={{ background: config.bg, color: config.color, border: `1px solid ${config.color}33` }}>
                          {config.label}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap truncate"
                          style={{ background: 'rgba(14,165,233,0.1)', color: ACCENT, border: '1px solid rgba(14,165,233,0.2)' }}>
                          <i className="ri-building-2-line text-[9px] flex-shrink-0" />
                          <span className="truncate">{item.firmaAd}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <i className="ri-time-line text-[10px]" style={{ color: textSecondary }} />
                        <span className="text-xs" style={{ color: textSecondary }}>{formatDate(item.deletedAt)}</span>
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
