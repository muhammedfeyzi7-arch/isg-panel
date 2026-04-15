import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import type { Gorev } from '@/types';
import { supabase } from '@/lib/supabase';
import {
  genId, getDeviceId, dbUpsert, dbDelete, fetchAllRows,
} from './storeHelpers';

// ── Zustand store (global, tek instance) ──────────────────────────────────

interface GorevState {
  gorevler: Gorev[];
  _setGorevler: (u: Gorev[] | ((p: Gorev[]) => Gorev[])) => void;
  _upsertGorev: (record: Gorev) => void;
  _removeGorev: (id: string) => void;
  _softDeleteGorev: (id: string, now: string) => void;
}

export const useGorevZustand = create<GorevState>()((set) => ({
  gorevler: [],

  _setGorevler: (u) =>
    set((state) => ({ gorevler: typeof u === 'function' ? u(state.gorevler) : u })),

  _upsertGorev: (record) =>
    set((state) => {
      const idx = state.gorevler.findIndex((g) => g.id === record.id);
      return {
        gorevler: idx === -1
          ? [record, ...state.gorevler]
          : state.gorevler.map((g, i) => (i === idx ? record : g)),
      };
    }),

  _removeGorev: (id) =>
    set((state) => ({ gorevler: state.gorevler.filter((g) => g.id !== id) })),

  _softDeleteGorev: (id, now) =>
    set((state) => ({
      gorevler: state.gorevler.map((g) =>
        g.id === id ? { ...g, silinmis: true as const, silinmeTarihi: g.silinmeTarihi ?? now } : g,
      ),
    })),
}));

// ── Selector exports ───────────────────────────────────────────────────────
export const selectGorevler = (s: GorevState) => s.gorevler;

// ── Hook options ──────────────────────────────────────────────────────────

export interface GorevStoreOptions {
  organizationId: string | null;
  userId: string | undefined;
  orgLoading: boolean;
  isSwitching: boolean;
  onSaveError?: (msg: string) => void;
  logFn?: (actionType: string, module: string, recordId: string, recordName?: string, description?: string) => void;
}

// ── Hook (AppContext tarafından çağrılır — subscription + CRUD) ────────────

