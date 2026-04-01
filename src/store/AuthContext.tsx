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
        // Geçersiz/süresi dolmuş token → oturumu temizle, login'e yönlendir
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

    // If sign-in failed, try sign-up to determine if user exists or not
    const displayName = email.split('@')[0]
      .replace(/[._-]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());

    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: displayName } },
    });

    // If sign-up also failed → check why
    if (signUpError) {
      const errMsg = signUpError.message.toLowerCase();
      // User already exists but wrong password (or other sign-in issue)
      if (
        errMsg.includes('already registered') ||
        errMsg.includes('already been registered') ||
        errMsg.includes('email_exists') ||
        errMsg.includes('user already registered') ||
        errMsg.includes('duplicate')
      ) {
        return { error: 'E-posta veya şifre hatalı. Lütfen tekrar deneyin.' };
      }
      return { error: signUpError.message };
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
