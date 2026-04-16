import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/store/AuthContext';
import { supabase } from '@/lib/supabase';
import SupportModal from '@/components/feature/SupportModal';
import { useSupportStore } from '@/store/useSupportStore';

interface SupportNotif {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  ticket_id: string | null;
}

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518';

const ACCENT = '#0EA5E9';
const ACCENT_DARK = '#0284C7';
const ACCENT_LIGHT = '#38BDF8';

export type HekimTab = 'genel_bakis' | 'firmalar' | 'personeller' | 'saglik' | 'is_kazasi' | 'cop' | 'ziyaret';

interface HekimSidebarProps {
  activeTab: HekimTab;
  setActiveTab: (tab: HekimTab) => void;
  orgName: string;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const navItems: { id: HekimTab; label: string; icon: string; mobileOnly?: boolean }[] = [
  { id: 'genel_bakis',  label: 'Genel Bakış',    icon: 'ri-dashboard-3-line' },
  { id: 'firmalar',    label: 'Firmalar',       icon: 'ri-building-3-line' },
  { id: 'personeller', label: 'Personel',        icon: 'ri-group-line' },
  { id: 'saglik',      label: 'Sağlık Durumu',   icon: 'ri-heart-pulse-line' },
  { id: 'is_kazasi',   label: 'İş Kazaları',     icon: 'ri-alert-line' },
  { id: 'cop',         label: 'Çöp Kutusu',      icon: 'ri-delete-bin-6-line' },
  { id: 'ziyaret',     label: 'Saha Ziyareti',   icon: 'ri-map-pin-user-line', mobileOnly: true },
];

export default function HekimSidebar({
  activeTab,
  setActiveTab,
  orgName,
  collapsed,
  setCollapsed,
  mobileOpen = false,
  onMobileClose,
}: HekimSidebarProps) {
  const { logout, user } = useAuth();
  const { supportOpen, viewTicketId, openSupport, closeSupport, openTicket } = useSupportStore();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [notifs, setNotifs] = useState<SupportNotif[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifs.filter(n => !n.is_read).length;

  const fetchNotifs = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from('notifications')
      .select('id, title, message, is_read, created_at, ticket_id')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setNotifs(data as SupportNotif[]);
  };

  useEffect(() => { fetchNotifs(); }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markRead = async (id: string) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  };

  const markAllRead = async () => {
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    const ids = notifs.filter(n => !n.is_read).map(n => n.id);
    if (ids.length > 0) await supabase.from('notifications').update({ is_read: true }).in('id', ids);
  };

  const userInitial = (user?.email ?? 'H').charAt(0).toUpperCase();
  const userName = user?.email?.split('@')[0] ?? 'İşyeri Hekimi';

  const handleNav = (tab: HekimTab) => {
    setActiveTab(tab);
    onMobileClose?.();
  };

  return (
    <>
      <aside
        className={[
          'fixed top-3 bottom-3 flex flex-col z-[42]',
          collapsed ? 'w-[64px] left-3' : 'w-[220px] left-3',
          mobileOpen ? 'translate-x-0 opacity-100' : '-translate-x-[calc(100%+12px)] opacity-0 lg:translate-x-0 lg:opacity-100',
        ].join(' ')}
        style={{
          background: 'var(--bg-sidebar)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          transition: mobileOpen
            ? 'width 0.28s cubic-bezier(0.4,0,0.2,1), transform 0.38s cubic-bezier(0.22,1,0.36,1), opacity 0.32s cubic-bezier(0.22,1,0.36,1)'
            : 'width 0.28s cubic-bezier(0.4,0,0.2,1), transform 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.22s ease',
          boxShadow: mobileOpen
            ? '0 24px 64px rgba(0,0,0,0.35), 0 8px 24px rgba(0,0,0,0.18), 0 0 0 1px rgba(15,23,42,0.08)'
            : '0 4px 24px rgba(0,0,0,0.10), 0 1px 6px rgba(0,0,0,0.06), 0 0 0 1px rgba(15,23,42,0.06)',
          overflow: 'hidden',
        }}
      >
        {/* ── Logo ── */}
        <div
          className={`flex items-center flex-shrink-0 ${collapsed ? 'justify-center px-0 h-[56px]' : 'px-4 h-[56px] gap-3'}`}
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div
            className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ background: `rgba(14,165,233,0.12)`, border: `1px solid rgba(14,165,233,0.22)` }}
          >
            <img src={LOGO_URL} alt="ISG" style={{ height: '16px', width: 'auto', objectFit: 'contain' }} />
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-bold truncate leading-tight" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                ISG Denetim
              </p>
              <p className="text-[9.5px] font-semibold mt-0.5 truncate" style={{ color: ACCENT, letterSpacing: '0.04em' }}>
                HEKİM PANELİ
              </p>
            </div>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Genişlet' : 'Daralt'}
            className="hidden lg:flex items-center justify-center w-6 h-6 rounded-md cursor-pointer flex-shrink-0 transition-all duration-150"
            style={{ color: 'var(--text-faint)', background: 'transparent' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = `rgba(14,165,233,0.1)`;
              (e.currentTarget as HTMLElement).style.color = ACCENT;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)';
            }}
          >
            <i className="ri-side-bar-line text-[11px]" style={{ transform: collapsed ? 'scaleX(-1)' : 'none' }} />
          </button>
        </div>

        {/* ── Org Badge ── */}
        {!collapsed && (
          <div className="mx-3 mt-3">
            <div
              className="px-3 py-2.5 rounded-xl"
              style={{ background: `rgba(14,165,233,0.06)`, border: `1px solid rgba(14,165,233,0.12)` }}
            >
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: ACCENT, boxShadow: `0 0 5px rgba(14,165,233,0.6)` }} />
                <p className="text-[9px] font-bold uppercase tracking-[0.12em]"
                  style={{ color: `rgba(14,165,233,0.65)` }}>
                  Organizasyon
                </p>
              </div>
              <p className="text-[12px] font-bold mt-1 truncate" style={{ color: ACCENT }}>{orgName}</p>
            </div>
          </div>
        )}

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5" style={{ scrollbarWidth: 'none' }}>
          {!collapsed && (
            <p className="text-[9px] font-bold uppercase px-2 mb-2 select-none tracking-[0.14em]"
              style={{ color: 'var(--text-faint)' }}>
              YÖNETİM
            </p>
          )}
          {collapsed && <div className="h-px my-2" style={{ background: 'var(--border-subtle)' }} />}

          {navItems.map(item => {
            const isActive = activeTab === item.id;
            const isHovered = hoveredItem === item.id;

            return (
              <button
                key={item.id}
                title={collapsed ? item.label : undefined}
                onClick={() => handleNav(item.id)}
                onMouseEnter={() => setHoveredItem(item.id)}
                onMouseLeave={() => setHoveredItem(null)}
                className={`w-full flex items-center text-left cursor-pointer relative overflow-hidden ${item.mobileOnly ? 'lg:hidden' : ''}`}
                style={{
                  padding: collapsed ? '9px 0' : '8px 10px',
                  borderRadius: '10px',
                  justifyContent: collapsed ? 'center' : undefined,
                  gap: collapsed ? undefined : '10px',
                  background: isActive
                    ? `rgba(14,165,233,0.1)`
                    : isHovered ? 'var(--bg-hover)' : 'transparent',
                  border: isActive
                    ? `1px solid rgba(14,165,233,0.2)`
                    : '1px solid transparent',
                  transition: 'all 0.18s ease',
                }}
              >
                {/* Left accent bar */}
                {isActive && !collapsed && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
                    style={{
                      width: '3px',
                      height: '55%',
                      background: `linear-gradient(180deg, ${ACCENT_LIGHT}, ${ACCENT_DARK})`,
                      boxShadow: `0 0 6px rgba(14,165,233,0.4)`,
                    }}
                  />
                )}

                {/* Icon */}
                <span
                  className="flex items-center justify-center flex-shrink-0"
                  style={{
                    width: '17px', height: '17px',
                    marginLeft: isActive && !collapsed ? '6px' : undefined,
                    transition: 'transform 0.18s ease',
                    transform: isHovered && !isActive ? 'translateX(1px)' : 'none',
                  }}
                >
                  <i
                    className={`${item.icon} text-[14px]`}
                    style={{
                      color: isActive ? ACCENT : isHovered ? 'var(--text-secondary)' : 'var(--text-muted)',
                      transition: 'color 0.18s ease',
                    }}
                  />
                </span>

                {/* Label */}
                {!collapsed && (
                  <>
                    <span
                      className="flex-1 leading-none text-[12px] truncate"
                      style={{
                        color: isActive ? ACCENT : isHovered ? 'var(--text-primary)' : 'var(--text-muted)',
                        fontWeight: isActive ? 600 : 500,
                        transition: 'color 0.18s ease',
                      }}
                    >
                      {item.label}
                    </span>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: ACCENT, boxShadow: `0 0 5px rgba(14,165,233,0.6)` }} />
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {/* ── Support + Bildirim ── */}
        <div className={`px-2.5 pb-2 space-y-1.5 ${collapsed ? 'flex flex-col items-center' : ''}`}>
          {/* Bildirim butonu */}
          <div className={`relative ${collapsed ? '' : 'w-full'}`} ref={notifRef}>
            <button
              onClick={() => { setNotifOpen(v => !v); fetchNotifs(); }}
              title={collapsed ? 'Bildirimler' : undefined}
              className={`cursor-pointer rounded-xl transition-all duration-150 relative ${collapsed ? 'w-10 h-10 flex items-center justify-center' : 'w-full flex items-center gap-2.5 px-3 py-2'}`}
              style={{ background: `rgba(14,165,233,0.06)`, border: `1px solid rgba(14,165,233,0.14)` }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `rgba(14,165,233,0.12)`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `rgba(14,165,233,0.06)`; }}
            >
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 relative">
                <i className="ri-notification-3-line text-xs" style={{ color: ACCENT }} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] flex items-center justify-center text-[8px] font-bold text-white rounded-full px-0.5"
                    style={{ background: '#EF4444' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              {!collapsed && (
                <>
                  <span className="text-[11.5px] font-semibold flex-1 text-left" style={{ color: ACCENT }}>Bildirimler</span>
                  {unreadCount > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>
                      {unreadCount}
                    </span>
                  )}
                </>
              )}
            </button>

            {/* Bildirim dropdown */}
            {notifOpen && (
              <div
                className="absolute bottom-full mb-2 left-0 w-[280px] overflow-hidden z-50"
                style={{
                  background: 'var(--bg-card-solid, #fff)',
                  border: '1px solid var(--border-subtle, rgba(15,23,42,0.09))',
                  borderRadius: '16px',
                  boxShadow: '0 20px 50px rgba(15,23,42,0.15)',
                }}
              >
                <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle, rgba(15,23,42,0.07))' }}>
                  <p className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>Bildirimler</p>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-[10px] font-semibold px-2 py-0.5 rounded-lg cursor-pointer" style={{ color: ACCENT, background: 'rgba(14,165,233,0.08)' }}>
                      Tümünü oku
                    </button>
                  )}
                </div>

                {notifs.length === 0 ? (
                  <div className="py-8 text-center">
                    <i className="ri-check-double-line text-xl mb-2 block" style={{ color: ACCENT }} />
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Yeni bildirim yok</p>
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto">
                    {notifs.map((n, idx) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          markRead(n.id);
                          setNotifOpen(false);
                          if (n.ticket_id) {
                            openTicket(n.ticket_id);
                          }
                        }}
                        className="px-4 py-3 cursor-pointer transition-all"
                        style={{
                          borderBottom: idx < notifs.length - 1 ? '1px solid var(--border-subtle, rgba(15,23,42,0.07))' : 'none',
                          opacity: n.is_read ? 0.55 : 1,
                          background: !n.is_read ? 'rgba(14,165,233,0.03)' : 'transparent',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(14,165,233,0.06)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = !n.is_read ? 'rgba(14,165,233,0.03)' : 'transparent'; }}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="w-6 h-6 flex items-center justify-center rounded-lg flex-shrink-0 mt-0.5" style={{ background: 'rgba(14,165,233,0.1)' }}>
                            <i className="ri-reply-line text-[10px]" style={{ color: ACCENT }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <p className="text-[11px] font-semibold truncate flex-1" style={{ color: 'var(--text-primary)' }}>{n.title}</p>
                              {!n.is_read && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: ACCENT }} />}
                            </div>
                            <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{n.message}</p>
                            <p className="text-[9px] mt-1" style={{ color: 'var(--text-faint)' }}>{new Date(n.created_at).toLocaleString('tr-TR')}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Destek butonu */}
          <button
            onClick={openSupport}
            title={collapsed ? 'Destek' : undefined}
            className={`cursor-pointer rounded-xl transition-all duration-150 ${collapsed ? 'w-10 h-10 flex items-center justify-center' : 'w-full flex items-center gap-2.5 px-3 py-2'}`}
            style={{ background: `rgba(14,165,233,0.06)`, border: `1px solid rgba(14,165,233,0.14)` }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = `rgba(14,165,233,0.12)`;
              (e.currentTarget as HTMLElement).style.borderColor = `rgba(14,165,233,0.28)`;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = `rgba(14,165,233,0.06)`;
              (e.currentTarget as HTMLElement).style.borderColor = `rgba(14,165,233,0.14)`;
            }}
          >
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
              <i className="ri-customer-service-2-line text-xs" style={{ color: ACCENT }} />
            </div>
            {!collapsed && (
              <>
                <span className="text-[11.5px] font-semibold flex-1 text-left" style={{ color: ACCENT }}>Destek</span>
                <i className="ri-arrow-right-s-line text-xs" style={{ color: `rgba(14,165,233,0.4)` }} />
              </>
            )}
          </button>
        </div>

        {/* ── Profile ── */}
        <div
          className={`mx-2.5 mb-3 rounded-xl flex items-center ${collapsed ? 'justify-center p-2' : 'gap-2.5 px-3 py-2.5'}`}
          style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)' }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${ACCENT_DARK}, ${ACCENT})` }}
          >
            {userInitial}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-[11.5px] font-semibold truncate leading-tight" style={{ color: 'var(--text-primary)' }}>
                  {userName}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full"
                    style={{ background: ACCENT, boxShadow: `0 0 4px rgba(14,165,233,0.6)` }} />
                  <p className="text-[9.5px] font-semibold" style={{ color: ACCENT }}>İşyeri Hekimi</p>
                </div>
              </div>
              <button
                onClick={logout}
                title="Çıkış Yap"
                className="flex items-center justify-center cursor-pointer rounded-md w-6 h-6 flex-shrink-0 transition-all duration-150"
                style={{ color: 'var(--text-faint)', background: 'transparent' }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.color = '#F87171';
                  (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)';
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <i className="ri-logout-box-r-line text-xs" />
              </button>
            </>
          )}
        </div>
      </aside>

      <SupportModal
        open={supportOpen}
        onClose={closeSupport}
        viewTicketId={viewTicketId}
      />
    </>
  );
}
