import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '@/store/AppContext';
import { useAuth } from '@/store/AuthContext';
import { supabase } from '@/lib/supabase';
import SupportModal from '@/components/feature/SupportModal';
import type { UzmanTab } from './UzmanSidebar';

const ACCENT = '#0EA5E9';

interface FirmaOption { id: string; name: string; }

interface Props {
  onMobileMenuToggle?: () => void;
  activeTab: UzmanTab;
  setActiveTab: (tab: UzmanTab) => void;
  tabTitles: Record<UzmanTab, { title: string; subtitle: string; icon: string }>;
  firmaOptions: FirmaOption[];
  aktiveFirmaId: string | null;
  setAktiveFirmaId: (id: string | null) => void;
}

// Uzman için hızlı ekle kartları — ziyaret yok
const uzmanQuickCards = [
  { id: 'tutanak',     label: 'Tutanak Ekle',    desc: 'Tutanak oluştur',       icon: 'ri-article-line',       accent: '#14B8A6', primary: true,  tab: 'tutanaklar' as UzmanTab },
  { id: 'sahadenetim', label: 'Saha Denetim',    desc: 'DÖF kaydı aç',          icon: 'ri-map-pin-user-line',  accent: '#FB923C', primary: true,  tab: 'saha_denetimleri' as UzmanTab },
  { id: 'evrak',       label: 'Evrak Ekle',      desc: 'Belge yükle',           icon: 'ri-file-add-line',      accent: '#F59E0B', primary: false, tab: 'belge_takibi' as UzmanTab },
  { id: 'egitim',      label: 'Eğitim Ekle',     desc: 'Eğitim planla',         icon: 'ri-graduation-cap-line',accent: '#A78BFA', primary: false, tab: 'egitimler' as UzmanTab },
  { id: 'ekipman',     label: 'Ekipman',         desc: 'Kontrol kaydı',         icon: 'ri-tools-line',         accent: '#34D399', primary: false, tab: 'ekipmanlar' as UzmanTab },
  { id: 'isizni',      label: 'İş İzni',         desc: 'İş izni kaydı aç',      icon: 'ri-file-shield-2-line', accent: '#38BDF8', primary: false, tab: 'is_izinleri' as UzmanTab },
  { id: 'personel',   label: 'Personel',         desc: 'Personel ekle',         icon: 'ri-user-add-line',      accent: '#10B981', primary: false, tab: 'personeller' as UzmanTab },
  { id: 'rapor',       label: 'Raporlar',        desc: 'Rapor görüntüle',       icon: 'ri-bar-chart-2-line',   accent: '#818CF8', primary: false, tab: 'raporlar' as UzmanTab },
];

interface SupportNotification {
  id: string; title: string; message: string; is_read: boolean; created_at: string; ticket_id: string | null;
}

