import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  action?: ReactNode;
  /** Yeşil "her şey yolunda" varyantı */
  variant?: 'default' | 'success' | 'search';
  size?: 'sm' | 'md' | 'lg';
}

const VARIANT_STYLES = {
  default: {
    iconBg: 'var(--bg-item)',
    iconBorder: 'var(--border-subtle)',
    iconColor: 'var(--text-faint)',
  },
  success: {
    iconBg: 'rgba(16,185,129,0.08)',
    iconBorder: 'rgba(16,185,129,0.15)',
    iconColor: '#34D399',
  },
  search: {
    iconBg: 'rgba(245,158,11,0.07)',
    iconBorder: 'rgba(245,158,11,0.14)',
    iconColor: 'rgba(251,191,36,0.65)',
  },
};

const SIZE_STYLES = {
  sm: { padding: 'py-8 px-6', iconSize: 'w-11 h-11', iconText: 'text-xl', titleText: 'text-[13px]', descText: 'text-[11.5px]' },
  md: { padding: 'py-14 px-8', iconSize: 'w-14 h-14', iconText: 'text-2xl', titleText: 'text-[14px]', descText: 'text-[12.5px]' },
  lg: { padding: 'py-16 px-10', iconSize: 'w-16 h-16', iconText: 'text-3xl', titleText: 'text-[15px]', descText: 'text-sm' },
};

export default function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'default',
  size = 'md',
}: EmptyStateProps) {
  const vs = VARIANT_STYLES[variant];
  const ss = SIZE_STYLES[size];

  return (
    <div className={`flex flex-col items-center text-center ${ss.padding} animate-fade-in`}>
      <div
        className={`${ss.iconSize} flex items-center justify-center rounded-2xl mb-4 flex-shrink-0`}
        style={{
          background: vs.iconBg,
          border: `1px solid ${vs.iconBorder}`,
          transition: 'all 0.2s ease',
        }}
      >
        <i className={`${icon} ${ss.iconText}`} style={{ color: vs.iconColor }} />
      </div>

      <p
        className={`${ss.titleText} font-bold mb-2`}
        style={{ color: 'var(--text-secondary)', letterSpacing: '-0.01em' }}
      >
        {title}
      </p>
      <p
        className={`${ss.descText} leading-relaxed max-w-[260px]`}
        style={{ color: 'var(--text-muted)', opacity: 0.85 }}
      >
        {description}
      </p>

      {variant === 'success' && (
        <div className="flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
          <span className="w-1.5 h-1.5 rounded-full status-dot-live" style={{ background: '#10B981' }} />
          <span className="text-[11px] font-semibold" style={{ color: '#34D399' }}>Sistem sağlıklı</span>
        </div>
      )}

      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Tablo içi boş satır — daha kompakt */
export function TableEmptyState({
  icon,
  title,
  description,
  action,
}: Omit<EmptyStateProps, 'variant' | 'size'>) {
  return (
    <tr>
      <td colSpan={99}>
        <EmptyState icon={icon} title={title} description={description} action={action} size="md" />
      </td>
    </tr>
  );
}
