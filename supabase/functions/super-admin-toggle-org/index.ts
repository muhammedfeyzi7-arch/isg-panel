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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Yetkisiz erişim.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '').trim();

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Token sahibi super admin mi kontrol et
    const { data: { user: callerUser }, error: authErr } = await adminClient.auth.getUser(token);
    if (authErr || !callerUser) {
      return new Response(JSON.stringify({ error: 'Geçersiz oturum.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await adminClient
      .from('profiles')
      .select('is_super_admin')
      .eq('user_id', callerUser.id)
      .maybeSingle();

    if (!profile?.is_super_admin) {
      return new Response(JSON.stringify({ error: 'Süper admin yetkisi gereklidir.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { org_id, is_active, subscription_end } = body as {
      org_id: string;
      is_active?: boolean;
      subscription_end?: string;
    };

    if (!org_id) {
      return new Response(JSON.stringify({ error: 'org_id zorunludur.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof is_active === 'boolean') updateFields.is_active = is_active;
    if (subscription_end !== undefined) updateFields.subscription_end = subscription_end;

    // 1. Organizasyonu güncelle
    const { error: orgErr } = await adminClient
      .from('organizations')
      .update(updateFields)
      .eq('id', org_id);

    if (orgErr) {
      return new Response(JSON.stringify({ error: 'Organizasyon güncellenemedi: ' + orgErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Eğer is_active değişiyorsa — tüm user_organizations üyelerini de güncelle
    if (typeof is_active === 'boolean') {
      const { error: memberErr } = await adminClient
        .from('user_organizations')
        .update({ is_active })
        .eq('organization_id', org_id);

      if (memberErr) {
        console.error('[toggle-org] user_organizations güncelleme hatası:', memberErr.message);
        // Kritik değil, organizasyon güncellendi sayılsın
      }

      // 3. Pasife alındıysa — tüm aktif session'ları zorla kapat
      if (!is_active) {
        // Bu org'daki tüm kullanıcıların user_id'sini bul
        const { data: members } = await adminClient
          .from('user_organizations')
          .select('user_id')
          .eq('organization_id', org_id);

        if (members && members.length > 0) {
          // Her kullanıcının session'ını iptal et
          await Promise.allSettled(
            members.map(m =>
              adminClient.auth.admin.signOut(m.user_id, 'others')
            )
          );
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: 'Sunucu hatası: ' + msg }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
