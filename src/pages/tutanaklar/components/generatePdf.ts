import type { Tutanak, Firma } from '../../../types';

const STATUS_COLORS: Record<string, string> = {
  'Taslak':     '#64748B',
  'Tamamlandı': '#10B981',
  'Onaylandı':  '#0EA5E9',
  'İptal':      '#EF4444',
};

const STATUS_BG: Record<string, string> = {
  'Taslak':     '#F1F5F9',
  'Tamamlandı': '#ECFDF5',
  'Onaylandı':  '#F0F9FF',
  'İptal':      '#FEF2F2',
};

function esc(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

function buildHtml(tutanak: Tutanak, firma: Firma | undefined, dosyaVeri?: string): string {
  const tarihStr = tutanak.tarih
    ? new Date(tutanak.tarih).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—';
  const olusturmaTarih = new Date(tutanak.olusturmaTarihi).toLocaleDateString('tr-TR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const printDate = new Date().toLocaleDateString('tr-TR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const stColor = STATUS_COLORS[tutanak.durum] ?? '#64748B';
  const stBg    = STATUS_BG[tutanak.durum]    ?? '#F1F5F9';

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tutanak ${esc(tutanak.tutanakNo)}</title>
<style>
  /* ── Reset ── */
  *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }

  /* ── Base ── */
  html { font-size: 13px; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    color: #1E293B;
    background: #ffffff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Page wrapper ── */
  .page {
    width: 794px;
    margin: 0 auto;
    padding: 40px 48px 48px;
  }

  /* ── HEADER ── */
  .hdr {
    display: table;
    width: 100%;
    border-collapse: collapse;
    padding-bottom: 18px;
    border-bottom: 2.5px solid #6366F1;
    margin-bottom: 24px;
  }
  .hdr-left  { display: table-cell; vertical-align: middle; }
  .hdr-right { display: table-cell; vertical-align: middle; text-align: right; white-space: nowrap; }
  .hdr-tc    { font-size:10px; letter-spacing:4px; font-weight:700; color:#64748B; text-transform:uppercase; margin-bottom:2px; }
  .hdr-title { font-size:19px; font-weight:800; color:#0F172A; line-height:1.2; }
  .hdr-sub   { font-size:12px; font-weight:500; color:#475569; margin-top:2px; }
  .no-lbl    { font-size:10px; color:#94A3B8; text-transform:uppercase; letter-spacing:1px; margin-bottom:5px; }
  .no-val    { display:inline-block; font-size:14px; font-weight:800; color:#6366F1;
               font-family:'Courier New',monospace; background:#EEF2FF;
               padding:5px 14px; border-radius:6px; border:1px solid #C7D2FE; letter-spacing:1px; }

  /* ── Title row ── */
  .title-row {
    display: table; width: 100%;
    background: #F8FAFC; border: 1px solid #E2E8F0;
    border-radius: 10px; padding: 14px 18px;
    margin-bottom: 20px;
  }
  .title-cell  { display:table-cell; vertical-align:middle; }
  .title-badge { display:table-cell; vertical-align:middle; text-align:right; white-space:nowrap; padding-left:16px; }
  .tlabel { font-size:10px; color:#94A3B8; text-transform:uppercase; letter-spacing:1px; margin-bottom:3px; }
  .ttitle { font-size:16px; font-weight:800; color:#0F172A; }
  .badge {
    display:inline-block;
    font-size:11px; font-weight:700;
    padding: 4px 14px; border-radius:20px;
  }

  /* ── Info table ── */
  .info-tbl { width:100%; border-collapse:separate; border-spacing:8px; margin-bottom:20px; }
  .info-cell {
    width:50%; background:#F8FAFC; border:1px solid #E2E8F0;
    border-radius:8px; padding:10px 14px; vertical-align:top;
  }
  .icell-lbl { font-size:10px; color:#94A3B8; text-transform:uppercase; letter-spacing:1px; margin-bottom:3px; }
  .icell-val { font-size:13px; font-weight:600; color:#1E293B; }

  /* ── Section ── */
  .sec { margin-bottom:20px; }
  .sec-head { display:table; margin-bottom:10px; }
  .sec-bar  { display:table-cell; width:4px; background:#6366F1; border-radius:4px; }
  .sec-bar.amber { background:#F59E0B; }
  .sec-lbl  { display:table-cell; vertical-align:middle; padding-left:8px;
              font-size:10.5px; font-weight:700; text-transform:uppercase;
              letter-spacing:1.5px; color:#475569; }
  .sec-body {
    background:#F8FAFC; border:1px solid #E2E8F0;
    border-radius:10px; padding:14px 16px;
    font-size:13px; line-height:1.75; color:#374151;
    white-space:pre-wrap; word-wrap:break-word;
  }
  .sec-body.notes { background:#FFFBEB; border-color:#FDE68A; color:#78716C; font-style:italic; }

  /* ── Attachment (non-image) ── */
  .attach {
    display:table; width:100%; background:#ECFDF5;
    border:1px solid #A7F3D0; border-radius:8px;
    padding:10px 14px; margin-bottom:20px;
  }
  .attach-icon { display:table-cell; vertical-align:middle; font-size:20px; padding-right:10px; }
  .attach-info { display:table-cell; vertical-align:middle; }
  .attach-lbl  { font-size:10px; color:#6B7280; }
  .attach-name { font-size:13px; font-weight:600; color:#1E293B; }

  /* ── Attachment (image) ── */
  .attach-img-wrap {
    margin-bottom: 20px;
    border: 1px solid #A7F3D0;
    border-radius: 10px;
    overflow: hidden;
    page-break-inside: avoid;
  }
  .attach-img-sec-head {
    background: #ECFDF5;
    padding: 7px 14px;
    border-bottom: 1px solid #A7F3D0;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: #059669;
  }
  .attach-img-body {
    background: #F9FAFB;
    padding: 14px;
    text-align: center;
  }
  .attach-img-body img {
    max-width: 100%;
    max-height: 340px;
    object-fit: contain;
    border-radius: 6px;
    display: block;
    margin: 0 auto;
    border: 1px solid #E2E8F0;
  }
  .attach-img-footer {
    background: #ECFDF5;
    padding: 7px 14px;
    border-top: 1px solid #A7F3D0;
    font-size: 11px;
    color: #374151;
    font-weight: 500;
  }

  /* ── Divider ── */
  .divider { border:none; border-top:1px solid #E2E8F0; margin:22px 0; }

  /* ── Signature ── */
  .sig-wrap { border:1px solid #E2E8F0; border-radius:10px; overflow:hidden; margin-bottom:24px; }
  .sig-head { background:#F8FAFC; padding:10px 16px; border-bottom:1px solid #E2E8F0;
              font-size:10px; font-weight:700; text-transform:uppercase;
              letter-spacing:1.5px; color:#94A3B8; }
  .sig-body { display:table; width:100%; padding:16px; }
  .sig-col  { display:table-cell; width:50%; vertical-align:top; padding:0 8px; }
  .sig-lbl  { font-size:10px; color:#94A3B8; margin-bottom:4px; }
  .sig-val  { font-size:13px; font-weight:600; color:#1E293B;
              padding-bottom:28px; border-bottom:1px solid #CBD5E1; }
  .sig-line-lbl { font-size:10px; color:#94A3B8; margin-top:4px; }

  /* ── Footer ── */
  .footer { text-align:center; font-size:10px; color:#94A3B8;
            padding-top:14px; border-top:1px solid #E2E8F0; }

  /* ── Print media ── */
  @media print {
    body { background:#fff !important; }
    .page { width:100% !important; padding:20px 28px !important; }
    @page { size: A4 portrait; margin: 1.2cm; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="hdr">
    <div class="hdr-left">
      <div class="hdr-tc">T.C.</div>
      <div class="hdr-title">İŞ SAĞLIĞI VE GÜVENLİĞİ</div>
      <div class="hdr-sub">DENETİM TUTANAĞI</div>
    </div>
    <div class="hdr-right">
      <div class="no-lbl">Tutanak No</div>
      <div class="no-val">${esc(tutanak.tutanakNo)}</div>
    </div>
  </div>

  <!-- BAŞLIK + DURUM -->
  <div class="title-row">
    <div class="title-cell">
      <div class="tlabel">Tutanak Başlığı</div>
      <div class="ttitle">${esc(tutanak.baslik)}</div>
    </div>
    <div class="title-badge">
      <span class="badge" style="background:${stBg};color:${stColor};border:1px solid ${stColor}44;">${esc(tutanak.durum)}</span>
    </div>
  </div>

  <!-- BİLGİ TABLOSU -->
  <table class="info-tbl">
    <tr>
      <td class="info-cell">
        <div class="icell-lbl">Firma</div>
        <div class="icell-val">${esc(firma?.ad ?? '—')}</div>
      </td>
      <td class="info-cell">
        <div class="icell-lbl">Tutanak Tarihi</div>
        <div class="icell-val">${esc(tarihStr)}</div>
      </td>
    </tr>
    <tr>
      <td class="info-cell">
        <div class="icell-lbl">Oluşturan Kişi</div>
        <div class="icell-val">${esc(tutanak.olusturanKisi || '—')}</div>
      </td>
      <td class="info-cell">
        <div class="icell-lbl">Kayıt Tarihi</div>
        <div class="icell-val">${esc(olusturmaTarih)}</div>
      </td>
    </tr>
    ${firma?.tehlikeSinifi || firma?.yetkiliKisi ? `
    <tr>
      ${firma.tehlikeSinifi ? `<td class="info-cell"><div class="icell-lbl">Tehlike Sınıfı</div><div class="icell-val">${esc(firma.tehlikeSinifi)}</div></td>` : '<td></td>'}
      ${firma.yetkiliKisi  ? `<td class="info-cell"><div class="icell-lbl">Firma Yetkilisi</div><div class="icell-val">${esc(firma.yetkiliKisi)}</div></td>` : '<td></td>'}
    </tr>` : ''}
  </table>

  <!-- AÇIKLAMA -->
  <div class="sec">
    <div class="sec-head">
      <div class="sec-bar"></div>
      <div class="sec-lbl">Açıklama / Tutanak Detayı</div>
    </div>
    <div class="sec-body">${esc(tutanak.aciklama || '—')}</div>
  </div>

  ${tutanak.notlar ? `
  <!-- NOTLAR -->
  <div class="sec">
    <div class="sec-head">
      <div class="sec-bar amber"></div>
      <div class="sec-lbl">Notlar</div>
    </div>
    <div class="sec-body notes">${esc(tutanak.notlar)}</div>
  </div>` : ''}

  ${tutanak.dosyaAdi ? (
    dosyaVeri && tutanak.dosyaTipi?.startsWith('image/')
      ? `
  <!-- EK GÖRSEL -->
  <div class="attach-img-wrap">
    <div class="attach-img-sec-head">&#128247; Ek Görsel / Fotoğraf</div>
    <div class="attach-img-body">
      <img src="${dosyaVeri}" alt="${esc(tutanak.dosyaAdi)}" />
    </div>
    <div class="attach-img-footer">
      ${esc(tutanak.dosyaAdi)}${tutanak.dosyaBoyutu ? ` &nbsp;&bull;&nbsp; ${(tutanak.dosyaBoyutu / 1024).toFixed(1)} KB` : ''}
    </div>
  </div>`
      : `
  <!-- EK DOSYA -->
  <div class="attach">
    <div class="attach-icon">&#128206;</div>
    <div class="attach-info">
      <div class="attach-lbl">Ek Dosya</div>
      <div class="attach-name">${esc(tutanak.dosyaAdi)}</div>
    </div>
  </div>`
  ) : ''}

  <hr class="divider">

  <!-- İMZA -->
  <div class="sig-wrap">
    <div class="sig-head">İmza ve Onay Alanı</div>
    <div class="sig-body">
      <div class="sig-col">
        <div class="sig-lbl">Tutanağı Düzenleyen</div>
        <div class="sig-val">${esc(tutanak.olusturanKisi || '')}&nbsp;</div>
        <div class="sig-line-lbl">İmza</div>
      </div>
      <div class="sig-col">
        <div class="sig-lbl">Tarih</div>
        <div class="sig-val">${esc(tarihStr)}&nbsp;</div>
        <div class="sig-line-lbl">Onay</div>
      </div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    ISG Denetim Sistemi &nbsp;&bull;&nbsp; ${esc(tutanak.tutanakNo)} &nbsp;&bull;&nbsp; ${esc(printDate)}
  </div>

</div>
</body>
</html>`;
}

/**
 * Blob URL yaklaşımı — `window.open` + `document.write` yerine
 * gerçek bir Blob URL açıyor; tarayıcı HTML'i tam parse ettikten
 * sonra `onload` ile print() tetikleniyor → boş sayfa yok.
 */
export function printTutanakAsPdf(tutanak: Tutanak, firma: Firma | undefined, dosyaVeri?: string): void {
  const html = buildHtml(tutanak, firma, dosyaVeri);

  // Blob URL oluştur — tarayıcı bunu gerçek bir HTML dosyası gibi render eder
  const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);

  const win = window.open(blobUrl, '_blank');

  if (!win) {
    // Popup engelleyici varsa: iframe fallback
    URL.revokeObjectURL(blobUrl);
    fallbackIframePrint(html);
    return;
  }

  // Tarayıcı HTML'i tam yükledikten sonra print()
  win.addEventListener('load', () => {
    // Kısa gecikme: font ve stiller işlendikten sonra yazdır
    setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch {
        /* print dialog kapatıldı */
      }
      // Blob URL'i temizle
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    }, 400);
  });

  // onload tetiklenmezse (bazı tarayıcılarda blob URL ile sorun) yedek kontrol
  const fallbackTimer = setTimeout(() => {
    if (!win.closed) {
      try { win.print(); } catch { /* ignore */ }
      URL.revokeObjectURL(blobUrl);
    }
  }, 3000);

  win.addEventListener('afterprint', () => clearTimeout(fallbackTimer));
}

/** Popup engellendiğinde gizli iframe ile yazdır */
function fallbackIframePrint(html: string): void {
  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, {
    position: 'fixed', top: '-10000px', left: '-10000px',
    width: '1px', height: '1px', border: 'none',
  });
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }

  doc.open();
  doc.write(html);
  doc.close();

  iframe.addEventListener('load', () => {
    setTimeout(() => {
      try { iframe.contentWindow?.print(); } catch { /* ignore */ }
      setTimeout(() => {
        try { document.body.removeChild(iframe); } catch { /* ignore */ }
      }, 2000);
    }, 400);
  });
}
