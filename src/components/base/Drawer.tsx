import { useEffect, ReactNode } from 'react';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}

export default function Drawer({ open, onClose, title, children, footer, width = 'w-[480px]' }: DrawerProps) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ backgroundColor: 'rgba(15,23,42,0.22)' }}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full ${width} z-50 flex flex-col transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ backgroundColor: 'var(--card)', borderLeft: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
          <button
            onClick={onClose}
            className="btn-ghost w-8 h-8 p-0 rounded-lg flex items-center justify-center"
          >
            <i className="ri-close-line text-lg" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            className="flex-shrink-0 px-6 py-4 flex gap-2"
            style={{ borderTop: '1px solid var(--border-subtle)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
