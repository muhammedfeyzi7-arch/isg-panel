import { useEffect, Fragment, useState } from 'react';
import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import SupportModal from './SupportModal';

const ROLE_MODULES: Record<string, string[]> = {
  admin: [
    'dashboard', 'firmalar', 'personeller',
    'evraklar', 'firma-evraklari', 'egitimler', 'muayeneler', 'tutanaklar',
    'uygunsuzluklar', 'ekipmanlar', 'is-izinleri',
    'raporlar', 'copkutusu', 'ayarlar',
  ],
  denetci: [
    'dashboard', 'firmalar', 'personeller',
    'ekipmanlar', 'uygunsuzluklar',
  ],
  member: [
    'dashboard', 'firmalar', 'personeller',
    'evraklar', 'firma-evraklari', 'egitimler', 'muayeneler', 'tutanaklar',
    'uygunsuzluklar', 'ekipmanlar', 'is-izinleri',
    'raporlar', 'copkutusu',
  ],
};

function getAllowedModules(role: string): string[] {
  return ROLE_MODULES[role] ?? ROLE_MODULES.member;
}

const menuGroups = [
  {
    label: 'GENEL',
    items: [
      { id: 'dashboard',    label: 'Kontrol Paneli',    icon: 'ri-dashboard-3-line' },
      { id: 'firmalar',     label: 'Firmalar',           icon: 'ri-building-2-line' },
      { id: 'personeller',  label: 'Personeller',        icon: 'ri-team-line' },
    ],
  },
  {
    label: 'YÖNETİM',
    items: [
      { id: 'evraklar',        label: 'Evrak Takibi',        icon: 'ri-file-list-3-line' },
      { id: 'firma-evraklari', label: 'Firma Evrakları',     icon: 'ri-building-4-line' },
      { id: 'egitimler',       label: 'Eğitim Evrakları',   icon: 'ri-graduation-cap-line' },
      { id: 'muayeneler',      label: 'Sağlık Evrakları',   icon: 'ri-heart-pulse-line' },
      { id: 'tutanaklar',      label: 'Tutanaklar',          icon: 'ri-article-line' },
      { id: 'uygunsuzluklar',  label: 'Saha Denetim',       icon: 'ri-map-pin-user-line' },
      { id: 'ekipmanlar',      label: 'Ekipman Kontrolleri', icon: 'ri-tools-line' },
      { id: 'is-izinleri',     label: 'İş İzni Takip',      icon: 'ri-shield-keyhole-line' },
    ],
  },
  {
    label: 'SİSTEM',
    items: [
      { id: 'raporlar',  label: 'Raporlar & Analiz', icon: 'ri-bar-chart-2-line' },
      { id: 'copkutusu', label: 'Çöp Kutusu',        icon: 'ri-delete-bin-2-line' },
      { id: 'ayarlar',   label: 'Ayarlar',            icon: 'ri-settings-4-line' },
    ],
  },
];

const ROLE_LABELS: Record<string, { label: string; color: string; dot: string }> = {
  admin:   { label: 'Admin Kullanıcı',                  color: '#F59E0B', dot: '#F59E0B' },
  denetci: { label: 'Saha Personeli',                   color: '#22D3EE', dot: '#22D3EE' },
  member:  { label: 'Evrak/Dökümantasyon Denetçi',      color: '#A78BFA', dot: '#A78BFA' },
};

interface SidebarProps {
  onMobileClose?: () => void;
  isDark?: boolean;
  mobileOpen?: boolean;
}

