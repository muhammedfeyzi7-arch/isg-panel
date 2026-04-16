import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/store/AppContext';
import { useAuth } from '@/store/AuthContext';
import { supabase } from '@/lib/supabase';
import ForcePasswordChange from '@/components/feature/ForcePasswordChange';
import ToastContainer from '@/components/base/ToastContainer';
import PremiumLoadingScreen from '@/components/feature/PremiumLoadingScreen';
import UzmanSidebar, { type UzmanTab } from './components/UzmanSidebar';
import UzmanGenelBakis from './components/UzmanGenelBakis';
import UzmanFirmalar from './components/UzmanFirmalar';
import UzmanSaglik from './components/UzmanSaglik';
import UzmanHeader from './components/UzmanHeader';

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
import UzmanMobilSaha from './components/UzmanMobilSaha';



const ACCENT = '#0EA5E9';
const ACCENT_DARK = '#0284C7';

interface FirmaOption {
  id: string;
  name: string;
}

const UZMAN_STEPS = [
  { label: 'Bağlantı kuruluyor...', icon: 'ri-wifi-line', duration: 280 },
  { label: 'Uzman bilgileri yükleniyor...', icon: 'ri-user-star-line', duration: 380 },
  { label: 'Atanmış firmalar kontrol ediliyor...', icon: 'ri-building-3-line', duration: 380 },
  { label: 'Saha modülü hazırlanıyor...', icon: 'ri-map-pin-user-line', duration: 320 },
  { label: 'Hazır!', icon: 'ri-check-double-line', duration: 140 },
];

function UzmanLoadingScreen({ isDark }: { isDark: boolean }) {
  return (
    <PremiumLoadingScreen
      isDark={isDark}
      panelName="ISG Denetim"
      panelSubtitle="Gezici Uzman Paneli"
      steps={UZMAN_STEPS}
    />
  );
}

