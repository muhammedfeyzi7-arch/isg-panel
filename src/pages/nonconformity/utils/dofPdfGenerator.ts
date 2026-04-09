// DÖF PDF & Excel Generator — v3
import type { Uygunsuzluk, Firma, Personel } from '../../../types';
import { getSignedUrlFromPath } from '@/utils/fileUpload';

function esc(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
}

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function resolveToBase64(src: string | undefined | null): Promise<string | null> {
  if (!src) return null;
  if (src.startsWith('data:')) return src;
  if (src.startsWith('http://') || src.startsWith('https://')) return fetchToBase64(src);
  const signedUrl = await getSignedUrlFromPath(src);
  if (!signedUrl) return null;
  return fetchToBase64(signedUrl);
}

async function fetchToBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'no-store' });
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

// ─── Severity renkleri ───────────────────────────────────────────────────────
const SEV_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  'Kritik': { bg: '#FEE2E2', color: '#DC2626', border: '#FECACA' },
  'Yüksek': { bg: '#FEF3C7', color: '#D97706', border: '#FDE68A' },
  'Orta':   { bg: '#FEF9C3', color: '#CA8A04', border: '#FEF08A' },
  'Düşük':  { bg: '#DCFCE7', color: '#16A34A', border: '#BBF7D0' },
};

function badge(text: string, bg: string, color: string, border: string): string {
  return `<span style="display:inline-block;padding:2px 9px;border-radius:20px;font-size:10px;font-weight:700;background:${bg};color:${color};border:1px solid ${border};white-space:nowrap;">${esc(text)}</span>`;
}

function photoCell(src: string | undefined, mevcut: boolean | undefined): string {
  if (src) {
    return `<img src="${src}" style="width:100%;max-width:110px;height:80px;object-fit:cover;border-radius:6px;border:1px solid #E2E8F0;display:block;margin:0 auto;" alt="foto" />`;
  }
  if (mevcut) {
    return `<div style="text-align:center;font-size:10px;color:#CA8A04;font-style:italic;">Yüklenemedi</div>`;
  }
  return `<div style="text-align:center;font-size:12px;color:#CBD5E1;">—</div>`;
}

