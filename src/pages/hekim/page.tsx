import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/store/AppContext';
import { useAuth } from '@/store/AuthContext';
import { supabase } from '@/lib/supabase';
import HekimSidebar, { type HekimTab } from './components/HekimSidebar';
import HekimFirmalarTab from './components/HekimFirmalarTab';
import HekimPersonellerTab from './components/HekimPersonellerTab';
import HekimSaglikTab from './components/HekimSaglikTab';

interface FirmaOption {
  id: string;
  name: string;
}

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518';

export default function HekimPage() {
  const { org, theme } = useApp();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<HekimTab>('firmalar');
  const [collapsed, setCollapsed] = useState(false);

  // Atanmış tüm firmalar
  const [atanmisFirmaIds, setAtanmisFirmaIds] = useState<string[]>([]);
  const [firmaOptions, setFirmaOptions] = useState<FirmaOption[]>([]);
  // Aktif seçili firma (switcher için) — null = tümü
  const [aktiveFirmaId, setAktiveFirmaId] = useState<string | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  const [orgId, setOrgId] = useState('');
  const [loading, setLoading] = useState(true);

  const isDark = theme === 'dark';
  const SIDEBAR_WIDTH = collapsed ? 64 : 220;

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

  // Hekimin atanmış firmalarını çek
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

          // Firma adlarını çek
          const { data: orgs } = await supabase
            .from('organizations')
            .select('id, name')
            .in('id', firmIds);

          const options: FirmaOption[] = (orgs ?? []).map(o => ({ id: o.id, name: o.name }));
          setFirmaOptions(options);

          // Tek firma varsa onu aktif seç
          if (options.length === 1) {
            setAktiveFirmaId(options[0].id);
          }
        }
      } catch (err) {
        console.error('[HekimPage] fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFirmalar();
  }, [user?.id, org?.id]);

  // Aktif firma bazlı filtre — null ise tüm firmalar
  const goruntulenenFirmaIds = aktiveFirmaId ? [aktiveFirmaId] : atanmisFirmaIds;
  const aktifFirmaAd = aktiveFirmaId
    ? firmaOptions.find(f => f.id === aktiveFirmaId)?.name ?? ''
    : null;

  // Loading
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
              style={{ border: '3px solid rgba(14,165,233,0.15)', borderTop: '3px solid #0EA5E9', animation: 'spin 0.9s linear infinite' }}
            />
            <img src={LOGO_URL} alt="ISG" className="w-7 h-7 object-contain relative z-10" />
          </div>
          <p className="text-sm font-semibold" style={{ color: isDark ? '#e2e8f0' : '#0f172a' }}>Hekim paneli yükleniyor...</p>
        </div>
      </div>
    );
  }

  // No-firma empty state
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
            style={{ background: 'rgba(14,165,233,0.08)', border: '1.5px solid rgba(14,165,233,0.18)' }}
          >
            <i className="ri-hospital-line text-3xl" style={{ color: '#0EA5E9' }} />
          </div>
          <h1 className="text-xl font-extrabold mb-2" style={{ color: isDark ? '#f1f5f9' : '#0f172a', letterSpacing: '-0.03em' }}>
            Henüz size firma atanmadı
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
            OSGB admininiz hesabınıza henüz müşteri firma ataması yapmadı. Atama yapıldığında panel otomatik olarak açılacak.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="whitespace-nowrap mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}
          >
            <i className="ri-refresh-line" />
            Yenile
          </button>
        </div>
      </div>
    );
  }

  const tabTitles: Record<HekimTab, { title: string; subtitle: string; icon: string }> = {
    firmalar: { title: 'Firmalar', subtitle: 'Atanmış firmaların genel durumu', icon: 'ri-building-3-line' },
    personeller: { title: 'Personeller', subtitle: 'Tüm firmalardaki çalışanlar', icon: 'ri-group-line' },
    saglik: { title: 'Sağlık Takibi', subtitle: 'Periyodik muayene kayıtları', icon: 'ri-heart-pulse-line' },
  };

  const current = tabTitles[activeTab];

  const renderContent = () => {
    switch (activeTab) {
      case 'firmalar':
        return <HekimFirmalarTab orgId={orgId} atanmisFirmaIds={goruntulenenFirmaIds} isDark={isDark} />;
      case 'personeller':
        return <HekimPersonellerTab atanmisFirmaIds={goruntulenenFirmaIds} isDark={isDark} />;
      case 'saglik':
        return <HekimSaglikTab atanmisFirmaIds={goruntulenenFirmaIds} isDark={isDark} />;
      default:
        return null;
    }
  };

  return (
    <div
      className="min-h-screen flex"
      style={{
        background: isDark
          ? 'linear-gradient(135deg, #0a0f1a 0%, #0d1525 50%, #0a1020 100%)'
          : 'linear-gradient(135deg, #f0f9ff 0%, #f8fafc 50%, #f0f4ff 100%)',
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

      <HekimSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        orgName={org?.displayName ?? 'İşyeri Hekimi'}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />

      <main
        className="flex-1 min-h-screen overflow-y-auto"
        style={{ marginLeft: `${SIDEBAR_WIDTH}px`, transition: 'margin-left 0.28s cubic-bezier(0.4,0,0.2,1)' }}
      >
        {/* ── Topbar ── */}
        <div
          className="sticky top-0 z-30 flex items-center gap-4 px-6 h-[56px]"
          style={{
            background: isDark ? 'rgba(17,24,39,0.92)' : 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(14px)',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)'}`,
          }}
        >
          {/* Sekme başlığı */}
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
              <i className={`${current.icon} text-sm`} style={{ color: '#0EA5E9' }} />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight" style={{ color: isDark ? '#f1f5f9' : '#0f172a' }}>
                {current.title}
              </p>
              <p className="text-[10px] leading-none mt-0.5" style={{ color: '#94a3b8' }}>
                {current.subtitle}
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2.5">
            {/* ── Firma Switcher ── */}
            {firmaOptions.length > 0 && (
              <div className="relative" ref={switcherRef}>
                <button
                  onClick={() => setSwitcherOpen(v => !v)}
                  className="whitespace-nowrap flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-semibold cursor-pointer transition-all"
                  style={{
                    background: aktiveFirmaId
                      ? 'rgba(14,165,233,0.12)'
                      : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)'),
                    border: `1px solid ${aktiveFirmaId ? 'rgba(14,165,233,0.3)' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)')}`,
                    color: aktiveFirmaId ? '#0EA5E9' : (isDark ? '#94a3b8' : '#475569'),
                  }}
                >
                  <i className="ri-building-3-line text-xs" />
                  <span className="max-w-[140px] truncate">
                    {aktifFirmaAd ?? `Tümü (${firmaOptions.length} firma)`}
                  </span>
                  {switcherOpen ? <i className="ri-arrow-up-s-line text-xs" /> : <i className="ri-arrow-down-s-line text-xs" />}
                </button>

                {/* Dropdown */}
                {switcherOpen && (
                  <div
                    className="switcher-dropdown absolute right-0 top-full mt-2 rounded-xl overflow-hidden z-50"
                    style={{
                      minWidth: '200px',
                      background: isDark ? '#1e293b' : '#ffffff',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)'}`,
                      boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 24px rgba(15,23,42,0.1)',
                    }}
                  >
                    {/* Tümü seçeneği — sadece birden fazla firma varsa */}
                    {firmaOptions.length > 1 && (
                      <button
                        onClick={() => { setAktiveFirmaId(null); setSwitcherOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-colors"
                        style={{
                          background: !aktiveFirmaId ? 'rgba(14,165,233,0.1)' : 'transparent',
                          color: !aktiveFirmaId ? '#0EA5E9' : (isDark ? '#94a3b8' : '#475569'),
                        }}
                        onMouseEnter={e => { if (aktiveFirmaId) (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)'; }}
                        onMouseLeave={e => { if (aktiveFirmaId) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <div className="w-6 h-6 flex items-center justify-center rounded-md flex-shrink-0"
                          style={{ background: !aktiveFirmaId ? 'rgba(14,165,233,0.15)' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)') }}>
                          <i className="ri-apps-line text-xs" style={{ color: !aktiveFirmaId ? '#0EA5E9' : (isDark ? '#94a3b8' : '#64748b') }} />
                        </div>
                        <span className="text-[12px] font-semibold">Tüm Firmalar</span>
                        {!aktiveFirmaId && <i className="ri-check-line text-xs ml-auto" style={{ color: '#0EA5E9' }} />}
                      </button>
                    )}

                    {/* Firma seçenekleri */}
                    {firmaOptions.map(f => (
                      <button
                        key={f.id}
                        onClick={() => { setAktiveFirmaId(f.id); setSwitcherOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-colors"
                        style={{
                          background: aktiveFirmaId === f.id ? 'rgba(14,165,233,0.1)' : 'transparent',
                          color: aktiveFirmaId === f.id ? '#0EA5E9' : (isDark ? '#e2e8f0' : '#0f172a'),
                        }}
                        onMouseEnter={e => { if (aktiveFirmaId !== f.id) (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)'; }}
                        onMouseLeave={e => { if (aktiveFirmaId !== f.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white"
                          style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}
                        >
                          {f.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[12px] font-medium flex-1 truncate">{f.name}</span>
                        {aktiveFirmaId === f.id && (
                          <i className="ri-check-line text-xs flex-shrink-0" style={{ color: '#0EA5E9' }} />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* İşyeri Hekimi badge */}
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#0EA5E9', boxShadow: '0 0 5px rgba(14,165,233,0.6)' }} />
              <span className="text-[10px] font-bold" style={{ color: '#0EA5E9' }}>İŞYERİ HEKİMİ</span>
            </div>
          </div>
        </div>

        {/* ── İçerik ── */}
        <div className="p-8 hekim-content" key={`${activeTab}-${aktiveFirmaId ?? 'all'}`}>
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
