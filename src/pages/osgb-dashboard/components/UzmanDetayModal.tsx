import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';

function SonZiyaretBadge({ userId }: { userId: string }) {
  const [gunSayisi, setGunSayisi] = useState<number | null>(null);
  useEffect(() => {
    supabase
      .from('osgb_ziyaretler')
      .select('giris_saati')
      .eq('uzman_user_id', userId)
      .order('giris_saati', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.giris_saati) {
          setGunSayisi(Math.floor((Date.now() - new Date(data.giris_saati).getTime()) / 86400000));
        } else {
          setGunSayisi(999);
        }
      });
  }, [userId]);

  if (gunSayisi === null) return null;
  const color = gunSayisi === 999 ? '#94A3B8' : gunSayisi >= 5 ? '#EF4444' : gunSayisi >= 3 ? '#F59E0B' : '#22C55E';
  const bg = gunSayisi === 999 ? 'rgba(148,163,184,0.12)' : gunSayisi >= 5 ? 'rgba(239,68,68,0.12)' : gunSayisi >= 3 ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)';
  const label = gunSayisi === 999 ? 'Hiç ziyaret yok' : gunSayisi === 0 ? 'Bugün aktif' : `Son ziyaret: ${gunSayisi}g önce`;
  return (
    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
      style={{ background: bg, color, border: `1px solid ${color}40` }}>
      <i className="ri-map-pin-2-line mr-0.5" />{label}
    </span>
  );
}

interface AltFirma {
  id: string;
  name: string;
}

interface UzmanDetayModalProps {
  uzman: {
    user_id: string;
    display_name: string;
    email: string;
    is_active: boolean;
    active_firm_id: string | null;
    active_firm_ids: string[] | null;
    active_firm_name: string | null;
  };
  orgId: string;
  altFirmalar: AltFirma[];
  onClose: () => void;
  onRefresh: () => void;
  addToast: (msg: string, type: 'success' | 'error') => void;
}

interface UzmanStats {
  uygunsuzlukAcik: number;
  uygunsuzlukKapatilan: number;
  tutanak: number;
  egitim: number;
  personel: number;
  isIzni: number;
}

interface UygunsuzlukRow {
  id: string;
  baslik: string;
  durum: string;
  onem_derecesi: string | null;
  created_at: string;
}

