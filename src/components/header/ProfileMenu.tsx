import { useState, useRef, useEffect } from 'react';
import { useSupportStore } from '@/store/useSupportStore';

interface ProfileMenuProps {
  currentUserAd: string;
  userEmail: string;
  isDark: boolean;
  nameColor: string;
  dropdownBg: string;
  dropdownBorder: string;
  dropdownItemHover: string;
  onNavigate: (module: string) => void;
  onLogout: () => void;
}

export default function ProfileMenu({
  currentUserAd,
  userEmail,
  isDark,
  nameColor,
  dropdownBg,
  dropdownBorder,
  dropdownItemHover,
  onNavigate,
  onLogout,
}: ProfileMenuProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const { openSupport } = useSupportStore();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initial = (currentUserAd || 'U').charAt(0).toUpperCase();

  return (
    <div className="relative flex-shrink-0" ref={profileRef}>
      {/* Trigger */}
      <button
        onClick={() => setProfileOpen(v => !v)}
        className="flex items-center gap-1.5 cursor-pointer transition-all duration-200 rounded-lg py-1 px-1.5"
        style={{
          background: profileOpen ? (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.06)') : 'transparent',
          border: `1px solid ${profileOpen ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.12)') : 'transparent'}`,
        }}
        onMouseEnter={e => {
          if (!profileOpen) {
            e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)';
            e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
          }
        }}
        onMouseLeave={e => {
          if (!profileOpen) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'transparent';
          }
        }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)', boxShadow: '0 2px 8px rgba(14,165,233,0.3)' }}
        >
          {initial}
        </div>
        <div className="hidden lg:block text-left">
          <p className="text-[11px] font-semibold leading-tight" style={{ color: nameColor }}>
            {currentUserAd || 'Kullanıcı'}
          </p>
        </div>
        <i
          className={`ri-arrow-down-s-line text-xs hidden md:block transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`}
          style={{ color: '#475569' }}
        />
      </button>

      {/* Dropdown */}
      {profileOpen && (
        <div
          className="absolute right-0 top-12 z-50 w-52 sm:w-56 animate-slide-up overflow-hidden"
          style={{
            background: dropdownBg,
            border: `1px solid ${dropdownBorder}`,
            borderRadius: '16px',
            boxShadow: isDark ? '0 25px 60px rgba(0,0,0,0.55)' : '0 20px 50px rgba(15,23,42,0.15)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Profile header */}
          <div className="px-4 py-3.5" style={{ borderBottom: `1px solid ${dropdownBorder}` }}>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)', boxShadow: '0 4px 12px rgba(14,165,233,0.3)' }}
              >
                {initial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold truncate" style={{ color: isDark ? '#E2E8F0' : '#0F172A' }}>
                  {currentUserAd || 'Kullanıcı'}
                </p>
                <p className="text-[10.5px] truncate mt-0.5" style={{ color: '#64748B' }}>{userEmail}</p>
              </div>
            </div>
          </div>

          {/* Menu items */}
          <div className="py-1.5">
            <button
              onClick={() => { onNavigate('ayarlar'); setProfileOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-all duration-150"
              onMouseEnter={e => { e.currentTarget.style.background = dropdownItemHover; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(59,130,246,0.1)' }}>
                <i className="ri-settings-4-line text-xs" style={{ color: '#3B82F6' }} />
              </div>
              <span className="text-[12.5px] font-medium" style={{ color: isDark ? '#CBD5E1' : '#334155' }}>Ayarlar</span>
              <i className="ri-arrow-right-s-line text-xs ml-auto" style={{ color: '#475569' }} />
            </button>

            <button
              onClick={() => { onNavigate('raporlar'); setProfileOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-all duration-150"
              onMouseEnter={e => { e.currentTarget.style.background = dropdownItemHover; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(16,185,129,0.1)' }}>
                <i className="ri-bar-chart-2-line text-xs" style={{ color: '#10B981' }} />
              </div>
              <span className="text-[12.5px] font-medium" style={{ color: isDark ? '#CBD5E1' : '#334155' }}>Raporlar</span>
              <i className="ri-arrow-right-s-line text-xs ml-auto" style={{ color: '#475569' }} />
            </button>

            <button
              onClick={() => { openSupport(); setProfileOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-all duration-150"
              onMouseEnter={e => { e.currentTarget.style.background = dropdownItemHover; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(16,185,129,0.1)' }}>
                <i className="ri-customer-service-2-line text-xs" style={{ color: '#10B981' }} />
              </div>
              <span className="text-[12.5px] font-medium" style={{ color: isDark ? '#CBD5E1' : '#334155' }}>Destek / Sorun Bildir</span>
              <i className="ri-arrow-right-s-line text-xs ml-auto" style={{ color: '#475569' }} />
            </button>

            <div className="mx-3 my-1.5" style={{ height: '1px', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.07)' }} />

            <button
              onClick={() => { setProfileOpen(false); onLogout(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-all duration-150"
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(239,68,68,0.1)' }}>
                <i className="ri-logout-box-r-line text-xs" style={{ color: '#EF4444' }} />
              </div>
              <span className="text-[12.5px] font-semibold" style={{ color: '#EF4444' }}>Oturumu Kapat</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
