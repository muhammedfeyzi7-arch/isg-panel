import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';

interface AlertSettings {
  id: string;
  organization_id: string;
  user_id: string;
  email_enabled: boolean;
  alert_days_before: number[];
  include_expired: boolean;
  notify_email: string | null;
}

interface CompanyDocument {
  id: string;
  title: string;
  document_type: string;
  valid_until: string | null;
  company_id: string;
}

interface Company {
  id: string;
  name: string;
}

function getDocStatus(validUntil: string | null): 'expired' | 'upcoming' | 'active' {
  if (!validUntil) return 'active';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(validUntil);
  d.setHours(0, 0, 0, 0);
  if (d < today) return 'expired';
  const in30 = new Date(today.getTime() + 30 * 86400000);
  if (d <= in30) return 'upcoming';
  return 'active';
}

function getDaysLeft(validUntil: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(validUntil);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / 86400000);
}

function buildEmailHtml(
  docs: { doc: CompanyDocument; company: Company | undefined; daysLeft: number; status: 'expired' | 'upcoming' }[],
  orgName: string,
): string {
  const expiredDocs = docs.filter(d => d.status === 'expired');
  const upcomingDocs = docs.filter(d => d.status === 'upcoming');

  const docRow = (d: typeof docs[0]) => {
    const isExpired = d.status === 'expired';
    const color = isExpired ? '#EF4444' : '#F59E0B';
    const badge = isExpired ? 'SURESİ DOLMUŞ' : `${d.daysLeft} GUN KALDI`;
    const bgColor = isExpired ? '#FEF2F2' : '#FFFBEB';
    const borderColor = isExpired ? '#FECACA' : '#FDE68A';
    return `
      <tr style="border-bottom: 1px solid #F1F5F9;">
        <td style="padding: 12px 16px; font-size: 13px; color: #1E293B; font-weight: 500;">${d.doc.title}</td>
        <td style="padding: 12px 16px; font-size: 12px; color: #64748B;">${d.doc.document_type}</td>
        <td style="padding: 12px 16px; font-size: 12px; color: #64748B;">${d.company?.name ?? '—'}</td>
        <td style="padding: 12px 16px; font-size: 12px; color: #64748B;">${d.doc.valid_until ? new Date(d.doc.valid_until).toLocaleDateString('tr-TR') : '—'}</td>
        <td style="padding: 12px 16px;">
          <span style="display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; color: ${color}; background: ${bgColor}; border: 1px solid ${borderColor};">
            ${badge}
          </span>
        </td>
      </tr>
    `;
  };

  return `
<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <div style="max-width: 680px; margin: 0 auto; padding: 32px 16px;">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <div style="display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; background: rgba(239,68,68,0.15); border-radius: 14px; margin-bottom: 16px;">
        <span style="font-size: 28px;">&#9888;&#65039;</span>
      </div>
      <h1 style="margin: 0; color: #F1F5F9; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">Firma Evraklari Uyarisi</h1>
      <p style="margin: 8px 0 0; color: #94A3B8; font-size: 13px;">${orgName} — ${new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
    </div>

    <!-- Summary Cards -->
    <div style="background: #FFFFFF; padding: 24px; border-left: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0;">
      <table style="width: 100%; border-collapse: separate; border-spacing: 12px;">
        <tr>
          <td style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 12px; padding: 16px; text-align: center; width: 33%;">
            <p style="margin: 0; font-size: 32px; font-weight: 800; color: #EF4444;">${expiredDocs.length}</p>
            <p style="margin: 4px 0 0; font-size: 12px; color: #DC2626; font-weight: 600;">Suresi Dolmus</p>
          </td>
          <td style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 12px; padding: 16px; text-align: center; width: 33%;">
            <p style="margin: 0; font-size: 32px; font-weight: 800; color: #F59E0B;">${upcomingDocs.length}</p>
            <p style="margin: 4px 0 0; font-size: 12px; color: #D97706; font-weight: 600;">Yaklasan (30 gun)</p>
          </td>
          <td style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 12px; padding: 16px; text-align: center; width: 33%;">
            <p style="margin: 0; font-size: 32px; font-weight: 800; color: #10B981;">${docs.length}</p>
            <p style="margin: 4px 0 0; font-size: 12px; color: #059669; font-weight: 600;">Toplam Uyari</p>
          </td>
        </tr>
      </table>
    </div>

    <!-- Table -->
    <div style="background: #FFFFFF; border-left: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; padding: 0 24px 24px;">
      <h2 style="margin: 0 0 16px; font-size: 15px; font-weight: 700; color: #1E293B; padding-top: 8px;">Evrak Detaylari</h2>
      <div style="overflow-x: auto; border-radius: 12px; border: 1px solid #E2E8F0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #F8FAFC;">
              <th style="padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px;">Evrak Adi</th>
              <th style="padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px;">Tur</th>
              <th style="padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px;">Firma</th>
              <th style="padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px;">Bitis Tarihi</th>
              <th style="padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px;">Durum</th>
            </tr>
          </thead>
          <tbody>
            ${docs.map(docRow).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- CTA -->
    <div style="background: #FFFFFF; border-left: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; padding: 0 24px 24px; text-align: center;">
      <p style="margin: 0 0 16px; font-size: 13px; color: #64748B;">Evraklari guncellemek icin ISG Denetim sistemine giris yapin.</p>
    </div>

    <!-- Footer -->
    <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 0 0 16px 16px; padding: 20px 24px; text-align: center;">
      <p style="margin: 0; font-size: 11px; color: #94A3B8;">Bu e-posta ISG Denetim sistemi tarafindan otomatik olarak gonderilmistir.</p>
      <p style="margin: 4px 0 0; font-size: 11px; color: #94A3B8;">Bildirim tercihlerinizi Ayarlar &gt; Bildirim Tercihleri bolumunden yonetebilirsiniz.</p>
    </div>

  </div>
</body>
</html>
  `;
}

