import { useState, useCallback, useRef, useEffect } from 'react';
import type { Gorev } from '@/types';
import { supabase } from '@/lib/supabase';

// ── Helpers (duplicated locally to avoid coupling with useStore internals) ──
function genId(): string {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

function getDeviceId(): string {
  let id = sessionStorage.getItem('isg_device_id');
  if (!id) {
    id = `dev_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
    sessionStorage.setItem('isg_device_id', id);
  }
  return id;
}

const DB_NAME = 'isg_cache';
const DB_VERSION = 1;
const STORE_NAME = 'tables';
const CACHE_TTL_MS = 30 * 1000;

function openCacheDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readCache<T>(key: string): Promise<{ data: T; ts: number } | null> {
  try {
    const db = await openCacheDB();
    return new Promise(resolve => {
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
    return new Promise(resolve => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ data, ts: Date.now() }, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { /* ignore */ }
}

async function dbUpsertGorev(
  item: Gorev & Record<string, unknown>,
  userId: string,
  organizationId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const payload = {
    id: item.id,
    user_id: userId,
    organization_id: organizationId,
    device_id: getDeviceId(),
    data: item,
    updated_at: now,
    deleted_at: null,
  };
  const { error } = await supabase.from('gorevler').upsert(payload, { onConflict: 'id' });
  if (error) throw new Error(error.message || JSON.stringify(error));
}

async function dbDeleteGorev(id: string): Promise<void> {
  try {
    await supabase.from('gorevler').update({ device_id: getDeviceId() }).eq('id', id);
  } catch { /* ignore */ }
  const { error } = await supabase.from('gorevler').delete().eq('id', id);
  if (error) throw error;
}

// ── Hook ──
export interface GorevStoreOptions {
  organizationId: string | null;
  userId: string | undefined;
  orgLoading: boolean;
  isSwitching: boolean;
  onSaveError?: (msg: string) => void;
  logFn?: (actionType: string, module: string, recordId: string, recordName?: string, description?: string) => void;
}

export function useGorevStore({
  organizationId,
  userId,
  orgLoading,
  isSwitching,
  onSaveError,
  logFn,
}: GorevStoreOptions) {
  const [gorevler, _setGorevler] = useState<Gorev[]>([]);
  const orgIdRef = useRef(organizationId);
  const userIdRef = useRef(userId);
  const isSwitchingRef = useRef(isSwitching);
  const onSaveErrorRef = useRef(onSaveError);
  const logFnRef = useRef(logFn);

  useEffect(() => { orgIdRef.current = organizationId; }, [organizationId]);
  useEffect(() => { userIdRef.current = userId; }, [userId]);
  useEffect(() => { isSwitchingRef.current = isSwitching; }, [isSwitching]);
  useEffect(() => { onSaveErrorRef.current = onSaveError; }, [onSaveError]);
  useEffect(() => { logFnRef.current = logFn; }, [logFn]);

  const pendingSavesRef = useRef<Gorev[]>([]);

  const setGorevler = useCallback((u: Gorev[] | ((p: Gorev[]) => Gorev[])) => {
    _setGorevler(u);
  }, []);

  // ── Save to DB ──
  const saveGorevToDb = useCallback(async (item: Gorev): Promise<void> => {
    if (isSwitchingRef.current) {
      onSaveErrorRef.current?.(`Firma değişimi devam ediyor. Lütfen bekleyin. (gorevler)`);
      return;
    }
    const orgId = orgIdRef.current;
    const uid = userIdRef.current;
    if (!orgId || !uid) {
      pendingSavesRef.current.push(item);
      return;
    }
    try {
      await dbUpsertGorev(item as Gorev & Record<string, unknown>, uid, orgId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onSaveErrorRef.current?.(`Kayıt hatası (gorevler): ${msg}`);
    }
  }, []);

  // ── Flush pending saves ──
  const flushPending = useCallback(() => {
    const orgId = orgIdRef.current;
    const uid = userIdRef.current;
    if (!orgId || !uid || pendingSavesRef.current.length === 0) return;
    const pending = [...pendingSavesRef.current];
    pendingSavesRef.current = [];
    pending.forEach(item => {
      dbUpsertGorev(item as Gorev & Record<string, unknown>, uid, orgId).catch(err => {
        pendingSavesRef.current.push(item);
        onSaveErrorRef.current?.(`Bekleyen kayıt hatası (gorevler): ${err instanceof Error ? err.message : String(err)}`);
      });
    });
  }, []);

  useEffect(() => {
    if (!organizationId || !userId || orgLoading) return;
    flushPending();
  }, [organizationId, userId, orgLoading, flushPending]);

  useEffect(() => {
    const handleOnline = () => flushPending();
    window.addEventListener('online', handleOnline);
    if (navigator.onLine) flushPending();
    return () => window.removeEventListener('online', handleOnline);
  }, [flushPending]);

  // ── Fetch ──
  const fetchGorevler = useCallback(async (orgId: string): Promise<void> => {
    const cacheKey = `gorevler_${orgId}`;
    const cached = await readCache<Gorev[]>(cacheKey);
    if (cached) {
      setGorevler(cached.data);
      if ((Date.now() - cached.ts) < CACHE_TTL_MS) return;
    }

    const { data, error } = await supabase
      .from('gorevler')
      .select('id, data, created_at')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) { console.error('[GorevStore] fetchGorevler error:', error); return; }
    const rows = (data ?? []).map(r => r.data as Gorev);
    setGorevler(rows);
    void writeCache(cacheKey, rows);
  }, [setGorevler]);

  // ── Load on mount / org change ──
  useEffect(() => {
    if (orgLoading || !organizationId || !userId) {
      setGorevler([]);
      return;
    }
    void fetchGorevler(organizationId);
  }, [organizationId, userId, orgLoading, fetchGorevler, setGorevler]);

  // ── Realtime ──
  useEffect(() => {
    if (!organizationId || !userId || orgLoading) return;
    const activeOrgId = organizationId;
    const deviceId = getDeviceId();
    const channelName = `gorev_rt_${activeOrgId}_${userId}_${Date.now()}`;

    const channel = supabase.channel(channelName).on(
      'postgres_changes' as Parameters<ReturnType<typeof supabase.channel>['on']>[0],
      { event: '*', schema: 'public', table: 'gorevler', filter: `organization_id=eq.${activeOrgId}` } as Parameters<ReturnType<typeof supabase.channel>['on']>[1],
      (payload: { eventType: string; new: Record<string, unknown>; old?: Record<string, unknown> }) => {
        const remoteDeviceId = payload.new?.device_id as string | undefined;
        if (remoteDeviceId && remoteDeviceId === deviceId) return;

        const recordId = (payload.new?.id ?? payload.old?.id) as string | undefined;
        if (!recordId) return;

        if (payload.eventType === 'DELETE') {
          _setGorevler(prev => {
            const next = prev.filter(g => g.id !== recordId);
            void writeCache(`gorevler_${activeOrgId}`, next);
            return next;
          });
          return;
        }

        const newData = payload.new?.data as Gorev | undefined;
        if (newData) {
          const record = { ...newData, id: recordId } as Gorev;
          _setGorevler(prev => {
            const idx = prev.findIndex(g => g.id === recordId);
            const next = idx === -1
              ? [record, ...prev]
              : prev.map((g, i) => i === idx ? record : g);
            void writeCache(`gorevler_${activeOrgId}`, next);
            return next;
          });
        } else {
          void fetchGorevler(activeOrgId);
        }
      },
    ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [organizationId, userId, orgLoading, fetchGorevler]);

  // ── CRUD ──
  const addGorev = useCallback((g: Omit<Gorev, 'id' | 'olusturmaTarihi'>): Gorev => {
    const newG: Gorev = { ...g, id: genId(), olusturmaTarihi: new Date().toISOString() };
    setGorevler(prev => [newG, ...prev]);
    void saveGorevToDb(newG);
    logFnRef.current?.('gorev_created', 'Görevler', newG.id, newG.baslik, `${newG.baslik} görevi oluşturuldu.`);
    return newG;
  }, [setGorevler, saveGorevToDb]);

  const updateGorev = useCallback((id: string, updates: Partial<Gorev>): void => {
    let updated: Gorev | null = null;
    setGorevler(prev => prev.map(g => {
      if (g.id !== id) return g;
      updated = { ...g, ...updates };
      return updated;
    }));
    if (updated) void saveGorevToDb(updated);
  }, [setGorevler, saveGorevToDb]);

  const deleteGorev = useCallback((id: string): void => {
    _setGorevler(prev => prev.filter(g => g.id !== id));
    dbDeleteGorev(id).catch(err => {
      console.error('[GorevStore] deleteGorev error:', err);
    });
  }, []);

  // ── Cascade delete (called from firma delete) ──
  const cascadeDeleteFirmaGorevler = useCallback((firmaId: string, now: string): Gorev[] => {
    const cascadeFields = { silinmis: true as const, silinmeTarihi: now, cascadeSilindi: true as const, cascadeFirmaId: firmaId };
    const updatedItems: Gorev[] = [];
    setGorevler(prev => prev.map(g => {
      if (g.firmaId !== firmaId || g.silinmis) return g;
      const u = { ...g, ...cascadeFields };
      updatedItems.push(u);
      return u;
    }));
    return updatedItems;
  }, [setGorevler]);

  const cascadeRestoreFirmaGorevler = useCallback((firmaId: string): Gorev[] => {
    const rf = { silinmis: false as const, silinmeTarihi: undefined, cascadeSilindi: false as const, cascadeFirmaId: undefined };
    const updatedItems: Gorev[] = [];
    setGorevler(prev => prev.map(g => {
      if (g.cascadeFirmaId !== firmaId || !g.cascadeSilindi) return g;
      const u = { ...g, ...rf };
      updatedItems.push(u);
      return u;
    }));
    return updatedItems;
  }, [setGorevler]);

  return {
    gorevler,
    fetchGorevler,
    addGorev,
    updateGorev,
    deleteGorev,
    cascadeDeleteFirmaGorevler,
    cascadeRestoreFirmaGorevler,
  };
}
