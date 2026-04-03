import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';

const moduleTitles: Record<string, { label: string; icon: string }> = {
  dashboard:      { label: 'Kontrol Paneli',     icon: 'ri-dashboard-3-line' },
  firmalar:       { label: 'Firmalar',            icon: 'ri-building-2-line' },
  personeller:    { label: 'Personeller',         icon: 'ri-team-line' },
  evraklar:       { label: 'Evrak Takibi',        icon: 'ri-file-list-3-line' },
  egitimler:      { label: 'Eğitim Yönetimi',    icon: 'ri-graduation-cap-line' },
  muayeneler:     { label: 'Sağlık Evrakları',   icon: 'ri-heart-pulse-line' },
  tutanaklar:     { label: 'Tutanaklar',          icon: 'ri-article-line' },
  uygunsuzluklar: { label: 'Saha Denetim',       icon: 'ri-map-pin-user-line' },
  ekipmanlar:     { label: 'Ekipman Kontrolleri', icon: 'ri-tools-line' },
  gorevler:       { label: 'Görevler',            icon: 'ri-task-line' },
  raporlar:       { label: 'Raporlar & Analiz',  icon: 'ri-bar-chart-2-line' },
  ayarlar:        { label: 'Ayarlar',             icon: 'ri-settings-4-line' },
};

const quickCards = [
  { id: 'firma',       label: 'Firma Ekle',       desc: 'Yeni firma kaydı oluştur',    icon: 'ri-building-2-line',     accent: '#3B82F6', primary: true,  module: 'firmalar' },
  { id: 'personel',    label: 'Personel Ekle',    desc: 'Çalışan kaydı ekle',          icon: 'ri-user-add-line',       accent: '#10B981', primary: true,  module: 'personeller' },
  { id: 'evrak',       label: 'Evrak Ekle',       desc: 'Belge yükle',                 icon: 'ri-file-add-line',       accent: '#F59E0B', primary: false, module: 'evraklar' },
  { id: 'egitim',      label: 'Eğitim Ekle',      desc: 'Eğitim planı oluştur',        icon: 'ri-graduation-cap-line', accent: '#A78BFA', primary: false, module: 'egitimler' },
  { id: 'muayene',     label: 'Sağlık Evrakı',    desc: 'Sağlık belgesi ekle',         icon: 'ri-heart-pulse-line',    accent: '#F43F5E', primary: false, module: 'muayeneler' },
  { id: 'tutanak',     label: 'Tutanak Ekle',      desc: 'Tutanak oluştur',             icon: 'ri-article-line',        accent: '#14B8A6', primary: false, module: 'tutanaklar' },
  { id: 'sahadenetim', label: 'Saha Denetim',      desc: 'Denetim kaydı aç',            icon: 'ri-map-pin-user-line',   accent: '#FB923C', primary: false, module: 'uygunsuzluklar' },
  { id: 'ekipman',     label: 'Ekipman Kontrolü', desc: 'Kontrol kaydı oluştur',       icon: 'ri-tools-line',          accent: '#34D399', primary: false, module: 'ekipmanlar' },
  { id: 'gorev',       label: 'Görev Ekle',        desc: 'Yeni görev tanımla',          icon: 'ri-task-line',           accent: '#C084FC', primary: false, module: 'gorevler' },
];

interface SearchResult {
  id: string;
  type: string;
  label: string;
  sub: string;
  icon: string;
  color: string;
  module: string;
}

