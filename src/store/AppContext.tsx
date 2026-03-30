import {
  createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { useStore, type StoreType } from './useStore';
import { useAuth } from './AuthContext';
import { useOrganization } from '../hooks/useOrganization';
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
  autoCreatePending: boolean;
  needsOnboarding: boolean;
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

  // Keep a stable ref to autoCreateOrg so it never appears in useEffect deps.
  // autoCreateOrg is NOT useCallback-wrapped in useOrganization, so its reference
  // changes every render. Including it in deps causes React to cancel the timeout
  // via cleanup and re-run the effect — but the ref guard then prevents a new timeout
  // from starting, leaving autoCreatePending = true forever.
  const autoCreateOrgRef = useRef(autoCreateOrg);
  useEffect(() => { autoCreateOrgRef.current = autoCreateOrg; });

  const autoCreateAttemptedRef = useRef<string | null>(null);
  const [autoCreatePending, setAutoCreatePending] = useState(false);

  useEffect(() => {
    // Deps: user?.id, orgLoading, rawOrg — intentionally excludes autoCreateOrg
    if (!user || orgLoading || rawOrg) return;
    if (autoCreateAttemptedRef.current === user.id) return;
    autoCreateAttemptedRef.current = user.id;
    setAutoCreatePending(true);

    // 500ms so JWT session is fully stable before RLS-protected insert.
    // IMPORTANT: No cleanup/clearTimeout here — the timeout MUST always complete.
    // The autoCreateInProgressRef inside autoCreateOrg prevents duplicate execution.
    setTimeout(async () => {
      try {
        await autoCreateOrgRef.current();
      } catch (err) {
        console.error('[ISG] AppContext autoCreate error:', err);
      } finally {
        setAutoCreatePending(false);
      }
    }, 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, orgLoading, rawOrg]);

  // Map rawOrg to OrgInfo with user display name
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

  const logAction = useCallback((
    _actionType: string, _module: string, _recordId: string,
    _recordName?: string, _description?: string,
  ) => {
    // Activity logging — no-op for now
  }, []);

  const addToastRef = useRef(addToast);
  useEffect(() => { addToastRef.current = addToast; }, [addToast]);

  const store = useStore(
    org?.id ?? null,
    logAction,
    useCallback((msg: string) => { addToastRef.current(msg, 'error'); }, []),
    user?.id,
    orgLoading,
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

  // needsOnboarding is now only true if both autoCreate finished AND we still have no org AND there's a real error
  // For normal new users, autoCreatePending will be true while org is being made — they never see onboarding
  const needsOnboarding = false; // Onboarding redirect disabled — org is always created silently

  return (
    <AppContext.Provider value={{
      ...store,
      toasts, addToast, removeToast,
      activeModule, setActiveModule,
      sidebarCollapsed, setSidebarCollapsed,
      quickCreate, setQuickCreate,
      theme, toggleTheme,
      bildirimler, okunmamisBildirimSayisi, bildirimOku, tumunuOku,
      org, orgLoading, orgError: loadError, needsOnboarding, autoCreatePending,
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
