import { useState, useEffect, useRef, type ReactNode } from 'react';
// PageSkeleton & DashboardSkeleton still used for orgLoading state
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import GeziciUzmanBanner from './GeziciUzmanBanner';
import { useApp } from '../../store/AppContext';
import { DashboardSkeleton, PageSkeleton } from '../base/Skeleton';
import { useOrgTransition } from '../../hooks/useOrgTransition';

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

  return null;
}

export default function Layout({ children }: { children: ReactNode }) {
  const { sidebarCollapsed, theme, activeModule, orgLoading, org } = useApp();
  const navigate = useNavigate();

  // ── Özel Rol Guard: Normal layout'ta olmamalı ──
  useEffect(() => {
    if (orgLoading) return;
    if (org?.osgbRole === 'isyeri_hekimi') {
      navigate('/hekim', { replace: true });
    }
    if (org?.osgbRole === 'gezici_uzman') {
      navigate('/uzman', { replace: true });
    }
    if (org?.osgbRole === 'osgb_admin') {
      navigate('/osgb-dashboard', { replace: true });
    }
  }, [org?.osgbRole, orgLoading, navigate]);

  // Gezici uzman + çoklu firma → banner 28px ekstra padding gerekir
  const hasBanner = org?.osgbRole === 'gezici_uzman' && (org?.activeFirmIds?.length ?? 0) > 1;
  // Firma değişimi fade animasyonu
  const { isTransitioning, transitionKey } = useOrgTransition({ duration: 160 });
  const [mobileOpen, setMobileOpen] = useState(false);
  const isDark = theme === 'dark';
  const [animKey, setAnimKey] = useState(0);
  const prevModule = useRef(activeModule);

  useEffect(() => {
    if (prevModule.current !== activeModule) {
      prevModule.current = activeModule;
      setAnimKey(k => k + 1);
      // NOT: Yapay 420ms moduleLoading skeleton KALDIRILDI.
      // Veriler zaten hafızada mevcut — skeleton gereksiz gecikme yaratıyordu.
      // Lazy load sayfalar için Suspense fallback (home/page.tsx) yeterli.
    }
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
    // Sadece org yüklenirken skeleton göster — modül geçişinde skeleton YOK
    // (lazy load sayfalar için Suspense fallback home/page.tsx'te tanımlı)
    if (orgLoading) {
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
          background: mobileOpen ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0)',
          backdropFilter: mobileOpen ? 'blur(8px) saturate(0.7)' : 'blur(0px)',
          WebkitBackdropFilter: mobileOpen ? 'blur(8px) saturate(0.7)' : 'blur(0px)',
          opacity: mobileOpen ? 1 : 0,
          pointerEvents: mobileOpen ? 'auto' : 'none',
          transition: mobileOpen
            ? 'opacity 0.32s cubic-bezier(0.22,1,0.36,1), backdrop-filter 0.32s cubic-bezier(0.22,1,0.36,1)'
            : 'opacity 0.22s ease, backdrop-filter 0.22s ease',
        }}
        onClick={() => setMobileOpen(false)}
      />

      <Sidebar
        onMobileClose={() => setMobileOpen(false)}
        isDark={isDark}
        mobileOpen={mobileOpen}
      />

      <Header onMobileMenuToggle={() => setMobileOpen(v => !v)} />

      {/* Context bar — gezici uzman + çoklu firma durumunda header'ın hemen altında */}
      <GeziciUzmanBanner />

      <main
        className={`transition-all duration-300 min-h-screen ${
          sidebarCollapsed ? 'lg:pl-[76px]' : 'lg:pl-[232px]'
        }`}
        style={{ paddingTop: hasBanner ? '88px' : '76px', paddingRight: '12px', paddingBottom: '12px' }}
      >
        <div className="px-2 sm:px-3 md:px-5 py-2 sm:py-3 max-w-[1680px]">
          <div
            key={`${animKey}_${transitionKey}`}
            className="page-enter"
            style={{
              opacity: isTransitioning ? 0 : 1,
              transition: isTransitioning
                ? 'opacity 0.12s ease'
                : 'opacity 0.22s ease',
            }}
          >
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
}
