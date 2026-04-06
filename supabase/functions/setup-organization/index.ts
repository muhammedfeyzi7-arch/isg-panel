import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { jwtVerify } from 'https://esm.sh/jose@5';

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
    'Vary': 'Origin',
  };
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

  let userId: string | null = null;
  let userEmail: string | null = null;
  let userMetadata: Record<string, unknown> = {};

  try {
    const jwtSecret = Deno.env.get('SUPABASE_JWT_SECRET');
    if (!jwtSecret) {
      console.error('SUPABASE_JWT_SECRET is not set - rejecting for security');
      return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const encoder = new TextEncoder();
    const secretKey = encoder.encode(jwtSecret);
    const { payload } = await jwtVerify(token, secretKey);
    if (!payload.sub) throw new Error('No sub in JWT');
    userId = payload.sub as string;
    userEmail = payload.email as string;
    userMetadata = (payload.user_metadata as Record<string, unknown>) || {};
  } catch (e) {
    console.error('JWT verification failed:', e);
    return new Response(JSON.stringify({ error: 'Invalid JWT', details: String(e) }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Invalid token - no user id' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // ── Fetch full auth user to get latest metadata (handles manually created users) ──
  let resolvedEmail = userEmail ?? '';
  let resolvedDisplayName = (userMetadata?.full_name as string | undefined) ?? '';

  try {
    const { data: authUserData } = await supabase.auth.admin.getUserById(userId);
    if (authUserData?.user) {
      resolvedEmail = authUserData.user.email ?? resolvedEmail;
      const meta = authUserData.user.user_metadata ?? {};
      if (!resolvedDisplayName && meta.full_name) {
        resolvedDisplayName = String(meta.full_name);
      }
      if (!resolvedDisplayName && meta.name) {
        resolvedDisplayName = String(meta.name);
      }
    }
  } catch (e) {
    console.warn('[setup-org] Could not fetch full auth user:', e);
  }

  // Derive a display name from email if still empty
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
      .select('organization_id, role, is_active, must_change_password, display_name, email, organizations(id, name, invite_code)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('joined_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingMembership?.organizations) {
      const org = existingMembership.organizations as { id: string; name: string; invite_code: string };

      // Back-fill display_name / email if they were empty (handles legacy records)
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

      return new Response(JSON.stringify({
        organization: org,
        role: existingMembership.role ?? 'admin',
        is_active: existingMembership.is_active,
        must_change_password: existingMembership.must_change_password,
        display_name: existingMembership.display_name || user.display_name,
        email: existingMembership.email || user.email,
        created: false,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── No active org found — create one automatically ──
    // This handles:
    //   1. Brand new users (first login)
    //   2. Users manually created via Supabase dashboard
    //   3. Users whose org membership was deleted

    console.log(`[setup-org] No org found for user ${userId} — creating new org automatically`);

    // Org name: prefer display name, fallback to email prefix
    const orgName = user.display_name !== 'Kullanıcı'
      ? user.display_name
      : user.email
        ? user.email.split('@')[0].replace(/[^a-zA-Z0-9\s]/g, ' ').trim() || 'ISG Firması'
        : 'ISG Firması';

    // Generate unique invite code
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

    // Insert user_organizations record with admin role
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
      });

    if (memberError) {
      // Handle race condition: another request may have already inserted
      if (memberError.code === '23505') {
        console.warn('[setup-org] Duplicate insert detected, fetching existing record');
        const { data: retryMembership } = await supabase
          .from('user_organizations')
          .select('organization_id, role, is_active, must_change_password, display_name, email, organizations(id, name, invite_code)')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('joined_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (retryMembership?.organizations) {
          const org = retryMembership.organizations as { id: string; name: string; invite_code: string };
          return new Response(JSON.stringify({
            organization: org,
            role: retryMembership.role ?? 'admin',
            is_active: retryMembership.is_active,
            must_change_password: retryMembership.must_change_password,
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

    // Initialize empty app_data for the new org
    await supabase
      .from('app_data')
      .upsert(
        { organization_id: newOrg.id, data: {}, updated_at: new Date().toISOString() },
        { onConflict: 'organization_id' }
      );

    // Log the auto-creation event
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

    console.log(`[setup-org] New org created: ${newOrg.id} for user ${userId}`);

    return new Response(JSON.stringify({
      organization: newOrg,
      role: 'admin',
      is_active: true,
      must_change_password: false,
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
