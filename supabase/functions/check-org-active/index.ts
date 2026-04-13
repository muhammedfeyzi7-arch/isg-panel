import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function getCorsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const { user_id } = body as { user_id: string };

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id zorunludur.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Kullanıcının aktif üyeliğini bul
    const { data: membership, error: memberErr } = await adminClient
      .from('user_organizations')
      .select('organization_id, is_active')
      .eq('user_id', user_id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (memberErr) {
      return new Response(JSON.stringify({ error: memberErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!membership) {
      return new Response(JSON.stringify({ allowed: false, reason: 'no_membership' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Organizasyonun aktif ve aboneliğinin geçerli olup olmadığını kontrol et
    const { data: org, error: orgErr } = await adminClient
      .from('organizations')
      .select('id, is_active, subscription_end')
      .eq('id', membership.organization_id)
      .maybeSingle();

    if (orgErr) {
      return new Response(JSON.stringify({ error: orgErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!org || org.is_active === false) {
      return new Response(JSON.stringify({ allowed: false, reason: 'org_inactive' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Abonelik süresi dolmuş mu kontrol et
    if (org.subscription_end) {
      const expiry = new Date(org.subscription_end);
      const now = new Date();
      if (expiry < now) {
        return new Response(JSON.stringify({ allowed: false, reason: 'subscription_expired' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ allowed: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: 'Sunucu hatası: ' + msg }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
