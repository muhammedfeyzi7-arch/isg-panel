import { useCountUp } from '@/hooks/useCountUp';
import { useApp } from '@/store/AppContext';

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
  accentColor: string;
  delay?: number;
}

export default function StatCard({
  label, value, icon, sub, trend, trendLabel,
  gradient, border, iconBg, valueColor, accentColor, delay = 0,
}: StatCardProps) {
  const animatedValue = useCountUp(value, 900, delay);
  const { theme } = useApp();
  const isDark = theme === 'dark';

  const cardBg = isDark ? gradient : 'var(--bg-card)';
  const cardBorder = isDark ? border : 'var(--border-main)';

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-200 cursor-default group"
      style={{
        background: cardBg,
        border: `1px solid ${cardBorder}`,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
        (e.currentTarget as HTMLDivElement).style.borderColor = accentColor + '55';
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 16px 40px ${accentColor}18`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLDivElement).style.borderColor = cardBorder;
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
      }}
    >
      {/* Top accent bar */}
      <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}44)` }} />

      <div className="p-5">
        {/* Icon + Trend row */}
        <div className="flex items-start justify-between mb-5">
          <div
            className="w-11 h-11 flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ background: iconBg }}
          >
            <i className={`${icon} text-white text-[16px]`} />
          </div>

          {trend ? (
            <span
              className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full"
              style={{
                background: trend.dir === 'up' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                color: trend.dir === 'up' ? '#34D399' : '#F87171',
                border: `1px solid ${trend.dir === 'up' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
              }}
            >
              <i className={trend.dir === 'up' ? 'ri-arrow-up-line' : 'ri-arrow-down-line'} />
              {trend.pct}%
            </span>
          ) : (
            <div className="w-2 h-2 rounded-full mt-1.5" style={{ background: accentColor, opacity: 0.5 }} />
          )}
        </div>

        {/* Value */}
        <p
          className="text-[2.6rem] font-black leading-none mb-2 tabular-nums"
          style={{
            background: valueColor,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.05em',
          }}
        >
          {animatedValue}
        </p>

        {/* Label */}
        <p className="text-[13.5px] font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          {label}
        </p>

        {/* Sub */}
        <div className="flex items-center gap-1.5">
          <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: accentColor, opacity: 0.6 }} />
          <p className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>{sub}</p>
        </div>

        {trendLabel && (
          <p className="text-[10px] mt-2.5 font-medium flex items-center gap-1 pt-2.5"
            style={{ color: 'var(--text-faint)', borderTop: '1px solid var(--border-subtle)' }}>
            <i className="ri-time-line" />{trendLabel}
          </p>
        )}
      </div>
    </div>
  );
}
