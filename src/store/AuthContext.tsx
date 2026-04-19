import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getCurrentSession, login as authLogin, logout as authLogout } from '@/services/authService';
import type { AuthSession, MemberRole } from '@/types/database';

interface AuthContextValue {
  session: AuthSession | null;
  loading: boolean;
  isConfigured: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isSpecialist: boolean;
  isDoctor: boolean;
  canManage: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const ADMIN_ROLES: MemberRole[] = ['owner', 'admin'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isSupabaseConfigured();
  const loginInProgress = useRef(false);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }

    const timeout = setTimeout(() => setLoading(false), 5000);

    getCurrentSession()
      .then((s) => setSession(s))
      .catch(() => setSession(null))
      .finally(() => { clearTimeout(timeout); setLoading(false); });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (loginInProgress.current) return;
      if (event === 'SIGNED_OUT') {
        setSession(null);
      } else if (event === 'TOKEN_REFRESHED') {
        try {
          const s = await getCurrentSession();
          setSession(s);
        } catch { /* token refresh hatası — mevcut session'ı koru */ }
      }
    });

    return () => { clearTimeout(timeout); subscription.unsubscribe(); };
  }, [configured]);

  const login = useCallback(async (email: string, password: string) => {
    loginInProgress.current = true;
    try {
      const s = await authLogin({ email, password });
      setSession(s);
    } finally {
      setTimeout(() => { loginInProgress.current = false; }, 1000);
    }
  }, []);

  const logout = useCallback(async () => {
    await authLogout();
    setSession(null);
  }, []);

  const role = session?.role ?? null;
  const isAdmin = role ? ADMIN_ROLES.includes(role) : false;
  const isSpecialist = role === 'specialist';
  const isDoctor = role === 'doctor';
  const canManage = isAdmin;

  return (
    <AuthContext.Provider value={{
      session, loading, isConfigured: configured,
      login, logout,
      isAdmin, isSpecialist, isDoctor, canManage,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
