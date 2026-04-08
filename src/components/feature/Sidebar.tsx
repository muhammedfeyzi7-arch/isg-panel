import { useEffect, Fragment, useState } from 'react';
import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import SupportModal from './SupportModal';

const ROLE_MODULES: Record<string, string[]> = {
  admin: [
    'dashboard', 'firmalar', 'personeller',
    'evraklar', 'firma-evraklari', 'egitimler', 'muayeneler', 'tutanaklar',
    'uygunsuzluklar', 'ekipmanlar', 'is-izinleri',
    'saha', 'raporlar', 'copkutusu', 'ayarlar',
  ],
  denetci: [
    'dashboard', 'firmalar', 'personeller',
    'ekipmanlar', 'uygunsuzluklar', 'saha',
    // muayeneler kasıtlı olarak yok — KVKK uyumu
  ],
  member: [
    'dashboard', 'firmalar', 'personeller',
    'evraklar', 'firma-evraklari', 'egitimler', 'muayeneler', 'tutanaklar',
    'uygunsuzluklar', 'ekipmanlar', 'is-izinleri',
    'saha', 'raporlar', 'copkutusu',
  ],
  firma_user: [
    'dashboard', 'personeller',
    'evraklar', 'egitimler',
    'uygunsuzluklar',
  ],
};

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
      { id: 'saha',      label: 'Saha Denetimleri', icon: 'ri-map-pin-user-line', mobileOnly: true },
      { id: 'raporlar',  label: 'Raporlar',          icon: 'ri-bar-chart-2-line' },
      { id: 'copkutusu', label: 'Çöp Kutusu',        icon: 'ri-delete-bin-2-line' },
      { id: 'ayarlar',   label: 'Ayarlar',            icon: 'ri-settings-4-line' },
    ],
  },
];

const ROLE_LABELS: Record<string, { label: string; color: string; dot: string }> = {
  admin:      { label: 'Admin Kullanıcı',              color: '#F59E0B', dot: '#F59E0B' },
  denetci:    { label: 'Saha Personeli',               color: '#22D3EE', dot: '#22D3EE' },
  member:     { label: 'Evrak/Dökümantasyon Denetçi',  color: '#A78BFA', dot: '#A78BFA' },
  firma_user: { label: 'Firma Yetkilisi',              color: '#34D399', dot: '#34D399' },
};

interface SidebarProps {
  onMobileClose?: () => void;
  isDark?: boolean;
  mobileOpen?: boolean;
}

