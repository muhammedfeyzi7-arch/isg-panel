interface OsgbQuickActionsProps {
  onFirmaEkle: () => void;
  onUzmanEkle: () => void;
  onZiyaretGit: () => void;
  onRaporGit: () => void;
}

interface ActionModule {
  id: string;
  icon: string;
  title: string;
  description: string;
  color: string;
  bg: string;
  border: string;
  glow: string;
  badge?: string;
  onClick: () => void;
}

export default function OsgbQuickActions({
  onFirmaEkle,
  onUzmanEkle,
  onZiyaretGit,
  onRaporGit,
}: OsgbQuickActionsProps) {
  const modules: ActionModule[] = [
    {
      id: 'firma',
      icon: 'ri-building-3-line',
      title: 'Firma Ekle',
      description: 'Yeni müşteri firma oluştur ve ISG süreçlerini başlat.',
      color: '#10B981',
      bg: 'rgba(16,185,129,0.08)',
      border: 'rgba(16,185,129,0.18)',
      glow: 'rgba(16,185,129,0.1)',
      badge: 'Yönetim',
      onClick: onFirmaEkle,
    },
    {
      id: 'uzman',
      icon: 'ri-shield-user-line',
      title: 'Uzman Ekle',
      description: 'Gezici uzman hesabı oluştur ve firmaya ata.',
      color: '#10B981',
      bg: 'rgba(16,185,129,0.08)',
      border: 'rgba(16,185,129,0.18)',
      glow: 'rgba(16,185,129,0.1)',
      badge: 'Ekip',
      onClick: onUzmanEkle,
    },
    {
      id: 'ziyaret',
      icon: 'ri-map-pin-2-line',
      title: 'Ziyaretler',
      description: 'Saha ziyaretlerini takip et, anlık durumu görüntüle.',
      color: '#F59E0B',
      bg: 'rgba(245,158,11,0.08)',
      border: 'rgba(245,158,11,0.18)',
      glow: 'rgba(245,158,11,0.1)',
      badge: 'Saha',
      onClick: onZiyaretGit,
    },
    {
      id: 'rapor',
      icon: 'ri-bar-chart-grouped-line',
      title: 'Rapor Al',
      description: 'Dönemsel PDF veya Excel raporu oluştur ve indir.',
      color: '#10B981',
      bg: 'rgba(16,185,129,0.08)',
      border: 'rgba(6,182,212,0.18)',
      glow: 'rgba(6,182,212,0.1)',
      badge: 'Analiz',
      onClick: onRaporGit,
    },
  ];

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'var(--bg-card-solid)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
            style={{ background: 'rgba(16,185,129,0.1)' }}
          >
            <i className="ri-flashlight-line text-xs" style={{ color: '#10B981' }} />
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Hızlı İşlemler</h3>
            <p className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>Sık kullanılan yönetim modülleri</p>
          </div>
        </div>
      </div>

      {/* Module Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-0">
        {modules.map((mod, i) => (
          <button
            key={mod.id}
            onClick={mod.onClick}
            className="group relative flex flex-col items-start p-5 text-left cursor-pointer transition-all duration-200 overflow-hidden"
            style={{
              borderRight: i < modules.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              background: 'transparent',
              border: 'none',
              borderRight: i % 2 === 0 ? '1px solid var(--border-subtle)' : 'none',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = mod.bg;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            {/* Glow bg on hover */}
            <div
              className="absolute inset-0 opacity-0 transition-opacity duration-200 pointer-events-none"
              style={{
                background: `radial-gradient(ellipse at 20% 30%, ${mod.glow} 0%, transparent 70%)`,
              }}
            />

            {/* Top row: icon + badge */}
            <div className="flex items-start justify-between w-full mb-4 relative z-10">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200"
                style={{
                  background: mod.bg,
                  border: `1.5px solid ${mod.border}`,
                }}
              >
                <i className={`${mod.icon} text-base`} style={{ color: mod.color }} />
              </div>
              <span
                className="text-[9.5px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                style={{
                  background: mod.bg,
                  color: mod.color,
                  border: `1px solid ${mod.border}`,
                }}
              >
                {mod.badge}
              </span>
            </div>

            {/* Title + Description */}
            <div className="relative z-10 w-full">
              <p
                className="text-[13px] font-bold mb-1.5"
                style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
              >
                {mod.title}
              </p>
              <p
                className="text-[11px] leading-relaxed"
                style={{ color: 'var(--text-muted)' }}
              >
                {mod.description}
              </p>
            </div>

            {/* Arrow CTA */}
            <div
              className="flex items-center gap-1.5 mt-4 relative z-10 transition-all duration-200"
              style={{ color: mod.color }}
            >
              <span className="text-[11px] font-semibold">
                {mod.id === 'firma' || mod.id === 'uzman' ? 'Ekle' : 'Git'}
              </span>
              <i className="ri-arrow-right-line text-xs transition-transform duration-200 group-hover:translate-x-0.5" />
            </div>
          </button>
        ))}
      </div>

      {/* Bottom row: grid lines for 2x2 on mobile */}
      <style>{`
        @media (max-width: 1024px) {
          .osgb-qa-grid button:nth-child(odd) { border-right: 1px solid var(--border-subtle); }
          .osgb-qa-grid button:nth-child(1),
          .osgb-qa-grid button:nth-child(2) { border-bottom: 1px solid var(--border-subtle); }
        }
        @media (min-width: 1025px) {
          .osgb-qa-grid button:not(:last-child) { border-right: 1px solid var(--border-subtle); }
        }
      `}</style>
    </div>
  );
}
