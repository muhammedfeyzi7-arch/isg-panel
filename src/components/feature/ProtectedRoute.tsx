import { type ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { supabase } from '../../lib/supabase';

interface ProtectedRouteProps {
  children: ReactNode;
}

type OrgType = 'firma' | 'osgb';
type OsgbRole = 'osgb_admin' | 'gezici_uzman' | null;

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { session, loading } = useAuth();
  const location = useLocation();
  const [subStatus, setSubStatus] = useState<'checking' | 'ok' | 'expired'>('checking');
  const [orgType, setOrgType] = useState<OrgType>('firma');
  const [osgbRole, setOsgbRole] = useState<OsgbRole>(null);

  useEffect(() => {
    if (loading || !session) {
      setSubStatus('ok');
      return;
    }
    (async () => {
      // Tüm aktif kayıtları çek — osgb_role olan kaydı önceliklendir
      const { data: uoList } = await supabase
        .from('user_organizations')
        .select('organization_id, osgb_role')
        .eq('user_id', session.user.id)
        .eq('is_active', true);

      const uoAll = uoList ?? [];
      // osgb_admin veya gezici_uzman rolü olan kaydı bul, yoksa ilk kaydı al
      const uo = uoAll.find(r => r.osgb_role === 'osgb_admin' || r.osgb_role === 'gezici_uzman')
        ?? uoAll[0]
        ?? null;

      if (!uo) { setSubStatus('ok'); return; }

      const { data: org } = await supabase
        .from('organizations')
        .select('is_active, subscription_end, org_type')
        .eq('id', uo.organization_id)
        .maybeSingle();

      if (!org) { setSubStatus('ok'); return; }

      // Super admin kontrolü
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_super_admin')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (profile?.is_super_admin) { setSubStatus('ok'); return; }

      const isExpired = org.subscription_end
        ? new Date(org.subscription_end) < new Date()
        : false;

      setOrgType((org.org_type === 'osgb' ? 'osgb' : 'firma') as OrgType);
      setOsgbRole((uo.osgb_role as OsgbRole) ?? null);

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

  // OSGB kullanıcısı firma paneline girmeye çalışıyorsa → OSGB paneline yönlendir
  const isOsgbPath = location.pathname.startsWith('/osgb');
  if (orgType === 'osgb' && !isOsgbPath) {
    if (osgbRole === 'gezici_uzman') {
      return <Navigate to="/osgb-uzman" replace />;
    }
    return <Navigate to="/osgb-dashboard" replace />;
  }

  // Firma kullanıcısı /osgb-dashboard veya /osgb-uzman'a erişmeye çalışıyorsa → /dashboard'a yönlendir
  const isOsgbDashboard = location.pathname === '/osgb-dashboard';
  const isOsgbUzman = location.pathname === '/osgb-uzman';
  const isOsgbOnboarding = location.pathname === '/osgb-onboarding';
  if ((isOsgbDashboard || isOsgbUzman) && orgType === 'firma' && !isOsgbOnboarding) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
