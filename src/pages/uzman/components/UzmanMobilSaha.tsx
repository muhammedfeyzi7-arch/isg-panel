import { useState, useCallback, useEffect, useRef, useMemo, memo } from 'react';
import { useApp } from '@/store/AppContext';
import { useAuth } from '@/store/AuthContext';
import { supabase } from '@/lib/supabase';
import SahaUygunsuzlukForm from '@/pages/saha/components/SahaUygunsuzlukForm';
import { SahaDetayModal, SahaKapatmaModal } from '@/pages/saha/components/SahaUygunsuzlukModals';
import IsIzniSahaBolumu from '@/pages/saha/components/IsIzniSahaBolumu';
import { OfflineBand, PendingModal } from '@/pages/saha/components/OfflineBand';
import QrScanner, { loadJsQR } from '@/pages/saha/components/QrScanner';
import {
  STATUS_CFG,
  EkipmanDetayPanel,
  EkipmanListeModal,
  FirmaEkipmanModal,
  FirmaOzeti,
} from '@/pages/saha/components/EkipmanKontrol';
import { STATUS_CONFIG, SEV_CONFIG } from '@/pages/nonconformity/utils/statusHelper';
import { useQueue } from '@/store/OfflineQueueContext';
import { uploadFileToStorage } from '@/utils/fileUpload';
import type { Ekipman, EkipmanStatus, Uygunsuzluk } from '@/types';

// ── Sekme Tanımları ───────────────────────────────────────────────────────────
type SahaTab = 'ziyaret' | 'qr' | 'ekipman' | 'izin' | 'uygunsuzluk';

const TABS: { id: SahaTab; label: string; icon: string; color: string }[] = [
  { id: 'ziyaret',     label: 'Ziyaret',     icon: 'ri-map-pin-user-line',   color: '#0EA5E9' },
  { id: 'qr',          label: 'QR Tara',     icon: 'ri-qr-code-line',        color: '#0EA5E9' },
  { id: 'ekipman',     label: 'Ekipman',     icon: 'ri-tools-line',          color: '#0EA5E9' },
  { id: 'izin',        label: 'İş İzni',     icon: 'ri-shield-keyhole-line', color: '#0EA5E9' },
  { id: 'uygunsuzluk', label: 'Uygunsuzluk', icon: 'ri-error-warning-line',  color: '#0EA5E9' },
];

const ACCENT = '#0EA5E9';

// ── GPS Yardımcıları ──────────────────────────────────────────────────────────
interface GpsCoords { lat: number; lng: number; }

function getGpsCoords(): Promise<GpsCoords | null> {
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 10000, maximumAge: 30000, enableHighAccuracy: true },
    );
  });
}

function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface FirmaGpsInfo {
  name: string;
  gps_required: boolean;
  gps_radius: number;
  gps_strict: boolean;
  firma_lat: number | null;
  firma_lng: number | null;
}

interface AktifZiyaret {
  id: string;
  firma_org_id: string;
  firma_ad: string | null;
  giris_saati: string;
  qr_ile_giris: boolean;
}

