import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/AuthContext';
import { useApp } from '@/store/AppContext';
import QrScanner from '@/pages/saha/components/QrScanner';
import { useQueue, LS_HEKIM_AKTIF_ZIYARET } from '@/store/OfflineQueueContext';
import type { ZiyaretCheckinPayload, ZiyaretCheckoutPayload } from '@/hooks/useOfflineQueue';

const ACCENT      = '#0EA5E9';
const ACCENT_DARK = '#0284C7';

const LS_HEKIM_ORG = 'isg_hekim_org_info';

interface AktifZiyaret {
  id: string | null;
  tempId: string;
  firma_org_id: string;
  firma_ad: string | null;
  giris_saati: string;
  cikis_saati?: string | null;
  sure_dakika?: number | null;
  gps_status?: 'ok' | 'too_far' | 'no_permission' | null;
  check_in_distance_m?: number | null;
  qr_ile_giris: boolean;
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

interface Props { isDark: boolean; }

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
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type GpsStatusType = 'idle' | 'loading' | 'checking' | 'ok' | 'denied' | 'blocked';

function HekimOfflineBant({ isOnline, isSyncing, pendingCount, isDark }: { isOnline: boolean; isSyncing: boolean; pendingCount: number; isDark: boolean; }) {
  const prevOnline  = useRef(isOnline);
  const prevSyncing = useRef(isSyncing);
  const [justCameOnline, setJustCameOnline] = useState(false);
  const [justSynced,     setJustSynced]     = useState(false);

  useEffect(() => {
    if (!prevOnline.current && isOnline) { setJustCameOnline(true); const t = setTimeout(() => setJustCameOnline(false), 4000); prevOnline.current = isOnline; return () => clearTimeout(t); }
    prevOnline.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    if (prevSyncing.current && !isSyncing && isOnline) { setJustSynced(true); const t = setTimeout(() => setJustSynced(false), 4000); prevSyncing.current = isSyncing; return () => clearTimeout(t); }
    prevSyncing.current = isSyncing;
  }, [isSyncing, isOnline]);

  void isDark;
  const cls = `mx-4 mb-3 flex items-center gap-3 px-4 py-3 rounded-xl`;

  if (!isOnline) return (
    <div className={cls} style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
      <i className="ri-wifi-off-line text-sm flex-shrink-0" style={{ color: '#F59E0B' }} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold" style={{ color: '#D97706' }}>Çevrimdışısınız</p>
        <p className="text-[10px]" style={{ color: '#92400E' }}>Ziyaretler kaydediliyor — bağlantı gelince senkronize edilir</p>
      </div>
      {pendingCount > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0" style={{ background: 'rgba(245,158,11,0.15)', color: '#D97706' }}>{pendingCount} bekliyor</span>}
    </div>
  );
  if (isSyncing) return (
    <div className={cls} style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)' }}>
      <i className="ri-loader-4-line text-sm animate-spin flex-shrink-0" style={{ color: ACCENT }} />
      <p className="text-xs font-bold" style={{ color: ACCENT_DARK }}>Senkronize ediliyor...</p>
    </div>
  );
  if (justCameOnline || justSynced) return (
    <div className={cls} style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
      <i className="ri-check-line text-sm flex-shrink-0" style={{ color: '#22C55E' }} />
      <p className="text-xs font-bold" style={{ color: '#16A34A' }}>Senkronize edildi</p>
    </div>
  );
  return null;
}

export default function HekimMobilZiyaret({ isDark }: Props) {
  const { user }       = useAuth();
  const { org, addToast } = useApp();

  // ── Global queue context (tek instance) ──────────────────────────────────
  const { isOnline, isSyncing, pendingCount, addToQueue, syncNow } = useQueue();

  const [aktifZiyaret, setAktifZiyaretState] = useState<AktifZiyaret | null>(() => {
    try { const r = localStorage.getItem(LS_HEKIM_AKTIF_ZIYARET); return r ? JSON.parse(r) as AktifZiyaret : null; } catch { return null; }
  });
  const [gecmis, setGecmis]               = useState<AktifZiyaret[]>([]);
  const [loading, setLoading]             = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showQr, setShowQr]               = useState(false);
  const [elapsed, setElapsed]             = useState('');
  const [gpsStatus, setGpsStatus]         = useState<GpsStatusType>('idle');
  const [gpsError, setGpsError]           = useState<string | null>(null);
  const [osgbOrgId, setOsgbOrgId] = useState<string | null>(() => { try { return JSON.parse(localStorage.getItem(LS_HEKIM_ORG) ?? 'null')?.orgId ?? null; } catch { return null; } });
  const [hekimAd,   setHekimAd]   = useState<string>(() => { try { return JSON.parse(localStorage.getItem(LS_HEKIM_ORG) ?? 'null')?.uzmanAd ?? ''; } catch { return ''; } });
  const actionInProgress = useRef(false);

