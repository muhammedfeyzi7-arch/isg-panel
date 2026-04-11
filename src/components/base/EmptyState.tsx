import type { ReactNode } from 'react';
import { useApp } from '@/store/AppContext';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  action?: ReactNode;
  /** Yeşil "her şey yolunda" varyantı */
  variant?: 'default' | 'success' | 'search';
  size?: 'sm' | 'md' | 'lg';
  /**
   * Gezici uzman context hint'ini gizle.
   * Varsayılan: false (gezici uzman + çoklu firma ise otomatik gösterilir)
   */
  hideOrgHint?: boolean;
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

/**
 * OrgContextHint — gezici uzman + çoklu firma durumunda
 * "Başka firmaya geç" yönlendirmesi gösterir.
 */
function OrgContextHint() {
  const { org } = useApp();

  const isGeziciMulti =
    org?.osgbRole === 'gezici_uzman' &&
    (org?.activeFirmIds?.length ?? 0) > 1;

  if (!isGeziciMulti) return null;

  return (
    <div
      className="mt-4 flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl text-left max-w-[280px]"
      style={{
        background: 'rgba(6,182,212,0.07)',
        border: '1px solid rgba(6,182,212,0.18)',
      }}
    >
      <div
        className="w-5 h-5 flex items-center justify-center rounded-lg flex-shrink-0 mt-0.5"
        style={{ background: 'rgba(6,182,212,0.12)' }}
      >
        <i className="ri-swap-line text-[10px]" style={{ color: '#06B6D4' }} />
      </div>
      <div>
        <p className="text-[11px] font-semibold leading-snug" style={{ color: '#06B6D4' }}>
          Başka bir firmaya geçmek için
        </p>
        <p className="text-[10.5px] leading-relaxed mt-0.5" style={{ color: 'rgba(6,182,212,0.65)' }}>
          üstteki <strong>firma seçiciyi</strong> kullanabilirsin.
        </p>
      </div>
    </div>
  );
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'default',
  size = 'md',
  hideOrgHint = false,
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

      {/* Gezici uzman context hint — veri yoksa firmayı değiştir yönlendirmesi */}
      {!hideOrgHint && variant !== 'success' && <OrgContextHint />}

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
