import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import SupportModal from './SupportModal';
import { supabase } from '@/lib/supabase';

interface SupportNotification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  ticket_id: string | null;
}

const moduleTitles: Record<string, { label: string; icon: string }> = {
  dashboard:      { label: 'Genel Bakış',        icon: 'ri-dashboard-3-line' },
  firmalar:       { label: 'Firmalar',            icon: 'ri-building-2-line' },
  personeller:    { label: 'Personel',            icon: 'ri-team-line' },
  'firma-evraklari': { label: 'Firma Belgeleri', icon: 'ri-building-4-line' },
  evraklar:       { label: 'Belge Takibi',        icon: 'ri-file-list-3-line' },
  egitimler:      { label: 'Eğitimler',           icon: 'ri-graduation-cap-line' },
  muayeneler:     { label: 'Sağlık Durumu',       icon: 'ri-heart-pulse-line' },
  tutanaklar:     { label: 'Tutanak Yönetimi',    icon: 'ri-article-line' },
  uygunsuzluklar: { label: 'Saha Denetimleri',   icon: 'ri-map-pin-user-line' },
  ekipmanlar:     { label: 'Ekipman',             icon: 'ri-tools-line' },
  'is-izinleri':  { label: 'İş İzinleri',         icon: 'ri-shield-keyhole-line' },
  raporlar:       { label: 'Raporlar',            icon: 'ri-bar-chart-2-line' },
  ayarlar:        { label: 'Ayarlar',             icon: 'ri-settings-4-line' },
  copkutusu:      { label: 'Çöp Kutusu',          icon: 'ri-delete-bin-2-line' },
  saha:           { label: 'Saha Denetimleri',    icon: 'ri-map-pin-user-line' },
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

  { id: 'isizni',      label: 'İş İzinleri',       desc: 'İş izni kaydı aç',            icon: 'ri-file-shield-2-line',  accent: '#38BDF8', primary: false, module: 'is-izinleri' },
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
    firmalar, personeller, evraklar, tutanaklar, egitimler, muayeneler, ekipmanlar,
    refreshData, dataLoading,
  } = useApp();

  const [refreshing, setRefreshing] = useState(false);
  const [refreshDone, setRefreshDone] = useState(false);
  const [supportNotifs, setSupportNotifs] = useState<SupportNotification[]>([]);
  const [supportNotifOpen, setSupportNotifOpen] = useState(false);
  const supportNotifRef = useRef<HTMLDivElement>(null);

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

  const handleRefresh = async () => {
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
  };
  const { logout, user } = useAuth();

  const [quickOpen, setQuickOpen]     = useState(false);
  const [notifOpen, setNotifOpen]     = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportViewTicketId, setSupportViewTicketId] = useState<string | null>(null);
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
      if (supportNotifRef.current && !supportNotifRef.current.contains(e.target as Node)) setSupportNotifOpen(false);
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
  const headerBg     = isDark ? 'var(--bg-header)'        : 'rgba(255,255,255,0.97)';
  const headerBorder = isDark ? 'var(--border-subtle)'    : 'rgba(15,23,42,0.075)';
  const textMuted    = isDark ? '#64748B'                 : '#64748B';
  const inputBg      = isDark ? 'var(--bg-input)'         : 'rgba(15,23,42,0.04)';
  const inputBorder  = isDark ? 'var(--border-input)'     : 'rgba(15,23,42,0.09)';
  const iconBtnBg    = isDark ? 'var(--bg-item)'          : 'rgba(15,23,42,0.038)';
  const iconBtnBorder= isDark ? 'var(--border-main)'      : 'rgba(15,23,42,0.09)';
  const nameColor    = isDark ? '#EDF2F7'                 : '#0F172A';
  const dropdownBg   = isDark ? 'var(--bg-card-solid)'   : 'rgba(255,255,255,0.99)';
  const dropdownBorder = isDark ? 'var(--border-main)'   : 'rgba(15,23,42,0.09)';
  const dropdownItemHover = isDark ? 'var(--bg-hover)'   : 'rgba(15,23,42,0.038)';

  // Sadece okunmamışları göster, okunmuşlar gizli
  const displayBildirimler = bildirimler.filter(b => !b.okundu).slice(0, 20);

  // Bildirime tıklayınca ilgili modüle git
  const handleBildirimClick = (b: typeof bildirimler[0]) => {
    bildirimOku(b.id);
    setNotifOpen(false);
    const targetModule = b.module || 'dashboard';
    // Kısa gecikme — önce dropdown kapanır, sonra navigasyon çalışır
    setTimeout(() => {
      setActiveModule(targetModule);
      // recordId varsa ilgili modülün açması için sinyal gönder
      if (b.recordId) {
        try {
          localStorage.setItem('isg_open_record', JSON.stringify({
            module: targetModule,
            recordId: b.recordId,
            tip: b.tip,
            ts: Date.now(),
          }));
          window.dispatchEvent(new CustomEvent('isg_open_record', {
            detail: { module: targetModule, recordId: b.recordId, tip: b.tip },
          }));
        } catch { /* ignore */ }
      }
    }, 50);
  };

  const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string; badge: string; badgeBg: string }> = {
    evrak_surecek:            { icon: 'ri-file-warning-line',      color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', badge: 'Evrak',          badgeBg: 'rgba(148,163,184,0.12)' },
    evrak_dolmus:             { icon: 'ri-file-damage-line',        color: '#F87171', bg: 'rgba(248,113,113,0.12)', badge: 'Evrak',          badgeBg: 'rgba(248,113,113,0.12)' },
    ekipman_kontrol:          { icon: 'ri-tools-line',              color: '#FB923C', bg: 'rgba(251,146,60,0.12)',  badge: 'Ekipman',        badgeBg: 'rgba(251,146,60,0.12)' },
    ekipman_kontrol_yapildi:  { icon: 'ri-checkbox-circle-fill',   color: '#34D399', bg: 'rgba(52,211,153,0.12)',  badge: 'Kontrol ✓',      badgeBg: 'rgba(52,211,153,0.12)' },
    egitim_surecek:           { icon: 'ri-graduation-cap-line',     color: '#60A5FA', bg: 'rgba(96,165,250,0.12)',  badge: 'Eğitim',         badgeBg: 'rgba(96,165,250,0.12)' },
    saglik_surecek:           { icon: 'ri-heart-pulse-line',        color: '#34D399', bg: 'rgba(52,211,153,0.12)',  badge: 'Sağlık',         badgeBg: 'rgba(52,211,153,0.12)' },
  };

  const hour      = new Date().getHours();
  const greeting  = hour >= 6 && hour < 12 ? 'Günaydın' : hour >= 12 && hour < 17 ? 'İyi Günler' : 'İyi Akşamlar';
  const firstName = (currentUser.ad || '').split(' ')[0] || 'Kullanıcı';

  return (
    <>
      {/* ══════════════════════════════════════════════════════
          HEADER — Mobile-First
      ══════════════════════════════════════════════════════ */}
      <header
        className={`fixed top-0 right-0 z-30 flex items-center left-0 ${sidebarCollapsed ? 'lg:left-[56px]' : 'lg:left-[220px]'}`}
        style={{
          height: '52px',
          background: headerBg,
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          borderBottom: `1px solid ${headerBorder}`,
          boxShadow: isDark ? '0 1px 8px rgba(0,0,0,0.25)' : '0 1px 6px rgba(15,23,42,0.06)',
          transition: 'left 0.26s cubic-bezier(0.4,0,0.2,1), background 0.3s ease',
          paddingLeft: '12px',
          paddingRight: '12px',
          gap: '8px',
        }}
      >
        {/* ── MOBİL: Hamburger ── */}
        <button
          onClick={onMobileMenuToggle}
          className="w-9 h-9 flex items-center justify-center rounded-xl cursor-pointer transition-all duration-200 lg:hidden flex-shrink-0"
          style={{ color: textMuted, background: iconBtnBg, border: `1px solid ${iconBtnBorder}` }}
        >
          <i className="ri-menu-line text-base" />
        </button>

        {/* ── DESKTOP: Sidebar collapse toggle ── */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="w-8 h-8 items-center justify-center rounded-lg cursor-pointer transition-all duration-200 hidden lg:flex flex-shrink-0"
          style={{ color: textMuted, background: iconBtnBg, border: `1px solid ${iconBtnBorder}` }}
          onMouseEnter={e => { e.currentTarget.style.color = isDark ? '#94A3B8' : '#334155'; e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = textMuted; e.currentTarget.style.background = iconBtnBg; }}
        >
          <i className={`${sidebarCollapsed ? 'ri-menu-unfold-line' : 'ri-menu-fold-line'} text-sm`} />
        </button>

        {/* ── Sayfa Başlığı (Mobil: orta, Desktop: sol) ── */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-6 h-6 flex items-center justify-center rounded-lg flex-shrink-0"
            style={{ background: `${isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)'}` }}>
            <i className={`${currentModule?.icon || 'ri-home-line'} text-[11px]`} style={{ color: '#818CF8' }} />
          </div>
          <span className="text-[13px] font-bold truncate" style={{ color: nameColor, maxWidth: '160px' }}>
            {currentModule?.label || activeModule}
          </span>
        </div>

        {/* ── Spacer ── */}
        <div className="flex-1" />

        {/* ── DESKTOP: Selamlama ── */}
        <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
          <p className="text-[11.5px] font-medium" style={{ color: textMuted }}>
            {greeting}, <span className="font-bold" style={{ color: nameColor }}>{firstName}</span>
          </p>
        </div>

        {/* ── DESKTOP: Status badge ── */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold flex-shrink-0"
          style={{ background: statusInfo.bg, border: `1px solid ${statusInfo.border}`, color: statusInfo.color }}>
          <i className={`${statusInfo.icon} text-[9px]`} />
          {statusInfo.text}
        </div>

        {/* ── DESKTOP: Arama ── */}
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
              e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(59,130,246,0.04)';
              e.currentTarget.style.borderColor = '#3b82f6';
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.2)';
              e.currentTarget.style.width = '200px';
            }}
            onBlur={e => {
              e.currentTarget.style.background = inputBg;
              e.currentTarget.style.borderColor = inputBorder;
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.width = '';
            }}
          />
          {showSearchDropdown && (
            <div className="absolute right-0 top-11 w-80 py-1 z-50 animate-slide-up"
              style={{ background: dropdownBg, border: `1px solid ${dropdownBorder}`, borderRadius: '14px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)' }}>
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
                    <button key={result.id}
                      onClick={() => { setActiveModule(result.module); setSearch(''); setSearchFocus(false); }}
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
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Yenile (Desktop) ── */}
        <button onClick={handleRefresh} disabled={refreshing || dataLoading} title="Verileri Yenile"
          className="w-8 h-8 hidden md:flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200 flex-shrink-0 disabled:opacity-50"
          style={{ background: refreshDone ? 'rgba(52,211,153,0.12)' : iconBtnBg, border: `1px solid ${refreshDone ? 'rgba(52,211,153,0.3)' : iconBtnBorder}` }}
          onMouseEnter={e => { if (!refreshing) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = refreshDone ? 'rgba(52,211,153,0.12)' : iconBtnBg; }}>
          <i className={`${refreshing ? 'ri-loader-4-line animate-spin' : refreshDone ? 'ri-check-line' : 'ri-refresh-line'} text-sm`}
            style={{ color: refreshDone ? '#34D399' : refreshing ? '#60A5FA' : textMuted }} />
        </button>

        {/* ── Tema Toggle ── */}
        <button onClick={toggleTheme} title={isDark ? 'Açık Tema' : 'Koyu Tema'}
          className="w-9 h-9 lg:w-8 lg:h-8 flex items-center justify-center rounded-xl lg:rounded-lg cursor-pointer transition-all duration-200 flex-shrink-0"
          style={{ background: iconBtnBg, border: `1px solid ${iconBtnBorder}` }}
          onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = iconBtnBg; }}>
          <i className={`${isDark ? 'ri-sun-line' : 'ri-moon-line'} text-base lg:text-sm`} style={{ color: isDark ? '#F59E0B' : '#475569' }} />
        </button>

        {/* ── Hızlı Ekle (Desktop) ── */}
        <button onClick={() => { setQuickOpen(true); setNotifOpen(false); setProfileOpen(false); }}
          className="btn-primary flex-shrink-0 hidden sm:flex"
          style={{ padding: '6px 12px', fontSize: '11.5px', borderRadius: '8px' }}>
          <i className="ri-add-line text-sm" />
          <span className="hidden lg:inline">Hızlı Ekle</span>
        </button>

        {/* ── Support Notifications (Supabase) ── */}
        <div className="relative flex-shrink-0" ref={supportNotifRef}>
          <button
            onClick={() => { setSupportNotifOpen(v => !v); setNotifOpen(false); setProfileOpen(false); setQuickOpen(false); fetchSupportNotifs(); }}
            className="w-9 h-9 lg:w-8 lg:h-8 flex items-center justify-center rounded-xl lg:rounded-lg cursor-pointer transition-all duration-200 relative"
            style={{ background: supportNotifOpen ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)') : iconBtnBg, border: `1px solid ${iconBtnBorder}` }}
            title="Destek Bildirimleri"
          >
            <i className="ri-message-3-line text-base lg:text-sm" style={{ color: supportNotifOpen ? (isDark ? '#E2E8F0' : '#0F172A') : textMuted }} />
            {unreadSupportCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] flex items-center justify-center text-[9px] font-bold text-white rounded-full px-1"
                style={{ background: 'linear-gradient(135deg, #10B981, #059669)', boxShadow: '0 0 6px rgba(16,185,129,0.5)' }}>
                {unreadSupportCount > 9 ? '9+' : unreadSupportCount}
              </span>
            )}
          </button>

          {supportNotifOpen && (
            <div className="absolute right-0 top-11 z-50 w-[320px] animate-slide-up overflow-hidden"
              style={{ background: dropdownBg, border: `1px solid ${dropdownBorder}`, borderRadius: '16px', boxShadow: isDark ? '0 25px 60px rgba(0,0,0,0.6)' : '0 20px 50px rgba(15,23,42,0.15)', backdropFilter: 'blur(20px)' }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${dropdownBorder}` }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(16,185,129,0.1)' }}>
                    <i className="ri-message-3-line text-xs" style={{ color: '#10B981' }} />
                  </div>
                  <p className="text-[13px] font-bold" style={{ color: nameColor }}>Destek Yanıtları</p>
                  {unreadSupportCount > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}>
                      {unreadSupportCount} yeni
                    </span>
                  )}
                </div>
                {unreadSupportCount > 0 && (
                  <button onClick={markAllSupportRead} className="text-[11px] cursor-pointer font-semibold px-2 py-1 rounded-lg transition-all"
                    style={{ color: '#10B981', background: 'rgba(16,185,129,0.08)' }}>
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
                    <div key={n.id}
                      onClick={() => {
                        markSupportRead(n.id);
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

        {/* ── Notifications ── */}
        <div className="relative flex-shrink-0" ref={notifRef}>
          <button
            onClick={() => { setNotifOpen(v => !v); setQuickOpen(false); setProfileOpen(false); }}
            className="w-9 h-9 lg:w-8 lg:h-8 flex items-center justify-center rounded-xl lg:rounded-lg cursor-pointer transition-all duration-200 relative"
            style={{
              background: notifOpen ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)') : iconBtnBg,
              border: `1px solid ${notifOpen ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.14)') : iconBtnBorder}`,
            }}
            onMouseEnter={e => { if (!notifOpen) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)'; }}
            onMouseLeave={e => { if (!notifOpen) e.currentTarget.style.background = iconBtnBg; }}
          >
            <i className="ri-notification-3-line text-base lg:text-sm" style={{ color: notifOpen ? (isDark ? '#E2E8F0' : '#0F172A') : textMuted }} />
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
                    {(['ekipman_kontrol_yapildi','evrak_surecek','evrak_dolmus','ekipman_kontrol','egitim_surecek','saglik_surecek'] as const).map(tip => {
                      const count = bildirimler.filter(b => b.tip === tip).length;
                      if (count === 0) return null;
                      const cfg = TYPE_CONFIG[tip] ?? { icon: 'ri-notification-3-line', color: '#64748B', bg: 'rgba(100,116,139,0.12)', badge: 'Bildirim', badgeBg: 'rgba(100,116,139,0.12)' };
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
                                <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                                  style={{ background: cfg.badgeBg, color: cfg.color }}>{cfg.badge}</span>
                                <p className="text-[12px] font-semibold truncate flex-1" style={{ color: isDark ? '#E2E8F0' : '#0F172A' }}>{b.mesaj}</p>
                                {!b.okundu && (
                                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#3B82F6' }} />
                                )}
                              </div>
                              <p className="text-[11px] leading-relaxed" style={{ color: '#64748B' }}>{b.detay}</p>
                              {b.module && (
                                <p className="text-[10px] mt-1 flex items-center gap-1 font-semibold" style={{ color: '#3B82F6' }}>
                                  <i className="ri-arrow-right-circle-line text-[10px]" />
                                  {b.module === 'evraklar' ? 'Evrak Takibi' : b.module === 'ekipmanlar' ? 'Ekipmanlar' : b.module === 'egitimler' ? 'Eğitimler' : b.module === 'muayeneler' ? 'Sağlık' : 'Panele Git'} sayfasına git
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

        {/* ── Profile ── */}
        <div className="relative flex-shrink-0" ref={profileRef}>
          <button
            onClick={() => { setProfileOpen(v => !v); setNotifOpen(false); setQuickOpen(false); }}
            className="flex items-center gap-1.5 cursor-pointer transition-all duration-200 rounded-xl lg:rounded-lg py-1 px-1.5"
            style={{
              background: profileOpen ? (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.06)') : 'transparent',
              border: `1px solid ${profileOpen ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.12)') : 'transparent'}`,
            }}
            onMouseEnter={e => { if (!profileOpen) { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)'; e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'; } }}
            onMouseLeave={e => { if (!profileOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; } }}
          >
            {/* Avatar */}
            <div
              className="w-8 h-8 lg:w-7 lg:h-7 rounded-xl lg:rounded-lg flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)', boxShadow: '0 2px 8px rgba(99,102,241,0.3)' }}
            >
              {(currentUser.ad || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="hidden lg:block text-left">
              <p className="text-[11px] font-semibold leading-tight" style={{ color: nameColor }}>{currentUser.ad || 'Kullanıcı'}</p>
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

                <button
                  onClick={() => { setSupportOpen(true); setProfileOpen(false); }}
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

      {/* Support Modal */}
      <SupportModal
        open={supportOpen}
        onClose={() => { setSupportOpen(false); setSupportViewTicketId(null); }}
        viewTicketId={supportViewTicketId}
      />

      {/* ══════════════════════════════════════════════════════
          QUICK ADD MODAL
      ══════════════════════════════════════════════════════ */}
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
            {/* Rainbow top bar */}
            <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #3B82F6, #10B981, #F59E0B, #A78BFA, #F43F5E, #14B8A6, #FB923C, #34D399)' }} />

            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-5"
              style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.07)'}` }}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className="w-10 h-10 flex items-center justify-center rounded-2xl flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
                    boxShadow: '0 6px 20px rgba(99,102,241,0.4)',
                  }}
                >
                  <i className="ri-add-circle-line text-white text-lg" />
                </div>
                <div>
                  <h2 className="text-[16px] font-black tracking-tight" style={{ color: nameColor, letterSpacing: '-0.03em' }}>
                    Hızlı Ekle
                  </h2>
                  <p className="text-[11.5px] mt-0.5" style={{ color: isDark ? '#475569' : '#94A3B8' }}>
                    Hangi kaydı oluşturmak istiyorsunuz?
                  </p>
                </div>
              </div>
              <button
                onClick={() => setQuickOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer transition-all duration-200"
                style={{
                  color: isDark ? '#475569' : '#94A3B8',
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)'}`,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = '#EF4444';
                  e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
                  e.currentTarget.style.borderColor = 'rgba(239,68,68,0.25)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = isDark ? '#475569' : '#94A3B8';
                  e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)';
                  e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)';
                }}
              >
                <i className="ri-close-line text-sm" />
              </button>
            </div>

            {/* Primary Cards — 2 büyük kart */}
            <div className="px-6 pt-5 pb-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] mb-3.5 flex items-center gap-2"
                style={{ color: isDark ? '#334155' : '#CBD5E1' }}>
                <span className="w-3 h-px inline-block" style={{ background: isDark ? '#334155' : '#CBD5E1' }} />
                Temel İşlemler
              </p>
              <div className="grid grid-cols-2 gap-3">
                {quickCards.filter(c => c.primary).map(card => (
                  <button
                    key={card.id}
                    onClick={() => handleQuickCard(card)}
                    className="relative flex items-center gap-4 px-5 py-4 rounded-2xl text-left cursor-pointer transition-all duration-200 overflow-hidden group"
                    style={{
                      background: isDark
                        ? `linear-gradient(135deg, ${card.accent}15, ${card.accent}06)`
                        : `linear-gradient(135deg, ${card.accent}0e, ${card.accent}05)`,
                      border: `1px solid ${card.accent}28`,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-3px)';
                      e.currentTarget.style.boxShadow = `0 14px 36px ${card.accent}28`;
                      e.currentTarget.style.borderColor = `${card.accent}50`;
                      e.currentTarget.style.background = isDark
                        ? `linear-gradient(135deg, ${card.accent}22, ${card.accent}0e)`
                        : `linear-gradient(135deg, ${card.accent}16, ${card.accent}08)`;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.borderColor = `${card.accent}28`;
                      e.currentTarget.style.background = isDark
                        ? `linear-gradient(135deg, ${card.accent}15, ${card.accent}06)`
                        : `linear-gradient(135deg, ${card.accent}0e, ${card.accent}05)`;
                    }}
                  >
                    {/* Decorative circle */}
                    <div
                      className="absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-10"
                      style={{ background: card.accent }}
                    />
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${card.accent}, ${card.accent}cc)`,
                        boxShadow: `0 6px 18px ${card.accent}40`,
                      }}
                    >
                      <i className={`${card.icon} text-white text-[18px]`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-bold leading-tight" style={{ color: nameColor }}>{card.label}</p>
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

            {/* Secondary Cards — küçük grid */}
            <div
              className="px-6 pb-5"
              style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)'}` }}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] mt-4 mb-3.5 flex items-center gap-2"
                style={{ color: isDark ? '#334155' : '#CBD5E1' }}>
                <span className="w-3 h-px inline-block" style={{ background: isDark ? '#334155' : '#CBD5E1' }} />
                Diğer İşlemler
              </p>
              <div className="grid grid-cols-4 gap-2">
                {quickCards.filter(c => !c.primary).map(card => (
                  <button
                    key={card.id}
                    onClick={() => handleQuickCard(card)}
                    className="flex flex-col items-center gap-2 py-3.5 px-2 rounded-2xl text-center cursor-pointer transition-all duration-200"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(15,23,42,0.025)',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.055)' : 'rgba(15,23,42,0.065)'}`,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.background = isDark ? `${card.accent}14` : `${card.accent}0c`;
                      e.currentTarget.style.borderColor = `${card.accent}38`;
                      e.currentTarget.style.boxShadow = `0 10px 28px ${card.accent}20`;
                      const iconWrap = e.currentTarget.querySelector('.icon-wrap') as HTMLElement;
                      if (iconWrap) {
                        iconWrap.style.background = `linear-gradient(135deg, ${card.accent}, ${card.accent}cc)`;
                        iconWrap.style.boxShadow = `0 4px 12px ${card.accent}40`;
                      }
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
                      if (iconWrap) {
                        iconWrap.style.background = isDark ? `${card.accent}18` : `${card.accent}12`;
                        iconWrap.style.boxShadow = 'none';
                      }
                      const icon = e.currentTarget.querySelector('i') as HTMLElement;
                      if (icon) icon.style.color = card.accent;
                      const label = e.currentTarget.querySelector('.card-label') as HTMLElement;
                      if (label) label.style.color = isDark ? '#64748B' : '#94A3B8';
                    }}
                  >
                    <div
                      className="icon-wrap w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0 transition-all duration-200"
                      style={{ background: isDark ? `${card.accent}18` : `${card.accent}12` }}
                    >
                      <i className={`${card.icon} text-[15px] transition-colors duration-200`} style={{ color: card.accent }} />
                    </div>
                    <p
                      className="card-label text-[11px] font-semibold leading-tight transition-colors duration-200"
                      style={{ color: isDark ? '#64748B' : '#94A3B8' }}
                    >
                      {card.label}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div
              className="px-6 py-3.5 flex items-center justify-between"
              style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)'}` }}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)'}`,
                    color: isDark ? '#475569' : '#94A3B8',
                  }}
                >
                  ESC
                </span>
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
