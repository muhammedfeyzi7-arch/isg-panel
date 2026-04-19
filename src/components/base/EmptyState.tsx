import { ReactNode } from 'react';
import Button from './Button';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  action?: ReactNode;
}

export default function EmptyState({
  icon = 'ri-inbox-line',
  title,
  description,
  actionLabel,
  onAction,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div
        className="w-14 h-14 flex items-center justify-center rounded-2xl mb-5"
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
        }}
      >
        <i className={`${icon} text-2xl`} style={{ color: 'var(--text-muted)' }}></i>
      </div>
      <p className="text-sm font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>
        {title}
      </p>
      {description && (
        <p className="text-sm max-w-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {description}
        </p>
      )}
      {(actionLabel || action) && (
        <div className="mt-6">
          {action ?? (
            <Button variant="primary" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
