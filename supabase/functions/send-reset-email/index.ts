import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://isgdenetim.com.tr';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const email: string = (body?.email ?? '').trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'Geçerli bir e-posta adresi giriniz.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'Email servisi yapılandırılmamış.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Supabase Admin client ile reset link oluştur
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const redirectTo = `${SITE_URL}/reset-password`;

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error('[send-reset-email] generateLink error:', linkError);
      // Güvenlik: kullanıcıya email bulunamadı demiyoruz, başarılı gibi davranıyoruz
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resetLink = linkData.properties.action_link;

    // Markalı HTML email şablonu
    const htmlContent = `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Şifre Sıfırlama - ISG Denetim</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0c1a2e 0%,#0f2744 100%);border-radius:16px 16px 0 0;padding:36px 40px;text-align:center;">
              <div style="display:inline-flex;align-items:center;gap:12px;margin-bottom:8px;">
                <div style="width:44px;height:44px;background:rgba(6,182,212,0.15);border:1px solid rgba(6,182,212,0.3);border-radius:12px;display:inline-flex;align-items:center;justify-content:center;">
                  <span style="font-size:22px;">🔐</span>
                </div>
              </div>
              <h1 style="margin:0;font-size:22px;font-weight:800;color:#e2f8fb;letter-spacing:-0.02em;">ISG Denetim</h1>
              <p style="margin:4px 0 0;font-size:12px;color:#4a9bb5;">İş Sağlığı &amp; Güvenliği Yönetim Platformu</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px 40px 32px;">
              <div style="text-align:center;margin-bottom:32px;">
                <div style="width:72px;height:72px;background:rgba(6,182,212,0.08);border:1px solid rgba(6,182,212,0.2);border-radius:20px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;">
                  <span style="font-size:32px;">🔑</span>
                </div>
                <h2 style="margin:0 0 10px;font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-0.02em;">Şifre Sıfırlama</h2>
                <p style="margin:0;font-size:15px;color:#64748b;line-height:1.6;">
                  ISG Denetim hesabınız için şifre sıfırlama talebinde bulundunuz.
                </p>
              </div>

              <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 24px;">
                Merhaba,<br/><br/>
                Hesabınızın şifresini sıfırlamak için aşağıdaki butona tıklayın. Bu bağlantı <strong>1 saat</strong> geçerlidir ve yalnızca bir kez kullanılabilir.
              </p>

              <!-- CTA Button -->
              <div style="text-align:center;margin:32px 0;">
                <a href="${resetLink}"
                   style="display:inline-block;background:linear-gradient(135deg,#0891B2 0%,#06B6D4 50%,#22D3EE 100%);color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:16px 40px;border-radius:12px;letter-spacing:0.02em;box-shadow:0 4px 20px rgba(6,182,212,0.4);">
                  🔓 Şifremi Sıfırla
                </a>
              </div>

              <!-- Security note -->
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin:24px 0 0;">
                <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;">⚠️ Güvenlik Notu</p>
                <ul style="margin:0;padding-left:16px;font-size:13px;color:#64748b;line-height:1.8;">
                  <li>Bu bağlantı <strong>1 saat</strong> içinde geçerliliğini yitirir.</li>
                  <li>Bağlantı yalnızca <strong>bir kez</strong> kullanılabilir.</li>
                  <li>Bu isteği siz yapmadıysanız bu e-postayı görmezden gelin.</li>
                  <li>Şifreniz bu e-posta aracılığıyla değiştirilemez.</li>
                </ul>
              </div>

              <!-- Fallback link -->
              <div style="margin-top:24px;padding:16px;background:#f0fdff;border:1px solid rgba(6,182,212,0.2);border-radius:10px;">
                <p style="margin:0 0 6px;font-size:12px;color:#64748b;">Buton çalışmıyorsa aşağıdaki bağlantıyı kopyalayıp tarayıcınıza yapıştırın:</p>
                <p style="margin:0;font-size:11px;color:#0891B2;word-break:break-all;">${resetLink}</p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:#94a3b8;">
                Bu e-posta <strong style="color:#64748b;">notify@isgdenetim.com.tr</strong> adresinden gönderilmiştir.
              </p>
              <p style="margin:0;font-size:11px;color:#cbd5e1;">
                &copy; ${new Date().getFullYear()} ISG Denetim — İş Sağlığı &amp; Güvenliği Yönetim Platformu
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Resend ile gönder
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ISG Denetim <notify@isgdenetim.com.tr>',
        to: [email],
        subject: 'ISGDENETIM - Şifre Sıfırlama',
        html: htmlContent,
      }),
    });

    if (!resendRes.ok) {
      const resendErr = await resendRes.text();
      console.error('[send-reset-email] Resend error:', resendErr);
      return new Response(JSON.stringify({ error: 'E-posta gönderilemedi. Lütfen tekrar deneyin.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[send-reset-email] Reset email sent to ${email} ✓`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[send-reset-email] Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Beklenmeyen bir hata oluştu.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