// ── Ziyaret Sekmesi ───────────────────────────────────────────────────────────
function ZiyaretTab({ isDark }: { isDark: boolean }) {
  const { user } = useAuth();
  const { org, addToast } = useApp();

  const [aktifZiyaret, setAktifZiyaret] = useState<AktifZiyaret | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [gecmis, setGecmis] = useState<AktifZiyaret[]>([]);
  const [elapsed, setElapsed] = useState('');
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'checking' | 'ok' | 'denied' | 'blocked'>('idle');
  const [osgbOrgId, setOsgbOrgId] = useState<string | null>(null);
  const [uzmanAd, setUzmanAd] = useState('');

  const cardBg = isDark ? 'rgba(17,24,39,0.85)' : '#ffffff';
  const border = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = isDark ? '#64748b' : '#64748b';

  // Elapsed timer
  useEffect(() => {
    if (!aktifZiyaret) { setElapsed(''); return; }
    const upd = () => {
      const diff = Date.now() - new Date(aktifZiyaret.giris_saati).getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(`${h > 0 ? h + 's ' : ''}${String(m).padStart(2, '0')}d ${String(s).padStart(2, '0')}s`);
    };
    upd();
    const iv = setInterval(upd, 1000);
    return () => clearInterval(iv);
  }, [aktifZiyaret]);

  const fetchZiyaret = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('osgb_ziyaretler')
        .select('id, firma_org_id, firma_ad, giris_saati, qr_ile_giris')
        .eq('uzman_user_id', user.id)
        .eq('durum', 'aktif')
        .maybeSingle();
      setAktifZiyaret(data ?? null);

      const { data: gecmisData } = await supabase
        .from('osgb_ziyaretler')
        .select('id, firma_org_id, firma_ad, giris_saati, qr_ile_giris')
        .eq('uzman_user_id', user.id)
        .eq('durum', 'tamamlandi')
        .order('created_at', { ascending: false })
        .limit(5);
      setGecmis((gecmisData ?? []) as AktifZiyaret[]);
    } finally { setLoading(false); }
  }, [user?.id]);

  const fetchOrgInfo = useCallback(async () => {
    if (!user?.id) return;
    if (org?.id) { setOsgbOrgId(org.id); setUzmanAd(user.user_metadata?.display_name ?? user.email ?? 'Uzman'); return; }
    const { data } = await supabase.from('user_organizations').select('organization_id, display_name').eq('user_id', user.id).eq('is_active', true).maybeSingle();
    if (data) { setOsgbOrgId(data.organization_id); setUzmanAd(data.display_name ?? user.email ?? 'Uzman'); }
  }, [user?.id, user?.email, user?.user_metadata, org?.id]);

  useEffect(() => { void fetchZiyaret(); void fetchOrgInfo(); }, [fetchZiyaret, fetchOrgInfo]);

  const handleCheckIn = useCallback(async (firmaId: string, qr = false) => {
    if (!user?.id) return;
    let resolvedOsgbOrgId = osgbOrgId;
    let resolvedUzmanAd = uzmanAd;
    if (!resolvedOsgbOrgId) {
      const { data } = await supabase.from('user_organizations').select('organization_id, display_name').eq('user_id', user.id).eq('is_active', true).maybeSingle();
      if (!data) { addToast('Organizasyon bulunamadı.', 'error'); return; }
      resolvedOsgbOrgId = data.organization_id;
      resolvedUzmanAd = data.display_name ?? user.email ?? 'Uzman';
    }
    setActionLoading(true); setGpsError(null);

    const { data: firmaData } = await supabase.from('organizations').select('name, gps_required, gps_radius, gps_strict, firma_lat, firma_lng').eq('id', firmaId).maybeSingle() as { data: FirmaGpsInfo | null };
    if (!firmaData) { addToast('Firma bulunamadı.', 'error'); setActionLoading(false); return; }

    const { data: existing } = await supabase.from('osgb_ziyaretler').select('id, firma_ad').eq('uzman_user_id', user.id).eq('durum', 'aktif').maybeSingle();
    if (existing) { addToast(`Zaten aktif ziyaret var: ${existing.firma_ad ?? 'Firma'}. Önce bitirin.`, 'error'); setActionLoading(false); return; }

    let coords: GpsCoords | null = null;
    let checkInGpsStatus: 'ok' | 'too_far' | 'no_permission' = 'ok';
    let checkInDistanceM: number | null = null;

    if (firmaData.gps_required) {
      setGpsStatus('loading');
      coords = await getGpsCoords();
      if (!coords) {
        checkInGpsStatus = 'no_permission';
        if (firmaData.gps_strict !== false) { setGpsStatus('denied'); setGpsError('Konum izni gerekli.'); setActionLoading(false); return; }
        setGpsStatus('denied');
      }
      if (coords && firmaData.firma_lat !== null && firmaData.firma_lng !== null) {
        setGpsStatus('checking');
        const dist = haversineMetres(coords.lat, coords.lng, firmaData.firma_lat, firmaData.firma_lng);
        const radius = firmaData.gps_radius ?? 1000;
        if (dist > radius) {
          checkInGpsStatus = 'too_far'; checkInDistanceM = Math.round(dist);
          const distStr = dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dist)} m`;
          setGpsStatus('blocked'); setGpsError(`Firma konumunda değilsiniz. Mesafe: ${distStr} — Limit: ${radius} m`); setActionLoading(false); return;
        }
        checkInDistanceM = Math.round(dist); checkInGpsStatus = 'ok'; setGpsStatus('ok');
      }
    } else {
      setGpsStatus('loading');
      coords = await getGpsCoords();
      setGpsStatus(coords ? 'ok' : 'idle');
    }

    try {
      const now = new Date().toISOString();
      const { data: yeniZiyaret, error } = await supabase.from('osgb_ziyaretler').insert({
        osgb_org_id: resolvedOsgbOrgId, firma_org_id: firmaId, firma_ad: firmaData.name,
        uzman_user_id: user.id, uzman_ad: resolvedUzmanAd || user.email || 'Uzman',
        uzman_email: user.email, giris_saati: now, durum: 'aktif', qr_ile_giris: qr,
        created_at: now, updated_at: now,
        check_in_lat: coords?.lat ?? null, check_in_lng: coords?.lng ?? null,
        gps_status: checkInGpsStatus, check_in_distance_m: checkInDistanceM,
      }).select('id, firma_org_id, firma_ad, giris_saati, qr_ile_giris').maybeSingle();
      if (error) throw error;
      setAktifZiyaret(yeniZiyaret ?? null);
      addToast(`${firmaData.name} ziyareti başlatıldı!`, 'success');
    } catch (err) {
      addToast(`Check-in yapılamadı: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setActionLoading(false);
      if (gpsStatus !== 'blocked' && gpsStatus !== 'denied') setTimeout(() => { setGpsStatus('idle'); setGpsError(null); }, 3000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, osgbOrgId, uzmanAd, addToast]);

  const handleCheckOut = useCallback(async () => {
    if (!aktifZiyaret || !user?.id) return;
    setActionLoading(true); setGpsStatus('loading');
    let coords: GpsCoords | null = null;
    try { coords = await getGpsCoords(); } catch { coords = null; }
    setGpsStatus(coords ? 'ok' : 'idle');
    try {
      const now = new Date().toISOString();
      const sureDakika = Math.round((Date.now() - new Date(aktifZiyaret.giris_saati).getTime()) / 60000);
      const { error } = await supabase
        .from('osgb_ziyaretler')
        .update({
          cikis_saati: now,
          durum: 'tamamlandi',
          sure_dakika: sureDakika,
          updated_at: now,
          check_out_lat: coords?.lat ?? null,
          check_out_lng: coords?.lng ?? null,
        })
        .eq('id', aktifZiyaret.id)
        .eq('uzman_user_id', user.id)
        .is('cikis_saati', null);
      if (error) throw new Error(error.message);
      addToast(`Ziyaret tamamlandı! Süre: ${sureDakika} dakika`, 'success');
      setAktifZiyaret(null); setShowQr(false); void fetchZiyaret();
    } catch (err) {
      addToast(`Check-out yapılamadı: ${err instanceof Error ? err.message : String(err)}`, 'error');
      void fetchZiyaret();
    } finally {
      setActionLoading(false);
      setTimeout(() => { setGpsStatus('idle'); setGpsError(null); }, 3000);
    }
  }, [aktifZiyaret, user?.id, addToast, fetchZiyaret]);

  const handleQrResult = useCallback((text: string) => {
    setShowQr(false); setGpsError(null); setGpsStatus('idle');
    let firmaId: string | null = null;
    try { const p = JSON.parse(text) as { type?: string; id?: string }; if (p.type === 'firm' && p.id) firmaId = p.id; } catch { /* not json */ }
    if (!firmaId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text.trim())) firmaId = text.trim();
    if (!firmaId) firmaId = text.match(/firma[_-]?id=([0-9a-f-]{36})/i)?.[1] ?? null;
    if (!firmaId) { const segs = text.replace(/[?#].*/, '').split('/').filter(Boolean); const last = segs[segs.length - 1] ?? ''; if (/^[0-9a-f-]{36}$/i.test(last)) firmaId = last; }
    if (!firmaId) { addToast('Geçersiz QR kodu.', 'error'); return; }
    const rFirmaId = firmaId;
    void (async () => {
      if (!user?.id) return;
      const { data: aktif } = await supabase.from('osgb_ziyaretler').select('id, firma_org_id, firma_ad, giris_saati, qr_ile_giris').eq('uzman_user_id', user.id).eq('durum', 'aktif').maybeSingle();
      if (aktif) {
        if (aktif.firma_org_id === rFirmaId) { setAktifZiyaret(aktif as AktifZiyaret); setTimeout(() => void handleCheckOut(), 100); }
        else addToast(`Başka firmada aktif ziyaret var (${aktif.firma_ad ?? 'Firma'}). Önce bitirin.`, 'error');
      } else void handleCheckIn(rFirmaId, true);
    })();
  }, [user?.id, handleCheckIn, handleCheckOut, addToast]);

  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const fmtDate = (iso: string) => {
    const d = new Date(iso); const t = new Date();
    if (d.toDateString() === t.toDateString()) return 'Bugün';
    const y = new Date(t); y.setDate(y.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'Dün';
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <i className="ri-loader-4-line text-2xl animate-spin" style={{ color: ACCENT }} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <style>{`
        @keyframes pulseRing { 0% { transform: scale(1); opacity: 0.8; } 70% { transform: scale(1.8); opacity: 0; } 100% { transform: scale(1.8); opacity: 0; } }
        @keyframes timerGlow { 0%, 100% { text-shadow: 0 0 12px rgba(14,165,233,0.3); } 50% { text-shadow: 0 0 24px rgba(14,165,233,0.7); } }
        .uzman-timer-glow { animation: timerGlow 2s ease-in-out infinite; }
      `}</style>

      {/* GPS band */}
      {gpsStatus !== 'idle' && (
        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${gpsStatus === 'blocked' ? 'rgba(239,68,68,0.25)' : gpsStatus === 'ok' ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
          <div className="flex items-center gap-2 px-3 py-2.5"
            style={{ background: gpsStatus === 'blocked' ? 'rgba(239,68,68,0.08)' : gpsStatus === 'ok' ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)' }}>
            <i className={`${gpsStatus === 'loading' || gpsStatus === 'checking' ? 'ri-loader-4-line animate-spin' : gpsStatus === 'ok' ? 'ri-map-pin-2-fill' : 'ri-map-pin-line'} text-sm flex-shrink-0`}
              style={{ color: gpsStatus === 'blocked' ? '#DC2626' : gpsStatus === 'ok' ? '#16A34A' : '#D97706' }} />
            <span className="text-xs font-semibold flex-1"
              style={{ color: gpsStatus === 'blocked' ? '#DC2626' : gpsStatus === 'ok' ? '#16A34A' : '#D97706' }}>
              {gpsStatus === 'loading' ? 'Konum alınıyor...' : gpsStatus === 'checking' ? 'Konum kontrol ediliyor...' : gpsStatus === 'ok' ? 'Konum doğrulandı' : gpsStatus === 'blocked' ? 'Firma konumunda değilsiniz' : 'Konum alınamadı'}
            </span>
            {(gpsStatus === 'blocked' || gpsStatus === 'denied') && (
              <button onClick={() => { setGpsStatus('idle'); setGpsError(null); }} className="w-5 h-5 flex items-center justify-center rounded cursor-pointer flex-shrink-0" style={{ color: '#DC2626' }}>
                <i className="ri-close-line text-xs" />
              </button>
            )}
          </div>
          {gpsError && (gpsStatus === 'blocked' || gpsStatus === 'denied') && (
            <div className="px-3 pb-3 pt-1" style={{ background: gpsStatus === 'blocked' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)' }}>
              <p className="text-[11px] leading-relaxed" style={{ color: '#64748B' }}>{gpsError}</p>
            </div>
          )}
        </div>
      )}

      {/* Aktif ziyaret */}
      {aktifZiyaret ? (
        <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: '1.5px solid rgba(14,165,233,0.3)' }}>
          <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #0284C7, #38BDF8, #0EA5E9)' }} />
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-shrink-0">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: ACCENT }} />
                <div className="absolute inset-0 rounded-full" style={{ background: ACCENT, animation: 'pulseRing 2s ease-out infinite' }} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: ACCENT }}>Aktif Ziyaret</span>
              {aktifZiyaret.qr_ile_giris && (
                <span className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(14,165,233,0.1)', color: ACCENT, border: '1px solid rgba(14,165,233,0.2)' }}>QR Girişi</span>
              )}
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.25)' }}>
                <i className="ri-building-2-line text-xl" style={{ color: ACCENT }} />
              </div>
              <div>
                <p className="text-base font-extrabold" style={{ color: textPrimary }}>{aktifZiyaret.firma_ad ?? 'Bilinmeyen Firma'}</p>
                <p className="text-xs" style={{ color: textMuted }}>Giriş: {fmtTime(aktifZiyaret.giris_saati)}</p>
              </div>
            </div>
            <div className="flex items-center justify-center py-4 rounded-2xl mb-4" style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.15)' }}>
              <p className="text-4xl font-black font-mono uzman-timer-glow" style={{ color: ACCENT }}>{elapsed || '00d 00s'}</p>
            </div>
            {showQr ? (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(14,165,233,0.2)' }}>
                <div className="flex items-center justify-between px-4 pt-3 pb-2">
                  <p className="text-sm font-semibold" style={{ color: textPrimary }}>Aynı Firma QR&apos;ını Okut</p>
                  <button onClick={() => setShowQr(false)} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                    <i className="ri-close-line text-sm" />
                  </button>
                </div>
                <QrScanner onResult={handleQrResult} onClose={() => setShowQr(false)} />
              </div>
            ) : (
              <button onClick={() => setShowQr(true)} disabled={actionLoading} className="w-full flex items-center gap-3 py-3 rounded-xl cursor-pointer transition-all" style={{ background: 'rgba(14,165,233,0.08)', border: '2px dashed rgba(14,165,233,0.35)', color: ACCENT }}>
                <div className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0 ml-3" style={{ background: 'rgba(14,165,233,0.15)' }}>
                  <i className={`${actionLoading ? 'ri-loader-4-line animate-spin' : 'ri-qr-scan-2-line'} text-base`} style={{ color: ACCENT }} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold" style={{ color: ACCENT }}>QR ile Ziyareti Bitir</p>
                  <p className="text-xs" style={{ color: textMuted }}>Aynı firma QR&apos;ını okutun</p>
                </div>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Check-in alanı */
        <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${border}` }}>
          <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${ACCENT}, #38BDF8, transparent)` }} />
          {showQr ? (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <i className="ri-qr-scan-2-line text-sm" style={{ color: ACCENT }} />
                  <p className="text-sm font-bold" style={{ color: textPrimary }}>Firma QR&apos;ı Okut</p>
                </div>
                <button onClick={() => setShowQr(false)} className="w-7 h-7 flex items-center justify-center rounded-xl cursor-pointer" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                  <i className="ri-close-line text-sm" />
                </button>
              </div>
              <QrScanner onResult={handleQrResult} onClose={() => setShowQr(false)} />
            </div>
          ) : (
            <button onClick={() => setShowQr(true)} disabled={actionLoading} className="w-full flex flex-col items-center gap-4 py-10 cursor-pointer transition-all" style={{ background: 'transparent' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(14,165,233,0.03)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
              <div className="relative">
                <div className="absolute w-28 h-28 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, rgba(14,165,233,0.3) 0%, transparent 70%)' }} />
                <div className="w-20 h-20 flex items-center justify-center rounded-2xl relative z-10" style={{ background: 'rgba(14,165,233,0.1)', border: '2px dashed rgba(14,165,233,0.35)' }}>
                  <i className={`${actionLoading ? 'ri-loader-4-line animate-spin' : 'ri-qr-scan-2-line'} text-4xl`} style={{ color: ACCENT }} />
                </div>
              </div>
              <div className="text-center">
                <p className="text-base font-extrabold" style={{ color: ACCENT }}>QR ile Ziyaret Başlat</p>
                <p className="text-xs mt-1" style={{ color: textMuted }}>Firma QR kodunu okutun — anında check-in</p>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)' }}>
                <i className="ri-camera-line text-xs" style={{ color: ACCENT }} />
                <span className="text-xs font-bold" style={{ color: ACCENT }}>Kamerayı Aç</span>
              </div>
            </button>
          )}
        </div>
      )}

      {/* Geçmiş ziyaretler */}
      {gecmis.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${border}` }}>
          <div className="px-4 pt-4 pb-2 flex items-center gap-2">
            <i className="ri-history-line text-xs" style={{ color: ACCENT }} />
            <p className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: textMuted }}>Son Ziyaretler</p>
          </div>
          <div className="px-3 pb-3 space-y-1.5">
            {gecmis.map(z => (
              <div key={z.id} className="flex items-center gap-3 px-3 py-3 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(15,23,42,0.025)', border: `1px solid ${border}` }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)' }}>
                  <i className="ri-building-2-line text-sm" style={{ color: textMuted }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: textPrimary }}>{z.firma_ad ?? '—'}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: textMuted }}>{fmtDate(z.giris_saati)} · {fmtTime(z.giris_saati)}</p>
                </div>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)', color: textMuted }}>
                  <i className="ri-check-line mr-0.5" />Bitti
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── QR Sekmesi ────────────────────────────────────────────────────────────────
const QrTab = memo(function QrTab({ isOnline, onKontrolYapildi, onDurumDegistir }: {
  isOnline: boolean;
  onKontrolYapildi: (id: string) => void;
  onDurumDegistir: (id: string, durum: EkipmanStatus, aciklama?: string, foto?: File | null) => void;
}) {
  const { ekipmanlar, addToast } = useApp();
  const [showQr, setShowQr] = useState(false);
  const [qrFoundEkipman, setQrFoundEkipman] = useState<Ekipman | null>(null);

  const handleQrResult = useCallback((text: string) => {
    setShowQr(false);
    const urlMatch = text.match(/\/equipment\/qr\/([^/?#\s]+)/);
    const moduleMatch = text.match(/[?&]qr=([^&\s]+)/);
    const uuidMatch = text.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    const ekipmanId = urlMatch?.[1] ?? moduleMatch?.[1] ?? (uuidMatch ? text.trim() : null);
    if (ekipmanId) {
      const e = ekipmanlar.find(x => x.id === ekipmanId);
      if (e) { setQrFoundEkipman(e); addToast(`Ekipman: ${e.ad}`, 'success'); return; }
      addToast('QR geçerli ama ekipman kayıtlı değil.', 'warning'); return;
    }
    addToast('QR okundu ama ekipman bulunamadı.', 'warning');
  }, [ekipmanlar, addToast]);

  return (
    <div className="space-y-4">
      {qrFoundEkipman && (
        <div className="rounded-2xl p-4" style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.25)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold" style={{ color: '#34D399' }}>QR ile Bulunan Ekipman</span>
            <button onClick={() => setQrFoundEkipman(null)} className="w-6 h-6 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(255,255,255,0.06)', color: '#64748B' }}>
              <i className="ri-close-line text-xs" />
            </button>
          </div>
          <EkipmanDetayPanel ekipman={qrFoundEkipman} onBack={() => setQrFoundEkipman(null)} onKontrolYapildi={id => { onKontrolYapildi(id); setQrFoundEkipman(null); }} onDurumDegistir={onDurumDegistir} isOnline={isOnline} kontrolBasarili={false} />
        </div>
      )}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
        {showQr ? (
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>QR Kod Tara</p>
              <button onClick={() => setShowQr(false)} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                <i className="ri-close-line text-sm" />
              </button>
            </div>
            <QrScanner onResult={handleQrResult} onClose={() => setShowQr(false)} />
          </div>
        ) : (
          <button onClick={() => setShowQr(true)} className="w-full flex flex-col items-center gap-3 py-10 cursor-pointer transition-all"
            style={{ background: 'transparent' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.04)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
            <div className="w-24 h-24 flex items-center justify-center rounded-2xl" style={{ background: 'rgba(52,211,153,0.08)', border: '2px dashed rgba(52,211,153,0.3)' }}>
              <i className="ri-qr-code-line text-5xl" style={{ color: '#34D399' }} />
            </div>
            <div className="text-center">
              <p className="text-base font-bold" style={{ color: '#34D399' }}>Ekipman QR kodunu okutun</p>
              <p className="text-xs mt-1" style={{ color: '#475569' }}>Kameraya erişim gereklidir</p>
            </div>
          </button>
        )}
      </div>
    </div>
  );
});

// ── Ekipman Sekmesi ───────────────────────────────────────────────────────────
const EkipmanTab = memo(function EkipmanTab({ isOnline, onKontrolYapildi, onDurumDegistir }: {
  isOnline: boolean;
  onKontrolYapildi: (id: string) => void;
  onDurumDegistir: (id: string, durum: EkipmanStatus, aciklama?: string, foto?: File | null) => void;
}) {
  const { ekipmanlar } = useApp();
  const [showEkipmanModal, setShowEkipmanModal] = useState(false);
  const [showFirmaModal, setShowFirmaModal] = useState(false);
  const [selectedFirmaId, setSelectedFirmaId] = useState<string | null>(null);

  const aktif = useMemo(() => ekipmanlar.filter(e => !e.silinmis && !e.cascadeSilindi), [ekipmanlar]);
  const uygunDegil = useMemo(() => aktif.filter(e => e.durum === 'Uygun Değil').length, [aktif]);
  const gecikmis = useMemo(() => aktif.filter(e => e.sonrakiKontrolTarihi && new Date(e.sonrakiKontrolTarihi) < new Date()).length, [aktif]);
  const yaklasan = useMemo(() => aktif.filter(e => { if (!e.sonrakiKontrolTarihi) return false; const d = Math.ceil((new Date(e.sonrakiKontrolTarihi).getTime() - Date.now()) / 86400000); return d >= 0 && d <= 7; }).length, [aktif]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Toplam', val: aktif.length, color: '#818CF8', bg: 'rgba(129,140,248,0.08)', border: 'rgba(129,140,248,0.2)' },
          { label: 'Uygun', val: aktif.filter(e => e.durum === 'Uygun').length, color: '#34D399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.2)' },
          { label: 'Uygun Değil', val: uygunDegil, color: uygunDegil > 0 ? '#F87171' : '#475569', bg: uygunDegil > 0 ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.03)', border: uygunDegil > 0 ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.07)' },
          { label: 'Gecikmiş/Yaklaşan', val: gecikmis + yaklasan, color: gecikmis > 0 ? '#EF4444' : yaklasan > 0 ? '#FBBF24' : '#475569', bg: gecikmis > 0 ? 'rgba(239,68,68,0.08)' : yaklasan > 0 ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.03)', border: gecikmis > 0 ? 'rgba(239,68,68,0.2)' : yaklasan > 0 ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.07)' },
        ].map(s => (
          <div key={s.label} className="px-4 py-3 rounded-2xl" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.val}</p>
            <p className="text-xs mt-1 font-medium" style={{ color: '#475569' }}>{s.label}</p>
          </div>
        ))}
      </div>
      <button onClick={() => setShowEkipmanModal(true)} className="w-full flex items-center gap-3 py-4 rounded-2xl cursor-pointer transition-all" style={{ background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.25)' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(129,140,248,0.18)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(129,140,248,0.1)'; }}>
        <div className="w-10 h-10 flex items-center justify-center rounded-xl ml-3" style={{ background: 'rgba(129,140,248,0.2)' }}>
          <i className="ri-checkbox-circle-line text-xl" style={{ color: '#818CF8' }} />
        </div>
        <div className="text-left">
          <p className="text-sm font-bold" style={{ color: '#818CF8' }}>Ekipman Kontrol Listesi</p>
          <p className="text-xs" style={{ color: '#475569' }}>{aktif.length} ekipman</p>
        </div>
        <i className="ri-arrow-right-s-line text-lg ml-auto mr-3" style={{ color: '#818CF8' }} />
      </button>
      <FirmaOzeti onFirmaEkipmanAc={id => { setSelectedFirmaId(id); setShowFirmaModal(true); }} />
      <EkipmanListeModal open={showEkipmanModal} onClose={() => setShowEkipmanModal(false)} onKontrolYapildi={onKontrolYapildi} onDurumDegistir={onDurumDegistir} isOnline={isOnline} />
      <FirmaEkipmanModal open={showFirmaModal} firmaId={selectedFirmaId} onClose={() => { setShowFirmaModal(false); setSelectedFirmaId(null); }} onKontrolYapildi={onKontrolYapildi} onDurumDegistir={onDurumDegistir} isOnline={isOnline} />
    </div>
  );
});

// ── Uygunsuzluk Sekmesi ───────────────────────────────────────────────────────
const UygunsuzlukTab = memo(function UygunsuzlukTab() {
  const { uygunsuzluklar, firmalar } = useApp();
  const [tab, setTab] = useState<'acik' | 'kapali'>('acik');
  const [detailRecord, setDetailRecord] = useState<Uygunsuzluk | null>(null);
  const [kapatmaRecord, setKapatmaRecord] = useState<Uygunsuzluk | null>(null);
  const [editRecord, setEditRecord] = useState<Uygunsuzluk | null>(null);
  const [showForm, setShowForm] = useState(false);

  const aktif = useMemo(() => uygunsuzluklar.filter(u => !u.silinmis && !u.cascadeSilindi), [uygunsuzluklar]);
  const aciklar = useMemo(() => aktif.filter(u => u.durum !== 'Kapandı').sort((a, b) => (b.olusturmaTarihi ?? '').localeCompare(a.olusturmaTarihi ?? '')), [aktif]);
  const kapalilar = useMemo(() => aktif.filter(u => u.durum === 'Kapandı').sort((a, b) => (b.olusturmaTarihi ?? '').localeCompare(a.olusturmaTarihi ?? '')), [aktif]);
  const liste = tab === 'acik' ? aciklar : kapalilar;

  const fmtDate = (iso?: string) => {
    if (!iso) return '—';
    const d = new Date(iso); if (isNaN(d.getTime())) return '—';
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days === 0) return 'Bugün'; if (days === 1) return 'Dün'; if (days < 7) return `${days}g önce`;
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
  };

  return (
    <>
      <button onClick={() => setShowForm(true)} className="w-full flex items-center gap-3 py-4 rounded-2xl cursor-pointer transition-all mb-4" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.18)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.1)'; }}>
        <div className="w-10 h-10 flex items-center justify-center rounded-xl ml-3" style={{ background: 'rgba(248,113,113,0.2)' }}>
          <i className="ri-add-circle-line text-xl" style={{ color: '#F87171' }} />
        </div>
        <div className="text-left">
          <p className="text-sm font-bold" style={{ color: '#F87171' }}>Yeni Uygunsuzluk</p>
          <p className="text-xs" style={{ color: '#475569' }}>Saha tespitini kaydet</p>
        </div>
        <i className="ri-arrow-right-s-line text-lg ml-auto mr-3" style={{ color: '#F87171' }} />
      </button>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
          <p className="text-xl font-bold" style={{ color: '#F87171' }}>{aciklar.length}</p>
          <p className="text-xs mt-0.5" style={{ color: '#475569' }}>Açık</p>
        </div>
        <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
          <p className="text-xl font-bold" style={{ color: '#34D399' }}>{kapalilar.length}</p>
          <p className="text-xs mt-0.5" style={{ color: '#475569' }}>Kapalı</p>
        </div>
      </div>
      <div className="flex items-center gap-1 px-1 py-1 rounded-full mb-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={() => setTab('acik')} className="flex-1 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-all whitespace-nowrap" style={{ background: tab === 'acik' ? 'rgba(239,68,68,0.2)' : 'transparent', color: tab === 'acik' ? '#F87171' : '#64748B' }}>Açık ({aciklar.length})</button>
        <button onClick={() => setTab('kapali')} className="flex-1 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-all whitespace-nowrap" style={{ background: tab === 'kapali' ? 'rgba(34,197,94,0.2)' : 'transparent', color: tab === 'kapali' ? '#22C55E' : '#64748B' }}>Kapalı ({kapalilar.length})</button>
      </div>
      {liste.length === 0 ? (
        <div className="text-center py-12 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <p className="text-xs font-medium" style={{ color: '#475569' }}>{tab === 'acik' ? 'Açık uygunsuzluk yok' : 'Kapalı uygunsuzluk yok'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {liste.map(u => {
            const firma = firmalar.find(f => f.id === u.firmaId);
            const sc = STATUS_CONFIG[u.durum] ?? { bg: 'rgba(100,116,139,0.1)', color: '#94A3B8', border: 'rgba(100,116,139,0.2)', icon: 'ri-question-line', label: u.durum };
            const sev = SEV_CONFIG[u.severity] ?? { bg: 'rgba(100,116,139,0.1)', color: '#94A3B8' };
            return (
              <button key={u.id} onClick={() => setDetailRecord(u)} className="w-full flex items-start gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all text-left" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}>
                <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 mt-0.5" style={{ background: `${sc.color}18` }}>
                  <i className={`${sc.icon} text-sm`} style={{ color: sc.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  {u.acilisNo && <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md mr-1" style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8' }}>{u.acilisNo}</span>}
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: sev.bg, color: sev.color }}>{u.severity}</span>
                  <p className="text-sm font-semibold truncate mt-1" style={{ color: 'var(--text-primary)' }}>{u.baslik}</p>
                  {firma && <p className="text-xs truncate" style={{ color: '#475569' }}>{firma.ad}</p>}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{sc.label}</span>
                  <span className="text-[10px]" style={{ color: '#334155' }}>{fmtDate(u.olusturmaTarihi ?? u.tarih)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
      <SahaDetayModal record={detailRecord} onClose={() => setDetailRecord(null)} onKapat={r => { setDetailRecord(null); setKapatmaRecord(r); }} onEdit={r => { setDetailRecord(null); setEditRecord(r); setShowForm(true); }} />
      <SahaKapatmaModal record={kapatmaRecord} onClose={() => setKapatmaRecord(null)} />
      <SahaUygunsuzlukForm isOpen={showForm} onClose={() => { setShowForm(false); setEditRecord(null); }} editRecord={editRecord} />
    </>
  );
});

// ── Ana UzmanMobilSaha ────────────────────────────────────────────────────────
interface Props { isDark: boolean; }

export default function UzmanMobilSaha({ isDark }: Props) {
  const { ekipmanlar, updateEkipman, addEkipmanKontrolKaydi, addToast, ekipmanKontrolBildirimi, currentUser, dataLoading, uygunsuzluklar, isIzinleri, org } = useApp();
  const [activeTab, setActiveTab] = useState<SahaTab>('ziyaret');
  const [showPendingModal, setShowPendingModal] = useState(false);

  useEffect(() => { void loadJsQR(); }, []);

  // Global queue context — tek instance, SahaPage ile paylaşılan
  const { isOnline, isSyncing, pendingCount, pendingItems, lastSyncAt, syncError, sessionId, addToQueue, syncNow, forceSyncAll, clearQueue } = useQueue();

  const prevSyncingRef = useRef(false);
  const prevPendingRef = useRef(pendingCount);
  useEffect(() => {
    if (prevSyncingRef.current && !isSyncing && isOnline) {
      const synced = prevPendingRef.current;
      if (synced > 0) {
        if (syncError) {
          addToast(`Bazı işlemler gönderilemedi — ${syncError}`, 'error');
        } else {
          addToast(`${synced} işlem senkronize edildi`, 'success');
        }
      }
    }
    if (!isSyncing) prevPendingRef.current = pendingCount;
    prevSyncingRef.current = isSyncing;
  }, [isSyncing, pendingCount, isOnline, addToast, syncError]);

  const handleKontrolYapildi = useCallback(async (ekipmanId: string) => {
    const ekipman = ekipmanlar.find(e => e.id === ekipmanId);
    if (!ekipman || !org?.id) return;
    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const sonraki = new Date(); sonraki.setMonth(sonraki.getMonth() + 1);
    const sonrakiStr = sonraki.toISOString().split('T')[0];
    const gecikmisDi = ekipman.sonrakiKontrolTarihi ? new Date(ekipman.sonrakiKontrolTarihi) < new Date() : false;

    const yeniKayitId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const yeniKayit = {
      id:            yeniKayitId,
      tarih:         now,
      kontrolEden:   currentUser?.ad || 'Uzman',
      kontrolEdenId: currentUser?.id || '',
      durum:         'Uygun' as const,
      kaynak:        'qr' as const,
    };

    addEkipmanKontrolKaydi(ekipmanId, yeniKayit);
    updateEkipman(ekipmanId, { sonrakiKontrolTarihi: sonrakiStr });
    ekipmanKontrolBildirimi(ekipman.ad, ekipmanId, 'Uygun', gecikmisDi);

    await addToQueue({
      type:  'ekipman_kontrol',
      label: `${ekipman.ad} — Kontrol kaydı`,
      payload: {
        ekipmanId,
        organizationId:       org.id,
        sonKontrolTarihi:     today,
        sonrakiKontrolTarihi: sonrakiStr,
        durum:                'Uygun',
        yeniKayit,
      } as unknown as Record<string, unknown>,
    });

    if (!isOnline) {
      addToast('Kontrol kaydedildi (çevrimdışı) — bağlantı gelince sunucuya gönderilecek.', 'success');
    } else {
      void syncNow();
      addToast('Kontrol başarıyla kaydedildi — durum "Uygun" olarak güncellendi.', 'success');
    }
  }, [ekipmanlar, updateEkipman, addEkipmanKontrolKaydi, currentUser, ekipmanKontrolBildirimi, isOnline, addToQueue, syncNow, addToast, org]);

  const handleDurumDegistir = useCallback(async (ekipmanId: string, yeniDurum: EkipmanStatus, aciklama?: string, foto?: File | null) => {
    const ekipman = ekipmanlar.find(e => e.id === ekipmanId);
    if (!ekipman || ekipman.durum === yeniDurum || !org?.id) return;
    const now = new Date().toISOString();
    const orgId = org.id;
    let fotoUrl: string | undefined;
    if (foto) {
      try { const u = await uploadFileToStorage(foto, orgId, 'ekipman-kontrol', `${ekipmanId}-${Date.now()}`); if (u) fotoUrl = u; } catch { /* ignore */ }
    }

    const yeniKayitId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const yeniKayit = {
      id:            yeniKayitId,
      tarih:         now,
      kontrolEden:   currentUser?.ad || 'Uzman',
      kontrolEdenId: currentUser?.id || '',
      durum:         yeniDurum,
      notlar:        aciklama || undefined,
      fotoUrl,
      kaynak:        'qr' as const,
    };

    addEkipmanKontrolKaydi(ekipmanId, yeniKayit);

    await addToQueue({
      type:  'ekipman_durum',
      label: `${ekipman.ad} — Durum: ${yeniDurum}`,
      payload: {
        ekipmanId,
        organizationId: orgId,
        durum:          yeniDurum,
        yeniKayit,
      } as unknown as Record<string, unknown>,
    });

    if (!isOnline) {
      addToast(`İşlem kaydedildi (çevrimdışı) — bağlantı gelince sunucuya gönderilecek.`, 'success');
    } else {
      void syncNow();
      addToast(`İşlem başarıyla kaydedildi — durum "${yeniDurum}" olarak güncellendi.`, 'success');
    }
  }, [ekipmanlar, addEkipmanKontrolKaydi, currentUser, org, isOnline, addToQueue, syncNow, addToast]);

  const { uygunsuzlukBadge, izinBadge, ekipmanBadge } = useMemo(() => ({
    uygunsuzlukBadge: uygunsuzluklar.filter(u => !u.silinmis && !u.cascadeSilindi && u.durum !== 'Kapandı').length,
    izinBadge: isIzinleri.filter(i => !i.silinmis && i.durum === 'Onay Bekliyor').length,
    ekipmanBadge: ekipmanlar.filter(e => !e.silinmis && !e.cascadeSilindi && (e.durum === 'Uygun Değil' || (e.sonrakiKontrolTarihi && new Date(e.sonrakiKontrolTarihi) < new Date()))).length,
  }), [ekipmanlar, uygunsuzluklar, isIzinleri]);

  void dataLoading;

  return (
    <div className="flex flex-col pb-8 px-3 sm:px-5" style={{ maxWidth: '640px', margin: '0 auto', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="rounded-2xl overflow-hidden mb-4" style={{ background: 'var(--bg-card-solid, rgba(17,24,39,0.8))', border: '1px solid rgba(14,165,233,0.2)' }}>
        <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #0284C7, #0EA5E9, #38BDF8)' }} />
        <div className="px-4 pt-3.5 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.25)' }}>
                <i className="ri-map-pin-user-line text-lg" style={{ color: ACCENT }} />
              </div>
              <div>
                <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary, #f1f5f9)', letterSpacing: '-0.02em' }}>Mobil Saha</h2>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted, #64748b)' }}>Gezici uzman saha işlemleri</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {pendingCount > 0 && (
                <button onClick={() => setShowPendingModal(true)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-pointer" style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', color: '#FBBF24' }}>
                  <i className="ri-time-line text-xs" />
                  <span className="text-xs font-bold">{pendingCount}</span>
                </button>
              )}
              <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-full whitespace-nowrap" style={{ background: 'rgba(14,165,233,0.1)', color: ACCENT, border: '1px solid rgba(14,165,233,0.2)' }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: ACCENT }} />
                {isOnline ? 'Aktif' : 'Çevrimdışı'}
              </span>
            </div>
          </div>
          {/* İstatistik satırı */}
          <div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {[
              { icon: 'ri-error-warning-line', val: uygunsuzlukBadge, label: 'açık', color: uygunsuzlukBadge > 0 ? '#F87171' : '#334155' },
              { icon: 'ri-tools-line', val: ekipmanBadge, label: 'ekipman', color: ekipmanBadge > 0 ? '#FBBF24' : '#334155' },
              { icon: 'ri-shield-keyhole-line', val: izinBadge, label: 'izin', color: izinBadge > 0 ? '#F59E0B' : '#334155' },
            ].map((s, i) => (
              <>
                {i > 0 && <div key={`d${i}`} className="w-px h-3" style={{ background: 'rgba(255,255,255,0.08)' }} />}
                <div key={s.label} className="flex items-center gap-1.5">
                  <i className={`${s.icon} text-xs`} style={{ color: s.color }} />
                  <span className="text-[11px] font-semibold" style={{ color: s.color }}>{s.val} {s.label}</span>
                </div>
              </>
            ))}
          </div>
        </div>
      </div>

      {/* Offline bant */}
      <div className="mb-4">
        <OfflineBand isOnline={isOnline} isSyncing={isSyncing} pendingCount={pendingCount} lastSyncAt={lastSyncAt} syncError={syncError} onSyncNow={() => void syncNow()} onForceSyncAll={() => void forceSyncAll()} onShowDetails={() => setShowPendingModal(true)} />
      </div>

      {/* Sekme navigasyonu */}
      <div className="flex items-center gap-0.5 mb-5 p-1 rounded-2xl overflow-x-auto" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', scrollbarWidth: 'none' }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          const badge = tab.id === 'ekipman' ? ekipmanBadge : tab.id === 'izin' ? izinBadge : tab.id === 'uygunsuzluk' ? uygunsuzlukBadge : 0;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="relative flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl cursor-pointer transition-all duration-200 whitespace-nowrap flex-1 min-w-0"
              style={{ background: isActive ? 'rgba(14,165,233,0.15)' : 'transparent', border: isActive ? '1px solid rgba(14,165,233,0.38)' : '1px solid transparent' }}>
              {badge > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: '#EF4444', zIndex: 1 }}>
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
              <div className="w-5 h-5 flex items-center justify-center">
                <i className={`${tab.icon} text-sm`} style={{ color: isActive ? ACCENT : '#475569' }} />
              </div>
              <span className="text-[10px] font-bold leading-none" style={{ color: isActive ? ACCENT : '#475569' }}>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Sekme içerikleri */}
      <div className="flex-1">
        {activeTab === 'ziyaret' && <ZiyaretTab isDark={isDark} />}
        {activeTab === 'qr' && <QrTab isOnline={isOnline} onKontrolYapildi={handleKontrolYapildi} onDurumDegistir={handleDurumDegistir} />}
        {activeTab === 'ekipman' && <EkipmanTab isOnline={isOnline} onKontrolYapildi={handleKontrolYapildi} onDurumDegistir={handleDurumDegistir} />}
        {activeTab === 'izin' && (
          <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <IsIzniSahaBolumu />
          </div>
        )}
        {activeTab === 'uygunsuzluk' && <UygunsuzlukTab />}
      </div>

      <PendingModal open={showPendingModal} onClose={() => setShowPendingModal(false)} items={pendingItems} isOnline={isOnline} isSyncing={isSyncing} onSyncNow={() => void syncNow()} onForceSyncAll={() => void forceSyncAll()} onClear={() => void clearQueue()} onShowHistory={() => setShowPendingModal(false)} onShowInspector={() => setShowPendingModal(false)} sessionId={sessionId} />
    </div>
  );
}
