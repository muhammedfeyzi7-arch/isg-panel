import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/store/AppContext';
import { useAuth } from '@/store/AuthContext';
import { supabase } from '@/lib/supabase';
import HekimSidebar, { type HekimTab } from './components/HekimSidebar';
import HekimGenelBakisTab from './components/HekimGenelBakisTab';
import HekimFirmalarTab from './components/HekimFirmalarTab';
import HekimPersonellerTab from './components/HekimPersonellerTab';
import HekimSaglikTab from './components/HekimSaglikTab';
import HekimCopTab from './components/HekimCopTab';
import HekimIsKazasiTab from './components/HekimIsKazasiTab';
import ZiyaretCheckIn from '@/pages/saha/components/ZiyaretCheckIn';

const ACCENT = '#0EA5E9';
const ACCENT_DARK = '#0284C7';

interface FirmaOption {
  id: string;
  name: string;
}

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518';

export default function HekimPage() {
  const { org, theme } = useApp();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<HekimTab>('genel_bakis');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [atanmisFirmaIds, setAtanmisFirmaIds] = useState<string[]>([]);
  const [firmaOptions, setFirmaOptions] = useState<FirmaOption[]>([]);
  const [aktiveFirmaId, setAktiveFirmaId] = useState<string | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  const [orgId, setOrgId] = useState('');
  const [loading, setLoading] = useState(true);

  const isDark = theme === 'dark';
  const SIDEBAR_WIDTH = collapsed ? 64 : 220;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!user || !org) return;
    const fetchFirmalar = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('user_organizations')
          .select('organization_id, active_firm_ids')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (data) {
          const baseOrgId = data.organization_id;
          setOrgId(baseOrgId);
          const firmIds: string[] =
            Array.isArray(data.active_firm_ids) && data.active_firm_ids.length > 0
              ? data.active_firm_ids
              : [baseOrgId];
          setAtanmisFirmaIds(firmIds);

          const { data: orgs } = await supabase
            .from('organizations')
            .select('id, name')
            .in('id', firmIds);

          const options: FirmaOption[] = (orgs ?? []).map(o => ({ id: o.id, name: o.name }));
          setFirmaOptions(options);
          if (options.length === 1) setAktiveFirmaId(options[0].id);
        }
      } catch (err) {
        console.error('[HekimPage] fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFirmalar();
  }, [user?.id, org?.id]);

  const goruntulenenFirmaIds = aktiveFirmaId ? [aktiveFirmaId] : atanmisFirmaIds;
  const aktifFirmaAd = aktiveFirmaId
    ? firmaOptions.find(f => f.id === aktiveFirmaId)?.name ?? ''
    : null;

  const borderColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = isDark ? '#64748b' : '#64748b';

  if (loading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center"
        style={{ background: isDark ? '#0f172a' : '#f8fafc', fontFamily: "'Inter', sans-serif" }}
      >
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); @keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div className="flex flex-col items-center gap-5">
          <div className="relative w-14 h-14 flex items-center justify-center">
            <div
              className="absolute inset-0 rounded-full"
              style={{ border: `3px solid rgba(14,165,233,0.15)`, borderTop: `3px solid ${ACCENT}`, animation: 'spin 0.9s linear infinite' }}
            />
            <img src={LOGO_URL} alt="ISG" className="w-7 h-7 object-contain relative z-10" />
          </div>
          <p className="text-sm font-semibold" style={{ color: isDark ? '#e2e8f0' : '#0f172a' }}>Hekim paneli yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!loading && atanmisFirmaIds.length === 0) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-8"
        style={{ background: isDark ? '#0f172a' : '#f8fafc', fontFamily: "'Inter', sans-serif" }}
      >
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');`}</style>
        <div className="text-center max-w-sm">
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6"
            style={{ background: `rgba(14,165,233,0.08)`, border: `1.5px solid rgba(14,165,233,0.18)` }}
          >
            <i className="ri-hospital-line text-3xl" style={{ color: ACCENT }} />
          </div>
          <h1 className="text-xl font-extrabold mb-2" style={{ color: isDark ? '#f1f5f9' : '#0f172a', letterSpacing: '-0.03em' }}>
            Henüz size firma atanmadı
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
            OSGB admininiz hesabınıza henüz müşteri firma ataması yapmadı.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="whitespace-nowrap mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
            style={{ background: `linear-gradient(135deg, ${ACCENT_DARK}, ${ACCENT})` }}
          >
            <i className="ri-refresh-line" />
            Yenile
          </button>
        </div>
      </div>
    );
  }

  const tabTitles: Record<HekimTab, { title: string; subtitle: string; icon: string }> = {
    genel_bakis: { title: 'Genel Bakış', subtitle: 'Tüm firmaların genel istatistikleri', icon: 'ri-dashboard-3-line' },
    firmalar: { title: 'Firmalar', subtitle: 'Atanmış firmaların listesi', icon: 'ri-building-3-line' },
    personeller: { title: 'Personel', subtitle: 'Tüm firmalardaki çalışanlar', icon: 'ri-group-line' },
    saglik: { title: 'Sağlık Durumu', subtitle: 'Periyodik muayene kayıtları', icon: 'ri-heart-pulse-line' },
    is_kazasi: { title: 'İş Kazaları', subtitle: 'Kaza kayıtları ve takibi', icon: 'ri-alert-line' },
    cop: { title: 'Çöp Kutusu', subtitle: 'Silinen kayıtları görüntüle', icon: 'ri-delete-bin-6-line' },
    ziyaret: { title: 'Saha Ziyareti', subtitle: 'QR ile firma ziyareti başlat', icon: 'ri-map-pin-user-line' },
  };

  const current = tabTitles[activeTab];

  const renderContent = () => {
    switch (activeTab) {
      case 'genel_bakis':
        return <HekimGenelBakisTab orgId={orgId} atanmisFirmaIds={goruntulenenFirmaIds} isDark={isDark} />;
      case 'firmalar':
        return <HekimFirmalarTab orgId={orgId} atanmisFirmaIds={goruntulenenFirmaIds} isDark={isDark} />;
      case 'personeller':
        return <HekimPersonellerTab atanmisFirmaIds={goruntulenenFirmaIds} isDark={isDark} />;
      case 'saglik':
        return <HekimSaglikTab atanmisFirmaIds={goruntulenenFirmaIds} isDark={isDark} />;
      case 'is_kazasi':
        return <HekimIsKazasiTab atanmisFirmaIds={goruntulenenFirmaIds} isDark={isDark} />;
      case 'cop':
        return <HekimCopTab atanmisFirmaIds={goruntulenenFirmaIds} isDark={isDark} />;
      case 'ziyaret':
        return (
          <div className="max-w-[520px] mx-auto pb-24">
            <div className="rounded-2xl overflow-hidden mb-5"
              style={{ background: isDark ? 'rgba(17,24,39,0.8)' : '#fff', border: `1px solid rgba(14,165,233,0.2)` }}>
              <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${ACCENT} 0%, #38BDF8 50%, ${ACCENT_DARK} 100%)` }} />
              <div className="px-4 pt-3.5 pb-3.5 flex items-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0"
                  style={{ background: `rgba(14,165,233,0.12)`, border: `1px solid rgba(14,165,233,0.25)` }}>
                  <i className="ri-map-pin-user-line text-lg" style={{ color: ACCENT }} />
                </div>
                <div>
                  <h2 className="text-sm font-bold" style={{ color: textPrimary, letterSpacing: '-0.02em' }}>Saha Ziyareti</h2>
                  <p className="text-[11px] mt-0.5" style={{ color: '#64748b' }}>QR ile firma check-in / check-out</p>
                </div>
                <span className="ml-auto flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-full whitespace-nowrap"
                  style={{ background: `rgba(14,165,233,0.1)`, color: ACCENT, border: `1px solid rgba(14,165,233,0.2)` }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: ACCENT }} />
                  Aktif
                </span>
              </div>
            </div>
            <ZiyaretCheckIn />
          </div>
        );
      default:
        return null;
    }
  };

  const MOBILE_TABS: { id: HekimTab; label: string; icon: string }[] = [
    { id: 'genel_bakis', label: 'Genel', icon: 'ri-dashboard-3-line' },
    { id: 'firmalar', label: 'Firmalar', icon: 'ri-building-3-line' },
    { id: 'personeller', label: 'Personel', icon: 'ri-group-line' },
    { id: 'saglik', label: 'Sağlık', icon: 'ri-heart-pulse-line' },
    { id: 'is_kazasi', label: 'Kazalar', icon: 'ri-alert-line' },
    { id: 'ziyaret', label: 'Ziyaret', icon: 'ri-map-pin-user-line' },
  ];

  return (
    <div
      className="min-h-screen"
      style={{
        background: isDark
          ? 'linear-gradient(135deg, #0a0f1a 0%, #0d1525 50%, #0a1020 100%)'
          : 'linear-gradient(135deg, #f0f9ff 0%, #f8fafc 50%, #f0f8ff 100%)',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes dropDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        .hekim-content { animation: fadeSlideUp 0.3s ease forwards; }
        .switcher-dropdown { animation: dropDown 0.18s ease forwards; }
        :root {
          --bg-sidebar: ${isDark ? '#111827' : '#ffffff'};
          --bg-main: ${isDark ? '#0f172a' : '#f8fafc'};
          --bg-item: ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)'};
          --bg-hover: ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)'};
          --border-subtle: ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)'};
          --text-primary: ${isDark ? '#f1f5f9' : '#0f172a'};
          --text-secondary: ${isDark ? '#94a3b8' : '#475569'};
          --text-muted: ${isDark ? '#64748b' : '#64748b'};
          --text-faint: ${isDark ? '#334155' : '#cbd5e1'};
        }
      `}</style>

      {/* Mobile overlay */}
      <div
        className="fixed inset-0 lg:hidden"
        style={{
          zIndex: 41,
          background: 'rgba(0,0,0,0.62)',
          backdropFilter: 'blur(3px)',
          opacity: mobileOpen ? 1 : 0,
          pointerEvents: mobileOpen ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
        onClick={() => setMobileOpen(false)}
      />

      <HekimSidebar
        activeTab={activeTab}
        setActiveTab={(tab) => { setActiveTab(tab); setMobileOpen(false); }}
        orgName={org?.displayName ?? 'İşyeri Hekimi'}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <main className="min-h-screen overflow-y-auto transition-all duration-300 lg:block">
        {/* ── Topbar ── */}
        <div
          className={`sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-6 h-[52px] lg:h-[56px] transition-all duration-300 ${collapsed ? 'lg:pl-[80px]' : 'lg:pl-[236px]'}`}
          style={{
            background: isDark ? 'rgba(17,24,39,0.95)' : 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(14px)',
            borderBottom: `1px solid ${borderColor}`,
          }}
        >
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(v => !v)}
            className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer lg:hidden flex-shrink-0 transition-all"
            style={{
              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)',
              border: `1px solid ${borderColor}`,
              color: isDark ? '#94a3b8' : '#475569',
            }}
          >
            <i className="ri-menu-line text-sm" />
          </button>

          {/* Sekme başlığı */}
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
              <i className={`${current.icon} text-sm`} style={{ color: ACCENT }} />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight" style={{ color: textPrimary }}>{current.title}</p>
              <p className="text-[10px] leading-none mt-0.5 hidden sm:block" style={{ color: '#94a3b8' }}>{current.subtitle}</p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Firma Switcher */}
            {firmaOptions.length > 0 && (
              <div className="relative" ref={switcherRef}>
                <button
                  onClick={() => setSwitcherOpen(v => !v)}
                  className="whitespace-nowrap flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold cursor-pointer transition-all"
                  style={{
                    background: aktiveFirmaId ? `rgba(14,165,233,0.12)` : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)'),
                    border: `1px solid ${aktiveFirmaId ? 'rgba(14,165,233,0.3)' : borderColor}`,
                    color: aktiveFirmaId ? ACCENT : (isDark ? '#94a3b8' : '#475569'),
                  }}
                >
                  <i className="ri-building-3-line text-xs" />
                  <span className="max-w-[100px] sm:max-w-[140px] truncate">
                    {aktifFirmaAd ?? `Tümü (${firmaOptions.length})`}
                  </span>
                  <i className={`${switcherOpen ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} text-xs`} />
                </button>

                {switcherOpen && (
                  <div
                    className="switcher-dropdown absolute right-0 top-full mt-2 rounded-xl overflow-hidden z-50"
                    style={{
                      minWidth: '180px',
                      background: isDark ? '#1e293b' : '#ffffff',
                      border: `1px solid ${borderColor}`,
                      boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 24px rgba(15,23,42,0.1)',
                    }}
                  >
                    {firmaOptions.length > 1 && (
                      <button
                        onClick={() => { setAktiveFirmaId(null); setSwitcherOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-colors"
                        style={{
                          background: !aktiveFirmaId ? `rgba(14,165,233,0.1)` : 'transparent',
                          color: !aktiveFirmaId ? ACCENT : (isDark ? '#94a3b8' : '#475569'),
                        }}
                      >
                        <div className="w-6 h-6 flex items-center justify-center rounded-md flex-shrink-0"
                          style={{ background: !aktiveFirmaId ? `rgba(14,165,233,0.15)` : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)') }}>
                          <i className="ri-apps-line text-xs" style={{ color: !aktiveFirmaId ? ACCENT : (isDark ? '#94a3b8' : '#64748b') }} />
                        </div>
                        <span className="text-[12px] font-semibold">Tüm Firmalar</span>
                        {!aktiveFirmaId && <i className="ri-check-line text-xs ml-auto" style={{ color: ACCENT }} />}
                      </button>
                    )}
                    {firmaOptions.map(f => (
                      <button
                        key={f.id}
                        onClick={() => { setAktiveFirmaId(f.id); setSwitcherOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-colors"
                        style={{
                          background: aktiveFirmaId === f.id ? `rgba(14,165,233,0.1)` : 'transparent',
                          color: aktiveFirmaId === f.id ? ACCENT : (isDark ? '#e2e8f0' : '#0f172a'),
                        }}
                      >
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white"
                          style={{ background: `linear-gradient(135deg, ${ACCENT_DARK}, ${ACCENT})` }}
                        >
                          {f.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[12px] font-medium flex-1 truncate">{f.name}</span>
                        {aktiveFirmaId === f.id && (
                          <i className="ri-check-line text-xs flex-shrink-0" style={{ color: ACCENT }} />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* İşyeri Hekimi badge */}
            <div
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full flex-shrink-0"
              style={{ background: `rgba(14,165,233,0.1)`, border: `1px solid rgba(14,165,233,0.2)` }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT, boxShadow: `0 0 5px rgba(14,165,233,0.6)` }} />
              <span className="text-[10px] font-bold" style={{ color: ACCENT }}>İŞYERİ HEKİMİ</span>
            </div>
          </div>
        </div>

        {/* ── İçerik ── */}
        <div
          className={`px-3 sm:px-5 md:px-6 py-4 hekim-content transition-all duration-300 ${collapsed ? 'lg:pl-[80px]' : 'lg:pl-[236px]'} ${activeTab === 'ziyaret' ? 'pb-24 lg:pb-4' : ''}`}
          key={`${activeTab}-${aktiveFirmaId ?? 'all'}`}
        >
          {renderContent()}
        </div>

        {/* ── Mobil Alt Tab Bar ── */}
        <nav
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40"
          style={{
            background: isDark ? 'rgba(17,24,39,0.97)' : 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(16px)',
            borderTop: `1px solid ${borderColor}`,
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          <div className="flex items-stretch">
            {MOBILE_TABS.map(tab => {
              const isActive = activeTab === tab.id;
              const isZiyaret = tab.id === 'ziyaret';
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 cursor-pointer transition-all duration-200 relative whitespace-nowrap"
                  style={{
                    background: isActive && isZiyaret ? `rgba(14,165,233,0.12)` : 'transparent',
                    borderTop: isActive ? `2px solid ${ACCENT}` : '2px solid transparent',
                  }}
                >
                  {isZiyaret ? (
                    <>
                      <div className="w-8 h-8 flex items-center justify-center rounded-xl"
                        style={{
                          background: isActive ? `rgba(14,165,233,0.2)` : `rgba(14,165,233,0.08)`,
                          border: `1px solid ${isActive ? 'rgba(14,165,233,0.4)' : 'rgba(14,165,233,0.2)'}`,
                        }}>
                        <i className={`${tab.icon} text-sm`} style={{ color: ACCENT }} />
                      </div>
                      <span className="text-[9px] font-bold" style={{ color: ACCENT }}>{tab.label}</span>
                    </>
                  ) : (
                    <>
                      <div className="w-5 h-5 flex items-center justify-center">
                        <i className={`${tab.icon} text-sm`} style={{ color: isActive ? ACCENT : (isDark ? '#475569' : '#94a3b8') }} />
                      </div>
                      <span className="text-[9px] font-semibold" style={{ color: isActive ? ACCENT : (isDark ? '#475569' : '#94a3b8') }}>
                        {tab.label}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </main>
    </div>
  );
}
