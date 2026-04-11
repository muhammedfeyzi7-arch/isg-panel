import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { useApp } from '../../store/AppContext';

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { session, loading: authLoading } = useAuth();
  const { org, orgLoading } = useApp();
  const location = useLocation();

  // Auth veya org henüz yüklenmedi
  if (authLoading || orgLoading) return null;

  // Oturum yok → login sayfasına
  if (!session) return <Navigate to="/login" replace />;

  // Org yüklenmiş ama null → org yoksa login'e (yeni kullanıcı onboarding ile çözülür)
  // Bazı durumlarda org hâlâ null gelebilir (yeni kayıt, edge fn bekliyor) — null spinner göster
  if (!org) return null;

  // ── Abonelik kontrolü ──
  // org.isActive false ise subscription-expired sayfasına yönlendir
  if (!org.isActive) {
    return <Navigate to="/subscription-expired" replace />;
  }

  const osgbRole = org.osgbRole ?? null;
  const isOsgbPath = location.pathname.startsWith('/osgb');

  // ── Gezici Uzman yönlendirme ──
  if (osgbRole === 'gezici_uzman') {
    const hasActiveFirm = (org.activeFirmIds?.length ?? 0) > 0;

    if (!hasActiveFirm) {
      // Firma atanmamış → uzman bekleme sayfasında tut
      if (location.pathname !== '/osgb-uzman') {
        return <Navigate to="/osgb-uzman" replace />;
      }
      return <>{children}</>;
    }

    // Firma atanmış → OSGB path'lerine girmeye çalışırsa /dashboard'a yönlendir
    if (isOsgbPath) {
      return <Navigate to="/dashboard" replace />;
    }

    // Normal firma panelinde çalışsın
    return <>{children}</>;
  }

  // ── OSGB Admin yönlendirme ──
  if (osgbRole === 'osgb_admin') {
    // OSGB admin firma paneline girmeye çalışıyorsa → OSGB paneline yönlendir
    if (!isOsgbPath) {
      return <Navigate to="/osgb-dashboard" replace />;
    }
    return <>{children}</>;
  }

  // ── Normal firma kullanıcısı ──
  // OSGB sayfalarına erişmeye çalışıyorsa → dashboard'a yönlendir
  const isOsgbDashboard = location.pathname === '/osgb-dashboard';
  const isOsgbUzman = location.pathname === '/osgb-uzman';
  if (isOsgbDashboard || isOsgbUzman) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
