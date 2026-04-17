import { type ReactNode, useEffect, useState } from 'react';
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
  const [orgTimeout, setOrgTimeout] = useState(false);

  // Org 12 saniyeden uzun yüklenirse timeout göster
  useEffect(() => {
    if (orgLoading || org) {
      setOrgTimeout(false);
      return;
    }
    if (!session) return;
    const t = setTimeout(() => setOrgTimeout(true), 12000);
    return () => clearTimeout(t);
  }, [orgLoading, org, session]);

  // Auth veya org henüz yüklenmedi
  if (authLoading || orgLoading) return null;

  // Oturum yok → login sayfasına
  if (!session) return <Navigate to="/login" replace />;

  // Org yüklenmiş ama null → timeout kontrolü
  if (!org) {
    if (orgTimeout) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0f1117]">
          <div className="text-center max-w-sm px-6">
            <div className="w-14 h-14 flex items-center justify-center rounded-full bg-red-500/10 mx-auto mb-4">
              <i className="ri-wifi-off-line text-2xl text-red-400" />
            </div>
            <h2 className="text-white font-semibold text-lg mb-2">Bağlantı Sorunu</h2>
            <p className="text-slate-400 text-sm mb-5">
              Organizasyon bilgileri yüklenemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              Sayfayı Yenile
            </button>
          </div>
        </div>
      );
    }
    // Henüz timeout olmadı — spinner göster
    return null;
  }

  // ── Abonelik kontrolü ──
  // org.isActive false ise subscription-expired sayfasına yönlendir
  if (!org.isActive) {
    return <Navigate to="/subscription-expired" replace />;
  }

  const osgbRole = org.osgbRole ?? null;
  const isOsgbPath = location.pathname.startsWith('/osgb');

  // ── Gezici Uzman yönlendirme ──
  if (osgbRole === 'gezici_uzman') {
    const allowedPaths = ['/uzman', '/saha', '/osgb-uzman'];
    if (!allowedPaths.includes(location.pathname)) {
      return <Navigate to="/uzman" replace />;
    }
    return <>{children}</>;
  }

  // ── İşyeri Hekimi yönlendirme ──
  if (osgbRole === 'isyeri_hekimi') {
    if (location.pathname !== '/hekim') return <Navigate to="/hekim" replace />;
    return <>{children}</>;
  }

  // ── OSGB Admin yönlendirme ──
  if (osgbRole === 'osgb_admin') {
    if (!isOsgbPath) {
      return <Navigate to="/osgb-dashboard" replace />;
    }
    return <>{children}</>;
  }

  // ── Normal firma kullanıcısı ──
  const blockedForFirma = ['/osgb-dashboard', '/osgb-uzman', '/uzman', '/hekim'];
  if (blockedForFirma.includes(location.pathname)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
