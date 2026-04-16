import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/store/AuthContext';
import { supabase } from '@/lib/supabase';
import SupportModal from '@/components/feature/SupportModal';

type Tab = 'dashboard' | 'firmalar' | 'uzmanlar' | 'ziyaretler' | 'raporlar' | 'analitik' | 'copkutusu' | 'ayarlar';

interface OsgbTopNavProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  orgName: string;
  onFirmaEkle?: () => void;
  onUzmanEkle?: () => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

const NAV_ITEMS: { id: Tab; icon: string; label: string }[] = [
  { id: 'dashboard',  icon: 'ri-layout-grid-line',       label: 'Genel Bakış' },
  { id: 'firmalar',   icon: 'ri-building-3-line',         label: 'Firmalar' },
  { id: 'uzmanlar',   icon: 'ri-shield-user-line',        label: 'Personel' },
  { id: 'ziyaretler', icon: 'ri-map-pin-2-line',          label: 'Ziyaretler' },
  { id: 'raporlar',   icon: 'ri-bar-chart-grouped-line',  label: 'Raporlar' },
  { id: 'analitik',   icon: 'ri-pie-chart-2-line',        label: 'Analiz' },
];

const MORE_ITEMS: { id: Tab; icon: string; label: string }[] = [
  { id: 'copkutusu', icon: 'ri-delete-bin-2-line', label: 'Çöp Kutusu' },
  { id: 'ayarlar',   icon: 'ri-settings-3-line',   label: 'Ayarlar' },
];

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518';

interface SupportNotification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  ticket_id: string | null;
}

