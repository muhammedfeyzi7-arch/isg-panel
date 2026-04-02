import { useState, type ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { useApp } from '../../store/AppContext';

export default function Layout({ children }: { children: ReactNode }) {
  const { sidebarCollapsed } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-app)', transition: 'background 0.3s ease' }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — desktop always visible, mobile slide-in */}
      <div
        className={`fixed left-0 top-0 h-screen z-40 transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <Sidebar onMobileClose={() => setMobileOpen(false)} />
      </div>

      {/* Header */}
      <Header onMobileMenuToggle={() => setMobileOpen(v => !v)} />

      {/* Main content */}
      <main
        className={`transition-all duration-300 pt-14 min-h-screen ${
          sidebarCollapsed ? 'lg:pl-[68px]' : 'lg:pl-[260px]'
        }`}
      >
        <div className="px-4 md:px-6 py-5 max-w-[1680px] page-enter">
          {children}
        </div>
      </main>
    </div>
  );
}