export function useGorevStore({
  organizationId,
  userId,
  orgLoading,
  isSwitching,
  onSaveError,
  logFn,
}: GorevStoreOptions) {
  // Zustand actions
  const _setGorevler    = useGorevZustand(s => s._setGorevler);
  const _upsertGorev    = useGorevZustand(s => s._upsertGorev);
  const _removeGorev    = useGorevZustand(s => s._softDeleteGorev);
  const _hardRemove     = useGorevZustand(s => s._removeGorev);
  const gorevler        = useGorevZustand(s => s.gorevler);

  // Refs
  const orgIdRef        = useRef(organizationId);
  const userIdRef       = useRef(userId);
  const isSwitchingRef  = useRef(isSwitching);
  const onSaveErrorRef  = useRef(onSaveError);
  const logFnRef        = useRef(logFn);

  useEffect(() => { orgIdRef.current = organizationId; },  [organizationId]);
  useEffect(() => { userIdRef.current = userId; },         [userId]);
  useEffect(() => { isSwitchingRef.current = isSwitching; }, [isSwitching]);
  useEffect(() => { onSaveErrorRef.current = onSaveError; }, [onSaveError]);
  useEffect(() => { logFnRef.current = logFn; },           [logFn]);

  const pendingSavesRef = useRef<Gorev[]>([]);

  // ── Save to DB ──
  const saveGorevToDb = async (item: Gorev): Promise<void> => {
    if (isSwitchingRef.current) {
      onSaveErrorRef.current?.('Firma değişimi devam ediyor. (gorevler)');
      return;
    }
    const orgId = orgIdRef.current;
    const uid = userIdRef.current;
    if (!orgId || !uid) { pendingSavesRef.current.push(item); return; }
    try {
      await dbUpsert(
        'gorevler',
        item as Gorev & { silinmis?: boolean; silinmeTarihi?: string } & Record<string, unknown>,
        uid, orgId,
      );
    } catch (err) {
      onSaveErrorRef.current?.(`Kayıt hatası (gorevler): ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // ── Flush pending ──
  const flushPending = () => {
    const orgId = orgIdRef.current;
    const uid = userIdRef.current;
    if (!orgId || !uid || pendingSavesRef.current.length === 0) return;
    const pending = [...pendingSavesRef.current];
    pendingSavesRef.current = [];
    pending.forEach(item => {
      dbUpsert(
        'gorevler',
        item as Gorev & { silinmis?: boolean; silinmeTarihi?: string } & Record<string, unknown>,
        uid, orgId,
      ).catch(err => {
        pendingSavesRef.current.push(item);
        onSaveErrorRef.current?.(`Bekleyen kayıt hatası (gorevler): ${err instanceof Error ? err.message : String(err)}`);
      });
    });
  };

  useEffect(() => {
    if (!organizationId || !userId || orgLoading) return;
    flushPending();
  }, [organizationId, userId, orgLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.addEventListener('online', flushPending);
    if (navigator.onLine) flushPending();
    return () => window.removeEventListener('online', flushPending);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch ──
  const fetchGorevler = async (orgId: string): Promise<void> => {
    const { data, error } = await fetchAllRows('gorevler', orgId);
    if (error || !data) { console.error('[GorevStore] fetchGorevler error:', error); return; }
    _setGorevler(data.map(r => r.data as Gorev));
  };

  // ── Load on mount / org change ──
  useEffect(() => {
    if (orgLoading || !organizationId || !userId) { _setGorevler([]); return; }
    void fetchGorevler(organizationId);
  }, [organizationId, userId, orgLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Realtime ──
  useEffect(() => {
    if (!organizationId || !userId || orgLoading) return;
    const activeOrgId = organizationId;
    const deviceId = getDeviceId();
    const channelName = `gorev_rt_${activeOrgId}_${userId}`;

    const channel = supabase.channel(channelName).on(
      'postgres_changes' as Parameters<ReturnType<typeof supabase.channel>['on']>[0],
      { event: '*', schema: 'public', table: 'gorevler', filter: `organization_id=eq.${activeOrgId}` } as Parameters<ReturnType<typeof supabase.channel>['on']>[1],
      (payload: { eventType: string; new: Record<string, unknown>; old?: Record<string, unknown> }) => {
        const remoteDeviceId = payload.new?.device_id as string | undefined;
        if (remoteDeviceId && remoteDeviceId === deviceId) return;

        const recordId = (payload.new?.id ?? payload.old?.id) as string | undefined;
        if (!recordId) return;

        if (payload.eventType === 'DELETE') { _hardRemove(recordId); return; }

        const newData = payload.new?.data as Gorev | undefined;
        const deletedAt = payload.new?.deleted_at;

        if (deletedAt && recordId) {
          if (newData) _upsertGorev({ ...newData, id: recordId } as Gorev);
          else _removeGorev(recordId, new Date().toISOString());
          return;
        }

        if (newData) _upsertGorev({ ...newData, id: recordId } as Gorev);
        else void fetchGorevler(activeOrgId);
      },
    ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [organizationId, userId, orgLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── CRUD ──
  const addGorev = (g: Omit<Gorev, 'id' | 'olusturmaTarihi'>): Gorev => {
    const newG: Gorev = { ...g, id: genId(), olusturmaTarihi: new Date().toISOString() };
    _upsertGorev(newG);
    void saveGorevToDb(newG);
    logFnRef.current?.('gorev_created', 'Görevler', newG.id, newG.baslik, `${newG.baslik} görevi oluşturuldu.`);
    return newG;
  };

  const updateGorev = (id: string, updates: Partial<Gorev>): void => {
    const current = useGorevZustand.getState().gorevler.find(g => g.id === id);
    if (!current) return;
    const updated = { ...current, ...updates };
    _upsertGorev(updated);
    void saveGorevToDb(updated);
  };

  const deleteGorev = (id: string): void => {
    const current = useGorevZustand.getState().gorevler.find(g => g.id === id);
    if (!current) return;
    const updated = { ...current, silinmis: true as const, silinmeTarihi: new Date().toISOString() };
    _upsertGorev(updated);
    void saveGorevToDb(updated);
    logFnRef.current?.('gorev_deleted', 'Görevler', id, undefined, 'Görev silindi.');
  };

  const restoreGorev = (id: string): void => {
    const current = useGorevZustand.getState().gorevler.find(g => g.id === id);
    if (!current) return;
    const updated = { ...current, silinmis: false as const, silinmeTarihi: undefined };
    _upsertGorev(updated);
    void saveGorevToDb(updated);
  };

  const permanentDeleteGorev = async (id: string): Promise<void> => {
    const snapshot = useGorevZustand.getState().gorevler;
    _hardRemove(id);
    try {
      await dbDelete('gorevler', id);
    } catch (err) {
      _setGorevler(snapshot);
      onSaveErrorRef.current?.(`Kalıcı silme hatası (gorevler): ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  };

  const cascadeDeleteFirmaGorevler = (firmaId: string, now: string): Gorev[] => {
    const cascadeFields = { silinmis: true as const, silinmeTarihi: now, cascadeSilindi: true as const, cascadeFirmaId: firmaId };
    const updatedItems: Gorev[] = [];
    _setGorevler(prev => prev.map(g => {
      if (g.firmaId !== firmaId || g.silinmis) return g;
      const u = { ...g, ...cascadeFields };
      updatedItems.push(u);
      return u;
    }));
    return updatedItems;
  };

  const cascadeRestoreFirmaGorevler = (firmaId: string): Gorev[] => {
    const rf = { silinmis: false as const, silinmeTarihi: undefined, cascadeSilindi: false as const, cascadeFirmaId: undefined };
    const updatedItems: Gorev[] = [];
    _setGorevler(prev => prev.map(g => {
      if (g.cascadeFirmaId !== firmaId || !g.cascadeSilindi) return g;
      const u = { ...g, ...rf };
      updatedItems.push(u);
      return u;
    }));
    return updatedItems;
  };

  return {
    gorevler,
    fetchGorevler,
    addGorev, updateGorev, deleteGorev, restoreGorev, permanentDeleteGorev,
    cascadeDeleteFirmaGorevler, cascadeRestoreFirmaGorevler,
  };
}
