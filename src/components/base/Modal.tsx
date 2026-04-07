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
  accentColor?: string;
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
};

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
  accentColor = '#6366F1',
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
        padding: '20px',
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: isDark ? 'rgba(0,0,0,0.72)' : 'rgba(15,23,42,0.45)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
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
          maxHeight: 'calc(100vh - 40px)',
          background: isDark ? '#0A0F1E' : '#FFFFFF',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.1)'}`,
          borderRadius: '22px',
          boxShadow: isDark
            ? `0 0 0 1px ${accentColor}18, 0 40px 100px rgba(0,0,0,0.85), 0 0 60px ${accentColor}08`
            : `0 0 0 1px rgba(15,23,42,0.06), 0 32px 80px rgba(15,23,42,0.18)`,
          overflow: 'hidden',
        }}
      >
        {/* Accent top bar */}
        <div style={{
          height: '3px',
          background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88)`,
          flexShrink: 0,
        }} />

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 28px 18px',
            flexShrink: 0,
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {icon && (
              <div
                style={{
                  width: 38,
                  height: 38,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '12px',
                  background: `linear-gradient(135deg, ${accentColor}28, ${accentColor}10)`,
                  border: `1px solid ${accentColor}30`,
                  flexShrink: 0,
                  boxShadow: `0 4px 12px ${accentColor}20`,
                }}
              >
                <i className={`${icon} text-base`} style={{ color: accentColor }} />
              </div>
            )}
            <div>
              <h2
                style={{
                  fontSize: '16px',
                  fontWeight: 800,
                  color: isDark ? '#F1F5F9' : '#0F172A',
                  margin: 0,
                  letterSpacing: '-0.025em',
                  lineHeight: 1.2,
                }}
              >
                {title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '10px',
              cursor: 'pointer',
              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.09)'}`,
              color: '#64748B',
              flexShrink: 0,
              transition: 'all 0.18s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#EF4444';
              e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.22)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = '#64748B';
              e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)';
              e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.09)';
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
            padding: '24px 28px',
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
              gap: '10px',
              padding: '18px 28px',
              flexShrink: 0,
              flexWrap: 'wrap',
              borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)'}`,
              background: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(15,23,42,0.015)',
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
