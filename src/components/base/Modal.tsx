import { type ReactNode, useEffect, useState } from 'react';
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
  const [mounted, setMounted] = useState(false);
  const [exiting, setExiting] = useState(false);
  let theme: 'dark' | 'light' = 'dark';
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const app = useApp();
    theme = app.theme;
  } catch { /* outside context */ }

  useEffect(() => {
    if (visible) {
      setExiting(false);
      setMounted(true);
    } else if (mounted) {
      setExiting(true);
      const t = setTimeout(() => {
        setMounted(false);
        setExiting(false);
      }, 220);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!visible) return;
    openModalCount++;
    document.body.style.overflow = 'hidden';

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        handleClose();
      }
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
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    setExiting(true);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  if (!mounted) return null;

  const isDark = theme === 'dark';

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '0',
        animation: exiting ? 'modal-backdrop-out 0.22s ease forwards' : 'modal-backdrop-in 0.2s ease both',
      }}
      className="sm:items-center sm:p-4"
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
        onClick={handleClose}
      />

      {/* Modal panel */}
      <div
        className={`w-full ${sizeClasses[size]} modal-panel rounded-t-[20px] sm:rounded-[16px]`}
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100dvh - 16px)',
          background: isDark ? '#0A0F1E' : '#FFFFFF',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.1)'}`,
          boxShadow: isDark
            ? `0 0 0 1px ${accentColor}18, 0 24px 80px rgba(0,0,0,0.7), 0 0 60px ${accentColor}08`
            : `0 0 0 1px rgba(15,23,42,0.06), 0 20px 60px rgba(15,23,42,0.18)`,
          overflow: 'hidden',
          animation: exiting
            ? 'modal-panel-out 0.2s cubic-bezier(0.55,0,1,0.45) forwards'
            : 'modal-panel-in 0.26s cubic-bezier(0.34,1.2,0.64,1) both',
          willChange: 'transform, opacity',
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
            padding: '16px 24px 14px',
            flexShrink: 0,
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {icon && (
              <div
                style={{
                  width: 40,
                  height: 40,
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
                <i className={`${icon} text-lg`} style={{ color: accentColor }} />
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
          {/* Kapatma butonu — mobilde büyük touch alanı */}
          <button
            onClick={handleClose}
            style={{
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '12px',
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
            <i className="ri-close-line" style={{ fontSize: '18px' }} />
          </button>
        </div>

        {/* Scrollable content */}
        <div
          style={{
            flex: '1 1 auto',
            overflowY: 'auto',
            padding: '24px',
            minHeight: 0,
            color: isDark ? '#E2E8F0' : '#0F172A',
          }}
        >
          {children}
        </div>

        {/* Footer — mobilde full width butonlar */}
        {footer && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              padding: '16px 24px',
              flexShrink: 0,
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
