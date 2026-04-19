import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  exact?: boolean;
}

const mainTabs: NavItem[] = [
  { label: 'Genel Bakış', path: '/specialist', icon: 'ri-dashboard-line', exact: true },
  { label: 'Firmalar', path: '/specialist/firms', icon: 'ri-building-2-line' },
  { label: 'Saha', path: '/specialist/field-inspection', icon: 'ri-map-pin-2-line' },
  { label: 'Raporlar', path: '/specialist/reports', icon: 'ri-file-chart-line' },
];

interface MenuGroup {
  title: string;
  items: NavItem[];
}

const menuGroups: MenuGroup[] = [
  {
    title: 'Operasyon',
    items: [
      { label: 'Personel', path: '/specialist/personnel', icon: 'ri-team-line' },
      { label: 'Tutanaklar', path: '/specialist/minutes', icon: 'ri-file-text-line' },
      { label: 'Firma Belgeleri', path: '/specialist/company-documents', icon: 'ri-file-list-3-line' },
      { label: 'Belge Takibi', path: '/specialist/document-tracking', icon: 'ri-file-search-line' },
      { label: 'Eğitimler', path: '/specialist/trainings', icon: 'ri-graduation-cap-line' },
      { label: 'Sağlık Durumu', path: '/specialist/health-status', icon: 'ri-heart-pulse-line' },
    ],
  },
  {
    title: 'Saha',
    items: [
      { label: 'Saha Denetimi', path: '/specialist/field-inspection', icon: 'ri-search-eye-line' },
      { label: 'Ekipman', path: '/specialist/equipment', icon: 'ri-tools-line' },
      { label: 'İş İzinleri', path: '/specialist/work-permits', icon: 'ri-file-shield-2-line' },
    ],
  },
  {
    title: 'Yönetim',
    items: [
      { label: 'Raporlar', path: '/specialist/reports', icon: 'ri-file-chart-line' },
      { label: 'Dökümanlar', path: '/specialist/documents', icon: 'ri-folder-line' },
      { label: 'Çöp Kutusu', path: '/specialist/trash', icon: 'ri-delete-bin-line' },
      { label: 'Ayarlar', path: '/specialist/settings', icon: 'ri-user-settings-line' },
    ],
  },
];

export default function SpecialistMobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, session } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (item: NavItem) => {
    if (item.exact) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  };

  const isMenuActive = menuGroups
    .flatMap((g) => g.items)
    .some((item) => location.pathname.startsWith(item.path) && !mainTabs.some((t) => t.path === item.path));

  const handleMenuNav = (path: string) => {
    navigate(path);
    setMenuOpen(false);
  };

  const displayName = session?.fullName ?? 'Uzman';
  const initials = displayName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();

  return (
    <>
      {/* Overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Menu Sheet */}
      {menuOpen && (
        <div
          className="fixed bottom-16 left-0 right-0 z-50 md:hidden rounded-t-2xl overflow-hidden overflow-y-auto"
          style={{
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)',
            borderBottom: 'none',
            maxHeight: '75vh',
          }}
        >
          {/* User Header */}
          <div
            className="flex items-center gap-3 px-5 py-4 sticky top-0"
            style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--card)' }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'var(--text-primary)' }}
            >
              <span className="text-sm font-semibold" style={{ color: 'var(--card)' }}>{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{displayName}</p>
              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>İş Güvenliği Uzmanı</p>
            </div>
          </div>

          {/* Menu Groups */}
          {menuGroups.map((group) => (
            <div key={group.title}>
              <p className="px-5 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {group.title}
              </p>
              {group.items.map((item) => {
                const active = location.pathname.startsWith(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => handleMenuNav(item.path)}
                    className="w-full flex items-center gap-4 px-5 py-3 transition-colors cursor-pointer"
                    style={{
                      backgroundColor: active ? 'var(--surface)' : 'transparent',
                      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}
                  >
                    <div
                      className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
                      style={{
                        backgroundColor: active ? 'var(--text-primary)' : 'var(--surface)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <i className={`${item.icon} text-sm`} style={{ color: active ? 'var(--card)' : 'var(--text-muted)' }} />
                    </div>
                    <span className="text-sm font-medium">{item.label}</span>
                    {active && <i className="ri-check-line ml-auto text-sm" style={{ color: 'var(--text-primary)' }} />}
                  </button>
                );
              })}
            </div>
          ))}

          {/* Logout */}
          <div style={{ borderTop: '1px solid var(--border-subtle)' }} className="py-2 pb-4 mt-2">
            <button
              onClick={async () => { await logout(); setMenuOpen(false); }}
              className="w-full flex items-center gap-4 px-5 py-3 transition-colors cursor-pointer"
              style={{ color: 'var(--danger)' }}
            >
              <div
                className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
                style={{ backgroundColor: 'var(--danger-bg)', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                <i className="ri-logout-box-line text-sm" style={{ color: 'var(--danger)' }} />
              </div>
              <span className="text-sm font-medium">Çıkış Yap</span>
            </button>
          </div>
        </div>
      )}

      {/* Bottom Nav Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden flex items-center"
        style={{
          backgroundColor: 'var(--card)',
          borderTop: '1px solid var(--border)',
          height: '64px',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {mainTabs.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-colors cursor-pointer"
              style={{ color: active ? 'var(--text-primary)' : 'var(--text-muted)' }}
            >
              <div className="w-6 h-6 flex items-center justify-center relative">
                <i className={`${item.icon} text-xl`} />
                {active && (
                  <span
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ backgroundColor: 'var(--text-primary)' }}
                  />
                )}
              </div>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}

        {/* Menü butonu */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-colors cursor-pointer"
          style={{ color: isMenuActive || menuOpen ? 'var(--text-primary)' : 'var(--text-muted)' }}
        >
          <div className="w-6 h-6 flex items-center justify-center relative">
            <i className={`${menuOpen ? 'ri-close-line' : 'ri-menu-line'} text-xl`} />
            {isMenuActive && !menuOpen && (
              <span
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                style={{ backgroundColor: 'var(--text-primary)' }}
              />
            )}
          </div>
          <span className="text-xs font-medium">Menü</span>
        </button>
      </nav>
    </>
  );
}
