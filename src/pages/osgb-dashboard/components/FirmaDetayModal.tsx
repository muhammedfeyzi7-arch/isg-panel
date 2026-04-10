import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';

const EDGE_URL = 'https://niuvjthvhjbfyuuhoowq.supabase.co/functions/v1/admin-user-management';

interface Uzman {
  user_id: string;
  display_name: string;
  email: string;
  active_firm_id: string | null;
}

interface FirmaDetayModalProps {
  firmaId: string;
  firmaAdi: string;
  orgId: string;
  uzmanlar: Uzman[];
  onClose: () => void;
  onRefresh: () => void;
  addToast: (msg: string, type: 'success' | 'error') => void;
}

interface Stats {
  personelSayisi: number;
  uygunsuzluk: number;
  kapatilan: number;
  tutanak: number;
  egitim: number;
  isIzni: number;
}

interface PersonelRow {
  id: string;
  ad_soyad: string;
  gorevi: string | null;
  created_at: string;
}

interface UygunsuzlukRow {
  id: string;
  baslik: string;
  durum: string;
  onem_derecesi: string | null;
  created_at: string;
}

export default function FirmaDetayModal({
  firmaId, firmaAdi, orgId, uzmanlar, onClose, onRefresh, addToast,
}: FirmaDetayModalProps) {
  const [activeTab, setActiveTab] = useState<'ozet' | 'personel' | 'uygunsuzluk'>('ozet');
  const [stats, setStats] = useState<Stats | null>(null);
  const [personeller, setPersoneller] = useState<PersonelRow[]>([]);
  const [uygunsuzluklar, setUygunsuzluklar] = useState<UygunsuzlukRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [atananUzmanId, setAtananUzmanId] = useState<string>('');
  const [atanmaLoading, setAtanmaLoading] = useState(false);

  useEffect(() => {
    fetchAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmaId]);

  const fetchAll = async () => {
    setLoading(true);
    const [
      { count: personelCount },
      { count: uygunsuzlukCount },
      { count: kapatılanCount },
      { count: tutanakCount },
      { count: egitimCount },
      { count: isIzniCount },
      { data: personelData },
      { data: uygunsuzlukData },
    ] = await Promise.all([
      supabase.from('personeller').select('id', { count: 'exact', head: true }).eq('organization_id', firmaId),
      supabase.from('uygunsuzluklar').select('id', { count: 'exact', head: true }).eq('organization_id', firmaId).neq('durum', 'Kapatıldı'),
      supabase.from('uygunsuzluklar').select('id', { count: 'exact', head: true }).eq('organization_id', firmaId).eq('durum', 'Kapatıldı'),
      supabase.from('tutanaklar').select('id', { count: 'exact', head: true }).eq('organization_id', firmaId),
      supabase.from('egitimler').select('id', { count: 'exact', head: true }).eq('organization_id', firmaId),
      supabase.from('is_izinleri').select('id', { count: 'exact', head: true }).eq('organization_id', firmaId),
      supabase.from('personeller').select('id, ad_soyad, gorevi, created_at').eq('organization_id', firmaId).order('created_at', { ascending: false }).limit(10),
      supabase.from('uygunsuzluklar').select('id, baslik, durum, onem_derecesi, created_at').eq('organization_id', firmaId).order('created_at', { ascending: false }).limit(10),
    ]);

    setStats({
      personelSayisi: personelCount ?? 0,
      uygunsuzluk: uygunsuzlukCount ?? 0,
      kapatilan: kapatılanCount ?? 0,
      tutanak: tutanakCount ?? 0,
      egitim: egitimCount ?? 0,
      isIzni: isIzniCount ?? 0,
    });
    setPersoneller(personelData ?? []);
    setUygunsuzluklar(uygunsuzlukData ?? []);

    // Mevcut atanmış uzmanı bul
    const atanan = uzmanlar.find(u => u.active_firm_id === firmaId);
    setAtananUzmanId(atanan?.user_id ?? '');
    setLoading(false);
  };

  const handleUzmanAta = async () => {
    setAtanmaLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { addToast('Oturum bulunamadı.', 'error'); return; }

      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'assign_firm',
          organization_id: orgId,
          firma_id: firmaId,
          uzman_user_id: atananUzmanId || null,
        }),
      });

      const json = await res.json() as { error?: string; success?: boolean };
      if (json.error) throw new Error(json.error);

      addToast(atananUzmanId ? 'Uzman başarıyla atandı!' : 'Uzman ataması kaldırıldı.', 'success');
      onRefresh();
    } catch (err) {
      addToast(`Uzman ataması yapılamadı: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setAtanmaLoading(false);
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
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(16,185,129,0.1)' }}>
              <i className="ri-building-2-line text-lg" style={{ color: '#059669' }} />
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: '#0f172a' }}>{firmaAdi}</h3>
              <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>Firma Detayları</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
            style={{ background: 'rgba(15,23,42,0.06)', color: '#64748b' }}>
            <i className="ri-close-line" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3">
            <i className="ri-loader-4-line text-2xl animate-spin" style={{ color: '#10B981' }} />
            <span className="text-sm" style={{ color: '#94a3b8' }}>Yükleniyor...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            {/* Uzman Atama Bandı */}
            <div className="px-6 py-4" style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <i className="ri-user-star-line text-sm" style={{ color: '#8B5CF6' }} />
                  <span className="text-xs font-semibold" style={{ color: '#475569' }}>Sorumlu Uzman:</span>
                </div>
                <select
                  value={atananUzmanId}
                  onChange={e => setAtananUzmanId(e.target.value)}
                  className="text-xs px-3 py-2 rounded-xl cursor-pointer flex-1"
                  style={{ background: '#fff', border: '1.5px solid #e2e8f0', color: '#0f172a', outline: 'none', minWidth: '180px' }}
                >
                  <option value="">— Uzman Atanmadı —</option>
                  {uzmanlar.map(u => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.display_name} {u.active_firm_id && u.active_firm_id !== firmaId ? '(başka firmada)' : ''}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleUzmanAta}
                  disabled={atanmaLoading}
                  className="whitespace-nowrap flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #10B981, #059669)', opacity: atanmaLoading ? 0.7 : 1 }}
                >
                  {atanmaLoading
                    ? <><i className="ri-loader-4-line animate-spin" />Kaydediliyor...</>
                    : <><i className="ri-save-line" />Kaydet</>}
                </button>
              </div>
            </div>

            {/* Stats */}
            {stats && (
              <div className="grid grid-cols-3 gap-3 px-6 py-4">
                {[
                  { label: 'Personel', value: stats.personelSayisi, icon: 'ri-group-line', color: '#06B6D4', bg: 'rgba(6,182,212,0.08)' },
                  { label: 'Açık Uyg.', value: stats.uygunsuzluk, icon: 'ri-alert-line', color: '#EF4444', bg: 'rgba(239,68,68,0.08)' },
                  { label: 'Kapatılan', value: stats.kapatilan, icon: 'ri-checkbox-circle-line', color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
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
                { id: 'personel' as const, label: `Personel (${personeller.length})` },
                { id: 'uygunsuzluk' as const, label: `Uygunsuzluk (${uygunsuzluklar.length})` },
              ].map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className="px-4 py-3 text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors"
                  style={{
                    color: activeTab === t.id ? '#059669' : '#94a3b8',
                    borderBottom: activeTab === t.id ? '2px solid #10B981' : '2px solid transparent',
                  }}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="px-6 py-4">
              {/* Özet Tab */}
              {activeTab === 'ozet' && stats && (
                <div className="space-y-3">
                  <div className="rounded-xl p-4" style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                    <p className="text-xs font-semibold mb-3" style={{ color: '#475569' }}>Uygunsuzluk Kapanma Oranı</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: '#e2e8f0' }}>
                        {(() => {
                          const total = stats.uygunsuzluk + stats.kapatilan;
                          const oran = total > 0 ? Math.round((stats.kapatilan / total) * 100) : 100;
                          return (
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${oran}%`, background: oran >= 80 ? '#10B981' : oran >= 50 ? '#F59E0B' : '#EF4444' }} />
                          );
                        })()}
                      </div>
                      {(() => {
                        const total = stats.uygunsuzluk + stats.kapatilan;
                        const oran = total > 0 ? Math.round((stats.kapatilan / total) * 100) : 100;
                        return (
                          <span className="text-sm font-bold flex-shrink-0"
                            style={{ color: oran >= 80 ? '#059669' : oran >= 50 ? '#D97706' : '#DC2626' }}>
                            %{oran}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <p className="text-xs" style={{ color: '#94a3b8' }}>
                    Son 10 personel ve uygunsuzluk için &quot;Personel&quot; ve &quot;Uygunsuzluk&quot; sekmelerini inceleyin.
                  </p>
                </div>
              )}

              {/* Personel Tab */}
              {activeTab === 'personel' && (
                <div className="space-y-2">
                  {personeller.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                      <i className="ri-group-line text-2xl" style={{ color: '#cbd5e1' }} />
                      <p className="text-xs" style={{ color: '#94a3b8' }}>Henüz personel kaydı yok</p>
                    </div>
                  ) : personeller.map(p => (
                    <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)' }}>
                        {p.ad_soyad.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: '#0f172a' }}>{p.ad_soyad}</p>
                        <p className="text-[10px]" style={{ color: '#94a3b8' }}>{p.gorevi ?? 'Görev belirtilmedi'}</p>
                      </div>
                      <span className="text-[10px] flex-shrink-0" style={{ color: '#94a3b8' }}>
                        {new Date(p.created_at).toLocaleDateString('tr-TR')}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Uygunsuzluk Tab */}
              {activeTab === 'uygunsuzluk' && (
                <div className="space-y-2">
                  {uygunsuzluklar.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                      <i className="ri-checkbox-circle-line text-2xl" style={{ color: '#10B981' }} />
                      <p className="text-xs" style={{ color: '#94a3b8' }}>Açık uygunsuzluk yok</p>
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
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