export default function OsgbTopNav({
  activeTab, setActiveTab, orgName, onFirmaEkle, onUzmanEkle, theme = 'dark', onToggleTheme,
}: OsgbTopNavProps) {
  const { user, logout } = useAuth();
  const isDark = theme === 'dark';

  const [displayName, setDisplayName] = useState<string>(
    user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'Admin'
  );

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const name = session.user.user_metadata?.full_name ?? session.user.email?.split('@')[0] ?? 'Admin';
        setDisplayName(name);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);

  const moreRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const [supportNotifs, setSupportNotifs] = useState<SupportNotification[]>([]);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportViewTicketId, setSupportViewTicketId] = useState<string | null>(null);
  const unreadCount = supportNotifs.filter(n => !n.is_read).length;

  const fetchNotifs = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from('notifications')
      .select('id, title, message, is_read, created_at, ticket_id')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setSupportNotifs(data as SupportNotification[]);
  };

  useEffect(() => { fetchNotifs(); }, []);

  const markRead = async (id: string) => {
    setSupportNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  };

  const markAllRead = async () => {
    setSupportNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    const ids = supportNotifs.filter(n => !n.is_read).map(n => n.id);
    if (ids.length > 0) await supabase.from('notifications').update({ is_read: true }).in('id', ids);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setQuickOpen(false); setMobileMenuOpen(false); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Theme tokens
  const navBg = isDark
    ? 'rgba(10, 8, 20, 0.92)'
    : 'rgba(255,255,255,0.96)';
  const navBorder = isDark
    ? 'rgba(139, 92, 246, 0.15)'
    : 'rgba(15,23,42,0.08)';
  const textPrimary = isDark ? '#F1F0FF' : '#0F172A';
  const textMuted = isDark ? '#6B7280' : '#64748B';
  const dropdownBg = isDark ? '#0F0D1F' : '#FFFFFF';
  const dropdownBorder = isDark ? 'rgba(139,92,246,0.18)' : 'rgba(15,23,42,0.09)';
  const dropdownHover = isDark ? 'rgba(139,92,246,0.08)' : 'rgba(15,23,42,0.04)';
  const iconBtnBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)';
  const iconBtnBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)';

  const ACCENT = '#8B5CF6';
  const ACCENT2 = '#A78BFA';

  const isMoreActive = MORE_ITEMS.some(i => i.id === activeTab);

  return (
    <>
      {/* ═══════════════════ TOP NAV ═══════════════════ */}
      <nav
        className="fixed top-0 left-0 right-0 z-40 flex items-center"
        style={{
          height: '58px',
          background: navBg,
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          borderBottom: `1px solid ${navBorder}`,
          paddingLeft: '20px',
          paddingRight: '20px',
          gap: '0',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 flex-shrink-0 mr-6">
          <div
            className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(109,40,217,0.15))',
              border: '1px solid rgba(139,92,246,0.3)',
            }}
          >
            <img src={LOGO_URL} alt="ISG" style={{ height: '16px', width: 'auto', objectFit: 'contain' }} />
          </div>
          <div className="hidden sm:block">
            <p className="text-[13px] font-black leading-tight" style={{ color: textPrimary, letterSpacing: '-0.03em' }}>
              ISG Denetim
            </p>
            <p className="text-[9px] font-bold uppercase tracking-[0.1em]" style={{ color: ACCENT }}>
              OSGB Panel
            </p>
          </div>
        </div>

        {/* ── Nav Items — Desktop ── */}
        <div className="hidden lg:flex items-center gap-1 flex-1">
          {NAV_ITEMS.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer transition-all duration-150 whitespace-nowrap"
                style={{
                  background: isActive
                    ? 'rgba(139,92,246,0.15)'
                    : 'transparent',
                  border: isActive
                    ? '1px solid rgba(139,92,246,0.3)'
                    : '1px solid transparent',
                  color: isActive ? ACCENT2 : textMuted,
                  fontSize: '12.5px',
                  fontWeight: isActive ? 600 : 500,
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)';
                    e.currentTarget.style.color = textPrimary;
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = textMuted;
                  }
                }}
              >
                <i className={`${item.icon} text-[13px]`} />
                {item.label}
              </button>
            );
          })}

          {/* More dropdown */}
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setMoreOpen(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer transition-all duration-150 whitespace-nowrap"
              style={{
                background: isMoreActive || moreOpen ? 'rgba(139,92,246,0.15)' : 'transparent',
                border: isMoreActive || moreOpen ? '1px solid rgba(139,92,246,0.3)' : '1px solid transparent',
                color: isMoreActive || moreOpen ? ACCENT2 : textMuted,
                fontSize: '12.5px',
                fontWeight: isMoreActive ? 600 : 500,
              }}
            >
              <i className="ri-more-line text-[13px]" />
              Diğer
              <i className={`ri-arrow-down-s-line text-[11px] transition-transform duration-150 ${moreOpen ? 'rotate-180' : ''}`} />
            </button>

            {moreOpen && (
              <div
                className="absolute left-0 top-11 w-44 py-1.5 z-50"
                style={{
                  background: dropdownBg,
                  border: `1px solid ${dropdownBorder}`,
                  borderRadius: '12px',
                  boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.6)' : '0 16px 40px rgba(15,23,42,0.15)',
                }}
              >
                {MORE_ITEMS.map(item => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setActiveTab(item.id); setMoreOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-all text-left"
                      style={{
                        background: isActive ? 'rgba(139,92,246,0.1)' : 'transparent',
                        color: isActive ? ACCENT2 : isDark ? '#CBD5E1' : '#334155',
                        fontSize: '12.5px',
                        fontWeight: isActive ? 600 : 400,
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = dropdownHover; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <i className={`${item.icon} text-sm`} style={{ color: isActive ? ACCENT : textMuted }} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1 lg:flex-none" />

        {/* ── Right Actions ── */}
        <div className="flex items-center gap-1.5">

          {/* Org badge */}
          <div
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold flex-shrink-0 mr-1"
            style={{
              background: 'rgba(139,92,246,0.1)',
              border: '1px solid rgba(139,92,246,0.2)',
              color: ACCENT2,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: ACCENT }} />
            {orgName}
          </div>

          {/* Hızlı Ekle */}
          <button
            onClick={() => setQuickOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white cursor-pointer whitespace-nowrap transition-all"
            style={{
              background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
              border: '1px solid rgba(139,92,246,0.4)',
              boxShadow: '0 2px 12px rgba(139,92,246,0.3)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(139,92,246,0.5)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = '0 2px 12px rgba(139,92,246,0.3)';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <i className="ri-add-line text-sm" />
            Hızlı Ekle
          </button>

          {/* Tema toggle */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              title={isDark ? 'Açık Tema' : 'Koyu Tema'}
              className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all flex-shrink-0"
              style={{ background: iconBtnBg, border: `1px solid ${iconBtnBorder}` }}
            >
              <i className={`${isDark ? 'ri-sun-line' : 'ri-moon-line'} text-sm`} style={{ color: isDark ? '#F59E0B' : '#475569' }} />
            </button>
          )}

          {/* Bildirimler */}
          <div className="relative flex-shrink-0" ref={notifRef}>
            <button
              onClick={() => { setNotifOpen(v => !v); setProfileOpen(false); fetchNotifs(); }}
              className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all relative"
              style={{ background: notifOpen ? 'rgba(139,92,246,0.12)' : iconBtnBg, border: `1px solid ${notifOpen ? 'rgba(139,92,246,0.3)' : iconBtnBorder}` }}
            >
              <i className="ri-notification-3-line text-sm" style={{ color: notifOpen ? ACCENT2 : textMuted }} />
              {unreadCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[16px] h-[16px] flex items-center justify-center text-[9px] font-bold text-white rounded-full px-1"
                  style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)', boxShadow: '0 0 6px rgba(139,92,246,0.5)' }}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div
                className="absolute right-0 top-11 z-50 w-[300px] overflow-hidden"
                style={{
                  background: dropdownBg,
                  border: `1px solid ${dropdownBorder}`,
                  borderRadius: '16px',
                  boxShadow: isDark ? '0 25px 60px rgba(0,0,0,0.6)' : '0 20px 50px rgba(15,23,42,0.15)',
                }}
              >
                <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${dropdownBorder}` }}>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(139,92,246,0.12)' }}>
                      <i className="ri-notification-3-line text-xs" style={{ color: ACCENT }} />
                    </div>
                    <p className="text-[13px] font-bold" style={{ color: textPrimary }}>Bildirimler</p>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(139,92,246,0.12)', color: ACCENT2, border: '1px solid rgba(139,92,246,0.2)' }}>
                        {unreadCount} yeni
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-[11px] cursor-pointer font-semibold px-2 py-1 rounded-lg" style={{ color: ACCENT2, background: 'rgba(139,92,246,0.08)' }}>
                      Tümünü oku
                    </button>
                  )}
                </div>

                {supportNotifs.length === 0 ? (
                  <div className="py-10 px-4 text-center">
                    <div className="w-10 h-10 flex items-center justify-center rounded-2xl mx-auto mb-3" style={{ background: 'rgba(139,92,246,0.1)' }}>
                      <i className="ri-check-double-line text-lg" style={{ color: ACCENT }} />
                    </div>
                    <p className="text-[12px] font-semibold" style={{ color: textPrimary }}>Yeni bildirim yok</p>
                    <p className="text-[11px] mt-1" style={{ color: textMuted }}>Sistem bildirimleri burada görünür</p>
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto">
                    {supportNotifs.map((n, idx) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          markRead(n.id);
                          setNotifOpen(false);
                          if (n.ticket_id) { setSupportViewTicketId(n.ticket_id); setSupportOpen(true); }
                        }}
                        className="px-4 py-3 cursor-pointer transition-all"
                        style={{
                          borderBottom: idx < supportNotifs.length - 1 ? `1px solid ${dropdownBorder}` : 'none',
                          opacity: n.is_read ? 0.5 : 1,
                          background: !n.is_read ? 'rgba(139,92,246,0.04)' : 'transparent',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = dropdownHover; }}
                        onMouseLeave={e => { e.currentTarget.style.background = !n.is_read ? 'rgba(139,92,246,0.04)' : 'transparent'; }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-7 h-7 flex items-center justify-center rounded-xl flex-shrink-0 mt-0.5" style={{ background: 'rgba(139,92,246,0.1)' }}>
                            <i className="ri-reply-line text-xs" style={{ color: ACCENT }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-[12px] font-semibold truncate flex-1" style={{ color: textPrimary }}>{n.title}</p>
                              {!n.is_read && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: ACCENT }} />}
                            </div>
                            <p className="text-[11px] mt-0.5" style={{ color: textMuted }}>{n.message}</p>
                            <p className="text-[10px] mt-1" style={{ color: isDark ? '#4B5563' : '#94A3B8' }}>{new Date(n.created_at).toLocaleString('tr-TR')}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Profil */}
          <div className="relative flex-shrink-0" ref={profileRef}>
            <button
              onClick={() => { setProfileOpen(v => !v); setNotifOpen(false); }}
              className="flex items-center gap-1.5 cursor-pointer transition-all rounded-lg py-1 px-1.5"
              style={{
                background: profileOpen ? 'rgba(139,92,246,0.1)' : 'transparent',
                border: `1px solid ${profileOpen ? 'rgba(139,92,246,0.25)' : 'transparent'}`,
              }}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
                  boxShadow: '0 2px 8px rgba(139,92,246,0.4)',
                }}
              >
                {(user?.email ?? 'O').charAt(0).toUpperCase()}
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-[11px] font-semibold leading-tight" style={{ color: textPrimary }}>{displayName}</p>
              </div>
              <i className={`ri-arrow-down-s-line text-xs hidden md:block transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} style={{ color: textMuted }} />
            </button>

            {profileOpen && (
              <div
                className="absolute right-0 top-12 z-50 w-[220px] overflow-hidden"
                style={{
                  background: dropdownBg,
                  border: `1px solid ${dropdownBorder}`,
                  borderRadius: '16px',
                  boxShadow: isDark ? '0 25px 60px rgba(0,0,0,0.6)' : '0 20px 50px rgba(15,23,42,0.15)',
                }}
              >
                <div className="px-4 py-3.5" style={{ borderBottom: `1px solid ${dropdownBorder}` }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)', boxShadow: '0 4px 12px rgba(139,92,246,0.35)' }}
                    >
                      {(user?.email ?? 'O').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold truncate" style={{ color: textPrimary }}>{displayName}</p>
                      <p className="text-[10.5px] truncate mt-0.5" style={{ color: textMuted }}>{user?.email}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }} />
                        <span className="text-[9.5px] font-semibold" style={{ color: ACCENT2 }}>OSGB Admin</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="py-1.5">
                  {[
                    { icon: 'ri-settings-4-line', label: 'Ayarlar', tab: 'ayarlar' as Tab, color: textMuted },
                    { icon: 'ri-bar-chart-2-line', label: 'Raporlar', tab: 'raporlar' as Tab, color: textMuted },
                  ].map(item => (
                    <button
                      key={item.label}
                      onClick={() => { setActiveTab(item.tab); setProfileOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-all"
                      onMouseEnter={e => { e.currentTarget.style.background = dropdownHover; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(139,92,246,0.08)' }}>
                        <i className={`${item.icon} text-xs`} style={{ color: ACCENT }} />
                      </div>
                      <span className="text-[12.5px] font-medium flex-1" style={{ color: isDark ? '#CBD5E1' : '#334155' }}>{item.label}</span>
                      <i className="ri-arrow-right-s-line text-xs" style={{ color: textMuted }} />
                    </button>
                  ))}

                  <button
                    onClick={() => { setSupportOpen(true); setProfileOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-all"
                    onMouseEnter={e => { e.currentTarget.style.background = dropdownHover; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(139,92,246,0.08)' }}>
                      <i className="ri-customer-service-2-line text-xs" style={{ color: ACCENT }} />
                    </div>
                    <span className="text-[12.5px] font-medium flex-1" style={{ color: isDark ? '#CBD5E1' : '#334155' }}>Destek</span>
                    <i className="ri-arrow-right-s-line text-xs" style={{ color: textMuted }} />
                  </button>

                  <div className="mx-3 my-1.5" style={{ height: '1px', background: dropdownBorder }} />

                  <button
                    onClick={() => { setProfileOpen(false); logout(); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-all"
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

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(v => !v)}
            className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer lg:hidden flex-shrink-0"
            style={{ background: iconBtnBg, border: `1px solid ${iconBtnBorder}` }}
          >
            <i className={`${mobileMenuOpen ? 'ri-close-line' : 'ri-menu-line'} text-sm`} style={{ color: textMuted }} />
          </button>
        </div>
      </nav>

      {/* ── Mobile Menu ── */}
      {mobileMenuOpen && createPortal(
        <div
          className="fixed inset-0 z-[39] lg:hidden"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="absolute top-[58px] left-0 right-0 py-3 px-4"
            style={{
              background: isDark ? '#0A0814' : '#FFFFFF',
              borderBottom: `1px solid ${navBorder}`,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="grid grid-cols-3 gap-2">
              {[...NAV_ITEMS, ...MORE_ITEMS].map(item => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
                    className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl cursor-pointer transition-all"
                    style={{
                      background: isActive ? 'rgba(139,92,246,0.15)' : isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)',
                      border: isActive ? '1px solid rgba(139,92,246,0.3)' : `1px solid ${navBorder}`,
                    }}
                  >
                    <i className={`${item.icon} text-lg`} style={{ color: isActive ? ACCENT2 : textMuted }} />
                    <span className="text-[10px] font-semibold text-center leading-tight" style={{ color: isActive ? ACCENT2 : textMuted }}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Quick Add Modal ── */}
      {quickOpen && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center p-4 z-[99999]"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(16px)' }}
          onClick={e => { if (e.target === e.currentTarget) setQuickOpen(false); }}
        >
          <div
            className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{
              background: isDark ? '#0F0D1F' : '#FFFFFF',
              border: `1px solid ${dropdownBorder}`,
              boxShadow: isDark ? '0 40px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(139,92,246,0.15)' : '0 30px 80px rgba(15,23,42,0.2)',
            }}
          >
            {/* Top gradient bar */}
            <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #8B5CF6, #A78BFA, #C4B5FD, #8B5CF6)' }} />

            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${dropdownBorder}` }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)' }}>
                  <i className="ri-add-circle-line text-base" style={{ color: ACCENT }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: textPrimary }}>Hızlı Ekle</h3>
                  <p className="text-[11px] mt-0.5" style={{ color: textMuted }}>Ne oluşturmak istiyorsunuz?</p>
                </div>
              </div>
              <button
                onClick={() => setQuickOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all"
                style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)', color: textMuted }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#EF4444'; }}
                onMouseLeave={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'; e.currentTarget.style.color = textMuted; }}
              >
                <i className="ri-close-line text-sm" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <button
                onClick={() => { onFirmaEkle?.(); setQuickOpen(false); }}
                className="w-full flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all text-left"
                style={{ background: 'rgba(139,92,246,0.06)', border: '1.5px solid rgba(139,92,246,0.18)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.12)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.35)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.06)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.18)'; e.currentTarget.style.transform = 'none'; }}
              >
                <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)' }}>
                  <i className="ri-building-2-line text-lg" style={{ color: ACCENT }} />
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: textPrimary }}>Firma Ekle</p>
                  <p className="text-[11px] mt-0.5" style={{ color: textMuted }}>Yeni müşteri firma kaydı oluştur</p>
                </div>
                <i className="ri-arrow-right-s-line ml-auto text-lg" style={{ color: ACCENT }} />
              </button>

              <button
                onClick={() => { onUzmanEkle?.(); setQuickOpen(false); }}
                className="w-full flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all text-left"
                style={{ background: 'rgba(139,92,246,0.06)', border: '1.5px solid rgba(139,92,246,0.18)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.12)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.35)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.06)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.18)'; e.currentTarget.style.transform = 'none'; }}
              >
                <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)' }}>
                  <i className="ri-user-add-line text-lg" style={{ color: ACCENT }} />
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: textPrimary }}>Personel Ekle</p>
                  <p className="text-[11px] mt-0.5" style={{ color: textMuted }}>Gezici uzman veya hekim ekle</p>
                </div>
                <i className="ri-arrow-right-s-line ml-auto text-lg" style={{ color: ACCENT }} />
              </button>

              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { icon: 'ri-map-pin-2-line', label: 'Ziyaretler', tab: 'ziyaretler' as Tab },
                  { icon: 'ri-bar-chart-grouped-line', label: 'Raporlar', tab: 'raporlar' as Tab },
                  { icon: 'ri-settings-3-line', label: 'Ayarlar', tab: 'ayarlar' as Tab },
                ].map(item => (
                  <button
                    key={item.label}
                    onClick={() => { setActiveTab(item.tab); setQuickOpen(false); }}
                    className="flex flex-col items-center gap-2 py-3 rounded-xl cursor-pointer transition-all"
                    style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)', border: `1px solid ${dropdownBorder}` }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.08)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)'; e.currentTarget.style.borderColor = dropdownBorder; }}
                  >
                    <div className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ background: 'rgba(139,92,246,0.1)' }}>
                      <i className={`${item.icon} text-sm`} style={{ color: ACCENT }} />
                    </div>
                    <span className="text-[10px] font-semibold" style={{ color: textMuted }}>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: `1px solid ${dropdownBorder}` }}>
              <div className="flex items-center gap-1.5">
                <kbd className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.06)', color: textMuted, border: `1px solid ${dropdownBorder}` }}>ESC</kbd>
                <span className="text-[10px]" style={{ color: textMuted }}>ile kapat</span>
              </div>
              <div className="flex items-center gap-1.5">
                <i className="ri-flashlight-line text-xs" style={{ color: ACCENT }} />
                <span className="text-[10px] font-semibold" style={{ color: textMuted }}>OSGB Panel</span>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      <SupportModal
        open={supportOpen}
        onClose={() => { setSupportOpen(false); setSupportViewTicketId(null); }}
        viewTicketId={supportViewTicketId}
      />
    </>
  );
}
