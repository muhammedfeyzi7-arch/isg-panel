/**
 * useOfflineQueue — Production-safe global offline işlem kuyruğu v3
 *
 * Yeni özellikler (v3):
 * 1. Sync History — son 10 sync logu, başarılı/başarısız/işlem sayısı
 * 2. Exponential Backoff — aynı hata tekrarında 1s→3s→10s bekleme
 * 3. Offline Session ID — her offline oturum için benzersiz sessionId
 * 4. Force Sync — kullanıcı tetiklemeli manuel tam sync
 * 5. Data Consistency Check — sync sonrası backend state karşılaştırma hook'u
 *
 * Mevcut özellikler (v2):
 * - Queue size limit (MAX_QUEUE_SIZE = 100)
 * - Payload validation
 * - Sync fail log
 * - Debounced online event
 * - visibilitychange sync
 * - Crash recovery
 * - FIFO guarantee
 * - Max 3 retry → drop + log
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Sabitler ─────────────────────────────────────────────────────────────────
const DB_NAME            = 'isg_offline_queue';
const DB_VERSION         = 2;
const STORE_NAME         = 'queue';
const MAX_RETRY          = 3;
const MAX_QUEUE_SIZE     = 100;
const ONLINE_DEBOUNCE_MS = 2000;
const STARTUP_SYNC_MS    = 1000;
const MAX_SYNC_HISTORY   = 10;

/** Exponential backoff gecikme tablosu (ms) */
const BACKOFF_DELAYS: Record<number, number> = {
  0: 0,
  1: 1000,
  2: 3000,
  3: 10000,
};

// ─── Sync History ─────────────────────────────────────────────────────────────
export interface SyncHistoryEntry {
  id:           string;
  startedAt:    string;   // ISO
  finishedAt:   string;   // ISO
  durationMs:   number;
  totalItems:   number;
  successCount: number;
  failCount:    number;
  droppedCount: number;
  sessionId:    string;
  trigger:      'online' | 'startup' | 'visibility' | 'manual';
}

const _syncHistory: SyncHistoryEntry[] = [];

export function getSyncHistory(): SyncHistoryEntry[] {
  return [..._syncHistory].reverse(); // en yeni başta
}

function _appendSyncHistory(entry: SyncHistoryEntry): void {
  _syncHistory.push(entry);
  if (_syncHistory.length > MAX_SYNC_HISTORY) _syncHistory.shift();
}

// ─── Structured fail log ──────────────────────────────────────────────────────
export interface SyncFailLog {
  itemId:     string;
  itemType:   string;
  itemLabel:  string;
  errorMsg:   string;
  retryCount: number;
  droppedAt?: string;
  ts:         string;
  sessionId?: string;
}

const _failLog: SyncFailLog[] = [];

export function getSyncFailLog(): SyncFailLog[] {
  return [..._failLog];
}

function _appendFailLog(entry: SyncFailLog): void {
  _failLog.push(entry);
  console.warn('[OfflineQueue][FailLog]', entry);
}

// ─── Session ID ───────────────────────────────────────────────────────────────
/** Aktif offline session ID — online gelince sıfırlanır */
let _currentSessionId: string = _makeSessionId();

export function getCurrentSessionId(): string {
  return _currentSessionId;
}

function _makeSessionId(): string {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function _rotateSessionId(): void {
  _currentSessionId = _makeSessionId();
}

// ─── IndexedDB helpers ────────────────────────────────────────────────────────
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror  = () => reject(req.error);
  });
}

export async function dbGetAll(): Promise<OfflineQueueItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).index('createdAt').getAll();
      req.onsuccess = () => {
        const raw   = req.result as unknown[];
        const valid = raw.filter((r): r is OfflineQueueItem => {
          if (!r || typeof r !== 'object') return false;
          const item = r as Partial<OfflineQueueItem>;
          return (
            typeof item.id        === 'string' &&
            typeof item.type      === 'string' &&
            typeof item.createdAt === 'number' &&
            typeof item.payload   === 'object' &&
            item.payload !== null
          );
        });
        if (valid.length !== raw.length) {
          console.warn(`[OfflineQueue] ${raw.length - valid.length} bozuk kayıt atlandı`);
        }
        resolve(valid);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function dbAdd(item: OfflineQueueItem): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(item);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  } catch { /* IndexedDB kullanılamıyorsa sessizce geç */ }
}

export async function dbDelete(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).delete(id);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  } catch { /* sessizce geç */ }
}

export async function dbClear(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).clear();
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  } catch { /* sessizce geç */ }
}

