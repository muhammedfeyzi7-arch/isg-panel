import { useState, useEffect, useRef } from 'react';

interface RealtimeBadgeProps {
  status: 'connected' | 'connecting' | 'disconnected';
  /** Sağ alt köşede sabit konumda mı, yoksa inline mı? */
  fixed?: boolean;
  /** Sadece bağlantı sorununda göster, connected'da gizle */
  hideWhenConnected?: boolean;
}

/**
 * Tüm panellerde kullanılabilen realtime bağlantı durumu badge'i.
 * fixed=true → sağ alt köşede sabit
 * fixed=false → inline (header içinde kullanılabilir)
 */
export default function RealtimeBadge({ status, fixed = true, hideWhenConnected = false }: RealtimeBadgeProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bağlandı → 3 sn göster sonra gizle (hideWhenConnected=true ise)
  // Bağlantı koptu → 1.5sn sonra göster (flicker önlemi)
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (status === 'connected') {
      if (hideWhenConnected) {
        // Bağlantı yeniden kuruldu toast'u 3 sn görünsün sonra kaybolsun
        setVisible(true);
        timerRef.current = setTimeout(() => setVisible(false), 3000);
      } else {
        setVisible(true);
      }
    } else if (status === 'disconnected') {
      // 1.5 sn gecikme — kısa kopmalarda flicker olmaz
      timerRef.current = setTimeout(() => setVisible(true), 1500);
    } else {
      // connecting — hemen göster
      setVisible(true);
    }

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [status, hideWhenConnected]);

  if (!visible) return null;

  const cfg = {
    connected: {
      dot: '#22C55E',
      text: 'Canlı',
      color: '#16A34A',
      bg: 'rgba(34,197,94,0.1)',
      border: 'rgba(34,197,94,0.25)',
      icon: null,
      pulse: true,
    },
    connecting: {
      dot: '#F59E0B',
      text: 'Bağlanıyor...',
      color: '#D97706',
      bg: 'rgba(245,158,11,0.1)',
      border: 'rgba(245,158,11,0.25)',
      icon: 'ri-refresh-line animate-spin',
      pulse: false,
    },
    disconnected: {
      dot: '#EF4444',
      text: 'Bağlantı kesildi',
      color: '#DC2626',
      bg: 'rgba(239,68,68,0.1)',
      border: 'rgba(239,68,68,0.25)',
      icon: 'ri-wifi-off-line',
      pulse: false,
    },
  }[status];

  const badge = (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-all"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}
    >
      {cfg.icon ? (
        <i className={`${cfg.icon} text-[10px]`} style={{ color: cfg.dot }} />
      ) : (
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.pulse ? 'animate-pulse' : ''}`}
          style={{ background: cfg.dot }}
        />
      )}
      {cfg.text}
    </div>
  );

  if (!fixed) return badge;

  return (
    <div
      className="fixed bottom-4 right-4 z-[200]"
      style={{ pointerEvents: 'none' }}
    >
      {badge}
    </div>
  );
}
