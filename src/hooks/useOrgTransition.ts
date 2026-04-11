import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/store/AppContext';

/**
 * useOrgTransition — firma değişince liste fade animasyonu + scroll reset
 *
 * Döndürür:
 *   - isTransitioning: true iken liste fade-out görünür
 *   - transitionKey: key prop olarak kullanılır, değişince React remount eder
 *
 * Kullanım:
 *   const { isTransitioning, transitionKey } = useOrgTransition();
 *
 *   <div
 *     key={transitionKey}
 *     style={{ opacity: isTransitioning ? 0 : 1, transition: 'opacity 0.2s ease' }}
 *   >
 *     {liste}
 *   </div>
 *
 * Veya CSS class ile:
 *   className={isTransitioning ? 'org-fade-out' : 'org-fade-in'}
 */
export function useOrgTransition(options?: {
  /** Scroll container selector. Varsayılan: window */
  scrollSelector?: string;
  /** Fade animasyon süresi ms. Varsayılan: 180 */
  duration?: number;
}) {
  const { org, isSwitching } = useApp();
  const { scrollSelector, duration = 180 } = options ?? {};

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionKey, setTransitionKey] = useState(() => org?.id ?? 'init');
  const prevOrgId = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const currentId = org?.id ?? null;

    // İlk mount — sadece ref'i kaydet
    if (prevOrgId.current === null) {
      prevOrgId.current = currentId;
      return;
    }

    // Firma değişmedi
    if (prevOrgId.current === currentId) return;

    prevOrgId.current = currentId;

    // 1. Fade-out başlat
    setIsTransitioning(true);

    // 2. Scroll reset
    try {
      if (scrollSelector) {
        const el = document.querySelector(scrollSelector);
        if (el) el.scrollTop = 0;
      } else {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    } catch { /* ignore */ }

    // 3. Animasyon bitince fade-in + key güncelle (React re-render tetikler)
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsTransitioning(false);
      setTransitionKey(currentId ?? `key_${Date.now()}`);
    }, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [org?.id, scrollSelector, duration]);

  // isSwitching sırasında da transitioning göster
  const effectiveTransitioning = isTransitioning || isSwitching;

  return {
    isTransitioning: effectiveTransitioning,
    transitionKey,
  };
}
