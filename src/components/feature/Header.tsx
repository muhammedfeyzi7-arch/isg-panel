import { useState, useCallback, useMemo } from 'react';
import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import FirmaSwitcher from './FirmaSwitcher';
import SearchBox from '@/components/header/SearchBox';
import NotificationDropdown from '@/components/header/NotificationDropdown';
import SupportButton from '@/components/header/SupportButton';
import ProfileMenu from '@/components/header/ProfileMenu';

// ── Static config ──────────────────────────────────────────────────────────

const moduleTitles: Record<string, { label: string; icon: string }> = {
  dashboard:         { label: 'Genel Bakış',      icon: 'ri-dashboard-3-line' },
  firmalar:          { label: 'Firmalar',          icon: 'ri-building-2-line' },
  personeller:       { label: 'Personel',          icon: 'ri-team-line' },
  'firma-evraklari': { label: 'Firma Belgeleri',   icon: 'ri-building-4-line' },
  evraklar:          { label: 'Belge Takibi',      icon: 'ri-file-list-3-line' },
  egitimler:         { label: 'Eğitimler',         icon: 'ri-graduation-cap-line' },
  muayeneler:        { label: 'Sağlık Durumu',     icon: 'ri-heart-pulse-line' },
  tutanaklar:        { label: 'Tutanak Yönetimi',  icon: 'ri-article-line' },
  uygunsuzluklar:    { label: 'Saha Denetimleri',  icon: 'ri-map-pin-user-line' },
  ekipmanlar:        { label: 'Ekipman',           icon: 'ri-tools-line' },
  'is-izinleri':     { label: 'İş İzinleri',       icon: 'ri-shield-keyhole-line' },
  raporlar:          { label: 'Raporlar',          icon: 'ri-bar-chart-2-line' },
  ayarlar:           { label: 'Ayarlar',           icon: 'ri-settings-4-line' },
  copkutusu:         { label: 'Çöp Kutusu',        icon: 'ri-delete-bin-2-line' },
  saha:              { label: 'Saha Denetimleri',  icon: 'ri-map-pin-user-line' },
};

const quickCards = [
  { id: 'firma',       label: 'Firma Ekle',       desc: 'Yeni firma kaydı oluştur',    icon: 'ri-building-2-line',     accent: '#3B82F6', primary: true,  module: 'firmalar' },
  { id: 'personel',    label: 'Personel Ekle',    desc: 'Çalışan kaydı ekle',          icon: 'ri-user-add-line',       accent: '#10B981', primary: true,  module: 'personeller' },
  { id: 'evrak',       label: 'Evrak Ekle',       desc: 'Belge yükle',                 icon: 'ri-file-add-line',       accent: '#F59E0B', primary: false, module: 'evraklar' },
  { id: 'egitim',      label: 'Eğitim Ekle',      desc: 'Eğitim planı oluştur',        icon: 'ri-graduation-cap-line', accent: '#A78BFA', primary: false, module: 'egitimler' },
  { id: 'muayene',     label: 'Sağlık Durumu',    desc: 'Sağlık durumu ekle',          icon: 'ri-heart-pulse-line',    accent: '#F43F5E', primary: false, module: 'muayeneler' },
  { id: 'tutanak',     label: 'Tutanak Ekle',     desc: 'Tutanak oluştur',             icon: 'ri-article-line',        accent: '#14B8A6', primary: false, module: 'tutanaklar' },
  { id: 'sahadenetim', label: 'Saha Denetim',     desc: 'Denetim kaydı aç',            icon: 'ri-map-pin-user-line',   accent: '#FB923C', primary: false, module: 'uygunsuzluklar' },
  { id: 'ekipman',     label: 'Ekipman Kontrolü', desc: 'Kontrol kaydı oluştur',       icon: 'ri-tools-line',          accent: '#34D399', primary: false, module: 'ekipmanlar' },
  { id: 'isizni',      label: 'İş İzinleri',      desc: 'İş izni kaydı aç',            icon: 'ri-file-shield-2-line',  accent: '#38BDF8', primary: false, module: 'is-izinleri' },
];

