import { supabase } from '@/lib/supabase';

export async function uploadDofPhoto(
  file: File,
  organizationId: string,
  type: 'opening' | 'closing'
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${organizationId}/${type}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage
    .from('dof-photos')
    .upload(path, file, { upsert: false, contentType: file.type });

  if (error) throw new Error(`Fotoğraf yüklenemedi: ${error.message}`);

  const { data } = supabase.storage.from('dof-photos').getPublicUrl(path);
  return data.publicUrl;
}

export async function imageUrlToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}
