import { useState } from 'react';
import { useAuth } from '@/store/AuthContext';
import SupportModal from '@/components/feature/SupportModal';
import { useSupportStore } from '@/store/useSupportStore';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518';

const ACCENT = '#0EA5E9';
const ACCENT_DARK = '#0284C7';
const ACCENT_LIGHT = '#38BDF8';

export type UzmanTab =
  | 'genel_bakis'
  | 'firmalar'
  | 'personeller'
  | 'firma_belgeleri'
  | 'belge_takibi'
  | 'egitimler'
  | 'saglik'
  | 'tutanaklar'
  | 'saha_denetimleri'
  | 'ekipmanlar'
  | 'is_izinleri'
  | 'raporlar'
  | 'dokumanlar'
  | 'mobil_saha'
  | 'cop';

interface NavSection {
  label: string;
  items: { id: UzmanTab; label: string; icon: string; mobileOnly?: boolean }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'GENEL',
    items: [
      { id: 'genel_bakis', label: 'Genel Bakış', icon: 'ri-dashboard-3-line' },
      { id: 'firmalar', label: 'Firmalar', icon: 'ri-building-3-line' },
      { id: 'personeller', label: 'Personel', icon: 'ri-group-line' },
    ],
  },
  {
    label: 'YÖNETİM',
    items: [
      { id: 'firma_belgeleri', label: 'Firma Belgeleri', icon: 'ri-folder-3-line' },
      { id: 'belge_takibi', label: 'Belge Takibi', icon: 'ri-file-list-3-line' },
      { id: 'egitimler', label: 'Eğitimler', icon: 'ri-graduation-cap-line' },
      { id: 'saglik', label: 'Sağlık Durumu', icon: 'ri-heart-pulse-line' },
      { id: 'tutanaklar', label: 'Tutanak Yönetimi', icon: 'ri-file-text-line' },
      { id: 'saha_denetimleri', label: 'Saha Denetimleri', icon: 'ri-error-warning-line' },
      { id: 'ekipmanlar', label: 'Ekipman', icon: 'ri-tools-line' },
      { id: 'is_izinleri', label: 'İş İzinleri', icon: 'ri-shield-keyhole-line' },
    ],
  },
  {
    label: 'SİSTEM',
    items: [
      { id: 'mobil_saha', label: 'Mobil Saha', icon: 'ri-smartphone-line', mobileOnly: true },
      { id: 'raporlar', label: 'Raporlar', icon: 'ri-bar-chart-line' },
      { id: 'dokumanlar', label: 'Dökümanlar', icon: 'ri-book-2-line' },
      { id: 'cop', label: 'Çöp Kutusu', icon: 'ri-delete-bin-6-line' },
    ],
  },
];

