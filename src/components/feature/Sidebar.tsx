import { useEffect } from 'react';
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

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  admin: { label: 'Admin', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', icon: 'ri-shield-star-line' },
  denetci: { label: 'Denetçi', color: '#06B6D4', bg: 'rgba(6,182,212,0.12)', icon: 'ri-search-eye-line' },
  member: { label: 'Kullanıcı', color: '#818CF8', bg: 'rgba(99,102,241,0.12)', icon: 'ri-user-line' },
};

export default function Sidebar() {
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

  return (
    <aside
      className={`fixed left-0 top-0 h-screen flex flex-col z-40 ${sidebarCollapsed ? 'w-[68px]' : 'w-[260px]'}`}
      style={{
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* ── Logo ── */}
      <div
        className={`flex items-center gap-3 py-4 ${sidebarCollapsed ? 'px-3 justify-center' : 'px-4'}`}
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div
          className="flex-shrink-0 flex items-center justify-center"
          style={{
            width: sidebarCollapsed ? '34px' : '40px',
            height: sidebarCollapsed ? '34px' : '40px',
            filter: 'drop-shadow(0 0 10px rgba(6,182,212,0.45))',
            transition: 'width 0.3s ease, height 0.3s ease',
          }}
        >
          <img
            src="https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/ae509f81-0883-42e1-9ed0-d08483f4284e_ChatGPT-Image-28-Mar-2026-23_09_27.png?v=f1e78272586c7081b6d13820591aa1f8"
            alt="ISG Denetim Logo"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <h1 className="text-[13px] font-bold text-white tracking-tight leading-tight">ISG Denetim</h1>
            <p className="text-[10px] mt-0.5 font-medium" style={{ color: 'rgba(6,182,212,0.8)', letterSpacing: '0.03em' }}>
              Yönetim Sistemi
            </p>
          </div>
        )}
      </div>

      {/* ── Role badge ── */}
      {!sidebarCollapsed && (
        <div className="px-3 pt-3 pb-1">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold w-fit"
            style={{ background: roleInfo.bg, color: roleInfo.color, border: `1px solid ${roleInfo.color}20` }}
          >
            <i className={`${roleInfo.icon} text-[10px]`} />
            {roleInfo.label}
          </div>
        </div>
      )}

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-4">
        {filteredGroups.map(group => (
          <div key={group.label}>
            {!sidebarCollapsed && (
              <p
                className="text-[9px] font-bold uppercase px-2 mb-1.5 select-none tracking-widest"
                style={{ color: 'rgba(255,255,255,0.18)' }}
              >
                {group.label}
              </p>
            )}
            {sidebarCollapsed && (
              <div className="h-px mx-2 mb-2" style={{ background: 'rgba(255,255,255,0.05)' }} />
            )}
            <ul className="space-y-0.5">
              {group.items.map(item => {
                const isActive = activeModule === item.id;
                const badge = badges[item.id];
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => setActiveModule(item.id)}
                      title={sidebarCollapsed ? item.label : ''}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left cursor-pointer group relative transition-all duration-150 ${
                        isActive ? '' : ''
                      }`}
                      style={
                        isActive
                          ? {
                              background: 'rgba(59,130,246,0.14)',
                              border: '1px solid rgba(59,130,246,0.22)',
                            }
                          : {
                              background: 'transparent',
                              border: '1px solid transparent',
                            }
                      }
                      onMouseEnter={e => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.borderColor = 'transparent';
                        }
                      }}
                    >
                      {/* Active indicator */}
                      {isActive && (
                        <span
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full"
                          style={{ background: 'linear-gradient(180deg, #60A5FA, #818CF8)' }}
                        />
                      )}

                      {/* Icon */}
                      <span
                        className={`w-[18px] h-[18px] flex items-center justify-center flex-shrink-0 transition-colors duration-150`}
                        style={{ color: isActive ? '#93C5FD' : 'rgba(255,255,255,0.35)' }}
                      >
                        <i className={`${item.icon} text-[14px]`} />
                      </span>

                      {/* Label */}
                      {!sidebarCollapsed && (
                        <>
                          <span
                            className="text-[12.5px] flex-1 transition-colors duration-150 font-medium"
                            style={{ color: isActive ? '#BFDBFE' : 'rgba(255,255,255,0.45)' }}
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
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* ── Mini Stats ── */}
      {!sidebarCollapsed && (
        <div className="px-3 py-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div
            className="rounded-xl p-2.5 flex gap-2"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            {[
              { value: firmalar.filter(f => !f.silinmis).length, label: 'Firma', color: '#60A5FA' },
              { value: personeller.filter(p => !p.silinmis).length, label: 'Personel', color: '#34D399' },
              { value: evraklar.filter(e => !e.silinmis).length, label: 'Evrak', color: '#FCD34D' },
            ].map((stat, i) => (
              <>
                {i > 0 && <div key={`div-${i}`} className="w-px self-stretch" style={{ background: 'rgba(255,255,255,0.06)' }} />}
                <div key={stat.label} className="flex-1 text-center">
                  <p className="text-sm font-bold" style={{ color: stat.color }}>{stat.value}</p>
                  <p className="text-[9px] font-medium mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>{stat.label}</p>
                </div>
              </>
            ))}
          </div>
        </div>
      )}

      {/* ── Profile ── */}
      <div
        className={`px-3 py-3 flex items-center gap-2.5 ${sidebarCollapsed ? 'justify-center' : ''}`}
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
        >
          {(currentUser.ad || 'U').charAt(0).toUpperCase()}
        </div>
        {!sidebarCollapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold truncate" style={{ color: 'rgba(255,255,255,0.75)' }}>
              {currentUser.ad || 'Kullanıcı'}
            </p>
            <p className="text-[10px] font-medium truncate" style={{ color: roleInfo.color }}>
              {roleInfo.label}
            </p>
          </div>
        )}
        <button
          onClick={logout}
          title="Çıkış Yap"
          className="flex items-center justify-center cursor-pointer transition-all rounded-lg w-6 h-6 flex-shrink-0"
          style={{ color: 'rgba(255,255,255,0.2)', background: 'transparent', border: 'none' }}
          onMouseEnter={e => {
            e.currentTarget.style.color = '#EF4444';
            e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.2)';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <i className="ri-logout-box-r-line text-sm" />
        </button>
      </div>
    </aside>
  );
}
