import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import { useStore, type StoreType } from './useStore';
import { useAuth } from './AuthContext';
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
  const { user } = useAuth();
  const userId = user?.id ?? 'guest';
  const store = useStore(userId);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activeModule, setActiveModule] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [quickCreate, setQuickCreate] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [okunanlar, setOkunanlar] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user?.email && store.currentUser.email !== user.email) {
      store.updateCurrentUser({
        email: user.email,
        ad: store.currentUser.ad || (user.user_metadata?.full_name as string) || '',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.email]);

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
      if (!e.gecerlilikTarihi) return;
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
    [bildirimler]
  );

  const bildirimOku = useCallback((id: string) => {
    setOkunanlar(prev => new Set([...prev, id]));
  }, []);

  const tumunuOku = useCallback(() => {
    setOkunanlar(new Set(bildirimler.map(b => b.id)));
  }, [bildirimler]);

  const addToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Math.random().toString(36).substring(2);
    const toast: Toast = { id, message, type };
    setToasts(prev => [...prev, toast]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <AppContext.Provider value={{
      ...store,
      toasts, addToast, removeToast,
      activeModule, setActiveModule,
      sidebarCollapsed, setSidebarCollapsed,
      quickCreate, setQuickCreate,
      theme, toggleTheme,
      bildirimler, okunmamisBildirimSayisi, bildirimOku, tumunuOku,
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
