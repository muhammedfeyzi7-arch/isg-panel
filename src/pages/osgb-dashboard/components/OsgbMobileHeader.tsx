import { useState } from 'react';
import { useAuth } from '@/store/AuthContext';

type Tab = 'dashboard' | 'firmalar' | 'uzmanlar' | 'ziyaretler' | 'raporlar' | 'analitik' | 'copkutusu' | 'ayarlar';

interface OsgbMobileHeaderProps {
  activeTab: Tab;
  orgName: string;
  onFirmaEkle?: () => void;
  onUzmanEkle?: () => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  setActiveTab?: (tab: Tab) => void;
}

const tabTitles: Record<Tab, string> = {
  dashboard:  'Genel Bakış',
  firmalar:   'Firmalar',
  uzmanlar:   'Personel',
  ziyaretler: 'Ziyaretler',
  raporlar:   'Raporlar',
  analitik:   'Analiz',
  copkutusu:  'Çöp Kutusu',
  ayarlar:    'Ayarlar',
};

export default function OsgbMobileHeader({
  activeTab,
  orgName,
  onFirmaEkle,
  onUzmanEkle,
  theme = 'dark',
  onToggleTheme,
  setActiveTab,
}: OsgbMobileHeaderProps) {
  const { logout } = useAuth();
  const isDark = theme === 'dark';
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const showAddBtn = activeTab === 'firmalar' || activeTab === 'uzmanlar' || activeTab === 'dashboard';

  const handleAdd = () => {
    if (activeTab === 'firmalar') { onFirmaEkle?.(); return; }
    if (activeTab === 'uzmanlar') { onUzmanEkle?.(); return; }
    setMenuOpen(v => !v);
  };

  const addLabel = activeTab === 'firmalar' ? 'Firma Ekle' : activeTab === 'uzmanlar' ? 'Personel Ekle' : 'Ekle';

  return (
    <>
      {/* ── MOBILE HEADER ── */}
      <header
        className="fixed top-0 left-0 right-0 z-40 lg:hidden"
        style={{
          background: isDark ? 'var(--bg-app)' : '#f8fafc',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        {/* Top bar: org name + icons */}
        <div
          className="flex items-center justify-between px-5 pt-4 pb-1"
        >
          {/* Org name + greeting */}
          <div>
            <p className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
              {orgName}
            </p>
            <h1 className="text-[22px] font-black leading-tight tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {tabTitles[activeTab]}
            </h1>
          </div>

          {/* Right icons */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                className="w-9 h-9 flex items-center justify-center rounded-full cursor-pointer"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <i
                  className={`${isDark ? 'ri-sun-line' : 'ri-moon-line'} text-base`}
                  style={{ color: isDark ? '#F59E0B' : '#475569' }}
                />
              </button>
            )}

            {/* Settings */}
            <button
              onClick={() => setActiveTab?.('ayarlar')}
              className="w-9 h-9 flex items-center justify-center rounded-full cursor-pointer"
              style={{
                background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <i className="ri-settings-3-line text-base" style={{ color: 'var(--text-muted)' }} />
            </button>

            {/* Profile avatar */}
            <button
              onClick={() => setProfileOpen(v => !v)}
              className="w-9 h-9 flex items-center justify-center rounded-full cursor-pointer text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}
            >
              {orgName.charAt(0).toUpperCase()}
            </button>
          </div>
        </div>

        {/* Add button row — only when relevant */}
        {showAddBtn && (
          <div className="px-5 pb-3 pt-2">
            <button
              onClick={handleAdd}
              className="flex items-center gap-2 px-4 h-9 rounded-full text-white text-sm font-bold cursor-pointer whitespace-nowrap"
              style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}
            >
              <i className="ri-add-line text-base" />
              {addLabel}
            </button>
          </div>
        )}

        {/* Subtle bottom border */}
        <div style={{ height: '1px', background: 'var(--border-subtle)' }} />
      </header>

      {/* ── PROFILE BOTTOM SHEET ── */}
      {profileOpen && (
        <div
          className="fixed inset-0 z-[60] lg:hidden"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
          onClick={() => setProfileOpen(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-3xl overflow-hidden"
            style={{
              background: isDark ? 'var(--bg-card-solid)' : '#fff',
              border: '1px solid var(--border-subtle)',
              paddingBottom: 'env(safe-area-inset-bottom, 16px)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-subtle)' }} />
            </div>

            {/* Org info */}
            <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black text-white"
                  style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}
                >
                  {orgName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{orgName}</p>
                  <p className="text-xs font-semibold" style={{ color: '#0EA5E9' }}>OSGB Admin</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 space-y-2">
              <button
                onClick={() => { setActiveTab?.('ayarlar'); setProfileOpen(false); }}
                className="w-full flex items-center gap-3 p-4 rounded-2xl cursor-pointer"
                style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)' }}
              >
                <div className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ background: 'rgba(100,116,139,0.1)' }}>
                  <i className="ri-settings-4-line text-lg" style={{ color: '#64748B' }} />
                </div>
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Ayarlar</span>
                <i className="ri-arrow-right-s-line ml-auto" style={{ color: 'var(--text-muted)' }} />
              </button>

              <button
                onClick={() => { logout(); setProfileOpen(false); }}
                className="w-full flex items-center gap-3 p-4 rounded-2xl cursor-pointer"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}
              >
                <div className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ background: 'rgba(239,68,68,0.1)' }}>
                  <i className="ri-logout-box-r-line text-lg" style={{ color: '#EF4444' }} />
                </div>
                <span className="text-sm font-bold" style={{ color: '#EF4444' }}>Çıkış Yap</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── QUICK ADD BOTTOM SHEET (dashboard) ── */}
      {menuOpen && activeTab === 'dashboard' && (
        <div
          className="fixed inset-0 z-[60] lg:hidden"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-3xl overflow-hidden"
            style={{
              background: isDark ? 'var(--bg-card-solid)' : '#fff',
              border: '1px solid var(--border-subtle)',
              paddingBottom: 'env(safe-area-inset-bottom, 16px)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-subtle)' }} />
            </div>

            <div className="px-6 pb-2">
              <p className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>Hızlı Ekle</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Ne eklemek istiyorsunuz?</p>
            </div>

            <div className="p-4 space-y-3">
              <button
                onClick={() => { onFirmaEkle?.(); setMenuOpen(false); }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl cursor-pointer"
                style={{ background: 'rgba(14,165,233,0.08)', border: '1.5px solid rgba(14,165,233,0.2)' }}
              >
                <div className="w-12 h-12 flex items-center justify-center rounded-2xl" style={{ background: 'rgba(14,165,233,0.15)' }}>
                  <i className="ri-building-2-line text-xl" style={{ color: '#0EA5E9' }} />
                </div>
                <div className="text-left">
                  <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Firma Ekle</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Yeni müşteri firması oluştur</p>
                </div>
                <i className="ri-arrow-right-s-line text-xl ml-auto" style={{ color: '#0EA5E9' }} />
              </button>

              <button
                onClick={() => { onUzmanEkle?.(); setMenuOpen(false); }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl cursor-pointer"
                style={{ background: 'rgba(14,165,233,0.08)', border: '1.5px solid rgba(14,165,233,0.2)' }}
              >
                <div className="w-12 h-12 flex items-center justify-center rounded-2xl" style={{ background: 'rgba(14,165,233,0.15)' }}>
                  <i className="ri-user-add-line text-xl" style={{ color: '#0EA5E9' }} />
                </div>
                <div className="text-left">
                  <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Personel Ekle</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Uzman veya hekim ekle</p>
                </div>
                <i className="ri-arrow-right-s-line text-xl ml-auto" style={{ color: '#0EA5E9' }} />
              </button>

              <button
                onClick={() => setMenuOpen(false)}
                className="w-full py-3.5 rounded-2xl text-sm font-bold cursor-pointer"
                style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
