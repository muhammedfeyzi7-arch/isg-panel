import {
  createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { useStore, type StoreType } from './useStore';
import { useAuth } from './AuthContext';
import { useOrganization } from '../hooks/useOrganization';
import { logActivity } from '../utils/activityLog';
import type { Toast } from '../types';

export interface Bildirim {
  id: string;
  tip: 'evrak_surecek' | 'evrak_dolmus' | 'ekipman_kontrol' | 'egitim_surecek' | 'saglik_surecek' | 'ekipman_kontrol_yapildi' | 'is_izni_onaylandi' | 'is_izni_reddedildi';
  mesaj: string;
  detay: string;
  tarih: string;
  okundu: boolean;
  kalanGun: number;
  module: string;
  recordId?: string;
}

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
  osgbRole?: 'osgb_admin' | 'gezici_uzman' | null;
}

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
  refreshData: () => Promise<void>;
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
  }, [user?.id, org?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

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
  );

  const fetchTable = useCallback(async (table: string) => {
    const orgId = org?.id;
    if (!orgId) return;
    const map: Record<string, (id: string) => Promise<void>> = {
      firmalar:       store.fetchFirmalar,
      personeller:    store.fetchPersoneller,
      evraklar:       store.fetchEvraklar,
      egitimler:      store.fetchEgitimler,
      muayeneler:     store.fetchMuayeneler,
      uygunsuzluklar: store.fetchUygunsuzluklar,
      ekipmanlar:     store.fetchEkipmanlar,
      gorevler:       store.fetchGorevler,
      tutanaklar:     store.fetchTutanaklar,
      is_izinleri:    store.fetchIsIzinleri,
    };
    const fn = map[table];
    if (fn) await fn(orgId);
    else console.warn(`[ISG] fetchTable: unknown table "${table}"`);
  }, [org?.id, store.fetchFirmalar, store.fetchPersoneller, store.fetchEvraklar, store.fetchEgitimler, store.fetchMuayeneler, store.fetchUygunsuzluklar, store.fetchEkipmanlar, store.fetchGorevler, store.fetchTutanaklar, store.fetchIsIzinleri]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const [kontrolBildirimleri, setKontrolBildirimleri] = useState<Bildirim[]>([]);

  const isIzniBildirimi = useCallback((
    izinNo: string, izinId: string, tip: 'onaylandi' | 'reddedildi', sahaNotu?: string,
  ) => {
    const id = `is_izni_${tip}_${izinId}_${Date.now()}`;
    const now = new Date().toISOString().split('T')[0];
    const yeniBildirim: Bildirim = {
      id,
      tip: tip === 'onaylandi' ? 'is_izni_onaylandi' : 'is_izni_reddedildi',
      mesaj: tip === 'onaylandi' ? `İş izni onaylandı — ${izinNo}` : `İş izni reddedildi — ${izinNo}`,
      detay: sahaNotu ? `Saha notu: ${sahaNotu}` : tip === 'onaylandi' ? 'Sahada uygundur' : 'Uygun değil',
      tarih: now,
      okundu: false,
      kalanGun: 0,
      module: 'is-izinleri',
      recordId: izinId,
    };
    setKontrolBildirimleri(prev => [yeniBildirim, ...prev].slice(0, 30));
    setTimeout(() => {
      setKontrolBildirimleri(prev => prev.map(b => b.id === id ? { ...b, okundu: true } : b));
    }, 60000);
  }, []);

  const ekipmanKontrolBildirimi = useCallback((
    ekipmanAd: string, ekipmanId: string, durum: string, gecikmisDi: boolean,
  ) => {
    const id = `kontrol_yapildi_${ekipmanId}_${Date.now()}`;
    const now = new Date().toISOString().split('T')[0];
    const yeniBildirim: Bildirim = {
      id,
      tip: 'ekipman_kontrol_yapildi',
      mesaj: gecikmisDi ? `${ekipmanAd} — Gecikmiş kontrol tamamlandı` : `${ekipmanAd} — Kontrol tamamlandı`,
      detay: `Durum: ${durum} · ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`,
      tarih: now,
      okundu: false,
      kalanGun: 0,
      module: 'ekipmanlar',
      recordId: ekipmanId,
    };
    setKontrolBildirimleri(prev => [yeniBildirim, ...prev].slice(0, 20));
    setTimeout(() => {
      setKontrolBildirimleri(prev => prev.map(b => b.id === id ? { ...b, okundu: true } : b));
    }, 30000);
  }, []);

  const [okunanlar, setOkunanlar] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('isg_okunan_bildirimler');
      return saved ? new Set<string>(JSON.parse(saved) as string[]) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

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
      store.updateCurrentUser({
        email: user.email,
        ad: resolvedName,
        ...(metaRole ? { rol: metaRole } : {}),
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.email, user?.user_metadata?.full_name, user?.user_metadata?.role]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light-mode');
    } else {
      root.classList.remove('light-mode');
    }
    localStorage.setItem('isg_theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const bildirimler = useMemo<Bildirim[]>(() => {
    const kontrolMerged = kontrolBildirimleri.map(b => ({
      ...b,
      okundu: b.okundu || okunanlar.has(b.id),
    }));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in30 = new Date(today.getTime() + 30 * 86400000);
    const result: Bildirim[] = [];

    const parseDate = (dateStr: string | null | undefined): Date | null => {
      if (!dateStr || !dateStr.trim()) return null;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const getDaysRemaining = (dateStr: string | null | undefined): number | null => {
      const d = parseDate(dateStr);
      if (!d) return null;
      return Math.ceil((d.getTime() - today.getTime()) / 86400000);
    };

    store.evraklar.forEach(e => {
      if (e.silinmis) return;
      const personel = e.personelId ? store.personeller.find(p => p.id === e.personelId) : null;
      const firma = store.firmalar.find(f => f.id === e.firmaId);
      const detayBase = `${personel ? personel.adSoyad + ' — ' : ''}${firma?.ad || ''}`;

      if (e.durum === 'Süre Dolmuş') {
        const d = parseDate(e.gecerlilikTarihi);
        const tarihBilgi = d ? `${d.toLocaleDateString('tr-TR')} tarihinde doldu` : 'Süresi dolmuş';
        result.push({ id: `evrak_dolmus_${e.id}`, tip: 'evrak_dolmus', mesaj: `${e.ad} evrakının süresi dolmuş`, detay: `${detayBase}${detayBase ? ' — ' : ''}${tarihBilgi}`, tarih: e.gecerlilikTarihi || new Date().toISOString().split('T')[0], okundu: okunanlar.has(`evrak_dolmus_${e.id}`), kalanGun: -1, module: 'evraklar', recordId: e.id });
        return;
      }
      if (e.durum === 'Eksik') {
        result.push({ id: `evrak_eksik_${e.id}`, tip: 'evrak_dolmus', mesaj: `${e.ad} evrakı eksik`, detay: `${detayBase}${detayBase ? ' — ' : ''}Evrak henüz yüklenmemiş`, tarih: new Date().toISOString().split('T')[0], okundu: okunanlar.has(`evrak_eksik_${e.id}`), kalanGun: -1, module: 'evraklar', recordId: e.id });
        return;
      }
      const d = parseDate(e.gecerlilikTarihi);
      if (!d) return;
      const kalanGun = getDaysRemaining(e.gecerlilikTarihi)!;
      if (d >= today && d <= in30) {
        result.push({ id: `evrak_surecek_${e.id}`, tip: 'evrak_surecek', mesaj: `${e.ad} evrakının süresi yaklaşıyor`, detay: `${detayBase}${detayBase ? ' — ' : ''}${kalanGun === 0 ? 'Bugün dolacak!' : `${kalanGun} gün kaldı`}`, tarih: e.gecerlilikTarihi!, okundu: okunanlar.has(`evrak_surecek_${e.id}`), kalanGun, module: 'evraklar', recordId: e.id });
      } else if (d < today) {
        result.push({ id: `evrak_dolmus_${e.id}`, tip: 'evrak_dolmus', mesaj: `${e.ad} evrakının süresi dolmuş`, detay: `${detayBase}${detayBase ? ' — ' : ''}${d.toLocaleDateString('tr-TR')} tarihinde doldu`, tarih: e.gecerlilikTarihi!, okundu: okunanlar.has(`evrak_dolmus_${e.id}`), kalanGun, module: 'evraklar', recordId: e.id });
      }
    });

    store.ekipmanlar.forEach(ek => {
      if (ek.silinmis) return;
      const firma = store.firmalar.find(f => f.id === ek.firmaId);
      if (ek.durum === 'Uygun Değil') {
        result.push({ id: `ekipman_uygunsuz_${ek.id}`, tip: 'ekipman_kontrol', mesaj: `${ek.ad} — KRİTİK: Uygun Değil`, detay: `${firma?.ad ? firma.ad + ' — ' : ''}Ekipman uygunsuz olarak işaretlendi`, tarih: new Date().toISOString().split('T')[0], okundu: okunanlar.has(`ekipman_uygunsuz_${ek.id}`), kalanGun: -999, module: 'ekipmanlar', recordId: ek.id });
        return;
      }
      if (ek.durum === 'Bakımda') {
        result.push({ id: `ekipman_bakimda_${ek.id}`, tip: 'ekipman_kontrol', mesaj: `${ek.ad} bakımda`, detay: `${firma?.ad ? firma.ad + ' — ' : ''}Ekipman bakım sürecinde`, tarih: new Date().toISOString().split('T')[0], okundu: okunanlar.has(`ekipman_bakimda_${ek.id}`), kalanGun: -1, module: 'ekipmanlar', recordId: ek.id });
        return;
      }
      const d = parseDate(ek.sonrakiKontrolTarihi);
      if (!d) return;
      const kalanGun = getDaysRemaining(ek.sonrakiKontrolTarihi)!;
      if (kalanGun < 0) {
        result.push({ id: `ekipman_gecikti_${ek.id}`, tip: 'ekipman_kontrol', mesaj: `${ek.ad} kontrolü gecikti`, detay: `${firma?.ad ? firma.ad + ' — ' : ''}${Math.abs(kalanGun)} gün gecikti`, tarih: ek.sonrakiKontrolTarihi, okundu: okunanlar.has(`ekipman_gecikti_${ek.id}`), kalanGun, module: 'ekipmanlar', recordId: ek.id });
        return;
      }
      if (kalanGun > 60) return;
      result.push({ id: `ekipman_${ek.id}`, tip: 'ekipman_kontrol', mesaj: `${ek.ad} kontrolü yaklaşıyor`, detay: `${firma?.ad ? firma.ad + ' — ' : ''}${kalanGun === 0 ? 'Bugün kontrol edilmeli!' : `${kalanGun} gün kaldı`}`, tarih: ek.sonrakiKontrolTarihi, okundu: okunanlar.has(`ekipman_${ek.id}`), kalanGun, module: 'ekipmanlar', recordId: ek.id });
    });

    store.muayeneler.forEach(m => {
      if (m.silinmis) return;
      const tarihStr = m.sonrakiTarih || m.muayeneTarihi;
      const d = parseDate(tarihStr);
      if (!d) return;
      const kalanGun = getDaysRemaining(tarihStr)!;
      if (kalanGun < 0 || kalanGun > 60) return;
      const personel = store.personeller.find(p => p.id === m.personelId);
      result.push({ id: `saglik_${m.id}`, tip: 'saglik_surecek', mesaj: `${personel?.adSoyad || 'Personel'} muayene tarihi yaklaşıyor`, detay: `Periyodik Muayene — ${kalanGun === 0 ? 'Bugün!' : `${kalanGun} gün kaldı`}`, tarih: tarihStr!, okundu: okunanlar.has(`saglik_${m.id}`), kalanGun, module: 'muayeneler', recordId: m.id });
    });

    const sorted = result.sort((a, b) => a.kalanGun - b.kalanGun);
    return [...kontrolMerged, ...sorted];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.evraklar, store.ekipmanlar, store.egitimler, store.muayeneler, store.personeller, store.firmalar, okunanlar, kontrolBildirimleri]);

  const okunmamisBildirimSayisi = useMemo(
    () => bildirimler.filter(b => !b.okundu).length,
    [bildirimler],
  );

  const MAX_OKUNAN_IDS = 500;
  const persistOkunanlar = useCallback((ids: Set<string>) => {
    try {
      const arr = [...ids].slice(-MAX_OKUNAN_IDS);
      localStorage.setItem('isg_okunan_bildirimler', JSON.stringify(arr));
    } catch { /* ignore */ }
  }, []);

  const bildirimOku = useCallback((id: string) => {
    setOkunanlar(prev => {
      const next = new Set([...prev, id]);
      persistOkunanlar(next);
      return next;
    });
  }, [persistOkunanlar]);

  const tumunuOku = useCallback(() => {
    const ids = bildirimler.map(b => b.id);
    setOkunanlar(prev => {
      const next = new Set([...prev, ...ids]);
      persistOkunanlar(next);
      return next;
    });
  }, [bildirimler, persistOkunanlar]);

  const clearMustChangePassword = useCallback(async () => {
    await clearMustChangePw();
  }, [clearMustChangePw]);

  return (
    <AppContext.Provider value={{
      ...store,
      toasts, addToast, removeToast,
      activeModule, setActiveModule,
      sidebarCollapsed, setSidebarCollapsed,
      quickCreate, setQuickCreate,
      theme, toggleTheme,
      bildirimler, okunmamisBildirimSayisi, bildirimOku, tumunuOku, ekipmanKontrolBildirimi, isIzniBildirimi,
      org, orgLoading, orgError: loadError,
      mustChangePassword: org?.mustChangePassword ?? false,
      clearMustChangePassword,
      createOrg,
      joinOrg,
      regenerateInviteCode,
      refetchOrg,
      logAction,
      fetchTable,
      refreshData: store.refreshAllData,
      pageLoading: store.pageLoading,
      partialLoading: store.partialLoading,
      realtimeStatus: store.realtimeStatus,
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
