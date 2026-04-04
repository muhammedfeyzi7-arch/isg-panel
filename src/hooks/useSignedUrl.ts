import { useState, useEffect, useRef } from 'react';
import { getSignedUrlFromPath } from '@/utils/fileUpload';

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

export function useSignedUrls(filePaths: (string | null | undefined)[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});

  // Stable key: sadece geçerli path'leri join et, max 2000 char ile sınırla
  const stableKey = filePaths
    .filter((p): p is string => !!p)
    .join('|')
    .slice(0, 2000);

  useEffect(() => {
    const validPaths = filePaths.filter((p): p is string => !!p);
    if (validPaths.length === 0) { setUrls({}); return; }

    let cancelled = false;

    const fetchAll = async () => {
      const results: Record<string, string> = {};
      await Promise.all(
        validPaths.map(async (path) => {
          // base64 veya tam URL ise direkt kullan
          if (path.startsWith('data:') || path.startsWith('http')) {
            results[path] = path;
            return;
          }
          const resolved = await getSignedUrlFromPath(path);
          if (resolved) results[path] = resolved;
        }),
      );
      if (!cancelled) setUrls(results);
    };

    void fetchAll();

    // 50 dakikada bir yenile (signed URL 1 saat geçerli)
    const interval = setInterval(() => { void fetchAll(); }, 50 * 60 * 1000);

    return () => { cancelled = true; clearInterval(interval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableKey]);

  return urls;
}