export default function Sidebar({ onMobileClose, isDark = true, mobileOpen = false }: SidebarProps) {
  const { activeModule, setActiveModule, sidebarCollapsed, currentUser, firmalar, personeller, evraklar, org, orgLoading } = useApp();
  const { logout } = useAuth();
  const [supportOpen, setSupportOpen] = useState(false);

  const userRole = org?.role ?? 'member';
  // org yüklenene kadar (loading veya null) tüm modüllere izin ver — yanlış kısıtlama olmasın
  const allowedModules = (orgLoading || !org) ? getAllowedModules('admin') : getAllowedModules(userRole);
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
        ${collapsed ? 'w-[56px]' : 'w-[220px]'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
      style={{
        background: sidebarBg,
        borderRight: sidebarBorder,
        transition: 'width 0.26s cubic-bezier(0.4,0,0.2,1), transform 0.26s cubic-bezier(0.4,0,0.2,1)',
        maxWidth: '260px',
      }}
    >
      {/* ── Logo ── */}
      <div
        className={`flex items-center ${collapsed ? 'justify-center px-2' : 'px-3.5 gap-2'}`}
        style={{
          borderBottom: logoBorderBottom,
          height: '52px',
          minHeight: '52px',
          flexShrink: 0,
        }}
      >
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: '26px',
            height: '26px',
            borderRadius: '8px',
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
              height: '15px',
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
              className="text-[12px] font-bold leading-tight truncate"
              style={{ color: logoTitleColor, letterSpacing: '-0.02em' }}
            >
              ISG Denetim
            </p>
            <p
              className="text-[9px] mt-0.5 font-semibold truncate"
              style={{ color: logoSubColor, letterSpacing: '0.01em' }}
            >
              Yönetim Sistemi
            </p>
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-2 px-1.5 space-y-3">
        {filteredGroups.map(group => (
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
                const isActive = activeModule === item.id;
                const badge = badges[item.id];
                // mobileOnly öğeler sadece mobil sidebar'da (mobileOpen=true) gösterilir
                if (item.mobileOnly && !mobileOpen) return null;

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
                      className="w-full flex items-center gap-2 text-left cursor-pointer relative"
                      style={{
                        padding: collapsed ? '7px 0' : '6.5px 8px',
                        borderRadius: '8px',
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
                          width: '16px',
                          height: '16px',
                          color: isActive ? activeIconColor : inactiveIconColor,
                          transition: 'color 0.15s ease',
                          marginLeft: isActive && !collapsed ? '5px' : undefined,
                        }}
                      >
                        <i className={`${item.icon} text-[13px]`} />
                      </span>

                      {/* Label + badge */}
                      {!collapsed && (
                        <>
                          <span
                            className="text-[11.5px] flex-1 leading-none truncate"
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
                              className="text-[8.5px] font-bold text-white rounded-full min-w-[15px] h-[15px] flex items-center justify-center px-1 flex-shrink-0"
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
        <div className="px-2 pb-1.5">
          <div
            className="rounded-lg p-2.5 flex gap-0"
            style={{ background: statsBg, border: statsBorder }}
          >
            {[
              { value: firmalar.filter(f => !f.silinmis).length,   label: 'Firma',   color: '#818CF8' },
              { value: personeller.filter(p => !p.silinmis).length, label: 'Personel', color: '#34D399' },
              { value: evraklar.filter(e => !e.silinmis).length,    label: 'Evrak',   color: '#FCD34D' },
            ].map((stat, i) => (
              <Fragment key={stat.label}>
                {i > 0 && (
                  <div className="w-px self-stretch mx-1.5" style={{ background: statsDivider }} />
                )}
                <div className="flex-1 text-center">
                  <p className="text-[12px] font-bold leading-none" style={{ color: stat.color }}>{stat.value}</p>
                  <p className="text-[8.5px] font-semibold mt-0.5" style={{ color: statsLabelColor }}>{stat.label}</p>
                </div>
              </Fragment>
            ))}
          </div>
        </div>
      )}

      {/* ── Support Button ── */}
      <div className="px-2 pb-1.5">
        <button
          onClick={() => setSupportOpen(true)}
          title={collapsed ? 'Destek / Sorun Bildir' : ''}
          className={`w-full flex items-center cursor-pointer rounded-lg transition-all duration-150 ${collapsed ? 'justify-center p-1.5' : 'gap-2 px-2.5 py-1.5'}`}
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
          <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
            <i className="ri-customer-service-2-line text-xs" style={{ color: '#10B981' }} />
          </div>
          {!collapsed && (
            <span className="text-[11px] font-semibold flex-1 text-left" style={{ color: '#10B981' }}>
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
        className={`mx-2 mb-2.5 rounded-lg flex items-center gap-2 cursor-pointer ${collapsed ? 'justify-center p-1.5' : 'px-2.5 py-2'}`}
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
          className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)' }}
        >
          {(currentUser.ad || 'U').charAt(0).toUpperCase()}
        </div>

        {!collapsed && (
          <>
            <div className="flex-1 min-w-0">
              <p
                className="text-[11px] font-semibold truncate leading-tight"
                style={{ color: profileNameColor }}
              >
                {currentUser.ad || 'Kullanıcı'}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: roleInfo.dot }}
                />
                <p className="text-[9px] font-semibold truncate" style={{ color: roleInfo.color }}>
                  {roleInfo.label}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              title="Çıkış Yap"
              className="flex items-center justify-center cursor-pointer rounded-md w-5 h-5 flex-shrink-0"
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
