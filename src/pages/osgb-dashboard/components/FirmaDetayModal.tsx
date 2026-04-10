import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';

const EDGE_URL = 'https://niuvjthvhjbfyuuhoowq.supabase.co/functions/v1/admin-user-management';

interface Uzman { user_id: string; display_name: string; email: string; active_firm_id: string | null; }
interface FirmaDetayModalProps {
  firmaId: string; firmaAdi: string; orgId: string; uzmanlar: Uzman[];
  onClose: () => void; onRefresh: () => void;
  addToast: (msg: string, type: 'success' | 'error') => void;
  isDark?: boolean;
}
interface Stats { personelSayisi: number; uygunsuzluk: number; kapatilan: number; tutanak: number; egitim: number; isIzni: number; }
interface PersonelRow { id: string; ad_soyad: string; gorevi: string | null; created_at: string; }
interface UygunsuzlukRow { id: string; baslik: string; durum: string; onem_derecesi: string | null; created_at: string; }
interface AtamaGecmisi { id: string; uzman_ad: string | null; uzman_email: string | null; giris_saati: string; cikis_saati: string | null; durum: string; }

export default function FirmaDetayModal({ firmaId, firmaAdi, orgId, uzmanlar, onClose, onRefresh, addToast, isDark = false }: FirmaDetayModalProps) {
  const [activeTab, setActiveTab] = useState<'ozet' | 'personel' | 'uygunsuzluk' | 'ziyaretler'>('ozet');
  const [stats, setStats] = useState<Stats | null>(null);
  const [personeller, setPersoneller] = useState<PersonelRow[]>([]);
  const [uygunsuzluklar, setUygunsuzluklar] = useState<UygunsuzlukRow[]>([]);
  const [atamaGecmisi, setAtamaGecmisi] = useState<AtamaGecmisi[]>([]);
  const [loading, setLoading] = useState(true);
  const [atananUzmanId, setAtananUzmanId] = useState<string>('');
  const [atanmaLoading, setAtanmaLoading] = useState(false);
  const [firmaDurum, setFirmaDurum] = useState<'aktif' | 'pasif'>('aktif');
  const [durumLoading, setDurumLoading] = useState(false);
  const [silOnay, setSilOnay] = useState(false);
  const [silLoading, setSilLoading] = useState(false);

  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc';
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9';
  const textPrimary = isDark ? '#e2e8f0' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const textFaint = isDark ? '#475569' : '#94a3b8';
  const modalBg = isDark ? '#1e293b' : '#ffffff';
  const modalBorder = isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0';
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : '#ffffff';
  const inputBorder = isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0';

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [
      { count: personelCount }, { count: uygunsuzlukCount }, { count: kapatilanCount },
      { count: tutanakCount }, { count: egitimCount }, { count: isIzniCount },
      { data: personelData }, { data: uygunsuzlukData }, { data: orgData }, { data: ziyaretData },
    ] = await Promise.all([
      supabase.from('personeller').select('id', { count: 'exact', head: true }).eq('organization_id', firmaId),
      supabase.from('uygunsuzluklar').select('id', { count: 'exact', head: true }).eq('organization_id', firmaId).neq('durum', 'Kapatıldı'),
      supabase.from('uygunsuzluklar').select('id', { count: 'exact', head: true }).eq('organization_id', firmaId).eq('durum', 'Kapatıldı'),
      supabase.from('tutanaklar').select('id', { count: 'exact', head: true }).eq('organization_id', firmaId),
      supabase.from('egitimler').select('id', { count: 'exact', head: true }).eq('organization_id', firmaId),
      supabase.from('is_izinleri').select('id', { count: 'exact', head: true }).eq('organization_id', firmaId),
      supabase.from('personeller').select('id, ad_soyad, gorevi, created_at').eq('organization_id', firmaId).order('created_at', { ascending: false }).limit(10),
      supabase.from('uygunsuzluklar').select('id, baslik, durum, onem_derecesi, created_at').eq('organization_id', firmaId).order('created_at', { ascending: false }).limit(10),
      supabase.from('organizations').select('is_active').eq('id', firmaId).maybeSingle(),
      supabase.from('osgb_ziyaretler').select('id, uzman_ad, uzman_email, giris_saati, cikis_saati, durum').eq('firma_org_id', firmaId).order('giris_saati', { ascending: false }).limit(10),
    ]);
    setStats({ personelSayisi: personelCount ?? 0, uygunsuzluk: uygunsuzlukCount ?? 0, kapatilan: kapatilanCount ?? 0, tutanak: tutanakCount ?? 0, egitim: egitimCount ?? 0, isIzni: isIzniCount ?? 0 });
    setPersoneller(personelData ?? []);
    setUygunsuzluklar(uygunsuzlukData ?? []);
    setAtamaGecmisi((ziyaretData ?? []) as AtamaGecmisi[]);
    setFirmaDurum((orgData as { is_active?: boolean } | null)?.is_active !== false ? 'aktif' : 'pasif');
    const atanan = uzmanlar.find(u => u.active_firm_id === firmaId);
    setAtananUzmanId(atanan?.user_id ?? '');
    setLoading(false);
  }, [firmaId, uzmanlar]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleUzmanAta = async () => {
    setAtanmaLoading(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) { addToast('Oturum bulunamadı.', 'error'); return; }
      const res = await fetch(EDGE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'assign_firm', organization_id: orgId, firma_id: firmaId, uzman_user_id: atananUzmanId || null }) });
      const json = await res.json() as { error?: string };
      if (json.error) throw new Error(json.error);
      addToast(atananUzmanId ? 'Uzman başarıyla atandı!' : 'Uzman ataması kaldırıldı.', 'success');
      onRefresh();
    } catch (err) {
      addToast(`Uzman ataması yapılamadı: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally { setAtanmaLoading(false); }
  };

  const handleDurumDegistir = async () => {
    setDurumLoading(true);
    try {
      const yeniDurum = firmaDurum === 'aktif' ? false : true;
      const { error } = await supabase.from('organizations').update({ is_active: yeniDurum }).eq('id', firmaId);
      if (error) throw error;
      setFirmaDurum(yeniDurum ? 'aktif' : 'pasif');
      addToast(`Firma ${yeniDurum ? 'aktif' : 'pasif'} yapıldı.`, 'success');
      onRefresh();
    } catch (err) {
      addToast(`İşlem başarısız: ${String(err)}`, 'error');
    } finally { setDurumLoading(false); }
  };

  const handleSil = async () => {
    setSilLoading(true);
    try {
      const { error } = await supabase.from('organizations').update({ is_active: false, name: `[SİLİNDİ] ${firmaAdi}` }).eq('id', firmaId);
      if (error) throw error;
      addToast('Firma silindi.', 'success');
      onClose();
      onRefresh();
    } catch (err) {
      addToast(`Silme başarısız: ${String(err)}`, 'error');
    } finally { setSilLoading(false); }
  };

  const uyOnem = (o: string | null) => o === 'Yüksek' || o === 'Kritik' ? { bg: 'rgba(239,68,68,0.1)', color: '#DC2626' } : o === 'Orta' ? { bg: 'rgba(245,158,11,0.1)', color: '#D97706' } : { bg: 'rgba(16,185,129,0.1)', color: '#059669' };
  const durumStyle = (d: string) => d === 'Kapatıldı' ? { bg: 'rgba(16,185,129,0.1)', color: '#059669' } : d === 'Devam Ediyor' ? { bg: 'rgba(245,158,11,0.1)', color: '#D97706' } : { bg: 'rgba(99,102,241,0.1)', color: '#6366F1' };

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', zIndex: 99999 }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-2xl rounded-2xl flex flex-col" style={{ background: modalBg, border: `1px solid ${modalBorder}`, maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${cardBorder}` }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <i className="ri-building-2-line text-base" style={{ color: '#059669' }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold" style={{ color: textPrimary }}>{firmaAdi}</h3>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: firmaDurum === 'aktif' ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.12)', color: firmaDurum === 'aktif' ? '#10B981' : '#64748B', border: `1px solid ${firmaDurum === 'aktif' ? 'rgba(16,185,129,0.25)' : 'rgba(100,116,139,0.25)'}` }}>
                  {firmaDurum === 'aktif' ? '● Aktif' : '○ Pasif'}
                </span>
              </div>
              <p className="text-[10.5px] mt-0.5" style={{ color: textFaint }}>Firma Detayları · ISG Yönetimi</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Durum Değiştir */}
            <button onClick={handleDurumDegistir} disabled={durumLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
              style={{ background: firmaDurum === 'aktif' ? 'rgba(100,116,139,0.1)' : 'rgba(16,185,129,0.1)', border: `1px solid ${firmaDurum === 'aktif' ? 'rgba(100,116,139,0.25)' : 'rgba(16,185,129,0.25)'}`, color: firmaDurum === 'aktif' ? '#64748B' : '#10B981' }}>
              {durumLoading ? <i className="ri-loader-4-line animate-spin text-xs" /> : <i className={`${firmaDurum === 'aktif' ? 'ri-pause-circle-line' : 'ri-play-circle-line'} text-xs`} />}
              {firmaDurum === 'aktif' ? 'Pasif Yap' : 'Aktif Et'}
            </button>
            {/* Sil */}
            {!silOnay ? (
              <button onClick={() => setSilOnay(true)}
                className="w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer transition-all"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}
                title="Firmayı Sil">
                <i className="ri-delete-bin-line text-xs" />
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold" style={{ color: '#EF4444' }}>Emin misiniz?</span>
                <button onClick={handleSil} disabled={silLoading}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer whitespace-nowrap text-white"
                  style={{ background: '#EF4444' }}>
                  {silLoading ? <i className="ri-loader-4-line animate-spin" /> : 'Sil'}
                </button>
                <button onClick={() => setSilOnay(false)} className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold cursor-pointer whitespace-nowrap" style={{ background: 'var(--bg-item, rgba(15,23,42,0.06))', color: textMuted }}>Vazgeç</button>
              </div>
            )}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)', color: textMuted }}>
              <i className="ri-close-line text-sm" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3">
            <i className="ri-loader-4-line text-2xl animate-spin" style={{ color: '#10B981' }} />
            <span className="text-sm" style={{ color: textFaint }}>Yükleniyor...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            {/* Uzman Atama */}
            <div className="px-6 py-4" style={{ background: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc', borderBottom: `1px solid ${cardBorder}` }}>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-6 h-6 flex items-center justify-center rounded-lg" style={{ background: 'rgba(139,92,246,0.1)' }}><i className="ri-user-star-line text-[10px]" style={{ color: '#8B5CF6' }} /></div>
                  <span className="text-xs font-semibold" style={{ color: textMuted }}>Sorumlu Uzman:</span>
                </div>
                <select value={atananUzmanId} onChange={e => setAtananUzmanId(e.target.value)}
                  className="text-xs px-3 py-2 rounded-xl cursor-pointer flex-1 outline-none"
                  style={{ background: inputBg, border: `1.5px solid ${inputBorder}`, color: textPrimary, minWidth: '160px' }}>
                  <option value="">— Uzman Atanmadı —</option>
                  {uzmanlar.map(u => <option key={u.user_id} value={u.user_id}>{u.display_name}{u.active_firm_id && u.active_firm_id !== firmaId ? ' (başka firmada)' : ''}</option>)}
                </select>
                <button onClick={handleUzmanAta} disabled={atanmaLoading}
                  className="whitespace-nowrap flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #10B981, #059669)', opacity: atanmaLoading ? 0.7 : 1 }}>
                  {atanmaLoading ? <><i className="ri-loader-4-line animate-spin" />Kaydediliyor...</> : <><i className="ri-save-line" />Kaydet</>}
                </button>
              </div>
            </div>

            {/* Stats Grid */}
            {stats && (
              <div className="grid grid-cols-3 gap-3 px-6 py-4">
                {[
                  { label: 'Personel', value: stats.personelSayisi, icon: 'ri-group-line', color: '#06B6D4', bg: 'rgba(6,182,212,0.1)' },
                  { label: 'Açık Uyg.', value: stats.uygunsuzluk, icon: 'ri-alert-line', color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
                  { label: 'Kapatılan', value: stats.kapatilan, icon: 'ri-checkbox-circle-line', color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
                  { label: 'Tutanak', value: stats.tutanak, icon: 'ri-file-list-3-line', color: '#6366F1', bg: 'rgba(99,102,241,0.1)' },
                  { label: 'Eğitim', value: stats.egitim, icon: 'ri-graduation-cap-line', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
                  { label: 'İş İzni', value: stats.isIzni, icon: 'ri-file-shield-2-line', color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)' },
                ].map(s => (
                  <div key={s.label} className="rounded-xl p-3 flex items-center gap-3" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: s.bg }}>
                      <i className={`${s.icon} text-sm`} style={{ color: s.color }} />
                    </div>
                    <div>
                      <p className="text-base font-extrabold leading-none" style={{ color: textPrimary }}>{s.value}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: textFaint }}>{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-0.5 px-6" style={{ borderBottom: `1px solid ${cardBorder}` }}>
              {[
                { id: 'ozet' as const, label: 'Özet', icon: 'ri-pie-chart-line' },
                { id: 'personel' as const, label: `Personel (${personeller.length})`, icon: 'ri-group-line' },
                { id: 'uygunsuzluk' as const, label: `Uyg. (${uygunsuzluklar.length})`, icon: 'ri-alert-line' },
                { id: 'ziyaretler' as const, label: `Ziyaret (${atamaGecmisi.length})`, icon: 'ri-map-pin-2-line' },
              ].map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className="flex items-center gap-1.5 px-3 py-3 text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors"
                  style={{ color: activeTab === t.id ? '#059669' : textFaint, borderBottom: activeTab === t.id ? '2px solid #10B981' : '2px solid transparent' }}>
                  <i className={`${t.icon} text-xs`} />
                  {t.label}
                </button>
              ))}
            </div>

            <div className="px-6 py-4">
              {/* Özet */}
              {activeTab === 'ozet' && stats && (
                <div className="space-y-3">
                  <div className="rounded-xl p-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                    <p className="text-xs font-semibold mb-3" style={{ color: textMuted }}>Uygunsuzluk Kapanma Oranı</p>
                    {(() => {
                      const total = stats.uygunsuzluk + stats.kapatilan;
                      const oran = total > 0 ? Math.round((stats.kapatilan / total) * 100) : 100;
                      return (
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }}>
                            <div className="h-full rounded-full" style={{ width: `${oran}%`, background: oran >= 80 ? '#10B981' : oran >= 50 ? '#F59E0B' : '#EF4444' }} />
                          </div>
                          <span className="text-sm font-bold flex-shrink-0" style={{ color: oran >= 80 ? '#059669' : oran >= 50 ? '#D97706' : '#DC2626' }}>%{oran}</span>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="rounded-xl p-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: textMuted }}>Atanmış Uzman</p>
                    {(() => {
                      const uzman = uzmanlar.find(u => u.active_firm_id === firmaId);
                      return uzman ? (
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>{uzman.display_name.charAt(0).toUpperCase()}</div>
                          <div>
                            <p className="text-xs font-bold" style={{ color: textPrimary }}>{uzman.display_name}</p>
                            <p className="text-[10px]" style={{ color: textFaint }}>{uzman.email}</p>
                          </div>
                        </div>
                      ) : <p className="text-xs" style={{ color: textFaint }}>Bu firmaya henüz uzman atanmadı.</p>;
                    })()}
                  </div>
                </div>
              )}

              {/* Personel */}
              {activeTab === 'personel' && (
                <div className="space-y-2">
                  {personeller.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                      <i className="ri-group-line text-2xl" style={{ color: textFaint }} />
                      <p className="text-xs" style={{ color: textFaint }}>Henüz personel kaydı yok</p>
                    </div>
                  ) : personeller.map(p => (
                    <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)' }}>{p.ad_soyad.charAt(0).toUpperCase()}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: textPrimary }}>{p.ad_soyad}</p>
                        <p className="text-[10px]" style={{ color: textFaint }}>{p.gorevi ?? 'Görev belirtilmedi'}</p>
                      </div>
                      <span className="text-[10px] flex-shrink-0" style={{ color: textFaint }}>{new Date(p.created_at).toLocaleDateString('tr-TR')}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Uygunsuzluk */}
              {activeTab === 'uygunsuzluk' && (
                <div className="space-y-2">
                  {uygunsuzluklar.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                      <i className="ri-checkbox-circle-line text-2xl" style={{ color: '#10B981' }} />
                      <p className="text-xs" style={{ color: textFaint }}>Açık uygunsuzluk yok</p>
                    </div>
                  ) : uygunsuzluklar.map(u => (
                    <div key={u.id} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: uyOnem(u.onem_derecesi).bg }}><i className="ri-alert-line text-xs" style={{ color: uyOnem(u.onem_derecesi).color }} /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold" style={{ color: textPrimary }}>{u.baslik}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: textFaint }}>{new Date(u.created_at).toLocaleDateString('tr-TR')}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={durumStyle(u.durum)}>{u.durum}</span>
                        {u.onem_derecesi && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={uyOnem(u.onem_derecesi)}>{u.onem_derecesi}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Ziyaret Geçmişi */}
              {activeTab === 'ziyaretler' && (
                <div className="space-y-2">
                  {atamaGecmisi.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                      <i className="ri-map-pin-2-line text-2xl" style={{ color: textFaint }} />
                      <p className="text-xs" style={{ color: textFaint }}>Henüz ziyaret kaydı yok</p>
                    </div>
                  ) : atamaGecmisi.map(z => (
                    <div key={z.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: z.durum === 'aktif' ? 'rgba(34,197,94,0.1)' : 'rgba(148,163,184,0.1)' }}>
                        <i className="ri-map-pin-2-line text-xs" style={{ color: z.durum === 'aktif' ? '#22C55E' : '#94A3B8' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: textPrimary }}>{z.uzman_ad ?? z.uzman_email ?? '—'}</p>
                        <p className="text-[10px]" style={{ color: textFaint }}>
                          {new Date(z.giris_saati).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          {z.cikis_saati && ` — ${new Date(z.cikis_saati).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`}
                        </p>
                      </div>
                      <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: z.durum === 'aktif' ? 'rgba(34,197,94,0.1)' : 'rgba(148,163,184,0.1)', color: z.durum === 'aktif' ? '#22C55E' : '#94A3B8' }}>
                        {z.durum === 'aktif' ? '● Aktif' : 'Tamamlandı'}
                      </span>
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
