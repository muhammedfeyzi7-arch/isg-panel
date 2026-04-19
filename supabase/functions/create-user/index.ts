import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResp({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    // Admin client
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Caller token doğrula
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return jsonResp({ error: 'Authorization header eksik' }, 401);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerUser) {
      return jsonResp({ error: `Token doğrulanamadı: ${callerErr?.message ?? 'user null'}` }, 401);
    }

    // Caller profili — service role ile çek (RLS bypass)
    const { data: caller, error: callerProfileErr } = await admin
      .from('profiles')
      .select('role, organization_id, status')
      .eq('id', callerUser.id)
      .maybeSingle();

    if (callerProfileErr) return jsonResp({ error: `Profil sorgu hatası: ${callerProfileErr.message}` }, 500);
    if (!caller) return jsonResp({ error: 'Çağıran kullanıcı profili bulunamadı' }, 403);
    if (!['owner', 'admin'].includes(caller.role)) return jsonResp({ error: `Yetki yok. Rolünüz: ${caller.role}` }, 403);
    if (caller.status !== 'active') return jsonResp({ error: 'Hesabınız pasif' }, 403);

    // Body
    const body = await req.json().catch(() => null);
    if (!body) return jsonResp({ error: 'Geçersiz JSON body' }, 400);

    const { email, password, fullName, phone, role, organizationId, specializationClass } = body;

    if (!email) return jsonResp({ error: 'email zorunlu' }, 400);
    if (!password) return jsonResp({ error: 'password zorunlu' }, 400);
    if (!fullName) return jsonResp({ error: 'fullName zorunlu' }, 400);
    if (!role) return jsonResp({ error: 'role zorunlu' }, 400);
    if (!organizationId) return jsonResp({ error: 'organizationId zorunlu' }, 400);

    if (!['specialist', 'doctor'].includes(role)) {
      return jsonResp({ error: `Geçersiz rol: ${role}. Sadece specialist veya doctor olabilir.` }, 400);
    }

    if (organizationId !== caller.organization_id) {
      return jsonResp({ error: 'Farklı organizasyona kullanıcı eklenemez' }, 403);
    }

    // Auth user oluştur
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: String(email),
      password: String(password),
      email_confirm: true,
    });

    if (createErr) return jsonResp({ error: `Auth kullanıcı oluşturma hatası: ${createErr.message}` }, 400);
    if (!created?.user) return jsonResp({ error: 'Auth user null döndü' }, 500);

    const now = new Date().toISOString();

    const profileData: Record<string, unknown> = {
      id: created.user.id,
      organization_id: String(organizationId),
      full_name: String(fullName),
      email: String(email),
      phone: phone ? String(phone) : null,
      role: String(role),
      status: 'active',
      created_at: now,
      updated_at: now,
    };

    if (role === 'specialist' && specializationClass) {
      profileData.specialization_class = String(specializationClass);
    }

    const { error: insertErr } = await admin.from('profiles').insert(profileData);

    if (insertErr) {
      // Rollback
      await admin.auth.admin.deleteUser(created.user.id);
      return jsonResp({ error: `Profil insert hatası: ${insertErr.message} | code: ${insertErr.code} | details: ${insertErr.details}` }, 500);
    }

    return jsonResp({ success: true, userId: created.user.id });

  } catch (err) {
    const msg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    return jsonResp({ error: `Beklenmeyen hata: ${msg}` }, 500);
  }
});
