import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';

const moduleTitles: Record<string, { label: string; icon: string }> = {
  dashboard: { label: 'Kontrol Paneli', icon: 'ri-dashboard-3-line' },
  firmalar: { label: 'Firmalar', icon: 'ri-building-2-line' },
  personeller: { label: 'Personeller', icon: 'ri-team-line' },
  evraklar: { label: 'Evrak Takibi', icon: 'ri-file-list-3-line' },
  egitimler: { label: 'Eğitim Yönetimi', icon: 'ri-graduation-cap-line' },
  muayeneler: { label: 'Sağlık Evrakları', icon: 'ri-heart-pulse-line' },
  tutanaklar: { label: 'Tutanaklar', icon: 'ri-article-line' },
  uygunsuzluklar: { label: 'Saha Denetim', icon: 'ri-map-pin-user-line' },
  ekipmanlar: { label: 'Ekipman Kontrolleri', icon: 'ri-tools-line' },
  gorevler: { label: 'Görevler', icon: 'ri-task-line' },
  raporlar: { label: 'Raporlar & Analiz', icon: 'ri-bar-chart-2-line' },
  ayarlar: { label: 'Ayarlar', icon: 'ri-settings-4-line' },
};

const quickCards = [
  { id: 'firma', label: 'Firma Ekle', desc: 'Yeni firma kaydı', icon: 'ri-building-2-line', gradient: 'linear-gradient(135deg, #1D4ED8, #3B82F6)', accent: '#3B82F6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)', module: 'firmalar' },
  { id: 'personel', label: 'Personel Ekle', desc: 'Çalışan kaydı', icon: 'ri-user-add-line', gradient: 'linear-gradient(135deg, #065F46, #10B981)', accent: '#10B981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', module: 'personeller' },
  { id: 'evrak', label: 'Evrak Ekle', desc: 'Belge yükle', icon: 'ri-file-add-line', gradient: 'linear-gradient(135deg, #92400E, #F59E0B)', accent: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', module: 'evraklar' },
  { id: 'egitim', label: 'Eğitim Ekle', desc: 'Eğitim planı', icon: 'ri-graduation-cap-line', gradient: 'linear-gradient(135deg, #3730A3, #6366F1)', accent: '#6366F1', bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.2)', module: 'egitimler' },
  { id: 'muayene', label: 'Sağlık Evrakı', desc: 'Sağlık belgesi', icon: 'ri-heart-pulse-line', gradient: 'linear-gradient(135deg, #9F1239, #F43F5E)', accent: '#F43F5E', bg: 'rgba(244,63,94,0.08)', border: 'rgba(244,63,94,0.2)', module: 'muayeneler' },
  { id: 'tutanak', label: 'Tutanak Ekle', desc: 'Tutanak oluştur', icon: 'ri-article-line', gradient: 'linear-gradient(135deg, #0F766E, #14B8A6)', accent: '#14B8A6', bg: 'rgba(20,184,166,0.08)', border: 'rgba(20,184,166,0.2)', module: 'tutanaklar' },
  { id: 'sahadenetim', label: 'Saha Denetim', desc: 'Denetim kaydı', icon: 'ri-map-pin-user-line', gradient: 'linear-gradient(135deg, #7C2D12, #EA580C)', accent: '#EA580C', bg: 'rgba(234,88,12,0.08)', border: 'rgba(234,88,12,0.2)', module: 'uygunsuzluklar' },
  { id: 'ekipman', label: 'Ekipman Kontrolü', desc: 'Kontrol kaydı', icon: 'ri-tools-line', gradient: 'linear-gradient(135deg, #134E4A, #14B8A6)', accent: '#0D9488', bg: 'rgba(13,148,136,0.08)', border: 'rgba(13,148,136,0.2)', module: 'ekipmanlar' },
  { id: 'gorev', label: 'Görev Ekle', desc: 'Yeni görev', icon: 'ri-task-line', gradient: 'linear-gradient(135deg, #4C1D95, #8B5CF6)', accent: '#8B5CF6', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.2)', module: 'gorevler' },
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

export default function Header() {
  const {
    activeModule, setActiveModule, sidebarCollapsed, setSidebarCollapsed,
    currentUser, setQuickCreate, theme, toggleTheme,
    bildirimler, okunmamisBildirimSayisi, bildirimOku, tumunuOku,
    firmalar, personeller, evraklar, tutanaklar,
  } = useApp();
  const { logout, user } = useAuth();

  const [quickOpen, setQuickOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const isDark = theme === 'dark';

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
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchFocus(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
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

  const handleQuickCard = (card: typeof quickCards[0]) => {
    setQuickOpen(false);
    setActiveModule(card.module);
    setQuickCreate(card.module);
  };

  const currentModule = moduleTitles[activeModule];
  const showSearchDropdown = searchFocus && (searchResults.length > 0 || search.trim().length > 0);

  const headerBg = isDark ? 'rgba(8,12,20,0.92)' : 'rgba(255,255,255,0.96)';
  const headerBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.1)';
  const textColor = isDark ? '#64748B' : '#64748B';
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)';
  const inputBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.1)';
  const iconBtnBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)';
  const iconBtnBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.1)';
  const breadcrumbColor = isDark ? '#334155' : '#94A3B8';
  const nameColor = isDark ? '#E2E8F0' : '#0F172A';
  const dropdownBg = isDark ? 'rgba(10,15,25,0.98)' : 'rgba(255,255,255,0.99)';
  const dropdownBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)';

  const urgentBildirimleri = bildirimler.filter(b => b.tip === 'evrak_surecek').slice(0, 5);
  const dolmusBildirimleri = bildirimler.filter(b => b.tip === 'evrak_dolmus').slice(0, 3);
  const displayBildirimler = [...urgentBildirimleri, ...dolmusBildirimleri].slice(0, 8);

  return (
    <>
      <header
        className={`fixed top-0 right-0 z-30 h-16 flex items-center px-5 gap-4 transition-all duration-300 ${sidebarCollapsed ? 'left-[68px]' : 'left-[260px]'}`}
        style={{
          background: headerBg,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: `1px solid ${headerBorder}`,
          transition: 'left 0.3s ease, background 0.3s ease',
        }}
      >
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200 hover:scale-105"
          style={{ color: textColor, background: iconBtnBg, border: `1px solid ${iconBtnBorder}` }}
        >
          <i className={`${sidebarCollapsed ? 'ri-menu-unfold-line' : 'ri-menu-fold-line'} text-sm`} />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-6 h-6 flex items-center justify-center">
            <i className={`${currentModule?.icon || 'ri-home-line'} text-sm`} style={{ color: '#3B82F6' }} />
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <span style={{ color: breadcrumbColor }}>ISG Denetim</span>
            <i className="ri-arrow-right-s-line text-xs" style={{ color: breadcrumbColor }} />
            <span className="font-semibold" style={{ color: nameColor }}>{currentModule?.label || activeModule}</span>
          </div>
        </div>

        <div className="flex-1" />

        {/* Global Search */}
        <div className="relative hidden md:flex items-center" ref={searchRef}>
          <i className="ri-search-line absolute left-3 text-sm z-10" style={{ color: '#475569' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => setSearchFocus(true)}
            placeholder="Hızlı ara... (firma, personel, evrak)"
            className="w-64 pl-9 pr-4 py-2 text-sm rounded-xl outline-none transition-all duration-200"
            style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: isDark ? '#94A3B8' : '#334155', fontSize: '13px' }}
            onFocus={e => { setSearchFocus(true); e.currentTarget.style.background = 'rgba(59,130,246,0.06)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}
            onBlur={e => { e.currentTarget.style.background = inputBg; e.currentTarget.style.borderColor = inputBorder; e.currentTarget.style.boxShadow = 'none'; }}
          />
          {showSearchDropdown && (
            <div
              className="absolute right-0 top-11 w-80 py-1 z-50 animate-slide-up"
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
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#475569' }}>{searchResults.length} sonuç bulundu</p>
                  </div>
                  {searchResults.map(result => (
                    <button key={result.id} onClick={() => { setActiveModule(result.module); setSearch(''); setSearchFocus(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all duration-150 text-left"
                      style={{ borderRadius: '8px' }}
                      onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(59,130,246,0.06)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: `${result.color}18` }}>
                        <i className={`${result.icon} text-sm`} style={{ color: result.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: `${result.color}18`, color: result.color }}>{result.type}</span>
                        </div>
                        <p className="text-sm font-medium truncate mt-0.5" style={{ color: isDark ? '#E2E8F0' : '#0F172A' }}>{result.label}</p>
                        <p className="text-xs truncate" style={{ color: '#64748B' }}>{result.sub}</p>
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
          className="w-9 h-9 flex items-center justify-center rounded-xl cursor-pointer transition-all duration-200"
          title={isDark ? 'Açık Temaya Geç' : 'Koyu Temaya Geç'}
          style={{ background: iconBtnBg, border: `1px solid ${iconBtnBorder}` }}
        >
          <i className={`${isDark ? 'ri-sun-line' : 'ri-moon-line'} text-base`} style={{ color: isDark ? '#F59E0B' : '#475569' }} />
        </button>

        {/* Quick Add */}
        <button onClick={() => { setQuickOpen(true); setNotifOpen(false); }} className="btn-primary">
          <i className="ri-add-circle-line text-base" />
          <span className="hidden sm:inline">Hızlı Ekle</span>
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setNotifOpen(!notifOpen); setQuickOpen(false); }}
            className="w-9 h-9 flex items-center justify-center rounded-xl cursor-pointer transition-all duration-200 relative"
            style={{ background: iconBtnBg, border: `1px solid ${iconBtnBorder}` }}
          >
            <i className="ri-notification-3-line text-base" style={{ color: textColor }} />
            {okunmamisBildirimSayisi > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white rounded-full px-1"
                style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)', boxShadow: '0 0 6px rgba(239,68,68,0.6)' }}>
                {okunmamisBildirimSayisi > 9 ? '9+' : okunmamisBildirimSayisi}
              </span>
            )}
          </button>
          {notifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 top-12 z-50 w-80 animate-slide-up overflow-hidden"
                style={{ background: dropdownBg, border: `1px solid ${dropdownBorder}`, borderRadius: '14px', boxShadow: '0 25px 60px rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)' }}>
                <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${dropdownBorder}` }}>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold" style={{ color: isDark ? '#E2E8F0' : '#0F172A' }}>Bildirimler</p>
                    {okunmamisBildirimSayisi > 0 && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.15)', color: '#F87171' }}>{okunmamisBildirimSayisi} okunmamış</span>
                    )}
                  </div>
                  {okunmamisBildirimSayisi > 0 && (
                    <button onClick={tumunuOku} className="text-xs cursor-pointer" style={{ color: '#3B82F6' }}>Tümünü okundu</button>
                  )}
                </div>
                {displayBildirimler.length === 0 ? (
                  <div className="py-10 px-4 text-center">
                    <div className="w-12 h-12 flex items-center justify-center rounded-2xl mx-auto mb-3" style={{ background: 'rgba(16,185,129,0.12)' }}>
                      <i className="ri-check-double-line text-xl" style={{ color: '#10B981' }} />
                    </div>
                    <p className="text-sm font-medium" style={{ color: isDark ? '#E2E8F0' : '#334155' }}>Tüm evraklar güncel</p>
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto">
                    {displayBildirimler.map(b => (
                      <div key={b.id} className="px-4 py-3 cursor-pointer" style={{ borderBottom: `1px solid ${dropdownBorder}`, opacity: b.okundu ? 0.6 : 1 }}
                        onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(59,130,246,0.04)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        onClick={() => bildirimOku(b.id)}>
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 mt-0.5"
                            style={{ background: b.tip === 'evrak_surecek' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)' }}>
                            <i className={b.tip === 'evrak_surecek' ? 'ri-timer-line' : 'ri-error-warning-line'}
                              style={{ color: b.tip === 'evrak_surecek' ? '#F59E0B' : '#EF4444', fontSize: '14px' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-semibold truncate" style={{ color: isDark ? '#E2E8F0' : '#0F172A' }}>{b.mesaj}</p>
                              {!b.okundu && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#3B82F6' }} />}
                            </div>
                            <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: '#64748B' }}>{b.detay}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); setQuickOpen(false); }}
            className="flex items-center gap-2.5 pl-3 cursor-pointer transition-all duration-200 rounded-xl py-1 pr-1"
            style={{ borderLeft: `1px solid ${headerBorder}`, background: profileOpen ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)') : 'transparent' }}
          >
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)', boxShadow: '0 2px 10px rgba(99,102,241,0.4)' }}>
              {(currentUser.ad || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-semibold leading-tight" style={{ color: nameColor }}>{currentUser.ad || 'Kullanıcı'}</p>
              <p className="text-[10px] leading-tight" style={{ color: '#475569' }}>{currentUser.rol}</p>
            </div>
            <i className={`ri-arrow-down-s-line text-sm hidden md:block transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} style={{ color: '#475569' }} />
          </button>
          {profileOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
              <div className="absolute right-0 top-12 z-50 w-56 animate-slide-up overflow-hidden"
                style={{ background: dropdownBg, border: `1px solid ${dropdownBorder}`, borderRadius: '14px', boxShadow: '0 25px 60px rgba(0,0,0,0.45)', backdropFilter: 'blur(20px)' }}>
                <div className="px-4 py-3" style={{ borderBottom: `1px solid ${dropdownBorder}` }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}>
                      {(currentUser.ad || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate" style={{ color: isDark ? '#E2E8F0' : '#0F172A' }}>{currentUser.ad || 'Kullanıcı'}</p>
                      <p className="text-[10px] truncate mt-0.5" style={{ color: '#64748B' }}>{user?.email || currentUser.email}</p>
                      <span className="inline-block text-[9px] font-semibold px-2 py-0.5 rounded-full mt-1"
                        style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)' }}>
                        {currentUser.rol}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="py-1.5">
                  <button onClick={() => { setActiveModule('ayarlar'); setProfileOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-all duration-150"
                    onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(59,130,246,0.1)' }}>
                      <i className="ri-settings-4-line text-sm" style={{ color: '#3B82F6' }} />
                    </div>
                    <span className="text-sm font-medium" style={{ color: isDark ? '#CBD5E1' : '#334155' }}>Ayarlar</span>
                  </button>
                  <div className="mx-3 my-1" style={{ height: '1px', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.07)' }} />
                  <button onClick={() => { setProfileOpen(false); logout(); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-all duration-150"
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(239,68,68,0.1)' }}>
                      <i className="ri-logout-box-r-line text-sm" style={{ color: '#EF4444' }} />
                    </div>
                    <span className="text-sm font-medium" style={{ color: '#EF4444' }}>Oturumu Kapat</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Quick Add Modal */}
      {quickOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) setQuickOpen(false); }}>
          <div className="w-full max-w-3xl animate-slide-up"
            style={{ background: isDark ? 'linear-gradient(145deg, #0D1220 0%, #111827 100%)' : '#FFFFFF', border: `1px solid ${dropdownBorder}`, borderRadius: '20px', boxShadow: '0 40px 80px rgba(0,0,0,0.7)' }}>
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: `1px solid ${dropdownBorder}` }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)', boxShadow: '0 4px 15px rgba(99,102,241,0.4)' }}>
                  <i className="ri-add-line text-white text-lg" />
                </div>
                <div>
                  <h2 className="text-base font-bold" style={{ color: nameColor }}>Hızlı Ekle</h2>
                  <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>Sisteme hızlı kayıt ekleyin</p>
                </div>
              </div>
              <button onClick={() => setQuickOpen(false)} className="w-9 h-9 flex items-center justify-center rounded-xl cursor-pointer"
                style={{ background: iconBtnBg, border: `1px solid ${iconBtnBorder}`, color: '#64748B' }}>
                <i className="ri-close-line text-base" />
              </button>
            </div>
            <div className="p-5 grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {quickCards.map(card => (
                <button key={card.id} onClick={() => handleQuickCard(card)}
                  className="group flex flex-col items-start gap-3 p-4 rounded-xl text-left cursor-pointer transition-all duration-200"
                  style={{ background: card.bg, border: `1px solid ${card.border}` }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'; e.currentTarget.style.borderColor = card.accent; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = card.border; }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: card.gradient, boxShadow: `0 4px 12px ${card.accent}35` }}>
                    <i className={`${card.icon} text-white text-base`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white leading-tight">{card.label}</p>
                    <p className="text-[11px] mt-1" style={{ color: '#64748B' }}>{card.desc}</p>
                  </div>
                  <div className="mt-auto flex items-center gap-1 text-[11px] font-semibold" style={{ color: card.accent }}>
                    <span>Ekle</span><i className="ri-arrow-right-line text-xs" />
                  </div>
                </button>
              ))}
            </div>
            <div className="px-5 py-3 flex items-center justify-end" style={{ borderTop: `1px solid ${dropdownBorder}` }}>
              <button onClick={() => setQuickOpen(false)} className="btn-secondary">Kapat</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
