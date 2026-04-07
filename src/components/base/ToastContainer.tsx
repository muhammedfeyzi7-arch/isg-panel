import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../store/AppContext';

const iconMap = {
  success: 'ri-checkbox-circle-fill',
  error: 'ri-error-warning-fill',
  warning: 'ri-alert-fill',
  info: 'ri-information-fill',
};

function getStyleMap(isDark: boolean) {
  return {
    success: {
      border: `1px solid ${isDark ? 'rgba(16,185,129,0.35)' : 'rgba(16,185,129,0.4)'}`,
      background: isDark ? '#0D1F18' : '#F0FDF4',
      iconColor: isDark ? '#34D399' : '#16A34A',
      textColor: isDark ? '#F1F5F9' : '#14532D',
    },
    error: {
      border: `1px solid ${isDark ? 'rgba(239,68,68,0.35)' : 'rgba(239,68,68,0.4)'}`,
      background: isDark ? '#1C0E0E' : '#FEF2F2',
      iconColor: isDark ? '#F87171' : '#DC2626',
      textColor: isDark ? '#F1F5F9' : '#7F1D1D',
    },
    warning: {
      border: `1px solid ${isDark ? 'rgba(245,158,11,0.35)' : 'rgba(245,158,11,0.4)'}`,
      background: isDark ? '#1C1708' : '#FFFBEB',
      iconColor: isDark ? '#FBBF24' : '#D97706',
      textColor: isDark ? '#F1F5F9' : '#78350F',
    },
    info: {
      border: `1px solid ${isDark ? 'rgba(99,102,241,0.35)' : 'rgba(99,102,241,0.4)'}`,
      background: isDark ? '#0C0F1C' : '#EEF2FF',
      iconColor: isDark ? '#818CF8' : '#4F46E5',
      textColor: isDark ? '#F1F5F9' : '#1E1B4B',
    },
  };
}

interface ToastItemProps {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  isDark: boolean;
  onRemove: (id: string) => void;
}

function ToastItem({ id, message, type, isDark, onRemove }: ToastItemProps) {
  const [exiting, setExiting] = useState(false);
  const [progress, setProgress] = useState(100);
  const styleMap = getStyleMap(isDark);
  const s = styleMap[type];
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const DURATION = 3200;

  useEffect(() => {
    // Progress bar countdown
    const startTime = Date.now();
    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / DURATION) * 100);
      setProgress(remaining);
    }, 30);

    // Auto dismiss
    timerRef.current = setTimeout(() => {
      handleDismiss();
    }, DURATION);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDismiss = () => {
    if (exiting) return;
    setExiting(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressRef.current) clearInterval(progressRef.current);
    setTimeout(() => onRemove(id), 280);
  };

  const progressColor = {
    success: '#34D399',
    error: '#F87171',
    warning: '#FBBF24',
    info: '#818CF8',
  }[type];

  return (
    <div
      className={exiting ? 'animate-slide-out' : 'animate-slide-in'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        minWidth: '300px',
        maxWidth: '400px',
        background: s.background,
        border: s.border,
        borderRadius: '14px',
        boxShadow: isDark
          ? '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)'
          : '0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
        overflow: 'hidden',
        willChange: 'transform, opacity',
      }}
    >
      {/* Main content */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 14px',
        }}
      >
        <div
          style={{
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '10px',
            flexShrink: 0,
            background: `${s.iconColor}20`,
            border: `1px solid ${s.iconColor}40`,
          }}
        >
          <i className={`${iconMap[type]} text-sm`} style={{ color: s.iconColor }} />
        </div>
        <p
          style={{
            fontSize: '13.5px',
            fontWeight: 600,
            flex: 1,
            lineHeight: '1.45',
            color: s.textColor,
            margin: 0,
          }}
        >
          {message}
        </p>
        <button
          onClick={handleDismiss}
          style={{
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            cursor: 'pointer',
            flexShrink: 0,
            color: isDark ? '#94A3B8' : '#64748B',
            background: 'transparent',
            border: 'none',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = isDark ? '#F1F5F9' : '#0F172A';
            e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = isDark ? '#94A3B8' : '#64748B';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <i className="ri-close-line text-sm" />
        </button>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: '2px',
          background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: progressColor,
            transition: 'width 0.03s linear',
            borderRadius: '0 0 0 0',
            opacity: 0.7,
          }}
        />
      </div>
    </div>
  );
}

export default function ToastContainer() {
  const { toasts, removeToast, theme } = useApp();
  const isDark = theme === 'dark';

  const content = (
    <div
      style={{
        position: 'fixed',
        top: '16px',
        right: '16px',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        pointerEvents: 'none',
        alignItems: 'flex-end',
      }}
    >
      {toasts.map(toast => (
        <div key={toast.id} style={{ pointerEvents: 'auto' }}>
          <ToastItem
            id={toast.id}
            message={toast.message}
            type={toast.type}
            isDark={isDark}
            onRemove={removeToast}
          />
        </div>
      ))}
    </div>
  );

  return createPortal(content, document.body);
}
