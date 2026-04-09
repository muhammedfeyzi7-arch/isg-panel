import { type ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { supabase } from '../../lib/supabase';

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { session, loading } = useAuth();
  const [subStatus, setSubStatus] = useState<'checking' | 'ok' | 'expired'>('checking');

  useEffect(() => {
    if (loading || !session) {
      setSubStatus('ok');
      return;
    }
    (async () => {
      // Kullanıcının organizasyonunu bul
      const { data: uo } = await supabase
        .from('user_organizations')
        .select('organization_id')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (!uo) { setSubStatus('ok'); return; }

      const { data: org } = await supabase
        .from('organizations')
        .select('is_active, subscription_end')
        .eq('id', uo.organization_id)
        .maybeSingle();

      if (!org) { setSubStatus('ok'); return; }

      // Super admin kontrolü — super admin asla bloklanmaz
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_super_admin')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (profile?.is_super_admin) { setSubStatus('ok'); return; }

      const isExpired = org.subscription_end
        ? new Date(org.subscription_end) < new Date()
        : false;

      if (!org.is_active || isExpired) {
        setSubStatus('expired');
      } else {
        setSubStatus('ok');
      }
    })();
  }, [session, loading]);

  if (loading || subStatus === 'checking') return null;
  if (!session) return <Navigate to="/login" replace />;
  if (subStatus === 'expired') return <Navigate to="/subscription-expired" replace />;

  return <>{children}</>;
}
