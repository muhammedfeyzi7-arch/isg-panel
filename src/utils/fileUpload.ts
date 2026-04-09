import { supabase } from '@/lib/supabase';

/**
 * Signed URL in-memory cache
 * Key: `${bucket}::${filePath}`
 * Value: { url, expiresAt } — 5 dakika TTL
 */
interface CacheEntry {
  url: string;
  expiresAt: number;
}
const urlCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 dakika

function getCachedUrl(bucket: string, filePath: string): string | null {
  const key = `${bucket}::${filePath}`;
  const entry = urlCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    urlCache.delete(key);
    return null;
  }
  return entry.url;
}

function setCachedUrl(bucket: string, filePath: string, url: string): void {
  const key = `${bucket}::${filePath}`;
  urlCache.set(key, { url, expiresAt: Date.now() + CACHE_TTL_MS });
}

// Desteklenen MIME tipleri
const ALLOWED_MIME: Record<string, string> = {
  pdf:  'application/pdf',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
};

// İş izni / şirket belgeleri için genişletilmiş MIME listesi (docx/doc dahil)
const ALLOWED_MIME_EXTENDED: Record<string, string> = {
  ...ALLOWED_MIME,
  doc:  'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls:  'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/**
 * Dosya doğrulama — boyut, uzantı ve MIME tip kontrolü
 *
 * @param file       - Doğrulanacak dosya
 * @param extended   - true → PDF/JPG/PNG + DOC/DOCX/XLS/XLSX kabul edilir
 *                     false (default) → sadece PDF/JPG/PNG
 * @throws Error     - Geçersiz dosyada hata fırlatır (mesaj kullanıcıya gösterilir)
 */
export function validateFile(file: File, extended = false): void {
  if (!file) throw new Error('Dosya seçilmedi.');

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const allowedMap = extended ? ALLOWED_MIME_EXTENDED : ALLOWED_MIME;

  // Uzantı kontrolü
  if (!allowedMap[ext]) {
    const allowed = extended
      ? 'PDF, JPG, PNG, DOC, DOCX, XLS, XLSX'
      : 'PDF, JPG, PNG';
    throw new Error(`Desteklenmeyen dosya formatı (.${ext}). Sadece ${allowed} dosyaları kabul edilmektedir.`);
  }

  // MIME tip kontrolü (tarayıcı tarafından belirlenir — ek güvenlik katmanı)
  const expectedMime = allowedMap[ext];
  if (file.type && file.type !== '' && file.type !== expectedMime) {
    // Bazı tarayıcılar MIME'i yanlış belirleyebilir — sadece uyarı logla, engelleme
    console.warn(`[validateFile] MIME mismatch: expected ${expectedMime}, got ${file.type}`);
  }

  // Boyut kontrolü — PDF max 50MB, görseller max 20MB
  const isPdf = ext === 'pdf';
  const isImage = ['jpg', 'jpeg', 'png'].includes(ext);
  const maxMB = isPdf ? 50 : isImage ? 20 : 50;
  const maxBytes = maxMB * 1024 * 1024;

  if (file.size > maxBytes) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    const limitMsg = isPdf
      ? 'PDF dosyaları max 50MB olabilir.'
      : isImage
      ? 'Görsel dosyaları (JPG/PNG) max 20MB olabilir.'
      : `Dosya max ${maxMB}MB olabilir.`;
    throw new Error(`Dosya boyutu çok büyük (${sizeMB}MB). ${limitMsg}`);
  }
}

/**
 * Signed URL üret — private bucket için güvenli erişim
 * Cache: aynı filePath için 5 dakika boyunca Supabase'e tekrar istek atmaz.
 * FIX 6: URL 24 saat geçerli (was 1 hour — caused broken images)
 */
