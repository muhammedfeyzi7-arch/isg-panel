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
  tip: 'evrak_surecek' | 'evrak_dolmus';
  mesaj: string;
  detay: string;
  tarih: string;
  okundu: boolean;
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
}

interface AppContextType extends StoreType {
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
    autoCreateOrg,
    clearMustChangePassword: clearMustChangePw,
  } = useOrganization(user);

  // Auto-create org when user has no org
  // IMPORTANT: autoCreateOrgRef prevents the effect from re-firing every time
  // autoCreateOrg gets a new reference (which would reset the 500ms timer indefinitely).
  const autoCreateAttemptedRef = useRef<string | null>(null);
  const autoCreateOrgRef = useRef(autoCreateOrg);
  useEffect(() => { autoCreateOrgRef.current = autoCreateOrg; }, [autoCreateOrg]);

  useEffect(() => {
    if (!user || orgLoading || rawOrg) return;
    if (autoCreateAttemptedRef.current === user.id) return;
    autoCreateAttemptedRef.current = user.id;
    const t = setTimeout(() => { autoCreateOrgRef.current(); }, 500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, orgLoading, rawOrg]);

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

  // ── Activity logging — writes to Supabase activity_logs table ──
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

  // ── Log user_login once per session ──
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

  const store = useStore(
    org?.id ?? null,
    logAction,
    useCallback((msg: string) => { addToastRef.current(msg, 'error'); }, []),
    user?.id,
    orgLoading,
    useCallback((module: string) => {
      addToastRef.current(`${module} modülünde başka bir kullanıcı değişiklik yaptı — veriler güncellendi.`, 'info');
    }, []),
  );

  const [activeModule, setActiveModule] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [quickCreate, setQuickCreate] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [okunanlar, setOkunanlar] = useState<Set<string>>(new Set());

  // Sync user email into store's currentUser
  useEffect(() => {
    if (user?.email && store.currentUser.email !== user.email) {
      store.updateCurrentUser({
        email: user.email,
        ad: store.currentUser.ad || getUserDisplayName(user),
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.email]);

  // Theme sync
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7 = new Date(today.getTime() + 7 * 86400000);
    const result: Bildirim[] = [];

    store.evraklar.forEach(e => {
      if (!e.gecerlilikTarihi || e.silinmis) return;
      const d = new Date(e.gecerlilikTarihi);
      d.setHours(0, 0, 0, 0);
      if (d >= today && d <= in7) {
        const kalanGun = Math.ceil((d.getTime() - today.getTime()) / 86400000);
        const personel = e.personelId ? store.personeller.find(p => p.id === e.personelId) : null;
        const firma = store.firmalar.find(f => f.id === e.firmaId);
        result.push({
          id: `bildirim_${e.id}`,
          tip: 'evrak_surecek',
          mesaj: `${e.ad} evrakının süresi dolmak üzere`,
          detay: `${personel ? personel.adSoyad + ' — ' : ''}${firma?.ad || ''} — ${kalanGun === 0 ? 'Bugün dolacak!' : `${kalanGun} gün kaldı`}`,
          tarih: e.gecerlilikTarihi,
          okundu: okunanlar.has(`bildirim_${e.id}`),
        });
      } else if (d < today) {
        const personel = e.personelId ? store.personeller.find(p => p.id === e.personelId) : null;
        const firma = store.firmalar.find(f => f.id === e.firmaId);
        result.push({
          id: `dolmus_${e.id}`,
          tip: 'evrak_dolmus',
          mesaj: `${e.ad} evrakının süresi dolmuş`,
          detay: `${personel ? personel.adSoyad + ' — ' : ''}${firma?.ad || ''} — ${d.toLocaleDateString('tr-TR')} tarihinde doldu`,
          tarih: e.gecerlilikTarihi,
          okundu: okunanlar.has(`dolmus_${e.id}`),
        });
      }
    });

    return result.sort((a, b) => new Date(a.tarih).getTime() - new Date(b.tarih).getTime());
  }, [store.evraklar, store.personeller, store.firmalar, okunanlar]);

  const okunmamisBildirimSayisi = useMemo(
    () => bildirimler.filter(b => !b.okundu).length,
    [bildirimler],
  );

  const bildirimOku = useCallback((id: string) => {
    setOkunanlar(prev => new Set([...prev, id]));
  }, []);

  const tumunuOku = useCallback(() => {
    setOkunanlar(new Set(bildirimler.map(b => b.id)));
  }, [bildirimler]);

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
      bildirimler, okunmamisBildirimSayisi, bildirimOku, tumunuOku,
      org, orgLoading, orgError: loadError,
      mustChangePassword: org?.mustChangePassword ?? false,
      clearMustChangePassword,
      createOrg,
      joinOrg,
      regenerateInviteCode,
      refetchOrg,
      logAction,
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
