import { useCallback, useRef } from 'react';
import { useApp } from '@/store/AppContext';

/**
 * useOrgFilters — firma bazlı filtre hafızası
 *
 * Her organizasyon ID'si için filtre state'ini in-memory map'te saklar.
 * Firma switch olunca eski filtreler geri yüklenir.
 *
 * Kullanım:
 *   const { getFilter, setFilter } = useOrgFilters<MyFilters>('personeller');
 *
 *   // Filtreyi oku (aktif org için)
 *   const saved = getFilter();
 *   const [filtre, setFiltre] = useState(saved ?? { durum: 'aktif' });
 *
 *   // Filtreyi kaydet
 *   useEffect(() => { setFilter(filtre); }, [filtre]);
 */

// Global map — tüm hook instance'ları paylaşır
// namespace → orgId → filterValue
const globalFilterMap = new Map<string, Map<string, unknown>>();

export function useOrgFilters<T>(namespace: string) {
  const { org } = useApp();
  const orgId = org?.id ?? '__none__';

  // Namespace için map al veya oluştur
  const getNamespaceMap = useCallback((): Map<string, unknown> => {
    if (!globalFilterMap.has(namespace)) {
      globalFilterMap.set(namespace, new Map<string, unknown>());
    }
    return globalFilterMap.get(namespace)!;
  }, [namespace]);

  /**
   * Aktif org için kayıtlı filtreyi döner.
   * Hiç kayıt yoksa undefined.
   */
  const getFilter = useCallback((): T | undefined => {
    return getNamespaceMap().get(orgId) as T | undefined;
  }, [orgId, getNamespaceMap]);

  /**
   * Aktif org için filtreyi kaydet.
   */
  const setFilter = useCallback((value: T) => {
    getNamespaceMap().set(orgId, value);
  }, [orgId, getNamespaceMap]);

  /**
   * Tüm org'ların filtrelerini temizle (logout vs.)
   */
  const clearAll = useCallback(() => {
    getNamespaceMap().clear();
  }, [getNamespaceMap]);

  return { getFilter, setFilter, clearAll };
}

/**
 * useOrgSelectionReset — org değişince seçili item'ı sıfırla
 *
 * Kullanım:
 *   const [selectedId, setSelectedId] = useState<string | null>(null);
 *   useOrgSelectionReset(() => setSelectedId(null));
 */
export function useOrgSelectionReset(resetFn: () => void) {
  const { org } = useApp();
  const prevOrgId = useRef<string | null>(null);

  if (org?.id && org.id !== prevOrgId.current) {
    prevOrgId.current = org.id;
    // Sync reset — render sırasında çalışmaz, sadece değişim anında
    if (prevOrgId.current !== null) {
      // İlk mount değil, gerçek değişim
      setTimeout(resetFn, 0);
    }
  }
}
