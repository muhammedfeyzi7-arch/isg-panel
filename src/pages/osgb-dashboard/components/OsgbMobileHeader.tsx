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

const tabSubtitles: Record<Tab, string> = {
  dashboard:  'Hoş geldiniz',
  firmalar:   'Müşteri firmaları',
  uzmanlar:   'Gezici uzmanlar',
  ziyaretler: 'Saha ziyaretleri',
  raporlar:   'Raporlar & analizler',
  analitik:   'Harita & analitik',
  copkutusu:  'Silinen kayıtlar',
  ayarlar:    'Hesap & sistem',
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
  const [profileOpen, setProfileOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const showAddBtn = activeTab === 'firmalar' || activeTab === 'uzmanlar' || activeTab === 'dashboard';

  const handleAdd = () => {
    if (activeTab === 'firmalar') { onFirmaEkle?.(); return; }
    if (activeTab === 'uzmanlar') { onUzmanEkle?.(); return; }
    setQuickAddOpen(true);
  };

  const addLabel = activeTab === 'firmalar' ? '+ Firma Ekle' : activeTab === 'uzmanlar' ? '+ Personel Ekle' : '+ Ekle';

  return (
    <>
      {/* ── MOBILE HEADER ── */}
      <header
        className="fixed top-0 left-0 right-0 z-40 lg:hidden"
        style={{
          background: isDark
            ? 'rgba(10,14,26,0.97)'
            : 'rgba(248,250,252,0.97)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        }}
      >
        {/* Safe area top */}
        <div style={{ height: 'env(safe-area-inset-top, 0px)' }} />

        {/* Main header row */}
        <div className="flex items-center justify-between px-5 py-3">
          {/* Left: Title block */}
          <div className="flex-1 min-w-0">
            <p
              className="text-[11px] font-semibold tracking-wide uppercase mb-0.5"
              style={{ color: isDark ? 'rgba(148,163,184,0.7)' : 'rgba(100,116,139,0.8)' }}
            >
              {orgName}
            </p>
            <h1
              className="text-[20px] font-black leading-none tracking-tight truncate"
              style={{ color: isDark ? '#F1F5F9' : '#0F172A' }}
            >
              {tabTitles[activeTab]}
            </h1>
          </div>

          {/* Right: theme toggle + avatar */}
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            {/* Theme toggle */}
            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                className="w-9 h-9 flex items-center justify-center rounded-2xl cursor-pointer transition-all active:scale-95"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.06)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                }}
              >
                <i
                  className={`${isDark ? 'ri-sun-line' : 'ri-moon-line'} text-[15px]`}
                  style={{ color: isDark ? '#FBBF24' : '#64748B' }}
                />
              </button>
            )}

            {/* Profile avatar */}
            <button
              onClick={() => setProfileOpen(v => !v)}
              className="w-9 h-9 flex items-center justify-center rounded-2xl cursor-pointer text-sm font-black text-white transition-all active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)',
                boxShadow: '0 2px 8px rgba(14,165,233,0.35)',
              }}
            >
              {orgName.charAt(0).toUpperCase()}
            </button>
          </div>
        </div>

        {/* Subtitle + Add button row */}
        <div className="flex items-center justify-between px-5 pb-3">
          <p
            className="text-[12px] font-medium"
            style={{ color: isDark ? 'rgba(148,163,184,0.55)' : 'rgba(100,116,139,0.6)' }}
          >
            {tabSubtitles[activeTab]}
          </p>

          {showAddBtn && (
            <button
              onClick={handleAdd}
              className="flex items-center gap-1.5 px-3.5 h-7 rounded-full text-white text-[11px] font-bold cursor-pointer whitespace-nowrap transition-all active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)',
                boxShadow: '0 2px 6px rgba(14,165,233,0.3)',
              }}
            >
              <i className="ri-add-line text-[13px]" />
              {addLabel}
            </button>
          )}
        </div>
      </header>

      {/* ── PROFILE BOTTOM SHEET ── */}
      {profileOpen && (
        <div
          className="fixed inset-0 z-[60] lg:hidden"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(12px)' }}
          onClick={() => setProfileOpen(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-[28px] overflow-hidden"
            style={{
              background: isDark ? '#111827' : '#FFFFFF',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
              paddingBottom: 'env(safe-area-inset-bottom, 20px)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div
                className="w-9 h-1 rounded-full"
                style={{ background: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }}
              />
            </div>

            {/* Profile info */}
            <div
              className="mx-4 mt-2 mb-3 p-4 rounded-2xl"
              style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`,
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black text-white flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)',
                    boxShadow: '0 4px 12px rgba(14,165,233,0.3)',
                  }}
                >
                  {orgName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p
                    className="text-[15px] font-bold"
                    style={{ color: isDark ? '#F1F5F9' : '#0F172A' }}
                  >
                    {orgName}
                  </p>
                  <p className="text-[12px] font-semibold mt-0.5" style={{ color: '#0EA5E9' }}>
                    OSGB Admin
                  </p>
                </div>
              </div>
            </div>

            {/* Menu items */}
            <div className="px-4 pb-2 space-y-2">
              <button
                onClick={() => { setActiveTab?.('ayarlar'); setProfileOpen(false); }}
                className="w-full flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-all active:scale-[0.98]"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`,
                }}
              >
                <div
                  className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0"
                  style={{ background: 'rgba(100,116,139,0.12)' }}
                >
                  <i className="ri-settings-4-line text-[17px]" style={{ color: '#64748B' }} />
                </div>
                <span
                  className="text-[14px] font-semibold flex-1 text-left"
                  style={{ color: isDark ? '#E2E8F0' : '#1E293B' }}
                >
                  Ayarlar
                </span>
                <i
                  className="ri-arrow-right-s-line text-[18px]"
                  style={{ color: isDark ? 'rgba(148,163,184,0.4)' : 'rgba(100,116,139,0.4)' }}
                />
              </button>

              <button
                onClick={() => { logout(); setProfileOpen(false); }}
                className="w-full flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-all active:scale-[0.98]"
                style={{
                  background: 'rgba(239,68,68,0.06)',
                  border: '1px solid rgba(239,68,68,0.15)',
                }}
              >
                <div
                  className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0"
                  style={{ background: 'rgba(239,68,68,0.1)' }}
                >
                  <i className="ri-logout-box-r-line text-[17px]" style={{ color: '#EF4444' }} />
                </div>
                <span className="text-[14px] font-bold flex-1 text-left" style={{ color: '#EF4444' }}>
                  Çıkış Yap
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── QUICK ADD BOTTOM SHEET (dashboard) ── */}
      {quickAddOpen && (
        <div
          className="fixed inset-0 z-[60] lg:hidden"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(12px)' }}
          onClick={() => setQuickAddOpen(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-[28px] overflow-hidden"
            style={{
              background: isDark ? '#111827' : '#FFFFFF',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
              paddingBottom: 'env(safe-area-inset-bottom, 20px)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div
                className="w-9 h-1 rounded-full"
                style={{ background: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }}
              />
            </div>

            <div className="px-5 pt-3 pb-2">
              <p
                className="text-[18px] font-black"
                style={{ color: isDark ? '#F1F5F9' : '#0F172A' }}
              >
                Hızlı Ekle
              </p>
              <p
                className="text-[13px] mt-0.5"
                style={{ color: isDark ? 'rgba(148,163,184,0.6)' : 'rgba(100,116,139,0.7)' }}
              >
                Ne eklemek istiyorsunuz?
              </p>
            </div>

            <div className="px-4 pb-2 space-y-2.5 mt-2">
              <button
                onClick={() => { onFirmaEkle?.(); setQuickAddOpen(false); }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all active:scale-[0.98]"
                style={{
                  background: 'rgba(14,165,233,0.07)',
                  border: '1.5px solid rgba(14,165,233,0.18)',
                }}
              >
                <div
                  className="w-12 h-12 flex items-center justify-center rounded-2xl flex-shrink-0"
                  style={{ background: 'rgba(14,165,233,0.12)' }}
                >
                  <i className="ri-building-2-line text-[20px]" style={{ color: '#0EA5E9' }} />
                </div>
                <div className="text-left flex-1">
                  <p
                    className="text-[15px] font-bold"
                    style={{ color: isDark ? '#F1F5F9' : '#0F172A' }}
                  >
                    Firma Ekle
                  </p>
                  <p
                    className="text-[12px] mt-0.5"
                    style={{ color: isDark ? 'rgba(148,163,184,0.6)' : 'rgba(100,116,139,0.7)' }}
                  >
                    Yeni müşteri firması oluştur
                  </p>
                </div>
                <i className="ri-arrow-right-s-line text-[20px]" style={{ color: '#0EA5E9' }} />
              </button>

              <button
                onClick={() => { onUzmanEkle?.(); setQuickAddOpen(false); }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all active:scale-[0.98]"
                style={{
                  background: 'rgba(14,165,233,0.07)',
                  border: '1.5px solid rgba(14,165,233,0.18)',
                }}
              >
                <div
                  className="w-12 h-12 flex items-center justify-center rounded-2xl flex-shrink-0"
                  style={{ background: 'rgba(14,165,233,0.12)' }}
                >
                  <i className="ri-user-add-line text-[20px]" style={{ color: '#0EA5E9' }} />
                </div>
                <div className="text-left flex-1">
                  <p
                    className="text-[15px] font-bold"
                    style={{ color: isDark ? '#F1F5F9' : '#0F172A' }}
                  >
                    Personel Ekle
                  </p>
                  <p
                    className="text-[12px] mt-0.5"
                    style={{ color: isDark ? 'rgba(148,163,184,0.6)' : 'rgba(100,116,139,0.7)' }}
                  >
                    Uzman veya hekim ekle
                  </p>
                </div>
                <i className="ri-arrow-right-s-line text-[20px]" style={{ color: '#0EA5E9' }} />
              </button>

              <button
                onClick={() => setQuickAddOpen(false)}
                className="w-full py-3.5 rounded-2xl text-[14px] font-semibold cursor-pointer transition-all active:scale-[0.98]"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`,
                  color: isDark ? 'rgba(148,163,184,0.7)' : 'rgba(100,116,139,0.8)',
                }}
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
