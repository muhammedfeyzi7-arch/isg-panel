import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/AuthContext';
import { useApp } from '@/store/AppContext';
import { useQueue, LS_AKTIF_ZIYARET } from '@/store/OfflineQueueContext';
import type { ZiyaretCheckinPayload, ZiyaretCheckoutPayload } from '@/hooks/useOfflineQueue';
import QrScanner from './QrScanner';

// ─── LocalStorage key ─────────────────────────────────────────────────────────
const LS_OSGB_ORG = 'isg_osgb_org_info';

// ─── Tipler ──────────────────────────────────────────────────────────────────
interface AktifZiyaret {
  id: string | null;
  tempId: string;
  firmaOrgId: string;
  firmaAd: string | null;
  girisAt: string;
  qrIleGiris: boolean;
  isOffline: boolean;
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

// ─── GPS yardımcıları ─────────────────────────────────────────────────────────
function getGpsCoords(timeout = 10000): Promise<GpsCoords | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout, maximumAge: 30000, enableHighAccuracy: true }
    );
  });
}

function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat  = toRad(lat2 - lat1);
  const dLng  = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtElapsed(since: string): string {
  const diff = Date.now() - new Date(since).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${h > 0 ? h + 's ' : ''}${String(m).padStart(2, '0')}d ${String(s).padStart(2, '0')}s`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Bugün';
  const yd = new Date(today); yd.setDate(yd.getDate() - 1);
  if (d.toDateString() === yd.toDateString()) return 'Dün';
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
}

type GpsStatusType = 'idle' | 'loading' | 'checking' | 'ok' | 'denied' | 'blocked';

const GPS_BAND_CFG: Record<GpsStatusType, { bg: string; border: string; color: string; icon: string; text: string } | null> = {
  idle:     null,
  loading:  { bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.2)',  color: '#D97706', icon: 'ri-loader-4-line animate-spin', text: 'Konum alınıyor...' },
  checking: { bg: 'rgba(14,165,233,0.08)',  border: 'rgba(14,165,233,0.2)',  color: '#0284C7', icon: 'ri-map-pin-2-line',              text: 'Konum kontrol ediliyor...' },
  ok:       { bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.2)',   color: '#16A34A', icon: 'ri-map-pin-2-fill',              text: 'Konum doğrulandı' },
  denied:   { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)',  color: '#D97706', icon: 'ri-map-pin-line',                text: 'Konum alınamadı' },
  blocked:  { bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.25)',  color: '#DC2626', icon: 'ri-map-pin-line',                text: 'Firma konumunda değilsiniz' },
};

// ─── Offline Bant ─────────────────────────────────────────────────────────────
function ZiyaretOfflineBant({ isOnline, isSyncing, pendingCount }: { isOnline: boolean; isSyncing: boolean; pendingCount: number }) {
  const prevOnline  = useRef(isOnline);
  const prevSyncing = useRef(isSyncing);
  const [justCameOnline, setJustCameOnline] = useState(false);
  const [justSynced,     setJustSynced]     = useState(false);

  useEffect(() => {
    if (!prevOnline.current && isOnline) {
      setJustCameOnline(true);
      const t = setTimeout(() => setJustCameOnline(false), 4000);
      prevOnline.current = isOnline;
      return () => clearTimeout(t);
    }
    prevOnline.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    if (prevSyncing.current && !isSyncing && isOnline) {
      setJustSynced(true);
      const t = setTimeout(() => setJustSynced(false), 4000);
      prevSyncing.current = isSyncing;
      return () => clearTimeout(t);
    }
    prevSyncing.current = isSyncing;
  }, [isSyncing, isOnline]);

  if (!isOnline) return (
    <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl mb-3"
      style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
      <i className="ri-wifi-off-line text-sm flex-shrink-0" style={{ color: '#F59E0B' }} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold" style={{ color: '#D97706' }}>Çevrimdışısınız</p>
        <p className="text-[10px]" style={{ color: '#92400E' }}>Veriler kaydediliyor — bağlantı gelince otomatik senkronize edilecek</p>
      </div>
      {pendingCount > 0 && (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0"
          style={{ background: 'rgba(245,158,11,0.15)', color: '#D97706' }}>
          {pendingCount} bekliyor
        </span>
      )}
    </div>
  );

  if (isSyncing) return (
    <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl mb-3"
      style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.25)' }}>
      <i className="ri-loader-4-line text-sm animate-spin flex-shrink-0" style={{ color: '#0EA5E9' }} />
      <p className="text-xs font-bold" style={{ color: '#0284C7' }}>Senkronize ediliyor...</p>
    </div>
  );

  if (justCameOnline || justSynced) return (
    <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl mb-3"
      style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}>
      <i className="ri-check-line text-sm flex-shrink-0" style={{ color: '#22C55E' }} />
      <p className="text-xs font-bold" style={{ color: '#16A34A' }}>Senkronize edildi</p>
    </div>
  );

  return null;
}

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────
export default function ZiyaretCheckIn() {
  const { user } = useAuth();
  const { addToast } = useApp();

  // ── Global queue context (tek instance) ──────────────────────────────────
  const { isOnline, isSyncing, pendingCount, addToQueue, syncNow } = useQueue();

  // ── Aktif ziyaret state (localStorage persist) ───────────────────────────
  const [aktifZiyaret, setAktifZiyaretState] = useState<AktifZiyaret | null>(() => {
    try {
      const raw = localStorage.getItem(LS_AKTIF_ZIYARET);
      return raw ? (JSON.parse(raw) as AktifZiyaret) : null;
    } catch { return null; }
  });

  const [gecmis, setGecmis]           = useState<AktifZiyaret[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showQr, setShowQr]           = useState(false);
  const [elapsed, setElapsed]         = useState('');
  const [gpsStatus, setGpsStatus]     = useState<GpsStatusType>('idle');
  const [gpsError, setGpsError]       = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [osgbOrgId, setOsgbOrgId] = useState<string | null>(() => {
    try { return JSON.parse(localStorage.getItem(LS_OSGB_ORG) ?? 'null')?.orgId ?? null; } catch { return null; }
  });
  const [uzmanAd, setUzmanAd] = useState<string>(() => {
    try { return JSON.parse(localStorage.getItem(LS_OSGB_ORG) ?? 'null')?.uzmanAd ?? ''; } catch { return ''; }
  });

  const actionInProgress = useRef(false);

  // ── setAktifZiyaret: state + localStorage birlikte ───────────────────────
  const setAktifZiyaret = useCallback((z: AktifZiyaret | null) => {
    setAktifZiyaretState(z);
    if (z) localStorage.setItem(LS_AKTIF_ZIYARET, JSON.stringify(z));
    else   localStorage.removeItem(LS_AKTIF_ZIYARET);
  }, []);

  // ── Süre sayacı ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!aktifZiyaret) { setElapsed(''); return; }
    const update = () => setElapsed(fmtElapsed(aktifZiyaret.girisAt));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [aktifZiyaret]);

  // ── Org bilgisi çek (cache'li) ────────────────────────────────────────────
  const fetchOrg = useCallback(async () => {
    if (!user?.id || osgbOrgId) return;
    const { data } = await supabase
      .from('user_organizations')
      .select('organization_id, display_name')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();
    if (data) {
      setOsgbOrgId(data.organization_id);
      setUzmanAd(data.display_name ?? user.email ?? 'Uzman');
      localStorage.setItem(LS_OSGB_ORG, JSON.stringify({
        orgId: data.organization_id,
        uzmanAd: data.display_name ?? user.email ?? 'Uzman',
      }));
    }
  }, [user?.id, user?.email, osgbOrgId]);

  // ── DB'den aktif ziyaret çek + localStorage ile uzlaştır ─────────────────
  const fetchZiyaret = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: aktif } = await supabase
        .from('osgb_ziyaretler')
        .select('id, firma_org_id, firma_ad, giris_saati, qr_ile_giris')
        .eq('uzman_user_id', user.id)
        .is('cikis_saati', null)
        .order('giris_saati', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (aktif) {
        // DB'de aktif kayıt var → localStorage'ı güncelle (firma adı da dahil)
        setAktifZiyaret({
          id: aktif.id,
          tempId: aktif.id,
          firmaOrgId: aktif.firma_org_id,
          firmaAd: aktif.firma_ad,
          girisAt: aktif.giris_saati,
          qrIleGiris: aktif.qr_ile_giris,
          isOffline: false,
        });
      } else {
        // DB'de yok
        const local = (() => {
          try { const r = localStorage.getItem(LS_AKTIF_ZIYARET); return r ? JSON.parse(r) as AktifZiyaret : null; }
          catch { return null; }
        })();
        if (local && !local.isOffline) setAktifZiyaret(null); // online'dan açılmış ama DB'de yok → temizle
        // offline kaydedildiyse dokunma — sync bekliyor
      }

      const { data: gecmisData } = await supabase
        .from('osgb_ziyaretler')
        .select('id, firma_org_id, firma_ad, giris_saati, qr_ile_giris')
        .eq('uzman_user_id', user.id)
        .not('cikis_saati', 'is', null)
        .order('giris_saati', { ascending: false })
        .limit(5);

      setGecmis((gecmisData ?? []).map(z => ({
        id: z.id, tempId: z.id, firmaOrgId: z.firma_org_id,
        firmaAd: z.firma_ad, girisAt: z.giris_saati,
        qrIleGiris: z.qr_ile_giris, isOffline: false,
      })));
    } finally {
      setLoading(false);
    }
  }, [user?.id, setAktifZiyaret]);

  useEffect(() => {
    void fetchOrg();
    void fetchZiyaret();
  }, [fetchOrg, fetchZiyaret]);

  // Online gelince DB ile uzlaştır
  useEffect(() => { if (isOnline) void fetchZiyaret(); }, [isOnline, fetchZiyaret]);

  // ── Org çözücü ────────────────────────────────────────────────────────────
  const resolveOrg = useCallback(async (): Promise<{ orgId: string; uzman: string } | null> => {
    if (osgbOrgId) return { orgId: osgbOrgId, uzman: uzmanAd || user?.email || 'Uzman' };
    try {
      const cached = JSON.parse(localStorage.getItem(LS_OSGB_ORG) ?? 'null') as { orgId: string; uzmanAd: string } | null;
      if (cached?.orgId) return { orgId: cached.orgId, uzman: cached.uzmanAd };
    } catch { /* ignore */ }
    if (!user?.id) return null;
    const { data } = await supabase
      .from('user_organizations')
      .select('organization_id, display_name')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();
    if (!data) return null;
    setOsgbOrgId(data.organization_id);
    setUzmanAd(data.display_name ?? user.email ?? 'Uzman');
    localStorage.setItem(LS_OSGB_ORG, JSON.stringify({ orgId: data.organization_id, uzmanAd: data.display_name ?? user.email ?? 'Uzman' }));
    return { orgId: data.organization_id, uzman: data.display_name ?? user.email ?? 'Uzman' };
  }, [osgbOrgId, uzmanAd, user]);

  // ─────────────────────────────────────────────────────────────────────────
  // CHECK-IN
  // ─────────────────────────────────────────────────────────────────────────
  const handleCheckIn = useCallback(async (firmaId: string) => {
    if (!user?.id) { addToast('Oturum bulunamadı.', 'error'); return; }
    if (actionInProgress.current) return;
    actionInProgress.current = true;
    setActionLoading(true);
    setGpsError(null);

    try {
      let orgInfo = await resolveOrg();
      if (!orgInfo) { addToast('Organizasyon bilgisi bulunamadı.', 'error'); return; }

      const now    = new Date().toISOString();
      const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      let coords: GpsCoords | null = null;
      let checkInGpsStatus: 'ok' | 'too_far' | 'no_permission' = 'ok';
      let checkInDistanceM: number | null = null;

      if (isOnline) {
        const { data: firmaData } = await supabase
          .from('organizations')
          .select('name, gps_required, gps_radius, gps_strict, firma_lat, firma_lng')
          .eq('id', firmaId)
          .maybeSingle() as { data: FirmaGpsInfo | null };

        if (!firmaData) { addToast('Firma bulunamadı. QR geçersiz olabilir.', 'error'); return; }

        // Çakışma kontrolü
        const { data: existing } = await supabase
          .from('osgb_ziyaretler')
          .select('id, firma_ad')
          .eq('uzman_user_id', user.id)
          .is('cikis_saati', null)
          .limit(1)
          .maybeSingle();
        if (existing) {
          addToast(`Zaten aktif bir ziyaretiniz var: ${existing.firma_ad ?? 'Firma'}. Önce mevcut ziyareti bitirin.`, 'error');
          return;
        }

        const firmaHasCoords = firmaData.firma_lat !== null && firmaData.firma_lng !== null;
        if (firmaData.gps_required || firmaHasCoords) {
          setGpsStatus('loading');
          coords = await getGpsCoords();
          if (!coords) {
            checkInGpsStatus = 'no_permission';
            if (firmaData.gps_required && firmaData.gps_strict !== false) {
              setGpsStatus('denied');
              setGpsError('Konum izni gerekli. Tarayıcı ayarlarından konum iznini etkinleştirin ve tekrar deneyin.');
              return;
            }
            setGpsStatus('denied');
          }
          if (coords && firmaHasCoords) {
            setGpsStatus('checking');
            const distance = haversineMetres(coords.lat, coords.lng, firmaData.firma_lat!, firmaData.firma_lng!);
            const radius   = firmaData.gps_radius ?? 1000;
            if (distance > radius) {
              checkInGpsStatus  = 'too_far';
              checkInDistanceM  = Math.round(distance);
              const distStr = distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${Math.round(distance)} m`;
              if (firmaData.gps_required || firmaData.gps_strict !== false) {
                setGpsStatus('blocked');
                setGpsError(`Firma konumunda değilsiniz. Mesafeniz: ${distStr} — İzin verilen: ${radius} m`);
                return;
              }
              setGpsStatus('denied');
              setGpsError(`Firma konumundan uzaktasınız: ${distStr}. Ziyaret yine de başlatılıyor.`);
            } else {
              checkInDistanceM  = Math.round(distance);
              checkInGpsStatus  = 'ok';
              setGpsStatus('ok');
            }
          } else if (coords && !firmaHasCoords) {
            checkInGpsStatus = 'ok';
            setGpsStatus('ok');
          }
        } else {
          setGpsStatus('loading');
          coords = await getGpsCoords();
          checkInGpsStatus = coords ? 'ok' : 'no_permission';
          setGpsStatus(coords ? 'ok' : 'idle');
        }

        const { data: yeni, error } = await supabase
          .from('osgb_ziyaretler')
          .insert({
            osgb_org_id: orgInfo.orgId, firma_org_id: firmaId, firma_ad: firmaData.name,
            uzman_user_id: user.id, uzman_ad: orgInfo.uzman || user.email || 'Uzman',
            uzman_email: user.email, giris_saati: now, durum: 'aktif', qr_ile_giris: true,
            created_at: now, updated_at: now,
            check_in_lat: coords?.lat ?? null, check_in_lng: coords?.lng ?? null,
            gps_status: checkInGpsStatus, check_in_distance_m: checkInDistanceM,
          })
          .select('id')
          .maybeSingle();
        if (error) throw error;

        setAktifZiyaret({
          id: yeni?.id ?? null, tempId: yeni?.id ?? tempId,
          firmaOrgId: firmaId, firmaAd: firmaData.name,
          girisAt: now, qrIleGiris: true, isOffline: false,
        });
        addToast(`İşlem başarıyla kaydedildi — ${firmaData.name} ziyareti başladı`, 'success');
        if (checkInGpsStatus === 'ok') setTimeout(() => { setGpsStatus('idle'); setGpsError(null); }, 3000);

      } else {
        // OFFLINE
        setGpsStatus('loading');
        coords = await getGpsCoords(5000).catch(() => null);
        checkInGpsStatus = coords ? 'ok' : 'no_permission';
        setGpsStatus('idle');

        const local = (() => { try { const r = localStorage.getItem(LS_AKTIF_ZIYARET); return r ? JSON.parse(r) as AktifZiyaret : null; } catch { return null; } })();
        if (local) { addToast('Aktif bir ziyaret zaten var (çevrimdışı). Önce bitirin.', 'error'); return; }

        const payload: ZiyaretCheckinPayload = {
          tempId, osgbOrgId: orgInfo.orgId, firmaOrgId: firmaId,
          firmaAd: `Firma (${firmaId.slice(0, 6)}...)`,
          uzmanUserId: user.id, uzmanAd: orgInfo.uzman || user.email || 'Uzman',
          uzmanEmail: user.email ?? null, girisAt: now, qrIleGiris: true,
          checkInLat: coords?.lat ?? null, checkInLng: coords?.lng ?? null,
          gpsStatus: checkInGpsStatus, checkInDistanceM,
        };
        await addToQueue({
          type: 'ziyaret_checkin',
          label: `Ziyaret başlatıldı (çevrimdışı) — ${new Date(now).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`,
          payload: payload as unknown as Record<string, unknown>,
        });
        setAktifZiyaret({
          id: null, tempId, firmaOrgId: firmaId,
          firmaAd: `Firma (${firmaId.slice(0, 6)}...)`,
          girisAt: now, qrIleGiris: true, isOffline: true,
        });
        addToast('İşlem kaydedildi (çevrimdışı) — bağlantı gelince sunucuya gönderilecek', 'success');
      }
      setShowQr(false);
    } catch (err) {
      addToast(`Check-in yapılamadı: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setActionLoading(false);
      actionInProgress.current = false;
    }
  }, [user, resolveOrg, addToast, isOnline, addToQueue, setAktifZiyaret]);

  // ─────────────────────────────────────────────────────────────────────────
  // CHECK-OUT
  // ─────────────────────────────────────────────────────────────────────────
  const handleCheckOut = useCallback(async () => {
    if (!user?.id || !aktifZiyaret) return;
    if (actionInProgress.current) return;
    actionInProgress.current = true;
    setActionLoading(true);
    setGpsError(null);
    // Önce UI'ı kapat — QR scanner açıksa kapat
    setShowQr(false);

    setGpsStatus('loading');
    const coords = await getGpsCoords(5000).catch(() => null);
    setGpsStatus(coords ? 'ok' : 'idle');

    const now        = new Date().toISOString();
    const sureDakika = aktifZiyaret.girisAt
      ? Math.round((Date.now() - new Date(aktifZiyaret.girisAt).getTime()) / 60000)
      : null;

    try {
      if (isOnline) {
        // ID var mı yoksa DB'den bul
        let ziyaretId = aktifZiyaret.id;

        if (!ziyaretId || aktifZiyaret.isOffline) {
          // Offline kaydedilmişse veya ID yoksa DB'den aktif ziyareti bul
          const { data: dbZiyaret } = await supabase
            .from('osgb_ziyaretler')
            .select('id')
            .eq('uzman_user_id', user.id)
            .is('cikis_saati', null)
            .order('giris_saati', { ascending: false })
            .limit(1)
            .maybeSingle();
          ziyaretId = dbZiyaret?.id ?? null;
        }

        if (ziyaretId) {
          // Önce cikis_saati null kontrolü olmadan update et — kapatılmış olsa da force update
          const { error, count } = await supabase
            .from('osgb_ziyaretler')
            .update({
              cikis_saati: now, durum: 'tamamlandi', sure_dakika: sureDakika,
              updated_at: now, check_out_lat: coords?.lat ?? null, check_out_lng: coords?.lng ?? null,
            })
            .eq('id', ziyaretId)
            .eq('uzman_user_id', user.id)
            .is('cikis_saati', null)
            .select('id');

          if (error) throw new Error(error.message);

          if (!count || count === 0) {
            // cikis_saati null filtresi eşleşmedi — zaten kapatılmış olabilir, temizle
            addToast('Ziyaret zaten tamamlanmış. Kayıt temizlendi.', 'info');
          } else {
            addToast(`İşlem başarıyla kaydedildi — ziyaret tamamlandı (${sureDakika ?? 0} dk)`, 'success');
          }
        } else {
          // DB'de aktif ziyaret yok, queue'ya ekle
          const payload: ZiyaretCheckoutPayload = {
            tempId: aktifZiyaret.tempId, realId: null,
            uzmanUserId: user.id, cikisAt: now, sureDakika,
            checkOutLat: coords?.lat ?? null, checkOutLng: coords?.lng ?? null,
          };
          await addToQueue({
            type: 'ziyaret_checkout',
            label: `Ziyaret bitirildi — Süre: ${sureDakika ?? 0} dk`,
            payload: payload as unknown as Record<string, unknown>,
          });
          addToast(`Ziyaret tamamlandı (${sureDakika ?? 0} dk)`, 'success');
        }
      } else {
        // Offline checkout
        const payload: ZiyaretCheckoutPayload = {
          tempId: aktifZiyaret.tempId, realId: aktifZiyaret.id,
          uzmanUserId: user.id, cikisAt: now, sureDakika,
          checkOutLat: coords?.lat ?? null, checkOutLng: coords?.lng ?? null,
        };
        await addToQueue({
          type: 'ziyaret_checkout',
          label: `Ziyaret bitirildi (çevrimdışı) — Süre: ${sureDakika ?? 0} dk`,
          payload: payload as unknown as Record<string, unknown>,
        });
        addToast('İşlem kaydedildi (çevrimdışı) — bağlantı gelince sunucuya gönderilecek', 'success');
      }

      // Her durumda yerel state'i temizle
      setAktifZiyaret(null);

      if (isOnline) await fetchZiyaret();
    } catch (err) {
      addToast(`Check-out yapılamadı: ${err instanceof Error ? err.message : String(err)}`, 'error');
      if (isOnline) await fetchZiyaret();
    } finally {
      setActionLoading(false);
      actionInProgress.current = false;
      setTimeout(() => { setGpsStatus('idle'); setGpsError(null); }, 3000);
    }
  }, [aktifZiyaret, user?.id, addToast, isOnline, addToQueue, setAktifZiyaret, fetchZiyaret]);

  // ── QR Sonucu ─────────────────────────────────────────────────────────────
  const handleQrResult = useCallback((text: string) => {
    // Önce QR scanner'ı kapat, GPS/error state'ini temizle
    setShowQr(false);
    setGpsError(null);
    setGpsStatus('idle');

    // QR içeriğini parse et
    let firmaId: string | null = null;
    try {
      const p = JSON.parse(text) as { type?: string; id?: string };
      if (p.type === 'firm' && p.id) firmaId = p.id;
    } catch { /* not JSON */ }

    // UUID formatı direkt
    if (!firmaId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text.trim())) {
      firmaId = text.trim();
    }
    // URL param formatı
    if (!firmaId) firmaId = text.match(/firma[_-]?id=([0-9a-f-]{36})/i)?.[1] ?? null;
    // URL path formatı
    if (!firmaId) {
      const segs = text.replace(/[?#].*/, '').split('/').filter(Boolean);
      const last = segs[segs.length - 1] ?? '';
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(last)) firmaId = last;
    }

    if (!firmaId) {
      addToast('Geçersiz QR kodu.', 'error');
      return;
    }

    if (aktifZiyaret) {
      // Aktif ziyaret varsa → checkout (aynı firma olsun veya olmasın, QR ile çıkış desteklenir)
      if (aktifZiyaret.firmaOrgId === firmaId) {
        // Kısa bir delay ile çağır — setShowQr(false) state'inin settle etmesi için
        setTimeout(() => { void handleCheckOut(); }, 50);
      } else {
        addToast(`Farklı firmada aktif ziyaret var (${aktifZiyaret.firmaAd ?? 'Firma'}). Önce mevcut ziyareti bitirin.`, 'error');
      }
    } else {
      // Aktif ziyaret yoksa → checkin
      void handleCheckIn(firmaId);
    }
  }, [aktifZiyaret, handleCheckIn, handleCheckOut, addToast]);

  if (loading) return (
    <div className="flex items-center justify-center py-16 gap-3">
      <i className="ri-loader-4-line text-xl animate-spin" style={{ color: '#0EA5E9' }} />
      <span className="text-sm" style={{ color: '#475569' }}>Yükleniyor...</span>
    </div>
  );

  const band = GPS_BAND_CFG[gpsStatus];

  return (
    <div className="space-y-3">
      <ZiyaretOfflineBant isOnline={isOnline} isSyncing={isSyncing} pendingCount={pendingCount} />

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
                <i className="ri-error-warning-line" /> Check-in engellendi — fiziksel olarak firmada olmanız gerekiyor
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

      {pendingCount > 0 && isOnline && !isSyncing && (
        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl"
          style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.2)' }}>
          <div className="flex items-center gap-2">
            <i className="ri-time-line text-sm" style={{ color: '#0EA5E9' }} />
            <p className="text-xs font-semibold" style={{ color: '#0284C7' }}>{pendingCount} bekleyen işlem</p>
          </div>
          <button onClick={() => syncNow()}
            className="text-xs font-bold px-3 py-1 rounded-lg cursor-pointer"
            style={{ background: 'rgba(14,165,233,0.1)', color: '#0EA5E9', border: '1px solid rgba(14,165,233,0.2)' }}>
            Şimdi Gönder
          </button>
        </div>
      )}

      {aktifZiyaret ? (
        <div className="rounded-2xl p-5"
          style={{
            background: aktifZiyaret.isOffline ? 'rgba(245,158,11,0.06)' : 'rgba(14,165,233,0.07)',
            border: `2px solid ${aktifZiyaret.isOffline ? 'rgba(245,158,11,0.35)' : 'rgba(14,165,233,0.3)'}`,
          }}>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="relative flex-shrink-0">
              <div className="w-3 h-3 rounded-full" style={{ background: aktifZiyaret.isOffline ? '#F59E0B' : '#0EA5E9' }} />
              <div className="absolute inset-0 rounded-full animate-ping"
                style={{ background: aktifZiyaret.isOffline ? 'rgba(245,158,11,0.4)' : 'rgba(14,165,233,0.4)' }} />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: aktifZiyaret.isOffline ? '#D97706' : '#0EA5E9' }}>Aktif Ziyaret</span>
            {aktifZiyaret.isOffline && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(245,158,11,0.15)', color: '#D97706', border: '1px solid rgba(245,158,11,0.3)' }}>ÇEVRİMDIŞI</span>
            )}
            {aktifZiyaret.qrIleGiris && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: aktifZiyaret.isOffline ? 'rgba(245,158,11,0.12)' : 'rgba(14,165,233,0.15)', color: aktifZiyaret.isOffline ? '#D97706' : '#0EA5E9', border: `1px solid ${aktifZiyaret.isOffline ? 'rgba(245,158,11,0.25)' : 'rgba(14,165,233,0.3)'}` }}>
                <i className="ri-qr-code-line mr-0.5" />QR ile giriş
              </span>
            )}
          </div>

          <div className="flex items-start gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: aktifZiyaret.isOffline ? 'rgba(245,158,11,0.15)' : 'rgba(14,165,233,0.15)', border: `1px solid ${aktifZiyaret.isOffline ? 'rgba(245,158,11,0.3)' : 'rgba(14,165,233,0.3)'}` }}>
              <i className="ri-building-2-line text-xl" style={{ color: aktifZiyaret.isOffline ? '#F59E0B' : '#0EA5E9' }} />
            </div>
            <div>
              <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{aktifZiyaret.firmaAd ?? 'Bilinmeyen Firma'}</p>
              <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>Giriş: {fmtTime(aktifZiyaret.girisAt)} · {fmtDate(aktifZiyaret.girisAt)}</p>
              {aktifZiyaret.isOffline && (
                <p className="text-[10px] mt-1 font-semibold" style={{ color: '#D97706' }}>Çevrimdışı kaydedildi — bağlantı gelince senkronize edilecek</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center py-3 rounded-xl mb-4"
            style={{ background: aktifZiyaret.isOffline ? 'rgba(245,158,11,0.08)' : 'rgba(14,165,233,0.08)', border: `1px solid ${aktifZiyaret.isOffline ? 'rgba(245,158,11,0.15)' : 'rgba(14,165,233,0.15)'}` }}>
            <div className="text-center">
              <p className="text-xs font-semibold mb-1" style={{ color: '#64748B' }}>Geçen Süre</p>
              <p className="text-2xl font-extrabold font-mono"
                style={{ color: aktifZiyaret.isOffline ? '#F59E0B' : '#0EA5E9', letterSpacing: '0.05em' }}>
                {elapsed || '00d 00s'}
              </p>
            </div>
          </div>

          {showQr ? (
            <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${aktifZiyaret.isOffline ? 'rgba(245,158,11,0.2)' : 'rgba(14,165,233,0.2)'}` }}>
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Aynı Firma QR&apos;ını Okut</p>
                <button onClick={() => setShowQr(false)} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                  <i className="ri-close-line text-sm" />
                </button>
              </div>
              <QrScanner onResult={handleQrResult} onClose={() => setShowQr(false)} />
              <p className="text-center text-xs py-2" style={{ color: '#64748B' }}>Aynı firmayı okutunca ziyaret otomatik biter</p>
            </div>
          ) : (
            <button onClick={() => setShowQr(true)} disabled={actionLoading}
              className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl cursor-pointer transition-all"
              style={{ background: aktifZiyaret.isOffline ? 'rgba(245,158,11,0.08)' : 'rgba(14,165,233,0.08)', border: `2px dashed ${aktifZiyaret.isOffline ? 'rgba(245,158,11,0.35)' : 'rgba(14,165,233,0.35)'}`, color: aktifZiyaret.isOffline ? '#D97706' : '#0EA5E9', opacity: actionLoading ? 0.6 : 1 }}>
              <div className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
                style={{ background: aktifZiyaret.isOffline ? 'rgba(245,158,11,0.15)' : 'rgba(14,165,233,0.15)' }}>
                {actionLoading
                  ? <i className="ri-loader-4-line animate-spin text-base" style={{ color: aktifZiyaret.isOffline ? '#F59E0B' : '#0EA5E9' }} />
                  : <i className="ri-qr-scan-2-line text-base" style={{ color: aktifZiyaret.isOffline ? '#F59E0B' : '#0EA5E9' }} />}
              </div>
              <div className="text-left">
                <p className="text-sm font-bold">{actionLoading ? 'İşleniyor...' : 'QR ile Ziyareti Bitir'}</p>
                <p className="text-xs" style={{ color: '#64748B' }}>{aktifZiyaret.isOffline ? 'Bitirme çevrimdışı kaydedilir' : 'Aynı firma QR kodunu okutun'}</p>
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
                  <button onClick={() => setShowQr(false)} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                    <i className="ri-close-line text-sm" />
                  </button>
                </div>
                <QrScanner onResult={handleQrResult} onClose={() => setShowQr(false)} />
                <p className="text-center text-xs mt-2" style={{ color: '#64748B' }}>
                  Firmanın QR kodunu tarat → otomatik check-in{!isOnline && ' (çevrimdışı kaydedilir)'}
                </p>
              </div>
            ) : (
              <button onClick={() => setShowQr(true)} disabled={actionLoading}
                className="w-full flex flex-col items-center justify-center gap-3 py-8 cursor-pointer transition-all"
                style={{ background: 'transparent', opacity: actionLoading ? 0.6 : 1 }}
                onMouseEnter={e => { if (!actionLoading) e.currentTarget.style.background = 'rgba(14,165,233,0.04)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                <div className="w-20 h-20 flex items-center justify-center rounded-2xl" style={{ background: 'rgba(14,165,233,0.08)', border: '2px dashed rgba(14,165,233,0.3)' }}>
                  {actionLoading
                    ? <i className="ri-loader-4-line text-4xl animate-spin" style={{ color: '#0EA5E9' }} />
                    : <i className="ri-qr-scan-2-line text-4xl" style={{ color: '#0EA5E9' }} />}
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold" style={{ color: '#0EA5E9' }}>{actionLoading ? 'İşleniyor...' : 'QR ile Ziyaret Başlat'}</p>
                  <p className="text-xs mt-1" style={{ color: '#475569' }}>
                    {!isOnline ? 'Çevrimdışı — ziyaret yerel olarak kaydedilir' : 'Firma QR kodunu okutun — anında check-in'}
                  </p>
                </div>
              </button>
            )}
          </div>

          {!showQr && !actionLoading && (
            <div className="rounded-2xl p-5" style={{ background: 'rgba(14,165,233,0.05)', border: '1px dashed rgba(14,165,233,0.3)' }}>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: 'rgba(14,165,233,0.1)' }}>
                  <i className="ri-qr-scan-2-line text-base" style={{ color: '#0EA5E9' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>QR kod okutarak ziyaret başlatın</p>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: '#64748B' }}>
                    {!isOnline
                      ? 'Çevrimdışı modasındasınız. QR okutulunca ziyaret yerel olarak kaydedilir ve bağlantı gelince senkronize edilir.'
                      : 'Firmanın QR kodunu tarat — sistem otomatik check-in ve check-out yapar. Aynı QR\'ı ikinci kez okutunca ziyaret biter.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {gecmis.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#475569' }}>Son Ziyaretler</p>
          <div className="space-y-2">
            {gecmis.map(z => (
              <div key={z.id ?? z.tempId} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(148,163,184,0.1)' }}>
                  <i className="ri-building-2-line text-xs" style={{ color: '#94A3B8' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{z.firmaAd ?? '—'}</p>
                  <p className="text-[10px]" style={{ color: '#475569' }}>{fmtDate(z.girisAt)} · {fmtTime(z.girisAt)}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {z.qrIleGiris && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(14,165,233,0.1)', color: '#0EA5E9' }}>QR</span>}
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(148,163,184,0.1)', color: '#94A3B8' }}>Tamamlandı</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
