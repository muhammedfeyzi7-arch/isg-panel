import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppLoadingScreen from '../../components/feature/AppLoadingScreen';
import { useApp } from '../../store/AppContext';
import Layout from '../../components/feature/Layout';
import ForcePasswordChange from '../../components/feature/ForcePasswordChange';
import OnboardingTour from '../../components/feature/OnboardingTour';
import KvkkPopup from '../../components/feature/KvkkPopup';
import ToastContainer from '../../components/base/ToastContainer';
import DashboardPage from '../dashboard/page';
import FirmalarPage from '../companies/page';
import PersonellerPage from '../personnel/page';
import EvraklarPage from '../documents/page';
import EgitimlerPage from '../training/page';
import RaporlarPage from '../reports/page';
import EkipmanlarPage from '../equipment/page';
import MuayenelerPage from '../health/page';
import UygunsuzluklarPage from '../nonconformity/page';
import TutanaklarPage from '../tutanaklar/page';
import CopKutusuPage from '../trash/page';
import SettingsPage from '../settings/page';
import IsIzniPage from '../is-izni/page';
import FirmaEvraklariPage from '../company-documents/page';
import SahaPage from '../saha/page';
import SuperAdminPage from '../super-admin/page';

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
  '/saha':            'saha',
  '/raporlar':        'raporlar',
  '/copkutusu':       'copkutusu',
  '/ayarlar':         'ayarlar',
  '/superadmin':      'superadmin',
};

function AppContent() {
  const { activeModule, orgError, org, mustChangePassword, setActiveModule, kvkkAccepted, setKvkkAccepted, pageLoading } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [loadingDone, setLoadingDone] = useState(false);

  // pageLoading bitince loading screen'i kapat
  useEffect(() => {
    if (!pageLoading) {
      // Kısa bir gecikme — animasyon tamamlansın
      const t = setTimeout(() => setLoadingDone(true), 300);
      return () => clearTimeout(t);
    }
  }, [pageLoading]);

  // URL değişince activeModule'ü güncelle
  useEffect(() => {
    const module = PATH_TO_MODULE[location.pathname];
    if (module && module !== activeModule) {
      setActiveModule(module);
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // activeModule değişince URL'yi güncelle (sidebar tıklamaları için)
  useEffect(() => {
    const expectedPath = `/${activeModule}`;
    if (location.pathname !== expectedPath && PATH_TO_MODULE[expectedPath] !== undefined) {
      navigate(expectedPath, { replace: true });
    }
  }, [activeModule]); // eslint-disable-line react-hooks/exhaustive-deps

  // İlk yükleme — loading screen göster (cache varsa çok kısa sürer)
  if (!loadingDone) {
    return <AppLoadingScreen onDone={() => setLoadingDone(true)} />;
  }

  if (mustChangePassword) {
    return <ForcePasswordChange />;
  }

  // KVKK: sadece kvkk_accepted=false olan kullanıcılara göster
  if (org && !kvkkAccepted) {
    return <KvkkPopup onAccepted={setKvkkAccepted} />;
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

  // firma_user yasak modüllere erişmeye çalışırsa dashboard'a yönlendir
  const FIRMA_USER_ALLOWED = new Set(['dashboard', 'personeller', 'evraklar', 'egitimler', 'uygunsuzluklar']);

  const renderPage = () => {
    // Super admin sayfası — Layout olmadan direkt render
    if (activeModule === 'superadmin') {
      return <SuperAdminPage />;
    }

    // firma_user için modul kısıtlaması
    if (isFirmaUser && !FIRMA_USER_ALLOWED.has(activeModule)) {
      return <DashboardPage />;
    }

    switch (activeModule) {
      case 'firmalar': return <FirmalarPage />;
      case 'personeller': return <PersonellerPage />;
      case 'evraklar': return <EvraklarPage />;
      case 'egitimler': return <EgitimlerPage />;
      case 'muayeneler': return <MuayenelerPage />;
      case 'uygunsuzluklar': return <UygunsuzluklarPage />;
      case 'ekipmanlar': return <EkipmanlarPage />;
      case 'tutanaklar': return <TutanaklarPage />;
      case 'is-izinleri': return <IsIzniPage />;
      case 'firma-evraklari': return <FirmaEvraklariPage />;
      case 'saha': return <SahaPage />;
      case 'raporlar': return <RaporlarPage />;
      case 'copkutusu': return <CopKutusuPage />;
      case 'ayarlar': return isFirmaUser ? <DashboardPage /> : <SettingsPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <Layout>
      <ToastContainer />
      <OnboardingTour />
      {renderPage()}
    </Layout>
  );
}

export default function ISGApp() {
  return <AppContent />;
}
