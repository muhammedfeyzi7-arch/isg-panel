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
}

const tools: DocTool[] = [
  {
    id: 'acil-durum-eylem-plani',
    title: 'Acil Durum Eylem Planı',
    description: 'AI destekli acil durum eylem planı oluşturun. Sektörünüze özel tahliye prosedürleri, müdahale adımları ve sorumluluk dağılımı otomatik hazırlanır.',
    icon: 'ri-alarm-warning-line',
    color: '#DC2626',
    bgColor: 'rgba(220,38,38,0.06)',
    borderColor: 'rgba(220,38,38,0.15)',
    badge: 'AI Destekli',
  },
  {
    id: 'saglik-guvenlik-plani',
    title: 'Sağlık Güvenlik Planı',
    description: 'İş yerinizdeki sağlık ve güvenlik risklerini kapsayan kapsamlı bir plan oluşturun. Yasal gerekliliklere uygun, sektöre özel içerik üretilir.',
    icon: 'ri-shield-check-line',
    color: '#059669',
    bgColor: 'rgba(5,150,105,0.06)',
    borderColor: 'rgba(5,150,105,0.15)',
    badge: 'AI Destekli',
  },
  {
    id: 'koordinator-atamasi',
    title: 'SGP Koordinatör Ataması',
    description: 'Sağlık Güvenlik Planı koordinatör atama belgesi hazırlayın. Görev tanımları, yetkiler ve sorumluluklar otomatik olarak düzenlenir.',
    icon: 'ri-user-star-line',
    color: '#7C3AED',
    bgColor: 'rgba(124,58,237,0.06)',
    borderColor: 'rgba(124,58,237,0.15)',
    badge: 'AI Destekli',
  },
  {
    id: 'acil-durum-ekipleri',
    title: 'Acil Durum Ekipleri',
    description: 'Yangın, tahliye, ilk yardım ve kurtarma ekiplerini oluşturun. Ekip üyelerinin görev ve sorumluluklarını içeren resmi belge hazırlanır.',
    icon: 'ri-team-line',
    color: '#D97706',
    bgColor: 'rgba(217,119,6,0.06)',
    borderColor: 'rgba(217,119,6,0.15)',
    badge: 'AI Destekli',
  },
  {
    id: 'risk-analizi',
    title: 'Risk Analizi',
    description: 'Fine-Kinney metoduyla AI destekli risk analizi yapın. Sektör ve tehlike türünü belirtin, AI otomatik olarak risk tablosunu oluşturur ve önleyici faaliyetleri önerir.',
    icon: 'ri-bar-chart-grouped-line',
    color: '#0284C7',
    bgColor: 'rgba(2,132,199,0.06)',
    borderColor: 'rgba(2,132,199,0.15)',
    badge: 'Fine-Kinney',
  },
];

export default function DokumanlarPage() {
  const [hoveredId, setHoveredId] = useState<ModalType>(null);
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  return (
    <div className="min-h-full" style={{ background: 'var(--bg-app)' }}>
      {/* Header */}
      <div
        className="px-6 py-5 border-b"
        style={{ borderColor: 'var(--border-main)', background: 'var(--bg-card)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
          >
            <i className="ri-file-text-line text-base" style={{ color: '#818CF8' }} />
          </div>
          <div>
            <h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Dökümanlar
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              AI destekli belge ve plan oluşturma araçları
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Info Banner */}
        <div
          className="rounded-xl p-4 mb-6 flex items-start gap-3"
          style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}
        >
          <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
            <i className="ri-sparkling-2-line text-sm" style={{ color: '#818CF8' }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Yapay Zeka Destekli Belge Üretimi
            </p>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Sektörünüzü ve ihtiyacınızı belirtin, yapay zeka yasal gerekliliklere uygun, profesyonel belgeler oluştursun.
              Oluşturulan belgeleri Firma Belgeleri bölümüne yükleyebilirsiniz.
            </p>
          </div>
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tools.map((tool) => (
            <button
              key={tool.id}
              className="text-left rounded-xl p-5 cursor-pointer transition-all duration-200 relative overflow-hidden"
              style={{
                background: hoveredId === tool.id ? tool.bgColor : 'var(--bg-card)',
                border: `1px solid ${hoveredId === tool.id ? tool.borderColor : 'var(--border-main)'}`,
                transform: hoveredId === tool.id ? 'translateY(-2px)' : 'translateY(0)',
              }}
              onMouseEnter={() => setHoveredId(tool.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => setActiveModal(tool.id)}
            >
              {/* Badge */}
              {tool.badge && (
                <span
                  className="absolute top-4 right-4 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: tool.bgColor, color: tool.color, border: `1px solid ${tool.borderColor}` }}
                >
                  {tool.badge}
                </span>
              )}

              {/* Icon */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: tool.bgColor, border: `1px solid ${tool.borderColor}` }}
              >
                <i className={`${tool.icon} text-lg`} style={{ color: tool.color }} />
              </div>

              {/* Title */}
              <h3 className="text-sm font-semibold mb-2 pr-16" style={{ color: 'var(--text-primary)' }}>
                {tool.title}
              </h3>

              {/* Description */}
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {tool.description}
              </p>

              {/* Footer */}
              <div className="flex items-center gap-1.5 mt-4 pt-4" style={{ borderTop: '1px solid var(--border-main)' }}>
                <span className="text-xs font-semibold" style={{ color: tool.color }}>
                  Oluşturmaya Başla
                </span>
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-arrow-right-line text-xs" style={{ color: tool.color }} />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Modals */}
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
