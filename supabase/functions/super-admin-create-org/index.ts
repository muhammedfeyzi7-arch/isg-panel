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

function generateInviteCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
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

    // Service role client — RLS bypass eder
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${serviceKey}` } },
    });

    // Caller'ı doğrula (user token ile ayrı client)
    const userClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user: callerUser }, error: authErr } = await userClient.auth.getUser(token);
    if (authErr || !callerUser) {
      return new Response(JSON.stringify({ error: 'Geçersiz oturum: ' + (authErr?.message ?? 'user not found') }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Super admin kontrolü
    const { data: profile, error: profileErr } = await adminClient
      .from('profiles')
      .select('is_super_admin')
      .eq('user_id', callerUser.id)
      .maybeSingle();

    if (profileErr) {
      return new Response(JSON.stringify({ error: 'Profil sorgu hatası: ' + profileErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!profile?.is_super_admin) {
      return new Response(JSON.stringify({ error: 'Bu işlem için süper admin yetkisi gereklidir.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const {
      org_name,
      subscription_start,
      subscription_end,
      admin_email,
      admin_password,
      admin_display_name,
    } = body as {
      org_name: string;
      subscription_start: string;
      subscription_end: string;
      admin_email: string;
      admin_password: string;
      admin_display_name: string;
    };

    if (!org_name?.trim()) {
      return new Response(JSON.stringify({ error: 'Organizasyon adı zorunludur.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!admin_email?.trim() || !admin_password || !admin_display_name?.trim()) {
      return new Response(JSON.stringify({ error: 'Admin email, şifre ve ad soyad zorunludur.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (admin_password.length < 8) {
      return new Response(JSON.stringify({ error: 'Şifre en az 8 karakter olmalıdır.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const normalizedEmail = admin_email.toLowerCase().trim();

    // Benzersiz davet kodu üret
    let inviteCode = generateInviteCode();
    for (let i = 0; i < 5; i++) {
      const { data: existing } = await adminClient
        .from('organizations')
        .select('id')
        .eq('invite_code', inviteCode)
        .maybeSingle();
      if (!existing) break;
      inviteCode = generateInviteCode();
    }

    // 1. Organizasyonu oluştur (service role — RLS bypass)
    const { data: newOrg, error: orgErr } = await adminClient
      .from('organizations')
      .insert({
        name: org_name.trim(),
        invite_code: inviteCode,
        created_by: callerUser.id,
        subscription_start: subscription_start || new Date().toISOString().split('T')[0],
        subscription_end: subscription_end || null,
        is_active: true,
      })
      .select()
      .single();

    if (orgErr || !newOrg) {
      return new Response(JSON.stringify({ error: 'Organizasyon oluşturulamadı: ' + (orgErr?.message ?? 'Bilinmeyen hata') }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Admin kullanıcıyı oluştur veya mevcut bul
    let adminUserId: string;

    const { data: existingUsers } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    const existingUser = existingUsers?.users?.find(u => u.email === normalizedEmail);

    if (existingUser) {
      adminUserId = existingUser.id;
    } else {
      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email: normalizedEmail,
        password: admin_password,
        email_confirm: true,
        user_metadata: {
          full_name: admin_display_name,
          admin_created: true,
          organization_id: newOrg.id,
          role: 'admin',
        },
      });

      if (createErr || !newUser?.user) {
        await adminClient.from('organizations').delete().eq('id', newOrg.id);
        return new Response(JSON.stringify({ error: 'Admin kullanıcı oluşturulamadı: ' + (createErr?.message ?? 'Bilinmeyen hata') }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      adminUserId = newUser.user.id;
    }

    // 3. user_organizations kaydı oluştur
    const { error: memberErr } = await adminClient
      .from('user_organizations')
      .insert({
        user_id: adminUserId,
        organization_id: newOrg.id,
        role: 'admin',
        display_name: admin_display_name.trim(),
        email: normalizedEmail,
        is_active: true,
        must_change_password: false,
      });

    if (memberErr) {
      await adminClient.from('organizations').delete().eq('id', newOrg.id);
      return new Response(JSON.stringify({ error: 'Kullanıcı organizasyona eklenemedi: ' + memberErr.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Profiles kaydı oluştur (yoksa)
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id')
      .eq('user_id', adminUserId)
      .maybeSingle();

    if (!existingProfile) {
      await adminClient.from('profiles').insert({
        user_id: adminUserId,
        role: 'admin',
        tour_completed: false,
        is_super_admin: false,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      organization: {
        id: newOrg.id,
        name: newOrg.name,
        invite_code: inviteCode,
        subscription_start: newOrg.subscription_start,
        subscription_end: newOrg.subscription_end,
      },
      admin_user: {
        id: adminUserId,
        email: normalizedEmail,
        display_name: admin_display_name,
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[FATAL]', err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: 'Sunucu hatası: ' + msg }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
