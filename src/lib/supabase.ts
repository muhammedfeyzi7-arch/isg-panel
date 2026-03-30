import { createClient } from '@supabase/supabase-js';

// Support both VITE_PUBLIC_ and VITE_ prefixed env vars
const supabaseUrl =
  (import.meta.env.VITE_PUBLIC_SUPABASE_URL as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  '';

// The API key — supports both legacy JWT (eyJ...) and new publishable key (sb_publishable_...)
// Supabase rolled out sb_publishable_ as the default for all new projects from May 2025.
// Both formats are fully supported by supabase-js.
const supabaseKey =
  (import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  '';

// ── Startup diagnostics ──────────────────────────────────────────
const detectKeyFormat = (key: string): string => {
  if (!key) return 'MISSING';
  if (key.startsWith('eyJ')) return 'JWT (legacy anon key)';
  if (key.startsWith('sb_publishable_')) return 'Publishable key (new format) ✓';
  if (key.startsWith('sb_secret_')) return 'Secret key (do NOT use on frontend!)';
  return `unknown format: ${key.substring(0, 12)}…`;
};

console.log('[Supabase] URL:', supabaseUrl || '(NOT SET)');
console.log('[Supabase] Key format:', detectKeyFormat(supabaseKey));
// ─────────────────────────────────────────────────────────────────

/**
 * Returns true when Supabase environment variables are present and non-placeholder.
 */
export const isSupabaseConfigured =
  supabaseUrl.length > 0 &&
  supabaseUrl !== 'https://your-project-id.supabase.co' &&
  supabaseKey.length > 0 &&
  supabaseKey !== 'your-anon-key-here';

/** Exposed for diagnostics */
export const resolvedSupabaseUrl = supabaseUrl;
export const resolvedKeyFormat = detectKeyFormat(supabaseKey);

/**
 * Ping the Supabase health endpoint to test live connectivity.
 * Works with both legacy JWT keys and new sb_publishable_ keys.
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
      detail: 'VITE_PUBLIC_SUPABASE_URL veya VITE_PUBLIC_SUPABASE_ANON_KEY eksik.',
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
      method: 'GET',
      headers: { apikey: supabaseKey },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    console.log(`[Supabase] Health check → ${response.status} ${response.statusText}`);

    if (response.ok) {
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
    const isNetwork =
      msg === 'Failed to fetch' || msg.includes('NetworkError') || msg.includes('network');

    console.error('[Supabase] Connection test failed:', msg);

    if (isAbort) {
      return {
        ok: false,
        error: 'Zaman aşımı',
        detail: `${supabaseUrl} adresine 8 saniyede ulaşılamadı.`,
      };
    }
    if (isNetwork) {
      return {
        ok: false,
        error: 'Ağ Hatası (Failed to fetch)',
        detail: `Supabase → Authentication → URL Configuration bölümüne yayın domaininizi ekleyin (Site URL + Redirect URLs).`,
      };
    }
    return { ok: false, error: msg, detail: `Tam hata: ${msg}` };
  }
}

/**
 * Singleton Supabase client.
 * supabase-js 2.x supports both legacy JWT anon keys and new sb_publishable_ keys natively.
 */
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : createClient('https://placeholder.supabase.co', 'placeholder-key');
