import { useState } from 'react';
import { Navigate } from 'react-router-dom';
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
  const { activeModule, dataLoading, needsOnboarding, orgLoading, orgError, org } = useApp();

  // Org not found / create failed → send to onboarding so user can take action
  if (needsOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  // Show error if org loading failed and we have no org
  if (orgError && !org) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-app)' }}>
        <div className="flex flex-col items-center gap-4 max-w-sm text-center px-6">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <i className="ri-error-warning-line text-red-400 text-xl" />
          </div>
          <p className="font-semibold text-slate-300">Organizasyon yüklenemedi</p>
          <p className="text-sm" style={{ color: '#64748B' }}>{orgError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
            style={{ background: 'rgba(99,102,241,0.2)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.3)' }}
          >
            Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  if ((orgLoading || dataLoading) && !org) {
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
