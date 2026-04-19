import { useApp } from '@/store/AppContext';

export default function ToastContainer() {
  const { toasts, dismissToast } = useApp();

  if (toasts.length === 0) return null;

  const iconMap: Record<string, string> = {
    success: 'ri-checkbox-circle-fill',
    error: 'ri-error-warning-fill',
    info: 'ri-information-fill',
  };

  const colorMap: Record<string, { bg: string; icon: string; border: string }> = {
    success: { bg: 'var(--success-bg)', icon: 'var(--success)', border: 'rgba(34,197,94,0.25)' },
    error: { bg: 'var(--danger-bg)', icon: 'var(--danger)', border: 'rgba(239,68,68,0.25)' },
    info: { bg: 'var(--card)', icon: 'var(--info)', border: 'var(--border)' },
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => {
        const colors = colorMap[toast.type] || colorMap.info;
        return (
          <div
            key={toast.id}
            className="flex items-center gap-3 px-4 py-3 rounded-xl pointer-events-auto"
            style={{
              backgroundColor: colors.bg,
              border: `1px solid ${colors.border}`,
              minWidth: '280px',
              maxWidth: '380px',
              boxShadow: '0 4px 16px rgba(15,23,42,0.08)',
              animation: 'slideInRight 0.25s ease-out',
            }}
          >
            <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
              <i className={`${iconMap[toast.type]} text-base`} style={{ color: colors.icon }} />
            </div>
            <p className="text-sm flex-1" style={{ color: 'var(--text-primary)' }}>{toast.message}</p>
            <button
              onClick={() => dismissToast(toast.id)}
              className="w-5 h-5 flex items-center justify-center rounded cursor-pointer flex-shrink-0 transition-opacity opacity-50 hover:opacity-100"
            >
              <i className="ri-close-line text-sm" style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
