import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/store/AppContext';
import { useAuth } from '@/store/AuthContext';

/* ── Topbar: theme toggle icon button ── */
function ThemeIconBtn({ isDark, borderColor }: { isDark: boolean; borderColor: string }) {
  const { toggleTheme } = useApp();
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={toggleTheme}
      title={isDark ? 'Açık Mod' : 'Karanlık Mod'}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer transition-all flex-shrink-0"
      style={{
        background: hovered
          ? isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)'
          : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)',
        border: `1px solid ${hovered ? (isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.12)') : borderColor}`,
      }}
    >
      <i
        className={isDark ? 'ri-sun-line text-sm' : 'ri-moon-line text-sm'}
        style={{ color: isDark ? '#F59E0B' : '#0EA5E9', transition: 'color 0.2s' }}
      />
    </button>
  );
}
import { supabase } from '@/lib/supabase';
import HekimSidebar, { type HekimTab } from './components/HekimSidebar';
import HekimGenelBakisTab from './components/HekimGenelBakisTab';
import HekimFirmalarTab from './components/HekimFirmalarTab';
import HekimPersonellerTab from './components/HekimPersonellerTab';
import HekimSaglikTab from './components/HekimSaglikTab';
import HekimCopTab from './components/HekimCopTab';
import HekimIsKazasiTab from './components/HekimIsKazasiTab';
import HekimMobilZiyaret from './components/HekimMobilZiyaret';

const ACCENT = '#0EA5E9';
const ACCENT_DARK = '#0284C7';

interface FirmaOption {
  id: string;
  name: string;
}

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518';

