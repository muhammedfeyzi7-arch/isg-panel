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
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
    });

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
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

    // If user doesn't exist → auto sign up (preserves the "any email/password" UX)
    const isNewUser =
      signInError.message.toLowerCase().includes('invalid login') ||
      signInError.message.toLowerCase().includes('invalid_credentials') ||
      signInError.message.toLowerCase().includes('user not found');

    if (isNewUser) {
      const displayName = email.split('@')[0]
        .replace(/[._-]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());

      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: displayName } },
      });

      if (signUpError) return { error: signUpError.message };

      // Immediately sign in after sign up
      const { error: signIn2Error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signIn2Error) {
        return { error: 'Hesap oluşturuldu. Lütfen e-posta kutunuzu kontrol edip doğrulama yapın, ardından giriş deneyin.' };
      }
      return { error: null };
    }

    return { error: signInError.message };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    const nav = (window as unknown as { REACT_APP_NAVIGATE?: (p: string) => void }).REACT_APP_NAVIGATE;
    if (nav) {
      nav('/login');
    } else {
      window.location.replace('/login');
    }
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
