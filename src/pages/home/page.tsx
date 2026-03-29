import { useState } from 'react';
import { AppProvider, useApp } from '../../store/AppContext';
import Layout from '../../components/feature/Layout';
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
import GorevlerPage from '../tasks/page';
import TutanaklarPage from '../tutanaklar/page';
import CopKutusuPage from '../trash/page';
import SettingsPage from '../settings/page';

function AppContent() {
  const { activeModule, dataLoading, needsOnboarding, org } = useApp();

  // Redirect handled in AppContext via window.REACT_APP_NAVIGATE
  if (needsOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-app)' }}>
        <div className="flex flex-col items-center gap-3">
          <i className="ri-loader-4-line text-2xl animate-spin" style={{ color: '#6366F1' }} />
          <span className="text-sm" style={{ color: '#64748B' }}>Yönlendiriliyor...</span>
        </div>
      </div>
    );
  }

  if (dataLoading && !org) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-app)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}>
            <i className="ri-shield-check-line text-white text-xl" />
          </div>
          <div className="flex items-center gap-2" style={{ color: '#475569' }}>
            <i className="ri-loader-4-line text-lg animate-spin" />
            <span className="text-sm">Veriler yükleniyor...</span>
          </div>
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
      case 'gorevler': return <GorevlerPage />;
      case 'tutanaklar': return <TutanaklarPage />;
      case 'raporlar': return <RaporlarPage />;
      case 'copkutusu': return <CopKutusuPage />;
      case 'ayarlar': return <SettingsPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <Layout>
      <ToastContainer />
      {renderPage()}
    </Layout>
  );
}

function SahaPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-white">Saha</h2>
        <p className="text-sm mt-1" style={{ color: '#64748B' }}>Saha denetimleri ve yerinde gözlem kayıtları</p>
      </div>
      <div
        className="glass-card rounded-xl py-24 text-center"
        style={{ border: '1px dashed rgba(59,130,246,0.2)' }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}
        >
          <i className="ri-map-pin-line text-3xl" style={{ color: '#3B82F6' }} />
        </div>
        <p className="font-bold text-slate-300 text-lg mb-2">Saha Modülü</p>
        <p className="text-sm" style={{ color: '#475569' }}>Saha denetim ve kontrol özellikleri yakında eklenecek.</p>
        <p className="text-xs mt-2" style={{ color: '#334155' }}>GPS konum takibi, anlık denetim raporları ve saha fotoğrafları planlanmaktadır.</p>
      </div>
    </div>
  );
}

export default function ISGApp() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
