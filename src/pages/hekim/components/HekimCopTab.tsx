import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface DeletedItem {
  id: string;
  type: 'personel' | 'muayene';
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
  const [activeType, setActiveType] = useState<'tumu' | 'personel' | 'muayene'>('tumu');

  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const tableBg = isDark ? 'rgba(20,30,50,0.98)' : '#ffffff';
  const tableHeadBg = isDark ? 'rgba(15,23,42,0.8)' : '#f8fafc';
  const borderColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)';
  const rowHoverBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)';

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
          const { data: personelRows } = await supabase.from('personeller').select('id, data, deleted_at').eq('organization_id', firmaId).not('deleted_at', 'is', null);
          (personelRows ?? []).forEach(r => {
            const d = r.data as Record<string, unknown>;
            allItems.push({ id: r.id, type: 'personel', label: (d.adSoyad as string) ?? 'İsimsiz Personel', subLabel: (d.gorev as string) ?? '—', firmaAd: firmaAdMap[firmaId] ?? firmaId, deletedAt: r.deleted_at ?? '' });
          });

          const { data: muayeneRows } = await supabase.from('muayeneler').select('id, data, deleted_at').eq('organization_id', firmaId).not('deleted_at', 'is', null);
          const { data: personellerForMap } = await supabase.from('personeller').select('id, data').eq('organization_id', firmaId);
          const pAdMap: Record<string, string> = {};
          (personellerForMap ?? []).forEach(r => { const d = r.data as Record<string, unknown>; pAdMap[r.id] = (d.adSoyad as string) ?? 'Bilinmiyor'; });

          (muayeneRows ?? []).forEach(r => {
            const d = r.data as Record<string, unknown>;
            const pid = (d.personelId as string) ?? '';
            const tarih = (d.muayeneTarihi as string) ?? '';
            allItems.push({ id: r.id, type: 'muayene', label: pAdMap[pid] ?? 'Bilinmiyor', subLabel: tarih ? new Date(tarih).toLocaleDateString('tr-TR') : '—', firmaAd: firmaAdMap[firmaId] ?? firmaId, deletedAt: r.deleted_at ?? '' });
          });
        }));

        allItems.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
        setItems(allItems);
      } catch (err) { console.error('[HekimCopTab] load error:', err); }
      finally { setLoading(false); }
    };
    load();
  }, [atanmisFirmaIds]);

  const filtered = items.filter(item => activeType === 'tumu' || item.type === activeType);
  const personelCount = items.filter(i => i.type === 'personel').length;
  const muayeneCount = items.filter(i => i.type === 'muayene').length;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const typeConfig = {
    personel: { icon: 'ri-user-line', color: '#10B981', bg: 'rgba(16,185,129,0.1)', label: 'Personel' },
    muayene: { icon: 'ri-heart-pulse-line', color: '#F43F5E', bg: 'rgba(244,63,94,0.1)', label: 'Muayene' },
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold" style={{ color: textPrimary, letterSpacing: '-0.02em' }}>Çöp Kutusu</h2>
        <p className="text-xs mt-0.5" style={{ color: textSecondary }}>Silinen kayıtları görüntüleyin — yalnızca okuma yetkisi</p>
      </div>

      {/* Bilgi banneri */}
      <div className="rounded-xl p-3.5 flex items-start gap-2.5"
        style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.15)' }}>
        <i className="ri-information-line text-sm flex-shrink-0 mt-0.5" style={{ color: '#0EA5E9' }} />
        <p className="text-xs leading-relaxed" style={{ color: textSecondary }}>
          Bu bölümde yalnızca silinen kayıtları <strong style={{ color: textPrimary }}>görüntüleyebilirsiniz</strong>. Geri yükleme veya kalıcı silme için OSGB yöneticinizle iletişime geçin.
        </p>
      </div>

      {/* Filtre tabs */}
      <div className="flex items-center gap-1.5">
        {[
          { key: 'tumu' as const, label: `Tümü (${items.length})` },
          { key: 'personel' as const, label: `Personel (${personelCount})` },
          { key: 'muayene' as const, label: `Muayene (${muayeneCount})` },
        ].map(opt => (
          <button key={opt.key} onClick={() => setActiveType(opt.key)}
            className="whitespace-nowrap px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-all"
            style={{
              background: activeType === opt.key ? 'rgba(14,165,233,0.12)' : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)'),
              color: activeType === opt.key ? '#0EA5E9' : textSecondary,
              border: `1px solid ${activeType === opt.key ? 'rgba(14,165,233,0.3)' : borderColor}`,
            }}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="rounded-xl p-10 flex items-center justify-center gap-2" style={{ background: tableBg, border: `1px solid ${borderColor}` }}>
          <i className="ri-loader-4-line animate-spin text-lg" style={{ color: '#0EA5E9' }} />
          <span className="text-sm" style={{ color: textSecondary }}>Yükleniyor...</span>
        </div>
      )}

      {/* Boş state */}
      {!loading && filtered.length === 0 && (
        <div className="rounded-xl p-12 flex flex-col items-center gap-4 text-center" style={{ background: tableBg, border: `1px solid ${borderColor}` }}>
          <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: 'rgba(100,116,139,0.08)', border: '1.5px solid rgba(100,116,139,0.15)' }}>
            <i className="ri-delete-bin-6-line text-2xl" style={{ color: '#94A3B8' }} />
          </div>
          <div>
            <p className="text-sm font-bold mb-1" style={{ color: textPrimary }}>Çöp kutusu boş</p>
            <p className="text-xs" style={{ color: textSecondary }}>Silinmiş kayıt bulunmuyor.</p>
          </div>
        </div>
      )}

      {/* Tablo */}
      {!loading && filtered.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: tableBg, border: `1px solid ${borderColor}` }}>
          {/* Tablo başlığı */}
          <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr] items-center"
            style={{ background: tableHeadBg, borderBottom: `1px solid ${borderColor}` }}>
            <div className="px-4 py-2.5 w-10" />
            {['KAYIT', 'TİP', 'FİRMA', 'SİLİNME TARİHİ'].map(h => (
              <div key={h} className="px-4 py-2.5">
                <span className="text-[10px] font-bold tracking-wider" style={{ color: textSecondary }}>{h}</span>
              </div>
            ))}
          </div>

          {/* Satırlar */}
          <div>
            {filtered.map((item, idx) => {
              const config = typeConfig[item.type];
              return (
                <div key={`${item.type}-${item.id}`}
                  className="grid grid-cols-[auto_1fr_1fr_1fr_1fr] items-center transition-all"
                  style={{
                    borderBottom: idx < filtered.length - 1 ? `1px solid ${borderColor}` : 'none',
                    background: 'transparent',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = rowHoverBg; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>

                  {/* İkon */}
                  <div className="px-4 py-3 w-10 flex-shrink-0">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: config.bg, border: `1px solid ${config.color}22` }}>
                      <i className={`${config.icon} text-xs`} style={{ color: config.color }} />
                    </div>
                  </div>

                  {/* Kayıt */}
                  <div className="px-4 py-3 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: textPrimary }}>{item.label}</p>
                    <p className="text-[10px] mt-0.5 truncate" style={{ color: textSecondary }}>{item.subLabel}</p>
                  </div>

                  {/* Tip */}
                  <div className="px-4 py-3">
                    <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{ background: config.bg, color: config.color, border: `1px solid ${config.color}33` }}>
                      {config.label}
                    </span>
                  </div>

                  {/* Firma */}
                  <div className="px-4 py-3">
                    <span className="text-xs font-medium truncate" style={{ color: '#0EA5E9' }}>{item.firmaAd}</span>
                  </div>

                  {/* Silinme tarihi */}
                  <div className="px-4 py-3">
                    <span className="text-xs" style={{ color: textSecondary }}>{formatDate(item.deletedAt)}</span>
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
