import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { useStore, type StoreType } from './useStore';
import { useAuth } from './AuthContext';
import { useOrganization, type OrgInfo } from '../hooks/useOrganization';
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
  // Org context
  org: OrgInfo | null;
  orgLoading: boolean;
  needsOnboarding: boolean;
  mustChangePassword: boolean;
  clearMustChangePassword: () => Promise<void>;
  createOrg: (name: string, userId: string) => Promise<{ error: string | null }>;
  joinOrg: (code: string) => Promise<{ error: string | null }>;
  regenerateInviteCode: () => Promise<{ error: string | null; newCode?: string }>;
  refetchOrg: () => Promise<void>;
  // Activity log
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

export function AppProvider({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const {
    org, loading: orgLoading,
    createOrg, joinOrg, regenerateInviteCode,
    refetch: refetchOrg, autoCreateOrg, clearMustChangePassword,
  } = useOrganization(user);
  const passiveChecked = useRef(false);
  const loginLoggedRef = useRef(false);

  // ── Activity log helper ──
  const logAction = useCallback((
    actionType: string,
    module: string,
    recordId: string,
    recordName?: string,
    description?: string,
  ) => {
    if (!user || !org) return;
    logActivity({
      organizationId: org.id,
      userId: user.id,
      userEmail: user.email ?? '',
      userName: org.displayName || user.email?.split('@')[0] || 'Bilinmeyen',
      userRole: org.role,
      actionType,
      module,
      recordId,
      recordName,
      description,
    });
  }, [user, org]);

  const store = useStore(org?.id ?? null, logAction);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activeModule, setActiveModule] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [quickCreate, setQuickCreate] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [okunanlar, setOkunanlar] = useState<Set<string>>(new Set());

  const needsOnboarding = false;
  const mustChangePassword = org?.mustChangePassword === true;

  const addToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Math.random().toString(36).substring(2);
    const toast: Toast = { id, message, type };
    setToasts(prev => [...prev, toast]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Passive user check: if user is deactivated by admin, sign them out
  useEffect(() => {
    if (!org || orgLoading || passiveChecked.current) return;
    passiveChecked.current = true;
    if (org.isActive === false) {
      addToast('Hesabınız devre dışı bırakıldı. Yöneticinizle iletişime geçin.', 'error');
      const t = setTimeout(() => { logout(); }, 2500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [org, orgLoading, addToast, logout]);

  // Auto-create org silently if user logged in but has no org
  useEffect(() => {
    if (!user || orgLoading || org) return;
    const timer = setTimeout(() => { autoCreateOrg(); }, 800);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, orgLoading, org]);

  // Log login event once per session when user + org are both loaded
  useEffect(() => {
    if (!user || !org || loginLoggedRef.current) return;
    loginLoggedRef.current = true;
    logActivity({
      organizationId: org.id,
      userId: user.id,
      userEmail: user.email ?? '',
      userName: org.displayName || user.email?.split('@')[0] || 'Bilinmeyen',
      userRole: org.role,
      actionType: 'user_login',
      module: 'Sistem',
      recordId: user.id,
      description: 'Kullanıcı sisteme giriş yaptı.',
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, org?.id]);

  // Sync user email into store
  useEffect(() => {
    if (user?.email && store.currentUser.email !== user.email) {
      store.updateCurrentUser({
        email: user.email,
        ad: store.currentUser.ad || (user.user_metadata?.full_name as string) || '',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.email]);

  // Theme effect
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
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
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

  return (
    <AppContext.Provider value={{
      ...store,
      toasts, addToast, removeToast,
      activeModule, setActiveModule,
      sidebarCollapsed, setSidebarCollapsed,
      quickCreate, setQuickCreate,
      theme, toggleTheme,
      bildirimler, okunmamisBildirimSayisi, bildirimOku, tumunuOku,
      org, orgLoading, needsOnboarding, mustChangePassword, clearMustChangePassword,
      createOrg, joinOrg, regenerateInviteCode, refetchOrg,
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