function AtamaBekleyenEkran({ isDark, onLogout, onRefresh }: { isDark: boolean; onLogout: () => void; onRefresh: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8" style={{ background: isDark ? '#0f172a' : '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');`}</style>
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(14,165,233,0.08)', border: '1.5px solid rgba(14,165,233,0.18)' }}>
          <i className="ri-map-pin-user-line text-3xl" style={{ color: ACCENT }} />
        </div>
        <h1 className="text-xl font-extrabold mb-2" style={{ color: isDark ? '#f1f5f9' : '#0f172a', letterSpacing: '-0.03em' }}>Henüz size firma atanmadı</h1>
        <p className="text-sm leading-relaxed mb-6" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>OSGB admininiz hesabınıza henüz müşteri firma ataması yapmadı.</p>
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

const TAB_TITLES: Record<UzmanTab, { title: string; subtitle: string; icon: string }> = {
  genel_bakis:      { title: 'Genel Bakış',       subtitle: 'Özet istatistikler',                   icon: 'ri-dashboard-3-line' },
  firmalar:         { title: 'Firmalar',            subtitle: 'OSGB tarafından atanan firmalar',      icon: 'ri-building-3-line' },
  personeller:      { title: 'Personel',           subtitle: 'Firma personellerini yönet',           icon: 'ri-group-line' },
  firma_belgeleri:  { title: 'Firma Belgeleri',    subtitle: 'Firma bazlı belge yönetimi',           icon: 'ri-folder-3-line' },
  belge_takibi:     { title: 'Belge Takibi',       subtitle: 'Personel evrak takibi',                icon: 'ri-file-list-3-line' },
  egitimler:        { title: 'Eğitimler',          subtitle: 'Eğitim kayıtları ve takibi',           icon: 'ri-graduation-cap-line' },
  saglik:           { title: 'Sağlık Durumu',      subtitle: 'Muayene sonuçları',                    icon: 'ri-heart-pulse-line' },
  tutanaklar:       { title: 'Tutanak Yönetimi',   subtitle: 'Tutanak oluştur ve yönet',             icon: 'ri-file-text-line' },
  saha_denetimleri: { title: 'Saha Denetimleri',   subtitle: 'Uygunsuzluk kayıtları ve DOF',         icon: 'ri-error-warning-line' },
  ekipmanlar:       { title: 'Ekipman',            subtitle: 'Ekipman kontrol ve takibi',            icon: 'ri-tools-line' },
  is_izinleri:      { title: 'İş İzinleri',        subtitle: 'İş izni yönetimi ve onaylar',          icon: 'ri-shield-keyhole-line' },
  raporlar:         { title: 'Raporlar',           subtitle: 'ISG raporları ve analizler',           icon: 'ri-bar-chart-line' },
  dokumanlar:       { title: 'Dökümanlar',         subtitle: 'Döküman kütüphanesi',                  icon: 'ri-book-2-line' },
  mobil_saha:       { title: 'Mobil Saha',         subtitle: 'QR ile ziyaret başlat (mobil)',        icon: 'ri-smartphone-line' },
  cop:              { title: 'Çöp Kutusu',         subtitle: 'Silinen kayıtlar',                     icon: 'ri-delete-bin-6-line' },
};

export default function UzmanPage() {
  const { org, theme, mustChangePassword, sidebarCollapsed, setSidebarCollapsed, addToast } = useApp();
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<UzmanTab>(() => {
    try { return (sessionStorage.getItem('uzman_active_tab') as UzmanTab) || 'genel_bakis'; } catch { return 'genel_bakis'; }
  });

  useEffect(() => {
    try { sessionStorage.setItem('uzman_active_tab', activeTab); } catch { /* ignore */ }
  }, [activeTab]);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [atanmisFirmaIds, setAtanmisFirmaIds] = useState<string[]>([]);
  const [firmaOptions, setFirmaOptions] = useState<FirmaOption[]>([]);
  const [aktiveFirmaId, setAktiveFirmaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLoading, setShowLoading] = useState(true);

  const isDark = theme === 'dark';

  useEffect(() => {
    const t = setTimeout(() => setShowLoading(false), 1600);
    return () => clearTimeout(t);
  }, []);

  // ── Tek fetchFirmalar fonksiyonu — hem ilk yükleme hem realtime kullanır ──
  const fetchFirmalar = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('user_organizations')
        .select('organization_id, active_firm_ids')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (data) {
        const rawFirmIds: string[] =
          Array.isArray(data.active_firm_ids) && data.active_firm_ids.length > 0
            ? data.active_firm_ids
            : [data.organization_id];

        const { data: orgs } = await supabase
          .from('organizations')
          .select('id, name')
          .in('id', rawFirmIds)
          .is('deleted_at', null);

        const options: FirmaOption[] = (orgs ?? []).map(o => ({ id: o.id, name: o.name }));
        const firmIds = options.map(o => o.id);
        setAtanmisFirmaIds(firmIds);
        setFirmaOptions(options);
        setAktiveFirmaId(prev => {
          if (prev && firmIds.includes(prev)) return prev;
          return options.length === 1 ? options[0].id : null;
        });
      } else {
        setAtanmisFirmaIds([]);
        setFirmaOptions([]);
        setAktiveFirmaId(null);
      }
    } catch (err) {
      console.error('[UzmanPage] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // İlk yükleme
  useEffect(() => {
    if (!user || !org) return;
    fetchFirmalar();
  }, [user?.id, org?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ziyaret planı bildirimi — bugün plan varsa toast göster
  useEffect(() => {
    if (!user?.id || !org?.id) return;
    const TODAY_DOW_TR = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'][new Date().getDay()];
    const TODAY_DOW_EN = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date().getDay()];
    supabase
      .from('osgb_ziyaret_planlari')
      .select('id, firma_org_id, gunler, notlar')
      .eq('osgb_org_id', org.id)
      .eq('aktif', true)
      .then(({ data }) => {
        const bugunPlanlar = (data ?? []).filter(p => {
          const gunler: string[] = p.gunler ?? [];
          return gunler.some(g => g === TODAY_DOW_TR || g.toLowerCase() === TODAY_DOW_EN);
        });
        if (bugunPlanlar.length === 0) return;
        // Kendi firma ataması olan planları filtrele
        supabase
          .from('user_organizations')
          .select('active_firm_ids, active_firm_id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle()
          .then(({ data: uData }) => {
            if (!uData) return;
            const firmIds: string[] = Array.isArray(uData.active_firm_ids) && uData.active_firm_ids.length > 0
              ? uData.active_firm_ids
              : uData.active_firm_id ? [uData.active_firm_id] : [];
            const ilgiliPlanlar = bugunPlanlar.filter(p =>
              firmIds.includes(p.firma_org_id) ||
              bugunPlanlar.some(bp => !bp.firma_org_id)
            );
            if (ilgiliPlanlar.length > 0) {
              // Firma adlarını çek
              supabase
                .from('organizations')
                .select('id, name')
                .in('id', ilgiliPlanlar.map(p => p.firma_org_id).filter(Boolean))
                .then(({ data: firmData }) => {
                  const firmaMap: Record<string, string> = {};
                  (firmData ?? []).forEach(f => { firmaMap[f.id] = f.name; });
                  ilgiliPlanlar.slice(0, 2).forEach(p => {
                    const firmaAd = firmaMap[p.firma_org_id] ?? 'Firma';
                    addToast(`Bugün ${firmaAd} için ziyaret planlanmış`, 'info');
                  });
                });
            }
          });
      });
  }, [user?.id, org?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime: user_organizations değişince firma listesini yenile
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`uzman_user_orgs_${user.id}`)
      .on(
        'postgres_changes' as Parameters<ReturnType<typeof supabase.channel>['on']>[0],
        { event: '*', schema: 'public', table: 'user_organizations', filter: `user_id=eq.${user.id}` } as Parameters<ReturnType<typeof supabase.channel>['on']>[1],
        () => { fetchFirmalar(); }
      )
      .subscribe();

    // organizations tablosunu da dinle (firma silindiğinde deleted_at set olur)
    const orgChannel = supabase
      .channel(`uzman_orgs_watch_${user.id}`)
      .on(
        'postgres_changes' as Parameters<ReturnType<typeof supabase.channel>['on']>[0],
        { event: 'UPDATE', schema: 'public', table: 'organizations' } as Parameters<ReturnType<typeof supabase.channel>['on']>[1],
        (payload: { new: Record<string, unknown> }) => {
          const updatedId = payload.new?.id as string | undefined;
          const deletedAt = payload.new?.deleted_at;
          if (updatedId && deletedAt) {
            setAtanmisFirmaIds(prev => prev.filter(id => id !== updatedId));
            setFirmaOptions(prev => prev.filter(f => f.id !== updatedId));
            setAktiveFirmaId(prev => (prev === updatedId ? null : prev));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(orgChannel);
    };
  }, [user?.id, fetchFirmalar]);

  const goruntulenenFirmaIds = aktiveFirmaId ? [aktiveFirmaId] : atanmisFirmaIds;

  // Her iki loading de tamamlanana kadar yükleme ekranını göster
  if (showLoading || loading) return <UzmanLoadingScreen isDark={isDark} />;
  if (mustChangePassword) return <ForcePasswordChange />;
  // Her iki loading bitti, firma ataması yoksa bekleme ekranı göster
  if (!loading && !showLoading && atanmisFirmaIds.length === 0) {
    return <AtamaBekleyenEkran isDark={isDark} onLogout={logout} onRefresh={() => window.location.reload()} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'genel_bakis':      return <UzmanGenelBakis atanmisFirmaIds={goruntulenenFirmaIds} isDark={isDark} />;
      case 'firmalar':         return <UzmanFirmalar atanmisFirmaIds={goruntulenenFirmaIds} isDark={isDark} />;
      case 'personeller':      return <PersonellerPage />;
      case 'firma_belgeleri':  return <FirmaEvraklariPage />;
      case 'belge_takibi':     return <EvraklarPage />;
      case 'egitimler':        return <EgitimlerPage />;
      case 'saglik':           return <UzmanSaglik atanmisFirmaIds={goruntulenenFirmaIds} isDark={isDark} />;
      case 'tutanaklar':       return <TutanaklarPage />;
      case 'saha_denetimleri': return <UygunsuzluklarPage />;
      case 'ekipmanlar':       return <EkipmanlarPage />;
      case 'is_izinleri':      return <IsIzniPage />;
      case 'raporlar':         return <RaporlarPage />;
      case 'dokumanlar':       return <DokumanlarPage />;
      case 'mobil_saha':       return <UzmanMobilSaha />;
      case 'cop':              return <CopKutusuPage />;
      default:                 return null;
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
        .uzman-content { animation: fadeSlideUp 0.3s ease forwards; }
        :root {
          --bg-sidebar: ${isDark ? '#111827' : '#ffffff'};
          --bg-main: ${isDark ? '#0f172a' : '#f8fafc'};
          --bg-item: ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)'};
          --bg-item-border: ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.07)'};
          --bg-hover: ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)'};
          --bg-card: ${isDark ? 'rgba(15,23,42,0.8)' : 'rgba(255,255,255,0.95)'};
          --bg-card-solid: ${isDark ? '#1e293b' : '#ffffff'};
          --bg-header: ${isDark ? 'rgba(10,15,26,0.95)' : 'rgba(255,255,255,0.97)'};
          --bg-input: ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)'};
          --border-subtle: ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)'};
          --border-main: ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.1)'};
          --border-input: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.12)'};
          --text-primary: ${isDark ? '#f1f5f9' : '#0f172a'};
          --text-secondary: ${isDark ? '#94a3b8' : '#475569'};
          --text-muted: ${isDark ? '#64748b' : '#64748b'};
          --text-faint: ${isDark ? '#334155' : '#cbd5e1'};
          --chart-tooltip-bg: ${isDark ? 'rgba(10,16,32,0.95)' : '#ffffff'};
          --chart-tooltip-border: ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.1)'};
        }
        .btn-primary { background: linear-gradient(135deg, #0EA5E9, #0284C7); color: #fff; border: none; border-radius: 10px; padding: 8px 16px; font-size: 12.5px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; transition: box-shadow 0.2s; }
        .btn-primary:hover { box-shadow: 0 4px 16px rgba(14,165,233,0.4); }
        .stat-card-interactive:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.15) !important; transform: translateY(-2px); }
        .table-premium { border-collapse: collapse; } .table-premium th { padding: 10px 14px; font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-muted); background: var(--bg-item); border-bottom: 1px solid var(--border-subtle); white-space: nowrap; } .table-premium td { padding: 10px 14px; font-size: 12px; color: var(--text-secondary); border-bottom: 1px solid var(--border-subtle); } .table-premium tbody tr:hover td { background: var(--bg-hover); }
        .isg-card { background: var(--bg-card-solid); border: 1px solid var(--border-subtle); border-radius: 16px; }
        @keyframes slide-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slide-up { animation: slide-up 0.18s ease forwards; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.3s ease forwards; }
      `}</style>

      {/* Mobile overlay */}
      <div
        className="fixed inset-0 lg:hidden"
        style={{
          zIndex: 41,
          background: mobileOpen ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0)',
          backdropFilter: mobileOpen ? 'blur(8px) saturate(0.7)' : 'blur(0px)',
          WebkitBackdropFilter: mobileOpen ? 'blur(8px) saturate(0.7)' : 'blur(0px)',
          opacity: mobileOpen ? 1 : 0,
          pointerEvents: mobileOpen ? 'auto' : 'none',
          transition: mobileOpen
            ? 'opacity 0.32s cubic-bezier(0.22,1,0.36,1), backdrop-filter 0.32s cubic-bezier(0.22,1,0.36,1)'
            : 'opacity 0.22s ease, backdrop-filter 0.22s ease',
        }}
        onClick={() => setMobileOpen(false)}
      />

      <UzmanSidebar
        activeTab={activeTab}
        setActiveTab={tab => { setActiveTab(tab); setMobileOpen(false); }}
        orgName={org?.displayName ?? 'Gezici Uzman'}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Ana Header — ana panelle aynı */}
      <UzmanHeader
        onMobileMenuToggle={() => setMobileOpen(v => !v)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        tabTitles={TAB_TITLES}
        firmaOptions={firmaOptions}
        aktiveFirmaId={aktiveFirmaId}
        setAktiveFirmaId={setAktiveFirmaId}
      />

      <main
        className="min-h-screen transition-all duration-300"
        style={{ overflowX: 'hidden', overflowY: 'auto' }}
      >
        {/* ── İçerik ── */}
        <div
          className={`pt-[76px] uzman-content transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-[76px]' : 'lg:pl-[232px]'} pb-8`}
          key={`${activeTab}-${aktiveFirmaId ?? 'all'}`}
          style={{ minHeight: 'calc(100vh - 76px)' }}
        >
          <div className="px-3 sm:px-5 md:px-6 py-4 max-w-[1600px] w-full">
            {renderContent()}
          </div>
        </div>
      </main>

      <ToastContainer />
    </div>
  );
}
