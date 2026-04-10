import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => void;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const clearAuthStorage = useCallback(() => {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('sb-')) localStorage.removeItem(key);
    });
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith('sb-')) sessionStorage.removeItem(key);
    });
  }, []);

  const handleAuthError = useCallback(async (error: Error | unknown) => {
    const errMsg = (error instanceof Error ? error.message : String(error)).toLowerCase();
    const isRefreshTokenError =
      errMsg.includes('refresh token not found') ||
      errMsg.includes('invalid refresh token') ||
      errMsg.includes('token has expired') ||
      errMsg.includes('token is expired') ||
      errMsg.includes('revoked');

    if (isRefreshTokenError) {
      if (window.location.pathname === '/login') return;
      if (window.location.pathname.startsWith('/super-admin')) return;
      clearAuthStorage();
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // ignore
      }
      setSession(null);
      window.location.replace('/login');
    }
  }, [clearAuthStorage]);

  // Süresi dolan organizasyonları otomatik pasife al — günde 1 kez
  // useEffect'ten ÖNCE tanımlanmalı!
  const triggerAutoExpire = useCallback(async () => {
    const LAST_RUN_KEY = 'isg_auto_expire_last_run';
    const lastRun = localStorage.getItem(LAST_RUN_KEY);
    const today = new Date().toISOString().substring(0, 10);
    if (lastRun === today) return;

    try {
      const supabaseBase = (import.meta.env.VITE_PUBLIC_SUPABASE_URL as string).replace(/\/rest\/v1\/?$/, '');
      await fetch(`${supabaseBase}/functions/v1/auto-expire-organizations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      localStorage.setItem(LAST_RUN_KEY, today);
    } catch {
      // Sessizce devam et
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Uygulama açılınca süresi dolan org'ları otomatik pasife al (günde 1 kez)
    triggerAutoExpire();

    supabase.auth.getSession().then(({ data: { session: s }, error }) => {
      if (error) {
        handleAuthError(error);
      } else {
        setSession(s);
      }
      setLoading(false);
    }).catch((err) => {
      handleAuthError(err);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        setSession(s);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        clearAuthStorage();
      } else if ((event as string) === 'TOKEN_REFRESH_FAILED' || (event as string) === 'USER_DELETED') {
        await handleAuthError(new Error('Refresh token invalid'));
      } else {
        setSession(s);
      }
    });

    return () => subscription.unsubscribe();
  }, [clearAuthStorage, handleAuthError, triggerAutoExpire]);

  const login = useCallback(async (email: string, password: string): Promise<{ error: string | null }> => {
    if (!isSupabaseConfigured) {
      return { error: 'Supabase bağlantısı yapılandırılmamış. Lütfen Supabase\'i bağlayın.' };
    }
    if (!email.trim()) return { error: 'E-posta adresi boş olamaz.' };
    if (password.length < 4) return { error: 'Şifre en az 4 karakter olmalıdır.' };

    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) {
        return { error: 'E-posta veya şifre hatalı. Lütfen tekrar deneyin.' };
      }

      if (signInData?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_super_admin')
          .eq('user_id', signInData.user.id)
          .maybeSingle();

        if (!profile?.is_super_admin) {
          const { data: membership } = await supabase
            .from('user_organizations')
            .select('organization_id, is_active')
            .eq('user_id', signInData.user.id)
            .maybeSingle();

          if (!membership || !membership.is_active) {
            await supabase.auth.signOut({ scope: 'local' });
            clearAuthStorage();
            return { error: 'Hesabınız devre dışı bırakılmış veya organizasyondan çıkarılmış. Lütfen yöneticinizle iletişime geçin.' };
          }

          const { data: org } = await supabase
            .from('organizations')
            .select('is_active, subscription_end')
            .eq('id', membership.organization_id)
            .maybeSingle();

          if (!org || !org.is_active) {
            await supabase.auth.signOut({ scope: 'local' });
            clearAuthStorage();
            return { error: 'ABONELİĞİNİZ SONLANMIŞTIR. Lütfen hizmet sağlayıcınızla iletişime geçin.' };
          }

          // String karşılaştırma — UTC/timezone sorunu yok
          if (org.subscription_end) {
            const now = new Date();
            const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const endStr = String(org.subscription_end).substring(0, 10);
            if (endStr < todayStr) {
              await supabase.auth.signOut({ scope: 'local' });
              clearAuthStorage();
              return { error: 'ABONELİĞİNİZ SONLANMIŞTIR. Lütfen hizmet sağlayıcınızla iletişime geçin.' };
            }
          }
        }
      }

      return { error: null };
    } catch {
      return { error: 'E-posta veya şifre hatalı. Lütfen tekrar deneyin.' };
    }
  }, [clearAuthStorage]);

  const logout = useCallback(async () => {
    clearAuthStorage();
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch {
      // ignore
    }
    window.location.replace('/login');
  }, [clearAuthStorage]);

  const updatePassword = useCallback(async (newPassword: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      loading,
      login,
      logout,
      updatePassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