export default function Header({ onMobileMenuToggle }: { onMobileMenuToggle?: () => void }) {
  const {
    activeModule, setActiveModule, sidebarCollapsed, setSidebarCollapsed,
    currentUser, setQuickCreate, theme, toggleTheme,
    bildirimler, okunmamisBildirimSayisi, bildirimOku, tumunuOku,
    firmalar, personeller, evraklar, tutanaklar,
  } = useApp();
  const { logout, user } = useAuth();

  const [quickOpen, setQuickOpen]     = useState(false);
  const [notifOpen, setNotifOpen]     = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [search, setSearch]           = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const searchRef  = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef   = useRef<HTMLDivElement>(null);

  const isDark = theme === 'dark';

  // ── Status badge — bildirim sayısına göre sistem durumu ──
  const statusInfo = (() => {
    const total = okunmamisBildirimSayisi;
    if (total === 0) return { text: 'Sistem sağlıklı', color: '#34D399', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)', icon: 'ri-checkbox-circle-line' };
    if (total <= 3)  return { text: `${total} yaklaşan işlem`, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)', icon: 'ri-timer-line' };
    return { text: `${total} uyarı var`, color: '#F87171', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)', icon: 'ri-alarm-warning-line' };
  })();

  const runSearch = useCallback((q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    const query = q.toLowerCase();
    const results: SearchResult[] = [];
    firmalar.filter(f => f.ad.toLowerCase().includes(query) || f.yetkiliKisi.toLowerCase().includes(query)).slice(0, 3).forEach(f =>
      results.push({ id: f.id, type: 'Firma', label: f.ad, sub: f.yetkiliKisi || f.tehlikeSinifi, icon: 'ri-building-2-line', color: '#3B82F6', module: 'firmalar' })
    );
    personeller.filter(p => p.adSoyad.toLowerCase().includes(query) || p.gorev.toLowerCase().includes(query)).slice(0, 3).forEach(p => {
      const firma = firmalar.find(f => f.id === p.firmaId);
      results.push({ id: p.id, type: 'Personel', label: p.adSoyad, sub: `${p.gorev || '—'} · ${firma?.ad || '—'}`, icon: 'ri-user-line', color: '#10B981', module: 'personeller' });
    });
    evraklar.filter(e => e.ad.toLowerCase().includes(query) || e.tur.toLowerCase().includes(query)).slice(0, 2).forEach(e => {
      const firma = firmalar.find(f => f.id === e.firmaId);
      results.push({ id: e.id, type: 'Evrak', label: e.ad, sub: `${e.tur} · ${firma?.ad || '—'}`, icon: 'ri-file-text-line', color: '#F59E0B', module: 'evraklar' });
    });
    tutanaklar.filter(t => t.baslik.toLowerCase().includes(query) || t.tutanakNo.toLowerCase().includes(query)).slice(0, 2).forEach(t => {
      const firma = firmalar.find(f => f.id === t.firmaId);
      results.push({ id: t.id, type: 'Tutanak', label: t.baslik, sub: `${t.tutanakNo} · ${firma?.ad || '—'}`, icon: 'ri-article-line', color: '#14B8A6', module: 'tutanaklar' });
    });
    setSearchResults(results.slice(0, 8));
  }, [firmalar, personeller, evraklar, tutanaklar]);

  useEffect(() => { runSearch(search); }, [search, runSearch]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current  && !searchRef.current.contains(e.target as Node))  setSearchFocus(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (notifRef.current   && !notifRef.current.contains(e.target as Node))   setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (quickOpen)   { e.stopPropagation(); setQuickOpen(false); }
      else if (notifOpen)   { e.stopPropagation(); setNotifOpen(false); }
      else if (profileOpen) { e.stopPropagation(); setProfileOpen(false); }
      else if (searchFocus) { e.stopPropagation(); setSearch(''); setSearchFocus(false); }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [quickOpen, notifOpen, profileOpen, searchFocus]);

  const handleQuickCard = (card: typeof quickCards[0]) => {
    setQuickOpen(false);
    setActiveModule(card.module);
    setQuickCreate(card.module);
  };

  const currentModule = moduleTitles[activeModule];
  const showSearchDropdown = searchFocus && (searchResults.length > 0 || search.trim().length > 0);

  // ── Theme tokens ──
  const headerBg     = isDark ? 'rgba(6,10,18,0.96)'    : 'rgba(255,255,255,0.98)';
  const headerBorder = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.08)';
  const textMuted    = isDark ? '#475569'                : '#64748B';
  const inputBg      = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.04)';
  const inputBorder  = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.1)';
  const iconBtnBg    = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)';
  const iconBtnBorder= isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.1)';
  const nameColor    = isDark ? '#E2E8F0'                : '#0F172A';
  const dropdownBg   = isDark ? 'rgba(8,12,20,0.99)'    : 'rgba(255,255,255,0.99)';
  const dropdownBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.1)';
  const dropdownItemHover = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)';

  const displayBildirimler = bildirimler.slice(0, 10);

  const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string; badge: string; badgeBg: string }> = {
    evrak_surecek:           { icon: 'ri-file-warning-line',      color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', badge: 'Evrak',          badgeBg: 'rgba(148,163,184,0.12)' },
    evrak_dolmus:            { icon: 'ri-file-damage-line',        color: '#F87171', bg: 'rgba(248,113,113,0.12)', badge: 'Evrak',          badgeBg: 'rgba(248,113,113,0.12)' },
    ekipman_kontrol:         { icon: 'ri-tools-line',              color: '#FB923C', bg: 'rgba(251,146,60,0.12)',  badge: 'Ekipman',        badgeBg: 'rgba(251,146,60,0.12)' },
    egitim_surecek:          { icon: 'ri-graduation-cap-line',     color: '#60A5FA', bg: 'rgba(96,165,250,0.12)',  badge: 'Eğitim',         badgeBg: 'rgba(96,165,250,0.12)' },
    saglik_surecek:          { icon: 'ri-heart-pulse-line',        color: '#34D399', bg: 'rgba(52,211,153,0.12)',  badge: 'Sağlık',         badgeBg: 'rgba(52,211,153,0.12)' },
    kontrol_formu_yaklasan:  { icon: 'ri-folder-shield-2-line',   color: '#A78BFA', bg: 'rgba(167,139,250,0.12)', badge: 'Kontrol Formu',  badgeBg: 'rgba(167,139,250,0.12)' },
    kontrol_formu_gecikti:   { icon: 'ri-alarm-warning-line',      color: '#F87171', bg: 'rgba(248,113,113,0.12)', badge: 'Kontrol Formu',  badgeBg: 'rgba(248,113,113,0.12)' },
  };

  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar';
  const firstName = (currentUser.ad || '').split(' ')[0] || 'Kullanıcı';

  return (
    <>
      {/* ══════════════════════════════════════════════════════
          HEADER
      ══════════════════════════════════════════════════════ */}
      <header
        className={`fixed top-0 right-0 z-30 h-16 flex items-center px-4 gap-2.5 left-0 ${sidebarCollapsed ? 'lg:left-[68px]' : 'lg:left-[252px]'}`}
        style={{
          background: headerBg,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: `1px solid ${headerBorder}`,
          transition: 'left 0.28s cubic-bezier(0.4,0,0.2,1), background 0.3s ease',
        }}
      >
        {/* Mobile hamburger */}
        <button
          onClick={onMobileMenuToggle}
          className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200 lg:hidden flex-shrink-0"
          style={{ color: textMuted, background: iconBtnBg, border: `1px solid ${iconBtnBorder}` }}
        >
          <i className="ri-menu-line text-sm" />
        </button>

        {/* Desktop sidebar toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="w-8 h-8 items-center justify-center rounded-lg cursor-pointer transition-all duration-200 hidden lg:flex flex-shrink-0"
          style={{ color: textMuted, background: iconBtnBg, border: `1px solid ${iconBtnBorder}` }}
          onMouseEnter={e => { e.currentTarget.style.color = isDark ? '#94A3B8' : '#334155'; }}
          onMouseLeave={e => { e.currentTarget.style.color = textMuted; }}
        >
          <i className={`${sidebarCollapsed ? 'ri-menu-unfold-line' : 'ri-menu-fold-line'} text-sm`} />
        </button>

        {/* Breadcrumb */}
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          <div className="w-5 h-5 flex items-center justify-center">
            <i className={`${currentModule?.icon || 'ri-home-line'} text-xs`} style={{ color: '#3B82F6' }} />
          </div>
          <div className="flex items-center gap-1 text-[12.5px]">
            <span style={{ color: isDark ? '#334155' : '#94A3B8' }}>ISG</span>
            <i className="ri-arrow-right-s-line text-xs" style={{ color: isDark ? '#334155' : '#94A3B8' }} />
            <span className="font-semibold" style={{ color: nameColor }}>{currentModule?.label || activeModule}</span>
          </div>
        </div>

        <div className="flex-1" />

        {/* Greeting */}
        <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
          <p className="text-[12px] font-semibold leading-tight" style={{ color: nameColor }}>
            {greeting}, <span style={{ color: '#60A5FA' }}>{firstName}</span>
          </p>
        </div>

        {/* Status badge */}
        <div
          className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-semibold flex-shrink-0"
          style={{ background: statusInfo.bg, border: `1px solid ${statusInfo.border}`, color: statusInfo.color }}
        >
          <i className={`${statusInfo.icon} text-[10px]`} />
          {statusInfo.text}
        </div>

        <div className="hidden lg:block w-px h-4 flex-shrink-0" style={{ background: headerBorder }} />

        {/* Global Search */}
        <div className="relative hidden md:flex items-center flex-shrink-0" ref={searchRef}>
          <i className="ri-search-line absolute left-3 text-xs z-10" style={{ color: '#475569' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => setSearchFocus(true)}
            placeholder="Ara..."
            className={`w-44 pl-8 pr-3 py-1.5 text-[12.5px] rounded-lg outline-none transition-all duration-200 ${isDark ? 'search-dark' : 'search-light'}`}
            style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: isDark ? '#e5e7eb' : '#334155' }}
            onFocus={e => {
              setSearchFocus(true);
              e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(59,130,246,0.04)';
              e.currentTarget.style.borderColor = '#3b82f6';
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.2)';
              e.currentTarget.style.width = '210px';
            }}
            onBlur={e => {
              e.currentTarget.style.background = inputBg;
              e.currentTarget.style.borderColor = inputBorder;
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.width = '';
            }}
          />
          {showSearchDropdown && (
            <div
              className="absolute right-0 top-10 w-80 py-1 z-50 animate-slide-up"
              style={{ background: dropdownBg, border: `1px solid ${dropdownBorder}`, borderRadius: '14px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)' }}
            >
              {searchResults.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <i className="ri-search-line text-2xl" style={{ color: '#475569' }} />
                  <p className="text-sm mt-2" style={{ color: '#64748B' }}>Sonuç bulunamadı</p>
                </div>
              ) : (
                <>
                  <div className="px-3 py-2" style={{ borderBottom: `1px solid ${dropdownBorder}` }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#475569' }}>{searchResults.length} sonuç</p>
                  </div>
                  {searchResults.map(result => (
                    <button
                      key={result.id}
                      onClick={() => { setActiveModule(result.module); setSearch(''); setSearchFocus(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all duration-150 text-left"
                      onMouseEnter={e => { e.currentTarget.style.background = dropdownItemHover; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: `${result.color}18` }}>
                        <i className={`${result.icon} text-xs`} style={{ color: result.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${result.color}18`, color: result.color }}>{result.type}</span>
                        </div>
                        <p className="text-[12.5px] font-medium truncate" style={{ color: isDark ? '#E2E8F0' : '#0F172A' }}>{result.label}</p>
                        <p className="text-[11px] truncate" style={{ color: '#64748B' }}>{result.sub}</p>
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200 flex-shrink-0"
          title={isDark ? 'Açık Tema' : 'Koyu Tema'}
          style={{ background: iconBtnBg, border: `1px solid ${iconBtnBorder}` }}
          onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = iconBtnBg; }}
        >
          <i className={`${isDark ? 'ri-sun-line' : 'ri-moon-line'} text-sm`} style={{ color: isDark ? '#F59E0B' : '#475569' }} />
        </button>

        {/* Quick Add */}
        <button
          onClick={() => { setQuickOpen(true); setNotifOpen(false); setProfileOpen(false); }}
          className="btn-primary flex-shrink-0"
          style={{ padding: '7px 14px', fontSize: '12.5px', borderRadius: '8px' }}
        >
          <i className="ri-add-line text-sm" />
          <span className="hidden sm:inline">Hızlı Ekle</span>
        </button>

        {/* ── Notifications ── */}
        <div className="relative flex-shrink-0" ref={notifRef}>
          <button
            onClick={() => { setNotifOpen(v => !v); setQuickOpen(false); setProfileOpen(false); }}
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
              className="absolute right-0 top-11 z-50 w-[340px] animate-slide-up overflow-hidden"
              style={{ background: dropdownBg, border: `1px solid ${dropdownBorder}`, borderRadius: '16px', boxShadow: isDark ? '0 25px 60px rgba(0,0,0,0.6)' : '0 20px 50px rgba(15,23,42,0.15)', backdropFilter: 'blur(20px)' }}
            >
              {/* Header */}
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${dropdownBorder}` }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(59,130,246,0.1)' }}>
                    <i className="ri-notification-3-line text-xs" style={{ color: '#60A5FA' }} />
                  </div>
                  <p className="text-[13px] font-bold" style={{ color: nameColor }}>Bildirimler</p>
                  {okunmamisBildirimSayisi > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.12)', color: '#F87171', border: '1px solid rgba(239,68,68,0.15)' }}>
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
                    {(['evrak_surecek','evrak_dolmus','ekipman_kontrol','egitim_surecek','saglik_surecek','kontrol_formu_yaklasan','kontrol_formu_gecikti'] as const).map(tip => {
                      const count = bildirimler.filter(b => b.tip === tip).length;
                      if (count === 0) return null;
                      const cfg = TYPE_CONFIG[tip];
                      return (
                        <span key={tip} className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: cfg.badgeBg, color: cfg.color, border: `1px solid ${cfg.color}25` }}>
                          <i className={`${cfg.icon} text-[9px]`} />
                          {cfg.badge} ({count})
                        </span>
                      );
                    })}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {displayBildirimler.map((b, idx) => {
                      const cfg = TYPE_CONFIG[b.tip] ?? TYPE_CONFIG['evrak_surecek'];
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
                          onClick={() => bildirimOku(b.id)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0 mt-0.5" style={{ background: cfg.bg }}>
                              <i className={cfg.icon} style={{ color: cfg.color, fontSize: '13px' }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                                  style={{ background: cfg.badgeBg, color: cfg.color }}>{cfg.badge}</span>
                                <p className="text-[12px] font-semibold truncate flex-1" style={{ color: isDark ? '#E2E8F0' : '#0F172A' }}>{b.mesaj}</p>
                                {!b.okundu && (
                                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#3B82F6' }} />
                                )}
                              </div>
                              <p className="text-[11px] leading-relaxed" style={{ color: '#64748B' }}>{b.detay}</p>
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
                    {bildirimler.length > 10 ? `${bildirimler.length - 10} daha var` : `${bildirimler.length} toplam uyarı`}
                  </p>
                  <button
                    onClick={() => { setActiveModule('dashboard'); setNotifOpen(false); }}
                    className="text-[11.5px] font-semibold cursor-pointer transition-all flex items-center gap-1.5"
                    style={{ color: '#60A5FA' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#93C5FD'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#60A5FA'; }}
                  >
                    Panele Git
                    <i className="ri-arrow-right-line text-[11px]" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Profile ── */}
        <div className="relative flex-shrink-0" ref={profileRef}>
          <button
            onClick={() => { setProfileOpen(v => !v); setNotifOpen(false); setQuickOpen(false); }}
            className="flex items-center gap-2 cursor-pointer transition-all duration-200 rounded-xl py-1.5 px-2"
            style={{
              background: profileOpen ? (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.06)') : 'transparent',
              border: `1px solid ${profileOpen ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.12)') : 'transparent'}`,
            }}
            onMouseEnter={e => { if (!profileOpen) { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)'; e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'; } }}
            onMouseLeave={e => { if (!profileOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; } }}
          >
            {/* Avatar */}
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
            >
              {(currentUser.ad || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-[12px] font-semibold leading-tight" style={{ color: nameColor }}>{currentUser.ad || 'Kullanıcı'}</p>
            </div>
            <i
              className={`ri-arrow-down-s-line text-xs hidden md:block transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`}
              style={{ color: '#475569' }}
            />
          </button>

          {profileOpen && (
            <div
              className="absolute right-0 top-12 z-50 w-56 animate-slide-up overflow-hidden"
              style={{ background: dropdownBg, border: `1px solid ${dropdownBorder}`, borderRadius: '16px', boxShadow: isDark ? '0 25px 60px rgba(0,0,0,0.55)' : '0 20px 50px rgba(15,23,42,0.15)', backdropFilter: 'blur(20px)' }}
            >
              {/* Profile header */}
              <div className="px-4 py-3.5" style={{ borderBottom: `1px solid ${dropdownBorder}` }}>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}
                  >
                    {(currentUser.ad || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold truncate" style={{ color: isDark ? '#E2E8F0' : '#0F172A' }}>{currentUser.ad || 'Kullanıcı'}</p>
                    <p className="text-[10.5px] truncate mt-0.5" style={{ color: '#64748B' }}>{user?.email || currentUser.email}</p>
                  </div>
                </div>
              </div>

              {/* Menu items */}
              <div className="py-1.5">
                <button
                  onClick={() => { setActiveModule('ayarlar'); setProfileOpen(false); }}
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
                  onClick={() => { setActiveModule('raporlar'); setProfileOpen(false); }}
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

      {/* ══════════════════════════════════════════════════════
          QUICK ADD MODAL
      ══════════════════════════════════════════════════════ */}
      {quickOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
          onClick={e => { if (e.target === e.currentTarget) setQuickOpen(false); }}
        >
          <div
            className="w-full max-w-[580px] animate-slide-up"
            style={{
              background: isDark ? '#0C1120' : '#FAFAFA',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.09)'}`,
              borderRadius: '20px',
              boxShadow: isDark ? '0 40px 80px rgba(0,0,0,0.7)' : '0 30px 70px rgba(15,23,42,0.18)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-5"
              style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.07)'}` }}
            >
              <div>
                <h2 className="text-[16px] font-bold tracking-tight" style={{ color: nameColor }}>Hızlı Ekle</h2>
                <p className="text-[12px] mt-0.5" style={{ color: isDark ? '#475569' : '#94A3B8' }}>
                  Hangi kaydı oluşturmak istiyorsunuz?
                </p>
              </div>
              <button
                onClick={() => setQuickOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200"
                style={{ color: isDark ? '#475569' : '#94A3B8', background: 'transparent', border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)'}` }}
                onMouseEnter={e => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = isDark ? '#475569' : '#94A3B8'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)'; }}
              >
                <i className="ri-close-line text-sm" />
              </button>
            </div>

            {/* Primary Cards */}
            <div className="px-5 pt-5 pb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: isDark ? '#334155' : '#CBD5E1' }}>
                Temel İşlemler
              </p>
              <div className="grid grid-cols-2 gap-3">
                {quickCards.filter(c => c.primary).map(card => (
                  <button
                    key={card.id}
                    onClick={() => handleQuickCard(card)}
                    className="flex items-center gap-4 px-4 py-4 rounded-2xl text-left cursor-pointer transition-all duration-200"
                    style={{
                      background: isDark
                        ? `linear-gradient(135deg, ${card.accent}18, ${card.accent}0a)`
                        : `linear-gradient(135deg, ${card.accent}10, ${card.accent}06)`,
                      border: `1px solid ${card.accent}30`,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-3px)';
                      e.currentTarget.style.boxShadow = `0 12px 32px ${card.accent}22`;
                      e.currentTarget.style.borderColor = `${card.accent}55`;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.borderColor = `${card.accent}30`;
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${card.accent}20`, border: `1px solid ${card.accent}35` }}
                    >
                      <i className={`${card.icon} text-base`} style={{ color: card.accent }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-bold leading-tight" style={{ color: nameColor }}>{card.label}</p>
                      <p className="text-[11px] mt-0.5 truncate" style={{ color: isDark ? '#475569' : '#94A3B8' }}>{card.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="px-5 pb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: isDark ? '#334155' : '#CBD5E1' }}>
                Diğer İşlemler
              </p>
              {/* Secondary Cards */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {quickCards.filter(c => !c.primary).map(card => (
                  <button
                    key={card.id}
                    onClick={() => handleQuickCard(card)}
                    className="flex flex-col items-center gap-2.5 px-3 py-3.5 rounded-xl text-center cursor-pointer transition-all duration-200"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.07)'}`,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.background = isDark ? `${card.accent}12` : `${card.accent}0d`;
                      e.currentTarget.style.borderColor = `${card.accent}35`;
                      e.currentTarget.style.boxShadow = `0 8px 24px ${card.accent}18`;
                      const icon = e.currentTarget.querySelector('i');
                      if (icon) icon.style.color = card.accent;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)';
                      e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.07)';
                      e.currentTarget.style.boxShadow = 'none';
                      const icon = e.currentTarget.querySelector('i');
                      if (icon) icon.style.color = isDark ? '#475569' : '#94A3B8';
                    }}
                  >
                    <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
                      style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)' }}
                    >
                      <i className={`${card.icon} text-sm transition-colors duration-200`} style={{ color: isDark ? '#475569' : '#94A3B8' }} />
                    </div>
                    <p className="text-[11.5px] font-semibold leading-tight" style={{ color: isDark ? '#94A3B8' : '#475569' }}>{card.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div
              className="px-5 py-3.5 flex items-center justify-between"
              style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)'}` }}
            >
              <p className="text-[11px]" style={{ color: isDark ? '#334155' : '#CBD5E1' }}>
                <i className="ri-keyboard-line mr-1.5" />
                ESC ile kapat
              </p>
              <button
                onClick={() => setQuickOpen(false)}
                className="text-[12px] font-semibold px-4 py-1.5 rounded-lg cursor-pointer transition-all duration-200"
                style={{
                  color: isDark ? '#475569' : '#94A3B8',
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)'}`,
                }}
                onMouseEnter={e => { e.currentTarget.style.color = isDark ? '#94A3B8' : '#475569'; }}
                onMouseLeave={e => { e.currentTarget.style.color = isDark ? '#475569' : '#94A3B8'; }}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
