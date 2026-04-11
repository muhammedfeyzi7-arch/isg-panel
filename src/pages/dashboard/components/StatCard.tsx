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
  accentColor: string;
  delay?: number;
}

export default function StatCard({
  label, value, icon, sub, trend, trendLabel,
  iconBg, valueColor, accentColor, delay = 0,
}: StatCardProps) {
  const animatedValue = useCountUp(value, 900, delay);

  return (
    <div
      className="relative rounded-2xl overflow-hidden transition-all duration-250 cursor-default select-none isg-card"
      style={{ borderRadius: '18px' }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(-3px)';
        el.style.borderColor = accentColor + '45';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(0)';
        el.style.borderColor = '';
      }}
    >
      {/* Top accent line — hekim stili */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}55)` }}
      />

      <div className="px-5 py-5">
        {/* Icon + trend row */}
        <div className="flex items-center justify-between mb-4">
          <div
            className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0"
            style={{
              background: iconBg,
            }}
          >
            <i className={`${icon} text-white text-base`} />
          </div>

          {trend ? (
            <span
              className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
              style={{
                background: trend.dir === 'up' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                color: trend.dir === 'up' ? '#34D399' : '#F87171',
                border: `1px solid ${trend.dir === 'up' ? 'rgba(16,185,129,0.22)' : 'rgba(239,68,68,0.22)'}`,
              }}
            >
              <i className={`${trend.dir === 'up' ? 'ri-arrow-up-line' : 'ri-arrow-down-line'} text-[9px]`} />
              {trend.pct}%
            </span>
          ) : (
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: accentColor, opacity: 0.4 }}
            />
          )}
        </div>

        {/* Big number */}
        <p
          className="font-black leading-none tabular-nums mb-2"
          style={{
            fontSize: 'clamp(1.8rem, 4vw, 2.4rem)',
            background: valueColor,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.05em',
          }}
        >
          {animatedValue}
        </p>

        {/* Label */}
        <p
          className="font-bold mb-2 leading-tight text-sm"
          style={{ color: 'var(--text-primary)' }}
        >
          {label}
        </p>

        {/* Thin divider */}
        <div className="h-px mb-2.5" style={{ background: `${accentColor}18` }} />

        {/* Sub info */}
        <div className="flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: accentColor, opacity: 0.6 }}
          />
          <p
            className="text-[11px] leading-snug"
            style={{ color: 'var(--text-muted)' }}
          >
            {sub}
          </p>
        </div>

        {trendLabel && (
          <p
            className="mt-2 flex items-center gap-1 pt-2"
            style={{
              fontSize: '9.5px',
              color: 'var(--text-faint)',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <i className="ri-time-line text-[9px]" />
            {trendLabel}
          </p>
        )}
      </div>
    </div>
  );
}
