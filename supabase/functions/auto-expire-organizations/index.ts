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

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Süresi dolmuş ama hâlâ aktif organizasyonları bul
    const { data: expiredOrgs, error: fetchError } = await serviceClient
      .from('organizations')
      .select('id, name, subscription_end')
      .eq('is_active', true)
      .lt('subscription_end', todayStr);

    if (fetchError) {
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!expiredOrgs || expiredOrgs.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'Süresi dolan organizasyon yok.', processed: 0 }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = [];

    for (const org of expiredOrgs) {
      try {
        // Organizasyonu pasife al
        await serviceClient
          .from('organizations')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', org.id);

        // O org'daki tüm kullanıcıları bul
        const { data: members } = await serviceClient
          .from('user_organizations')
          .select('user_id')
          .eq('organization_id', org.id);

        // Direkt DB'den session sil — en kesin yöntem
        let kickedCount = 0;
        if (members && members.length > 0) {
          for (const m of members) {
            try {
              await serviceClient.rpc('delete_user_sessions', { target_user_id: m.user_id });
              kickedCount++;
            } catch { /* devam */ }
          }
        }

        results.push({
          org_id: org.id,
          org_name: org.name,
          subscription_end: org.subscription_end,
          status: 'deactivated',
          kicked_users: kickedCount,
        });
      } catch (err) {
        results.push({ org_id: org.id, status: 'error', error: String(err) });
      }
    }

    return new Response(JSON.stringify({ success: true, today: todayStr, processed: results.length, results }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
