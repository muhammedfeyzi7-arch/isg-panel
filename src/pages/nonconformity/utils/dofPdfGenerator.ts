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

export async function exportDofToExcel(
  records: Uygunsuzluk[],
  firmalar: Firma[],
  personeller: Personel[],
): Promise<void> {
  const XLSX = await import('xlsx-js-style');

  const headers = [
    'No', 'DÖF No', 'Tarih', 'Firma', 'Personel', 'Başlık',
    'Uygunsuzluk Açıklaması', 'Alınması Gereken Önlemler',
    'Sorumlu', 'Hedef Tarih', 'Kapanma Tarihi', 'Durum',
  ];

  const rows = records.map((r, i) => {
    const firma = firmalar.find(f => f.id === r.firmaId);
    const personel = personeller.find(p => p.id === r.personelId);
    return [
      i + 1,
      r.acilisNo ?? `DÖF-${i + 1}`,
      r.tarih ? new Date(r.tarih).toLocaleDateString('tr-TR') : '—',
      firma?.ad ?? '—',
      personel?.adSoyad ?? '—',
      r.baslik ?? '',
      r.aciklama ?? '',
      r.onlem ?? '',
      r.sorumlu ?? '',
      r.hedefTarih ? new Date(r.hedefTarih).toLocaleDateString('tr-TR') : '',
      r.kapatmaTarihi ? new Date(r.kapatmaTarihi).toLocaleDateString('tr-TR') : '',
      r.durum,
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Kolon genişlikleri
  ws['!cols'] = [
    { wch: 5 },   // No
    { wch: 14 },  // DÖF No
    { wch: 12 },  // Tarih
    { wch: 28 },  // Firma
    { wch: 22 },  // Personel
    { wch: 32 },  // Başlık
    { wch: 45 },  // Açıklama
    { wch: 45 },  // Önlemler
    { wch: 22 },  // Sorumlu
    { wch: 14 },  // Hedef Tarih
    { wch: 14 },  // Kapanma Tarihi
    { wch: 14 },  // Durum
  ];

  // Başlık satırı stilini ayarla
  const headerRange = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!ws[cellAddr]) continue;
    ws[cellAddr].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      fill: { fgColor: { rgb: '1E293B' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        bottom: { style: 'medium', color: { rgb: 'EF4444' } },
      },
    };
  }

  // Veri satırlarını stillendir
  for (let row = 1; row <= rows.length; row++) {
    const isEven = row % 2 === 0;
    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
      const cellAddr = XLSX.utils.encode_cell({ r: row, c: col });
      if (!ws[cellAddr]) {
        ws[cellAddr] = { t: 's', v: '' };
      }
      ws[cellAddr].s = {
        fill: { fgColor: { rgb: isEven ? 'F8FAFC' : 'FFFFFF' } },
        alignment: { vertical: 'top', wrapText: true },
        border: {
          bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
          right: { style: 'thin', color: { rgb: 'E5E7EB' } },
        },
      };

      // Durum sütununu renklendir (son sütun = index 11)
      if (col === 11) {
        const val = ws[cellAddr].v;
        if (val === 'Açık') {
          ws[cellAddr].s.font = { bold: true, color: { rgb: 'DC2626' } };
        } else if (val === 'Kapandı') {
          ws[cellAddr].s.font = { bold: true, color: { rgb: '16A34A' } };
        }
      }
    }
  }

  // Satır yükseklikleri
  ws['!rows'] = [
    { hpt: 28 }, // başlık
    ...rows.map(() => ({ hpt: 60 })), // veri satırları
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DÖF Raporu');

  // Özet sayfası
  const summaryData = [
    ['DÖF RAPORU ÖZETİ', ''],
    ['Oluşturma Tarihi', new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })],
    ['', ''],
    ['Toplam Kayıt', records.length],
    ['Açık Uygunsuzluk', records.filter(r => r.durum === 'Açık').length],
    ['Kapatılan', records.filter(r => r.durum === 'Kapandı').length],
    ['', ''],
    ['Firma Dağılımı', ''],
    ...Object.entries(
      records.reduce<Record<string, number>>((acc, r) => {
        const firmAd = firmalar.find(f => f.id === r.firmaId)?.ad ?? 'Bilinmiyor';
        acc[firmAd] = (acc[firmAd] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([firma, count]) => [firma, count]),
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 28 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Özet');

  const xlsxData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob(
    [xlsxData],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  );
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