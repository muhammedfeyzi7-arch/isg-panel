import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';

interface SuperAdminContextType {
  isSuperAdmin: boolean;
  loading: boolean;
}

const SuperAdminContext = createContext<SuperAdminContextType>({ isSuperAdmin: false, loading: true });

export function SuperAdminProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkSuperAdmin = useCallback(async () => {
    if (!user) {
      setIsSuperAdmin(false);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('user_id', user.id)
      .maybeSingle();
    setIsSuperAdmin(data?.is_super_admin === true);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    checkSuperAdmin();
  }, [checkSuperAdmin]);

  return (
    <SuperAdminContext.Provider value={{ isSuperAdmin, loading }}>
      {children}
    </SuperAdminContext.Provider>
  );
}

export function useSuperAdmin() {
  return useContext(SuperAdminContext);
}
