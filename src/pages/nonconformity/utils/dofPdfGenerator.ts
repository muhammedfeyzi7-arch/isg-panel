import type { Uygunsuzluk, Firma, Personel } from '../../../types';

function esc(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, ' ');
}

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Supabase Storage URL'ini base64'e çevir (cross-origin print sorunu için)
async function urlToBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Fotoğraf src'sini hazırla: URL ise base64'e çevir, base64 ise direkt kullan
async function resolvePhotoSrc(src: string | undefined): Promise<string | null> {
  if (!src) return null;
  if (src.startsWith('data:')) return src; // zaten base64
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return await urlToBase64(src);
  }
  return null;
}

function severityBadge(severity: string): string {
  const map: Record<string, { bg: string; color: string }> = {
    'Kritik':  { bg: '#FEE2E2', color: '#DC2626' },
    'Yüksek':  { bg: '#FEF3C7', color: '#D97706' },
    'Orta':    { bg: '#FEF9C3', color: '#CA8A04' },
    'Düşük':   { bg: '#DCFCE7', color: '#16A34A' },
  };
  const s = map[severity] ?? { bg: '#F1F5F9', color: '#64748B' };
  return `<span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;background:${s.bg};color:${s.color};white-space:nowrap;">${esc(severity)}</span>`;
}

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

  // Firma dağılımı özeti
  const firmaDagilim = Object.entries(
    records.reduce<Record<string, number>>((acc, r) => {
      const ad = firmalar.find(f => f.id === r.firmaId)?.ad ?? 'Bilinmiyor';
      acc[ad] = (acc[ad] ?? 0) + 1;
      return acc;
    }, {}),
  );

  const photoCell = (src: string | undefined) => src
    ? `<img src="${src}" style="max-width:88px;max-height:66px;object-fit:cover;border-radius:5px;border:1px solid #E2E8F0;display:block;margin:0 auto;" alt="foto" />`
    : `<span style="color:#CBD5E1;font-size:11px;display:block;text-align:center;">—</span>`;

  const rows = records.map((r, i) => {
    const firma = firmalar.find(f => f.id === r.firmaId);
    const personel = personeller.find(p => p.id === r.personelId);
    const acilisFoto = r.acilisFotoMevcut ? photoMap.get(`${r.id}_acilis`) : undefined;
    const kapatmaFoto = r.kapatmaFotoMevcut ? photoMap.get(`${r.id}_kapatma`) : undefined;
    const isKapandi = r.durum === 'Kapandı';
    // Excel zebra: çift satır #F8FAFC, tek satır #FFFFFF
    const rowBg = i % 2 === 0 ? '#FFFFFF' : '#F8FAFC';

    const durumBadge = isKapandi
      ? `<span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:#DCFCE7;color:#16A34A;border:1px solid #BBF7D0;white-space:nowrap;">✓ Kapandı</span>`
      : `<span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:#FEE2E2;color:#DC2626;border:1px solid #FECACA;white-space:nowrap;">● Açık</span>`;

    const tdBase = `padding:10px 8px;vertical-align:top;border-bottom:1px solid #E5E7EB;border-right:1px solid #E5E7EB;`;

    return `
    <tr style="background:${rowBg};page-break-inside:avoid;">
      <td style="${tdBase}text-align:center;font-weight:800;font-size:13px;color:#374151;">${i + 1}</td>
      <td style="${tdBase}">
        <div style="font-size:10px;font-family:'Courier New',monospace;font-weight:700;color:#6366F1;margin-bottom:3px;">${esc(r.acilisNo ?? `DÖF-${i + 1}`)}</div>
        <div style="font-size:11px;font-weight:600;color:#374151;white-space:nowrap;">${esc(fmtDate(r.tarih))}</div>
        <div style="font-size:10px;color:#6B7280;margin-top:3px;">${esc(firma?.ad ?? '—')}</div>
        ${personel ? `<div style="font-size:10px;color:#9CA3AF;margin-top:2px;">${esc(personel.adSoyad)}</div>` : ''}
      </td>
      <td style="${tdBase}text-align:center;">${photoCell(acilisFoto)}</td>
      <td style="${tdBase}">
        <div style="font-size:12px;font-weight:700;color:#111827;margin-bottom:4px;">${esc(r.baslik)}</div>
        ${r.aciklama ? `<div style="font-size:11px;color:#374151;line-height:1.55;margin-bottom:4px;">${esc(r.aciklama)}</div>` : ''}
        <div style="margin-top:4px;">${severityBadge(r.severity)}</div>
      </td>
      <td style="${tdBase}">
        <div style="font-size:11px;color:#374151;line-height:1.55;">${r.onlem ? esc(r.onlem) : '<span style="color:#9CA3AF;">—</span>'}</div>
        ${r.sorumlu ? `<div style="font-size:10px;color:#6B7280;margin-top:5px;font-weight:600;">Sorumlu: ${esc(r.sorumlu)}</div>` : ''}
        ${r.hedefTarih ? `<div style="font-size:10px;color:#6B7280;">Hedef: ${esc(fmtDate(r.hedefTarih))}</div>` : ''}
      </td>
      <td style="${tdBase}text-align:center;">${photoCell(kapatmaFoto)}</td>
      <td style="${tdBase}text-align:center;border-right:none;">
        ${durumBadge}
        ${r.kapatmaTarihi ? `<div style="font-size:10px;color:#6B7280;margin-top:5px;">${esc(fmtDate(r.kapatmaTarihi))}</div>` : ''}
      </td>
    </tr>`;
  }).join('');

  const firmaSummaryRows = firmaDagilim.map(([ad, count]) => `
    <tr>
      <td style="padding:5px 10px;font-size:11px;color:#374151;border-bottom:1px solid #F1F5F9;">${esc(ad)}</td>
      <td style="padding:5px 10px;font-size:11px;font-weight:700;color:#1E293B;text-align:center;border-bottom:1px solid #F1F5F9;">${count}</td>
      <td style="padding:5px 10px;font-size:11px;color:#64748B;text-align:center;border-bottom:1px solid #F1F5F9;">${Math.round((count / total) * 100)}%</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>DÖF Raporu — ${printDate}</title>
<style>
  *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#1E293B;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{width:1060px;margin:0 auto;padding:28px 32px 40px}

  /* ── Üst şerit ── */
  .top-bar{height:5px;background:linear-gradient(90deg,#EF4444 0%,#F97316 55%,#FCD34D 100%);margin-bottom:22px;border-radius:2px}

  /* ── Header ── */
  .header{display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:16px;border-bottom:2px solid #E2E8F0;margin-bottom:18px}
  .hdr-left{}
  .hdr-badge{display:inline-block;padding:3px 10px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;background:#EF4444;color:#fff;margin-bottom:6px}
  .hdr-title{font-size:22px;font-weight:800;color:#0F172A;letter-spacing:-0.3px}
  .hdr-sub{font-size:11px;color:#64748B;margin-top:3px}
  .hdr-right{text-align:right}
  .hdr-date{font-size:12px;font-weight:600;color:#374151}
  .hdr-label{font-size:10px;color:#94A3B8;margin-top:2px}

  /* ── Özet kartlar ── */
  .summary{display:flex;gap:10px;margin-bottom:18px}
  .sum-box{flex:1;border:1px solid #E2E8F0;border-radius:8px;padding:12px 16px;text-align:center;position:relative;overflow:hidden}
  .sum-box::before{content:'';position:absolute;top:0;left:0;right:0;height:3px}
  .sum-total::before{background:#1E293B}
  .sum-acik::before{background:#EF4444}
  .sum-kapandi::before{background:#22C55E}
  .sum-oran::before{background:#F97316}
  .sum-num{font-size:24px;font-weight:800;color:#0F172A;line-height:1}
  .sum-label{font-size:10px;color:#64748B;margin-top:4px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px}
  .sum-acik .sum-num{color:#DC2626}
  .sum-kapandi .sum-num{color:#16A34A}
  .sum-oran .sum-num{color:#EA580C}

  /* ── Ana tablo ── */
  .section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748B;margin-bottom:8px;padding-left:2px}
  table.dof-table{width:100%;border-collapse:collapse;border:1px solid #D1D5DB;font-size:12px;border-radius:6px;overflow:hidden}
  table.dof-table thead tr{background:#1E293B}
  table.dof-table thead th{
    padding:11px 8px;
    text-align:center;
    font-size:10px;
    font-weight:700;
    text-transform:uppercase;
    letter-spacing:0.8px;
    color:#94A3B8;
    border-right:1px solid rgba(255,255,255,0.07);
    border-bottom:3px solid #EF4444;
  }
  table.dof-table thead th:last-child{border-right:none}
  table.dof-table thead th.th-left{text-align:left}

  /* ── Firma özet tablosu ── */
  .firma-section{margin-top:20px;display:flex;gap:16px;align-items:flex-start}
  .firma-table-wrap{flex:1}
  table.firma-table{width:100%;border-collapse:collapse;border:1px solid #E2E8F0;border-radius:6px;overflow:hidden;font-size:11px}
  table.firma-table thead tr{background:#334155}
  table.firma-table thead th{padding:8px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:#94A3B8;border-bottom:2px solid #EF4444}
  table.firma-table thead th:not(:first-child){text-align:center}

  /* ── Footer ── */
  .footer{display:flex;align-items:center;justify-content:space-between;margin-top:20px;padding-top:12px;border-top:1px solid #E2E8F0;font-size:10px;color:#94A3B8}
  .footer-brand{font-weight:700;color:#64748B}

  @media print{
    body{background:#fff!important}
    .page{width:100%!important;padding:0 16px 20px!important}
    .no-print{display:none!important}
    @page{size:A4 landscape;margin:0.8cm}
  }
</style>
</head>
<body>
<div class="page">
  <div class="top-bar"></div>

  <div class="header">
    <div class="hdr-left">
      <div class="hdr-badge">DÖF</div>
      <div class="hdr-title">Düzeltici ve Önleyici Faaliyet Raporu</div>
      <div class="hdr-sub">Uygunsuzluk Yönetimi — ISG Denetim Sistemi</div>
    </div>
    <div class="hdr-right">
      <div class="hdr-date">${printDate}</div>
      <div class="hdr-label">Oluşturma Tarihi</div>
    </div>
  </div>

  <div class="summary">
    <div class="sum-box sum-total">
      <div class="sum-num">${total}</div>
      <div class="sum-label">Toplam Kayıt</div>
    </div>
    <div class="sum-box sum-acik">
      <div class="sum-num">${acik}</div>
      <div class="sum-label">Açık Uygunsuzluk</div>
    </div>
    <div class="sum-box sum-kapandi">
      <div class="sum-num">${kapandi}</div>
      <div class="sum-label">Kapatılan</div>
    </div>
    <div class="sum-box sum-oran">
      <div class="sum-num">${total > 0 ? Math.round((kapandi / total) * 100) : 0}%</div>
      <div class="sum-label">Kapanma Oranı</div>
    </div>
  </div>

  <div class="section-title">Kayıt Listesi</div>
  <table class="dof-table">
    <thead>
      <tr>
        <th style="width:36px">No</th>
        <th class="th-left" style="width:115px">DÖF No / Tarih</th>
        <th style="width:96px">Açılış Foto</th>
        <th class="th-left">Uygunsuzluk Açıklaması</th>
        <th class="th-left">Alınması Gereken Önlemler</th>
        <th style="width:96px">Kapanma Foto</th>
        <th style="width:88px">Durum</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="firma-section">
    <div class="firma-table-wrap">
      <div class="section-title" style="margin-top:0">Firma Dağılımı</div>
      <table class="firma-table">
        <thead>
          <tr>
            <th>Firma Adı</th>
            <th>Kayıt Sayısı</th>
            <th>Oran</th>
          </tr>
        </thead>
        <tbody>
          ${firmaSummaryRows || `<tr><td colspan="3" style="padding:10px;text-align:center;color:#9CA3AF;">—</td></tr>`}
        </tbody>
      </table>
    </div>
  </div>

  <div class="footer">
    <span class="footer-brand">ISG Denetim Sistemi</span>
    <span>DÖF Raporu &nbsp;•&nbsp; Toplam ${total} kayıt &nbsp;•&nbsp; ${printDate}</span>
  </div>
</div>
</body>
</html>`;
}

