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
    // Sadece gerçek oturum/token yenileme hatalarında çalış — yanlış şifre hatalarında ÇALIŞMA
    const isRefreshTokenError =
      errMsg.includes('refresh token not found') ||
      errMsg.includes('invalid refresh token') ||
      errMsg.includes('token has expired') ||
      errMsg.includes('token is expired') ||
      errMsg.includes('revoked');
    
    if (isRefreshTokenError) {
      // Login veya super-admin sayfasındayken hiçbir şey yapma
      if (window.location.pathname === '/login') return;
      if (window.location.pathname.startsWith('/super-admin')) return;
      clearAuthStorage();
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // Ignore signOut errors
      }
      setSession(null);
      window.location.replace('/login');
    }
  }, [clearAuthStorage]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Load existing session on mount
    supabase.auth.getSession().then(({ data: { session: s }, error }) => {
      if (error) {
        handleAuthError(error);
      } else {
        setSession(s);
      }
      setLoading(false);
    }).catch((err) => {
      // Network or token error — clear stale tokens and show login
      handleAuthError(err);
      setLoading(false);
    });

    // Subscribe to auth changes
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
  }, [clearAuthStorage, handleAuthError]);

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

      // Giriş başarısız — her türlü hata "yanlış şifre/mail" olarak göster
      if (signInError) {
        return { error: 'E-posta veya şifre hatalı. Lütfen tekrar deneyin.' };
      }

      // Giriş başarılı — edge function ile org aktif mi kontrol et (RLS bypass)
      if (signInData?.user) {
        try {
          const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
          const checkRes = await fetch(`${supabaseUrl}/functions/v1/check-org-active`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: signInData.user.id }),
          });
          const checkData = await checkRes.json() as { allowed?: boolean; reason?: string; error?: string };

          if (!checkData.allowed) {
            await supabase.auth.signOut({ scope: 'local' });
            clearAuthStorage();
            if (checkData.reason === 'org_inactive') {
              return { error: 'Organizasyonunuz askıya alınmıştır. Lütfen yöneticinizle iletişime geçin.' };
            }
            return { error: 'Hesabınız devre dışı bırakılmış veya organizasyondan çıkarılmış. Lütfen yöneticinizle iletişime geçin.' };
          }
        } catch {
          // Edge function'a ulaşılamazsa login'e izin ver (fail-open)
          // Gerçek engelleme sadece açık "allowed: false" yanıtında yapılır
        }
      }

      return { error: null };
    } catch {
      return { error: 'E-posta veya şifre hatalı. Lütfen tekrar deneyin.' };
    }
  }, [clearAuthStorage]);

  const logout = useCallback(async () => {
    // Tab hafızasını temizle — çıkışta her panel genel bakıştan başlasın
    const TAB_KEYS = ['uzman_active_tab', 'hekim_active_tab', 'osgb_active_tab', 'admin_active_tab', 'isg_active_module'];
    TAB_KEYS.forEach(key => { try { sessionStorage.removeItem(key); } catch { /* ignore */ } });
    clearAuthStorage();
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch {
      // Ignore signOut errors
    }
    // Force full page reload to completely reset all in-memory state
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