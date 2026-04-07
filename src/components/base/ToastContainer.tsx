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

export default function ToastContainer() {
  const { toasts, removeToast, theme } = useApp();
  const isDark = theme === 'dark';
  const styleMap = getStyleMap(isDark);

  const content = (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        pointerEvents: 'none',
      }}
    >
      {toasts.map(toast => {
        const s = styleMap[toast.type];
        return (
          <div
            key={toast.id}
            className="animate-slide-in"
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              minWidth: '320px',
              maxWidth: '420px',
              background: s.background,
              border: s.border,
              borderRadius: '14px',
              boxShadow: isDark
                ? '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)'
                : '0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
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
              <i className={`${iconMap[toast.type]} text-sm`} style={{ color: s.iconColor }} />
            </div>
            <p
              style={{
                fontSize: '14px',
                fontWeight: 600,
                flex: 1,
                lineHeight: '1.4',
                color: s.textColor,
                margin: 0,
              }}
            >
              {toast.message}
            </p>
            <button
              onClick={() => removeToast(toast.id)}
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
        );
      })}
    </div>
  );

  return createPortal(content, document.body);
}
