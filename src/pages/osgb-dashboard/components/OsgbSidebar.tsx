import { useState, useEffect } from 'react';
import { useAuth } from '@/store/AuthContext';
import SupportModal from '@/components/feature/SupportModal';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518';

type Tab = 'dashboard' | 'firmalar' | 'uzmanlar' | 'ziyaretler' | 'raporlar' | 'ayarlar';

interface OsgbSidebarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  orgName: string;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  firmaCount?: number;
  uzmanCount?: number;
}

const navGroups = [
  {
    label: 'GENEL',
    items: [{ id: 'dashboard' as Tab, label: 'Genel Bakış', icon: 'ri-layout-grid-line' }],
  },
  {
    label: 'YÖNETİM',
    items: [
      { id: 'firmalar' as Tab, label: 'Firmalar', icon: 'ri-building-3-line' },
      { id: 'uzmanlar' as Tab, label: 'Uzmanlar', icon: 'ri-shield-user-line' },
      { id: 'ziyaretler' as Tab, label: 'Ziyaretler', icon: 'ri-map-pin-2-line' },
    ],
  },
  {
    label: 'SİSTEM',
    items: [
      { id: 'raporlar' as Tab, label: 'Raporlar', icon: 'ri-bar-chart-grouped-line' },
      { id: 'ayarlar' as Tab, label: 'Ayarlar', icon: 'ri-settings-3-line' },
    ],
  },
];

