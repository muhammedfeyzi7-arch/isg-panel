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

  const card: React.CSSProperties = {
    background: isDark
      ? 'linear-gradient(145deg, rgba(30,41,59,0.95), rgba(15,23,42,0.98))'
      : 'linear-gradient(145deg, rgba(255,255,255,0.98), rgba(248,250,252,0.95))',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)'}`,
    borderRadius: '20px',
  };

  useEffect(() => {
    if (atanmisFirmaIds.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const safeIds = atanmisFirmaIds.filter(id => typeof id === 'string' && id.length > 0);
        if (safeIds.length === 0) { setItems([]); setLoading(false); return; }

        const { data: orgs } = await supabase
          .from('organizations')
          .select('id, name')
          .in('id', safeIds);

        const firmaAdMap: Record<string, string> = {};
        (orgs ?? []).forEach(o => { firmaAdMap[o.id] = o.name; });

        const allItems: DeletedItem[] = [];

        await Promise.all(
          safeIds.map(async (firmaId) => {
            // Silinen personeller
            const { data: personelRows } = await supabase
              .from('personeller')
              .select('id, data, deleted_at')
              .eq('organization_id', firmaId)
              .not('deleted_at', 'is', null);

            (personelRows ?? []).forEach(r => {
              const d = r.data as Record<string, unknown>;
              allItems.push({
                id: r.id,
                type: 'personel',
                label: (d.adSoyad as string) ?? 'İsimsiz Personel',
                subLabel: (d.gorev as string) ?? '—',
                firmaAd: firmaAdMap[firmaId] ?? firmaId,
                deletedAt: r.deleted_at ?? '',
              });
            });

            // Silinen muayeneler
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
          })
        );

        // Silme tarihine göre sırala
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
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold" style={{ color: textPrimary, letterSpacing: '-0.02em' }}>Çöp Kutusu</h2>
        <p className="text-xs mt-0.5" style={{ color: textSecondary }}>
          Silinen kayıtları görüntüleyin — yalnızca okuma yetkisi
        </p>
      </div>

      {/* Bilgi banneri */}
      <div className="rounded-2xl p-4 flex items-start gap-3"
        style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.15)' }}>
        <div className="w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
          <i className="ri-information-line text-sm" style={{ color: '#0EA5E9' }} />
        </div>
        <p className="text-[12px] leading-relaxed" style={{ color: textSecondary }}>
          Bu bölümde yalnızca silinen kayıtları <strong style={{ color: textPrimary }}>görüntüleyebilirsiniz</strong>.
          Geri yükleme veya kalıcı silme işlemleri için OSGB yöneticinizle iletişime geçin.
        </p>
      </div>

      {/* Filtre tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {[
          { key: 'tumu' as const, label: `Tümü (${items.length})` },
          { key: 'personel' as const, label: `Personel (${personelCount})` },
          { key: 'muayene' as const, label: `Muayene (${muayeneCount})` },
        ].map(opt => (
          <button
            key={opt.key}
            onClick={() => setActiveType(opt.key)}
            className="whitespace-nowrap px-3 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer transition-all"
            style={{
              background: activeType === opt.key ? 'rgba(14,165,233,0.15)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)'),
              color: activeType === opt.key ? '#0EA5E9' : textSecondary,
              border: `1px solid ${activeType === opt.key ? 'rgba(14,165,233,0.3)' : (isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.09)')}`,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl p-4 animate-pulse" style={card}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)' }} />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 rounded" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)' }} />
                  <div className="h-3 w-28 rounded" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Boş state */}
      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl p-14 flex flex-col items-center gap-5" style={card}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(100,116,139,0.08)', border: '1.5px solid rgba(100,116,139,0.15)' }}>
            <i className="ri-delete-bin-6-line text-2xl" style={{ color: '#94A3B8' }} />
          </div>
          <div className="text-center">
            <p className="text-base font-bold mb-2" style={{ color: textPrimary }}>Çöp kutusu boş</p>
            <p className="text-sm" style={{ color: textSecondary }}>
              Atanmış firmalarınızda silinmiş kayıt bulunmuyor.
            </p>
          </div>
        </div>
      )}

      {/* Liste */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((item, idx) => {
            const config = typeConfig[item.type];
            return (
              <div
                key={`${item.type}-${item.id}`}
                className="rounded-2xl p-4"
                style={{
                  ...card,
                  animation: `hekimCopFadeIn 0.3s ease ${idx * 0.03}s both`,
                }}
              >
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: config.bg, border: `1px solid ${config.color}22` }}
                  >
                    <i className={`${config.icon} text-sm`} style={{ color: config.color }} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold" style={{ color: textPrimary }}>{item.label}</p>
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase"
                        style={{ background: config.bg, color: config.color, border: `1px solid ${config.color}33` }}
                      >
                        {config.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-[11px]" style={{ color: textSecondary }}>
                        <i className="ri-briefcase-line mr-1 text-[10px]" />
                        {item.subLabel}
                      </span>
                      <span style={{ color: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(15,23,42,0.2)', fontSize: '10px' }}>·</span>
                      <span className="text-[11px]" style={{ color: '#0EA5E9', fontWeight: 600 }}>
                        <i className="ri-building-3-line mr-1 text-[10px]" />
                        {item.firmaAd}
                      </span>
                    </div>
                  </div>

                  {/* Delete date */}
                  <div className="flex-shrink-0 text-right">
                    <p className="text-[10px] font-medium mb-0.5" style={{ color: textSecondary }}>Silinme tarihi</p>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)',
                        color: textSecondary,
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)'}`,
                      }}
                    >
                      {formatDate(item.deletedAt)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes hekimCopFadeIn {
          from { opacity: 0; transform: translateX(-6px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}