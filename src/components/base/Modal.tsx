import { type ReactNode, useEffect } from 'react';
import { useApp } from '../../store/AppContext';

interface ModalProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: ReactNode;
  icon?: string;
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
};

export default function Modal({ open, isOpen, onClose, title, children, size = 'md', footer, icon }: ModalProps) {
  const visible = open ?? isOpen ?? false;
  let theme: 'dark' | 'light' = 'dark';
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const app = useApp();
    theme = app.theme;
  } catch { /* outside context */ }

  // ESC tuşu ile kapat
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [visible, onClose]);

  if (!visible) return null;

  const isDark = theme === 'dark';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      />
      {/* Modal */}
      <div
        className={`relative w-full ${sizeClasses[size]} max-h-[90vh] flex flex-col animate-slide-up`}
        style={{
          background: isDark ? 'rgba(11,16,27,0.98)' : 'rgba(255,255,255,0.99)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.12)'}`,
          borderRadius: '20px',
          boxShadow: isDark
            ? '0 40px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)'
            : '0 40px 100px rgba(0,0,0,0.15), 0 0 0 1px rgba(15,23,42,0.06)',
          backdropFilter: 'blur(20px)',
          transition: 'background 0.3s ease',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.09)'}` }}
        >
          <div className="flex items-center gap-3">
            {icon && (
              <div
                className="w-8 h-8 flex items-center justify-center rounded-xl"
                style={{
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(99,102,241,0.1))',
                  border: '1px solid rgba(99,102,241,0.2)',
                }}
              >
                <i className={`${icon} text-sm`} style={{ color: '#60A5FA' }} />
              </div>
            )}
            <h2 className="text-base font-bold" style={{ color: isDark ? '#E2E8F0' : '#0F172A' }}>{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer transition-all duration-200 hover:scale-105"
            style={{
              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.1)'}`,
              color: isDark ? '#64748B' : '#64748B',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = isDark ? '#E2E8F0' : '#0F172A';
              e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = '#64748B';
              e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)';
            }}
          >
            <i className="ri-close-line text-base" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5" style={{ color: isDark ? '#E2E8F0' : '#0F172A' }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            className="px-6 py-4 flex items-center justify-end gap-3 flex-shrink-0"
            style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.09)'}` }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
