import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/store/AppContext';
import { useAuth } from '@/store/AuthContext';
import { supabase } from '@/lib/supabase';
import ForcePasswordChange from '@/components/feature/ForcePasswordChange';
import ToastContainer from '@/components/base/ToastContainer';
import UzmanSidebar, { type UzmanTab } from './components/UzmanSidebar';
import UzmanGenelBakis from './components/UzmanGenelBakis';
import UzmanFirmalar from './components/UzmanFirmalar';
import UzmanSaglik from './components/UzmanSaglik';

// Ana panelden alınan sekmeler
import PersonellerPage from '@/pages/personnel/page';
import FirmaEvraklariPage from '@/pages/company-documents/page';
import EvraklarPage from '@/pages/documents/page';
import EgitimlerPage from '@/pages/training/page';
import TutanaklarPage from '@/pages/tutanaklar/page';
import UygunsuzluklarPage from '@/pages/nonconformity/page';
import EkipmanlarPage from '@/pages/equipment/page';
import IsIzniPage from '@/pages/is-izni/page';
import RaporlarPage from '@/pages/reports/page';
import DokumanlarPage from '@/pages/dokumanlar/page';
import CopKutusuPage from '@/pages/trash/page';
import HekimMobilZiyaret from '@/pages/hekim/components/HekimMobilZiyaret';

const ACCENT = '#0EA5E9';
const ACCENT_DARK = '#0284C7';
const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518';

interface FirmaOption {
  id: string;
  name: string;
}

// ── Loading Screen ──────────────────────────────────────────────────────────
function UzmanLoadingScreen({ isDark }: { isDark: boolean }) {
  const STEPS = [
    { label: 'Bağlantı kuruluyor...', icon: 'ri-wifi-line', duration: 500 },
    { label: 'Uzman bilgileri yükleniyor...', icon: 'ri-user-star-line', duration: 700 },
    { label: 'Atanmış firmalar kontrol ediliyor...', icon: 'ri-building-3-line', duration: 700 },
    { label: 'Saha modülü hazırlanıyor...', icon: 'ri-map-pin-user-line', duration: 600 },
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
      if (current >= STEPS.length) { setFadeOut(true); return; }
      setStepIndex(current);
      const stepDuration = STEPS[current].duration;
      const stepStart = elapsed;
      const interval = setInterval(() => { elapsed += 20; setProgress(Math.min((elapsed / total) * 100, 100)); }, 20);
      setTimeout(() => { clearInterval(interval); current++; elapsed = stepStart + stepDuration; tick(); }, stepDuration);
    };
    tick();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = STEPS[Math.min(stepIndex, STEPS.length - 1)];
  const isDone = stepIndex >= STEPS.length - 1 && progress >= 95;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{ background: isDark ? '#0f172a' : '#f8fafc', opacity: fadeOut ? 0 : 1, transition: 'opacity 0.4s ease', pointerEvents: fadeOut ? 'none' : 'all', fontFamily: "'Inter', sans-serif" }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); @keyframes uzmanSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <div className="flex flex-col items-center gap-5 mb-10">
        <div className="w-16 h-16 flex items-center justify-center rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.18), rgba(14,165,233,0.06))', border: '1px solid rgba(14,165,233,0.3)', boxShadow: '0 0 40px rgba(14,165,233,0.15)' }}>
          <img src={LOGO_URL} alt="ISG Logo" style={{ height: '32px', width: 'auto', objectFit: 'contain', filter: 'brightness(1.2) drop-shadow(0 0 8px rgba(14,165,233,0.5))' }} />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-black" style={{ color: isDark ? '#f1f5f9' : '#0f172a', letterSpacing: '-0.04em' }}>ISG Denetim</h1>
          <p className="text-sm mt-1 font-semibold" style={{ color: ACCENT }}>Gezici Uzman Paneli</p>
        </div>
      </div>
      <div className="w-64 mb-5">
        <div className="h-1 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }}>
          <div className="h-full rounded-full transition-all duration-200" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #0EA5E9, #38BDF8)', boxShadow: '0 0 8px rgba(14,165,233,0.5)' }} />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px]" style={{ color: isDark ? '#475569' : '#94a3b8' }}>{Math.round(progress)}%</span>
          <span className="text-[10px]" style={{ color: isDark ? '#475569' : '#94a3b8' }}>{stepIndex + 1}/{STEPS.length}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300" style={{ background: isDone ? 'rgba(14,165,233,0.12)' : 'rgba(14,165,233,0.07)', border: `1px solid ${isDone ? 'rgba(14,165,233,0.3)' : 'rgba(14,165,233,0.15)'}` }}>
        <i className={`${step.icon} text-sm`} style={{ color: ACCENT, animation: isDone ? 'none' : 'uzmanSpin 1.5s linear infinite' }} />
        <span className="text-xs font-semibold" style={{ color: ACCENT }}>{step.label}</span>
      </div>
      <div className="flex items-center gap-2 mt-6">
        {STEPS.map((_, i) => (
          <div key={i} className="rounded-full transition-all duration-300" style={{ width: i === stepIndex ? '20px' : '6px', height: '6px', background: i < stepIndex ? ACCENT : i === stepIndex ? '#38BDF8' : isDark ? 'rgba(14,165,233,0.15)' : 'rgba(14,165,233,0.12)' }} />
        ))}
      </div>
    </div>
  );
}

