import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';
import LoginPage from '@/pages/login/page';

type PanelRole = 'admin' | 'specialist' | 'doctor';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: PanelRole;
}

/** Kullanıcının doğru paneline yönlendirir */
function roleHome(isAdmin: boolean, isSpecialist: boolean, isDoctor: boolean): string {
  if (isAdmin) return '/admin';
  if (isSpecialist) return '/specialist';
  if (isDoctor) return '/doctor';
  return '/';
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { session, loading, isConfigured, isAdmin, isSpecialist, isDoctor } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ backgroundColor: 'var(--text-primary)' }}>
            <i className="ri-shield-check-line text-lg" style={{ color: 'var(--card)' }} />
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!isConfigured || !session) return <LoginPage />;

  // Rol kontrolü — yanlış panele erişimde kendi paneline yönlendir
  if (requiredRole) {
    const hasAccess =
      (requiredRole === 'admin' && isAdmin) ||
      (requiredRole === 'specialist' && isSpecialist) ||
      (requiredRole === 'doctor' && isDoctor);

    if (!hasAccess) {
      return <Navigate to={roleHome(isAdmin, isSpecialist, isDoctor)} replace />;
    }
  }

  return <>{children}</>;
}
