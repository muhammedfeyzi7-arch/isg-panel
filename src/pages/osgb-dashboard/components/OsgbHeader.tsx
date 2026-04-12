import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/store/AuthContext';
import { supabase } from '@/lib/supabase';

import SupportModal from '@/components/feature/SupportModal';

type Tab = 'dashboard' | 'firmalar' | 'uzmanlar' | 'ziyaretler' | 'raporlar' | 'ayarlar';

interface OsgbHeaderProps {
  activeTab: Tab;
  setActiveTab?: (tab: Tab) => void;
  collapsed: boolean;
  orgName: string;
  onMobileMenuToggle?: () => void;
  onFirmaEkle?: () => void;
  onUzmanEkle?: () => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

const tabMeta: Record<Tab, { label: string; icon: string }> = {
  dashboard:  { label: 'Genel Bakış', icon: 'ri-layout-grid-line' },
  firmalar:   { label: 'Firmalar', icon: 'ri-building-3-line' },
  uzmanlar:   { label: 'Uzmanlar', icon: 'ri-shield-user-line' },
  ziyaretler: { label: 'Ziyaretler', icon: 'ri-map-pin-2-line' },
  raporlar:   { label: 'Raporlar', icon: 'ri-bar-chart-grouped-line' },
  ayarlar:    { label: 'Ayarlar', icon: 'ri-settings-3-line' },
};

interface SupportNotification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  ticket_id: string | null;
}

