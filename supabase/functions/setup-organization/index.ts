import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function getCorsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

async function ensureProfileRecord(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  role?: string,
): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from('profiles')
      .select('id, tour_completed')
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing?.id) {
      await supabase
        .from('profiles')
        .insert({ user_id: userId, tour_completed: false, ...(role ? { role } : {}) });
    } else if (role) {
      await supabase
        .from('profiles')
        .update({ role })
        .eq('user_id', userId);
    }
  } catch (err) {
    console.warn('[ensureProfileRecord] Failed:', err);
  }
}

/**
 * Idempotent RLS policy bootstrap — migration bağımlılığını sıfırlar.
 * Yeni kurulumda veya güncellenen üyeliklerde arka planda çalışır.
 * DO $$ IF NOT EXISTS $$ — mevcut policy varsa sessizce geçer.
 *
 * Politikalar:
 * 1. firmalar tablosu — gezici uzman SELECT (can_access_org)
 * 2. activity_logs INSERT — gezici uzman (can_access_org)
 */
async function bootstrapRlsPolicies(supabase: ReturnType<typeof createClient>): Promise<void> {
  const queries = [
    // ── firmalar: gezici uzman SELECT ──────────────────────────────────
    `DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'firmalar'
      AND policyname = 'firmalar_gezici_uzman_select'
  ) THEN
    CREATE POLICY firmalar_gezici_uzman_select
      ON public.firmalar
      FOR SELECT
      USING (can_access_org(organization_id));
    RAISE NOTICE '[RLS Bootstrap] firmalar_gezici_uzman_select created';
  END IF;
END $do$;`,

    // ── activity_logs: gezici uzman INSERT (can_access_org) ─────────────
    `DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'activity_logs'
      AND policyname = 'activity_logs_gezici_uzman_insert'
  ) THEN
    CREATE POLICY activity_logs_gezici_uzman_insert
      ON public.activity_logs
      FOR INSERT
      WITH CHECK (can_access_org(organization_id));
    RAISE NOTICE '[RLS Bootstrap] activity_logs_gezici_uzman_insert created';
  END IF;
END $do$;`,
  ];

  for (const sql of queries) {
    try {
      // Service role client ile direkt SQL çalıştır
      const { error } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => { error: { message: string } | null } })
        .rpc('exec_sql_ddl', { sql_query: sql });
      if (error) {
        // RPC yoksa skip — migration.sql ile manuel yapılabilir
        console.warn('[setup-org bootstrap] exec_sql_ddl not available:', error.message);
      }
    } catch (e) {
      console.warn('[setup-org bootstrap] policy bootstrap skipped (RPC unavailable):', e);
    }
  }
}

const VALID_ROLES = ['admin', 'denetci', 'member'];

