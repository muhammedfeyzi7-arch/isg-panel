import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppLoadingScreen from '../../components/feature/AppLoadingScreen';
import { useApp } from '../../store/AppContext';
import Layout from '../../components/feature/Layout';
import ForcePasswordChange from '../../components/feature/ForcePasswordChange';
import OnboardingTour from '../../components/feature/OnboardingTour';
import ToastContainer from '../../components/base/ToastContainer';
import { PageSkeleton, DashboardSkeleton } from '../../components/base/Skeleton';

// ── Lazy imports — her sayfa sadece ilk açıldığında yüklenir ──────────────
// Bu sayede uygulama ilk açılışında tüm sayfa kodları inmez, sadece
// aktif sayfa kodu yüklenir. Sonraki açılışlarda tarayıcı cache'den gelir.
const DashboardPage      = lazy(() => import('../dashboard/page'));
const FirmalarPage       = lazy(() => import('../companies/page'));
const PersonellerPage    = lazy(() => import('../personnel/page'));
const EvraklarPage       = lazy(() => import('../documents/page'));
const EgitimlerPage      = lazy(() => import('../training/page'));
const RaporlarPage       = lazy(() => import('../reports/page'));
const EkipmanlarPage     = lazy(() => import('../equipment/page'));
const MuayenelerPage     = lazy(() => import('../health/page'));
const UygunsuzluklarPage = lazy(() => import('../nonconformity/page'));
const TutanaklarPage     = lazy(() => import('../tutanaklar/page'));
const CopKutusuPage      = lazy(() => import('../trash/page'));
const SettingsPage       = lazy(() => import('../settings/page'));
const IsIzniPage         = lazy(() => import('../is-izni/page'));
const FirmaEvraklariPage = lazy(() => import('../company-documents/page'));
const DokumanlarPage     = lazy(() => import('../dokumanlar/page'));
const SahaPage           = lazy(() => import('../saha/page'));
const GelismisRaporlarPage = lazy(() => import('../raporlar/page'));
const ZiyaretTakvimiPage   = lazy(() => import('../ziyaret-takvimi/page'));

// URL path → modül adı eşlemesi
const PATH_TO_MODULE: Record<string, string> = {
  '/dashboard':       'dashboard',
  '/firmalar':        'firmalar',
  '/personeller':     'personeller',
  '/evraklar':        'evraklar',
  '/firma-evraklari': 'firma-evraklari',
  '/egitimler':       'egitimler',
  '/muayeneler':      'muayeneler',
  '/tutanaklar':      'tutanaklar',
  '/uygunsuzluklar':  'uygunsuzluklar',
  '/ekipmanlar':      'ekipmanlar',
  '/is-izinleri':     'is-izinleri',
  '/raporlar':        'raporlar',
  '/gelismis-raporlar': 'gelismis-raporlar',
  '/ziyaret-takvimi': 'ziyaret-takvimi',
  '/dokumanlar':      'dokumanlar',
  '/copkutusu':       'copkutusu',
  '/ayarlar':         'ayarlar',
};

// Modüle göre uygun skeleton seç
function ModuleFallback({ module }: { module: string }) {
  if (module === 'dashboard') return <DashboardSkeleton />;
  return <PageSkeleton />;
}

function AppContent() {
  const { activeModule, orgError, org, mustChangePassword, setActiveModule, pageLoading } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [loadingDone, setLoadingDone] = useState(false);

  // pageLoading bitince loading screen'i kapat
  useEffect(() => {
    if (!pageLoading) {
      const t = setTimeout(() => setLoadingDone(true), 300);
      return () => clearTimeout(t);
    }
  }, [pageLoading]);

  // ── URL ↔ activeModule senkronizasyonu ─────────────────────────────────
  // Çift useEffect döngüsü yerine: URL değişimini tek ref ile takip ediyoruz.
  // URL → module: her zaman çalışır (dış link, geri tuşu, direkt URL girişi)
  // module → URL: sadece sidebar/kod tetiklediğinde çalışır (loop önlemi)
  const isUrlChangeRef = useRef(false);

  useEffect(() => {
    const module = PATH_TO_MODULE[location.pathname];
    if (module && module !== activeModule) {
      isUrlChangeRef.current = true;
      setActiveModule(module);
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // URL değişimi tetiklediyse navigate çağırma — sonsuz döngü önlemi
    if (isUrlChangeRef.current) {
      isUrlChangeRef.current = false;
      return;
    }
    const expectedPath = `/${activeModule}`;
    if (location.pathname !== expectedPath && PATH_TO_MODULE[expectedPath] !== undefined) {
      navigate(expectedPath, { replace: true });
    }
  }, [activeModule]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!loadingDone) {
    return <AppLoadingScreen onDone={() => setLoadingDone(true)} />;
  }

  if (mustChangePassword) {
    return <ForcePasswordChange />;
  }

  if (orgError && !org) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-app)' }}>
        <div className="flex flex-col items-center gap-4 max-w-sm text-center px-6">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <i className="ri-error-warning-line text-red-400 text-xl" />
          </div>
          <p className="font-semibold text-slate-300">Organizasyon yüklenemedi</p>
          <p className="text-sm" style={{ color: '#64748B' }}>{orgError}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer" style={{ background: 'rgba(99,102,241,0.2)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.3)' }}>
            Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  const isFirmaUser = org?.role === 'firma_user';
  const FIRMA_USER_ALLOWED = new Set(['dashboard', 'personeller', 'evraklar', 'egitimler', 'uygunsuzluklar']);

  const renderPage = () => {
    if (isFirmaUser && !FIRMA_USER_ALLOWED.has(activeModule)) {
      return <DashboardPage />;
    }

    switch (activeModule) {
      case 'firmalar':        return <FirmalarPage />;
      case 'personeller':     return <PersonellerPage />;
      case 'evraklar':        return <EvraklarPage />;
      case 'egitimler':       return <EgitimlerPage />;
      case 'muayeneler':      return <MuayenelerPage />;
      case 'uygunsuzluklar':  return <UygunsuzluklarPage />;
      case 'ekipmanlar':      return <EkipmanlarPage />;
      case 'tutanaklar':      return <TutanaklarPage />;
      case 'is-izinleri':     return <IsIzniPage />;
      case 'firma-evraklari': return <FirmaEvraklariPage />;
      case 'raporlar':        return <RaporlarPage />;
      case 'gelismis-raporlar': return <GelismisRaporlarPage />;
      case 'ziyaret-takvimi': return <ZiyaretTakvimiPage />;
      case 'dokumanlar':      return <DokumanlarPage />;
      case 'copkutusu':       return <CopKutusuPage />;
      case 'ayarlar':         return isFirmaUser ? <DashboardPage /> : <SettingsPage />;
      case 'saha':            return <SahaPage />;
      default:                return <DashboardPage />;
    }
  };

  return (
    <div>
      <Layout>
        <ToastContainer />
        <OnboardingTour />
        {/* Suspense: sayfa lazy yüklenirken modüle uygun skeleton göster */}
        <Suspense fallback={<ModuleFallback module={activeModule} />}>
          {renderPage()}
        </Suspense>
      </Layout>
    </div>
  );
}

export default function ISGApp() {
  return <AppContent />;
}