export async function printDofRaporu(
  records: Uygunsuzluk[],
  firmalar: Firma[],
  personeller: Personel[],
  getPhoto: (id: string, type: 'acilis' | 'kapatma') => string | undefined,
): Promise<void> {
  // Tüm fotoğrafları önceden base64'e çevir (cross-origin print sorunu için)
  const photoMap = new Map<string, string>();
  const photoJobs: Promise<void>[] = [];

  records.forEach(r => {
    if (r.acilisFotoMevcut) {
      const src = getPhoto(r.id, 'acilis');
      if (src) {
        photoJobs.push(
          resolvePhotoSrc(src).then(b64 => {
            if (b64) photoMap.set(`${r.id}_acilis`, b64);
          }),
        );
      }
    }
    if (r.kapatmaFotoMevcut) {
      const src = getPhoto(r.id, 'kapatma');
      if (src) {
        photoJobs.push(
          resolvePhotoSrc(src).then(b64 => {
            if (b64) photoMap.set(`${r.id}_kapatma`, b64);
          }),
        );
      }
    }
  });

  await Promise.all(photoJobs);

  const html = buildHtml(records, firmalar, personeller, photoMap);
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

// Fotoğraf URL'sini base64'e çevir (Excel için)
async function photoUrlToBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportDofToExcel(
  records: Uygunsuzluk[],
  firmalar: Firma[],
  personeller: Personel[],
  getPhoto?: (id: string, type: 'acilis' | 'kapatma') => string | undefined,
): Promise<void> {
  // Fotoğrafları önceden çek (URL → base64)
  const photoMap = new Map<string, string>();
  if (getPhoto) {
    const jobs: Promise<void>[] = [];
    records.forEach(r => {
      if (r.acilisFotoMevcut) {
        const src = getPhoto(r.id, 'acilis') ?? r.acilisFotoUrl;
        if (src && src.startsWith('http')) {
          jobs.push(photoUrlToBase64(src).then(b64 => { if (b64) photoMap.set(`${r.id}_acilis`, b64); }));
        } else if (src && src.startsWith('data:')) {
          photoMap.set(`${r.id}_acilis`, src);
        }
      }
      if (r.kapatmaFotoMevcut) {
        const src = getPhoto(r.id, 'kapatma') ?? r.kapatmaFotoUrl;
        if (src && src.startsWith('http')) {
          jobs.push(photoUrlToBase64(src).then(b64 => { if (b64) photoMap.set(`${r.id}_kapatma`, b64); }));
        } else if (src && src.startsWith('data:')) {
          photoMap.set(`${r.id}_kapatma`, src);
        }
      }
    });
    await Promise.all(jobs);
  } else {
    // getPhoto verilmemişse direkt URL'leri kullan
    const jobs: Promise<void>[] = [];
    records.forEach(r => {
      if (r.acilisFotoUrl && r.acilisFotoUrl.startsWith('http')) {
        jobs.push(photoUrlToBase64(r.acilisFotoUrl).then(b64 => { if (b64) photoMap.set(`${r.id}_acilis`, b64); }));
      }
      if (r.kapatmaFotoUrl && r.kapatmaFotoUrl.startsWith('http')) {
        jobs.push(photoUrlToBase64(r.kapatmaFotoUrl).then(b64 => { if (b64) photoMap.set(`${r.id}_kapatma`, b64); }));
      }
    });
    await Promise.all(jobs);
  }

  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ISG Denetim Sistemi';
  wb.created = new Date();

  // ── Ana Sayfa ──
  const ws = wb.addWorksheet('DÖF Raporu', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  // Sütun tanımları
  ws.columns = [
    { header: 'No', key: 'no', width: 6 },
    { header: 'DÖF No', key: 'dofNo', width: 16 },
    { header: 'Tarih', key: 'tarih', width: 13 },
    { header: 'Firma', key: 'firma', width: 28 },
    { header: 'Personel', key: 'personel', width: 22 },
    { header: 'Başlık', key: 'baslik', width: 32 },
    { header: 'Uygunsuzluk Açıklaması', key: 'aciklama', width: 42 },
    { header: 'Alınması Gereken Önlemler', key: 'onlem', width: 42 },
    { header: 'Sorumlu', key: 'sorumlu', width: 20 },
    { header: 'Hedef Tarih', key: 'hedefTarih', width: 14 },
    { header: 'Kapanma Tarihi', key: 'kapatmaTarihi', width: 16 },
    { header: 'Önem', key: 'severity', width: 12 },
    { header: 'Durum', key: 'durum', width: 14 },
    { header: 'Açılış Fotoğrafı', key: 'acilisFoto', width: 22 },
    { header: 'Kapanış Fotoğrafı', key: 'kapatmaFoto', width: 22 },
  ];

  // Başlık satırı stili
  const headerRow = ws.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FFEF4444' } },
    };
  });

  // Veri satırları
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const firma = firmalar.find(f => f.id === r.firmaId);
    const personel = personeller.find(p => p.id === r.personelId);
    const isEven = i % 2 === 0;
    const rowBg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

    const rowData = {
      no: i + 1,
      dofNo: r.acilisNo ?? `DÖF-${i + 1}`,
      tarih: r.tarih ? new Date(r.tarih).toLocaleDateString('tr-TR') : '—',
      firma: firma?.ad ?? '—',
      personel: personel?.adSoyad ?? '—',
      baslik: r.baslik ?? '',
      aciklama: r.aciklama ?? '',
      onlem: r.onlem ?? '',
      sorumlu: r.sorumlu ?? '',
      hedefTarih: r.hedefTarih ? new Date(r.hedefTarih).toLocaleDateString('tr-TR') : '',
      kapatmaTarihi: r.kapatmaTarihi ? new Date(r.kapatmaTarihi).toLocaleDateString('tr-TR') : '',
      severity: r.severity,
      durum: r.durum,
      acilisFoto: '',
      kapatmaFoto: '',
    };

    const dataRow = ws.addRow(rowData);
    dataRow.height = 80;

    // Satır stili
    dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
      // Durum sütunu rengi (col 13)
      if (colNumber === 13) {
        const val = cell.value as string;
        if (val === 'Açık') {
          cell.font = { bold: true, color: { argb: 'FFDC2626' }, size: 11 };
        } else if (val === 'Kapandı') {
          cell.font = { bold: true, color: { argb: 'FF16A34A' }, size: 11 };
        }
      }
      // Önem sütunu rengi (col 12)
      if (colNumber === 12) {
        const val = cell.value as string;
        const sevColors: Record<string, string> = {
          'Kritik': 'FFDC2626', 'Yüksek': 'FFD97706', 'Orta': 'FFCA8A04', 'Düşük': 'FF16A34A',
        };
        if (sevColors[val]) cell.font = { bold: true, color: { argb: sevColors[val] }, size: 11 };
      }
    });

    // Fotoğrafları ekle (col 14 = Açılış, col 15 = Kapanış)
    const acilisB64 = photoMap.get(`${r.id}_acilis`);
    const kapatmaB64 = photoMap.get(`${r.id}_kapatma`);

    const addPhoto = async (b64: string, col: number) => {
      try {
        const [meta, data] = b64.split(',');
        const mimeMatch = meta.match(/data:([^;]+);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const ext = mime.includes('png') ? 'png' : mime.includes('gif') ? 'gif' : 'jpeg';
        const imageId = wb.addImage({ base64: data, extension: ext as 'jpeg' | 'png' | 'gif' });
        // Satır index (0-based): i+1 (başlık row=0)
        ws.addImage(imageId, {
          tl: { col: col - 1, row: i + 1 },
          br: { col: col, row: i + 2 },
          editAs: 'oneCell',
        });
        // Hücredeki metni temizle
        const cell = dataRow.getCell(col);
        cell.value = '';
      } catch { /* fotoğraf eklenemezse sessizce geç */ }
    };

    if (acilisB64) await addPhoto(acilisB64, 14);
    else {
      const cell = dataRow.getCell(14);
      cell.value = r.acilisFotoUrl ? '🔗 Fotoğraf var (URL)' : '—';
      cell.font = { color: { argb: r.acilisFotoUrl ? 'FF6366F1' : 'FF9CA3AF' }, size: 10 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }

    if (kapatmaB64) await addPhoto(kapatmaB64, 15);
    else {
      const cell = dataRow.getCell(15);
      cell.value = r.kapatmaFotoUrl ? '🔗 Fotoğraf var (URL)' : '—';
      cell.font = { color: { argb: r.kapatmaFotoUrl ? 'FF16A34A' : 'FF9CA3AF' }, size: 10 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  }

  // Freeze header row
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  // ── Özet Sayfası ──
  const wsSummary = wb.addWorksheet('Özet');
  wsSummary.columns = [{ header: '', key: 'label', width: 30 }, { header: '', key: 'value', width: 22 }];

  const summaryRows = [
    ['DÖF RAPORU ÖZETİ', ''],
    ['Oluşturma Tarihi', new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })],
    ['', ''],
    ['Toplam Kayıt', records.length],
    ['Açık Uygunsuzluk', records.filter(r => r.durum === 'Açık').length],
    ['Kapatılan', records.filter(r => r.durum === 'Kapandı').length],
    ['Kapanma Oranı (%)', records.length > 0 ? Math.round((records.filter(r => r.durum === 'Kapandı').length / records.length) * 100) : 0],
    ['', ''],
    ['FIRMA DAĞILIMI', ''],
    ...Object.entries(
      records.reduce<Record<string, number>>((acc, r) => {
        const firmAd = firmalar.find(f => f.id === r.firmaId)?.ad ?? 'Bilinmiyor';
        acc[firmAd] = (acc[firmAd] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([firma, count]) => [firma, count]),
  ];

  summaryRows.forEach((rowData, idx) => {
    const row = wsSummary.addRow(rowData);
    if (idx === 0 || idx === 8) {
      row.getCell(1).font = { bold: true, size: 13, color: { argb: 'FF1E293B' } };
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    }
    row.height = 22;
  });

  // Excel dosyasını indir
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const date = new Date().toLocaleDateString('tr-TR');
  link.download = `${date} DÖF Raporu.xlsx`;
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