async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    return { ok: false, error: 'RESEND_API_KEY yapilandirilmamis' };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'ISG Denetim <onboarding@resend.dev>',
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: err };
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json().catch(() => ({}));
    const isTest = body?.test === true;

    const { data: orgData } = await supabase
      .from('user_organizations')
      .select('organization_id, organizations(name)')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!orgData) {
      return new Response(JSON.stringify({ error: 'Organization not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const orgId = orgData.organization_id;
    const orgName = (orgData.organizations as { name: string } | null)?.name ?? 'ISG Denetim';

    const { data: settings } = await supabase
      .from('document_alert_settings')
      .select('*')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .maybeSingle() as { data: AlertSettings | null };

    if (!settings?.email_enabled && !isTest) {
      return new Response(JSON.stringify({ ok: true, message: 'E-posta bildirimleri devre disi' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const notifyEmail = settings?.notify_email || user.email;
    if (!notifyEmail) {
      return new Response(JSON.stringify({ error: 'Bildirim e-postasi bulunamadi' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: docsData } = await supabase
      .from('company_documents')
      .select('id, title, document_type, valid_until, company_id')
      .eq('organization_id', orgId);

    const docs: CompanyDocument[] = docsData ?? [];

    const { data: companiesData } = await supabase
      .from('companies')
      .select('id, name')
      .eq('organization_id', orgId);

    const companies: Company[] = companiesData ?? [];

    const alertDaysBefore = settings?.alert_days_before ?? [7, 14, 30];
    const includeExpired = settings?.include_expired ?? true;

    const criticalDocs = docs
      .filter(doc => {
        if (!doc.valid_until) return false;
        const status = getDocStatus(doc.valid_until);
        if (status === 'expired') return includeExpired;
        if (status === 'upcoming') {
          const days = getDaysLeft(doc.valid_until);
          return alertDaysBefore.some(threshold => days <= threshold);
        }
        return false;
      })
      .map(doc => {
        const status = getDocStatus(doc.valid_until) as 'expired' | 'upcoming';
        const daysLeft = doc.valid_until ? getDaysLeft(doc.valid_until) : 0;
        const company = companies.find(c => c.id === doc.company_id);
        return { doc, company, daysLeft, status };
      })
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'expired' ? -1 : 1;
        return a.daysLeft - b.daysLeft;
      });

    if (criticalDocs.length === 0 && !isTest) {
      return new Response(JSON.stringify({ ok: true, message: 'Kritik evrak bulunamadi, e-posta gonderilmedi' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const subject = criticalDocs.length > 0
      ? `Firma Evraki Uyarisi: ${criticalDocs.length} evrak dikkat gerektiriyor — ${orgName}`
      : `ISG Denetim — Test E-postasi`;

    const html = criticalDocs.length > 0
      ? buildEmailHtml(criticalDocs, orgName)
      : `<html><body style="font-family: sans-serif; padding: 32px; color: #1E293B;"><h2>Test E-postasi</h2><p>ISG Denetim bildirim sistemi basariyla yapilandirildi. Bu bir test e-postasidir.</p><p style="color: #64748B; font-size: 13px;">Su anda kritik evrak bulunmamaktadir.</p></body></html>`;

    const emailResult = await sendEmail(notifyEmail, subject, html);

    if (!emailResult.ok) {
      return new Response(JSON.stringify({ ok: false, error: emailResult.error }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!isTest && settings) {
      await supabase
        .from('document_alert_settings')
        .update({ last_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', settings.id);
    }

    return new Response(JSON.stringify({
      ok: true,
      message: `E-posta gonderildi: ${notifyEmail}`,
      criticalCount: criticalDocs.length,
      isTest,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