export default function UzmanHeader({
  onMobileMenuToggle, activeTab, setActiveTab, tabTitles,
  firmaOptions, aktiveFirmaId, setAktiveFirmaId,
}: Props) {
  const {
    sidebarCollapsed, setSidebarCollapsed,
    currentUser, theme, toggleTheme,
    bildirimler, okunmamisBildirimSayisi, bildirimOku, tumunuOku,
    firmalar, personeller, evraklar, tutanaklar,
    refreshData, dataLoading, setQuickCreate,
  } = useApp();
  const { logout, user } = useAuth();

  const isDark = theme === 'dark';
  const current = tabTitles[activeTab];

  const [quickOpen, setQuickOpen]     = useState(false);
  const [notifOpen, setNotifOpen]     = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportViewTicketId, setSupportViewTicketId] = useState<string | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [search, setSearch]           = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [refreshDone, setRefreshDone] = useState(false);
  const [supportNotifs, setSupportNotifs] = useState<SupportNotification[]>([]);
  const [supportNotifOpen, setSupportNotifOpen] = useState(false);

  const searchRef  = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef   = useRef<HTMLDivElement>(null);
  const switcherRef = useRef<HTMLDivElement>(null);
  const supportNotifRef = useRef<HTMLDivElement>(null);

  const unreadSupportCount = supportNotifs.filter(n => !n.is_read).length;

  const fetchSupportNotifs = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase.from('notifications')
      .select('id, title, message, is_read, created_at, ticket_id')
      .eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(20);
    if (data) setSupportNotifs(data as SupportNotification[]);
  }, []);

  useEffect(() => { fetchSupportNotifs(); }, [fetchSupportNotifs]);

  const markSupportRead = async (id: string) => {
    setSupportNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  };

  const handleRefresh = async () => {
    if (refreshing || dataLoading) return;
    setRefreshing(true); setRefreshDone(false);
    try { await refreshData(); setRefreshDone(true); setTimeout(() => setRefreshDone(false), 2000); }
    finally { setRefreshing(false); }
  };

  // Search
  interface SearchResult { id: string; type: string; label: string; sub: string; icon: string; color: string; tab: UzmanTab; }
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const runSearch = useCallback((q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    const query = q.toLowerCase();
    const results: SearchResult[] = [];
    firmalar.filter(f => !f.silinmis && f.ad.toLowerCase().includes(query)).slice(0, 3).forEach(f =>
      results.push({ id: f.id, type: 'Firma', label: f.ad, sub: f.yetkiliKisi || f.tehlikeSinifi, icon: 'ri-building-2-line', color: ACCENT, tab: 'firmalar' })
    );
    personeller.filter(p => !p.silinmis && p.adSoyad.toLowerCase().includes(query)).slice(0, 3).forEach(p =>
      results.push({ id: p.id, type: 'Personel', label: p.adSoyad, sub: p.gorev || '—', icon: 'ri-user-line', color: '#10B981', tab: 'personeller' })
    );
    evraklar.filter(e => !e.silinmis && e.ad.toLowerCase().includes(query)).slice(0, 2).forEach(e =>
      results.push({ id: e.id, type: 'Evrak', label: e.ad, sub: e.tur, icon: 'ri-file-text-line', color: '#F59E0B', tab: 'belge_takibi' })
    );
    tutanaklar.filter(t => !t.silinmis && t.baslik.toLowerCase().includes(query)).slice(0, 2).forEach(t =>
      results.push({ id: t.id, type: 'Tutanak', label: t.baslik, sub: t.tutanakNo, icon: 'ri-article-line', color: '#14B8A6', tab: 'tutanaklar' })
    );
    setSearchResults(results.slice(0, 8));
  }, [firmalar, personeller, evraklar, tutanaklar]);
  useEffect(() => { runSearch(search); }, [search, runSearch]);

  // Close outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchFocus(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) setSwitcherOpen(false);
      if (supportNotifRef.current && !supportNotifRef.current.contains(e.target as Node)) setSupportNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (quickOpen) { e.stopPropagation(); setQuickOpen(false); }
      else if (notifOpen) { e.stopPropagation(); setNotifOpen(false); }
      else if (profileOpen) { e.stopPropagation(); setProfileOpen(false); }
      else if (searchFocus) { e.stopPropagation(); setSearch(''); setSearchFocus(false); }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [quickOpen, notifOpen, profileOpen, searchFocus]);

  const handleQuickCard = (card: typeof uzmanQuickCards[0]) => {
    setQuickOpen(false);
    setActiveTab(card.tab);
    setQuickCreate(card.tab);
  };

  // Status badge
  const statusInfo = (() => {
    const total = okunmamisBildirimSayisi;
    if (total === 0) return { text: 'Sistem sağlıklı', color: '#34D399', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)', icon: 'ri-checkbox-circle-line' };
    if (total <= 3)  return { text: `${total} yaklaşan`, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)', icon: 'ri-timer-line' };
    return { text: `${total} uyarı`, color: '#F87171', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)', icon: 'ri-alarm-warning-line' };
  })();

  const hour = new Date().getHours();
  const greeting = hour >= 6 && hour < 12 ? 'Günaydın' : hour >= 12 && hour < 17 ? 'İyi Günler' : 'İyi Akşamlar';
  const firstName = (currentUser.ad || '').split(' ')[0] || 'Uzman';
  const displayBildirimler = bildirimler.filter(b => !b.okundu).slice(0, 20);

  // Theme tokens
  const headerBg     = isDark ? 'var(--bg-header)' : 'rgba(255,255,255,0.97)';
  const headerBorder = isDark ? 'var(--border-subtle)' : 'rgba(15,23,42,0.075)';
  const textMuted    = isDark ? '#64748B' : '#64748B';
  const inputBg      = isDark ? 'var(--bg-input)' : 'rgba(15,23,42,0.04)';
  const inputBorder  = isDark ? 'var(--border-input)' : 'rgba(15,23,42,0.09)';
  const iconBtnBg    = isDark ? 'var(--bg-item)' : 'rgba(15,23,42,0.038)';
  const iconBtnBorder= isDark ? 'var(--border-main)' : 'rgba(15,23,42,0.09)';
  const nameColor    = isDark ? '#EDF2F7' : '#0F172A';
  const dropdownBg   = isDark ? 'var(--bg-card-solid)' : 'rgba(255,255,255,0.99)';
  const dropdownBorder = isDark ? 'var(--border-main)' : 'rgba(15,23,42,0.09)';
  const dropdownItemHover = isDark ? 'var(--bg-hover)' : 'rgba(15,23,42,0.038)';
  const showSearchDropdown = searchFocus && (searchResults.length > 0 || search.trim().length > 0);

  const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string; badge: string; badgeBg: string }> = {
    evrak_surecek:           { icon: 'ri-file-warning-line',    color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', badge: 'Evrak',   badgeBg: 'rgba(148,163,184,0.12)' },
    evrak_dolmus:            { icon: 'ri-file-damage-line',     color: '#F87171', bg: 'rgba(248,113,113,0.12)', badge: 'Evrak',   badgeBg: 'rgba(248,113,113,0.12)' },
    ekipman_kontrol:         { icon: 'ri-tools-line',           color: '#FB923C', bg: 'rgba(251,146,60,0.12)',  badge: 'Ekipman', badgeBg: 'rgba(251,146,60,0.12)' },
    ekipman_kontrol_yapildi: { icon: 'ri-checkbox-circle-fill', color: '#34D399', bg: 'rgba(52,211,153,0.12)',  badge: 'Kontrol', badgeBg: 'rgba(52,211,153,0.12)' },
    egitim_surecek:          { icon: 'ri-graduation-cap-line',  color: '#60A5FA', bg: 'rgba(96,165,250,0.12)',  badge: 'Eğitim',  badgeBg: 'rgba(96,165,250,0.12)' },
    saglik_surecek:          { icon: 'ri-heart-pulse-line',     color: '#34D399', bg: 'rgba(52,211,153,0.12)',  badge: 'Sağlık',  badgeBg: 'rgba(52,211,153,0.12)' },
  };

  return (
    <>
      <header
        className={`fixed top-0 right-0 z-30 flex items-center left-0 ${sidebarCollapsed ? 'lg:left-[64px]' : 'lg:left-[220px]'}`}
        style={{
          height: '56px',
          background: headerBg,
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderBottom: `1px solid ${headerBorder}`,
          transition: 'left 0.28s cubic-bezier(0.4,0,0.2,1)',
          paddingLeft: '20px',
          paddingRight: '16px',
          gap: '8px',
        }}
      >
        {/* Mobile hamburger */}
        <button onClick={onMobileMenuToggle}
          className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200 lg:hidden flex-shrink-0"
          style={{ color: textMuted, background: iconBtnBg, border: `1px solid ${iconBtnBorder}` }}>
          <i className="ri-menu-line text-sm" />
        </button>

        {/* Desktop sidebar toggle */}
        <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="w-8 h-8 items-center justify-center rounded-lg cursor-pointer transition-all duration-200 hidden lg:flex flex-shrink-0"
          style={{ color: textMuted, background: iconBtnBg, border: `1px solid ${iconBtnBorder}` }}>
          <i className={`${sidebarCollapsed ? 'ri-menu-unfold-line' : 'ri-menu-fold-line'} text-sm`} />
        </button>

        {/* Sayfa başlığı */}
        <div className="flex items-center gap-2.5 flex-shrink-0 min-w-0">
          <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
            <i className={`${current?.icon || 'ri-home-line'} text-sm`} style={{ color: ACCENT }} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold leading-tight truncate" style={{ color: nameColor, maxWidth: '160px' }}>
              {current?.title || activeTab}
            </span>
          </div>
        </div>

        <div className="flex-1" />

        {/* Selamlama */}
        <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
          <p className="text-[11.5px] font-medium" style={{ color: textMuted }}>
            {greeting}, <span className="font-bold" style={{ color: nameColor }}>{firstName}</span>
          </p>
        </div>

        {/* Status badge */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold flex-shrink-0"
          style={{ background: statusInfo.bg, border: `1px solid ${statusInfo.border}`, color: statusInfo.color }}>
          <i className={`${statusInfo.icon} text-[9px]`} />
          {statusInfo.text}
        </div>

        {/* Firma Switcher */}
        {firmaOptions.length > 1 && (
          <div className="relative hidden sm:block flex-shrink-0" ref={switcherRef}>
            <button onClick={() => setSwitcherOpen(v => !v)}
              className="whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold cursor-pointer transition-all"
              style={{
                background: aktiveFirmaId ? 'rgba(14,165,233,0.12)' : iconBtnBg,
                border: `1px solid ${aktiveFirmaId ? 'rgba(14,165,233,0.3)' : iconBtnBorder}`,
                color: aktiveFirmaId ? ACCENT : textMuted,
              }}>
              <i className="ri-building-3-line text-xs" />
              <span className="max-w-[100px] truncate">
                {aktiveFirmaId ? firmaOptions.find(f => f.id === aktiveFirmaId)?.name : `Tüm (${firmaOptions.length})`}
              </span>
              <i className={`${switcherOpen ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} text-xs`} />
            </button>
            {switcherOpen && (
              <div className="absolute right-0 top-11 z-50 rounded-xl overflow-hidden animate-slide-up"
                style={{ minWidth: 200, background: dropdownBg, border: `1px solid ${dropdownBorder}`, boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
                <div className="px-3 py-2" style={{ borderBottom: `1px solid ${dropdownBorder}` }}>
                  <p className="text-[10px] font-bold uppercase" style={{ color: textMuted }}>Firma Seçin</p>
                </div>
                {firmaOptions.length > 1 && (
                  <button onClick={() => { setAktiveFirmaId(null); setSwitcherOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-xs cursor-pointer transition-all"
                    style={{ background: !aktiveFirmaId ? 'rgba(14,165,233,0.08)' : 'transparent', color: !aktiveFirmaId ? ACCENT : isDark ? '#CBD5E1' : '#334155' }}>
                    <i className="ri-apps-2-line text-xs" />
                    <span className="flex-1 font-semibold">Tüm Firmalar</span>
                    {!aktiveFirmaId && <i className="ri-check-line text-xs" style={{ color: ACCENT }} />}
                  </button>
                )}
                {firmaOptions.map(f => (
                  <button key={f.id} onClick={() => { setAktiveFirmaId(f.id); setSwitcherOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-xs cursor-pointer transition-all"
                    style={{ background: aktiveFirmaId === f.id ? 'rgba(14,165,233,0.08)' : 'transparent', color: aktiveFirmaId === f.id ? ACCENT : isDark ? '#CBD5E1' : '#334155' }}>
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-[9px] font-bold text-white"
                      style={{ background: `linear-gradient(135deg, #0284C7, ${ACCENT})` }}>
                      {f.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="flex-1 truncate">{f.name}</span>
                    {aktiveFirmaId === f.id && <i className="ri-check-line text-xs" style={{ color: ACCENT }} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Arama */}
        <div className="relative hidden md:flex items-center flex-shrink-0" ref={searchRef}>
          <i className="ri-search-line absolute left-2.5 text-[11px] z-10" style={{ color: '#475569' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} onFocus={() => setSearchFocus(true)}
            placeholder="Ara..." className="w-36 pl-7 pr-2.5 py-1.5 text-[11.5px] rounded-lg outline-none transition-all duration-200"
            style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: isDark ? '#e5e7eb' : '#334155' }}
            onFocus={e => {
              setSearchFocus(true);
              e.currentTarget.style.borderColor = ACCENT;
              e.currentTarget.style.boxShadow = `0 0 0 2px rgba(14,165,233,0.2)`;
              e.currentTarget.style.width = '200px';
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = inputBorder;
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.width = '';
            }} />
          {showSearchDropdown && (
            <div className="absolute right-0 top-11 w-80 py-1 z-50 animate-slide-up"
              style={{ background: dropdownBg, border: `1px solid ${dropdownBorder}`, borderRadius: '14px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)' }}>
              {searchResults.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-sm mt-2" style={{ color: '#64748B' }}>Sonuç bulunamadı</p>
                </div>
              ) : (
                searchResults.map(result => (
                  <button key={result.id} onClick={() => { setActiveTab(result.tab); setSearch(''); setSearchFocus(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all duration-150 text-left"
                    onMouseEnter={e => { e.currentTarget.style.background = dropdownItemHover; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: `${result.color}18` }}>
                      <i className={`${result.icon} text-xs`} style={{ color: result.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${result.color}18`, color: result.color }}>{result.type}</span>
                      <p className="text-[12.5px] font-medium truncate mt-0.5" style={{ color: isDark ? '#E2E8F0' : '#0F172A' }}>{result.label}</p>
                      <p className="text-[11px] truncate" style={{ color: '#64748B' }}>{result.sub}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Yenile */}
        <button onClick={handleRefresh} disabled={refreshing || dataLoading} title="Verileri Yenile"
          className="w-8 h-8 hidden md:flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200 flex-shrink-0 disabled:opacity-50"
          style={{ background: refreshDone ? 'rgba(52,211,153,0.12)' : iconBtnBg, border: `1px solid ${refreshDone ? 'rgba(52,211,153,0.3)' : iconBtnBorder}` }}>
          <i className={`${refreshing ? 'ri-loader-4-line animate-spin' : refreshDone ? 'ri-check-line' : 'ri-refresh-line'} text-sm`}
            style={{ color: refreshDone ? '#34D399' : refreshing ? '#60A5FA' : textMuted }} />
        </button>

        {/* Tema Toggle */}
        <button onClick={toggleTheme} title={isDark ? 'Açık Tema' : 'Koyu Tema'}
          className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200 flex-shrink-0"
          style={{ background: iconBtnBg, border: `1px solid ${iconBtnBorder}` }}>
          <i className={`${isDark ? 'ri-sun-line' : 'ri-moon-line'} text-sm`} style={{ color: isDark ? '#F59E0B' : '#475569' }} />
        </button>

        {/* Hızlı Ekle */}
        <button onClick={() => { setQuickOpen(true); setNotifOpen(false); setProfileOpen(false); }}
          className="whitespace-nowrap flex-shrink-0 flex items-center gap-1.5 cursor-pointer font-semibold transition-all duration-150"
          style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '10px', background: `linear-gradient(135deg, ${ACCENT}, #0284C7)`, color: '#ffffff', border: 'none', boxShadow: `0 2px 10px rgba(14,165,233,0.35)` }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(14,165,233,0.5)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 10px rgba(14,165,233,0.35)'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}>
          <i className="ri-add-line text-sm" />
          <span className="hidden lg:inline">Hızlı Ekle</span>
        </button>

        {/* Destek Bildirimleri */}
        <div className="relative flex-shrink-0 hidden sm:block" ref={supportNotifRef}>
          <button onClick={() => { setSupportNotifOpen(v => !v); setNotifOpen(false); setProfileOpen(false); setQuickOpen(false); fetchSupportNotifs(); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200 relative"
            style={{ background: iconBtnBg, border: `1px solid ${iconBtnBorder}` }}>
            <i className="ri-message-3-line text-sm" style={{ color: textMuted }} />
            {unreadSupportCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] flex items-center justify-center text-[9px] font-bold text-white rounded-full px-1"
                style={{ background: 'linear-gradient(135deg, #10B981, #059669)', boxShadow: '0 0 6px rgba(16,185,129,0.5)' }}>
                {unreadSupportCount > 9 ? '9+' : unreadSupportCount}
              </span>
            )}
          </button>
          {supportNotifOpen && (
            <div className="absolute right-0 top-11 z-50 w-[300px] animate-slide-up overflow-hidden"
              style={{ background: dropdownBg, border: `1px solid ${dropdownBorder}`, borderRadius: '16px', boxShadow: '0 25px 60px rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)' }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${dropdownBorder}` }}>
                <p className="text-[13px] font-bold" style={{ color: nameColor }}>Destek Yanıtları</p>
                {unreadSupportCount > 0 && (
                  <button onClick={async () => {
                    setSupportNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
                    const ids = supportNotifs.filter(n => !n.is_read).map(n => n.id);
                    if (ids.length > 0) await supabase.from('notifications').update({ is_read: true }).in('id', ids);
                  }} className="text-[11px] cursor-pointer font-semibold px-2 py-1 rounded-lg" style={{ color: '#10B981', background: 'rgba(16,185,129,0.08)' }}>
                    Tümünü oku
                  </button>
                )}
              </div>
              {supportNotifs.length === 0 ? (
                <div className="py-8 text-center"><p className="text-[12px]" style={{ color: '#64748B' }}>Yeni bildirim yok</p></div>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  {supportNotifs.map((n, idx) => (
                    <div key={n.id} onClick={() => { markSupportRead(n.id); setSupportNotifOpen(false); if (n.ticket_id) { setSupportViewTicketId(n.ticket_id); setSupportOpen(true); } }}
                      className="px-4 py-3 cursor-pointer transition-all"
                      style={{ borderBottom: idx < supportNotifs.length - 1 ? `1px solid ${dropdownBorder}` : 'none', opacity: n.is_read ? 0.5 : 1 }}
                      onMouseEnter={e => { e.currentTarget.style.background = dropdownItemHover; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                      <p className="text-[12px] font-semibold" style={{ color: isDark ? '#E2E8F0' : '#0F172A' }}>{n.title}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: '#64748B' }}>{n.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bildirimler */}
        <div className="relative flex-shrink-0" ref={notifRef}>
          <button onClick={() => { setNotifOpen(v => !v); setQuickOpen(false); setProfileOpen(false); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200 relative"
            style={{ background: notifOpen ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)') : iconBtnBg, border: `1px solid ${iconBtnBorder}` }}>
            <i className="ri-notification-3-line text-sm" style={{ color: textMuted }} />
            {okunmamisBildirimSayisi > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] flex items-center justify-center text-[9px] font-bold text-white rounded-full px-1"
                style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)', boxShadow: '0 0 6px rgba(239,68,68,0.5)' }}>
                {okunmamisBildirimSayisi > 9 ? '9+' : okunmamisBildirimSayisi}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-11 z-50 w-[320px] animate-slide-up overflow-hidden"
              style={{ background: dropdownBg, border: `1px solid ${dropdownBorder}`, borderRadius: '16px', boxShadow: isDark ? '0 25px 60px rgba(0,0,0,0.6)' : '0 20px 50px rgba(15,23,42,0.15)', backdropFilter: 'blur(20px)' }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${dropdownBorder}` }}>
                <p className="text-[13px] font-bold" style={{ color: nameColor }}>Bildirimler</p>
                {okunmamisBildirimSayisi > 0 && (
                  <button onClick={tumunuOku} className="text-[11px] cursor-pointer font-semibold px-2.5 py-1 rounded-lg transition-all"
                    style={{ color: '#60A5FA', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
                    Tümünü oku
                  </button>
                )}
              </div>
              {displayBildirimler.length === 0 ? (
                <div className="py-8 px-4 text-center">
                  <i className="ri-check-double-line text-xl" style={{ color: '#10B981' }} />
                  <p className="text-[13px] font-semibold mt-2" style={{ color: isDark ? '#E2E8F0' : '#334155' }}>Her şey yolunda</p>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  {displayBildirimler.map((b, idx) => {
                    const cfg = TYPE_CONFIG[b.tip] ?? { icon: 'ri-notification-3-line', color: '#64748B', bg: 'rgba(100,116,139,0.12)', badge: 'Bildirim', badgeBg: 'rgba(100,116,139,0.12)' };
                    return (
                      <div key={b.id} className="px-4 py-3 cursor-pointer transition-all"
                        style={{ borderBottom: idx < displayBildirimler.length - 1 ? `1px solid ${dropdownBorder}` : 'none' }}
                        onClick={() => { bildirimOku(b.id); setNotifOpen(false); }}
                        onMouseEnter={e => { e.currentTarget.style.background = dropdownItemHover; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0 mt-0.5" style={{ background: cfg.bg }}>
                            <i className={cfg.icon} style={{ color: cfg.color, fontSize: '13px' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold truncate" style={{ color: isDark ? '#E2E8F0' : '#0F172A' }}>{b.mesaj}</p>
                            <p className="text-[11px] mt-0.5" style={{ color: '#64748B' }}>{b.detay}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Profil */}
        <div className="relative flex-shrink-0" ref={profileRef}>
          <button onClick={() => { setProfileOpen(v => !v); setNotifOpen(false); setQuickOpen(false); }}
            className="flex items-center gap-1.5 cursor-pointer transition-all duration-200 rounded-lg py-1 px-1.5"
            style={{ background: profileOpen ? (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.06)') : 'transparent', border: `1px solid ${profileOpen ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.12)') : 'transparent'}` }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${ACCENT}, #0284C7)`, boxShadow: `0 2px 8px rgba(14,165,233,0.3)` }}>
              {(currentUser.ad || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="hidden lg:block text-left">
              <p className="text-[11px] font-semibold leading-tight" style={{ color: nameColor }}>{currentUser.ad || 'Uzman'}</p>
            </div>
            <i className={`ri-arrow-down-s-line text-xs hidden md:block transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} style={{ color: '#475569' }} />
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-12 z-50 w-52 animate-slide-up overflow-hidden"
              style={{ background: dropdownBg, border: `1px solid ${dropdownBorder}`, borderRadius: '16px', boxShadow: isDark ? '0 25px 60px rgba(0,0,0,0.55)' : '0 20px 50px rgba(15,23,42,0.15)', backdropFilter: 'blur(20px)' }}>
              <div className="px-4 py-3.5" style={{ borderBottom: `1px solid ${dropdownBorder}` }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${ACCENT}, #0284C7)` }}>
                    {(currentUser.ad || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold truncate" style={{ color: isDark ? '#E2E8F0' : '#0F172A' }}>{currentUser.ad || 'Gezici Uzman'}</p>
                    <p className="text-[10.5px] truncate mt-0.5" style={{ color: '#64748B' }}>{user?.email || currentUser.email}</p>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded mt-1 inline-block" style={{ background: 'rgba(14,165,233,0.12)', color: ACCENT }}>
                      GEZİCİ UZMAN
                    </span>
                  </div>
                </div>
              </div>
              <div className="py-1.5">
                <button onClick={() => { setSupportOpen(true); setProfileOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-all duration-150"
                  onMouseEnter={e => { e.currentTarget.style.background = dropdownItemHover; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                  <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(16,185,129,0.1)' }}>
                    <i className="ri-customer-service-2-line text-xs" style={{ color: '#10B981' }} />
                  </div>
                  <span className="text-[12.5px] font-medium" style={{ color: isDark ? '#CBD5E1' : '#334155' }}>Destek / Sorun Bildir</span>
                </button>
                <div className="mx-3 my-1.5" style={{ height: '1px', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.07)' }} />
                <button onClick={() => { setProfileOpen(false); logout(); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-all duration-150"
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
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

      <SupportModal open={supportOpen} onClose={() => { setSupportOpen(false); setSupportViewTicketId(null); }} viewTicketId={supportViewTicketId} />

      {/* Hızlı Ekle Modal */}
      {quickOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
          onClick={e => { if (e.target === e.currentTarget) setQuickOpen(false); }}>
          <div className="w-full max-w-[580px] animate-slide-up overflow-hidden"
            style={{ background: isDark ? 'var(--bg-card-solid)' : '#FFFFFF', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.1)'}`, borderRadius: '24px', boxShadow: isDark ? '0 40px 100px rgba(0,0,0,0.8)' : '0 30px 80px rgba(15,23,42,0.2)' }}>
            <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${ACCENT}, #14B8A6, #F59E0B, #A78BFA, #FB923C)` }} />
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.07)'}` }}>
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 flex items-center justify-center rounded-2xl flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${ACCENT}, #0284C7)`, boxShadow: `0 6px 20px rgba(14,165,233,0.4)` }}>
                  <i className="ri-add-circle-line text-white text-lg" />
                </div>
                <div>
                  <h2 className="text-[16px] font-black tracking-tight" style={{ color: nameColor, letterSpacing: '-0.03em' }}>Hızlı Ekle</h2>
                  <p className="text-[11.5px] mt-0.5" style={{ color: isDark ? '#475569' : '#94A3B8' }}>Hangi kaydı oluşturmak istiyorsunuz?</p>
                </div>
              </div>
              <button onClick={() => setQuickOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer transition-all duration-200"
                style={{ color: isDark ? '#475569' : '#94A3B8', background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)'}` }}
                onMouseEnter={e => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = isDark ? '#475569' : '#94A3B8'; e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)'; }}>
                <i className="ri-close-line text-sm" />
              </button>
            </div>
            {/* Primary Cards */}
            <div className="px-6 pt-5 pb-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] mb-3.5" style={{ color: isDark ? '#334155' : '#CBD5E1' }}>Temel İşlemler</p>
              <div className="grid grid-cols-2 gap-3">
                {uzmanQuickCards.filter(c => c.primary).map(card => (
                  <button key={card.id} onClick={() => handleQuickCard(card)}
                    className="relative flex items-center gap-4 px-5 py-4 rounded-2xl text-left cursor-pointer transition-all duration-200 overflow-hidden"
                    style={{ background: isDark ? `${card.accent}15` : `${card.accent}0e`, border: `1px solid ${card.accent}28` }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 14px 36px ${card.accent}28`; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${card.accent}, ${card.accent}cc)`, boxShadow: `0 6px 18px ${card.accent}40` }}>
                      <i className={`${card.icon} text-white text-[18px]`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-bold leading-tight" style={{ color: nameColor }}>{card.label}</p>
                      <p className="text-[11.5px] mt-1" style={{ color: isDark ? '#64748B' : '#94A3B8' }}>{card.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            {/* Secondary Grid */}
            <div className="px-6 pb-5" style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)'}` }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] mt-4 mb-3.5" style={{ color: isDark ? '#334155' : '#CBD5E1' }}>Diğer İşlemler</p>
              <div className="grid grid-cols-4 gap-2">
                {uzmanQuickCards.filter(c => !c.primary).map(card => (
                  <button key={card.id} onClick={() => handleQuickCard(card)}
                    className="flex flex-col items-center gap-2 py-3.5 px-2 rounded-2xl text-center cursor-pointer transition-all duration-200"
                    style={{ background: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(15,23,42,0.025)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.055)' : 'rgba(15,23,42,0.065)'}` }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.background = isDark ? `${card.accent}14` : `${card.accent}0c`;
                      e.currentTarget.style.borderColor = `${card.accent}38`;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(15,23,42,0.025)';
                      e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.055)' : 'rgba(15,23,42,0.065)';
                    }}>
                    <div className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ background: isDark ? `${card.accent}18` : `${card.accent}12` }}>
                      <i className={`${card.icon} text-[15px]`} style={{ color: card.accent }} />
                    </div>
                    <p className="text-[11px] font-semibold leading-tight" style={{ color: isDark ? '#64748B' : '#94A3B8' }}>{card.label}</p>
                  </button>
                ))}
              </div>
            </div>
            {/* Footer */}
            <div className="px-6 py-3.5 flex items-center justify-between" style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)'}` }}>
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono"
                  style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)'}`, color: isDark ? '#475569' : '#94A3B8' }}>ESC</span>
                <span className="text-[11px]" style={{ color: isDark ? '#334155' : '#CBD5E1' }}>ile kapat</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10.5px]" style={{ color: isDark ? '#334155' : '#CBD5E1' }}>
                <i className="ri-map-pin-user-line text-[11px]" style={{ color: ACCENT }} />
                <span>Gezici Uzman Paneli</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
