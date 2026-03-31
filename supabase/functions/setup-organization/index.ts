import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify JWT and get user
  const { data: { user }, error: userError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  );

  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Check if user already has an org
    const { data: existingMembership } = await supabase
      .from('user_organizations')
      .select('organization_id, organizations(id, name, invite_code)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingMembership?.organizations) {
      const org = existingMembership.organizations as { id: string; name: string; invite_code: string };
      return new Response(JSON.stringify({ org, created: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create new org
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const inviteCode = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const orgName = user.email
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

    return new Response(JSON.stringify({ org: newOrg, created: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
