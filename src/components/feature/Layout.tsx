import { useState, useEffect, useRef, type ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { useApp } from '../../store/AppContext';
import { DashboardSkeleton, PageSkeleton } from '../base/Skeleton';

function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBackOnline, setShowBackOnline] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleOffline = () => {
      setIsOnline(false);
      setShowBackOnline(false);
    };
    const handleOnline = () => {
      setIsOnline(true);
      setShowBackOnline(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setShowBackOnline(false), 3500);
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (isOnline && !showBackOnline) return null;

  if (!isOnline) {
    return (
      <div
        className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2.5 py-2.5 px-4"
        style={{
          background: 'linear-gradient(90deg, rgba(239,68,68,0.95), rgba(220,38,38,0.95))',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div className="w-5 h-5 flex items-center justify-center rounded-full flex-shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }}>
          <i className="ri-wifi-off-line text-xs text-white" />
        </div>
        <p className="text-xs font-semibold text-white">
          İnternet bağlantısı yok — değişiklikler bağlantı gelince otomatik kaydedilecek
        </p>
        <div className="flex items-center gap-1 ml-1">
          <span className="w-1.5 h-1.5 rounded-full bg-white opacity-60 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-white opacity-60 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-white opacity-60 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 py-2.5 px-4"
      style={{
        background: 'linear-gradient(90deg, rgba(16,185,129,0.95), rgba(5,150,105,0.95))',
        backdropFilter: 'blur(8px)',
      }}
    >
      <i className="ri-checkbox-circle-fill text-sm text-white" />
      <p className="text-xs font-semibold text-white">
        Bağlantı yeniden kuruldu — bekleyen değişiklikler kaydediliyor...
      </p>
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { sidebarCollapsed, theme, activeModule, orgLoading } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isDark = theme === 'dark';
  const [animKey, setAnimKey] = useState(0);
  const prevModule = useRef(activeModule);
  const [moduleLoading, setModuleLoading] = useState(false);
  const loadingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (prevModule.current !== activeModule) {
      prevModule.current = activeModule;
      setAnimKey(k => k + 1);
      // Modül değişince kısa bir loading hissi ver
      setModuleLoading(true);
      if (loadingTimer.current) clearTimeout(loadingTimer.current);
      loadingTimer.current = setTimeout(() => setModuleLoading(false), 420);
    }
    return () => {
      if (loadingTimer.current) clearTimeout(loadingTimer.current);
    };
  }, [activeModule]);

  useEffect(() => {
    const handler = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const renderContent = () => {
    if (orgLoading) {
      return activeModule === 'dashboard' ? <DashboardSkeleton /> : <PageSkeleton />;
    }
    if (moduleLoading) {
      return activeModule === 'dashboard' ? <DashboardSkeleton /> : <PageSkeleton />;
    }
    return children;
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-app)', transition: 'background 0.3s ease' }}>
      <OfflineBanner />

      {/* Mobile overlay */}
      <div
        className="fixed inset-0 lg:hidden"
        style={{
          zIndex: 39,
          background: 'rgba(0,0,0,0.62)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          opacity: mobileOpen ? 1 : 0,
          pointerEvents: mobileOpen ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
        onClick={() => setMobileOpen(false)}
      />

      <Sidebar
        onMobileClose={() => setMobileOpen(false)}
        isDark={isDark}
        mobileOpen={mobileOpen}
      />

      <Header onMobileMenuToggle={() => setMobileOpen(v => !v)} />

      <main
        className={`transition-all duration-300 pt-16 min-h-screen ${
          sidebarCollapsed ? 'lg:pl-[68px]' : 'lg:pl-[252px]'
        }`}
      >
        <div className="px-5 md:px-8 py-6 max-w-[1680px]">
          <div key={animKey} className="page-enter">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
}
