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
    iconBg: 'rgba(99,102,241,0.08)',
    iconBorder: 'rgba(99,102,241,0.15)',
    iconColor: 'rgba(129,140,248,0.7)',
  },
  success: {
    iconBg: 'rgba(16,185,129,0.08)',
    iconBorder: 'rgba(16,185,129,0.15)',
    iconColor: '#34D399',
  },
  search: {
    iconBg: 'rgba(245,158,11,0.08)',
    iconBorder: 'rgba(245,158,11,0.15)',
    iconColor: 'rgba(251,191,36,0.7)',
  },
};

const SIZE_STYLES = {
  sm: { padding: 'py-8 px-6', iconSize: 'w-12 h-12', iconText: 'text-2xl', titleText: 'text-sm', descText: 'text-xs' },
  md: { padding: 'py-12 px-8', iconSize: 'w-14 h-14', iconText: 'text-3xl', titleText: 'text-[14px]', descText: 'text-[12.5px]' },
  lg: { padding: 'py-16 px-10', iconSize: 'w-16 h-16', iconText: 'text-3xl', titleText: 'text-base', descText: 'text-sm' },
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
        style={{ background: vs.iconBg, border: `1px solid ${vs.iconBorder}` }}
      >
        <i className={`${icon} ${ss.iconText}`} style={{ color: vs.iconColor }} />
      </div>

      <p className={`${ss.titleText} font-bold mb-1.5`} style={{ color: 'var(--text-secondary)' }}>
        {title}
      </p>
      <p className={`${ss.descText} leading-relaxed max-w-xs`} style={{ color: 'var(--text-muted)' }}>
        {description}
      </p>

      {variant === 'success' && (
        <div className="flex items-center gap-1.5 mt-3">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10B981' }} />
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
