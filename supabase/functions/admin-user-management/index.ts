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

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Yetkisiz erişim.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Authenticate the user
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Yetkisiz erişim.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Parse request body
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const action = body.action as string;
  const requestedOrgId = body.organization_id as string | undefined;

  // Find caller's membership — use organization_id from request if provided
  let membershipQuery = adminClient
    .from('user_organizations')
    .select('role, organization_id, display_name, email')
    .eq('user_id', user.id);

  if (requestedOrgId) {
    membershipQuery = membershipQuery.eq('organization_id', requestedOrgId);
  }

  const { data: memberships, error: membershipError } = await membershipQuery;

  if (membershipError || !memberships || memberships.length === 0) {
    return new Response(JSON.stringify({ error: 'Organizasyon üyeliği bulunamadı.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const callerMembership = memberships[0];

  if (callerMembership.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Bu işlem için admin yetkisi gereklidir.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const orgId = callerMembership.organization_id;
  const callerName = callerMembership.display_name || user.email?.split('@')[0] || 'Admin';
  const callerEmail = callerMembership.email || user.email || '';

  // Helper: log activity (silent fail)
  async function logActivity(
    actionType: string,
    module: string,
    recordId: string,
    recordName?: string,
    description?: string,
  ) {
    try {
      await adminClient.from('activity_logs').insert({
        organization_id: orgId,
        user_id: user.id,
        user_email: callerEmail,
        user_name: callerName,
        user_role: 'admin',
        action_type: actionType,
        module,
        record_id: recordId,
        record_name: recordName ?? null,
        description: description ?? null,
      });
    } catch (_e) {
      // silent
    }
  }

  // ── LIST MEMBERS ──────────────────────────────────────────────
  if (action === 'list') {
    const { data: members, error: listError } = await adminClient
      .from('user_organizations')
      .select('user_id, role, is_active, must_change_password, display_name, email, joined_at')
      .eq('organization_id', orgId)
      .order('joined_at', { ascending: true });

    if (listError) {
      return new Response(JSON.stringify({ error: listError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Enrich with auth email if missing
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

  // ── CREATE USER ───────────────────────────────────────────────
  if (action === 'create') {
    const { email, password, display_name, role } = body as {
      email: string;
      password: string;
      display_name: string;
      role: string;
    };

    if (!email || !password || !display_name) {
      return new Response(
        JSON.stringify({ error: 'E-posta, şifre ve ad soyad zorunludur.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if auth user already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingAuthUser = existingUsers?.users?.find((u) => u.email === normalizedEmail);

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
        return new Response(
          JSON.stringify({ error: 'Bu e-posta zaten organizasyonunuzda kayıtlı.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      newUserId = existingAuthUser.id;
    } else {
      // Create new auth user
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name: display_name },
      });

      if (createError || !newUser?.user) {
        const errMsg = createError?.message ?? 'Kullanıcı oluşturulamadı.';
        return new Response(JSON.stringify({ error: errMsg }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      newUserId = newUser.user.id;
    }

    // Insert org membership
    const { error: memberError } = await adminClient.from('user_organizations').insert({
      user_id: newUserId,
      organization_id: orgId,
      role: role === 'admin' ? 'admin' : 'member',
      display_name,
      email: normalizedEmail,
      is_active: true,
      must_change_password: true,
    });

    if (memberError) {
      return new Response(JSON.stringify({ error: memberError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await logActivity(
      'user_created',
      'Kullanıcı Yönetimi',
      newUserId,
      display_name,
      `${display_name} (${normalizedEmail}) kullanıcısı ${role === 'admin' ? 'Admin' : 'Kullanıcı'} rolüyle oluşturuldu.`,
    );

    return new Response(JSON.stringify({ success: true, user_id: newUserId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── UPDATE MEMBER ─────────────────────────────────────────────
  if (action === 'update') {
    const { target_user_id, is_active, role, display_name } = body as {
      target_user_id: string;
      is_active?: boolean;
      role?: string;
      display_name?: string;
    };

    if (!target_user_id) {
      return new Response(JSON.stringify({ error: 'target_user_id zorunludur.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (target_user_id === user.id && is_active === false) {
      return new Response(
        JSON.stringify({ error: 'Kendi hesabınızı pasif yapamazsınız.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Check target is in this org
    const { data: targetCheck } = await adminClient
      .from('user_organizations')
      .select('display_name, email')
      .eq('user_id', target_user_id)
      .eq('organization_id', orgId)
      .maybeSingle();

    if (!targetCheck) {
      return new Response(
        JSON.stringify({ error: 'Hedef kullanıcı bu organizasyonda bulunamadı.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
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
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const memberName = targetCheck.display_name || targetCheck.email || target_user_id;
    if (is_active !== undefined) {
      await logActivity(
        is_active ? 'user_activated' : 'user_deactivated',
        'Kullanıcı Yönetimi',
        target_user_id,
        memberName,
        `${memberName} kullanıcısı ${is_active ? 'aktif' : 'pasif'} yapıldı.`,
      );
    }
    if (role !== undefined) {
      await logActivity(
        'user_role_changed',
        'Kullanıcı Yönetimi',
        target_user_id,
        memberName,
        `${memberName} kullanıcısının rolü ${role === 'admin' ? 'Admin' : 'Kullanıcı'} olarak değiştirildi.`,
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── DELETE MEMBER ─────────────────────────────────────────────
  if (action === 'delete') {
    const { target_user_id } = body as { target_user_id: string };

    if (!target_user_id) {
      return new Response(JSON.stringify({ error: 'target_user_id zorunludur.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (target_user_id === user.id) {
      return new Response(
        JSON.stringify({ error: 'Kendinizi silemezsiniz.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: targetCheck } = await adminClient
      .from('user_organizations')
      .select('display_name, email')
      .eq('user_id', target_user_id)
      .eq('organization_id', orgId)
      .maybeSingle();

    if (!targetCheck) {
      return new Response(
        JSON.stringify({ error: 'Hedef kullanıcı bu organizasyonda bulunamadı.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Remove from organization only (keep auth user)
    const { error: deleteError } = await adminClient
      .from('user_organizations')
      .delete()
      .eq('user_id', target_user_id)
      .eq('organization_id', orgId);

    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const memberName = targetCheck.display_name || targetCheck.email || target_user_id;
    await logActivity(
      'user_deleted',
      'Kullanıcı Yönetimi',
      target_user_id,
      memberName,
      `${memberName} kullanıcısı organizasyondan kaldırıldı.`,
    );

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Bilinmeyen işlem: ' + action }), {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
