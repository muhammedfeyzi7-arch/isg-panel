import { useState, useEffect, useRef } from 'react';
import { getSignedUrlFromPath } from '@/utils/fileUpload';

export function useSignedUrl(filePath: string | null | undefined, bucket = 'uploads'): string | null {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!filePath) { setSignedUrl(null); return; }

    // base64 veya tam URL ise direkt kullan — signed URL üretmeye gerek yok
    if (filePath.startsWith('data:') || filePath.startsWith('http')) {
      setSignedUrl(filePath);
      return;
    }

    const fetchUrl = async () => {
      const url = await getSignedUrlFromPath(filePath, bucket);
      setSignedUrl(url);
    };

    void fetchUrl();

    timerRef.current = setInterval(() => { void fetchUrl(); }, 50 * 60 * 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [filePath, bucket]);

  return signedUrl;
}

export function useSignedUrls(filePaths: (string | null | undefined)[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});

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
