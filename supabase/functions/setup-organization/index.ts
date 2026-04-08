import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS — tüm origin'lere izin ver (preview URL'leri için)
function getCorsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

// Kullanıcı için profiles kaydı oluştur (yoksa) — tour_completed: false ile
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

  // Service role client (bypasses RLS)
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify user token using Supabase auth (no JWT secret needed)
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user: authUser }, error: authError } = await userClient.auth.getUser();

  if (authError || !authUser) {
    console.error('[setup-org] Auth verification failed:', authError?.message);
    return new Response(JSON.stringify({ error: 'Invalid token', details: authError?.message }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userId = authUser.id;

  // Get full user info from admin API (latest metadata)
  let resolvedEmail = authUser.email ?? '';
  let resolvedDisplayName = '';
  let metaOrgId = '';
  let metaRole = '';

  try {
    const { data: adminUserData } = await supabase.auth.admin.getUserById(userId);
    if (adminUserData?.user) {
      resolvedEmail = adminUserData.user.email ?? resolvedEmail;
      const meta = adminUserData.user.user_metadata ?? {};
      resolvedDisplayName = (meta.full_name as string) || (meta.name as string) || '';
      metaOrgId = (meta.organization_id as string) || '';
      metaRole = (meta.role as string) || '';
    }
  } catch (e) {
    console.warn('[setup-org] Could not fetch full auth user:', e);
    // Use data from token
    const meta = authUser.user_metadata ?? {};
    resolvedDisplayName = (meta.full_name as string) || (meta.name as string) || '';
    metaOrgId = (meta.organization_id as string) || '';
    metaRole = (meta.role as string) || '';
  }

  // Derive display name from email if still empty
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
      .select('organization_id, role, is_active, must_change_password, display_name, email, kvkk_accepted, organizations(id, name, invite_code)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('joined_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingMembership?.organizations) {
      const org = existingMembership.organizations as { id: string; name: string; invite_code: string };

      // Back-fill display_name / email if they were empty
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

      return new Response(JSON.stringify({
        organization: org,
        role: existingMembership.role ?? 'admin',
        is_active: existingMembership.is_active,
        must_change_password: existingMembership.must_change_password,
        kvkk_accepted: existingMembership.kvkk_accepted === true,
        display_name: existingMembership.display_name || user.display_name,
        email: existingMembership.email || user.email,
        created: false,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── No active org found — check metadata for pre-assigned org ──
    if (metaOrgId) {
      console.log(`[setup-org] User ${userId} has metadata org_id=${metaOrgId}, role=${metaRole}`);

      const { data: targetOrg } = await supabase
        .from('organizations')
        .select('id, name, invite_code')
        .eq('id', metaOrgId)
        .maybeSingle();

      if (targetOrg) {
        const assignedRole = normalizeRole(metaRole || 'member');

        const { data: inactiveMembership } = await supabase
          .from('user_organizations')
          .select('id')
          .eq('user_id', user.id)
          .eq('organization_id', metaOrgId)
          .maybeSingle();

        if (inactiveMembership) {
          await supabase
            .from('user_organizations')
            .update({
              is_active: true,
              role: assignedRole,
              display_name: user.display_name,
              email: user.email,
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
            });

          if (memberError && memberError.code !== '23505') {
            console.error('[setup-org] Member insert to existing org failed:', memberError.message);
          }
        }

        await ensureProfileRecord(supabase, user.id, assignedRole);

        // Clear metadata for security
        try {
          const { data: currentUser } = await supabase.auth.admin.getUserById(user.id);
          const currentMeta = currentUser?.user?.user_metadata ?? {};
          await supabase.auth.admin.updateUserById(user.id, {
            user_metadata: {
              ...currentMeta,
              organization_id: null,
              role: null,
            },
          });
        } catch (e) {
          console.warn('[setup-org] Could not clear metadata:', e);
        }

        return new Response(JSON.stringify({
          organization: targetOrg,
          role: assignedRole,
          is_active: true,
          must_change_password: true,
          kvkk_accepted: false,
          display_name: user.display_name,
          email: user.email,
          created: false,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ── No org found — create one automatically ──
    console.log(`[setup-org] No org found for user ${userId} — creating new org automatically`);

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
      .insert({ name: orgName, invite_code: inviteCode, created_by: user.id })
      .select()
      .maybeSingle();

    if (orgError || !newOrg) {
      console.error('[setup-org] Org creation failed:', orgError?.message);
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
          .select('organization_id, role, is_active, must_change_password, display_name, email, kvkk_accepted, organizations(id, name, invite_code)')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('joined_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (retryMembership?.organizations) {
          const org = retryMembership.organizations as { id: string; name: string; invite_code: string };
          await ensureProfileRecord(supabase, user.id);
          return new Response(JSON.stringify({
            organization: org,
            role: retryMembership.role ?? 'admin',
            is_active: retryMembership.is_active,
            must_change_password: retryMembership.must_change_password,
            kvkk_accepted: retryMembership.kvkk_accepted === true,
            display_name: retryMembership.display_name || user.display_name,
            email: retryMembership.email || user.email,
            created: false,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      console.error('[setup-org] Member insert failed:', memberError.message);
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

    return new Response(JSON.stringify({
      organization: newOrg,
      role: 'admin',
      is_active: true,
      must_change_password: false,
      kvkk_accepted: true,
      display_name: user.display_name,
      email: user.email,
      created: true,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[setup-org] Unhandled error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
