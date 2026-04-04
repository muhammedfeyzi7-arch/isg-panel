import { supabase } from '@/lib/supabase';

/**
 * Merkezi dosya yükleme yardımcısı
 * File objesi → Supabase Storage → public URL
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

    const { data } = supabase.storage.from('uploads').getPublicUrl(filePath);
    return data?.publicUrl ?? null;
  } catch (err) {
    console.error(`[fileUpload] Unexpected error (${module}):`, err);
    return null;
  }
}

/**
 * base64 data URL → Supabase Storage → public URL
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

    const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(filePath);
    return urlData?.publicUrl ?? null;
  } catch (err) {
    console.error(`[fileUpload] base64 error (${module}):`, err);
    return null;
  }
}

/**
 * URL'den dosya indir (fetch → blob → download)
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
 */
export async function urlToBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'force-cache' });
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
