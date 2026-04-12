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
  iconBg, accentColor, delay = 0,
}: StatCardProps) {
  const animatedValue = useCountUp(value, 900, delay);

  return (
    <div
      className="relative rounded-2xl overflow-hidden cursor-default select-none stat-card-interactive"
      style={{
        background: 'var(--bg-card-solid)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '20px',
      }}
    >
      <div className="px-5 py-5">
        {/* Icon + trend row */}
        <div className="flex items-center justify-between mb-4">
          <div
            className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ background: `linear-gradient(135deg, rgba(14,165,233,0.2), rgba(14,165,233,0.08))` }}
          >
            <i className={`${icon} text-sm`} style={{ color: '#0EA5E9' }} />
          </div>

          {trend ? (
            <span
              className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
              style={{
                background: trend.dir === 'up' ? 'rgba(14,165,233,0.12)' : 'rgba(239,68,68,0.12)',
                color: trend.dir === 'up' ? '#38BDF8' : '#F87171',
                border: `1px solid ${trend.dir === 'up' ? 'rgba(14,165,233,0.22)' : 'rgba(239,68,68,0.22)'}`,
              }}
            >
              <i className={`${trend.dir === 'up' ? 'ri-arrow-up-line' : 'ri-arrow-down-line'} text-[9px]`} />
              {trend.pct}%
            </span>
          ) : (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(14,165,233,0.08)', color: '#0EA5E9', border: '1px solid rgba(14,165,233,0.15)' }}
            >
              ✓
            </span>
          )}
        </div>

        {/* Big number */}
        <p
          className="font-black leading-none tabular-nums mb-2"
          style={{
            fontSize: 'clamp(1.8rem, 4vw, 2.4rem)',
            color: 'var(--text-primary)',
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
        <div className="h-px mb-2.5" style={{ background: 'var(--border-subtle)' }} />

        {/* Sub info */}
        <div className="flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: '#0EA5E9', opacity: 0.7 }}
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
