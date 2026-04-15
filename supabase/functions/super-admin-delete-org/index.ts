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

    console.log(`[delete-org] Başlıyor: ${org_id}`);

    // 1. Bu org'a bağlı kullanıcı ID'lerini bul
    const { data: members } = await adminClient
      .from('user_organizations')
      .select('user_id')
      .eq('organization_id', org_id);

    const userIds: string[] = (members ?? []).map((m: { user_id: string }) => m.user_id);
    console.log(`[delete-org] ${userIds.length} üye bulundu`);

    // 2. organization_id ile bağlı tüm tabloları temizle (FK sırasına göre — alt tablolar önce)
    const orgTables = [
      'notifications',
      'activity_logs',
      'document_alert_settings',
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
      'company_documents',
      'personeller',
      'firmalar',
    ];

    for (const table of orgTables) {
      const { error: delErr } = await adminClient
        .from(table)
        .delete()
        .eq('organization_id', org_id);
      if (delErr) {
        console.warn(`[delete-org] ${table} silme uyarısı:`, delErr.message);
      } else {
        console.log(`[delete-org] ${table} temizlendi`);
      }
    }

    // 3. role_permissions temizle
    const { error: rpErr } = await adminClient
      .from('role_permissions')
      .delete()
      .eq('organization_id', org_id);
    if (rpErr) console.warn('[delete-org] role_permissions:', rpErr.message);

    // 4. user_organizations temizle
    const { error: uoErr } = await adminClient
      .from('user_organizations')
      .delete()
      .eq('organization_id', org_id);
    if (uoErr) console.warn('[delete-org] user_organizations:', uoErr.message);

    // 5. profiles + auth.users temizle (başka org'da olmayan kullanıcılar için)
    let deletedUsers = 0;
    if (userIds.length > 0) {
      for (const uid of userIds) {
        // Başka aktif org üyeliği var mı?
        const { data: otherMemberships } = await adminClient
          .from('user_organizations')
          .select('id')
          .eq('user_id', uid)
          .limit(1);

        if (!otherMemberships || otherMemberships.length === 0) {
          // Profile sil
          const { error: profileErr } = await adminClient
            .from('profiles')
            .delete()
            .eq('user_id', uid);
          if (profileErr) console.warn(`[delete-org] profile silme (${uid}):`, profileErr.message);

          // auth.users'dan sil
          const { error: authDelErr } = await adminClient.auth.admin.deleteUser(uid);
          if (authDelErr) {
            console.warn(`[delete-org] auth user silme uyarısı (${uid}):`, authDelErr.message);
          } else {
            deletedUsers++;
          }
        } else {
          console.log(`[delete-org] Kullanıcı ${uid} başka org'da üye, silme atlandı`);
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

    console.log(`[delete-org] Tamamlandı. Silinen kullanıcı: ${deletedUsers}/${userIds.length}`);

    return new Response(JSON.stringify({ 
      success: true, 
      deleted_users: deletedUsers,
      total_members: userIds.length,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[FATAL]', err);
    return new Response(JSON.stringify({ error: 'Sunucu hatası: ' + (err instanceof Error ? err.message : String(err)) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
