import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/store/AuthContext';
import { supabase } from '@/lib/supabase';
import SupportModal from '@/components/feature/SupportModal';

type Tab = 'dashboard' | 'firmalar' | 'uzmanlar' | 'ziyaretler' | 'raporlar' | 'analitik' | 'copkutusu' | 'ayarlar';

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
  dashboard:  { label: 'Genel Bakış',     icon: 'ri-layout-grid-line' },
  firmalar:   { label: 'Firmalar',        icon: 'ri-building-3-line' },
  uzmanlar:   { label: 'Uzmanlar',        icon: 'ri-shield-user-line' },
  ziyaretler: { label: 'Ziyaretler',      icon: 'ri-map-pin-2-line' },
  raporlar:   { label: 'Raporlar',        icon: 'ri-bar-chart-grouped-line' },
  analitik:   { label: 'Analiz & Harita', icon: 'ri-map-2-line' },
  copkutusu:  { label: 'Çöp Kutusu',     icon: 'ri-delete-bin-2-line' },
  ayarlar:    { label: 'Ayarlar',         icon: 'ri-settings-3-line' },
};

interface SupportNotification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  ticket_id: string | null;
}

const ACCENT   = '#818CF8';
const ACCENT_D = '#6366F1';

export default function OsgbHeader({
  activeTab, setActiveTab, collapsed, orgName,
  onMobileMenuToggle, onFirmaEkle, onUzmanEkle, theme = 'dark', onToggleTheme,
}: OsgbHeaderProps) {
  const { user, logout } = useAuth();
  const meta = tabMeta[activeTab];
  const isDark = theme === 'dark';

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Günaydın' : hour < 17 ? 'İyi Günler' : 'İyi Akşamlar';

  const [displayName, setDisplayName] = useState(
    user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'Admin'
  );

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) {
        setDisplayName(session.user.user_metadata?.full_name ?? session.user.email?.split('@')[0] ?? 'Admin');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const [notifs, setNotifs]       = useState<SupportNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef    = useRef<HTMLDivElement>(null);
  const unread      = notifs.filter(n => !n.is_read).length;

  const [supportOpen, setSupportOpen]             = useState(false);
  const [supportViewTicketId, setSupportViewTicketId] = useState<string | null>(null);

  const fetchNotifs = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from('notifications')
      .select('id,title,message,is_read,created_at,ticket_id')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setNotifs(data as SupportNotification[]);
  };

  useEffect(() => { void fetchNotifs(); }, []);

  const markRead = async (id: string) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  };

  const markAllRead = async () => {
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    const ids = notifs.filter(n => !n.is_read).map(n => n.id);
    if (ids.length) await supabase.from('notifications').update({ is_read: true }).in('id', ids);
  };

  const [search, setSearch]         = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const searchRef   = useRef<HTMLDivElement>(null);
  const profileRef  = useRef<HTMLDivElement>(null);
  const quickRef    = useRef<HTMLDivElement>(null);

  const [profileOpen, setProfileOpen] = useState(false);
  const [quickOpen, setQuickOpen]     = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [refreshDone, setRefreshDone] = useState(false);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true); setRefreshDone(false);
    await new Promise(r => setTimeout(r, 800));
    setRefreshDone(true); setRefreshing(false);
    setTimeout(() => setRefreshDone(false), 2000);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setQuickOpen(false); };
    if (quickOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [quickOpen]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchFocus(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (quickRef.current && !quickRef.current.contains(e.target as Node)) {
        if (!(e.target as HTMLElement).closest('[data-quick-dropdown]')) setQuickOpen(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const navToTab = (tab: Tab) => {
    setActiveTab?.(tab);
    setProfileOpen(false);
    setQuickOpen(false);
  };

  /* ── Renkler ── */
  const bg     = isDark ? 'rgba(14,17,32,0.97)' : 'rgba(255,255,255,0.98)';
  const border = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)';
  const text   = isDark ? '#e8eaf6' : '#0F172A';
  const muted  = isDark ? 'rgba(255,255,255,0.35)' : '#64748B';
  const btnBg  = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)';
  const btnBorder = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.08)';
  const inBg   = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)';
  const inBd   = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.08)';
  const dropBg = isDark ? '#161b30' : '#ffffff';
  const dropBd = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.09)';
  const dropHv = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)';

  return (
    <>
      <header
        className={`fixed top-0 right-0 z-30 flex items-center gap-2 ${collapsed ? 'lg:left-[88px]' : 'lg:left-[244px]'} left-0`}
        style={{
          height: '50px',
          background: bg,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: `1px solid ${border}`,
          boxShadow: isDark ? '0 1px 0 rgba(255,255,255,0.04), 0 4px 20px rgba(0,0,0,0.3)' : '0 1px 0 rgba(15,23,42,0.06)',
          transition: 'left 0.28s cubic-bezier(0.4,0,0.2,1)',
          paddingLeft: '14px',
          paddingRight: '14px',
        }}
      >
        {/* Mobile hamburger */}
        <button onClick={onMobileMenuToggle}
          className="w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer lg:hidden flex-shrink-0"
          style={{ color: muted, background: btnBg, border: `1px solid ${btnBorder}` }}>
          <i className="ri-menu-line text-sm" />
        </button>

        {/* Sayfa başlığı */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ background: 'rgba(129,140,248,0.15)', border: '1px solid rgba(129,140,248,0.2)' }}>
            <i className={`${meta.icon} text-[11px]`} style={{ color: ACCENT }} />
          </div>
          <span className="text-[13px] font-bold truncate" style={{ color: text, maxWidth: '140px' }}>
            {meta.label}
          </span>
        </div>

        <div className="flex-1" />

        {/* Selamlama */}
        <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
          <p className="text-[11.5px] font-medium" style={{ color: muted }}>
            {greeting}, <span className="font-bold" style={{ color: text }}>{displayName}</span>
          </p>
        </div>

        {/* OSGB badge */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold flex-shrink-0"
          style={{ background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)', color: ACCENT }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: ACCENT }} />
          OSGB · {orgName}
        </div>

        {/* Arama */}
        <div className="relative hidden md:flex items-center flex-shrink-0" ref={searchRef}>
          <i className="ri-search-line absolute left-2.5 text-[11px] z-10" style={{ color: '#718096' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Ara..."
            className="w-36 pl-7 pr-2.5 py-1.5 text-[11.5px] rounded-xl outline-none transition-all duration-200"
            style={{ background: inBg, border: `1px solid ${inBd}`, color: isDark ? '#e8eaf6' : '#334155' }}
            onFocus={e => {
              setSearchFocus(true);
              e.currentTarget.style.borderColor = ACCENT;
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(129,140,248,0.2)';
              e.currentTarget.style.width = '180px';
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = inBd;
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.width = '';
            }}
          />
          {searchFocus && search.trim().length > 0 && (
            <div className="absolute right-0 top-11 w-72 py-3 z-50"
              style={{ background: dropBg, border: `1px solid ${dropBd}`, borderRadius: '14px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
              <div className="px-4 py-2 text-center">
                <i className="ri-search-line text-xl" style={{ color: ACCENT }} />
                <p className="text-[12px] mt-1 font-medium" style={{ color: muted }}>&quot;{search}&quot; aranıyor...</p>
              </div>
            </div>
          )}
        </div>

        {/* Yenile */}
        <button onClick={handleRefresh} disabled={refreshing} title="Verileri Yenile"
          className="w-8 h-8 hidden md:flex items-center justify-center rounded-xl cursor-pointer transition-all flex-shrink-0"
          style={{ background: refreshDone ? 'rgba(129,140,248,0.12)' : btnBg, border: `1px solid ${refreshDone ? 'rgba(129,140,248,0.3)' : btnBorder}` }}>
          <i className={`${refreshing ? 'ri-loader-4-line animate-spin' : refreshDone ? 'ri-check-line' : 'ri-refresh-line'} text-sm`}
            style={{ color: refreshDone ? ACCENT : refreshing ? ACCENT : muted }} />
        </button>

        {/* Tema toggle */}
        {onToggleTheme && (
          <button onClick={onToggleTheme} title={isDark ? 'Açık Tema' : 'Koyu Tema'}
            className="w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer transition-all flex-shrink-0"
            style={{ background: btnBg, border: `1px solid ${btnBorder}` }}>
            <i className={`${isDark ? 'ri-sun-line' : 'ri-moon-line'} text-sm`} style={{ color: isDark ? '#F59E0B' : '#475569' }} />
          </button>
        )}

        {/* Hızlı Ekle */}
        <div className="relative flex-shrink-0" ref={quickRef}>
          <button
            onClick={() => { setQuickOpen(v => !v); setProfileOpen(false); setNotifOpen(false); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white cursor-pointer whitespace-nowrap flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_D})`, fontSize: '11px', boxShadow: quickOpen ? '0 4px 16px rgba(99,102,241,0.45)' : 'none' }}>
            <i className="ri-add-line text-sm" />
            <span className="hidden sm:inline">Hızlı Ekle</span>
          </button>
        </div>

        {/* Hızlı Ekle Modal */}
        {quickOpen && createPortal(
          <div data-quick-dropdown="true"
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ zIndex: 999999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)' }}
            onMouseDown={e => { if (e.target === e.currentTarget) setQuickOpen(false); }}>
            <div className="relative w-full max-w-lg rounded-2xl overflow-hidden"
              style={{ background: dropBg, border: `1px solid ${dropBd}`, boxShadow: '0 40px 100px rgba(0,0,0,0.6)' }}>
              {/* Renkli üst bant */}
              <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT_D}, #A78BFA, #F59E0B)` }} />
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${dropBd}` }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl"
                    style={{ background: 'rgba(129,140,248,0.15)', border: '1px solid rgba(129,140,248,0.25)' }}>
                    <i className="ri-add-circle-line text-lg" style={{ color: ACCENT }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: text }}>Hızlı Ekle</h3>
                    <p className="text-[11px] mt-0.5" style={{ color: muted }}>Hangi kaydı oluşturmak istiyorsunuz?</p>
                  </div>
                </div>
                <button onClick={() => setQuickOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all"
                  style={{ background: btnBg, color: muted, border: `1px solid ${dropBd}` }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLElement).style.color = '#EF4444'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = btnBg; (e.currentTarget as HTMLElement).style.color = muted; }}>
                  <i className="ri-close-line text-sm" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-5">
                {/* Ana işlemler */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: muted }}>— Temel İşlemler</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { icon: 'ri-building-2-line', label: 'Firma Ekle', desc: 'Yeni firma kaydı', action: () => { onFirmaEkle?.(); setQuickOpen(false); } },
                      { icon: 'ri-user-add-line', label: 'Uzman Ekle', desc: 'Çalışan kaydı ekle', action: () => { onUzmanEkle?.(); setQuickOpen(false); } },
                    ].map(item => (
                      <button key={item.label} onClick={item.action}
                        className="flex flex-col items-start gap-3 p-4 rounded-xl cursor-pointer transition-all text-left"
                        style={{ background: 'rgba(129,140,248,0.07)', border: '1.5px solid rgba(129,140,248,0.18)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(129,140,248,0.14)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(129,140,248,0.35)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(129,140,248,0.07)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(129,140,248,0.18)'; }}>
                        <div className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ background: 'rgba(129,140,248,0.15)', border: '1px solid rgba(129,140,248,0.25)' }}>
                          <i className={`${item.icon} text-lg`} style={{ color: ACCENT }} />
                        </div>
                        <div>
                          <p className="text-sm font-bold" style={{ color: text }}>{item.label}</p>
                          <p className="text-[10.5px] mt-0.5" style={{ color: muted }}>{item.desc}</p>
                          <p className="text-[10px] font-semibold mt-2" style={{ color: ACCENT }}>Modüle git →</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Diğer sayfalar */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: muted }}>— Diğer Sayfalar</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { icon: 'ri-map-pin-2-line', label: 'Ziyaretler', color: '#22C55E', bg: 'rgba(34,197,94,0.1)', tab: 'ziyaretler' as Tab },
                      { icon: 'ri-bar-chart-grouped-line', label: 'Raporlar', color: ACCENT, bg: 'rgba(129,140,248,0.1)', tab: 'raporlar' as Tab },
                      { icon: 'ri-pie-chart-2-line', label: 'Analitik', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', tab: 'analitik' as Tab },
                      { icon: 'ri-settings-3-line', label: 'Ayarlar', color: '#94A3B8', bg: 'rgba(148,163,184,0.1)', tab: 'ayarlar' as Tab },
                    ].map(item => (
                      <button key={item.label} onClick={() => { navToTab(item.tab); setQuickOpen(false); }}
                        className="flex flex-col items-center justify-center gap-2 py-3 px-2 rounded-xl cursor-pointer transition-all"
                        style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)', border: `1px solid ${dropBd}` }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = item.bg; (e.currentTarget as HTMLElement).style.borderColor = item.color + '44'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)'; (e.currentTarget as HTMLElement).style.borderColor = dropBd; }}>
                        <div className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ background: item.bg }}>
                          <i className={`${item.icon} text-sm`} style={{ color: item.color }} />
                        </div>
                        <span className="text-[10px] font-semibold text-center leading-tight" style={{ color: muted }}>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-6 py-3 flex items-center justify-between" style={{ borderTop: `1px solid ${dropBd}` }}>
                <div className="flex items-center gap-2">
                  <kbd className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: btnBg, color: muted, border: `1px solid ${dropBd}` }}>ESC</kbd>
                  <span className="text-[10px]" style={{ color: muted }}>ile kapat</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <i className="ri-flashlight-line text-xs" style={{ color: ACCENT }} />
                  <span className="text-[10px] font-semibold" style={{ color: muted }}>6 modül</span>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Bildirimler */}
        <div className="relative flex-shrink-0 hidden sm:block" ref={notifRef}>
          <button onClick={() => { setNotifOpen(v => !v); setProfileOpen(false); setQuickOpen(false); void fetchNotifs(); }}
            className="w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer transition-all relative"
            style={{ background: notifOpen ? 'rgba(129,140,248,0.12)' : btnBg, border: `1px solid ${notifOpen ? 'rgba(129,140,248,0.28)' : btnBorder}` }}
            title="Bildirimler">
            <i className="ri-notification-3-line text-sm" style={{ color: notifOpen ? ACCENT : muted }} />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] flex items-center justify-center text-[9px] font-bold text-white rounded-full px-1"
                style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_D})`, boxShadow: `0 0 6px rgba(129,140,248,0.5)` }}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-12 z-50 w-[300px] sm:w-[320px] overflow-hidden"
              style={{ background: dropBg, border: `1px solid ${dropBd}`, borderRadius: '16px', boxShadow: isDark ? '0 25px 60px rgba(0,0,0,0.6)' : '0 20px 50px rgba(15,23,42,0.15)', backdropFilter: 'blur(20px)' }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${dropBd}` }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(129,140,248,0.12)' }}>
                    <i className="ri-notification-3-line text-xs" style={{ color: ACCENT }} />
                  </div>
                  <p className="text-[13px] font-bold" style={{ color: text }}>Bildirimler</p>
                  {unread > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(129,140,248,0.12)', color: ACCENT, border: '1px solid rgba(129,140,248,0.2)' }}>
                      {unread} yeni
                    </span>
                  )}
                </div>
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-[11px] cursor-pointer font-semibold px-2 py-1 rounded-lg"
                    style={{ color: ACCENT, background: 'rgba(129,140,248,0.08)' }}>
                    Tümünü oku
                  </button>
                )}
              </div>

              {notifs.length === 0 ? (
                <div className="py-10 px-4 text-center">
                  <div className="w-10 h-10 flex items-center justify-center rounded-2xl mx-auto mb-3" style={{ background: 'rgba(129,140,248,0.1)' }}>
                    <i className="ri-check-double-line text-lg" style={{ color: ACCENT }} />
                  </div>
                  <p className="text-[12px] font-semibold" style={{ color: text }}>Yeni bildirim yok</p>
                  <p className="text-[11px] mt-1" style={{ color: muted }}>Sistem bildirimleri burada görünür</p>
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto">
                  {notifs.map((n, idx) => (
                    <div key={n.id}
                      onClick={() => { markRead(n.id); setNotifOpen(false); if (n.ticket_id) { setSupportViewTicketId(n.ticket_id); setSupportOpen(true); } }}
                      className="px-4 py-3 cursor-pointer transition-all"
                      style={{
                        borderBottom: idx < notifs.length - 1 ? `1px solid ${dropBd}` : 'none',
                        opacity: n.is_read ? 0.5 : 1,
                        background: !n.is_read ? 'rgba(129,140,248,0.04)' : 'transparent',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = dropHv; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = !n.is_read ? 'rgba(129,140,248,0.04)' : 'transparent'; }}>
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 flex items-center justify-center rounded-xl flex-shrink-0 mt-0.5" style={{ background: 'rgba(129,140,248,0.1)' }}>
                          <i className="ri-reply-line text-xs" style={{ color: ACCENT }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-[12px] font-semibold truncate flex-1" style={{ color: text }}>{n.title}</p>
                            {!n.is_read && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: ACCENT }} />}
                          </div>
                          <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: muted }}>{n.message}</p>
                          <p className="text-[10px] mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.2)' : '#94A3B8' }}>
                            {new Date(n.created_at).toLocaleString('tr-TR')}
                          </p>
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
            onClick={() => { setProfileOpen(v => !v); setNotifOpen(false); setQuickOpen(false); }}
            className="flex items-center gap-1.5 cursor-pointer transition-all rounded-xl py-1 px-1.5"
            style={{
              background: profileOpen ? 'rgba(129,140,248,0.1)' : 'transparent',
              border: `1px solid ${profileOpen ? 'rgba(129,140,248,0.25)' : 'transparent'}`,
            }}
            onMouseEnter={e => { if (!profileOpen) { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)'; } }}
            onMouseLeave={e => { if (!profileOpen) { (e.currentTarget as HTMLElement).style.background = 'transparent'; } }}>
            <div className="w-7 h-7 rounded-xl flex items-center justify-center text-[11px] font-black text-white flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_D})`, boxShadow: '0 2px 8px rgba(99,102,241,0.4)' }}>
              {(user?.email ?? 'O').charAt(0).toUpperCase()}
            </div>
            <div className="hidden lg:block text-left">
              <p className="text-[11px] font-semibold leading-tight" style={{ color: text }}>{displayName}</p>
            </div>
            <i className={`ri-arrow-down-s-line text-xs hidden md:block transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} style={{ color: muted }} />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-12 z-50 w-[220px] overflow-hidden"
              style={{ background: dropBg, border: `1px solid ${dropBd}`, borderRadius: '16px', boxShadow: isDark ? '0 25px 60px rgba(0,0,0,0.65)' : '0 20px 50px rgba(15,23,42,0.15)', backdropFilter: 'blur(20px)' }}>
              {/* Profil header */}
              <div className="px-4 py-3.5" style={{ borderBottom: `1px solid ${dropBd}` }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_D})`, boxShadow: '0 4px 12px rgba(99,102,241,0.4)' }}>
                    {(user?.email ?? 'O').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold truncate" style={{ color: text }}>{displayName}</p>
                    <p className="text-[10.5px] truncate mt-0.5" style={{ color: muted }}>{user?.email}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }} />
                      <span className="text-[9.5px] font-semibold" style={{ color: ACCENT }}>OSGB Admin</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="py-1.5">
                {[
                  { icon: 'ri-settings-4-line', label: 'Ayarlar', tab: 'ayarlar' as Tab, color: '#94A3B8', bg: 'rgba(148,163,184,0.1)' },
                  { icon: 'ri-bar-chart-2-line', label: 'Raporlar', tab: 'raporlar' as Tab, color: ACCENT, bg: 'rgba(129,140,248,0.1)' },
                ].map(item => (
                  <button key={item.label} onClick={() => navToTab(item.tab)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-all"
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = dropHv; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: item.bg }}>
                      <i className={`${item.icon} text-xs`} style={{ color: item.color }} />
                    </div>
                    <span className="text-[12.5px] font-medium flex-1" style={{ color: isDark ? '#CBD5E1' : '#334155' }}>{item.label}</span>
                    <i className="ri-arrow-right-s-line text-xs" style={{ color: muted }} />
                  </button>
                ))}

                <button onClick={() => { setSupportOpen(true); setProfileOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-all"
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = dropHv; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                  <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(129,140,248,0.1)' }}>
                    <i className="ri-customer-service-2-line text-xs" style={{ color: ACCENT }} />
                  </div>
                  <span className="text-[12.5px] font-medium flex-1" style={{ color: isDark ? '#CBD5E1' : '#334155' }}>Destek / Sorun Bildir</span>
                  <i className="ri-arrow-right-s-line text-xs" style={{ color: muted }} />
                </button>

                <div className="mx-3 my-1.5 h-px" style={{ background: dropBd }} />

                <button onClick={() => { setProfileOpen(false); logout(); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-all"
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.07)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
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
