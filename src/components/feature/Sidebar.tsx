import { useEffect, Fragment, useState } from 'react';
import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import SupportModal from './SupportModal';
import { useSupportStore } from '@/store/useSupportStore';

const ROLE_MODULES: Record<string, string[]> = {
  admin: [
    'dashboard', 'firmalar', 'personeller',
    'evraklar', 'firma-evraklari', 'egitimler', 'muayeneler', 'tutanaklar',
    'uygunsuzluklar', 'ekipmanlar', 'is-izinleri',
    'saha', 'raporlar', 'dokumanlar', 'copkutusu', 'ayarlar',
  ],
  denetci: [
    'dashboard', 'firmalar', 'personeller',
    'ekipmanlar', 'uygunsuzluklar', 'saha',
  ],
  member: [
    'dashboard', 'firmalar', 'personeller',
    'evraklar', 'firma-evraklari', 'egitimler', 'muayeneler', 'tutanaklar',
    'uygunsuzluklar', 'ekipmanlar', 'is-izinleri',
    'saha', 'raporlar', 'dokumanlar', 'copkutusu',
  ],
  firma_user: [
    'dashboard', 'personeller',
    'evraklar', 'egitimler',
    'uygunsuzluklar',
  ],
};

// Gezici uzman artık /uzman bağımsız paneline yönlendiriliyor
// Ana sidebar'da gösterilmemeli — bu liste sadece fallback guard için
const GEZICI_UZMAN_MODULES: string[] = [];

function getAllowedModules(role: string): string[] {
  return ROLE_MODULES[role] ?? ROLE_MODULES.member;
}

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  mobileOnly?: boolean;
}

const menuGroups: { label: string; items: MenuItem[] }[] = [
  {
    label: 'GENEL',
    items: [
      { id: 'dashboard',    label: 'Genel Bakış',   icon: 'ri-dashboard-3-line' },
      { id: 'firmalar',     label: 'Firmalar',       icon: 'ri-building-2-line' },
      { id: 'personeller',  label: 'Personel',       icon: 'ri-team-line' },
    ],
  },
  {
    label: 'YÖNETİM',
    items: [
      { id: 'firma-evraklari', label: 'Firma Belgeleri',  icon: 'ri-building-4-line' },
      { id: 'evraklar',        label: 'Belge Takibi',     icon: 'ri-file-list-3-line' },
      { id: 'egitimler',       label: 'Eğitimler',        icon: 'ri-graduation-cap-line' },
      { id: 'muayeneler',      label: 'Sağlık Durumu',    icon: 'ri-heart-pulse-line' },
      { id: 'tutanaklar',      label: 'Tutanak Yönetimi', icon: 'ri-article-line' },
      { id: 'uygunsuzluklar',  label: 'Saha Denetimleri', icon: 'ri-map-pin-user-line' },
      { id: 'ekipmanlar',      label: 'Ekipman',          icon: 'ri-tools-line' },
      { id: 'is-izinleri',     label: 'İş İzinleri',      icon: 'ri-shield-keyhole-line' },
    ],
  },
  {
    label: 'SİSTEM',
    items: [
      { id: 'saha',       label: 'Saha Denetimleri', icon: 'ri-map-pin-user-line', mobileOnly: true },
      { id: 'raporlar',   label: 'Raporlar',          icon: 'ri-bar-chart-2-line' },
      { id: 'dokumanlar', label: 'Dökümanlar',        icon: 'ri-file-text-line' },
      { id: 'copkutusu',  label: 'Çöp Kutusu',        icon: 'ri-delete-bin-2-line' },
      { id: 'ayarlar',    label: 'Ayarlar',            icon: 'ri-settings-4-line' },
    ],
  },
];

// Accent: #0EA5E9 (sky-500 cyan) — hekim temasıyla aynı
const ACCENT = '#0EA5E9';
const ACCENT_DARK = '#0284C7';

