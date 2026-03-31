import type { Uygunsuzluk, Firma, Personel } from '../../../types';

function esc(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, ' ');
}

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function buildHtml(
  records: Uygunsuzluk[],
  firmalar: Firma[],
  personeller: Personel[],
  getPhoto: (id: string, type: 'acilis' | 'kapatma') => string | undefined,
): string {
  const printDate = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
  const total = records.length;
  const acik = records.filter(r => r.durum === 'Açık').length;
  const kapandi = records.filter(r => r.durum === 'Kapandı').length;

  const rows = records.map((r, i) => {
    const firma = firmalar.find(f => f.id === r.firmaId);
    const acilisFoto = r.acilisFotoMevcut ? getPhoto(r.id, 'acilis') : undefined;
    const kapatmaFoto = r.kapatmaFotoMevcut ? getPhoto(r.id, 'kapatma') : undefined;
    const isKapandi = r.durum === 'Kapandı';

    const photoCell = (src: string | undefined) => src
      ? `<img src="${src}" style="max-width:90px;max-height:70px;object-fit:cover;border-radius:6px;border:1px solid #E2E8F0;display:block;margin:0 auto;" alt="foto" />`
      : `<span style="color:#CBD5E1;font-size:11px;">—</span>`;

    const durumCell = isKapandi
      ? `<span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:#DCFCE7;color:#16A34A;border:1px solid #BBF7D0;white-space:nowrap;">✓ Kapalı</span>`
      : `<span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:#FEE2E2;color:#DC2626;border:1px solid #FECACA;white-space:nowrap;">● Açık</span>`;

    const rowBg = i % 2 === 0 ? '#FAFAFA' : '#FFFFFF';

    return `
    <tr style="background:${rowBg};page-break-inside:avoid;">
      <td style="padding:10px 8px;text-align:center;font-weight:800;font-size:13px;color:#374151;vertical-align:top;border-bottom:1px solid #E5E7EB;">${i + 1}</td>
      <td style="padding:10px 8px;vertical-align:top;border-bottom:1px solid #E5E7EB;">
        <div style="font-size:11px;font-weight:700;color:#374151;white-space:nowrap;">${esc(fmtDate(r.tarih))}</div>
        <div style="font-size:10px;color:#9CA3AF;margin-top:2px;font-family:'Courier New',monospace;">${esc(r.acilisNo ?? `DÖF-${i + 1}`)}</div>
        <div style="font-size:10px;color:#6B7280;margin-top:2px;">${esc(firma?.ad ?? '—')}</div>
      </td>
      <td style="padding:10px 8px;text-align:center;vertical-align:top;border-bottom:1px solid #E5E7EB;">${photoCell(acilisFoto)}</td>
      <td style="padding:10px 8px;vertical-align:top;border-bottom:1px solid #E5E7EB;">
        <div style="font-size:12px;font-weight:700;color:#111827;margin-bottom:3px;">${esc(r.baslik)}</div>
        ${r.aciklama ? `<div style="font-size:11px;color:#374151;line-height:1.5;">${esc(r.aciklama)}</div>` : ''}
      </td>
      <td style="padding:10px 8px;vertical-align:top;border-bottom:1px solid #E5E7EB;">
        <div style="font-size:11px;color:#374151;line-height:1.5;">${r.onlem ? esc(r.onlem) : '<span style="color:#9CA3AF;">—</span>'}</div>
        ${r.sorumlu ? `<div style="font-size:10px;color:#6B7280;margin-top:4px;">Sorumlu: ${esc(r.sorumlu)}</div>` : ''}
        ${r.hedefTarih ? `<div style="font-size:10px;color:#6B7280;">Hedef: ${esc(fmtDate(r.hedefTarih))}</div>` : ''}
      </td>
      <td style="padding:10px 8px;text-align:center;vertical-align:top;border-bottom:1px solid #E5E7EB;">${photoCell(kapatmaFoto)}</td>
      <td style="padding:10px 8px;text-align:center;vertical-align:top;border-bottom:1px solid #E5E7EB;">${durumCell}
        ${r.kapatmaTarihi ? `<div style="font-size:10px;color:#6B7280;margin-top:4px;">${esc(fmtDate(r.kapatmaTarihi))}</div>` : ''}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>DÖF Raporu — ${printDate}</title>
<style>
  *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
  html{font-size:12px}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1E293B;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{width:1050px;margin:0 auto;padding:0 36px 36px}
  .accent{height:4px;background:linear-gradient(90deg,#EF4444 0%,#F97316 60%,#FCD34D 100%);margin-bottom:20px}
  .header{display:flex;align-items:center;justify-content:space-between;padding-bottom:14px;border-bottom:2px solid #E2E8F0;margin-bottom:16px}
  .hdr-title{font-size:18px;font-weight:800;color:#0F172A}
  .hdr-sub{font-size:11px;font-weight:600;color:#EF4444;margin-top:2px;text-transform:uppercase;letter-spacing:1px}
  .print-date{font-size:11px;color:#94A3B8}
  .summary{display:flex;gap:12px;margin-bottom:16px}
  .sum-box{flex:1;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:10px 14px;text-align:center}
  .sum-num{font-size:20px;font-weight:800;color:#0F172A}
  .sum-label{font-size:10px;color:#64748B;margin-top:2px;font-weight:600}
  .sum-acik .sum-num{color:#DC2626}
  .sum-kapandi .sum-num{color:#16A34A}
  table.dof-table{width:100%;border-collapse:collapse;border:1px solid #D1D5DB;border-radius:8px;overflow:hidden;font-size:12px}
  table.dof-table thead tr{background:linear-gradient(135deg,#1E293B,#334155)}
  table.dof-table thead th{padding:10px 8px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#94A3B8;border-right:1px solid rgba(255,255,255,0.06)}
  table.dof-table thead th:last-child{border-right:none}
  table.dof-table tbody tr:hover{background:#F1F5F9}
  .footer{text-align:center;font-size:10px;color:#94A3B8;padding-top:12px;border-top:1px solid #E2E8F0;margin-top:16px}
  @media print{
    body{background:#fff!important}
    .page{width:100%!important;padding:0 20px 20px!important}
    @page{size:A4 landscape;margin:1cm}
  }
</style>
</head>
<body>
<div class="accent"></div>
<div class="page">
  <div class="header">
    <div>
      <div class="hdr-title">DÖF RAPORU</div>
      <div class="hdr-sub">Düzeltici ve Önleyici Faaliyet — Uygunsuzluk Yönetimi</div>
    </div>
    <div class="print-date">${printDate}</div>
  </div>

  <div class="summary">
    <div class="sum-box"><div class="sum-num">${total}</div><div class="sum-label">Toplam Kayıt</div></div>
    <div class="sum-box sum-acik"><div class="sum-num">${acik}</div><div class="sum-label">Açık Uygunsuzluk</div></div>
    <div class="sum-box sum-kapandi"><div class="sum-num">${kapandi}</div><div class="sum-label">Kapatılan</div></div>
  </div>

  <table class="dof-table">
    <thead>
      <tr>
        <th style="width:40px">No</th>
        <th style="width:110px">Tarih / Firma</th>
        <th style="width:100px">Uygunsuzluk Fotoğrafı</th>
        <th>Uygunsuzluk Açıklaması</th>
        <th>Alınması Gereken Önlemler</th>
        <th style="width:100px">Kapanma Fotoğrafı</th>
        <th style="width:90px">Durum</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="footer">
    ISG Denetim Sistemi &nbsp;•&nbsp; DÖF Raporu &nbsp;•&nbsp; Toplam ${total} kayıt &nbsp;•&nbsp; ${printDate}
  </div>
</div>
</body>
</html>`;
}

export function printDofRaporu(
  records: Uygunsuzluk[],
  firmalar: Firma[],
  personeller: Personel[],
  getPhoto: (id: string, type: 'acilis' | 'kapatma') => string | undefined,
): void {
  const html = buildHtml(records, firmalar, personeller, getPhoto);
  const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    URL.revokeObjectURL(url);
    fallbackPrint(html);
    return;
  }
  win.addEventListener('load', () => {
    setTimeout(() => {
      try { win.focus(); win.print(); } catch { /* ignore */ }
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, 500);
  });
  const fb = setTimeout(() => {
    if (!win.closed) { try { win.print(); } catch { /* ignore */ } URL.revokeObjectURL(url); }
  }, 4000);
  win.addEventListener('afterprint', () => clearTimeout(fb));
}

export function exportDofToExcel(
  records: Uygunsuzluk[],
  firmalar: Firma[],
  personeller: Personel[],
): void {
  const headers = ['No', 'DÖF No', 'Tarih', 'Firma', 'Personel', 'Başlık', 'Uygunsuzluk Açıklaması', 'Alınması Gereken Önlemler', 'Sorumlu', 'Hedef Tarih', 'Kapanma Tarihi', 'Durum'];

  const rows = records.map((r, i) => {
    const firma = firmalar.find(f => f.id === r.firmaId);
    const personel = personeller.find(p => p.id === r.personelId);
    return [
      i + 1,
      r.acilisNo ?? `DÖF-${i + 1}`,
      r.tarih ? new Date(r.tarih).toLocaleDateString('tr-TR') : '—',
      firma?.ad ?? '—',
      personel?.adSoyad ?? '—',
      r.baslik,
      r.aciklama ?? '',
      r.onlem ?? '',
      r.sorumlu ?? '',
      r.hedefTarih ? new Date(r.hedefTarih).toLocaleDateString('tr-TR') : '',
      r.kapatmaTarihi ? new Date(r.kapatmaTarihi).toLocaleDateString('tr-TR') : '',
      r.durum,
    ];
  });

  // Build CSV (Excel compatible with UTF-8 BOM)
  const csvRows = [headers, ...rows].map(row =>
    row.map(cell => {
      const str = String(cell ?? '');
      // Wrap in quotes if contains comma, newline or quote
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(','),
  );

  const csvContent = '\uFEFF' + csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const date = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
  link.download = `DOF-Raporu-${date}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fallbackPrint(html: string): void {
  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, { position: 'fixed', top: '-9999px', left: '-9999px', width: '1px', height: '1px', border: 'none' });
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }
  doc.open(); doc.write(html); doc.close();
  iframe.addEventListener('load', () => {
    setTimeout(() => {
      try { iframe.contentWindow?.print(); } catch { /* ignore */ }
      setTimeout(() => { try { document.body.removeChild(iframe); } catch { /* ignore */ } }, 2000);
    }, 400);
  });
}
