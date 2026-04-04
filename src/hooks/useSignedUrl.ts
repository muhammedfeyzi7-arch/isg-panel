import { useState, useEffect, useRef } from 'react';
import { getSignedUrlFromPath } from '@/utils/fileUpload';

/**
 * Verilen filePath için görüntüleme anında signed URL üretir.
 * filePath hem eski signed URL formatını hem de yeni path formatını destekler.
 * URL 50 dakikada bir otomatik yenilenir (expire olmadan önce).
 */
export function useSignedUrl(filePath: string | null | undefined, bucket = 'uploads'): string | null {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!filePath) {
      setSignedUrl(null);
      return;
    }

    // Eğer zaten tam bir signed URL ise (eski format) — direkt kullan
    // Ama expire olmuş olabilir, yine de path'i çıkarıp yenile
    const fetchUrl = async () => {
      const url = await getSignedUrlFromPath(filePath, bucket);
      setSignedUrl(url);
    };

    void fetchUrl();

    // 50 dakikada bir yenile (1 saatlik URL'nin 10 dk öncesinde)
    timerRef.current = setInterval(() => {
      void fetchUrl();
    }, 50 * 60 * 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [filePath, bucket]);

  return signedUrl;
}

/**
 * Birden fazla filePath için signed URL üretir.
 * Record<filePath, signedUrl> döner.
 */
export function useSignedUrls(filePaths: (string | null | undefined)[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const validPaths = filePaths.filter((p): p is string => !!p);
    if (validPaths.length === 0) {
      setUrls({});
      return;
    }

    let cancelled = false;

    const fetchAll = async () => {
      const results: Record<string, string> = {};
      await Promise.all(
        validPaths.map(async (path) => {
          const url = await getSignedUrlFromPath(path);
          if (url) results[path] = url;
        }),
      );
      if (!cancelled) setUrls(results);
    };

    void fetchAll();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePaths.join(',')]);

  return urls;
}