// ── Hekim Loading Screen ──
function HekimLoadingScreen({ isDark }: { isDark: boolean }) {
  const STEPS = [
    { label: 'Bağlantı kuruluyor...', icon: 'ri-wifi-line', duration: 500 },
    { label: 'Hekim bilgileri yükleniyor...', icon: 'ri-heart-pulse-line', duration: 700 },
    { label: 'Firmalar hazırlanıyor...', icon: 'ri-building-3-line', duration: 700 },
    { label: 'Muayene kayıtları alınıyor...', icon: 'ri-stethoscope-line', duration: 600 },
    { label: 'Hazır!', icon: 'ri-check-double-line', duration: 300 },
  ];

  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    let current = 0;
    const total = STEPS.reduce((s, st) => s + st.duration, 0);
    let elapsed = 0;

    const tick = () => {
      if (current >= STEPS.length) {
        setFadeOut(true);
        return;
      }
      setStepIndex(current);
      const stepDuration = STEPS[current].duration;
      const stepStart = elapsed;

      const interval = setInterval(() => {
        elapsed += 20;
        setProgress(Math.min((elapsed / total) * 100, 100));
      }, 20);

      setTimeout(() => {
        clearInterval(interval);
        current++;
        elapsed = stepStart + stepDuration;
        tick();
      }, stepDuration);
    };

    tick();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = STEPS[Math.min(stepIndex, STEPS.length - 1)];
  const isDone = stepIndex >= STEPS.length - 1 && progress >= 95;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{
        background: isDark ? '#0f172a' : '#f8fafc',
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 0.4s ease',
        pointerEvents: fadeOut ? 'none' : 'all',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes hekimSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Logo & Başlık */}
      <div className="flex flex-col items-center gap-5 mb-10">
        <div
          className="w-16 h-16 flex items-center justify-center rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, rgba(14,165,233,0.18), rgba(14,165,233,0.06))',
            border: '1px solid rgba(14,165,233,0.3)',
            boxShadow: '0 0 40px rgba(14,165,233,0.15)',
          }}
        >
          <img
            src={LOGO_URL}
            alt="ISG Logo"
            style={{
              height: '32px', width: 'auto', objectFit: 'contain',
              filter: 'brightness(1.2) drop-shadow(0 0 8px rgba(14,165,233,0.5))',
            }}
          />
        </div>
        <div className="text-center">
          <h1
            className="text-2xl font-black"
            style={{ color: isDark ? '#f1f5f9' : '#0f172a', letterSpacing: '-0.04em' }}
          >
            ISG Denetim
          </h1>
          <p className="text-sm mt-1 font-semibold" style={{ color: '#0EA5E9' }}>
            İşyeri Hekimi Paneli
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-64 mb-5">
        <div className="h-1 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }}>
          <div
            className="h-full rounded-full transition-all duration-200"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #0EA5E9, #38BDF8)',
              boxShadow: '0 0 8px rgba(14,165,233,0.5)',
            }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px]" style={{ color: isDark ? '#475569' : '#94a3b8' }}>{Math.round(progress)}%</span>
          <span className="text-[10px]" style={{ color: isDark ? '#475569' : '#94a3b8' }}>{stepIndex + 1}/{STEPS.length}</span>
        </div>
      </div>

      {/* Step badge */}
      <div
        className="flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300"
        style={{
          background: isDone ? 'rgba(14,165,233,0.12)' : 'rgba(14,165,233,0.07)',
          border: `1px solid ${isDone ? 'rgba(14,165,233,0.3)' : 'rgba(14,165,233,0.15)'}`,
        }}
      >
        <i
          className={`${step.icon} text-sm`}
          style={{ color: '#0EA5E9', animation: isDone ? 'none' : 'hekimSpin 1.5s linear infinite' }}
        />
        <span className="text-xs font-semibold" style={{ color: '#0EA5E9' }}>{step.label}</span>
      </div>

      {/* Step dots */}
      <div className="flex items-center gap-2 mt-6">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === stepIndex ? '20px' : '6px',
              height: '6px',
              background: i < stepIndex
                ? '#0EA5E9'
                : i === stepIndex
                  ? '#38BDF8'
                  : isDark ? 'rgba(14,165,233,0.15)' : 'rgba(14,165,233,0.12)',
            }}
          />
        ))}
      </div>
    </div>
  );
}

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
    return <HekimLoadingScreen isDark={isDark} />;
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
          <div className="lg:hidden -mx-3 sm:-mx-5 md:-mx-6 -my-4">
            <HekimMobilZiyaret isDark={isDark} />
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
          className={`sticky top-0 z-30 transition-all duration-300 ${collapsed ? 'lg:pl-[64px]' : 'lg:pl-[220px]'}`}
          style={{
            background: isDark
              ? 'rgba(10,15,26,0.92)'
              : 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: `1px solid ${borderColor}`,
          }}
        >
          {/* Top gradient accent line */}
          <div
            className="h-[2px] w-full"
            style={{ background: `linear-gradient(90deg, ${ACCENT} 0%, #38BDF8 40%, transparent 100%)`, opacity: 0.7 }}
          />

          <div className="flex items-center gap-3 px-4 sm:px-5 h-[54px]">
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(v => !v)}
              className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer lg:hidden flex-shrink-0 transition-all"
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)',
                border: `1px solid ${borderColor}`,
                color: isDark ? '#94a3b8' : '#64748b',
              }}
            >
              <i className="ri-menu-line text-sm" />
            </button>

            {/* Sekme başlığı — icon pill + title */}
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
                style={{
                  background: `linear-gradient(135deg, rgba(14,165,233,0.18), rgba(14,165,233,0.08))`,
                  border: `1px solid rgba(14,165,233,0.22)`,
                }}
              >
                <i className={`${current.icon} text-sm`} style={{ color: ACCENT }} />
              </div>
              <div className="min-w-0">
                <p
                  className="text-[13.5px] font-bold leading-tight truncate"
                  style={{ color: textPrimary, letterSpacing: '-0.02em' }}
                >
                  {current.title}
                </p>
                <p className="text-[10px] leading-none mt-[2px] hidden sm:block truncate" style={{ color: isDark ? '#475569' : '#94a3b8' }}>
                  {current.subtitle}
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="hidden sm:block h-5 w-px flex-shrink-0 mx-1" style={{ background: borderColor }} />

            {/* Firma Switcher */}
            {firmaOptions.length > 0 && (
              <div className="relative hidden sm:block" ref={switcherRef}>
                <button
                  onClick={() => setSwitcherOpen(v => !v)}
                  className="whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold cursor-pointer transition-all"
                  style={{
                    background: aktiveFirmaId
                      ? `rgba(14,165,233,0.12)`
                      : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)',
                    border: `1px solid ${aktiveFirmaId ? 'rgba(14,165,233,0.3)' : borderColor}`,
                    color: aktiveFirmaId ? ACCENT : isDark ? '#94a3b8' : '#64748b',
                  }}
                >
                  <i className="ri-building-3-line text-xs" />
                  <span className="max-w-[120px] truncate">
                    {aktifFirmaAd ?? `Tüm Firmalar (${firmaOptions.length})`}
                  </span>
                  <i className={`${switcherOpen ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} text-xs opacity-70`} />
                </button>

                {switcherOpen && (
                  <div
                    className="switcher-dropdown absolute left-0 top-full mt-2 rounded-2xl overflow-hidden z-50"
                    style={{
                      minWidth: '200px',
                      background: isDark ? '#1a2235' : '#ffffff',
                      border: `1px solid ${borderColor}`,
                      boxShadow: isDark
                        ? '0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)'
                        : '0 16px 48px rgba(15,23,42,0.12), 0 0 0 1px rgba(14,165,233,0.06)',
                    }}
                  >
                    <div className="px-3 pt-3 pb-1.5">
                      <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: isDark ? '#475569' : '#94a3b8' }}>
                        Firma Seçin
                      </p>
                    </div>
                    {firmaOptions.length > 1 && (
                      <button
                        onClick={() => { setAktiveFirmaId(null); setSwitcherOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all mx-0"
                        style={{
                          background: !aktiveFirmaId ? `rgba(14,165,233,0.1)` : 'transparent',
                          color: !aktiveFirmaId ? ACCENT : isDark ? '#94a3b8' : '#64748b',
                        }}
                        onMouseEnter={e => { if (aktiveFirmaId) (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)'; }}
                        onMouseLeave={e => { if (aktiveFirmaId) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <div
                          className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
                          style={{
                            background: !aktiveFirmaId
                              ? `rgba(14,165,233,0.18)`
                              : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
                          }}
                        >
                          <i className="ri-apps-2-line text-xs" style={{ color: !aktiveFirmaId ? ACCENT : isDark ? '#94a3b8' : '#64748b' }} />
                        </div>
                        <span className="text-[12px] font-semibold flex-1">Tüm Firmalar</span>
                        {!aktiveFirmaId && <i className="ri-check-line text-xs" style={{ color: ACCENT }} />}
                      </button>
                    )}
                    <div className="mx-3 my-1 h-px" style={{ background: borderColor }} />
                    {firmaOptions.map(f => (
                      <button
                        key={f.id}
                        onClick={() => { setAktiveFirmaId(f.id); setSwitcherOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all"
                        style={{
                          background: aktiveFirmaId === f.id ? `rgba(14,165,233,0.1)` : 'transparent',
                          color: aktiveFirmaId === f.id ? ACCENT : isDark ? '#e2e8f0' : '#0f172a',
                        }}
                        onMouseEnter={e => { if (aktiveFirmaId !== f.id) (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)'; }}
                        onMouseLeave={e => { if (aktiveFirmaId !== f.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-white"
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
                    <div className="h-2" />
                  </div>
                )}
              </div>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Right actions */}
            <div className="flex items-center gap-1.5">
              {/* Theme toggle icon button */}
              <ThemeIconBtn isDark={isDark} borderColor={borderColor} />

              {/* Divider */}
              <div className="hidden sm:block h-5 w-px mx-1" style={{ background: borderColor }} />

              {/* İşyeri Hekimi badge */}
              <div
                className="hidden sm:flex items-center gap-1.5 pl-2 pr-3 py-1.5 rounded-full flex-shrink-0"
                style={{
                  background: isDark
                    ? 'rgba(14,165,233,0.08)'
                    : 'rgba(14,165,233,0.07)',
                  border: `1px solid rgba(14,165,233,0.18)`,
                }}
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${ACCENT_DARK}, ${ACCENT})` }}
                >
                  {(user?.email ?? 'H').charAt(0).toUpperCase()}
                </div>
                <span className="text-[10px] font-bold" style={{ color: ACCENT }}>İŞYERİ HEKİMİ</span>
              </div>
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
                      <div className="relative">
                        <div
                          className="w-10 h-10 flex items-center justify-center rounded-2xl relative z-10"
                          style={{
                            background: isActive
                              ? `linear-gradient(135deg, ${ACCENT_DARK}, ${ACCENT})`
                              : `rgba(14,165,233,0.1)`,
                            border: `1.5px solid ${isActive ? ACCENT : 'rgba(14,165,233,0.3)'}`,
                            boxShadow: isActive ? `0 0 12px rgba(14,165,233,0.4)` : 'none',
                          }}>
                          <i className={`${tab.icon} text-base`} style={{ color: isActive ? '#fff' : ACCENT }} />
                        </div>
                        {isActive && (
                          <div className="absolute inset-0 rounded-2xl z-0 animate-ping"
                            style={{ background: `rgba(14,165,233,0.2)` }} />
                        )}
                      </div>
                      <span className="text-[9px] font-extrabold" style={{ color: ACCENT }}>{tab.label}</span>
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
