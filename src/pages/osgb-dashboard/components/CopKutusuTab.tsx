import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface SilinmisFirma {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
  deleted_at: string | null;  // null olabilir (is_active:false ama deleted_at yok)
}

interface FirmaVeriOzet {
  personelCount: number;
  evrakCount: number;
  ekipmanCount: number;
  uygunsuzlukCount: number;
  egitimCount: number;
  loading: boolean;
}

interface CopKutusuTabProps {
  orgId: string;
  isDark: boolean;
  onFirmaRestored: () => void;
  onGoToFirmalar?: () => void;
}

export default function CopKutusuTab({ orgId, isDark, onFirmaRestored, onGoToFirmalar }: CopKutusuTabProps) {
  const [firmalar, setFirmalar] = useState<SilinmisFirma[]>([]);
  const [loading, setLoading] = useState(true);
  const [kaliciSilOnayId, setKaliciSilOnayId] = useState<string | null>(null);
  const [kaliciSilVeriOzet, setKaliciSilVeriOzet] = useState<FirmaVeriOzet | null>(null);
  const [islemLoading, setIslemLoading] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<{ tip: 'success' | 'error'; metin: string } | null>(null);

  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = isDark ? '#64748b' : '#64748b';
  const cardBg = isDark ? 'rgba(17,24,39,0.85)' : '#ffffff';
  const border = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)';

  const fetchSilinmis = useCallback(async () => {
    setLoading(true);
    try {
      // deleted_at dolu VEYA is_active: false olan firmaları göster
      const { data: byDeleted } = await supabase
        .from('organizations')
        .select('id, name, invite_code, created_at, deleted_at')
        .eq('parent_org_id', orgId)
        .eq('org_type', 'firma')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      // deleted_at yoksa is_active: false olanları da kontrol et
      const { data: byInactive } = await supabase
        .from('organizations')
        .select('id, name, invite_code, created_at, deleted_at')
        .eq('parent_org_id', orgId)
        .eq('org_type', 'firma')
        .eq('is_active', false)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      const allDeleted = [...(byDeleted ?? []), ...(byInactive ?? [])];
      // Deduplicate
      const seen = new Set<string>();
      const unique = allDeleted.filter(f => {
        if (seen.has(f.id)) return false;
        seen.add(f.id);
        return true;
      });
      setFirmalar(unique as SilinmisFirma[]);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { void fetchSilinmis(); }, [fetchSilinmis]);

  const showMesaj = (tip: 'success' | 'error', metin: string) => {
    setMesaj({ tip, metin });
    setTimeout(() => setMesaj(null), 3000);
  };

  const handleGeriAl = async (firmaId: string, firmaAdi: string) => {
    setIslemLoading(firmaId);
    try {
      const temizAd = firmaAdi.replace(/^\[SİLİNDİ\]\s*/i, '').trim();

      // Önce güncellemeyi yap
      const { error, count } = await supabase
        .from('organizations')
        .update({ deleted_at: null, is_active: true, name: temizAd })
        .eq('id', firmaId)
        .select('id', { count: 'exact', head: true });

      if (error) {
        // RLS veya başka bir hata
        if (error.message?.includes('row-level security') || error.code === '42501') {
          showMesaj('error', 'Yetki hatası: Bu firmayı geri alma yetkiniz yok.');
        } else {
          showMesaj('error', `Geri alma başarısız: ${error.message}`);
        }
        return;
      }

      // count 0 ise RLS sessizce engelledi demektir
      if (count === 0) {
        // count null da olabilir — doğrulama için firmayı tekrar çek
        const { data: check } = await supabase
          .from('organizations')
          .select('id, deleted_at, is_active')
          .eq('id', firmaId)
          .maybeSingle();

        if (check && check.deleted_at !== null) {
          showMesaj('error', 'Güncelleme yapılamadı. Sayfayı yenileyip tekrar deneyin.');
          return;
        }
      }

      // Yerel listeden kaldır
      setFirmalar(prev => prev.filter(f => f.id !== firmaId));
      showMesaj('success', `"${temizAd}" başarıyla geri alındı ve aktif edildi.`);

      // DB yazmasının yayılması için bekle, sonra parent'ı yenile
      await new Promise<void>(resolve => setTimeout(resolve, 800));
      onFirmaRestored();

      // Firmalar tabına geç
      await new Promise<void>(resolve => setTimeout(resolve, 200));
      if (onGoToFirmalar) onGoToFirmalar();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bilinmeyen hata';
      showMesaj('error', `Geri alma başarısız: ${msg}`);
    } finally {
      setIslemLoading(null);
    }
  };

  const handleKaliciSilOnayla = async (firmaId: string) => {
    setKaliciSilOnayId(firmaId);
    setKaliciSilVeriOzet({ personelCount: 0, evrakCount: 0, ekipmanCount: 0, uygunsuzlukCount: 0, egitimCount: 0, loading: true });
    try {
      const [
        { count: personelC },
        { count: evrakC },
        { count: ekipmanC },
        { count: uygunsuzlukC },
        { count: egitimC },
      ] = await Promise.all([
        supabase.from('personeller').select('id', { count: 'exact', head: true }).eq('organization_id', firmaId).is('deleted_at', null),
        supabase.from('evraklar').select('id', { count: 'exact', head: true }).eq('organization_id', firmaId).is('deleted_at', null),
        supabase.from('ekipmanlar').select('id', { count: 'exact', head: true }).eq('organization_id', firmaId).is('deleted_at', null),
        supabase.from('uygunsuzluklar').select('id', { count: 'exact', head: true }).eq('organization_id', firmaId).is('deleted_at', null),
        supabase.from('egitimler').select('id', { count: 'exact', head: true }).eq('organization_id', firmaId).is('deleted_at', null),
      ]);
      setKaliciSilVeriOzet({ personelCount: personelC ?? 0, evrakCount: evrakC ?? 0, ekipmanCount: ekipmanC ?? 0, uygunsuzlukCount: uygunsuzlukC ?? 0, egitimCount: egitimC ?? 0, loading: false });
    } catch {
      setKaliciSilVeriOzet({ personelCount: 0, evrakCount: 0, ekipmanCount: 0, uygunsuzlukCount: 0, egitimCount: 0, loading: false });
    }
  };

  const handleKaliciSil = async (firmaId: string, firmaAdi: string) => {
    setIslemLoading(firmaId);
    try {
      // organizations tablosunda DELETE sadece super_admin RLS'ine açık.
      // OSGB admin için: firmayı "kalıcı silinmiş" olarak işaretle (is_active:false + özel prefix).
      // Hard DELETE, super admin panelinden veya scheduled job ile yapılabilir.
      const { error } = await supabase
        .from('organizations')
        .update({
          name: `[SİLİNDİ] ${firmaAdi.replace(/^\[SİLİNDİ\]\s*/i, '')}`,
          is_active: false,
          deleted_at: new Date().toISOString(),
        })
        .eq('id', firmaId);

      if (error) {
        // RLS engeli
        if (error.message?.includes('row-level security') || error.code === '42501') {
          showMesaj('error', 'Yetki hatası: Bu firmayı silme yetkiniz yok.');
        } else {
          showMesaj('error', `Silme başarısız: ${error.message}`);
        }
        return;
      }

      setFirmalar(prev => prev.filter(f => f.id !== firmaId));
      setKaliciSilOnayId(null);
      showMesaj('success', `"${firmaAdi}" kalıcı olarak işaretlendi ve devre dışı bırakıldı.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bilinmeyen hata';
      showMesaj('error', `Kalıcı silme başarısız: ${msg}`);
    } finally {
      setIslemLoading(null);
    }
  };

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getDaysSinceDeleted = (deletedAt: string | null | undefined) => {
    if (!deletedAt) return null;
    const d = new Date(deletedAt);
    if (isNaN(d.getTime())) return null;
    return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-4 page-enter">
      {/* Başlık */}
      <div className="rounded-2xl p-5 flex items-center gap-4"
        style={{ background: isDark ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.18)' }}>
        <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <i className="ri-delete-bin-2-line text-lg" style={{ color: '#EF4444' }} />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-bold" style={{ color: textPrimary }}>Çöp Kutusu</h2>
          <p className="text-xs mt-0.5" style={{ color: textMuted }}>
            Silinen firmalar burada listelenir. Geri alabilir veya kalıcı olarak silebilirsiniz.
          </p>
        </div>
        <span className="text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap"
          style={{ background: firmalar.length > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(100,116,139,0.1)', color: firmalar.length > 0 ? '#EF4444' : '#64748B', border: `1px solid ${firmalar.length > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(100,116,139,0.15)'}` }}>
          {firmalar.length} firma
        </span>
      </div>

      {/* Toast mesajı */}
      {mesaj && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-2"
          style={{
            background: mesaj.tip === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${mesaj.tip === 'success' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
          }}>
          <i className={`${mesaj.tip === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'} text-sm`}
            style={{ color: mesaj.tip === 'success' ? '#22C55E' : '#EF4444' }} />
          <span className="text-xs font-semibold" style={{ color: mesaj.tip === 'success' ? '#16A34A' : '#DC2626' }}>
            {mesaj.metin}
          </span>
        </div>
      )}

      {/* İçerik */}
      {loading ? (
        <div className="rounded-2xl p-12 flex flex-col items-center gap-4"
          style={{ background: cardBg, border: `1px solid ${border}` }}>
          <i className="ri-loader-4-line text-2xl animate-spin" style={{ color: '#EF4444' }} />
          <p className="text-sm" style={{ color: textMuted }}>Yükleniyor...</p>
        </div>
      ) : firmalar.length === 0 ? (
        <div className="rounded-2xl p-16 flex flex-col items-center gap-4 text-center"
          style={{ background: cardBg, border: `1px solid ${border}` }}>
          <div className="w-16 h-16 flex items-center justify-center rounded-2xl"
            style={{ background: 'rgba(100,116,139,0.08)', border: '1px solid rgba(100,116,139,0.15)' }}>
            <i className="ri-delete-bin-2-line text-2xl" style={{ color: '#64748B' }} />
          </div>
          <div>
            <p className="text-sm font-bold mb-1" style={{ color: textPrimary }}>Çöp kutusu boş</p>
            <p className="text-xs" style={{ color: textMuted }}>Silinen firmalar burada görünür.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {/* Tablo başlıkları */}
          <div className="hidden md:grid grid-cols-[2fr_1.5fr_1.5fr_180px] items-center px-4 py-2"
            style={{ borderBottom: `1px solid ${border}` }}>
            {['FİRMA', 'OLUŞTURULMA', 'SİLİNME', 'İŞLEM'].map(h => (
              <span key={h} className="text-[10px] font-bold tracking-wider uppercase" style={{ color: textMuted }}>{h}</span>
            ))}
          </div>

          {firmalar.map(f => {
            const daysSince = getDaysSinceDeleted(f.deleted_at);
            const isKaliciOnay = kaliciSilOnayId === f.id;
            const islem = islemLoading === f.id;

            return (
              <div key={f.id}
                className="rounded-xl px-4 py-3 grid grid-cols-1 md:grid-cols-[2fr_1.5fr_1.5fr_180px] items-center gap-3 md:gap-0"
                style={{ background: cardBg, border: `1px solid ${border}` }}>

                {/* Firma adı */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)' }}>
                    {f.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate" style={{ color: textPrimary }}>{f.name}</p>
                    <span className="text-[9px]" style={{ color: textMuted }}>
                      {daysSince === null ? 'Pasif firma' : daysSince === 0 ? 'Bugün silindi' : `${daysSince} gün önce silindi`}
                    </span>
                  </div>
                </div>

                {/* Oluşturulma */}
                <div className="hidden md:block">
                  <span className="text-[11px]" style={{ color: textMuted }}>{formatDate(f.created_at)}</span>
                </div>

                {/* Silinme tarihi */}
                <div className="hidden md:block">
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.18)' }}>
                    <i className="ri-time-line text-[9px]" />
                    {formatDate(f.deleted_at)}
                  </span>
                </div>

                {/* İşlemler */}
                <div className="flex items-center gap-2 justify-start md:justify-end flex-wrap"
                  onClick={e => e.stopPropagation()}>
                  {/* Geri Al */}
                  <button
                    onClick={() => void handleGeriAl(f.id, f.name)}
                    disabled={islem}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer text-xs font-semibold whitespace-nowrap transition-all"
                    style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#16A34A' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(34,197,94,0.15)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(34,197,94,0.08)'; }}>
                    {islem
                      ? <i className="ri-loader-4-line animate-spin text-xs" />
                      : <i className="ri-arrow-go-back-line text-xs" />}
                    Geri Al
                  </button>

                  {/* Kalıcı Sil */}
                  <button
                    onClick={() => void handleKaliciSilOnayla(f.id)}
                    disabled={islem}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer text-xs font-semibold whitespace-nowrap transition-all"
                    style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', color: '#EF4444' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.14)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.07)'; }}>
                    <i className="ri-delete-bin-line text-xs" />
                    Kalıcı Sil
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Kalıcı Silme Onay Modalı */}
      {kaliciSilOnayId && (() => {
        const firma = firmalar.find(f => f.id === kaliciSilOnayId);
        if (!firma) return null;
        const ozet = kaliciSilVeriOzet;
        const islem = islemLoading === kaliciSilOnayId;
        const toplamVeri = ozet ? (ozet.personelCount + ozet.evrakCount + ozet.ekipmanCount + ozet.uygunsuzlukCount + ozet.egitimCount) : 0;
        return (
          <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)', zIndex: 99999 }}>
            <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: isDark ? 'rgba(15,23,42,0.98)' : '#ffffff', border: '1px solid rgba(239,68,68,0.3)' }}>
              <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg,#EF4444,#DC2626)' }} />
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
                    <i className="ri-delete-bin-2-line text-lg" style={{ color: '#EF4444' }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: textPrimary }}>Kalıcı Silme Onayı</h3>
                    <p className="text-xs mt-0.5" style={{ color: textMuted }}>Bu işlem geri alınamaz!</p>
                  </div>
                </div>
                <p className="text-sm font-semibold mb-4" style={{ color: textPrimary }}>
                  <span className="font-black" style={{ color: '#EF4444' }}>"{firma.name}"</span> firmasını kalıcı olarak silmek üzeresiniz.
                </p>
                {ozet?.loading ? (
                  <div className="rounded-xl p-4 flex items-center gap-3 mb-4" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                    <i className="ri-loader-4-line animate-spin text-sm" style={{ color: '#EF4444' }} />
                    <span className="text-xs" style={{ color: textMuted }}>Firmaya ait veriler kontrol ediliyor...</span>
                  </div>
                ) : toplamVeri > 0 ? (
                  <div className="rounded-xl p-4 mb-4" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <p className="text-xs font-bold mb-3" style={{ color: '#EF4444' }}>⚠️ Bu firmaya ait aşağıdaki veriler orphan (sahipsiz) kalacak:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Personel', count: ozet?.personelCount ?? 0, icon: 'ri-group-line' },
                        { label: 'Evrak', count: ozet?.evrakCount ?? 0, icon: 'ri-file-list-line' },
                        { label: 'Ekipman', count: ozet?.ekipmanCount ?? 0, icon: 'ri-tools-line' },
                        { label: 'Uygunsuzluk', count: ozet?.uygunsuzlukCount ?? 0, icon: 'ri-alert-line' },
                        { label: 'Eğitim', count: ozet?.egitimCount ?? 0, icon: 'ri-graduation-cap-line' },
                      ].filter(x => x.count > 0).map(item => (
                        <div key={item.label} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)' }}>
                          <i className={`${item.icon} text-xs`} style={{ color: '#EF4444' }} />
                          <span className="text-xs font-bold" style={{ color: '#EF4444' }}>{item.count}</span>
                          <span className="text-xs" style={{ color: textMuted }}>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl p-3 mb-4 flex items-center gap-2" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <i className="ri-checkbox-circle-line text-sm" style={{ color: '#22C55E' }} />
                    <span className="text-xs" style={{ color: '#16A34A' }}>Bu firmaya ait kayıt bulunmuyor, güvenle silinebilir.</span>
                  </div>
                )}
                <div className="flex items-center gap-2 justify-end">
                  <button onClick={() => { setKaliciSilOnayId(null); setKaliciSilVeriOzet(null); }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap"
                    style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.06)', color: textMuted, border: `1px solid ${border}` }}>
                    Vazgeç
                  </button>
                  <button onClick={() => void handleKaliciSil(firma.id, firma.name)} disabled={islem || ozet?.loading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer text-white whitespace-nowrap"
                    style={{ background: 'linear-gradient(135deg,#EF4444,#DC2626)', opacity: (islem || ozet?.loading) ? 0.7 : 1 }}>
                    {islem ? <><i className="ri-loader-4-line animate-spin" />Siliniyor...</> : <><i className="ri-delete-bin-line" />Kalıcı Olarak Sil</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Bilgi notu */}
      {firmalar.length > 0 && (
        <div className="rounded-xl px-4 py-3 flex items-start gap-2.5"
          style={{ background: isDark ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.18)' }}>
          <i className="ri-information-line text-sm flex-shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
          <p className="text-[11px] leading-relaxed" style={{ color: textMuted }}>
            <span className="font-semibold" style={{ color: '#D97706' }}>Dikkat:</span> Kalıcı silme geri alınamaz. Firmaya ait tüm veriler (personel kayıtları hariç) silinecektir. &quot;Geri Al&quot; ile firmayı aktif listeye geri taşıyabilirsiniz.
          </p>
        </div>
      )}
    </div>
  );
}
