import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  Firma, Personel, Evrak, Egitim, Muayene, Uygunsuzluk, Ekipman, Gorev, Tutanak, CurrentUser,
  UygunsuzlukStatus, IsIzni,
} from '../types';
import { getEvrakKategori } from '../utils/evrakKategori';
import { supabase } from '../lib/supabase';
import { uploadFileToStorage } from '../utils/fileUpload';

// ──────── ID & numbering ────────
function genId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

// ── Supabase RPC ile race-condition-safe numara üretimi ──
async function generateRecordNoFromDB(type: 'dof' | 'tutanak' | 'is_izni'): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('generate_record_no', { record_type: type });
    if (error) {
      console.error(`[ISG] generateRecordNo RPC error (${type}):`, error);
      return null;
    }
    return data as string;
  } catch (err) {
    console.error(`[ISG] generateRecordNo unexpected error (${type}):`, err);
    return null;
  }
}

// Fallback: frontend'de üret (RPC başarısız olursa)
export function generateTutanakNo(existing: { tutanakNo: string }[]): string {
  const year = new Date().getFullYear();
  const prefix = `TTK-${year}-`;
  const maxNum = existing
    .filter(t => t.tutanakNo?.startsWith(prefix))
    .map(t => parseInt(t.tutanakNo.replace(prefix, ''), 10))
    .filter(n => !isNaN(n))
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}${String(maxNum + 1).padStart(4, '0')}`;
}

export function generateDofNo(existing: { acilisNo?: string }[]): string {
  const year = new Date().getFullYear();
  const prefix = `DÖF-${year}-`;
  const maxNum = existing
    .filter(u => u.acilisNo?.startsWith(prefix))
    .map(u => parseInt(u.acilisNo!.replace(prefix, ''), 10))
    .filter(n => !isNaN(n))
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}${String(maxNum + 1).padStart(4, '0')}`;
}

export function generateIsIzniNo(existing: { izinNo: string }[]): string {
  const year = new Date().getFullYear();
  const prefix = `IZN-${year}-`;
  const maxNum = existing
    .filter(t => t.izinNo?.startsWith(prefix))
    .map(t => parseInt(t.izinNo.replace(prefix, ''), 10))
    .filter(n => !isNaN(n))
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}${String(maxNum + 1).padStart(4, '0')}`;
}

const defaultUser: CurrentUser = { id: 'u1', ad: '', email: '', rol: 'Admin' };

export type LogFn = (
  actionType: string, module: string, recordId: string, recordName?: string, description?: string,
) => void;

// ──────── Supabase DB helpers ────────
// Device ID helper — her sekme/cihaz için unique
function getDeviceId(): string {
  let id = sessionStorage.getItem('isg_device_id');
  if (!id) {
    id = `dev_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
    sessionStorage.setItem('isg_device_id', id);
  }
  return id;
}

async function dbUpsert(
  table: string,
  item: { id: string } & Record<string, unknown>,
  userId: string,
  organizationId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const isSilinmis = item.silinmis === true;
  const silinmeTarihi = typeof item.silinmeTarihi === 'string' ? item.silinmeTarihi : (isSilinmis ? now : null);
  const payload: Record<string, unknown> = {
    id: item.id,
    user_id: userId,
    organization_id: organizationId,
    device_id: getDeviceId(),
    data: item,
    updated_at: now,
    deleted_at: isSilinmis ? silinmeTarihi : null,
  };
  console.log(`[ISG] Saving ${table}/${item.id}`, { organization_id: organizationId, user_id: userId, deleted_at: payload.deleted_at });
  const { data, error } = await supabase.from(table).upsert(payload, { onConflict: 'id' }).select('id');
  if (error) {
    const errMsg = error.message || error.details || error.hint || JSON.stringify(error);
    console.error(`[ISG] SAVE ERROR ${table}/${item.id}:`, errMsg, error);
    // RLS hatasını daha anlaşılır göster
    if (errMsg.includes('row-level security') || errMsg.includes('RLS') || errMsg.includes('policy')) {
      throw new Error(`Yetki hatası: Bu işlem için yetkiniz yok. (${errMsg})`);
    }
    throw new Error(errMsg);
  }
  if (!data || data.length === 0) {
    // Önce kaydın var olup olmadığını kontrol et
    const { data: existing } = await supabase.from(table).select('id').eq('id', item.id).maybeSingle();
    if (!existing) {
      const msg = `Kayıt veritabanına yazılamadı (${table}). RLS politikası engelliyor olabilir.`;
      console.error(`[ISG] ${msg}`);
      throw new Error(msg);
    }
    // Kayıt var ama select döndürmedi — bu normal olabilir (RLS select kısıtlaması)
    console.log(`[ISG] SAVE OK ${table}/${item.id} ✓ (verified via select)`);
    return;
  }
  console.log(`[ISG] SAVE OK ${table}/${item.id} ✓ (rows confirmed: ${data.length})`);
}

async function dbDelete(table: string, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) {
    const errMsg = error.message || error.details || error.hint || JSON.stringify(error);
    console.error(`[ISG] DELETE ERROR ${table}/${id}:`, errMsg, error);
    throw new Error(errMsg);
  }
  console.log(`[ISG] DELETE OK ${table}/${id} ✓`);
}

async function dbDeleteMany(table: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from(table).delete().in('id', ids);
  if (error) {
    const errMsg = error.message || error.details || error.hint || JSON.stringify(error);
    console.error(`[ISG] DELETE_MANY ERROR ${table}:`, errMsg, error);
    throw new Error(errMsg);
  }
  console.log(`[ISG] DELETE_MANY OK ${table} (${ids.length} rows) ✓`);
}

// ──────── IndexedDB Cache ────────
// localStorage 5MB limitini aşmamak için IndexedDB kullanıyoruz
const DB_NAME = 'isg_cache';
const DB_VERSION = 1;
const STORE_NAME = 'tables';
// Cache sadece sayfa yenileme anında kullanılır — realtime zaten anlık günceller
// 30 saniye: yenileme sonrası hızlı açılış için yeterli, stale veri riski yok
const CACHE_TTL_MS = 30 * 1000; // 30 saniye

function openCacheDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readCache<T>(key: string): Promise<{ data: T; ts: number } | null> {
  try {
    const db = await openCacheDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

async function writeCache<T>(key: string, data: T): Promise<void> {
  try {
    const db = await openCacheDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ data, ts: Date.now() }, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { /* ignore */ }
}

// ──────── Main hook ────────
export function useStore(
  organizationId: string | null,
  logFn?: LogFn,
  onSaveError?: (msg: string) => void,
  userId?: string,
  orgLoading?: boolean,
  onRemoteChange?: (module: string) => void,
) {
  const [firmalar, _setFirmalar] = useState<Firma[]>([]);
  const [personeller, _setPersoneller] = useState<Personel[]>([]);
  const [evraklar, _setEvraklar] = useState<Evrak[]>([]);
  const [egitimler, _setEgitimler] = useState<Egitim[]>([]);
  const [muayeneler, _setMuayeneler] = useState<Muayene[]>([]);
  const [uygunsuzluklar, _setUygunsuzluklar] = useState<Uygunsuzluk[]>([]);
  const [ekipmanlar, _setEkipmanlar] = useState<Ekipman[]>([]);
  const [gorevler, _setGorevler] = useState<Gorev[]>([]);
  const [tutanaklar, _setTutanaklar] = useState<Tutanak[]>([]);
  const [isIzinleri, _setIsIzinleri] = useState<IsIzni[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser>(defaultUser);
  const [dataLoading, setDataLoading] = useState(true);
  // pageLoading: ilk açılış — henüz hiç veri yok, tüm sayfa skeleton gösterilir
  const [pageLoading, setPageLoading] = useState(true);
  // partialLoading: veri var ama arka planda güncelleniyor (yenile butonu, refresh)
  const [partialLoading, setPartialLoading] = useState(false);
  // realtimeStatus: Supabase realtime channel bağlantı durumu
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');

  const uygRef = useRef<Uygunsuzluk[]>([]);
  const tutRef = useRef<Tutanak[]>([]);
  const isIzRef = useRef<IsIzni[]>([]);
  const logFnRef = useRef(logFn);
  useEffect(() => { logFnRef.current = logFn; }, [logFn]);
  const onSaveErrorRef = useRef(onSaveError);
  useEffect(() => { onSaveErrorRef.current = onSaveError; }, [onSaveError]);
  const onRemoteChangeRef = useRef(onRemoteChange);
  useEffect(() => { onRemoteChangeRef.current = onRemoteChange; }, [onRemoteChange]);

  const orgIdRef = useRef(organizationId);
  const userIdRef = useRef(userId);
  useEffect(() => { orgIdRef.current = organizationId; }, [organizationId]);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

    // ── Kendi silme işlemlerimizi takip et — realtime'da "başka kullanıcı" bildirimi çıkmasın ──
  const ownDeletesRef = useRef<Set<string>>(new Set());

  // ── Pending saves queue ──
  const pendingSavesRef = useRef<{ table: string; item: { id: string } & Record<string, unknown> }[]>([]);

  // Flush fonksiyonu — org hazır olunca pending queue'yu gönder
  const flushPendingSaves = useCallback(() => {
    const orgId = orgIdRef.current;
    const uid = userIdRef.current;
    if (!orgId || !uid) return;
    if (pendingSavesRef.current.length === 0) return;
    const pending = [...pendingSavesRef.current];
    pendingSavesRef.current = [];
    console.log(`[ISG] Flushing ${pending.length} pending saves for org=${orgId}`);
    pending.forEach(({ table, item }) => {
      dbUpsert(table, item, uid, orgId).then(() => {
        console.log(`[ISG] Pending save OK ${table}/${item.id} ✓`);
      }).catch(err => {
        console.error(`[ISG] Pending save FAILED ${table}/${item.id}:`, err);
        // Başarısız olanı tekrar queue'ya ekle
        pendingSavesRef.current.push({ table, item });
        onSaveErrorRef.current?.(`Bekleyen kayıt hatası (${table}): ${err instanceof Error ? err.message : String(err)}`);
      });
    });
  }, []);

  // org/user hazır olunca flush
  useEffect(() => {
    if (!organizationId || !userId || orgLoading) return;
    flushPendingSaves();
  }, [organizationId, userId, orgLoading, flushPendingSaves]);

  // ── Online event listener — internet gelince pending saves flush et ──
  useEffect(() => {
    const handleOnline = () => {
      console.log('[ISG] Network online — flushing pending saves...');
      flushPendingSaves();
    };
    window.addEventListener('online', handleOnline);
    // Sayfa açıldığında zaten online ise de flush et
    if (navigator.onLine) flushPendingSaves();
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [flushPendingSaves]);

  // ── Stable setters ──
  const setFirmalar = useCallback((u: Firma[] | ((p: Firma[]) => Firma[])) => { _setFirmalar(u); }, []);
  const setPersoneller = useCallback((u: Personel[] | ((p: Personel[]) => Personel[])) => { _setPersoneller(u); }, []);
  const setEvraklar = useCallback((u: Evrak[] | ((p: Evrak[]) => Evrak[])) => { _setEvraklar(u); }, []);
  const setEgitimler = useCallback((u: Egitim[] | ((p: Egitim[]) => Egitim[])) => { _setEgitimler(u); }, []);
  const setMuayeneler = useCallback((u: Muayene[] | ((p: Muayene[]) => Muayene[])) => { _setMuayeneler(u); }, []);
  const setUygunsuzluklar = useCallback((u: Uygunsuzluk[] | ((p: Uygunsuzluk[]) => Uygunsuzluk[])) => {
    _setUygunsuzluklar(prev => {
      const next = typeof u === 'function' ? u(prev) : u;
      uygRef.current = next;
      return next;
    });
  }, []);
  const setEkipmanlar = useCallback((u: Ekipman[] | ((p: Ekipman[]) => Ekipman[])) => { _setEkipmanlar(u); }, []);
  const setGorevler = useCallback((u: Gorev[] | ((p: Gorev[]) => Gorev[])) => { _setGorevler(u); }, []);
  const setTutanaklar = useCallback((u: Tutanak[] | ((p: Tutanak[]) => Tutanak[])) => {
    _setTutanaklar(prev => {
      const next = typeof u === 'function' ? u(prev) : u;
      tutRef.current = next;
      return next;
    });
  }, []);
  const setIsIzinleri = useCallback((u: IsIzni[] | ((p: IsIzni[]) => IsIzni[])) => {
    _setIsIzinleri(prev => {
      const next = typeof u === 'function' ? u(prev) : u;
      isIzRef.current = next;
      return next;
    });
  }, []);

  // ── DB write helpers ──
  const saveToDb = useCallback(async (table: string, item: { id: string } & Record<string, unknown>, throwOnError = false): Promise<void> => {
    const orgId = orgIdRef.current;
    const uid = userIdRef.current;
    if (!orgId || !uid) {
      console.warn(`[ISG] SAVE QUEUED ${table}/${item.id}: orgId=${orgId} userId=${uid} not ready yet`);
      pendingSavesRef.current.push({ table, item });
      if (throwOnError) throw new Error(`Organizasyon bilgisi henüz hazır değil. Lütfen tekrar deneyin.`);
      return;
    }
    try {
      await dbUpsert(table, item, uid, orgId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ISG] SAVE FAILED ${table}/${item.id}:`, msg);
      onSaveErrorRef.current?.(`Kayıt hatası (${table}): ${msg}`);
      if (throwOnError) throw err;
    }
  }, []);

  const deleteFromDb = useCallback(async (table: string, id: string) => {
    try {
      await dbDelete(table, id);
    } catch (err) {
      console.error(`[ISG] DELETE FAILED ${table}/${id}:`, err);
    }
  }, []);

  const deleteManyFromDb = useCallback(async (table: string, ids: string[]) => {
    if (ids.length === 0) return;
    try {
      await dbDeleteMany(table, ids);
    } catch (err) {
      console.error(`[ISG] DELETE_MANY FAILED ${table}:`, err);
    }
  }, []);

  // ── Paginated fetch — bypasses Supabase's 1000-row default limit ──
  const fetchAllRows = useCallback(async (
    table: string,
    orgId: string,
  ): Promise<{ data: { data: unknown }[] | null; error: unknown }> => {
    const PAGE_SIZE = 500; // Smaller page size for reliability
    let allRows: { data: unknown }[] = [];
    let from = 0;
    let hasMore = true;
    let pageNum = 0;

    while (hasMore) {
      pageNum++;
      const to = from + PAGE_SIZE - 1;
      console.log(`[ISG] fetchAllRows ${table} page=${pageNum} range=${from}-${to}`);

      const { data, error } = await supabase
        .from(table)
        .select('id, data, created_at')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error(`[ISG] fetchAllRows error (${table}) page=${pageNum}:`, error);
        // Return what we have so far rather than nothing
        return { data: allRows.length > 0 ? allRows as { data: unknown }[] : null, error };
      }

      const rows = data ?? [];
      allRows = allRows.concat(rows as { data: unknown }[]);

      console.log(`[ISG] fetchAllRows ${table} page=${pageNum} got=${rows.length} total_so_far=${allRows.length}`);

      // Stop if we got fewer rows than requested (last page)
      if (rows.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        from += PAGE_SIZE;
      }

      // Safety: max 20 pages (10,000 rows) to prevent infinite loops
      if (pageNum >= 20) {
        console.warn(`[ISG] fetchAllRows ${table}: reached max pages (20), stopping`);
        hasMore = false;
      }
    }

    console.log(`[ISG] fetchAllRows DONE: ${table} total=${allRows.length} pages=${pageNum}`);
    return { data: allRows as { data: unknown }[], error: null };
  }, []);

  // ── Shared helpers ──
  const KAN: Record<string, string> = {
    'A Rh+': 'A+', 'A Rh-': 'A-', 'B Rh+': 'B+', 'B Rh-': 'B-',
    'AB Rh+': 'AB+', 'AB Rh-': 'AB-', '0 Rh+': '0+', '0 Rh-': '0-',
  };

  const extractRows = useCallback(<T>(
    settled: PromiseSettledResult<{ data: { data: unknown }[] | null; error: unknown }>,
  ): T[] => {
    if (settled.status === 'rejected') { console.error('[ISG] Table load rejected:', settled.reason); return []; }
    const res = settled.value;
    if (res.error) { console.error('[ISG] Load error:', res.error); return []; }
    return (res.data ?? []).map(row => row.data as T);
  }, []);

  // ── Generic cache-first fetch helper ──
  const fetchWithCache = useCallback(async <T>(
    table: string,
    orgId: string,
    setter: (rows: T[]) => void,
    transform?: (row: T) => T,
  ): Promise<void> => {
    const cacheKey = `${table}_${orgId}`;

    // 1. Cache'ten anında yükle
    const cached = await readCache<T[]>(cacheKey);
    if (cached) {
      setter(cached.data);
      console.log(`[ISG] fetch ${table} cache HIT (${cached.data.length} rows)`);
      // Fresh ise DB'ye gitme
      if ((Date.now() - cached.ts) < CACHE_TTL_MS) {
        console.log(`[ISG] fetch ${table} cache FRESH — skipping DB`);
        return;
      }
    }

    // 2. DB'den çek
    const res = await fetchAllRows(table, orgId);
    if (!res.data) return;
    let rows = res.data.map(r => r.data as T);
    if (transform) rows = rows.map(transform);
    setter(rows);
    void writeCache(cacheKey, rows);
    console.log(`[ISG] fetch ${table} DB ✓ (${rows.length} rows) → cache updated`);
  }, [fetchAllRows]);

  // ── Per-table fetch functions (lazy load, cache-first) ──
  const fetchFirmalar = useCallback(async (orgId: string) => {
    await fetchWithCache<Firma>('firmalar', orgId, setFirmalar);
  }, [fetchWithCache, setFirmalar]);

  const fetchPersoneller = useCallback(async (orgId: string) => {
    await fetchWithCache<Personel>('personeller', orgId, setPersoneller, p => ({
      ...p, kanGrubu: KAN[p.kanGrubu ?? ''] ?? (p.kanGrubu ?? ''),
    }));
  }, [fetchWithCache, setPersoneller]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchEvraklar = useCallback(async (orgId: string) => {
    await fetchWithCache<Evrak>('evraklar', orgId, setEvraklar, e => ({
      ...e, kategori: e.kategori || getEvrakKategori(e.tur ?? '', e.ad ?? ''),
    }));
  }, [fetchWithCache, setEvraklar]);

  const fetchEgitimler = useCallback(async (orgId: string) => {
    await fetchWithCache<Egitim>('egitimler', orgId, setEgitimler);
  }, [fetchWithCache, setEgitimler]);

  const fetchMuayeneler = useCallback(async (orgId: string) => {
    await fetchWithCache<Muayene>('muayeneler', orgId, setMuayeneler);
  }, [fetchWithCache, setMuayeneler]);

  const fetchUygunsuzluklar = useCallback(async (orgId: string) => {
    await fetchWithCache<Uygunsuzluk>('uygunsuzluklar', orgId, setUygunsuzluklar, u => {
      let durum = u.durum as string;
      if (durum === 'Kapatıldı') durum = 'Kapandı';
      if (durum === 'İncelemede') durum = 'Açık';
      return { ...u, durum: durum as UygunsuzlukStatus };
    });
  }, [fetchWithCache, setUygunsuzluklar]);

  const fetchEkipmanlar = useCallback(async (orgId: string) => {
    await fetchWithCache<Ekipman>('ekipmanlar', orgId, setEkipmanlar);
  }, [fetchWithCache, setEkipmanlar]);

  const fetchGorevler = useCallback(async (orgId: string) => {
    await fetchWithCache<Gorev>('gorevler', orgId, setGorevler);
  }, [fetchWithCache, setGorevler]);

  const fetchTutanaklar = useCallback(async (orgId: string) => {
    await fetchWithCache<Tutanak>('tutanaklar', orgId, setTutanaklar);
  }, [fetchWithCache, setTutanaklar]);

  const fetchIsIzinleri = useCallback(async (orgId: string) => {
    await fetchWithCache<IsIzni>('is_izinleri', orgId, setIsIzinleri);
  }, [fetchWithCache, setIsIzinleri]);

  // ── Core data loader — cache-first, sonra arka planda güncelle ──
  const loadAllData = useCallback(async (orgId: string) => {
    const firmaKey = `firmalar_${orgId}`;
    const personelKey = `personeller_${orgId}`;

    // 1. Cache'ten anında yükle (varsa)
    const [cachedFirmalar, cachedPersoneller] = await Promise.all([
      readCache<Firma[]>(firmaKey),
      readCache<Personel[]>(personelKey),
    ]);

    const now = Date.now();
    const firmaFresh = cachedFirmalar && (now - cachedFirmalar.ts) < CACHE_TTL_MS;
    const personelFresh = cachedPersoneller && (now - cachedPersoneller.ts) < CACHE_TTL_MS;

    if (cachedFirmalar) {
      setFirmalar(cachedFirmalar.data);
      console.log(`[ISG] loadAllData cache HIT firmalar (${cachedFirmalar.data.length} rows, ${firmaFresh ? 'fresh' : 'stale'})`);
    }
    if (cachedPersoneller) {
      setPersoneller(cachedPersoneller.data);
      console.log(`[ISG] loadAllData cache HIT personeller (${cachedPersoneller.data.length} rows, ${personelFresh ? 'fresh' : 'stale'})`);
    }

    // Cache varsa ve fresh ise → pageLoading'i hemen kapat (kullanıcı anında görür)
    if (cachedFirmalar && cachedPersoneller) {
      setPageLoading(false);
      setDataLoading(false);
    }

    // 2. Stale veya cache yok → DB'den çek
    const needsFirma = !firmaFresh;
    const needsPersonel = !personelFresh;

    if (!needsFirma && !needsPersonel) {
      console.log('[ISG] loadAllData: both fresh from cache, skipping DB fetch');
      return;
    }

    const results = await Promise.allSettled([
      needsFirma ? fetchAllRows('firmalar', orgId) : Promise.resolve({ data: null, error: null }),
      needsPersonel ? fetchAllRows('personeller', orgId) : Promise.resolve({ data: null, error: null }),
    ]);

    const [firmaRes, personelRes] = results;

    if (needsFirma && firmaRes.status === 'fulfilled' && firmaRes.value.data) {
      const rows = extractRows<Firma>(firmaRes as PromiseSettledResult<{ data: { data: unknown }[] | null; error: unknown }>);
      setFirmalar(rows);
      void writeCache(firmaKey, rows);
      console.log(`[ISG] loadAllData DB firmalar ✓ (${rows.length} rows) → cache updated`);
    }

    if (needsPersonel && personelRes.status === 'fulfilled' && personelRes.value.data) {
      const rows = extractRows<Personel>(personelRes as PromiseSettledResult<{ data: { data: unknown }[] | null; error: unknown }>)
        .map(p => ({ ...p, kanGrubu: KAN[p.kanGrubu ?? ''] ?? (p.kanGrubu ?? '') }));
      setPersoneller(rows);
      void writeCache(personelKey, rows);
      console.log(`[ISG] loadAllData DB personeller ✓ (${rows.length} rows) → cache updated`);
    }
  }, [fetchAllRows, setFirmalar, setPersoneller, extractRows]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Public refresh function — called by UI refresh buttons ──
  const refreshAllData = useCallback(async () => {
    const orgId = orgIdRef.current;
    if (!orgId) return;
    setDataLoading(true);
    setPartialLoading(true);
    try {
      // Hem firmalar/personeller hem ekipmanlar dahil tüm tabloları yenile
      await Promise.all([
        loadAllData(orgId),
        fetchEkipmanlar(orgId),
      ]);
    } finally {
      setDataLoading(false);
      setPartialLoading(false);
    }
  }, [loadAllData, fetchEkipmanlar]);

  // ── Load from Supabase ──
  useEffect(() => {
    if (orgLoading) return;
    if (!organizationId || !userId) {
      setFirmalar([]); setPersoneller([]); setEvraklar([]);
      setEgitimler([]); setMuayeneler([]); setUygunsuzluklar([]);
      setEkipmanlar([]); setGorevler([]); setTutanaklar([]); setIsIzinleri([]);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    setPageLoading(true);  // ilk yükleme — tüm sayfa skeleton
    console.log(`[ISG] Loading data for org=${organizationId} user=${userId}`);

    const orgId = organizationId;
    loadAllData(orgId).then(() => {
      setDataLoading(false);
      setPageLoading(false); // veri geldi — skeleton kaldır
      // Ekipmanlar: aktif + silinmiş ayrı sorgularla çek
      fetchEkipmanlar(orgId);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, userId, orgLoading]);

  // ── Real-time subscription ──
  useEffect(() => {
    if (!organizationId || !userId || orgLoading) return;

    // Bu closure içinde her zaman güncel orgId'yi kullanmak için ref al
    const activeOrgId = organizationId;

    const KAN: Record<string, string> = { 'A Rh+': 'A+', 'A Rh-': 'A-', 'B Rh+': 'B+', 'B Rh-': 'B-', 'AB Rh+': 'AB+', 'AB Rh-': 'AB-', '0 Rh+': '0+', '0 Rh-': '0-' };

    // ── Tek kayıt patch — tüm tabloyu yeniden çekmek yerine sadece değişen kaydı güncelle ──
    // Bu sayede karşı cihazdan gelen değişiklikler ANINDA yansır (iş izinleri gibi)
    const applyPatch = (table: string, rawRecord: unknown, eventType: string, recordId: string) => {
      if (eventType === 'DELETE') {
        // Silinen kaydı state'den çıkar + cache'i güncelle
        const filterAndCache = <T extends { id: string }>(
          setter: (fn: (prev: T[]) => T[]) => void,
          cacheTable: string,
        ) => {
          setter(prev => {
            const next = prev.filter(r => r.id !== recordId);
            void writeCache(`${cacheTable}_${activeOrgId}`, next);
            return next;
          });
        };
        switch (table) {
          case 'firmalar':       filterAndCache<Firma>(setFirmalar, 'firmalar'); break;
          case 'personeller':    filterAndCache<Personel>(setPersoneller, 'personeller'); break;
          case 'evraklar':       filterAndCache<Evrak>(setEvraklar, 'evraklar'); break;
          case 'egitimler':      filterAndCache<Egitim>(setEgitimler, 'egitimler'); break;
          case 'muayeneler':     filterAndCache<Muayene>(setMuayeneler, 'muayeneler'); break;
          case 'uygunsuzluklar': filterAndCache<Uygunsuzluk>(setUygunsuzluklar, 'uygunsuzluklar'); break;
          case 'ekipmanlar':     filterAndCache<Ekipman>(setEkipmanlar, 'ekipmanlar'); break;
          case 'gorevler':       filterAndCache<Gorev>(setGorevler, 'gorevler'); break;
          case 'tutanaklar':     filterAndCache<Tutanak>(setTutanaklar, 'tutanaklar'); break;
          case 'is_izinleri':    filterAndCache<IsIzni>(setIsIzinleri, 'is_izinleri'); break;
        }
        return;
      }

      // INSERT veya UPDATE — payload.new.data içindeki kaydı direkt uygula
      const data = rawRecord as Record<string, unknown>;
      if (!data) return;

      const upsertRecord = <T extends { id: string }>(
        setter: (fn: (prev: T[]) => T[]) => void,
        transform?: (r: T) => T,
        cacheTable?: string,
      ) => {
        const record = (transform ? transform(data as unknown as T) : data) as T;
        setter(prev => {
          const idx = prev.findIndex(r => r.id === recordId);
          let next: T[];
          if (idx === -1) {
            next = [record, ...prev];
          } else {
            next = [...prev];
            next[idx] = record;
          }
          // Cache'i de güncelle (arka planda)
          if (cacheTable) {
            void writeCache(`${cacheTable}_${activeOrgId}`, next);
          }
          return next;
        });
      };

      switch (table) {
        case 'firmalar':
          upsertRecord<Firma>(setFirmalar, undefined, 'firmalar');
          break;
        case 'personeller':
          upsertRecord<Personel>(setPersoneller, p => ({
            ...p, kanGrubu: KAN[p.kanGrubu ?? ''] ?? (p.kanGrubu ?? ''),
          }), 'personeller');
          break;
        case 'evraklar':
          upsertRecord<Evrak>(setEvraklar, e => ({
            ...e, kategori: e.kategori || getEvrakKategori(e.tur ?? '', e.ad ?? ''),
          }), 'evraklar');
          break;
        case 'egitimler':
          upsertRecord<Egitim>(setEgitimler, undefined, 'egitimler');
          break;
        case 'muayeneler':
          upsertRecord<Muayene>(setMuayeneler, undefined, 'muayeneler');
          break;
        case 'uygunsuzluklar':
          upsertRecord<Uygunsuzluk>(setUygunsuzluklar, u => ({
            ...u,
            durum: (u.durum === 'Kapatıldı' ? 'Kapandı' : u.durum === 'İncelemede' ? 'Açık' : u.durum) as UygunsuzlukStatus,
          }), 'uygunsuzluklar');
          break;
        case 'ekipmanlar':
          upsertRecord<Ekipman>(setEkipmanlar, undefined, 'ekipmanlar');
          break;
        case 'gorevler':
          upsertRecord<Gorev>(setGorevler, undefined, 'gorevler');
          break;
        case 'tutanaklar':
          upsertRecord<Tutanak>(setTutanaklar, undefined, 'tutanaklar');
          break;
        case 'is_izinleri':
          upsertRecord<IsIzni>(setIsIzinleri, undefined, 'is_izinleri');
          break;
      }
    };

    // Fallback: tüm tabloyu yeniden çek (patch başarısız olursa veya data yoksa)
    const reloadTable = async (table: string) => {
      try {
        // Use paginated fetch to bypass 1000-row limit
        const { data, error } = await fetchAllRows(table, activeOrgId);
        if (error) {
          console.error(`[ISG] reloadTable error (${table}):`, error);
          return;
        }
        if (!data) return;
        const rows = data.map(r => r.data as unknown);
        // TABLE_MAP yerine applyPatch ile tek tek uygula
        switch (table) {
          case 'firmalar':       setFirmalar(rows as Firma[]); break;
          case 'personeller':    setPersoneller((rows as Personel[]).map(p => ({ ...p, kanGrubu: KAN[p.kanGrubu ?? ''] ?? (p.kanGrubu ?? '') }))); break;
          case 'evraklar':       setEvraklar((rows as Evrak[]).map(e => ({ ...e, kategori: e.kategori || getEvrakKategori(e.tur ?? '', e.ad ?? '') }))); break;
          case 'egitimler':      setEgitimler(rows as Egitim[]); break;
          case 'muayeneler':     setMuayeneler(rows as Muayene[]); break;
          case 'uygunsuzluklar': setUygunsuzluklar((rows as Uygunsuzluk[]).map(u => ({ ...u, durum: (u.durum === 'Kapatıldı' ? 'Kapandı' : u.durum === 'İncelemede' ? 'Açık' : u.durum) as UygunsuzlukStatus }))); break;
          case 'ekipmanlar':     setEkipmanlar(rows as Ekipman[]); break;
          case 'gorevler':       setGorevler(rows as Gorev[]); break;
          case 'tutanaklar':     setTutanaklar(rows as Tutanak[]); break;
          case 'is_izinleri':    setIsIzinleri(rows as IsIzni[]); break;
        }
        console.log(`[ISG] Realtime full-reload OK: ${table} (${rows.length} rows) org=${activeOrgId}`);
      } catch (err) {
        console.error(`[ISG] reloadTable exception (${table}):`, err);
      }
    };

    const TABLES = [
      'firmalar', 'personeller', 'evraklar', 'egitimler',
      'muayeneler', 'uygunsuzluklar', 'ekipmanlar', 'gorevler', 'tutanaklar', 'is_izinleri',
    ];

    // Device ID: her sekme/cihaz için unique, session boyunca sabit
    const deviceId = getDeviceId();

    const MODULE_NAMES: Record<string, string> = {
      firmalar: 'Firmalar', personeller: 'Personeller', evraklar: 'Evraklar',
      egitimler: 'Eğitimler', muayeneler: 'Muayeneler', uygunsuzluklar: 'Saha Denetim',
      ekipmanlar: 'Ekipmanlar', gorevler: 'Görevler', tutanaklar: 'Tutanaklar', is_izinleri: 'İş İzinleri',
    };

    // Unique channel ismi — her org+user kombinasyonu için ayrı channel
    const channelName = `isg_rt_${activeOrgId}_${userId}_${Date.now()}`;
    let channel = supabase.channel(channelName);

    TABLES.forEach(table => {
      channel = channel.on(
        'postgres_changes' as Parameters<typeof channel.on>[0],
        { event: '*', schema: 'public', table, filter: `organization_id=eq.${activeOrgId}` } as Parameters<typeof channel.on>[1],
        (payload: { eventType: string; new: Record<string, unknown>; old?: Record<string, unknown> }) => {
          // Kendi cihazımızdan gelen değişiklikleri skip et
          const remoteDeviceId = payload.new?.device_id as string | undefined;
          if (remoteDeviceId && remoteDeviceId === deviceId) {
            console.log(`[ISG] Realtime skip (own device): ${table}`);
            return;
          }

          const recordId = (payload.new?.id ?? payload.old?.id) as string | undefined;
          console.log(`[ISG] Realtime incoming: ${table} event=${payload.eventType} id=${recordId} from device=${remoteDeviceId ?? 'unknown'}`);

          if (payload.eventType === 'DELETE') {
            // DELETE: payload.new boş gelir, old.id'den sil
            const delId = (payload.old?.id) as string | undefined;
            if (delId) {
              // Kendi kalıcı silmemizden geliyorsa bildirim gösterme
              const isOwnDelete = ownDeletesRef.current.has(delId);
              if (isOwnDelete) {
                ownDeletesRef.current.delete(delId);
                console.log(`[ISG] Realtime skip (own delete): ${table}/${delId}`);
                return;
              }
              applyPatch(table, null, 'DELETE', delId);
            } else {
              // id yoksa fallback reload
              void reloadTable(table);
            }
            onRemoteChangeRef.current?.(MODULE_NAMES[table] ?? table);
            return;
          }

          // INSERT / UPDATE: payload.new.data içinde tam kayıt var
          const newData = payload.new?.data;
          if (newData && recordId) {
            // Kalıcı silinen kayıtlar için gelen UPDATE event'ini yoksay
            // (permanentDelete öncesi deleted_at set ederken UPDATE event'i geliyor)
            if (ownDeletesRef.current.has(recordId)) {
              console.log(`[ISG] Realtime skip (own permanent delete UPDATE): ${table}/${recordId}`);
              return;
            }
            // Anında patch — DB'ye tekrar sorgu atmadan
            applyPatch(table, newData, payload.eventType, recordId);
            onRemoteChangeRef.current?.(MODULE_NAMES[table] ?? table);
          } else {
            // data yoksa fallback: tüm tabloyu yeniden çek
            console.warn(`[ISG] Realtime: no data in payload for ${table}/${recordId}, falling back to reload`);
            void reloadTable(table);
            onRemoteChangeRef.current?.(MODULE_NAMES[table] ?? table);
          }
        },
      ) as typeof channel;
    });

    channel.subscribe((status, err) => {
      if (err) {
        console.error(`[ISG] Realtime subscribe error for org=${activeOrgId}:`, err);
      } else {
        console.log(`[ISG] Realtime ${status} for org=${activeOrgId} channel=${channelName}`);
      }
      if (status === 'SUBSCRIBED') {
        setRealtimeStatus('connected');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.warn(`[ISG] Realtime connection issue (${status}) — Supabase will auto-reconnect`);
        setRealtimeStatus('disconnected');
      } else {
        // JOINING, etc.
        setRealtimeStatus('connecting');
      }
    });

    return () => {
      console.log(`[ISG] Realtime cleanup: removing channel=${channelName}`);
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, userId, orgLoading]);

  // ──────── FIRMA ────────
  const addFirma = useCallback((firma: Omit<Firma, 'id' | 'olusturmaTarihi' | 'guncellemeTarihi'>) => {
    const now = new Date().toISOString();
    const newFirma: Firma = { ...firma, id: genId(), olusturmaTarihi: now, guncellemeTarihi: now };
    setFirmalar(prev => [newFirma, ...prev]);
    saveToDb('firmalar', newFirma as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('firma_created', 'Firmalar', newFirma.id, newFirma.ad, `${newFirma.ad} firması oluşturuldu.`);
    return newFirma;
  }, [setFirmalar, saveToDb]);

  const updateFirma = useCallback((id: string, updates: Partial<Firma>) => {
    let updated: Firma | null = null;
    setFirmalar(prev => prev.map(f => {
      if (f.id !== id) return f;
      updated = { ...f, ...updates, guncellemeTarihi: new Date().toISOString() };
      return updated;
    }));
    if (updated) saveToDb('firmalar', updated as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('firma_updated', 'Firmalar', id, updates.ad, 'Firma bilgileri güncellendi.');
  }, [setFirmalar, saveToDb]);

  const deleteFirma = useCallback((id: string) => {
    const now = new Date().toISOString();
    const cascadeFields = { silinmis: true as const, silinmeTarihi: now, cascadeSilindi: true as const, cascadeFirmaId: id };
    const updatedItems: { table: string; item: { id: string } & Record<string, unknown> }[] = [];

    setFirmalar(prev => prev.map(f => {
      if (f.id !== id) return f;
      const u = { ...f, silinmis: true as const, silinmeTarihi: now };
      updatedItems.push({ table: 'firmalar', item: u as unknown as { id: string } & Record<string, unknown> });
      return u;
    }));
    setPersoneller(prev => prev.map(p => {
      if (p.firmaId !== id || p.silinmis) return p;
      const u = { ...p, ...cascadeFields };
      updatedItems.push({ table: 'personeller', item: u as unknown as { id: string } & Record<string, unknown> });
      return u;
    }));
    setEvraklar(prev => prev.map(e => {
      if (e.silinmis || e.firmaId !== id || e.personelId) return e;
      const u = { ...e, ...cascadeFields };
      updatedItems.push({ table: 'evraklar', item: u as unknown as { id: string } & Record<string, unknown> });
      return u;
    }));
    setEgitimler(prev => prev.map(e => {
      if (e.firmaId !== id || e.silinmis) return e;
      const u = { ...e, ...cascadeFields };
      updatedItems.push({ table: 'egitimler', item: u as unknown as { id: string } & Record<string, unknown> });
      return u;
    }));
    setMuayeneler(prev => prev.map(m => {
      if (m.firmaId !== id || m.silinmis) return m;
      const u = { ...m, ...cascadeFields };
      updatedItems.push({ table: 'muayeneler', item: u as unknown as { id: string } & Record<string, unknown> });
      return u;
    }));
    setUygunsuzluklar(prev => prev.map(u => {
      if (u.firmaId !== id || u.silinmis) return u;
      const updated = { ...u, ...cascadeFields };
      updatedItems.push({ table: 'uygunsuzluklar', item: updated as unknown as { id: string } & Record<string, unknown> });
      return updated;
    }));
    setEkipmanlar(prev => prev.map(e => {
      if (e.firmaId !== id || e.silinmis) return e;
      const u = { ...e, ...cascadeFields };
      updatedItems.push({ table: 'ekipmanlar', item: u as unknown as { id: string } & Record<string, unknown> });
      return u;
    }));
    setGorevler(prev => prev.map(g => {
      if (g.firmaId !== id || g.silinmis) return g;
      const u = { ...g, ...cascadeFields };
      updatedItems.push({ table: 'gorevler', item: u as unknown as { id: string } & Record<string, unknown> });
      return u;
    }));

    updatedItems.forEach(({ table, item }) => saveToDb(table, item));
    logFnRef.current?.('firma_deleted', 'Firmalar', id, undefined, 'Firma silindi.');
  }, [setFirmalar, setPersoneller, setEvraklar, setEgitimler, setMuayeneler, setUygunsuzluklar, setEkipmanlar, setGorevler, saveToDb]);

  const restoreFirma = useCallback((id: string) => {
    const rf = { silinmis: false as const, silinmeTarihi: undefined, cascadeSilindi: false as const, cascadeFirmaId: undefined };
    const updatedItems: { table: string; item: { id: string } & Record<string, unknown> }[] = [];

    const updateAndCollect = <T extends { id: string }>(
      setter: (fn: (prev: T[]) => T[]) => void,
      table: string,
      predicate: (item: T) => boolean,
    ) => {
      setter(prev => prev.map(item => {
        if (!predicate(item)) return item;
        const u = { ...item, ...rf };
        updatedItems.push({ table, item: u as unknown as { id: string } & Record<string, unknown> });
        return u;
      }));
    };

    setFirmalar(prev => prev.map(f => {
      if (f.id !== id) return f;
      const u = { ...f, silinmis: false as const, silinmeTarihi: undefined };
      updatedItems.push({ table: 'firmalar', item: u as unknown as { id: string } & Record<string, unknown> });
      return u;
    }));
    updateAndCollect<Personel>(setPersoneller, 'personeller', p => p.cascadeFirmaId === id && !!p.cascadeSilindi);
    updateAndCollect<Evrak>(setEvraklar, 'evraklar', e => e.cascadeFirmaId === id && !!e.cascadeSilindi);
    updateAndCollect<Egitim>(setEgitimler, 'egitimler', e => e.cascadeFirmaId === id && !!e.cascadeSilindi);
    updateAndCollect<Muayene>(setMuayeneler, 'muayeneler', m => m.cascadeFirmaId === id && !!m.cascadeSilindi);
    updateAndCollect<Uygunsuzluk>(setUygunsuzluklar, 'uygunsuzluklar', u => u.cascadeFirmaId === id && !!u.cascadeSilindi);
    updateAndCollect<Ekipman>(setEkipmanlar, 'ekipmanlar', e => e.cascadeFirmaId === id && !!e.cascadeSilindi);
    updateAndCollect<Gorev>(setGorevler, 'gorevler', g => g.cascadeFirmaId === id && !!g.cascadeSilindi);

    updatedItems.forEach(({ table, item }) => saveToDb(table, item));
  }, [setFirmalar, setPersoneller, setEvraklar, setEgitimler, setMuayeneler, setUygunsuzluklar, setEkipmanlar, setGorevler, saveToDb]);

  const permanentDeleteFirma = useCallback(async (id: string) => {
    ownDeletesRef.current.add(id);
    // Snapshot all affected state for rollback
    let snapshotFirmalar: Firma[] = [];
    let snapshotPersoneller: Personel[] = [];
    let snapshotEvraklar: Evrak[] = [];
    let snapshotEgitimler: Egitim[] = [];
    let snapshotMuayeneler: Muayene[] = [];
    let snapshotUyg: Uygunsuzluk[] = [];
    let snapshotEkipmanlar: Ekipman[] = [];
    let snapshotGorevler: Gorev[] = [];

    let personelIds: string[] = [];
    let evrakIds: string[] = [];
    let egitimIds: string[] = [];
    let muayeneIds: string[] = [];
    let uygIds: string[] = [];
    let ekipmanIds: string[] = [];
    let gorevIds: string[] = [];

    // Optimistic UI update — collect snapshots and IDs simultaneously
    await Promise.all([
      new Promise<void>(resolve => { _setFirmalar(prev => { snapshotFirmalar = prev; resolve(); return prev.filter(f => f.id !== id); }); }),
      new Promise<void>(resolve => { _setPersoneller(prev => { snapshotPersoneller = prev; personelIds = prev.filter(p => p.firmaId === id).map(p => p.id); resolve(); return prev.filter(p => p.firmaId !== id); }); }),
      new Promise<void>(resolve => { _setEvraklar(prev => { snapshotEvraklar = prev; evrakIds = prev.filter(e => e.firmaId === id).map(e => e.id); resolve(); return prev.filter(e => e.firmaId !== id); }); }),
      new Promise<void>(resolve => { _setEgitimler(prev => { snapshotEgitimler = prev; egitimIds = prev.filter(e => e.firmaId === id).map(e => e.id); resolve(); return prev.filter(e => e.firmaId !== id); }); }),
      new Promise<void>(resolve => { _setMuayeneler(prev => { snapshotMuayeneler = prev; muayeneIds = prev.filter(m => m.firmaId === id).map(m => m.id); resolve(); return prev.filter(m => m.firmaId !== id); }); }),
      new Promise<void>(resolve => { _setUygunsuzluklar(prev => { snapshotUyg = prev; uygIds = prev.filter(u => u.firmaId === id).map(u => u.id); resolve(); return prev.filter(u => u.firmaId !== id); }); }),
      new Promise<void>(resolve => { _setEkipmanlar(prev => { snapshotEkipmanlar = prev; ekipmanIds = prev.filter(e => e.firmaId === id).map(e => e.id); resolve(); return prev.filter(e => e.firmaId !== id); }); }),
      new Promise<void>(resolve => { _setGorevler(prev => { snapshotGorevler = prev; gorevIds = prev.filter(g => g.firmaId === id).map(g => g.id); resolve(); return prev.filter(g => g.firmaId !== id); }); }),
    ]);

    try {
      await Promise.all([
        dbDelete('firmalar', id),
        dbDeleteMany('personeller', personelIds),
        dbDeleteMany('evraklar', evrakIds),
        dbDeleteMany('egitimler', egitimIds),
        dbDeleteMany('muayeneler', muayeneIds),
        dbDeleteMany('uygunsuzluklar', uygIds),
        dbDeleteMany('ekipmanlar', ekipmanIds),
        dbDeleteMany('gorevler', gorevIds),
      ]);
    } catch (err) {
      console.error('[ISG] permanentDeleteFirma FAILED, rolling back:', err);
      _setFirmalar(snapshotFirmalar);
      _setPersoneller(snapshotPersoneller);
      _setEvraklar(snapshotEvraklar);
      _setEgitimler(snapshotEgitimler);
      _setMuayeneler(snapshotMuayeneler);
      _setUygunsuzluklar(snapshotUyg);
      _setEkipmanlar(snapshotEkipmanlar);
      _setGorevler(snapshotGorevler);
      onSaveErrorRef.current?.(`Kalıcı silme hatası (firma): ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  // ──────── PERSONEL ────────
  const addPersonel = useCallback((personel: Omit<Personel, 'id' | 'olusturmaTarihi' | 'guncellemeTarihi'>) => {
    const now = new Date().toISOString();
    const newPersonel: Personel = { ...personel, id: genId(), olusturmaTarihi: now, guncellemeTarihi: now };
    setPersoneller(prev => [newPersonel, ...prev]);
    saveToDb('personeller', newPersonel as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('personel_created', 'Personeller', newPersonel.id, newPersonel.adSoyad, `${newPersonel.adSoyad} personel olarak eklendi.`);
    return newPersonel;
  }, [setPersoneller, saveToDb]);

  const updatePersonel = useCallback((id: string, updates: Partial<Personel>) => {
    let updated: Personel | null = null;
    setPersoneller(prev => prev.map(p => {
      if (p.id !== id) return p;
      updated = { ...p, ...updates, guncellemeTarihi: new Date().toISOString() };
      return updated;
    }));
    if (updated) saveToDb('personeller', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setPersoneller, saveToDb]);

  const deletePersonel = useCallback((id: string) => {
    let updated: Personel | null = null;
    setPersoneller(prev => prev.map(p => {
      if (p.id !== id) return p;
      updated = { ...p, silinmis: true as const, silinmeTarihi: new Date().toISOString() };
      return updated;
    }));
    if (updated) saveToDb('personeller', updated as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('personel_deleted', 'Personeller', id, undefined, 'Personel silindi.');
  }, [setPersoneller, saveToDb]);

  const restorePersonel = useCallback((id: string) => {
    let updated: Personel | null = null;
    setPersoneller(prev => prev.map(p => {
      if (p.id !== id) return p;
      updated = { ...p, silinmis: false as const, silinmeTarihi: undefined };
      return updated;
    }));
    if (updated) saveToDb('personeller', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setPersoneller, saveToDb]);

  const personellerRef = useRef<Personel[]>([]);
  useEffect(() => { personellerRef.current = personeller; }, [personeller]);

  const permanentDeletePersonel = useCallback(async (id: string) => {
    const snapshot = personellerRef.current;
    ownDeletesRef.current.add(id);
    _setPersoneller(prev => prev.filter(p => p.id !== id));
    try {
      await dbDelete('personeller', id);
    } catch (err) {
      console.error('[ISG] permanentDeletePersonel FAILED, rolling back:', err);
      ownDeletesRef.current.delete(id);
      _setPersoneller(snapshot);
      onSaveErrorRef.current?.(`Kalıcı silme hatası (personeller): ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }, []);

  // ──────── EVRAK ────────
  const addEvrak = useCallback((evrak: Omit<Evrak, 'id' | 'olusturmaTarihi'>) => {
    const id = genId();
    // dosyaVeri (base64) artık kabul edilmiyor — sadece dosyaUrl kullanılır
    const { dosyaVeri: _ignored, ...rest } = evrak as Evrak & { dosyaVeri?: string };
    const kategori = evrak.kategori || getEvrakKategori(evrak.tur, evrak.ad);
    const newEvrak: Evrak = { ...rest, kategori, id, olusturmaTarihi: new Date().toISOString() };
    setEvraklar(prev => [newEvrak, ...prev]);
    saveToDb('evraklar', newEvrak as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('evrak_created', 'Evraklar', id, newEvrak.ad, `${newEvrak.ad} evrakı eklendi.`);
    return newEvrak;
  }, [setEvraklar, saveToDb]);

  const updateEvrak = useCallback((id: string, updates: Partial<Evrak>) => {
    const { dosyaVeri: _ignored, ...rest } = updates as Partial<Evrak> & { dosyaVeri?: string };
    let updated: Evrak | null = null;
    setEvraklar(prev => prev.map(e => {
      if (e.id !== id) return e;
      const merged = { ...e, ...rest };
      if (rest.tur !== undefined || rest.ad !== undefined) merged.kategori = getEvrakKategori(merged.tur, merged.ad);
      updated = merged;
      return merged;
    }));
    if (updated) saveToDb('evraklar', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setEvraklar, saveToDb]);

  const deleteEvrak = useCallback((id: string) => {
    let updated: Evrak | null = null;
    setEvraklar(prev => prev.map(e => {
      if (e.id !== id) return e;
      updated = { ...e, silinmis: true as const, silinmeTarihi: new Date().toISOString() };
      return updated;
    }));
    if (updated) saveToDb('evraklar', updated as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('evrak_deleted', 'Evraklar', id, undefined, 'Evrak silindi.');
  }, [setEvraklar, saveToDb]);

  const restoreEvrak = useCallback((id: string) => {
    let updated: Evrak | null = null;
    setEvraklar(prev => prev.map(e => {
      if (e.id !== id) return e;
      updated = { ...e, silinmis: false as const, silinmeTarihi: undefined };
      return updated;
    }));
    if (updated) saveToDb('evraklar', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setEvraklar, saveToDb]);

  const evraklarRef = useRef<Evrak[]>([]);
  useEffect(() => { evraklarRef.current = evraklar; }, [evraklar]);

  const permanentDeleteEvrak = useCallback(async (id: string) => {
    const snapshot = evraklarRef.current;
    ownDeletesRef.current.add(id);
    _setEvraklar(prev => prev.filter(e => e.id !== id));
    try {
      await dbDelete('evraklar', id);
    } catch (err) {
      console.error('[ISG] permanentDeleteEvrak FAILED, rolling back:', err);
      ownDeletesRef.current.delete(id);
      _setEvraklar(snapshot);
      onSaveErrorRef.current?.(`Kalıcı silme hatası (evraklar): ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }, []);

  // ──────── EĞİTİM ────────
  const addEgitim = useCallback((egitim: Omit<Egitim, 'id' | 'olusturmaTarihi'>) => {
    const id = genId();
    const { belgeDosyaVeri: _ignored, ...rest } = egitim as Egitim & { belgeDosyaVeri?: string };
    const newEgitim: Egitim = { ...rest, id, olusturmaTarihi: new Date().toISOString() };
    setEgitimler(prev => [newEgitim, ...prev]);
    saveToDb('egitimler', newEgitim as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('egitim_created', 'Eğitimler', id, newEgitim.ad, `${newEgitim.ad} eğitimi oluşturuldu.`);
    return newEgitim;
  }, [setEgitimler, saveToDb]);

  const updateEgitim = useCallback((id: string, updates: Partial<Egitim>) => {
    const { belgeDosyaVeri: _ignored, ...rest } = updates as Partial<Egitim> & { belgeDosyaVeri?: string };
    let updated: Egitim | null = null;
    setEgitimler(prev => prev.map(e => {
      if (e.id !== id) return e;
      updated = { ...e, ...rest };
      return updated;
    }));
    if (updated) saveToDb('egitimler', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setEgitimler, saveToDb]);

  const deleteEgitim = useCallback((id: string) => {
    let updated: Egitim | null = null;
    setEgitimler(prev => prev.map(e => {
      if (e.id !== id) return e;
      updated = { ...e, silinmis: true as const, silinmeTarihi: new Date().toISOString() };
      return updated;
    }));
    if (updated) saveToDb('egitimler', updated as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('egitim_deleted', 'Eğitimler', id, undefined, 'Eğitim silindi.');
  }, [setEgitimler, saveToDb]);

  const restoreEgitim = useCallback((id: string) => {
    let updated: Egitim | null = null;
    setEgitimler(prev => prev.map(e => {
      if (e.id !== id) return e;
      updated = { ...e, silinmis: false as const, silinmeTarihi: undefined };
      return updated;
    }));
    if (updated) saveToDb('egitimler', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setEgitimler, saveToDb]);

  const egitimlerRef = useRef<Egitim[]>([]);
  useEffect(() => { egitimlerRef.current = egitimler; }, [egitimler]);

  const permanentDeleteEgitim = useCallback(async (id: string) => {
    const snapshot = egitimlerRef.current;
    ownDeletesRef.current.add(id);
    _setEgitimler(prev => prev.filter(e => e.id !== id));
    try {
      await dbDelete('egitimler', id);
    } catch (err) {
      console.error('[ISG] permanentDeleteEgitim FAILED, rolling back:', err);
      ownDeletesRef.current.delete(id);
      _setEgitimler(snapshot);
      onSaveErrorRef.current?.(`Kalıcı silme hatası (egitimler): ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }, []);

  // ──────── MUAYENE ────────
  const addMuayene = useCallback((muayene: Omit<Muayene, 'id' | 'olusturmaTarihi'>) => {
    const newMuayene: Muayene = { ...muayene, id: genId(), olusturmaTarihi: new Date().toISOString() };
    setMuayeneler(prev => [newMuayene, ...prev]);
    saveToDb('muayeneler', newMuayene as unknown as { id: string } & Record<string, unknown>);
    return newMuayene;
  }, [setMuayeneler, saveToDb]);

  const updateMuayene = useCallback((id: string, updates: Partial<Muayene>) => {
    let updated: Muayene | null = null;
    setMuayeneler(prev => prev.map(m => {
      if (m.id !== id) return m;
      updated = { ...m, ...updates };
      return updated;
    }));
    if (updated) saveToDb('muayeneler', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setMuayeneler, saveToDb]);

  const deleteMuayene = useCallback((id: string) => {
    const now = new Date().toISOString();
    let updated: Muayene | null = null;
    setMuayeneler(prev => prev.map(m => {
      if (m.id !== id) return m;
      updated = { ...m, silinmis: true as const, silinmeTarihi: now };
      return updated;
    }));
    if (updated) {
      // deleted_at kolonunu da açıkça set et — fetchAllRows .is('deleted_at', null) filtresi için kritik
      const orgId = orgIdRef.current;
      const uid = userIdRef.current;
      if (orgId && uid) {
        supabase
          .from('muayeneler')
          .update({
            data: updated,
            updated_at: now,
            deleted_at: now,
            device_id: getDeviceId(),
          })
          .eq('id', id)
          .eq('organization_id', orgId)
          .then(({ error }) => {
            if (error) {
              console.error('[ISG] deleteMuayene DB error:', error.message);
              // Rollback — kaydı geri getir
              setMuayeneler(prev => prev.map(m => m.id === id ? { ...m, silinmis: false as const, silinmeTarihi: undefined } : m));
              onSaveErrorRef.current?.(`Muayene silinemedi: ${error.message}`);
            } else {
              console.log(`[ISG] deleteMuayene OK: ${id} deleted_at=${now}`);
            }
          });
      } else {
        // orgId henüz hazır değil — pending queue'ya ekle (silinmis=true ile upsert)
        saveToDb('muayeneler', updated as unknown as { id: string } & Record<string, unknown>);
      }
    }
    logFnRef.current?.('muayene_deleted', 'Sağlık', id, undefined, 'Sağlık evrakı silindi.');
  }, [setMuayeneler, saveToDb]);

  const restoreMuayene = useCallback((id: string) => {
    const now = new Date().toISOString();
    let updated: Muayene | null = null;
    setMuayeneler(prev => prev.map(m => {
      if (m.id !== id) return m;
      updated = { ...m, silinmis: false as const, silinmeTarihi: undefined };
      return updated;
    }));
    if (updated) {
      // deleted_at'i null'a çek — yoksa fetchAllRows geri getirmez
      const orgId = orgIdRef.current;
      const uid = userIdRef.current;
      if (orgId && uid) {
        supabase
          .from('muayeneler')
          .update({
            data: updated,
            updated_at: now,
            deleted_at: null,
            device_id: getDeviceId(),
          })
          .eq('id', id)
          .eq('organization_id', orgId)
          .then(({ error }) => {
            if (error) {
              console.error('[ISG] restoreMuayene DB error:', error.message);
              setMuayeneler(prev => prev.map(m => m.id === id ? { ...m, silinmis: true as const } : m));
            } else {
              console.log(`[ISG] restoreMuayene OK: ${id} deleted_at=null`);
            }
          });
      } else {
        saveToDb('muayeneler', updated as unknown as { id: string } & Record<string, unknown>);
      }
    }
  }, [setMuayeneler, saveToDb]);

  const muayenelerRef = useRef<Muayene[]>([]);
  useEffect(() => { muayenelerRef.current = muayeneler; }, [muayeneler]);

  const permanentDeleteMuayene = useCallback(async (id: string) => {
    const snapshot = muayenelerRef.current;
    ownDeletesRef.current.add(id);
    _setMuayeneler(prev => prev.filter(m => m.id !== id));
    try {
      await dbDelete('muayeneler', id);
      console.log(`[ISG] permanentDeleteMuayene OK: ${id}`);
    } catch (err) {
      console.error('[ISG] permanentDeleteMuayene FAILED, rolling back:', err);
      ownDeletesRef.current.delete(id);
      _setMuayeneler(snapshot);
      onSaveErrorRef.current?.(`Kalıcı silme hatası (muayeneler): ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }, []);

  // ──────── UYGUNSUZLUK ────────
  const addUygunsuzluk = useCallback(async (u: Omit<Uygunsuzluk, 'id' | 'olusturmaTarihi'>) => {
    const id = genId();
    const now = new Date().toISOString();
    // Supabase RPC ile race-condition-safe numara üret, fallback: frontend
    const rpcNo = await generateRecordNoFromDB('dof');
    const acilisNo = rpcNo ?? generateDofNo(uygRef.current);
    const durum = u.kapatmaFotoMevcut ? 'Kapandı' as const : 'Açık' as const;
    const newU: Uygunsuzluk = { ...u, id, durum, olusturmaTarihi: now, acilisNo };
    setUygunsuzluklar(prev => [newU, ...prev]);
    saveToDb('uygunsuzluklar', newU as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('uygunsuzluk_created', 'Uygunsuzluklar', id, u.baslik, `${u.baslik} uygunsuzluk kaydı oluşturuldu.`);
    return newU;
  }, [setUygunsuzluklar, saveToDb]);

  const updateUygunsuzluk = useCallback((id: string, updates: Partial<Uygunsuzluk>) => {
    let updated: Uygunsuzluk | null = null;
    setUygunsuzluklar(prev => prev.map(u => {
      if (u.id !== id) return u;
      const merged = { ...u, ...updates };
      merged.durum = merged.kapatmaFotoMevcut ? 'Kapandı' : 'Açık';
      updated = merged;
      return merged;
    }));
    if (updated) saveToDb('uygunsuzluklar', updated as unknown as { id: string } & Record<string, unknown>);
    if (updates.kapatmaFotoMevcut) logFnRef.current?.('uygunsuzluk_closed', 'Uygunsuzluklar', id, updates.baslik, 'Uygunsuzluk kapatıldı.');
  }, [setUygunsuzluklar, saveToDb]);

  const deleteUygunsuzluk = useCallback((id: string) => {
    let updated: Uygunsuzluk | null = null;
    setUygunsuzluklar(prev => prev.map(u => {
      if (u.id !== id) return u;
      updated = { ...u, silinmis: true as const, silinmeTarihi: new Date().toISOString() };
      return updated;
    }));
    if (updated) saveToDb('uygunsuzluklar', updated as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('uygunsuzluk_deleted', 'Uygunsuzluklar', id, undefined, 'Uygunsuzluk silindi.');
  }, [setUygunsuzluklar, saveToDb]);

  const uygunsuzluklarRef = useRef<Uygunsuzluk[]>([]);
  useEffect(() => { uygunsuzluklarRef.current = uygunsuzluklar; }, [uygunsuzluklar]);

  const permanentDeleteUygunsuzluk = useCallback(async (id: string) => {
    const snapshot = uygunsuzluklarRef.current;
    ownDeletesRef.current.add(id);
    _setUygunsuzluklar(prev => prev.filter(u => u.id !== id));
    try {
      await dbDelete('uygunsuzluklar', id);
      console.log(`[ISG] permanentDeleteUygunsuzluk OK: ${id}`);
    } catch (err) {
      console.error('[ISG] permanentDeleteUygunsuzluk FAILED, rolling back:', err);
      ownDeletesRef.current.delete(id);
      _setUygunsuzluklar(snapshot);
      onSaveErrorRef.current?.(`Kalıcı silme hatası (uygunsuzluklar): ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }, []);

  const getUygunsuzlukPhoto = useCallback((id: string, type: 'acilis' | 'kapatma'): string | undefined => {
    const record = uygRef.current.find(u => u.id === id);
    if (record) {
      const url = type === 'acilis' ? record.acilisFotoUrl : record.kapatmaFotoUrl;
      if (url) return url;
    }
    return undefined;
  }, []);

  const setUygunsuzlukPhoto = useCallback(async (id: string, type: 'acilis' | 'kapatma', base64: string): Promise<string | null> => {
    try {
      const orgId = orgIdRef.current ?? 'unknown';
      const [meta, data] = base64.split(',');
      const mimeMatch = meta.match(/data:([^;]+);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const ext = mime.split('/')[1]?.split('+')[0] ?? 'jpg';
      const byteString = atob(data);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
      const blob = new Blob([ab], { type: mime });
      const file = new File([blob], `${type}-${id}.${ext}`, { type: mime });

      // Tek standart path: {orgId}/{module}/{id}.{ext}
      const url = await uploadFileToStorage(file, orgId, `uygunsuzluk-${type}`, id);
      console.log(`[ISG] Photo uploaded to Storage: ${url}`);
      return url;
    } catch (err) {
      console.error('[ISG] setUygunsuzlukPhoto error:', err);
      return null;
    }
  }, []);

  // ──────── EKİPMAN ────────
  const addEkipman = useCallback((e: Omit<Ekipman, 'id' | 'olusturmaTarihi'>) => {
    const id = genId();
    const { dosyaVeri: _ignored, ...rest } = e as Ekipman & { dosyaVeri?: string };
    const newE: Ekipman = { ...rest, id, olusturmaTarihi: new Date().toISOString() };
    setEkipmanlar(prev => [newE, ...prev]);
    saveToDb('ekipmanlar', newE as unknown as { id: string } & Record<string, unknown>);
    return newE;
  }, [setEkipmanlar, saveToDb]);

  // Kontrol geçmişine yeni kayıt ekle
  const addEkipmanKontrolKaydi = useCallback((
    ekipmanId: string,
    kayit: Omit<import('@/types').EkipmanKontrolKaydi, 'id'>
  ) => {
    const yeniKayit: import('@/types').EkipmanKontrolKaydi = {
      ...kayit,
      id: genId(),
    };
    let updated: Ekipman | null = null;
    setEkipmanlar(prev => prev.map(e => {
      if (e.id !== ekipmanId) return e;
      updated = {
        ...e,
        kontrolGecmisi: [yeniKayit, ...(e.kontrolGecmisi ?? [])],
        sonKontrolTarihi: kayit.tarih.split('T')[0],
      };
      return updated;
    }));
    if (updated) saveToDb('ekipmanlar', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setEkipmanlar, saveToDb]);

  // Ekipmana yeni belge ekle (aktif) — eskisini arşive al
  const addEkipmanBelge = useCallback((
    ekipmanId: string,
    belge: Omit<import('@/types').EkipmanBelge, 'id' | 'arsiv'>
  ) => {
    const yeniBelge: import('@/types').EkipmanBelge = {
      ...belge,
      id: genId(),
      arsiv: false,
    };
    let updated: Ekipman | null = null;
    setEkipmanlar(prev => prev.map(e => {
      if (e.id !== ekipmanId) return e;
      // Mevcut aktif belgeleri arşive al
      const eskiBelgeler = (e.belgeler ?? []).map(b =>
        b.arsiv ? b : { ...b, arsiv: true }
      );
      updated = {
        ...e,
        belgeler: [yeniBelge, ...eskiBelgeler],
        belgeMevcut: true,
        dosyaAdi: yeniBelge.dosyaAdi,
        dosyaUrl: yeniBelge.dosyaUrl,
      };
      return updated;
    }));
    if (updated) saveToDb('ekipmanlar', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setEkipmanlar, saveToDb]);

  // Fields that denetci role is allowed to update (FIX 1: field-level restriction)
  const DENETCI_ALLOWED_EKIPMAN_FIELDS = new Set([
    'sonKontrolTarihi', 'sonrakiKontrolTarihi', 'durum', 'kontrolGecmisi', 'notlar',
  ]);

  const updateEkipman = useCallback((id: string, updates: Partial<Ekipman>, callerRole?: string) => {
    const { dosyaVeri: _ignored, ...rest } = updates as Partial<Ekipman> & { dosyaVeri?: string };

    let safeRest = rest;
    if (callerRole === 'denetci') {
      safeRest = Object.fromEntries(
        Object.entries(rest).filter(([key]) => DENETCI_ALLOWED_EKIPMAN_FIELDS.has(key))
      ) as Partial<Ekipman>;
    }

    // kontrolGecmisi ve belgeler undefined gelirse mevcut değeri koru — override etme
    // Bu sayede addEkipmanKontrolKaydi + updateEkipman aynı anda çağrılınca veri kaybolmaz
    if (safeRest.kontrolGecmisi === undefined) {
      delete safeRest.kontrolGecmisi;
    }
    if (safeRest.belgeler === undefined) {
      delete safeRest.belgeler;
    }

    let updated: Ekipman | null = null;
    let snapshot: Ekipman | null = null;
    setEkipmanlar(prev => prev.map(e => {
      if (e.id !== id) return e;
      snapshot = e;
      updated = { ...e, ...safeRest };
      return updated;
    }));

    if (updated) {
      const now = new Date().toISOString();
      const orgId = orgIdRef.current;
      const uid = userIdRef.current;
      // Denetçi için direkt UPDATE — upsert with_check'i bypass eder
      supabase
        .from('ekipmanlar')
        .update({ data: updated, updated_at: now, organization_id: orgId, user_id: uid, device_id: getDeviceId() })
        .eq('id', id)
        .eq('organization_id', orgId)
        .then(({ error }) => {
          if (error) {
            console.error('[ISG] updateEkipman DB error:', error.message);
            if (snapshot) setEkipmanlar(prev => prev.map(e => e.id === id ? snapshot! : e));
            onSaveErrorRef.current?.(`Ekipman güncellenemedi: ${error.message}`);
          }
        });
    }
  }, [setEkipmanlar]);

  const deleteEkipman = useCallback((id: string) => {
    let updated: Ekipman | null = null;
    setEkipmanlar(prev => prev.map(e => {
      if (e.id !== id) return e;
      updated = { ...e, silinmis: true as const, silinmeTarihi: new Date().toISOString() };
      return updated;
    }));
    if (updated) saveToDb('ekipmanlar', updated as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('ekipman_deleted', 'Ekipmanlar', id, undefined, 'Ekipman silindi.');
  }, [setEkipmanlar, saveToDb]);

  const restoreEkipman = useCallback((id: string) => {
    let updated: Ekipman | null = null;
    setEkipmanlar(prev => prev.map(e => {
      if (e.id !== id) return e;
      updated = { ...e, silinmis: false as const, silinmeTarihi: undefined };
      return updated;
    }));
    if (updated) saveToDb('ekipmanlar', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setEkipmanlar, saveToDb]);

  const ekipmanlarRef = useRef<Ekipman[]>([]);
  useEffect(() => { ekipmanlarRef.current = ekipmanlar; }, [ekipmanlar]);

  const permanentDeleteEkipman = useCallback(async (id: string) => {
    const snapshot = ekipmanlarRef.current;
    _setEkipmanlar(prev => prev.filter(e => e.id !== id));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('https://niuvjthvhjbfyuuhoowq.supabase.co/functions/v1/delete-ekipman', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ ids: [id] }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Silme başarısız');
      console.log(`[ISG] permanentDeleteEkipman OK: ${id}`);
    } catch (err) {
      console.error('[ISG] permanentDeleteEkipman FAILED, rolling back:', err);
      _setEkipmanlar(snapshot);
      onSaveErrorRef.current?.(`Kalıcı silme hatası (ekipmanlar): ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }, []);

  const permanentDeleteEkipmanMany = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const snapshot = ekipmanlarRef.current;
    _setEkipmanlar(prev => prev.filter(e => !ids.includes(e.id)));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('https://niuvjthvhjbfyuuhoowq.supabase.co/functions/v1/delete-ekipman', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ ids }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Silme başarısız');
      console.log(`[ISG] permanentDeleteEkipmanMany OK: ${ids.length} items`);
    } catch (err) {
      console.error('[ISG] permanentDeleteEkipmanMany FAILED, rolling back:', err);
      _setEkipmanlar(snapshot);
      onSaveErrorRef.current?.(`Kalıcı silme hatası (ekipmanlar): ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }, []);

  // ──────── GÖREV ────────
  const addGorev = useCallback((g: Omit<Gorev, 'id' | 'olusturmaTarihi'>) => {
    const newG: Gorev = { ...g, id: genId(), olusturmaTarihi: new Date().toISOString() };
    setGorevler(prev => [newG, ...prev]);
    saveToDb('gorevler', newG as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('gorev_created', 'Görevler', newG.id, newG.baslik, `${newG.baslik} görevi oluşturuldu.`);
    return newG;
  }, [setGorevler, saveToDb]);

  const updateGorev = useCallback((id: string, updates: Partial<Gorev>) => {
    let updated: Gorev | null = null;
    setGorevler(prev => prev.map(g => {
      if (g.id !== id) return g;
      updated = { ...g, ...updates };
      return updated;
    }));
    if (updated) saveToDb('gorevler', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setGorevler, saveToDb]);

  const deleteGorev = useCallback((id: string) => {
    setGorevler(prev => prev.filter(g => g.id !== id));
    deleteFromDb('gorevler', id);
  }, [setGorevler, deleteFromDb]);

  // ──────── TUTANAK ────────
  const addTutanak = useCallback(async (t: Omit<Tutanak, 'id' | 'olusturmaTarihi' | 'guncellemeTarihi'>) => {
    const now = new Date().toISOString();
    const id = genId();
    const { dosyaVeri: _ignored, ...rest } = t as Tutanak & { dosyaVeri?: string };
    const rpcNo = await generateRecordNoFromDB('tutanak');
    // Fallback: fetch fresh count from DB to avoid stale-ref race condition
    let tutanakNo: string;
    if (rpcNo) {
      tutanakNo = rpcNo;
    } else {
      // Fresh fetch from DB to avoid stale tutRef race condition
      const orgId = orgIdRef.current;
      if (orgId) {
        const { data } = await supabase.from('tutanaklar').select('data').eq('organization_id', orgId);
        const freshList = (data ?? []).map(r => r.data as { tutanakNo: string });
        tutanakNo = generateTutanakNo(freshList);
      } else {
        tutanakNo = generateTutanakNo(tutRef.current);
      }
    }
    const newT: Tutanak = { ...rest, id, tutanakNo, olusturmaTarihi: now, guncellemeTarihi: now };
    setTutanaklar(prev => [newT, ...prev]);
    saveToDb('tutanaklar', newT as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('tutanak_created', 'Tutanaklar', id, newT.baslik, `${newT.tutanakNo} - ${newT.baslik} tutanağı oluşturuldu.`);
    return newT;
  }, [setTutanaklar, saveToDb]);

  const updateTutanak = useCallback((id: string, updates: Partial<Tutanak>) => {
    const { dosyaVeri: _ignored, ...rest } = updates as Partial<Tutanak> & { dosyaVeri?: string };
    let updated: Tutanak | null = null;
    setTutanaklar(prev => prev.map(t => {
      if (t.id !== id) return t;
      updated = { ...t, ...rest, guncellemeTarihi: new Date().toISOString() };
      return updated;
    }));
    if (updated) saveToDb('tutanaklar', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setTutanaklar, saveToDb]);

  const deleteTutanak = useCallback((id: string) => {
    let updated: Tutanak | null = null;
    setTutanaklar(prev => prev.map(t => {
      if (t.id !== id) return t;
      updated = { ...t, silinmis: true as const, silinmeTarihi: new Date().toISOString() };
      return updated;
    }));
    if (updated) saveToDb('tutanaklar', updated as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('tutanak_deleted', 'Tutanaklar', id, undefined, 'Tutanak silindi.');
  }, [setTutanaklar, saveToDb]);

  const restoreTutanak = useCallback((id: string) => {
    let updated: Tutanak | null = null;
    setTutanaklar(prev => prev.map(t => {
      if (t.id !== id) return t;
      updated = { ...t, silinmis: false as const, silinmeTarihi: undefined };
      return updated;
    }));
    if (updated) saveToDb('tutanaklar', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setTutanaklar, saveToDb]);

  const tutanaklarRef2 = useRef<Tutanak[]>([]);
  useEffect(() => { tutanaklarRef2.current = tutanaklar; }, [tutanaklar]);

  const permanentDeleteTutanak = useCallback(async (id: string) => {
    const snapshot = tutanaklarRef2.current;
    ownDeletesRef.current.add(id);
    _setTutanaklar(prev => prev.filter(t => t.id !== id));
    try {
      await dbDelete('tutanaklar', id);
    } catch (err) {
      console.error('[ISG] permanentDeleteTutanak FAILED, rolling back:', err);
      ownDeletesRef.current.delete(id);
      _setTutanaklar(snapshot);
      onSaveErrorRef.current?.(`Kalıcı silme hatası (tutanaklar): ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }, []);

  // ──────── İŞ İZNİ ────────
  const addIsIzni = useCallback(async (iz: Omit<IsIzni, 'id' | 'izinNo' | 'olusturmaTarihi' | 'guncellemeTarihi'>) => {
    const now = new Date().toISOString();
    const id = genId();
    const rpcNo = await generateRecordNoFromDB('is_izni');
    const izinNo = rpcNo ?? generateIsIzniNo(isIzRef.current);
    const newIz: IsIzni = { ...iz, id, izinNo, olusturmaTarihi: now, guncellemeTarihi: now };
    setIsIzinleri(prev => [newIz, ...prev]);
    // DB'ye yazılmasını bekle ve hata fırlat — evrak yükleme bu tamamlanmadan yapılmamalı
    await saveToDb('is_izinleri', newIz as unknown as { id: string } & Record<string, unknown>, true);
    logFnRef.current?.('is_izni_created', 'İş İzinleri', id, izinNo, `${izinNo} iş izni oluşturuldu.`);
    return newIz;
  }, [setIsIzinleri, saveToDb]);

  const updateIsIzni = useCallback(async (id: string, updates: Partial<IsIzni>): Promise<void> => {
    let updated: IsIzni | null = null;
    let snapshot: IsIzni | null = null;
    setIsIzinleri(prev => prev.map(iz => {
      if (iz.id !== id) return iz;
      snapshot = iz;
      updated = { ...iz, ...updates, guncellemeTarihi: new Date().toISOString() };
      return updated;
    }));
    if (updated) {
      const now = new Date().toISOString();
      try {
        const orgId = orgIdRef.current;
        const uid = userIdRef.current;
        const deviceId = getDeviceId();

        // orgId null ise güncelleme yapma — RLS bypass eder ve veri kaybı olur
        if (!orgId) {
          console.error('[ISG] updateIsIzni ABORT: orgId is null!');
          if (snapshot) setIsIzinleri(prev => prev.map(iz => iz.id === id ? snapshot! : iz));
          throw new Error('Organizasyon bilgisi hazır değil. Sayfayı yenileyip tekrar deneyin.');
        }

        console.log(`[ISG] updateIsIzni: id=${id} org=${orgId} device=${deviceId} durum=${(updated as IsIzni).durum}`);

        // Direkt UPDATE kullan — device_id mutlaka yazılsın (realtime sync için kritik)
        const { data: updatedRows, error } = await supabase
          .from('is_izinleri')
          .update({
            data: updated,
            updated_at: now,
            organization_id: orgId,
            user_id: uid,
            device_id: deviceId,
          })
          .eq('id', id)
          .eq('organization_id', orgId)
          .select('id');

        console.log(`[ISG] updateIsIzni result: rows=${updatedRows?.length ?? 0} error=${error?.message}`);

        if (error) {
          const errMsg = error.message || error.details || JSON.stringify(error);
          console.error('[ISG] updateIsIzni DB error:', errMsg, error);
          if (snapshot) {
            setIsIzinleri(prev => prev.map(iz => iz.id === id ? snapshot! : iz));
          }
          if (errMsg.includes('row-level security') || errMsg.includes('RLS') || errMsg.includes('policy')) {
            throw new Error(`Yetki hatası: Bu işlem için yetkiniz yok. (${errMsg})`);
          }
          throw new Error(errMsg);
        }

        // Eğer update hiçbir satırı etkilememişse — RLS veya yanlış orgId
        if (!updatedRows || updatedRows.length === 0) {
          console.warn(`[ISG] updateIsIzni: 0 rows updated for id=${id} org=${orgId} — trying without org filter`);
          // OrgId filtresi olmadan tekrar dene (bazı RLS politikalarında gerekebilir)
          const { data: fallbackRows, error: err2 } = await supabase
            .from('is_izinleri')
            .update({
              data: updated,
              updated_at: now,
              device_id: deviceId,
            })
            .eq('id', id)
            .select('id');

          if (err2) {
            console.error('[ISG] updateIsIzni fallback error:', err2.message);
            if (snapshot) setIsIzinleri(prev => prev.map(iz => iz.id === id ? snapshot! : iz));
            throw new Error(err2.message);
          }
          if (!fallbackRows || fallbackRows.length === 0) {
            console.error(`[ISG] updateIsIzni: STILL 0 rows — record may not exist or RLS blocking`);
            if (snapshot) setIsIzinleri(prev => prev.map(iz => iz.id === id ? snapshot! : iz));
            throw new Error('İş izni güncellenemedi. Kayıt bulunamadı veya yetki hatası.');
          }
          console.log(`[ISG] updateIsIzni fallback OK: ${id}`);
        } else {
          console.log(`[ISG] updateIsIzni OK: ${id} (${updatedRows.length} rows updated)`);
        }
      } catch (err) {
        if (snapshot) {
          setIsIzinleri(prev => prev.map(iz => iz.id === id ? snapshot! : iz));
        }
        throw err;
      }
    }
    logFnRef.current?.('is_izni_updated', 'İş İzinleri', id, updates.izinNo, 'İş izni güncellendi.');
  }, [setIsIzinleri]);

  const deleteIsIzni = useCallback((id: string) => {
    const now = new Date().toISOString();
    // Snapshot'tan updated kaydı bul — state setter async olduğu için önce ref'ten al
    const current = isIzRef.current.find(iz => iz.id === id);
    if (!current) return;
    const updated: IsIzni = { ...current, silinmis: true as const, silinmeTarihi: now };
    setIsIzinleri(prev => prev.map(iz => iz.id === id ? updated : iz));
    // is_izinleri tablosu deleted_at kolonunu kullanıyor — direkt update
    supabase
      .from('is_izinleri')
      .update({ deleted_at: now, data: updated, updated_at: now, device_id: getDeviceId() })
      .eq('id', id)
      .then(({ error }) => {
        if (error) {
          console.error('[ISG] deleteIsIzni DB error:', error.message);
          // Rollback
          setIsIzinleri(prev => prev.map(iz => iz.id === id ? current : iz));
          onSaveErrorRef.current?.(`İş izni silme hatası: ${error.message}`);
        } else {
          console.log('[ISG] deleteIsIzni OK:', id);
        }
      });
    logFnRef.current?.('is_izni_deleted', 'İş İzinleri', id, undefined, 'İş izni silindi.');
  }, [setIsIzinleri]);

  const restoreIsIzni = useCallback((id: string) => {
    const now = new Date().toISOString();
    const current = isIzRef.current.find(iz => iz.id === id);
    if (!current) return;
    const updated: IsIzni = { ...current, silinmis: false as const, silinmeTarihi: undefined };
    setIsIzinleri(prev => prev.map(iz => iz.id === id ? updated : iz));
    // is_izinleri tablosu deleted_at kolonunu kullanıyor — null'a çek
    supabase
      .from('is_izinleri')
      .update({ deleted_at: null, data: updated, updated_at: now, device_id: getDeviceId() })
      .eq('id', id)
      .then(({ error }) => {
        if (error) {
          console.error('[ISG] restoreIsIzni DB error:', error);
          setIsIzinleri(prev => prev.map(iz => iz.id === id ? current : iz));
        } else {
          console.log(`[ISG] restoreIsIzni OK: ${id}`);
        }
      });
  }, [setIsIzinleri]);

  const isIzinleriRef2 = useRef<IsIzni[]>([]);
  useEffect(() => { isIzinleriRef2.current = isIzinleri; }, [isIzinleri]);

  const permanentDeleteIsIzni = useCallback(async (id: string) => {
    const snapshot = isIzinleriRef2.current;
    ownDeletesRef.current.add(id);
    _setIsIzinleri(prev => prev.filter(iz => iz.id !== id));
    try {
      await dbDelete('is_izinleri', id);
      logFnRef.current?.('is_izni_perm_deleted', 'İş İzinleri', id, undefined, 'İş izni kalıcı silindi.');
    } catch (err) {
      console.error('[ISG] permanentDeleteIsIzni FAILED, rolling back:', err);
      ownDeletesRef.current.delete(id);
      _setIsIzinleri(snapshot);
      onSaveErrorRef.current?.(`Kalıcı silme hatası (is_izinleri): ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }, []);

  // ──────── LOGO — Supabase Storage ────────
  /**
   * Firma logosunu Storage'a yükle ve URL'yi firmalar tablosuna kaydet.
   * Artık localStorage kullanılmıyor — tüm cihazlarda çalışır.
   * file: File objesi veya zaten yüklenmiş URL string'i kabul eder.
   */
  const setFirmaLogo = useCallback(async (firmaId: string, fileOrUrl: File | string): Promise<string | null> => {
    if (typeof fileOrUrl === 'string') {
      // Zaten bir URL — sadece DB'ye kaydet
      updateFirma(firmaId, { logoUrl: fileOrUrl } as Partial<Firma>);
      return fileOrUrl;
    }
    const orgId = orgIdRef.current ?? 'unknown';
    // uploadFileToStorage → filePath döner (path, URL değil)
    const filePath = await uploadFileToStorage(fileOrUrl, orgId, 'firma-logo', firmaId);
    if (filePath) {
      // filePath'i signed URL'ye çevir (24 saat geçerli) — böylece <img src> direkt çalışır
      const { getSignedUrl } = await import('../utils/fileUpload');
      const signedUrl = await getSignedUrl(filePath);
      const urlToSave = signedUrl ?? filePath;
      updateFirma(firmaId, { logoUrl: urlToSave } as Partial<Firma>);
      return urlToSave;
    }
    return null;
  }, [updateFirma]);



  // ──────── PERSONEL FOTO — Supabase Storage ────────
  /**
   * Personel fotoğrafını Storage'a yükle ve URL'yi personeller tablosuna kaydet.
   */
  const setPersonelFoto = useCallback(async (personelId: string, file: File): Promise<string | null> => {
    const orgId = orgIdRef.current ?? 'unknown';
    const url = await uploadFileToStorage(file, orgId, 'personel-foto', personelId);
    if (url) {
      updatePersonel(personelId, { fotoUrl: url } as Partial<Personel>);
    }
    return url;
  }, [updatePersonel]);

  const getPersonelFoto = useCallback((personelId: string): string | null => {
    const p = _setPersoneller.length !== undefined
      ? undefined
      : undefined;
    void p;
    // fotoUrl doğrudan personel state'inden okunur
    const found = personeller.find(x => x.id === personelId);
    return found?.fotoUrl ?? null;
  }, [personeller]);

  // ──────── CURRENT USER ────────
  const updateCurrentUser = useCallback((updates: Partial<CurrentUser>) => {
    setCurrentUser(prev => ({ ...prev, ...updates }));
  }, []);

  return {
    firmalar, personeller, evraklar, egitimler, muayeneler,
    uygunsuzluklar, ekipmanlar, gorevler, tutanaklar, isIzinleri, currentUser,
    dataLoading,
    pageLoading,
    partialLoading,
    realtimeStatus,
    isSaving: false,
    refreshAllData,
    fetchFirmalar, fetchPersoneller, fetchEvraklar, fetchEgitimler,
    fetchMuayeneler, fetchUygunsuzluklar, fetchEkipmanlar,
    fetchGorevler, fetchTutanaklar, fetchIsIzinleri,
    addFirma, updateFirma, deleteFirma, restoreFirma, permanentDeleteFirma,
    addPersonel, updatePersonel, deletePersonel, restorePersonel, permanentDeletePersonel,
    addEvrak, updateEvrak, deleteEvrak, restoreEvrak, permanentDeleteEvrak,
    addEgitim, updateEgitim, deleteEgitim, restoreEgitim, permanentDeleteEgitim,
    addMuayene, updateMuayene, deleteMuayene, restoreMuayene, permanentDeleteMuayene,
    addUygunsuzluk, updateUygunsuzluk, deleteUygunsuzluk, permanentDeleteUygunsuzluk, getUygunsuzlukPhoto, setUygunsuzlukPhoto,
    addEkipman, updateEkipman, deleteEkipman, restoreEkipman, permanentDeleteEkipman, permanentDeleteEkipmanMany,
    addEkipmanKontrolKaydi, addEkipmanBelge,
    addGorev, updateGorev, deleteGorev,
    addTutanak, updateTutanak, deleteTutanak, restoreTutanak, permanentDeleteTutanak,
    addIsIzni, updateIsIzni, deleteIsIzni, restoreIsIzni, permanentDeleteIsIzni,
    setFirmaLogo,
    getPersonelFoto, setPersonelFoto,
    updateCurrentUser,
  };
}

export type StoreType = ReturnType<typeof useStore>;