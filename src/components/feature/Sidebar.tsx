import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';

const menuGroups = [
  {
    label: 'ANA MODÜLLER',
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

export default function Sidebar() {
  const { activeModule, setActiveModule, sidebarCollapsed, currentUser, firmalar, personeller, evraklar } = useApp();
  const { logout } = useAuth();

  const eksikEvrak = evraklar.filter(e => e.durum === 'Eksik' || e.durum === 'Süre Dolmuş').length;
  const badges: Record<string, number> = { evraklar: eksikEvrak };

  return (
    <aside
      className={`fixed left-0 top-0 h-screen flex flex-col transition-all duration-300 z-40 ${sidebarCollapsed ? 'w-[68px]' : 'w-[260px]'}`}
      style={{ background: 'var(--bg-sidebar)', borderRight: '1px solid rgba(255,255,255,0.06)', transition: 'width 0.3s ease, background 0.3s ease' }}
    >
      {/* Logo */}
      <div
        className={`flex items-center gap-3 py-4 ${sidebarCollapsed ? 'px-3 justify-center' : 'px-4'}`}
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div
          className="flex-shrink-0 flex items-center justify-center"
          style={{
            width: sidebarCollapsed ? '36px' : '44px',
            height: sidebarCollapsed ? '36px' : '44px',
            filter: 'drop-shadow(0 0 8px rgba(6,182,212,0.5))',
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
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide leading-tight">ISG Denetim</h1>
            <p className="text-[10px] mt-0.5 font-medium" style={{ color: '#06B6D4' }}>
              Yönetim Sistemi
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-5">
        {menuGroups.map(group => (
          <div key={group.label}>
            {!sidebarCollapsed && (
              <p className="text-[10px] font-bold uppercase px-3 mb-2 select-none" style={{ color: '#3D4E63', letterSpacing: '0.08em' }}>
                {group.label}
              </p>
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
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left cursor-pointer group relative transition-all duration-200 ${
                        isActive ? 'sidebar-active' : 'text-slate-500 sidebar-hover'
                      }`}
                    >
                      {isActive && (
                        <span
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r-full"
                          style={{ background: 'linear-gradient(180deg, #3B82F6, #6366F1)' }}
                        />
                      )}
                      <span className={`w-5 h-5 flex items-center justify-center flex-shrink-0 transition-all ${isActive ? 'text-blue-400' : ''}`}>
                        <i className={`${item.icon} text-base`} />
                      </span>
                      {!sidebarCollapsed && (
                        <>
                          <span className={`text-sm font-medium flex-1 ${isActive ? 'text-blue-300' : ''}`}>
                            {item.label}
                          </span>
                          {badge != null && badge > 0 && (
                            <span
                              className="text-[10px] font-bold text-white rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0"
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

      {/* Mini Stats */}
      {!sidebarCollapsed && (
        <div className="px-3 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="rounded-xl p-3 flex gap-3" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)' }}>
            <div className="flex-1 text-center">
              <p className="text-sm font-bold" style={{ background: 'linear-gradient(135deg, #60A5FA, #818CF8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {firmalar.length}
              </p>
              <p className="text-[10px] text-slate-600 mt-0.5">Firma</p>
            </div>
            <div className="w-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <div className="flex-1 text-center">
              <p className="text-sm font-bold" style={{ background: 'linear-gradient(135deg, #34D399, #10B981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {personeller.length}
              </p>
              <p className="text-[10px] text-slate-600 mt-0.5">Personel</p>
            </div>
            <div className="w-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <div className="flex-1 text-center">
              <p className="text-sm font-bold" style={{ background: 'linear-gradient(135deg, #FCD34D, #F59E0B)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {evraklar.length}
              </p>
              <p className="text-[10px] text-slate-600 mt-0.5">Evrak</p>
            </div>
          </div>
        </div>
      )}

      {/* Profile */}
      <div
        className={`px-3 py-3 flex items-center gap-3 ${sidebarCollapsed ? 'justify-center' : ''}`}
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)', boxShadow: '0 2px 10px rgba(99,102,241,0.4)' }}
        >
          {(currentUser.ad || 'U').charAt(0).toUpperCase()}
        </div>
        {!sidebarCollapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-300 truncate">{currentUser.ad || 'Kullanıcı'}</p>
            <p className="text-[10px] text-slate-600 truncate">{currentUser.rol}</p>
          </div>
        )}
        <button
          onClick={logout}
          title="Çıkış Yap"
          className={`flex items-center justify-center cursor-pointer transition-colors rounded-lg ${sidebarCollapsed ? 'w-7 h-7' : 'w-6 h-6'}`}
          style={{ color: '#475569' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = 'transparent'; }}
        >
          <i className="ri-logout-box-r-line text-sm" />
        </button>
      </div>
    </aside>
  );
}
