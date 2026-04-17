import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  process.env.VITE_PUBLIC_SUPABASE_URL ??
  '';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.VITE_PUBLIC_SUPABASE_ANON_KEY ??
  '';

export const isSupabaseConfigured =
  supabaseUrl.length > 0 &&
  supabaseUrl !== 'https://your-project-id.supabase.co' &&
  supabaseAnonKey.length > 0 &&
  supabaseAnonKey !== 'your-anon-key-here';

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
