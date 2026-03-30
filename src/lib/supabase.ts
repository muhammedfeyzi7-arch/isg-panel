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

// ── Startup diagnostics ──────────────────────────────────────────
// Log exactly what URL and key format are in use so we can diagnose
// production "Failed to fetch" issues without guessing.
const keyPrefix = supabaseAnonKey.substring(0, 20);
const keyFormat = supabaseAnonKey.startsWith('eyJ')
  ? 'JWT ✓'
  : supabaseAnonKey.startsWith('sb_publishable_')
    ? 'Readdy proxy key (may fail in published site — needs real anon key)'
    : supabaseAnonKey.length === 0
      ? 'MISSING'
      : 'unknown format';

console.log('[ISG:Supabase] URL:', supabaseUrl || '(NOT SET)');
console.log('[ISG:Supabase] Key prefix:', keyPrefix ? `${keyPrefix}…` : '(NOT SET)');
console.log('[ISG:Supabase] Key format:', keyFormat);
console.log('[ISG:Supabase] Auth endpoint:', supabaseUrl ? `${supabaseUrl}/auth/v1` : '(unknown)');
// ─────────────────────────────────────────────────────────────────

/**
 * Returns true if Supabase environment variables are properly configured.
 * Use this to show a friendly error instead of crashing.
 */
export const isSupabaseConfigured =
  supabaseUrl.length > 0 &&
  supabaseUrl !== 'https://your-project-id.supabase.co' &&
  supabaseAnonKey.length > 0 &&
  supabaseAnonKey !== 'your-anon-key-here';

/** The resolved Supabase project URL — exposed for diagnostic display */
export const resolvedSupabaseUrl = supabaseUrl;
/** Key format indicator — exposed for diagnostic display */
export const resolvedKeyFormat = keyFormat;

/**
 * Ping the Supabase health endpoint to test connectivity.
 * Returns { ok, error, detail, statusCode }.
 * Catches CORS / network errors and gives a specific diagnosis.
 */
export async function testSupabaseConnection(): Promise<{
  ok: boolean;
  error?: string;
  detail?: string;
  statusCode?: number;
}> {
  if (!isSupabaseConfigured) {
    return {
      ok: false,
      error: 'Supabase yapılandırılmamış',
      detail: 'VITE_SUPABASE_URL veya VITE_SUPABASE_ANON_KEY eksik.',
    };
  }
  try {
    // Use the Supabase auth health endpoint — doesn't require auth, just tests reachability
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
      method: 'GET',
      headers: { 'apikey': supabaseAnonKey },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    console.log(`[ISG:Supabase] Health check → ${response.status} ${response.statusText}`);

    if (response.ok || response.status === 200) {
      return { ok: true, statusCode: response.status };
    }
    const text = await response.text().catch(() => '');
    return {
      ok: false,
      error: `HTTP ${response.status}`,
      detail: text || response.statusText,
      statusCode: response.status,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isAbort = err instanceof Error && err.name === 'AbortError';
    const isCors = msg === 'Failed to fetch' || msg.includes('NetworkError') || msg.includes('network');

    console.error('[ISG:Supabase] Connection test failed:', msg);

    if (isAbort) {
      return {
        ok: false,
        error: 'Zaman aşımı',
        detail: `Supabase ${supabaseUrl} adresine 8 saniyede ulaşılamadı. İnternet bağlantınızı kontrol edin.`,
      };
    }
    if (isCors) {
      return {
        ok: false,
        error: 'CORS / Ağ Hatası (Failed to fetch)',
        detail: `Yayınlanan site ${supabaseUrl} adresine erişemiyor. Supabase Dashboard → Authentication → URL Configuration → Site URL ve Redirect URLs bölümlerine yayın domaininizi ekleyin. Ayrıca ${supabaseUrl.replace('https://', '')} adresinin Supabase CORS izin listesinde olduğundan emin olun.`,
      };
    }
    return {
      ok: false,
      error: msg,
      detail: `Tam hata: ${msg}`,
    };
  }
}

/**
 * Safe Supabase client — only initialised when config is valid.
 * If config is missing the app renders a friendly error screen instead of crashing.
 */
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : // Provide a no-op mock so imports don't explode before the config check
    createClient('https://placeholder.supabase.co', 'placeholder-key');
