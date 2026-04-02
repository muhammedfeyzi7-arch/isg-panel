import { useEffect, Fragment } from 'react';
import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';

const ROLE_MODULES: Record<string, string[]> = {
  admin: [
    'dashboard', 'firmalar', 'personeller',
    'evraklar', 'egitimler', 'muayeneler', 'tutanaklar',
    'uygunsuzluklar', 'ekipmanlar', 'gorevler', 'is-izinleri',
    'raporlar', 'copkutusu', 'ayarlar',
  ],
  denetci: [
    'dashboard', 'firmalar', 'personeller',
    'uygunsuzluklar', 'tutanaklar', 'is-izinleri', 'raporlar',
    'ayarlar',
  ],
  member: [
    'dashboard', 'firmalar', 'personeller',
    'evraklar', 'egitimler', 'muayeneler', 'tutanaklar',
    'uygunsuzluklar', 'ekipmanlar', 'gorevler', 'is-izinleri',
    'raporlar', 'copkutusu', 'ayarlar',
  ],
};

function getAllowedModules(role: string): string[] {
  return ROLE_MODULES[role] ?? ROLE_MODULES.member;
}

const menuGroups = [
  {
    label: 'GENEL',
    items: [
      { id: 'dashboard', label: 'Kontrol Paneli', icon: 'ri-dashboard-3-line' },
      { id: 'firmalar', label: 'Firmalar', icon: 'ri-building-2-line' },
      { id: 'personeller', label: 'Personeller', icon: 'ri-team-line' },
    ],
  },
  {
    label: 'YÖNETİM',
    items: [
      { id: 'evraklar', label: 'Evrak Takibi', icon: 'ri-file-list-3-line' },
      { id: 'egitimler', label: 'Eğitim Evrakları', icon: 'ri-graduation-cap-line' },
      { id: 'muayeneler', label: 'Sağlık Evrakları', icon: 'ri-heart-pulse-line' },
      { id: 'tutanaklar', label: 'Tutanaklar', icon: 'ri-article-line' },
      { id: 'uygunsuzluklar', label: 'Saha Denetim', icon: 'ri-map-pin-user-line' },
      { id: 'ekipmanlar', label: 'Ekipman Kontrolleri', icon: 'ri-tools-line' },
      { id: 'gorevler', label: 'Görevler', icon: 'ri-task-line' },
      { id: 'is-izinleri', label: 'İş İzni Takip', icon: 'ri-shield-keyhole-line' },
    ],
  },
  {
    label: 'SİSTEM',
    items: [
      { id: 'raporlar', label: 'Raporlar & Analiz', icon: 'ri-bar-chart-2-line' },
      { id: 'copkutusu', label: 'Çöp Kutusu', icon: 'ri-delete-bin-2-line' },
      { id: 'ayarlar', label: 'Ayarlar', icon: 'ri-settings-4-line' },
    ],
  },
];

const ROLE_LABELS: Record<string, { label: string; color: string; dot: string }> = {
  admin:   { label: 'Admin',     color: '#F59E0B', dot: '#F59E0B' },
  denetci: { label: 'Denetçi',   color: '#22D3EE', dot: '#22D3EE' },
  member:  { label: 'Kullanıcı', color: '#A78BFA', dot: '#A78BFA' },
};

interface SidebarProps {
  onMobileClose?: () => void;
  isDark?: boolean;
}

