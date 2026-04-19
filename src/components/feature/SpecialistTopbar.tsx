import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';

interface NavItem {
  label: string;
  path?: string;
  icon: string;
  children?: { label: string; path: string; icon: string; desc: string }[];
}

const navItems: NavItem[] = [
  {
    label: 'Genel Bakış',
    path: '/specialist',
    icon: 'ri-dashboard-line',
  },
  {
    label: 'Firmalar',
    path: '/specialist/firms',
    icon: 'ri-building-2-line',
  },
  {
    label: 'Operasyon',
    icon: 'ri-briefcase-line',
    children: [
      { label: 'Personel', path: '/specialist/personnel', icon: 'ri-team-line', desc: 'Firma çalışanları' },
      { label: 'Tutanaklar', path: '/specialist/minutes', icon: 'ri-file-text-line', desc: 'Tutanak kayıtları' },
      { label: 'Firma Belgeleri', path: '/specialist/company-documents', icon: 'ri-file-list-3-line', desc: 'Firma bazlı belgeler' },
      { label: 'Belge Takibi', path: '/specialist/document-tracking', icon: 'ri-file-search-line', desc: 'Eksik ve yaklaşan belgeler' },
      { label: 'Eğitimler', path: '/specialist/trainings', icon: 'ri-graduation-cap-line', desc: 'Eğitim planları ve kayıtlar' },
      { label: 'Sağlık Durumu', path: '/specialist/health-status', icon: 'ri-heart-pulse-line', desc: 'Personel sağlık uygunluğu' },
    ],
  },
  {
    label: 'Saha',
    icon: 'ri-map-pin-2-line',
    children: [
      { label: 'Saha Denetimi', path: '/specialist/field-inspection', icon: 'ri-search-eye-line', desc: 'Aktif saha işlemleri' },
      { label: 'Ekipman', path: '/specialist/equipment', icon: 'ri-tools-line', desc: 'Ekipman takibi' },
      { label: 'İş İzinleri', path: '/specialist/work-permits', icon: 'ri-file-shield-2-line', desc: 'İş izni yönetimi' },
    ],
  },
  {
    label: 'Yönetim',
    icon: 'ri-settings-3-line',
    children: [
      { label: 'Raporlar', path: '/specialist/reports', icon: 'ri-file-chart-line', desc: 'Raporlar ve analizler' },
      { label: 'Dökümanlar', path: '/specialist/documents', icon: 'ri-folder-line', desc: 'Tüm dökümanlar' },
      { label: 'Çöp Kutusu', path: '/specialist/trash', icon: 'ri-delete-bin-line', desc: 'Silinen öğeler' },
      { label: 'Ayarlar', path: '/specialist/settings', icon: 'ri-user-settings-line', desc: 'Profil ve tercihler' },
    ],
  },
];

interface SpecialistTopbarProps {
  darkMode: boolean;
  onToggleDark: () => void;
}

