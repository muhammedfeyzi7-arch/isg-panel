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
      className="relative rounded-2xl overflow-hidden transition-all duration-250 cursor-default select-none"
      style={{
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        borderRadius: '18px',
        WebkitTapHighlightColor: 'transparent',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(-4px)';
        el.style.borderColor = accentColor + '60';
        el.style.boxShadow = `0 16px 40px ${accentColor}20, 0 4px 12px rgba(0,0,0,0.08)`;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(0)';
        el.style.borderColor = cardBorder;
        el.style.boxShadow = 'none';
      }}
      onTouchStart={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'scale(0.97)';
        (e.currentTarget as HTMLDivElement).style.opacity = '0.88';
      }}
      onTouchEnd={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
        (e.currentTarget as HTMLDivElement).style.opacity = '1';
      }}
    >
      {/* Top accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}55)` }}
      />

      <div className="px-5 pt-6 pb-5">
        {/* Icon row */}
        <div className="flex items-center justify-between mb-4">
          <div
            className="w-11 h-11 flex items-center justify-center rounded-xl flex-shrink-0"
            style={{
              background: iconBg,
              boxShadow: `0 6px 16px ${accentColor}30`,
            }}
          >
            <i className={`${icon} text-white text-[17px]`} />
          </div>

          {trend ? (
            <span
              className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
              style={{
                background: trend.dir === 'up' ? 'rgba(16,185,129,0.13)' : 'rgba(239,68,68,0.13)',
                color: trend.dir === 'up' ? '#34D399' : '#F87171',
                border: `1px solid ${trend.dir === 'up' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
              }}
            >
              <i className={`${trend.dir === 'up' ? 'ri-arrow-up-line' : 'ri-arrow-down-line'} text-[9px]`} />
              {trend.pct}%
            </span>
          ) : (
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: accentColor, opacity: 0.45 }}
            />
          )}
        </div>

        {/* Big number */}
        <p
          className="font-black leading-none tabular-nums mb-2"
          style={{
            fontSize: 'clamp(2rem, 5vw, 2.6rem)',
            background: valueColor,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.06em',
          }}
        >
          {animatedValue}
        </p>

        {/* Label */}
        <p
          className="font-bold mb-2 leading-tight"
          style={{
            fontSize: 'clamp(12px, 2vw, 13px)',
            color: 'var(--text-primary)',
          }}
        >
          {label}
        </p>

        {/* Divider */}
        <div className="h-px mb-3" style={{ background: `${accentColor}18` }} />

        {/* Sub info */}
        <div className="flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: accentColor, opacity: 0.7 }}
          />
          <p
            className="leading-snug"
            style={{
              fontSize: 'clamp(10px, 1.8vw, 11px)',
              color: 'var(--text-muted)',
            }}
          >
            {sub}
          </p>
        </div>

        {trendLabel && (
          <p
            className="mt-2.5 flex items-center gap-1 pt-2.5"
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
