// OSGB Raporlar — PDF Export (HTML print yöntemi)

interface FirmaRapor {
  id: string;
  name: string;
  personelSayisi: number;
  uzmanAd: string | null;
  uygunsuzluk: number;
  kapatilan: number;
  tutanakSayisi: number;
  egitimSayisi: number;
  sonGuncelleme?: string;
}

interface UzmanRapor {
  user_id: string;
  display_name: string;
  email: string;
  active_firm_name: string | null;
  is_active: boolean;
}

export interface OsgbRaporData {
  orgName: string;
  donem: string;
  firmalar: FirmaRapor[];
  uzmanlar: UzmanRapor[];
}

function esc(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function kpiBadge(label: string, value: number | string, color: string, bg: string): string {
  return `
    <div style="flex:1;background:${bg};border:1px solid ${color}22;border-radius:12px;padding:14px 16px;text-align:center;position:relative;overflow:hidden;">
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${color};border-radius:3px 3px 0 0;"></div>
      <div style="font-size:28px;font-weight:800;color:${color};line-height:1.1;">${esc(String(value))}</div>
      <div style="font-size:10px;color:#64748B;margin-top:4px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">${esc(label)}</div>
    </div>`;
}

export function buildOsgbReportHtml(data: OsgbRaporData): string {
  const { orgName, donem, firmalar, uzmanlar } = data;
  const printDate = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });

  const totalPersonel = firmalar.reduce((s, f) => s + f.personelSayisi, 0);
  const totalUygunsuzluk = firmalar.reduce((s, f) => s + f.uygunsuzluk, 0);
  const totalKapatilan = firmalar.reduce((s, f) => s + f.kapatilan, 0);
  const totalTutanak = firmalar.reduce((s, f) => s + f.tutanakSayisi, 0);
  const totalEgitim = firmalar.reduce((s, f) => s + f.egitimSayisi, 0);
  const kapanmaOran = totalUygunsuzluk > 0 ? Math.round((totalKapatilan / totalUygunsuzluk) * 100) : 0;

  const firmaRows = firmalar.map((f, i) => {
    const rowBg = i % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
    const uyRisk = f.uygunsuzluk > 5 ? '#DC2626' : f.uygunsuzluk > 2 ? '#D97706' : '#16A34A';
    const uyBg = f.uygunsuzluk > 5 ? 'rgba(220,38,38,0.1)' : f.uygunsuzluk > 2 ? 'rgba(217,119,6,0.1)' : 'rgba(22,163,74,0.1)';
    return `
    <tr style="background:${rowBg};">
      <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;font-weight:700;color:#0F172A;font-size:13px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:28px;height:28px;border-radius:8px;background:rgba(16,185,129,0.1);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#059669;">${i + 1}</div>
          ${esc(f.name)}
        </div>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;text-align:center;font-weight:700;color:#0F172A;font-size:14px;">${f.personelSayisi}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;text-align:center;color:#64748B;font-size:12px;">${esc(f.uzmanAd ?? '—')}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;text-align:center;">
        <span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${uyBg};color:${uyRisk};">
          ${f.uygunsuzluk}
        </span>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;text-align:center;font-size:12px;color:#16A34A;font-weight:600;">${f.kapatilan}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;text-align:center;font-size:12px;color:#6366F1;font-weight:600;">${f.tutanakSayisi}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;text-align:center;font-size:12px;color:#0891B2;font-weight:600;">${f.egitimSayisi}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;text-align:center;">
        <div style="width:60px;height:6px;background:#E5E7EB;border-radius:3px;margin:0 auto;overflow:hidden;">
          <div style="height:100%;width:${f.uygunsuzluk > 0 ? Math.round((f.kapatilan / f.uygunsuzluk) * 100) : 100}%;background:linear-gradient(90deg,#10B981,#059669);border-radius:3px;"></div>
        </div>
        <div style="font-size:10px;color:#64748B;margin-top:3px;">${f.uygunsuzluk > 0 ? Math.round((f.kapatilan / f.uygunsuzluk) * 100) : 100}%</div>
      </td>
    </tr>`;
  }).join('');

  const uzmanRows = uzmanlar.map((u, i) => {
    const rowBg = i % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
    return `
    <tr style="background:${rowBg};">
      <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;font-weight:600;color:#0F172A;font-size:13px;">${esc(u.display_name)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;color:#64748B;font-size:12px;">${esc(u.email)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;color:#374151;font-size:12px;">${esc(u.active_firm_name ?? 'Atanmadı')}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;text-align:center;">
        <span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${u.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(148,163,184,0.1)'};color:${u.is_active ? '#059669' : '#94A3B8'};">
          ${u.is_active ? 'Aktif' : 'Pasif'}
        </span>
      </td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>OSGB Raporu — ${esc(orgName)} — ${esc(donem)}</title>
<style>
  *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#1E293B;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{width:900px;margin:0 auto;padding:28px 32px 40px}
  @media print{
    body{background:#fff!important}
    .page{width:100%!important;padding:0 12px 20px!important}
    @page{size:A4 portrait;margin:0.8cm}
    tr{page-break-inside:avoid}
    .no-print{display:none!important}
  }
</style>
</head>
<body>
<div class="page">

  <!-- Accent bar -->
  <div style="height:5px;background:linear-gradient(90deg,#10B981,#059669,#047857);border-radius:3px;margin-bottom:24px;"></div>

  <!-- Header -->
  <div style="display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:16px;border-bottom:2px solid #E2E8F0;margin-bottom:20px;">
    <div>
      <div style="display:inline-block;padding:3px 10px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;background:#10B981;color:#fff;margin-bottom:8px;">OSGB ISG Raporu</div>
      <div style="font-size:22px;font-weight:800;color:#0F172A;letter-spacing:-0.5px;">${esc(orgName)}</div>
      <div style="font-size:12px;color:#64748B;margin-top:4px;">Dönem: <strong>${esc(donem)}</strong> &nbsp;·&nbsp; ISG Denetim Yönetim Sistemi</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:14px;font-weight:700;color:#1E293B;">${printDate}</div>
      <div style="font-size:10px;color:#94A3B8;margin-top:2px;">Rapor Tarihi</div>
    </div>
  </div>

  <!-- KPI Row -->
  <div style="display:flex;gap:10px;margin-bottom:24px;">
    ${kpiBadge('Müşteri Firma', firmalar.length, '#10B981', 'rgba(16,185,129,0.06)')}
    ${kpiBadge('Toplam Personel', totalPersonel, '#0891B2', 'rgba(8,145,178,0.06)')}
    ${kpiBadge('Açık Uygunsuzluk', totalUygunsuzluk - totalKapatilan, '#DC2626', 'rgba(220,38,38,0.06)')}
    ${kpiBadge('Tutanak Sayısı', totalTutanak, '#6366F1', 'rgba(99,102,241,0.06)')}
    ${kpiBadge('Eğitim Sayısı', totalEgitim, '#0891B2', 'rgba(8,145,178,0.06)')}
    ${kpiBadge('Kapanma Oranı', `${kapanmaOran}%`, '#059669', 'rgba(5,150,105,0.06)')}
  </div>

  <!-- Firma Tablosu -->
  <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#64748B;margin-bottom:10px;display:flex;align-items:center;gap:6px;">
    <div style="width:3px;height:14px;background:#10B981;border-radius:2px;"></div>
    Müşteri Firma Özeti
  </div>
  <table style="width:100%;border-collapse:collapse;border:1px solid #D1D5DB;font-size:12px;margin-bottom:24px;">
    <thead>
      <tr style="background:#0F172A;">
        <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:#E2E8F0;border-bottom:3px solid #10B981;">Firma Adı</th>
        <th style="padding:10px 12px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:#E2E8F0;border-bottom:3px solid #10B981;">Personel</th>
        <th style="padding:10px 12px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:#E2E8F0;border-bottom:3px solid #10B981;">Sorumlu Uzman</th>
        <th style="padding:10px 12px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:#E2E8F0;border-bottom:3px solid #10B981;">Açık Uygunsuzluk</th>
        <th style="padding:10px 12px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:#E2E8F0;border-bottom:3px solid #10B981;">Kapatılan</th>
        <th style="padding:10px 12px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:#E2E8F0;border-bottom:3px solid #10B981;">Tutanak</th>
        <th style="padding:10px 12px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:#E2E8F0;border-bottom:3px solid #10B981;">Eğitim</th>
        <th style="padding:10px 12px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:#E2E8F0;border-bottom:3px solid #10B981;">Kapanma %</th>
      </tr>
    </thead>
    <tbody>
      ${firmaRows || '<tr><td colspan="8" style="padding:20px;text-align:center;color:#94A3B8;">Firma bulunamadı</td></tr>'}
    </tbody>
    <tfoot>
      <tr style="background:#F8FAFC;border-top:2px solid #E2E8F0;">
        <td style="padding:10px 12px;font-weight:800;color:#0F172A;font-size:12px;">TOPLAM</td>
        <td style="padding:10px 12px;text-align:center;font-weight:800;color:#0F172A;">${totalPersonel}</td>
        <td style="padding:10px 12px;text-align:center;color:#94A3B8;">—</td>
        <td style="padding:10px 12px;text-align:center;font-weight:800;color:#DC2626;">${totalUygunsuzluk - totalKapatilan}</td>
        <td style="padding:10px 12px;text-align:center;font-weight:800;color:#16A34A;">${totalKapatilan}</td>
        <td style="padding:10px 12px;text-align:center;font-weight:800;color:#6366F1;">${totalTutanak}</td>
        <td style="padding:10px 12px;text-align:center;font-weight:800;color:#0891B2;">${totalEgitim}</td>
        <td style="padding:10px 12px;text-align:center;font-weight:800;color:#059669;">${kapanmaOran}%</td>
      </tr>
    </tfoot>
  </table>

  <!-- Uzman Tablosu -->
  <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#64748B;margin-bottom:10px;display:flex;align-items:center;gap:6px;">
    <div style="width:3px;height:14px;background:#8B5CF6;border-radius:2px;"></div>
    Gezici Uzman Listesi
  </div>
  <table style="width:100%;border-collapse:collapse;border:1px solid #D1D5DB;font-size:12px;margin-bottom:24px;">
    <thead>
      <tr style="background:#0F172A;">
        <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:#E2E8F0;border-bottom:3px solid #8B5CF6;">Ad Soyad</th>
        <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:#E2E8F0;border-bottom:3px solid #8B5CF6;">E-posta</th>
        <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:#E2E8F0;border-bottom:3px solid #8B5CF6;">Atandığı Firma</th>
        <th style="padding:10px 12px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:#E2E8F0;border-bottom:3px solid #8B5CF6;">Durum</th>
      </tr>
    </thead>
    <tbody>
      ${uzmanRows || '<tr><td colspan="4" style="padding:20px;text-align:center;color:#94A3B8;">Uzman bulunamadı</td></tr>'}
    </tbody>
  </table>

  <!-- Footer -->
  <div style="display:flex;align-items:center;justify-content:space-between;padding-top:14px;border-top:1px solid #E2E8F0;font-size:10px;color:#64748B;">
    <span style="font-weight:700;color:#374151;">ISG Denetim Yönetim Sistemi</span>
    <span>OSGB Raporu &nbsp;·&nbsp; ${esc(orgName)} &nbsp;·&nbsp; ${printDate}</span>
  </div>

</div>
</body>
</html>`;
}

export function downloadOsgbReportPdf(data: OsgbRaporData): void {
  const html = buildOsgbReportHtml(data);
  const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const dateStr = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
  link.download = `${dateStr}-OSGB-Raporu.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
