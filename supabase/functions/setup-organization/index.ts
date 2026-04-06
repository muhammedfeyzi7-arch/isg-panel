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
  const user = { id: userId, email: userEmail, user_metadata: userMetadata };

  try {
    // Check for existing membership - but ALWAYS ensure role is admin for org creator
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
      
      // IMPORTANT: If this user created the org, ensure they are admin
      const { data: orgData } = await supabase
        .from('organizations')
        .select('created_by')
        .eq('id', org.id)
        .maybeSingle();
      
      const isCreator = orgData?.created_by === user.id;
      const shouldBeAdmin = isCreator || existingMembership.role === 'admin';
      
      // If creator but not admin, fix the role
      if (isCreator && existingMembership.role !== 'admin') {
        await supabase
          .from('user_organizations')
          .update({ role: 'admin' })
          .eq('user_id', user.id)
          .eq('organization_id', org.id);
      }
      
      return new Response(JSON.stringify({
        organization: org,
        role: shouldBeAdmin ? 'admin' : (existingMembership.role ?? 'member'),
        is_active: existingMembership.is_active,
        must_change_password: existingMembership.must_change_password,
        display_name: existingMembership.display_name,
        created: false,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // No active org — check org limit before creating
    const { count: orgCount } = await supabase
      .from('organizations')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', user.id);

    if ((orgCount ?? 0) >= 3) {
      return new Response(JSON.stringify({ error: 'Maksimum 3 organizasyon oluşturabilirsiniz.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create new org
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const inviteCode = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const orgName = user.user_metadata?.full_name
      ? String(user.user_metadata.full_name)
      : user.email
        ? user.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ').trim() || 'ISG Firması'
        : 'ISG Firması';

    const { data: newOrg, error: orgError } = await supabase
      .from('organizations')
      .insert({ name: orgName, invite_code: inviteCode, created_by: user.id })
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
        email: user.email ?? '',
        is_active: true,
        must_change_password: false,
      });

    if (memberError) {
      return new Response(JSON.stringify({ error: memberError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase
      .from('app_data')
      .upsert({ organization_id: newOrg.id, data: {}, updated_at: new Date().toISOString() }, { onConflict: 'organization_id' });

    return new Response(JSON.stringify({
      organization: newOrg,
      role: 'admin',
      is_active: true,
      must_change_password: false,
      created: true,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});