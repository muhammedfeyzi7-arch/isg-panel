import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/AuthContext';
import { useApp } from '@/store/AppContext';
import QrScanner from '@/pages/saha/components/QrScanner';

const ACCENT = '#0EA5E9';
const ACCENT_DARK = '#0284C7';

interface AktifZiyaret {
  id: string;
  firma_org_id: string;
  firma_ad: string | null;
  giris_saati: string;
  qr_ile_giris: boolean;
}

interface GpsCoords { lat: number; lng: number; }

interface FirmaGpsInfo {
  name: string;
  gps_required: boolean;
  gps_radius: number;
  gps_strict: boolean;
  firma_lat: number | null;
  firma_lng: number | null;
}

interface Props {
  isDark: boolean;
}

function getGpsCoords(): Promise<GpsCoords | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 10000, maximumAge: 30000, enableHighAccuracy: true }
    );
  });
}

function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type GpsStatusType = 'idle' | 'loading' | 'checking' | 'ok' | 'denied' | 'blocked';

export default function HekimMobilZiyaret({ isDark }: Props) {
  const { user } = useAuth();
  const { org, addToast } = useApp();

  const [aktifZiyaret, setAktifZiyaret] = useState<AktifZiyaret | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [gecmis, setGecmis] = useState<AktifZiyaret[]>([]);
  const [elapsed, setElapsed] = useState('');
  const [gpsStatus, setGpsStatus] = useState<GpsStatusType>('idle');
  const [gpsError, setGpsError] = useState<string | null>(null);

  const [osgbOrgId, setOsgbOrgId] = useState<string | null>(null);
  const [hekimAd, setHekimAd] = useState<string>('');

  const bg = isDark ? '#0a0f1a' : '#f0f9ff';
  const cardBg = isDark ? 'rgba(17,24,39,0.85)' : '#ffffff';
  const border = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = isDark ? '#64748b' : '#64748b';

  // Elapsed timer
  useEffect(() => {
    if (!aktifZiyaret) { setElapsed(''); return; }
    const update = () => {
      const diff = Date.now() - new Date(aktifZiyaret.giris_saati).getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(`${h > 0 ? h + 's ' : ''}${String(m).padStart(2, '0')}d ${String(s).padStart(2, '0')}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [aktifZiyaret]);

  const fetchOrgInfo = useCallback(async () => {
    if (!user?.id) return;
    // org zaten context'ten gelebilir
    if (org?.id) {
      setOsgbOrgId(org.id);
      setHekimAd(user.user_metadata?.display_name ?? user.email ?? 'Hekim');
      return;
    }
    const { data: uoData } = await supabase
      .from('user_organizations')
      .select('organization_id, display_name')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();
    if (uoData) {
      setOsgbOrgId(uoData.organization_id);
      setHekimAd(uoData.display_name ?? user.email ?? 'Hekim');
    }
  }, [user?.id, user?.email, user?.user_metadata, org?.id]);

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
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void fetchZiyaret();
    void fetchOrgInfo();
  }, [fetchZiyaret, fetchOrgInfo]);

  // ── CHECK-IN (GPS kontrollü) ──
  const handleCheckIn = useCallback(async (firmaId: string, qr = false) => {
    if (!user?.id) { addToast('Oturum bulunamadı.', 'error'); return; }

    let resolvedOsgbOrgId = osgbOrgId;
    let resolvedHekimAd = hekimAd;

    if (!resolvedOsgbOrgId) {
      const { data: uoData } = await supabase
        .from('user_organizations')
        .select('organization_id, display_name')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      if (!uoData) { addToast('Organizasyon bilgisi bulunamadı.', 'error'); return; }
      resolvedOsgbOrgId = uoData.organization_id;
      resolvedHekimAd = uoData.display_name ?? user.email ?? 'Hekim';
    }

    setActionLoading(true);
    setGpsError(null);

    // Firma GPS bilgisini çek
    const { data: firmaData } = await supabase
      .from('organizations')
      .select('name, gps_required, gps_radius, gps_strict, firma_lat, firma_lng')
      .eq('id', firmaId)
      .maybeSingle() as { data: FirmaGpsInfo | null };

    if (!firmaData) {
      addToast('Firma bulunamadı. QR geçersiz olabilir.', 'error');
      setActionLoading(false);
      return;
    }

    // Aktif ziyaret çakışma kontrolü
    const { data: existing } = await supabase
      .from('osgb_ziyaretler')
      .select('id, firma_ad')
      .eq('uzman_user_id', user.id)
      .eq('durum', 'aktif')
      .maybeSingle();

    if (existing) {
      addToast(`Zaten aktif bir ziyaretiniz var: ${existing.firma_ad ?? 'Firma'}. Önce mevcut ziyareti bitirin.`, 'error');
      setActionLoading(false);
      return;
    }

    // GPS kontrolü
    let coords: GpsCoords | null = null;
    let checkInGpsStatus: 'ok' | 'too_far' | 'no_permission' = 'ok';
    let checkInDistanceM: number | null = null;

    if (firmaData.gps_required) {
      setGpsStatus('loading');
      coords = await getGpsCoords();

      if (!coords) {
        checkInGpsStatus = 'no_permission';
        const strict = firmaData.gps_strict !== false;
        if (strict) {
          setGpsStatus('denied');
          setGpsError('Konum izni gerekli. Tarayıcı ayarlarından konum iznini etkinleştirin ve tekrar deneyin.');
          setActionLoading(false);
          return;
        }
        setGpsStatus('denied');
      }

      if (coords && firmaData.firma_lat !== null && firmaData.firma_lng !== null) {
        setGpsStatus('checking');
        const distance = haversineMetres(coords.lat, coords.lng, firmaData.firma_lat, firmaData.firma_lng);
        const radius = firmaData.gps_radius ?? 1000;

        if (distance > radius) {
          checkInGpsStatus = 'too_far';
          checkInDistanceM = Math.round(distance);
          const distStr = distance >= 1000
            ? `${(distance / 1000).toFixed(1)} km`
            : `${Math.round(distance)} m`;
          setGpsStatus('blocked');
          setGpsError(`Firma konumunda değilsiniz. Mesafeniz: ${distStr} — İzin verilen: ${radius} m`);
          setActionLoading(false);
          return;
        }
        checkInDistanceM = Math.round(distance);
        checkInGpsStatus = 'ok';
        setGpsStatus('ok');
      } else if (!coords) {
        checkInGpsStatus = 'no_permission';
      } else {
        checkInGpsStatus = 'ok';
        setGpsStatus('ok');
      }
    } else {
      setGpsStatus('loading');
      coords = await getGpsCoords();
      if (coords) {
        checkInGpsStatus = 'ok';
        setGpsStatus('ok');
      } else {
        checkInGpsStatus = 'no_permission';
        setGpsStatus('idle');
      }
    }

    try {
      const now = new Date().toISOString();
      const { data: yeniZiyaret, error } = await supabase
        .from('osgb_ziyaretler')
        .insert({
          osgb_org_id: resolvedOsgbOrgId,
          firma_org_id: firmaId,
          firma_ad: firmaData.name,
          uzman_user_id: user.id,
          uzman_ad: resolvedHekimAd || user.email || 'Hekim',
          uzman_email: user.email,
          giris_saati: now,
          durum: 'aktif',
          qr_ile_giris: qr,
          created_at: now,
          updated_at: now,
          check_in_lat: coords?.lat ?? null,
          check_in_lng: coords?.lng ?? null,
          gps_status: checkInGpsStatus,
          check_in_distance_m: checkInDistanceM,
        })
        .select('id, firma_org_id, firma_ad, giris_saati, qr_ile_giris')
        .maybeSingle();

      if (error) throw error;
      setAktifZiyaret(yeniZiyaret ?? null);
      addToast(`${firmaData.name} ziyareti başlatıldı!`, 'success');
    } catch (err) {
      addToast(`Check-in yapılamadı: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setActionLoading(false);
      if (gpsStatus !== 'blocked' && gpsStatus !== 'denied') {
        setTimeout(() => { setGpsStatus('idle'); setGpsError(null); }, 3000);
      }
    }
  }, [user, osgbOrgId, hekimAd, addToast, gpsStatus]);

  // ── CHECK-OUT ──
  const handleCheckOut = useCallback(async () => {
    if (!aktifZiyaret || !user?.id) return;
    setActionLoading(true);
    setGpsError(null);
    setGpsStatus('loading');

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
        .eq('uzman_user_id', user.id);

      if (error) throw new Error(error.message || 'Güncelleme başarısız');

      addToast(`Ziyaret tamamlandı! Süre: ${sureDakika} dakika`, 'success');
      setAktifZiyaret(null);
      setShowQr(false);
      void fetchZiyaret();
    } catch (err) {
      addToast(`Check-out yapılamadı: ${err instanceof Error ? err.message : String(err)}`, 'error');
      void fetchZiyaret();
    } finally {
      setActionLoading(false);
      setTimeout(() => { setGpsStatus('idle'); setGpsError(null); }, 3000);
    }
  }, [aktifZiyaret, user?.id, addToast, fetchZiyaret]);

  // QR sonucu
  const handleQrResult = useCallback((text: string) => {
    setShowQr(false);
    setGpsError(null);
    setGpsStatus('idle');
    let firmaId: string | null = null;

    try {
      const parsed = JSON.parse(text) as { type?: string; id?: string };
      if (parsed.type === 'firm' && parsed.id) firmaId = parsed.id;
    } catch { /* not JSON */ }

    if (!firmaId) {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text.trim())) firmaId = text.trim();
    }
    if (!firmaId) firmaId = text.match(/firma[_-]?id=([0-9a-f-]{36})/i)?.[1] ?? null;
    if (!firmaId) {
      const segs = text.replace(/[?#].*/, '').split('/').filter(Boolean);
      const last = segs[segs.length - 1] ?? '';
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(last)) firmaId = last;
    }

    if (!firmaId) { addToast('Geçersiz QR kodu.', 'error'); return; }

    // aktifZiyaret state'ini doğrudan okumak yerine DB'den kontrol et
    const resolvedFirmaId = firmaId;
    void (async () => {
      if (!user?.id) return;
      const { data: aktif } = await supabase
        .from('osgb_ziyaretler')
        .select('id, firma_org_id, firma_ad, giris_saati, qr_ile_giris')
        .eq('uzman_user_id', user.id)
        .eq('durum', 'aktif')
        .maybeSingle();

      if (aktif) {
        if (aktif.firma_org_id === resolvedFirmaId) {
          // Checkout yap — state'i güncelle
          setAktifZiyaret(aktif as AktifZiyaret);
          // Kısa gecikme ile checkout çağır
          setTimeout(() => void handleCheckOut(), 100);
        } else {
          addToast(`Başka firmada aktif ziyaret var (${aktif.firma_ad ?? 'Firma'}). Önce bitirin.`, 'error');
        }
      } else {
        void handleCheckIn(resolvedFirmaId, true);
      }
    })();
  }, [user?.id, handleCheckIn, handleCheckOut, addToast]);

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Bugün';
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Dün';
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
  };

  // GPS durum bandı
  type BandConfig = { bg: string; border: string; color: string; icon: string; text: string } | null;
  const gpsBandConfig: Record<GpsStatusType, BandConfig> = {
    idle: null,
    loading: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', color: '#D97706', icon: 'ri-loader-4-line animate-spin', text: 'Konum alınıyor...' },
    checking: { bg: 'rgba(14,165,233,0.08)', border: 'rgba(14,165,233,0.2)', color: '#0284C7', icon: 'ri-map-pin-2-line', text: 'Konum kontrol ediliyor...' },
    ok: { bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)', color: '#16A34A', icon: 'ri-map-pin-2-fill', text: 'Konum doğrulandı' },
    denied: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', color: '#D97706', icon: 'ri-map-pin-line', text: gpsError ? 'Konum izni gerekli — check-in engellendi' : 'Konum alınamadı' },
    blocked: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', color: '#DC2626', icon: 'ri-map-pin-line', text: 'Firma konumunda değilsiniz' },
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4" style={{ background: bg, minHeight: '100vh' }}>
        <div className="w-12 h-12 flex items-center justify-center rounded-2xl"
          style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)' }}>
          <i className="ri-loader-4-line text-xl animate-spin" style={{ color: ACCENT }} />
        </div>
        <p className="text-sm font-semibold" style={{ color: textMuted }}>Yükleniyor...</p>
      </div>
    );
  }

  const band = gpsBandConfig[gpsStatus];

  return (
    <div className="min-h-screen pb-24" style={{ background: bg }}>
      <style>{`
        @keyframes pulseRing {
          0% { transform: scale(1); opacity: 0.8; }
          70% { transform: scale(1.8); opacity: 0; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes timerGlow {
          0%, 100% { text-shadow: 0 0 12px rgba(14,165,233,0.3); }
          50% { text-shadow: 0 0 24px rgba(14,165,233,0.7); }
        }
        .hekim-timer-glow { animation: timerGlow 2s ease-in-out infinite; }
      `}</style>

      {/* ── HERO HEADER ── */}
      <div
        className="relative overflow-hidden px-5 pt-8 pb-6"
        style={{
          background: isDark
            ? 'linear-gradient(160deg, #0c1929 0%, #0a1520 60%, #080f1a 100%)'
            : 'linear-gradient(160deg, #e0f2fe 0%, #f0f9ff 60%, #f8fafc 100%)',
          borderBottom: `1px solid ${border}`,
        }}
      >
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(14,165,233,0.08) 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
        <div className="absolute top-0 left-0 right-0 h-[3px]"
          style={{ background: `linear-gradient(90deg, ${ACCENT_DARK}, #38BDF8, ${ACCENT})` }} />

        <div className="relative z-10 flex items-start gap-4">
          <div className="relative flex-shrink-0">
            <div className="w-14 h-14 flex items-center justify-center rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, rgba(14,165,233,0.2), rgba(14,165,233,0.08))',
                border: '1.5px solid rgba(14,165,233,0.3)',
              }}>
              <i className="ri-heart-pulse-line text-2xl" style={{ color: ACCENT }} />
            </div>
            {aktifZiyaret && (
              <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full"
                style={{ background: ACCENT, boxShadow: '0 0 8px rgba(14,165,233,0.6)' }}>
                <i className="ri-check-line text-white text-[9px] font-bold" />
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-extrabold leading-tight" style={{ color: textPrimary, letterSpacing: '-0.03em' }}>
                Saha Ziyareti
              </h1>
              {aktifZiyaret ? (
                <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-full whitespace-nowrap"
                  style={{ background: 'rgba(14,165,233,0.15)', color: ACCENT, border: '1px solid rgba(14,165,233,0.3)' }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: ACCENT }} />
                  AKTİF
                </span>
              ) : (
                <span className="text-[9px] font-bold px-2 py-1 rounded-full whitespace-nowrap"
                  style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)', color: textMuted, border: `1px solid ${border}` }}>
                  BEKLİYOR
                </span>
              )}
            </div>
            <p className="text-xs leading-relaxed" style={{ color: textMuted }}>
              QR okutarak firma check-in / check-out yap
            </p>
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="px-4 pt-5 space-y-4">

        {/* GPS Durum Bandı */}
        {band && (
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${band.border}` }}>
            <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: band.bg }}>
              <i className={`${band.icon} text-sm flex-shrink-0`} style={{ color: band.color }} />
              <span className="text-xs font-semibold flex-1" style={{ color: band.color }}>{band.text}</span>
              {(gpsStatus === 'blocked' || gpsStatus === 'denied') && (
                <button onClick={() => { setGpsStatus('idle'); setGpsError(null); }}
                  className="w-5 h-5 flex items-center justify-center rounded cursor-pointer flex-shrink-0"
                  style={{ color: band.color, opacity: 0.7 }}>
                  <i className="ri-close-line text-xs" />
                </button>
              )}
            </div>
            {gpsError && gpsStatus === 'blocked' && (
              <div className="px-3 pb-3 pt-1" style={{ background: band.bg }}>
                <p className="text-[11px] leading-relaxed" style={{ color: '#64748B' }}>{gpsError}</p>
                <div className="flex items-center gap-1.5 mt-2 text-[10px] font-semibold" style={{ color: '#DC2626' }}>
                  <i className="ri-error-warning-line" />
                  Check-in engellendi — fiziksel olarak firmada olmanız gerekiyor
                </div>
              </div>
            )}
            {gpsError && gpsStatus === 'denied' && (
              <div className="px-3 pb-3 pt-1" style={{ background: band.bg }}>
                <p className="text-[11px] leading-relaxed" style={{ color: '#64748B' }}>{gpsError}</p>
              </div>
            )}
          </div>
        )}

        {/* ── AKTİF ZİYARET ── */}
        {aktifZiyaret ? (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: cardBg, border: '1.5px solid rgba(14,165,233,0.3)' }}
          >
            <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${ACCENT_DARK}, #38BDF8, ${ACCENT})` }} />
            <div className="p-5">
              {/* Status badge */}
              <div className="flex items-center gap-2 mb-5">
                <div className="relative flex-shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: ACCENT }} />
                  <div className="absolute inset-0 rounded-full" style={{ background: ACCENT, animation: 'pulseRing 2s ease-out infinite' }} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: ACCENT }}>
                  Aktif Ziyaret
                </span>
                {aktifZiyaret.qr_ile_giris && (
                  <span className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                    style={{ background: 'rgba(14,165,233,0.1)', color: ACCENT, border: '1px solid rgba(14,165,233,0.2)' }}>
                    <i className="ri-qr-code-line mr-0.5" />QR Girişi
                  </span>
                )}
              </div>

              {/* Firma info */}
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.2), rgba(14,165,233,0.06))', border: '1px solid rgba(14,165,233,0.25)' }}>
                  <i className="ri-building-2-line text-2xl" style={{ color: ACCENT }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-extrabold leading-tight truncate" style={{ color: textPrimary, letterSpacing: '-0.02em' }}>
                    {aktifZiyaret.firma_ad ?? 'Bilinmeyen Firma'}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <i className="ri-time-line text-xs" style={{ color: textMuted }} />
                    <p className="text-xs" style={{ color: textMuted }}>Giriş: {formatTime(aktifZiyaret.giris_saati)}</p>
                  </div>
                </div>
              </div>

              {/* Timer */}
              <div className="flex items-center justify-center py-5 rounded-2xl mb-5"
                style={{ background: isDark ? 'rgba(14,165,233,0.06)' : 'rgba(14,165,233,0.05)', border: '1px solid rgba(14,165,233,0.15)' }}>
                <div className="text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: 'rgba(14,165,233,0.6)' }}>
                    Geçen Süre
                  </p>
                  <p className="text-4xl font-black font-mono hekim-timer-glow" style={{ color: ACCENT, letterSpacing: '0.04em' }}>
                    {elapsed || '00d 00s'}
                  </p>
                </div>
              </div>

              {/* QR ile bitir */}
              {showQr ? (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(14,165,233,0.2)' }}>
                  <div className="flex items-center justify-between px-4 pt-3 pb-2">
                    <p className="text-sm font-semibold" style={{ color: textPrimary }}>Aynı Firma QR&apos;ını Okut</p>
                    <button onClick={() => setShowQr(false)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer"
                      style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                      <i className="ri-close-line text-sm" />
                    </button>
                  </div>
                  <QrScanner onResult={handleQrResult} onClose={() => setShowQr(false)} />
                  <p className="text-center text-xs py-2" style={{ color: textMuted }}>
                    Aynı firmayı okutunca ziyaret otomatik biter
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => setShowQr(true)}
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl cursor-pointer transition-all mb-3"
                  style={{ background: 'rgba(14,165,233,0.08)', border: '2px dashed rgba(14,165,233,0.35)', color: ACCENT }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.14)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.08)'; }}>
                  <div className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: 'rgba(14,165,233,0.15)' }}>
                    {actionLoading
                      ? <i className="ri-loader-4-line animate-spin text-base" style={{ color: ACCENT }} />
                      : <i className="ri-qr-scan-2-line text-base" style={{ color: ACCENT }} />}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold" style={{ color: ACCENT }}>QR ile Ziyareti Bitir</p>
                    <p className="text-xs" style={{ color: textMuted }}>Aynı firma QR kodunu okutun</p>
                  </div>
                </button>
              )}

              {/* Sadece QR ile bitirme — manuel buton yok */}
              {!showQr && !actionLoading && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(14,165,233,0.04)', border: '1px dashed rgba(14,165,233,0.2)' }}>
                  <i className="ri-information-line text-xs flex-shrink-0 mt-0.5" style={{ color: ACCENT }} />
                  <p className="text-[10px] leading-relaxed" style={{ color: '#64748B' }}>
                    Ziyareti bitirmek için aynı firmanın QR kodunu tekrar okutun.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── CHECK-IN ALANI ── */
          <div className="space-y-3">
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: cardBg, border: `1px solid ${border}` }}
            >
              <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${ACCENT}, #38BDF8, transparent)` }} />

              {showQr ? (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 flex items-center justify-center rounded-lg" style={{ background: 'rgba(14,165,233,0.1)' }}>
                        <i className="ri-qr-scan-2-line text-xs" style={{ color: ACCENT }} />
                      </div>
                      <p className="text-sm font-bold" style={{ color: textPrimary }}>Firma QR&apos;ı Okut</p>
                    </div>
                    <button
                      onClick={() => setShowQr(false)}
                      className="w-7 h-7 flex items-center justify-center rounded-xl cursor-pointer"
                      style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <i className="ri-close-line text-sm" />
                    </button>
                  </div>
                  <QrScanner onResult={handleQrResult} onClose={() => setShowQr(false)} />
                  <p className="text-center text-xs mt-3 leading-relaxed" style={{ color: textMuted }}>
                    Firma QR kodunu çerçeve içine getirin — otomatik check-in
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => setShowQr(true)}
                  disabled={actionLoading}
                  className="w-full flex flex-col items-center justify-center gap-4 py-10 cursor-pointer transition-all"
                  style={{ background: 'transparent', opacity: actionLoading ? 0.6 : 1 }}
                  onMouseEnter={e => { if (!actionLoading) (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.03)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <div className="relative flex items-center justify-center">
                    <div className="absolute w-28 h-28 rounded-full opacity-20"
                      style={{ background: 'radial-gradient(circle, rgba(14,165,233,0.3) 0%, transparent 70%)' }} />
                    <div className="w-20 h-20 flex items-center justify-center rounded-2xl relative z-10"
                      style={{
                        background: 'linear-gradient(135deg, rgba(14,165,233,0.16), rgba(14,165,233,0.05))',
                        border: '2px dashed rgba(14,165,233,0.35)',
                      }}>
                      {actionLoading
                        ? <i className="ri-loader-4-line text-4xl animate-spin" style={{ color: ACCENT }} />
                        : <i className="ri-qr-scan-2-line text-4xl" style={{ color: ACCENT }} />}
                    </div>
                  </div>
                  <div className="text-center px-4">
                    <p className="text-base font-extrabold" style={{ color: ACCENT, letterSpacing: '-0.02em' }}>
                      {actionLoading ? 'İşleniyor...' : 'QR ile Ziyaret Başlat'}
                    </p>
                    <p className="text-xs mt-1.5 leading-relaxed" style={{ color: textMuted }}>
                      {actionLoading ? 'Konum ve firma bilgileri kontrol ediliyor' : 'Firma QR kodunu okutun — anında check-in yapılır'}
                    </p>
                  </div>
                  {!actionLoading && (
                    <div
                      className="flex items-center gap-2 px-4 py-2 rounded-full"
                      style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)' }}
                    >
                      <i className="ri-camera-line text-xs" style={{ color: ACCENT }} />
                      <span className="text-xs font-bold" style={{ color: ACCENT }}>Kamerayı Aç</span>
                    </div>
                  )}
                </button>
              )}
            </div>

            {!showQr && !actionLoading && (
              <div
                className="rounded-2xl p-4"
                style={{ background: isDark ? 'rgba(14,165,233,0.05)' : 'rgba(14,165,233,0.04)', border: '1px dashed rgba(14,165,233,0.25)' }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: 'rgba(14,165,233,0.1)' }}>
                    <i className="ri-qr-scan-2-line text-base" style={{ color: ACCENT }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: textPrimary }}>QR kod okutarak ziyaret başlatın</p>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: textMuted }}>
                      Firmanın QR kodunu tarat — sistem otomatik check-in ve check-out yapar. Aynı QR&apos;ı ikinci kez okutunca ziyaret biter.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── GEÇMİŞ ZİYARETLER ── */}
        {gecmis.length > 0 && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: cardBg, border: `1px solid ${border}` }}
          >
            <div className="px-4 pt-4 pb-2 flex items-center gap-2">
              <div className="w-6 h-6 flex items-center justify-center rounded-lg" style={{ background: 'rgba(14,165,233,0.1)' }}>
                <i className="ri-history-line text-xs" style={{ color: ACCENT }} />
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: textMuted }}>
                Son Ziyaretler
              </p>
            </div>
            <div className="px-3 pb-3 space-y-1.5">
              {gecmis.map(z => (
                <div key={z.id}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl"
                  style={{ background: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(15,23,42,0.025)', border: `1px solid ${border}` }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)' }}>
                    <i className="ri-building-2-line text-sm" style={{ color: textMuted }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: textPrimary }}>
                      {z.firma_ad ?? '—'}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: textMuted }}>
                      {formatDate(z.giris_saati)} · {formatTime(z.giris_saati)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {z.qr_ile_giris && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(14,165,233,0.1)', color: ACCENT, border: '1px solid rgba(14,165,233,0.2)' }}>QR</span>
                    )}
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)', color: textMuted }}>
                      <i className="ri-check-line mr-0.5" />Bitti
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