export default function Sidebar({ onMobileClose, isDark = true }: SidebarProps) {
  const { activeModule, setActiveModule, sidebarCollapsed, currentUser, firmalar, personeller, evraklar, org } = useApp();
  const { logout } = useAuth();

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

  // ── Style tokens based on mode ──
  const dark = isDark;

  const sidebarBg = dark
    ? 'linear-gradient(180deg, #0f172a 0%, #111827 100%)'
    : '#ffffff';
  const sidebarBorder = dark
    ? '1px solid rgba(255,255,255,0.05)'
    : '1px solid #e5e7eb';
  const logoBorderBottom = dark
    ? '1px solid rgba(255,255,255,0.06)'
    : '1px solid #f3f4f6';
  const groupLabelColor = dark ? 'rgba(255,255,255,0.2)' : '#9ca3af';
  const groupDividerBg = dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6';
  const statsBg = dark ? 'rgba(255,255,255,0.03)' : '#f9fafb';
  const statsBorder = dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e5e7eb';
  const statsDivider = dark ? 'rgba(255,255,255,0.06)' : '#e5e7eb';
  const statsLabelColor = dark ? 'rgba(255,255,255,0.22)' : '#9ca3af';
  const profileBg = dark ? 'rgba(255,255,255,0.03)' : '#f9fafb';
  const profileBorder = dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e5e7eb';
  const profileNameColor = dark ? 'rgba(255,255,255,0.8)' : '#111827';
  const logoutColor = dark ? 'rgba(255,255,255,0.2)' : '#9ca3af';
  const logoTitleColor = dark ? '#e2f8fb' : '#111827';
  const logoSubColor = dark ? 'rgba(34,211,238,0.55)' : '#6b7280';

  return (
    <aside
      className={`fixed left-0 top-0 h-screen flex flex-col z-40 ${collapsed ? 'w-[68px]' : 'w-[252px]'}`}
      style={{
        background: sidebarBg,
        borderRight: sidebarBorder,
        transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* ── Logo ── */}
      <div
        className={`flex items-center ${collapsed ? 'justify-center px-3 py-4' : 'px-4 py-4 gap-3'}`}
        style={{
          borderBottom: logoBorderBottom,
          minHeight: '60px',
        }}
      >
        {/* Logo image container */}
        <div
          className="flex-shrink-0 flex items-center justify-center overflow-hidden"
          style={{
            width: collapsed ? '30px' : '34px',
            height: '34px',
            minWidth: collapsed ? '30px' : '34px',
            transition: 'all 0.28s ease',
          }}
        >
          <img
            src="https://storage.readdy-site.link/images/2b2f6d06-2b0c-4e86-8bc6-4a76e6f99c56.webp"
            alt="ISG Logo"
            style={{
              height: '30px',
              width: 'auto',
              maxWidth: collapsed ? '30px' : '34px',
              objectFit: 'contain',
              display: 'block',
              filter: dark ? 'drop-shadow(0 0 6px rgba(34,211,238,0.3))' : 'none',
            }}
          />
        </div>

        {/* Logo text — only when expanded */}
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p
              className="text-[13px] font-bold leading-tight truncate"
              style={{ color: logoTitleColor, letterSpacing: '-0.02em' }}
            >
              ISG Denetim
            </p>
            <p
              className="text-[10px] mt-0.5 font-medium truncate"
              style={{ color: logoSubColor, letterSpacing: '0.02em' }}
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
            {/* Group label — expanded */}
            {!collapsed && (
              <p
                className="text-[9.5px] font-bold uppercase px-2.5 mb-1.5 select-none tracking-[0.12em]"
                style={{ color: groupLabelColor }}
              >
                {group.label}
              </p>
            )}
            {/* Group divider — collapsed */}
            {collapsed && (
              <div className="h-px mx-2 mb-2.5" style={{ background: groupDividerBg }} />
            )}

            <ul className="space-y-0.5">
              {group.items.map(item => {
                const isActive = activeModule === item.id;
                const badge = badges[item.id];

                // Active styles
                const activeBg = dark
                  ? 'rgba(59,130,246,0.12)'
                  : '#e0f2fe';
                const activeBorderColor = dark ? '#22c55e' : '#3b82f6';
                const activeTextColor = dark ? '#e2f8fb' : '#1d4ed8';
                const activeIconColor = dark ? '#22D3EE' : '#2563eb';
                const inactiveTextColor = dark ? 'rgba(255,255,255,0.45)' : '#6b7280';
                const inactiveIconColor = dark ? 'rgba(255,255,255,0.3)' : '#9ca3af';
                const hoverBg = dark ? 'rgba(255,255,255,0.05)' : '#f3f4f6';

                return (
                  <li key={item.id}>
                    <button
                      onClick={() => { setActiveModule(item.id); onMobileClose?.(); }}
                      title={collapsed ? item.label : ''}
                      className="w-full flex items-center gap-2.5 text-left cursor-pointer relative transition-all duration-150"
                      style={{
                        padding: collapsed ? '9px 0' : '9px 10px',
                        borderRadius: '10px',
                        justifyContent: collapsed ? 'center' : undefined,
                        background: isActive ? activeBg : 'transparent',
                        borderLeft: isActive && !collapsed
                          ? `3px solid ${activeBorderColor}`
                          : '3px solid transparent',
                        paddingLeft: !collapsed ? (isActive ? '9px' : '10px') : undefined,
                      }}
                      onMouseEnter={e => {
                        if (!isActive) {
                          e.currentTarget.style.background = hoverBg;
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      {/* Icon */}
                      <span
                        className="flex items-center justify-center flex-shrink-0"
                        style={{
                          width: '18px',
                          height: '18px',
                          color: isActive ? activeIconColor : inactiveIconColor,
                          transition: 'color 0.15s ease',
                        }}
                      >
                        <i className={`${item.icon} text-[15px]`} />
                      </span>

                      {/* Label + badge */}
                      {!collapsed && (
                        <>
                          <span
                            className="text-[12.5px] flex-1 font-medium leading-none truncate"
                            style={{
                              color: isActive ? activeTextColor : inactiveTextColor,
                              transition: 'color 0.15s ease',
                            }}
                          >
                            {item.label}
                          </span>
                          {badge != null && badge > 0 && (
                            <span
                              className="text-[9px] font-bold text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 flex-shrink-0"
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
                          className="absolute top-1 right-1 w-2 h-2 rounded-full"
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
              { value: firmalar.filter(f => !f.silinmis).length, label: 'Firma', color: '#60A5FA' },
              { value: personeller.filter(p => !p.silinmis).length, label: 'Personel', color: '#34D399' },
              { value: evraklar.filter(e => !e.silinmis).length, label: 'Evrak', color: '#FCD34D' },
            ].map((stat, i) => (
              <Fragment key={stat.label}>
                {i > 0 && (
                  <div className="w-px self-stretch mx-2" style={{ background: statsDivider }} />
                )}
                <div className="flex-1 text-center">
                  <p className="text-[13px] font-bold leading-none" style={{ color: stat.color }}>{stat.value}</p>
                  <p className="text-[9px] font-medium mt-1" style={{ color: statsLabelColor }}>{stat.label}</p>
                </div>
              </Fragment>
            ))}
          </div>
        </div>
      )}

      {/* ── Profile ── */}
      <div
        className={`mx-2.5 mb-3 rounded-xl flex items-center gap-2.5 cursor-pointer transition-all duration-150 ${collapsed ? 'justify-center p-2' : 'px-3 py-2.5'}`}
        style={{ background: profileBg, border: profileBorder }}
        onMouseEnter={e => {
          e.currentTarget.style.background = dark
            ? 'rgba(255,255,255,0.06)'
            : '#f3f4f6';
          e.currentTarget.style.borderColor = dark
            ? 'rgba(255,255,255,0.1)'
            : '#d1d5db';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = profileBg;
          e.currentTarget.style.borderColor = dark
            ? 'rgba(255,255,255,0.06)'
            : '#e5e7eb';
        }}
      >
        {/* Avatar */}
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #22D3EE, #0891B2)' }}
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
                <p className="text-[10px] font-medium truncate" style={{ color: roleInfo.color }}>
                  {roleInfo.label}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              title="Çıkış Yap"
              className="flex items-center justify-center cursor-pointer transition-all rounded-lg w-6 h-6 flex-shrink-0"
              style={{ color: logoutColor, background: 'transparent', border: 'none' }}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#EF4444';
                e.currentTarget.style.background = 'rgba(239,68,68,0.12)';
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
  );
}