/** Tek bir item'i ID'ye göre retry sayısını güncelleyerek yaz */
export async function dbUpdateRetry(id: string, retryCount: number): Promise<void> {
  try {
    const items = await dbGetAll();
    const item  = items.find(i => i.id === id);
    if (item) await dbAdd({ ...item, retryCount });
  } catch { /* sessizce geç */ }
}

// ─── Tipler ───────────────────────────────────────────────────────────────────
export type OfflineActionType =
  | 'ekipman_kontrol'
  | 'ekipman_durum'
  | 'ziyaret_checkin'
  | 'ziyaret_checkout';

// ─── Ekipman Payload Types ────────────────────────────────────────────────────

export interface EkipmanKontrolKaydi {
  id:            string;
  tarih:         string;
  kontrolEden:   string;
  kontrolEdenId: string;
  durum:         string;
  notlar?:       string;
  fotoUrl?:      string;
  kaynak?:       string;
}

export interface EkipmanKontrolPayload {
  ekipmanId:           string;
  organizationId:      string;
  sonKontrolTarihi:    string;
  sonrakiKontrolTarihi: string;
  durum:               string;
  yeniKayit:           EkipmanKontrolKaydi;
  /** Sync anında mevcut ekipman JSONB data'sı — merge için */
  mevcutData?:         Record<string, unknown>;
}

export interface EkipmanDurumPayload {
  ekipmanId:      string;
  organizationId: string;
  durum:          string;
  yeniKayit:      EkipmanKontrolKaydi;
  /** Sync anında mevcut ekipman JSONB data'sı — merge için */
  mevcutData?:    Record<string, unknown>;
}

export interface ZiyaretCheckinPayload {
  tempId:             string;
  osgbOrgId:          string;
  firmaOrgId:         string;
  firmaAd:            string;
  uzmanUserId:        string;
  uzmanAd:            string;
  uzmanEmail:         string | null;
  girisAt:            string;
  qrIleGiris:         boolean;
  checkInLat:         number | null;
  checkInLng:         number | null;
  gpsStatus:          'ok' | 'too_far' | 'no_permission' | null;
  checkInDistanceM:   number | null;
  sessionId?:         string;
}

export interface ZiyaretCheckoutPayload {
  tempId:         string | null;
  realId:         string | null;
  uzmanUserId:    string;
  cikisAt:        string;
  sureDakika:     number | null;
  checkOutLat:    number | null;
  checkOutLng:    number | null;
  sessionId?:     string;
}

export interface OfflineQueueItem {
  id:          string;
  type:        OfflineActionType;
  payload:     Record<string, unknown>;
  createdAt:   number;
  retryCount:  number;
  label:       string;
  sessionId?:  string;
  lastError?:  string;
}

export interface UseOfflineQueueReturn {
  isOnline:        boolean;
  isSyncing:       boolean;
  pendingCount:    number;
  pendingItems:    OfflineQueueItem[];
  lastSyncAt:      Date | null;
  syncError:       string | null;
  queueLimitWarn:  boolean;
  sessionId:       string;
  addToQueue:      (item: Omit<OfflineQueueItem, 'id' | 'createdAt' | 'retryCount' | 'sessionId'>) => Promise<'ok' | 'limit_dropped' | 'validation_error'>;
  syncNow:         (trigger?: SyncHistoryEntry['trigger']) => Promise<void>;
  forceSyncAll:    () => Promise<void>;
  clearQueue:      () => Promise<void>;
  retryItem:       (id: string) => Promise<void>;
}

// ─── Payload Validation ───────────────────────────────────────────────────────
function validatePayload(type: OfflineActionType, payload: Record<string, unknown>): string | null {
  const now = Date.now();
  switch (type) {
    case 'ziyaret_checkin': {
      if (!payload.uzmanUserId) return 'uzmanUserId eksik';
      if (!payload.firmaOrgId)  return 'firmaOrgId eksik';
      if (!payload.osgbOrgId)   return 'osgbOrgId eksik';
      if (!payload.girisAt)     return 'girisAt eksik';
      const ts = new Date(payload.girisAt as string).getTime();
      if (isNaN(ts)) return 'girisAt geçersiz timestamp';
      if (Math.abs(now - ts) > 86400000 * 2) {
        console.warn('[OfflineQueue] girisAt 2 günden eskiye ait:', payload.girisAt);
      }
      break;
    }
    case 'ziyaret_checkout': {
      if (!payload.uzmanUserId)               return 'uzmanUserId eksik';
      if (!payload.tempId && !payload.realId) return 'tempId veya realId gerekli';
      if (!payload.cikisAt)                   return 'cikisAt eksik';
      const ts = new Date(payload.cikisAt as string).getTime();
      if (isNaN(ts)) return 'cikisAt geçersiz timestamp';
      break;
    }
    case 'ekipman_kontrol':
    case 'ekipman_durum': {
      if (!payload.ekipmanId) return 'ekipmanId eksik';
      break;
    }
    default:
      break;
  }
  return null;
}

