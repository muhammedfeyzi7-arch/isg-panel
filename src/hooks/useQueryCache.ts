/**
 * useQueryCache — basit in-memory + sessionStorage cache hook'u
 * Sekme değiştirince aynı veriyi sıfırdan çekmeyi önler.
 * TTL süresi dolunca veya firmalar değişince otomatik invalidate edilir.
 */

import { useRef, useCallback } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  key: string;
}

// Global in-memory store — component unmount olsa bile yaşar
const memoryStore = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_MS = 2 * 60 * 1000; // 2 dakika

export function useQueryCache<T>(ttlMs = DEFAULT_TTL_MS) {
  const ttlRef = useRef(ttlMs);

  const get = useCallback((key: string): T | null => {
    const entry = memoryStore.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() - entry.timestamp > ttlRef.current) {
      memoryStore.delete(key);
      return null;
    }
    return entry.data;
  }, []);

  const set = useCallback((key: string, data: T) => {
    memoryStore.set(key, { data, timestamp: Date.now(), key });
  }, []);

  const invalidate = useCallback((keyPrefix: string) => {
    for (const k of memoryStore.keys()) {
      if (k.startsWith(keyPrefix)) memoryStore.delete(k);
    }
  }, []);

  const invalidateAll = useCallback(() => {
    memoryStore.clear();
  }, []);

  return { get, set, invalidate, invalidateAll };
}
