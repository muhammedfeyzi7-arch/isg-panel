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
      return new Response(JSON.stringify({ error: 'Oturum bulunamadı. Lütfen önce giriş yapın.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Caller client - verify user token
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await callerClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Geçersiz oturum. Lütfen tekrar giriş yapın.', detail: userError?.message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service role client - bypass RLS
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Check is_super_admin
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('is_super_admin')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) {
      return new Response(JSON.stringify({ error: 'Profil sorgu hatası: ' + profileError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!profile || !profile.is_super_admin) {
      return new Response(JSON.stringify({ error: 'Bu sayfaya erişim yetkiniz yok.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const operation = url.searchParams.get('op') ?? 'list';

    if (operation === 'check_admin') {
      return new Response(JSON.stringify({ is_super_admin: true, email: user.email }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (operation === 'list') {
      const { data: orgs, error: orgsError } = await adminClient
        .from('organizations')
        .select('id, name, invite_code, is_active, subscription_start, subscription_end, created_at, created_by')
        .order('created_at', { ascending: false });

      if (orgsError) throw orgsError;

      const orgsWithCount = await Promise.all(
        (orgs ?? []).map(async (org) => {
          const { count } = await adminClient
            .from('user_organizations')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', org.id)
            .eq('is_active', true);

          let creatorEmail = null;
          if (org.created_by) {
            const { data: uo } = await adminClient
              .from('user_organizations')
              .select('email')
              .eq('user_id', org.created_by)
              .maybeSingle();
            creatorEmail = uo?.email ?? null;
          }

          return { ...org, member_count: count ?? 0, creator_email: creatorEmail };
        })
      );

      return new Response(JSON.stringify({ data: orgsWithCount }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (operation === 'get_members') {
      const orgId = url.searchParams.get('orgId');
      if (!orgId) {
        return new Response(JSON.stringify({ error: 'orgId gerekli' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: members, error: membersError } = await adminClient
        .from('user_organizations')
        .select('user_id, email, role, is_active, joined_at, created_at')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: true });

      if (membersError) throw membersError;

      // Enrich with profile names
      const enriched = await Promise.all(
        (members ?? []).map(async (m) => {
          const { data: p } = await adminClient
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('user_id', m.user_id)
            .maybeSingle();
          return {
            ...m,
            full_name: p?.full_name ?? null,
            avatar_url: p?.avatar_url ?? null,
          };
        })
      );

      return new Response(JSON.stringify({ data: enriched }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (operation === 'update' && req.method === 'POST') {
      const body = await req.json();
      const { orgId, is_active, subscription_start, subscription_end } = body;

      if (!orgId) {
        return new Response(JSON.stringify({ error: 'orgId gerekli' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: updateError } = await adminClient
        .from('organizations')
        .update({
          is_active,
          subscription_start: subscription_start || null,
          subscription_end: subscription_end || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orgId);

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Bilinmeyen işlem' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
