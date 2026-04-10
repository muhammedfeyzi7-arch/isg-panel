import { useState } from 'react';
import { useAuth } from '@/store/AuthContext';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518';

type Tab = 'dashboard' | 'firmalar' | 'uzmanlar' | 'raporlar';

interface OsgbSidebarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  orgName: string;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const navGroups = [
  {
    label: 'GENEL',
    items: [
      { id: 'dashboard' as Tab, label: 'Genel Bakış', icon: 'ri-dashboard-3-line' },
    ],
  },
  {
    label: 'YÖNETİM',
    items: [
      { id: 'firmalar' as Tab, label: 'Müşteri Firmalar', icon: 'ri-building-2-line' },
      { id: 'uzmanlar' as Tab, label: 'Gezici Uzmanlar', icon: 'ri-user-star-line' },
    ],
  },
  {
    label: 'SİSTEM',
    items: [
      { id: 'raporlar' as Tab, label: 'Raporlar', icon: 'ri-bar-chart-2-line' },
    ],
  },
];

export default function OsgbSidebar({
  activeTab, setActiveTab, orgName, collapsed, setCollapsed, mobileOpen = false, onMobileClose,
}: OsgbSidebarProps) {
  const { logout, user } = useAuth();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const sidebarBg = 'var(--bg-sidebar, #0f172a)';
  const borderRight = '1px solid var(--border-subtle, rgba(255,255,255,0.07))';
  const groupLabelColor = 'rgba(255,255,255,0.32)';
  const groupDividerBg = 'rgba(255,255,255,0.08)';

  const handleNav = (tab: Tab) => {
    setActiveTab(tab);
    onMobileClose?.();
  };

  return (
    <aside
      className={`
        fixed left-0 top-0 h-screen flex flex-col z-[42]
        ${collapsed ? 'w-[48px]' : 'w-[168px]'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
      style={{
        background: sidebarBg,
        borderRight,
        transition: 'width 0.26s cubic-bezier(0.4,0,0.2,1), transform 0.26s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* ── Logo ── */}
      <div
        className={`flex items-center ${collapsed ? 'justify-center px-2' : 'px-3.5 gap-2'}`}
        style={{
          borderBottom: '1px solid var(--border-main, rgba(255,255,255,0.07))',
          height: '46px',
          minHeight: '46px',
          flexShrink: 0,
        }}
      >
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: '26px', height: '26px', borderRadius: '8px',
            background: 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(16,185,129,0.1))',
            border: '1px solid rgba(16,185,129,0.3)',
          }}
        >
          <img
            src={LOGO_URL}
            alt="ISG Logo"
            style={{ height: '15px', width: 'auto', objectFit: 'contain', filter: 'brightness(1.1) drop-shadow(0 0 5px rgba(16,185,129,0.4))' }}
          />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold leading-tight truncate" style={{ color: '#f1f5f9', letterSpacing: '-0.02em' }}>
              ISG Denetim
            </p>
            <p className="text-[8px] mt-0.5 font-semibold truncate" style={{ color: 'rgba(52,211,153,0.7)' }}>
              OSGB Paneli
            </p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto w-6 h-6 hidden lg:flex items-center justify-center rounded-lg cursor-pointer flex-shrink-0"
          style={{ color: 'rgba(52,211,153,0.6)', background: 'transparent' }}
        >
          <i className={`${collapsed ? 'ri-menu-unfold-line' : 'ri-menu-fold-line'} text-xs`} />
        </button>
      </div>

      {/* OSGB org adı */}
      {!collapsed && (
        <div
          className="mx-2 mt-2 px-3 py-2 rounded-xl"
          style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)' }}
        >
          <p className="text-[8.5px] font-bold uppercase tracking-widest" style={{ color: 'rgba(52,211,153,0.6)' }}>OSGB</p>
          <p className="text-[11px] font-bold truncate mt-0.5" style={{ color: '#6EE7B7' }}>{orgName}</p>
        </div>
      )}

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-2 px-1.5 space-y-3 mt-1">
        {navGroups.map(group => (
          <div key={group.label}>
            {!collapsed && (
              <p
                className="text-[8.5px] font-bold uppercase px-2 mb-1 select-none tracking-[0.14em]"
                style={{ color: groupLabelColor }}
              >
                {group.label}
              </p>
            )}
            {collapsed && (
              <div className="h-px mx-1.5 mb-2" style={{ background: groupDividerBg }} />
            )}
            <ul className="space-y-0.5">
              {group.items.map(item => {
                const isActive = activeTab === item.id;
                const isHovered = hoveredItem === item.id && !isActive;
                return (
                  <li key={item.id}>
                    <button
                      title={collapsed ? item.label : ''}
                      onClick={() => handleNav(item.id)}
                      onMouseEnter={() => setHoveredItem(item.id)}
                      onMouseLeave={() => setHoveredItem(null)}
                      className="w-full flex items-center gap-2 text-left cursor-pointer relative"
                      style={{
                        padding: collapsed ? '7px 0' : '6.5px 8px',
                        borderRadius: '8px',
                        justifyContent: collapsed ? 'center' : undefined,
                        background: isActive
                          ? 'linear-gradient(135deg, rgba(16,185,129,0.18), rgba(16,185,129,0.08))'
                          : isHovered ? 'rgba(255,255,255,0.06)' : 'transparent',
                        border: isActive
                          ? '1px solid rgba(16,185,129,0.35)'
                          : isHovered ? '1px solid rgba(255,255,255,0.055)' : '1px solid transparent',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {isActive && !collapsed && (
                        <span
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-full"
                          style={{ height: '60%', background: 'linear-gradient(180deg, #34D399, #10B981)' }}
                        />
                      )}
                      <span
                        className="flex items-center justify-center flex-shrink-0"
                        style={{
                          width: '16px', height: '16px',
                          color: isActive ? '#34D399' : '#4a8a6a',
                          transition: 'color 0.15s ease',
                          marginLeft: isActive && !collapsed ? '5px' : undefined,
                        }}
                      >
                        <i className={`${item.icon} text-[13px]`} />
                      </span>
                      {!collapsed && (
                        <span
                          className="text-[11px] flex-1 leading-none truncate"
                          style={{
                            color: isActive ? '#A7F3D0' : '#4a8a6a',
                            fontWeight: isActive ? 600 : 500,
                            transition: 'color 0.15s ease',
                          }}
                        >
                          {item.label}
                        </span>
                      )}
                      {!collapsed && isActive && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#10B981' }} />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* ── Profile + Logout ── */}
      <div
        className={`mx-2 mb-2.5 rounded-lg flex items-center gap-2 ${collapsed ? 'justify-center p-1.5' : 'px-2.5 py-2'}`}
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.055)',
        }}
      >
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
        >
          {(user?.email ?? 'O').charAt(0).toUpperCase()}
        </div>
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold truncate leading-tight" style={{ color: '#e2e8f0' }}>
                {user?.email?.split('@')[0] ?? 'OSGB Admin'}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#10B981' }} />
                <p className="text-[9px] font-semibold truncate" style={{ color: '#10B981' }}>OSGB Admin</p>
              </div>
            </div>
            <button
              onClick={logout}
              title="Çıkış Yap"
              className="flex items-center justify-center cursor-pointer rounded-md w-5 h-5 flex-shrink-0"
              style={{ color: 'rgba(255,255,255,0.35)', transition: 'all 0.15s ease' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; e.currentTarget.style.background = 'transparent'; }}
            >
              <i className="ri-logout-box-r-line text-xs" />
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
