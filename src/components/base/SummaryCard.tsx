interface SummaryCardProps {
  label: string;
  value: string | number;
  icon: string;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
  iconColor?: string;
}

export default function SummaryCard({ label, value, icon, sub, trend, iconColor }: SummaryCardProps) {
  const trendColor =
    trend === 'up' ? 'var(--success-text)' :
    trend === 'down' ? 'var(--danger-text)' :
    'var(--text-muted)';

  const trendIcon =
    trend === 'up' ? 'ri-arrow-up-line' :
    trend === 'down' ? 'ri-arrow-down-line' :
    null;

  return (
    <div className="stat-card">
      <div className="stat-icon">
        <i className={`${icon} text-base`} style={{ color: iconColor ?? 'var(--text-secondary)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-xs font-medium uppercase"
          style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}
        >
          {label}
        </p>
        <p className="text-2xl font-semibold mt-1 leading-none" style={{ color: 'var(--text-primary)' }}>
          {value}
        </p>
        {sub && (
          <div className="flex items-center gap-1 mt-1.5">
            {trendIcon && (
              <div className="w-3 h-3 flex items-center justify-center">
                <i className={`${trendIcon} text-xs`} style={{ color: trendColor }} />
              </div>
            )}
            <p className="text-xs" style={{ color: trendColor }}>{sub}</p>
          </div>
        )}
      </div>
    </div>
  );
}
