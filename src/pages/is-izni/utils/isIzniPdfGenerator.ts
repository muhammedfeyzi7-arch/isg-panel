import type { IsIzni, Firma, Personel } from '@/types';

function esc(str: string): string {
  return (str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmt(dateStr: string): string {
  if (!dateStr) return '—';
  try { return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return dateStr; }
}

function tipIcon(tip: string): string {
  const icons: Record<string, string> = {
    'Sıcak Çalışma': '🔥',
    'Yüksekte Çalışma': '⬆️',
    'Kapalı Alan': '🚪',
    'Elektrikli Çalışma': '⚡',
    'Kazı': '⛏️',
    'Genel': '📋',
  };
  return icons[tip] ?? '📋';
}

function tipColor(tip: string): string {
  const colors: Record<string, string> = {
    'Sıcak Çalışma': '#c2410c',
    'Yüksekte Çalışma': '#b45309',
    'Kapalı Alan': '#6d28d9',
    'Elektrikli Çalışma': '#a16207',
    'Kazı': '#78350f',
    'Genel': '#374151',
  };
  return colors[tip] ?? '#374151';
}

function tipBg(tip: string): string {
  const bgs: Record<string, string> = {
    'Sıcak Çalışma': '#fff7ed',
    'Yüksekte Çalışma': '#fffbeb',
    'Kapalı Alan': '#f5f3ff',
    'Elektrikli Çalışma': '#fefce8',
    'Kazı': '#fef3c7',
    'Genel': '#f8fafc',
  };
  return bgs[tip] ?? '#f8fafc';
}

/* KKD listesini parse et — virgül/noktalı virgül ile ayrılmış */
function parseKkdList(ekipman: string): string[] {
  if (!ekipman) return [];
  return ekipman.split(/[,;،]/).map(s => s.trim()).filter(Boolean);
}

export function generateIsIzniPdf(
  iz: IsIzni,
  firma: Firma | undefined,
  calisanlar: Personel[],
): void {
  const firmaAd = firma?.ad ?? '—';
  const durumColor = iz.durum === 'Onaylandı' ? '#15803d' : iz.durum === 'Reddedildi' ? '#dc2626' : '#b45309';
  const durumBg = iz.durum === 'Onaylandı' ? '#dcfce7' : iz.durum === 'Reddedildi' ? '#fee2e2' : '#fef3c7';
  const durumBorder = iz.durum === 'Onaylandı' ? '#86efac' : iz.durum === 'Reddedildi' ? '#fca5a5' : '#fde68a';

  /* Çalışan listesi */
  const calisanHtml = (() => {
    const liste: { ad: string; gorev: string }[] = [];
    if (calisanlar.length > 0) {
      calisanlar.forEach(p => liste.push({ ad: p.adSoyad, gorev: p.gorev || p.departman || '—' }));
    } else if (iz.calisanlar) {
      iz.calisanlar.split(/[,;]/).forEach(s => {
        const t = s.trim();
        if (t) liste.push({ ad: t, gorev: '—' });
      });
    }
    if (liste.length === 0) return '<span style="color:#94a3b8;font-style:italic;">Çalışan bilgisi girilmemiş</span>';
    return liste.map(p => `
      <div class="calisan-kart">
        <div class="calisan-avatar">${esc(p.ad.charAt(0).toUpperCase())}</div>
        <div>
          <div class="calisan-ad">${esc(p.ad)}</div>
          <div class="calisan-gorev">${esc(p.gorev)}</div>
        </div>
      </div>`).join('');
  })();

  /* KKD checkbox listesi */
  const kkdListesi = parseKkdList(iz.gerekliEkipman);
  const kkdHtml = kkdListesi.length > 0
    ? kkdListesi.map(k => `
      <div class="kkd-item">
        <div class="kkd-check">✓</div>
        <span>${esc(k)}</span>
      </div>`).join('')
    : '<span style="color:#94a3b8;font-style:italic;">Belirtilmemiş</span>';

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"/>
<title>İş İzni Belgesi — ${esc(iz.izinNo)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 11px; color: #1e293b; background: #fff; }
  .page { width: 210mm; min-height: 297mm; padding: 14mm 14mm 12mm 14mm; margin: 0 auto; }

  /* ── HEADER ── */
  .header-wrap {
    display: flex; align-items: stretch;
    border: 2px solid #1e3a5f; border-radius: 6px;
    overflow: hidden; margin-bottom: 14px;
  }
  .header-logo {
    width: 52mm; background: #f8fafc;
    border-right: 2px solid #1e3a5f;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 10px 12px; gap: 4px;
  }
  .header-logo .firma-ad {
    font-size: 13px; font-weight: 800; color: #1e3a5f;
    text-align: center; line-height: 1.3;
  }
  .header-logo .firma-sub {
    font-size: 9px; color: #64748b; text-align: center;
  }
  .header-title {
    flex: 1; background: #1e3a5f;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 10px 16px;
  }
  .header-title h1 {
    font-size: 17px; font-weight: 900; color: #fff;
    letter-spacing: 1px; text-align: center;
  }
  .header-title p {
    font-size: 10px; color: #93c5fd; margin-top: 3px; text-align: center;
  }
  .header-no {
    width: 44mm; background: #eff6ff;
    border-left: 2px solid #1e3a5f;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 10px 10px; gap: 5px;
  }
  .header-no .no-label { font-size: 9px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .header-no .no-val { font-size: 16px; font-weight: 900; color: #1e3a5f; font-family: 'Courier New', monospace; }
  .durum-badge {
    display: inline-block; padding: 3px 10px; border-radius: 20px;
    font-size: 10px; font-weight: 700;
    background: ${durumBg}; color: ${durumColor};
    border: 1.5px solid ${durumBorder};
  }

  /* ── TİP BANDI ── */
  .tip-band {
    display: flex; align-items: center; gap: 8px;
    padding: 7px 12px; border-radius: 5px; margin-bottom: 12px;
    background: ${tipBg(iz.tip)}; border: 1.5px solid ${tipColor(iz.tip)}30;
  }
  .tip-band .tip-icon { font-size: 16px; }
  .tip-band .tip-text { font-size: 13px; font-weight: 800; color: ${tipColor(iz.tip)}; }
  .tip-band .tip-sub { font-size: 10px; color: #64748b; margin-left: auto; }

  /* ── BÖLÜM BAŞLIĞI ── */
  .section { margin-bottom: 12px; }
  .section-head {
    display: flex; align-items: center; gap: 6px;
    background: #1e3a5f; color: #fff;
    padding: 5px 10px; border-radius: 4px 4px 0 0;
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
  }
  .section-head.red { background: #991b1b; }
  .section-head.green { background: #14532d; }
  .section-head.amber { background: #92400e; }
  .section-head.slate { background: #334155; }
  .section-body {
    border: 1.5px solid #cbd5e1; border-top: none;
    border-radius: 0 0 4px 4px; padding: 10px;
    background: #fff;
  }

  /* ── BİLGİ TABLOSU ── */
  .info-table { width: 100%; border-collapse: collapse; }
  .info-table td { padding: 5px 8px; vertical-align: top; }
  .info-table .lbl {
    width: 22%; font-size: 9px; font-weight: 700; color: #64748b;
    text-transform: uppercase; letter-spacing: 0.3px;
    background: #f1f5f9; border: 1px solid #e2e8f0;
    white-space: nowrap;
  }
  .info-table .val {
    width: 28%; font-size: 11px; color: #1e293b; font-weight: 500;
    background: #fff; border: 1px solid #e2e8f0;
  }

  /* ── METİN KUTUSU ── */
  .text-box {
    font-size: 11px; color: #1e293b; line-height: 1.6;
    padding: 8px 10px; background: #f8fafc;
    border: 1px solid #e2e8f0; border-radius: 3px;
    min-height: 36px; white-space: pre-wrap;
  }
  .text-box.danger { background: #fff5f5; border-color: #fecaca; }
  .text-box.success { background: #f0fdf4; border-color: #bbf7d0; }

  /* ── TEHLİKE / ÖNLEM YAN YANA ── */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }

  /* ── ÇALIŞANLAR ── */
  .calisan-grid { display: flex; flex-wrap: wrap; gap: 6px; }
  .calisan-kart {
    display: flex; align-items: center; gap: 7px;
    padding: 5px 9px; border-radius: 5px;
    background: #eff6ff; border: 1px solid #bfdbfe;
    min-width: 120px;
  }
  .calisan-avatar {
    width: 26px; height: 26px; border-radius: 50%;
    background: #1e3a5f; color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700; flex-shrink: 0;
  }
  .calisan-ad { font-size: 11px; font-weight: 600; color: #1e3a5f; }
  .calisan-gorev { font-size: 9px; color: #64748b; }

  /* ── KKD ── */
  .kkd-grid { display: flex; flex-wrap: wrap; gap: 6px; }
  .kkd-item {
    display: flex; align-items: center; gap: 5px;
    padding: 4px 9px; border-radius: 4px;
    background: #f0fdf4; border: 1px solid #86efac;
    font-size: 10px; color: #14532d; font-weight: 600;
  }
  .kkd-check {
    width: 16px; height: 16px; border-radius: 3px;
    background: #16a34a; color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 900; flex-shrink: 0;
  }

  /* ── İMZA ── */
  .imza-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 12px; }
  .imza-box {
    border: 1.5px solid #cbd5e1; border-radius: 5px;
    overflow: hidden;
  }
  .imza-head {
    background: #334155; color: #fff;
    font-size: 9px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.5px; padding: 5px 8px; text-align: center;
  }
  .imza-body { padding: 8px; }
  .imza-alan {
    height: 48px; border-bottom: 1.5px dashed #94a3b8;
    margin-bottom: 6px;
  }
  .imza-row { display: flex; justify-content: space-between; font-size: 9px; color: #64748b; }
  .imza-row span { font-weight: 600; }

  /* ── FOOTER ── */
  .footer {
    margin-top: 10px; padding-top: 8px;
    border-top: 1.5px solid #e2e8f0;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 9px; color: #94a3b8;
  }
  .footer-left { display: flex; gap: 14px; }
  .footer-badge {
    display: inline-block; padding: 2px 8px; border-radius: 10px;
    background: #f1f5f9; border: 1px solid #e2e8f0;
    font-size: 9px; color: #64748b; font-weight: 600;
  }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding: 10mm 12mm; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="header-wrap">
    <div class="header-logo">
      <div class="firma-ad">${esc(firmaAd)}</div>
      <div class="firma-sub">İş Sağlığı ve Güvenliği</div>
    </div>
    <div class="header-title">
      <h1>İŞ İZNİ BELGESİ</h1>
      <p>WORK PERMIT / PERMIS DE TRAVAIL</p>
    </div>
    <div class="header-no">
      <div class="no-label">İzin No</div>
      <div class="no-val">${esc(iz.izinNo)}</div>
      <div class="durum-badge">${esc(iz.durum)}</div>
    </div>
  </div>

  <!-- TİP BANDI -->
  <div class="tip-band">
    <span class="tip-icon">${tipIcon(iz.tip)}</span>
    <span class="tip-text">${esc(iz.tip).toUpperCase()}</span>
    <span class="tip-sub">
      ${fmt(iz.baslamaTarihi)}${iz.bitisTarihi ? ' &rarr; ' + fmt(iz.bitisTarihi) : ''}
      &nbsp;&nbsp;|&nbsp;&nbsp; ${iz.calisanSayisi} Çalışan
    </span>
  </div>

  <!-- GENEL BİLGİLER -->
  <div class="section">
    <div class="section-head">📋 Genel Bilgiler</div>
    <div class="section-body" style="padding:0;">
      <table class="info-table">
        <tr>
          <td class="lbl">Firma</td>
          <td class="val">${esc(firmaAd)}</td>
          <td class="lbl">Bölüm / Alan</td>
          <td class="val">${esc(iz.bolum || '—')}</td>
        </tr>
        <tr>
          <td class="lbl">Sorumlu Kişi</td>
          <td class="val">${esc(iz.sorumlu || '—')}</td>
          <td class="lbl">Çalışan Sayısı</td>
          <td class="val">${iz.calisanSayisi} kişi</td>
        </tr>
        <tr>
          <td class="lbl">Başlama Tarihi</td>
          <td class="val">${fmt(iz.baslamaTarihi)}</td>
          <td class="lbl">Bitiş Tarihi</td>
          <td class="val">${fmt(iz.bitisTarihi)}</td>
        </tr>
        <tr>
          <td class="lbl">Onaylayan</td>
          <td class="val">${esc(iz.onaylayanKisi || '—')}</td>
          <td class="lbl">Onay Tarihi</td>
          <td class="val">${fmt(iz.onayTarihi || '')}</td>
        </tr>
        <tr>
          <td class="lbl">Oluşturan</td>
          <td class="val">${esc(iz.olusturanKisi || '—')}</td>
          <td class="lbl">Oluşturma Tarihi</td>
          <td class="val">${fmt(iz.olusturmaTarihi)}</td>
        </tr>
      </table>
    </div>
  </div>

  <!-- İŞ AÇIKLAMASI -->
  <div class="section">
    <div class="section-head">📝 İş Açıklaması / Yapılacak Çalışma</div>
    <div class="section-body">
      <div class="text-box">${esc(iz.aciklama || '—')}</div>
    </div>
  </div>

  <!-- TEHLİKELER + ÖNLEMLER -->
  <div class="two-col">
    <div class="section" style="margin-bottom:0">
      <div class="section-head red">⚠️ Tehlikeler / Riskler</div>
      <div class="section-body">
        <div class="text-box danger">${esc(iz.tehlikeler || '—')}</div>
      </div>
    </div>
    <div class="section" style="margin-bottom:0">
      <div class="section-head green">🛡️ Alınacak Önlemler</div>
      <div class="section-body">
        <div class="text-box success">${esc(iz.onlemler || '—')}</div>
      </div>
    </div>
  </div>

  <!-- ÇALIŞANLAR -->
  <div class="section">
    <div class="section-head">👷 Çalışanlar (${iz.calisanSayisi} Kişi)</div>
    <div class="section-body">
      <div class="calisan-grid">${calisanHtml}</div>
    </div>
  </div>

  <!-- GEREKLİ EKİPMAN / KKD -->
  <div class="section">
    <div class="section-head amber">🦺 Gerekli Ekipman / KKD</div>
    <div class="section-body">
      <div class="kkd-grid">${kkdHtml}</div>
    </div>
  </div>

  ${iz.notlar ? `
  <!-- NOTLAR -->
  <div class="section">
    <div class="section-head slate">📌 Notlar</div>
    <div class="section-body">
      <div class="text-box">${esc(iz.notlar)}</div>
    </div>
  </div>` : ''}

  <!-- İMZA ALANLARI -->
  <div class="imza-grid">
    <div class="imza-box">
      <div class="imza-head">Çalışan / Sorumlu</div>
      <div class="imza-body">
        <div class="imza-alan"></div>
        <div class="imza-row">
          <span>Ad Soyad:</span>
          <span>${esc(iz.sorumlu || '_______________')}</span>
        </div>
        <div class="imza-row" style="margin-top:3px;">
          <span>Tarih:</span>
          <span>${fmt(iz.baslamaTarihi)}</span>
        </div>
      </div>
    </div>
    <div class="imza-box">
      <div class="imza-head">İşveren / Vekili</div>
      <div class="imza-body">
        <div class="imza-alan"></div>
        <div class="imza-row">
          <span>Ad Soyad:</span>
          <span>_______________</span>
        </div>
        <div class="imza-row" style="margin-top:3px;">
          <span>Unvan:</span>
          <span>_______________</span>
        </div>
      </div>
    </div>
    <div class="imza-box">
      <div class="imza-head">ISG Uzmanı / Onaylayan</div>
      <div class="imza-body">
        <div class="imza-alan"></div>
        <div class="imza-row">
          <span>Ad Soyad:</span>
          <span>${esc(iz.onaylayanKisi || '_______________')}</span>
        </div>
        <div class="imza-row" style="margin-top:3px;">
          <span>Tarih:</span>
          <span>${fmt(iz.onayTarihi || '')}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-left">
      <span>İzin No: <strong>${esc(iz.izinNo)}</strong></span>
      <span>Tip: <strong>${esc(iz.tip)}</strong></span>
      <span>Firma: <strong>${esc(firmaAd)}</strong></span>
    </div>
    <div>
      <span class="footer-badge">ISG Denetim Sistemi</span>
      &nbsp;
      <span style="color:#cbd5e1;">Bu belge resmi iş izni kaydıdır.</span>
    </div>
  </div>

</div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=960,height=750');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 700);
}
