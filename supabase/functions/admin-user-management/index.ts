import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS — sadece bilinen origin'lere izin ver
const ALLOWED_ORIGINS = [
  'https://readdy.ai',
  'https://app.readdy.ai',
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
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Vary': 'Origin',
  };
}

const VALID_ROLES = ['admin', 'denetci', 'member'];

function normalizeRole(role: string): string {
  if (VALID_ROLES.includes(role)) return role;
  return 'member';
}

// Decode JWT payload without verification (for logging/debugging)
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('[AUTH] Missing or invalid Authorization header');
    return new Response(JSON.stringify({ error: 'Yetkisiz erişim: Authorization header eksik.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  
  if (!token || token === 'undefined' || token === 'null' || token === '') {
    console.error('[AUTH] Token is empty or invalid string');
    return new Response(JSON.stringify({ error: 'Geçersiz token: Oturum süresi dolmuş olabilir. Lütfen tekrar giriş yapın.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Debug: decode JWT to check expiry
  const payload = decodeJwtPayload(token);
  if (payload) {
    const exp = payload.exp as number | undefined;
    const now = Math.floor(Date.now() / 1000);
    console.log('[AUTH] Token exp:', exp, 'now:', now, 'expired:', exp ? exp < now : 'unknown');
    if (exp && exp < now) {
      return new Response(JSON.stringify({ error: 'Oturum süresi dolmuş. Lütfen tekrar giriş yapın.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Use admin client to verify the token via getUser
  const { data: { user: callerUser }, error: authError } = await adminClient.auth.getUser(token);

  if (authError || !callerUser) {
    console.error('[AUTH] Token verification failed:', authError?.message, authError?.status);
    
    // Try with user client as fallback
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    
    const { data: { user: fallbackUser }, error: fallbackError } = await userClient.auth.getUser();
    
    if (fallbackError || !fallbackUser) {
      console.error('[AUTH] Fallback verification also failed:', fallbackError?.message);
      return new Response(JSON.stringify({ error: 'Geçersiz token. Lütfen tekrar giriş yapın.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('[AUTH] Fallback verification succeeded for user:', fallbackUser.id);
    return await handleRequest(req, fallbackUser.id, fallbackUser.email ?? '', adminClient, corsHeaders, normalizeRole);
  }

  console.log('[AUTH] Token verified for user:', callerUser.id);
  return await handleRequest(req, callerUser.id, callerUser.email ?? '', adminClient, corsHeaders, normalizeRole);
});

async function handleRequest(
  req: Request,
  userId: string,
  email: string,
  adminClient: ReturnType<typeof createClient>,
  corsHeaders: Record<string, string>,
  normalizeRole: (role: string) => string,
): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const action = body.action as string;
  const requestedOrgId = body.organization_id as string | undefined;

  let membershipQuery = adminClient
    .from('user_organizations')
    .select('role, organization_id, display_name, email, is_active')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (requestedOrgId) {
    membershipQuery = membershipQuery.eq('organization_id', requestedOrgId);
  }

  const { data: memberships, error: membershipError } = await membershipQuery;

  if (membershipError || !memberships || memberships.length === 0) {
    console.error('[MEMBERSHIP] Error or no memberships:', membershipError?.message, 'userId:', userId, 'orgId:', requestedOrgId);
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
  const callerName = callerMembership.display_name || email?.split('@')[0] || 'Admin';
  const callerEmail = callerMembership.email || email || '';

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
        user_id: userId,
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

    const enriched = await Promise.all((members ?? []).map(async (m) => {
      let memberEmail = m.email;
      if (!memberEmail) {
        try {
          const { data: authUser } = await adminClient.auth.admin.getUserById(m.user_id);
          memberEmail = authUser?.user?.email ?? '';
        } catch {
          memberEmail = '';
        }
      }
      return { ...m, email: memberEmail };
    }));

    return new Response(JSON.stringify({ members: enriched }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── CREATE USER ───────────────────────────────────────────────
  if (action === 'create') {
    console.log('[CREATE USER] Started');
    
    const { email: newEmail, password, display_name, role } = body as {
      email: string;
      password: string;
      display_name: string;
      role: string;
    };

    if (!newEmail || !password || !display_name) {
      return new Response(
        JSON.stringify({ error: 'E-posta, şifre ve ad soyad zorunludur.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Şifre en az 8 karakter olmalıdır.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const normalizedEmail = newEmail.toLowerCase().trim();

    const { data: existingUsers, error: listError } = await adminClient.auth.admin.listUsers();
    
    if (listError) {
      return new Response(
        JSON.stringify({ error: 'Kullanıcı listesi alınamadı: ' + listError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    
    const existingAuthUser = existingUsers?.users?.find((u) => u.email === normalizedEmail);

    let newUserId: string;

    if (existingAuthUser) {
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
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: { 
          full_name: display_name,
          admin_created: true,
          organization_id: orgId,
        },
      });

      if (createError) {
        console.error('[CREATE USER] Auth creation error:', createError.message);
        let errorMsg = 'Kullanıcı oluşturulamadı: ' + createError.message;
        if (createError.message.includes('Database error')) {
          errorMsg = 'Veritabanı hatası oluştu. Lütfen birkaç saniye bekleyip tekrar deneyin.';
        } else if (createError.message.includes('already registered') || createError.message.includes('already exists')) {
          errorMsg = 'Bu e-posta adresi zaten kayıtlı.';
        }
        return new Response(JSON.stringify({ error: errorMsg }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (!newUser?.user) {
        return new Response(JSON.stringify({ error: 'Kullanıcı oluşturulamadı: Auth servisi yanıt vermedi.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      newUserId = newUser.user.id;
      console.log('[CREATE USER] New auth user created with ID:', newUserId);
    }

    const { data: insertData, error: memberError } = await adminClient
      .from('user_organizations')
      .insert({
        user_id: newUserId,
        organization_id: orgId,
        role: normalizeRole(role),
        display_name,
        email: normalizedEmail,
        is_active: true,
        must_change_password: true,
      })
      .select()
      .single();

    if (memberError) {
      console.error('[CREATE USER] DB insert error:', memberError);
      return new Response(JSON.stringify({ 
        error: 'Kullanıcı veritabanına eklenemedi: ' + memberError.message,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[CREATE USER] DB insert successful:', insertData?.user_id);

    try {
      await adminClient
        .from('profiles')
        .upsert({
          user_id: newUserId,
          role: normalizeRole(role),
        }, { onConflict: 'user_id', ignoreDuplicates: true });
    } catch (profileErr) {
      console.warn('[CREATE USER] Profile upsert skipped:', profileErr);
    }

    const roleLabel = role === 'admin' ? 'Admin' : role === 'denetci' ? 'Denetçi' : 'Kullanıcı';
    await logActivity(
      'user_created',
      'Kullanıcı Yönetimi',
      newUserId,
      display_name,
      `${display_name} (${normalizedEmail}) kullanıcısı ${roleLabel} rolüyle oluşturuldu.`,
    );

    return new Response(JSON.stringify({ 
      success: true, 
      user_id: newUserId,
      message: 'Kullanıcı başarıyla oluşturuldu'
    }), {
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

    if (target_user_id === userId && is_active === false) {
      return new Response(
        JSON.stringify({ error: 'Kendi hesabınızı pasif yapamazsınız.' }),
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

    const updates: Record<string, unknown> = {};
    if (is_active !== undefined) updates.is_active = is_active;
    if (role !== undefined) updates.role = normalizeRole(role);
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
      const roleLabel = role === 'admin' ? 'Admin' : role === 'denetci' ? 'Denetçi' : 'Kullanıcı';
      await logActivity(
        'user_role_changed',
        'Kullanıcı Yönetimi',
        target_user_id,
        memberName,
        `${memberName} kullanıcısının rolü ${roleLabel} olarak değiştirildi.`,
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── RESET PASSWORD ────────────────────────────────────────────
  if (action === 'reset_password') {
    const { target_user_id, new_password } = body as {
      target_user_id: string;
      new_password: string;
    };

    if (!target_user_id || !new_password) {
      return new Response(JSON.stringify({ error: 'target_user_id ve new_password zorunludur.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (new_password.length < 8) {
      return new Response(JSON.stringify({ error: 'Şifre en az 8 karakter olmalıdır.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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

    const { error: pwError } = await adminClient.auth.admin.updateUserById(target_user_id, {
      password: new_password,
    });

    if (pwError) {
      return new Response(JSON.stringify({ error: pwError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await adminClient
      .from('user_organizations')
      .update({ must_change_password: true })
      .eq('user_id', target_user_id)
      .eq('organization_id', orgId);

    const memberName = targetCheck.display_name || targetCheck.email || target_user_id;
    await logActivity(
      'password_reset',
      'Kullanıcı Yönetimi',
      target_user_id,
      memberName,
      `${memberName} kullanıcısının şifresi admin tarafından sıfırlandı.`,
    );

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

    if (target_user_id === userId) {
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
}
