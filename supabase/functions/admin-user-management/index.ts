import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  // Verify caller JWT
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  // Admin client (service role)
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verify caller is admin of their org
  const { data: callerMembership, error: membershipError } = await adminClient
    .from('user_organizations')
    .select('role, organization_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (membershipError || !callerMembership) {
    return new Response(JSON.stringify({ error: 'Organizasyon bulunamadı.' }), { status: 403, headers: corsHeaders });
  }

  if (callerMembership.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Bu işlem için admin yetkisi gereklidir.' }), { status: 403, headers: corsHeaders });
  }

  const orgId = callerMembership.organization_id;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const action = body.action as string;

  // ── LIST MEMBERS ──
  if (action === 'list') {
    const { data: members, error: listError } = await adminClient
      .from('user_organizations')
      .select('user_id, role, is_active, must_change_password, display_name, email, joined_at')
      .eq('organization_id', orgId)
      .order('joined_at', { ascending: true });

    if (listError) {
      return new Response(JSON.stringify({ error: listError.message }), { status: 400, headers: corsHeaders });
    }

    // Enrich with auth email if stored email is missing
    const enriched = await Promise.all((members ?? []).map(async (m) => {
      let email = m.email;
      if (!email) {
        try {
          const { data: authUser } = await adminClient.auth.admin.getUserById(m.user_id);
          email = authUser?.user?.email ?? '';
        } catch {
          email = '';
        }
      }
      return { ...m, email };
    }));

    return new Response(JSON.stringify({ members: enriched }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── CREATE USER ──
  if (action === 'create') {
    const { email, password, display_name, role } = body as {
      email: string;
      password: string;
      display_name: string;
      role: string;
    };

    if (!email || !password || !display_name) {
      return new Response(JSON.stringify({ error: 'E-posta, şifre ve ad soyad zorunludur.' }), { status: 400, headers: corsHeaders });
    }

    // Check if already member of any org
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingAuthUser = existingUsers?.users?.find(u => u.email === email.toLowerCase().trim());

    let newUserId: string;

    if (existingAuthUser) {
      // Check if already in this org
      const { data: alreadyMember } = await adminClient
        .from('user_organizations')
        .select('id')
        .eq('user_id', existingAuthUser.id)
        .eq('organization_id', orgId)
        .maybeSingle();

      if (alreadyMember) {
        return new Response(JSON.stringify({ error: 'Bu e-posta zaten organizasyonunuzda kayıtlı.' }), { status: 400, headers: corsHeaders });
      }
      newUserId = existingAuthUser.id;
    } else {
      // Create new auth user (skip email confirmation)
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: email.toLowerCase().trim(),
        password,
        email_confirm: true,
        user_metadata: { full_name: display_name },
      });

      if (createError || !newUser?.user) {
        return new Response(JSON.stringify({ error: createError?.message ?? 'Kullanıcı oluşturulamadı.' }), { status: 400, headers: corsHeaders });
      }
      newUserId = newUser.user.id;
    }

    // Add to organization
    const { error: memberError } = await adminClient
      .from('user_organizations')
      .insert({
        user_id: newUserId,
        organization_id: orgId,
        role: role === 'admin' ? 'admin' : 'member',
        display_name,
        email: email.toLowerCase().trim(),
        is_active: true,
        must_change_password: true,
      });

    if (memberError) {
      return new Response(JSON.stringify({ error: memberError.message }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true, user_id: newUserId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── UPDATE MEMBER ──
  if (action === 'update') {
    const { target_user_id, is_active, role, display_name } = body as {
      target_user_id: string;
      is_active?: boolean;
      role?: string;
      display_name?: string;
    };

    if (!target_user_id) {
      return new Response(JSON.stringify({ error: 'target_user_id zorunludur.' }), { status: 400, headers: corsHeaders });
    }

    // Prevent admin from deactivating themselves
    if (target_user_id === user.id && is_active === false) {
      return new Response(JSON.stringify({ error: 'Kendi hesabınızı pasif yapamazsınız.' }), { status: 400, headers: corsHeaders });
    }

    const updates: Record<string, unknown> = {};
    if (is_active !== undefined) updates.is_active = is_active;
    if (role !== undefined) updates.role = role === 'admin' ? 'admin' : 'member';
    if (display_name !== undefined) updates.display_name = display_name;

    const { error: updateError } = await adminClient
      .from('user_organizations')
      .update(updates)
      .eq('user_id', target_user_id)
      .eq('organization_id', orgId);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Bilinmeyen işlem.' }), { status: 400, headers: corsHeaders });
});
