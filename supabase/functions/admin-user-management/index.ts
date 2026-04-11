import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function getCorsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  };
}

const VALID_ROLES      = ['admin', 'denetci', 'member', 'firma_user'] as const;
const VALID_OSGB_ROLES = ['osgb_admin', 'gezici_uzman', 'isyeri_hekimi'] as const;

const ACTIONS = {
  USER_CREATE    : 'USER_CREATE',
  USER_UPDATE    : 'USER_UPDATE',
  USER_DELETE    : 'USER_DELETE',
  USER_ACTIVATE  : 'USER_ACTIVATE',
  USER_DEACTIVATE: 'USER_DEACTIVATE',
  ROLE_CHANGE    : 'ROLE_CHANGE',
  PASSWORD_RESET : 'PASSWORD_RESET',
  FIRM_ASSIGN    : 'FIRM_ASSIGN',
  FIRM_UNASSIGN  : 'FIRM_UNASSIGN',
  FIRMS_BULK_UPDATE: 'FIRMS_BULK_UPDATE',
} as const;

type ActionKey = typeof ACTIONS[keyof typeof ACTIONS];
type Severity  = 'info' | 'warning' | 'critical';

function normalizeRole(role: string): string {
  return (VALID_ROLES as readonly string[]).includes(role) ? role : 'member';
}

function getRoleLabel(role: string, osgbRole?: string | null): string {
  if (osgbRole === 'osgb_admin')    return 'OSGB Admin';
  if (osgbRole === 'gezici_uzman')  return 'Gezici Uzman';
  if (osgbRole === 'isyeri_hekimi') return 'İşyeri Hekimi';
  if (role === 'admin')      return 'Admin Kullanıcı';
  if (role === 'denetci')    return 'Saha Personeli';
  if (role === 'firma_user') return 'Firma Yetkilisi';
  return 'Evrak/Dökümantasyon Denetçi';
}

function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    const exp = payload.exp as number | undefined;
    return exp ? exp < Math.floor(Date.now() / 1000) : false;
  } catch { return true; }
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

async function ensureProfileRecord(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  role: string,
): Promise<void> {
  try {
    const { data: existing } = await adminClient
      .from('profiles').select('id').eq('user_id', userId).maybeSingle();
    if (existing?.id) {
      await adminClient.from('profiles').update({ role: normalizeRole(role) }).eq('user_id', userId);
    } else {
      await adminClient.from('profiles').insert({
        user_id: userId, role: normalizeRole(role), tour_completed: false,
      });
    }
  } catch (err) { console.warn('[ensureProfileRecord]', err); }
}

