import { type ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import ForcePasswordChange from './ForcePasswordChange';
import { useApp } from '../../store/AppContext';

export default function Layout({ children }: { children: ReactNode }) {
  const { sidebarCollapsed, mustChangePassword } = useApp();
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-app)', transition: 'background 0.3s ease' }}>
      <Sidebar />
      <Header />
      <main
        className={`transition-all duration-300 pt-16 min-h-screen ${sidebarCollapsed ? 'pl-[68px]' : 'pl-[260px]'}`}
      >
        <div className="px-6 py-6 max-w-[1680px] page-enter">
          {children}
        </div>
      </main>

      {/* Force password change overlay for temp-password users */}
      {mustChangePassword && <ForcePasswordChange />}
    </div>
  );
}
