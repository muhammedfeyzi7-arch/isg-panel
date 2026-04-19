import { useState, useEffect } from 'react';
import { BrowserRouter, useNavigate, useLocation } from 'react-router-dom';
import { AppRoutes } from './router';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';
import Topbar from '@/components/feature/Topbar';
import NavTabs from '@/components/feature/NavTabs';
import MobileBottomNav from '@/components/feature/MobileBottomNav';
import { AppProvider, useApp } from '@/store/AppContext';
import { AuthProvider, useAuth } from '@/store/AuthContext';
import ToastContainer from '@/components/base/ToastContainer';
import LoginPage from '@/pages/login/page';

function AppShell() {
  const [darkMode, setDarkMode] = useState(false);
  const { session, loading, isConfigured, isAdmin, isSpecialist, isDoctor } = useAuth();
  const { setSessionInfo } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  // Specialist ve Doctor kendi layout'larını yönetiyor — admin shell gösterilmez
  const isSpecialistRoute = location.pathname.startsWith('/specialist');
  const isDoctorRoute = location.pathname.startsWith('/doctor');

  useEffect(() => {
    if (session) {
      setSessionInfo(session.organizationId, session.userId, session.role);
    }
  }, [session, setSessionInfo]);

  useEffect(() => {
    if (!session || loading) return;
    const path = location.pathname;
    const isRootOrLogin = path === '/' || path === '/login' || path === '';
    if (isRootOrLogin) {
      if (isAdmin) navigate('/admin', { replace: true });
      else if (isSpecialist) navigate('/specialist', { replace: true });
      else if (isDoctor) navigate('/doctor', { replace: true });
    }
  }, [session, loading, isAdmin, isSpecialist, isDoctor, navigate, location.pathname]);

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

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

  // Specialist ve Doctor panelleri kendi layout'larını kullanıyor
  if (isSpecialistRoute || isDoctorRoute) {
    return (
      <>
        <AppRoutes />
        <ToastContainer />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg)' }}>
      <Topbar darkMode={darkMode} onToggleDark={() => setDarkMode(!darkMode)} />
      <NavTabs />
      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        <AppRoutes />
      </main>
      <MobileBottomNav />
      <ToastContainer />
    </div>
  );
}

function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <BrowserRouter basename={__BASE_PATH__}>
        <AuthProvider>
          <AppProvider>
            <AppShell />
          </AppProvider>
        </AuthProvider>
      </BrowserRouter>
    </I18nextProvider>
  );
}

export default App;
