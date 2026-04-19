import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';

interface TabDef { label: string; path: string; icon: string }

const adminTabs: TabDef[] = [
  { label: 'Genel Bakış', path: '/admin', icon: 'ri-dashboard-line' },
  { label: 'Firmalar', path: '/admin/firmalar', icon: 'ri-building-2-line' },
  { label: 'Personel', path: '/admin/personel', icon: 'ri-team-line' },
  { label: 'Ziyaretler', path: '/admin/ziyaretler', icon: 'ri-map-pin-time-line' },
  { label: 'Raporlar', path: '/admin/raporlar', icon: 'ri-file-chart-line' },
  { label: 'Aktivite', path: '/admin/activity-logs', icon: 'ri-file-list-3-line' },
  { label: 'Ayarlar', path: '/admin/ayarlar', icon: 'ri-settings-3-line' },
];

const specialistTabs: TabDef[] = [
  { label: 'Panelim', path: '/specialist', icon: 'ri-dashboard-line' },
];

const doctorTabs: TabDef[] = [
  { label: 'Panelim', path: '/doctor', icon: 'ri-dashboard-line' },
];

export default function NavTabs() {
  const location = useLocation();
  const { isAdmin, isSpecialist, isDoctor } = useAuth();

  let tabs: TabDef[] = adminTabs;
  if (isSpecialist) tabs = specialistTabs;
  else if (isDoctor) tabs = doctorTabs;
  else if (isAdmin) tabs = adminTabs;

  const isActive = (tab: TabDef) => {
    if (tab.path === '/admin' || tab.path === '/specialist' || tab.path === '/doctor') {
      return location.pathname === tab.path;
    }
    return location.pathname.startsWith(tab.path);
  };

  return (
    <nav
      className="hidden md:flex items-end px-6 gap-0.5"
      style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)', height: '44px' }}
    >
      {tabs.map((tab) => {
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
    </nav>
  );
}
