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

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Load existing session on mount
    supabase.auth.getSession().then(({ data: { session: s }, error }) => {
      if (error) {
        // Geçersiz/süresi dolmuş token → localStorage'ı temizle, oturumu kapat
        const errMsg = error.message?.toLowerCase() ?? '';
        if (
          errMsg.includes('refresh token') ||
          errMsg.includes('invalid') ||
          errMsg.includes('not found') ||
          errMsg.includes('expired')
        ) {
          // Tüm supabase auth verilerini localStorage'dan temizle
          Object.keys(localStorage).forEach((key) => {
            if (key.startsWith('sb-')) localStorage.removeItem(key);
          });
        }
        supabase.auth.signOut();
        setSession(null);
      } else {
        setSession(s);
      }
      setLoading(false);
    });

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        setSession(s);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        // Geçersiz token kalıntılarını temizle
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith('sb-')) localStorage.removeItem(key);
        });
      } else if (event === 'TOKEN_REFRESH_FAILED' as string) {
        // Token yenileme başarısız → oturumu temizle
        setSession(null);
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith('sb-')) localStorage.removeItem(key);
        });
        supabase.auth.signOut();
      } else {
        setSession(s);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ error: string | null }> => {
    if (!isSupabaseConfigured) {
      return { error: 'Supabase bağlantısı yapılandırılmamış. Lütfen Supabase\'i bağlayın.' };
    }
    if (!email.trim()) return { error: 'E-posta adresi boş olamaz.' };
    if (password.length < 4) return { error: 'Şifre en az 4 karakter olmalıdır.' };

    // Try sign in first
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (!signInError) return { error: null };

    // Detect "wrong credentials" errors — user exists but password wrong
    // In this case, we must NOT attempt sign-up (would show "already registered")
    const signInMsg = signInError.message.toLowerCase();
    const isWrongCredentials =
      signInMsg.includes('invalid login credentials') ||
      signInMsg.includes('invalid credentials') ||
      signInMsg.includes('invalid_credentials') ||
      signInMsg.includes('email not confirmed') ||
      signInMsg.includes('email_not_confirmed');

    if (isWrongCredentials) {
      return { error: 'E-posta veya şifre hatalı. Lütfen tekrar deneyin.' };
    }

    // For any other sign-in error, try sign-up — this handles brand-new users
    const displayName = email.split('@')[0]
      .replace(/[._-]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());

    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: displayName } },
    });

    // If sign-up also failed for any reason → always show friendly message (never raw Supabase error)
    if (signUpError) {
      return { error: 'E-posta veya şifre hatalı. Lütfen tekrar deneyin.' };
    }

    // Sign-up succeeded → new user was created, sign in immediately
    const { error: signIn2Error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signIn2Error) {
      return { error: 'Hesap oluşturuldu. Lütfen e-posta kutunuzu kontrol edip doğrulama yapın, ardından giriş deneyin.' };
    }

    return { error: null };
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
