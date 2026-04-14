import { useState, useCallback, useRef, useEffect } from 'react';
import type { Gorev } from '@/types';
import { supabase } from '@/lib/supabase';
import {
  genId, getDeviceId, dbUpsert, dbDelete, fetchAllRows,
} from './storeHelpers';

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
  // deleted_at is correctly set by dbUpsert from item.silinmis
  const saveGorevToDb = useCallback(async (item: Gorev): Promise<void> => {
    if (isSwitchingRef.current) {
      onSaveErrorRef.current?.('Firma değişimi devam ediyor. Lütfen bekleyin. (gorevler)');
      return;
    }
    const orgId = orgIdRef.current;
    const uid = userIdRef.current;
    if (!orgId || !uid) {
      pendingSavesRef.current.push(item);
      return;
    }
    try {
      await dbUpsert(
        'gorevler',
        item as Gorev & { silinmis?: boolean; silinmeTarihi?: string } & Record<string, unknown>,
        uid,
        orgId,
      );
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
      dbUpsert(
        'gorevler',
        item as Gorev & { silinmis?: boolean; silinmeTarihi?: string } & Record<string, unknown>,
        uid,
        orgId,
      ).catch(err => {
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
    window.addEventListener('online', flushPending);
    if (navigator.onLine) flushPending();
    return () => window.removeEventListener('online', flushPending);
  }, [flushPending]);

  // ── Fetch — always from DB (no cache), paginated ──
  const fetchGorevler = useCallback(async (orgId: string): Promise<void> => {
    const { data, error } = await fetchAllRows('gorevler', orgId);
    if (error || !data) { console.error('[GorevStore] fetchGorevler error:', error); return; }
    const rows = data.map(r => r.data as Gorev);
    setGorevler(rows);
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
  // Soft delete: when deleted_at arrives, mark silinmis:true (keep in Trash view)
  // Hard DELETE: remove from state
  useEffect(() => {
    if (!organizationId || !userId || orgLoading) return;
    const activeOrgId = organizationId;
    const deviceId = getDeviceId();
    // Sabit kanal adı — Date.now() KALDIRILDI (zombie kanal önlemi)
    const channelName = `gorev_rt_${activeOrgId}_${userId}`;

    const channel = supabase.channel(channelName).on(
      'postgres_changes' as Parameters<ReturnType<typeof supabase.channel>['on']>[0],
      { event: '*', schema: 'public', table: 'gorevler', filter: `organization_id=eq.${activeOrgId}` } as Parameters<ReturnType<typeof supabase.channel>['on']>[1],
      (payload: { eventType: string; new: Record<string, unknown>; old?: Record<string, unknown> }) => {
        const remoteDeviceId = payload.new?.device_id as string | undefined;
        if (remoteDeviceId && remoteDeviceId === deviceId) return;

        const recordId = (payload.new?.id ?? payload.old?.id) as string | undefined;
        if (!recordId) return;

        // Hard DELETE
        if (payload.eventType === 'DELETE') {
          _setGorevler(prev => prev.filter(g => g.id !== recordId));
          return;
        }

        const newData = payload.new?.data as Gorev | undefined;
        const deletedAt = payload.new?.deleted_at;

        // Soft delete from another device — mark silinmis:true instead of removing
        if (deletedAt && recordId) {
          const now = new Date().toISOString();
          if (newData) {
            const record = { ...newData, id: recordId } as Gorev;
            _setGorevler(prev => {
              const idx = prev.findIndex(g => g.id === recordId);
              return idx === -1 ? [record, ...prev] : prev.map((g, i) => i === idx ? record : g);
            });
          } else {
            _setGorevler(prev => prev.map(g => g.id === recordId ? { ...g, silinmis: true as const, silinmeTarihi: g.silinmeTarihi ?? now } : g));
          }
          return;
        }

        // INSERT / UPDATE
        if (newData) {
          const record = { ...newData, id: recordId } as Gorev;
          _setGorevler(prev => {
            const idx = prev.findIndex(g => g.id === recordId);
            return idx === -1 ? [record, ...prev] : prev.map((g, i) => i === idx ? record : g);
          });
        } else {
          void fetchGorevler(activeOrgId);
        }
      },
    ).subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setGorevler(prev => prev.map(g => { if (g.id !== id) return g; updated = { ...g, ...updates }; return updated; }));
    if (updated) void saveGorevToDb(updated);
  }, [setGorevler, saveGorevToDb]);

  const deleteGorev = useCallback((id: string): void => {
    let updated: Gorev | null = null;
    setGorevler(prev => prev.map(g => { if (g.id !== id) return g; updated = { ...g, silinmis: true as const, silinmeTarihi: new Date().toISOString() }; return updated; }));
    if (updated) void saveGorevToDb(updated);
    logFnRef.current?.('gorev_deleted', 'Görevler', id, undefined, 'Görev silindi.');
  }, [setGorevler, saveGorevToDb]);

  const restoreGorev = useCallback((id: string): void => {
    let updated: Gorev | null = null;
    setGorevler(prev => prev.map(g => { if (g.id !== id) return g; updated = { ...g, silinmis: false as const, silinmeTarihi: undefined }; return updated; }));
    if (updated) void saveGorevToDb(updated);
  }, [setGorevler, saveGorevToDb]);

  const gorevlerSnapshotRef = useRef<Gorev[]>([]);
  useEffect(() => { gorevlerSnapshotRef.current = gorevler; }, [gorevler]);

  const permanentDeleteGorev = useCallback(async (id: string): Promise<void> => {
    const snapshot = gorevlerSnapshotRef.current;
    _setGorevler(prev => prev.filter(g => g.id !== id));
    try {
      await dbDelete('gorevler', id);
    } catch (err) {
      _setGorevler(snapshot);
      onSaveErrorRef.current?.(`Kalıcı silme hatası (gorevler): ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }, []);

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
    addGorev, updateGorev, deleteGorev, restoreGorev, permanentDeleteGorev,
    cascadeDeleteFirmaGorevler, cascadeRestoreFirmaGorevler,
  };
}
