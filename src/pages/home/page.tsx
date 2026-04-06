import { useApp } from '../../store/AppContext';
import Layout from '../../components/feature/Layout';
import ForcePasswordChange from '../../components/feature/ForcePasswordChange';
import OnboardingTour from '../../components/feature/OnboardingTour';
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

function AppContent() {
  const { activeModule, orgError, org, mustChangePassword } = useApp();

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

  const renderPage = () => {
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
      case 'raporlar': return <RaporlarPage />;
      case 'copkutusu': return <CopKutusuPage />;
      case 'ayarlar': return <SettingsPage />;
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
