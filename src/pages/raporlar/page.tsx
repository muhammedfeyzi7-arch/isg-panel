import { useState, useMemo } from 'react';
import { useApp } from '@/store/AppContext';
import FirmaRaporKarti from './components/FirmaRaporKarti';
import RaporOzetGrafik from './components/RaporOzetGrafik';
import RaporExportPanel from './components/RaporExportPanel';

type RaporTab = 'genel' | 'firma' | 'export';

export default function RaporlarPage() {
  const { firmalar } = useApp();
  const [activeTab, setActiveTab] = useState<RaporTab>('genel');
  const [secilenFirmaId, setSecilenFirmaId] = useState<string>('');

  const aktifFirmalar = useMemo(() => firmalar.filter(f => !f.silinmis), [firmalar]);

  const TABS: { id: RaporTab; label: string; icon: string }[] = [
    { id: 'genel', label: 'Genel Özet', icon: 'ri-bar-chart-box-line' },
    { id: 'firma', label: 'Firma Bazlı', icon: 'ri-building-2-line' },
    { id: 'export', label: 'Dışa Aktar', icon: 'ri-download-2-line' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl overflow-hidden isg-card">
        <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, #7C3AED, #A78BFA, #C4B5FD)' }} />
        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #A78BFA)' }}>
              <i className="ri-bar-chart-box-line text-white text-sm" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                Gelişmiş Raporlar
              </h1>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Firma bazlı analiz, grafik özeti ve dışa aktarma
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sekmeler */}
      <div className="flex items-center gap-1 p-1 rounded-xl isg-card" style={{ maxWidth: 'fit-content' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
            style={{
              background: activeTab === tab.id ? 'rgba(124,58,237,0.12)' : 'transparent',
              color: activeTab === tab.id ? '#A78BFA' : 'var(--text-muted)',
              border: activeTab === tab.id ? '1px solid rgba(124,58,237,0.25)' : '1px solid transparent',
            }}
          >
            <i className={`${tab.icon} text-sm`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Genel Özet */}
      {activeTab === 'genel' && <RaporOzetGrafik />}

      {/* Firma Bazlı */}
      {activeTab === 'firma' && (
        <div className="space-y-4">
          {/* Firma seçici */}
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={secilenFirmaId}
              onChange={e => setSecilenFirmaId(e.target.value)}
              className="isg-input"
              style={{ minWidth: '220px' }}
            >
              <option value="">Tüm Firmalar Genel Görünüm</option>
              {aktifFirmalar.map(f => (
                <option key={f.id} value={f.id}>{f.ad}</option>
              ))}
            </select>
            {secilenFirmaId && (
              <button
                onClick={() => setSecilenFirmaId('')}
                className="btn-secondary whitespace-nowrap text-xs"
              >
                <i className="ri-close-line mr-1" />Temizle
              </button>
            )}
          </div>

          {secilenFirmaId ? (
            <FirmaRaporKarti firmaId={secilenFirmaId} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {aktifFirmalar.length === 0 ? (
                <div className="col-span-full isg-card rounded-xl py-16 text-center">
                  <i className="ri-building-2-line text-3xl" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm mt-3" style={{ color: 'var(--text-muted)' }}>Firma bulunamadı</p>
                </div>
              ) : (
                aktifFirmalar.map(f => (
                  <FirmaRaporKarti
                    key={f.id}
                    firmaId={f.id}
                    compact
                    onClick={() => { setSecilenFirmaId(f.id); }}
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Dışa Aktar */}
      {activeTab === 'export' && <RaporExportPanel />}
    </div>
  );
}
