import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS — tüm originlere izin ver (JWT manuel doğrulanıyor)
function getCorsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  };
}

const VALID_ROLES = ['admin', 'denetci', 'member', 'firma_user'];

function normalizeRole(role: string): string {
  if (VALID_ROLES.includes(role)) return role;
  return 'member';
}

function getRoleLabel(role: string): string {
  if (role === 'admin') return 'Admin Kullanıcı';
  if (role === 'denetci') return 'Saha Personeli';
  if (role === 'firma_user') return 'Firma Yetkilisi';
  return 'Evrak/Dökümantasyon Denetçi';
}

// Decode JWT payload without verification
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

// Kullanıcı için profiles kaydı oluştur veya güncelle (tour_completed korunur)
async function ensureProfileRecord(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  role: string,
): Promise<void> {
  try {
    const { data: existing } = await adminClient
      .from('profiles')
      .select('id, tour_completed')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing?.id) {
      // Kayıt var — sadece role güncelle, tour_completed'a dokunma
      await adminClient
        .from('profiles')
        .update({ role: normalizeRole(role) })
        .eq('user_id', userId);
    } else {
      // Kayıt yok — yeni oluştur, tour_completed false
      await adminClient
        .from('profiles')
        .insert({ user_id: userId, role: normalizeRole(role), tour_completed: false });
    }
  } catch (err) {
    console.warn('[ensureProfileRecord] Failed:', err);
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Sunucu yapılandırma hatası.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Yetkisiz erişim: Authorization header eksik.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '').trim();

    if (!token || token === 'undefined' || token === 'null' || token === '') {
      return new Response(JSON.stringify({ error: 'Geçersiz token. Lütfen tekrar giriş yapın.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = decodeJwtPayload(token);
    if (payload) {
      const exp = payload.exp as number | undefined;
      const now = Math.floor(Date.now() / 1000);
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

    const { data: { user: callerUser }, error: authError } = await adminClient.auth.getUser(token);

    if (authError || !callerUser) {
      return new Response(JSON.stringify({ error: 'Geçersiz oturum. Lütfen tekrar giriş yapın.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return await handleRequest(req, callerUser.id, callerUser.email ?? '', adminClient, corsHeaders, normalizeRole, getRoleLabel);
  } catch (err) {
    console.error('[FATAL] Unhandled error:', err);
    return new Response(JSON.stringify({ error: 'Sunucu hatası oluştu. Lütfen tekrar deneyin.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function handleRequest(
  req: Request,
  userId: string,
  email: string,
  adminClient: ReturnType<typeof createClient>,
  corsHeaders: Record<string, string>,
  normalizeRole: (role: string) => string,
  getRoleLabel: (role: string) => string,
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

  // ── LIST MEMBERS ──
  if (action === 'list') {
    const { data: members, error: listError } = await adminClient
      .from('user_organizations')
      .select('user_id, role, is_active, must_change_password, display_name, email, joined_at, firm_id')
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

  // ── CREATE USER ──
  if (action === 'create') {
    const { email: newEmail, password, display_name, role, firm_id } = body as {
      email: string;
      password: string;
      display_name: string;
      role: string;
      firm_id?: string;
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
    const assignedRole = normalizeRole(role);

    // firma_user için firm_id zorunlu
    if (assignedRole === 'firma_user' && !firm_id) {
      return new Response(
        JSON.stringify({ error: 'Firma Yetkilisi rolü için firma seçimi zorunludur.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: existingMember } = await adminClient
      .from('user_organizations')
      .select('id')
      .eq('organization_id', orgId)
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingMember) {
      return new Response(
        JSON.stringify({ error: 'Bu e-posta zaten organizasyonunuzda kayıtlı.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let newUserId: string;

    const { data: existingUsers, error: listError } = await adminClient.auth.admin.listUsers({ perPage: 1000 });

    if (listError) {
      console.error('[CREATE] listUsers error:', listError.message);
    }

    const existingAuthUser = existingUsers?.users?.find((u) => u.email === normalizedEmail);

    if (existingAuthUser) {
      newUserId = existingAuthUser.id;

      try {
        await adminClient.auth.admin.updateUserById(newUserId, {
          user_metadata: {
            ...(existingAuthUser.user_metadata ?? {}),
            full_name: display_name,
            organization_id: orgId,
            role: assignedRole,
            admin_created: true,
          },
        });
      } catch (e) {
        console.warn('[CREATE] Could not update existing user metadata:', e);
      }
    } else {
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: display_name,
          admin_created: true,
          organization_id: orgId,
          role: assignedRole,
        },
      });

      if (createError) {
        let errorMsg = 'Kullanıcı oluşturulamadı.';
        if (createError.message.includes('already registered') || createError.message.includes('already exists')) {
          errorMsg = 'Bu e-posta adresi zaten kayıtlı.';
        } else if (createError.message.includes('Database error')) {
          errorMsg = 'Veritabanı hatası. Lütfen birkaç saniye bekleyip tekrar deneyin.';
        } else if (createError.message.includes('invalid')) {
          errorMsg = 'Geçersiz e-posta adresi.';
        } else {
          errorMsg = 'Kullanıcı oluşturulamadı: ' + createError.message;
        }
        return new Response(JSON.stringify({ error: errorMsg }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!newUser?.user) {
        return new Response(JSON.stringify({ error: 'Kullanıcı oluşturulamadı: Servis yanıt vermedi.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      newUserId = newUser.user.id;
    }

    // user_organizations INSERT — firma_user için firm_id de kaydediliyor
    const insertPayload: Record<string, unknown> = {
      user_id: newUserId,
      organization_id: orgId,
      role: assignedRole,
      display_name,
      email: normalizedEmail,
      is_active: true,
      must_change_password: true,
    };

    if (assignedRole === 'firma_user' && firm_id) {
      insertPayload.firm_id = firm_id;
    }

    const { error: memberError } = await adminClient
      .from('user_organizations')
      .insert(insertPayload);

    if (memberError) {
      if (memberError.code === '23505') {
        return new Response(JSON.stringify({ error: 'Bu kullanıcı zaten organizasyonda kayıtlı.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({
        error: 'Kullanıcı organizasyona eklenemedi: ' + memberError.message,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await ensureProfileRecord(adminClient, newUserId, assignedRole);

    const roleLabel = getRoleLabel(assignedRole);
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
      message: 'Kullanıcı başarıyla oluşturuldu',
    }), {
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

    if (role !== undefined) {
      try {
        const { data: authUserData } = await adminClient.auth.admin.getUserById(target_user_id);
        if (authUserData?.user) {
          await adminClient.auth.admin.updateUserById(target_user_id, {
            user_metadata: {
              ...(authUserData.user.user_metadata ?? {}),
              role: normalizeRole(role),
            },
          });
        }
      } catch (e) {
        console.warn('[UPDATE] Could not update user metadata role:', e);
      }
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
      const roleLabel = getRoleLabel(normalizeRole(role));
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

  // ── RESET PASSWORD ──
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

  // ── DELETE MEMBER ──
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

    const { data: otherMemberships } = await adminClient
      .from('user_organizations')
      .select('organization_id')
      .eq('user_id', target_user_id)
      .limit(1);

    if (!otherMemberships || otherMemberships.length === 0) {
      try {
        const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(target_user_id);
        if (authDeleteError) {
          const errMsg = authDeleteError.message?.toLowerCase() ?? '';
          if (!errMsg.includes('not found') && !errMsg.includes('does not exist')) {
            console.error('[DELETE] Auth delete failed:', authDeleteError.message);
          }
        }
      } catch (authErr) {
        console.error('[DELETE] Auth delete exception:', authErr);
      }
    }

    const memberName = targetCheck.display_name || targetCheck.email || target_user_id;
    await logActivity(
      'user_deleted',
      'Kullanıcı Yönetimi',
      target_user_id,
      memberName,
      `${memberName} kullanıcısı organizasyondan kaldırıldı ve hesabı silindi.`,
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
