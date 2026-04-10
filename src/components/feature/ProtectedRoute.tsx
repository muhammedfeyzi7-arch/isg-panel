import { type ReactNode, useEffect, useState, useRef, useCallback } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { supabase } from '../../lib/supabase';

interface ProtectedRouteProps {
  children: ReactNode;
}

type Status = 'checking' | 'ok' | 'expired' | 'inactive';

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { session, loading, logout } = useAuth();
  const location = useLocation();
  const [status, setStatus] = useState<Status>('checking');
  const orgIdRef = useRef<string | null>(null);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const checkOrgStatus = useCallback(async (userId: string): Promise<Status> => {
    try {
      // 1. Kullanıcının user_organizations kaydı aktif mi?
      const { data: uo } = await supabase
        .from('user_organizations')
        .select('organization_id, is_active')
        .eq('user_id', userId)
        .maybeSingle();

      if (!uo) return 'inactive';
      if (!uo.is_active) return 'inactive';

      orgIdRef.current = uo.organization_id;

      // 2. Super admin kontrolü — asla bloklanmaz
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_super_admin')
        .eq('user_id', userId)
        .maybeSingle();

      if (profile?.is_super_admin) return 'ok';

      // 3. Organizasyonun kendisi aktif mi ve süresi dolmamış mı?
      const { data: org } = await supabase
        .from('organizations')
        .select('is_active, subscription_end')
        .eq('id', uo.organization_id)
        .maybeSingle();

      if (!org) return 'inactive';
      if (!org.is_active) return 'inactive';

      // Tarih karşılaştırması: subscription_end "YYYY-MM-DD" formatında geliyor
      // Türkiye saatiyle bugünün tarihini al ve karşılaştır
      let isExpired = false;
      if (org.subscription_end) {
        const today = new Date();
        // Bugünün tarihini YYYY-MM-DD formatında al (local time)
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        // subscription_end'i de YYYY-MM-DD olarak al (ilk 10 karakter)
        const endStr = org.subscription_end.substring(0, 10);
        // Bitiş tarihi bugünden önce ise expired
        isExpired = endStr < todayStr;
      }

      if (isExpired) return 'expired';

      return 'ok';
    } catch {
      return 'inactive'; // Hata durumunda güvenli taraf — erişimi engelle
    }
  }, []);

  const setupRealtimeListener = useCallback((orgId: string, userId: string) => {
    // Önceki kanalı temizle
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    // Organizations tablosunu dinle — is_active veya subscription_end değişirse kontrol et
    const channel = supabase
      .channel(`org-status-${orgId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'organizations',
          filter: `id=eq.${orgId}`,
        },
        async () => {
          const newStatus = await checkOrgStatus(userId);
          setStatus(newStatus);
          if (newStatus === 'inactive' || newStatus === 'expired') {
            // Kullanıcıyı anında çıkar
            await logout();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_organizations',
          filter: `organization_id=eq.${orgId}`,
        },
        async () => {
          const newStatus = await checkOrgStatus(userId);
          setStatus(newStatus);
          if (newStatus === 'inactive' || newStatus === 'expired') {
            await logout();
          }
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;
  }, [checkOrgStatus, logout]);

  // İlk yükleme ve session değişiminde kontrol
  useEffect(() => {
    if (loading) return;
    if (!session) {
      setStatus('ok');
      return;
    }

    setStatus('checking');
    checkOrgStatus(session.user.id).then(result => {
      setStatus(result);
      if (result === 'ok' && orgIdRef.current) {
        setupRealtimeListener(orgIdRef.current, session.user.id);
      }
    });

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [session, loading, checkOrgStatus, setupRealtimeListener]);

  // Her route değişiminde de kontrol et
  useEffect(() => {
    if (!session || loading || status === 'checking') return;

    checkOrgStatus(session.user.id).then(result => {
      if (result !== status) {
        setStatus(result);
        if (result === 'inactive' || result === 'expired') {
          logout();
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Her 20 saniyede bir arka planda kontrol et — realtime çalışmasa bile yakalar
  useEffect(() => {
    if (!session || loading) return;

    const interval = setInterval(async () => {
      const result = await checkOrgStatus(session.user.id);
      if (result === 'inactive' || result === 'expired') {
        setStatus(result);
        logout();
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [session, loading, checkOrgStatus, logout]);

  if (loading || status === 'checking') return null;
  if (!session) return <Navigate to="/login" replace />;
  if (status === 'expired') return <Navigate to="/subscription-expired" replace />;
  if (status === 'inactive') return <Navigate to="/subscription-expired" replace />;

  return <>{children}</>;
}