export default function OsgbSidebar({
  activeTab,
  setActiveTab,
  orgName,
  collapsed,
  setCollapsed,
  mobileOpen = false,
  onMobileClose,
  firmaCount = 0,
  uzmanCount = 0,
}: OsgbSidebarProps) {
  const { logout, user } = useAuth();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [supportOpen, setSupportOpen] = useState(false);

  const handleNav = (tab: Tab) => {
    setActiveTab(tab);
    onMobileClose?.();
  };

  const userInitial = (user?.email ?? 'O').charAt(0).toUpperCase();
  const userName = user?.email?.split('@')[0] ?? 'OSGB Admin';

  return (
    <>
      <aside
        className={[
          'fixed left-0 top-0 h-screen flex flex-col z-[42]',
          collapsed ? 'w-[64px]' : 'w-[220px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
        style={{
          background: 'var(--bg-sidebar)',
          borderRight: '1px solid var(--border-subtle)',
          transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1), transform 0.28s cubic-bezier(0.4,0,0.2,1), background 0s, border-color 0s',
          boxShadow: '2px 0 16px rgba(0,0,0,0.08)',
        }}
      >
        {/* ── Top: Logo + Org ── */}
        <div
          className={`flex items-center flex-shrink-0 ${collapsed ? 'justify-center px-0 h-[56px]' : 'px-4 h-[56px] gap-3'}`}
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          {/* Logo */}
          <div
            className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
            style={{
              background: 'rgba(16,185,129,0.12)',
              border: '1px solid rgba(16,185,129,0.22)',
            }}
          >
            <img
              src={LOGO_URL}
              alt="ISG"
              style={{ height: '16px', width: 'auto', objectFit: 'contain' }}
            />
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p
                className="text-[12.5px] font-bold truncate leading-tight"
                style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
              >
                ISG Denetim
              </p>
              <p
                className="text-[9.5px] font-semibold mt-0.5 truncate"
                style={{ color: '#10B981', letterSpacing: '0.04em' }}
              >
                OSGB PANELİ
              </p>
            </div>
          )}

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Genişlet' : 'Daralt'}
            className="hidden lg:flex items-center justify-center w-6 h-6 rounded-md cursor-pointer flex-shrink-0 transition-all duration-150"
            style={{ color: 'var(--text-faint)', background: 'transparent' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.1)';
              (e.currentTarget as HTMLElement).style.color = '#10B981';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)';
            }}
          >
            <i
              className="ri-side-bar-line text-[11px]"
              style={{ transform: collapsed ? 'scaleX(-1)' : 'none' }}
            />
          </button>
        </div>

        {/* ── Org Badge ── */}
        {!collapsed && (
          <div className="mx-3 mt-3">
            <div
              className="px-3 py-2.5 rounded-xl"
              style={{
                background: 'rgba(16,185,129,0.06)',
                border: '1px solid rgba(16,185,129,0.12)',
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: '#10B981', boxShadow: '0 0 5px rgba(16,185,129,0.6)' }}
                />
                <p
                  className="text-[9px] font-bold uppercase tracking-[0.12em]"
                  style={{ color: 'rgba(16,185,129,0.65)' }}
                >
                  Organizasyon
                </p>
              </div>
              <p
                className="text-[12px] font-bold mt-1 truncate"
                style={{ color: '#10B981' }}
              >
                {orgName}
              </p>
            </div>
          </div>
        )}

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-1" style={{ scrollbarWidth: 'none' }}>
          {navGroups.map((group, gi) => (
            <div key={group.label} className={gi > 0 ? 'mt-4' : ''}>
              {!collapsed ? (
                <p
                  className="text-[9px] font-bold uppercase px-2 mb-1.5 select-none tracking-[0.14em]"
                  style={{ color: 'var(--text-faint)' }}
                >
                  {group.label}
                </p>
              ) : (
                <div className="h-px my-2" style={{ background: 'var(--border-subtle)' }} />
              )}

              <ul className="space-y-0.5">
                {group.items.map(item => {
                  const isActive = activeTab === item.id;
                  const isHovered = hoveredItem === item.id;

                  return (
                    <li key={item.id}>
                      <button
                        title={collapsed ? item.label : undefined}
                        onClick={() => handleNav(item.id)}
                        onMouseEnter={() => setHoveredItem(item.id)}
                        onMouseLeave={() => setHoveredItem(null)}
                        className="w-full flex items-center text-left cursor-pointer relative overflow-hidden"
                        style={{
                          padding: collapsed ? '9px 0' : '8px 10px',
                          borderRadius: '10px',
                          justifyContent: collapsed ? 'center' : undefined,
                          gap: collapsed ? undefined : '10px',
                          background: isActive
                            ? 'rgba(16,185,129,0.1)'
                            : isHovered
                            ? 'var(--bg-hover)'
                            : 'transparent',
                          border: isActive
                            ? '1px solid rgba(16,185,129,0.2)'
                            : '1px solid transparent',
                          transition: 'all 0.18s ease',
                        }}
                      >
                        {/* Active accent bar */}
                        {isActive && !collapsed && (
                          <span
                            className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
                            style={{
                              width: '3px',
                              height: '55%',
                              background: 'linear-gradient(180deg, #34D399, #059669)',
                              boxShadow: '0 0 6px rgba(16,185,129,0.4)',
                            }}
                          />
                        )}

                        {/* Icon */}
                        <span
                          className="flex items-center justify-center flex-shrink-0"
                          style={{
                            width: '17px',
                            height: '17px',
                            marginLeft: isActive && !collapsed ? '6px' : undefined,
                            transition: 'transform 0.18s ease',
                            transform: isHovered && !isActive ? 'translateX(1px)' : 'none',
                          }}
                        >
                          <i
                            className={`${item.icon} text-[14px]`}
                            style={{
                              color: isActive
                                ? '#10B981'
                                : isHovered
                                ? 'var(--text-secondary)'
                                : 'var(--text-faint)',
                              transition: 'color 0.18s ease',
                            }}
                          />
                        </span>

                        {/* Label */}
                        {!collapsed && (
                          <span
                            className="flex-1 leading-none text-[12px] truncate"
                            style={{
                              color: isActive
                                ? '#10B981'
                                : isHovered
                                ? 'var(--text-primary)'
                                : 'var(--text-muted)',
                              fontWeight: isActive ? 600 : 500,
                              transition: 'color 0.18s ease',
                            }}
                          >
                            {item.label}
                          </span>
                        )}

                        {/* Active dot */}
                        {!collapsed && isActive && (
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{
                              background: '#10B981',
                              boxShadow: '0 0 5px rgba(16,185,129,0.6)',
                            }}
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* ── Stats Box ── */}
        {!collapsed && (
          <div className="px-3 pb-2">
            <div
              className="rounded-xl p-3"
              style={{
                background: 'var(--bg-item)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <p
                className="text-[9px] font-bold uppercase tracking-[0.12em] mb-2.5"
                style={{ color: 'var(--text-faint)' }}
              >
                İstatistikler
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: firmaCount, label: 'Toplam Firma', color: '#10B981', icon: 'ri-building-3-line' },
                  { value: uzmanCount, label: 'Toplam Uzman', color: '#10B981', icon: 'ri-shield-user-line' },
                ].map(stat => (
                  <div
                    key={stat.label}
                    className="rounded-lg p-2.5"
                    style={{
                      background: 'rgba(16,185,129,0.05)',
                      border: '1px solid rgba(16,185,129,0.1)',
                    }}
                  >
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                        <i
                          className={`${stat.icon} text-[10px]`}
                          style={{ color: 'rgba(16,185,129,0.55)' }}
                        />
                      </div>
                    </div>
                    <p
                      className="text-[17px] font-extrabold leading-none"
                      style={{ color: stat.color }}
                    >
                      {stat.value}
                    </p>
                    <p
                      className="text-[9px] font-medium mt-0.5"
                      style={{ color: 'var(--text-faint)' }}
                    >
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Support ── */}
        <div className={`px-2.5 pb-2 ${collapsed ? 'flex justify-center' : ''}`}>
          <button
            onClick={() => setSupportOpen(true)}
            title={collapsed ? 'Destek' : undefined}
            className={`cursor-pointer rounded-xl transition-all duration-150 ${collapsed ? 'w-10 h-10 flex items-center justify-center' : 'w-full flex items-center gap-2.5 px-3 py-2'}`}
            style={{
              background: 'rgba(16,185,129,0.06)',
              border: '1px solid rgba(16,185,129,0.14)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.12)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(16,185,129,0.28)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.06)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(16,185,129,0.14)';
            }}
          >
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
              <i className="ri-customer-service-2-line text-xs" style={{ color: '#10B981' }} />
            </div>
            {!collapsed && (
              <>
                <span className="text-[11.5px] font-semibold flex-1 text-left" style={{ color: '#10B981' }}>
                  Destek
                </span>
                <i className="ri-arrow-right-s-line text-xs" style={{ color: 'rgba(16,185,129,0.4)' }} />
              </>
            )}
          </button>
        </div>

        {/* ── Profile ── */}
        <div
          className={`mx-2.5 mb-3 rounded-xl flex items-center ${collapsed ? 'justify-center p-2' : 'gap-2.5 px-3 py-2.5'}`}
          style={{
            background: 'var(--bg-item)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-white"
            style={{
              background: 'linear-gradient(135deg, #10B981, #059669)',
            }}
          >
            {userInitial}
          </div>

          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p
                  className="text-[11.5px] font-semibold truncate leading-tight"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {userName}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: '#10B981', boxShadow: '0 0 4px rgba(16,185,129,0.6)' }}
                  />
                  <p className="text-[9.5px] font-semibold" style={{ color: '#10B981' }}>
                    OSGB Admin
                  </p>
                </div>
              </div>
              <button
                onClick={logout}
                title="Çıkış Yap"
                className="flex items-center justify-center cursor-pointer rounded-md w-6 h-6 flex-shrink-0 transition-all duration-150"
                style={{ color: 'var(--text-faint)', background: 'transparent' }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.color = '#F87171';
                  (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)';
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <i className="ri-logout-box-r-line text-xs" />
              </button>
            </>
          )}
        </div>
      </aside>

      <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />
    </>
  );
}