export default function UzmanDetayModal({
  uzman, orgId, altFirmalar, onClose, onRefresh, addToast,
}: UzmanDetayModalProps) {
  const [activeTab, setActiveTab] = useState<'ozet' | 'uygunsuzluk' | 'ayarlar'>('ozet');
  const [isActive, setIsActive] = useState(uzman.is_active);
  const [secilenFirmaIds, setSecilenFirmaIds] = useState<string[]>(
    uzman.active_firm_ids?.length
      ? uzman.active_firm_ids
      : uzman.active_firm_id ? [uzman.active_firm_id] : []
  );
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<UzmanStats | null>(null);
  const [uygunsuzluklar, setUygunsuzluklar] = useState<UygunsuzlukRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    setDataLoading(true);
    const firmId = uzman.active_firm_id;
    if (firmId) {
      const [
        { count: acikCount },
        { count: kapatilanCount },
        { count: tutanakCount },
        { count: egitimCount },
        { count: personelCount },
        { count: isIzniCount },
        { data: uyData },
      ] = await Promise.all([
        supabase.from('uygunsuzluklar').select('id', { count: 'exact', head: true }).eq('organization_id', firmId).neq('durum', 'Kapatıldı'),
        supabase.from('uygunsuzluklar').select('id', { count: 'exact', head: true }).eq('organization_id', firmId).eq('durum', 'Kapatıldı'),
        supabase.from('tutanaklar').select('id', { count: 'exact', head: true }).eq('organization_id', firmId),
        supabase.from('egitimler').select('id', { count: 'exact', head: true }).eq('organization_id', firmId),
        supabase.from('personeller').select('id', { count: 'exact', head: true }).eq('organization_id', firmId),
        supabase.from('is_izinleri').select('id', { count: 'exact', head: true }).eq('organization_id', firmId),
        supabase.from('uygunsuzluklar').select('id, baslik, durum, onem_derecesi, created_at').eq('organization_id', firmId).order('created_at', { ascending: false }).limit(10),
      ]);
      setStats({
        uygunsuzlukAcik: acikCount ?? 0,
        uygunsuzlukKapatilan: kapatilanCount ?? 0,
        tutanak: tutanakCount ?? 0,
        egitim: egitimCount ?? 0,
        personel: personelCount ?? 0,
        isIzni: isIzniCount ?? 0,
      });
      setUygunsuzluklar(uyData ?? []);
    } else {
      setStats({ uygunsuzlukAcik: 0, uygunsuzlukKapatilan: 0, tutanak: 0, egitim: 0, personel: 0, isIzni: 0 });
      setUygunsuzluklar([]);
    }
    setDataLoading(false);
  };

  const toggleFirma = (firmaId: string) => {
    setSecilenFirmaIds(prev =>
      prev.includes(firmaId) ? prev.filter(id => id !== firmaId) : [...prev, firmaId]
    );
  };

  const handleKaydet = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Oturum bulunamadı.');

      const res = await fetch('https://niuvjthvhjbfyuuhoowq.supabase.co/functions/v1/admin-user-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'update',
          organization_id: orgId,
          target_user_id: uzman.user_id,
          is_active: isActive,
          active_firm_id: secilenFirmaIds[0] ?? null,
          active_firm_ids: secilenFirmaIds.length > 0 ? secilenFirmaIds : null,
        }),
      });
      const json = await res.json() as { error?: string; success?: boolean };
      if (json.error) throw new Error(json.error);

      addToast('Uzman bilgileri güncellendi!', 'success');
      onRefresh();
      onClose();
    } catch (err) {
      addToast(`Güncelleme yapılamadı: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const uyOnem = (onem: string | null) => {
    if (onem === 'Yüksek' || onem === 'Kritik') return { bg: 'rgba(239,68,68,0.1)', color: '#DC2626' };
    if (onem === 'Orta') return { bg: 'rgba(245,158,11,0.1)', color: '#D97706' };
    return { bg: 'rgba(16,185,129,0.1)', color: '#059669' };
  };

  const durumStyle = (durum: string) => {
    if (durum === 'Kapatıldı') return { bg: 'rgba(16,185,129,0.1)', color: '#059669' };
    if (durum === 'Devam Ediyor') return { bg: 'rgba(245,158,11,0.1)', color: '#D97706' };
    return { bg: 'rgba(99,102,241,0.1)', color: '#6366F1' };
  };

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', zIndex: 99999 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl flex flex-col"
        style={{ background: '#fff', border: '1px solid #e2e8f0', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid #f1f5f9' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              style={{ background: isActive ? 'linear-gradient(135deg, #10B981, #059669)' : 'linear-gradient(135deg, #94a3b8, #64748b)' }}
            >
              {(uzman.display_name ?? uzman.email ?? '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: '#0f172a' }}>{uzman.display_name}</h3>
              <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>{uzman.email}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
            style={{ background: 'rgba(15,23,42,0.06)', color: '#64748b' }}>
            <i className="ri-close-line" />
          </button>
        </div>

        {dataLoading ? (
          <div className="flex items-center justify-center py-20 gap-3">
            <i className="ri-loader-4-line text-2xl animate-spin" style={{ color: '#8B5CF6' }} />
            <span className="text-sm" style={{ color: '#94a3b8' }}>Yükleniyor...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            {/* Firma Bilgi Bandı */}
            <div className="px-6 py-4" style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                  <i className="ri-building-2-line text-sm" style={{ color: '#10B981' }} />
                  <span className="text-xs font-semibold" style={{ color: '#475569' }}>
                    Atandığı {secilenFirmaIds.length > 1 ? 'Firmalar' : 'Firma'}:
                  </span>
                </div>
                <div className="flex-1 flex flex-wrap gap-1.5">
                  {secilenFirmaIds.length > 0
                    ? secilenFirmaIds.map((id, idx) => {
                        const f = altFirmalar.find(af => af.id === id);
                        return f ? (
                          <span key={id} className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{
                              background: idx === 0 ? 'rgba(16,185,129,0.12)' : 'rgba(99,102,241,0.1)',
                              color: idx === 0 ? '#059669' : '#6366F1',
                              border: `1px solid ${idx === 0 ? 'rgba(16,185,129,0.25)' : 'rgba(99,102,241,0.2)'}`,
                            }}>
                            {idx === 0 ? '★ ' : ''}{f.name}
                          </span>
                        ) : null;
                      })
                    : <span className="text-xs" style={{ color: '#94a3b8' }}>Henüz firma atanmadı</span>
                  }
                  {secilenFirmaIds.length > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(99,102,241,0.08)', color: '#6366F1', border: '1px solid rgba(99,102,241,0.15)' }}>
                      {secilenFirmaIds.length} firma sorumluluğu
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                  style={{
                    background: isActive ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.1)',
                    color: isActive ? '#10B981' : '#64748b',
                    border: `1px solid ${isActive ? 'rgba(16,185,129,0.2)' : 'rgba(100,116,139,0.2)'}`,
                  }}>
                  {isActive ? '● Aktif' : '○ Pasif'}
                </span>
                <SonZiyaretBadge userId={uzman.user_id} />
              </div>
            </div>

            {/* Stats */}
            {stats && (
              <div className="grid grid-cols-3 gap-3 px-6 py-4">
                {[
                  { label: 'Personel', value: stats.personel, icon: 'ri-group-line', color: '#06B6D4', bg: 'rgba(6,182,212,0.08)' },
                  { label: 'Açık Uyg.', value: stats.uygunsuzlukAcik, icon: 'ri-alert-line', color: '#EF4444', bg: 'rgba(239,68,68,0.08)' },
                  { label: 'Kapatılan', value: stats.uygunsuzlukKapatilan, icon: 'ri-checkbox-circle-line', color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
                  { label: 'Tutanak', value: stats.tutanak, icon: 'ri-file-list-3-line', color: '#6366F1', bg: 'rgba(99,102,241,0.08)' },
                  { label: 'Eğitim', value: stats.egitim, icon: 'ri-graduation-cap-line', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
                  { label: 'İş İzni', value: stats.isIzni, icon: 'ri-file-shield-2-line', color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)' },
                ].map(s => (
                  <div key={s.label} className="rounded-xl p-3 flex items-center gap-3"
                    style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: s.bg }}>
                      <i className={`${s.icon} text-sm`} style={{ color: s.color }} />
                    </div>
                    <div>
                      <p className="text-base font-extrabold leading-none" style={{ color: '#0f172a' }}>{s.value}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: '#94a3b8' }}>{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 px-6 pb-0" style={{ borderBottom: '1px solid #f1f5f9' }}>
              {[
                { id: 'ozet' as const, label: 'Özet' },
                { id: 'uygunsuzluk' as const, label: `Uygunsuzluklar (${uygunsuzluklar.length})` },
                { id: 'ayarlar' as const, label: 'Düzenle' },
              ].map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className="px-4 py-3 text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors"
                  style={{
                    color: activeTab === t.id ? '#7C3AED' : '#94a3b8',
                    borderBottom: activeTab === t.id ? '2px solid #8B5CF6' : '2px solid transparent',
                  }}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="px-6 py-4">
              {/* Özet Tab */}
              {activeTab === 'ozet' && stats && (
                <div className="space-y-3">
                  {/* Kapanma oranı */}
                  <div className="rounded-xl p-4" style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                    <p className="text-xs font-semibold mb-3" style={{ color: '#475569' }}>Uygunsuzluk Kapanma Oranı</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: '#e2e8f0' }}>
                        {(() => {
                          const total = stats.uygunsuzlukAcik + stats.uygunsuzlukKapatilan;
                          const oran = total > 0 ? Math.round((stats.uygunsuzlukKapatilan / total) * 100) : 100;
                          return (
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${oran}%`, background: oran >= 80 ? '#10B981' : oran >= 50 ? '#F59E0B' : '#EF4444' }} />
                          );
                        })()}
                      </div>
                      {(() => {
                        const total = stats.uygunsuzlukAcik + stats.uygunsuzlukKapatilan;
                        const oran = total > 0 ? Math.round((stats.uygunsuzlukKapatilan / total) * 100) : 100;
                        return (
                          <span className="text-sm font-bold flex-shrink-0"
                            style={{ color: oran >= 80 ? '#059669' : oran >= 50 ? '#D97706' : '#DC2626' }}>
                            %{oran}
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Uzman bilgi kartı */}
                  <div className="rounded-xl p-4 space-y-3" style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                    <p className="text-xs font-semibold" style={{ color: '#475569' }}>Uzman Bilgileri</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 flex items-center justify-center">
                          <i className="ri-mail-line text-xs" style={{ color: '#94a3b8' }} />
                        </div>
                        <span className="text-xs" style={{ color: '#64748b' }}>{uzman.email}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <i className="ri-building-2-line text-xs" style={{ color: '#94a3b8' }} />
                        </div>
                        <div>
                          {secilenFirmaIds.length > 0
                            ? secilenFirmaIds.map((id, idx) => {
                                const f = altFirmalar.find(af => af.id === id);
                                return f ? (
                                  <span key={id} className="text-xs block" style={{ color: '#64748b' }}>
                                    {idx === 0 ? <strong>{f.name}</strong> : f.name}
                                    {idx === 0 && secilenFirmaIds.length > 1 && <span style={{ color: '#94a3b8' }}> (birincil)</span>}
                                  </span>
                                ) : null;
                              })
                            : <span className="text-xs" style={{ color: '#94a3b8' }}>Firma atanmadı</span>
                          }
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 flex items-center justify-center">
                          <i className="ri-user-star-line text-xs" style={{ color: '#94a3b8' }} />
                        </div>
                        <span className="text-xs" style={{ color: '#64748b' }}>Gezici Uzman</span>
                      </div>
                    </div>
                  </div>

                  {!uzman.active_firm_id && (
                    <div className="flex items-start gap-2 p-3 rounded-xl"
                      style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                      <i className="ri-alert-line text-sm flex-shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
                      <p className="text-xs leading-relaxed" style={{ color: '#92400e' }}>
                        Bu uzmana henüz firma atanmadı. İstatistikler firma atandıktan sonra görüntülenecek.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Uygunsuzluk Tab */}
              {activeTab === 'uygunsuzluk' && (
                <div className="space-y-2">
                  {uygunsuzluklar.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                      <i className="ri-checkbox-circle-line text-2xl" style={{ color: '#10B981' }} />
                      <p className="text-xs" style={{ color: '#94a3b8' }}>
                        {uzman.active_firm_id ? 'Açık uygunsuzluk yok' : 'Firma atanmadı — veri yok'}
                      </p>
                    </div>
                  ) : uygunsuzluklar.map(u => (
                    <div key={u.id} className="flex items-start gap-3 p-3 rounded-xl"
                      style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: uyOnem(u.onem_derecesi).bg }}>
                        <i className="ri-alert-line text-xs" style={{ color: uyOnem(u.onem_derecesi).color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold" style={{ color: '#0f172a' }}>{u.baslik}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: '#94a3b8' }}>
                          {new Date(u.created_at).toLocaleDateString('tr-TR')}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={durumStyle(u.durum)}>
                          {u.durum}
                        </span>
                        {u.onem_derecesi && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={uyOnem(u.onem_derecesi)}>
                            {u.onem_derecesi}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Düzenle (Ayarlar) Tab */}
              {activeTab === 'ayarlar' && (
                <div className="space-y-4">
                  {/* Aktif/Pasif Toggle */}
                  <div className="flex items-center justify-between p-4 rounded-xl"
                    style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: '#0f172a' }}>Hesap Durumu</p>
                      <p className="text-[10px] mt-0.5" style={{ color: '#94a3b8' }}>
                        {isActive ? 'Uzman sisteme giriş yapabilir' : 'Uzmanın erişimi kısıtlı'}
                      </p>
                    </div>
                    <button
                      onClick={() => setIsActive(p => !p)}
                      className="relative cursor-pointer flex-shrink-0"
                      style={{ width: '44px', height: '24px' }}
                    >
                      <div className="w-full h-full rounded-full transition-colors"
                        style={{ background: isActive ? '#10B981' : '#e2e8f0' }} />
                      <div className="absolute top-1 transition-all rounded-full"
                        style={{ width: '16px', height: '16px', background: '#fff', left: isActive ? '24px' : '4px' }} />
                    </button>
                  </div>

                  {/* Firma Atama — Çoklu Seçim */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-semibold" style={{ color: '#475569' }}>
                        Atanacak Firma(lar)
                        <span className="ml-1.5 text-[10px] font-normal" style={{ color: '#94a3b8' }}>
                          ({secilenFirmaIds.length} seçili)
                        </span>
                      </label>
                      {secilenFirmaIds.length > 0 && (
                        <button onClick={() => setSecilenFirmaIds([])} className="text-[10px] cursor-pointer" style={{ color: '#EF4444' }}>
                          Tümünü kaldır
                        </button>
                      )}
                    </div>
                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                      {altFirmalar.map(f => {
                        const secili = secilenFirmaIds.includes(f.id);
                        return (
                          <button key={f.id} type="button" onClick={() => toggleFirma(f.id)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all text-left"
                            style={{
                              background: secili ? 'rgba(139,92,246,0.08)' : '#f8fafc',
                              border: secili ? '1.5px solid rgba(139,92,246,0.3)' : '1.5px solid #e2e8f0',
                            }}>
                            <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                              style={secili
                                ? { background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' }
                                : { background: '#fff', border: '1.5px solid #cbd5e1' }}>
                              {secili && <i className="ri-check-line text-white text-[10px]" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold truncate" style={{ color: secili ? '#6D28D9' : '#1e293b' }}>{f.name}</p>
                            </div>
                            {secili && secilenFirmaIds[0] === f.id && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                                style={{ background: 'rgba(139,92,246,0.12)', color: '#7C3AED' }}>Birincil</span>
                            )}
                          </button>
                        );
                      })}
                      {altFirmalar.length === 0 && (
                        <p className="text-xs text-center py-4" style={{ color: '#94a3b8' }}>Henüz firma eklenmedi</p>
                      )}
                    </div>
                    {secilenFirmaIds.length > 1 && (
                      <p className="text-[10px] mt-1.5" style={{ color: '#94a3b8' }}>
                        İlk seçilen firma birincil olarak atanır ve uzmanın varsayılan organizasyonunu belirler.
                      </p>
                    )}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={onClose}
                      className="flex-1 whitespace-nowrap py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
                      style={{ background: 'rgba(15,23,42,0.05)', border: '1px solid rgba(15,23,42,0.1)', color: '#64748b' }}>
                      İptal
                    </button>
                    <button onClick={handleKaydet} disabled={loading}
                      className="flex-1 whitespace-nowrap flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer"
                      style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)', opacity: loading ? 0.7 : 1 }}>
                      {loading
                        ? <><i className="ri-loader-4-line animate-spin" />Kaydediliyor...</>
                        : <><i className="ri-save-line" />Kaydet</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
