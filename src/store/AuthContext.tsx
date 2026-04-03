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
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Load existing session on mount
    supabase.auth.getSession().then(({ data: { session: s }, error }) => {
      if (error) {
        const errMsg = error.message?.toLowerCase() ?? '';
        if (
          errMsg.includes('refresh token') ||
          errMsg.includes('invalid') ||
          errMsg.includes('not found') ||
          errMsg.includes('expired') ||
          errMsg.includes('failed to fetch') ||
          errMsg.includes('network')
        ) {
          clearAuthStorage();
        }
        supabase.auth.signOut().catch(() => {});
        setSession(null);
      } else {
        setSession(s);
      }
      setLoading(false);
    }).catch(() => {
      // Network error — clear stale tokens and show login
      clearAuthStorage();
      setSession(null);
      setLoading(false);
    });

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        setSession(s);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        clearAuthStorage();
      } else if ((event as string) === 'TOKEN_REFRESH_FAILED') {
        setSession(null);
        clearAuthStorage();
        supabase.auth.signOut().catch(() => {});
      } else {
        setSession(s);
      }
    });

    return () => subscription.unsubscribe();
  }, [clearAuthStorage]);

  const login = useCallback(async (email: string, password: string): Promise<{ error: string | null }> => {
    if (!isSupabaseConfigured) {
      return { error: 'Supabase bağlantısı yapılandırılmamış. Lütfen Supabase\'i bağlayın.' };
    }
    if (!email.trim()) return { error: 'E-posta adresi boş olamaz.' };
    if (password.length < 4) return { error: 'Şifre en az 4 karakter olmalıdır.' };

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (!signInError) return { error: null };

    // Always return a friendly error — never expose raw Supabase messages
    return { error: 'E-posta veya şifre hatalı. Lütfen tekrar deneyin.' };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    // Force full page reload to completely reset all in-memory state
    // This prevents stale data from previous session appearing after re-login
    window.location.replace('/login');
  }, []);

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
