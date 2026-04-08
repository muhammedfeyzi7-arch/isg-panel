import { useState, useEffect, useRef } from 'react';
import { getSignedUrlFromPath, getSignedUrlsBulk } from '@/utils/fileUpload';

export interface SignedUrlResult {
  url: string | null;
  loading: boolean;
}

export function useSignedUrl(filePath: string | null | undefined, bucket = 'uploads'): SignedUrlResult {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!filePath) {
      setUrl(null);
      setLoading(false);
      return;
    }

    // base64 veya tam URL ise direkt kullan — signed URL üretmeye gerek yok
    if (filePath.startsWith('data:') || filePath.startsWith('http')) {
      setUrl(filePath);
      setLoading(false);
      return;
    }

    setLoading(true);

    const fetchUrl = async () => {
      const resolved = await getSignedUrlFromPath(filePath, bucket);
      setUrl(resolved);
      setLoading(false);
    };

    void fetchUrl();

    // 50 dakikada bir yenile (signed URL 1 saat geçerli)
    timerRef.current = setInterval(() => { void fetchUrl(); }, 50 * 60 * 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [filePath, bucket]);

  return { url, loading };
}

export interface SignedUrlsResult {
  urls: Record<string, string>;
  loading: boolean;
}

/**
 * Çoklu signed URL hook — BULK optimized
 *
 * N path için tek Supabase request atar (cache miss olanlar için).
 * Cache hit olanlar anında gösterilir, loading false kalır.
 *
 * @param filePaths - filePath listesi (null/undefined güvenli)
 * @param bucket    - Storage bucket (default: 'uploads')
 */
export function useSignedUrls(
  filePaths: (string | null | undefined)[],
  bucket = 'uploads',
): SignedUrlsResult {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stable key: sadece geçerli path'leri join et, max 2000 char ile sınırla
  const stableKey = filePaths
    .filter((p): p is string => !!p)
    .join('|')
    .slice(0, 2000);

  useEffect(() => {
    const validPaths = filePaths.filter((p): p is string => !!p);

    if (validPaths.length === 0) {
      setUrls({});
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchBulk = async () => {
      setLoading(true);
      const result = await getSignedUrlsBulk(validPaths, bucket);
      if (!cancelled) {
        setUrls(result);
        setLoading(false);
      }
    };

    void fetchBulk();

    // 50 dakikada bir yenile (signed URL 24 saat geçerli, cache 5 dk TTL)
    intervalRef.current = setInterval(() => { void fetchBulk(); }, 50 * 60 * 1000);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableKey, bucket]);

  return { urls, loading };
}
