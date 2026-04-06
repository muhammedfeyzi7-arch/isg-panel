import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://readdy.ai',
  'https://app.readdy.ai',
  'http://localhost:5173',
  'http://localhost:3000',
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.some(o => origin.startsWith(o)) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verify token via Supabase Auth (no JWT secret needed)
  const { data: { user: authUser }, error: authError } = await adminClient.auth.getUser(token);
  if (authError || !authUser) {
    console.error('[setup-org] Auth failed:', authError?.message);
    return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userId = authUser.id;
  const userEmail = authUser.email ?? '';
  const userMetadata = authUser.user_metadata ?? {};

  // Parse optional org_name from body
  let bodyOrgName: string | null = null;
  try {
    const body = await req.json() as { org_name?: string };
    if (body?.org_name?.trim()) bodyOrgName = body.org_name.trim();
  } catch { /* no body */ }

  try {
    // Check existing active membership
    const { data: existingMembership } = await adminClient
      .from('user_organizations')
      .select('organization_id, role, is_active, must_change_password, display_name, email, organizations(id, name, invite_code)')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('joined_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingMembership?.organizations) {
      const org = existingMembership.organizations as { id: string; name: string; invite_code: string };

      // Ensure creator is always admin
      const { data: orgData } = await adminClient
        .from('organizations')
        .select('created_by')
        .eq('id', org.id)
        .maybeSingle();

      const isCreator = orgData?.created_by === userId;
      const finalRole = (isCreator || existingMembership.role === 'admin') ? 'admin' : (existingMembership.role ?? 'member');

      if (isCreator && existingMembership.role !== 'admin') {
        await adminClient.from('user_organizations')
          .update({ role: 'admin' })
          .eq('user_id', userId)
          .eq('organization_id', org.id);
      }

      return new Response(JSON.stringify({
        organization: org,
        role: finalRole,
        is_active: existingMembership.is_active,
        must_change_password: existingMembership.must_change_password,
        display_name: existingMembership.display_name,
        created: false,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // No org — check limit
    const { count: orgCount } = await adminClient
      .from('organizations')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', userId);

    if ((orgCount ?? 0) >= 3) {
      return new Response(JSON.stringify({ error: 'Maksimum 3 organizasyon oluşturabilirsiniz.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine org name: body > metadata > email
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const inviteCode = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const orgName = bodyOrgName
      || (userMetadata?.full_name ? String(userMetadata.full_name) : null)
      || (userEmail ? userEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ').trim() : null)
      || 'ISG Firması';

    console.log(`[setup-org] Creating org "${orgName}" for user ${userId}`);

    const { data: newOrg, error: orgError } = await adminClient
      .from('organizations')
      .insert({ name: orgName, invite_code: inviteCode, created_by: userId })
      .select()
      .maybeSingle();

    if (orgError || !newOrg) {
      console.error('[setup-org] Org insert failed:', orgError?.message);
      return new Response(JSON.stringify({ error: orgError?.message || 'Org creation failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: memberError } = await adminClient
      .from('user_organizations')
      .insert({
        user_id: userId,
        organization_id: newOrg.id,
        role: 'admin',
        email: userEmail,
        is_active: true,
        must_change_password: false,
      });

    if (memberError) {
      console.error('[setup-org] Member insert failed:', memberError.message);
      return new Response(JSON.stringify({ error: memberError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await adminClient.from('app_data').upsert(
      { organization_id: newOrg.id, data: {}, updated_at: new Date().toISOString() },
      { onConflict: 'organization_id' }
    );

    console.log(`[setup-org] Done! User ${userId} is admin of org ${newOrg.id}`);

    return new Response(JSON.stringify({
      organization: newOrg,
      role: 'admin',
      is_active: true,
      must_change_password: false,
      created: true,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[setup-org] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});