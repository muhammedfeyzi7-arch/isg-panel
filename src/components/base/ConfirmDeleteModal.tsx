import { useEffect, useRef } from 'react';

interface ConfirmDeleteModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  loading?: boolean;
  isDark?: boolean;
}

/**
 * Evrensel silme onay modalı.
 * Tüm panellerde aynı UX standardını sağlar.
 */
export default function ConfirmDeleteModal({
  open,
  onClose,
  onConfirm,
  title = 'Silmek istediğinize emin misiniz?',
  description = 'Bu işlem geri alınabilir — kayıt çöp kutusuna taşınır.',
  loading = false,
  isDark = false,
}: ConfirmDeleteModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => confirmRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const bg = isDark ? '#1e293b' : '#ffffff';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.1)';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          background: bg,
          border: `1px solid ${border}`,
          animation: 'confirmModalIn 0.18s ease forwards',
        }}
        onClick={e => e.stopPropagation()}
      >
        <style>{`
          @keyframes confirmModalIn {
            from { opacity: 0; transform: scale(0.94) translateY(8px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>

        {/* Header kırmızı çizgi */}
        <div className="h-1" style={{ background: 'linear-gradient(90deg, #EF4444, #DC2626)' }} />

        <div className="p-6">
          {/* İkon */}
          <div
            className="w-12 h-12 flex items-center justify-center rounded-2xl mb-4"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1.5px solid rgba(239,68,68,0.2)' }}
          >
            <i className="ri-delete-bin-2-line text-xl" style={{ color: '#EF4444' }} />
          </div>

          {/* Başlık */}
          <h3
            className="text-sm font-bold mb-1.5 leading-snug"
            style={{ color: textPrimary }}
          >
            {title}
          </h3>

          {/* Açıklama */}
          <p className="text-xs leading-relaxed mb-6" style={{ color: textMuted }}>
            {description}
          </p>

          {/* Butonlar */}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={loading}
              className="whitespace-nowrap flex-1 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all"
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)',
                border: `1px solid ${border}`,
                color: textMuted,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)'; }}
            >
              İptal
            </button>
            <button
              ref={confirmRef}
              onClick={onConfirm}
              disabled={loading}
              className="whitespace-nowrap flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all text-white"
              style={{
                background: loading ? '#9ca3af' : 'linear-gradient(135deg, #EF4444, #DC2626)',
                opacity: loading ? 0.8 : 1,
              }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.opacity = '0.9'; }}
              onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLElement).style.opacity = '1'; }}
            >
              {loading ? (
                <><i className="ri-loader-4-line animate-spin" />Siliniyor...</>
              ) : (
                <><i className="ri-delete-bin-line" />Evet, Sil</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
