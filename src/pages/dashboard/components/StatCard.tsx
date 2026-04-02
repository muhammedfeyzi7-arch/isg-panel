import { useCountUp } from '@/hooks/useCountUp';

interface StatCardProps {
  label: string;
  value: number;
  icon: string;
  sub: string;
  trend?: { pct: number; dir: 'up' | 'down' } | null;
  trendLabel?: string | null;
  gradient: string;
  border: string;
  iconBg: string;
  valueColor: string;
  delay?: number;
}

export default function StatCard({
  label, value, icon, sub, trend, trendLabel,
  gradient, border, iconBg, valueColor, delay = 0,
}: StatCardProps) {
  const animatedValue = useCountUp(value, 900, delay);

  return (
    <div
      className="rounded-2xl p-5 transition-all duration-200 cursor-default"
      style={{
        background: gradient,
        border: `1px solid ${border}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 12px 32px rgba(0,0,0,0.25), 0 0 0 1px ${border}`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
      }}
    >
      <div className="flex items-start justify-between mb-5">
        {/* Icon */}
        <div
          className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0"
          style={{
            background: iconBg,
            boxShadow: `0 6px 20px ${border}`,
          }}
        >
          <i className={`${icon} text-white text-[15px]`} />
        </div>

        {/* Trend badge */}
        {trend && (
          <span
            className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full"
            style={{
              background: trend.dir === 'up' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              color: trend.dir === 'up' ? '#34D399' : '#F87171',
              border: `1px solid ${trend.dir === 'up' ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)'}`,
            }}
          >
            <i className={trend.dir === 'up' ? 'ri-arrow-up-line' : 'ri-arrow-down-line'} />
            {trend.pct}%
          </span>
        )}
      </div>

      {/* Value */}
      <div>
        <p
          className="text-[2.2rem] font-extrabold leading-none mb-2 tabular-nums"
          style={{
            background: valueColor,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.03em',
          }}
        >
          {animatedValue}
        </p>
        <p className="text-[13px] font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          {label}
        </p>
        <p className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>{sub}</p>
        {trendLabel && (
          <p className="text-[10px] mt-2 font-medium flex items-center gap-1" style={{ color: 'var(--text-faint, #475569)' }}>
            <i className="ri-time-line" />{trendLabel}
          </p>
        )}
      </div>
    </div>
  );
}
