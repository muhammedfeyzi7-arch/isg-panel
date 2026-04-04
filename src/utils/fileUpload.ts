import { supabase } from '@/lib/supabase';

/**
 * Dosya doğrulama — boyut ve tip kontrolü
 * @returns null if valid, error message string if invalid
 */
export function validateFile(file: File, maxMB = 10): string | null {
  const maxBytes = maxMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return `Dosya boyutu ${maxMB}MB sınırını aşıyor (${(file.size / 1024 / 1024).toFixed(1)}MB).`;
  }
  const allowed = /\.(pdf|jpg|jpeg|png)$/i;
  if (!allowed.test(file.name)) {
    return 'Sadece PDF, JPG ve PNG dosyaları desteklenmektedir.';
  }
  return null;
}

/**
 * Signed URL üret — private bucket için güvenli erişim
 * URL 1 saat geçerli, sadece giriş yapmış kullanıcılar erişebilir
 */
export async function getSignedUrl(
  filePath: string,
  bucket = 'uploads',
  expiresIn = 3600,
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresIn);
    if (error || !data?.signedUrl) {
      console.error('[fileUpload] getSignedUrl error:', error);
      return null;
    }
    return data.signedUrl;
  } catch (err) {
    console.error('[fileUpload] getSignedUrl exception:', err);
    return null;
  }
}

/**
 * Stored path'ten signed URL üret
 * DB'de saklanan path formatı: {orgId}/{module}/{uuid}.{ext}
 */
export async function getSignedUrlFromPath(
  storedPath: string,
  bucket = 'uploads',
): Promise<string | null> {
  if (!storedPath) return null;
  // Eğer zaten tam URL ise path'i çıkar
  const pathMatch = storedPath.match(/\/storage\/v1\/object\/(?:public|sign)\/[^/]+\/(.+?)(?:\?|$)/);
  const cleanPath = pathMatch ? pathMatch[1] : storedPath;
  return getSignedUrl(cleanPath, bucket);
}

/**
 * Merkezi dosya yükleme yardımcısı
 * File objesi → Supabase Storage (private) → storage PATH döner (DB'ye kaydedilir)
 * NOT: Artık signed URL değil, filePath döner. Görüntüleme için getSignedUrlFromPath kullan.
 */
export async function uploadFileToStorage(
  file: File,
  orgId: string,
  module: string,
  recordId?: string,
): Promise<string | null> {
  try {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
    const uuid = recordId ?? crypto.randomUUID();
    const filePath = `${orgId}/${module}/${uuid}.${ext}`;

    const { error } = await supabase.storage
      .from('uploads')
      .upload(filePath, file, { upsert: true, contentType: file.type });

    if (error) {
      console.error(`[fileUpload] Storage error (${module}):`, error);
      return null;
    }

    // DB'ye filePath kaydet — expire olmaz, görüntüleme anında signed URL üretilir
    return filePath;
  } catch (err) {
    console.error(`[fileUpload] Unexpected error (${module}):`, err);
    return null;
  }
}

/**
 * base64 data URL → Supabase Storage (private) → filePath döner
 */
export async function uploadBase64ToStorage(
  base64: string,
  orgId: string,
  module: string,
  recordId: string,
  fileName?: string,
): Promise<string | null> {
  try {
    const [meta, data] = base64.split(',');
    const mimeMatch = meta.match(/data:([^;]+);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const ext = fileName?.split('.').pop()?.toLowerCase() ?? mime.split('/')[1]?.split('+')[0] ?? 'bin';
    const filePath = `${orgId}/${module}/${recordId}.${ext}`;

    const byteString = atob(data);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    const blob = new Blob([ab], { type: mime });

    const { error } = await supabase.storage
      .from('uploads')
      .upload(filePath, blob, { upsert: true, contentType: mime });

    if (error) {
      console.error(`[fileUpload] base64 Storage error (${module}):`, error);
      return null;
    }

    // DB'ye filePath kaydet — expire olmaz
    return filePath;
  } catch (err) {
    console.error(`[fileUpload] base64 error (${module}):`, err);
    return null;
  }
}

/**
 * URL'den dosya indir (fetch → blob → download)
 * Signed URL'ler için de çalışır
 */
export async function downloadFromUrl(url: string, fileName: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    return true;
  } catch {
    return false;
  }
}

/**
 * URL'den base64'e çevir (Excel/Word embed için)
 * filePath ise önce signed URL üretir, sonra fetch eder
 */
export async function urlToBase64(urlOrPath: string): Promise<string | null> {
  if (!urlOrPath) return null;
  try {
    // filePath ise signed URL üret
    let fetchUrl = urlOrPath;
    if (!urlOrPath.startsWith('data:') && !urlOrPath.startsWith('http://') && !urlOrPath.startsWith('https://')) {
      const signed = await getSignedUrlFromPath(urlOrPath);
      if (!signed) return null;
      fetchUrl = signed;
    }
    // base64 ise direkt döndür
    if (fetchUrl.startsWith('data:')) return fetchUrl;

    const res = await fetch(fetchUrl, {
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * base64 data URL → Blob → download
 */
export function downloadFromBase64(base64: string, fileName: string): void {
  try {
    const arr = base64.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
    const bstr = atob(arr[1]);
    const u8arr = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
    const blob = new Blob([u8arr], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    const link = document.createElement('a');
    link.href = base64;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
