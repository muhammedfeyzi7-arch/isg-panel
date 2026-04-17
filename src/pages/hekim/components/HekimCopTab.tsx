import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface DeletedItem {
  id: string;
  type: 'muayene' | 'is_kazasi';
  label: string;
  subLabel: string;
  firmaAd: string;
  deletedAt: string;
}

interface HekimCopTabProps {
  atanmisFirmaIds: string[];
  isDark: boolean;
  addToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function HekimCopTab({ atanmisFirmaIds, isDark, addToast }: HekimCopTabProps) {
  const [items, setItems] = useState<DeletedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<'tumu' | 'muayene' | 'is_kazasi'>('tumu');
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<DeletedItem | null>(null);

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
          const [muayeneResult, kazaResult, personelResult] = await Promise.all([
            supabase.from('muayeneler').select('id, data, deleted_at').eq('organization_id', firmaId).not('deleted_at', 'is', null),
            supabase.from('is_kazalari').select('id, personel_id, kaza_tarihi, kaza_turu, deleted_at').eq('organization_id', firmaId).not('deleted_at', 'is', null),
            supabase.from('personeller').select('id, data').eq('organization_id', firmaId),
          ]);

          const pAdMap: Record<string, string> = {};
          (personelResult.data ?? []).forEach(r => {
            const d = r.data as Record<string, unknown>;
            pAdMap[r.id] = (d.adSoyad as string) ?? 'Bilinmiyor';
          });

          (muayeneResult.data ?? []).forEach(r => {
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

          (kazaResult.data ?? []).forEach(r => {
            allItems.push({
              id: r.id,
              type: 'is_kazasi',
              label: pAdMap[r.personel_id] ?? 'Bilinmiyor',
              subLabel: r.kaza_tarihi ? new Date(r.kaza_tarihi).toLocaleDateString('tr-TR') : '—',
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

  const handleRestore = async (item: DeletedItem) => {
    setRestoringId(item.id);
    try {
      const table = item.type === 'muayene' ? 'muayeneler' : 'is_kazalari';
      const { error } = await supabase
        .from(table)
        .update({ deleted_at: null })
        .eq('id', item.id);

      if (error) {
        addToast?.('Geri yükleme başarısız: ' + error.message, 'error');
      } else {
        addToast?.(`"${item.label}" kaydı başarıyla geri yüklendi.`, 'success');
        setItems(prev => prev.filter(i => i.id !== item.id));
        setConfirmRestore(null);
      }
    } catch {
      addToast?.('Beklenmeyen bir hata oluştu.', 'error');
    } finally {
      setRestoringId(null);
    }
  };

  const filtered = items.filter(item => activeType === 'tumu' || item.type === activeType);
  const muayeneCount = items.filter(i => i.type === 'muayene').length;
  const kazaCount = items.filter(i => i.type === 'is_kazasi').length;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const typeConfig = {
    muayene: { icon: 'ri-heart-pulse-line', color: '#F43F5E', bg: 'rgba(244,63,94,0.1)', label: 'Muayene' },
    is_kazasi: { icon: 'ri-alert-line', color: '#EF4444', bg: 'rgba(239,68,68,0.1)', label: 'İş Kazası' },
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold" style={{ color: textPrimary, letterSpacing: '-0.02em' }}>Çöp Kutusu</h2>
        <p className="text-xs mt-0.5" style={{ color: textSecondary }}>Silinen kayıtları görüntüleyin ve geri yükleyin</p>
      </div>

      {/* Bilgi banneri */}
      <div className="rounded-xl p-3.5 flex items-start gap-2.5"
        style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.15)' }}>
        <i className="ri-information-line text-sm flex-shrink-0 mt-0.5" style={{ color: ACCENT }} />
        <p className="text-xs leading-relaxed" style={{ color: textSecondary }}>
          Silinen kayıtları <strong style={{ color: textPrimary }}>geri yükleyebilirsiniz</strong>. Geri yüklenen kayıtlar ilgili sekmelerde tekrar görünür hale gelir.
        </p>
      </div>

      {/* Filtre tabs */}
      <div className="flex items-center gap-1.5">
        {[
          { key: 'tumu' as const, label: `Tümü (${items.length})` },
          { key: 'muayene' as const, label: `Muayene (${muayeneCount})` },
          { key: 'is_kazasi' as const, label: `İş Kazası (${kazaCount})` },
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
            <div className="min-w-[640px]">
              <div className="grid items-center px-4 py-2.5"
                style={{ gridTemplateColumns: '2fr 1fr 1.2fr 1fr 100px', background: tableHeadBg, borderBottom: `1px solid ${borderColor}` }}>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: textSecondary }}>KAYIT</span>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: textSecondary }}>TİP</span>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: textSecondary }}>FİRMA</span>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: textSecondary }}>SİLİNME</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-right" style={{ color: textSecondary }}>İŞLEM</span>
              </div>

              <div className="space-y-1.5 p-2">
                {filtered.map((item) => {
                  const config = typeConfig[item.type];
                  const isRestoring = restoringId === item.id;
                  return (
                    <div
                      key={`${item.type}-${item.id}`}
                      className="grid items-center px-4 py-3 rounded-xl transition-all duration-200 cursor-default"
                      style={{
                        gridTemplateColumns: '2fr 1fr 1.2fr 1fr 100px',
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

                      {/* Geri Yükle butonu */}
                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => setConfirmRestore(item)}
                          disabled={isRestoring}
                          className="whitespace-nowrap flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                          style={{
                            background: isRestoring ? 'rgba(16,185,129,0.05)' : 'rgba(16,185,129,0.1)',
                            color: '#10B981',
                            border: '1px solid rgba(16,185,129,0.25)',
                            opacity: isRestoring ? 0.6 : 1,
                          }}
                          onMouseEnter={e => { if (!isRestoring) (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.2)'; }}
                          onMouseLeave={e => { if (!isRestoring) (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.1)'; }}
                        >
                          {isRestoring
                            ? <i className="ri-loader-4-line animate-spin text-xs" />
                            : <i className="ri-arrow-go-back-line text-xs" />
                          }
                          {isRestoring ? 'Yükleniyor' : 'Geri Al'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Geri Yükleme Onay Modalı */}
      {confirmRestore && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', zIndex: 9999 }}
        >
          <div
            className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${borderColor}` }}
          >
            <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #10B981, #34D399)' }} />
            <div className="p-6">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1.5px solid rgba(16,185,129,0.2)' }}>
                <i className="ri-arrow-go-back-line text-xl" style={{ color: '#10B981' }} />
              </div>
              <p className="text-sm font-bold mb-1" style={{ color: textPrimary }}>Kaydı geri yükle?</p>
              <p className="text-xs mb-1" style={{ color: textSecondary }}>
                <strong style={{ color: textPrimary }}>{confirmRestore.label}</strong> adlı kayıt geri yüklenecek.
              </p>
              <p className="text-xs mb-5" style={{ color: textSecondary }}>
                İlgili sekmede tekrar görünür hale gelecek.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmRestore(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold cursor-pointer whitespace-nowrap"
                  style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', color: textSecondary, border: `1px solid ${borderColor}` }}
                >
                  İptal
                </button>
                <button
                  onClick={() => handleRestore(confirmRestore)}
                  disabled={restoringId === confirmRestore.id}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold cursor-pointer text-white whitespace-nowrap flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #059669, #10B981)', opacity: restoringId === confirmRestore.id ? 0.7 : 1 }}
                >
                  {restoringId === confirmRestore.id
                    ? <><i className="ri-loader-4-line animate-spin" />Yükleniyor...</>
                    : <><i className="ri-arrow-go-back-line" />Geri Yükle</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
