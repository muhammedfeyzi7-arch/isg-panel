import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

// Global counter to track open modals — prevents scroll unlock when nested modals close
let openModalCount = 0;

export default function Modal({
  open,
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  footer,
  icon,
}: ModalProps) {
  const visible = open ?? isOpen ?? false;
  let theme: 'dark' | 'light' = 'dark';
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const app = useApp();
    theme = app.theme;
  } catch { /* outside context */ }

  useEffect(() => {
    if (!visible) return;
    openModalCount++;
    document.body.style.overflow = 'hidden';

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    document.addEventListener('keydown', handler, true);

    return () => {
      document.removeEventListener('keydown', handler, true);
      openModalCount--;
      // Only restore scroll when ALL modals are closed
      if (openModalCount <= 0) {
        openModalCount = 0;
        document.body.style.overflow = '';
      }
    };
  }, [visible, onClose]);

  if (!visible) return null;

  const isDark = theme === 'dark';

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 0,
        }}
        onClick={onClose}
      />

      {/* Modal panel */}
      <div
        className={`w-full ${sizeClasses[size]} animate-slide-up`}
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100vh - 32px)',
          background: isDark ? 'rgba(11,16,27,0.98)' : 'rgba(255,255,255,0.99)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.12)'}`,
          borderRadius: '20px',
          boxShadow: isDark
            ? '0 40px 100px rgba(0,0,0,0.8)'
            : '0 40px 100px rgba(0,0,0,0.15)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            flexShrink: 0,
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.09)'}`,
            borderRadius: '20px 20px 0 0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {icon && (
              <div
                style={{
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(99,102,241,0.1))',
                  border: '1px solid rgba(99,102,241,0.2)',
                  flexShrink: 0,
                }}
              >
                <i className={`${icon} text-sm`} style={{ color: '#60A5FA' }} />
              </div>
            )}
            <h2
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: isDark ? '#E2E8F0' : '#0F172A',
                margin: 0,
              }}
            >
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '10px',
              cursor: 'pointer',
              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.1)'}`,
              color: '#64748B',
              flexShrink: 0,
              transition: 'all 0.2s ease',
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
            <i className="ri-close-line" style={{ fontSize: '15px' }} />
          </button>
        </div>

        {/* Scrollable content */}
        <div
          style={{
            flex: '1 1 auto',
            overflowY: 'auto',
            padding: '20px 24px',
            minHeight: 0,
            color: isDark ? '#E2E8F0' : '#0F172A',
          }}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              padding: '16px 24px',
              flexShrink: 0,
              flexWrap: 'wrap',
              borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.09)'}`,
              borderRadius: '0 0 20px 20px',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