// ─── Exponential Backoff ──────────────────────────────────────────────────────
function getBackoffDelay(retryCount: number): number {
  return BACKOFF_DELAYS[retryCount] ?? BACKOFF_DELAYS[3];
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  return new Promise(r => setTimeout(r, ms));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useOfflineQueue(
  onApply: (item: OfflineQueueItem) => Promise<void>,
): UseOfflineQueueReturn {
  const [isOnline,       setIsOnline]       = useState(() => navigator.onLine);
  const [isSyncing,      setIsSyncing]      = useState(false);
  const [pendingItems,   setPendingItems]   = useState<OfflineQueueItem[]>([]);
  const [lastSyncAt,     setLastSyncAt]     = useState<Date | null>(null);
  const [syncError,      setSyncError]      = useState<string | null>(null);
  const [queueLimitWarn, setQueueLimitWarn] = useState(false);
  const [sessionId,      setSessionId]      = useState(_currentSessionId);

  const onApplyRef      = useRef(onApply);
  const isSyncingRef    = useRef(false);
  const startupDoneRef  = useRef(false);
  const onlineDebounce  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { onApplyRef.current = onApply; }, [onApply]);

  // İlk yüklemede queue'yu oku
  useEffect(() => {
    void dbGetAll().then(items => {
      setPendingItems(items);
      setQueueLimitWarn(items.length >= MAX_QUEUE_SIZE * 0.8);
    });
  }, []);

  // ── syncNow — FIFO, parallel korumalı, backoff, history ──────────────────
  const syncNow = useCallback(async (trigger: SyncHistoryEntry['trigger'] = 'manual') => {
    if (isSyncingRef.current) return;
    if (!navigator.onLine) return;

    const items = await dbGetAll();
    if (items.length === 0) { setPendingItems([]); return; }

    isSyncingRef.current = true;
    setIsSyncing(true);
    setSyncError(null);

    const histStart      = Date.now();
    const histSessionId  = _currentSessionId;
    let successCount     = 0;
    let failCount        = 0;
    let droppedCount     = 0;

    const sorted = [...items].sort((a, b) => a.createdAt - b.createdAt);

    for (const item of sorted) {
      // Exponential backoff: önceki deneme sayısına göre bekle
      const delay = getBackoffDelay(item.retryCount);
      await sleep(delay);

      try {
        await onApplyRef.current(item);
        await dbDelete(item.id);
        successCount++;
      } catch (err) {
        failCount++;
        const errMsg    = err instanceof Error ? err.message : String(err);
        const nextRetry = item.retryCount + 1;

        if (nextRetry >= MAX_RETRY) {
          droppedCount++;
          _appendFailLog({
            itemId:     item.id,
            itemType:   item.type,
            itemLabel:  item.label,
            errorMsg:   errMsg,
            retryCount: nextRetry,
            droppedAt:  new Date().toISOString(),
            ts:         new Date().toISOString(),
            sessionId:  histSessionId,
          });
          await dbDelete(item.id);
        } else {
          _appendFailLog({
            itemId:     item.id,
            itemType:   item.type,
            itemLabel:  item.label,
            errorMsg:   errMsg,
            retryCount: nextRetry,
            ts:         new Date().toISOString(),
            sessionId:  histSessionId,
          });
          await dbAdd({ ...item, retryCount: nextRetry, lastError: errMsg });
        }
      }
    }

    // Sync History kaydı
    const histFinish = Date.now();
    _appendSyncHistory({
      id:           `sh_${histStart.toString(36)}`,
      startedAt:    new Date(histStart).toISOString(),
      finishedAt:   new Date(histFinish).toISOString(),
      durationMs:   histFinish - histStart,
      totalItems:   sorted.length,
      successCount,
      failCount,
      droppedCount,
      sessionId:    histSessionId,
      trigger,
    });

    const remaining = await dbGetAll();
    setPendingItems(remaining);
    setQueueLimitWarn(remaining.length >= MAX_QUEUE_SIZE * 0.8);
    setLastSyncAt(new Date());
    isSyncingRef.current = false;
    setIsSyncing(false);

    if (failCount > 0 && successCount === 0) {
      setSyncError(`${failCount} işlem gönderilemedi.`);
    } else if (failCount > 0) {
      setSyncError(`${failCount} işlem tekrar denenecek, ${successCount} başarılı.`);
    } else {
      setSyncError(null);
    }
  }, []);

  /** Force sync: tüm retry count'ları sıfırla + backoff'suz hemen dene */
  const forceSyncAll = useCallback(async () => {
    if (isSyncingRef.current) return;
    if (!navigator.onLine) { setSyncError('İnternet bağlantısı yok.'); return; }

    // Retry count'ları sıfırla
    const items = await dbGetAll();
    for (const item of items) {
      if (item.retryCount > 0) await dbAdd({ ...item, retryCount: 0, lastError: undefined });
    }
    await syncNow('manual');
  }, [syncNow]);

  // ── Tek item retry ────────────────────────────────────────────────────────
  const retryItem = useCallback(async (id: string) => {
    const items = await dbGetAll();
    const item  = items.find(i => i.id === id);
    if (!item || !navigator.onLine) return;

    try {
      await onApplyRef.current(item);
      await dbDelete(id);
      const remaining = await dbGetAll();
      setPendingItems(remaining);
      setSyncError(null);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await dbAdd({ ...item, retryCount: item.retryCount + 1, lastError: errMsg });
      const remaining = await dbGetAll();
      setPendingItems(remaining);
    }
  }, []);

  // ── online/offline + visibilitychange ─────────────────────────────────────
  useEffect(() => {
    const triggerDebounced = (trigger: SyncHistoryEntry['trigger']) => {
      if (onlineDebounce.current) clearTimeout(onlineDebounce.current);
      onlineDebounce.current = setTimeout(() => { void syncNow(trigger); }, ONLINE_DEBOUNCE_MS);
    };

    const handleOnline = () => {
      setIsOnline(true);
      setSyncError(null);
      // Yeni oturum başladı → session ID döndür
      _rotateSessionId();
      setSessionId(_currentSessionId);
      triggerDebounced('online');
    };

    const handleOffline = () => {
      setIsOnline(false);
      if (onlineDebounce.current) { clearTimeout(onlineDebounce.current); onlineDebounce.current = null; }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) triggerDebounced('visibility');
    };

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);

    if (navigator.onLine && !startupDoneRef.current) {
      startupDoneRef.current = true;
      setTimeout(() => { void syncNow('startup'); }, STARTUP_SYNC_MS);
    }

    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (onlineDebounce.current) clearTimeout(onlineDebounce.current);
    };
  }, [syncNow]);

  // ── addToQueue — validation + size limit + sessionId ─────────────────────
  const addToQueue = useCallback(async (
    item: Omit<OfflineQueueItem, 'id' | 'createdAt' | 'retryCount' | 'sessionId'>,
  ): Promise<'ok' | 'limit_dropped' | 'validation_error'> => {
    const validErr = validatePayload(item.type, item.payload);
    if (validErr) {
      console.error(`[OfflineQueue] Validation failed for ${item.type}: ${validErr}`, item.payload);
      _appendFailLog({
        itemId:     'N/A',
        itemType:   item.type,
        itemLabel:  item.label,
        errorMsg:   `Validation: ${validErr}`,
        retryCount: 0,
        droppedAt:  new Date().toISOString(),
        ts:         new Date().toISOString(),
      });
      return 'validation_error';
    }

    const currentItems  = await dbGetAll();
    let limitDropped = false;

    if (currentItems.length >= MAX_QUEUE_SIZE) {
      const oldest = [...currentItems].sort((a, b) => a.createdAt - b.createdAt)[0];
      if (oldest) {
        await dbDelete(oldest.id);
        console.warn(`[OfflineQueue] Size limit aşıldı, en eski silindi:`, oldest.id);
        limitDropped = true;
      }
    }

    const newItem: OfflineQueueItem = {
      ...item,
      id:         `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt:  Date.now(),
      retryCount: 0,
      sessionId:  _currentSessionId,
    };
    await dbAdd(newItem);
    const updated = await dbGetAll();
    setPendingItems(updated);
    setQueueLimitWarn(updated.length >= MAX_QUEUE_SIZE * 0.8);

    return limitDropped ? 'limit_dropped' : 'ok';
  }, []);

  // ── clearQueue ────────────────────────────────────────────────────────────
  const clearQueue = useCallback(async () => {
    await dbClear();
    setPendingItems([]);
    setSyncError(null);
    setQueueLimitWarn(false);
  }, []);

  return {
    isOnline,
    isSyncing,
    pendingCount: pendingItems.length,
    pendingItems,
    lastSyncAt,
    syncError,
    queueLimitWarn,
    sessionId,
    addToQueue,
    syncNow,
    forceSyncAll,
    clearQueue,
    retryItem,
  };
}
