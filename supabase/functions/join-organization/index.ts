import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { jwtVerify } from 'https://esm.sh/jose@5';

// CORS — sadece bilinen origin'lere izin ver
const ALLOWED_ORIGINS = [
  'https://readdy.ai',
  'https://app.readdy.ai',
  // Geliştirme ortamı
  'http://localhost:5173',
  'http://localhost:3000',
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.some(o => origin.startsWith(o))
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

// In-memory rate limiter: userId → { count, resetAt }
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;       // max 5 deneme
const RATE_WINDOW = 60_000; // 1 dakika

function checkRateLimit(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }

  if (entry.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT - entry.count };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── JWT doğrulama ──────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Yetkisiz erişim.' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  let userId: string;
  let userEmail: string;

  try {
    const jwtSecret = Deno.env.get('SUPABASE_JWT_SECRET');
    if (!jwtSecret) throw new Error('JWT secret not configured');
    const { payload } = await jwtVerify(token, new TextEncoder().encode(jwtSecret));
    if (!payload.sub) throw new Error('No sub in JWT');
    userId = payload.sub as string;
    userEmail = (payload.email as string) ?? '';
  } catch (e) {
    console.error('[join-org] JWT verification failed:', e);
    return new Response(JSON.stringify({ error: 'Geçersiz oturum. Lütfen tekrar giriş yapın.' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── Rate limiting — userId bazlı ──────────────────────────
  const rl = checkRateLimit(`join:${userId}`);
  if (!rl.allowed) {
    console.warn(`[join-org] Rate limit exceeded for user ${userId}`);
    return new Response(JSON.stringify({
      error: 'Çok fazla deneme yaptınız. Lütfen 1 dakika bekleyin.',
    }), {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': '60',
        'X-RateLimit-Remaining': '0',
      },
    });
  }

  // ── Request body ──────────────────────────────────────────
  let body: { invite_code?: string } = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Geçersiz istek gövdesi.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const inviteCode = (body.invite_code ?? '').trim().toUpperCase();
  if (!inviteCode || inviteCode.length < 4 || inviteCode.length > 10) {
    return new Response(JSON.stringify({ error: 'Geçersiz davet kodu formatı.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // ── Org bul ───────────────────────────────────────────────
  const { data: targetOrg, error: orgError } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('invite_code', inviteCode)
    .maybeSingle();

  if (orgError || !targetOrg) {
    // Başarısız denemeyi logla
    console.warn(`[join-org] Invalid invite code attempt by user=${userId} code=${inviteCode}`);
    await supabase.from('activity_logs').insert({
      organization_id: '00000000-0000-0000-0000-000000000000',
      user_id: userId,
      user_email: userEmail,
      user_name: userEmail,
      user_role: 'unknown',
      action_type: 'invite_code_failed',
      module: 'Onboarding',
      record_id: userId,
      description: `Geçersiz davet kodu denemesi: ${inviteCode}`,
    }).catch(() => {/* silent */});

    return new Response(JSON.stringify({ error: 'Geçersiz davet kodu.' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── Zaten üye mi? ─────────────────────────────────────────
  const { data: alreadyMember } = await supabase
    .from('user_organizations')
    .select('id')
    .eq('user_id', userId)
    .eq('organization_id', targetOrg.id)
    .maybeSingle();

  if (alreadyMember) {
    return new Response(JSON.stringify({ error: 'Bu organizasyona zaten üyesiniz.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── Üye ekle ──────────────────────────────────────────────
  const { error: memberError } = await supabase
    .from('user_organizations')
    .insert({
      user_id: userId,
      organization_id: targetOrg.id,
      role: 'member',
      email: userEmail,
      is_active: true,
      must_change_password: false,
    });

  if (memberError) {
    if (memberError.message.includes('duplicate')) {
      return new Response(JSON.stringify({ error: 'Bu organizasyona zaten üyesiniz.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.error('[join-org] Insert error:', memberError);
    return new Response(JSON.stringify({ error: 'Organizasyona katılırken hata oluştu.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── Başarı logu ───────────────────────────────────────────
  await supabase.from('activity_logs').insert({
    organization_id: targetOrg.id,
    user_id: userId,
    user_email: userEmail,
    user_name: userEmail,
    user_role: 'member',
    action_type: 'user_joined',
    module: 'Onboarding',
    record_id: userId,
    description: `${userEmail} organizasyona davet koduyla katıldı.`,
  }).catch(() => {/* silent */});

  console.log(`[join-org] User ${userId} joined org ${targetOrg.id} successfully`);

  return new Response(JSON.stringify({
    success: true,
    organization: { id: targetOrg.id, name: targetOrg.name },
  }), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-RateLimit-Remaining': String(rl.remaining),
    },
  });
});