function normalizeRole(role: unknown): string {
  if (typeof role === 'string' && VALID_ROLES.includes(role)) return role;
  return 'admin';
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user: authUser }, error: authError } = await userClient.auth.getUser();

  if (authError || !authUser) {
    return new Response(JSON.stringify({ error: 'Invalid token', details: authError?.message }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userId = authUser.id;

  // ── Handle clear_must_change_password action ──
  let requestBody: Record<string, unknown> = {};
  try {
    const text = await req.text();
    if (text) requestBody = JSON.parse(text) as Record<string, unknown>;
  } catch { /* ignore */ }

  if (requestBody.action === 'clear_must_change_password') {
    const { error: updateError } = await supabase
      .from('user_organizations')
      .update({ must_change_password: false })
      .eq('user_id', userId)
      .eq('is_active', true);

    if (updateError) {
      console.error('[setup-org] clear_must_change_password failed:', updateError.message);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let resolvedEmail = authUser.email ?? '';
  let resolvedDisplayName = '';
  let metaOrgId = '';
  let metaRole = '';
  let metaOsgbRole = '';
  let metaActiveFirmIds: string[] = [];

  try {
    const { data: adminUserData } = await supabase.auth.admin.getUserById(userId);
    if (adminUserData?.user) {
      resolvedEmail = adminUserData.user.email ?? resolvedEmail;
      const meta = adminUserData.user.user_metadata ?? {};
      resolvedDisplayName = (meta.full_name as string) || (meta.name as string) || '';
      metaOrgId = (meta.organization_id as string) || '';
      metaRole = (meta.role as string) || '';
      metaOsgbRole = (meta.osgb_role as string) || '';
      const rawFirmIds = meta.active_firm_ids;
      if (Array.isArray(rawFirmIds)) {
        metaActiveFirmIds = rawFirmIds.filter((id): id is string => typeof id === 'string' && id.length > 0);
      }
    }
  } catch (e) {
    console.warn('[setup-org] Could not fetch full auth user:', e);
    const meta = authUser.user_metadata ?? {};
    resolvedDisplayName = (meta.full_name as string) || (meta.name as string) || '';
    metaOrgId = (meta.organization_id as string) || '';
    metaRole = (meta.role as string) || '';
    metaOsgbRole = (meta.osgb_role as string) || '';
    const rawFirmIds = meta.active_firm_ids;
    if (Array.isArray(rawFirmIds)) {
      metaActiveFirmIds = rawFirmIds.filter((id): id is string => typeof id === 'string' && id.length > 0);
    }
  }

  if (!resolvedDisplayName && resolvedEmail) {
    resolvedDisplayName = resolvedEmail
      .split('@')[0]
      .replace(/[._-]/g, ' ')
      .replace(/\b\w/g, (c: string) => c.toUpperCase())
      .trim() || 'Kullanıcı';
  }
  if (!resolvedDisplayName) resolvedDisplayName = 'Kullanıcı';

  const user = { id: userId, email: resolvedEmail, display_name: resolvedDisplayName };

  try {
    // ── Check for existing active membership ──
    const { data: existingMembership } = await supabase
      .from('user_organizations')
      .select('organization_id, role, is_active, must_change_password, display_name, email, kvkk_accepted, osgb_role, active_firm_ids, organizations(id, name, invite_code, org_type)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('joined_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingMembership?.organizations) {
      const org = existingMembership.organizations as { id: string; name: string; invite_code: string; org_type?: string };

      const needsUpdate =
        (!existingMembership.display_name && user.display_name) ||
        (!existingMembership.email && user.email);

      if (needsUpdate) {
        await supabase
          .from('user_organizations')
          .update({
            ...((!existingMembership.display_name && user.display_name) ? { display_name: user.display_name } : {}),
            ...((!existingMembership.email && user.email) ? { email: user.email } : {}),
          })
          .eq('user_id', user.id)
          .eq('organization_id', org.id);
      }

      await ensureProfileRecord(supabase, user.id);

      // ── Arka planda idempotent RLS policy bootstrap ──
      // Migration bağımlılığını sıfırlamak için — her login'de kontrol edilir
      bootstrapRlsPolicies(supabase).catch(e =>
        console.warn('[setup-org] bootstrapRlsPolicies silently failed:', e)
      );

      return new Response(JSON.stringify({
        organization: org,
        role: existingMembership.role ?? 'admin',
        is_active: existingMembership.is_active,
        must_change_password: existingMembership.must_change_password,
        kvkk_accepted: existingMembership.kvkk_accepted === true,
        display_name: existingMembership.display_name || user.display_name,
        email: existingMembership.email || user.email,
        osgb_role: existingMembership.osgb_role ?? null,
        active_firm_ids: existingMembership.active_firm_ids ?? [],
        created: false,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── No active org found — check metadata for pre-assigned org ──
    if (metaOrgId) {
      const { data: targetOrg } = await supabase
        .from('organizations')
        .select('id, name, invite_code, org_type')
        .eq('id', metaOrgId)
        .maybeSingle();

      if (targetOrg) {
        const assignedRole = normalizeRole(metaRole || 'member');
        const assignedOsgbRole = metaOsgbRole || null;
        const assignedFirmIds = metaActiveFirmIds.length > 0 ? metaActiveFirmIds : null;

        const { data: inactiveMembership } = await supabase
          .from('user_organizations')
          .select('id')
          .eq('user_id', user.id)
          .eq('organization_id', metaOrgId)
          .maybeSingle();

        const osgbPayload = assignedOsgbRole ? { osgb_role: assignedOsgbRole } : {};
        const firmIdsPayload = assignedFirmIds ? { active_firm_ids: assignedFirmIds } : {};

        if (inactiveMembership) {
          await supabase
            .from('user_organizations')
            .update({
              is_active: true,
              role: assignedRole,
              display_name: user.display_name,
              email: user.email,
              ...osgbPayload,
              ...firmIdsPayload,
            })
            .eq('user_id', user.id)
            .eq('organization_id', metaOrgId);
        } else {
          const { error: memberError } = await supabase
            .from('user_organizations')
            .insert({
              user_id: user.id,
              organization_id: metaOrgId,
              role: assignedRole,
              display_name: user.display_name,
              email: user.email,
              is_active: true,
              must_change_password: true,
              kvkk_accepted: false,
              ...osgbPayload,
              ...firmIdsPayload,
            });

          if (memberError && memberError.code !== '23505') {
            console.error('[setup-org] Member insert to existing org failed:', memberError.message);
          }
        }

        await ensureProfileRecord(supabase, user.id, assignedRole);

        try {
          const { data: currentUser } = await supabase.auth.admin.getUserById(user.id);
          const currentMeta = currentUser?.user?.user_metadata ?? {};
          await supabase.auth.admin.updateUserById(user.id, {
            user_metadata: {
              ...currentMeta,
              organization_id: null,
              role: null,
              osgb_role: null,
              active_firm_ids: null,
            },
          });
        } catch (e) {
          console.warn('[setup-org] Could not clear metadata:', e);
        }

        // Bootstrap yeni atama için de çalıştır
        bootstrapRlsPolicies(supabase).catch(e =>
          console.warn('[setup-org] bootstrapRlsPolicies (assign) silently failed:', e)
        );

        return new Response(JSON.stringify({
          organization: targetOrg,
          role: assignedRole,
          is_active: true,
          must_change_password: true,
          kvkk_accepted: false,
          display_name: user.display_name,
          email: user.email,
          osgb_role: assignedOsgbRole,
          active_firm_ids: assignedFirmIds ?? [],
          created: false,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ── No org found — create one automatically ──
    const orgName = user.display_name !== 'Kullanıcı'
      ? user.display_name
      : user.email
        ? user.email.split('@')[0].replace(/[^a-zA-Z0-9\s]/g, ' ').trim() || 'ISG Firması'
        : 'ISG Firması';

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const inviteCode = Array.from(
      { length: 6 },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join('');

    const { data: newOrg, error: orgError } = await supabase
      .from('organizations')
      .insert({ name: orgName, invite_code: inviteCode, created_by: user.id, org_type: 'firma' })
      .select()
      .maybeSingle();

    if (orgError || !newOrg) {
      return new Response(JSON.stringify({ error: orgError?.message || 'Org creation failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: memberError } = await supabase
      .from('user_organizations')
      .insert({
        user_id: user.id,
        organization_id: newOrg.id,
        role: 'admin',
        display_name: user.display_name,
        email: user.email,
        is_active: true,
        must_change_password: false,
        kvkk_accepted: true,
      });

    if (memberError) {
      if (memberError.code === '23505') {
        const { data: retryMembership } = await supabase
          .from('user_organizations')
          .select('organization_id, role, is_active, must_change_password, display_name, email, kvkk_accepted, osgb_role, active_firm_ids, organizations(id, name, invite_code, org_type)')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('joined_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (retryMembership?.organizations) {
          const org = retryMembership.organizations as { id: string; name: string; invite_code: string; org_type?: string };
          await ensureProfileRecord(supabase, user.id);
          return new Response(JSON.stringify({
            organization: org,
            role: retryMembership.role ?? 'admin',
            is_active: retryMembership.is_active,
            must_change_password: retryMembership.must_change_password,
            kvkk_accepted: retryMembership.kvkk_accepted === true,
            display_name: retryMembership.display_name || user.display_name,
            email: retryMembership.email || user.email,
            osgb_role: retryMembership.osgb_role ?? null,
            active_firm_ids: retryMembership.active_firm_ids ?? [],
            created: false,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      return new Response(JSON.stringify({ error: memberError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await ensureProfileRecord(supabase, user.id);

    await supabase
      .from('app_data')
      .upsert(
        { organization_id: newOrg.id, data: {}, updated_at: new Date().toISOString() },
        { onConflict: 'organization_id' }
      );

    await supabase.from('activity_logs').insert({
      organization_id: newOrg.id,
      user_id: user.id,
      user_email: user.email,
      user_name: user.display_name,
      user_role: 'admin',
      action_type: 'org_auto_created',
      module: 'Sistem',
      record_id: newOrg.id,
      record_name: orgName,
      description: `Organizasyon otomatik oluşturuldu: ${orgName}`,
    }).catch(() => { /* silent */ });

    // ── Yeni org için de bootstrap çalıştır ──
    bootstrapRlsPolicies(supabase).catch(e =>
      console.warn('[setup-org] bootstrapRlsPolicies (new org) silently failed:', e)
    );

    return new Response(JSON.stringify({
      organization: { ...newOrg, org_type: 'firma' },
      role: 'admin',
      is_active: true,
      must_change_password: false,
      kvkk_accepted: true,
      display_name: user.display_name,
      email: user.email,
      osgb_role: null,
      active_firm_ids: [],
      created: true,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[setup-org] Unhandled error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
