/**
 * useOfflineQueue — Saha sayfası için offline işlem kuyruğu
 *
 * Desteklenen işlemler:
 * - ekipman_kontrol     : Ekipman kontrol durumu güncelleme
 * - ekipman_durum       : Ekipman durum değiştirme
 * - ziyaret_checkin     : Ziyaret başlatma (check-in)
 * - ziyaret_checkout    : Ziyaret bitirme (check-out)
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ─── IndexedDB helpers ────────────────────────────────────────────────────────
const DB_NAME    = 'isg_offline_queue';
const DB_VERSION = 2;  // v2: ziyaret tipleri eklendi
const STORE_NAME = 'queue';

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

async function dbGetAll(): Promise<OfflineQueueItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).index('createdAt').getAll();
      req.onsuccess = () => resolve(req.result as OfflineQueueItem[]);
      req.onerror   = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

async function dbAdd(item: OfflineQueueItem): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(item);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  } catch {
    // IndexedDB kullanılamıyorsa sessizce geç
  }
}

async function dbDelete(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).delete(id);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  } catch {
    // sessizce geç
  }
}

async function dbClear(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).clear();
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  } catch {
    // sessizce geç
  }
}

// ─── Tipler ───────────────────────────────────────────────────────────────────
export type OfflineActionType =
  | 'ekipman_kontrol'
  | 'ekipman_durum'
  | 'ziyaret_checkin'
  | 'ziyaret_checkout';

export interface ZiyaretCheckinPayload {
  tempId: string;              // Offline oluşturulan geçici ID (localStorage'da saklı)
  osgbOrgId: string;
  firmaOrgId: string;
  firmaAd: string;
  uzmanUserId: string;
  uzmanAd: string;
  uzmanEmail: string | null;
  girisAt: string;             // ISO timestamp
  qrIleGiris: boolean;
  checkInLat: number | null;
  checkInLng: number | null;
  gpsStatus: 'ok' | 'too_far' | 'no_permission' | null;
  checkInDistanceM: number | null;
}

export interface ZiyaretCheckoutPayload {
  tempId: string | null;       // Offline oluşturulanın geçici ID'si (gerçek id yoksa)
  realId: string | null;       // Gerçek DB id (online oluşturulmuşsa)
  uzmanUserId: string;
  cikisAt: string;             // ISO timestamp
  sureDakika: number | null;
  checkOutLat: number | null;
  checkOutLng: number | null;
}

export interface OfflineQueueItem {
  id: string;
  type: OfflineActionType;
  payload: Record<string, unknown>;
  createdAt: number;
  retryCount: number;
  label: string;
}

export interface OfflineQueueState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  pendingItems: OfflineQueueItem[];
  lastSyncAt: Date | null;
  syncError: string | null;
}

export interface UseOfflineQueueReturn extends OfflineQueueState {
  addToQueue: (item: Omit<OfflineQueueItem, 'id' | 'createdAt' | 'retryCount'>) => Promise<void>;
  syncNow: () => Promise<void>;
  clearQueue: () => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useOfflineQueue(
  onApply: (item: OfflineQueueItem) => Promise<void>,
): UseOfflineQueueReturn {
  const [isOnline, setIsOnline]       = useState(() => navigator.onLine);
  const [isSyncing, setIsSyncing]     = useState(false);
  const [pendingItems, setPendingItems] = useState<OfflineQueueItem[]>([]);
  const [lastSyncAt, setLastSyncAt]   = useState<Date | null>(null);
  const [syncError, setSyncError]     = useState<string | null>(null);

  const onApplyRef   = useRef(onApply);
  const isSyncingRef = useRef(false);
  useEffect(() => { onApplyRef.current = onApply; }, [onApply]);

  const loadQueue = useCallback(async () => {
    const items = await dbGetAll();
    setPendingItems(items);
  }, []);

  useEffect(() => { void loadQueue(); }, [loadQueue]);

  const syncNow = useCallback(async () => {
    if (isSyncingRef.current) return;
    if (!navigator.onLine) return;

    const items = await dbGetAll();
    if (items.length === 0) { setPendingItems([]); return; }

    isSyncingRef.current = true;
    setIsSyncing(true);
    setSyncError(null);

    let successCount = 0;
    let failCount    = 0;

    for (const item of items) {
      try {
        await onApplyRef.current(item);
        await dbDelete(item.id);
        successCount++;
      } catch (err) {
        failCount++;
        const updated: OfflineQueueItem = { ...item, retryCount: item.retryCount + 1 };
        await dbAdd(updated);
        console.warn(`[OfflineQueue] Sync failed for ${item.id}:`, err);
        // 3 denemeden sonra bırak
        if (updated.retryCount >= 3) {
          await dbDelete(item.id);
          console.error(`[OfflineQueue] Dropped after 3 retries: ${item.id}`);
        }
      }
    }

    const remaining = await dbGetAll();
    setPendingItems(remaining);
    setLastSyncAt(new Date());
    isSyncingRef.current = false;
    setIsSyncing(false);

    if (failCount > 0) {
      setSyncError(`${failCount} işlem uygulanamadı, ${successCount} işlem başarılı.`);
    } else {
      setSyncError(null);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncError(null);
      setTimeout(() => { void syncNow(); }, 1500);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (navigator.onLine) setTimeout(() => { void syncNow(); }, 500);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncNow]);

  const addToQueue = useCallback(async (
    item: Omit<OfflineQueueItem, 'id' | 'createdAt' | 'retryCount'>,
  ) => {
    const newItem: OfflineQueueItem = {
      ...item,
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      retryCount: 0,
    };
    await dbAdd(newItem);
    setPendingItems(prev => [...prev, newItem]);
  }, []);

  const clearQueue = useCallback(async () => {
    await dbClear();
    setPendingItems([]);
    setSyncError(null);
  }, []);

  return {
    isOnline,
    isSyncing,
    pendingCount: pendingItems.length,
    pendingItems,
    lastSyncAt,
    syncError,
    addToQueue,
    syncNow,
    clearQueue,
  };
}
