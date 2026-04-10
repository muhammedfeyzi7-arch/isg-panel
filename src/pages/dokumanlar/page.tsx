import { useState } from 'react';
import RiskAnaliziModal from './components/RiskAnaliziModal';
import AcilDurumEylemPlaniModal from './components/AcilDurumEylemPlaniModal';
import SaglikGuvenlikPlaniModal from './components/SaglikGuvenlikPlaniModal';
import KoordinatorAtamasiModal from './components/KoordinatorAtamasiModal';
import AcilDurumEkipleriModal from './components/AcilDurumEkipleriModal';

type ModalType = 'risk-analizi' | 'acil-durum-eylem-plani' | 'saglik-guvenlik-plani' | 'koordinator-atamasi' | 'acil-durum-ekipleri' | null;

interface DocTool {
  id: ModalType;
  title: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  badge?: string;
  badgeBg?: string;
}

const tools: DocTool[] = [
  {
    id: 'acil-durum-eylem-plani',
    title: 'Acil Durum Eylem Planı',
    description: 'AI destekli acil durum eylem planı oluşturun. Sektörünüze özel tahliye prosedürleri, müdahale adımları ve sorumluluk dağılımı otomatik hazırlanır.',
    icon: 'ri-alarm-warning-line',
    color: '#DC2626',
    bgColor: 'rgba(220,38,38,0.08)',
    borderColor: 'rgba(220,38,38,0.18)',
    badge: 'AI Destekli',
    badgeBg: 'rgba(220,38,38,0.1)',
  },
  {
    id: 'saglik-guvenlik-plani',
    title: 'Sağlık Güvenlik Planı',
    description: 'Yapı işleri mevzuatına uygun, 15 bölümlü kapsamlı Sağlık ve Güvenlik Planı oluşturun. Tüm yasal referanslar ve tablolar dahil.',
    icon: 'ri-shield-check-line',
    color: '#059669',
    bgColor: 'rgba(5,150,105,0.08)',
    borderColor: 'rgba(5,150,105,0.18)',
    badge: '15 Bölüm',
    badgeBg: 'rgba(5,150,105,0.1)',
  },
  {
    id: 'koordinator-atamasi',
    title: 'SGP Koordinatör Ataması',
    description: 'Sağlık Güvenlik Planı koordinatör atama belgesi hazırlayın. Görev tanımları, yetkiler ve sorumluluklar otomatik olarak düzenlenir.',
    icon: 'ri-user-star-line',
    color: '#7C3AED',
    bgColor: 'rgba(124,58,237,0.08)',
    borderColor: 'rgba(124,58,237,0.18)',
    badge: 'Word Belgesi',
    badgeBg: 'rgba(124,58,237,0.1)',
  },
  {
    id: 'acil-durum-ekipleri',
    title: 'Acil Durum Ekipleri',
    description: 'Kurtarma, tahliye, söndürme ve ilk yardım ekiplerini oluşturun. Personel bilgilerini girin, resmi atama formu Word belgesi olarak hazırlanır.',
    icon: 'ri-team-line',
    color: '#D97706',
    bgColor: 'rgba(217,119,6,0.08)',
    borderColor: 'rgba(217,119,6,0.18)',
    badge: 'Atama Formu',
    badgeBg: 'rgba(217,119,6,0.1)',
  },
  {
    id: 'risk-analizi',
    title: 'Risk Analizi',
    description: 'Fine-Kinney metoduyla AI destekli risk analizi yapın. Sektör ve tehlike türünü belirtin, AI otomatik olarak risk tablosunu oluşturur ve önleyici faaliyetleri önerir.',
    icon: 'ri-bar-chart-grouped-line',
    color: '#0284C7',
    bgColor: 'rgba(2,132,199,0.08)',
    borderColor: 'rgba(2,132,199,0.18)',
    badge: 'Fine-Kinney',
    badgeBg: 'rgba(2,132,199,0.1)',
  },
];

export default function DokumanlarPage() {
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Dökümanlar</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[11px] sm:text-[12px]" style={{ color: 'var(--text-muted)' }}>AI destekli belge ve plan oluşturma araçları</span>
            <span className="w-1 h-1 rounded-full" style={{ background: 'var(--border-main)' }} />
            <span className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8' }}>{tools.length} araç</span>
          </div>
        </div>
      </div>

      {/* ── Info Banner ── */}
      <div
        className="flex items-start gap-3 px-4 py-3 rounded-xl"
        style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}
      >
        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
          <i className="ri-sparkling-2-line text-sm" style={{ color: '#818CF8' }} />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Yapay Zeka Destekli Belge Üretimi
          </p>
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Sektörünüzü ve ihtiyacınızı belirtin, yapay zeka yasal gerekliliklere uygun profesyonel belgeler oluştursun. Oluşturulan belgeleri Firma Belgeleri bölümüne yükleyebilirsiniz.
          </p>
        </div>
      </div>

      {/* ── Tools Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {tools.map((tool) => (
          <button
            key={tool.id}
            className="text-left rounded-xl p-5 cursor-pointer transition-all duration-200 isg-card group"
            onClick={() => setActiveModal(tool.id)}
          >
            {/* Top row: icon + badge */}
            <div className="flex items-start justify-between mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: tool.bgColor, border: `1px solid ${tool.borderColor}` }}
              >
                <i className={`${tool.icon} text-lg`} style={{ color: tool.color }} />
              </div>
              {tool.badge && (
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                  style={{ background: tool.badgeBg, color: tool.color, border: `1px solid ${tool.borderColor}` }}
                >
                  {tool.badge}
                </span>
              )}
            </div>

            {/* Title */}
            <h3 className="text-sm font-bold mb-1.5" style={{ color: 'var(--text-primary)' }}>
              {tool.title}
            </h3>

            {/* Description */}
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {tool.description}
            </p>

            {/* Footer */}
            <div
              className="flex items-center gap-1.5 mt-4 pt-3"
              style={{ borderTop: '1px solid var(--border-subtle)' }}
            >
              <span className="text-xs font-semibold" style={{ color: tool.color }}>
                Oluşturmaya Başla
              </span>
              <div className="w-4 h-4 flex items-center justify-center transition-transform duration-200 group-hover:translate-x-0.5">
                <i className="ri-arrow-right-line text-xs" style={{ color: tool.color }} />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* ── Modals ── */}
      {activeModal === 'risk-analizi' && (
        <RiskAnaliziModal onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'acil-durum-eylem-plani' && (
        <AcilDurumEylemPlaniModal onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'saglik-guvenlik-plani' && (
        <SaglikGuvenlikPlaniModal onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'koordinator-atamasi' && (
        <KoordinatorAtamasiModal onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'acil-durum-ekipleri' && (
        <AcilDurumEkipleriModal onClose={() => setActiveModal(null)} />
      )}
    </div>
  );
}
