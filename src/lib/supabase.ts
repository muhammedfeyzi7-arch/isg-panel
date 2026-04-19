import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
// v2

const supabaseUrl = (import.meta.env.VITE_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL) as string;
const supabaseAnonKey = (import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase] Supabase URL veya Anon Key tanımlı değil. ' +
    'Uygulama local state modunda çalışıyor.'
  );
}

export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

export const isSupabaseConfigured = (): boolean =>
  Boolean(supabaseUrl && supabaseAnonKey &&
    !supabaseUrl.includes('placeholder'));
