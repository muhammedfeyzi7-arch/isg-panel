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

  return (
    <>
      <aside
        className={[
          'fixed left-0 top-0 h-screen flex flex-col z-[42]',
          collapsed ? 'w-[64px]' : 'w-[220px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
        style={{
          background: 'linear-gradient(180deg, #1a1f37 0%, #151929 40%, #0f1320 100%)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1), transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Dekoratif arka plan desen */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div style={{
            position: 'absolute', top: '-60px', left: '-60px',
            width: '200px', height: '200px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
          }} />
          <div style={{
            position: 'absolute', bottom: '80px', right: '-40px',
            width: '160px', height: '160px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)',
          }} />
        </div>

        {/* ── Logo ── */}
        <div
          className={`relative flex items-center flex-shrink-0 ${collapsed ? 'justify-center px-0 h-[60px]' : 'px-4 h-[60px] gap-3'}`}
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div
            className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.2))',
              border: '1px solid rgba(99,102,241,0.3)',
              boxShadow: '0 0 16px rgba(99,102,241,0.2)',
            }}
          >
            <img src={LOGO_URL} alt="ISG" style={{ height: '16px', width: 'auto', objectFit: 'contain' }} />
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-black truncate leading-tight text-white" style={{ letterSpacing: '-0.02em' }}>
                ISG Denetim
              </p>
              <p className="text-[9px] font-bold mt-0.5 truncate" style={{ color: 'rgba(139,92,246,0.9)', letterSpacing: '0.1em' }}>
                OSGB PANELİ
              </p>
            </div>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Genişlet' : 'Daralt'}
            className="hidden lg:flex items-center justify-center w-6 h-6 rounded-md cursor-pointer flex-shrink-0 transition-all duration-150"
            style={{ color: 'rgba(255,255,255,0.3)', background: 'transparent' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.15)';
              (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.8)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)';
            }}
          >
            <i className="ri-side-bar-line text-[11px]" style={{ transform: collapsed ? 'scaleX(-1)' : 'none' }} />
          </button>
        </div>

        {/* ── Org Badge ── */}
        {!collapsed && (
          <div className="mx-3 mt-3 relative">
            <div className="px-3 py-2.5 rounded-xl"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))',
                border: '1px solid rgba(99,102,241,0.2)',
              }}>
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] mb-0.5" style={{ color: 'rgba(99,102,241,0.7)' }}>
                Organizasyon
              </p>
              <p className="text-[11.5px] font-bold truncate text-white">{orgName}</p>
            </div>
          </div>
        )}

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-1 relative" style={{ scrollbarWidth: 'none' }}>
          {navGroups.map((group, gi) => (
            <div key={group.label} className={gi > 0 ? 'mt-5' : ''}>
              {!collapsed ? (
                <p className="text-[9px] font-bold uppercase px-2 mb-2 select-none tracking-[0.14em]"
                  style={{ color: 'rgba(255,255,255,0.25)' }}>
                  {group.label}
                </p>
              ) : (
                <div className="h-px my-3 mx-2" style={{ background: 'rgba(255,255,255,0.08)' }} />
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
                          padding: collapsed ? '10px 0' : '9px 10px',
                          borderRadius: '12px',
                          justifyContent: collapsed ? 'center' : undefined,
                          gap: collapsed ? undefined : '10px',
                          background: isActive
                            ? 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.15))'
                            : isHovered
                            ? 'rgba(255,255,255,0.06)'
                            : 'transparent',
                          border: isActive
                            ? '1px solid rgba(99,102,241,0.3)'
                            : '1px solid transparent',
                          transition: 'all 0.18s ease',
                          boxShadow: isActive ? '0 4px 12px rgba(99,102,241,0.15)' : 'none',
                        }}
                      >
                        {/* Active left accent bar */}
                        {isActive && !collapsed && (
                          <span
                            className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
                            style={{
                              width: '3px', height: '60%',
                              background: 'linear-gradient(180deg, #818CF8, #6366F1)',
                              boxShadow: '0 0 8px rgba(99,102,241,0.6)',
                            }}
                          />
                        )}

                        <span
                          className="flex items-center justify-center flex-shrink-0"
                          style={{
                            width: '18px', height: '18px',
                            marginLeft: isActive && !collapsed ? '6px' : undefined,
                          }}
                        >
                          <i className={`${item.icon} text-[14px]`}
                            style={{
                              color: isActive
                                ? '#A5B4FC'
                                : isHovered
                                ? 'rgba(255,255,255,0.7)'
                                : 'rgba(255,255,255,0.35)',
                              transition: 'color 0.18s ease',
                            }}
                          />
                        </span>

                        {!collapsed && (
                          <span
                            className="flex-1 leading-none text-[12.5px] truncate"
                            style={{
                              color: isActive
                                ? '#E0E7FF'
                                : isHovered
                                ? 'rgba(255,255,255,0.85)'
                                : 'rgba(255,255,255,0.45)',
                              fontWeight: isActive ? 600 : 500,
                              transition: 'color 0.18s ease',
                            }}
                          >
                            {item.label}
                          </span>
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
          <div className="px-3 pb-2 relative">
            <div className="rounded-xl p-3"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}>
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] mb-2.5"
                style={{ color: 'rgba(255,255,255,0.25)' }}>
                İstatistikler
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: firmaCount, label: 'Firma', icon: 'ri-building-3-line', color: '#818CF8' },
                  { value: uzmanCount, label: 'Uzman', icon: 'ri-shield-user-line', color: '#A78BFA' },
                ].map(stat => (
                  <div key={stat.label} className="rounded-lg p-2.5"
                    style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.15)' }}>
                    <p className="text-[18px] font-black leading-none" style={{ color: stat.color }}>{stat.value}</p>
                    <p className="text-[9px] font-medium mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Destek ── */}
        <div className={`px-2.5 pb-2 relative ${collapsed ? 'flex justify-center' : ''}`}>
          <button
            onClick={openSupport}
            title={collapsed ? 'Destek' : undefined}
            className={`cursor-pointer rounded-xl transition-all duration-150 ${collapsed ? 'w-10 h-10 flex items-center justify-center' : 'w-full flex items-center gap-2.5 px-3 py-2'}`}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.15)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.3)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
            }}
          >
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
              <i className="ri-customer-service-2-line text-xs" style={{ color: 'rgba(255,255,255,0.5)' }} />
            </div>
            {!collapsed && (
              <span className="text-[11.5px] font-medium flex-1 text-left" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Destek
              </span>
            )}
          </button>
        </div>

        {/* ── Profil ── */}
        <div
          className={`mx-2.5 mb-3 rounded-xl flex items-center relative ${collapsed ? 'justify-center p-2' : 'gap-2.5 px-3 py-2.5'}`}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-black text-white"
            style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
          >
            {userInitial}
          </div>

          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-[11.5px] font-semibold truncate leading-tight text-white">
                  {userName}
                </p>
                <p className="text-[9.5px] font-medium mt-0.5" style={{ color: 'rgba(165,180,252,0.7)' }}>OSGB Admin</p>
              </div>
              <button
                onClick={logout}
                title="Çıkış Yap"
                className="flex items-center justify-center cursor-pointer rounded-md w-6 h-6 flex-shrink-0 transition-all duration-150"
                style={{ color: 'rgba(255,255,255,0.25)', background: 'transparent' }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.color = '#F87171';
                  (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.12)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.25)';
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <i className="ri-logout-box-r-line text-xs" />
              </button>
            </>
          )}
        </div>
      </aside>

      <SupportModal
        open={supportOpen}
        onClose={closeSupport}
        viewTicketId={viewTicketId}
      />
    </>
  );
}
