import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/AuthContext';

interface OsgbContextValue {
  loading: boolean;
  error: string | null;
  orgId: string | null;
  orgName: string;
  refresh: () => Promise<void>;
}

const OsgbContext = createContext<OsgbContextValue | null>(null);

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message?: unknown }).message ?? 'Bilinmeyen hata');
  }
  return String(err ?? 'Bilinmeyen hata');
}

export function OsgbProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState('OSGB');

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setError('Kullanıcı oturumu bulunamadı.');
      setOrgId(null);
      setOrgName('OSGB');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: membership, error: membershipError } = await supabase
        .from('user_organizations')
        .select('organization_id, osgb_role, role, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .or('osgb_role.eq.osgb_admin,role.eq.admin')
        .order('joined_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (membershipError) throw membershipError;
      if (!membership?.organization_id) {
        setError('OSGB admin yetkiniz bulunmuyor.');
        setOrgId(null);
        setOrgName('OSGB');
        return;
      }

      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id, name, is_active')
        .eq('id', membership.organization_id)
        .maybeSingle();

      if (orgError) throw orgError;
      if (!org || org.is_active === false) {
        setError('Hesabınız devre dışı bırakıldı');
        setOrgId(null);
        setOrgName('OSGB');
        return;
      }

      setOrgId(org.id);
      setOrgName(org.name ?? 'OSGB');
    } catch (err) {
      setError(toErrorMessage(err));
      setOrgId(null);
      setOrgName('OSGB');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo(
    () => ({
      loading,
      error,
      orgId,
      orgName,
      refresh: load,
    }),
    [loading, error, orgId, orgName, load],
  );

  return <OsgbContext.Provider value={value}>{children}</OsgbContext.Provider>;
}

export function useOsgb() {
  const context = useContext(OsgbContext);
  if (!context) throw new Error('useOsgb must be used within OsgbProvider');
  return context;
}
