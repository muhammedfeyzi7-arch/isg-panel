// İş Kazası Tutanak Raporu Generator — Resmi Word/HTML Formatı

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

function fmt(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch { return dateStr; }
}

function fmtFull(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch { return dateStr; }
}

const VUCUT_LABEL: Record<string, string> = {
  bas: 'Baş', boyun: 'Boyun', sag_omuz: 'Sağ Omuz', sol_omuz: 'Sol Omuz',
  gogus: 'Göğüs', sirt: 'Sırt', sag_kol: 'Sağ Kol', sol_kol: 'Sol Kol',
  sag_el: 'Sağ El', sol_el: 'Sol El', karin: 'Karın/Bel',
  sag_kalca: 'Sağ Kalça', sol_kalca: 'Sol Kalça',
  sag_bacak: 'Sağ Bacak', sol_bacak: 'Sol Bacak',
  sag_ayak: 'Sağ Ayak', sol_ayak: 'Sol Ayak',
};

const SIDDET_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  'Hafif':    { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE', label: 'HAFİF' },
  'Orta':     { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A', label: 'ORTA' },
  'Ağır':     { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', label: 'AĞIR' },
  'Çok Ağır': { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA', label: 'ÇOK AĞIR' },
};

const DURUM_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  'Açık':           { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
  'Soruşturuluyor': { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' },
  'Kapatıldı':      { bg: '#F0FDF4', color: '#15803D', border: '#86EFAC' },
};

function badge(text: string, bg: string, color: string, border: string): string {
  return `<span style="display:inline-block;padding:3px 12px;border-radius:20px;font-size:10px;font-weight:700;background:${bg};color:${color};border:1.5px solid ${border};letter-spacing:0.5px;white-space:nowrap;">${esc(text)}</span>`;
}

function infoRow(label: string, value: string, full = false): string {
  const tdLabel = `padding:7px 10px;font-size:9.5px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.4px;background:#F8FAFC;border:1px solid #E2E8F0;white-space:nowrap;width:${full ? '20%' : '22%'};`;
  const tdValue = `padding:7px 10px;font-size:11px;color:#1E293B;font-weight:500;background:#FFF;border:1px solid #E2E8F0;width:${full ? '80%' : '28%'};`;
  return `<tr><td style="${tdLabel}">${esc(label)}</td><td style="${tdValue}${full ? 'colspan="3"' : ''}">${value}</td></tr>`;
}

// Basit vücut silueti çizimi (ASCII art style HTML)
function buildBodyDiagram(bolgeleri: string[]): string {
  const selected = new Set(bolgeleri);

  const cellStyle = (id: string) => {
    const isSelected = selected.has(id);
    return isSelected
      ? 'background:#EF4444;color:#fff;font-size:8px;font-weight:700;border-radius:3px;padding:2px 4px;text-align:center;display:inline-block;white-space:nowrap;'
      : 'background:#F1F5F9;color:#94A3B8;font-size:8px;border-radius:3px;padding:2px 4px;text-align:center;display:inline-block;white-space:nowrap;';
  };

  const regions = [
    ['bas', 'boyun'],
    ['sag_omuz', 'gogus', 'sol_omuz'],
    ['sag_kol', 'sirt', 'sol_kol'],
    ['sag_el', 'karin', 'sol_el'],
    ['sag_kalca', '', 'sol_kalca'],
    ['sag_bacak', '', 'sol_bacak'],
    ['sag_ayak', '', 'sol_ayak'],
  ];

  const rows = regions.map(row => {
    const cells = row.map(id => {
      if (!id) return '<td style="padding:2px 4px;"></td>';
      const label = VUCUT_LABEL[id] ?? id;
      return `<td style="padding:2px 4px;text-align:center;"><span style="${cellStyle(id)}">${esc(label)}</span></td>`;
    });
    return `<tr>${cells.join('')}</tr>`;
  });

  return `
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
      ${rows.join('')}
    </table>
  `;
}

export interface IsKazasiRaporData {
  id: string;
  personelAd: string;
  personelGorev?: string;
  firmaAd: string;
  kazaTarihi: string;
  kazaSaati?: string;
  kazaYeri?: string;
  kazaTuru?: string;
  kazaAciklamasi?: string;
  yaraliVucutBolgeleri: string[];
  yaralanmaTuru?: string;
  yaralanmaSiddeti: string;
  isGunuKaybi: number;
  hastaneyeKaldirildi: boolean;
  hastaneAdi?: string;
  tanikBilgileri?: string;
  onlemler?: string;
  durum: string;
  raporNo?: string;
  raporTarihi?: string;
  hazirlayanAd?: string;
  osgbAd?: string;
}

function buildHtml(kaza: IsKazasiRaporData): string {
  const printDate = fmtFull(new Date().toISOString());
  const raporNo = kaza.raporNo ?? `IK-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
  const siddetCfg = SIDDET_STYLE[kaza.yaralanmaSiddeti] ?? SIDDET_STYLE['Hafif'];
  const durumCfg = DURUM_STYLE[kaza.durum] ?? DURUM_STYLE['Açık'];

  const bolgeLabels = kaza.yaraliVucutBolgeleri
    .map(id => VUCUT_LABEL[id] ?? id.replace(/_/g, ' '))
    .join(', ') || '—';

  const bodyDiagram = buildBodyDiagram(kaza.yaraliVucutBolgeleri);

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>İş Kazası Tutanak Raporu — ${raporNo}</title>
<style>
  *,*::before,*::after { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 11px;
    color: #1E293B;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 12mm 14mm 12mm 14mm; }

  /* ── TOP BORDER ── */
  .top-stripe {
    height: 5px;
    background: linear-gradient(90deg, #1e3a5f 0%, #c0392b 50%, #1e3a5f 100%);
    border-radius: 3px;
    margin-bottom: 14px;
  }

  /* ── HEADER ── */
  .header-outer {
    display: flex;
    border: 2px solid #1e3a5f;
    border-radius: 6px;
    overflow: hidden;
    margin-bottom: 14px;
  }
  .header-logo-block {
    width: 48mm;
    background: #f0f4f8;
    border-right: 2px solid #1e3a5f;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 10px 12px;
    gap: 3px;
  }
  .logo-emblem {
    width: 38px; height: 38px;
    background: #1e3a5f;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 4px;
  }
  .logo-emblem span { font-size: 18px; }
  .header-logo-block .org-name {
    font-size: 11px; font-weight: 800; color: #1e3a5f;
    text-align: center; line-height: 1.3;
    font-family: 'Segoe UI', Arial, sans-serif;
  }
  .header-logo-block .org-sub {
    font-size: 8.5px; color: #64748b; text-align: center;
    font-family: 'Segoe UI', Arial, sans-serif;
  }

  .header-center {
    flex: 1;
    background: #1e3a5f;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 10px 14px;
  }
  .header-center .doc-type {
    font-size: 9px; font-weight: 700; color: #93c5fd;
    letter-spacing: 2px; text-transform: uppercase;
    font-family: 'Segoe UI', Arial, sans-serif;
    margin-bottom: 3px;
  }
  .header-center h1 {
    font-size: 19px; font-weight: 900; color: #fff;
    letter-spacing: 0.5px; text-align: center;
    font-family: 'Segoe UI', Arial, sans-serif;
    line-height: 1.2;
  }
  .header-center p {
    font-size: 9px; color: #bfdbfe; margin-top: 3px; text-align: center;
    font-family: 'Segoe UI', Arial, sans-serif;
  }

  .header-no-block {
    width: 42mm;
    background: #eff6ff;
    border-left: 2px solid #1e3a5f;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 10px 10px;
    gap: 5px;
  }
  .no-label { font-size: 8.5px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; font-family: 'Segoe UI', Arial, sans-serif; }
  .no-value {
    font-size: 13px; font-weight: 900; color: #1e3a5f;
    font-family: 'Courier New', monospace;
    text-align: center;
  }
  .durum-pill {
    padding: 3px 10px; border-radius: 20px;
    font-size: 9.5px; font-weight: 700;
    background: ${durumCfg.bg}; color: ${durumCfg.color};
    border: 1.5px solid ${durumCfg.border};
    font-family: 'Segoe UI', Arial, sans-serif;
    white-space: nowrap;
  }

  /* ── UYARI BANDI ── */
  .uyari-band {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 14px; border-radius: 5px;
    background: ${siddetCfg.bg};
    border: 1.5px solid ${siddetCfg.border};
    margin-bottom: 14px;
  }
  .uyari-icon { font-size: 20px; flex-shrink: 0; }
  .uyari-text { font-size: 13px; font-weight: 900; color: ${siddetCfg.color}; font-family: 'Segoe UI', Arial, sans-serif; letter-spacing: 0.5px; }
  .uyari-sub { font-size: 10px; color: #64748b; margin-left: auto; font-family: 'Segoe UI', Arial, sans-serif; white-space: nowrap; }

  /* ── BÖLÜM BAŞLIĞI ── */
  .sec-head {
    display: flex; align-items: center; gap: 6px;
    background: #1e3a5f; color: #fff;
    padding: 6px 12px;
    border-radius: 4px 4px 0 0;
    font-size: 9.5px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.7px;
    font-family: 'Segoe UI', Arial, sans-serif;
  }
  .sec-head.red { background: #991b1b; }
  .sec-head.green { background: #14532d; }
  .sec-head.amber { background: #78350f; }
  .sec-head.slate { background: #334155; }
  .sec-head.teal { background: #134e4a; }

  .sec-body {
    border: 1.5px solid #cbd5e1;
    border-top: none;
    border-radius: 0 0 5px 5px;
    background: #fff;
  }
  .section { margin-bottom: 12px; }

  /* ── BİLGİ TABLOSU ── */
  .info-tbl { width: 100%; border-collapse: collapse; }
  .info-tbl td { padding: 7px 10px; vertical-align: top; }
  .info-tbl .lbl {
    font-size: 9.5px; font-weight: 700; color: #64748B;
    text-transform: uppercase; letter-spacing: 0.4px;
    background: #F8FAFC; border: 1px solid #E2E8F0;
    white-space: nowrap; width: 22%;
    font-family: 'Segoe UI', Arial, sans-serif;
  }
  .info-tbl .val {
    font-size: 11px; color: #1E293B; font-weight: 500;
    background: #FFF; border: 1px solid #E2E8F0;
    width: 28%;
    font-family: 'Times New Roman', Times, serif;
  }

  /* ── METİN KUTUSU ── */
  .text-box {
    font-size: 11px; color: #1e293b; line-height: 1.7;
    padding: 9px 12px; background: #f8fafc;
    border: 1px solid #e2e8f0;
    min-height: 40px;
    font-family: 'Times New Roman', Times, serif;
  }
  .text-box.danger { background: #fff5f5; border-color: #fecaca; }
  .text-box.success { background: #f0fdf4; border-color: #bbf7d0; }

  /* ── YATAY İKİ SÜTUN ── */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
  .three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 12px; }

  /* ── VÜCUT DİYAGRAMI BÖLÜMÜ ── */
  .body-diagram-wrap {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 0;
  }
  .diagram-left {
    padding: 10px;
    border-right: 1px solid #e2e8f0;
    background: #fafafa;
  }
  .diagram-right { padding: 10px; }
  .bolge-list { display: flex; flex-wrap: wrap; gap: 5px; }
  .bolge-tag {
    padding: 3px 9px; border-radius: 20px;
    background: #FEE2E2; color: #DC2626;
    border: 1px solid #FECACA;
    font-size: 9.5px; font-weight: 700;
    font-family: 'Segoe UI', Arial, sans-serif;
    white-space: nowrap;
  }
  .bolge-empty { font-size: 10px; color: #94a3b8; font-style: italic; font-family: 'Segoe UI', Arial, sans-serif; }

  /* ── KKD / ÖNLEM ── */
  .kkd-grid { display: flex; flex-wrap: wrap; gap: 5px; padding: 10px; }
  .kkd-item {
    display: flex; align-items: center; gap: 5px;
    padding: 4px 9px; border-radius: 4px;
    background: #f0fdf4; border: 1px solid #86efac;
    font-size: 10px; color: #14532d; font-weight: 600;
    font-family: 'Segoe UI', Arial, sans-serif;
  }
  .kkd-check {
    width: 14px; height: 14px; border-radius: 2px;
    background: #16a34a; color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 9px; font-weight: 900; flex-shrink: 0;
  }

  /* ── İMZA ── */
  .imza-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 12px; }
  .imza-box { border: 1.5px solid #cbd5e1; border-radius: 5px; overflow: hidden; }
  .imza-head {
    background: #334155; color: #fff;
    font-size: 9px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.5px; padding: 6px 10px; text-align: center;
    font-family: 'Segoe UI', Arial, sans-serif;
  }
  .imza-body { padding: 10px 12px; }
  .imza-alan {
    height: 50px;
    border-bottom: 1.5px dashed #94a3b8;
    margin-bottom: 8px;
  }
  .imza-row {
    display: flex; justify-content: space-between;
    font-size: 9px; color: #64748b;
    font-family: 'Segoe UI', Arial, sans-serif;
    margin-top: 3px;
  }
  .imza-row span:last-child { font-weight: 600; color: #334155; }

  /* ── FOOTER ── */
  .footer {
    margin-top: 12px; padding-top: 10px;
    border-top: 1.5px solid #e2e8f0;
    display: flex; justify-content: space-between; align-items: center;
  }
  .footer-left { display: flex; gap: 16px; font-size: 9.5px; color: #64748b; font-family: 'Segoe UI', Arial, sans-serif; }
  .footer-right { font-size: 9px; color: #94a3b8; font-family: 'Segoe UI', Arial, sans-serif; }
  .footer-badge {
    display: inline-block; padding: 2px 9px; border-radius: 10px;
    background: #f1f5f9; border: 1px solid #e2e8f0;
    font-size: 9px; color: #64748b; font-weight: 600;
  }

  /* ── PRINT ── */
  @media print {
    body { background: #fff !important; }
    .page { padding: 8mm 12mm; }
    @page { size: A4 portrait; margin: 0.7cm; }
    .section { page-break-inside: avoid; }
    .imza-grid { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- TOP STRIPE -->
  <div class="top-stripe"></div>

  <!-- HEADER -->
  <div class="header-outer">
    <div class="header-logo-block">
      <div class="logo-emblem"><span>⚕️</span></div>
      <div class="org-name">${esc(kaza.osgbAd ?? kaza.firmaAd)}</div>
      <div class="org-sub">İş Sağlığı ve Güvenliği</div>
    </div>
    <div class="header-center">
      <div class="doc-type">Resmi Tutanak Belgesi</div>
      <h1>İŞ KAZASI TUTANAĞ</h1>
      <p>WORK ACCIDENT REPORT / RAPPORT D'ACCIDENT DU TRAVAIL</p>
    </div>
    <div class="header-no-block">
      <div class="no-label">Rapor No</div>
      <div class="no-value">${esc(raporNo)}</div>
      <div class="no-label" style="margin-top:2px;">Şiddet</div>
      <div class="durum-pill">${esc(kaza.durum)}</div>
    </div>
  </div>

  <!-- UYARI BANDI -->
  <div class="uyari-band">
    <span class="uyari-icon">⚠️</span>
    <span class="uyari-text">YARALANMA ŞİDDETİ: ${esc(siddetCfg.label)}</span>
    <span class="uyari-sub">
      ${esc(kaza.kazaTarihi ? fmt(kaza.kazaTarihi) : '')}${kaza.kazaSaati ? ' &nbsp;|&nbsp; ' + esc(kaza.kazaSaati) : ''}
      &nbsp;&nbsp;|&nbsp;&nbsp; ${esc(kaza.firmaAd)}
    </span>
  </div>

  <!-- BÖLÜM 1: GENEL BİLGİLER -->
  <div class="section">
    <div class="sec-head">📋 Bölüm 1 — Genel Bilgiler / Temel Kayıt</div>
    <div class="sec-body">
      <table class="info-tbl">
        <tr>
          <td class="lbl">Rapor No</td>
          <td class="val" style="font-family:'Courier New',monospace;font-weight:700;color:#1e3a5f;">${esc(raporNo)}</td>
          <td class="lbl">Rapor Tarihi</td>
          <td class="val">${esc(printDate)}</td>
        </tr>
        <tr>
          <td class="lbl">Firma / İşyeri</td>
          <td class="val" style="font-weight:700;">${esc(kaza.firmaAd)}</td>
          <td class="lbl">OSGB / Kurum</td>
          <td class="val">${esc(kaza.osgbAd ?? '—')}</td>
        </tr>
        <tr>
          <td class="lbl">Hazırlayan</td>
          <td class="val">${esc(kaza.hazirlayanAd ?? 'İşyeri Hekimi')}</td>
          <td class="lbl">Durum</td>
          <td class="val">${badge(kaza.durum, durumCfg.bg, durumCfg.color, durumCfg.border)}</td>
        </tr>
      </table>
    </div>
  </div>

  <!-- BÖLÜM 2: KAZAZEDE BİLGİLERİ -->
  <div class="section">
    <div class="sec-head red">👤 Bölüm 2 — Kazazede Bilgileri</div>
    <div class="sec-body">
      <table class="info-tbl">
        <tr>
          <td class="lbl">Ad Soyad</td>
          <td class="val" style="font-weight:700;font-size:12px;">${esc(kaza.personelAd)}</td>
          <td class="lbl">Görev / Unvan</td>
          <td class="val">${esc(kaza.personelGorev ?? '—')}</td>
        </tr>
        <tr>
          <td class="lbl">Firma</td>
          <td class="val">${esc(kaza.firmaAd)}</td>
          <td class="lbl">İş Günü Kaybı</td>
          <td class="val" style="font-weight:700;color:${kaza.isGunuKaybi > 0 ? '#DC2626' : '#374151'};">
            ${kaza.isGunuKaybi > 0 ? esc(String(kaza.isGunuKaybi)) + ' gün' : 'Yok'}
          </td>
        </tr>
        <tr>
          <td class="lbl">Hastaneye Kaldırıldı</td>
          <td class="val" style="font-weight:600;color:${kaza.hastaneyeKaldirildi ? '#DC2626' : '#15803D'};">
            ${kaza.hastaneyeKaldirildi ? '✓ Evet' : '✗ Hayır'}
          </td>
          <td class="lbl">Hastane Adı</td>
          <td class="val">${esc(kaza.hastaneAdi || (kaza.hastaneyeKaldirildi ? 'Belirtilmemiş' : '—'))}</td>
        </tr>
      </table>
    </div>
  </div>

  <!-- BÖLÜM 3: KAZA DETAYLARI -->
  <div class="section">
    <div class="sec-head amber">📅 Bölüm 3 — Kaza Bilgileri</div>
    <div class="sec-body">
      <table class="info-tbl">
        <tr>
          <td class="lbl">Kaza Tarihi</td>
          <td class="val" style="font-weight:700;">${esc(fmtFull(kaza.kazaTarihi))}</td>
          <td class="lbl">Kaza Saati</td>
          <td class="val">${esc(kaza.kazaSaati || '—')}</td>
        </tr>
        <tr>
          <td class="lbl">Kaza Yeri</td>
          <td class="val">${esc(kaza.kazaYeri || '—')}</td>
          <td class="lbl">Kaza Türü</td>
          <td class="val">${esc(kaza.kazaTuru || '—')}</td>
        </tr>
        <tr>
          <td class="lbl">Yaralanma Türü</td>
          <td class="val">${esc(kaza.yaralanmaTuru || '—')}</td>
          <td class="lbl">Yaralanma Şiddeti</td>
          <td class="val">${badge(kaza.yaralanmaSiddeti, siddetCfg.bg, siddetCfg.color, siddetCfg.border)}</td>
        </tr>
      </table>
    </div>
  </div>

  <!-- BÖLÜM 4: KAZA AÇIKLAMASI -->
  <div class="section">
    <div class="sec-head">📝 Bölüm 4 — Kaza Açıklaması</div>
    <div class="sec-body">
      <div class="text-box">${kaza.kazaAciklamasi ? esc(kaza.kazaAciklamasi) : '<span style="color:#94a3b8;font-style:italic;">Açıklama girilmemiş</span>'}</div>
    </div>
  </div>

  <!-- BÖLÜM 5: YARALANAN VÜCUT BÖLGELERİ -->
  <div class="section">
    <div class="sec-head red">🩺 Bölüm 5 — Yaralanan Vücut Bölgeleri</div>
    <div class="sec-body">
      <div class="body-diagram-wrap">
        <div class="diagram-left">
          <p style="font-size:9px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;font-family:'Segoe UI',Arial,sans-serif;">Vücut Haritası</p>
          ${bodyDiagram}
        </div>
        <div class="diagram-right">
          <p style="font-size:9px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;font-family:'Segoe UI',Arial,sans-serif;">Etkilenen Bölgeler (${kaza.yaraliVucutBolgeleri.length})</p>
          <div class="bolge-list">
            ${kaza.yaraliVucutBolgeleri.length > 0
              ? kaza.yaraliVucutBolgeleri.map(id => `<span class="bolge-tag">${esc(VUCUT_LABEL[id] ?? id)}</span>`).join('')
              : '<span class="bolge-empty">Vücut bölgesi belirtilmemiş</span>'
            }
          </div>
          ${kaza.yaraliVucutBolgeleri.length > 0 ? `
          <div style="margin-top:12px;padding:8px 10px;background:#FEF2F2;border:1px solid #FECACA;border-radius:4px;">
            <p style="font-size:9px;font-weight:700;color:#DC2626;margin-bottom:3px;font-family:'Segoe UI',Arial,sans-serif;">KLİNİK NOT</p>
            <p style="font-size:10px;color:#7F1D1D;line-height:1.5;font-family:'Times New Roman',serif;">
              Kazazede; <strong>${esc(bolgeLabels)}</strong> bölgesinde
              <strong>${esc(kaza.yaralanmaTuru || 'belirtilmemiş türde')}</strong> yaralanma
              meydana geldiği tespit edilmiştir.
              Yaralanma şiddeti <strong>${esc(kaza.yaralanmaSiddeti)}</strong> olarak değerlendirilmiştir.
            </p>
          </div>` : ''}
        </div>
      </div>
    </div>
  </div>

  <!-- BÖLÜM 6: TANIK VE ÖNLEMLER -->
  <div class="two-col">
    <div class="section" style="margin-bottom:0">
      <div class="sec-head teal">👁️ Bölüm 6a — Tanık Bilgileri</div>
      <div class="sec-body">
        <div class="text-box">${kaza.tanikBilgileri ? esc(kaza.tanikBilgileri) : '<span style="color:#94a3b8;font-style:italic;">Tanık bilgisi girilmemiş</span>'}</div>
      </div>
    </div>
    <div class="section" style="margin-bottom:0">
      <div class="sec-head green">🛡️ Bölüm 6b — Alınan / Alınacak Önlemler</div>
      <div class="sec-body">
        <div class="text-box success">${kaza.onlemler ? esc(kaza.onlemler) : '<span style="color:#94a3b8;font-style:italic;">Önlem bilgisi girilmemiş</span>'}</div>
      </div>
    </div>
  </div>

  <!-- BÖLÜM 7: YASAL ZORUNLULUKLAR NOTU -->
  <div class="section">
    <div class="sec-head slate">⚖️ Bölüm 7 — Yasal Yükümlülükler</div>
    <div class="sec-body">
      <div class="text-box" style="background:#FEFCE8;border-color:#FDE68A;font-family:'Segoe UI',Arial,sans-serif;font-size:10px;line-height:1.7;color:#713F12;">
        <strong>6331 sayılı İş Sağlığı ve Güvenliği Kanunu</strong> uyarınca, iş kazaları;
        kazanın olduğu günden itibaren <strong>en geç 3 iş günü</strong> içinde işveren tarafından Sosyal Güvenlik Kurumu'na bildirilerek kayıt altına alınmalıdır.
        Bu tutanak, yasal bildirim yükümlülüğünün yerine getirilmesine yönelik resmi bir kayıt belgesidir.
        <br><br>
        Kazanın ağır yaralanma veya ölümle sonuçlanması halinde yetkili Çalışma ve İş Kurumu İl Müdürlüğü'ne derhal bilgi verilmesi zorunludur.
      </div>
    </div>
  </div>

  <!-- İMZA ALANLARI -->
  <div class="imza-grid">
    <div class="imza-box">
      <div class="imza-head">Kazazede / Çalışan</div>
      <div class="imza-body">
        <div class="imza-alan"></div>
        <div class="imza-row">
          <span>Ad Soyad:</span>
          <span>${esc(kaza.personelAd)}</span>
        </div>
        <div class="imza-row">
          <span>Tarih:</span>
          <span>${fmt(kaza.kazaTarihi)}</span>
        </div>
      </div>
    </div>
    <div class="imza-box">
      <div class="imza-head">İşveren Vekili</div>
      <div class="imza-body">
        <div class="imza-alan"></div>
        <div class="imza-row">
          <span>Ad Soyad:</span>
          <span>________________________</span>
        </div>
        <div class="imza-row">
          <span>Ünvan:</span>
          <span>________________________</span>
        </div>
      </div>
    </div>
    <div class="imza-box">
      <div class="imza-head">İşyeri Hekimi / ISG Uzmanı</div>
      <div class="imza-body">
        <div class="imza-alan"></div>
        <div class="imza-row">
          <span>Ad Soyad:</span>
          <span>${esc(kaza.hazirlayanAd ?? 'İşyeri Hekimi')}</span>
        </div>
        <div class="imza-row">
          <span>Tarih:</span>
          <span>${esc(printDate)}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-left">
      <span>Rapor No: <strong>${esc(raporNo)}</strong></span>
      <span>Kazazede: <strong>${esc(kaza.personelAd)}</strong></span>
      <span>Firma: <strong>${esc(kaza.firmaAd)}</strong></span>
    </div>
    <div class="footer-right">
      <span class="footer-badge">ISG Denetim Yönetim Sistemi</span>
      &nbsp;
      <span style="color:#cbd5e1;">Bu belge resmi iş kazası tutanağıdır.</span>
    </div>
  </div>

</div>
</body>
</html>`;
}

export function printIsKazasiTutanagi(kaza: IsKazasiRaporData): void {
  const html = buildHtml(kaza);
  const win = window.open('', '_blank', 'width=960,height=820');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 800);
}

export function downloadIsKazasiHtml(kaza: IsKazasiRaporData): void {
  const html = buildHtml(kaza);
  const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const dateStr = kaza.kazaTarihi
    ? new Date(kaza.kazaTarihi).toLocaleDateString('tr-TR').replace(/\./g, '-')
    : new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
  link.download = `${dateStr}-IsKazasiTutanagi-${kaza.personelAd.replace(/\s+/g, '-')}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
