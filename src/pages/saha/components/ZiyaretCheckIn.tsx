import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/AuthContext';
import { useApp } from '@/store/AppContext';
import QrScanner from './QrScanner';

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

/** GPS konumu alır. Hata/izin yoksa null döner */
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

/** Haversine formülü — metre cinsinden mesafe */
function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Dünya yarıçapı (metre)
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

export default function ZiyaretCheckIn() {
  const { user } = useAuth();
  const { addToast } = useApp();

  const [aktifZiyaret, setAktifZiyaret] = useState<AktifZiyaret | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [gecmis, setGecmis] = useState<AktifZiyaret[]>([]);
  const [elapsed, setElapsed] = useState('');
  const [gpsStatus, setGpsStatus] = useState<GpsStatusType>('idle');
  const [gpsError, setGpsError] = useState<string | null>(null);

  const [osgbOrgId, setOsgbOrgId] = useState<string | null>(null);
  const [uzmanAd, setUzmanAd] = useState<string>('');

  // Süre sayacı
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

  const fetchAtanmisFirmalar = useCallback(async () => {
    if (!user?.id) return;
    const { data: uoData } = await supabase
      .from('user_organizations')
      .select('organization_id, display_name')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();
    if (uoData) {
      setOsgbOrgId(uoData.organization_id);
      setUzmanAd(uoData.display_name ?? user.email ?? 'Uzman');
    }
  }, [user?.id, user?.email]);

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
    void fetchAtanmisFirmalar();
  }, [fetchZiyaret, fetchAtanmisFirmalar]);

  // ── CHECK-IN ──
  const handleCheckIn = useCallback(async (firmaId: string, qr = false) => {
    if (!user?.id) { addToast('Oturum bulunamadı.', 'error'); return; }

    let resolvedOsgbOrgId = osgbOrgId;
    let resolvedUzmanAd = uzmanAd;

    if (!resolvedOsgbOrgId) {
      const { data: uoData } = await supabase
        .from('user_organizations')
        .select('organization_id, display_name')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      if (!uoData) { addToast('Organizasyon bilgisi bulunamadı.', 'error'); return; }
      resolvedOsgbOrgId = uoData.organization_id;
      resolvedUzmanAd = uoData.display_name ?? user.email ?? 'Uzman';
    }

    setActionLoading(true);
    setGpsError(null);

    // 1) Firma bilgisini çek (GPS alanları dahil)
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

    // 2) Aktif ziyaret çakışma kontrolü
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

    // 3) GPS kontrolü
    let coords: GpsCoords | null = null;
    let checkInGpsStatus: 'ok' | 'too_far' | 'no_permission' = 'ok';
    let checkInDistanceM: number | null = null;

    // Firma koordinatı tanımlıysa HER DURUMDA GPS kontrolü yap
    const firmaHasCoords = firmaData.firma_lat !== null && firmaData.firma_lng !== null;

    if (firmaData.gps_required || firmaHasCoords) {
      setGpsStatus('loading');
      coords = await getGpsCoords();

      if (!coords) {
        checkInGpsStatus = 'no_permission';
        const strict = firmaData.gps_strict !== false;

        if (firmaData.gps_required && strict) {
          setGpsStatus('denied');
          setGpsError('Konum izni gerekli. Tarayıcı ayarlarından konum iznini etkinleştirin ve tekrar deneyin.');
          setActionLoading(false);
          return;
        }
        // Strict değil → uyarıyla devam
        setGpsStatus('denied');
      }

      if (coords && firmaHasCoords) {
        setGpsStatus('checking');
        const distance = haversineMetres(coords.lat, coords.lng, firmaData.firma_lat!, firmaData.firma_lng!);
        const radius = firmaData.gps_radius ?? 1000;

        if (distance > radius) {
          checkInGpsStatus = 'too_far';
          checkInDistanceM = Math.round(distance);
          const distStr = distance >= 1000
            ? `${(distance / 1000).toFixed(1)} km`
            : `${Math.round(distance)} m`;

          // gps_required veya gps_strict ise engelle
          const shouldBlock = firmaData.gps_required || firmaData.gps_strict !== false;
          if (shouldBlock) {
            setGpsStatus('blocked');
            setGpsError(`Firma konumunda değilsiniz. Mesafeniz: ${distStr} — İzin verilen: ${radius} m`);
            setActionLoading(false);
            return;
          }
          // Koordinat tanımlı ama gps_required=false ve strict=false → uyarı ver ama devam et
          setGpsStatus('denied');
          setGpsError(`Firma konumundan uzaktasınız: ${distStr}. Ziyaret yine de başlatılıyor.`);
        } else {
          checkInDistanceM = Math.round(distance);
          checkInGpsStatus = 'ok';
          setGpsStatus('ok');
        }
      } else if (coords && !firmaHasCoords) {
        // Koordinat yok, GPS al ama engelleme yok
        checkInGpsStatus = 'ok';
        setGpsStatus('ok');
      }
    } else {
      // GPS gerekmez, koordinat da yok → yine de GPS almaya çalış (kayıt amaçlı)
      setGpsStatus('loading');
      coords = await getGpsCoords();
      checkInGpsStatus = coords ? 'ok' : 'no_permission';
      setGpsStatus(coords ? 'ok' : 'idle');
    }

    // 4) Check-in kaydı oluştur
    try {
      const now = new Date().toISOString();
      const { data: yeniZiyaret, error } = await supabase
        .from('osgb_ziyaretler')
        .insert({
          osgb_org_id: resolvedOsgbOrgId,
          firma_org_id: firmaId,
          firma_ad: firmaData.name,
          uzman_user_id: user.id,
          uzman_ad: resolvedUzmanAd || user.email || 'Uzman',
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
  }, [user, osgbOrgId, uzmanAd, addToast, gpsStatus]);

  // ── CHECK-OUT — engelleme yok ──
  const handleCheckOut = useCallback(async () => {
    if (!aktifZiyaret || !user?.id) return;
    setActionLoading(true);
    setGpsError(null);
    setGpsStatus('loading');

    let coords: GpsCoords | null = null;
    try {
      coords = await getGpsCoords();
    } catch {
      coords = null;
    }
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
        .eq('durum', 'aktif'); // sadece aktif ziyareti kapat — çift update önlemi

      if (error) throw new Error(error.message || 'Güncelleme başarısız');

      addToast(`Ziyaret tamamlandı! Süre: ${sureDakika} dakika`, 'success');
      setShowQr(false);
      // DB'den taze veri çek — state'i manuel set etme
      await fetchZiyaret();
    } catch (err) {
      console.error('[CheckOut] err:', err);
      addToast(`Check-out yapılamadı: ${err instanceof Error ? err.message : String(err)}`, 'error');
      // Hata olsa bile listeyi yenile — tutarsız state'i temizle
      await fetchZiyaret();
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
    } catch { /* JSON değil */ }

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

    if (aktifZiyaret) {
      if (aktifZiyaret.firma_org_id === firmaId) void handleCheckOut();
      else addToast(`Farklı firmada aktif ziyaretiniz var (${aktifZiyaret.firma_ad}). Önce bitirin.`, 'error');
    } else {
      void handleCheckIn(firmaId, true);
    }
  }, [aktifZiyaret, handleCheckIn, handleCheckOut, addToast]);

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Bugün';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Dün';
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
  };

  // GPS durum bandı config
  const gpsBandConfig: Record<GpsStatusType, { bg: string; border: string; color: string; icon: string; text: string } | null> = {
    idle: null,
    loading: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', color: '#D97706', icon: 'ri-loader-4-line animate-spin', text: 'Konum alınıyor...' },
    checking: { bg: 'rgba(14,165,233,0.08)', border: 'rgba(14,165,233,0.2)', color: '#0284C7', icon: 'ri-map-pin-2-line', text: 'Konum kontrol ediliyor...' },
    ok: { bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)', color: '#16A34A', icon: 'ri-map-pin-2-fill', text: 'Konum doğrulandı' },
    denied: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', color: '#D97706', icon: 'ri-map-pin-line', text: gpsError ? 'Konum izni gerekli — check-in engellendi' : 'Konum alınamadı — ziyaret yine de devam ediyor' },
    blocked: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', color: '#DC2626', icon: 'ri-map-pin-line', text: 'Firma konumunda değilsiniz' },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3">
        <i className="ri-loader-4-line text-xl animate-spin" style={{ color: '#0EA5E9' }} />
        <span className="text-sm" style={{ color: '#475569' }}>Yükleniyor...</span>
      </div>
    );
  }

  const band = gpsBandConfig[gpsStatus];

  return (
    <div className="space-y-4">

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
          {/* Detay mesaj */}
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

      {/* ── AKTİF ZİYARET KARTI ── */}
      {aktifZiyaret ? (
        <div className="rounded-2xl p-5" style={{ background: 'rgba(14,165,233,0.07)', border: '2px solid rgba(14,165,233,0.3)' }}>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="relative flex-shrink-0">
              <div className="w-3 h-3 rounded-full" style={{ background: '#0EA5E9' }} />
              <div className="absolute inset-0 rounded-full animate-ping" style={{ background: 'rgba(14,165,233,0.4)' }} />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#0EA5E9' }}>Aktif Ziyaret</span>
            {aktifZiyaret.qr_ile_giris && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(14,165,233,0.15)', color: '#0EA5E9', border: '1px solid rgba(14,165,233,0.3)' }}>
                <i className="ri-qr-code-line mr-0.5" />QR ile giriş
              </span>
            )}
          </div>

          <div className="flex items-start gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.3)' }}>
              <i className="ri-building-2-line text-xl" style={{ color: '#0EA5E9' }} />
            </div>
            <div>
              <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                {aktifZiyaret.firma_ad ?? 'Bilinmeyen Firma'}
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                Giriş: {formatTime(aktifZiyaret.giris_saati)} · {formatDate(aktifZiyaret.giris_saati)}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center py-3 rounded-xl mb-4"
            style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.15)' }}>
            <div className="text-center">
              <p className="text-xs font-semibold mb-1" style={{ color: '#64748B' }}>Geçen Süre</p>
              <p className="text-2xl font-extrabold font-mono" style={{ color: '#0EA5E9', letterSpacing: '0.05em' }}>
                {elapsed || '00d 00s'}
              </p>
            </div>
          </div>

          {showQr ? (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(14,165,233,0.2)' }}>
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Aynı Firma QR&apos;ını Okut</p>
                <button onClick={() => setShowQr(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                  <i className="ri-close-line text-sm" />
                </button>
              </div>
              <QrScanner onResult={handleQrResult} onClose={() => setShowQr(false)} />
              <p className="text-center text-xs py-2" style={{ color: '#64748B' }}>
                Aynı firmayı okutunca ziyaret otomatik biter
              </p>
            </div>
          ) : (
            <button
              onClick={() => setShowQr(true)}
              disabled={actionLoading}
              className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl cursor-pointer transition-all"
              style={{ background: 'rgba(14,165,233,0.08)', border: '2px dashed rgba(14,165,233,0.35)', color: '#0EA5E9' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(14,165,233,0.14)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(14,165,233,0.08)'; }}>
              <div className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
                style={{ background: 'rgba(14,165,233,0.15)' }}>
                {actionLoading
                  ? <i className="ri-loader-4-line animate-spin text-base" style={{ color: '#0EA5E9' }} />
                  : <i className="ri-qr-scan-2-line text-base" style={{ color: '#0EA5E9' }} />}
              </div>
              <div className="text-left">
                <p className="text-sm font-bold" style={{ color: '#0EA5E9' }}>QR ile Ziyareti Bitir</p>
                <p className="text-xs" style={{ color: '#64748B' }}>Aynı firma QR kodunu okutun</p>
              </div>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(14,165,233,0.2)', background: 'rgba(255,255,255,0.02)' }}>
            {showQr ? (
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Firma QR Kodunu Okut</p>
                  <button onClick={() => setShowQr(false)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                    <i className="ri-close-line text-sm" />
                  </button>
                </div>
                <QrScanner onResult={handleQrResult} onClose={() => setShowQr(false)} />
                <p className="text-center text-xs mt-2" style={{ color: '#64748B' }}>
                  Firmanın QR kodunu tarat → otomatik check-in yapılır
                </p>
              </div>
            ) : (
              <button
                onClick={() => setShowQr(true)}
                disabled={actionLoading}
                className="w-full flex flex-col items-center justify-center gap-3 py-8 cursor-pointer transition-all"
                style={{ background: 'transparent', opacity: actionLoading ? 0.6 : 1 }}
                onMouseEnter={e => { if (!actionLoading) e.currentTarget.style.background = 'rgba(14,165,233,0.04)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                <div className="w-20 h-20 flex items-center justify-center rounded-2xl"
                  style={{ background: 'rgba(14,165,233,0.08)', border: '2px dashed rgba(14,165,233,0.3)' }}>
                  {actionLoading
                    ? <i className="ri-loader-4-line text-4xl animate-spin" style={{ color: '#0EA5E9' }} />
                    : <i className="ri-qr-scan-2-line text-4xl" style={{ color: '#0EA5E9' }} />}
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold" style={{ color: '#0EA5E9' }}>
                    {actionLoading ? 'İşleniyor...' : 'QR ile Ziyaret Başlat'}
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#475569' }}>
                    {actionLoading ? 'Konum ve firma bilgileri kontrol ediliyor' : 'Firma QR kodunu okutun — anında check-in'}
                  </p>
                </div>
              </button>
            )}
          </div>

          {!showQr && !actionLoading && (
            <div className="rounded-2xl p-5" style={{ background: 'rgba(14,165,233,0.05)', border: '1px dashed rgba(14,165,233,0.3)' }}>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
                  style={{ background: 'rgba(14,165,233,0.1)' }}>
                  <i className="ri-qr-scan-2-line text-base" style={{ color: '#0EA5E9' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    QR kod okutarak ziyaret başlatın
                  </p>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: '#64748B' }}>
                    Firmanın QR kodunu tarat — sistem otomatik check-in ve check-out yapar. Aynı QR&apos;ı ikinci kez okutunca ziyaret biter.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ZİYARET GEÇMİŞİ ── */}
      {gecmis.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#475569' }}>
            Son Ziyaretler
          </p>
          <div className="space-y-2">
            {gecmis.map(z => (
              <div key={z.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(148,163,184,0.1)' }}>
                  <i className="ri-building-2-line text-xs" style={{ color: '#94A3B8' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {z.firma_ad ?? '—'}
                  </p>
                  <p className="text-[10px]" style={{ color: '#475569' }}>
                    {formatDate(z.giris_saati)} · {formatTime(z.giris_saati)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {z.qr_ile_giris && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: 'rgba(14,165,233,0.1)', color: '#0EA5E9' }}>QR</span>
                  )}
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(148,163,184,0.1)', color: '#94A3B8' }}>Tamamlandı</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
