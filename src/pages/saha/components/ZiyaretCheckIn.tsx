import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/AuthContext';
import { useApp } from '@/store/AppContext';
import { useQueue, LS_AKTIF_ZIYARET } from '@/store/OfflineQueueContext';
import type { ZiyaretCheckinPayload, ZiyaretCheckoutPayload } from '@/hooks/useOfflineQueue';
import QrScanner from './QrScanner';

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

  const { isOnline, isSyncing, pendingCount, addToQueue, syncNow } = useQueue();

  // ── Aktif ziyaret state (localStorage persist) ───────────────────────────
  const [aktifZiyaret, setAktifZiyaretState] = useState<AktifZiyaret | null>(() => {
    try {
      const raw = localStorage.getItem(LS_AKTIF_ZIYARET);
      return raw ? (JSON.parse(raw) as AktifZiyaret) : null;
    } catch { return null; }
  });

  const [gecmis, setGecmis]               = useState<AktifZiyaret[]>([]);
  const [loading, setLoading]             = useState(true);
  const [showQr, setShowQr]               = useState(false);
  const [elapsed, setElapsed]             = useState('');
  const [gpsStatus, setGpsStatus]         = useState<GpsStatusType>('idle');
  const [gpsError, setGpsError]           = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

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

  // ────────────────────────────────────────────────────────────────────────
  // ORG ÇÖZÜCÜ — Her çağrıda doğrudan DB'den çeker, cache YOK
  // ────────────────────────────────────────────────────────────────────────
  const getOrgFromDB = useCallback(async (): Promise<{ orgId: string; uzman: string } | null> => {
    if (!user?.id) return null;

    // ── Önce osgb_role olan kayıttan OSGB org'unu çek (en güvenilir) ──
    const { data: osgbRow } = await supabase
      .from('user_organizations')
      .select('organization_id, display_name')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .in('osgb_role', ['gezici_uzman', 'isyeri_hekimi'])
      .order('joined_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (osgbRow?.organization_id) {
      console.log('[getOrgFromDB] osgb_role ile bulundu:', osgbRow.organization_id);
      return {
        orgId: osgbRow.organization_id,
        uzman: osgbRow.display_name ?? user.email ?? 'Uzman',
      };
    }

    // ── Fallback: herhangi aktif kayıt ──
    const { data, error } = await supabase
      .from('user_organizations')
      .select('organization_id, display_name, osgb_role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('joined_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('[getOrgFromDB] DB error:', error);
      return null;
    }

    if (!data || data.length === 0) {
      console.error('[getOrgFromDB] Org bulunamadı! user_id:', user.id);
      return null;
    }

    // osgb_role null olan kaydı önce dene (OSGB üyeliği, firma değil)
    const best = data[0];
    console.log('[getOrgFromDB] fallback ile bulundu:', best.organization_id, 'osgb_role:', best.osgb_role);

    return {
      orgId: best.organization_id,
      uzman: best.display_name ?? user.email ?? 'Uzman',
    };
  }, [user?.id, user?.email]);

  // ── DB'den aktif ziyaret çek ─────────────────────────────────────────────
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
        const local = (() => {
          try { const r = localStorage.getItem(LS_AKTIF_ZIYARET); return r ? JSON.parse(r) as AktifZiyaret : null; }
          catch { return null; }
        })();
        // Online'dan kayıt açılmış ama DB'de yoksa temizle
        if (local && !local.isOffline) setAktifZiyaret(null);
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

  useEffect(() => { void fetchZiyaret(); }, [fetchZiyaret]);
  useEffect(() => { if (isOnline) void fetchZiyaret(); }, [isOnline, fetchZiyaret]);

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
      // ── 1. Her zaman DB'den org çek ─────────────────────────────────────
      const orgInfo = await getOrgFromDB();
      if (!orgInfo) {
        addToast('Organizasyon bilgisi bulunamadı. Lütfen tekrar giriş yapın.', 'error');
        return;
      }

      // user.id = auth.uid() — state veya prop DEĞİL
      const authUserId = user.id;
      const now    = new Date().toISOString();
      const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      let coords: GpsCoords | null = null;
      let checkInGpsStatus: 'ok' | 'too_far' | 'no_permission' = 'ok';
      let checkInDistanceM: number | null = null;

      if (isOnline) {
        // ── 2. Firma bilgisini çek ─────────────────────────────────────────
        const { data: firmaData } = await supabase
          .from('organizations')
          .select('name, gps_required, gps_radius, gps_strict, firma_lat, firma_lng')
          .eq('id', firmaId)
          .maybeSingle() as { data: FirmaGpsInfo | null };

        if (!firmaData) { addToast('Firma bulunamadı. QR geçersiz olabilir.', 'error'); return; }

        // ── 3. Çakışma kontrolü — user.id ile ─────────────────────────────
        const { data: existing } = await supabase
          .from('osgb_ziyaretler')
          .select('id, firma_ad')
          .eq('uzman_user_id', authUserId)
          .is('cikis_saati', null)
          .limit(1)
          .maybeSingle();
        if (existing) {
          addToast(`Zaten aktif bir ziyaretiniz var: ${existing.firma_ad ?? 'Firma'}. Önce mevcut ziyareti bitirin.`, 'error');
          return;
        }

        // ── 4. GPS kontrolü ────────────────────────────────────────────────
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
              checkInGpsStatus = 'too_far';
              checkInDistanceM = Math.round(distance);
              const distStr    = distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${Math.round(distance)} m`;
              if (firmaData.gps_required || firmaData.gps_strict !== false) {
                setGpsStatus('blocked');
                setGpsError(`Firma konumunda değilsiniz. Mesafeniz: ${distStr} — İzin verilen: ${radius} m`);
                return;
              }
              setGpsStatus('denied');
              setGpsError(`Firma konumundan uzaktasınız: ${distStr}. Ziyaret yine de başlatılıyor.`);
            } else {
              checkInDistanceM = Math.round(distance);
              checkInGpsStatus = 'ok';
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

        // ── 5. INSERT — osgb_org_id DB'den, uzman_user_id = auth.uid() ────
        const insertPayload = {
          osgb_org_id:         orgInfo.orgId,   // ← DB'den gelen gerçek org
          firma_org_id:        firmaId,
          firma_ad:            firmaData.name,
          uzman_user_id:       authUserId,       // ← auth.uid(), state değil
          uzman_ad:            orgInfo.uzman || user.email || 'Uzman',
          uzman_email:         user.email,
          giris_saati:         now,
          durum:               'aktif',
          qr_ile_giris:        true,
          created_at:          now,
          updated_at:          now,
          check_in_lat:        coords?.lat ?? null,
          check_in_lng:        coords?.lng ?? null,
          gps_status:          checkInGpsStatus,
          check_in_distance_m: checkInDistanceM,
        };

        // Zorunlu log — veri tutarlılığı doğrulama
        console.log('CHECKIN FINAL', {
          osgb_org_id:   insertPayload.osgb_org_id,
          uzman_user_id: insertPayload.uzman_user_id,
          firma_org_id:  insertPayload.firma_org_id,
          firma_ad:      insertPayload.firma_ad,
        });

        const { data: yeni, error } = await supabase
          .from('osgb_ziyaretler')
          .insert(insertPayload)
          .select('id')
          .maybeSingle();

        if (error) throw error;

        setAktifZiyaret({
          id:          yeni?.id ?? null,
          tempId:      yeni?.id ?? tempId,
          firmaOrgId:  firmaId,
          firmaAd:     firmaData.name,
          girisAt:     now,
          qrIleGiris:  true,
          isOffline:   false,
        });
        addToast(`İşlem başarıyla kaydedildi — ${firmaData.name} ziyareti başladı`, 'success');
        if (checkInGpsStatus === 'ok') setTimeout(() => { setGpsStatus('idle'); setGpsError(null); }, 3000);

      } else {
        // ── OFFLINE ─────────────────────────────────────────────────────────
        setGpsStatus('loading');
        coords = await getGpsCoords(5000).catch(() => null);
        checkInGpsStatus = coords ? 'ok' : 'no_permission';
        setGpsStatus('idle');

        const local = (() => { try { const r = localStorage.getItem(LS_AKTIF_ZIYARET); return r ? JSON.parse(r) as AktifZiyaret : null; } catch { return null; } })();
        if (local) { addToast('Aktif bir ziyaret zaten var (çevrimdışı). Önce bitirin.', 'error'); return; }

        const payload: ZiyaretCheckinPayload = {
          tempId,
          osgbOrgId:         orgInfo.orgId,   // ← DB'den gelen org
          firmaOrgId:        firmaId,
          firmaAd:           `Firma (${firmaId.slice(0, 6)}...)`,
          uzmanUserId:       authUserId,       // ← auth.uid()
          uzmanAd:           orgInfo.uzman || user.email || 'Uzman',
          uzmanEmail:        user.email ?? null,
          girisAt:           now,
          qrIleGiris:        true,
          checkInLat:        coords?.lat ?? null,
          checkInLng:        coords?.lng ?? null,
          gpsStatus:         checkInGpsStatus,
          checkInDistanceM,
        };
        await addToQueue({
          type:  'ziyaret_checkin',
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
  }, [user, getOrgFromDB, addToast, isOnline, addToQueue, setAktifZiyaret]);

  // ─────────────────────────────────────────────────────────────────────────
  // CHECK-OUT
  // ─────────────────────────────────────────────────────────────────────────
  const handleCheckOut = useCallback(async () => {
    if (!user?.id || !aktifZiyaret) return;
    if (actionInProgress.current) return;
    actionInProgress.current = true;
    setActionLoading(true);
    setGpsError(null);
    setShowQr(false);

    setGpsStatus('loading');
    const coords = await getGpsCoords(5000).catch(() => null);
    setGpsStatus(coords ? 'ok' : 'idle');

    const now        = new Date().toISOString();
    const authUserId = user.id; // auth.uid() — state değil

    try {
      if (isOnline) {
        // ── Adım 1: ID çözüm — önce aktifZiyaret.id ──────────────────────
        let ziyaretId: string | null = aktifZiyaret.id;

        // ── Adım 2: ID yoksa veya offline ise — user.id ile fallback ──────
        if (!ziyaretId || aktifZiyaret.isOffline) {
          const { data: byUser } = await supabase
            .from('osgb_ziyaretler')
            .select('id')
            .eq('uzman_user_id', authUserId)
            .is('cikis_saati', null)
            .order('giris_saati', { ascending: false })
            .limit(1)
            .maybeSingle();
          ziyaretId = byUser?.id ?? null;
        }

        // ── Adım 3: Hâlâ yoksa — DB'den org alıp osgb_org_id ile fallback ─
        if (!ziyaretId) {
          const orgInfo = await getOrgFromDB();
          if (orgInfo) {
            const { data: byOrg } = await supabase
              .from('osgb_ziyaretler')
              .select('id')
              .eq('osgb_org_id', orgInfo.orgId)
              .eq('uzman_user_id', authUserId)
              .is('cikis_saati', null)
              .order('giris_saati', { ascending: false })
              .limit(1)
              .maybeSingle();
            ziyaretId = byOrg?.id ?? null;
          }
        }

        console.log('CHECKOUT START', {
          aktifZiyaretId: aktifZiyaret.id,
          resolvedId:     ziyaretId,
          authUserId,
        });

        if (ziyaretId) {
          // Süreyi hesapla: giris_saatini önce çek
          let sureDakika: number | null = null;
          if (aktifZiyaret?.girisAt) {
            sureDakika = Math.max(1, Math.round((new Date(now).getTime() - new Date(aktifZiyaret.girisAt).getTime()) / 60000));
          } else {
            // DB'den giris_saati çek
            const { data: zRow } = await supabase
              .from('osgb_ziyaretler')
              .select('giris_saati')
              .eq('id', ziyaretId)
              .maybeSingle();
            if (zRow?.giris_saati) {
              sureDakika = Math.max(1, Math.round((new Date(now).getTime() - new Date(zRow.giris_saati).getTime()) / 60000));
            }
          }

          // ── UPDATE — sadece id + cikis_saati null filtresi
          // .eq('uzman_user_id') KALDIRILDI — user mismatch bypass
          // sure_dakika GENERATED ALWAYS — DB otomatik hesaplar, gönderilmez
          const { data: updateData, error, count } = await supabase
            .from('osgb_ziyaretler')
            .update({
              cikis_saati:   now,
              durum:         'tamamlandi',
              updated_at:    now,
              check_out_lat: coords?.lat ?? null,
              check_out_lng: coords?.lng ?? null,
            })
            .eq('id', ziyaretId)
            .is('cikis_saati', null)
            .select('id', { count: 'exact' });

          // Zorunlu log — her zaman yazdır
          console.log('CHECKOUT RESULT', {
            ziyaretId,
            data:  updateData,
            error: error ? { message: error.message, code: error.code, details: error.details } : null,
            count,
          });

          if (error) {
            addToast(`Ziyaret sonlandırılamadı: ${error.message}`, 'error');
            throw new Error(error.message);
          }

          if (!count || count === 0) {
            addToast('Ziyaret zaten tamamlanmış. Kayıt temizlendi.', 'info');
          } else {
            addToast('Ziyaret başarıyla tamamlandı.', 'success');
          }
        } else {
          console.warn('CHECKOUT: Aktif ziyaret DB\'de bulunamadı, local temizleniyor', { authUserId });
          addToast('Yerel ziyaret kaydı temizlendi.', 'info');
        }
      } else {
        // ── Offline checkout ──────────────────────────────────────────────
        const payload: ZiyaretCheckoutPayload = {
          tempId:      aktifZiyaret.tempId,
          realId:      aktifZiyaret.id,
          uzmanUserId: authUserId,
          cikisAt:     now,
          sureDakika:  null,    // GENERATED ALWAYS — gönderilmez
          checkOutLat: coords?.lat ?? null,
          checkOutLng: coords?.lng ?? null,
        };
        await addToQueue({
          type:    'ziyaret_checkout',
          label:   'Ziyaret bitirildi (çevrimdışı)',
          payload: payload as unknown as Record<string, unknown>,
        });
        addToast('İşlem kaydedildi (çevrimdışı) — bağlantı gelince sunucuya gönderilecek', 'success');
      }

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
  }, [aktifZiyaret, user?.id, getOrgFromDB, addToast, isOnline, addToQueue, setAktifZiyaret, fetchZiyaret]);

  // ── QR Sonucu ─────────────────────────────────────────────────────────────
  const handleQrResult = useCallback((text: string) => {
    setShowQr(false);
    setGpsError(null);
    setGpsStatus('idle');

    let firmaId: string | null = null;
    try {
      const p = JSON.parse(text) as { type?: string; id?: string };
      if (p.type === 'firm' && p.id) firmaId = p.id;
    } catch { /* not JSON */ }

    if (!firmaId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text.trim()))
      firmaId = text.trim();
    if (!firmaId) firmaId = text.match(/firma[_-]?id=([0-9a-f-]{36})/i)?.[1] ?? null;
    if (!firmaId) {
      const segs = text.replace(/[?#].*/, '').split('/').filter(Boolean);
      const last = segs[segs.length - 1] ?? '';
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(last)) firmaId = last;
    }

    if (!firmaId) { addToast('Geçersiz QR kodu.', 'error'); return; }

    console.log('QR OKUNDU', firmaId);

    if (aktifZiyaret) {
      // Aktif ziyaret var → her zaman checkout (firma mismatch bloklama)
      if (aktifZiyaret.firmaOrgId !== firmaId) {
        console.warn('QR firma mismatch — checkout yine de devam etti', {
          aktifFirma: aktifZiyaret.firmaOrgId,
          qrFirma:    firmaId,
        });
      }
      setTimeout(() => { void handleCheckOut(); }, 50);
    } else {
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