  const setAktifZiyaret = useCallback((z: AktifZiyaret | null) => {
    setAktifZiyaretState(z);
    if (z) localStorage.setItem(LS_HEKIM_AKTIF_ZIYARET, JSON.stringify(z));
    else   localStorage.removeItem(LS_HEKIM_AKTIF_ZIYARET);
  }, []);

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
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [aktifZiyaret]);

  const resolveOsgbOrgId = useCallback(async (orgId: string): Promise<string> => {
    // org_type kontrolü: eğer osgb ise direkt, firma ise parent_org_id al
    const { data } = await supabase
      .from('organizations')
      .select('id, org_type, parent_org_id')
      .eq('id', orgId)
      .maybeSingle();
    if (!data) return orgId;
    if (data.org_type === 'osgb') return data.id;
    if (data.parent_org_id) return data.parent_org_id;
    return orgId;
  }, []);

  const fetchOrgInfo = useCallback(async () => {
    if (!user?.id || osgbOrgId) return;
    if (org?.id) {
      // org.id osgb mi kontrol et
      const realOsgbId = await resolveOsgbOrgId(org.id);
      setOsgbOrgId(realOsgbId);
      const ad = user.user_metadata?.display_name ?? user.email ?? 'Hekim';
      setHekimAd(ad);
      localStorage.setItem(LS_HEKIM_ORG, JSON.stringify({ orgId: realOsgbId, uzmanAd: ad }));
      return;
    }
    const { data } = await supabase.from('user_organizations').select('organization_id, display_name').eq('user_id', user.id).eq('is_active', true).maybeSingle();
    if (data) {
      const realOsgbId = await resolveOsgbOrgId(data.organization_id);
      setOsgbOrgId(realOsgbId);
      const ad = data.display_name ?? user.email ?? 'Hekim';
      setHekimAd(ad);
      localStorage.setItem(LS_HEKIM_ORG, JSON.stringify({ orgId: realOsgbId, uzmanAd: ad }));
    }
  }, [user?.id, user?.email, user?.user_metadata, org?.id, osgbOrgId, resolveOsgbOrgId]);

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
        setAktifZiyaret({ id: aktif.id, tempId: aktif.id, firma_org_id: aktif.firma_org_id, firma_ad: aktif.firma_ad, giris_saati: aktif.giris_saati, qr_ile_giris: aktif.qr_ile_giris, isOffline: false });
      } else {
        const local = (() => { try { const r = localStorage.getItem(LS_HEKIM_AKTIF_ZIYARET); return r ? JSON.parse(r) as AktifZiyaret : null; } catch { return null; } })();
        if (local && !local.isOffline) setAktifZiyaret(null);
      }

      const { data: gecmisData } = await supabase.from('osgb_ziyaretler').select('id, firma_org_id, firma_ad, giris_saati, cikis_saati, sure_dakika, gps_status, check_in_distance_m, qr_ile_giris').eq('uzman_user_id', user.id).not('cikis_saati', 'is', null).order('giris_saati', { ascending: false }).limit(10);
      setGecmis((gecmisData ?? []).map(z => ({ id: z.id, tempId: z.id, firma_org_id: z.firma_org_id, firma_ad: z.firma_ad, giris_saati: z.giris_saati, cikis_saati: z.cikis_saati, sure_dakika: z.sure_dakika, gps_status: z.gps_status, check_in_distance_m: z.check_in_distance_m, qr_ile_giris: z.qr_ile_giris, isOffline: false })));
    } finally { setLoading(false); }
  }, [user?.id, setAktifZiyaret]);

  // localStorage cache'teki orgId'nin gerçekten OSGB olduğunu doğrula (eski hatalı cache temizle)
  useEffect(() => {
    const validateCache = async () => {
      try {
        const cached = JSON.parse(localStorage.getItem(LS_HEKIM_ORG) ?? 'null') as { orgId: string; uzmanAd: string } | null;
        if (!cached?.orgId) return;
        const { data } = await supabase.from('organizations').select('org_type, parent_org_id').eq('id', cached.orgId).maybeSingle();
        if (data && data.org_type !== 'osgb') {
          // Cache yanlış — temizle, yeniden resolve edilecek
          localStorage.removeItem(LS_HEKIM_ORG);
          setOsgbOrgId(null);
          setHekimAd('');
        }
      } catch { /* ignore */ }
    };
    void validateCache();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { void fetchZiyaret(); void fetchOrgInfo(); }, [fetchZiyaret, fetchOrgInfo]);
  useEffect(() => { if (isOnline) void fetchZiyaret(); }, [isOnline, fetchZiyaret]);

  const resolveOrg = useCallback(async (): Promise<{ orgId: string; uzman: string } | null> => {
    if (osgbOrgId) return { orgId: osgbOrgId, uzman: hekimAd || user?.email || 'Hekim' };
    try { const c = JSON.parse(localStorage.getItem(LS_HEKIM_ORG) ?? 'null') as { orgId: string; uzmanAd: string } | null; if (c?.orgId) return { orgId: c.orgId, uzman: c.uzmanAd }; } catch { /* ignore */ }
    if (!user?.id) return null;
    const { data } = await supabase.from('user_organizations').select('organization_id, display_name').eq('user_id', user.id).eq('is_active', true).maybeSingle();
    if (!data) return null;
    // OSGB org ID'sini doğru çöz: firma ise parent_org_id al
    const realOsgbId = await resolveOsgbOrgId(data.organization_id);
    const ad = data.display_name ?? user.email ?? 'Hekim';
    setOsgbOrgId(realOsgbId); setHekimAd(ad);
    localStorage.setItem(LS_HEKIM_ORG, JSON.stringify({ orgId: realOsgbId, uzmanAd: ad }));
    return { orgId: realOsgbId, uzman: ad };
  }, [osgbOrgId, hekimAd, user, resolveOsgbOrgId]);

  const handleCheckIn = useCallback(async (firmaId: string) => {
    if (!user?.id) { addToast('Oturum bulunamadı.', 'error'); return; }
    if (actionInProgress.current) return;
    actionInProgress.current = true;
    setActionLoading(true);
    setGpsError(null);
    try {
      const orgInfo = await resolveOrg();
      if (!orgInfo) { addToast('Organizasyon bilgisi bulunamadı.', 'error'); return; }
      const now = new Date().toISOString();
      const tempId = `htmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      let coords: GpsCoords | null = null;
      let checkInGpsStatus: 'ok' | 'too_far' | 'no_permission' = 'ok';
      let checkInDistanceM: number | null = null;

      if (isOnline) {
        const { data: firmaData } = await supabase.from('organizations').select('name, gps_required, gps_radius, gps_strict, firma_lat, firma_lng').eq('id', firmaId).maybeSingle() as { data: FirmaGpsInfo | null };
        if (!firmaData) { addToast('Firma bulunamadı. QR geçersiz olabilir.', 'error'); return; }
        const { data: existing } = await supabase.from('osgb_ziyaretler').select('id, firma_ad').eq('uzman_user_id', user.id).is('cikis_saati', null).limit(1).maybeSingle();
        if (existing) { addToast(`Zaten aktif bir ziyaretiniz var: ${existing.firma_ad ?? 'Firma'}. Önce mevcut ziyareti bitirin.`, 'error'); return; }

        if (firmaData.gps_required) {
          setGpsStatus('loading');
          coords = await getGpsCoords();
          if (!coords) { checkInGpsStatus = 'no_permission'; if (firmaData.gps_strict !== false) { setGpsStatus('denied'); setGpsError('Konum izni gerekli.'); return; } setGpsStatus('denied'); }
          if (coords && firmaData.firma_lat !== null && firmaData.firma_lng !== null) {
            setGpsStatus('checking');
            const dist = haversineMetres(coords.lat, coords.lng, firmaData.firma_lat, firmaData.firma_lng);
            const radius = firmaData.gps_radius ?? 1000;
            if (dist > radius) { checkInGpsStatus = 'too_far'; checkInDistanceM = Math.round(dist); setGpsStatus('blocked'); setGpsError(`Firma konumunda değilsiniz. Mesafe: ${dist >= 1000 ? (dist / 1000).toFixed(1) + ' km' : Math.round(dist) + ' m'}`); return; }
            checkInDistanceM = Math.round(dist); checkInGpsStatus = 'ok'; setGpsStatus('ok');
          }
        } else {
          setGpsStatus('loading'); coords = await getGpsCoords(); checkInGpsStatus = coords ? 'ok' : 'no_permission'; setGpsStatus(coords ? 'ok' : 'idle');
        }

        const { data: yeni, error } = await supabase.from('osgb_ziyaretler').insert({ osgb_org_id: orgInfo.orgId, firma_org_id: firmaId, firma_ad: firmaData.name, uzman_user_id: user.id, uzman_ad: orgInfo.uzman || user.email || 'Hekim', uzman_email: user.email, giris_saati: now, durum: 'aktif', qr_ile_giris: true, created_at: now, updated_at: now, check_in_lat: coords?.lat ?? null, check_in_lng: coords?.lng ?? null, gps_status: checkInGpsStatus, check_in_distance_m: checkInDistanceM }).select('id').maybeSingle();
        if (error) throw error;
        setAktifZiyaret({ id: yeni?.id ?? null, tempId: yeni?.id ?? tempId, firma_org_id: firmaId, firma_ad: firmaData.name, giris_saati: now, qr_ile_giris: true, isOffline: false });
        addToast(`İşlem başarıyla kaydedildi — ${firmaData.name} ziyareti başladı`, 'success');
        if (checkInGpsStatus === 'ok') setTimeout(() => { setGpsStatus('idle'); setGpsError(null); }, 3000);
      } else {
        setGpsStatus('loading'); coords = await getGpsCoords().catch(() => null); checkInGpsStatus = coords ? 'ok' : 'no_permission'; setGpsStatus('idle');
        const local = (() => { try { const r = localStorage.getItem(LS_HEKIM_AKTIF_ZIYARET); return r ? JSON.parse(r) as AktifZiyaret : null; } catch { return null; } })();
        if (local) { addToast('Aktif bir ziyaret zaten var (çevrimdışı). Önce bitirin.', 'error'); return; }

        const payload: ZiyaretCheckinPayload = { tempId, osgbOrgId: orgInfo.orgId, firmaOrgId: firmaId, firmaAd: `Firma (${firmaId.slice(0, 6)}...)`, uzmanUserId: user.id, uzmanAd: orgInfo.uzman || user.email || 'Hekim', uzmanEmail: user.email ?? null, girisAt: now, qrIleGiris: true, checkInLat: coords?.lat ?? null, checkInLng: coords?.lng ?? null, gpsStatus: checkInGpsStatus, checkInDistanceM };
        await addToQueue({ type: 'ziyaret_checkin', label: `Hekim ziyareti başlatıldı (çevrimdışı) — ${new Date(now).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`, payload: payload as unknown as Record<string, unknown> });
        setAktifZiyaret({ id: null, tempId, firma_org_id: firmaId, firma_ad: `Firma (${firmaId.slice(0, 6)}...)`, giris_saati: now, qr_ile_giris: true, isOffline: true });
        addToast('Ziyaret başlatıldı (çevrimdışı) — bağlantı gelince kaydedilecek.', 'success');
      }
      setShowQr(false);
    } catch (err) { addToast(`Check-in yapılamadı: ${err instanceof Error ? err.message : String(err)}`, 'error'); }
    finally { setActionLoading(false); actionInProgress.current = false; }
  }, [user, resolveOrg, addToast, isOnline, addToQueue, setAktifZiyaret]);

  const handleCheckOut = useCallback(async () => {
    if (!aktifZiyaret || !user?.id) return;
    if (actionInProgress.current) return;
    actionInProgress.current = true;
    setActionLoading(true); setGpsError(null); setGpsStatus('loading');
    let coords: GpsCoords | null = null;
    try { coords = await getGpsCoords(); } catch { coords = null; }
    setGpsStatus(coords ? 'ok' : 'idle');
    const now = new Date().toISOString();
    const sureDakika = Math.round((Date.now() - new Date(aktifZiyaret.giris_saati).getTime()) / 60000);
    try {
      if (isOnline && aktifZiyaret.id && !aktifZiyaret.isOffline) {
        // sure_dakika GENERATED ALWAYS — DB otomatik hesaplar, gönderilmez
        const { error } = await supabase.from('osgb_ziyaretler').update({ cikis_saati: now, durum: 'tamamlandi', updated_at: now, check_out_lat: coords?.lat ?? null, check_out_lng: coords?.lng ?? null }).eq('id', aktifZiyaret.id).is('cikis_saati', null);
        if (error) throw new Error(error.message);
        addToast(`İşlem başarıyla kaydedildi — ziyaret tamamlandı (${sureDakika} dk)`, 'success');
      } else {
        const payload: ZiyaretCheckoutPayload = { tempId: aktifZiyaret.tempId, realId: aktifZiyaret.id, uzmanUserId: user.id, cikisAt: now, sureDakika, checkOutLat: coords?.lat ?? null, checkOutLng: coords?.lng ?? null };
        await addToQueue({ type: 'ziyaret_checkout', label: `Hekim ziyareti bitirildi (çevrimdışı) — Süre: ${sureDakika} dk`, payload: payload as unknown as Record<string, unknown> });
        addToast('İşlem kaydedildi (çevrimdışı) — bağlantı gelince sunucuya gönderilecek', 'success');
      }
      setAktifZiyaret(null); setShowQr(false);
      if (isOnline) await fetchZiyaret();
    } catch (err) { addToast(`Check-out yapılamadı: ${err instanceof Error ? err.message : String(err)}`, 'error'); if (isOnline) await fetchZiyaret(); }
    finally { setActionLoading(false); actionInProgress.current = false; setTimeout(() => { setGpsStatus('idle'); setGpsError(null); }, 3000); }
  }, [aktifZiyaret, user?.id, addToast, isOnline, addToQueue, setAktifZiyaret, fetchZiyaret]);

  const handleQrResult = useCallback((text: string) => {
    setShowQr(false); setGpsError(null); setGpsStatus('idle');
    let firmaId: string | null = null;
    try { const p = JSON.parse(text) as { type?: string; id?: string }; if (p.type === 'firm' && p.id) firmaId = p.id; } catch { /* not JSON */ }
    if (!firmaId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text.trim())) firmaId = text.trim();
    if (!firmaId) firmaId = text.match(/firma[_-]?id=([0-9a-f-]{36})/i)?.[1] ?? null;
    if (!firmaId) { const segs = text.replace(/[?#].*/, '').split('/').filter(Boolean); const last = segs[segs.length - 1] ?? ''; if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(last)) firmaId = last; }
    if (!firmaId) { addToast('Geçersiz QR kodu.', 'error'); return; }
    if (aktifZiyaret) {
      if (aktifZiyaret.firma_org_id === firmaId) void handleCheckOut();
      else addToast(`Farklı firmada aktif ziyaret var (${aktifZiyaret.firma_ad ?? 'Firma'}). Önce bitirin.`, 'error');
    } else void handleCheckIn(firmaId);
  }, [aktifZiyaret, handleCheckIn, handleCheckOut, addToast]);

  const [detayZiyaret, setDetayZiyaret] = useState<AktifZiyaret | null>(null);

  const bg = isDark ? '#0a0f1a' : '#f0f9ff';
  const cardBg = isDark ? 'rgba(17,24,39,0.85)' : '#ffffff';
  const border = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = '#64748b';

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const formatDate = (iso: string) => { const d = new Date(iso); const t = new Date(); if (d.toDateString() === t.toDateString()) return 'Bugün'; const y = new Date(t); y.setDate(y.getDate() - 1); if (d.toDateString() === y.toDateString()) return 'Dün'; return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }); };

  type BandCfg = { bg: string; border: string; color: string; icon: string; text: string } | null;
  const gpsBandConfig: Record<GpsStatusType, BandCfg> = {
    idle: null,
    loading:  { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)',  color: '#D97706', icon: 'ri-loader-4-line animate-spin', text: 'Konum alınıyor...' },
    checking: { bg: 'rgba(14,165,233,0.08)', border: 'rgba(14,165,233,0.2)',  color: '#0284C7', icon: 'ri-map-pin-2-line',              text: 'Konum kontrol ediliyor...' },
    ok:       { bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.2)',   color: '#16A34A', icon: 'ri-map-pin-2-fill',              text: 'Konum doğrulandı' },
    denied:   { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', color: '#D97706', icon: 'ri-map-pin-line',                text: gpsError ? 'Konum izni gerekli' : 'Konum alınamadı' },
    blocked:  { bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.25)', color: '#DC2626', icon: 'ri-map-pin-line',                text: 'Firma konumunda değilsiniz' },
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4" style={{ background: bg, minHeight: '100vh' }}>
      <div className="w-12 h-12 flex items-center justify-center rounded-2xl" style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)' }}>
        <i className="ri-loader-4-line text-xl animate-spin" style={{ color: ACCENT }} />
      </div>
      <p className="text-sm font-semibold" style={{ color: textMuted }}>Yükleniyor...</p>
    </div>
  );

  const band = gpsBandConfig[gpsStatus];

  return (
    <div className="flex flex-col min-h-screen pb-8" style={{ maxWidth: '520px', margin: '0 auto', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes pulseRing{0%{transform:scale(1);opacity:.8}70%{transform:scale(1.8);opacity:0}100%{transform:scale(1.8);opacity:0}}
        @keyframes timerGlow{0%,100%{text-shadow:0 0 12px rgba(14,165,233,.3)}50%{text-shadow:0 0 24px rgba(14,165,233,.7)}}
        .hekim-timer-glow{animation:timerGlow 2s ease-in-out infinite}
        @keyframes qrPulseRing{0%,100%{opacity:0;transform:scale(1.1)}50%{opacity:1;transform:scale(1.3)}}
        @keyframes qrIdleScan{0%{top:18%;opacity:0.3}50%{top:72%;opacity:0.9}100%{top:18%;opacity:0.3}}
      `}</style>

      {/* Başlık Kartı — UzmanMobilSaha stilinde */}
      <div className="rounded-2xl overflow-hidden mb-4" style={{ background: 'var(--bg-card-solid, rgba(17,24,39,0.8))', border: '1px solid rgba(14,165,233,0.2)' }}>
        <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #0284C7 0%, #0EA5E9 50%, #38BDF8 100%)' }} />
        <div className="px-4 pt-3.5 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0 relative" style={{ background: 'linear-gradient(135deg,rgba(14,165,233,.2),rgba(14,165,233,.08))', border: '1.5px solid rgba(14,165,233,.3)' }}>
                <i className="ri-heart-pulse-line text-lg" style={{ color: ACCENT }} />
                {aktifZiyaret && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 flex items-center justify-center rounded-full" style={{ background: aktifZiyaret.isOffline ? '#F59E0B' : ACCENT, boxShadow: `0 0 8px ${aktifZiyaret.isOffline ? 'rgba(245,158,11,.6)' : 'rgba(14,165,233,.6)'}` }}><i className="ri-check-line text-white text-[8px] font-bold" /></span>}
              </div>
              <div>
                <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary, #f1f5f9)', letterSpacing: '-0.02em' }}>
                  {aktifZiyaret ? 'Aktif Ziyaret' : 'Hekim Saha Ziyareti'}
                </h2>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted, #64748b)' }}>
                  {aktifZiyaret ? aktifZiyaret.firma_ad ?? 'Firma' : 'QR ile check-in / check-out'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {pendingCount > 0 && isOnline && !isSyncing && (
                <button onClick={() => syncNow()} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all" style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', color: '#FBBF24' }}>
                  <i className="ri-time-line text-xs" /><span className="text-xs font-bold">{pendingCount}</span>
                </button>
              )}
              <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-full whitespace-nowrap" style={{ background: isOnline ? 'rgba(14,165,233,0.1)' : 'rgba(245,158,11,0.1)', color: isOnline ? ACCENT : '#F59E0B', border: `1px solid ${isOnline ? 'rgba(14,165,233,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: isOnline ? ACCENT : '#F59E0B' }} />
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
          {aktifZiyaret && (
            <div className="flex items-center gap-3 mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: aktifZiyaret.isOffline ? '#F59E0B' : ACCENT }} />
                <span className="text-[10px] font-bold" style={{ color: aktifZiyaret.isOffline ? '#D97706' : ACCENT }}>
                  {aktifZiyaret.isOffline ? 'ÇEVRİMDIŞI' : 'AKTİF ZİYARET'}
                </span>
              </div>
              <div className="w-px h-3" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <span className="text-[10px] font-mono font-bold" style={{ color: ACCENT }}>{elapsed || '00:00'}</span>
              <div className="w-px h-3" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <span className="text-[10px]" style={{ color: 'var(--text-muted, #64748b)' }}>
                {formatTime(aktifZiyaret.giris_saati)} giriş
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="mb-4"><HekimOfflineBant isOnline={isOnline} isSyncing={isSyncing} pendingCount={pendingCount} isDark={isDark} /></div>

      <div className="px-4 space-y-4">
        {band && (
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${band.border}` }}>
            <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: band.bg }}>
              <i className={`${band.icon} text-sm flex-shrink-0`} style={{ color: band.color }} />
              <span className="text-xs font-semibold flex-1" style={{ color: band.color }}>{band.text}</span>
              {(gpsStatus === 'blocked' || gpsStatus === 'denied') && <button onClick={() => { setGpsStatus('idle'); setGpsError(null); }} className="w-5 h-5 flex items-center justify-center rounded cursor-pointer flex-shrink-0" style={{ color: band.color, opacity: 0.7 }}><i className="ri-close-line text-xs" /></button>}
            </div>
            {gpsError && (gpsStatus === 'blocked' || gpsStatus === 'denied') && (
              <div className="px-3 pb-3 pt-1" style={{ background: band.bg }}>
                <p className="text-[11px] leading-relaxed" style={{ color: '#64748B' }}>{gpsError}</p>
                {gpsStatus === 'blocked' && <div className="flex items-center gap-1.5 mt-2 text-[10px] font-semibold" style={{ color: '#DC2626' }}><i className="ri-error-warning-line" />Check-in engellendi — fiziksel olarak firmada olmanız gerekiyor</div>}
              </div>
            )}
          </div>
        )}

        {aktifZiyaret ? (
          /* ── AKTİF ZİYARET KARTI ── */
          <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: `1.5px solid ${aktifZiyaret.isOffline ? 'rgba(245,158,11,.4)' : 'rgba(14,165,233,.3)'}` }}>
            <div className="h-[3px]" style={{ background: aktifZiyaret.isOffline ? 'linear-gradient(90deg,#D97706,#F59E0B,#FBBF24)' : `linear-gradient(90deg,${ACCENT_DARK},#38BDF8,${ACCENT})` }} />
            <div className="p-5">
              {/* Firma bilgisi */}
              <div className="flex items-center gap-4 mb-4">
                <div className="relative flex-shrink-0">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: aktifZiyaret.isOffline ? 'linear-gradient(135deg,rgba(245,158,11,.2),rgba(245,158,11,.06))' : 'linear-gradient(135deg,rgba(14,165,233,.2),rgba(14,165,233,.06))', border: `1px solid ${aktifZiyaret.isOffline ? 'rgba(245,158,11,.25)' : 'rgba(14,165,233,.25)'}` }}>
                    <i className="ri-building-2-line text-2xl" style={{ color: aktifZiyaret.isOffline ? '#F59E0B' : ACCENT }} />
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: aktifZiyaret.isOffline ? '#F59E0B' : ACCENT }}>
                    <div className="absolute inset-0 rounded-full" style={{ background: aktifZiyaret.isOffline ? '#F59E0B' : ACCENT, animation: 'pulseRing 2s ease-out infinite' }} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-extrabold leading-tight truncate" style={{ color: textPrimary, letterSpacing: '-0.02em' }}>{aktifZiyaret.firma_ad ?? 'Bilinmeyen Firma'}</p>
                  <div className="flex items-center gap-1.5 mt-1"><i className="ri-time-line text-xs" style={{ color: textMuted }} /><p className="text-xs" style={{ color: textMuted }}>Giriş: {formatTime(aktifZiyaret.giris_saati)} · {formatDate(aktifZiyaret.giris_saati)}</p></div>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {aktifZiyaret.isOffline && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,.15)', color: '#D97706', border: '1px solid rgba(245,158,11,.3)' }}>ÇEVRİMDIŞI</span>}
                    {aktifZiyaret.qr_ile_giris && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(14,165,233,.1)', color: ACCENT, border: '1px solid rgba(14,165,233,.2)' }}><i className="ri-qr-code-line mr-0.5" />QR</span>}
                  </div>
                </div>
              </div>

              {/* Süre göstergesi */}
              <div className="flex items-center justify-center py-6 rounded-2xl mb-4" style={{ background: aktifZiyaret.isOffline ? 'rgba(245,158,11,.06)' : 'rgba(14,165,233,.06)', border: `1px solid ${aktifZiyaret.isOffline ? 'rgba(245,158,11,.15)' : 'rgba(14,165,233,.15)'}` }}>
                <div className="text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[.14em] mb-2" style={{ color: aktifZiyaret.isOffline ? 'rgba(245,158,11,.6)' : 'rgba(14,165,233,.6)' }}>Geçen Süre</p>
                  <p className={`text-5xl font-black font-mono ${!aktifZiyaret.isOffline ? 'hekim-timer-glow' : ''}`} style={{ color: aktifZiyaret.isOffline ? '#F59E0B' : ACCENT, letterSpacing: '0.04em' }}>{elapsed || '00:00'}</p>
                  {aktifZiyaret.isOffline && <p className="text-[10px] mt-2 font-medium" style={{ color: '#D97706' }}>Bağlantı gelince senkronize edilecek</p>}
                </div>
              </div>

              {/* QR ile bitir */}
              {showQr ? (
                <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${aktifZiyaret.isOffline ? 'rgba(245,158,11,.2)' : 'rgba(14,165,233,.2)'}` }}>
                  <div className="flex items-center justify-between px-4 pt-3 pb-2">
                    <p className="text-sm font-semibold" style={{ color: textPrimary }}>Aynı Firma QR&apos;ını Okut</p>
                    <button onClick={() => setShowQr(false)} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(239,68,68,.1)', color: '#EF4444' }}><i className="ri-close-line text-sm" /></button>
                  </div>
                  <QrScanner onResult={handleQrResult} onClose={() => setShowQr(false)} />
                  <p className="text-center text-xs py-2" style={{ color: textMuted }}>Aynı firmayı okutunca ziyaret otomatik biter</p>
                </div>
              ) : (
                <>
                  <button onClick={() => setShowQr(true)} disabled={actionLoading} className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl cursor-pointer transition-all mb-3"
                    style={{ background: aktifZiyaret.isOffline ? 'rgba(245,158,11,.08)' : 'linear-gradient(135deg, rgba(14,165,233,0.1), rgba(2,132,199,0.05))', border: `2px dashed ${aktifZiyaret.isOffline ? 'rgba(245,158,11,.35)' : 'rgba(14,165,233,.35)'}`, color: aktifZiyaret.isOffline ? '#D97706' : ACCENT, opacity: actionLoading ? 0.6 : 1 }}>
                    <div className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: aktifZiyaret.isOffline ? 'rgba(245,158,11,.15)' : 'rgba(14,165,233,.15)' }}>
                      {actionLoading ? <i className="ri-loader-4-line animate-spin text-base" style={{ color: aktifZiyaret.isOffline ? '#F59E0B' : ACCENT }} /> : <i className="ri-qr-scan-2-line text-base" style={{ color: aktifZiyaret.isOffline ? '#F59E0B' : ACCENT }} />}
                    </div>
                    <div className="text-left"><p className="text-sm font-bold">QR ile Ziyareti Bitir</p><p className="text-xs" style={{ color: textMuted }}>{aktifZiyaret.isOffline ? 'Çevrimdışı kaydedilir' : 'Aynı firma QR kodunu okutun'}</p></div>
                    <i className="ri-arrow-right-s-line text-lg ml-auto" style={{ color: aktifZiyaret.isOffline ? '#F59E0B' : ACCENT }} />
                  </button>
                  {!actionLoading && <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}><i className="ri-information-line text-xs flex-shrink-0 mt-0.5" style={{ color: ACCENT }} /><p className="text-[10px] leading-relaxed" style={{ color: '#64748B' }}>Ziyareti bitirmek için aynı firmanın QR kodunu tekrar okutun.</p></div>}
                </>
              )}
            </div>
          </div>
        ) : (
          /* ── QR TARAMA (aktif ziyaret yok) ── */
          <div className="space-y-4">
            {/* Premium QR Butonu */}
            <div className="relative rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.06) 0%, rgba(2,132,199,0.04) 50%, rgba(56,189,248,0.06) 100%)', border: '1px solid rgba(14,165,233,0.18)' }}>
              <div className="absolute top-0 left-0 w-16 h-16 opacity-20" style={{ background: 'radial-gradient(circle at top left, rgba(14,165,233,0.4), transparent 70%)' }} />
              <div className="absolute bottom-0 right-0 w-20 h-20 opacity-15" style={{ background: 'radial-gradient(circle at bottom right, rgba(2,132,199,0.4), transparent 70%)' }} />

              {showQr ? (
                <div className="p-4 relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 flex items-center justify-center rounded-xl" style={{ background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.25)' }}>
                        <i className="ri-qr-scan-2-line text-xs" style={{ color: ACCENT }} />
                      </div>
                      <p className="text-sm font-bold" style={{ color: ACCENT, letterSpacing: '-0.02em' }}>QR Kod Taranıyor</p>
                    </div>
                    <button onClick={() => setShowQr(false)} className="w-7 h-7 flex items-center justify-center rounded-xl cursor-pointer transition-all" style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <i className="ri-close-line text-sm" />
                    </button>
                  </div>
                  <QrScanner onResult={handleQrResult} onClose={() => setShowQr(false)} />
                  <p className="text-center text-xs mt-3 leading-relaxed" style={{ color: textMuted }}>Firma QR kodunu çerçeve içine getirin — {!isOnline ? 'çevrimdışı kaydedilir' : 'otomatik check-in'}</p>
                </div>
              ) : (
                <button onClick={() => setShowQr(true)} disabled={actionLoading} className="w-full relative z-10 cursor-pointer transition-all duration-300" style={{ padding: '32px 24px', opacity: actionLoading ? 0.6 : 1 }}>
                  <div className="flex flex-col items-center gap-5">
                    <div className="relative">
                      <div className="absolute inset-0 rounded-2xl" style={{ background: 'rgba(14,165,233,0.06)', animation: 'qrPulseRing 3s ease-in-out infinite', transform: 'scale(1.3)' }} />
                      <div className="absolute inset-0 rounded-2xl" style={{ background: 'rgba(14,165,233,0.08)', animation: 'qrPulseRing 3s ease-in-out infinite 0.5s', transform: 'scale(1.15)' }} />
                      <div className="relative w-28 h-28 flex items-center justify-center rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.12), rgba(2,132,199,0.08))', border: '1.5px solid rgba(14,165,233,0.28)' }}>
                        <div className="absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 rounded-tl-lg" style={{ borderColor: ACCENT }} />
                        <div className="absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 rounded-tr-lg" style={{ borderColor: ACCENT }} />
                        <div className="absolute bottom-2 left-2 w-5 h-5 border-b-2 border-l-2 rounded-bl-lg" style={{ borderColor: ACCENT }} />
                        <div className="absolute bottom-2 right-2 w-5 h-5 border-b-2 border-r-2 rounded-br-lg" style={{ borderColor: ACCENT }} />
                        <div className="absolute left-4 right-4 h-0.5 rounded-full opacity-60" style={{ background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)`, animation: 'qrIdleScan 2.5s ease-in-out infinite', top: '30%' }} />
                        {actionLoading ? <i className="ri-loader-4-line animate-spin text-5xl" style={{ color: ACCENT }} /> : <i className="ri-qr-code-line text-5xl" style={{ color: ACCENT }} />}
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold mb-1.5" style={{ color: ACCENT, letterSpacing: '-0.03em' }}>{actionLoading ? 'İşleniyor...' : 'Firma QR Kodunu Tara'}</p>
                      <p className="text-xs font-medium" style={{ color: '#475569', lineHeight: '1.5' }}>{!isOnline ? 'Çevrimdışı modasındasınız — yerel kaydedilir' : 'Firmanın QR kodunu okutun — anında check-in'}</p>
                    </div>
                    {!actionLoading && <div className="flex items-center gap-2 px-5 py-2.5 rounded-full" style={{ background: `linear-gradient(135deg, rgba(14,165,233,0.2), rgba(2,132,199,0.15))`, border: '1px solid rgba(14,165,233,0.35)' }}><i className="ri-camera-line text-sm" style={{ color: ACCENT }} /><span className="text-sm font-bold" style={{ color: ACCENT }}>Kamerayı Aç</span><i className="ri-arrow-right-s-line text-base" style={{ color: 'rgba(14,165,233,0.6)' }} /></div>}
                  </div>
                </button>
              )}
            </div>

            {/* Bilgi kartları */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 px-3.5 py-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)' }}>
                  <i className="ri-history-line text-sm" style={{ color: ACCENT }} />
                </div>
                <div>
                  <p className="text-base font-bold" style={{ color: ACCENT }}>{gecmis.length}</p>
                  <p className="text-[10px] font-medium" style={{ color: '#475569' }}>Geçmiş ziyaret</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-3.5 py-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: isOnline ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', border: `1px solid ${isOnline ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
                  <i className={`${isOnline ? 'ri-wifi-line' : 'ri-wifi-off-line'} text-sm`} style={{ color: isOnline ? '#22C55E' : '#F59E0B' }} />
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: isOnline ? '#22C55E' : '#F59E0B' }}>{isOnline ? 'Online' : 'Offline'}</p>
                  <p className="text-[10px] font-medium" style={{ color: '#475569' }}>{isOnline ? 'Canlı bağlantı' : 'Yerel kayıt'}</p>
                </div>
              </div>
            </div>

            {/* Nasıl çalışır */}
            {!showQr && !actionLoading && (
              <div className="rounded-2xl px-4 py-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#334155' }}>NASIL ÇALIŞIR</p>
                <div className="space-y-2.5">
                  {[
                    { icon: 'ri-qr-code-line', color: ACCENT, text: 'Firmadaki QR kodu kameranıza gösterin' },
                    { icon: 'ri-map-pin-user-line', color: '#38BDF8', text: 'Sistem konumu doğrulayıp check-in yapar' },
                    { icon: 'ri-check-double-line', color: ACCENT_DARK, text: 'Çıkarken aynı QR ile ziyareti bitirin' },
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-7 h-7 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: `${step.color}12`, border: `1px solid ${step.color}22` }}><i className={`${step.icon} text-xs`} style={{ color: step.color }} /></div>
                      <p className="text-xs font-medium" style={{ color: '#475569' }}>{step.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {gecmis.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${border}` }}>
            <div className="px-4 pt-4 pb-2 flex items-center gap-2">
              <div className="w-6 h-6 flex items-center justify-center rounded-lg" style={{ background: 'rgba(14,165,233,.1)', border: '1px solid rgba(14,165,233,.2)' }}>
                <i className="ri-history-line text-xs" style={{ color: ACCENT }} />
              </div>
              <p className="text-xs font-bold uppercase tracking-[.12em]" style={{ color: textMuted }}>Son Ziyaretler</p>
              <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(14,165,233,.1)', color: ACCENT }}>{gecmis.length}</span>
            </div>
            <div className="px-3 pb-3 space-y-1.5">
              {gecmis.map(z => {
                const sureDk = z.sure_dakika;
                const sureStr = sureDk ? (sureDk >= 60 ? `${Math.floor(sureDk/60)}s ${sureDk%60}dk` : `${sureDk}dk`) : null;
                return (
                <button key={z.id ?? z.tempId} onClick={() => setDetayZiyaret(z)} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left cursor-pointer transition-all" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${border}` }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,.3)'; (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.04)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = border; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(14,165,233,.08)', border: '1px solid rgba(14,165,233,.15)' }}>
                    <i className="ri-building-2-line text-sm" style={{ color: ACCENT }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: textPrimary }}>{z.firma_ad ?? '—'}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: textMuted }}>{formatDate(z.giris_saati)} · {formatTime(z.giris_saati)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {sureStr && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(14,165,233,.1)', color: ACCENT, border: '1px solid rgba(14,165,233,.2)' }}>{sureStr}</span>}
                    {z.gps_status === 'ok' && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,.1)', color: '#22C55E' }}><i className="ri-map-pin-line" /></span>}
                    <i className="ri-arrow-right-s-line text-lg" style={{ color: '#475569' }} />
                  </div>
                </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {/* Geçmiş ziyaret detay popup */}
      {detayZiyaret && (
        <div className="fixed inset-0 flex items-end justify-center z-50" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => setDetayZiyaret(null)}>
          <div className="w-full max-w-md rounded-t-3xl p-5 space-y-3" style={{ background: cardBg, border: `1px solid ${border}` }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-center mb-1"><div className="w-10 h-1 rounded-full" style={{ background: border }} /></div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold" style={{ color: textPrimary }}>Ziyaret Detayı</p>
              <button onClick={() => setDetayZiyaret(null)} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(239,68,68,.1)', color: '#EF4444' }}><i className="ri-close-line text-sm" /></button>
            </div>
            <div className="rounded-xl p-4 space-y-2.5" style={{ background: isDark ? 'rgba(255,255,255,.04)' : 'rgba(15,23,42,.03)', border: `1px solid ${border}` }}>
              <div className="flex items-center gap-2"><i className="ri-building-2-line text-sm" style={{ color: ACCENT }} /><p className="text-sm font-bold" style={{ color: textPrimary }}>{detayZiyaret.firma_ad ?? '—'}</p></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg p-2.5" style={{ background: isDark ? 'rgba(14,165,233,.08)' : 'rgba(14,165,233,.05)' }}>
                  <p className="text-[10px]" style={{ color: textMuted }}>Giriş</p>
                  <p className="text-xs font-bold" style={{ color: textPrimary }}>{new Date(detayZiyaret.giris_saati).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</p>
                  <p className="text-[10px]" style={{ color: textMuted }}>{new Date(detayZiyaret.giris_saati).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}</p>
                </div>
                <div className="rounded-lg p-2.5" style={{ background: isDark ? 'rgba(148,163,184,.08)' : 'rgba(148,163,184,.05)' }}>
                  <p className="text-[10px]" style={{ color: textMuted }}>Çıkış</p>
                  <p className="text-xs font-bold" style={{ color: textPrimary }}>{detayZiyaret.cikis_saati ? new Date(detayZiyaret.cikis_saati).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—'}</p>
                  <p className="text-[10px]" style={{ color: textMuted }}>{detayZiyaret.cikis_saati ? new Date(detayZiyaret.cikis_saati).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }) : ''}</p>
                </div>
              </div>
              {detayZiyaret.sure_dakika != null && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(99,102,241,.08)' }}>
                  <i className="ri-timer-line text-sm" style={{ color: '#6366F1' }} />
                  <span className="text-xs font-bold" style={{ color: '#6366F1' }}>
                    {detayZiyaret.sure_dakika >= 60 ? `${Math.floor(detayZiyaret.sure_dakika/60)} saat ${detayZiyaret.sure_dakika%60} dakika` : `${detayZiyaret.sure_dakika} dakika`}
                  </span>
                </div>
              )}
              {detayZiyaret.gps_status && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: detayZiyaret.gps_status === 'ok' ? 'rgba(34,197,94,.08)' : detayZiyaret.gps_status === 'too_far' ? 'rgba(239,68,68,.08)' : 'rgba(245,158,11,.08)' }}>
                  <i className="ri-map-pin-2-line text-sm" style={{ color: detayZiyaret.gps_status === 'ok' ? '#22C55E' : detayZiyaret.gps_status === 'too_far' ? '#EF4444' : '#F59E0B' }} />
                  <span className="text-xs font-semibold" style={{ color: detayZiyaret.gps_status === 'ok' ? '#16A34A' : detayZiyaret.gps_status === 'too_far' ? '#DC2626' : '#D97706' }}>
                    {detayZiyaret.gps_status === 'ok' ? 'Konum doğrulandı' : detayZiyaret.gps_status === 'too_far' ? `Kapsam dışı${detayZiyaret.check_in_distance_m ? ` (${detayZiyaret.check_in_distance_m}m)` : ''}` : 'GPS alınamadı'}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                {detayZiyaret.qr_ile_giris && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(14,165,233,.1)', color: ACCENT, border: '1px solid rgba(14,165,233,.2)' }}><i className="ri-qr-code-line mr-0.5" />QR Girişi</span>}
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(148,163,184,.1)', color: '#94A3B8', border: '1px solid rgba(148,163,184,.2)' }}>Tamamlandı</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
