import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceClient = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('is_super_admin')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile?.is_super_admin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { org_id, fields } = await req.json();
    if (!org_id || !fields) {
      return new Response(JSON.stringify({ error: 'org_id and fields required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Organizasyonu güncelle
    const { data, error } = await serviceClient
      .from('organizations')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', org_id)
      .select();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Pasife alındıysa veya tarih geçmişe çekildiyse — tüm session'ları direkt DB'den sil
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const shouldKick = fields.is_active === false || (
      fields.subscription_end && fields.subscription_end < todayStr
    );

    if (shouldKick) {
      const { data: members } = await serviceClient
        .from('user_organizations')
        .select('user_id')
        .eq('organization_id', org_id);

      if (members && members.length > 0) {
        for (const m of members) {
          try {
            // Direkt DB'den session sil — en kesin yöntem
            await serviceClient.rpc('delete_user_sessions', { target_user_id: m.user_id });
          } catch { /* devam */ }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
