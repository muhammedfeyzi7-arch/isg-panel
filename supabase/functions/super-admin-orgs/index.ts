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
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Caller's supabase client (to get user info)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get caller user
    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check is_super_admin from profiles using service role (bypass RLS)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('is_super_admin')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError || !profile?.is_super_admin) {
      return new Response(JSON.stringify({ error: 'Forbidden: not a super admin' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle different operations
    const url = new URL(req.url);
    const operation = url.searchParams.get('op') ?? 'list';

    if (operation === 'list') {
      // Get all organizations with member counts
      const { data: orgs, error: orgsError } = await adminClient
        .from('organizations')
        .select('id, name, invite_code, is_active, subscription_start, subscription_end, created_at, created_by')
        .order('created_at', { ascending: false });

      if (orgsError) throw orgsError;

      // Get member counts
      const orgsWithCount = await Promise.all(
        (orgs ?? []).map(async (org) => {
          const { count } = await adminClient
            .from('user_organizations')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', org.id)
            .eq('is_active', true);

          // Get creator email
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

    if (operation === 'update' && req.method === 'POST') {
      const body = await req.json();
      const { orgId, is_active, subscription_start, subscription_end } = body;

      if (!orgId) {
        return new Response(JSON.stringify({ error: 'orgId required' }), {
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

    if (operation === 'check_admin') {
      return new Response(JSON.stringify({ is_super_admin: true, email: user.email }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown operation' }), {
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
