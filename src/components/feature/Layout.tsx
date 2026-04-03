import { useState, useEffect, useRef, type ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { useApp } from '../../store/AppContext';

export default function Layout({ children }: { children: ReactNode }) {
  const { sidebarCollapsed, theme, activeModule } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isDark = theme === 'dark';
  const [animKey, setAnimKey] = useState(0);
  const prevModule = useRef(activeModule);

  useEffect(() => {
    if (prevModule.current !== activeModule) {
      prevModule.current = activeModule;
      setAnimKey(k => k + 1);
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

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-app)', transition: 'background 0.3s ease' }}>

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
        <div className="px-4 md:px-6 py-5 max-w-[1680px]">
          <div key={animKey}>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