// ─── HTML Builder ─────────────────────────────────────────────────────────────
function buildHtml(
  records: Uygunsuzluk[],
  firmalar: Firma[],
  personeller: Personel[],
  photoMap: Map<string, string>,
): string {
  const printDate = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
  const total = records.length;
  const acik = records.filter(r => r.durum === 'Açık').length;
  const kapandi = records.filter(r => r.durum === 'Kapandı').length;
  const kapanmaOran = total > 0 ? Math.round((kapandi / total) * 100) : 0;

  // Firma dağılımı
  const firmaDagilim = Object.entries(
    records.reduce<Record<string, number>>((acc, r) => {
      const ad = firmalar.find(f => f.id === r.firmaId)?.ad ?? 'Bilinmiyor';
      acc[ad] = (acc[ad] ?? 0) + 1;
      return acc;
    }, {}),
  );

  // Severity dağılımı
  const sevDagilim = ['Kritik', 'Yüksek', 'Orta', 'Düşük'].map(s => ({
    label: s,
    count: records.filter(r => r.severity === s).length,
    ...SEV_STYLE[s],
  })).filter(s => s.count > 0);

  // ── Tablo satırları ──
  // Sütun sırası: No | DÖF No | Tarih | Firma | Personel | Başlık | Açılış Foto | Açıklama | Önlemler | Sorumlu | Hedef Tarih | Kapanma Tarihi | Kapanış Foto | Önem | Durum
  const rows = records.map((r, i) => {
    const firma = firmalar.find(f => f.id === r.firmaId);
    const personel = personeller.find(p => p.id === r.personelId);
    const acilisFoto = r.acilisFotoMevcut ? photoMap.get(`${r.id}_acilis`) : undefined;
    const kapatmaFoto = r.kapatmaFotoMevcut ? photoMap.get(`${r.id}_kapatma`) : undefined;
    const rowBg = i % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
    const sev = SEV_STYLE[r.severity] ?? { bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0' };
    const durumBg = r.durum === 'Kapandı' ? '#16A34A' : '#DC2626';
    const durumColor = '#FFFFFF';
    const durumBorder = r.durum === 'Kapandı' ? '#15803D' : '#B91C1C';
    const durumIcon = r.durum === 'Kapandı' ? '✓' : '●';

    const td = `padding:8px 7px;vertical-align:middle;border-bottom:1px solid #E5E7EB;border-right:1px solid #E5E7EB;font-size:11px;color:#374151;`;
    const tdTop = `padding:8px 7px;vertical-align:top;border-bottom:1px solid #E5E7EB;border-right:1px solid #E5E7EB;font-size:11px;color:#374151;`;

    return `
    <tr style="background:${rowBg};">
      <td style="${td}text-align:center;font-weight:800;font-size:12px;color:#94A3B8;">${i + 1}</td>
      <td style="${td}">
        <div style="font-family:'Courier New',monospace;font-size:10px;font-weight:700;color:#6366F1;">${esc(r.acilisNo ?? `DÖF-${i + 1}`)}</div>
      </td>
      <td style="${td}white-space:nowrap;">${esc(fmtDate(r.tarih))}</td>
      <td style="${tdTop}font-weight:600;color:#1E293B;">${esc(firma?.ad ?? '—')}</td>
      <td style="${tdTop}color:#64748B;">${esc(personel?.adSoyad ?? '—')}</td>
      <td style="${tdTop}font-weight:600;color:#1E293B;">${esc(r.baslik)}</td>
      <td style="${td}text-align:center;min-width:100px;">${photoCell(acilisFoto, r.acilisFotoMevcut)}</td>
      <td style="${tdTop}max-width:180px;">${r.aciklama ? esc(r.aciklama) : '<span style="color:#CBD5E1;">—</span>'}</td>
      <td style="${tdTop}max-width:180px;">${r.onlem ? esc(r.onlem) : '<span style="color:#CBD5E1;">—</span>'}</td>
      <td style="${td}font-weight:600;">${esc(r.sorumlu ?? '—')}</td>
      <td style="${td}white-space:nowrap;">${esc(fmtDate(r.hedefTarih))}</td>
      <td style="${td}white-space:nowrap;">${esc(fmtDate(r.kapatmaTarihi))}</td>
      <td style="${td}text-align:center;min-width:100px;">${photoCell(kapatmaFoto, r.kapatmaFotoMevcut)}</td>
      <td style="${td}text-align:center;">${badge(r.severity, sev.bg, sev.color, sev.border)}</td>
      <td style="${td}text-align:center;border-right:none;">${badge(durumIcon + ' ' + r.durum, durumBg, durumColor, durumBorder)}</td>
    </tr>`;
  }).join('');

  const firmaSummaryRows = firmaDagilim.map(([ad, count]) => `
    <tr>
      <td style="padding:6px 10px;font-size:11px;color:#374151;border-bottom:1px solid #F1F5F9;">${esc(ad)}</td>
      <td style="padding:6px 10px;font-size:12px;font-weight:700;color:#1E293B;text-align:center;border-bottom:1px solid #F1F5F9;">${count}</td>
      <td style="padding:6px 10px;font-size:11px;color:#64748B;text-align:center;border-bottom:1px solid #F1F5F9;">${Math.round((count / total) * 100)}%</td>
    </tr>`).join('');

  const sevSummaryRows = sevDagilim.map(s => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #F1F5F9;">${badge(s.label, s.bg, s.color, s.border)}</td>
      <td style="padding:6px 10px;font-size:12px;font-weight:700;color:#1E293B;text-align:center;border-bottom:1px solid #F1F5F9;">${s.count}</td>
      <td style="padding:6px 10px;font-size:11px;color:#64748B;text-align:center;border-bottom:1px solid #F1F5F9;">${Math.round((s.count / total) * 100)}%</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>DÖF Raporu — ${printDate}</title>
<style>
  *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#1E293B;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{width:1200px;margin:0 auto;padding:28px 32px 40px}

  /* ── Header ── */
  .top-accent{height:4px;background:linear-gradient(90deg,#EF4444,#F97316,#FCD34D);border-radius:2px;margin-bottom:20px}
  .header{display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:16px;border-bottom:2px solid #E2E8F0;margin-bottom:16px}
  .hdr-badge{display:inline-block;padding:3px 10px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;background:#EF4444;color:#fff;margin-bottom:6px}
  .hdr-title{font-size:20px;font-weight:800;color:#0F172A;letter-spacing:-0.3px}
  .hdr-sub{font-size:11px;color:#64748B;margin-top:3px}
  .hdr-right{text-align:right}
  .hdr-date{font-size:13px;font-weight:700;color:#1E293B}
  .hdr-label{font-size:10px;color:#94A3B8;margin-top:2px}

  /* ── KPI Cards ── */
  .kpi-row{display:flex;gap:10px;margin-bottom:16px}
  .kpi{flex:1;border-radius:10px;padding:12px 16px;text-align:center;position:relative;overflow:hidden;border:1px solid #E2E8F0}
  .kpi::before{content:'';position:absolute;top:0;left:0;right:0;height:3px}
  .kpi-total::before{background:#1E293B}
  .kpi-acik::before{background:#EF4444}
  .kpi-kapandi::before{background:#22C55E}
  .kpi-oran::before{background:#F97316}
  .kpi-num{font-size:26px;font-weight:800;line-height:1;color:#0F172A}
  .kpi-acik .kpi-num{color:#DC2626}
  .kpi-kapandi .kpi-num{color:#16A34A}
  .kpi-oran .kpi-num{color:#EA580C}
  .kpi-label{font-size:10px;color:#64748B;margin-top:4px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px}

  /* ── Section title ── */
  .sec-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#64748B;margin-bottom:8px;display:flex;align-items:center;gap:6px}
  .sec-title::before{content:'';display:inline-block;width:3px;height:12px;background:#EF4444;border-radius:2px}

  /* ── Main table ── */
  table.main-tbl{width:100%;border-collapse:collapse;border:1px solid #D1D5DB;font-size:11px;table-layout:fixed}
  table.main-tbl thead tr{background:#1E293B}
  table.main-tbl thead th{
    padding:10px 7px;
    font-size:9.5px;
    font-weight:700;
    text-transform:uppercase;
    letter-spacing:0.7px;
    color:#E2E8F0;
    border-right:1px solid rgba(255,255,255,0.08);
    border-bottom:3px solid #EF4444;
    text-align:center;
    white-space:nowrap;
  }
  table.main-tbl thead th.th-left{text-align:left}
  table.main-tbl thead th:last-child{border-right:none}

  /* ── Summary tables ── */
  .summary-row{display:flex;gap:14px;margin-top:18px}
  .summary-box{flex:1}
  table.sum-tbl{width:100%;border-collapse:collapse;border:1px solid #E2E8F0;font-size:11px;border-radius:6px;overflow:hidden}
  table.sum-tbl thead tr{background:#334155}
  table.sum-tbl thead th{padding:8px 10px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:#E2E8F0;border-bottom:2px solid #EF4444;text-align:left}
  table.sum-tbl thead th:not(:first-child){text-align:center}

  /* ── Footer ── */
  .footer{display:flex;align-items:center;justify-content:space-between;margin-top:18px;padding-top:12px;border-top:1px solid #E2E8F0;font-size:10px;color:#64748B}
  .footer-brand{font-weight:700;color:#374151}

  @media print{
    body{background:#fff!important}
    .page{width:100%!important;padding:0 12px 20px!important}
    @page{size:A3 landscape;margin:0.6cm}
    tr{page-break-inside:avoid}
  }
</style>
</head>
<body>
<div class="page">

  <div class="top-accent"></div>

  <!-- Header -->
  <div class="header">
    <div>
      <div class="hdr-badge">DÖF — Saha Denetim Raporu</div>
      <div class="hdr-title">Düzeltici ve Önleyici Faaliyet Raporu</div>
      <div class="hdr-sub">ISG Denetim Yönetim Sistemi &nbsp;•&nbsp; Uygunsuzluk Kayıtları</div>
    </div>
    <div class="hdr-right">
      <div class="hdr-date">${printDate}</div>
      <div class="hdr-label">Rapor Tarihi</div>
    </div>
  </div>

  <!-- KPI Cards -->
  <div class="kpi-row">
    <div class="kpi kpi-total">
      <div class="kpi-num">${total}</div>
      <div class="kpi-label">Toplam Kayıt</div>
    </div>
    <div class="kpi kpi-acik">
      <div class="kpi-num">${acik}</div>
      <div class="kpi-label">Açık Uygunsuzluk</div>
    </div>
    <div class="kpi kpi-kapandi">
      <div class="kpi-num">${kapandi}</div>
      <div class="kpi-label">Kapatılan</div>
    </div>
    <div class="kpi kpi-oran">
      <div class="kpi-num">${kapanmaOran}%</div>
      <div class="kpi-label">Kapanma Oranı</div>
    </div>
  </div>

  <!-- Main Table -->
  <div class="sec-title">Kayıt Listesi</div>
  <table class="main-tbl">
    <colgroup>
      <col style="width:32px">
      <col style="width:80px">
      <col style="width:68px">
      <col style="width:100px">
      <col style="width:90px">
      <col style="width:110px">
      <col style="width:100px">
      <col style="width:160px">
      <col style="width:160px">
      <col style="width:80px">
      <col style="width:68px">
      <col style="width:68px">
      <col style="width:100px">
      <col style="width:60px">
      <col style="width:70px">
    </colgroup>
    <thead>
      <tr>
        <th>No</th>
        <th>DÖF No</th>
        <th>Tarih</th>
        <th class="th-left">Firma</th>
        <th class="th-left">Personel</th>
        <th class="th-left">Başlık</th>
        <th>Açılış Fotoğrafı</th>
        <th class="th-left">Uygunsuzluk Açıklaması</th>
        <th class="th-left">Alınması Gereken Önlemler</th>
        <th class="th-left">Sorumlu</th>
        <th>Hedef Tarih</th>
        <th>Kapanma Tarihi</th>
        <th>Kapanış Fotoğrafı</th>
        <th>Önem</th>
        <th>Durum</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="15" style="padding:20px;text-align:center;color:#9CA3AF;">Kayıt bulunamadı</td></tr>`}
    </tbody>
  </table>

  <!-- Summary Row -->
  <div class="summary-row">
    <div class="summary-box">
      <div class="sec-title" style="margin-top:0">Firma Dağılımı</div>
      <table class="sum-tbl">
        <thead><tr><th>Firma Adı</th><th>Kayıt</th><th>Oran</th></tr></thead>
        <tbody>
          ${firmaSummaryRows || `<tr><td colspan="3" style="padding:10px;text-align:center;color:#9CA3AF;">—</td></tr>`}
        </tbody>
      </table>
    </div>
    <div class="summary-box">
      <div class="sec-title" style="margin-top:0">Önem Dağılımı</div>
      <table class="sum-tbl">
        <thead><tr><th>Seviye</th><th>Kayıt</th><th>Oran</th></tr></thead>
        <tbody>
          ${sevSummaryRows || `<tr><td colspan="3" style="padding:10px;text-align:center;color:#9CA3AF;">—</td></tr>`}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <span class="footer-brand">ISG Denetim Yönetim Sistemi</span>
    <span>DÖF Raporu &nbsp;•&nbsp; ${total} kayıt &nbsp;•&nbsp; ${printDate}</span>
  </div>

</div>
</body>
</html>`;
}

// ─── PDF olarak direkt indir (print dialog yok) ───────────────────────────────
export async function printDofRaporu(
  records: Uygunsuzluk[],
  firmalar: Firma[],
  personeller: Personel[],
  getPhoto: (id: string, type: 'acilis' | 'kapatma') => string | undefined,
): Promise<void> {
  const photoMap = new Map<string, string>();
  const photoJobs: Promise<void>[] = [];

  records.forEach(r => {
    const acilisSrc = r.acilisFotoMevcut ? (getPhoto(r.id, 'acilis') ?? r.acilisFotoUrl) : undefined;
    const kapatmaSrc = r.kapatmaFotoMevcut ? (getPhoto(r.id, 'kapatma') ?? r.kapatmaFotoUrl) : undefined;
    if (acilisSrc) photoJobs.push(resolveToBase64(acilisSrc).then(b64 => { if (b64) photoMap.set(`${r.id}_acilis`, b64); }));
    if (kapatmaSrc) photoJobs.push(resolveToBase64(kapatmaSrc).then(b64 => { if (b64) photoMap.set(`${r.id}_kapatma`, b64); }));
  });

  await Promise.all(photoJobs);

  const html = buildHtml(records, firmalar, personeller, photoMap);

  // Direkt HTML dosyası olarak indir — tarayıcıda açılır, Ctrl+P ile yazdırılabilir
  const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const dateStr = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
  link.download = `${dateStr}-DOF-Raporu.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── Excel Export ─────────────────────────────────────────────────────────────
export async function exportDofToExcel(
  records: Uygunsuzluk[],
  firmalar: Firma[],
  personeller: Personel[],
  getPhoto?: (id: string, type: 'acilis' | 'kapatma') => string | undefined,
): Promise<void> {
  const photoMap = new Map<string, string>();
  const jobs: Promise<void>[] = [];

  records.forEach(r => {
    const acilisSrc = getPhoto ? (getPhoto(r.id, 'acilis') ?? r.acilisFotoUrl) : r.acilisFotoUrl;
    const kapatmaSrc = getPhoto ? (getPhoto(r.id, 'kapatma') ?? r.kapatmaFotoUrl) : r.kapatmaFotoUrl;
    if (acilisSrc) jobs.push(resolveToBase64(acilisSrc).then(b64 => { if (b64) photoMap.set(`${r.id}_acilis`, b64); }));
    if (kapatmaSrc) jobs.push(resolveToBase64(kapatmaSrc).then(b64 => { if (b64) photoMap.set(`${r.id}_kapatma`, b64); }));
  });

  await Promise.all(jobs);

  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ISG Denetim Sistemi';
  wb.created = new Date();

  const ws = wb.addWorksheet('DÖF Raporu', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  ws.columns = [
    { header: 'No', key: 'no', width: 6 },
    { header: 'DÖF No', key: 'dofNo', width: 16 },
    { header: 'Tarih', key: 'tarih', width: 13 },
    { header: 'Firma', key: 'firma', width: 28 },
    { header: 'Personel', key: 'personel', width: 22 },
    { header: 'Başlık', key: 'baslik', width: 32 },
    { header: 'Açılış Fotoğrafı', key: 'acilisFoto', width: 22 },
    { header: 'Uygunsuzluk Açıklaması', key: 'aciklama', width: 42 },
    { header: 'Alınması Gereken Önlemler', key: 'onlem', width: 42 },
    { header: 'Sorumlu', key: 'sorumlu', width: 20 },
    { header: 'Hedef Tarih', key: 'hedefTarih', width: 14 },
    { header: 'Kapanma Tarihi', key: 'kapatmaTarihi', width: 16 },
    { header: 'Kapanış Fotoğrafı', key: 'kapatmaFoto', width: 22 },
    { header: 'Önem', key: 'severity', width: 12 },
    { header: 'Durum', key: 'durum', width: 14 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FFEF4444' } } };
  });

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const firma = firmalar.find(f => f.id === r.firmaId);
    const personel = personeller.find(p => p.id === r.personelId);
    const rowBg = i % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';

    const rowData = {
      no: i + 1,
      dofNo: r.acilisNo ?? `DÖF-${i + 1}`,
      tarih: r.tarih ? new Date(r.tarih).toLocaleDateString('tr-TR') : '—',
      firma: firma?.ad ?? '—',
      personel: personel?.adSoyad ?? '—',
      baslik: r.baslik ?? '',
      acilisFoto: '',
      aciklama: r.aciklama ?? '',
      onlem: r.onlem ?? '',
      sorumlu: r.sorumlu ?? '',
      hedefTarih: r.hedefTarih ? new Date(r.hedefTarih).toLocaleDateString('tr-TR') : '',
      kapatmaTarihi: r.kapatmaTarihi ? new Date(r.kapatmaTarihi).toLocaleDateString('tr-TR') : '',
      kapatmaFoto: '',
      severity: r.severity,
      durum: r.durum,
    };

    const dataRow = ws.addRow(rowData);
    dataRow.height = 80;

    dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
      if (colNumber === 15) {
        const val = cell.value as string;
        if (val === 'Açık') {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFEF4444' } },
            bottom: { style: 'thin', color: { argb: 'FFEF4444' } },
            left: { style: 'thin', color: { argb: 'FFEF4444' } },
            right: { style: 'thin', color: { argb: 'FFEF4444' } },
          };
        } else if (val === 'Kapandı') {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A34A' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF22C55E' } },
            bottom: { style: 'thin', color: { argb: 'FF22C55E' } },
            left: { style: 'thin', color: { argb: 'FF22C55E' } },
            right: { style: 'thin', color: { argb: 'FF22C55E' } },
          };
        }
      }
      if (colNumber === 14) {
        const val = cell.value as string;
        const sevColors: Record<string, string> = { 'Kritik': 'FFDC2626', 'Yüksek': 'FFD97706', 'Orta': 'FFCA8A04', 'Düşük': 'FF16A34A' };
        if (sevColors[val]) { cell.font = { bold: true, color: { argb: sevColors[val] }, size: 11 }; cell.alignment = { horizontal: 'center', vertical: 'middle' }; }
      }
    });

    const acilisB64 = photoMap.get(`${r.id}_acilis`);
    const kapatmaB64 = photoMap.get(`${r.id}_kapatma`);

    const addPhoto = async (b64: string, col: number) => {
      try {
        const [meta, data] = b64.split(',');
        const mime = (meta.match(/data:([^;]+);/) ?? [])[1] ?? 'image/jpeg';
        const ext = mime.includes('png') ? 'png' : mime.includes('gif') ? 'gif' : 'jpeg';
        const imageId = wb.addImage({ base64: data, extension: ext as 'jpeg' | 'png' | 'gif' });
        ws.addImage(imageId, { tl: { col: col - 1, row: i + 1 }, br: { col: col, row: i + 2 }, editAs: 'oneCell' });
        dataRow.getCell(col).value = '';
      } catch { /* sessizce geç */ }
    };

    if (acilisB64) await addPhoto(acilisB64, 7);
    else { const c = dataRow.getCell(7); c.value = r.acilisFotoMevcut ? 'Yüklenemedi' : '—'; c.font = { color: { argb: r.acilisFotoMevcut ? 'FFCA8A04' : 'FF9CA3AF' }, size: 10 }; c.alignment = { horizontal: 'center', vertical: 'middle' }; }

    if (kapatmaB64) await addPhoto(kapatmaB64, 13);
    else { const c = dataRow.getCell(13); c.value = r.kapatmaFotoMevcut ? 'Yüklenemedi' : '—'; c.font = { color: { argb: r.kapatmaFotoMevcut ? 'FFCA8A04' : 'FF9CA3AF' }, size: 10 }; c.alignment = { horizontal: 'center', vertical: 'middle' }; }
  }

  ws.views = [{ state: 'frozen', ySplit: 1 }];

  // Özet sayfası
  const wsSummary = wb.addWorksheet('Özet');
  wsSummary.columns = [{ header: '', key: 'label', width: 30 }, { header: '', key: 'value', width: 22 }];
  const summaryRows: (string | number)[][] = [
    ['DÖF RAPORU ÖZETİ', ''],
    ['Oluşturma Tarihi', new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })],
    ['', ''],
    ['Toplam Kayıt', records.length],
    ['Açık Uygunsuzluk', records.filter(r => r.durum === 'Açık').length],
    ['Kapatılan', records.filter(r => r.durum === 'Kapandı').length],
    ['Kapanma Oranı (%)', records.length > 0 ? Math.round((records.filter(r => r.durum === 'Kapandı').length / records.length) * 100) : 0],
    ['', ''],
    ['FİRMA DAĞILIMI', ''],
    ...Object.entries(records.reduce<Record<string, number>>((acc, r) => {
      const ad = firmalar.find(f => f.id === r.firmaId)?.ad ?? 'Bilinmiyor';
      acc[ad] = (acc[ad] ?? 0) + 1; return acc;
    }, {})).map(([firma, count]) => [firma, count]),
  ];
  summaryRows.forEach((rowData, idx) => {
    const row = wsSummary.addRow(rowData);
    if (idx === 0 || idx === 8) {
      row.getCell(1).font = { bold: true, size: 13, color: { argb: 'FF1E293B' } };
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    }
    row.height = 22;
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const date = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
  link.download = `${date}-DOF-Raporu.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
