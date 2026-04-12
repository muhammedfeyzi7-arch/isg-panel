import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function getCorsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Yetkisiz erişim.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '').trim();

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${serviceKey}` } },
    });

    // Caller doğrula
    const userClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user: callerUser }, error: authErr } = await userClient.auth.getUser(token);
    if (authErr || !callerUser) {
      return new Response(JSON.stringify({ error: 'Geçersiz oturum.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Super admin kontrolü
    const { data: profile } = await adminClient
      .from('profiles')
      .select('is_super_admin')
      .eq('user_id', callerUser.id)
      .maybeSingle();

    if (!profile?.is_super_admin) {
      return new Response(JSON.stringify({ error: 'Süper admin yetkisi gereklidir.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { org_id } = await req.json() as { org_id: string };
    if (!org_id) {
      return new Response(JSON.stringify({ error: 'org_id zorunludur.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Bu org'a bağlı kullanıcı ID'lerini bul
    const { data: members } = await adminClient
      .from('user_organizations')
      .select('user_id')
      .eq('organization_id', org_id);

    const userIds: string[] = (members ?? []).map((m: { user_id: string }) => m.user_id);

    // 2. İlgili tüm tabloları temizle (sırayla — FK bağımlılıkları göz önünde)
    const tables = [
      'notifications',
      'activity_logs',
      'document_alert_settings',
      'company_documents',
      'support_tickets',
      'osgb_ziyaretler',
      'is_izinleri',
      'gorevler',
      'uygunsuzluklar',
      'muayeneler',
      'egitimler',
      'ekipmanlar',
      'evraklar',
      'tutanaklar',
      'is_kazalari',
      'app_data',
      'firmalar',
      'personeller',
    ];

    for (const table of tables) {
      const { error: delErr } = await adminClient
        .from(table)
        .delete()
        .eq('organization_id', org_id);
      if (delErr) {
        console.warn(`[delete-org] ${table} silme uyarısı:`, delErr.message);
      }
    }

    // 3. role_permissions temizle
    await adminClient
      .from('role_permissions')
      .delete()
      .eq('organization_id', org_id);

    // 4. user_organizations temizle
    await adminClient
      .from('user_organizations')
      .delete()
      .eq('organization_id', org_id);

    // 5. profiles temizle (sadece bu org'a ait kullanıcılar için)
    // Başka orglarda da olan kullanıcıların profillerini silme
    if (userIds.length > 0) {
      for (const uid of userIds) {
        // Bu kullanıcının başka aktif org üyeliği var mı?
        const { data: otherMemberships } = await adminClient
          .from('user_organizations')
          .select('id')
          .eq('user_id', uid)
          .neq('organization_id', org_id)
          .limit(1);

        if (!otherMemberships || otherMemberships.length === 0) {
          // Başka org'u yok — profiles'ı sil
          await adminClient.from('profiles').delete().eq('user_id', uid);

          // auth.users'dan da sil
          const { error: authDelErr } = await adminClient.auth.admin.deleteUser(uid);
          if (authDelErr) {
            console.warn(`[delete-org] auth user silme uyarısı (${uid}):`, authDelErr.message);
          }
        }
      }
    }

    // 6. organizations tablosundan sil
    const { error: orgDelErr } = await adminClient
      .from('organizations')
      .delete()
      .eq('id', org_id);

    if (orgDelErr) {
      return new Response(JSON.stringify({ error: 'Organizasyon silinemedi: ' + orgDelErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, deleted_users: userIds.length }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[FATAL]', err);
    return new Response(JSON.stringify({ error: 'Sunucu hatası: ' + (err instanceof Error ? err.message : String(err)) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
