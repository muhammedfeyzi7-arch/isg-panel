import { useCountUp } from '@/hooks/useCountUp';

interface StatCardProps {
  label: string;
  value: number;
  icon: string;
  sub: string;
  trend?: { pct: number; dir: 'up' | 'down' } | null;
  trendLabel?: string | null;
  gradient?: string;
  border?: string;
  iconBg?: string;
  valueColor?: string;
  accentColor?: string;
  delay?: number;
  variant?: 'default' | 'danger' | 'warning' | 'success';
}

const VARIANT_MAP = {
  default: {
    accent: '#0EA5E9',
    accentLight: 'rgba(14,165,233,0.12)',
    accentBorder: 'rgba(14,165,233,0.22)',
    iconGrad: 'linear-gradient(135deg, rgba(14,165,233,0.22), rgba(14,165,233,0.07))',
    barGrad: 'linear-gradient(90deg, #0EA5E9, #38BDF8)',
    shimmer: 'rgba(14,165,233,0.06)',
  },
  danger: {
    accent: '#EF4444',
    accentLight: 'rgba(239,68,68,0.12)',
    accentBorder: 'rgba(239,68,68,0.22)',
    iconGrad: 'linear-gradient(135deg, rgba(239,68,68,0.22), rgba(239,68,68,0.07))',
    barGrad: 'linear-gradient(90deg, #EF4444, #F87171)',
    shimmer: 'rgba(239,68,68,0.05)',
  },
  warning: {
    accent: '#F59E0B',
    accentLight: 'rgba(245,158,11,0.12)',
    accentBorder: 'rgba(245,158,11,0.22)',
    iconGrad: 'linear-gradient(135deg, rgba(245,158,11,0.22), rgba(245,158,11,0.07))',
    barGrad: 'linear-gradient(90deg, #F59E0B, #FCD34D)',
    shimmer: 'rgba(245,158,11,0.05)',
  },
  success: {
    accent: '#10B981',
    accentLight: 'rgba(16,185,129,0.12)',
    accentBorder: 'rgba(16,185,129,0.22)',
    iconGrad: 'linear-gradient(135deg, rgba(16,185,129,0.22), rgba(16,185,129,0.07))',
    barGrad: 'linear-gradient(90deg, #10B981, #34D399)',
    shimmer: 'rgba(16,185,129,0.05)',
  },
};

export default function StatCard({
  label,
  value,
  icon,
  sub,
  trend,
  trendLabel,
  accentColor,
  delay = 0,
  variant = 'default',
}: StatCardProps) {
  const animatedValue = useCountUp(value, 900, delay);
  const v = VARIANT_MAP[variant];

  // accentColor override
  const accent = accentColor ?? v.accent;
  const accentLight = `${accent}1E`;
  const accentBorder = `${accent}38`;

  return (
    <div
      className="relative rounded-2xl overflow-hidden cursor-default select-none group transition-all duration-300"
      style={{
        background: 'var(--bg-card-solid)',
        border: '1px solid var(--border-subtle)',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
        (e.currentTarget as HTMLElement).style.boxShadow = `0 16px 40px ${accentLight}, 0 4px 16px rgba(0,0,0,0.06)`;
        (e.currentTarget as HTMLElement).style.borderColor = accentBorder;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
      }}
    >
      {/* Accent top bar */}
      <div
        className="h-[3px] w-full"
        style={{ background: v.barGrad }}
      />

      {/* Shimmer background blob */}
      <div
        className="absolute top-0 right-0 w-28 h-28 rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle, ${accentLight} 0%, transparent 70%)`,
          transform: 'translate(30%, -30%)',
        }}
      />

      <div className="px-5 py-5 relative">
        {/* Top row: icon + badge */}
        <div className="flex items-start justify-between mb-5">
          <div
            className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
            style={{ background: v.iconGrad, border: `1px solid ${accentBorder}` }}
          >
            <i className={`${icon} text-base`} style={{ color: accent }} />
          </div>

          {trend ? (
            <div
              className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
              style={{
                background: trend.dir === 'up' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                color: trend.dir === 'up' ? '#10B981' : '#EF4444',
                border: `1px solid ${trend.dir === 'up' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
              }}
            >
              <i className={`${trend.dir === 'up' ? 'ri-arrow-up-line' : 'ri-arrow-down-line'} text-[9px]`} />
              {trend.pct}%
            </div>
          ) : (
            <div
              className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
              style={{
                background: accentLight,
                color: accent,
                border: `1px solid ${accentBorder}`,
              }}
            >
              <i className="ri-check-line text-[9px]" />
              Güncel
            </div>
          )}
        </div>

        {/* Big number */}
        <div className="mb-1">
          <p
            className="font-black leading-none tabular-nums"
            style={{
              fontSize: 'clamp(2rem, 4vw, 2.6rem)',
              color: 'var(--text-primary)',
              letterSpacing: '-0.06em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {animatedValue}
          </p>
        </div>

        {/* Label */}
        <p
          className="text-sm font-bold mb-3 leading-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          {label}
        </p>

        {/* Divider */}
        <div className="h-px mb-3" style={{ background: 'var(--border-subtle)' }} />

        {/* Sub text */}
        <div className="flex items-center gap-2">
          <div
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: accent }}
          />
          <p className="text-[11px] leading-snug flex-1" style={{ color: 'var(--text-muted)' }}>
            {sub}
          </p>
        </div>

        {/* Trend label */}
        {trendLabel && (
          <div
            className="flex items-center gap-1.5 mt-2.5 pt-2.5"
            style={{ borderTop: '1px solid var(--border-subtle)' }}
          >
            <i className="ri-time-line text-[9px]" style={{ color: 'var(--text-faint)' }} />
            <p className="text-[9.5px]" style={{ color: 'var(--text-faint)' }}>
              {trendLabel}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
