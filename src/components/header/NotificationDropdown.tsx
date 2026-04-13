import { useRef, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Bildirim } from '@/store/useNotificationStore';
import { useSupportStore } from '@/store/useSupportStore';

// ── Support (Supabase) Notification type ──────────────────────────────────

interface SupportNotification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  ticket_id: string | null;
}

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string; badge: string; badgeBg: string }> = {
  evrak_surecek:           { icon: 'ri-file-warning-line',    color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', badge: 'Evrak',     badgeBg: 'rgba(148,163,184,0.12)' },
  evrak_dolmus:            { icon: 'ri-file-damage-line',     color: '#F87171', bg: 'rgba(248,113,113,0.12)', badge: 'Evrak',     badgeBg: 'rgba(248,113,113,0.12)' },
  ekipman_kontrol:         { icon: 'ri-tools-line',           color: '#FB923C', bg: 'rgba(251,146,60,0.12)',  badge: 'Ekipman',   badgeBg: 'rgba(251,146,60,0.12)' },
  ekipman_kontrol_yapildi: { icon: 'ri-checkbox-circle-fill', color: '#34D399', bg: 'rgba(52,211,153,0.12)',  badge: 'Kontrol ✓', badgeBg: 'rgba(52,211,153,0.12)' },
  egitim_surecek:          { icon: 'ri-graduation-cap-line',  color: '#60A5FA', bg: 'rgba(96,165,250,0.12)',  badge: 'Eğitim',    badgeBg: 'rgba(96,165,250,0.12)' },
  saglik_surecek:          { icon: 'ri-heart-pulse-line',     color: '#34D399', bg: 'rgba(52,211,153,0.12)',  badge: 'Sağlık',    badgeBg: 'rgba(52,211,153,0.12)' },
};

// ── Props ─────────────────────────────────────────────────────────────────

interface NotificationDropdownProps {
  // ISG (app) bildirimleri
  bildirimler: Bildirim[];
  okunmamisBildirimSayisi: number;
  bildirimOku: (id: string) => void;
  tumunuOku: () => void;
  onNavigate: (module: string, recordId?: string, tip?: string) => void;
  // Theme
  isDark: boolean;
  nameColor: string;
  dropdownBg: string;
  dropdownBorder: string;
  dropdownItemHover: string;
  textMuted: string;
  iconBtnBg: string;
  iconBtnBorder: string;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function NotificationDropdown({
  bildirimler,
  okunmamisBildirimSayisi,
  bildirimOku,
  tumunuOku,
  onNavigate,
  isDark,
  nameColor,
  dropdownBg,
  dropdownBorder,
  dropdownItemHover,
  textMuted,
  iconBtnBg,
  iconBtnBorder,
}: NotificationDropdownProps) {
  // ISG notifications panel
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Support (Supabase) notifications panel
  const [supportNotifOpen, setSupportNotifOpen] = useState(false);
  const [supportNotifs, setSupportNotifs] = useState<SupportNotification[]>([]);
  const supportNotifRef = useRef<HTMLDivElement>(null);
  const { openTicket: openSupportTicket } = useSupportStore();

  const unreadSupportCount = supportNotifs.filter(n => !n.is_read).length;

  const fetchSupportNotifs = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from('notifications')
      .select('id, title, message, is_read, created_at, ticket_id')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setSupportNotifs(data as SupportNotification[]);
  }, []);

  useEffect(() => { fetchSupportNotifs(); }, [fetchSupportNotifs]);

  const markSupportRead = async (id: string) => {
    setSupportNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  };

  const markAllSupportRead = async () => {
    setSupportNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    const ids = supportNotifs.filter(n => !n.is_read).map(n => n.id);
    if (ids.length > 0) await supabase.from('notifications').update({ is_read: true }).in('id', ids);
  };

  // Click-outside for both dropdowns
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (supportNotifRef.current && !supportNotifRef.current.contains(e.target as Node)) setSupportNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleBildirimClick = (b: Bildirim) => {
    bildirimOku(b.id);
    setNotifOpen(false);
    const targetModule = b.module || 'dashboard';
    setTimeout(() => {
      onNavigate(targetModule, b.recordId, b.tip);
    }, 50);
  };

  const displayBildirimler = bildirimler.filter(b => !b.okundu).slice(0, 20);

  return (
    <>
      {/* ── Support Notifications (Supabase) ── */}
      <div className="relative flex-shrink-0 hidden sm:block" ref={supportNotifRef}>
        <button
          onClick={() => { setSupportNotifOpen(v => !v); setNotifOpen(false); fetchSupportNotifs(); }}
          className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200 relative"
          style={{
            background: supportNotifOpen ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)') : iconBtnBg,
            border: `1px solid ${iconBtnBorder}`,
          }}
          title="Destek Bildirimleri"
        >
          <i className="ri-message-3-line text-sm" style={{ color: supportNotifOpen ? (isDark ? '#E2E8F0' : '#0F172A') : textMuted }} />
          {unreadSupportCount > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-[16px] h-[16px] flex items-center justify-center text-[9px] font-bold text-white rounded-full px-1"
              style={{ background: 'linear-gradient(135deg, #10B981, #059669)', boxShadow: '0 0 6px rgba(16,185,129,0.5)' }}
            >
              {unreadSupportCount > 9 ? '9+' : unreadSupportCount}
            </span>
          )}
        </button>

        {supportNotifOpen && (
          <div
            className="absolute right-0 top-11 z-50 w-[290px] sm:w-[320px] animate-slide-up overflow-hidden"
            style={{
              background: dropdownBg,
              border: `1px solid ${dropdownBorder}`,
              borderRadius: '16px',
              boxShadow: isDark ? '0 25px 60px rgba(0,0,0,0.6)' : '0 20px 50px rgba(15,23,42,0.15)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${dropdownBorder}` }}>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(16,185,129,0.1)' }}>
                  <i className="ri-message-3-line text-xs" style={{ color: '#10B981' }} />
                </div>
                <p className="text-[13px] font-bold" style={{ color: nameColor }}>Destek Yanıtları</p>
                {unreadSupportCount > 0 && (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}
                  >
                    {unreadSupportCount} yeni
                  </span>
                )}
              </div>
              {unreadSupportCount > 0 && (
                <button
                  onClick={markAllSupportRead}
                  className="text-[11px] cursor-pointer font-semibold px-2 py-1 rounded-lg transition-all"
                  style={{ color: '#10B981', background: 'rgba(16,185,129,0.08)' }}
                >
                  Tümünü oku
                </button>
              )}
            </div>

            {supportNotifs.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <div className="w-10 h-10 flex items-center justify-center rounded-2xl mx-auto mb-3" style={{ background: 'rgba(16,185,129,0.1)' }}>
                  <i className="ri-check-double-line text-lg" style={{ color: '#10B981' }} />
                </div>
                <p className="text-[12px] font-semibold" style={{ color: isDark ? '#E2E8F0' : '#334155' }}>Yeni bildirim yok</p>
                <p className="text-[11px] mt-1" style={{ color: '#64748B' }}>Admin yanıt verince burada görünür</p>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                {supportNotifs.map((n, idx) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      markSupportRead(n.id);
                      setSupportNotifOpen(false);
                      if (n.ticket_id) openSupportTicket(n.ticket_id);
                    }}
                    className="px-4 py-3 cursor-pointer transition-all"
                    style={{
                      borderBottom: idx < supportNotifs.length - 1 ? `1px solid ${dropdownBorder}` : 'none',
                      opacity: n.is_read ? 0.5 : 1,
                      background: !n.is_read ? (isDark ? 'rgba(16,185,129,0.04)' : 'rgba(16,185,129,0.03)') : 'transparent',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = dropdownItemHover; }}
                    onMouseLeave={e => { e.currentTarget.style.background = !n.is_read ? (isDark ? 'rgba(16,185,129,0.04)' : 'rgba(16,185,129,0.03)') : 'transparent'; }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 flex items-center justify-center rounded-xl flex-shrink-0 mt-0.5" style={{ background: 'rgba(16,185,129,0.1)' }}>
                        <i className="ri-reply-line text-xs" style={{ color: '#10B981' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[12px] font-semibold truncate flex-1" style={{ color: isDark ? '#E2E8F0' : '#0F172A' }}>{n.title}</p>
                          {!n.is_read && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#10B981' }} />}
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

      {/* ── ISG Notifications ── */}
      <div className="relative flex-shrink-0" ref={notifRef}>
        <button
          onClick={() => { setNotifOpen(v => !v); setSupportNotifOpen(false); }}
          className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200 relative"
          style={{
            background: notifOpen ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)') : iconBtnBg,
            border: `1px solid ${notifOpen ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.14)') : iconBtnBorder}`,
          }}
          onMouseEnter={e => { if (!notifOpen) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)'; }}
          onMouseLeave={e => { if (!notifOpen) e.currentTarget.style.background = iconBtnBg; }}
        >
          <i className="ri-notification-3-line text-sm" style={{ color: notifOpen ? (isDark ? '#E2E8F0' : '#0F172A') : textMuted }} />
          {okunmamisBildirimSayisi > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-[16px] h-[16px] flex items-center justify-center text-[9px] font-bold text-white rounded-full px-1 notif-badge-enter"
              style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)', boxShadow: '0 0 6px rgba(239,68,68,0.5)' }}
            >
              {okunmamisBildirimSayisi > 9 ? '9+' : okunmamisBildirimSayisi}
            </span>
          )}
        </button>

        {notifOpen && (
          <div
            className="absolute right-0 top-11 z-50 w-[300px] sm:w-[340px] animate-slide-up overflow-hidden"
            style={{
              background: dropdownBg,
              border: `1px solid ${dropdownBorder}`,
              borderRadius: '16px',
              boxShadow: isDark ? '0 25px 60px rgba(0,0,0,0.6)' : '0 20px 50px rgba(15,23,42,0.15)',
              backdropFilter: 'blur(20px)',
            }}
          >
            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${dropdownBorder}` }}>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(59,130,246,0.1)' }}>
                  <i className="ri-notification-3-line text-xs" style={{ color: '#60A5FA' }} />
                </div>
                <p className="text-[13px] font-bold" style={{ color: nameColor }}>Bildirimler</p>
                {okunmamisBildirimSayisi > 0 && (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(239,68,68,0.12)', color: '#F87171', border: '1px solid rgba(239,68,68,0.15)' }}
                  >
                    {okunmamisBildirimSayisi} yeni
                  </span>
                )}
              </div>
              {okunmamisBildirimSayisi > 0 && (
                <button
                  onClick={tumunuOku}
                  className="text-[11px] cursor-pointer font-semibold px-2.5 py-1 rounded-lg transition-all"
                  style={{ color: '#60A5FA', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.14)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.08)'; }}
                >
                  Tümünü okundu işaretle
                </button>
              )}
            </div>

            {/* Body */}
            {displayBildirimler.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <div className="w-12 h-12 flex items-center justify-center rounded-2xl mx-auto mb-3" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.15)' }}>
                  <i className="ri-check-double-line text-xl" style={{ color: '#10B981' }} />
                </div>
                <p className="text-[13px] font-semibold" style={{ color: isDark ? '#E2E8F0' : '#334155' }}>Her şey yolunda</p>
                <p className="text-[11px] mt-1" style={{ color: '#64748B' }}>Sistemde yaklaşan veya geciken işlem bulunmuyor</p>
              </div>
            ) : (
              <>
                {/* Summary chips */}
                <div className="px-4 py-2.5 flex flex-wrap gap-1.5" style={{ borderBottom: `1px solid ${dropdownBorder}` }}>
                  {(['ekipman_kontrol_yapildi', 'evrak_surecek', 'evrak_dolmus', 'ekipman_kontrol', 'egitim_surecek', 'saglik_surecek'] as const).map(tip => {
                    const count = bildirimler.filter(b => b.tip === tip).length;
                    if (count === 0) return null;
                    const cfg = TYPE_CONFIG[tip] ?? { icon: 'ri-notification-3-line', color: '#64748B', bg: 'rgba(100,116,139,0.12)', badge: 'Bildirim', badgeBg: 'rgba(100,116,139,0.12)' };
                    return (
                      <span
                        key={tip}
                        className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: cfg.badgeBg, color: cfg.color, border: `1px solid ${cfg.color}25` }}
                      >
                        <i className={`${cfg.icon} text-[9px]`} />
                        {cfg.badge} ({count})
                      </span>
                    );
                  })}
                </div>

                <div className="max-h-64 overflow-y-auto">
                  {displayBildirimler.map((b, idx) => {
                    const cfg = TYPE_CONFIG[b.tip as keyof typeof TYPE_CONFIG] ?? {
                      icon: 'ri-notification-3-line',
                      color: '#64748B',
                      bg: 'rgba(100,116,139,0.12)',
                      badge: 'Bildirim',
                      badgeBg: 'rgba(100,116,139,0.12)',
                    };
                    return (
                      <div
                        key={b.id}
                        className="px-4 py-3 cursor-pointer transition-all"
                        style={{
                          borderBottom: idx < displayBildirimler.length - 1 ? `1px solid ${dropdownBorder}` : 'none',
                          opacity: b.okundu ? 0.45 : 1,
                          background: !b.okundu ? (isDark ? 'rgba(59,130,246,0.03)' : 'rgba(59,130,246,0.02)') : 'transparent',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = dropdownItemHover; }}
                        onMouseLeave={e => { e.currentTarget.style.background = !b.okundu ? (isDark ? 'rgba(59,130,246,0.03)' : 'rgba(59,130,246,0.02)') : 'transparent'; }}
                        onClick={() => handleBildirimClick(b)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0 mt-0.5" style={{ background: cfg.bg }}>
                            <i className={cfg.icon} style={{ color: cfg.color, fontSize: '13px' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: cfg.badgeBg, color: cfg.color }}>
                                {cfg.badge}
                              </span>
                              <p className="text-[12px] font-semibold truncate flex-1" style={{ color: isDark ? '#E2E8F0' : '#0F172A' }}>{b.mesaj}</p>
                              {!b.okundu && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#3B82F6' }} />}
                            </div>
                            <p className="text-[11px] leading-relaxed" style={{ color: '#64748B' }}>{b.detay}</p>
                            {b.module && (
                              <p className="text-[10px] mt-1 flex items-center gap-1 font-semibold" style={{ color: '#3B82F6' }}>
                                <i className="ri-arrow-right-circle-line text-[10px]" />
                                {b.module === 'evraklar' ? 'Evrak Takibi'
                                  : b.module === 'ekipmanlar' ? 'Ekipmanlar'
                                  : b.module === 'egitimler' ? 'Eğitimler'
                                  : b.module === 'muayeneler' ? 'Sağlık'
                                  : 'Panele Git'} sayfasına git
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Footer */}
            {displayBildirimler.length > 0 && (
              <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderTop: `1px solid ${dropdownBorder}` }}>
                <p className="text-[10.5px]" style={{ color: '#475569' }}>
                  {okunmamisBildirimSayisi} okunmamış uyarı
                </p>
                <button
                  onClick={tumunuOku}
                  className="text-[11.5px] font-semibold cursor-pointer transition-all flex items-center gap-1.5"
                  style={{ color: '#60A5FA' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#93C5FD'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#60A5FA'; }}
                >
                  Tümünü okundu işaretle
                  <i className="ri-check-double-line text-[11px]" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