export default function SpecialistTopbar({ darkMode, onToggleDark }: SpecialistTopbarProps) {
  const { session, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { setOpenMenu(null); }, [location.pathname]);

  const displayName = session?.fullName ?? 'Uzman';
  const displayOrg = session?.organizationName ?? 'OSGB Panel';
  const initials = displayName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

  const isPathActive = (item: NavItem): boolean => {
    if (item.path) return location.pathname === item.path;
    return item.children?.some((c) => location.pathname.startsWith(c.path)) ?? false;
  };

  const handleLogout = async () => {
    await logout();
    setProfileOpen(false);
  };

  return (
    <header style={{ backgroundColor: 'var(--card)', borderBottom: '1px solid var(--border)' }} className="z-40 relative">
      {/* Top row */}
      <div className="h-14 flex items-center px-6 gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2.5 min-w-[180px]">
          <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--text-primary)' }}>
            <i className="ri-shield-check-fill text-sm" style={{ color: 'var(--card)' }} />
          </div>
          <div>
            <span className="font-semibold text-sm tracking-tight block leading-none" style={{ color: 'var(--text-primary)' }}>{displayOrg}</span>
            <span className="text-xs leading-none" style={{ color: 'var(--text-muted)' }}>Uzman Paneli</span>
          </div>
        </div>

        {/* Spacer */}
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
              onClick={() => { setProfileOpen(!profileOpen); setOpenMenu(null); }}
              className="flex items-center gap-2 pl-2 pr-1.5 py-1.5 rounded-lg transition-colors cursor-pointer"
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--text-primary)' }}>
                <span className="text-xs font-semibold" style={{ color: 'var(--card)' }}>{initials}</span>
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
                  <span className="inline-block text-xs px-2 py-0.5 rounded-full mt-1.5" style={{ backgroundColor: 'var(--info-bg)', color: 'var(--info-text)', border: '1px solid rgba(14,165,233,0.2)' }}>
                    İş Güvenliği Uzmanı
                  </span>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => { navigate('/specialist/settings'); setProfileOpen(false); }}
                    className="w-full text-left px-4 py-2 text-sm transition-colors cursor-pointer flex items-center gap-2"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-user-settings-line text-xs" /></div>
                    Ayarlar
                  </button>
                  <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '4px 0' }} />
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

      {/* Nav row - hidden on mobile */}
      <div className="hidden md:flex h-11 items-center px-6 gap-1" style={{ backgroundColor: 'var(--surface)', borderTop: '1px solid var(--border-subtle)' }} ref={menuRef}>
        {navItems.map((item) => {
          const active = isPathActive(item);
          const isOpen = openMenu === item.label;

          if (item.path) {
            return (
              <Link
                key={item.label}
                to={item.path}
                className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                style={{
                  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                  backgroundColor: active ? 'var(--card)' : 'transparent',
                  border: active ? '1px solid var(--border)' : '1px solid transparent',
                }}
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className={`${item.icon} text-sm`} />
                </div>
                {item.label}
              </Link>
            );
          }

          return (
            <div key={item.label} className="relative">
              <button
                onClick={() => setOpenMenu(isOpen ? null : item.label)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                style={{
                  color: active || isOpen ? 'var(--text-primary)' : 'var(--text-muted)',
                  backgroundColor: active || isOpen ? 'var(--card)' : 'transparent',
                  border: active || isOpen ? '1px solid var(--border)' : '1px solid transparent',
                }}
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className={`${item.icon} text-sm`} />
                </div>
                {item.label}
                <div className="w-3 h-3 flex items-center justify-center ml-0.5">
                  <i className={`ri-arrow-down-s-line text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
                {active && !isOpen && (
                  <span className="w-1.5 h-1.5 rounded-full ml-0.5" style={{ backgroundColor: 'var(--info)' }} />
                )}
              </button>

              {isOpen && item.children && (
                <div
                  className="absolute top-full left-0 mt-1.5 rounded-xl z-50 overflow-hidden"
                  style={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                    minWidth: '260px',
                  }}
                >
                  <div className="p-1.5">
                    {item.children.map((child) => {
                      const childActive = location.pathname === child.path;
                      return (
                        <Link
                          key={child.path}
                          to={child.path}
                          className="flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer"
                          style={{
                            backgroundColor: childActive ? 'var(--surface)' : 'transparent',
                          }}
                          onMouseEnter={(e) => { if (!childActive) e.currentTarget.style.backgroundColor = 'var(--surface)'; }}
                          onMouseLeave={(e) => { if (!childActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0 mt-0.5" style={{ backgroundColor: childActive ? 'var(--text-primary)' : 'var(--surface)', border: '1px solid var(--border)' }}>
                            <i className={`${child.icon} text-xs`} style={{ color: childActive ? 'var(--card)' : 'var(--text-muted)' }} />
                          </div>
                          <div>
                            <p className="text-sm font-medium" style={{ color: childActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{child.label}</p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{child.desc}</p>
                          </div>
                          {childActive && (
                            <div className="ml-auto w-4 h-4 flex items-center justify-center mt-1">
                              <i className="ri-check-line text-xs" style={{ color: 'var(--text-primary)' }} />
                            </div>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </header>
  );
}
