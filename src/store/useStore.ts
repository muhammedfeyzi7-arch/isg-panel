import { useState, useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import type {
  Firma, Personel, Evrak, Egitim, Muayene, Uygunsuzluk, Ekipman,
  Gorev, Tutanak, CurrentUser, UygunsuzlukStatus, IsIzni,
} from '../types';
import { getEvrakKategori } from '../utils/evrakKategori';
import { supabase } from '../lib/supabase';
import { uploadFileToStorage } from '../utils/fileUpload';
import {
  genId, getDeviceId, dbUpsert, dbDelete, dbDeleteMany,
  dbUpdateDirect, fetchAllRows, generateRecordNoFromDB,
} from './storeHelpers';

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

// ──────── KAN grubu normalize ────────
const KAN_MAP: Record<string, string> = {
  'A Rh+': 'A+', 'A Rh-': 'A-', 'B Rh+': 'B+', 'B Rh-': 'B-',
  'AB Rh+': 'AB+', 'AB Rh-': 'AB-', '0 Rh+': '0+', '0 Rh-': '0-',
};

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
  // ── State ──
  const [firmalar, _setFirmalar] = useState<Firma[]>([]);
  const [personeller, _setPersoneller] = useState<Personel[]>([]);
  const [evraklar, _setEvraklar] = useState<Evrak[]>([]);
  const [egitimler, _setEgitimler] = useState<Egitim[]>([]);
  const [muayeneler, _setMuayeneler] = useState<Muayene[]>([]);
  const [uygunsuzluklar, _setUygunsuzluklar] = useState<Uygunsuzluk[]>([]);
  const [ekipmanlar, _setEkipmanlar] = useState<Ekipman[]>([]);
  // NOTE: gorevler state intentionally removed — managed exclusively by useGorevStore
  const [tutanaklar, _setTutanaklar] = useState<Tutanak[]>([]);
  const [isIzinleri, _setIsIzinleri] = useState<IsIzni[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser>(defaultUser);
  const [dataLoading, setDataLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(true);
  const [partialLoading, setPartialLoading] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');

  // ── Refs ──
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
  const isSwitchingRef = useRef(isSwitching ?? false);
  useEffect(() => { isSwitchingRef.current = isSwitching ?? false; }, [isSwitching]);
  const ownDeletesRef = useRef<Set<string>>(new Set());
  const pendingSavesRef = useRef<{ table: string; item: { id: string } & Record<string, unknown> }[]>([]);

  // ── Active org ID — prefer external ref (useOrganization ref-first pattern) ──
  const getActiveOrgId = useCallback((): string | null => {
    if (externalOrgIdRef?.current) return externalOrgIdRef.current;
    return orgIdRef.current;
  }, [externalOrgIdRef]);

  // ── Stable setters with ref sync ──
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

  // ── Pending saves flush ──
  const flushPendingSaves = useCallback(() => {
    const orgId = orgIdRef.current;
    const uid = userIdRef.current;
    if (!orgId || !uid || pendingSavesRef.current.length === 0) return;
    const pending = [...pendingSavesRef.current];
    pendingSavesRef.current = [];
    if (import.meta.env.DEV) console.log(`[ISG] Flushing ${pending.length} pending saves for org=${orgId}`);
    pending.forEach(({ table, item }) => {
      dbUpsert(table, item as { id: string; silinmis?: boolean; silinmeTarihi?: string } & Record<string, unknown>, uid, orgId)
        .then(() => { if (import.meta.env.DEV) console.log(`[ISG] Pending save OK ${table}/${item.id} ✓`); })
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
      const msg = `Firma değişimi devam ediyor. Lütfen değişim tamamlandıktan sonra tekrar deneyin. (${table})`;
      console.warn(`[ISG] SAVE BLOCKED (isSwitching): ${table}/${item.id}`);
      onSaveErrorRef.current?.(msg);
      if (throwOnError) throw new Error(msg);
      return;
    }
    const orgId = getActiveOrgId();
    const uid = userIdRef.current;
    if (!orgId || !uid) {
      console.warn(`[ISG] SAVE QUEUED ${table}/${item.id}: orgId=${orgId} userId=${uid} not ready`);
      pendingSavesRef.current.push({ table, item });
      if (throwOnError) throw new Error('Organizasyon bilgisi henüz hazır değil. Lütfen tekrar deneyin.');
      return;
    }
    try {
      await dbUpsert(
        table,
        item as { id: string; silinmis?: boolean; silinmeTarihi?: string } & Record<string, unknown>,
        uid,
        orgId,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onSaveErrorRef.current?.(`Kayıt hatası (${table}): ${msg}`);
      if (throwOnError) throw err;
    }
  }, [getActiveOrgId]);

  const deleteFromDb = useCallback(async (table: string, id: string) => {
    if (isSwitchingRef.current) {
      onSaveErrorRef.current?.(`Firma değişimi devam ediyor. Silme işlemi iptal edildi. (${table})`);
      return;
    }
    try { await dbDelete(table, id); } catch (err) { console.error(`[ISG] DELETE FAILED ${table}/${id}:`, err); }
  }, []);

  const updateDirectInDb = useCallback(async (
    table: string,
    id: string,
    payload: Record<string, unknown>,
    throwOnError = false,
  ): Promise<{ rows: number; error: string | null }> => {
    if (isSwitchingRef.current) {
      const msg = `Firma değişimi devam ediyor. Güncelleme işlemi iptal edildi. (${table})`;
      onSaveErrorRef.current?.(msg);
      if (throwOnError) throw new Error(msg);
      return { rows: 0, error: msg };
    }
    const orgId = getActiveOrgId();
    if (!orgId) {
      const msg = `Organizasyon bilgisi hazır değil. Güncelleme iptal edildi. (${table})`;
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
    if (isSwitchingRef.current) {
      onSaveErrorRef.current?.(`Firma değişimi devam ediyor. Toplu silme işlemi iptal edildi. (${table})`);
      return;
    }
    try { await dbDeleteMany(table, ids); } catch (err) { console.error(`[ISG] DELETE_MANY FAILED ${table}:`, err); }
  }, []);

  // ── Per-table fetchers (always DB, no cache) ──
  const fetchTable = useCallback(async <T>(
    table: string,
    orgId: string,
    setter: (rows: T[]) => void,
    transform?: (row: T) => T,
  ): Promise<void> => {
    const res = await fetchAllRows(table, orgId);
    if (!res.data) return;
    let rows = res.data.map(r => r.data as T);
    if (transform) rows = rows.map(transform);
    setter(rows);
  }, []);

  const fetchFirmalar = useCallback(async (orgId: string) => {
    await fetchTable<Firma>('firmalar', orgId, setFirmalar);
  }, [fetchTable, setFirmalar]);

  const fetchPersoneller = useCallback(async (orgId: string) => {
    await fetchTable<Personel>('personeller', orgId, setPersoneller, p => ({
      ...p, kanGrubu: KAN_MAP[p.kanGrubu ?? ''] ?? (p.kanGrubu ?? ''),
    }));
  }, [fetchTable, setPersoneller]);

  const fetchEvraklar = useCallback(async (orgId: string) => {
    await fetchTable<Evrak>('evraklar', orgId, setEvraklar, e => ({
      ...e, kategori: e.kategori || getEvrakKategori(e.tur ?? '', e.ad ?? ''),
    }));
  }, [fetchTable, setEvraklar]);

  const fetchEgitimler = useCallback(async (orgId: string) => {
    await fetchTable<Egitim>('egitimler', orgId, setEgitimler);
  }, [fetchTable, setEgitimler]);

  const fetchMuayeneler = useCallback(async (orgId: string) => {
    await fetchTable<Muayene>('muayeneler', orgId, setMuayeneler);
  }, [fetchTable, setMuayeneler]);

  const fetchUygunsuzluklar = useCallback(async (orgId: string) => {
    await fetchTable<Uygunsuzluk>('uygunsuzluklar', orgId, setUygunsuzluklar, u => {
      let durum = u.durum as string;
      if (durum === 'Kapatıldı') durum = 'Kapandı';
      if (durum === 'İncelemede') durum = 'Açık';
      return { ...u, durum: durum as UygunsuzlukStatus };
    });
  }, [fetchTable, setUygunsuzluklar]);

  const fetchEkipmanlar = useCallback(async (orgId: string) => {
    await fetchTable<Ekipman>('ekipmanlar', orgId, setEkipmanlar);
  }, [fetchTable, setEkipmanlar]);

  // fetchGorevler is a no-op here — gorevler is managed by useGorevStore
  const fetchGorevler = useCallback(async (_orgId: string) => {
    // Intentionally empty: gorevler managed exclusively by useGorevStore
  }, []);

  const fetchTutanaklar = useCallback(async (orgId: string) => {
    await fetchTable<Tutanak>('tutanaklar', orgId, setTutanaklar);
  }, [fetchTable, setTutanaklar]);

  const fetchIsIzinleri = useCallback(async (orgId: string) => {
    await fetchTable<IsIzni>('is_izinleri', orgId, setIsIzinleri);
  }, [fetchTable, setIsIzinleri]);

  // ── Which tables have been fetched at least once ──
  const fetchedTablesRef = useRef<Set<string>>(new Set());

  // Reset on org change
  useEffect(() => {
    fetchedTablesRef.current = new Set();
  }, [organizationId]);

  // ── Initial load — fetch firmalar + personeller only ──
  const loadAllData = useCallback(async (orgId: string) => {
    fetchedTablesRef.current.add('firmalar');
    fetchedTablesRef.current.add('personeller');
    await Promise.allSettled([
      fetchFirmalar(orgId),
      fetchPersoneller(orgId),
    ]);
  }, [fetchFirmalar, fetchPersoneller]);

  // ── Lazy fetch: modüle ilk girilince ilgili tabloyu çek ──
  // Modül → tablo eşlemesi
  const MODULE_TABLES: Record<string, string[]> = {
    firmalar:        ['firmalar'],
    personeller:     ['personeller'],
    evraklar:        ['evraklar', 'personeller', 'firmalar'],
    'firma-evraklari': ['firmalar'],
    egitimler:       ['egitimler', 'personeller', 'firmalar'],
    muayeneler:      ['muayeneler', 'personeller', 'firmalar'],
    uygunsuzluklar:  ['uygunsuzluklar', 'personeller', 'firmalar'],
    ekipmanlar:      ['ekipmanlar', 'firmalar'],
    tutanaklar:      ['tutanaklar', 'personeller', 'firmalar'],
    'is-izinleri':   ['is_izinleri', 'personeller', 'firmalar'],
    raporlar:        ['evraklar', 'egitimler', 'muayeneler', 'uygunsuzluklar', 'ekipmanlar', 'tutanaklar', 'is_izinleri', 'personeller', 'firmalar'],
    dokumanlar:      ['personeller', 'firmalar'],
    copkutusu:       ['firmalar', 'personeller', 'evraklar', 'egitimler', 'muayeneler', 'uygunsuzluklar', 'ekipmanlar', 'tutanaklar', 'is_izinleri'],
    ayarlar:         [],
    dashboard:       ['firmalar', 'personeller'],
    saha:            ['personeller', 'firmalar', 'uygunsuzluklar', 'ekipmanlar', 'is_izinleri'],
  };

  // Populated after fetcher functions are defined — see useEffect below
  const fetcherMapRef = useRef<Record<string, (orgId: string) => Promise<void>>>({});

  const fetchModuleTables = useCallback(async (module: string) => {
    const orgId = orgIdRef.current;
    if (!orgId) return;
    const tables = MODULE_TABLES[module] ?? [];
    const toFetch = tables.filter(t => !fetchedTablesRef.current.has(t));
    if (toFetch.length === 0) return;
    // Mark immediately to prevent duplicate parallel calls
    toFetch.forEach(t => fetchedTablesRef.current.add(t));
    const fetchers = fetcherMapRef.current;
    await Promise.allSettled(
      toFetch
        .filter(t => fetchers[t])
        .map(t => fetchers[t](orgId))
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Full refresh (module-aware) ──
  // refreshAllData artık sadece o anda yüklenmiş tabloları yeniler
  // + aktif modülün tablolarını ekler (eğer daha önce yüklenmediyse yükler)
  const refreshAllData = useCallback(async (activeModule?: string) => {
    const orgId = orgIdRef.current;
    if (!orgId) return;
    setDataLoading(true);
    setPartialLoading(true);
    try {
      // Aktif modülün tablolarını da kümemize ekle
      const moduleTables = activeModule ? (MODULE_TABLES[activeModule] ?? []) : [];
      moduleTables.forEach(t => fetchedTablesRef.current.add(t));

      const tablesToRefresh = Array.from(fetchedTablesRef.current);
      const fetchers = fetcherMapRef.current;
      await Promise.allSettled(
        tablesToRefresh
          .filter(t => fetchers[t])
          .map(t => fetchers[t](orgId))
      );
    } finally {
      setDataLoading(false);
      setPartialLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Populate fetcherMapRef after all fetchers are defined ──
  useEffect(() => {
    fetcherMapRef.current = {
      firmalar:      fetchFirmalar,
      personeller:   fetchPersoneller,
      evraklar:      fetchEvraklar,
      egitimler:     fetchEgitimler,
      muayeneler:    fetchMuayeneler,
      uygunsuzluklar: fetchUygunsuzluklar,
      ekipmanlar:    fetchEkipmanlar,
      tutanaklar:    fetchTutanaklar,
      is_izinleri:   fetchIsIzinleri,
    };
  }, [fetchFirmalar, fetchPersoneller, fetchEvraklar, fetchEgitimler, fetchMuayeneler, fetchUygunsuzluklar, fetchEkipmanlar, fetchTutanaklar, fetchIsIzinleri]);

  // ── Load on mount / org change ──
  useEffect(() => {
    if (orgLoading) return;
    if (!organizationId || !userId) {
      setFirmalar([]); setPersoneller([]); setEvraklar([]);
      setEgitimler([]); setMuayeneler([]); setUygunsuzluklar([]);
      setEkipmanlar([]); setTutanaklar([]); setIsIzinleri([]);
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
  // NOTE: gorevler table is intentionally excluded — handled by useGorevStore
  useEffect(() => {
    if (!organizationId || !userId || orgLoading) return;
    const activeOrgId = organizationId;

    // ──────────────────────────────────────────────────────────────
    // Soft-delete patch: when deleted_at arrives via realtime,
    // we update the record as silinmis:true INSTEAD of removing it
    // from state. This keeps it visible in the Çöp Kutusu (Trash).
    // Hard DELETE events still remove the record from state.
    // ──────────────────────────────────────────────────────────────
    const applySoftDeletePatch = (table: string, recordId: string) => {
      const now = new Date().toISOString();
      switch (table) {
        case 'firmalar':
          _setFirmalar(prev => prev.map(r => r.id === recordId ? { ...r, silinmis: true as const, silinmeTarihi: r.silinmeTarihi ?? now } : r));
          break;
        case 'personeller':
          _setPersoneller(prev => prev.map(r => r.id === recordId ? { ...r, silinmis: true as const, silinmeTarihi: r.silinmeTarihi ?? now } : r));
          break;
        case 'evraklar':
          _setEvraklar(prev => prev.map(r => r.id === recordId ? { ...r, silinmis: true as const, silinmeTarihi: r.silinmeTarihi ?? now } : r));
          break;
        case 'egitimler':
          _setEgitimler(prev => prev.map(r => r.id === recordId ? { ...r, silinmis: true as const, silinmeTarihi: r.silinmeTarihi ?? now } : r));
          break;
        case 'muayeneler':
          _setMuayeneler(prev => prev.map(r => r.id === recordId ? { ...r, silinmis: true as const, silinmeTarihi: r.silinmeTarihi ?? now } : r));
          break;
        case 'uygunsuzluklar':
          _setUygunsuzluklar(prev => {
            const next = prev.map(r => r.id === recordId ? { ...r, silinmis: true as const, silinmeTarihi: r.silinmeTarihi ?? now } : r);
            uygRef.current = next;
            return next;
          });
          break;
        case 'ekipmanlar':
          _setEkipmanlar(prev => prev.map(r => r.id === recordId ? { ...r, silinmis: true as const, silinmeTarihi: r.silinmeTarihi ?? now } : r));
          break;
        case 'tutanaklar':
          _setTutanaklar(prev => {
            const next = prev.map(r => r.id === recordId ? { ...r, silinmis: true as const, silinmeTarihi: r.silinmeTarihi ?? now } : r);
            tutRef.current = next;
            return next;
          });
          break;
        case 'is_izinleri':
          _setIsIzinleri(prev => {
            const next = prev.map(r => r.id === recordId ? { ...r, silinmis: true as const, silinmeTarihi: r.silinmeTarihi ?? now } : r);
            isIzRef.current = next;
            return next;
          });
          break;
      }
    };

    const applyHardDeletePatch = (table: string, recordId: string) => {
      switch (table) {
        case 'firmalar':       _setFirmalar(prev => prev.filter(r => r.id !== recordId)); break;
        case 'personeller':    _setPersoneller(prev => prev.filter(r => r.id !== recordId)); break;
        case 'evraklar':       _setEvraklar(prev => prev.filter(r => r.id !== recordId)); break;
        case 'egitimler':      _setEgitimler(prev => prev.filter(r => r.id !== recordId)); break;
        case 'muayeneler':     _setMuayeneler(prev => prev.filter(r => r.id !== recordId)); break;
        case 'uygunsuzluklar': _setUygunsuzluklar(prev => { const n = prev.filter(r => r.id !== recordId); uygRef.current = n; return n; }); break;
        case 'ekipmanlar':     _setEkipmanlar(prev => prev.filter(r => r.id !== recordId)); break;
        case 'tutanaklar':     _setTutanaklar(prev => { const n = prev.filter(r => r.id !== recordId); tutRef.current = n; return n; }); break;
        case 'is_izinleri':    _setIsIzinleri(prev => { const n = prev.filter(r => r.id !== recordId); isIzRef.current = n; return n; }); break;
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
        case 'firmalar':       upsert<Firma>(setFirmalar); break;
        case 'personeller':    upsert<Personel>(setPersoneller, p => ({ ...p, kanGrubu: KAN_MAP[p.kanGrubu ?? ''] ?? (p.kanGrubu ?? '') })); break;
        case 'evraklar':       upsert<Evrak>(setEvraklar, e => ({ ...e, kategori: e.kategori || getEvrakKategori(e.tur ?? '', e.ad ?? '') })); break;
        case 'egitimler':      upsert<Egitim>(setEgitimler); break;
        case 'muayeneler':     upsert<Muayene>(setMuayeneler); break;
        case 'uygunsuzluklar': upsert<Uygunsuzluk>(setUygunsuzluklar, u => ({ ...u, durum: (u.durum === 'Kapatıldı' ? 'Kapandı' : u.durum === 'İncelemede' ? 'Açık' : u.durum) as UygunsuzlukStatus })); break;
        case 'ekipmanlar':     upsert<Ekipman>(setEkipmanlar); break;
        case 'tutanaklar':     upsert<Tutanak>(setTutanaklar); break;
        case 'is_izinleri':    upsert<IsIzni>(setIsIzinleri); break;
      }
    };

    const reloadTable = async (table: string) => {
      const { data, error } = await fetchAllRows(table, activeOrgId);
      if (error || !data) { console.error(`[ISG] reloadTable error (${table}):`, error); return; }
      const rows = data.map(r => r.data as unknown);
      switch (table) {
        case 'firmalar':       setFirmalar(rows as Firma[]); break;
        case 'personeller':    setPersoneller((rows as Personel[]).map(p => ({ ...p, kanGrubu: KAN_MAP[p.kanGrubu ?? ''] ?? (p.kanGrubu ?? '') }))); break;
        case 'evraklar':       setEvraklar((rows as Evrak[]).map(e => ({ ...e, kategori: e.kategori || getEvrakKategori(e.tur ?? '', e.ad ?? '') }))); break;
        case 'egitimler':      setEgitimler(rows as Egitim[]); break;
        case 'muayeneler':     setMuayeneler(rows as Muayene[]); break;
        case 'uygunsuzluklar': setUygunsuzluklar((rows as Uygunsuzluk[]).map(u => ({ ...u, durum: (u.durum === 'Kapatıldı' ? 'Kapandı' : u.durum === 'İncelemede' ? 'Açık' : u.durum) as UygunsuzlukStatus }))); break;
        case 'ekipmanlar':     setEkipmanlar(rows as Ekipman[]); break;
        case 'tutanaklar':     setTutanaklar(rows as Tutanak[]); break;
        case 'is_izinleri':    setIsIzinleri(rows as IsIzni[]); break;
      }
    };

    // gorevler intentionally NOT in this list — useGorevStore owns it
    const TABLES = [
      'firmalar', 'personeller', 'evraklar', 'egitimler',
      'muayeneler', 'uygunsuzluklar', 'ekipmanlar', 'tutanaklar', 'is_izinleri',
    ];

    const deviceId = getDeviceId();
    const MODULE_NAMES: Record<string, string> = {
      firmalar: 'Firmalar', personeller: 'Personeller', evraklar: 'Evraklar',
      egitimler: 'Eğitimler', muayeneler: 'Muayeneler', uygunsuzluklar: 'Saha Denetim',
      ekipmanlar: 'Ekipmanlar', tutanaklar: 'Tutanaklar', is_izinleri: 'İş İzinleri',
    };

    // Sabit kanal adı — Date.now() KALDIRILDI.
    // Date.now() kullanılırsa her re-mount yeni kanal açar, eski kanallar hemen kapanmaz,
    // zamanla onlarca zombie kanal birikir ve realtime yavaşlar / kopar.
    // Sabit ad ile Supabase aynı kanalı yeniden kullanır.
    const channelName = `isg_rt_${activeOrgId}_${userId}`;
    let channel = supabase.channel(channelName, { config: { presence: { key: '' } } });

    TABLES.forEach(table => {
      channel = channel.on(
        'postgres_changes' as Parameters<typeof channel.on>[0],
        { event: '*', schema: 'public', table, filter: `organization_id=eq.${activeOrgId}` } as Parameters<typeof channel.on>[1],
        (payload: { eventType: string; new: Record<string, unknown>; old?: Record<string, unknown> }) => {
          const remoteDeviceId = payload.new?.device_id as string | undefined;
          if (remoteDeviceId && remoteDeviceId === deviceId) {
            console.log(`[ISG] Realtime skip (own device): ${table}`);
            return;
          }

          const recordId = (payload.new?.id ?? payload.old?.id) as string | undefined;
          if (!recordId) { void reloadTable(table); return; }

          // ── Hard DELETE ──
          if (payload.eventType === 'DELETE') {
            const isOwnDelete = ownDeletesRef.current.has(recordId);
            if (isOwnDelete) { ownDeletesRef.current.delete(recordId); return; }
            applyHardDeletePatch(table, recordId);
            onRemoteChangeRef.current?.(MODULE_NAMES[table] ?? table);
            return;
          }

          const newData = payload.new?.data;
          const deletedAt = payload.new?.deleted_at;

          // ── Soft DELETE from another device/tab ──
          // Instead of removing from state, mark silinmis:true so Trash still shows it
          if (deletedAt && recordId) {
            console.log(`[ISG] Realtime soft-delete patch: ${table}/${recordId}`);
            // Use the full data payload if available, else just flag silinmis
            if (newData) {
              applyUpsertPatch(table, recordId, newData);
            } else {
              applySoftDeletePatch(table, recordId);
            }
            onRemoteChangeRef.current?.(MODULE_NAMES[table] ?? table);
            return;
          }

          // ── INSERT / UPDATE ──
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
      if (err) console.error(`[ISG] Realtime subscribe error:`, err);
      if (status === 'SUBSCRIBED') setRealtimeStatus('connected');
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setRealtimeStatus('disconnected');
      else setRealtimeStatus('connecting');
    });

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, userId, orgLoading]);

  // ──────── FIRMA ────────
  const addFirma = useCallback((firma: Omit<Firma, 'id' | 'olusturmaTarihi' | 'guncellemeTarihi'>) => {
    const now = new Date().toISOString();
    const newFirma: Firma = { ...firma, id: genId(), olusturmaTarihi: now, guncellemeTarihi: now };
    setFirmalar(prev => [newFirma, ...prev]);
    void saveToDb('firmalar', newFirma as unknown as { id: string } & Record<string, unknown>);
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
    if (updated) void saveToDb('firmalar', updated as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('firma_updated', 'Firmalar', id, updates.ad, 'Firma bilgileri güncellendi.');
  }, [setFirmalar, saveToDb]);

  const deleteFirma = useCallback((id: string) => {
    const now = new Date().toISOString();
    const cascadeFields = { silinmis: true as const, silinmeTarihi: now, cascadeSilindi: true as const, cascadeFirmaId: id };
    const updatedItems: { table: string; item: { id: string } & Record<string, unknown> }[] = [];

    setFirmalar(prev => prev.map(f => { if (f.id !== id) return f; const u = { ...f, silinmis: true as const, silinmeTarihi: now }; updatedItems.push({ table: 'firmalar', item: u as unknown as { id: string } & Record<string, unknown> }); return u; }));
    setPersoneller(prev => prev.map(p => { if (p.firmaId !== id || p.silinmis) return p; const u = { ...p, ...cascadeFields }; updatedItems.push({ table: 'personeller', item: u as unknown as { id: string } & Record<string, unknown> }); return u; }));
    setEvraklar(prev => prev.map(e => { if (e.silinmis || e.firmaId !== id || e.personelId) return e; const u = { ...e, ...cascadeFields }; updatedItems.push({ table: 'evraklar', item: u as unknown as { id: string } & Record<string, unknown> }); return u; }));
    setEgitimler(prev => prev.map(e => { if (e.firmaId !== id || e.silinmis) return e; const u = { ...e, ...cascadeFields }; updatedItems.push({ table: 'egitimler', item: u as unknown as { id: string } & Record<string, unknown> }); return u; }));
    setMuayeneler(prev => prev.map(m => { if (m.firmaId !== id || m.silinmis) return m; const u = { ...m, ...cascadeFields }; updatedItems.push({ table: 'muayeneler', item: u as unknown as { id: string } & Record<string, unknown> }); return u; }));
    setUygunsuzluklar(prev => prev.map(u => { if (u.firmaId !== id || u.silinmis) return u; const updated = { ...u, ...cascadeFields }; updatedItems.push({ table: 'uygunsuzluklar', item: updated as unknown as { id: string } & Record<string, unknown> }); return updated; }));
    setEkipmanlar(prev => prev.map(e => { if (e.firmaId !== id || e.silinmis) return e; const u = { ...e, ...cascadeFields }; updatedItems.push({ table: 'ekipmanlar', item: u as unknown as { id: string } & Record<string, unknown> }); return u; }));

    // Flush all cascade saves in parallel — guarantee all reach DB
    void Promise.allSettled(
      updatedItems.map(({ table, item }) => saveToDb(table, item))
    ).then(results => {
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        console.error('[ISG] deleteFirma cascade: some saves failed', failed);
        onSaveErrorRef.current?.(`Firma silme sırasında ${failed.length} kayıt yazılamadı. Lütfen tekrar deneyin.`);
      }
    });

    logFnRef.current?.('firma_deleted', 'Firmalar', id, undefined, 'Firma silindi.');
  }, [setFirmalar, setPersoneller, setEvraklar, setEgitimler, setMuayeneler, setUygunsuzluklar, setEkipmanlar, saveToDb]);

  const restoreFirma = useCallback((id: string) => {
    const rf = { silinmis: false as const, silinmeTarihi: undefined, cascadeSilindi: false as const, cascadeFirmaId: undefined };
    const updatedItems: { table: string; item: { id: string } & Record<string, unknown> }[] = [];

    const collect = <T extends { id: string }>(
      setter: (fn: (prev: T[]) => T[]) => void,
      table: string,
      pred: (item: T) => boolean,
    ) => setter(prev => prev.map(item => {
      if (!pred(item)) return item;
      const u = { ...item, ...rf };
      updatedItems.push({ table, item: u as unknown as { id: string } & Record<string, unknown> });
      return u;
    }));

    setFirmalar(prev => prev.map(f => { if (f.id !== id) return f; const u = { ...f, silinmis: false as const, silinmeTarihi: undefined }; updatedItems.push({ table: 'firmalar', item: u as unknown as { id: string } & Record<string, unknown> }); return u; }));
    collect<Personel>(setPersoneller, 'personeller', p => p.cascadeFirmaId === id && !!p.cascadeSilindi);
    collect<Evrak>(setEvraklar, 'evraklar', e => e.cascadeFirmaId === id && !!e.cascadeSilindi);
    collect<Egitim>(setEgitimler, 'egitimler', e => e.cascadeFirmaId === id && !!e.cascadeSilindi);
    collect<Muayene>(setMuayeneler, 'muayeneler', m => m.cascadeFirmaId === id && !!m.cascadeSilindi);
    collect<Uygunsuzluk>(setUygunsuzluklar, 'uygunsuzluklar', u => u.cascadeFirmaId === id && !!u.cascadeSilindi);
    collect<Ekipman>(setEkipmanlar, 'ekipmanlar', e => e.cascadeFirmaId === id && !!e.cascadeSilindi);

    void Promise.allSettled(
      updatedItems.map(({ table, item }) => saveToDb(table, item, true))
    ).then(results => {
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        console.error('[ISG] restoreFirma: some saves failed', failed);
        onSaveErrorRef.current?.(`Firma geri yükleme sırasında ${failed.length} kayıt yazılamadı. Lütfen tekrar deneyin.`);
      }
    });
  }, [setFirmalar, setPersoneller, setEvraklar, setEgitimler, setMuayeneler, setUygunsuzluklar, setEkipmanlar, saveToDb]);

  const permanentDeleteFirma = useCallback(async (id: string) => {
    ownDeletesRef.current.add(id);
    let snapFirmalar: Firma[] = [], snapPersoneller: Personel[] = [], snapEvraklar: Evrak[] = [],
      snapEgitimler: Egitim[] = [], snapMuayeneler: Muayene[] = [], snapUyg: Uygunsuzluk[] = [],
      snapEkipmanlar: Ekipman[] = [];
    let personelIds: string[] = [], evrakIds: string[] = [], egitimIds: string[] = [],
      muayeneIds: string[] = [], uygIds: string[] = [], ekipmanIds: string[] = [];

    await Promise.all([
      new Promise<void>(res => { _setFirmalar(prev => { snapFirmalar = prev; res(); return prev.filter(f => f.id !== id); }); }),
      new Promise<void>(res => { _setPersoneller(prev => { snapPersoneller = prev; personelIds = prev.filter(p => p.firmaId === id).map(p => p.id); res(); return prev.filter(p => p.firmaId !== id); }); }),
      new Promise<void>(res => { _setEvraklar(prev => { snapEvraklar = prev; evrakIds = prev.filter(e => e.firmaId === id).map(e => e.id); res(); return prev.filter(e => e.firmaId !== id); }); }),
      new Promise<void>(res => { _setEgitimler(prev => { snapEgitimler = prev; egitimIds = prev.filter(e => e.firmaId === id).map(e => e.id); res(); return prev.filter(e => e.firmaId !== id); }); }),
      new Promise<void>(res => { _setMuayeneler(prev => { snapMuayeneler = prev; muayeneIds = prev.filter(m => m.firmaId === id).map(m => m.id); res(); return prev.filter(m => m.firmaId !== id); }); }),
      new Promise<void>(res => { _setUygunsuzluklar(prev => { snapUyg = prev; uygIds = prev.filter(u => u.firmaId === id).map(u => u.id); res(); return prev.filter(u => u.firmaId !== id); }); }),
      new Promise<void>(res => { _setEkipmanlar(prev => { snapEkipmanlar = prev; ekipmanIds = prev.filter(e => e.firmaId === id).map(e => e.id); res(); return prev.filter(e => e.firmaId !== id); }); }),
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
      ]);
    } catch (err) {
      console.error('[ISG] permanentDeleteFirma FAILED, rolling back:', err);
      _setFirmalar(snapFirmalar); _setPersoneller(snapPersoneller); _setEvraklar(snapEvraklar);
      _setEgitimler(snapEgitimler); _setMuayeneler(snapMuayeneler); _setUygunsuzluklar(snapUyg);
      _setEkipmanlar(snapEkipmanlar);
      onSaveErrorRef.current?.(`Kalıcı silme hatası (firma): ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  // ──────── PERSONEL ────────
  const addPersonel = useCallback((personel: Omit<Personel, 'id' | 'olusturmaTarihi' | 'guncellemeTarihi'>) => {
    const now = new Date().toISOString();
    const newPersonel: Personel = { ...personel, id: genId(), olusturmaTarihi: now, guncellemeTarihi: now };
    setPersoneller(prev => [newPersonel, ...prev]);
    void saveToDb('personeller', newPersonel as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('personel_created', 'Personeller', newPersonel.id, newPersonel.adSoyad, `${newPersonel.adSoyad} personel olarak eklendi.`);
    return newPersonel;
  }, [setPersoneller, saveToDb]);

  const updatePersonel = useCallback((id: string, updates: Partial<Personel>) => {
    let updated: Personel | null = null;
    setPersoneller(prev => prev.map(p => { if (p.id !== id) return p; updated = { ...p, ...updates, guncellemeTarihi: new Date().toISOString() }; return updated; }));
    if (updated) void saveToDb('personeller', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setPersoneller, saveToDb]);

  const deletePersonel = useCallback((id: string) => {
    let updated: Personel | null = null;
    setPersoneller(prev => prev.map(p => { if (p.id !== id) return p; updated = { ...p, silinmis: true as const, silinmeTarihi: new Date().toISOString() }; return updated; }));
    if (updated) void saveToDb('personeller', updated as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('personel_deleted', 'Personeller', id, undefined, 'Personel silindi.');
  }, [setPersoneller, saveToDb]);

  const restorePersonel = useCallback((id: string) => {
    let updated: Personel | null = null;
    setPersoneller(prev => prev.map(p => { if (p.id !== id) return p; updated = { ...p, silinmis: false as const, silinmeTarihi: undefined }; return updated; }));
    if (updated) void saveToDb('personeller', updated as unknown as { id: string } & Record<string, unknown>, true).catch(err => onSaveErrorRef.current?.(`Personel geri yükleme hatası: ${err instanceof Error ? err.message : String(err)}`));
  }, [setPersoneller, saveToDb]);

  const personellerRef = useRef<Personel[]>([]);
  useEffect(() => { personellerRef.current = personeller; }, [personeller]);
  const permanentDeletePersonel = useCallback(async (id: string) => {
    const snapshot = personellerRef.current;
    ownDeletesRef.current.add(id);
    _setPersoneller(prev => prev.filter(p => p.id !== id));
    try { await dbDelete('personeller', id); } catch (err) { ownDeletesRef.current.delete(id); _setPersoneller(snapshot); onSaveErrorRef.current?.(`Kalıcı silme hatası (personeller): ${err instanceof Error ? err.message : String(err)}`); throw err; }
  }, []);

  // ──────── EVRAK ────────
  const addEvrak = useCallback((evrak: Omit<Evrak, 'id' | 'olusturmaTarihi'>) => {
    const id = genId();
    const { dosyaVeri: _ignored, ...rest } = evrak as Evrak & { dosyaVeri?: string };
    const kategori = evrak.kategori || getEvrakKategori(evrak.tur, evrak.ad);
    const newEvrak: Evrak = { ...rest, kategori, id, olusturmaTarihi: new Date().toISOString() };
    setEvraklar(prev => [newEvrak, ...prev]);
    void saveToDb('evraklar', newEvrak as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('evrak_created', 'Evraklar', id, newEvrak.ad, `${newEvrak.ad} evrakı eklendi.`);
    return newEvrak;
  }, [setEvraklar, saveToDb]);

  const updateEvrak = useCallback((id: string, updates: Partial<Evrak>) => {
    const { dosyaVeri: _ignored, ...rest } = updates as Partial<Evrak> & { dosyaVeri?: string };
    let updated: Evrak | null = null;
    setEvraklar(prev => prev.map(e => { if (e.id !== id) return e; const merged = { ...e, ...rest }; if (rest.tur !== undefined || rest.ad !== undefined) merged.kategori = getEvrakKategori(merged.tur, merged.ad); updated = merged; return merged; }));
    if (updated) void saveToDb('evraklar', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setEvraklar, saveToDb]);

  const deleteEvrak = useCallback((id: string) => {
    let updated: Evrak | null = null;
    setEvraklar(prev => prev.map(e => { if (e.id !== id) return e; updated = { ...e, silinmis: true as const, silinmeTarihi: new Date().toISOString() }; return updated; }));
    if (updated) void saveToDb('evraklar', updated as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('evrak_deleted', 'Evraklar', id, undefined, 'Evrak silindi.');
  }, [setEvraklar, saveToDb]);

  const restoreEvrak = useCallback((id: string) => {
    let updated: Evrak | null = null;
    setEvraklar(prev => prev.map(e => { if (e.id !== id) return e; updated = { ...e, silinmis: false as const, silinmeTarihi: undefined }; return updated; }));
    if (updated) void saveToDb('evraklar', updated as unknown as { id: string } & Record<string, unknown>, true).catch(err => onSaveErrorRef.current?.(`Evrak geri yükleme hatası: ${err instanceof Error ? err.message : String(err)}`));
  }, [setEvraklar, saveToDb]);

  const evraklarRef = useRef<Evrak[]>([]);
  useEffect(() => { evraklarRef.current = evraklar; }, [evraklar]);
  const permanentDeleteEvrak = useCallback(async (id: string) => {
    const snapshot = evraklarRef.current;
    ownDeletesRef.current.add(id);
    _setEvraklar(prev => prev.filter(e => e.id !== id));
    try { await dbDelete('evraklar', id); } catch (err) { ownDeletesRef.current.delete(id); _setEvraklar(snapshot); onSaveErrorRef.current?.(`Kalıcı silme hatası (evraklar): ${err instanceof Error ? err.message : String(err)}`); throw err; }
  }, []);

  // ──────── EĞİTİM ────────
  const addEgitim = useCallback((egitim: Omit<Egitim, 'id' | 'olusturmaTarihi'>) => {
    const id = genId();
    const { belgeDosyaVeri: _ignored, ...rest } = egitim as Egitim & { belgeDosyaVeri?: string };
    const newEgitim: Egitim = { ...rest, id, olusturmaTarihi: new Date().toISOString() };
    setEgitimler(prev => [newEgitim, ...prev]);
    void saveToDb('egitimler', newEgitim as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('egitim_created', 'Eğitimler', id, newEgitim.ad, `${newEgitim.ad} eğitimi oluşturuldu.`);
    return newEgitim;
  }, [setEgitimler, saveToDb]);

  const updateEgitim = useCallback((id: string, updates: Partial<Egitim>) => {
    const { belgeDosyaVeri: _ignored, ...rest } = updates as Partial<Egitim> & { belgeDosyaVeri?: string };
    let updated: Egitim | null = null;
    setEgitimler(prev => prev.map(e => { if (e.id !== id) return e; updated = { ...e, ...rest }; return updated; }));
    if (updated) void saveToDb('egitimler', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setEgitimler, saveToDb]);

  const deleteEgitim = useCallback((id: string) => {
    let updated: Egitim | null = null;
    setEgitimler(prev => prev.map(e => { if (e.id !== id) return e; updated = { ...e, silinmis: true as const, silinmeTarihi: new Date().toISOString() }; return updated; }));
    if (updated) void saveToDb('egitimler', updated as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('egitim_deleted', 'Eğitimler', id, undefined, 'Eğitim silindi.');
  }, [setEgitimler, saveToDb]);

  const restoreEgitim = useCallback((id: string) => {
    let updated: Egitim | null = null;
    setEgitimler(prev => prev.map(e => { if (e.id !== id) return e; updated = { ...e, silinmis: false as const, silinmeTarihi: undefined }; return updated; }));
    if (updated) void saveToDb('egitimler', updated as unknown as { id: string } & Record<string, unknown>, true).catch(err => onSaveErrorRef.current?.(`Eğitim geri yükleme hatası: ${err instanceof Error ? err.message : String(err)}`));
  }, [setEgitimler, saveToDb]);

  const egitimlerRef = useRef<Egitim[]>([]);
  useEffect(() => { egitimlerRef.current = egitimler; }, [egitimler]);
  const permanentDeleteEgitim = useCallback(async (id: string) => {
    const snapshot = egitimlerRef.current;
    ownDeletesRef.current.add(id);
    _setEgitimler(prev => prev.filter(e => e.id !== id));
    try { await dbDelete('egitimler', id); } catch (err) { ownDeletesRef.current.delete(id); _setEgitimler(snapshot); onSaveErrorRef.current?.(`Kalıcı silme hatası (egitimler): ${err instanceof Error ? err.message : String(err)}`); throw err; }
  }, []);

  // ──────── MUAYENE ────────
  const addMuayene = useCallback((muayene: Omit<Muayene, 'id' | 'olusturmaTarihi'>) => {
    const newMuayene: Muayene = { ...muayene, id: genId(), olusturmaTarihi: new Date().toISOString() };
    setMuayeneler(prev => [newMuayene, ...prev]);
    void saveToDb('muayeneler', newMuayene as unknown as { id: string } & Record<string, unknown>);
    return newMuayene;
  }, [setMuayeneler, saveToDb]);

  const updateMuayene = useCallback((id: string, updates: Partial<Muayene>) => {
    let updated: Muayene | null = null;
    setMuayeneler(prev => prev.map(m => { if (m.id !== id) return m; updated = { ...m, ...updates }; return updated; }));
    if (updated) void saveToDb('muayeneler', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setMuayeneler, saveToDb]);

  const deleteMuayene = useCallback((id: string) => {
    const now = new Date().toISOString();
    let updated: Muayene | null = null;
    setMuayeneler(prev => prev.map(m => { if (m.id !== id) return m; updated = { ...m, silinmis: true as const, silinmeTarihi: now }; return updated; }));
    if (updated) {
      // Use saveToDb which now correctly sets deleted_at from silinmis flag
      void saveToDb('muayeneler', updated as unknown as { id: string } & Record<string, unknown>);
    }
    logFnRef.current?.('muayene_deleted', 'Sağlık', id, undefined, 'Sağlık evrakı silindi.');
  }, [setMuayeneler, saveToDb]);

  const restoreMuayene = useCallback((id: string) => {
    let updated: Muayene | null = null;
    setMuayeneler(prev => prev.map(m => { if (m.id !== id) return m; updated = { ...m, silinmis: false as const, silinmeTarihi: undefined }; return updated; }));
    if (updated) void saveToDb('muayeneler', updated as unknown as { id: string } & Record<string, unknown>, true).catch(err => onSaveErrorRef.current?.(`Sağlık kaydı geri yükleme hatası: ${err instanceof Error ? err.message : String(err)}`));
  }, [setMuayeneler, saveToDb]);

  const muayenelerRef = useRef<Muayene[]>([]);
  useEffect(() => { muayenelerRef.current = muayeneler; }, [muayeneler]);
  const permanentDeleteMuayene = useCallback(async (id: string) => {
    const snapshot = muayenelerRef.current;
    ownDeletesRef.current.add(id);
    _setMuayeneler(prev => prev.filter(m => m.id !== id));
    try { await dbDelete('muayeneler', id); } catch (err) { ownDeletesRef.current.delete(id); _setMuayeneler(snapshot); onSaveErrorRef.current?.(`Kalıcı silme hatası (muayeneler): ${err instanceof Error ? err.message : String(err)}`); throw err; }
  }, []);

  // ──────── UYGUNSUZLUK ────────
  const addUygunsuzluk = useCallback(async (u: Omit<Uygunsuzluk, 'id' | 'olusturmaTarihi'>) => {
    const id = genId();
    const now = new Date().toISOString();
    const rpcNo = await generateRecordNoFromDB('dof');
    const acilisNo = rpcNo ?? generateDofNo(uygRef.current);
    const durum = u.kapatmaFotoMevcut ? 'Kapandı' as const : 'Açık' as const;
    const newU: Uygunsuzluk = { ...u, id, durum, olusturmaTarihi: now, acilisNo };
    setUygunsuzluklar(prev => [newU, ...prev]);
    // throwOnError=true — orgId/userId hazır değilse form hata göstersin, sessizce geçmesin
    await saveToDb('uygunsuzluklar', newU as unknown as { id: string } & Record<string, unknown>, true);
    logFnRef.current?.('uygunsuzluk_created', 'Uygunsuzluklar', id, u.baslik, `${u.baslik} uygunsuzluk kaydı oluşturuldu.`);
    return newU;
  }, [setUygunsuzluklar, saveToDb]);

  const updateUygunsuzluk = useCallback((id: string, updates: Partial<Uygunsuzluk>) => {
    let updated: Uygunsuzluk | null = null;
    setUygunsuzluklar(prev => prev.map(u => { if (u.id !== id) return u; const merged = { ...u, ...updates }; merged.durum = merged.kapatmaFotoMevcut ? 'Kapandı' : 'Açık'; updated = merged; return merged; }));
    if (updated) void saveToDb('uygunsuzluklar', updated as unknown as { id: string } & Record<string, unknown>);
    if (updates.kapatmaFotoMevcut) logFnRef.current?.('uygunsuzluk_closed', 'Uygunsuzluklar', id, updates.baslik, 'Uygunsuzluk kapatıldı.');
  }, [setUygunsuzluklar, saveToDb]);

  const deleteUygunsuzluk = useCallback((id: string) => {
    let updated: Uygunsuzluk | null = null;
    setUygunsuzluklar(prev => prev.map(u => { if (u.id !== id) return u; updated = { ...u, silinmis: true as const, silinmeTarihi: new Date().toISOString() }; return updated; }));
    if (updated) void saveToDb('uygunsuzluklar', updated as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('uygunsuzluk_deleted', 'Uygunsuzluklar', id, undefined, 'Uygunsuzluk silindi.');
  }, [setUygunsuzluklar, saveToDb]);

  const restoreUygunsuzluk = useCallback((id: string) => {
    let updated: Uygunsuzluk | null = null;
    setUygunsuzluklar(prev => prev.map(u => { if (u.id !== id) return u; updated = { ...u, silinmis: false as const, silinmeTarihi: undefined }; return updated; }));
    if (updated) void saveToDb('uygunsuzluklar', updated as unknown as { id: string } & Record<string, unknown>, true).catch(err => onSaveErrorRef.current?.(`Saha denetim geri yükleme hatası: ${err instanceof Error ? err.message : String(err)}`));
  }, [setUygunsuzluklar, saveToDb]);

  const uygunsuzluklarRef = useRef<Uygunsuzluk[]>([]);
  useEffect(() => { uygunsuzluklarRef.current = uygunsuzluklar; }, [uygunsuzluklar]);
  const permanentDeleteUygunsuzluk = useCallback(async (id: string) => {
    const snapshot = uygunsuzluklarRef.current;
    ownDeletesRef.current.add(id);
    _setUygunsuzluklar(prev => prev.filter(u => u.id !== id));
    try { await dbDelete('uygunsuzluklar', id); } catch (err) { ownDeletesRef.current.delete(id); _setUygunsuzluklar(snapshot); onSaveErrorRef.current?.(`Kalıcı silme hatası (uygunsuzluklar): ${err instanceof Error ? err.message : String(err)}`); throw err; }
  }, []);

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
  const addEkipman = useCallback((e: Omit<Ekipman, 'id' | 'olusturmaTarihi'>) => {
    const id = genId();
    const { dosyaVeri: _ignored, ...rest } = e as Ekipman & { dosyaVeri?: string };
    const newE: Ekipman = { ...rest, id, olusturmaTarihi: new Date().toISOString() };
    setEkipmanlar(prev => [newE, ...prev]);
    void saveToDb('ekipmanlar', newE as unknown as { id: string } & Record<string, unknown>);
    return newE;
  }, [setEkipmanlar, saveToDb]);

  const addEkipmanKontrolKaydi = useCallback((ekipmanId: string, kayit: Omit<import('@/types').EkipmanKontrolKaydi, 'id'>) => {
    const yeniKayit: import('@/types').EkipmanKontrolKaydi = { ...kayit, id: genId() };
    let updated: Ekipman | null = null;
    setEkipmanlar(prev => prev.map(e => {
      if (e.id !== ekipmanId) return e;
      updated = { ...e, durum: kayit.durum, kontrolGecmisi: [yeniKayit, ...(e.kontrolGecmisi ?? [])], sonKontrolTarihi: kayit.tarih.split('T')[0] };
      return updated;
    }));
    if (updated) void saveToDb('ekipmanlar', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setEkipmanlar, saveToDb]);

  const addEkipmanBelge = useCallback((ekipmanId: string, belge: Omit<import('@/types').EkipmanBelge, 'id' | 'arsiv'>) => {
    const yeniBelge: import('@/types').EkipmanBelge = { ...belge, id: genId(), arsiv: false };
    let updated: Ekipman | null = null;
    setEkipmanlar(prev => prev.map(e => {
      if (e.id !== ekipmanId) return e;
      const eskiBelgeler = (e.belgeler ?? []).map(b => b.arsiv ? b : { ...b, arsiv: true });
      updated = { ...e, belgeler: [yeniBelge, ...eskiBelgeler], belgeMevcut: true, dosyaAdi: yeniBelge.dosyaAdi, dosyaUrl: yeniBelge.dosyaUrl };
      return updated;
    }));
    if (updated) void saveToDb('ekipmanlar', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setEkipmanlar, saveToDb]);

  const DENETCI_ALLOWED_EKIPMAN_FIELDS = new Set(['sonKontrolTarihi', 'sonrakiKontrolTarihi', 'durum', 'kontrolGecmisi', 'notlar']);

  const updateEkipman = useCallback((id: string, updates: Partial<Ekipman>, callerRole?: string) => {
    const { dosyaVeri: _ignored, ...rest } = updates as Partial<Ekipman> & { dosyaVeri?: string };
    let safeRest = rest;
    if (callerRole === 'denetci') {
      safeRest = Object.fromEntries(Object.entries(rest).filter(([key]) => DENETCI_ALLOWED_EKIPMAN_FIELDS.has(key))) as Partial<Ekipman>;
    }
    if (safeRest.kontrolGecmisi === undefined) delete safeRest.kontrolGecmisi;
    if (safeRest.belgeler === undefined) delete safeRest.belgeler;
    let updated: Ekipman | null = null;
    let snapshot: Ekipman | null = null;
    setEkipmanlar(prev => prev.map(e => { if (e.id !== id) return e; snapshot = e; updated = { ...e, ...safeRest }; return updated; }));
    if (updated) {
      updateDirectInDb('ekipmanlar', id, { data: updated }).then(({ error }) => {
        if (error && snapshot) setEkipmanlar(prev => prev.map(e => e.id === id ? snapshot! : e));
      });
    }
  }, [setEkipmanlar, updateDirectInDb]);

  const deleteEkipman = useCallback((id: string) => {
    let updated: Ekipman | null = null;
    setEkipmanlar(prev => prev.map(e => { if (e.id !== id) return e; updated = { ...e, silinmis: true as const, silinmeTarihi: new Date().toISOString() }; return updated; }));
    if (updated) void saveToDb('ekipmanlar', updated as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('ekipman_deleted', 'Ekipmanlar', id, undefined, 'Ekipman silindi.');
  }, [setEkipmanlar, saveToDb]);

  const restoreEkipman = useCallback((id: string) => {
    let updated: Ekipman | null = null;
    setEkipmanlar(prev => prev.map(e => { if (e.id !== id) return e; updated = { ...e, silinmis: false as const, silinmeTarihi: undefined }; return updated; }));
    if (updated) void saveToDb('ekipmanlar', updated as unknown as { id: string } & Record<string, unknown>, true).catch(err => onSaveErrorRef.current?.(`Ekipman geri yükleme hatası: ${err instanceof Error ? err.message : String(err)}`));
  }, [setEkipmanlar, saveToDb]);

  const ekipmanlarRef = useRef<Ekipman[]>([]);
  useEffect(() => { ekipmanlarRef.current = ekipmanlar; }, [ekipmanlar]);
  const permanentDeleteEkipman = useCallback(async (id: string) => {
    const snapshot = ekipmanlarRef.current;
    ownDeletesRef.current.add(id);
    _setEkipmanlar(prev => prev.filter(e => e.id !== id));
    try { await dbDelete('ekipmanlar', id); } catch (err) { ownDeletesRef.current.delete(id); _setEkipmanlar(snapshot); onSaveErrorRef.current?.(`Kalıcı silme hatası (ekipmanlar): ${err instanceof Error ? err.message : String(err)}`); throw err; }
  }, []);

  const permanentDeleteEkipmanMany = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const snapshot = ekipmanlarRef.current;
    ids.forEach(id => ownDeletesRef.current.add(id));
    _setEkipmanlar(prev => prev.filter(e => !ids.includes(e.id)));
    try { await dbDeleteMany('ekipmanlar', ids); } catch (err) { ids.forEach(id => ownDeletesRef.current.delete(id)); _setEkipmanlar(snapshot); onSaveErrorRef.current?.(`Kalıcı silme hatası (ekipmanlar): ${err instanceof Error ? err.message : String(err)}`); throw err; }
  }, []);

  // ──────── GÖREV — stub only (real impl in useGorevStore) ────────
  // These stubs exist only to satisfy StoreType interface consumers that may
  // call them before AppContext overrides them. They are effectively dead code.
  const addGorev = useCallback((g: Omit<Gorev, 'id' | 'olusturmaTarihi'>): Gorev => {
    const newG: Gorev = { ...g, id: genId(), olusturmaTarihi: new Date().toISOString() };
    console.warn('[ISG] useStore.addGorev called — should use useGorevStore via AppContext');
    return newG;
  }, []);
  const updateGorev = useCallback((_id: string, _updates: Partial<Gorev>) => {
    console.warn('[ISG] useStore.updateGorev called — should use useGorevStore via AppContext');
  }, []);
  const deleteGorev = useCallback((_id: string) => {
    console.warn('[ISG] useStore.deleteGorev called — should use useGorevStore via AppContext');
  }, []);
  const restoreGorev = useCallback((_id: string) => {
    console.warn('[ISG] useStore.restoreGorev called — should use useGorevStore via AppContext');
  }, []);
  const permanentDeleteGorev = useCallback(async (_id: string) => {
    console.warn('[ISG] useStore.permanentDeleteGorev called — should use useGorevStore via AppContext');
  }, []);

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
    setTutanaklar(prev => [newT, ...prev]);
    void saveToDb('tutanaklar', newT as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('tutanak_created', 'Tutanaklar', id, newT.baslik, `${newT.tutanakNo} - ${newT.baslik} tutanağı oluşturuldu.`);
    return newT;
  }, [setTutanaklar, saveToDb]);

  const updateTutanak = useCallback((id: string, updates: Partial<Tutanak>) => {
    const { dosyaVeri: _ignored, ...rest } = updates as Partial<Tutanak> & { dosyaVeri?: string };
    let updated: Tutanak | null = null;
    setTutanaklar(prev => prev.map(t => { if (t.id !== id) return t; updated = { ...t, ...rest, guncellemeTarihi: new Date().toISOString() }; return updated; }));
    if (updated) void saveToDb('tutanaklar', updated as unknown as { id: string } & Record<string, unknown>);
  }, [setTutanaklar, saveToDb]);

  const deleteTutanak = useCallback((id: string) => {
    let updated: Tutanak | null = null;
    setTutanaklar(prev => prev.map(t => { if (t.id !== id) return t; updated = { ...t, silinmis: true as const, silinmeTarihi: new Date().toISOString() }; return updated; }));
    if (updated) void saveToDb('tutanaklar', updated as unknown as { id: string } & Record<string, unknown>);
    logFnRef.current?.('tutanak_deleted', 'Tutanaklar', id, undefined, 'Tutanak silindi.');
  }, [setTutanaklar, saveToDb]);

  const restoreTutanak = useCallback((id: string) => {
    let updated: Tutanak | null = null;
    setTutanaklar(prev => prev.map(t => { if (t.id !== id) return t; updated = { ...t, silinmis: false as const, silinmeTarihi: undefined }; return updated; }));
    if (updated) void saveToDb('tutanaklar', updated as unknown as { id: string } & Record<string, unknown>, true).catch(err => onSaveErrorRef.current?.(`Tutanak geri yükleme hatası: ${err instanceof Error ? err.message : String(err)}`));
  }, [setTutanaklar, saveToDb]);

  const tutanaklarRef = useRef<Tutanak[]>([]);
  useEffect(() => { tutanaklarRef.current = tutanaklar; }, [tutanaklar]);
  const permanentDeleteTutanak = useCallback(async (id: string) => {
    const snapshot = tutanaklarRef.current;
    ownDeletesRef.current.add(id);
    _setTutanaklar(prev => prev.filter(t => t.id !== id));
    try { await dbDelete('tutanaklar', id); } catch (err) { ownDeletesRef.current.delete(id); _setTutanaklar(snapshot); onSaveErrorRef.current?.(`Kalıcı silme hatası (tutanaklar): ${err instanceof Error ? err.message : String(err)}`); throw err; }
  }, []);

  // ──────── İŞ İZNİ ────────
  const addIsIzni = useCallback(async (iz: Omit<IsIzni, 'id' | 'izinNo' | 'olusturmaTarihi' | 'guncellemeTarihi'>) => {
    const now = new Date().toISOString();
    const id = genId();
    const rpcNo = await generateRecordNoFromDB('is_izni');
    const izinNo = rpcNo ?? generateIsIzniNo(isIzRef.current);
    const newIz: IsIzni = { ...iz, id, izinNo, olusturmaTarihi: now, guncellemeTarihi: now };
    setIsIzinleri(prev => [newIz, ...prev]);
    await saveToDb('is_izinleri', newIz as unknown as { id: string } & Record<string, unknown>, true);
    logFnRef.current?.('is_izni_created', 'İş İzinleri', id, izinNo, `${izinNo} iş izni oluşturuldu.`);
    return newIz;
  }, [setIsIzinleri, saveToDb]);

  const updateIsIzni = useCallback(async (id: string, updates: Partial<IsIzni>): Promise<void> => {
    let updated: IsIzni | null = null;
    let snapshot: IsIzni | null = null;
    setIsIzinleri(prev => prev.map(iz => { if (iz.id !== id) return iz; snapshot = iz; updated = { ...iz, ...updates, guncellemeTarihi: new Date().toISOString() }; return updated; }));
    if (updated) {
      const { rows, error: updateErr } = await updateDirectInDb('is_izinleri', id, { data: updated }, true);
      if (updateErr) {
        if (snapshot) setIsIzinleri(prev => prev.map(iz => iz.id === id ? snapshot! : iz));
        throw new Error(updateErr.includes('row-level security') ? `Yetki hatası: Bu işlem için yetkiniz yok. (${updateErr})` : updateErr);
      }
      if (rows === 0) {
        if (snapshot) setIsIzinleri(prev => prev.map(iz => iz.id === id ? snapshot! : iz));
        throw new Error('İş izni güncellenemedi. Kayıt bulunamadı.');
      }
    }
    logFnRef.current?.('is_izni_updated', 'İş İzinleri', id, updates.izinNo, 'İş izni güncellendi.');
  }, [setIsIzinleri, updateDirectInDb]);

  const deleteIsIzni = useCallback((id: string) => {
    const now = new Date().toISOString();
    const current = isIzRef.current.find(iz => iz.id === id);
    if (!current) return;
    const updated: IsIzni = { ...current, silinmis: true as const, silinmeTarihi: now };
    setIsIzinleri(prev => prev.map(iz => iz.id === id ? updated : iz));
    // Use saveToDb which sets deleted_at correctly from silinmis flag
    void saveToDb('is_izinleri', updated as unknown as { id: string } & Record<string, unknown>).catch(() => {
      setIsIzinleri(prev => prev.map(iz => iz.id === id ? current : iz));
    });
    logFnRef.current?.('is_izni_deleted', 'İş İzinleri', id, undefined, 'İş izni silindi.');
  }, [setIsIzinleri, saveToDb]);

  const restoreIsIzni = useCallback((id: string) => {
    const current = isIzRef.current.find(iz => iz.id === id);
    if (!current) return;
    const updated: IsIzni = { ...current, silinmis: false as const, silinmeTarihi: undefined };
    setIsIzinleri(prev => prev.map(iz => iz.id === id ? updated : iz));
    void saveToDb('is_izinleri', updated as unknown as { id: string } & Record<string, unknown>, true).catch(err => {
      setIsIzinleri(prev => prev.map(iz => iz.id === id ? current : iz));
      onSaveErrorRef.current?.(`İş izni geri yükleme hatası: ${err instanceof Error ? err.message : String(err)}`);
    });
  }, [setIsIzinleri, saveToDb]);

  const isIzinleriRef = useRef<IsIzni[]>([]);
  useEffect(() => { isIzinleriRef.current = isIzinleri; }, [isIzinleri]);
  const permanentDeleteIsIzni = useCallback(async (id: string) => {
    const snapshot = isIzinleriRef.current;
    ownDeletesRef.current.add(id);
    _setIsIzinleri(prev => prev.filter(iz => iz.id !== id));
    try { await dbDelete('is_izinleri', id); logFnRef.current?.('is_izni_perm_deleted', 'İş İzinleri', id, undefined, 'İş izni kalıcı silindi.'); } catch (err) { ownDeletesRef.current.delete(id); _setIsIzinleri(snapshot); onSaveErrorRef.current?.(`Kalıcı silme hatası (is_izinleri): ${err instanceof Error ? err.message : String(err)}`); throw err; }
  }, []);

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

  const getPersonelFoto = useCallback((personelId: string): string | null => {
    // fotoUrl is read directly from personeller state — set via setPersonelFoto
    return null; // caller should use personeller.find(p => p.id === personelId)?.fotoUrl
  }, []);

  // ──────── CURRENT USER ────────
  const updateCurrentUser = useCallback((updates: Partial<CurrentUser>) => {
    setCurrentUser(prev => ({ ...prev, ...updates }));
  }, []);

  // ── gorevler is always [] here — AppContext overrides with useGorevStore data ──
  const gorevler: Gorev[] = [];

  return {
    firmalar, personeller, evraklar, egitimler, muayeneler,
    uygunsuzluklar, ekipmanlar,
    // gorevler intentionally empty — overridden by AppContext via useGorevStore
    gorevler,
    tutanaklar, isIzinleri, currentUser,
    dataLoading, pageLoading, partialLoading, realtimeStatus, isSaving: false,
    refreshAllData,
    fetchModuleTables,
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
    // expose deleteFromDb / deleteManyFromDb for internal use
    deleteFromDb, deleteManyFromDb,
  };
}

export type StoreType = ReturnType<typeof useStore>;
