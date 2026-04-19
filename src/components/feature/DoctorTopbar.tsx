import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';

interface NavTab {
  label: string;
  path: string;
  icon: string;
}

const doctorTabs: NavTab[] = [
  { label: 'Genel Bakış', path: '/doctor', icon: 'ri-dashboard-line' },
  { label: 'Firmalar', path: '/doctor/firms', icon: 'ri-building-2-line' },
  { label: 'Saha Ziyareti', path: '/doctor/field-visit', icon: 'ri-qr-code-line' },
  { label: 'Personel', path: '/doctor/personnel', icon: 'ri-team-line' },
  { label: 'Sağlık Durumu', path: '/doctor/health-status', icon: 'ri-heart-pulse-line' },
  { label: 'İş Kazası Rapor', path: '/doctor/incident-reports', icon: 'ri-file-warning-line' },
];

interface DoctorTopbarProps {
  darkMode: boolean;
  onToggleDark: () => void;
}

export default function DoctorTopbar({ darkMode, onToggleDark }: DoctorTopbarProps) {
  const { session, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const displayName = session?.fullName ?? 'Hekim';
  const displayOrg = session?.organizationName ?? 'OSGB Panel';
  const initials = displayName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

  const isActive = (tab: NavTab) =>
    tab.path === '/doctor' ? location.pathname === '/doctor' : location.pathname.startsWith(tab.path);

  const handleLogout = async () => {
    await logout();
    setProfileOpen(false);
  };

  return (
    <header style={{ backgroundColor: 'var(--card)', borderBottom: '1px solid var(--border)' }} className="z-40 relative">
      {/* Top row */}
      <div className="h-14 flex items-center px-6 gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--text-primary)' }}>
            <i className="ri-shield-check-fill text-sm" style={{ color: 'var(--card)' }} />
          </div>
          <div>
            <span className="font-semibold text-sm tracking-tight block leading-none" style={{ color: 'var(--text-primary)' }}>{displayOrg}</span>
            <span className="text-xs leading-none" style={{ color: 'var(--text-muted)' }}>Hekim Paneli</span>
          </div>
        </div>

        <div className="flex-1" />

        {/* Right actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleDark}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <i className={darkMode ? 'ri-sun-line text-base' : 'ri-moon-line text-base'} />
          </button>

          <div className="w-px h-5 mx-1" style={{ backgroundColor: 'var(--border)' }} />

          {/* Profile */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 pl-2 pr-1.5 py-1.5 rounded-lg transition-colors cursor-pointer"
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--purple)' }}>
                <span className="text-xs font-semibold" style={{ color: '#fff' }}>{initials}</span>
              </div>
              <span className="text-sm font-medium hidden sm:block" style={{ color: 'var(--text-primary)' }}>{displayName}</span>
              <div className="w-4 h-4 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
                <i className="ri-arrow-down-s-line text-sm" />
              </div>
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-10 w-56 rounded-xl z-50 overflow-hidden" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
                <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{displayName}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{session?.email}</p>
                  <span className="inline-block text-xs px-2 py-0.5 rounded-full mt-1.5" style={{ backgroundColor: 'var(--purple-bg)', color: 'var(--purple-text)', border: '1px solid rgba(139,92,246,0.2)' }}>
                    İş Hekimi
                  </span>
                </div>
                <div className="py-1">
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm transition-colors cursor-pointer flex items-center gap-2"
                    style={{ color: 'var(--danger)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--danger-bg)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-logout-box-line text-xs" /></div>
                    Çıkış Yap
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Nav tabs row - hidden on mobile */}
      <div className="hidden md:flex items-end px-6 gap-0.5" style={{ backgroundColor: 'var(--surface)', borderTop: '1px solid var(--border-subtle)', height: '44px' }}>
        {doctorTabs.map((tab) => {
          const active = isActive(tab);
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className="flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium rounded-t-md transition-colors whitespace-nowrap cursor-pointer"
              style={{
                color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                backgroundColor: active ? 'var(--card)' : 'transparent',
                borderTop: active ? '1px solid var(--border)' : '1px solid transparent',
                borderLeft: active ? '1px solid var(--border)' : '1px solid transparent',
                borderRight: active ? '1px solid var(--border)' : '1px solid transparent',
                borderBottom: active ? '1px solid var(--card)' : '1px solid transparent',
                marginBottom: active ? '-1px' : '0',
              }}
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className={`${tab.icon} text-sm`} />
              </div>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