export default function OsgbHeader({
  activeTab, setActiveTab, collapsed, orgName, onMobileMenuToggle, onFirmaEkle, onUzmanEkle, theme = 'dark', onToggleTheme,
}: OsgbHeaderProps) {
  const { user, logout } = useAuth();
  const meta = tabMeta[activeTab];
  const isDark = theme === 'dark';

  const hour = new Date().getHours();
  const greeting = hour >= 6 && hour < 12 ? 'Günaydın' : hour >= 12 && hour < 17 ? 'İyi Günler' : 'İyi Akşamlar';

  const [displayName, setDisplayName] = useState<string>(
    user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'Admin'
  );
  const firstName = displayName;

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const name = session.user.user_metadata?.full_name ?? session.user.email?.split('@')[0] ?? 'Admin';
        setDisplayName(name);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const [supportNotifs, setSupportNotifs] = useState<SupportNotification[]>([]);
  const [supportNotifOpen, setSupportNotifOpen] = useState(false);
  const supportNotifRef = useRef<HTMLDivElement>(null);
  const unreadCount = supportNotifs.filter(n => !n.is_read).length;

  const [supportOpen, setSupportOpen] = useState(false);
  const [supportViewTicketId, setSupportViewTicketId] = useState<string | null>(null);

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

  const [search, setSearch] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const [quickOpen, setQuickOpen] = useState(false);
  const quickRef = useRef<HTMLDivElement>(null);
  const quickBtnRef = useRef<HTMLButtonElement>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [refreshDone, setRefreshDone] = useState(false);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshDone(false);
    await new Promise(r => setTimeout(r, 800));
    setRefreshDone(true);
    setRefreshing(false);
    setTimeout(() => setRefreshDone(false), 2000);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setQuickOpen(false);
    };
    if (quickOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [quickOpen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchFocus(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (supportNotifRef.current && !supportNotifRef.current.contains(e.target as Node)) setSupportNotifOpen(false);
      if (quickRef.current && !quickRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (!target.closest('[data-quick-dropdown]')) {
          setQuickOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const headerBg     = isDark ? 'var(--bg-header, rgba(15,23,42,0.95))' : 'rgba(255,255,255,0.97)';
  const headerBorder = isDark ? 'var(--border-subtle, rgba(255,255,255,0.07))' : 'rgba(15,23,42,0.075)';
  const textMuted    = '#64748B';
  const nameColor    = isDark ? '#EDF2F7' : '#0F172A';
  const iconBtnBg    = isDark ? 'var(--bg-item, rgba(255,255,255,0.05))' : 'rgba(15,23,42,0.038)';
  const iconBtnBorder= isDark ? 'var(--border-main, rgba(255,255,255,0.08))' : 'rgba(15,23,42,0.09)';
  const inputBg      = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)';
  const inputBorder  = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.09)';
  const dropdownBg   = isDark ? 'var(--bg-card-solid, #1e293b)' : 'rgba(255,255,255,0.99)';
  const dropdownBorder= isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.09)';
  const dropdownHover= isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.038)';

  // ACCENT = #0EA5E9, ACCENT_DARK = #0284C7
  const ACCENT = '#0EA5E9';
  const ACCENT_DARK = '#0284C7';

  const navToTab = (tab: Tab) => {
    setActiveTab?.(tab);
    setProfileOpen(false);
    setQuickOpen(false);
  };

  return (
    <>
      <header
        className={`fixed top-0 right-0 z-30 flex items-center ${collapsed ? 'lg:left-[64px]' : 'lg:left-[220px]'} left-0`}
        style={{
          height: '46px',
          background: headerBg,
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          borderBottom: `1px solid ${headerBorder}`,
          boxShadow: isDark ? '0 1px 8px rgba(0,0,0,0.25)' : '0 1px 6px rgba(15,23,42,0.06)',
          transition: 'left 0.26s cubic-bezier(0.4,0,0.2,1)',
          paddingLeft: '10px',
          paddingRight: '10px',
          gap: '6px',
        }}
      >
        {/* Mobile hamburger */}
        <button
          onClick={onMobileMenuToggle}
          className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer lg:hidden flex-shrink-0"
          style={{ color: textMuted, background: iconBtnBg, border: `1px solid ${iconBtnBorder}` }}
        >
          <i className="ri-menu-line text-sm" />
        </button>

        {/* Sayfa başlığı */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="w-6 h-6 flex items-center justify-center rounded-lg flex-shrink-0"
            style={{ background: 'rgba(14,165,233,0.12)' }}>
            <i className={`${meta.icon} text-[11px]`} style={{ color: ACCENT }} />
          </div>
          <span className="text-[12px] sm:text-[13px] font-bold truncate" style={{ color: nameColor, maxWidth: '140px' }}>
            {meta.label}
          </span>
        </div>

        <div className="flex-1" />

        {/* Selamlama */}
        <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
          <p className="text-[11.5px] font-medium" style={{ color: textMuted }}>
            {greeting}, <span className="font-bold" style={{ color: nameColor }}>{firstName}</span>
          </p>
        </div>

        {/* OSGB badge */}
        <div
          className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold flex-shrink-0"
          style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)', color: ACCENT_DARK }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: ACCENT }} />
          OSGB Admin · {orgName}
        </div>

        {/* Arama */}
        <div className="relative hidden md:flex items-center flex-shrink-0" ref={searchRef}>
          <i className="ri-search-line absolute left-2.5 text-[11px] z-10" style={{ color: '#475569' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => setSearchFocus(true)}
            placeholder="Ara..."
            className="w-36 pl-7 pr-2.5 py-1.5 text-[11.5px] rounded-lg outline-none transition-all duration-200"
            style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: isDark ? '#e5e7eb' : '#334155' }}
            onFocus={e => {
              setSearchFocus(true);
              e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.09)' : `rgba(14,165,233,0.04)`;
              e.currentTarget.style.borderColor = ACCENT;
              e.currentTarget.style.boxShadow = `0 0 0 2px rgba(14,165,233,0.2)`;
              e.currentTarget.style.width = '180px';
            }}
            onBlur={e => {
              e.currentTarget.style.background = inputBg;
              e.currentTarget.style.borderColor = inputBorder;
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.width = '';
            }}
          />
          {searchFocus && search.trim().length > 0 && (
            <div
              className="absolute right-0 top-11 w-72 py-3 z-50"
              style={{ background: dropdownBg, border: `1px solid ${dropdownBorder}`, borderRadius: '14px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            >
              <div className="px-4 py-2 text-center">
                <i className="ri-search-line text-xl" style={{ color: ACCENT }} />
                <p className="text-[12px] mt-1.5 font-medium" style={{ color: textMuted }}>
                  &quot;{search}&quot; için arama yapılıyor...
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Yenile */}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          title="Verileri Yenile"
          className="w-8 h-8 hidden md:flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200 flex-shrink-0 disabled:opacity-50"
          style={{ background: refreshDone ? 'rgba(14,165,233,0.12)' : iconBtnBg, border: `1px solid ${refreshDone ? 'rgba(14,165,233,0.3)' : iconBtnBorder}` }}
          onMouseEnter={e => { if (!refreshing) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = refreshDone ? 'rgba(14,165,233,0.12)' : iconBtnBg; }}
        >
          <i
            className={`${refreshing ? 'ri-loader-4-line animate-spin' : refreshDone ? 'ri-check-line' : 'ri-refresh-line'} text-sm`}
            style={{ color: refreshDone ? ACCENT : refreshing ? ACCENT : textMuted }}
          />
        </button>

        {/* Tema toggle */}
        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            title={isDark ? 'Açık Tema' : 'Koyu Tema'}
            className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200 flex-shrink-0"
            style={{ background: iconBtnBg, border: `1px solid ${iconBtnBorder}` }}
            onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = iconBtnBg; }}
          >
            <i className={`${isDark ? 'ri-sun-line' : 'ri-moon-line'} text-sm`} style={{ color: isDark ? '#F59E0B' : '#475569' }} />
          </button>
        )}

        {/* Hızlı Ekle */}
        <div className="relative flex-shrink-0" ref={quickRef}>
          <button
            ref={quickBtnRef}
            onClick={() => {
              setQuickOpen(v => !v);
              setProfileOpen(false);
              setSupportNotifOpen(false);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer whitespace-nowrap flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DARK})`, fontSize: '11px', borderRadius: '8px' }}
          >
            <i className="ri-add-line text-sm" />
            <span className="hidden sm:inline">Hızlı Ekle</span>
          </button>
        </div>

        {/* Hızlı Ekle Modal (Portal) */}
        {quickOpen && createPortal(
          <div
            data-quick-dropdown="true"
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ zIndex: 999999, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)' }}
            onMouseDown={e => { if (e.target === e.currentTarget) setQuickOpen(false); }}
          >
            <div
              className="relative w-full max-w-lg rounded-2xl overflow-hidden"
              style={{
                background: isDark ? '#1e293b' : '#ffffff',
                border: `1px solid ${dropdownBorder}`,
                boxShadow: isDark ? '0 40px 100px rgba(0,0,0,0.7)' : '0 30px 80px rgba(15,23,42,0.18)',
              }}
            >
              {/* Renkli üst bant */}
              <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT_DARK}, #38BDF8, #F59E0B)` }} />

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${dropdownBorder}` }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ background: `rgba(14,165,233,0.15)`, border: `1px solid rgba(14,165,233,0.2)` }}>
                    <i className="ri-add-circle-line text-lg" style={{ color: ACCENT }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: isDark ? '#F1F5F9' : '#0F172A' }}>Hızlı Ekle</h3>
                    <p className="text-[11px] mt-0.5" style={{ color: '#64748B' }}>Hangi kaydı oluşturmak istiyorsunuz?</p>
                  </div>
                </div>
                <button
                  onClick={() => setQuickOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all"
                  style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)', color: '#64748B', border: `1px solid ${dropdownBorder}` }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLElement).style.color = '#EF4444'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)'; (e.currentTarget as HTMLElement).style.color = '#64748B'; }}
                >
                  <i className="ri-close-line text-sm" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#94A3B8' }}>— Temel İşlemler</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => { onFirmaEkle?.(); setQuickOpen(false); }}
                      className="flex flex-col items-start gap-3 p-4 rounded-xl cursor-pointer transition-all text-left group"
                      style={{ background: isDark ? `rgba(14,165,233,0.06)` : '#f0f9ff', border: `1.5px solid rgba(14,165,233,0.2)` }}
                      onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(14,165,233,0.12)' : '#e0f2fe'; e.currentTarget.style.borderColor = 'rgba(14,165,233,0.4)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = isDark ? 'rgba(14,165,233,0.06)' : '#f0f9ff'; e.currentTarget.style.borderColor = 'rgba(14,165,233,0.2)'; }}
                    >
                      <div className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.2)' }}>
                        <i className="ri-building-2-line text-lg" style={{ color: ACCENT }} />
                      </div>
                      <div>
                        <p className="text-sm font-bold" style={{ color: isDark ? '#E2E8F0' : '#0F172A' }}>Firma Ekle</p>
                        <p className="text-[10.5px] mt-0.5" style={{ color: '#64748B' }}>Yeni firma kaydı oluştur</p>
                        <p className="text-[10px] font-semibold mt-2" style={{ color: ACCENT }}>Modüle git →</p>
                      </div>
                    </button>

                    <button
                      onClick={() => { onUzmanEkle?.(); setQuickOpen(false); }}
                      className="flex flex-col items-start gap-3 p-4 rounded-xl cursor-pointer transition-all text-left group"
                      style={{ background: isDark ? 'rgba(14,165,233,0.06)' : '#f0f9ff', border: `1.5px solid rgba(14,165,233,0.2)` }}
                      onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(14,165,233,0.12)' : '#e0f2fe'; e.currentTarget.style.borderColor = 'rgba(14,165,233,0.4)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = isDark ? 'rgba(14,165,233,0.06)' : '#f0f9ff'; e.currentTarget.style.borderColor = 'rgba(14,165,233,0.2)'; }}
                    >
                      <div className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.2)' }}>
                        <i className="ri-user-add-line text-lg" style={{ color: ACCENT }} />
                      </div>
                      <div>
                        <p className="text-sm font-bold" style={{ color: isDark ? '#E2E8F0' : '#0F172A' }}>Uzman Ekle</p>
                        <p className="text-[10.5px] mt-0.5" style={{ color: '#64748B' }}>Çalışan kaydı ekle</p>
                        <p className="text-[10px] font-semibold mt-2" style={{ color: ACCENT }}>Modüle git →</p>
                      </div>
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#94A3B8' }}>— Diğer İşlemler</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { icon: 'ri-file-list-3-line', label: 'Ziyaret Ekle', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', tab: 'ziyaretler' as Tab },
                      { icon: 'ri-bar-chart-grouped-line', label: 'Raporlar', color: ACCENT, bg: 'rgba(14,165,233,0.1)', tab: 'raporlar' as Tab },
                      { icon: 'ri-map-pin-2-line', label: 'Ziyaretler', color: ACCENT, bg: 'rgba(14,165,233,0.1)', tab: 'ziyaretler' as Tab },
                      { icon: 'ri-settings-3-line', label: 'Ayarlar', color: '#64748B', bg: 'rgba(100,116,139,0.1)', tab: 'ayarlar' as Tab },
                    ].map(item => (
                      <button
                        key={item.label}
                        onClick={() => { navToTab(item.tab); setQuickOpen(false); }}
                        className="flex flex-col items-center justify-center gap-2 py-3 px-2 rounded-xl cursor-pointer transition-all"
                        style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)', border: `1px solid ${dropdownBorder}` }}
                        onMouseEnter={e => { e.currentTarget.style.background = item.bg; e.currentTarget.style.borderColor = item.color + '44'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)'; e.currentTarget.style.borderColor = dropdownBorder; }}
                      >
                        <div className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ background: item.bg }}>
                          <i className={`${item.icon} text-sm`} style={{ color: item.color }} />
                        </div>
                        <span className="text-[10px] font-semibold text-center leading-tight" style={{ color: isDark ? '#94A3B8' : '#475569' }}>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-6 py-3 flex items-center justify-between" style={{ borderTop: `1px solid ${dropdownBorder}` }}>
                <div className="flex items-center gap-2">
                  <kbd className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)', color: '#64748B', border: `1px solid ${dropdownBorder}` }}>ESC</kbd>
                  <span className="text-[10px]" style={{ color: '#64748B' }}>ile kapat</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <i className="ri-flashlight-line text-xs" style={{ color: ACCENT }} />
                  <span className="text-[10px] font-semibold" style={{ color: '#64748B' }}>6 modül mevcut</span>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Bildirimler */}
        <div className="relative flex-shrink-0 hidden sm:block" ref={supportNotifRef}>
          <button
            onClick={() => { setSupportNotifOpen(v => !v); setProfileOpen(false); setQuickOpen(false); fetchNotifs(); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200 relative"
            style={{
              background: supportNotifOpen ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)') : iconBtnBg,
              border: `1px solid ${iconBtnBorder}`,
            }}
            title="Bildirimler"
          >
            <i className="ri-notification-3-line text-sm" style={{ color: supportNotifOpen ? (isDark ? '#E2E8F0' : '#0F172A') : textMuted }} />
            {unreadCount > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[16px] h-[16px] flex items-center justify-center text-[9px] font-bold text-white rounded-full px-1"
                style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DARK})`, boxShadow: `0 0 6px rgba(14,165,233,0.5)` }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {supportNotifOpen && (
            <div
              className="absolute right-0 top-11 z-50 w-[300px] sm:w-[320px] overflow-hidden"
              style={{ background: dropdownBg, border: `1px solid ${dropdownBorder}`, borderRadius: '16px', boxShadow: isDark ? '0 25px 60px rgba(0,0,0,0.5)' : '0 20px 50px rgba(15,23,42,0.15)', backdropFilter: 'blur(20px)' }}
            >
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${dropdownBorder}` }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(14,165,233,0.1)' }}>
                    <i className="ri-notification-3-line text-xs" style={{ color: ACCENT }} />
                  </div>
                  <p className="text-[13px] font-bold" style={{ color: nameColor }}>Bildirimler</p>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(14,165,233,0.12)', color: ACCENT, border: '1px solid rgba(14,165,233,0.2)' }}>
                      {unreadCount} yeni
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-[11px] cursor-pointer font-semibold px-2 py-1 rounded-lg" style={{ color: ACCENT, background: 'rgba(14,165,233,0.08)' }}>
                    Tümünü oku
                  </button>
                )}
              </div>

              {supportNotifs.length === 0 ? (
                <div className="py-10 px-4 text-center">
                  <div className="w-10 h-10 flex items-center justify-center rounded-2xl mx-auto mb-3" style={{ background: 'rgba(14,165,233,0.1)' }}>
                    <i className="ri-check-double-line text-lg" style={{ color: ACCENT }} />
                  </div>
                  <p className="text-[12px] font-semibold" style={{ color: isDark ? '#E2E8F0' : '#334155' }}>Yeni bildirim yok</p>
                  <p className="text-[11px] mt-1" style={{ color: '#64748B' }}>Sistem bildirimleri burada görünür</p>
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto">
                  {supportNotifs.map((n, idx) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        markRead(n.id);
                        setSupportNotifOpen(false);
                        if (n.ticket_id) {
                          setSupportViewTicketId(n.ticket_id);
                          setSupportOpen(true);
                        }
                      }}
                      className="px-4 py-3 cursor-pointer transition-all"
                      style={{
                        borderBottom: idx < supportNotifs.length - 1 ? `1px solid ${dropdownBorder}` : 'none',
                        opacity: n.is_read ? 0.5 : 1,
                        background: !n.is_read ? (isDark ? 'rgba(14,165,233,0.04)' : 'rgba(14,165,233,0.03)') : 'transparent',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = dropdownHover; }}
                      onMouseLeave={e => { e.currentTarget.style.background = !n.is_read ? (isDark ? 'rgba(14,165,233,0.04)' : 'rgba(14,165,233,0.03)') : 'transparent'; }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 flex items-center justify-center rounded-xl flex-shrink-0 mt-0.5" style={{ background: 'rgba(14,165,233,0.1)' }}>
                          <i className="ri-reply-line text-xs" style={{ color: ACCENT }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-[12px] font-semibold truncate flex-1" style={{ color: isDark ? '#E2E8F0' : '#0F172A' }}>{n.title}</p>
                            {!n.is_read && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: ACCENT }} />}
                          </div>
                          <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: '#64748B' }}>{n.message}</p>
                          <p className="text-[10px] mt-1" style={{ color: '#94A3B8' }}>{new Date(n.created_at).toLocaleString('tr-TR')}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Profil dropdown */}
        <div className="relative flex-shrink-0" ref={profileRef}>
          <button
            onClick={() => { setProfileOpen(v => !v); setSupportNotifOpen(false); setQuickOpen(false); }}
            className="flex items-center gap-1.5 cursor-pointer transition-all duration-200 rounded-lg py-1 px-1.5"
            style={{
              background: profileOpen ? (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.06)') : 'transparent',
              border: `1px solid ${profileOpen ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.12)') : 'transparent'}`,
            }}
            onMouseEnter={e => { if (!profileOpen) { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)'; e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'; } }}
            onMouseLeave={e => { if (!profileOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; } }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DARK})`, boxShadow: `0 2px 8px rgba(14,165,233,0.35)` }}
            >
              {(user?.email ?? 'O').charAt(0).toUpperCase()}
            </div>
            <div className="hidden lg:block text-left">
              <p className="text-[11px] font-semibold leading-tight" style={{ color: nameColor }}>{firstName}</p>
            </div>
            <i className={`ri-arrow-down-s-line text-xs hidden md:block transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} style={{ color: '#475569' }} />
          </button>

          {profileOpen && (
            <div
              className="absolute right-0 top-12 z-50 w-[220px] overflow-hidden"
              style={{ background: dropdownBg, border: `1px solid ${dropdownBorder}`, borderRadius: '16px', boxShadow: isDark ? '0 25px 60px rgba(0,0,0,0.55)' : '0 20px 50px rgba(15,23,42,0.15)', backdropFilter: 'blur(20px)' }}
            >
              <div className="px-4 py-3.5" style={{ borderBottom: `1px solid ${dropdownBorder}` }}>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DARK})`, boxShadow: '0 4px 12px rgba(14,165,233,0.3)' }}
                  >
                    {(user?.email ?? 'O').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold truncate" style={{ color: isDark ? '#E2E8F0' : '#0F172A' }}>{firstName}</p>
                    <p className="text-[10.5px] truncate mt-0.5" style={{ color: '#64748B' }}>{user?.email}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }} />
                      <span className="text-[9.5px] font-semibold" style={{ color: ACCENT }}>OSGB Admin</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="py-1.5">
                <button
                  onClick={() => navToTab('ayarlar')}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-all duration-150"
                  onMouseEnter={e => { e.currentTarget.style.background = dropdownHover; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(100,116,139,0.1)' }}>
                    <i className="ri-settings-4-line text-xs" style={{ color: '#64748B' }} />
                  </div>
                  <span className="text-[12.5px] font-medium flex-1" style={{ color: isDark ? '#CBD5E1' : '#334155' }}>Ayarlar</span>
                  <i className="ri-arrow-right-s-line text-xs" style={{ color: '#475569' }} />
                </button>

                <button
                  onClick={() => navToTab('raporlar')}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-all duration-150"
                  onMouseEnter={e => { e.currentTarget.style.background = dropdownHover; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(14,165,233,0.1)' }}>
                    <i className="ri-bar-chart-2-line text-xs" style={{ color: ACCENT }} />
                  </div>
                  <span className="text-[12.5px] font-medium flex-1" style={{ color: isDark ? '#CBD5E1' : '#334155' }}>Raporlar</span>
                  <i className="ri-arrow-right-s-line text-xs" style={{ color: '#475569' }} />
                </button>

                <button
                  onClick={() => { setSupportOpen(true); setProfileOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-all duration-150"
                  onMouseEnter={e => { e.currentTarget.style.background = dropdownHover; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(14,165,233,0.1)' }}>
                    <i className="ri-customer-service-2-line text-xs" style={{ color: ACCENT }} />
                  </div>
                  <span className="text-[12.5px] font-medium flex-1" style={{ color: isDark ? '#CBD5E1' : '#334155' }}>Destek / Sorun Bildir</span>
                  <i className="ri-arrow-right-s-line text-xs" style={{ color: '#475569' }} />
                </button>

                <div className="mx-3 my-1.5" style={{ height: '1px', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.07)' }} />

                <button
                  onClick={() => { setProfileOpen(false); logout(); }}
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
      </header>

      <SupportModal
        open={supportOpen}
        onClose={() => { setSupportOpen(false); setSupportViewTicketId(null); }}
        viewTicketId={supportViewTicketId}
      />
    </>
  );
}
