import { useState, useEffect, useRef, type ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { useApp } from '../../store/AppContext';
import { DashboardSkeleton, PageSkeleton } from '../base/Skeleton';

function ConnectionBanner() {
  const { realtimeStatus } = useApp();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBackOnline, setShowBackOnline] = useState(false);
  const [showRealtimeReconnected, setShowRealtimeReconnected] = useState(false);
  const prevRealtimeRef = useRef(realtimeStatus);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Delay realtime disconnect banner — avoid flicker on initial connect
  const [realtimeDisconnectVisible, setRealtimeDisconnectVisible] = useState(false);
  const realtimeDisconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Test modu — geliştirici simülasyonu
  const [testMode, setTestMode] = useState<null | 'offline' | 'realtime-down' | 'back-online' | 'realtime-up'>(null);
  const testTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerTest = (mode: 'offline' | 'realtime-down') => {
    setTestMode(mode);
    if (testTimerRef.current) clearTimeout(testTimerRef.current);
    testTimerRef.current = setTimeout(() => {
      setTestMode(mode === 'offline' ? 'back-online' : 'realtime-up');
      testTimerRef.current = setTimeout(() => setTestMode(null), 3500);
    }, 3000);
  };

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

  // Realtime status change tracking
  useEffect(() => {
    const prev = prevRealtimeRef.current;
    prevRealtimeRef.current = realtimeStatus;

    if (realtimeStatus === 'disconnected') {
      // Show disconnect banner after 2s delay to avoid flicker
      if (realtimeDisconnectTimerRef.current) clearTimeout(realtimeDisconnectTimerRef.current);
      realtimeDisconnectTimerRef.current = setTimeout(() => {
        setRealtimeDisconnectVisible(true);
      }, 2000);
    } else {
      if (realtimeDisconnectTimerRef.current) clearTimeout(realtimeDisconnectTimerRef.current);
      setRealtimeDisconnectVisible(false);
    }

    // Was disconnected, now connected → show "reconnected" message
    if (prev === 'disconnected' && realtimeStatus === 'connected') {
      setShowRealtimeReconnected(true);
      if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
      realtimeTimerRef.current = setTimeout(() => setShowRealtimeReconnected(false), 3500);
    }

    return () => {
      if (realtimeDisconnectTimerRef.current) clearTimeout(realtimeDisconnectTimerRef.current);
      if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
    };
  }, [realtimeStatus]);

  // Priority: test mode > internet offline > realtime disconnected > back online > realtime reconnected
  if (testMode === 'offline') {
    return (
      <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2.5 py-2.5 px-4"
        style={{ background: 'linear-gradient(90deg, rgba(239,68,68,0.97), rgba(220,38,38,0.97))', backdropFilter: 'blur(8px)' }}>
        <div className="w-5 h-5 flex items-center justify-center rounded-full flex-shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }}>
          <i className="ri-wifi-off-line text-xs text-white" />
        </div>
        <p className="text-xs font-semibold text-white">
          [TEST] İnternet bağlantısı yok — değişiklikler bağlantı gelince otomatik kaydedilecek
        </p>
        <span className="text-[10px] text-white/60 ml-1">3sn sonra geri gelecek...</span>
      </div>
    );
  }

  if (testMode === 'realtime-down') {
    return (
      <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2.5 py-2 px-4"
        style={{ background: 'linear-gradient(90deg, rgba(245,158,11,0.97), rgba(217,119,6,0.97))', backdropFilter: 'blur(8px)' }}>
        <div className="w-5 h-5 flex items-center justify-center rounded-full flex-shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }}>
          <i className="ri-refresh-line text-xs text-white animate-spin" />
        </div>
        <p className="text-xs font-semibold text-white">
          [TEST] Canlı bağlantı kesildi, yeniden bağlanıyor...
        </p>
        <span className="text-[10px] text-white/60 ml-1">3sn sonra geri gelecek...</span>
      </div>
    );
  }

  if (testMode === 'back-online') {
    return (
      <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 py-2.5 px-4"
        style={{ background: 'linear-gradient(90deg, rgba(16,185,129,0.97), rgba(5,150,105,0.97))', backdropFilter: 'blur(8px)' }}>
        <i className="ri-checkbox-circle-fill text-sm text-white" />
        <p className="text-xs font-semibold text-white">[TEST] İnternet bağlantısı yeniden kuruldu</p>
      </div>
    );
  }

  if (testMode === 'realtime-up') {
    return (
      <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 py-2 px-4"
        style={{ background: 'linear-gradient(90deg, rgba(16,185,129,0.97), rgba(5,150,105,0.97))', backdropFilter: 'blur(8px)' }}>
        <i className="ri-signal-wifi-fill text-sm text-white" />
        <p className="text-xs font-semibold text-white">[TEST] Canlı bağlantı yeniden kuruldu</p>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div
        className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2.5 py-2.5 px-4"
        style={{
          background: 'linear-gradient(90deg, rgba(239,68,68,0.97), rgba(220,38,38,0.97))',
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

  if (realtimeDisconnectVisible && realtimeStatus === 'disconnected') {
    return (
      <div
        className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2.5 py-2 px-4"
        style={{
          background: 'linear-gradient(90deg, rgba(245,158,11,0.97), rgba(217,119,6,0.97))',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div className="w-5 h-5 flex items-center justify-center rounded-full flex-shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }}>
          <i className="ri-refresh-line text-xs text-white animate-spin" />
        </div>
        <p className="text-xs font-semibold text-white">
          Canlı bağlantı kesildi, yeniden bağlanıyor...
        </p>
        <div className="flex items-center gap-1 ml-1">
          <span className="w-1.5 h-1.5 rounded-full bg-white opacity-70 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-white opacity-70 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-white opacity-70 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    );
  }

  if (showBackOnline) {
    return (
      <div
        className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 py-2.5 px-4"
        style={{
          background: 'linear-gradient(90deg, rgba(16,185,129,0.97), rgba(5,150,105,0.97))',
          backdropFilter: 'blur(8px)',
        }}
      >
        <i className="ri-checkbox-circle-fill text-sm text-white" />
        <p className="text-xs font-semibold text-white">
          İnternet bağlantısı yeniden kuruldu — bekleyen değişiklikler kaydediliyor...
        </p>
      </div>
    );
  }

  if (showRealtimeReconnected) {
    return (
      <div
        className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 py-2 px-4"
        style={{
          background: 'linear-gradient(90deg, rgba(16,185,129,0.97), rgba(5,150,105,0.97))',
          backdropFilter: 'blur(8px)',
        }}
      >
        <i className="ri-signal-wifi-fill text-sm text-white" />
        <p className="text-xs font-semibold text-white">
          Canlı bağlantı yeniden kuruldu — veriler anlık güncelleniyor
        </p>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-1.5">
      <button
        onClick={() => triggerTest('offline')}
        className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg cursor-pointer whitespace-nowrap"
        style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#F87171' }}
      >
        Test: İnternet Kes
      </button>
      <button
        onClick={() => triggerTest('realtime-down')}
        className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg cursor-pointer whitespace-nowrap"
        style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#FCD34D' }}
      >
        Test: Realtime Kes
      </button>
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
      <ConnectionBanner />

      {/* Mobile overlay */}
      <div
        className="fixed inset-0 lg:hidden"
        style={{
          zIndex: 41,
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
        className={`transition-all duration-300 pt-[52px] min-h-screen ${
          sidebarCollapsed ? 'lg:pl-[56px]' : 'lg:pl-[220px]'
        }`}
      >
        <div className="px-4 md:px-6 py-4 max-w-[1680px]">
          <div key={animKey} className="page-enter">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
}