export async function getSignedUrl(
  filePath: string,
  bucket = 'uploads',
  expiresIn = 86400,
): Promise<string | null> {
  // Boş/null path kontrolü — hiç request atma
  if (!filePath) return null;

  // Cache hit → direkt dön, Supabase'e istek yok
  const cached = getCachedUrl(bucket, filePath);
  if (cached) return cached;

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresIn);
    if (error || !data?.signedUrl) {
      console.error('[fileUpload] getSignedUrl error:', error);
      return null;
    }
    // Cache'e yaz
    setCachedUrl(bucket, filePath, data.signedUrl);
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
 * BULK Signed URL üret — N path için tek Supabase request
 *
 * Akış:
 *  1. Boş / data: / http path'leri ayır (request atılmaz)
 *  2. Cache'te olanları ayır (request atılmaz)
 *  3. Sadece cache miss olanları createSignedUrls ile TEK request'te al
 *  4. Gelenleri cache'e yaz
 *  5. Tüm sonuçları birleştir → Record<originalPath, signedUrl> döner
 *
 * @param paths   - Orijinal filePath listesi (null/undefined güvenli)
 * @param bucket  - Storage bucket adı (default: 'uploads')
 * @param expiresIn - Saniye cinsinden URL geçerlilik süresi (default: 86400 = 24 saat)
 */
export async function getSignedUrlsBulk(
  paths: (string | null | undefined)[],
  bucket = 'uploads',
  expiresIn = 86400,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  // 1. Geçerli path'leri filtrele + normalize et
  const validPaths: string[] = [];
  const directMap: Record<string, string> = {}; // data: veya http URL'ler

  for (const raw of paths) {
    if (!raw) continue;

    // Tam URL veya base64 → direkt kullan
    if (raw.startsWith('data:') || raw.startsWith('http://') || raw.startsWith('https://')) {
      directMap[raw] = raw;
      continue;
    }

    // Supabase storage URL'inden path çıkar
    const pathMatch = raw.match(/\/storage\/v1\/object\/(?:public|sign)\/[^/]+\/(.+?)(?:\?|$)/);
    const cleanPath = pathMatch ? pathMatch[1] : raw;
    validPaths.push(cleanPath);
  }

  // Direkt URL'leri sonuca ekle
  Object.assign(result, directMap);

  if (validPaths.length === 0) return result;

  // 2. Cache kontrolü — hit olanları ayır
  const cacheMisses: string[] = [];

  for (const p of validPaths) {
    const cached = getCachedUrl(bucket, p);
    if (cached) {
      result[p] = cached;
    } else {
      cacheMisses.push(p);
    }
  }

  if (cacheMisses.length === 0) return result; // Hepsi cache'teydi

  // 3. Cache miss olanları TEK request ile al
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrls(cacheMisses, expiresIn);

    if (error) {
      console.error('[fileUpload] getSignedUrlsBulk error:', error);
      // Hata durumunda tek tek fallback
      await Promise.all(
        cacheMisses.map(async (p) => {
          const url = await getSignedUrl(p, bucket, expiresIn);
          if (url) result[p] = url;
        }),
      );
      return result;
    }

    // 4. Gelenleri cache'e yaz + sonuca ekle
    if (data) {
      for (const item of data) {
        if (item.signedUrl && item.path) {
          setCachedUrl(bucket, item.path, item.signedUrl);
          result[item.path] = item.signedUrl;
        }
      }
    }
  } catch (err) {
    console.error('[fileUpload] getSignedUrlsBulk exception:', err);
  }

  return result;
}

/**
 * Görsel dosyaları upload öncesi sıkıştır (Canvas API)
 * Telefon kamerası 5-15MB çeker — bu fonksiyon 500KB-1MB'a düşürür.
 * PDF ve diğer dosyalara dokunmaz.
 *
 * @param file       - Sıkıştırılacak dosya
 * @param maxWidth   - Maksimum genişlik (px), default 1920
 * @param quality    - JPEG kalitesi 0-1, default 0.82
 */
