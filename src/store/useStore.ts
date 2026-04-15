import { useState, useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type {
  Firma, Personel, Evrak, Egitim, Muayene, Uygunsuzluk, Ekipman,
  Gorev, Tutanak, CurrentUser, IsIzni,
} from '../types';
import { getEvrakKategori } from '../utils/evrakKategori';
import { supabase } from '../lib/supabase';
import { uploadFileToStorage } from '../utils/fileUpload';
import {
  genId, getDeviceId, dbUpsert, dbDelete, dbDeleteMany,
  dbUpdateDirect, fetchAllRows, generateRecordNoFromDB,
} from './storeHelpers';
import {
  useMainStore, resetMainStore,
} from './useMainStore';
import { normalizePersonel } from './slices/personelSlice';
import { normalizeEvrak } from './slices/evrakSlice';
import { normalizeUygunsuzluk } from './slices/uygunsuzlukSlice';

// Suppress unused import warning — getEvrakKategori used by consumers via StoreType
void getEvrakKategori;

// ──────── Fallback numbering ────────
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

// ──────── Main hook ────────
export function useStore(
  organizationId: string | null,
  logFn?: LogFn,
  onSaveError?: (msg: string) => void,
  userId?: string,
  orgLoading?: boolean,
  onRemoteChange?: (module: string) => void,
  isSwitching?: boolean,
  externalOrgIdRef?: MutableRefObject<string | null>,
) {
  // ── Zustand state — tek shallow selector, tüm state tek abonelik ──────────
  // 30+ ayrı useMainStore(s => s.xxx) yerine tek subscription — render sayısı düşer
  const {
    firmalar, personeller, evraklar, egitimler, muayeneler,
    uygunsuzluklar, ekipmanlar, tutanaklar, isIzinleri,
    _setFirmalar, _setPersoneller, _setEvraklar, _setEgitimler,
    _setMuayeneler, _setUygunsuzluklar, _setEkipmanlar, _setTutanaklar, _setIsIzinleri,
    addFirma: zAddFirma, updateFirma: zUpdateFirma,
    addPersonel: zAddPersonel, updatePersonel: zUpdatePersonel,
    deletePersonel: zDeletePersonel, restorePersonel: zRestorePersonel,
    addEvrak: zAddEvrak, updateEvrak: zUpdateEvrak,
    deleteEvrak: zDeleteEvrak, restoreEvrak: zRestoreEvrak,
    addEgitim: zAddEgitim, updateEgitim: zUpdateEgitim,
    deleteEgitim: zDeleteEgitim, restoreEgitim: zRestoreEgitim,
    addMuayene: zAddMuayene, updateMuayene: zUpdateMuayene,
    deleteMuayene: zDeleteMuayene, restoreMuayene: zRestoreMuayene,
    addUygunsuzlukToState: zAddUyg, updateUygunsuzluk: zUpdateUyg,
    deleteUygunsuzluk: zDeleteUyg, restoreUygunsuzluk: zRestoreUyg,
    addEkipman: zAddEkipman, updateEkipmanState: zUpdateEkipmanState,
    addEkipmanKontrolKaydiState: zAddKontrolState,
    addEkipmanBelgeState: zAddBelgeState,
    deleteEkipman: zDeleteEkipman, restoreEkipman: zRestoreEkipman,
    addTutanakToState: zAddTutanak, updateTutanak: zUpdateTutanak,
    deleteTutanak: zDeleteTutanak, restoreTutanak: zRestoreTutanak,
    addIsIzniToState: zAddIsIzni, updateIsIzniState: zUpdateIsIzniState,
    deleteIsIzni: zDeleteIsIzni, restoreIsIzni: zRestoreIsIzni,
  } = useMainStore(
    useShallow(s => ({
      firmalar:          s.firmalar,
      personeller:       s.personeller,
      evraklar:          s.evraklar,
      egitimler:         s.egitimler,
      muayeneler:        s.muayeneler,
      uygunsuzluklar:    s.uygunsuzluklar,
      ekipmanlar:        s.ekipmanlar,
      tutanaklar:        s.tutanaklar,
      isIzinleri:        s.isIzinleri,
      _setFirmalar:      s._setFirmalar,
      _setPersoneller:   s._setPersoneller,
      _setEvraklar:      s._setEvraklar,
      _setEgitimler:     s._setEgitimler,
      _setMuayeneler:    s._setMuayeneler,
      _setUygunsuzluklar:s._setUygunsuzluklar,
      _setEkipmanlar:    s._setEkipmanlar,
      _setTutanaklar:    s._setTutanaklar,
      _setIsIzinleri:    s._setIsIzinleri,
      addFirma:                     s.addFirma,
      updateFirma:                  s.updateFirma,
      addPersonel:                  s.addPersonel,
      updatePersonel:               s.updatePersonel,
      deletePersonel:               s.deletePersonel,
      restorePersonel:              s.restorePersonel,
      addEvrak:                     s.addEvrak,
      updateEvrak:                  s.updateEvrak,
      deleteEvrak:                  s.deleteEvrak,
      restoreEvrak:                 s.restoreEvrak,
      addEgitim:                    s.addEgitim,
      updateEgitim:                 s.updateEgitim,
      deleteEgitim:                 s.deleteEgitim,
      restoreEgitim:                s.restoreEgitim,
      addMuayene:                   s.addMuayene,
      updateMuayene:                s.updateMuayene,
      deleteMuayene:                s.deleteMuayene,
      restoreMuayene:               s.restoreMuayene,
      addUygunsuzlukToState:        s.addUygunsuzlukToState,
      updateUygunsuzluk:            s.updateUygunsuzluk,
      deleteUygunsuzluk:            s.deleteUygunsuzluk,
      restoreUygunsuzluk:           s.restoreUygunsuzluk,
      addEkipman:                   s.addEkipman,
      updateEkipmanState:           s.updateEkipmanState,
      addEkipmanKontrolKaydiState:  s.addEkipmanKontrolKaydiState,
      addEkipmanBelgeState:         s.addEkipmanBelgeState,
      deleteEkipman:                s.deleteEkipman,
      restoreEkipman:               s.restoreEkipman,
      addTutanakToState:            s.addTutanakToState,
      updateTutanak:                s.updateTutanak,
      deleteTutanak:                s.deleteTutanak,
      restoreTutanak:               s.restoreTutanak,
      addIsIzniToState:             s.addIsIzniToState,
      updateIsIzniState:            s.updateIsIzniState,
      deleteIsIzni:                 s.deleteIsIzni,
      restoreIsIzni:                s.restoreIsIzni,
    })),
  );

  // ms referansı: sadece getState() çağrıları için (render döngüsü dışı okuma)
  const ms = useMainStore;

  // ── Uygunsuzluk ref (gerçek zamanlı okuma için) ──
  const uygRef = useRef<Uygunsuzluk[]>([]);
  useEffect(() => { uygRef.current = uygunsuzluklar; }, [uygunsuzluklar]);
  const tutRef = useRef<Tutanak[]>([]);
  useEffect(() => { tutRef.current = tutanaklar; }, [tutanaklar]);
  const isIzRef = useRef<IsIzni[]>([]);
  useEffect(() => { isIzRef.current = isIzinleri; }, [isIzinleri]);

  // ── UI state (Zustand'a taşınmadı, yerel kalıyor) ──
  const [currentUser, setCurrentUser] = useState<CurrentUser>(defaultUser);
  const [dataLoading, setDataLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(true);
  const [partialLoading, setPartialLoading] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');

  // ── Refs ──
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
  const isSwitchingRef = useRef(isSwitching ?? false);
  useEffect(() => { isSwitchingRef.current = isSwitching ?? false; }, [isSwitching]);
  const ownDeletesRef = useRef<Set<string>>(new Set());
  const pendingSavesRef = useRef<{ table: string; item: { id: string } & Record<string, unknown> }[]>([]);

  // ── Active org ID ──
  const getActiveOrgId = useCallback((): string | null => {
    if (externalOrgIdRef?.current) return externalOrgIdRef.current;
    return orgIdRef.current;
  }, [externalOrgIdRef]);

  // ── Pending saves flush ──
  const flushPendingSaves = useCallback(() => {
    const orgId = orgIdRef.current;
    const uid = userIdRef.current;
    if (!orgId || !uid || pendingSavesRef.current.length === 0) return;
    const pending = [...pendingSavesRef.current];
    pendingSavesRef.current = [];
    pending.forEach(({ table, item }) => {
      dbUpsert(table, item as { id: string; silinmis?: boolean; silinmeTarihi?: string } & Record<string, unknown>, uid, orgId)
        .catch(err => {
          pendingSavesRef.current.push({ table, item });
          onSaveErrorRef.current?.(`Bekleyen kayıt hatası (${table}): ${err instanceof Error ? err.message : String(err)}`);
        });
    });
  }, []);

  useEffect(() => {
    if (!organizationId || !userId || orgLoading) return;
    flushPendingSaves();
  }, [organizationId, userId, orgLoading, flushPendingSaves]);

  useEffect(() => {
    window.addEventListener('online', flushPendingSaves);
    if (navigator.onLine) flushPendingSaves();
    return () => window.removeEventListener('online', flushPendingSaves);
  }, [flushPendingSaves]);

  // ── DB write helpers ──
  const saveToDb = useCallback(async (
    table: string,
    item: { id: string } & Record<string, unknown>,
    throwOnError = false,
  ): Promise<void> => {
    if (isSwitchingRef.current) {
      const msg = `Firma değişimi devam ediyor. (${table})`;
      onSaveErrorRef.current?.(msg);
      if (throwOnError) throw new Error(msg);
      return;
    }
    const orgId = getActiveOrgId();
    const uid = userIdRef.current;
    if (!orgId || !uid) {
      pendingSavesRef.current.push({ table, item });
      if (throwOnError) throw new Error('Organizasyon bilgisi henüz hazır değil.');
      return;
    }
    try {
      await dbUpsert(table, item as { id: string; silinmis?: boolean; silinmeTarihi?: string } & Record<string, unknown>, uid, orgId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onSaveErrorRef.current?.(`Kayıt hatası (${table}): ${msg}`);
      if (throwOnError) throw err;
    }
  }, [getActiveOrgId]);

  const deleteFromDb = useCallback(async (table: string, id: string) => {
    if (isSwitchingRef.current) { onSaveErrorRef.current?.(`Firma değişimi devam ediyor. (${table})`); return; }
    try { await dbDelete(table, id); } catch (err) { console.error(`[ISG] DELETE FAILED ${table}/${id}:`, err); }
  }, []);

  const updateDirectInDb = useCallback(async (
    table: string, id: string, payload: Record<string, unknown>, throwOnError = false,
  ): Promise<{ rows: number; error: string | null }> => {
    if (isSwitchingRef.current) {
      const msg = `Firma değişimi devam ediyor. (${table})`;
      onSaveErrorRef.current?.(msg);
      if (throwOnError) throw new Error(msg);
      return { rows: 0, error: msg };
    }
    const orgId = getActiveOrgId();
    if (!orgId) {
      const msg = `Organizasyon bilgisi hazır değil. (${table})`;
      onSaveErrorRef.current?.(msg);
      if (throwOnError) throw new Error(msg);
      return { rows: 0, error: msg };
    }
    const result = await dbUpdateDirect(table, id, orgId, payload);
    if (result.error) {
      onSaveErrorRef.current?.(`Güncelleme hatası (${table}): ${result.error}`);
      if (throwOnError) throw new Error(result.error);
    }
    return result;
  }, [getActiveOrgId]);

  const deleteManyFromDb = useCallback(async (table: string, ids: string[]) => {
    if (ids.length === 0) return;
    if (isSwitchingRef.current) { onSaveErrorRef.current?.(`Firma değişimi devam ediyor. (${table})`); return; }
    try { await dbDeleteMany(table, ids); } catch (err) { console.error(`[ISG] DELETE_MANY FAILED ${table}:`, err); }
  }, []);

  // ── Per-table fetchers ──
  const fetchTable = useCallback(async <T>(
    table: string, orgId: string, setter: (rows: T[]) => void, transform?: (row: T) => T,
  ): Promise<void> => {
    const res = await fetchAllRows(table, orgId);
    if (!res.data) return;
    let rows = res.data.map(r => r.data as T);
    if (transform) rows = rows.map(transform);
    setter(rows);
  }, []);

  const fetchFirmalar     = useCallback((orgId: string) => fetchTable<Firma>('firmalar', orgId, _setFirmalar), [fetchTable, _setFirmalar]);
  const fetchPersoneller  = useCallback((orgId: string) => fetchTable<Personel>('personeller', orgId, _setPersoneller, normalizePersonel), [fetchTable, _setPersoneller]);
  const fetchEvraklar     = useCallback((orgId: string) => fetchTable<Evrak>('evraklar', orgId, _setEvraklar, normalizeEvrak), [fetchTable, _setEvraklar]);
  const fetchEgitimler    = useCallback((orgId: string) => fetchTable<Egitim>('egitimler', orgId, _setEgitimler), [fetchTable, _setEgitimler]);
  const fetchMuayeneler   = useCallback((orgId: string) => fetchTable<Muayene>('muayeneler', orgId, _setMuayeneler), [fetchTable, _setMuayeneler]);
  const fetchUygunsuzluklar = useCallback((orgId: string) => fetchTable<Uygunsuzluk>('uygunsuzluklar', orgId, _setUygunsuzluklar, normalizeUygunsuzluk), [fetchTable, _setUygunsuzluklar]);
  const fetchEkipmanlar   = useCallback((orgId: string) => fetchTable<Ekipman>('ekipmanlar', orgId, _setEkipmanlar), [fetchTable, _setEkipmanlar]);
  const fetchTutanaklar   = useCallback((orgId: string) => fetchTable<Tutanak>('tutanaklar', orgId, _setTutanaklar), [fetchTable, _setTutanaklar]);
  const fetchIsIzinleri   = useCallback((orgId: string) => fetchTable<IsIzni>('is_izinleri', orgId, _setIsIzinleri), [fetchTable, _setIsIzinleri]);
  const fetchGorevler     = useCallback(async (_orgId: string) => { /* managed by useGorevStore */ }, []);

  // ── Fetched tables tracking ──
  const fetchedTablesRef = useRef<Set<string>>(new Set());
  useEffect(() => { fetchedTablesRef.current = new Set(); }, [organizationId]);

  const MODULE_TABLES: Record<string, string[]> = {
    firmalar:          ['firmalar'],
    personeller:       ['personeller'],
    evraklar:          ['evraklar', 'personeller', 'firmalar'],
    'firma-evraklari': ['firmalar'],
    egitimler:         ['egitimler', 'personeller', 'firmalar'],
    muayeneler:        ['muayeneler', 'personeller', 'firmalar'],
    uygunsuzluklar:    ['uygunsuzluklar', 'personeller', 'firmalar'],
    ekipmanlar:        ['ekipmanlar', 'firmalar'],
    tutanaklar:        ['tutanaklar', 'personeller', 'firmalar'],
    'is-izinleri':     ['is_izinleri', 'personeller', 'firmalar'],
    raporlar:          ['evraklar', 'egitimler', 'muayeneler', 'uygunsuzluklar', 'ekipmanlar', 'tutanaklar', 'is_izinleri', 'personeller', 'firmalar'],
    dokumanlar:        ['personeller', 'firmalar'],
    copkutusu:         ['firmalar', 'personeller', 'evraklar', 'egitimler', 'muayeneler', 'uygunsuzluklar', 'ekipmanlar', 'tutanaklar', 'is_izinleri'],
    ayarlar:           [],
    dashboard:         ['firmalar', 'personeller'],
    saha:              ['personeller', 'firmalar', 'uygunsuzluklar', 'ekipmanlar', 'is_izinleri'],
  };

  const fetcherMapRef = useRef<Record<string, (orgId: string) => Promise<void>>>({});

  const fetchModuleTables = useCallback(async (module: string) => {
    const orgId = orgIdRef.current;
    if (!orgId) return;
    const tables = MODULE_TABLES[module] ?? [];
    const toFetch = tables.filter(t => !fetchedTablesRef.current.has(t));
    if (toFetch.length === 0) return;
    toFetch.forEach(t => fetchedTablesRef.current.add(t));
    const fetchers = fetcherMapRef.current;
    await Promise.allSettled(toFetch.filter(t => fetchers[t]).map(t => fetchers[t](orgId)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshAllData = useCallback(async (activeModule?: string) => {
    const orgId = orgIdRef.current;
    if (!orgId) return;
    setDataLoading(true);
    setPartialLoading(true);
    try {
      const moduleTables = activeModule ? (MODULE_TABLES[activeModule] ?? []) : [];
      moduleTables.forEach(t => fetchedTablesRef.current.add(t));
      const tablesToRefresh = Array.from(fetchedTablesRef.current);
      const fetchers = fetcherMapRef.current;
      await Promise.allSettled(tablesToRefresh.filter(t => fetchers[t]).map(t => fetchers[t](orgId)));
    } finally {
      setDataLoading(false);
      setPartialLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetcherMapRef.current = {
      firmalar: fetchFirmalar, personeller: fetchPersoneller, evraklar: fetchEvraklar,
      egitimler: fetchEgitimler, muayeneler: fetchMuayeneler, uygunsuzluklar: fetchUygunsuzluklar,
      ekipmanlar: fetchEkipmanlar, tutanaklar: fetchTutanaklar, is_izinleri: fetchIsIzinleri,
    };
  }, [fetchFirmalar, fetchPersoneller, fetchEvraklar, fetchEgitimler, fetchMuayeneler, fetchUygunsuzluklar, fetchEkipmanlar, fetchTutanaklar, fetchIsIzinleri]);

  // ── Load on mount / org change ──
  const loadAllData = useCallback(async (orgId: string) => {
    fetchedTablesRef.current.add('firmalar');
    fetchedTablesRef.current.add('personeller');
    await Promise.allSettled([fetchFirmalar(orgId), fetchPersoneller(orgId)]);
  }, [fetchFirmalar, fetchPersoneller]);

  useEffect(() => {
    if (orgLoading) return;
    if (!organizationId || !userId) {
      resetMainStore();
      setDataLoading(false);
      setPageLoading(false);
      return;
    }
    setDataLoading(true);
    setPageLoading(true);
    loadAllData(organizationId).then(() => {
      setDataLoading(false);
      setPageLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, userId, orgLoading]);

  // ── Realtime subscription ──
  useEffect(() => {
    if (!organizationId || !userId || orgLoading) return;
    const activeOrgId = organizationId;

    const applySoftDeletePatch = (table: string, recordId: string) => {
      const now = new Date().toISOString();
      switch (table) {
        case 'firmalar':       _setFirmalar(prev => prev.map(r => r.id === recordId ? { ...r, silinmis: true as const, silinmeTarihi: r.silinmeTarihi ?? now } : r)); break;
        case 'personeller':    _setPersoneller(prev => prev.map(r => r.id === recordId ? { ...r, silinmis: true as const, silinmeTarihi: r.silinmeTarihi ?? now } : r)); break;
        case 'evraklar':       _setEvraklar(prev => prev.map(r => r.id === recordId ? { ...r, silinmis: true as const, silinmeTarihi: r.silinmeTarihi ?? now } : r)); break;
        case 'egitimler':      _setEgitimler(prev => prev.map(r => r.id === recordId ? { ...r, silinmis: true as const, silinmeTarihi: r.silinmeTarihi ?? now } : r)); break;
        case 'muayeneler':     _setMuayeneler(prev => prev.map(r => r.id === recordId ? { ...r, silinmis: true as const, silinmeTarihi: r.silinmeTarihi ?? now } : r)); break;
        case 'uygunsuzluklar': _setUygunsuzluklar(prev => prev.map(r => r.id === recordId ? { ...r, silinmis: true as const, silinmeTarihi: r.silinmeTarihi ?? now } : r)); break;
        case 'ekipmanlar':     _setEkipmanlar(prev => prev.map(r => r.id === recordId ? { ...r, silinmis: true as const, silinmeTarihi: r.silinmeTarihi ?? now } : r)); break;
        case 'tutanaklar':     _setTutanaklar(prev => prev.map(r => r.id === recordId ? { ...r, silinmis: true as const, silinmeTarihi: r.silinmeTarihi ?? now } : r)); break;
        case 'is_izinleri':    _setIsIzinleri(prev => prev.map(r => r.id === recordId ? { ...r, silinmis: true as const, silinmeTarihi: r.silinmeTarihi ?? now } : r)); break;
        // osgb_ziyaretler ve gorevler: sadece onRemoteChange bildirimi — useGorevStore ve ZiyaretlerTab kendi state'ini yönetir
        default: break;
      }
    };

    const applyHardDeletePatch = (table: string, recordId: string) => {
      switch (table) {
        case 'firmalar':       _setFirmalar(prev => prev.filter(r => r.id !== recordId)); break;
        case 'personeller':    _setPersoneller(prev => prev.filter(r => r.id !== recordId)); break;
        case 'evraklar':       _setEvraklar(prev => prev.filter(r => r.id !== recordId)); break;
        case 'egitimler':      _setEgitimler(prev => prev.filter(r => r.id !== recordId)); break;
        case 'muayeneler':     _setMuayeneler(prev => prev.filter(r => r.id !== recordId)); break;
        case 'uygunsuzluklar': _setUygunsuzluklar(prev => prev.filter(r => r.id !== recordId)); break;
        case 'ekipmanlar':     _setEkipmanlar(prev => prev.filter(r => r.id !== recordId)); break;
        case 'tutanaklar':     _setTutanaklar(prev => prev.filter(r => r.id !== recordId)); break;
        case 'is_izinleri':    _setIsIzinleri(prev => prev.filter(r => r.id !== recordId)); break;
      }
    };

    const applyUpsertPatch = (table: string, recordId: string, data: unknown) => {
      const upsert = <T extends { id: string }>(
        setter: (fn: (prev: T[]) => T[]) => void,
        transform?: (r: T) => T,
      ) => {
        const raw = data as T;
        const record = transform ? transform(raw) : raw;
        setter(prev => {
          const idx = prev.findIndex(r => r.id === recordId);
          return idx === -1 ? [record, ...prev] : prev.map((r, i) => i === idx ? record : r);
        });
      };
      switch (table) {
        case 'firmalar':       upsert<Firma>(_setFirmalar); break;
        case 'personeller':    upsert<Personel>(_setPersoneller, normalizePersonel); break;
        case 'evraklar':       upsert<Evrak>(_setEvraklar, normalizeEvrak); break;
        case 'egitimler':      upsert<Egitim>(_setEgitimler); break;
        case 'muayeneler':     upsert<Muayene>(_setMuayeneler); break;
        case 'uygunsuzluklar': upsert<Uygunsuzluk>(_setUygunsuzluklar, normalizeUygunsuzluk); break;
        case 'ekipmanlar':     upsert<Ekipman>(_setEkipmanlar); break;
        case 'tutanaklar':     upsert<Tutanak>(_setTutanaklar); break;
        case 'is_izinleri':    upsert<IsIzni>(_setIsIzinleri); break;
      }
    };

    const reloadTable = async (table: string) => {
      const { data, error } = await fetchAllRows(table, activeOrgId);
      if (error || !data) return;
      const rows = data.map(r => r.data as unknown);
      switch (table) {
        case 'firmalar':       _setFirmalar(rows as Firma[]); break;
        case 'personeller':    _setPersoneller((rows as Personel[]).map(normalizePersonel)); break;
        case 'evraklar':       _setEvraklar((rows as Evrak[]).map(normalizeEvrak)); break;
        case 'egitimler':      _setEgitimler(rows as Egitim[]); break;
        case 'muayeneler':     _setMuayeneler(rows as Muayene[]); break;
        case 'uygunsuzluklar': _setUygunsuzluklar((rows as Uygunsuzluk[]).map(normalizeUygunsuzluk)); break;
        case 'ekipmanlar':     _setEkipmanlar(rows as Ekipman[]); break;
        case 'tutanaklar':     _setTutanaklar(rows as Tutanak[]); break;
        case 'is_izinleri':    _setIsIzinleri(rows as IsIzni[]); break;
      }
    };

    const TABLES = ['firmalar', 'personeller', 'evraklar', 'egitimler', 'muayeneler', 'uygunsuzluklar', 'ekipmanlar', 'tutanaklar', 'is_izinleri', 'osgb_ziyaretler', 'gorevler'];
    const deviceId = getDeviceId();
    const MODULE_NAMES: Record<string, string> = {
      firmalar: 'Firmalar', personeller: 'Personeller', evraklar: 'Evraklar',
      egitimler: 'Eğitimler', muayeneler: 'Muayeneler', uygunsuzluklar: 'Saha Denetim',
      ekipmanlar: 'Ekipmanlar', tutanaklar: 'Tutanaklar', is_izinleri: 'İş İzinleri',
      osgb_ziyaretler: 'Ziyaretler', gorevler: 'Görevler',
    };

    const channelName = `isg_rt_${activeOrgId}_${userId}`;
    let channel = supabase.channel(channelName, { config: { presence: { key: '' } } });

    TABLES.forEach(table => {
      channel = channel.on(
        'postgres_changes' as Parameters<typeof channel.on>[0],
        { event: '*', schema: 'public', table, filter: `organization_id=eq.${activeOrgId}` } as Parameters<typeof channel.on>[1],
        (payload: { eventType: string; new: Record<string, unknown>; old?: Record<string, unknown> }) => {
          const remoteDeviceId = payload.new?.device_id as string | undefined;
          if (remoteDeviceId && remoteDeviceId === deviceId) return;

          const recordId = (payload.new?.id ?? payload.old?.id) as string | undefined;
          if (!recordId) { void reloadTable(table); return; }

          if (payload.eventType === 'DELETE') {
            const isOwnDelete = ownDeletesRef.current.has(recordId);
            if (isOwnDelete) { ownDeletesRef.current.delete(recordId); return; }
            applyHardDeletePatch(table, recordId);
            onRemoteChangeRef.current?.(MODULE_NAMES[table] ?? table);
            return;
          }

          const newData = payload.new?.data;
          const deletedAt = payload.new?.deleted_at;

          if (deletedAt && recordId) {
            if (newData) applyUpsertPatch(table, recordId, newData);
            else applySoftDeletePatch(table, recordId);
            onRemoteChangeRef.current?.(MODULE_NAMES[table] ?? table);
            return;
          }

          if (newData && recordId) {
            applyUpsertPatch(table, recordId, newData);
            onRemoteChangeRef.current?.(MODULE_NAMES[table] ?? table);
          } else {
            void reloadTable(table);
            onRemoteChangeRef.current?.(MODULE_NAMES[table] ?? table);
          }
        },
      ) as typeof channel;
    });

    channel.subscribe((status, err) => {
      if (err) console.error('[ISG] Realtime subscribe error:', err);
      if (status === 'SUBSCRIBED') setRealtimeStatus('connected');
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setRealtimeStatus('disconnected');
      else setRealtimeStatus('connecting');
    });

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, userId, orgLoading]);

  // ──────── FIRMA ────────
  const addFirma = useCallback((firma: Omit<Firma, 'id' | 'olusturmaTarihi' | 'guncellemeTarihi'>) => {
    const newFirma = zAddFirma(firma);
    void saveToDb('firmalar', newFirma as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('firma_created', 'Firmalar', newFirma.id, newFirma.ad, `${newFirma.ad} firması oluşturuldu.`);
    return newFirma;
  }, [zAddFirma, saveToDb]);

  const updateFirma = useCallback((id: string, updates: Partial<Firma>) => {
    zUpdateFirma(id, updates);
    const updated = ms.getState().firmalar.find(f => f.id === id);
    if (updated) void saveToDb('firmalar', updated as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('firma_updated', 'Firmalar', id, updates.ad, 'Firma bilgileri güncellendi.');
  }, [zUpdateFirma, saveToDb, ms]);

  const deleteFirma = useCallback((id: string) => {
    const now = new Date().toISOString();
    const cascadeFields = { silinmis: true as const, silinmeTarihi: now, cascadeSilindi: true as const, cascadeFirmaId: id };
    const updatedItems: { table: string; item: { id: string } & Record<string, unknown> }[] = [];

    _setFirmalar(prev => prev.map(f => { if (f.id !== id) return f; const u = { ...f, silinmis: true as const, silinmeTarihi: now }; updatedItems.push({ table: 'firmalar', item: u as unknown as { id: string } & Record<string, unknown> }); return u; }));
    _setPersoneller(prev => prev.map(p => { if (p.firmaId !== id || p.silinmis) return p; const u = { ...p, ...cascadeFields }; updatedItems.push({ table: 'personeller', item: u as unknown as { id: string } & Record<string, unknown> }); return u; }));
    _setEvraklar(prev => prev.map(e => { if (e.silinmis || e.firmaId !== id || e.personelId) return e; const u = { ...e, ...cascadeFields }; updatedItems.push({ table: 'evraklar', item: u as unknown as { id: string } & Record<string, unknown> }); return u; }));
    _setEgitimler(prev => prev.map(e => { if (e.firmaId !== id || e.silinmis) return e; const u = { ...e, ...cascadeFields }; updatedItems.push({ table: 'egitimler', item: u as unknown as { id: string } & Record<string, unknown> }); return u; }));
    _setMuayeneler(prev => prev.map(m => { if (m.firmaId !== id || m.silinmis) return m; const u = { ...m, ...cascadeFields }; updatedItems.push({ table: 'muayeneler', item: u as unknown as { id: string } & Record<string, unknown> }); return u; }));
    _setUygunsuzluklar(prev => prev.map(u => { if (u.firmaId !== id || u.silinmis) return u; const updated = { ...u, ...cascadeFields }; updatedItems.push({ table: 'uygunsuzluklar', item: updated as unknown as { id: string } & Record<string, unknown> }); return updated; }));
    _setEkipmanlar(prev => prev.map(e => { if (e.firmaId !== id || e.silinmis) return e; const u = { ...e, ...cascadeFields }; updatedItems.push({ table: 'ekipmanlar', item: u as unknown as { id: string } & Record<string, unknown> }); return u; }));

    void Promise.allSettled(updatedItems.map(({ table, item }) => saveToDb(table, item))).then(results => {
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) onSaveErrorRef.current?.(`Firma silme sırasında ${failed.length} kayıt yazılamadı.`);
    });
    logFnRef.current?.('firma_deleted', 'Firmalar', id, undefined, 'Firma silindi.');
  }, [_setFirmalar, _setPersoneller, _setEvraklar, _setEgitimler, _setMuayeneler, _setUygunsuzluklar, _setEkipmanlar, saveToDb]);

  const restoreFirma = useCallback((id: string) => {
    const rf = { silinmis: false as const, silinmeTarihi: undefined, cascadeSilindi: false as const, cascadeFirmaId: undefined };
    const updatedItems: { table: string; item: { id: string } & Record<string, unknown> }[] = [];

    const collect = <T extends { id: string }>(setter: (fn: (prev: T[]) => T[]) => void, table: string, pred: (item: T) => boolean) =>
      setter(prev => prev.map(item => {
        if (!pred(item)) return item;
        const u = { ...item, ...rf };
        updatedItems.push({ table, item: u as unknown as { id: string } & Record<string, unknown> });
        return u;
      }));

    _setFirmalar(prev => prev.map(f => { if (f.id !== id) return f; const u = { ...f, silinmis: false as const, silinmeTarihi: undefined }; updatedItems.push({ table: 'firmalar', item: u as unknown as { id: string } & Record<string, unknown> }); return u; }));
    collect<Personel>(_setPersoneller, 'personeller', p => p.cascadeFirmaId === id && !!p.cascadeSilindi);
    collect<Evrak>(_setEvraklar, 'evraklar', e => e.cascadeFirmaId === id && !!e.cascadeSilindi);
    collect<Egitim>(_setEgitimler, 'egitimler', e => e.cascadeFirmaId === id && !!e.cascadeSilindi);
    collect<Muayene>(_setMuayeneler, 'muayeneler', m => m.cascadeFirmaId === id && !!m.cascadeSilindi);
    collect<Uygunsuzluk>(_setUygunsuzluklar, 'uygunsuzluklar', u => u.cascadeFirmaId === id && !!u.cascadeSilindi);
    collect<Ekipman>(_setEkipmanlar, 'ekipmanlar', e => e.cascadeFirmaId === id && !!e.cascadeSilindi);

    void Promise.allSettled(updatedItems.map(({ table, item }) => saveToDb(table, item, true))).then(results => {
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) onSaveErrorRef.current?.(`Firma geri yükleme sırasında ${failed.length} kayıt yazılamadı.`);
    });
  }, [_setFirmalar, _setPersoneller, _setEvraklar, _setEgitimler, _setMuayeneler, _setUygunsuzluklar, _setEkipmanlar, saveToDb]);

  const permanentDeleteFirma = useCallback(async (id: string) => {
    ownDeletesRef.current.add(id);
    const snap = {
      firmalar: ms.getState().firmalar, personeller: ms.getState().personeller,
      evraklar: ms.getState().evraklar, egitimler: ms.getState().egitimler,
      muayeneler: ms.getState().muayeneler, uygunsuzluklar: ms.getState().uygunsuzluklar,
      ekipmanlar: ms.getState().ekipmanlar,
    };
    const personelIds = snap.personeller.filter(p => p.firmaId === id).map(p => p.id);
    const evrakIds    = snap.evraklar.filter(e => e.firmaId === id).map(e => e.id);
    const egitimIds   = snap.egitimler.filter(e => e.firmaId === id).map(e => e.id);
    const muayeneIds  = snap.muayeneler.filter(m => m.firmaId === id).map(m => m.id);
    const uygIds      = snap.uygunsuzluklar.filter(u => u.firmaId === id).map(u => u.id);
    const ekipmanIds  = snap.ekipmanlar.filter(e => e.firmaId === id).map(e => e.id);

    _setFirmalar(prev => prev.filter(f => f.id !== id));
    _setPersoneller(prev => prev.filter(p => p.firmaId !== id));
    _setEvraklar(prev => prev.filter(e => e.firmaId !== id));
    _setEgitimler(prev => prev.filter(e => e.firmaId !== id));
    _setMuayeneler(prev => prev.filter(m => m.firmaId !== id));
    _setUygunsuzluklar(prev => prev.filter(u => u.firmaId !== id));
    _setEkipmanlar(prev => prev.filter(e => e.firmaId !== id));

    try {
      await Promise.all([
        dbDelete('firmalar', id),
        dbDeleteMany('personeller', personelIds),
        dbDeleteMany('evraklar', evrakIds),
        dbDeleteMany('egitimler', egitimIds),
        dbDeleteMany('muayeneler', muayeneIds),
        dbDeleteMany('uygunsuzluklar', uygIds),
        dbDeleteMany('ekipmanlar', ekipmanIds),
      ]);
    } catch (err) {
      _setFirmalar(snap.firmalar); _setPersoneller(snap.personeller); _setEvraklar(snap.evraklar);
      _setEgitimler(snap.egitimler); _setMuayeneler(snap.muayeneler); _setUygunsuzluklar(snap.uygunsuzluklar);
      _setEkipmanlar(snap.ekipmanlar);
      onSaveErrorRef.current?.(`Kalıcı silme hatası (firma): ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [ms, _setFirmalar, _setPersoneller, _setEvraklar, _setEgitimler, _setMuayeneler, _setUygunsuzluklar, _setEkipmanlar]);

  // ──────── PERSONEL ────────
  const addPersonel = useCallback((personel: Omit<Personel, 'id' | 'olusturmaTarihi' | 'guncellemeTarihi'>) => {
    const newPersonel = zAddPersonel(personel);
    void saveToDb('personeller', newPersonel as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('personel_created', 'Personeller', newPersonel.id, newPersonel.adSoyad, `${newPersonel.adSoyad} personel olarak eklendi.`);
    return newPersonel;
  }, [zAddPersonel, saveToDb]);

  const updatePersonel = useCallback((id: string, updates: Partial<Personel>) => {
    zUpdatePersonel(id, updates);
    const updated = ms.getState().personeller.find(p => p.id === id);
    if (updated) void saveToDb('personeller', updated as unknown as { id: string } & Record<string, unknown>);
  }, [zUpdatePersonel, saveToDb, ms]);

  const deletePersonel = useCallback((id: string) => {
    const updated = zDeletePersonel(id);
    if (updated) void saveToDb('personeller', updated as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('personel_deleted', 'Personeller', id, undefined, 'Personel silindi.');
  }, [zDeletePersonel, saveToDb]);

  const restorePersonel = useCallback((id: string) => {
    const updated = zRestorePersonel(id);
    if (updated) void saveToDb('personeller', updated as unknown as { id: string } & Record<string, unknown>, true).catch(err => onSaveErrorRef.current?.(`Personel geri yükleme hatası: ${err instanceof Error ? err.message : String(err)}`));
  }, [zRestorePersonel, saveToDb]);

  const permanentDeletePersonel = useCallback(async (id: string) => {
    const snapshot = ms.getState().personeller;
    ownDeletesRef.current.add(id);
    _setPersoneller(prev => prev.filter(p => p.id !== id));
    try { await dbDelete('personeller', id); } catch (err) { ownDeletesRef.current.delete(id); _setPersoneller(snapshot); onSaveErrorRef.current?.(`Kalıcı silme hatası: ${err instanceof Error ? err.message : String(err)}`); throw err; }
  }, [ms, _setPersoneller]);

  // ──────── EVRAK ────────
  const addEvrak = useCallback((evrak: Omit<Evrak, 'id' | 'olusturmaTarihi'>) => {
    const newEvrak = zAddEvrak(evrak);
    void saveToDb('evraklar', newEvrak as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('evrak_created', 'Evraklar', newEvrak.id, newEvrak.ad, `${newEvrak.ad} evrakı eklendi.`);
    return newEvrak;
  }, [zAddEvrak, saveToDb]);

  const updateEvrak = useCallback((id: string, updates: Partial<Evrak>) => {
    zUpdateEvrak(id, updates);
    const updated = ms.getState().evraklar.find(e => e.id === id);
    if (updated) void saveToDb('evraklar', updated as unknown as { id: string } & Record<string, unknown>);
  }, [zUpdateEvrak, saveToDb, ms]);

  const deleteEvrak = useCallback((id: string) => {
    const updated = zDeleteEvrak(id);
    if (updated) void saveToDb('evraklar', updated as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('evrak_deleted', 'Evraklar', id, undefined, 'Evrak silindi.');
  }, [zDeleteEvrak, saveToDb]);

  const restoreEvrak = useCallback((id: string) => {
    const updated = zRestoreEvrak(id);
    if (updated) void saveToDb('evraklar', updated as unknown as { id: string } & Record<string, unknown>, true).catch(err => onSaveErrorRef.current?.(`Evrak geri yükleme hatası: ${err instanceof Error ? err.message : String(err)}`));
  }, [zRestoreEvrak, saveToDb]);

  const permanentDeleteEvrak = useCallback(async (id: string) => {
    const snapshot = ms.getState().evraklar;
    ownDeletesRef.current.add(id);
    _setEvraklar(prev => prev.filter(e => e.id !== id));
    try { await dbDelete('evraklar', id); } catch (err) { ownDeletesRef.current.delete(id); _setEvraklar(snapshot); onSaveErrorRef.current?.(`Kalıcı silme hatası: ${err instanceof Error ? err.message : String(err)}`); throw err; }
  }, [ms, _setEvraklar]);

  // ──────── EĞİTİM ────────
  const addEgitim = useCallback((egitim: Omit<Egitim, 'id' | 'olusturmaTarihi'>) => {
    const newEgitim = zAddEgitim(egitim);
    void saveToDb('egitimler', newEgitim as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('egitim_created', 'Eğitimler', newEgitim.id, newEgitim.ad, `${newEgitim.ad} eğitimi oluşturuldu.`);
    return newEgitim;
  }, [zAddEgitim, saveToDb]);

  const updateEgitim = useCallback((id: string, updates: Partial<Egitim>) => {
    zUpdateEgitim(id, updates);
    const updated = ms.getState().egitimler.find(e => e.id === id);
    if (updated) void saveToDb('egitimler', updated as unknown as { id: string } & Record<string, unknown>);
  }, [zUpdateEgitim, saveToDb, ms]);

  const deleteEgitim = useCallback((id: string) => {
    const updated = zDeleteEgitim(id);
    if (updated) void saveToDb('egitimler', updated as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('egitim_deleted', 'Eğitimler', id, undefined, 'Eğitim silindi.');
  }, [zDeleteEgitim, saveToDb]);

  const restoreEgitim = useCallback((id: string) => {
    const updated = zRestoreEgitim(id);
    if (updated) void saveToDb('egitimler', updated as unknown as { id: string } & Record<string, unknown>, true).catch(err => onSaveErrorRef.current?.(`Eğitim geri yükleme hatası: ${err instanceof Error ? err.message : String(err)}`));
  }, [zRestoreEgitim, saveToDb]);

  const permanentDeleteEgitim = useCallback(async (id: string) => {
    const snapshot = ms.getState().egitimler;
    ownDeletesRef.current.add(id);
    _setEgitimler(prev => prev.filter(e => e.id !== id));
    try { await dbDelete('egitimler', id); } catch (err) { ownDeletesRef.current.delete(id); _setEgitimler(snapshot); onSaveErrorRef.current?.(`Kalıcı silme hatası: ${err instanceof Error ? err.message : String(err)}`); throw err; }
  }, [ms, _setEgitimler]);

  // ──────── MUAYENE ────────
  const addMuayene = useCallback((muayene: Omit<Muayene, 'id' | 'olusturmaTarihi'>) => {
    const newMuayene = zAddMuayene(muayene);
    void saveToDb('muayeneler', newMuayene as unknown as { id: string } & Record<string, unknown>);
    return newMuayene;
  }, [zAddMuayene, saveToDb]);

  const updateMuayene = useCallback((id: string, updates: Partial<Muayene>) => {
    zUpdateMuayene(id, updates);
    const updated = ms.getState().muayeneler.find(m => m.id === id);
    if (updated) void saveToDb('muayeneler', updated as unknown as { id: string } & Record<string, unknown>);
  }, [zUpdateMuayene, saveToDb, ms]);

  const deleteMuayene = useCallback((id: string) => {
    const updated = zDeleteMuayene(id);
    if (updated) void saveToDb('muayeneler', updated as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('muayene_deleted', 'Sağlık', id, undefined, 'Sağlık evrakı silindi.');
  }, [zDeleteMuayene, saveToDb]);

  const restoreMuayene = useCallback((id: string) => {
    const updated = zRestoreMuayene(id);
    if (updated) void saveToDb('muayeneler', updated as unknown as { id: string } & Record<string, unknown>, true).catch(err => onSaveErrorRef.current?.(`Sağlık kaydı geri yükleme hatası: ${err instanceof Error ? err.message : String(err)}`));
  }, [zRestoreMuayene, saveToDb]);

  const permanentDeleteMuayene = useCallback(async (id: string) => {
    const snapshot = ms.getState().muayeneler;
    ownDeletesRef.current.add(id);
    _setMuayeneler(prev => prev.filter(m => m.id !== id));
    try { await dbDelete('muayeneler', id); } catch (err) { ownDeletesRef.current.delete(id); _setMuayeneler(snapshot); onSaveErrorRef.current?.(`Kalıcı silme hatası: ${err instanceof Error ? err.message : String(err)}`); throw err; }
  }, [ms, _setMuayeneler]);

  // ──────── UYGUNSUZLUK ────────
  const addUygunsuzluk = useCallback(async (u: Omit<Uygunsuzluk, 'id' | 'olusturmaTarihi'>) => {
    const id = genId();
    const now = new Date().toISOString();
    const rpcNo = await generateRecordNoFromDB('dof');
    const acilisNo = rpcNo ?? generateDofNo(uygRef.current);
    const durum = u.kapatmaFotoMevcut ? 'Kapandı' as const : 'Açık' as const;
    const newU: Uygunsuzluk = { ...u, id, durum, olusturmaTarihi: now, acilisNo };
    zAddUyg(newU);
    await saveToDb('uygunsuzluklar', newU as unknown as { id: string } & Record<string, unknown>, true);
    logFnRef.current?.('uygunsuzluk_created', 'Uygunsuzluklar', id, u.baslik, `${u.baslik} uygunsuzluk kaydı oluşturuldu.`);
    return newU;
  }, [zAddUyg, saveToDb]);

  const updateUygunsuzluk = useCallback((id: string, updates: Partial<Uygunsuzluk>) => {
    zUpdateUyg(id, updates);
    const updated = ms.getState().uygunsuzluklar.find(u => u.id === id);
    if (updated) void saveToDb('uygunsuzluklar', updated as unknown as { id: string } & Record<string, unknown>);
    if (updates.kapatmaFotoMevcut) logFnRef.current?.('uygunsuzluk_closed', 'Uygunsuzluklar', id, updates.baslik, 'Uygunsuzluk kapatıldı.');
  }, [zUpdateUyg, saveToDb, ms]);

  const deleteUygunsuzluk = useCallback((id: string) => {
    const updated = zDeleteUyg(id);
    if (updated) void saveToDb('uygunsuzluklar', updated as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('uygunsuzluk_deleted', 'Uygunsuzluklar', id, undefined, 'Uygunsuzluk silindi.');
  }, [zDeleteUyg, saveToDb]);

  const restoreUygunsuzluk = useCallback((id: string) => {
    const updated = zRestoreUyg(id);
    if (updated) void saveToDb('uygunsuzluklar', updated as unknown as { id: string } & Record<string, unknown>, true).catch(err => onSaveErrorRef.current?.(`Saha denetim geri yükleme hatası: ${err instanceof Error ? err.message : String(err)}`));
  }, [zRestoreUyg, saveToDb]);

  const permanentDeleteUygunsuzluk = useCallback(async (id: string) => {
    const snapshot = ms.getState().uygunsuzluklar;
    ownDeletesRef.current.add(id);
    _setUygunsuzluklar(prev => prev.filter(u => u.id !== id));
    try { await dbDelete('uygunsuzluklar', id); } catch (err) { ownDeletesRef.current.delete(id); _setUygunsuzluklar(snapshot); onSaveErrorRef.current?.(`Kalıcı silme hatası: ${err instanceof Error ? err.message : String(err)}`); throw err; }
  }, [ms, _setUygunsuzluklar]);

  const getUygunsuzlukPhoto = useCallback((id: string, type: 'acilis' | 'kapatma'): string | undefined => {
    const record = uygRef.current.find(u => u.id === id);
    if (record) { const url = type === 'acilis' ? record.acilisFotoUrl : record.kapatmaFotoUrl; if (url) return url; }
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
      const file = new File([new Blob([ab], { type: mime })], `${type}-${id}.${ext}`, { type: mime });
      const url = await uploadFileToStorage(file, orgId, `uygunsuzluk-${type}`, id);
      return url;
    } catch (err) { console.error('[ISG] setUygunsuzlukPhoto error:', err); return null; }
  }, []);

  // ──────── EKİPMAN ────────
  const DENETCI_ALLOWED_EKIPMAN_FIELDS = new Set(['sonKontrolTarihi', 'sonrakiKontrolTarihi', 'durum', 'kontrolGecmisi', 'notlar']);

  const addEkipman = useCallback((e: Omit<Ekipman, 'id' | 'olusturmaTarihi'>) => {
    const newE = zAddEkipman(e);
    void saveToDb('ekipmanlar', newE as unknown as { id: string } & Record<string, unknown>);
    return newE;
  }, [zAddEkipman, saveToDb]);

  const addEkipmanKontrolKaydi = useCallback((ekipmanId: string, kayit: Omit<import('@/types').EkipmanKontrolKaydi, 'id'>) => {
    const updated = zAddKontrolState(ekipmanId, kayit);
    if (updated) void saveToDb('ekipmanlar', updated as unknown as { id: string } & Record<string, unknown>);
  }, [zAddKontrolState, saveToDb]);

  const addEkipmanBelge = useCallback((ekipmanId: string, belge: Omit<import('@/types').EkipmanBelge, 'id' | 'arsiv'>) => {
    const updated = zAddBelgeState(ekipmanId, belge);
    if (updated) void saveToDb('ekipmanlar', updated as unknown as { id: string } & Record<string, unknown>);
  }, [zAddBelgeState, saveToDb]);

  const updateEkipman = useCallback((id: string, updates: Partial<Ekipman>, callerRole?: string) => {
    const { dosyaVeri: _ignored, ...rest } = updates as Partial<Ekipman> & { dosyaVeri?: string };
    let safeRest = rest;
    if (callerRole === 'denetci') {
      safeRest = Object.fromEntries(Object.entries(rest).filter(([key]) => DENETCI_ALLOWED_EKIPMAN_FIELDS.has(key))) as Partial<Ekipman>;
    }
    if (safeRest.kontrolGecmisi === undefined) delete safeRest.kontrolGecmisi;
    if (safeRest.belgeler === undefined) delete safeRest.belgeler;
    const snapshot = ms.getState().ekipmanlar.find(e => e.id === id);
    const updated = zUpdateEkipmanState(id, safeRest);
    if (updated) {
      updateDirectInDb('ekipmanlar', id, { data: updated }).then(({ error }) => {
        if (error && snapshot) _setEkipmanlar(prev => prev.map(e => e.id === id ? snapshot : e));
      });
    }
  }, [zUpdateEkipmanState, updateDirectInDb, _setEkipmanlar, ms]); // eslint-disable-line react-hooks/exhaustive-deps

  const deleteEkipman = useCallback((id: string) => {
    const updated = zDeleteEkipman(id);
    if (updated) void saveToDb('ekipmanlar', updated as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('ekipman_deleted', 'Ekipmanlar', id, undefined, 'Ekipman silindi.');
  }, [zDeleteEkipman, saveToDb]);

  const restoreEkipman = useCallback((id: string) => {
    const updated = zRestoreEkipman(id);
    if (updated) void saveToDb('ekipmanlar', updated as unknown as { id: string } & Record<string, unknown>, true).catch(err => onSaveErrorRef.current?.(`Ekipman geri yükleme hatası: ${err instanceof Error ? err.message : String(err)}`));
  }, [zRestoreEkipman, saveToDb]);

  const permanentDeleteEkipman = useCallback(async (id: string) => {
    const snapshot = ms.getState().ekipmanlar;
    ownDeletesRef.current.add(id);
    _setEkipmanlar(prev => prev.filter(e => e.id !== id));
    try { await dbDelete('ekipmanlar', id); } catch (err) { ownDeletesRef.current.delete(id); _setEkipmanlar(snapshot); onSaveErrorRef.current?.(`Kalıcı silme hatası: ${err instanceof Error ? err.message : String(err)}`); throw err; }
  }, [ms, _setEkipmanlar]);

  const permanentDeleteEkipmanMany = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const snapshot = ms.getState().ekipmanlar;
    ids.forEach(id => ownDeletesRef.current.add(id));
    _setEkipmanlar(prev => prev.filter(e => !ids.includes(e.id)));
    try { await dbDeleteMany('ekipmanlar', ids); } catch (err) { ids.forEach(id => ownDeletesRef.current.delete(id)); _setEkipmanlar(snapshot); onSaveErrorRef.current?.(`Kalıcı silme hatası: ${err instanceof Error ? err.message : String(err)}`); throw err; }
  }, [ms, _setEkipmanlar]);

  // ──────── GÖREV — stub ────────
  const addGorev = useCallback((g: Omit<Gorev, 'id' | 'olusturmaTarihi'>): Gorev => {
    const newG: Gorev = { ...g, id: genId(), olusturmaTarihi: new Date().toISOString() };
    console.warn('[ISG] useStore.addGorev stub — use useGorevStore');
    return newG;
  }, []);
  const updateGorev = useCallback((_id: string, _updates: Partial<Gorev>) => {}, []);
  const deleteGorev = useCallback((_id: string) => {}, []);
  const restoreGorev = useCallback((_id: string) => {}, []);
  const permanentDeleteGorev = useCallback(async (_id: string) => {}, []);

  // ──────── TUTANAK ────────
  const addTutanak = useCallback(async (t: Omit<Tutanak, 'id' | 'olusturmaTarihi' | 'guncellemeTarihi'>) => {
    const now = new Date().toISOString();
    const id = genId();
    const { dosyaVeri: _ignored, ...rest } = t as Tutanak & { dosyaVeri?: string };
    const rpcNo = await generateRecordNoFromDB('tutanak');
    let tutanakNo: string;
    if (rpcNo) {
      tutanakNo = rpcNo;
    } else {
      const orgId = orgIdRef.current;
      if (orgId) {
        const { data } = await supabase.from('tutanaklar').select('data').eq('organization_id', orgId);
        tutanakNo = generateTutanakNo((data ?? []).map(r => r.data as { tutanakNo: string }));
      } else {
        tutanakNo = generateTutanakNo(tutRef.current);
      }
    }
    const newT: Tutanak = { ...rest, id, tutanakNo, olusturmaTarihi: now, guncellemeTarihi: now };
    zAddTutanak(newT);
    void saveToDb('tutanaklar', newT as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('tutanak_created', 'Tutanaklar', id, newT.baslik, `${newT.tutanakNo} - ${newT.baslik} tutanağı oluşturuldu.`);
    return newT;
  }, [zAddTutanak, saveToDb]);

  const updateTutanak = useCallback((id: string, updates: Partial<Tutanak>) => {
    zUpdateTutanak(id, updates);
    const updated = ms.getState().tutanaklar.find(t => t.id === id);
    if (updated) void saveToDb('tutanaklar', updated as unknown as { id: string } & Record<string, unknown>);
  }, [zUpdateTutanak, saveToDb, ms]);

  const deleteTutanak = useCallback((id: string) => {
    const updated = zDeleteTutanak(id);
    if (updated) void saveToDb('tutanaklar', updated as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('tutanak_deleted', 'Tutanaklar', id, undefined, 'Tutanak silindi.');
  }, [zDeleteTutanak, saveToDb]);

  const restoreTutanak = useCallback((id: string) => {
    const updated = zRestoreTutanak(id);
    if (updated) void saveToDb('tutanaklar', updated as unknown as { id: string } & Record<string, unknown>, true).catch(err => onSaveErrorRef.current?.(`Tutanak geri yükleme hatası: ${err instanceof Error ? err.message : String(err)}`));
  }, [zRestoreTutanak, saveToDb]);

  const permanentDeleteTutanak = useCallback(async (id: string) => {
    const snapshot = ms.getState().tutanaklar;
    ownDeletesRef.current.add(id);
    _setTutanaklar(prev => prev.filter(t => t.id !== id));
    try { await dbDelete('tutanaklar', id); } catch (err) { ownDeletesRef.current.delete(id); _setTutanaklar(snapshot); onSaveErrorRef.current?.(`Kalıcı silme hatası: ${err instanceof Error ? err.message : String(err)}`); throw err; }
  }, [ms, _setTutanaklar]);

  // ──────── İŞ İZNİ ────────
  const addIsIzni = useCallback(async (iz: Omit<IsIzni, 'id' | 'izinNo' | 'olusturmaTarihi' | 'guncellemeTarihi'>) => {
    const now = new Date().toISOString();
    const id = genId();
    const rpcNo = await generateRecordNoFromDB('is_izni');
    const izinNo = rpcNo ?? generateIsIzniNo(isIzRef.current);
    const newIz: IsIzni = { ...iz, id, izinNo, olusturmaTarihi: now, guncellemeTarihi: now };
    zAddIsIzni(newIz);
    await saveToDb('is_izinleri', newIz as unknown as { id: string } & Record<string, unknown>, true);
    logFnRef.current?.('is_izni_created', 'İş İzinleri', id, izinNo, `${izinNo} iş izni oluşturuldu.`);
    return newIz;
  }, [zAddIsIzni, saveToDb]);

  const updateIsIzni = useCallback(async (id: string, updates: Partial<IsIzni>): Promise<void> => {
    const snapshot = ms.getState().isIzinleri.find(iz => iz.id === id);
    const updated = zUpdateIsIzniState(id, updates);
    if (updated) {
      const { rows, error: updateErr } = await updateDirectInDb('is_izinleri', id, { data: updated }, true);
      if (updateErr) {
        if (snapshot) _setIsIzinleri(prev => prev.map(iz => iz.id === id ? snapshot : iz));
        throw new Error(updateErr.includes('row-level security') ? `Yetki hatası: ${updateErr}` : updateErr);
      }
      if (rows === 0) {
        if (snapshot) _setIsIzinleri(prev => prev.map(iz => iz.id === id ? snapshot : iz));
        throw new Error('İş izni güncellenemedi. Kayıt bulunamadı.');
      }
    }
    logFnRef.current?.('is_izni_updated', 'İş İzinleri', id, updates.izinNo, 'İş izni güncellendi.');
  }, [zUpdateIsIzniState, updateDirectInDb, _setIsIzinleri, ms]);

  const deleteIsIzni = useCallback((id: string) => {
    const current = isIzRef.current.find(iz => iz.id === id);
    if (!current) return;
    const updated = zDeleteIsIzni(id);
    if (updated) {
      void saveToDb('is_izinleri', updated as unknown as { id: string } & Record<string, unknown>).catch(() => {
        if (current) _setIsIzinleri(prev => prev.map(iz => iz.id === id ? current : iz));
      });
    }
    logFnRef.current?.('is_izni_deleted', 'İş İzinleri', id, undefined, 'İş izni silindi.');
  }, [zDeleteIsIzni, saveToDb, _setIsIzinleri]);

  const restoreIsIzni = useCallback((id: string) => {
    const current = isIzRef.current.find(iz => iz.id === id);
    if (!current) return;
    const updated = zRestoreIsIzni(id);
    if (updated) {
      void saveToDb('is_izinleri', updated as unknown as { id: string } & Record<string, unknown>, true).catch(err => {
        if (current) _setIsIzinleri(prev => prev.map(iz => iz.id === id ? current : iz));
        onSaveErrorRef.current?.(`İş izni geri yükleme hatası: ${err instanceof Error ? err.message : String(err)}`);
      });
    }
  }, [zRestoreIsIzni, saveToDb, _setIsIzinleri]);

  const permanentDeleteIsIzni = useCallback(async (id: string) => {
    const snapshot = ms.getState().isIzinleri;
    ownDeletesRef.current.add(id);
    _setIsIzinleri(prev => prev.filter(iz => iz.id !== id));
    try {
      await dbDelete('is_izinleri', id);
      logFnRef.current?.('is_izni_perm_deleted', 'İş İzinleri', id, undefined, 'İş izni kalıcı silindi.');
    } catch (err) {
      ownDeletesRef.current.delete(id);
      _setIsIzinleri(snapshot);
      onSaveErrorRef.current?.(`Kalıcı silme hatası: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }, [ms, _setIsIzinleri]);

  // ──────── LOGO / FOTO ────────
  const setFirmaLogo = useCallback(async (firmaId: string, fileOrUrl: File | string): Promise<string | null> => {
    if (typeof fileOrUrl === 'string') { updateFirma(firmaId, { logoUrl: fileOrUrl } as Partial<Firma>); return fileOrUrl; }
    const orgId = orgIdRef.current ?? 'unknown';
    const filePath = await uploadFileToStorage(fileOrUrl, orgId, 'firma-logo', firmaId);
    if (filePath) updateFirma(firmaId, { logoUrl: filePath } as Partial<Firma>);
    return filePath;
  }, [updateFirma]);

  const setPersonelFoto = useCallback(async (personelId: string, file: File): Promise<string | null> => {
    const orgId = orgIdRef.current ?? 'unknown';
    const url = await uploadFileToStorage(file, orgId, 'personel-foto', personelId);
    if (url) updatePersonel(personelId, { fotoUrl: url } as Partial<Personel>);
    return url;
  }, [updatePersonel]);

  const getPersonelFoto = useCallback((_personelId: string): string | null => null, []);

  const updateCurrentUser = useCallback((updates: Partial<CurrentUser>) => {
    setCurrentUser(prev => ({ ...prev, ...updates }));
  }, []);

  const gorevler: Gorev[] = [];

  return {
    firmalar, personeller, evraklar, egitimler, muayeneler,
    uygunsuzluklar, ekipmanlar, gorevler, tutanaklar, isIzinleri, currentUser,
    dataLoading, pageLoading, partialLoading, realtimeStatus, isSaving: false,
    refreshAllData, fetchModuleTables,
    fetchFirmalar, fetchPersoneller, fetchEvraklar, fetchEgitimler,
    fetchMuayeneler, fetchUygunsuzluklar, fetchEkipmanlar,
    fetchGorevler, fetchTutanaklar, fetchIsIzinleri,
    addFirma, updateFirma, deleteFirma, restoreFirma, permanentDeleteFirma,
    addPersonel, updatePersonel, deletePersonel, restorePersonel, permanentDeletePersonel,
    addEvrak, updateEvrak, deleteEvrak, restoreEvrak, permanentDeleteEvrak,
    addEgitim, updateEgitim, deleteEgitim, restoreEgitim, permanentDeleteEgitim,
    addMuayene, updateMuayene, deleteMuayene, restoreMuayene, permanentDeleteMuayene,
    addUygunsuzluk, updateUygunsuzluk, deleteUygunsuzluk, restoreUygunsuzluk, permanentDeleteUygunsuzluk,
    getUygunsuzlukPhoto, setUygunsuzlukPhoto,
    addEkipman, updateEkipman, deleteEkipman, restoreEkipman, permanentDeleteEkipman, permanentDeleteEkipmanMany,
    addEkipmanKontrolKaydi, addEkipmanBelge,
    addGorev, updateGorev, deleteGorev, restoreGorev, permanentDeleteGorev,
    addTutanak, updateTutanak, deleteTutanak, restoreTutanak, permanentDeleteTutanak,
    addIsIzni, updateIsIzni, deleteIsIzni, restoreIsIzni, permanentDeleteIsIzni,
    setFirmaLogo, getPersonelFoto, setPersonelFoto,
    updateCurrentUser,
    deleteFromDb, deleteManyFromDb,
  };
}

export type StoreType = ReturnType<typeof useStore>;
