import {
  createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { useStore, type StoreType } from './useStore';
import { useAuth } from './AuthContext';
import { useOrganization } from '../hooks/useOrganization';
import { logActivity } from '../utils/activityLog';
import { supabase } from '../lib/supabase';
import type { Toast, Firma } from '../types';
import { useNotificationStore } from './useNotificationStore';
import { useGorevStore } from './useGorevStore';

export type { Bildirim } from './useNotificationStore';
export type Theme = 'dark' | 'light';

export interface OrgInfo {
  id: string;
  name: string;
  invite_code: string;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
  displayName?: string;
  email?: string;
  orgType: 'firma' | 'osgb';
  osgbRole?: 'osgb_admin' | 'gezici_uzman' | 'isyeri_hekimi' | null;
  activeFirmIds?: string[];
}

import type { Bildirim } from './useNotificationStore';

interface AppContextType extends StoreType {
  fetchTable: (table: string) => Promise<void>;
  pageLoading: boolean;
  partialLoading: boolean;
  realtimeStatus: 'connected' | 'connecting' | 'disconnected';
  toasts: Toast[];
  addToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;
  activeModule: string;
  setActiveModule: (m: string) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  quickCreate: string | null;
  setQuickCreate: (v: string | null) => void;
  theme: Theme;
  toggleTheme: () => void;
  bildirimler: Bildirim[];
  okunmamisBildirimSayisi: number;
  bildirimOku: (id: string) => void;
  tumunuOku: () => void;
  ekipmanKontrolBildirimi: (ekipmanAd: string, ekipmanId: string, durum: string, gecikmisDi: boolean) => void;
  isIzniBildirimi: (izinNo: string, izinId: string, tip: 'onaylandi' | 'reddedildi', sahaNotu?: string) => void;
  org: OrgInfo | null;
  orgLoading: boolean;
  orgError: string | null;
  mustChangePassword: boolean;
  clearMustChangePassword: () => Promise<void>;
  createOrg: (name: string, userId: string) => Promise<{ error: string | null }>;
  joinOrg: (code: string) => Promise<{ error: string | null }>;
  regenerateInviteCode: () => Promise<{ error: string | null; newCode?: string }>;
  refetchOrg: () => Promise<void>;
  logAction: (actionType: string, module: string, recordId: string, recordName?: string, description?: string) => void;
  restoreGorev: (id: string) => void;
  permanentDeleteGorev: (id: string) => Promise<void>;
  refreshData: () => Promise<void>;
  isSwitching: boolean;
  switchActiveFirma: (firmaId: string) => Promise<{ error: string | null }>;
  fetchActiveFirmNames: () => Promise<{ id: string; name: string }[]>;
}

const AppContext = createContext<AppContextType | null>(null);

function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem('isg_theme') as Theme | null;
    return saved === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function getUserDisplayName(user: User | null): string {
  if (!user) return 'Kullanıcı';
  const fullName = user.user_metadata?.full_name as string | undefined;
  if (fullName) return fullName;
  if (user.email) return user.email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return 'Kullanıcı';
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const {
    org: rawOrg,
    loading: orgLoading,
    loadError,
    createOrg,
    joinOrg,
    regenerateInviteCode,
    refetch: refetchOrg,
    clearMustChangePassword: clearMustChangePw,
    isSwitching,
    orgIdRef,
    switchActiveFirma,
    fetchActiveFirmNames,
  } = useOrganization(user);

  const org = useMemo<OrgInfo | null>(() => {
    if (!rawOrg) return null;
    return {
      ...rawOrg,
      displayName: rawOrg.displayName || getUserDisplayName(user),
      email: rawOrg.email || user?.email,
    };
  }, [rawOrg, user]);

  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Math.random().toString(36).substring(2);
    const toast: Toast = { id, message, type };
    setToasts(prev => [...prev, toast]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const orgRef = useRef(org);
  const userRef = useRef(user);
  useEffect(() => { orgRef.current = org; }, [org]);
  useEffect(() => { userRef.current = user; }, [user]);

  const logAction = useCallback((
    actionType: string, module: string, recordId: string,
    recordName?: string, description?: string,
  ) => {
    const currentOrg = orgRef.current;
    const currentUser = userRef.current;
    if (!currentUser || !currentOrg) return;
    logActivity({
      organizationId: currentOrg.id,
      userId: currentUser.id,
      userEmail: currentUser.email ?? '',
      userName: currentOrg.displayName || getUserDisplayName(currentUser),
      userRole: currentOrg.role,
      actionType,
      module,
      recordId,
      recordName,
      description,
    });
  }, []);

  const loginLoggedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user || !org) return;
    if (loginLoggedRef.current === user.id) return;
    loginLoggedRef.current = user.id;
    logActivity({
      organizationId: org.id,
      userId: user.id,
      userEmail: user.email ?? '',
      userName: org.displayName || getUserDisplayName(user),
      userRole: org.role,
      actionType: 'user_login',
      module: 'Sistem',
      recordId: user.id,
      description: 'Sisteme giriş yapıldı.',
    });
  }, [user?.id, org?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const addToastRef = useRef(addToast);
  useEffect(() => { addToastRef.current = addToast; }, [addToast]);

  const onSaveErrorCb = useCallback((msg: string) => {
    addToastRef.current(msg, 'error');
  }, []);

  const onRemoteChangeCb = useCallback((module: string) => {
    addToastRef.current(
      `${module} modülünde başka bir kullanıcı değişiklik yaptı — veriler güncellendi.`,
      'info',
    );
  }, []);

  const store = useStore(
    org?.id ?? null,
    logAction,
    onSaveErrorCb,
    user?.id,
    orgLoading,
    onRemoteChangeCb,
    isSwitching,
    orgIdRef,
  );

  // ── Gezici uzman: extra firma verileri ──────────────────────────────────
  const [geziciFirmalar, setGeziciFirmalar] = useState<Firma[]>([]);

  type ExtraFirmaVeriMap = Record<string, {
    personeller: import('../types').Personel[];
    evraklar: import('../types').Evrak[];
    egitimler: import('../types').Egitim[];
    muayeneler: import('../types').Muayene[];
    uygunsuzluklar: import('../types').Uygunsuzluk[];
    ekipmanlar: import('../types').Ekipman[];
    tutanaklar: import('../types').Tutanak[];
    isIzinleri: import('../types').IsIzni[];
  }>;
  const [extraFirmaVeriMap, setExtraFirmaVeriMap] = useState<ExtraFirmaVeriMap>({});

  const flattenExtraVeriler = useCallback((map: ExtraFirmaVeriMap) => {
    const result = {
      personeller: [] as import('../types').Personel[],
      evraklar: [] as import('../types').Evrak[],
      egitimler: [] as import('../types').Egitim[],
      muayeneler: [] as import('../types').Muayene[],
      uygunsuzluklar: [] as import('../types').Uygunsuzluk[],
      ekipmanlar: [] as import('../types').Ekipman[],
      tutanaklar: [] as import('../types').Tutanak[],
      isIzinleri: [] as import('../types').IsIzni[],
    };
    Object.values(map).forEach(v => {
      result.personeller.push(...v.personeller);
      result.evraklar.push(...v.evraklar);
      result.egitimler.push(...v.egitimler);
      result.muayeneler.push(...v.muayeneler);
      result.uygunsuzluklar.push(...v.uygunsuzluklar);
      result.ekipmanlar.push(...v.ekipmanlar);
      result.tutanaklar.push(...v.tutanaklar);
      result.isIzinleri.push(...v.isIzinleri);
    });
    return result;
  }, []);

  const [extraFirmaVeriler, setExtraFirmaVeriler] = useState(() => flattenExtraVeriler({}));

  useEffect(() => {
    if (org?.osgbRole !== 'gezici_uzman') {
      setGeziciFirmalar([]);
      setExtraFirmaVeriMap({});
      setExtraFirmaVeriler(flattenExtraVeriler({}));
      return;
    }
    const allFirmIds = org.activeFirmIds && org.activeFirmIds.length > 0
      ? org.activeFirmIds
      : org.id ? [org.id] : [];
    if (allFirmIds.length === 0) { setGeziciFirmalar([]); return; }

    supabase.from('organizations').select('id, name').in('id', allFirmIds).then(async ({ data: orgData }) => {
      if (!orgData || orgData.length === 0) return;
      const tehlikeMap: Record<string, string> = {};
      try {
        const { data: profiles } = await supabase
          .from('firma_profiles')
          .select('organization_id, tehlike_sinifi')
          .in('organization_id', allFirmIds);
        if (profiles) profiles.forEach((p: Record<string, string>) => {
          if (p.tehlike_sinifi) tehlikeMap[p.organization_id] = p.tehlike_sinifi;
        });
      } catch { /* ignore */ }
      setGeziciFirmalar(orgData.map(d => ({
        id: d.id, ad: d.name, yetkiliKisi: '', telefon: '', email: '', adres: '',
        sektor: '', notlar: '',
        tehlikeSinifi: (tehlikeMap[d.id] as import('../types').TehlikeSinifi) || 'Az Tehlikeli',
        durum: 'Aktif' as import('../types').FirmaStatus,
        silinmis: false,
        olusturmaTarihi: new Date().toISOString(),
        guncellemeTarihi: new Date().toISOString(),
      } as Firma)));
    });

    const extraIds = allFirmIds.filter(id => id !== org.id);
    if (extraIds.length === 0) return;

    // Paginated fetch for gezici uzman extra firms — uses fetchAllRows to bypass Supabase 1000-row limit
    const fetchTableForOrg = async (table: string, orgId: string): Promise<unknown[]> => {
      const { data } = await (await import('./storeHelpers')).fetchAllRows(table, orgId);
      return (data ?? []).map(r => r.data as unknown);
    };

    Promise.all(extraIds.map(async (firmId) => {
      const [personeller, evraklar, egitimler, muayeneler, uygunsuzluklar, ekipmanlar, tutanaklar, isIzinleri] = await Promise.all([
        fetchTableForOrg('personeller', firmId),
        fetchTableForOrg('evraklar', firmId),
        fetchTableForOrg('egitimler', firmId),
        fetchTableForOrg('muayeneler', firmId),
        fetchTableForOrg('uygunsuzluklar', firmId),
        fetchTableForOrg('ekipmanlar', firmId),
        fetchTableForOrg('tutanaklar', firmId),
        fetchTableForOrg('is_izinleri', firmId),
      ]);
      return { firmId, personeller, evraklar, egitimler, muayeneler, uygunsuzluklar, ekipmanlar, tutanaklar, isIzinleri };
    })).then(results => {
      const newMap: ExtraFirmaVeriMap = {};
      results.forEach(r => {
        newMap[r.firmId] = {
          personeller: r.personeller as import('../types').Personel[],
          evraklar: r.evraklar as import('../types').Evrak[],
          egitimler: r.egitimler as import('../types').Egitim[],
          muayeneler: r.muayeneler as import('../types').Muayene[],
          uygunsuzluklar: r.uygunsuzluklar as import('../types').Uygunsuzluk[],
          ekipmanlar: r.ekipmanlar as import('../types').Ekipman[],
          tutanaklar: r.tutanaklar as import('../types').Tutanak[],
          isIzinleri: r.isIzinleri as import('../types').IsIzni[],
        };
      });
      setExtraFirmaVeriMap(newMap);
      setExtraFirmaVeriler(flattenExtraVeriler(newMap));
    });
  }, [org?.osgbRole, org?.id, org?.activeFirmIds, flattenExtraVeriler]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Gezici uzman: realtime subscription ────────────────────────────────
  useEffect(() => {
    if (org?.osgbRole !== 'gezici_uzman') return;
    const extraIds = (org.activeFirmIds ?? []).filter(id => id !== org.id);
    if (extraIds.length === 0) return;

    const TABLES = ['personeller', 'evraklar', 'egitimler', 'muayeneler', 'uygunsuzluklar', 'ekipmanlar', 'tutanaklar', 'is_izinleri'];
    type TableKey = 'personeller' | 'evraklar' | 'egitimler' | 'muayeneler' | 'uygunsuzluklar' | 'ekipmanlar' | 'tutanaklar' | 'isIzinleri';
    const TABLE_KEY_MAP: Record<string, TableKey> = {
      personeller: 'personeller', evraklar: 'evraklar', egitimler: 'egitimler',
      muayeneler: 'muayeneler', uygunsuzluklar: 'uygunsuzluklar', ekipmanlar: 'ekipmanlar',
      tutanaklar: 'tutanaklar', is_izinleri: 'isIzinleri',
    };

    const channels = extraIds.map(firmId => {
      const channelName = `gezici_extra_${firmId}_${Date.now()}`;
      let ch = supabase.channel(channelName);
      TABLES.forEach(table => {
        ch = ch.on(
          'postgres_changes' as Parameters<typeof ch.on>[0],
          { event: '*', schema: 'public', table, filter: `organization_id=eq.${firmId}` } as Parameters<typeof ch.on>[1],
          (payload: { eventType: string; new: Record<string, unknown>; old?: Record<string, unknown> }) => {
            const recordId = (payload.new?.id ?? payload.old?.id) as string | undefined;
            if (!recordId) return;
            const tableKey = TABLE_KEY_MAP[table];
            if (!tableKey) return;
            const newData = payload.new?.data as Record<string, unknown> | undefined;
            const deletedAt = payload.new?.deleted_at;
            const isDeletion = payload.eventType === 'DELETE' || !!deletedAt;
            setExtraFirmaVeriMap(prev => {
              const firmData = prev[firmId] ?? {
                personeller: [], evraklar: [], egitimler: [], muayeneler: [],
                uygunsuzluklar: [], ekipmanlar: [], tutanaklar: [], isIzinleri: [],
              };
              type AnyRecord = { id: string };
              const currentList = (firmData[tableKey] as AnyRecord[]);
              let updatedList: AnyRecord[];
              if (isDeletion) {
                updatedList = currentList.filter(r => r.id !== recordId);
              } else if (newData) {
                const record = { ...newData, id: recordId } as AnyRecord;
                const idx = currentList.findIndex(r => r.id === recordId);
                updatedList = idx === -1 ? [record, ...currentList] : currentList.map((r, i) => i === idx ? record : r);
              } else {
                return prev;
              }
              const updatedFirmData = { ...firmData, [tableKey]: updatedList };
              const newMap = { ...prev, [firmId]: updatedFirmData };
              setExtraFirmaVeriler(flattenExtraVeriler(newMap));
              return newMap;
            });
          }
        ) as typeof ch;
      });
      ch.subscribe();
      return ch;
    });

    return () => { channels.forEach(ch => supabase.removeChannel(ch)); };
  }, [org?.osgbRole, org?.id, org?.activeFirmIds, flattenExtraVeriler]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── fetchTable ──────────────────────────────────────────────────────────
  const fetchTable = useCallback(async (table: string) => {
    const orgId = org?.id;
    if (!orgId) return;
    const map: Record<string, (id: string) => Promise<void>> = {
      firmalar: store.fetchFirmalar, personeller: store.fetchPersoneller,
      evraklar: store.fetchEvraklar, egitimler: store.fetchEgitimler,
      muayeneler: store.fetchMuayeneler, uygunsuzluklar: store.fetchUygunsuzluklar,
      ekipmanlar: store.fetchEkipmanlar, gorevler: store.fetchGorevler,
      tutanaklar: store.fetchTutanaklar, is_izinleri: store.fetchIsIzinleri,
    };
    const fn = map[table];
    if (fn) await fn(orgId);
    else console.warn(`[ISG] fetchTable: unknown table "${table}"`);
  }, [org?.id, store.fetchFirmalar, store.fetchPersoneller, store.fetchEvraklar, store.fetchEgitimler, store.fetchMuayeneler, store.fetchUygunsuzluklar, store.fetchEkipmanlar, store.fetchGorevler, store.fetchTutanaklar, store.fetchIsIzinleri]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Module / UI state ───────────────────────────────────────────────────
  const [activeModule, setActiveModuleState] = useState<string>(() => {
    try { return localStorage.getItem('isg_active_module') || 'dashboard'; } catch { return 'dashboard'; }
  });
  const setActiveModule = useCallback((m: string) => {
    setActiveModuleState(m);
    try { localStorage.setItem('isg_active_module', m); } catch { /* ignore */ }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [quickCreate, setQuickCreate] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    if (!user) return;
    const metaName = user.user_metadata?.full_name as string | undefined;
    const metaRole = user.user_metadata?.role as string | undefined;
    const resolvedName = metaName || getUserDisplayName(user);
    const needsUpdate =
      store.currentUser.email !== user.email ||
      (resolvedName && store.currentUser.ad !== resolvedName) ||
      (metaRole && store.currentUser.rol !== metaRole);
    if (needsUpdate) {
      store.updateCurrentUser({ email: user.email, ad: resolvedName, ...(metaRole ? { rol: metaRole } : {}) });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.email, user?.user_metadata?.full_name, user?.user_metadata?.role]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') root.classList.add('light-mode');
    else root.classList.remove('light-mode');
    localStorage.setItem('isg_theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  // ── Merged data (gezici uzman: all firms merged) ────────────────────────
  const mergedFirmalar = useMemo<Firma[]>(() => {
    if (org?.osgbRole !== 'gezici_uzman') return store.firmalar;
    if (geziciFirmalar.length === 0) return store.firmalar;
    const mevcutIds = new Set(store.firmalar.map(f => f.id));
    const yeniFirmalar = geziciFirmalar.filter(f => !mevcutIds.has(f.id));
    return [...yeniFirmalar, ...store.firmalar];
  }, [org?.osgbRole, geziciFirmalar, store.firmalar]);

  const isGezici = org?.osgbRole === 'gezici_uzman';

  const mergedPersoneller = useMemo(() =>
    isGezici && extraFirmaVeriler.personeller.length > 0
      ? [...store.personeller, ...extraFirmaVeriler.personeller.filter(e => !store.personeller.some(s => s.id === e.id))]
      : store.personeller,
  [isGezici, store.personeller, extraFirmaVeriler.personeller]);

  const mergedEvraklar = useMemo(() =>
    isGezici && extraFirmaVeriler.evraklar.length > 0
      ? [...store.evraklar, ...extraFirmaVeriler.evraklar.filter(e => !store.evraklar.some(s => s.id === e.id))]
      : store.evraklar,
  [isGezici, store.evraklar, extraFirmaVeriler.evraklar]);

  const mergedEgitimler = useMemo(() =>
    isGezici && extraFirmaVeriler.egitimler.length > 0
      ? [...store.egitimler, ...extraFirmaVeriler.egitimler.filter(e => !store.egitimler.some(s => s.id === e.id))]
      : store.egitimler,
  [isGezici, store.egitimler, extraFirmaVeriler.egitimler]);

  const mergedMuayeneler = useMemo(() =>
    isGezici && extraFirmaVeriler.muayeneler.length > 0
      ? [...store.muayeneler, ...extraFirmaVeriler.muayeneler.filter(e => !store.muayeneler.some(s => s.id === e.id))]
      : store.muayeneler,
  [isGezici, store.muayeneler, extraFirmaVeriler.muayeneler]);

  const mergedUygunsuzluklar = useMemo(() =>
    isGezici && extraFirmaVeriler.uygunsuzluklar.length > 0
      ? [...store.uygunsuzluklar, ...extraFirmaVeriler.uygunsuzluklar.filter(e => !store.uygunsuzluklar.some(s => s.id === e.id))]
      : store.uygunsuzluklar,
  [isGezici, store.uygunsuzluklar, extraFirmaVeriler.uygunsuzluklar]);

  const mergedEkipmanlar = useMemo(() =>
    isGezici && extraFirmaVeriler.ekipmanlar.length > 0
      ? [...store.ekipmanlar, ...extraFirmaVeriler.ekipmanlar.filter(e => !store.ekipmanlar.some(s => s.id === e.id))]
      : store.ekipmanlar,
  [isGezici, store.ekipmanlar, extraFirmaVeriler.ekipmanlar]);

  const mergedTutanaklar = useMemo(() =>
    isGezici && extraFirmaVeriler.tutanaklar.length > 0
      ? [...store.tutanaklar, ...extraFirmaVeriler.tutanaklar.filter(e => !store.tutanaklar.some(s => s.id === e.id))]
      : store.tutanaklar,
  [isGezici, store.tutanaklar, extraFirmaVeriler.tutanaklar]);

  const mergedIsIzinleri = useMemo(() =>
    isGezici && extraFirmaVeriler.isIzinleri.length > 0
      ? [...store.isIzinleri, ...extraFirmaVeriler.isIzinleri.filter(e => !store.isIzinleri.some(s => s.id === e.id))]
      : store.isIzinleri,
  [isGezici, store.isIzinleri, extraFirmaVeriler.isIzinleri]);

  // ── Gorev store (isolated) ──────────────────────────────────────────────
  const gorevStore = useGorevStore({
    organizationId: org?.id ?? null,
    userId: user?.id,
    orgLoading,
    isSwitching,
    onSaveError: onSaveErrorCb,
    logFn: logAction,
  });

  // ── Notification store (isolated) — MUST be after merged arrays ─────────
  const {
    bildirimler,
    okunmamisBildirimSayisi,
    bildirimOku,
    tumunuOku,
    ekipmanKontrolBildirimi,
    isIzniBildirimi,
  } = useNotificationStore({
    evraklar: mergedEvraklar,
    ekipmanlar: mergedEkipmanlar,
    egitimler: mergedEgitimler,
    muayeneler: mergedMuayeneler,
    personeller: mergedPersoneller,
    firmalar: mergedFirmalar,
  });

  const clearMustChangePassword = useCallback(async () => {
    await clearMustChangePw();
  }, [clearMustChangePw]);

  return (
    <AppContext.Provider value={{
      ...store,
      // ── Gorev store override ──
      gorevler: gorevStore.gorevler,
      addGorev: gorevStore.addGorev,
      updateGorev: gorevStore.updateGorev,
      deleteGorev: gorevStore.deleteGorev,
      restoreGorev: gorevStore.restoreGorev,
      permanentDeleteGorev: gorevStore.permanentDeleteGorev,
      fetchGorevler: gorevStore.fetchGorevler,
      firmalar: mergedFirmalar,
      personeller: mergedPersoneller,
      evraklar: mergedEvraklar,
      egitimler: mergedEgitimler,
      muayeneler: mergedMuayeneler,
      uygunsuzluklar: mergedUygunsuzluklar,
      ekipmanlar: mergedEkipmanlar,
      tutanaklar: mergedTutanaklar,
      isIzinleri: mergedIsIzinleri,
      toasts, addToast, removeToast,
      activeModule, setActiveModule,
      sidebarCollapsed, setSidebarCollapsed,
      quickCreate, setQuickCreate,
      theme, toggleTheme,
      bildirimler, okunmamisBildirimSayisi, bildirimOku, tumunuOku, ekipmanKontrolBildirimi, isIzniBildirimi,
      org, orgLoading, orgError: loadError,
      mustChangePassword: org?.mustChangePassword ?? false,
      clearMustChangePassword,
      createOrg, joinOrg, regenerateInviteCode, refetchOrg,
      logAction, fetchTable,
      refreshData: store.refreshAllData,
      pageLoading: store.pageLoading,
      partialLoading: store.partialLoading,
      realtimeStatus: store.realtimeStatus,
      isSwitching, switchActiveFirma, fetchActiveFirmNames,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
