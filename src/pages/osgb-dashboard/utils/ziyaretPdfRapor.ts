// Ziyaret PDF Raporu — HTML print yöntemi

interface ZiyaretPdfItem {
  id: string;
  uzman_ad: string | null;
  uzman_email: string | null;
  firma_ad: string | null;
  giris_saati: string;
  cikis_saati: string | null;
  durum: 'aktif' | 'tamamlandi';
  qr_ile_giris: boolean;
  sure_dakika: number | null;
  notlar?: string | null;
}

interface ZiyaretPdfOptions {
  orgName: string;
  donem: string;
  firmaFilter?: string;
  uzmanFilter?: string;
  ziyaretler: ZiyaretPdfItem[];
}

function esc(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtDT(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtSure(dk: number | null): string {
  if (!dk || dk < 0) return '—';
  const h = Math.floor(dk / 60);
  const m = dk % 60;
  return h > 0 ? `${h} saat ${m} dk` : `${m} dk`;
}

function kpiCard(label: string, value: string | number, color: string, bg: string): string {
  return `
    <div style="flex:1;background:${bg};border:1px solid ${color}33;border-radius:12px;padding:14px 16px;text-align:center;position:relative;overflow:hidden;">
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${color};border-radius:3px 3px 0 0;"></div>
      <div style="font-size:24px;font-weight:800;color:${color};line-height:1.1;">${esc(String(value))}</div>
      <div style="font-size:10px;color:#64748B;margin-top:4px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">${esc(label)}</div>
    </div>`;
}

export function buildZiyaretPdfHtml(opts: ZiyaretPdfOptions): string {
  const { orgName, donem, firmaFilter, uzmanFilter, ziyaretler } = opts;
  const printDate = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });

  const toplam = ziyaretler.length;
  const tamamlanan = ziyaretler.filter(z => z.durum === 'tamamlandi').length;
  const aktif = ziyaretler.filter(z => z.durum === 'aktif').length;
  const qrKullanilan = ziyaretler.filter(z => z.qr_ile_giris).length;
  const qrOran = toplam > 0 ? Math.round((qrKullanilan / toplam) * 100) : 0;
  const ortSure = ziyaretler.filter(z => z.sure_dakika && z.sure_dakika > 0).length > 0
    ? Math.round(
        ziyaretler
          .filter(z => z.sure_dakika && z.sure_dakika > 0)
          .reduce((s, z) => s + (z.sure_dakika ?? 0), 0) /
        ziyaretler.filter(z => z.sure_dakika && z.sure_dakika > 0).length
      )
    : 0;

  const rows = ziyaretler.map((z, i) => {
    const rowBg = i % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
    const durumColor = z.durum === 'aktif' ? '#16A34A' : '#64748B';
    const durumBg = z.durum === 'aktif' ? 'rgba(22,163,74,0.1)' : 'rgba(100,116,139,0.1)';
    const tipColor = z.qr_ile_giris ? '#7C3AED' : '#475569';
    const tipBg = z.qr_ile_giris ? 'rgba(124,58,237,0.08)' : 'rgba(71,85,105,0.08)';
    return `
    <tr style="background:${rowBg};">
      <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;font-size:11px;color:#0F172A;font-weight:600;">
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="width:22px;height:22px;border-radius:6px;background:${z.durum === 'aktif' ? 'rgba(34,197,94,0.15)' : 'rgba(100,116,139,0.12)'};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:${durumColor};flex-shrink:0;">${i + 1}</div>
          ${esc(z.uzman_ad ?? z.uzman_email ?? '—')}
        </div>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;font-size:11px;color:#374151;">${esc(z.firma_ad ?? '—')}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;font-size:11px;color:#374151;white-space:nowrap;">${fmtDT(z.giris_saati)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;font-size:11px;color:#374151;white-space:nowrap;">${z.cikis_saati ? fmtDT(z.cikis_saati) : '—'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;text-align:center;">
        <span style="font-size:11px;font-weight:700;color:#0891B2;">${fmtSure(z.sure_dakika)}</span>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;text-align:center;">
        <span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;background:${tipBg};color:${tipColor};">${z.qr_ile_giris ? 'QR' : 'Manuel'}</span>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;text-align:center;">
        <span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;background:${durumBg};color:${durumColor};">${z.durum === 'aktif' ? 'Devam Ediyor' : 'Tamamlandı'}</span>
      </td>
    </tr>`;
  }).join('');

  const filterInfo: string[] = [];
  if (firmaFilter) filterInfo.push(`Firma: <strong>${esc(firmaFilter)}</strong>`);
  if (uzmanFilter) filterInfo.push(`Uzman: <strong>${esc(uzmanFilter)}</strong>`);

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>Ziyaret Raporu — ${esc(orgName)} — ${esc(donem)}</title>
<style>
  *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#1E293B;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{width:900px;margin:0 auto;padding:28px 32px 40px}
  @media print{
    body{background:#fff!important}
    .page{width:100%!important;padding:0 12px 20px!important}
    @page{size:A4 landscape;margin:0.8cm}
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
      <div style="display:inline-block;padding:3px 10px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;background:#10B981;color:#fff;margin-bottom:8px;">OSGB Ziyaret Raporu</div>
      <div style="font-size:22px;font-weight:800;color:#0F172A;letter-spacing:-0.5px;">${esc(orgName)}</div>
      <div style="font-size:12px;color:#64748B;margin-top:4px;">Dönem: <strong>${esc(donem)}</strong> &nbsp;·&nbsp; ISG Denetim Yönetim Sistemi</div>
      ${filterInfo.length > 0 ? `<div style="font-size:11px;color:#64748B;margin-top:4px;">Filtre: ${filterInfo.join(' · ')}</div>` : ''}
    </div>
    <div style="text-align:right;">
      <div style="font-size:14px;font-weight:700;color:#1E293B;">${printDate}</div>
      <div style="font-size:10px;color:#94A3B8;margin-top:2px;">Rapor Tarihi</div>
    </div>
  </div>

  <!-- KPI Row -->
  <div style="display:flex;gap:10px;margin-bottom:24px;">
    ${kpiCard('Toplam Ziyaret', toplam, '#10B981', 'rgba(16,185,129,0.06)')}
    ${kpiCard('Tamamlanan', tamamlanan, '#059669', 'rgba(5,150,105,0.06)')}
    ${kpiCard('Aktif / Devam', aktif, '#22C55E', 'rgba(34,197,94,0.06)')}
    ${kpiCard('Ort. Süre', fmtSure(ortSure), '#0891B2', 'rgba(8,145,178,0.06)')}
    ${kpiCard('QR Kullanım', `%${qrOran}`, '#7C3AED', 'rgba(124,58,237,0.06)')}
  </div>

  <!-- Tablo başlığı -->
  <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#64748B;margin-bottom:10px;display:flex;align-items:center;gap:6px;">
    <div style="width:3px;height:14px;background:#10B981;border-radius:2px;"></div>
    Ziyaret Kayıtları (${toplam} kayıt)
  </div>

  <table style="width:100%;border-collapse:collapse;border:1px solid #D1D5DB;font-size:12px;margin-bottom:24px;">
    <thead>
      <tr style="background:#0F172A;">
        <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:#E2E8F0;border-bottom:3px solid #10B981;">Uzman</th>
        <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:#E2E8F0;border-bottom:3px solid #10B981;">Firma</th>
        <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:#E2E8F0;border-bottom:3px solid #10B981;">Giriş Zamanı</th>
        <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:#E2E8F0;border-bottom:3px solid #10B981;">Çıkış Zamanı</th>
        <th style="padding:10px 12px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:#E2E8F0;border-bottom:3px solid #10B981;">Süre</th>
        <th style="padding:10px 12px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:#E2E8F0;border-bottom:3px solid #10B981;">Tip</th>
        <th style="padding:10px 12px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:#E2E8F0;border-bottom:3px solid #10B981;">Durum</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="7" style="padding:20px;text-align:center;color:#94A3B8;">Kayıt bulunamadı</td></tr>'}
    </tbody>
    <tfoot>
      <tr style="background:#F8FAFC;border-top:2px solid #E2E8F0;">
        <td style="padding:10px 12px;font-weight:800;color:#0F172A;font-size:12px;" colspan="4">TOPLAM: ${toplam} ziyaret</td>
        <td style="padding:10px 12px;text-align:center;font-weight:800;color:#0891B2;">${fmtSure(ortSure)}</td>
        <td style="padding:10px 12px;text-align:center;font-weight:800;color:#7C3AED;">%${qrOran} QR</td>
        <td style="padding:10px 12px;text-align:center;font-weight:800;color:#059669;">${tamamlanan} tam.</td>
      </tr>
    </tfoot>
  </table>

  <!-- Footer -->
  <div style="display:flex;align-items:center;justify-content:space-between;padding-top:14px;border-top:1px solid #E2E8F0;font-size:10px;color:#64748B;">
    <span style="font-weight:700;color:#374151;">ISG Denetim Yönetim Sistemi</span>
    <span>Ziyaret Raporu &nbsp;·&nbsp; ${esc(orgName)} &nbsp;·&nbsp; ${printDate}</span>
  </div>

</div>
</body>
</html>`;
}

export function openZiyaretPdfRapor(opts: ZiyaretPdfOptions): void {
  const html = buildZiyaretPdfHtml(opts);
  const newWin = window.open('', '_blank', 'width=1000,height=700');
  if (!newWin) return;
  newWin.document.write(html);
  newWin.document.close();
  setTimeout(() => {
    newWin.focus();
    newWin.print();
  }, 400);
}
