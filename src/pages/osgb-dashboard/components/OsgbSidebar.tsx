import { useState } from 'react';
import { useAuth } from '@/store/AuthContext';
import SupportModal from '@/components/feature/SupportModal';
import { useSupportStore } from '@/store/useSupportStore';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518';

type Tab = 'dashboard' | 'firmalar' | 'uzmanlar' | 'ziyaretler' | 'raporlar' | 'analitik' | 'copkutusu' | 'ayarlar';

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
      { id: 'uzmanlar' as Tab, label: 'Personel', icon: 'ri-shield-user-line' },
      { id: 'ziyaretler' as Tab, label: 'Ziyaretler', icon: 'ri-map-pin-2-line' },
    ],
  },
  {
    label: 'SİSTEM',
    items: [
      { id: 'raporlar' as Tab, label: 'Raporlar', icon: 'ri-bar-chart-grouped-line' },
      { id: 'analitik' as Tab, label: 'Analiz & Harita', icon: 'ri-pie-chart-2-line' },
      { id: 'copkutusu' as Tab, label: 'Çöp Kutusu', icon: 'ri-delete-bin-2-line' },
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
  const { supportOpen, viewTicketId, openSupport, closeSupport } = useSupportStore();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const handleNav = (tab: Tab) => {
    setActiveTab(tab);
    onMobileClose?.();
  };

  const userInitial = (user?.email ?? 'O').charAt(0).toUpperCase();
  const userName = user?.email?.split('@')[0] ?? 'OSGB Admin';

  const sidebarWidth = collapsed ? 72 : 228;

  return (
    <>
      {/* Sidebar wrapper — margin ile floating effect */}
      <div
        className={[
          'fixed left-0 top-0 h-screen z-[42] flex items-stretch',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
        style={{
          width: `${sidebarWidth}px`,
          padding: '10px 8px',
          transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1), transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <aside
          className="flex flex-col w-full h-full relative overflow-hidden"
          style={{
            borderRadius: '20px',
            background: 'linear-gradient(170deg, #1e2140 0%, #161929 55%, #111525 100%)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          {/* Dekoratif glow topda */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: '-40px', left: '50%', transform: 'translateX(-50%)',
              width: '180px', height: '100px',
              borderRadius: '50%',
              background: 'radial-gradient(ellipse, rgba(99,102,241,0.18) 0%, transparent 70%)',
              filter: 'blur(12px)',
            }}
          />
          {/* Dekoratif glow altta */}
          <div
            className="absolute pointer-events-none"
            style={{
              bottom: '60px', right: '-30px',
              width: '120px', height: '120px',
              borderRadius: '50%',
              background: 'radial-gradient(ellipse, rgba(139,92,246,0.1) 0%, transparent 70%)',
              filter: 'blur(16px)',
            }}
          />

          {/* ── Logo ── */}
          <div
            className={`relative flex items-center flex-shrink-0 ${collapsed ? 'justify-center h-[58px]' : 'px-4 h-[58px] gap-2.5'}`}
          >
            <div
              className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.35), rgba(139,92,246,0.2))',
                border: '1px solid rgba(99,102,241,0.35)',
                boxShadow: '0 0 14px rgba(99,102,241,0.25)',
              }}
            >
              <img src={LOGO_URL} alt="ISG" style={{ height: '15px', width: 'auto', objectFit: 'contain' }} />
            </div>

            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-black leading-tight text-white truncate" style={{ letterSpacing: '-0.02em' }}>
                  ISG Denetim
                </p>
                <p className="text-[8.5px] font-bold mt-0.5" style={{ color: 'rgba(165,180,252,0.7)', letterSpacing: '0.12em' }}>
                  OSGB PANELİ
                </p>
              </div>
            )}

            <button
              onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? 'Genişlet' : 'Daralt'}
              className="hidden lg:flex items-center justify-center w-5 h-5 rounded-lg cursor-pointer flex-shrink-0 transition-all duration-200"
              style={{ color: 'rgba(255,255,255,0.2)', background: 'transparent' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.2)';
                (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.75)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
                (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)';
              }}
            >
              <i
                className="ri-side-bar-line text-[10px]"
                style={{ transform: collapsed ? 'scaleX(-1)' : 'none', display: 'block' }}
              />
            </button>
          </div>

          {/* Divider */}
          <div className="mx-3 mb-1" style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />

          {/* ── Org Badge ── */}
          {!collapsed && (
            <div className="mx-3 mt-2.5 mb-1">
              <div
                className="px-3 py-2 rounded-2xl"
                style={{
                  background: 'rgba(99,102,241,0.12)',
                  border: '1px solid rgba(99,102,241,0.18)',
                }}
              >
                <p className="text-[8.5px] font-bold uppercase tracking-[0.14em]" style={{ color: 'rgba(165,180,252,0.55)' }}>
                  Organizasyon
                </p>
                <p className="text-[11.5px] font-bold text-white truncate mt-0.5">{orgName}</p>
              </div>
            </div>
          )}

          {/* ── Navigation ── */}
          <nav
            className="flex-1 overflow-y-auto py-2 px-2 relative"
            style={{ scrollbarWidth: 'none' }}
          >
            {navGroups.map((group, gi) => (
              <div key={group.label} className={gi > 0 ? 'mt-4' : 'mt-1'}>
                {!collapsed ? (
                  <p
                    className="text-[8.5px] font-bold uppercase px-2 mb-1.5 select-none"
                    style={{ color: 'rgba(255,255,255,0.2)', letterSpacing: '0.14em' }}
                  >
                    {group.label}
                  </p>
                ) : (
                  gi > 0 && <div className="h-px my-2.5 mx-1" style={{ background: 'rgba(255,255,255,0.07)' }} />
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
                          className="w-full flex items-center text-left cursor-pointer relative"
                          style={{
                            padding: collapsed ? '9px 0' : '8px 10px',
                            borderRadius: '14px',
                            justifyContent: collapsed ? 'center' : undefined,
                            gap: collapsed ? undefined : '9px',
                            background: isActive
                              ? 'linear-gradient(135deg, rgba(99,102,241,0.28), rgba(139,92,246,0.18))'
                              : isHovered
                              ? 'rgba(255,255,255,0.07)'
                              : 'transparent',
                            border: isActive
                              ? '1px solid rgba(99,102,241,0.28)'
                              : '1px solid transparent',
                            boxShadow: isActive ? '0 2px 10px rgba(99,102,241,0.18)' : 'none',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {/* Active left bar */}
                          {isActive && !collapsed && (
                            <span
                              className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
                              style={{
                                width: '3px',
                                height: '50%',
                                background: 'linear-gradient(180deg, #A5B4FC, #818CF8)',
                                boxShadow: '0 0 8px rgba(99,102,241,0.7)',
                              }}
                            />
                          )}

                          {/* Icon */}
                          <span
                            className="flex items-center justify-center flex-shrink-0 rounded-lg transition-all duration-150"
                            style={{
                              width: '28px',
                              height: '28px',
                              marginLeft: isActive && !collapsed ? '4px' : undefined,
                              background: isActive
                                ? 'rgba(99,102,241,0.25)'
                                : isHovered
                                ? 'rgba(255,255,255,0.07)'
                                : 'transparent',
                            }}
                          >
                            <i
                              className={`${item.icon} text-[13px]`}
                              style={{
                                color: isActive
                                  ? '#A5B4FC'
                                  : isHovered
                                  ? 'rgba(255,255,255,0.65)'
                                  : 'rgba(255,255,255,0.3)',
                                transition: 'color 0.15s ease',
                              }}
                            />
                          </span>

                          {!collapsed && (
                            <span
                              className="flex-1 text-[12px] truncate leading-none"
                              style={{
                                color: isActive
                                  ? '#C7D2FE'
                                  : isHovered
                                  ? 'rgba(255,255,255,0.8)'
                                  : 'rgba(255,255,255,0.38)',
                                fontWeight: isActive ? 600 : 500,
                                transition: 'color 0.15s ease',
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
                                background: '#818CF8',
                                boxShadow: '0 0 6px rgba(99,102,241,0.8)',
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

          {/* ── Stats ── */}
          {!collapsed && (
            <div className="px-2.5 pb-2">
              <div
                className="rounded-2xl p-3"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <p
                  className="text-[8.5px] font-bold uppercase tracking-[0.14em] mb-2"
                  style={{ color: 'rgba(255,255,255,0.22)' }}
                >
                  İstatistikler
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { value: firmaCount, label: 'Firma', color: '#818CF8' },
                    { value: uzmanCount, label: 'Uzman', color: '#A78BFA' },
                  ].map(stat => (
                    <div
                      key={stat.label}
                      className="rounded-xl p-2.5"
                      style={{
                        background: 'rgba(99,102,241,0.1)',
                        border: '1px solid rgba(99,102,241,0.14)',
                      }}
                    >
                      <p className="text-[19px] font-black leading-none" style={{ color: stat.color }}>
                        {stat.value}
                      </p>
                      <p className="text-[9px] font-medium mt-1" style={{ color: 'rgba(255,255,255,0.28)' }}>
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Destek ── */}
          <div className={`px-2.5 pb-2 ${collapsed ? 'flex justify-center' : ''}`}>
            <button
              onClick={openSupport}
              title={collapsed ? 'Destek' : undefined}
              className={`cursor-pointer rounded-2xl transition-all duration-150 ${
                collapsed ? 'w-10 h-10 flex items-center justify-center' : 'w-full flex items-center gap-2 px-3 py-2'
              }`}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.14)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.28)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)';
              }}
            >
              <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                <i className="ri-customer-service-2-line text-xs" style={{ color: 'rgba(255,255,255,0.38)' }} />
              </span>
              {!collapsed && (
                <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.38)' }}>
                  Destek
                </span>
              )}
            </button>
          </div>

          {/* ── Profil ── */}
          <div
            className={`mx-2 mb-2 rounded-2xl flex items-center ${collapsed ? 'justify-center p-2' : 'gap-2 px-3 py-2.5'}`}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div
              className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 text-[11px] font-black text-white"
              style={{
                background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                boxShadow: '0 2px 8px rgba(99,102,241,0.4)',
              }}
            >
              {userInitial}
            </div>

            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold leading-tight text-white truncate">
                    {userName}
                  </p>
                  <p className="text-[9px] mt-0.5" style={{ color: 'rgba(165,180,252,0.6)' }}>
                    OSGB Admin
                  </p>
                </div>
                <button
                  onClick={logout}
                  title="Çıkış Yap"
                  className="flex items-center justify-center cursor-pointer rounded-xl w-6 h-6 flex-shrink-0 transition-all duration-150"
                  style={{ color: 'rgba(255,255,255,0.2)', background: 'transparent' }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.color = '#F87171';
                    (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.12)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)';
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  <i className="ri-logout-box-r-line text-xs" />
                </button>
              </>
            )}
          </div>
        </aside>
      </div>

      <SupportModal
        open={supportOpen}
        onClose={closeSupport}
        viewTicketId={viewTicketId}
      />
    </>
  );
}
