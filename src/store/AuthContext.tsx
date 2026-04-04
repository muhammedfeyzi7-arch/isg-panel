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
      errMsg.includes('refresh token') ||
      errMsg.includes('invalid') ||
      errMsg.includes('not found') ||
      errMsg.includes('expired') ||
      errMsg.includes('revoked') ||
      errMsg.includes('invalid refresh token');
    
    if (isRefreshTokenError) {
      clearAuthStorage();
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // Ignore signOut errors
      }
      setSession(null);
      // Redirect to login if not already there
      if (window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
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

    // Clear any stale tokens before login
    clearAuthStorage();

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (!signInError) return { error: null };

    // Handle specific auth errors
    const errMsg = signInError.message?.toLowerCase() ?? '';
    if (errMsg.includes('refresh token') || errMsg.includes('invalid')) {
      clearAuthStorage();
      return { error: 'Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.' };
    }

    // Always return a friendly error — never expose raw Supabase messages
    return { error: 'E-posta veya şifre hatalı. Lütfen tekrar deneyin.' };
  }, [clearAuthStorage]);

  const logout = useCallback(async () => {
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