interface UzmanSidebarProps {
  activeTab: UzmanTab;
  setActiveTab: (tab: UzmanTab) => void;
  orgName: string;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function UzmanSidebar({
  activeTab,
  setActiveTab,
  orgName,
  collapsed,
  setCollapsed,
  mobileOpen = false,
  onMobileClose,
}: UzmanSidebarProps) {
  const { logout, user } = useAuth();
  const { supportOpen, viewTicketId, openSupport, closeSupport } = useSupportStore();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const userInitial = (user?.email ?? 'U').charAt(0).toUpperCase();
  const userName = user?.email?.split('@')[0] ?? 'Gezici Uzman';

  const handleNav = (tab: UzmanTab) => {
    setActiveTab(tab);
    onMobileClose?.();
  };

  return (
    <>
      <aside
        className={[
          'fixed top-3 bottom-3 flex flex-col z-[42]',
          collapsed ? 'w-[64px] left-3' : 'w-[220px] left-3',
          mobileOpen ? 'translate-x-0 opacity-100' : '-translate-x-[calc(100%+12px)] opacity-0 lg:translate-x-0 lg:opacity-100',
        ].join(' ')}
        style={{
          background: 'var(--bg-sidebar)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          transition: mobileOpen
            ? 'width 0.28s cubic-bezier(0.4,0,0.2,1), transform 0.38s cubic-bezier(0.22,1,0.36,1), opacity 0.32s cubic-bezier(0.22,1,0.36,1)'
            : 'width 0.28s cubic-bezier(0.4,0,0.2,1), transform 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.22s ease',
          boxShadow: mobileOpen
            ? '0 24px 64px rgba(0,0,0,0.35), 0 8px 24px rgba(0,0,0,0.18), 0 0 0 1px rgba(15,23,42,0.08)'
            : '0 4px 24px rgba(0,0,0,0.10), 0 1px 6px rgba(0,0,0,0.06), 0 0 0 1px rgba(15,23,42,0.06)',
          overflow: 'hidden',
        }}
      >
        {/* ── Logo ── */}
        <div
          className={`flex items-center flex-shrink-0 ${collapsed ? 'justify-center px-0 h-[56px]' : 'px-4 h-[56px] gap-3'}`}
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div
            className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ background: `rgba(14,165,233,0.12)`, border: `1px solid rgba(14,165,233,0.22)` }}
          >
            <img src={LOGO_URL} alt="ISG" style={{ height: '16px', width: 'auto', objectFit: 'contain' }} />
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-bold truncate leading-tight" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                ISG Denetim
              </p>
              <p className="text-[9.5px] font-semibold mt-0.5 truncate" style={{ color: ACCENT, letterSpacing: '0.04em' }}>
                GEZİCİ UZMAN
              </p>
            </div>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Genişlet' : 'Daralt'}
            className="hidden lg:flex items-center justify-center w-6 h-6 rounded-md cursor-pointer flex-shrink-0 transition-all duration-150"
            style={{ color: 'var(--text-faint)', background: 'transparent' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = `rgba(14,165,233,0.1)`;
              (e.currentTarget as HTMLElement).style.color = ACCENT;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)';
            }}
          >
            <i className="ri-side-bar-line text-[11px]" style={{ transform: collapsed ? 'scaleX(-1)' : 'none' }} />
          </button>
        </div>

        {/* ── Org Badge ── */}
        {!collapsed && (
          <div className="mx-3 mt-3">
            <div
              className="px-3 py-2.5 rounded-xl"
              style={{ background: `rgba(14,165,233,0.06)`, border: `1px solid rgba(14,165,233,0.12)` }}
            >
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: ACCENT, boxShadow: `0 0 5px rgba(14,165,233,0.6)` }} />
                <p className="text-[9px] font-bold uppercase tracking-[0.12em]"
                  style={{ color: `rgba(14,165,233,0.65)` }}>
                  Organizasyon
                </p>
              </div>
              <p className="text-[12px] font-bold mt-1 truncate" style={{ color: ACCENT }}>{orgName}</p>
            </div>
          </div>
        )}

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5" style={{ scrollbarWidth: 'none' }}>
          {NAV_SECTIONS.map((section, si) => (
            <div key={section.label} className={si > 0 ? 'mt-4' : ''}>
              {!collapsed && (
                <p className="text-[9px] font-bold uppercase px-2 mb-2 select-none tracking-[0.14em]"
                  style={{ color: 'var(--text-faint)' }}>
                  {section.label}
                </p>
              )}
              {collapsed && si > 0 && <div className="h-px my-2" style={{ background: 'var(--border-subtle)' }} />}
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const isActive = activeTab === item.id;
                  const isHovered = hoveredItem === item.id;

                  return (
                    <button
                      key={item.id}
                      title={collapsed ? item.label : undefined}
                      onClick={() => handleNav(item.id)}
                      onMouseEnter={() => setHoveredItem(item.id)}
                      onMouseLeave={() => setHoveredItem(null)}
                      className={`w-full flex items-center text-left cursor-pointer relative overflow-hidden ${item.mobileOnly ? 'lg:hidden' : ''}`}
                      style={{
                        padding: collapsed ? '9px 0' : '8px 10px',
                        borderRadius: '10px',
                        justifyContent: collapsed ? 'center' : undefined,
                        gap: collapsed ? undefined : '10px',
                        background: isActive
                          ? `rgba(14,165,233,0.1)`
                          : isHovered ? 'var(--bg-hover)' : 'transparent',
                        border: isActive
                          ? `1px solid rgba(14,165,233,0.2)`
                          : '1px solid transparent',
                        transition: 'all 0.18s ease',
                      }}
                    >
                      {isActive && !collapsed && (
                        <span
                          className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
                          style={{
                            width: '3px',
                            height: '55%',
                            background: `linear-gradient(180deg, ${ACCENT_LIGHT}, ${ACCENT_DARK})`,
                            boxShadow: `0 0 6px rgba(14,165,233,0.4)`,
                          }}
                        />
                      )}

                      <span
                        className="flex items-center justify-center flex-shrink-0"
                        style={{
                          width: '17px', height: '17px',
                          marginLeft: isActive && !collapsed ? '6px' : undefined,
                          transition: 'transform 0.18s ease',
                          transform: isHovered && !isActive ? 'translateX(1px)' : 'none',
                        }}
                      >
                        <i
                          className={`${item.icon} text-[14px]`}
                          style={{
                            color: isActive ? ACCENT : isHovered ? 'var(--text-secondary)' : 'var(--text-muted)',
                            transition: 'color 0.18s ease',
                          }}
                        />
                      </span>

                      {!collapsed && (
                        <>
                          <span
                            className="flex-1 leading-none text-[12px] truncate"
                            style={{
                              color: isActive ? ACCENT : isHovered ? 'var(--text-primary)' : 'var(--text-muted)',
                              fontWeight: isActive ? 600 : 500,
                              transition: 'color 0.18s ease',
                            }}
                          >
                            {item.label}
                          </span>
                          {isActive && (
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ background: ACCENT, boxShadow: `0 0 5px rgba(14,165,233,0.6)` }} />
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* ── Support ── */}
        <div className={`px-2.5 pb-2 ${collapsed ? 'flex justify-center' : ''}`}>
          <button
            onClick={openSupport}
            title={collapsed ? 'Destek' : undefined}
            className={`cursor-pointer rounded-xl transition-all duration-150 ${collapsed ? 'w-10 h-10 flex items-center justify-center' : 'w-full flex items-center gap-2.5 px-3 py-2'}`}
            style={{ background: `rgba(14,165,233,0.06)`, border: `1px solid rgba(14,165,233,0.14)` }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = `rgba(14,165,233,0.12)`;
              (e.currentTarget as HTMLElement).style.borderColor = `rgba(14,165,233,0.28)`;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = `rgba(14,165,233,0.06)`;
              (e.currentTarget as HTMLElement).style.borderColor = `rgba(14,165,233,0.14)`;
            }}
          >
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
              <i className="ri-customer-service-2-line text-xs" style={{ color: ACCENT }} />
            </div>
            {!collapsed && (
              <>
                <span className="text-[11.5px] font-semibold flex-1 text-left" style={{ color: ACCENT }}>Destek</span>
                <i className="ri-arrow-right-s-line text-xs" style={{ color: `rgba(14,165,233,0.4)` }} />
              </>
            )}
          </button>
        </div>

        {/* ── Profile ── */}
        <div
          className={`mx-2.5 mb-3 rounded-xl flex items-center ${collapsed ? 'justify-center p-2' : 'gap-2.5 px-3 py-2.5'}`}
          style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)' }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${ACCENT_DARK}, ${ACCENT})` }}
          >
            {userInitial}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-[11.5px] font-semibold truncate leading-tight" style={{ color: 'var(--text-primary)' }}>
                  {userName}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full"
                    style={{ background: ACCENT, boxShadow: `0 0 4px rgba(14,165,233,0.6)` }} />
                  <p className="text-[9.5px] font-semibold" style={{ color: ACCENT }}>Gezici Uzman</p>
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

      <SupportModal open={supportOpen} onClose={closeSupport} viewTicketId={viewTicketId} />
    </>
  );
}