// ── Atama Bekleniyor ──────────────────────────────────────────────────────────
function AtamaBekleyenEkran({ isDark, onLogout, onRefresh }: { isDark: boolean; onLogout: () => void; onRefresh: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8" style={{ background: isDark ? '#0f172a' : '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');`}</style>
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(14,165,233,0.08)', border: '1.5px solid rgba(14,165,233,0.18)' }}>
          <i className="ri-map-pin-user-line text-3xl" style={{ color: ACCENT }} />
        </div>
        <h1 className="text-xl font-extrabold mb-2" style={{ color: isDark ? '#f1f5f9' : '#0f172a', letterSpacing: '-0.03em' }}>Henüz size firma atanmadı</h1>
        <p className="text-sm leading-relaxed mb-6" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>OSGB admininiz hesabınıza henüz müşteri firma ataması yapmadı. Atama yapıldıktan sonra panele erişebilirsiniz.</p>
        <div className="flex flex-col gap-2">
          <button onClick={onRefresh} className="whitespace-nowrap inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer" style={{ background: `linear-gradient(135deg, ${ACCENT_DARK}, ${ACCENT})` }}>
            <i className="ri-refresh-line" />Yenile
          </button>
          <button onClick={onLogout} className="whitespace-nowrap inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', color: isDark ? '#94a3b8' : '#64748b', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)'}` }}>
            <i className="ri-logout-box-line" />Çıkış Yap
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sekme Başlıkları ─────────────────────────────────────────────────────────
const TAB_TITLES: Record<UzmanTab, { title: string; subtitle: string; icon: string }> = {
  genel_bakis:      { title: 'Genel Bakış',       subtitle: 'Özet istatistikler',                   icon: 'ri-dashboard-3-line' },
  firmalar:         { title: 'Atanmış Firmalar',   subtitle: 'OSGB tarafından atanan firmalar',      icon: 'ri-building-3-line' },
  personeller:      { title: 'Personel',           subtitle: 'Firma personellerini yönet',           icon: 'ri-group-line' },
  firma_belgeleri:  { title: 'Firma Belgeleri',    subtitle: 'Firma bazlı belge yönetimi',           icon: 'ri-folder-3-line' },
  belge_takibi:     { title: 'Belge Takibi',       subtitle: 'Personel evrak takibi',                icon: 'ri-file-list-3-line' },
  egitimler:        { title: 'Eğitimler',          subtitle: 'Eğitim kayıtları ve takibi',           icon: 'ri-graduation-cap-line' },
  saglik:           { title: 'Sağlık Durumu',      subtitle: 'Muayene sonuçları (hekim verisinden)', icon: 'ri-heart-pulse-line' },
  tutanaklar:       { title: 'Tutanak Yönetimi',   subtitle: 'Tutanak oluştur ve yönet',             icon: 'ri-file-text-line' },
  saha_denetimleri: { title: 'Saha Denetimleri',   subtitle: 'Uygunsuzluk kayıtları ve DOF',         icon: 'ri-error-warning-line' },
  ekipmanlar:       { title: 'Ekipman',            subtitle: 'Ekipman kontrol ve takibi',            icon: 'ri-tools-line' },
  is_izinleri:      { title: 'İş İzinleri',        subtitle: 'İş izni yönetimi ve onaylar',          icon: 'ri-shield-keyhole-line' },
  raporlar:         { title: 'Raporlar',           subtitle: 'ISG raporları ve analizler',           icon: 'ri-bar-chart-line' },
  dokumanlar:       { title: 'Dökümanlar',         subtitle: 'Döküman kütüphanesi',                  icon: 'ri-book-2-line' },
  mobil_saha:       { title: 'Mobil Saha',         subtitle: 'QR ile ziyaret başlat (mobil)',        icon: 'ri-smartphone-line' },
  cop:              { title: 'Çöp Kutusu',         subtitle: 'Silinen kayıtlar',                     icon: 'ri-delete-bin-6-line' },
};

// ── Mobil Alt Tab Tanımları ───────────────────────────────────────────────────
const MOBILE_TABS: { id: UzmanTab; label: string; icon: string; mobileOnly?: boolean }[] = [
  { id: 'genel_bakis',      label: 'Genel',    icon: 'ri-dashboard-3-line' },
  { id: 'firmalar',         label: 'Firmalar', icon: 'ri-building-3-line' },
  { id: 'personeller',      label: 'Personel', icon: 'ri-group-line' },
  { id: 'saha_denetimleri', label: 'Saha',     icon: 'ri-error-warning-line' },
  { id: 'mobil_saha',       label: 'Ziyaret',  icon: 'ri-map-pin-user-line', mobileOnly: true },
];

// ── Ana Sayfa ────────────────────────────────────────────────────────────────
export default function UzmanPage() {
  const { org, theme, mustChangePassword } = useApp();
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<UzmanTab>('genel_bakis');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [atanmisFirmaIds, setAtanmisFirmaIds] = useState<string[]>([]);
  const [firmaOptions, setFirmaOptions] = useState<FirmaOption[]>([]);
  const [aktiveFirmaId, setAktiveFirmaId] = useState<string | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);
  const [orgId, setOrgId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showLoading, setShowLoading] = useState(true);

  const isDark = theme === 'dark';
  const borderColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';

  // Loading animasyonu
  useEffect(() => {
    const t = setTimeout(() => setShowLoading(false), 2800);
    return () => clearTimeout(t);
  }, []);

  // Dışarı tıklayınca switcher'ı kapat
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Atanmış firmaları çek
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
        console.error('[UzmanPage] fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFirmalar();
  }, [user?.id, org?.id]);

  const goruntulenenFirmaIds = aktiveFirmaId ? [aktiveFirmaId] : atanmisFirmaIds;
  const aktifFirmaAd = aktiveFirmaId ? firmaOptions.find(f => f.id === aktiveFirmaId)?.name ?? '' : null;

  if (showLoading || loading) {
    return <UzmanLoadingScreen isDark={isDark} />;
  }

  if (mustChangePassword) {
    return <ForcePasswordChange />;
  }

  if (atanmisFirmaIds.length === 0) {
    return <AtamaBekleyenEkran isDark={isDark} onLogout={logout} onRefresh={() => window.location.reload()} />;
  }

  const current = TAB_TITLES[activeTab];

  const renderContent = () => {
    switch (activeTab) {
      case 'genel_bakis':
        return <UzmanGenelBakis atanmisFirmaIds={goruntulenenFirmaIds} isDark={isDark} />;
      case 'firmalar':
        return <UzmanFirmalar atanmisFirmaIds={goruntulenenFirmaIds} isDark={isDark} />;
      case 'personeller':
        return <PersonellerPage />;
      case 'firma_belgeleri':
        return <FirmaEvraklariPage />;
      case 'belge_takibi':
        return <EvraklarPage />;
      case 'egitimler':
        return <EgitimlerPage />;
      case 'saglik':
        return <UzmanSaglik atanmisFirmaIds={goruntulenenFirmaIds} isDark={isDark} />;
      case 'tutanaklar':
        return <TutanaklarPage />;
      case 'saha_denetimleri':
        return <UygunsuzluklarPage />;
      case 'ekipmanlar':
        return <EkipmanlarPage />;
      case 'is_izinleri':
        return <IsIzniPage />;
      case 'raporlar':
        return <RaporlarPage />;
      case 'dokumanlar':
        return <DokumanlarPage />;
      case 'mobil_saha':
        return (
          <div className="lg:hidden -mx-3 sm:-mx-5 md:-mx-6 -my-4">
            <HekimMobilZiyaret isDark={isDark} />
          </div>
        );
      case 'cop':
        return <CopKutusuPage />;
      default:
        return null;
    }
  };

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
        .uzman-content { animation: fadeSlideUp 0.3s ease forwards; }
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

      <UzmanSidebar
        activeTab={activeTab}
        setActiveTab={tab => { setActiveTab(tab); setMobileOpen(false); }}
        orgName={org?.displayName ?? 'Gezici Uzman'}
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
            background: isDark ? 'rgba(10,15,26,0.92)' : 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: `1px solid ${borderColor}`,
          }}
        >
          <div className="h-[2px] w-full" style={{ background: `linear-gradient(90deg, ${ACCENT} 0%, #38BDF8 40%, transparent 100%)`, opacity: 0.7 }} />
          <div className="flex items-center gap-3 px-4 sm:px-5 h-[54px]">
            {/* Hamburger */}
            <button
              onClick={() => setMobileOpen(v => !v)}
              className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer lg:hidden flex-shrink-0 transition-all"
              style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', border: `1px solid ${borderColor}`, color: isDark ? '#94a3b8' : '#64748b' }}
            >
              <i className="ri-menu-line text-sm" />
            </button>

            {/* Sekme başlığı */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: `linear-gradient(135deg, rgba(14,165,233,0.18), rgba(14,165,233,0.08))`, border: `1px solid rgba(14,165,233,0.22)` }}>
                <i className={`${current.icon} text-sm`} style={{ color: ACCENT }} />
              </div>
              <div className="min-w-0">
                <p className="text-[13.5px] font-bold leading-tight truncate" style={{ color: textPrimary, letterSpacing: '-0.02em' }}>{current.title}</p>
                <p className="text-[10px] leading-none mt-[2px] hidden sm:block truncate" style={{ color: isDark ? '#475569' : '#94a3b8' }}>{current.subtitle}</p>
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
                    background: aktiveFirmaId ? `rgba(14,165,233,0.12)` : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)',
                    border: `1px solid ${aktiveFirmaId ? 'rgba(14,165,233,0.3)' : borderColor}`,
                    color: aktiveFirmaId ? ACCENT : isDark ? '#94a3b8' : '#64748b',
                  }}
                >
                  <i className="ri-building-3-line text-xs" />
                  <span className="max-w-[120px] truncate">{aktifFirmaAd ?? `Tüm Firmalar (${firmaOptions.length})`}</span>
                  <i className={`${switcherOpen ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} text-xs opacity-70`} />
                </button>

                {switcherOpen && (
                  <div
                    className="switcher-dropdown absolute left-0 top-full mt-2 rounded-2xl overflow-hidden z-50"
                    style={{ minWidth: '200px', background: isDark ? '#1a2235' : '#ffffff', border: `1px solid ${borderColor}` }}
                  >
                    <div className="px-3 pt-3 pb-1.5">
                      <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: isDark ? '#475569' : '#94a3b8' }}>Firma Seçin</p>
                    </div>
                    {firmaOptions.length > 1 && (
                      <button
                        onClick={() => { setAktiveFirmaId(null); setSwitcherOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all"
                        style={{ background: !aktiveFirmaId ? `rgba(14,165,233,0.1)` : 'transparent', color: !aktiveFirmaId ? ACCENT : isDark ? '#94a3b8' : '#64748b' }}
                      >
                        <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: !aktiveFirmaId ? `rgba(14,165,233,0.18)` : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }}>
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
                        style={{ background: aktiveFirmaId === f.id ? `rgba(14,165,233,0.1)` : 'transparent', color: aktiveFirmaId === f.id ? ACCENT : isDark ? '#e2e8f0' : '#0f172a' }}
                      >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-white" style={{ background: `linear-gradient(135deg, ${ACCENT_DARK}, ${ACCENT})` }}>
                          {f.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[12px] font-medium flex-1 truncate">{f.name}</span>
                        {aktiveFirmaId === f.id && <i className="ri-check-line text-xs flex-shrink-0" style={{ color: ACCENT }} />}
                      </button>
                    ))}
                    <div className="h-2" />
                  </div>
                )}
              </div>
            )}

            <div className="flex-1" />

            {/* Gezici Uzman badge */}
            <div
              className="hidden sm:flex items-center gap-1.5 pl-2 pr-3 py-1.5 rounded-full flex-shrink-0"
              style={{ background: isDark ? 'rgba(14,165,233,0.08)' : 'rgba(14,165,233,0.07)', border: `1px solid rgba(14,165,233,0.18)` }}
            >
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0" style={{ background: `linear-gradient(135deg, ${ACCENT_DARK}, ${ACCENT})` }}>
                {(user?.email ?? 'U').charAt(0).toUpperCase()}
              </div>
              <span className="text-[10px] font-bold" style={{ color: ACCENT }}>GEZİCİ UZMAN</span>
            </div>
          </div>
        </div>

        {/* ── İçerik ── */}
        <div
          className={`px-3 sm:px-5 md:px-6 py-4 uzman-content transition-all duration-300 ${collapsed ? 'lg:pl-[80px]' : 'lg:pl-[236px]'} ${activeTab === 'mobil_saha' ? 'pb-24 lg:pb-4' : ''}`}
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
              const isMobileSaha = tab.id === 'mobil_saha';
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 cursor-pointer transition-all duration-200 relative whitespace-nowrap"
                  style={{
                    background: isActive && isMobileSaha ? `rgba(14,165,233,0.12)` : 'transparent',
                    borderTop: isActive ? `2px solid ${ACCENT}` : '2px solid transparent',
                  }}
                >
                  {isMobileSaha ? (
                    <>
                      <div className="relative">
                        <div className="w-10 h-10 flex items-center justify-center rounded-2xl relative z-10" style={{ background: isActive ? `linear-gradient(135deg, ${ACCENT_DARK}, ${ACCENT})` : `rgba(14,165,233,0.1)`, border: `1.5px solid ${isActive ? ACCENT : 'rgba(14,165,233,0.3)'}` }}>
                          <i className={`${tab.icon} text-base`} style={{ color: isActive ? '#fff' : ACCENT }} />
                        </div>
                      </div>
                      <span className="text-[9px] font-extrabold" style={{ color: ACCENT }}>{tab.label}</span>
                    </>
                  ) : (
                    <>
                      <div className="w-5 h-5 flex items-center justify-center">
                        <i className={`${tab.icon} text-sm`} style={{ color: isActive ? ACCENT : (isDark ? '#475569' : '#94a3b8') }} />
                      </div>
                      <span className="text-[9px] font-semibold" style={{ color: isActive ? ACCENT : (isDark ? '#475569' : '#94a3b8') }}>{tab.label}</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </main>

      <ToastContainer />
    </div>
  );
}
