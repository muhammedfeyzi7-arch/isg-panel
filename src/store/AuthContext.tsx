import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'SIGNED_OUT') {
        setSession(null);
      } else {
        setSession(newSession);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        return { error: 'E-posta veya şifre hatalı. Lütfen tekrar deneyin.' };
      }
      if (error.message.includes('Email not confirmed')) {
        return { error: 'E-posta adresiniz henüz doğrulanmamış.' };
      }
      return { error: error.message };
    }
    return { error: null };
  }, []);

  const logout = useCallback(async () => {
    // 1. State'i anında temizle — korumalı sayfalar hemen login'e atar
    setSession(null);

    // 2. Supabase oturumunu sunucu tarafında da kapat
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // signOut hatası sessizce yutulsun, state zaten temizlendi
    }

    // 3. localStorage'daki tüm Supabase token anahtarlarını sil
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-') || key.startsWith('supabase')) {
        localStorage.removeItem(key);
      }
    });

    // 4. sessionStorage temizle (hoş geldiniz animasyonu bayrağı dahil)
    sessionStorage.clear();

    // 5. Login sayfasına yönlendir
    if (typeof window !== 'undefined' && (window as unknown as { REACT_APP_NAVIGATE?: (path: string) => void }).REACT_APP_NAVIGATE) {
      (window as unknown as { REACT_APP_NAVIGATE: (path: string) => void }).REACT_APP_NAVIGATE('/login');
    } else {
      window.location.replace('/login');
    }
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      if (error.message.includes('New password should be different')) {
        return { error: 'Yeni şifre mevcut şifreden farklı olmalıdır.' };
      }
      if (error.message.includes('Password should be at least')) {
        return { error: 'Şifre en az 6 karakter olmalıdır.' };
      }
      return { error: error.message };
    }
    return { error: null };
  }, []);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, login, logout, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
