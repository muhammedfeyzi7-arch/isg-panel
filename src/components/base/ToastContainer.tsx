import { useApp } from '../../store/AppContext';

const iconMap = {
  success: 'ri-checkbox-circle-fill',
  error: 'ri-error-warning-fill',
  warning: 'ri-alert-fill',
  info: 'ri-information-fill',
};

const styleMap = {
  success: {
    border: '1px solid rgba(16,185,129,0.35)',
    background: '#0D1F18',
    iconColor: '#34D399',
    dot: 'linear-gradient(135deg, #10B981, #059669)',
  },
  error: {
    border: '1px solid rgba(239,68,68,0.35)',
    background: '#1C0E0E',
    iconColor: '#F87171',
    dot: 'linear-gradient(135deg, #EF4444, #DC2626)',
  },
  warning: {
    border: '1px solid rgba(245,158,11,0.35)',
    background: '#1C1708',
    iconColor: '#FBBF24',
    dot: 'linear-gradient(135deg, #F59E0B, #D97706)',
  },
  info: {
    border: '1px solid rgba(99,102,241,0.35)',
    background: '#0C0F1C',
    iconColor: '#818CF8',
    dot: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
  },
};

export default function ToastContainer() {
  const { toasts, removeToast } = useApp();

  return (
    <div className="fixed top-5 right-5 z-[100000] flex flex-col gap-2.5 pointer-events-none">
      {toasts.map(toast => {
        const s = styleMap[toast.type];
        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-center gap-3 px-4 py-3.5 min-w-[320px] max-w-sm animate-slide-in"
            style={{
              background: s.background,
              border: s.border,
              borderRadius: '14px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)',
            }}
          >
            <div
              className="w-7 h-7 flex items-center justify-center rounded-xl flex-shrink-0"
              style={{ background: `${s.iconColor}20`, border: `1px solid ${s.iconColor}40` }}
            >
              <i className={`${iconMap[toast.type]} text-sm`} style={{ color: s.iconColor }} />
            </div>
            <p className="text-sm font-semibold flex-1 leading-tight" style={{ color: '#F1F5F9' }}>{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="w-6 h-6 flex items-center justify-center rounded-lg cursor-pointer transition-colors flex-shrink-0"
              style={{ color: '#94A3B8' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#F1F5F9'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.background = 'transparent'; }}
            >
              <i className="ri-close-line text-sm" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
