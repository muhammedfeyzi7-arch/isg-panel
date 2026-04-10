import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const serviceClient = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const { user_id, org_id } = body;

    if (user_id) {
      // Tek kullanıcının tüm session + refresh token'larını direkt DB'den sil
      await serviceClient.rpc('delete_user_sessions', { target_user_id: user_id });
      return new Response(JSON.stringify({ success: true, kicked: user_id }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (org_id) {
      // Org'daki tüm kullanıcıları bul
      const { data: members } = await serviceClient
        .from('user_organizations')
        .select('user_id')
        .eq('organization_id', org_id);

      const kicked: string[] = [];
      if (members) {
        for (const m of members) {
          try {
            await serviceClient.rpc('delete_user_sessions', { target_user_id: m.user_id });
            kicked.push(m.user_id);
          } catch { /* devam */ }
        }
      }

      return new Response(JSON.stringify({ success: true, kicked }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'user_id or org_id required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
