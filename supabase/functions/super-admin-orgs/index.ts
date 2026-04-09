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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Oturum bulunamadı. Lütfen önce giriş yapın.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await callerClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Geçersiz oturum. Lütfen tekrar giriş yapın.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('is_super_admin')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) {
      return new Response(JSON.stringify({ error: 'Profil sorgu hatası: ' + profileError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!profile || !profile.is_super_admin) {
      return new Response(JSON.stringify({ error: 'Bu sayfaya erişim yetkiniz yok.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const operation = url.searchParams.get('op') ?? 'list';

    // ── check_admin ──────────────────────────────────────────────────────────
    if (operation === 'check_admin') {
      return new Response(JSON.stringify({ is_super_admin: true, email: user.email }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── list ─────────────────────────────────────────────────────────────────
    if (operation === 'list') {
      const { data: orgs, error: orgsError } = await adminClient
        .from('organizations')
        .select('id, name, invite_code, is_active, subscription_start, subscription_end, created_at, created_by')
        .order('created_at', { ascending: false });

      if (orgsError) throw orgsError;

      const orgsWithCount = await Promise.all(
        (orgs ?? []).map(async (org) => {
          const { count } = await adminClient
            .from('user_organizations')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', org.id)
            .eq('is_active', true);

          let creatorEmail = null;
          if (org.created_by) {
            const { data: uo } = await adminClient
              .from('user_organizations')
              .select('email')
              .eq('user_id', org.created_by)
              .maybeSingle();
            creatorEmail = uo?.email ?? null;
          }

          // Last activity
          const { data: lastLog } = await adminClient
            .from('activity_logs')
            .select('created_at')
            .eq('organization_id', org.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Total action count
          const { count: actionCount } = await adminClient
            .from('activity_logs')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', org.id);

          return {
            ...org,
            member_count: count ?? 0,
            creator_email: creatorEmail,
            last_activity: lastLog?.created_at ?? null,
            total_actions: actionCount ?? 0,
          };
        })
      );

      return new Response(JSON.stringify({ data: orgsWithCount }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── get_members ──────────────────────────────────────────────────────────
    if (operation === 'get_members') {
      const orgId = url.searchParams.get('orgId');
      if (!orgId) {
        return new Response(JSON.stringify({ error: 'orgId gerekli' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // user_organizations kolonları: id, user_id, organization_id, role, email, display_name, is_active, joined_at
      const { data: members, error: membersError } = await adminClient
        .from('user_organizations')
        .select('id, user_id, email, display_name, role, is_active, joined_at')
        .eq('organization_id', orgId)
        .order('joined_at', { ascending: true });

      if (membersError) throw membersError;

      // Last activity per member
      const enriched = await Promise.all(
        (members ?? []).map(async (m) => {
          const { data: lastLog } = await adminClient
            .from('activity_logs')
            .select('created_at, action_type, module')
            .eq('organization_id', orgId)
            .eq('user_id', m.user_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const { count: actionCount } = await adminClient
            .from('activity_logs')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', orgId)
            .eq('user_id', m.user_id);

          return {
            ...m,
            last_activity: lastLog?.created_at ?? null,
            last_action: lastLog ? `${lastLog.module ?? ''} - ${lastLog.action_type ?? ''}` : null,
            action_count: actionCount ?? 0,
          };
        })
      );

      return new Response(JSON.stringify({ data: enriched }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── update_member ────────────────────────────────────────────────────────
    if (operation === 'update_member' && req.method === 'POST') {
      const body = await req.json();
      const { memberId, role, is_active } = body;

      if (!memberId) {
        return new Response(JSON.stringify({ error: 'memberId gerekli' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const updateData: Record<string, unknown> = {};
      if (role !== undefined) updateData.role = role;
      if (is_active !== undefined) updateData.is_active = is_active;

      const { error: updateError } = await adminClient
        .from('user_organizations')
        .update(updateData)
        .eq('id', memberId);

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── remove_member ────────────────────────────────────────────────────────
    if (operation === 'remove_member' && req.method === 'POST') {
      const body = await req.json();
      const { memberId } = body;

      if (!memberId) {
        return new Response(JSON.stringify({ error: 'memberId gerekli' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: removeError } = await adminClient
        .from('user_organizations')
        .update({ is_active: false })
        .eq('id', memberId);

      if (removeError) throw removeError;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── org_activity ─────────────────────────────────────────────────────────
    if (operation === 'org_activity') {
      const orgId = url.searchParams.get('orgId');
      if (!orgId) {
        return new Response(JSON.stringify({ error: 'orgId gerekli' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: logs, error: logsError } = await adminClient
        .from('activity_logs')
        .select('id, user_email, user_name, action_type, module, description, created_at, severity')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(30);

      if (logsError) throw logsError;

      return new Response(JSON.stringify({ data: logs ?? [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── update ───────────────────────────────────────────────────────────────
    if (operation === 'update' && req.method === 'POST') {
      const body = await req.json();
      const { orgId, is_active, subscription_start, subscription_end } = body;

      if (!orgId) {
        return new Response(JSON.stringify({ error: 'orgId gerekli' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: updateError } = await adminClient
        .from('organizations')
        .update({
          is_active,
          subscription_start: subscription_start || null,
          subscription_end: subscription_end || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orgId);

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── send_subscription_alerts ─────────────────────────────────────────────
    if (operation === 'send_subscription_alerts' && req.method === 'POST') {
      const body = await req.json();
      const { orgId } = body;

      // Get org info
      const { data: org, error: orgError } = await adminClient
        .from('organizations')
        .select('id, name, subscription_end')
        .eq('id', orgId)
        .maybeSingle();

      if (orgError || !org) {
        return new Response(JSON.stringify({ error: 'Organizasyon bulunamadı' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get active members
      const { data: members } = await adminClient
        .from('user_organizations')
        .select('email, display_name, role')
        .eq('organization_id', orgId)
        .eq('is_active', true);

      const end = org.subscription_end ? new Date(org.subscription_end) : null;
      const now = new Date();
      const diffDays = end ? Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

      const endDateStr = end
        ? end.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
        : 'Belirtilmemiş';

      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

      if (!RESEND_API_KEY) {
        // No email service configured - return member list for manual action
        return new Response(JSON.stringify({
          success: false,
          error: 'E-posta servisi yapılandırılmamış (RESEND_API_KEY eksik)',
          members: members ?? [],
          org_name: org.name,
          days_left: diffDays,
          end_date: endDateStr,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Send emails via Resend
      const results = [];
      for (const member of (members ?? [])) {
        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'noreply@yourdomain.com',
              to: member.email,
              subject: `${org.name} - Abonelik Sona Erme Uyarısı`,
              html: `
                <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
                  <h2 style="color: #111; margin-bottom: 8px;">Abonelik Uyarısı</h2>
                  <p style="color: #555;">Merhaba ${member.display_name ?? member.email},</p>
                  <p style="color: #555;"><strong>${org.name}</strong> organizasyonunuzun aboneliği <strong>${diffDays !== null ? diffDays + ' gün' : 'yakında'}</strong> içinde sona erecektir.</p>
                  <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 24px 0;">
                    <p style="margin: 0; color: #92400e; font-size: 14px;">
                      <strong>Abonelik Bitiş Tarihi:</strong> ${endDateStr}
                    </p>
                  </div>
                  <p style="color: #555;">Üyeliğiniz hakkında bilgi almak için hizmet sağlayıcınızla iletişime geçin.</p>
                  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
                  <p style="color: #999; font-size: 12px;">Bu e-posta otomatik olarak gönderilmiştir.</p>
                </div>
              `,
            }),
          });
          results.push({ email: member.email, success: res.ok });
        } catch (e) {
          results.push({ email: member.email, success: false, error: String(e) });
        }
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Bilinmeyen işlem' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
