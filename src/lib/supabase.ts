import { createClient } from '@supabase/supabase-js';

// Supports both VITE_SUPABASE_URL and VITE_PUBLIC_SUPABASE_URL (legacy)
const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  (import.meta.env.VITE_PUBLIC_SUPABASE_URL as string | undefined) ||
  '';

const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  (import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string | undefined) ||
  '';

/**
 * Returns true if Supabase environment variables are properly configured.
 * Use this to show a friendly error instead of crashing.
 */
export const isSupabaseConfigured =
  supabaseUrl.length > 0 &&
  supabaseUrl !== 'https://your-project-id.supabase.co' &&
  supabaseAnonKey.length > 0 &&
  supabaseAnonKey !== 'your-anon-key-here';

/**
 * Safe Supabase client — only initialised when config is valid.
 * If config is missing the app renders a friendly error screen instead of crashing.
 */
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : // Provide a no-op mock so imports don't explode before the config check
    createClient('https://placeholder.supabase.co', 'placeholder-key');
