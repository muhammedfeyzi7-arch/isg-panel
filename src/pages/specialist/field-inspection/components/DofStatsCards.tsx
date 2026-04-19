interface Stats {
  total: number;
  open: number;
  closed: number;
  critical: number;
}

interface Props {
  stats: Stats;
}

export default function DofStatsCards({ stats }: Props) {
  const cards = [
    {
      label: 'Toplam Kayıt',
      value: stats.total,
      icon: 'ri-file-list-3-line',
      color: 'var(--info)',
      bg: 'var(--info-bg)',
      textColor: 'var(--info-text)',
    },
    {
      label: 'Açık Uygunsuzluk',
      value: stats.open,
      icon: 'ri-error-warning-line',
      color: 'var(--warning)',
      bg: 'var(--warning-bg)',
      textColor: 'var(--warning-text)',
    },
    {
      label: 'Kapandı',
      value: stats.closed,
      icon: 'ri-checkbox-circle-line',
      color: 'var(--success)',
      bg: 'var(--success-bg)',
      textColor: 'var(--success-text)',
    },
    {
      label: 'Kritik Açık',
      value: stats.critical,
      icon: 'ri-alarm-warning-line',
      color: 'var(--danger)',
      bg: 'var(--danger-bg)',
      textColor: 'var(--danger-text)',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-xl p-5 flex items-center gap-4"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div
            className="w-11 h-11 flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ backgroundColor: c.bg }}
          >
            <i className={`${c.icon} text-xl`} style={{ color: c.color }} />
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{c.value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{c.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
