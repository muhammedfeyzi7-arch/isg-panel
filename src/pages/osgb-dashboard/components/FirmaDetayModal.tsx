import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import FirmaQrModal from './FirmaQrModal';
import FirmaKonumSecici from './FirmaKonumSecici';

interface Uzman {
  user_id: string;
  display_name: string;
  email: string;
  active_firm_id: string | null;
  active_firm_ids?: string[] | null;
}
interface FirmaDetayModalProps {
  firmaId: string;
  firmaAdi: string;
  orgId: string;
  uzmanlar: Uzman[];
  onClose: () => void;
  onRefresh: () => void;
  addToast: (msg: string, type: 'success' | 'error') => void;
  isDark?: boolean;
}
interface PersonelRow { id: string; ad_soyad: string; gorevi: string | null; created_at: string; }
interface ZiyaretRow {
  id: string;
  uzman_ad: string | null;
  uzman_email: string | null;
  giris_saati: string;
  cikis_saati: string | null;
  durum: string;
  qr_ile_giris?: boolean;
}

export default function FirmaDetayModal({
  firmaId, firmaAdi, orgId, uzmanlar, onClose, onRefresh, addToast, isDark = false,
}: FirmaDetayModalProps) {
  const [activeTab, setActiveTab] = useState<'ozet' | 'personel' | 'ziyaretler' | 'duzenle'>('ozet');
  const [personeller, setPersoneller] = useState<PersonelRow[]>([]);
  const [ziyaretler, setZiyaretler] = useState<ZiyaretRow[]>([]);
  const [personelSayisi, setPersonelSayisi] = useState(0);
  const [loading, setLoading] = useState(true);
  const [atananUzmanIds, setAtananUzmanIds] = useState<string[]>([]);
  const [atanmaLoading, setAtanmaLoading] = useState(false);
  const [firmaDurum, setFirmaDurum] = useState<'aktif' | 'pasif'>('aktif');
  const [durumLoading, setDurumLoading] = useState(false);
  const [silOnay, setSilOnay] = useState(false);
  const [silLoading, setSilLoading] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [sonZiyaretTarih, setSonZiyaretTarih] = useState<string | null>(null);
  const [firmaInfo, setFirmaInfo] = useState<{
    yetkili?: string; telefon?: string; email?: string; sgkSicil?: string; adres?: string;
  } | null>(null);

  // Düzenleme formu
  const [editForm, setEditForm] = useState({
    ad: firmaAdi,
    yetkili: '', telefon: '', email: '', sgkSicil: '', adres: '',
    gpsRequired: false, gpsRadius: 1000, gpsStrict: true,
    firmaLat: null as number | null, firmaLng: null as number | null,
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  const cardBg = 'var(--bg-item)';
  const cardBorder = 'var(--border-subtle)';
  const textPrimary = 'var(--text-primary)';
  const textMuted = 'var(--text-muted)';
  const textFaint = 'var(--text-faint)';
  const modalBg = 'var(--modal-bg)';
  const modalBorder = 'var(--modal-border)';
  const inputBorder = 'var(--border-input)';

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [
      { count: personelCount },
      { data: personelData },
      { data: orgData },
      { data: ziyaretData },
      { data: appData },
    ] = await Promise.all([
      supabase.from('personeller').select('id', { count: 'exact', head: true }).eq('organization_id', firmaId),
      supabase.from('personeller').select('id, ad_soyad, gorevi, created_at').eq('organization_id', firmaId).order('created_at', { ascending: false }).limit(10),
      supabase.from('organizations').select('id, name, is_active, gps_required, gps_radius, gps_strict, firma_lat, firma_lng').eq('id', firmaId).maybeSingle(),
      supabase.from('osgb_ziyaretler')
        .select('id, uzman_ad, uzman_email, giris_saati, cikis_saati, durum, qr_ile_giris')
        .eq('firma_org_id', firmaId)
        .order('giris_saati', { ascending: false })
        .limit(20),
      supabase.from('app_data').select('data').eq('organization_id', firmaId).maybeSingle(),
    ]);

    setPersonelSayisi(personelCount ?? 0);
    setPersoneller(personelData ?? []);
    setZiyaretler((ziyaretData ?? []) as ZiyaretRow[]);
    setSonZiyaretTarih((ziyaretData ?? [])[0]?.giris_saati ?? null);

    const org = orgData as { is_active?: boolean; name?: string; gps_required?: boolean; gps_radius?: number; gps_strict?: boolean; firma_lat?: number | null; firma_lng?: number | null } | null;
    setFirmaDurum(org?.is_active !== false ? 'aktif' : 'pasif');

    const data = (appData as { data?: Record<string, unknown> } | null)?.data;
    const infoObj = data && typeof data === 'object' ? {
      yetkili: data.yetkili as string | undefined,
      telefon: data.telefon as string | undefined,
      email: data.email as string | undefined,
      sgkSicil: data.sgkSicil as string | undefined,
      adres: data.adres as string | undefined,
    } : null;
    if (infoObj) setFirmaInfo(infoObj);

    // Düzenleme formunu doldur
    setEditForm({
      ad: org?.name ?? firmaAdi,
      yetkili: (data?.yetkili as string) ?? '',
      telefon: (data?.telefon as string) ?? '',
      email: (data?.email as string) ?? '',
      sgkSicil: (data?.sgkSicil as string) ?? '',
      adres: (data?.adres as string) ?? '',
      gpsRequired: org?.gps_required ?? false,
      gpsRadius: org?.gps_radius ?? 1000,
      gpsStrict: org?.gps_strict ?? true,
      firmaLat: org?.firma_lat ?? null,
      firmaLng: org?.firma_lng ?? null,
    });

    const atananlar = uzmanlar.filter(u =>
      (u.active_firm_ids && u.active_firm_ids.includes(firmaId)) ||
      u.active_firm_id === firmaId
    );
    setAtananUzmanIds(atananlar.map(u => u.user_id));
    setLoading(false);
  }, [firmaId, uzmanlar]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const toggleUzman = (userId: string) => {
    setAtananUzmanIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleUzmanAta = async () => {
    setAtanmaLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Oturum bulunamadı.');

      const eskiAtananlar = uzmanlar.filter(u =>
        (u.active_firm_ids && u.active_firm_ids.includes(firmaId)) ||
        u.active_firm_id === firmaId
      );
      const eklenecekler = atananUzmanIds.filter(id => !eskiAtananlar.some(u => u.user_id === id));
      const kaldirilacaklar = eskiAtananlar
        .filter(u => !atananUzmanIds.includes(u.user_id))
        .map(u => u.user_id);

      const res = await fetch('https://niuvjthvhjbfyuuhoowq.supabase.co/functions/v1/admin-user-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'assign_firms',
          organization_id: orgId,
          firma_id: firmaId,
          eklenecek_user_ids: eklenecekler,
          kaldirilacak_user_ids: kaldirilacaklar,
        }),
      });
      const json = await res.json() as { error?: string; success?: boolean };
      if (json.error) throw new Error(json.error);

      addToast(
        atananUzmanIds.length > 0
          ? `${atananUzmanIds.length} uzman bu firmaya atandı!`
          : 'Uzman ataması kaldırıldı.',
        'success'
      );
      onRefresh();
    } catch (err) {
      addToast(`Uzman ataması yapılamadı: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally { setAtanmaLoading(false); }
  };

  /** Nominatim geocoding */
  const handleGeocode = async () => {
    const q = editForm.adres.trim();
    if (!q) return;
    setGeocodeLoading(true);
    setGeocodeError(null);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`, { headers: { 'Accept-Language': 'tr' } });
      const result = await res.json() as Array<{ lat: string; lon: string }>;
      if (!result || result.length === 0) { setGeocodeError('Adres bulunamadı.'); return; }
      setEditForm(p => ({ ...p, firmaLat: parseFloat(result[0].lat), firmaLng: parseFloat(result[0].lon) }));
    } catch { setGeocodeError('Arama hatası.'); }
    finally { setGeocodeLoading(false); }
  };

  const handleEdit = async () => {
    if (!editForm.ad.trim()) { setEditError('Firma adı zorunludur.'); return; }
    setEditLoading(true);
    setEditError(null);
    try {
      const { error: orgErr } = await supabase.from('organizations').update({
        name: editForm.ad.trim(),
        gps_required: editForm.gpsRequired,
        gps_radius: editForm.gpsRadius,
        gps_strict: editForm.gpsStrict,
        firma_lat: editForm.gpsRequired ? editForm.firmaLat : null,
        firma_lng: editForm.gpsRequired ? editForm.firmaLng : null,
        firma_adres: editForm.adres.trim() || null,
      }).eq('id', firmaId);
      if (orgErr) throw orgErr;
      await supabase.from('app_data').upsert({
        organization_id: firmaId,
        data: { yetkili: editForm.yetkili, telefon: editForm.telefon, email: editForm.email, sgkSicil: editForm.sgkSicil, adres: editForm.adres },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id' });
      setFirmaInfo({ yetkili: editForm.yetkili, telefon: editForm.telefon, email: editForm.email, sgkSicil: editForm.sgkSicil, adres: editForm.adres });
      addToast('Firma bilgileri güncellendi!', 'success');
      setActiveTab('ozet');
      onRefresh();
    } catch (err) { setEditError(err instanceof Error ? err.message : String(err)); }
    finally { setEditLoading(false); }
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
      const { error } = await supabase.from('organizations')
        .update({ is_active: false, name: `[SİLİNDİ] ${firmaAdi}` })
        .eq('id', firmaId);
      if (error) throw error;
      addToast('Firma silindi.', 'success');
      onClose();
      onRefresh();
    } catch (err) {
      addToast(`Silme başarısız: ${String(err)}`, 'error');
    } finally { setSilLoading(false); }
  };

  const aktifZiyaret = ziyaretler.find(z => z.durum === 'aktif' || !z.cikis_saati);
  const totalZiyaret = ziyaretler.length;
  const son7Gun = ziyaretler.filter(z => {
    const diff = (Date.now() - new Date(z.giris_saati).getTime()) / 86400000;
    return diff <= 7;
  }).length;

  const avgSure = (() => {
    const tamamlanan = ziyaretler.filter(z => z.cikis_saati);
    if (tamamlanan.length === 0) return null;
    const toplamDk = tamamlanan.reduce((acc, z) => {
      const diff = (new Date(z.cikis_saati!).getTime() - new Date(z.giris_saati).getTime()) / 60000;
      return acc + diff;
    }, 0);
    return Math.round(toplamDk / tamamlanan.length);
  })();

  const gunOnce = (tarih: string) => {
    const diff = (Date.now() - new Date(tarih).getTime()) / 86400000;
    if (diff < 1 / 24) return 'Az önce';
    if (diff < 1) return `${Math.floor(diff * 24)}s önce`;
    if (diff < 2) return 'Dün';
    return `${Math.floor(diff)}g önce`;
  };

  const ziyaretSuresi = (giris: string, cikis: string | null) => {
    if (!cikis) return null;
    const dk = Math.round((new Date(cikis).getTime() - new Date(giris).getTime()) / 60000);
    if (dk < 60) return `${dk}dk`;
    return `${Math.floor(dk / 60)}sa ${dk % 60}dk`;
  };

  const modal = createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', zIndex: 99999 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl rounded-2xl flex flex-col"
        style={{ background: modalBg, border: `1px solid ${modalBorder}`, maxHeight: '90vh' }}>

        {/* ── HEADER ── */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${cardBorder}` }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex-shrink-0">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.15), rgba(2,132,199,0.1))', border: '1px solid rgba(14,165,233,0.2)' }}>
                <i className="ri-building-2-line text-base" style={{ color: '#0284C7' }} />
              </div>
              {aktifZiyaret && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center"
                  style={{ background: '#22C55E', borderColor: modalBg }}>
                  <span className="w-full h-full rounded-full animate-ping" style={{ background: 'rgba(34,197,94,0.6)' }} />
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold truncate" style={{ color: textPrimary }}>{firmaAdi}</h3>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{
                    background: firmaDurum === 'aktif' ? 'rgba(14,165,233,0.12)' : 'rgba(100,116,139,0.12)',
                    color: firmaDurum === 'aktif' ? '#0EA5E9' : '#64748B',
                    border: `1px solid ${firmaDurum === 'aktif' ? 'rgba(14,165,233,0.25)' : 'rgba(100,116,139,0.25)'}`,
                  }}>
                  {firmaDurum === 'aktif' ? '● Aktif' : '○ Pasif'}
                </span>
                {aktifZiyaret && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1"
                    style={{ background: 'rgba(34,197,94,0.1)', color: '#16A34A', border: '1px solid rgba(34,197,94,0.25)' }}>
                    <span className="w-1.5 h-1.5 rounded-full inline-block animate-pulse" style={{ background: '#22C55E' }} />
                    Ziyaret aktif
                  </span>
                )}
              </div>
              <p className="text-[10px] mt-0.5" style={{ color: textFaint }}>ISG Yönetimi · Müşteri Firma</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={() => setShowQrModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
              style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)', color: '#0EA5E9' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.15)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.08)'; }}>
              <i className="ri-qr-code-line text-xs" />QR
            </button>
            <button onClick={handleDurumDegistir} disabled={durumLoading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
              style={{
                background: firmaDurum === 'aktif' ? 'rgba(239,68,68,0.07)' : 'rgba(14,165,233,0.08)',
                border: `1px solid ${firmaDurum === 'aktif' ? 'rgba(239,68,68,0.2)' : 'rgba(14,165,233,0.2)'}`,
                color: firmaDurum === 'aktif' ? '#EF4444' : '#0EA5E9',
              }}>
              {durumLoading ? <i className="ri-loader-4-line animate-spin text-xs" /> : <i className={`${firmaDurum === 'aktif' ? 'ri-pause-circle-line' : 'ri-play-circle-line'} text-xs`} />}
              {firmaDurum === 'aktif' ? 'Pasif Yap' : 'Aktif Et'}
            </button>
            {!silOnay ? (
              <button onClick={() => setSilOnay(true)}
                className="w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer transition-all"
                style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', color: '#EF4444' }}>
                <i className="ri-delete-bin-line text-xs" />
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-semibold" style={{ color: '#EF4444' }}>Emin mi?</span>
                <button onClick={handleSil} disabled={silLoading}
                  className="px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer text-white whitespace-nowrap"
                  style={{ background: '#EF4444' }}>
                  {silLoading ? <i className="ri-loader-4-line animate-spin" /> : 'Sil'}
                </button>
                <button onClick={() => setSilOnay(false)}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold cursor-pointer whitespace-nowrap"
                  style={{ background: 'var(--bg-item)', color: textMuted }}>
                  Vazgeç
                </button>
              </div>
            )}
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
              style={{ background: 'var(--bg-item)', color: textMuted }}>
              <i className="ri-close-line text-sm" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3">
            <i className="ri-loader-4-line text-2xl animate-spin" style={{ color: '#0EA5E9' }} />
            <span className="text-sm" style={{ color: textFaint }}>Yükleniyor...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">

            {/* ── UZMAN ATAMA ── */}
            <div className="px-6 py-4" style={{ background: 'var(--bg-item)', borderBottom: `1px solid ${cardBorder}` }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 flex items-center justify-center rounded-lg" style={{ background: 'rgba(14,165,233,0.1)' }}>
                    <i className="ri-user-star-line text-[10px]" style={{ color: '#0EA5E9' }} />
                  </div>
                  <span className="text-xs font-semibold" style={{ color: textMuted }}>Bu firmaya atanan uzmanlar</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: atananUzmanIds.length > 0 ? 'rgba(14,165,233,0.1)' : 'rgba(100,116,139,0.08)', color: atananUzmanIds.length > 0 ? '#0284C7' : textFaint }}>
                    {atananUzmanIds.length} uzman bağlı
                  </span>
                </div>
                <button onClick={handleUzmanAta} disabled={atanmaLoading}
                  className="whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white cursor-pointer"
                  style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)', opacity: atanmaLoading ? 0.7 : 1 }}>
                  {atanmaLoading
                    ? <><i className="ri-loader-4-line animate-spin text-xs" />Kaydediliyor...</>
                    : <><i className="ri-save-line text-xs" />Kaydet</>}
                </button>
              </div>

              {uzmanlar.length === 0 ? (
                <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.18)' }}>
                  <i className="ri-information-line text-sm flex-shrink-0" style={{ color: '#F59E0B' }} />
                  <p className="text-xs" style={{ color: textMuted }}>Henüz gezici uzman eklenmedi.</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
                  {uzmanlar.map(u => {
                    const secili = atananUzmanIds.includes(u.user_id);
                    const baskaBirFirmada = !secili && ((u.active_firm_ids && u.active_firm_ids.length > 0) || u.active_firm_id);
                    return (
                      <button key={u.user_id} type="button" onClick={() => toggleUzman(u.user_id)}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all text-left"
                        style={{ background: secili ? 'rgba(14,165,233,0.07)' : 'var(--bg-card-solid)', border: secili ? '1.5px solid rgba(14,165,233,0.28)' : `1.5px solid ${inputBorder}` }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateX(2px)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateX(0)'; }}>
                        <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                          style={secili ? { background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' } : { background: 'var(--bg-card-solid)', border: `1.5px solid ${inputBorder}` }}>
                          {secili && <i className="ri-check-line text-white text-[10px]" />}
                        </div>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                          style={{ background: secili ? 'linear-gradient(135deg, #0EA5E9, #0284C7)' : 'linear-gradient(135deg, #64748b, #475569)' }}>
                          {(u.display_name ?? u.email ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: secili ? '#0284C7' : textPrimary }}>{u.display_name}</p>
                          <p className="text-[10px] truncate" style={{ color: textFaint }}>{u.email}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {baskaBirFirmada && !secili && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                              style={{ background: 'rgba(245,158,11,0.1)', color: '#D97706', border: '1px solid rgba(245,158,11,0.22)' }}>
                              Başka firmada
                            </span>
                          )}
                          {secili && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{ background: 'rgba(14,165,233,0.1)', color: '#0284C7', border: '1px solid rgba(14,165,233,0.22)' }}>
                              ✓ Atandı
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {uzmanlar.length > 0 && (
                <p className="text-[10px] mt-2" style={{ color: textFaint }}>
                  <i className="ri-information-line mr-0.5" />Bir uzman birden fazla firmaya atanabilir.
                </p>
              )}
            </div>

            {/* ── KPI ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-4" style={{ borderBottom: `1px solid ${cardBorder}` }}>
              {[
                { label: 'Toplam Personel', value: personelSayisi, icon: 'ri-group-line', color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)' },
                { label: 'Toplam Ziyaret', value: totalZiyaret, icon: 'ri-map-pin-2-line', color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)' },
                { label: 'Son Ziyaret', value: sonZiyaretTarih ? gunOnce(sonZiyaretTarih) : '—', icon: 'ri-time-line', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', isText: true },
                { label: 'Ort. Ziyaret Süresi', value: avgSure !== null ? `${avgSure}dk` : '—', icon: 'ri-timer-line', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', isText: true },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-3 flex items-center gap-3" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: s.bg }}>
                    <i className={`${s.icon} text-sm`} style={{ color: s.color }} />
                  </div>
                  <div>
                    <p className={`${(s as { isText?: boolean }).isText ? 'text-sm' : 'text-base'} font-extrabold leading-none`} style={{ color: textPrimary }}>{s.value}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: textFaint }}>{s.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── TABS ── */}
            <div className="flex gap-0.5 px-6" style={{ borderBottom: `1px solid ${cardBorder}` }}>
              {[
                { id: 'ozet' as const, label: 'Özet', icon: 'ri-pie-chart-line' },
                { id: 'personel' as const, label: `Personel (${personeller.length})`, icon: 'ri-group-line' },
                { id: 'ziyaretler' as const, label: `Ziyaret (${ziyaretler.length})`, icon: 'ri-map-pin-2-line' },
                { id: 'duzenle' as const, label: 'Düzenle', icon: 'ri-edit-line' },
              ].map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className="flex items-center gap-1.5 px-3 py-3 text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors"
                  style={{ color: activeTab === t.id ? '#0284C7' : textFaint, borderBottom: activeTab === t.id ? '2px solid #0EA5E9' : '2px solid transparent' }}>
                  <i className={`${t.icon} text-xs`} />{t.label}
                </button>
              ))}
            </div>

            <div className="px-6 py-4">
              {activeTab === 'ozet' && (
                <div className="space-y-4">
                  <div className="rounded-xl p-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                    <div className="flex items-center gap-2 mb-3">
                      <i className="ri-building-2-line text-xs" style={{ color: '#0EA5E9' }} />
                      <p className="text-xs font-semibold" style={{ color: textMuted }}>Firma Bilgileri</p>
                    </div>
                    {!firmaInfo || (!firmaInfo.yetkili && !firmaInfo.telefon && !firmaInfo.email && !firmaInfo.sgkSicil && !firmaInfo.adres) ? (
                      <p className="text-xs" style={{ color: textFaint }}>Firma bilgisi henüz girilmemiş.</p>
                    ) : (
                      <div className="space-y-2">
                        {[
                          { label: 'Yetkili Kişi', value: firmaInfo.yetkili, icon: 'ri-user-line' },
                          { label: 'Telefon', value: firmaInfo.telefon, icon: 'ri-phone-line' },
                          { label: 'E-posta', value: firmaInfo.email, icon: 'ri-mail-line' },
                          { label: 'SGK Sicil No', value: firmaInfo.sgkSicil, icon: 'ri-file-shield-2-line' },
                          { label: 'Adres', value: firmaInfo.adres, icon: 'ri-map-pin-line' },
                        ].filter(row => row.value).map(row => (
                          <div key={row.label} className="flex items-start gap-2.5">
                            <div className="w-6 h-6 flex items-center justify-center rounded-lg flex-shrink-0 mt-0.5" style={{ background: 'rgba(14,165,233,0.08)' }}>
                              <i className={`${row.icon} text-[10px]`} style={{ color: '#0EA5E9' }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px]" style={{ color: textFaint }}>{row.label}</p>
                              <p className="text-xs font-semibold" style={{ color: textPrimary }}>{row.value}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl p-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                    <div className="flex items-center gap-2 mb-3">
                      <i className="ri-bar-chart-line text-xs" style={{ color: '#0EA5E9' }} />
                      <p className="text-xs font-semibold" style={{ color: textMuted }}>Ziyaret Performansı</p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[10.5px]" style={{ color: textFaint }}>Son 7 günde ziyaret oranı</p>
                        <span className="text-xs font-bold" style={{ color: son7Gun > 0 ? '#0EA5E9' : textFaint }}>{son7Gun} ziyaret</span>
                      </div>
                      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }}>
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, (son7Gun / 7) * 100)}%`, background: son7Gun >= 5 ? '#0EA5E9' : son7Gun >= 2 ? '#F59E0B' : '#EF4444' }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'personel' && (
                <div className="space-y-2">
                  {personeller.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                      <i className="ri-group-line text-2xl" style={{ color: textFaint }} />
                      <p className="text-xs" style={{ color: textFaint }}>Henüz personel kaydı yok</p>
                    </div>
                  ) : personeller.map(p => (
                    <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl transition-all"
                      style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateX(2px)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateX(0)'; }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}>
                        {p.ad_soyad.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: textPrimary }}>{p.ad_soyad}</p>
                        <p className="text-[10px]" style={{ color: textFaint }}>{p.gorevi ?? 'Görev belirtilmedi'}</p>
                      </div>
                      <span className="text-[10px] flex-shrink-0" style={{ color: textFaint }}>
                        {new Date(p.created_at).toLocaleDateString('tr-TR')}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'duzenle' && (
                <div className="space-y-4">
                  {editError && (
                    <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <i className="ri-error-warning-line text-sm flex-shrink-0" style={{ color: '#EF4444' }} />
                      <p className="text-xs" style={{ color: '#EF4444' }}>{editError}</p>
                    </div>
                  )}
                  {/* Temel Bilgiler */}
                  <div className="rounded-xl p-4 space-y-3" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                    <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: textMuted }}>Temel Bilgiler</p>
                    {[
                      { label: 'Firma Adı *', key: 'ad', placeholder: 'Firma adı' },
                      { label: 'Yetkili Kişi', key: 'yetkili', placeholder: 'Yetkili adı soyadı' },
                      { label: 'Telefon', key: 'telefon', placeholder: '+90 5xx xxx xx xx' },
                      { label: 'E-posta', key: 'email', placeholder: 'firma@example.com' },
                      { label: 'SGK Sicil No', key: 'sgkSicil', placeholder: 'SGK sicil numarası' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="block text-[10px] font-semibold mb-1" style={{ color: textMuted }}>{f.label}</label>
                        <input
                          value={(editForm as Record<string, unknown>)[f.key] as string}
                          onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                          placeholder={f.placeholder}
                          className="w-full text-xs px-3 py-2 rounded-xl outline-none"
                          style={{ background: 'var(--bg-input)', border: `1px solid ${cardBorder}`, color: textPrimary }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* GPS Ayarları */}
                  <div className="rounded-xl p-4 space-y-3" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                    <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: textMuted }}>GPS & Konum Ayarları</p>
                    <div className="flex gap-2">
                      {[
                        { val: false, label: 'Sadece QR', icon: 'ri-qr-code-line' },
                        { val: true, label: 'QR + Konum', icon: 'ri-map-pin-2-line' },
                      ].map(opt => (
                        <button key={String(opt.val)} type="button"
                          onClick={() => setEditForm(p => ({ ...p, gpsRequired: opt.val }))}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                          style={{
                            background: editForm.gpsRequired === opt.val ? (opt.val ? 'rgba(239,68,68,0.1)' : 'rgba(14,165,233,0.1)') : 'var(--bg-item)',
                            border: `1.5px solid ${editForm.gpsRequired === opt.val ? (opt.val ? 'rgba(239,68,68,0.3)' : 'rgba(14,165,233,0.3)') : cardBorder}`,
                            color: editForm.gpsRequired === opt.val ? (opt.val ? '#EF4444' : '#0EA5E9') : textMuted,
                          }}>
                          <i className={`${opt.icon} text-xs`} />{opt.label}
                        </button>
                      ))}
                    </div>

                    {editForm.gpsRequired && (
                      <div className="space-y-3">
                        {/* Adres + Geocode */}
                        <div>
                          <label className="block text-[10px] font-semibold mb-1" style={{ color: textMuted }}>Firma Adresi</label>
                          <div className="flex gap-2">
                            <input
                              value={editForm.adres}
                              onChange={e => { setEditForm(p => ({ ...p, adres: e.target.value })); setGeocodeError(null); }}
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleGeocode(); } }}
                              placeholder="Tam adres — Enter veya 'Ara'"
                              className="flex-1 text-xs px-3 py-2 rounded-xl outline-none"
                              style={{ background: 'var(--bg-input)', border: `1px solid ${cardBorder}`, color: textPrimary }}
                            />
                            <button type="button" onClick={() => void handleGeocode()} disabled={geocodeLoading || !editForm.adres.trim()}
                              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap"
                              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', opacity: geocodeLoading ? 0.7 : 1 }}>
                              {geocodeLoading ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-search-line" />}Ara
                            </button>
                          </div>
                          {geocodeError && <p className="text-[10px] mt-1" style={{ color: '#EF4444' }}>{geocodeError}</p>}
                          {editForm.firmaLat !== null && !geocodeError && (
                            <p className="text-[10px] mt-1" style={{ color: '#16A34A' }}>
                              <i className="ri-map-pin-2-fill mr-0.5" />Konum: {editForm.firmaLat.toFixed(5)}, {editForm.firmaLng?.toFixed(5)} — haritaya tıklayarak ayarlayın
                            </p>
                          )}
                        </div>
                        {/* Harita */}
                        <FirmaKonumSecici
                          lat={editForm.firmaLat}
                          lng={editForm.firmaLng}
                          radius={editForm.gpsRadius}
                          onSelect={(lat, lng) => setEditForm(p => ({ ...p, firmaLat: lat, firmaLng: lng }))}
                        />
                        {/* Radius slider */}
                        <div>
                          <label className="block text-[10px] font-semibold mb-1" style={{ color: textMuted }}>
                            İzin Verilen Mesafe: <span style={{ color: '#EF4444' }}>{editForm.gpsRadius} m</span>
                          </label>
                          <input type="range" min={50} max={5000} step={50} value={editForm.gpsRadius}
                            onChange={e => setEditForm(p => ({ ...p, gpsRadius: Number(e.target.value) }))}
                            className="w-full" />
                        </div>
                        {/* GPS Strict */}
                        <div className="flex gap-2">
                          {[
                            { val: true, label: 'GPS yoksa engelle' },
                            { val: false, label: 'GPS yoksa izin ver' },
                          ].map(opt => (
                            <button key={String(opt.val)} type="button"
                              onClick={() => setEditForm(p => ({ ...p, gpsStrict: opt.val }))}
                              className="flex-1 py-2 rounded-xl text-[10px] font-semibold cursor-pointer transition-all"
                              style={{
                                background: editForm.gpsStrict === opt.val ? 'rgba(14,165,233,0.1)' : 'var(--bg-item)',
                                border: `1px solid ${editForm.gpsStrict === opt.val ? 'rgba(14,165,233,0.3)' : cardBorder}`,
                                color: editForm.gpsStrict === opt.val ? '#0EA5E9' : textMuted,
                              }}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {!editForm.gpsRequired && (
                      <div>
                        <label className="block text-[10px] font-semibold mb-1" style={{ color: textMuted }}>Adres (isteğe bağlı)</label>
                        <input value={editForm.adres} onChange={e => setEditForm(p => ({ ...p, adres: e.target.value }))}
                          placeholder="Firma adresi" className="w-full text-xs px-3 py-2 rounded-xl outline-none"
                          style={{ background: 'var(--bg-input)', border: `1px solid ${cardBorder}`, color: textPrimary }} />
                      </div>
                    )}
                  </div>

                  <button onClick={() => void handleEdit()} disabled={editLoading}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white cursor-pointer"
                    style={{ background: editLoading ? 'rgba(14,165,233,0.5)' : 'linear-gradient(135deg, #0EA5E9, #0284C7)', opacity: editLoading ? 0.8 : 1 }}>
                    {editLoading ? <><i className="ri-loader-4-line animate-spin" />Kaydediliyor...</> : <><i className="ri-save-line" />Değişiklikleri Kaydet</>}
                  </button>
                </div>
              )}

              {activeTab === 'ziyaretler' && (
                <div className="space-y-2">
                  {ziyaretler.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                      <i className="ri-map-pin-2-line text-2xl" style={{ color: textFaint }} />
                      <p className="text-xs" style={{ color: textFaint }}>Henüz ziyaret kaydı yok</p>
                    </div>
                  ) : ziyaretler.map(z => {
                    const aktif = z.durum === 'aktif' || !z.cikis_saati;
                    const sure = ziyaretSuresi(z.giris_saati, z.cikis_saati);
                    return (
                      <div key={z.id} className="flex items-center gap-3 p-3 rounded-xl transition-all"
                        style={{ background: aktif ? 'rgba(34,197,94,0.06)' : cardBg, border: `1px solid ${aktif ? 'rgba(34,197,94,0.2)' : cardBorder}` }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateX(2px)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateX(0)'; }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: aktif ? 'rgba(34,197,94,0.12)' : 'rgba(148,163,184,0.1)' }}>
                          {aktif ? <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: '#22C55E' }} /> : <i className="ri-checkbox-circle-line text-sm" style={{ color: '#94A3B8' }} />}
                        </div>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                          style={{ background: aktif ? 'linear-gradient(135deg, #0EA5E9, #0284C7)' : 'linear-gradient(135deg, #64748b, #475569)' }}>
                          {(z.uzman_ad ?? z.uzman_email ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: textPrimary }}>{z.uzman_ad ?? z.uzman_email ?? '—'}</p>
                          <p className="text-[10px]" style={{ color: textFaint }}>
                            {new Date(z.giris_saati).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            {z.cikis_saati && ` — ${new Date(z.cikis_saati).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {sure && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(14,165,233,0.1)', color: '#0284C7' }}>{sure}</span>}
                          {z.qr_ile_giris && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(14,165,233,0.1)', color: '#0284C7' }}>QR</span>}
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: aktif ? 'rgba(34,197,94,0.1)' : 'rgba(148,163,184,0.1)', color: aktif ? '#16A34A' : '#94A3B8' }}>
                            {aktif ? '● Aktif' : 'Tamam'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );

  return (
    <>
      {modal}
      {showQrModal && (
        <FirmaQrModal firmaId={firmaId} firmaAdi={firmaAdi} isDark={isDark} onClose={() => setShowQrModal(false)} />
      )}
    </>
  );
}
