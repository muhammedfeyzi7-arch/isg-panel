import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, resolvedSupabaseUrl, resolvedKeyFormat } from '../lib/supabase';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** Set when a network/CORS error makes Supabase unreachable */
  connectionError: string | null;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => void;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

/** Classify a raw fetch error into a user-friendly Turkish message */
function classifyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const isCors = msg === 'Failed to fetch' || msg.includes('NetworkError') || msg.includes('network request failed');
  if (isCors) {
    return `CORS / Ağ Hatası — yayınlanan site Supabase'e ulaşamıyor.\n\nURL: ${resolvedSupabaseUrl}\nAnahtar formatı: ${resolvedKeyFormat}\n\nÇözüm: Supabase Dashboard → Authentication → URL Configuration → Site URL ve Redirect URLs'e yayın domaininizi ekleyin.`;
  }
  return msg;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Load existing session on mount
    supabase.auth.getSession()
      .then(({ data: { session: s }, error }) => {
        if (error) {
          console.error('[ISG:Auth] getSession error:', error.message);
        }
        setSession(s);
        setLoading(false);
      })
      .catch((err: unknown) => {
        const classified = classifyError(err);
        console.error('[ISG:Auth] getSession FAILED:', classified);
        setConnectionError(classified);
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

    console.log('[ISG:Auth] login attempt →', resolvedSupabaseUrl, '| key:', resolvedKeyFormat);

    // Try sign in first
    let signInResult: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;
    try {
      signInResult = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    } catch (err) {
      const classified = classifyError(err);
      setConnectionError(classified);
      return { error: classified };
    }

    const { error: signInError } = signInResult;
    if (!signInError) {
      setConnectionError(null);
      return { error: null };
    }

    console.warn('[ISG:Auth] signIn failed:', signInError.message);

    // If user doesn't exist → auto sign up (preserves the "any email/password" UX)
    const isNewUser =
      signInError.message.toLowerCase().includes('invalid login') ||
      signInError.message.toLowerCase().includes('invalid_credentials') ||
      signInError.message.toLowerCase().includes('user not found');

    if (isNewUser) {
      const displayName = email.split('@')[0]
        .replace(/[._-]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());

      let signUpResult: Awaited<ReturnType<typeof supabase.auth.signUp>>;
      try {
        signUpResult = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: displayName } },
        });
      } catch (err) {
        const classified = classifyError(err);
        setConnectionError(classified);
        return { error: classified };
      }

      if (signUpResult.error) return { error: signUpResult.error.message };

      // Immediately sign in after sign up
      try {
        const { error: signIn2Error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signIn2Error) {
          return { error: 'Hesap oluşturuldu. Lütfen e-posta kutunuzu kontrol edip doğrulama yapın, ardından giriş deneyin.' };
        }
        setConnectionError(null);
        return { error: null };
      } catch (err) {
        const classified = classifyError(err);
        setConnectionError(classified);
        return { error: classified };
      }
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
      connectionError,
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
