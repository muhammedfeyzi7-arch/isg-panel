import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';

interface TopbarProps {
  darkMode: boolean;
  onToggleDark: () => void;
}

export default function Topbar({ darkMode, onToggleDark }: TopbarProps) {
  const { session, logout, isConfigured } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const displayName = session?.fullName ?? 'Demo Kullanıcı';
  const displayOrg = session?.organizationName ?? 'OSGB Panel';
  const initials = displayName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  const roleLabel: Record<string, string> = { owner: 'Sahip', admin: 'Yönetici', specialist: 'Uzman', doctor: 'Hekim' };

  const handleLogout = async () => {
    await logout();
    setProfileOpen(false);
  };

  return (
    <header
      className="h-14 flex items-center px-4 md:px-6 gap-4 z-40 relative"
      style={{ backgroundColor: 'var(--card)', borderBottom: '1px solid var(--border)' }}
    >
      {/* Logo + Brand */}
      <div className="flex items-center gap-2.5 md:min-w-[200px]">
        <div
          className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
          style={{ backgroundColor: 'var(--text-primary)' }}
        >
          <i className="ri-shield-check-fill text-sm" style={{ color: 'var(--card)' }} />
        </div>
        <span className="font-semibold text-sm tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {displayOrg}
        </span>
      </div>

      {/* Search — masaüstünde görünür, mobilde gizli */}
      <div className="hidden md:flex flex-1 justify-center">
        <div className="relative w-full max-w-md">
          <div className="w-4 h-4 flex items-center justify-center absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
            <i className="ri-search-line text-sm" />
          </div>
          <input
            type="text"
            placeholder="Firma, personel veya ziyaret ara..."
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg focus:outline-none transition-colors"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-1 ml-auto md:min-w-[200px] justify-end">
        {/* Dark Mode Toggle */}
        <button
          onClick={onToggleDark}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          title={darkMode ? 'Açık Mod' : 'Koyu Mod'}
        >
          <i className={darkMode ? 'ri-sun-line text-base' : 'ri-moon-line text-base'} />
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer relative"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <i className="ri-notification-3-line text-base" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
          </button>
          {notifOpen && (
            <div
              className="absolute right-0 top-10 w-80 rounded-xl z-50 overflow-hidden"
              style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}
            >
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Bildirimler</span>
              </div>
              <div className="px-4 py-8 text-center">
                <i className="ri-notification-off-line text-2xl" style={{ color: 'var(--border)' }} />
                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Yeni bildirim yok</p>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-5 mx-1" style={{ backgroundColor: 'var(--border)' }} />

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
            className="flex items-center gap-2 pl-2 pr-1.5 py-1.5 rounded-lg transition-colors cursor-pointer"
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'var(--text-primary)' }}
            >
              <span className="text-xs font-semibold" style={{ color: 'var(--card)' }}>{initials}</span>
            </div>
            <span className="text-sm font-medium hidden sm:block" style={{ color: 'var(--text-primary)' }}>{displayName}</span>
            <div className="w-4 h-4 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
              <i className="ri-arrow-down-s-line text-sm" />
            </div>
          </button>

          {profileOpen && (
            <div
              className="absolute right-0 top-10 w-56 rounded-xl z-50 overflow-hidden"
              style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}
            >
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{displayName}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{session?.email ?? 'Demo Modu'}</p>
                {session?.role && (
                  <span
                    className="inline-block text-xs px-2 py-0.5 rounded-full mt-1.5"
                    style={{ backgroundColor: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                  >
                    {roleLabel[session.role] ?? session.role}
                  </span>
                )}
              </div>
              <div className="py-1">
                <button
                  onClick={() => { navigate('/ayarlar'); setProfileOpen(false); }}
                  className="w-full text-left px-4 py-2 text-sm transition-colors cursor-pointer flex items-center gap-2"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div className="w-4 h-4 flex items-center justify-center"><i className="ri-settings-3-line text-xs" /></div>
                  Ayarlar
                </button>
                {(session?.role === 'owner' || session?.role === 'admin') && (
                  <button
                    onClick={() => { navigate('/admin/activity-logs'); setProfileOpen(false); }}
                    className="w-full text-left px-4 py-2 text-sm transition-colors cursor-pointer flex items-center gap-2"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-file-list-3-line text-xs" /></div>
                    Aktivite Logları
                  </button>
                )}
                <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '4px 0' }} />
                {isConfigured ? (
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm transition-colors cursor-pointer flex items-center gap-2"
                    style={{ color: 'var(--danger)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--danger-bg)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-logout-box-line text-xs" /></div>
                    Çıkış Yap
                  </button>
                ) : (
                  <button
                    onClick={() => { window.dispatchEvent(new CustomEvent('demo-login')); setProfileOpen(false); }}
                    className="w-full text-left px-4 py-2 text-sm transition-colors cursor-pointer flex items-center gap-2"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-logout-box-line text-xs" /></div>
                    Demo&apos;dan Çık
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