interface SidebarProps {
  onMobileClose?: () => void;
  isDark?: boolean;
  mobileOpen?: boolean;
}

export default function Sidebar({ onMobileClose, isDark = true, mobileOpen = false }: SidebarProps) {
  const { activeModule, setActiveModule, sidebarCollapsed, setSidebarCollapsed, currentUser, firmalar, personeller, evraklar, org, orgLoading } = useApp();
  const { logout, user } = useAuth();
  const { supportOpen, viewTicketId, openSupport, closeSupport } = useSupportStore();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const userRole = org?.role ?? 'member';
  const isGeziciUzman = org?.osgbRole === 'gezici_uzman';
  const allowedModules = (orgLoading || !org)
    ? getAllowedModules('admin')
    : isGeziciUzman
      ? GEZICI_UZMAN_MODULES
      : getAllowedModules(userRole);

  useEffect(() => {
    if (!allowedModules.includes(activeModule)) {
      setActiveModule('dashboard');
    }
  }, [activeModule, allowedModules, setActiveModule]);

  const eksikEvrak = evraklar.filter(e => e.durum === 'Eksik' || e.durum === 'Süre Dolmuş').length;
  const badges: Record<string, number> = { evraklar: eksikEvrak };

  const filteredGroups = menuGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => allowedModules.includes(item.id)),
    }))
    .filter(group => group.items.length > 0);

  const collapsed = sidebarCollapsed;

  // Design tokens (matching hekim sidebar)
  const sidebarBg     = isDark ? '#111827' : '#ffffff';
  const borderColor   = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)';
  const labelColor    = isDark ? 'rgba(255,255,255,0.28)' : '#cbd5e1';
  const textPrimary   = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted     = isDark ? '#64748b' : '#64748b';
  const textFaint     = isDark ? '#334155' : '#cbd5e1';
  const statsBg       = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)';
  const profileBg     = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)';
  const hoverBg       = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)';

  const orgDisplayName = org?.displayName ?? org?.name ?? 'Organizasyon';
  const userInitial = (currentUser.ad || user?.email || 'U').charAt(0).toUpperCase();
  const userName = currentUser.ad || user?.email?.split('@')[0] || 'Kullanıcı';

  const ROLE_LABEL: Record<string, string> = {
    admin: 'Admin',
    denetci: 'Saha Personeli',
    member: 'Evrak/Dok. Denetçi',
    firma_user: 'Firma Yetkilisi',
  };
  const roleLabel = isGeziciUzman ? 'Gezici Uzman' : (ROLE_LABEL[userRole] ?? 'Kullanıcı');

  return (
    <>
      <aside
        className={`
          fixed left-0 top-0 h-screen flex flex-col z-[42]
          ${collapsed ? 'w-[64px]' : 'w-[220px]'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{
          background: sidebarBg,
          borderRight: `1px solid ${borderColor}`,
          transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1), transform 0.26s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* ── Logo ── */}
        <div
          className={`flex items-center flex-shrink-0 ${collapsed ? 'justify-center px-0 h-[56px]' : 'px-4 h-[56px] gap-3'}`}
          style={{ borderBottom: `1px solid ${borderColor}` }}
        >
          <div
            className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
            style={{
              background: `rgba(14,165,233,0.12)`,
              border: `1px solid rgba(14,165,233,0.22)`,
            }}
          >
            <img
              src="https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518"
              alt="ISG Logo"
              style={{ height: '16px', width: 'auto', objectFit: 'contain' }}
            />
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-bold truncate leading-tight" style={{ color: textPrimary, letterSpacing: '-0.02em' }}>
                ISG Denetim
              </p>
              <p className="text-[9.5px] font-semibold mt-0.5 truncate" style={{ color: ACCENT, letterSpacing: '0.04em' }}>
                Yönetim Sistemi
              </p>
            </div>
          )}

          <button
            onClick={() => setSidebarCollapsed(!collapsed)}
            title={collapsed ? 'Genişlet' : 'Daralt'}
            className="hidden lg:flex items-center justify-center w-6 h-6 rounded-md cursor-pointer flex-shrink-0 transition-all duration-150"
            style={{ color: textFaint, background: 'transparent', border: 'none' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = `rgba(14,165,233,0.1)`;
              (e.currentTarget as HTMLElement).style.color = ACCENT;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = textFaint;
            }}
          >
            <i className="ri-side-bar-line text-[11px]" style={{ transform: collapsed ? 'scaleX(-1)' : 'none', display: 'block' }} />
          </button>
        </div>

        {/* ── Org Badge ── */}
        {!collapsed && (
          <div className="mx-3 mt-3">
            <div
              className="px-3 py-2.5 rounded-xl"
              style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.12)' }}
            >
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: ACCENT, boxShadow: `0 0 5px rgba(14,165,233,0.6)` }} />
                <p className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: 'rgba(14,165,233,0.65)' }}>
                  Organizasyon
                </p>
              </div>
              <p className="text-[12px] font-bold mt-1 truncate" style={{ color: ACCENT }}>{orgDisplayName}</p>
            </div>
          </div>
        )}

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5" style={{ scrollbarWidth: 'none' }}>
          {filteredGroups.map((group, gi) => (
            <div key={group.label} className={gi > 0 ? 'mt-4' : ''}>
              {!collapsed ? (
                <p
                  className="text-[9px] font-bold uppercase px-2 mb-2 select-none tracking-[0.14em]"
                  style={{ color: labelColor }}
                >
                  {group.label}
                </p>
              ) : (
                gi > 0 && <div className="h-px mx-2 mb-3 mt-1" style={{ background: borderColor }} />
              )}

              <ul className="space-y-0.5">
                {group.items.map(item => {
                  const isActive = activeModule === item.id;
                  const isHovered = hoveredItem === item.id;
                  const badge = badges[item.id];

                  return (
                    <li key={item.id} className={item.mobileOnly ? 'lg:hidden' : ''}>
                      <button
                        id={`sidebar-${item.id}`}
                        onClick={() => { setActiveModule(item.id); onMobileClose?.(); }}
                        onMouseEnter={() => setHoveredItem(item.id)}
                        onMouseLeave={() => setHoveredItem(null)}
                        title={collapsed ? item.label : ''}
                        className="w-full flex items-center text-left cursor-pointer relative overflow-hidden"
                        style={{
                          padding: collapsed ? '9px 0' : '8px 10px',
                          borderRadius: '10px',
                          justifyContent: collapsed ? 'center' : undefined,
                          gap: collapsed ? undefined : '10px',
                          background: isActive
                            ? 'rgba(14,165,233,0.1)'
                            : isHovered ? hoverBg : 'transparent',
                          border: isActive
                            ? '1px solid rgba(14,165,233,0.2)'
                            : '1px solid transparent',
                          transition: 'all 0.18s ease',
                        }}
                      >
                        {/* Left accent bar */}
                        {isActive && !collapsed && (
                          <span
                            className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
                            style={{
                              width: '3px',
                              height: '55%',
                              background: `linear-gradient(180deg, #38BDF8, ${ACCENT_DARK})`,
                              boxShadow: '0 0 6px rgba(14,165,233,0.4)',
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
                              color: isActive ? ACCENT : isHovered ? (isDark ? '#94a3b8' : '#475569') : textMuted,
                              transition: 'color 0.18s ease',
                            }}
                          />
                        </span>

                        {/* Label + badge */}
                        {!collapsed && (
                          <>
                            <span
                              className="flex-1 leading-none text-[12px] truncate"
                              style={{
                                color: isActive ? ACCENT : isHovered ? textPrimary : textMuted,
                                fontWeight: isActive ? 600 : 500,
                                transition: 'color 0.18s ease',
                              }}
                            >
                              {item.label}
                            </span>
                            {badge != null && badge > 0 && (
                              <span
                                className="text-[8.5px] font-bold text-white rounded-full min-w-[15px] h-[15px] flex items-center justify-center px-1 flex-shrink-0"
                                style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)' }}
                              >
                                {badge > 9 ? '9+' : badge}
                              </span>
                            )}
                            {/* Active dot */}
                            {isActive && badge == null && (
                              <span
                                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ background: ACCENT, boxShadow: '0 0 5px rgba(14,165,233,0.6)' }}
                              />
                            )}
                          </>
                        )}

                        {/* Badge dot when collapsed */}
                        {collapsed && badge != null && badge > 0 && (
                          <span
                            className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
                            style={{ background: '#EF4444' }}
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

        {/* ── Mini Stats ── */}
        {!collapsed && (
          <div className="px-3 pb-2">
            <div
              className="rounded-xl p-3 flex gap-0"
              style={{ background: statsBg, border: `1px solid ${borderColor}` }}
            >
              {[
                { value: firmalar.filter(f => !f.silinmis).length,    label: 'Firma',    color: ACCENT },
                { value: personeller.filter(p => !p.silinmis).length, label: 'Personel', color: '#34D399' },
                { value: evraklar.filter(e => !e.silinmis).length,    label: 'Evrak',    color: '#FCD34D' },
              ].map((stat, i) => (
                <Fragment key={stat.label}>
                  {i > 0 && (
                    <div className="w-px self-stretch mx-2" style={{ background: borderColor }} />
                  )}
                  <div className="flex-1 text-center">
                    <p className="text-[12px] font-bold leading-none" style={{ color: stat.color }}>{stat.value}</p>
                    <p className="text-[8.5px] font-semibold mt-0.5" style={{ color: textMuted }}>{stat.label}</p>
                  </div>
                </Fragment>
              ))}
            </div>
          </div>
        )}

        {/* ── Support Button ── */}
        <div className={`px-2.5 pb-2 ${collapsed ? 'flex justify-center' : ''}`}>
          <button
            onClick={openSupport}
            title={collapsed ? 'Destek / Sorun Bildir' : ''}
            className={`cursor-pointer rounded-xl transition-all duration-150 ${collapsed ? 'w-10 h-10 flex items-center justify-center' : 'w-full flex items-center gap-2.5 px-3 py-2'}`}
            style={{
              background: 'rgba(14,165,233,0.06)',
              border: '1px solid rgba(14,165,233,0.14)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.12)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.28)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.06)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.14)';
            }}
          >
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
              <i className="ri-customer-service-2-line text-xs" style={{ color: ACCENT }} />
            </div>
            {!collapsed && (
              <>
                <span className="text-[11.5px] font-semibold flex-1 text-left" style={{ color: ACCENT }}>Destek</span>
                <i className="ri-arrow-right-s-line text-xs" style={{ color: 'rgba(14,165,233,0.4)' }} />
              </>
            )}
          </button>
        </div>

        {/* ── Profile ── */}
        <div
          className={`mx-2.5 mb-3 rounded-xl flex items-center ${collapsed ? 'justify-center p-2' : 'gap-2.5 px-3 py-2.5'}`}
          style={{ background: profileBg, border: `1px solid ${borderColor}` }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DARK})` }}
          >
            {userInitial}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-[11.5px] font-semibold truncate leading-tight" style={{ color: textPrimary }}>
                  {userName}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT, boxShadow: '0 0 4px rgba(14,165,233,0.6)' }} />
                  <p className="text-[9.5px] font-semibold" style={{ color: ACCENT }}>{roleLabel}</p>
                </div>
              </div>
              <button
                onClick={logout}
                title="Çıkış Yap"
                className="flex items-center justify-center cursor-pointer rounded-md w-6 h-6 flex-shrink-0 transition-all duration-150"
                style={{ color: textFaint, background: 'transparent', border: 'none' }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.color = '#F87171';
                  (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.color = textFaint;
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