async function compressImageIfNeeded(
  file: File,
  maxWidth = 1920,
  quality = 0.82,
): Promise<File> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const isImage = ['jpg', 'jpeg', 'png'].includes(ext);

  // Görsel değilse veya zaten küçükse (< 300KB) dokunma
  if (!isImage || file.size < 300 * 1024) return file;

  return new Promise<File>((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // Boyut hesapla — oranı koru
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          // Sıkıştırma işe yaramadıysa (nadiren olur) orijinali kullan
          if (blob.size >= file.size) { resolve(file); return; }
          const compressed = new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() });
          console.log(
            `[fileUpload] compress: ${(file.size / 1024).toFixed(0)}KB → ${(compressed.size / 1024).toFixed(0)}KB` +
            ` (${Math.round((1 - compressed.size / file.size) * 100)}% küçüldü)`,
          );
          resolve(compressed);
        },
        'image/jpeg',
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file); // Hata durumunda orijinali kullan
    };

    img.src = objectUrl;
  });
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
  // ── SON SAVUNMA: Her upload noktasından önce merkezi validation ──
  // is-izni ve company-documents modülleri genişletilmiş format kabul eder
  const isExtended = ['is-izni-evrak', 'company-doc', 'tutanak'].includes(module);
  validateFile(file, isExtended);

  // Uzantı güvenlik kontrolü — dosya adı manipülasyonuna karşı
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const safeExts = isExtended
    ? ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'xls', 'xlsx']
    : ['pdf', 'jpg', 'jpeg', 'png'];
  if (!safeExts.includes(ext)) {
    throw new Error(`Güvenlik hatası: .${ext} uzantısı bu modülde desteklenmiyor.`);
  }

  try {
    // Görsel ise upload öncesi sıkıştır — telefon fotoğrafları 5-15MB olabiliyor
    const fileToUpload = await compressImageIfNeeded(file);

    const fileExt = fileToUpload.name.split('.').pop()?.toLowerCase() ?? 'bin';
    const uuid = recordId ?? crypto.randomUUID();
    const filePath = `${orgId}/${module}/${uuid}.${fileExt}`;

    const { error } = await supabase.storage
      .from('uploads')
      .upload(filePath, fileToUpload, { upsert: true, contentType: fileToUpload.type });

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
 * Görsel ise upload öncesi otomatik sıkıştırır (telefon fotoğrafları için kritik)
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

    // Enforce 50MB server-side limit on base64 uploads
    const estimatedBytes = Math.ceil(data.length * 0.75);
    const MAX_BYTES = 50 * 1024 * 1024;
    if (estimatedBytes > MAX_BYTES) {
      console.error(`[fileUpload] base64 too large: ~${(estimatedBytes / 1024 / 1024).toFixed(1)}MB > 50MB limit`);
      throw new Error(`Dosya boyutu 50MB sınırını aşıyor (~${(estimatedBytes / 1024 / 1024).toFixed(1)}MB). Lütfen daha küçük bir dosya seçin.`);
    }

    const byteString = atob(data);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    const blob = new Blob([ab], { type: mime });

    // Görsel ise sıkıştır — telefon kamerası 5-15MB çekiyor
    const isImage = ['image/jpeg', 'image/jpg', 'image/png'].includes(mime);
    let uploadBlob = blob;
    let uploadMime = mime;
    let uploadExt = ext;

    if (isImage && blob.size > 300 * 1024) {
      const tempFile = new File([blob], `photo.${ext}`, { type: mime });
      const compressed = await compressImageIfNeeded(tempFile);
      if (compressed !== tempFile) {
        uploadBlob = compressed;
        uploadMime = 'image/jpeg';
        uploadExt = 'jpg';
      }
    }

    const filePath = `${orgId}/${module}/${recordId}.${uploadExt}`;

    const { error } = await supabase.storage
      .from('uploads')
      .upload(filePath, uploadBlob, { upsert: true, contentType: uploadMime });

    if (error) {
      console.error(`[fileUpload] base64 Storage error (${module}):`, error);
      return null;
    }

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