export default function Sidebar({ onMobileClose, isDark = true, mobileOpen = false }: SidebarProps) {
  const { activeModule, setActiveModule, sidebarCollapsed, currentUser, firmalar, personeller, evraklar, org } = useApp();
  const { logout } = useAuth();
  const [supportOpen, setSupportOpen] = useState(false);

  const userRole = org?.role ?? 'member';
  const allowedModules = getAllowedModules(userRole);
  const roleInfo = ROLE_LABELS[userRole] ?? ROLE_LABELS.member;

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
  const dark = isDark;

  // ── Design tokens ──
  const sidebarBg = dark
    ? 'var(--bg-sidebar)'
    : '#FFFFFF';
  const sidebarBorder = dark
    ? '1px solid var(--border-subtle)'
    : '1px solid rgba(15,23,42,0.08)';
  const logoBorderBottom = dark
    ? '1px solid var(--border-main)'
    : '1px solid rgba(15,23,42,0.07)';
  const groupLabelColor = dark ? 'rgba(255,255,255,0.32)' : '#94A3B8';
  const groupDividerBg  = dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)';
  const statsBg         = dark ? 'rgba(255,255,255,0.04)' : '#F8FAFC';
  const statsBorder     = dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.07)';
  const statsDivider    = dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)';
  const statsLabelColor = dark ? 'rgba(255,255,255,0.38)' : '#94A3B8';
  const profileBg       = dark ? 'rgba(255,255,255,0.04)' : '#F8FAFC';
  const profileBorder   = dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.07)';
  const profileNameColor= dark ? '#E2E8F0' : '#0F172A';
  const logoutColor     = dark ? 'rgba(255,255,255,0.35)' : '#94A3B8';
  const logoTitleColor  = dark ? '#F1F5F9' : '#0F172A';
  const logoSubColor    = dark ? 'rgba(165,180,252,0.7)' : '#64748B';

  return (
    <>
    <aside
      className={`
        fixed left-0 top-0 h-screen flex flex-col z-40
        ${collapsed ? 'w-[68px]' : 'w-[252px]'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
      style={{
        background: sidebarBg,
        borderRight: sidebarBorder,
        transition: 'width 0.26s cubic-bezier(0.4,0,0.2,1), transform 0.26s cubic-bezier(0.4,0,0.2,1)',
        maxWidth: '300px',
      }}
    >
      {/* ── Logo ── */}
      <div
        className={`flex items-center ${collapsed ? 'justify-center px-3' : 'px-4 gap-2.5'}`}
        style={{
          borderBottom: logoBorderBottom,
          height: '60px',
          minHeight: '60px',
          flexShrink: 0,
        }}
      >
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: '30px',
            height: '30px',
            borderRadius: '9px',
            background: dark
              ? 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(99,102,241,0.1))'
              : 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(99,102,241,0.06))',
            border: dark ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(99,102,241,0.2)',
          }}
        >
          <img
            src="https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518"
            alt="ISG Logo"
            style={{
              height: '18px',
              width: 'auto',
              objectFit: 'contain',
              display: 'block',
              filter: dark ? 'brightness(1.15) drop-shadow(0 0 5px rgba(99,102,241,0.4))' : 'none',
              transition: 'all 0.26s ease',
            }}
          />
        </div>

        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p
              className="text-[13px] font-bold leading-tight truncate"
              style={{ color: logoTitleColor, letterSpacing: '-0.02em' }}
            >
              ISG Denetim
            </p>
            <p
              className="text-[10px] mt-0.5 font-semibold truncate"
              style={{ color: logoSubColor, letterSpacing: '0.01em' }}
            >
              Yönetim Sistemi
            </p>
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {filteredGroups.map(group => (
          <div key={group.label}>
            {!collapsed && (
              <p
                className="text-[9px] font-bold uppercase px-2.5 mb-1.5 select-none tracking-[0.14em]"
                style={{ color: groupLabelColor }}
              >
                {group.label}
              </p>
            )}
            {collapsed && (
              <div className="h-px mx-2 mb-2.5" style={{ background: groupDividerBg }} />
            )}

            <ul className="space-y-0.5">
              {group.items.map(item => {
                const isActive = activeModule === item.id;
                const badge = badges[item.id];

                const activeBg = dark
                  ? 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(99,102,241,0.08))'
                  : 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(99,102,241,0.05))';
                const activeBorderColor = dark ? 'rgba(99,102,241,0.35)' : 'rgba(99,102,241,0.3)';
                const activeTextColor   = dark ? '#C7D2FE' : '#4338CA';
                const activeIconColor   = dark ? '#818CF8' : '#4F46E5';
                const inactiveTextColor = dark ? '#94A3B8' : '#64748B';
                const inactiveIconColor = dark ? '#64748B' : '#94A3B8';
                const hoverBg = dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)';

                return (
                  <li key={item.id}>
                    <button
                      id={`sidebar-${item.id}`}
                      onClick={() => { setActiveModule(item.id); onMobileClose?.(); }}
                      title={collapsed ? item.label : ''}
                      className="w-full flex items-center gap-2.5 text-left cursor-pointer relative"
                      style={{
                        padding: collapsed ? '9px 0' : '8px 10px',
                        borderRadius: '10px',
                        justifyContent: collapsed ? 'center' : undefined,
                        background: isActive ? activeBg : 'transparent',
                        border: isActive
                          ? `1px solid ${activeBorderColor}`
                          : '1px solid transparent',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={e => {
                        if (!isActive) {
                          e.currentTarget.style.background = hoverBg;
                          e.currentTarget.style.borderColor = dark
                            ? 'rgba(255,255,255,0.055)'
                            : 'rgba(15,23,42,0.07)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.borderColor = 'transparent';
                        }
                      }}
                    >
                      {/* Active left accent bar */}
                      {isActive && !collapsed && (
                        <span
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-full"
                          style={{
                            height: '60%',
                            background: 'linear-gradient(180deg, #818CF8, #6366F1)',
                          }}
                        />
                      )}

                      {/* Icon */}
                      <span
                        className="flex items-center justify-center flex-shrink-0"
                        style={{
                          width: '18px',
                          height: '18px',
                          color: isActive ? activeIconColor : inactiveIconColor,
                          transition: 'color 0.15s ease',
                          marginLeft: isActive && !collapsed ? '6px' : undefined,
                        }}
                      >
                        <i className={`${item.icon} text-[14.5px]`} />
                      </span>

                      {/* Label + badge */}
                      {!collapsed && (
                        <>
                          <span
                            className="text-[12.5px] flex-1 leading-none truncate"
                            style={{
                              color: isActive ? activeTextColor : inactiveTextColor,
                              fontWeight: isActive ? 600 : 500,
                              transition: 'color 0.15s ease',
                            }}
                          >
                            {item.label}
                          </span>
                          {badge != null && badge > 0 && (
                            <span
                              className="text-[9px] font-bold text-white rounded-full min-w-[17px] h-[17px] flex items-center justify-center px-1 flex-shrink-0"
                              style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)' }}
                            >
                              {badge > 9 ? '9+' : badge}
                            </span>
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
        <div className="px-2.5 pb-2">
          <div
            className="rounded-xl p-3 flex gap-0"
            style={{ background: statsBg, border: statsBorder }}
          >
            {[
              { value: firmalar.filter(f => !f.silinmis).length,   label: 'Firma',   color: '#818CF8' },
              { value: personeller.filter(p => !p.silinmis).length, label: 'Personel', color: '#34D399' },
              { value: evraklar.filter(e => !e.silinmis).length,    label: 'Evrak',   color: '#FCD34D' },
            ].map((stat, i) => (
              <Fragment key={stat.label}>
                {i > 0 && (
                  <div className="w-px self-stretch mx-2" style={{ background: statsDivider }} />
                )}
                <div className="flex-1 text-center">
                  <p className="text-[13px] font-bold leading-none" style={{ color: stat.color }}>{stat.value}</p>
                  <p className="text-[9px] font-semibold mt-1" style={{ color: statsLabelColor }}>{stat.label}</p>
                </div>
              </Fragment>
            ))}
          </div>
        </div>
      )}

      {/* ── Support Button ── */}
      <div className="px-2.5 pb-2">
        <button
          onClick={() => setSupportOpen(true)}
          title={collapsed ? 'Destek / Sorun Bildir' : ''}
          className={`w-full flex items-center cursor-pointer rounded-xl transition-all duration-150 ${collapsed ? 'justify-center p-2' : 'gap-2.5 px-3 py-2'}`}
          style={{
            background: dark ? 'rgba(16,185,129,0.07)' : 'rgba(16,185,129,0.06)',
            border: '1px solid rgba(16,185,129,0.18)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = dark ? 'rgba(16,185,129,0.13)' : 'rgba(16,185,129,0.11)';
            e.currentTarget.style.borderColor = 'rgba(16,185,129,0.32)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = dark ? 'rgba(16,185,129,0.07)' : 'rgba(16,185,129,0.06)';
            e.currentTarget.style.borderColor = 'rgba(16,185,129,0.18)';
          }}
        >
          <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
            <i className="ri-customer-service-2-line text-sm" style={{ color: '#10B981' }} />
          </div>
          {!collapsed && (
            <span className="text-[12px] font-semibold flex-1 text-left" style={{ color: '#10B981' }}>
              Destek
            </span>
          )}
          {!collapsed && (
            <i className="ri-arrow-right-s-line text-xs" style={{ color: 'rgba(16,185,129,0.5)' }} />
          )}
        </button>
      </div>

      {/* ── Profile ── */}
      <div
        className={`mx-2.5 mb-3 rounded-xl flex items-center gap-2.5 cursor-pointer ${collapsed ? 'justify-center p-2' : 'px-3 py-2.5'}`}
        style={{
          background: profileBg,
          border: profileBorder,
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = dark
            ? 'rgba(255,255,255,0.05)'
            : '#F1F5F9';
          e.currentTarget.style.borderColor = dark
            ? 'rgba(255,255,255,0.09)'
            : 'rgba(15,23,42,0.12)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = profileBg;
          e.currentTarget.style.borderColor = dark
            ? 'rgba(255,255,255,0.055)'
            : 'rgba(15,23,42,0.07)';
        }}
      >
        {/* Avatar */}
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)' }}
        >
          {(currentUser.ad || 'U').charAt(0).toUpperCase()}
        </div>

        {!collapsed && (
          <>
            <div className="flex-1 min-w-0">
              <p
                className="text-[12px] font-semibold truncate leading-tight"
                style={{ color: profileNameColor }}
              >
                {currentUser.ad || 'Kullanıcı'}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: roleInfo.dot }}
                />
                <p className="text-[10px] font-semibold truncate" style={{ color: roleInfo.color }}>
                  {roleInfo.label}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              title="Çıkış Yap"
              className="flex items-center justify-center cursor-pointer rounded-lg w-6 h-6 flex-shrink-0"
              style={{
                color: logoutColor,
                background: 'transparent',
                border: 'none',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#EF4444';
                e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = logoutColor;
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <i className="ri-logout-box-r-line text-sm" />
            </button>
          </>
        )}
      </div>
    </aside>

    <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />
    </>
  );
}