// ── Component ──────────────────────────────────────────────────────────────

export default function Header({ onMobileMenuToggle }: { onMobileMenuToggle?: () => void }) {
  const {
    activeModule, setActiveModule, sidebarCollapsed, setSidebarCollapsed,
    currentUser, setQuickCreate, theme, toggleTheme,
    bildirimler, okunmamisBildirimSayisi, bildirimOku, tumunuOku,
    firmalar, personeller, evraklar, tutanaklar,
    refreshData, dataLoading,
    org: ctxOrg,
  } = useApp();

  const { logout, user } = useAuth();

  const [quickOpen, setQuickOpen] = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [refreshDone, setRefreshDone] = useState(false);

  const isDark = theme === 'dark';

  // ── Gezici uzman firma suffix ──
  const isGeziciMulti = ctxOrg?.osgbRole === 'gezici_uzman' && (ctxOrg?.activeFirmIds?.length ?? 0) > 1;
  const firmaSuffix = isGeziciMulti ? (ctxOrg?.activeFirmName || ctxOrg?.name) : null;

  // ── Theme tokens ──
  const headerBg       = isDark ? 'var(--bg-header)'      : 'rgba(255,255,255,0.97)';
  const headerBorder   = isDark ? 'var(--border-subtle)'  : 'rgba(15,23,42,0.075)';
  const textMuted      = isDark ? '#64748B'               : '#64748B';
  const inputBg        = isDark ? 'var(--bg-input)'       : 'rgba(15,23,42,0.04)';
  const inputBorder    = isDark ? 'var(--border-input)'   : 'rgba(15,23,42,0.09)';
  const iconBtnBg      = isDark ? 'var(--bg-item)'        : 'rgba(15,23,42,0.038)';
  const iconBtnBorder  = isDark ? 'var(--border-main)'    : 'rgba(15,23,42,0.09)';
  const nameColor      = isDark ? '#EDF2F7'               : '#0F172A';
  const dropdownBg     = isDark ? 'var(--bg-card-solid)'  : 'rgba(255,255,255,0.99)';
  const dropdownBorder = isDark ? 'var(--border-main)'    : 'rgba(15,23,42,0.09)';
  const dropdownItemHover = isDark ? 'var(--bg-hover)'    : 'rgba(15,23,42,0.038)';

  // ── Status badge — useMemo: sadece okunmamisBildirimSayisi değişince hesapla ──
  const statusInfo = useMemo(() => {
    const total = okunmamisBildirimSayisi;
    if (total === 0) return { text: 'Sistem sağlıklı',        color: '#34D399', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.2)',  icon: 'ri-checkbox-circle-line' };
    if (total <= 3)  return { text: `${total} yaklaşan işlem`, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.2)',  icon: 'ri-timer-line' };
    return                  { text: `${total} uyarı var`,      color: '#F87171', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.2)',   icon: 'ri-alarm-warning-line' };
  }, [okunmamisBildirimSayisi]);

  // ── Refresh ──
  const handleRefresh = useCallback(async () => {
    if (refreshing || dataLoading) return;
    setRefreshing(true);
    setRefreshDone(false);
    try {
      await refreshData();
      setRefreshDone(true);
      setTimeout(() => setRefreshDone(false), 2000);
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, dataLoading, refreshData]);

  // ── Quick create ──
  const handleQuickCard = useCallback((card: typeof quickCards[0]) => {
    setQuickOpen(false);
    setActiveModule(card.module);
    setQuickCreate(card.module);
  }, [setActiveModule, setQuickCreate]);

  // ── Navigate with record open signal ──
  const handleNavigate = useCallback((module: string, recordId?: string, tip?: string) => {
    setActiveModule(module);
    if (recordId) {
      try {
        localStorage.setItem('isg_open_record', JSON.stringify({ module, recordId, tip, ts: Date.now() }));
        window.dispatchEvent(new CustomEvent('isg_open_record', { detail: { module, recordId, tip } }));
      } catch { /* ignore */ }
    }
  }, [setActiveModule]);

  const currentModule = moduleTitles[activeModule];
  const hour = new Date().getHours();
  const greeting = hour >= 6 && hour < 12 ? 'Günaydın' : hour >= 12 && hour < 17 ? 'İyi Günler' : 'İyi Akşamlar';
  const firstName = (currentUser.ad || '').split(' ')[0] || 'Kullanıcı';

  // ── Search data — useMemo: SearchBox'a her render'da yeni obje gitmesin ──
  // Yeni obje referansı SearchBox'u gereksiz re-render'a zorluyor
  const searchData = useMemo(
    () => ({ firmalar, personeller, evraklar, tutanaklar }),
    [firmalar, personeller, evraklar, tutanaklar],
  );

  return (
    <>
      {/* ═══════════════════ HEADER ═══════════════════ */}
      <header
        className={`fixed top-0 right-0 z-30 flex items-center left-0 ${sidebarCollapsed ? 'lg:left-[64px]' : 'lg:left-[220px]'}`}
        style={{
          height: '56px',
          background: headerBg,
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderBottom: `1px solid ${headerBorder}`,
          transition: 'left 0.28s cubic-bezier(0.4,0,0.2,1), background 0.3s ease',
          paddingLeft: '20px',
          paddingRight: '16px',
          gap: '8px',
        }}
      >
        {/* Hamburger — Mobile */}
        <button
          onClick={onMobileMenuToggle}
          className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200 lg:hidden flex-shrink-0"
          style={{ color: textMuted, background: iconBtnBg, border: `1px solid ${iconBtnBorder}` }}
        >
          <i className="ri-menu-line text-sm" />
        </button>

        {/* Sidebar collapse — Desktop */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="w-8 h-8 items-center justify-center rounded-lg cursor-pointer transition-all duration-200 hidden lg:flex flex-shrink-0"
          style={{ color: textMuted, background: iconBtnBg, border: `1px solid ${iconBtnBorder}` }}
          onMouseEnter={e => { e.currentTarget.style.color = isDark ? '#94A3B8' : '#334155'; e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = textMuted; e.currentTarget.style.background = iconBtnBg; }}
        >
          <i className={`${sidebarCollapsed ? 'ri-menu-unfold-line' : 'ri-menu-fold-line'} text-sm`} />
        </button>

        {/* Sayfa Başlığı */}
        <div className="flex items-center gap-2.5 flex-shrink-0 min-w-0">
          <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
            <i className={`${currentModule?.icon || 'ri-home-line'} text-sm`} style={{ color: '#0EA5E9' }} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold leading-tight truncate" style={{ color: nameColor, maxWidth: '160px' }}>
              {currentModule?.label || activeModule}
            </span>
            {firmaSuffix && (
              <span className="hidden lg:flex items-center gap-1 text-[10px] font-semibold leading-none mt-0.5" style={{ color: '#0EA5E9' }}>
                <i className="ri-building-2-line text-[9px]" />
                <span className="truncate" style={{ maxWidth: '120px' }}>{firmaSuffix}</span>
              </span>
            )}
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Selamlama — Desktop */}
        <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
          <p className="text-[11.5px] font-medium" style={{ color: textMuted }}>
            {greeting}, <span className="font-bold" style={{ color: nameColor }}>{firstName}</span>
          </p>
        </div>

        {/* Status badge — XL */}
        <div
          className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold flex-shrink-0"
          style={{ background: statusInfo.bg, border: `1px solid ${statusInfo.border}`, color: statusInfo.color }}
        >
          <i className={`${statusInfo.icon} text-[9px]`} />
          {statusInfo.text}
        </div>

        {/* Firma Switcher */}
        <FirmaSwitcher isDark={isDark} />

        {/* Search */}
        <SearchBox
          data={searchData}
          isDark={isDark}
          inputBg={inputBg}
          inputBorder={inputBorder}
          dropdownBg={dropdownBg}
          dropdownBorder={dropdownBorder}
          dropdownItemHover={dropdownItemHover}
          onNavigate={module => handleNavigate(module)}
        />

        {/* Yenile */}
        <button
          onClick={handleRefresh}
          disabled={refreshing || dataLoading}
          title="Verileri Yenile"
          className="w-8 h-8 hidden md:flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200 flex-shrink-0 disabled:opacity-50"
          style={{ background: refreshDone ? 'rgba(52,211,153,0.12)' : iconBtnBg, border: `1px solid ${refreshDone ? 'rgba(52,211,153,0.3)' : iconBtnBorder}` }}
          onMouseEnter={e => { if (!refreshing) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = refreshDone ? 'rgba(52,211,153,0.12)' : iconBtnBg; }}
        >
          <i
            className={`${refreshing ? 'ri-loader-4-line animate-spin' : refreshDone ? 'ri-check-line' : 'ri-refresh-line'} text-sm`}
            style={{ color: refreshDone ? '#34D399' : refreshing ? '#60A5FA' : textMuted }}
          />
        </button>

        {/* Tema Toggle */}
        <button
          onClick={toggleTheme}
          title={isDark ? 'Açık Tema' : 'Koyu Tema'}
          className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200 flex-shrink-0"
          style={{ background: iconBtnBg, border: `1px solid ${iconBtnBorder}` }}
          onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = iconBtnBg; }}
        >
          <i className={`${isDark ? 'ri-sun-line' : 'ri-moon-line'} text-sm`} style={{ color: isDark ? '#F59E0B' : '#475569' }} />
        </button>

        {/* Hızlı Ekle */}
        <button
          onClick={() => setQuickOpen(true)}
          className="whitespace-nowrap flex-shrink-0 flex items-center gap-1.5 cursor-pointer font-semibold transition-all duration-150"
          style={{
            padding: '6px 14px',
            fontSize: '12px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #0EA5E9, #0284C7)',
            color: '#ffffff',
            border: 'none',
            boxShadow: '0 2px 10px rgba(14,165,233,0.35)',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(14,165,233,0.5)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 10px rgba(14,165,233,0.35)'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}
        >
          <i className="ri-add-line text-sm" />
          <span className="hidden lg:inline">Hızlı Ekle</span>
        </button>

        {/* Notifications (ISG + Support) */}
        <NotificationDropdown
          bildirimler={bildirimler}
          okunmamisBildirimSayisi={okunmamisBildirimSayisi}
          bildirimOku={bildirimOku}
          tumunuOku={tumunuOku}
          onNavigate={handleNavigate}
          isDark={isDark}
          nameColor={nameColor}
          dropdownBg={dropdownBg}
          dropdownBorder={dropdownBorder}
          dropdownItemHover={dropdownItemHover}
          textMuted={textMuted}
          iconBtnBg={iconBtnBg}
          iconBtnBorder={iconBtnBorder}
        />

        {/* Support button */}
        <SupportButton
          isDark={isDark}
          iconBtnBg={iconBtnBg}
          iconBtnBorder={iconBtnBorder}
        />

        {/* Profile */}
        <ProfileMenu
          currentUserAd={currentUser.ad || ''}
          userEmail={user?.email || currentUser.email || ''}
          isDark={isDark}
          nameColor={nameColor}
          dropdownBg={dropdownBg}
          dropdownBorder={dropdownBorder}
          dropdownItemHover={dropdownItemHover}
          onNavigate={module => { setActiveModule(module); }}
          onLogout={logout}
        />
      </header>

      {/* ═══════════════════ QUICK ADD MODAL ═══════════════════ */}
      {quickOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
          onClick={e => { if (e.target === e.currentTarget) setQuickOpen(false); }}
        >
          <div
            className="w-full max-w-[620px] animate-slide-up overflow-hidden"
            style={{
              background: isDark ? 'var(--bg-card-solid)' : '#FFFFFF',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.1)'}`,
              borderRadius: '24px',
              boxShadow: isDark
                ? '0 0 0 1px rgba(99,102,241,0.12), 0 40px 100px rgba(0,0,0,0.8)'
                : '0 0 0 1px rgba(99,102,241,0.08), 0 30px 80px rgba(15,23,42,0.2)',
            }}
          >
            {/* Rainbow bar */}
            <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #3B82F6, #10B981, #F59E0B, #A78BFA, #F43F5E, #14B8A6, #FB923C, #34D399)' }} />

            {/* Modal header */}
            <div
              className="flex items-center justify-between px-6 py-5"
              style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.07)'}` }}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 flex items-center justify-center rounded-2xl flex-shrink-0" style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)', boxShadow: '0 6px 20px rgba(99,102,241,0.4)' }}>
                  <i className="ri-add-circle-line text-white text-lg" />
                </div>
                <div>
                  <h2 className="text-[16px] font-black tracking-tight" style={{ color: isDark ? '#EDF2F7' : '#0F172A', letterSpacing: '-0.03em' }}>Hızlı Ekle</h2>
                  <p className="text-[11.5px] mt-0.5" style={{ color: isDark ? '#475569' : '#94A3B8' }}>Hangi kaydı oluşturmak istiyorsunuz?</p>
                </div>
              </div>
              <button
                onClick={() => setQuickOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer transition-all duration-200"
                style={{ color: isDark ? '#475569' : '#94A3B8', background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)'}` }}
                onMouseEnter={e => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.25)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = isDark ? '#475569' : '#94A3B8'; e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)'; e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)'; }}
              >
                <i className="ri-close-line text-sm" />
              </button>
            </div>

            {/* Primary Cards */}
            <div className="px-6 pt-5 pb-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] mb-3.5 flex items-center gap-2" style={{ color: isDark ? '#334155' : '#CBD5E1' }}>
                <span className="w-3 h-px inline-block" style={{ background: isDark ? '#334155' : '#CBD5E1' }} />
                Temel İşlemler
              </p>
              <div className="grid grid-cols-2 gap-3">
                {quickCards.filter(c => c.primary).map(card => (
                  <button
                    key={card.id}
                    onClick={() => handleQuickCard(card)}
                    className="relative flex items-center gap-4 px-5 py-4 rounded-2xl text-left cursor-pointer transition-all duration-200 overflow-hidden"
                    style={{ background: isDark ? `linear-gradient(135deg, ${card.accent}15, ${card.accent}06)` : `linear-gradient(135deg, ${card.accent}0e, ${card.accent}05)`, border: `1px solid ${card.accent}28` }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 14px 36px ${card.accent}28`; e.currentTarget.style.borderColor = `${card.accent}50`; e.currentTarget.style.background = isDark ? `linear-gradient(135deg, ${card.accent}22, ${card.accent}0e)` : `linear-gradient(135deg, ${card.accent}16, ${card.accent}08)`; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = `${card.accent}28`; e.currentTarget.style.background = isDark ? `linear-gradient(135deg, ${card.accent}15, ${card.accent}06)` : `linear-gradient(135deg, ${card.accent}0e, ${card.accent}05)`; }}
                  >
                    <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-10" style={{ background: card.accent }} />
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `linear-gradient(135deg, ${card.accent}, ${card.accent}cc)`, boxShadow: `0 6px 18px ${card.accent}40` }}>
                      <i className={`${card.icon} text-white text-[18px]`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-bold leading-tight" style={{ color: isDark ? '#EDF2F7' : '#0F172A' }}>{card.label}</p>
                      <p className="text-[11.5px] mt-1" style={{ color: isDark ? '#64748B' : '#94A3B8' }}>{card.desc}</p>
                      <div className="flex items-center gap-1 mt-2">
                        <span className="text-[10px] font-bold" style={{ color: card.accent }}>Modüle git</span>
                        <i className="ri-arrow-right-line text-[10px]" style={{ color: card.accent }} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Secondary Cards */}
            <div className="px-6 pb-5" style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)'}` }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] mt-4 mb-3.5 flex items-center gap-2" style={{ color: isDark ? '#334155' : '#CBD5E1' }}>
                <span className="w-3 h-px inline-block" style={{ background: isDark ? '#334155' : '#CBD5E1' }} />
                Diğer İşlemler
              </p>
              <div className="grid grid-cols-4 gap-2">
                {quickCards.filter(c => !c.primary).map(card => (
                  <button
                    key={card.id}
                    onClick={() => handleQuickCard(card)}
                    className="flex flex-col items-center gap-2 py-3.5 px-2 rounded-2xl text-center cursor-pointer transition-all duration-200"
                    style={{ background: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(15,23,42,0.025)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.055)' : 'rgba(15,23,42,0.065)'}` }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.background = isDark ? `${card.accent}14` : `${card.accent}0c`;
                      e.currentTarget.style.borderColor = `${card.accent}38`;
                      e.currentTarget.style.boxShadow = `0 10px 28px ${card.accent}20`;
                      const iconWrap = e.currentTarget.querySelector('.icon-wrap') as HTMLElement;
                      if (iconWrap) { iconWrap.style.background = `linear-gradient(135deg, ${card.accent}, ${card.accent}cc)`; iconWrap.style.boxShadow = `0 4px 12px ${card.accent}40`; }
                      const icon = e.currentTarget.querySelector('i') as HTMLElement;
                      if (icon) icon.style.color = '#ffffff';
                      const label = e.currentTarget.querySelector('.card-label') as HTMLElement;
                      if (label) label.style.color = card.accent;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(15,23,42,0.025)';
                      e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.055)' : 'rgba(15,23,42,0.065)';
                      e.currentTarget.style.boxShadow = 'none';
                      const iconWrap = e.currentTarget.querySelector('.icon-wrap') as HTMLElement;
                      if (iconWrap) { iconWrap.style.background = isDark ? `${card.accent}18` : `${card.accent}12`; iconWrap.style.boxShadow = 'none'; }
                      const icon = e.currentTarget.querySelector('i') as HTMLElement;
                      if (icon) icon.style.color = card.accent;
                      const label = e.currentTarget.querySelector('.card-label') as HTMLElement;
                      if (label) label.style.color = isDark ? '#64748B' : '#94A3B8';
                    }}
                  >
                    <div className="icon-wrap w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0 transition-all duration-200" style={{ background: isDark ? `${card.accent}18` : `${card.accent}12` }}>
                      <i className={`${card.icon} text-[15px] transition-colors duration-200`} style={{ color: card.accent }} />
                    </div>
                    <p className="card-label text-[11px] font-semibold leading-tight transition-colors duration-200" style={{ color: isDark ? '#64748B' : '#94A3B8' }}>
                      {card.label}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 flex items-center justify-between" style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)'}` }}>
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)'}`, color: isDark ? '#475569' : '#94A3B8' }}>ESC</span>
                <span className="text-[11px]" style={{ color: isDark ? '#334155' : '#CBD5E1' }}>ile kapat</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10.5px]" style={{ color: isDark ? '#334155' : '#CBD5E1' }}>
                <i className="ri-flashlight-line text-[11px]" style={{ color: '#6366F1' }} />
                <span>{quickCards.length} modül mevcut</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