Deno.serve(async (req) => {
  const origin      = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl        = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Sunucu yapılandırma hatası.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Yetkisiz erişim: Authorization header eksik.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token || token === 'undefined' || token === 'null') {
      return new Response(JSON.stringify({ error: 'Geçersiz token.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (isTokenExpired(token)) {
      return new Response(JSON.stringify({ error: 'Oturum süresi dolmuş. Lütfen tekrar giriş yapın.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user: callerUser }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !callerUser) {
      return new Response(JSON.stringify({ error: 'Geçersiz veya süresi dolmuş oturum.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clientIp        = req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? null;
    const clientUserAgent = req.headers.get('user-agent') ?? null;

    return await handleRequest(
      req, callerUser.id, callerUser.email ?? '',
      adminClient, corsHeaders, clientIp, clientUserAgent,
    );
  } catch (err) {
    console.error('[FATAL]', err);
    return new Response(JSON.stringify({ error: 'Sunucu hatası.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function handleRequest(
  req: Request,
  callerId: string,
  callerAuthEmail: string,
  adminClient: ReturnType<typeof createClient>,
  corsHeaders: Record<string, string>,
  clientIp: string | null,
  clientUserAgent: string | null,
): Promise<Response> {

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { body = {}; }

  const action = body.action as string;

  const { data: callerMemberships, error: membershipError } = await adminClient
    .from('user_organizations')
    .select('role, organization_id, display_name, email, is_active, osgb_role')
    .eq('user_id', callerId)
    .eq('is_active', true);

  if (membershipError) {
    return new Response(JSON.stringify({ error: 'Yetki sorgusu başarısız.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!callerMemberships || callerMemberships.length === 0) {
    return new Response(JSON.stringify({ error: 'Aktif organizasyon üyeliği bulunamadı.' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const hintOrgId = (body.organization_id as string | undefined)?.trim();

  let callerMembership =
    callerMemberships.find(m => m.osgb_role === 'osgb_admin') ??
    callerMemberships.find(m => m.role === 'admin') ??
    callerMemberships[0];

  if (hintOrgId) {
    const verified = callerMemberships.find(m => m.organization_id === hintOrgId);
    if (verified) callerMembership = verified;
  }

  if (callerMembership.is_active === false) {
    return new Response(JSON.stringify({ error: 'Hesabınız pasif durumda.' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const isAdmin     = callerMembership.role === 'admin';
  const isOsgbAdmin = callerMembership.osgb_role === 'osgb_admin';

  if (!isAdmin && !isOsgbAdmin) {
    return new Response(JSON.stringify({ error: 'Bu işlem için admin yetkisi gereklidir.' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const orgId       = callerMembership.organization_id as string;
  const callerName  = (callerMembership.display_name as string) || callerAuthEmail.split('@')[0] || 'Admin';
  const callerEmail = (callerMembership.email as string) || callerAuthEmail || '';

  async function logAction(params: {
    action    : ActionKey;
    targetId? : string;
    targetName?: string;
    description: string;
    metadata?  : Record<string, unknown>;
    severity?  : Severity;
    module?    : string;
  }) {
    try {
      const targetIdSafe = params.targetId && isUuid(params.targetId) ? params.targetId : null;
      await adminClient.from('activity_logs').insert({
        organization_id : orgId,
        user_id         : callerId,
        user_email      : callerEmail,
        user_name       : callerName,
        user_role       : isOsgbAdmin ? 'osgb_admin' : 'admin',
        action_type     : params.action,
        module          : params.module ?? 'Kullanıcı Yönetimi',
        record_id       : params.targetId ?? null,
        record_name     : params.targetName ?? null,
        description     : params.description,
        actor_id        : callerId,
        target_id       : targetIdSafe,
        metadata        : {
          ...(params.metadata ?? {}),
          actor_id: callerId, actor_name: callerName,
          actor_email: callerEmail, org_id: orgId,
          timestamp: new Date().toISOString(),
        },
        severity   : params.severity ?? 'info',
        ip_address : clientIp,
        user_agent : clientUserAgent,
        entity_type: params.module ?? 'Kullanıcı Yönetimi',
        entity_id  : params.targetId ?? null,
      });
    } catch (logErr) { console.warn('[LOG]', logErr); }
  }

  // ── LIST ──
  if (action === 'list') {
    const { data: members, error: listError } = await adminClient
      .from('user_organizations')
      .select('user_id, role, is_active, must_change_password, display_name, email, joined_at, firm_id, osgb_role, active_firm_id, active_firm_ids')
      .eq('organization_id', orgId)
      .order('joined_at', { ascending: true });

    if (listError) {
      return new Response(JSON.stringify({ error: listError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const enriched = await Promise.all((members ?? []).map(async (m) => {
      let memberEmail = m.email;
      if (!memberEmail) {
        try {
          const { data: au } = await adminClient.auth.admin.getUserById(m.user_id);
          memberEmail = au?.user?.email ?? '';
        } catch { memberEmail = ''; }
      }
      return { ...m, email: memberEmail };
    }));

    return new Response(JSON.stringify({ members: enriched }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── CREATE USER ──
  if (action === 'create') {
    const {
      email: newEmail, password, display_name, role, firm_id,
      osgb_role, active_firm_id, active_firm_ids,
    } = body as {
      email: string; password: string; display_name: string; role: string;
      firm_id?: string; osgb_role?: string;
      active_firm_id?: string | null; active_firm_ids?: string[] | null;
    };

    if (!newEmail || !password || !display_name) {
      return new Response(JSON.stringify({ error: 'E-posta, şifre ve ad soyad zorunludur.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (password.length < 8) {
      return new Response(JSON.stringify({ error: 'Şifre en az 8 karakter olmalıdır.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const normalizedEmail  = newEmail.toLowerCase().trim();
    const assignedRole     = normalizeRole(role ?? 'member');
    const assignedOsgbRole = osgb_role && (VALID_OSGB_ROLES as readonly string[]).includes(osgb_role) ? osgb_role : null;

    if (assignedRole === 'firma_user' && !firm_id) {
      return new Response(JSON.stringify({ error: 'Firma Yetkilisi rolü için firma seçimi zorunludur.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Gezici uzman veya işyeri hekimi için firma ataması zorunlu
    if ((assignedOsgbRole === 'gezici_uzman' || assignedOsgbRole === 'isyeri_hekimi') &&
        (!active_firm_ids || active_firm_ids.length === 0) && !active_firm_id) {
      return new Response(JSON.stringify({ error: `${assignedOsgbRole === 'isyeri_hekimi' ? 'İşyeri Hekimi' : 'Gezici Uzman'} için en az bir firma ataması zorunludur.` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: existingMember } = await adminClient
      .from('user_organizations').select('id')
      .eq('organization_id', orgId).eq('email', normalizedEmail).maybeSingle();

    if (existingMember) {
      return new Response(JSON.stringify({ error: 'Bu e-posta zaten organizasyonunuzda kayıtlı.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let newUserId: string;
    const { data: existingUsers } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    const existingAuthUser = existingUsers?.users?.find(u => u.email === normalizedEmail);

    if (existingAuthUser) {
      newUserId = existingAuthUser.id;
      try {
        await adminClient.auth.admin.updateUserById(newUserId, {
          user_metadata: {
            ...(existingAuthUser.user_metadata ?? {}),
            full_name: display_name, organization_id: orgId,
            role: assignedRole, admin_created: true,
            ...(assignedOsgbRole ? { osgb_role: assignedOsgbRole } : {}),
          },
        });
      } catch (e) { console.warn('[CREATE] metadata update skipped:', e); }
    } else {
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: normalizedEmail, password, email_confirm: true,
        user_metadata: {
          full_name: display_name, admin_created: true,
          organization_id: orgId, role: assignedRole,
          ...(assignedOsgbRole ? { osgb_role: assignedOsgbRole } : {}),
        },
      });
      if (createError) {
        const msg = createError.message;
        let errorMsg = 'Kullanıcı oluşturulamadı: ' + msg;
        if (msg.includes('already registered') || msg.includes('already exists')) errorMsg = 'Bu e-posta adresi zaten kayıtlı.';
        else if (msg.includes('Database error')) errorMsg = 'Veritabanı hatası. Lütfen tekrar deneyin.';
        else if (msg.includes('invalid')) errorMsg = 'Geçersiz e-posta adresi.';
        return new Response(JSON.stringify({ error: errorMsg }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!newUser?.user) {
        return new Response(JSON.stringify({ error: 'Kullanıcı oluşturulamadı.' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      newUserId = newUser.user.id;
    }

    const insertPayload: Record<string, unknown> = {
      user_id: newUserId, organization_id: orgId, role: assignedRole,
      display_name, email: normalizedEmail, is_active: true, must_change_password: true,
    };
    if (assignedRole === 'firma_user' && firm_id) insertPayload.firm_id = firm_id;
    if (assignedOsgbRole) insertPayload.osgb_role = assignedOsgbRole;

    // Gezici uzman VE işyeri hekimi için active_firm_ids ata
    if (assignedOsgbRole === 'gezici_uzman' || assignedOsgbRole === 'isyeri_hekimi') {
      if (active_firm_ids?.length) {
        insertPayload.active_firm_ids = active_firm_ids;
        insertPayload.active_firm_id  = active_firm_ids[0];
      } else if (active_firm_id) {
        insertPayload.active_firm_id  = active_firm_id;
        insertPayload.active_firm_ids = [active_firm_id];
      }
    }

    const { error: memberError } = await adminClient.from('user_organizations').insert(insertPayload);
    if (memberError) {
      // Üyelik eklenemedi — Auth'tan da silelim (orphan user oluşmasın)
      if (memberError.code === '23505') {
        return new Response(JSON.stringify({ error: 'Bu kullanıcı zaten organizasyonda kayıtlı.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // Yeni oluşturulan auth user'ı temizle
      if (!existingAuthUser) {
        try { await adminClient.auth.admin.deleteUser(newUserId); } catch { /* ignore */ }
      }
      return new Response(JSON.stringify({ error: 'Kullanıcı organizasyona eklenemedi: ' + memberError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await ensureProfileRecord(adminClient, newUserId, assignedRole);

    const roleLabel = getRoleLabel(assignedRole, assignedOsgbRole);
    await logAction({
      action: ACTIONS.USER_CREATE, targetId: newUserId, targetName: display_name,
      description: `${display_name} (${normalizedEmail}) kullanıcısı ${roleLabel} rolüyle oluşturuldu.`,
      metadata: { email: normalizedEmail, role: assignedRole, osgb_role: assignedOsgbRole, firm_id: firm_id ?? null },
      severity: 'info',
    });

    return new Response(JSON.stringify({ success: true, user_id: newUserId, message: 'Kullanıcı başarıyla oluşturuldu' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── ASSIGN FIRMS ──
  if (action === 'assign_firms') {
    const { firma_id, uzman_user_ids, eklenecek_user_ids, kaldirilacak_user_ids } = body as {
      firma_id: string; uzman_user_ids?: string[];
      eklenecek_user_ids?: string[]; kaldirilacak_user_ids?: string[];
    };

    if (!firma_id) {
      return new Response(JSON.stringify({ error: 'firma_id zorunludur.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    for (const uid of kaldirilacak_user_ids ?? []) {
      const { data: u } = await adminClient.from('user_organizations')
        .select('active_firm_id, active_firm_ids').eq('user_id', uid).eq('organization_id', orgId).maybeSingle();
      if (!u) continue;
      const curr: string[] = (u.active_firm_ids as string[] | null) ?? (u.active_firm_id ? [u.active_firm_id as string] : []);
      const next = curr.filter(id => id !== firma_id);
      await adminClient.from('user_organizations').update({
        active_firm_ids: next.length > 0 ? next : null, active_firm_id: next[0] ?? null,
      }).eq('user_id', uid).eq('organization_id', orgId);
    }

    for (const uid of eklenecek_user_ids ?? []) {
      const { data: u } = await adminClient.from('user_organizations')
        .select('active_firm_id, active_firm_ids').eq('user_id', uid).eq('organization_id', orgId).maybeSingle();
      if (!u) continue;
      const curr: string[] = (u.active_firm_ids as string[] | null) ?? (u.active_firm_id ? [u.active_firm_id as string] : []);
      const next = curr.includes(firma_id) ? curr : [...curr, firma_id];
      await adminClient.from('user_organizations').update({
        active_firm_ids: next, active_firm_id: next[0],
      }).eq('user_id', uid).eq('organization_id', orgId);
    }

    if (uzman_user_ids !== undefined) {
      const { data: all } = await adminClient.from('user_organizations')
        .select('user_id, active_firm_id, active_firm_ids')
        .eq('organization_id', orgId)
        .in('osgb_role', ['gezici_uzman', 'isyeri_hekimi']);

      for (const u of all ?? []) {
        const uid = u.user_id as string;
        const curr: string[] = (u.active_firm_ids as string[] | null) ?? (u.active_firm_id ? [u.active_firm_id as string] : []);
        const should = uzman_user_ids.includes(uid);
        const has    = curr.includes(firma_id);
        if (should && !has) {
          const next = [...curr, firma_id];
          await adminClient.from('user_organizations').update({ active_firm_ids: next, active_firm_id: next[0] })
            .eq('user_id', uid).eq('organization_id', orgId);
        } else if (!should && has) {
          const next = curr.filter(id => id !== firma_id);
          await adminClient.from('user_organizations').update({
            active_firm_ids: next.length > 0 ? next : null, active_firm_id: next[0] ?? null,
          }).eq('user_id', uid).eq('organization_id', orgId);
        }
      }
    }

    await logAction({
      action: ACTIONS.FIRMS_BULK_UPDATE, module: 'Uzman Yönetimi', targetId: firma_id,
      description: 'Firma uzman/hekim atamaları güncellendi.',
      metadata: { firma_id, eklenecek_count: (eklenecek_user_ids ?? []).length, kaldirilacak_count: (kaldirilacak_user_ids ?? []).length },
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── LEGACY ASSIGN FIRM ──
  if (action === 'assign_firm') {
    const { firma_id, uzman_user_id } = body as { firma_id: string; uzman_user_id: string | null };

    if (!firma_id) {
      return new Response(JSON.stringify({ error: 'firma_id zorunludur.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await adminClient.from('user_organizations')
      .update({ active_firm_id: null }).eq('organization_id', orgId).eq('active_firm_id', firma_id);

    if (uzman_user_id) {
      const { data: uzmanCheck } = await adminClient.from('user_organizations')
        .select('id, display_name, email').eq('user_id', uzman_user_id).eq('organization_id', orgId).maybeSingle();

      if (!uzmanCheck) {
        return new Response(JSON.stringify({ error: 'Hedef uzman bu organizasyonda bulunamadı.' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: assignErr } = await adminClient.from('user_organizations')
        .update({ active_firm_id: firma_id }).eq('organization_id', orgId).eq('user_id', uzman_user_id);

      if (assignErr) {
        return new Response(JSON.stringify({ error: 'Uzman ataması yapılamadı: ' + assignErr.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const uzmanName = (uzmanCheck.display_name as string) || (uzmanCheck.email as string) || uzman_user_id;
      await logAction({
        action: ACTIONS.FIRM_ASSIGN, module: 'Uzman Yönetimi', targetId: uzman_user_id, targetName: uzmanName,
        description: `${uzmanName} kullanıcısı firmaya atandı.`,
        metadata: { firma_id, uzman_name: uzmanName },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── UPDATE MEMBER ──
  if (action === 'update') {
    const { target_user_id, is_active, role, display_name, osgb_role, active_firm_id, active_firm_ids } = body as {
      target_user_id: string; is_active?: boolean; role?: string; display_name?: string;
      osgb_role?: string; active_firm_id?: string | null; active_firm_ids?: string[] | null;
    };

    if (!target_user_id) {
      return new Response(JSON.stringify({ error: 'target_user_id zorunludur.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (target_user_id === callerId) {
      if (is_active === false) return new Response(JSON.stringify({ error: 'Kendi hesabınızı pasif yapamazsınız.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (role !== undefined && role !== 'admin' && isAdmin) return new Response(JSON.stringify({ error: 'Kendi admin rolünüzü kaldıramazsınız.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: target } = await adminClient.from('user_organizations')
      .select('display_name, email, role, osgb_role, is_active').eq('user_id', target_user_id).eq('organization_id', orgId).maybeSingle();

    if (!target) {
      return new Response(JSON.stringify({ error: 'Hedef kullanıcı bu organizasyonda bulunamadı.' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const updates: Record<string, unknown> = {};
    if (is_active       !== undefined) updates.is_active       = is_active;
    if (role            !== undefined) updates.role            = normalizeRole(role);
    if (display_name    !== undefined) updates.display_name    = display_name;
    if (osgb_role       !== undefined) updates.osgb_role       = (VALID_OSGB_ROLES as readonly string[]).includes(osgb_role) ? osgb_role : null;
    if (active_firm_id  !== undefined) updates.active_firm_id  = active_firm_id;
    if (active_firm_ids !== undefined) updates.active_firm_ids = active_firm_ids;

    const { error: updateError } = await adminClient.from('user_organizations')
      .update(updates).eq('user_id', target_user_id).eq('organization_id', orgId);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (role !== undefined) {
      try {
        const { data: au } = await adminClient.auth.admin.getUserById(target_user_id);
        if (au?.user) {
          await adminClient.auth.admin.updateUserById(target_user_id, {
            user_metadata: { ...(au.user.user_metadata ?? {}), role: normalizeRole(role) },
          });
        }
      } catch (e) { console.warn('[UPDATE] metadata role update skipped:', e); }
    }

    const targetName = (target.display_name as string) || (target.email as string) || target_user_id;
    if (is_active !== undefined) {
      await logAction({
        action: is_active ? ACTIONS.USER_ACTIVATE : ACTIONS.USER_DEACTIVATE,
        targetId: target_user_id, targetName,
        description: `${targetName} kullanıcısı ${is_active ? 'aktif' : 'pasif'} yapıldı.`,
        metadata: { email: target.email, previous_status: target.is_active, new_status: is_active },
        severity: is_active ? 'info' : 'warning',
      });
    }
    if (active_firm_ids !== undefined || active_firm_id !== undefined) {
      await logAction({
        action: ACTIONS.FIRM_ASSIGN, targetId: target_user_id, targetName,
        description: `${targetName} kullanıcısına firma ataması güncellendi.`,
        metadata: { email: target.email, active_firm_ids, active_firm_id },
      });
    }
    if (role !== undefined) {
      await logAction({
        action: ACTIONS.ROLE_CHANGE, targetId: target_user_id, targetName,
        description: `${targetName} kullanıcısının rolü güncellendi.`,
        metadata: { email: target.email, previous_role: target.role, new_role: normalizeRole(role), previous_osgb: target.osgb_role },
        severity: 'warning',
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── RESET PASSWORD ──
  if (action === 'reset_password') {
    const { target_user_id, new_password } = body as { target_user_id: string; new_password: string };

    if (!target_user_id || !new_password) {
      return new Response(JSON.stringify({ error: 'target_user_id ve new_password zorunludur.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (new_password.length < 8) {
      return new Response(JSON.stringify({ error: 'Şifre en az 8 karakter olmalıdır.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: target } = await adminClient.from('user_organizations')
      .select('display_name, email, role, osgb_role').eq('user_id', target_user_id).eq('organization_id', orgId).maybeSingle();

    if (!target) {
      return new Response(JSON.stringify({ error: 'Hedef kullanıcı bu organizasyonda bulunamadı.' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: pwError } = await adminClient.auth.admin.updateUserById(target_user_id, { password: new_password });
    if (pwError) {
      return new Response(JSON.stringify({ error: pwError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await adminClient.from('user_organizations').update({ must_change_password: true })
      .eq('user_id', target_user_id).eq('organization_id', orgId);

    const targetName = (target.display_name as string) || (target.email as string) || target_user_id;
    await logAction({
      action: ACTIONS.PASSWORD_RESET, targetId: target_user_id, targetName,
      description: `${targetName} kullanıcısının şifresi sıfırlandı.`,
      metadata: { email: target.email, role: target.role, osgb_role: target.osgb_role },
      severity: 'warning',
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── DELETE MEMBER ──
  if (action === 'delete') {
    const { target_user_id } = body as { target_user_id: string };

    if (!target_user_id) return new Response(JSON.stringify({ error: 'target_user_id zorunludur.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (target_user_id === callerId) return new Response(JSON.stringify({ error: 'Kendinizi silemezsiniz.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: target } = await adminClient.from('user_organizations')
      .select('display_name, email, role, osgb_role').eq('user_id', target_user_id).eq('organization_id', orgId).maybeSingle();

    if (!target) {
      return new Response(JSON.stringify({ error: 'Hedef kullanıcı bu organizasyonda bulunamadı.' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Önce log yaz (silmeden önce)
    const targetName = (target.display_name as string) || (target.email as string) || target_user_id;
    await logAction({
      action: ACTIONS.USER_DELETE, targetId: target_user_id, targetName,
      description: `${targetName} kullanıcısı organizasyondan kaldırıldı.`,
      metadata: { email: target.email, role: target.role, osgb_role: target.osgb_role },
      severity: 'critical',
    });

    // user_organizations kaydını sil
    const { error: deleteError } = await adminClient.from('user_organizations')
      .delete().eq('user_id', target_user_id).eq('organization_id', orgId);

    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Başka aktif org üyeliği var mı kontrol et
    const { data: others } = await adminClient.from('user_organizations')
      .select('organization_id').eq('user_id', target_user_id).limit(1);

    const hadOtherOrgs = (others?.length ?? 0) > 0;

    // Başka org yoksa Auth'tan da sil
    if (!hadOtherOrgs) {
      try {
        const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(target_user_id);
        if (authDeleteError) {
          console.error('[DELETE] Auth delete error:', authDeleteError.message);
          // Auth silme başarısız olsa bile user_organizations zaten silindi — devam et
        } else {
          console.log('[DELETE] Auth user deleted:', target_user_id);
        }
      } catch (e) {
        console.error('[DELETE] Auth delete exception:', e);
      }
    } else {
      console.log('[DELETE] User has other orgs, keeping auth account:', target_user_id, 'orgs remaining:', others?.length);
    }

    return new Response(JSON.stringify({ 
      success: true,
      auth_deleted: !hadOtherOrgs,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Bilinmeyen işlem: ' + action }), {
    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
