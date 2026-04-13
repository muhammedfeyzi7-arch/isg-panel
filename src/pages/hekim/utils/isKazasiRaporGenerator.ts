// İş Kazası Tutanak Raporu — Profesyonel HTML/PDF

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
    return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return dateStr; }
}

function fmtFull(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
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

const SIDDET_CFG: Record<string, { bg: string; text: string; border: string; accent: string; icon: string }> = {
  'Hafif':    { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE', accent: '#3B82F6', icon: '●' },
  'Orta':     { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A', accent: '#F59E0B', icon: '◆' },
  'Ağır':     { bg: '#FFF1F2', text: '#9F1239', border: '#FECDD3', accent: '#F43F5E', icon: '▲' },
  'Çok Ağır': { bg: '#FEF2F2', text: '#7F1D1D', border: '#FECACA', accent: '#EF4444', icon: '⚠' },
};

const DURUM_CFG: Record<string, { bg: string; text: string; border: string }> = {
  'Açık':           { bg: '#FFF1F2', text: '#9F1239', border: '#FECDD3' },
  'Soruşturuluyor': { bg: '#FFFBEB', text: '#78350F', border: '#FDE68A' },
  'Kapatıldı':      { bg: '#F0FDF4', text: '#14532D', border: '#86EFAC' },
};

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
  const raporNo = kaza.raporNo ?? `IK-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000) + 10000)}`;
  const sCfg = SIDDET_CFG[kaza.yaralanmaSiddeti] ?? SIDDET_CFG['Hafif'];
  const dCfg = DURUM_CFG[kaza.durum] ?? DURUM_CFG['Açık'];

  const bolgeLabels = kaza.yaraliVucutBolgeleri.map(id => VUCUT_LABEL[id] ?? id).join(', ') || '—';

  // SVG vücut silueti
  const svgBody = buildBodySvg(kaza.yaraliVucutBolgeleri);

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>İş Kazası Tutanağı — ${raporNo}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  *,*::before,*::after { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
    font-size: 11px;
    color: #1E293B;
    background: #F1F5F9;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    padding: 0 0 20mm;
    background: #fff;
  }

  /* ── KAPAK BÖLÜM ── */
  .cover {
    background: linear-gradient(135deg, #0F172A 0%, #1E3A5F 60%, #1a1a2e 100%);
    padding: 24px 28px 20px;
    position: relative;
    overflow: hidden;
  }
  .cover::before {
    content: '';
    position: absolute;
    top: -40px; right: -40px;
    width: 200px; height: 200px;
    border-radius: 50%;
    background: rgba(239,68,68,0.07);
  }
  .cover::after {
    content: '';
    position: absolute;
    bottom: -20px; left: -20px;
    width: 120px; height: 120px;
    border-radius: 50%;
    background: rgba(59,130,246,0.05);
  }
  .cover-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 18px;
  }
  .cover-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    background: rgba(239,68,68,0.2);
    color: #FDA4AF;
    border: 1px solid rgba(239,68,68,0.3);
  }
  .cover-badge-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #F43F5E;
  }
  .cover-no {
    font-size: 10px;
    font-weight: 700;
    color: rgba(255,255,255,0.5);
    letter-spacing: 0.5px;
  }
  .cover-title {
    font-size: 26px;
    font-weight: 900;
    color: #fff;
    letter-spacing: -0.5px;
    line-height: 1.15;
    margin-bottom: 6px;
  }
  .cover-sub {
    font-size: 11px;
    color: rgba(255,255,255,0.5);
    letter-spacing: 0.5px;
  }
  .cover-meta {
    display: flex;
    gap: 20px;
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid rgba(255,255,255,0.1);
  }
  .cover-meta-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .cover-meta-label {
    font-size: 8.5px;
    font-weight: 600;
    color: rgba(255,255,255,0.4);
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }
  .cover-meta-value {
    font-size: 11px;
    font-weight: 700;
    color: rgba(255,255,255,0.9);
  }
  .cover-pills {
    display: flex;
    gap: 6px;
    margin-top: 10px;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 9.5px;
    font-weight: 700;
    white-space: nowrap;
  }
  .pill-siddet {
    background: ${sCfg.bg};
    color: ${sCfg.text};
    border: 1.5px solid ${sCfg.border};
  }
  .pill-durum {
    background: ${dCfg.bg};
    color: ${dCfg.text};
    border: 1.5px solid ${dCfg.border};
  }
  .pill-hastane {
    background: #FFF7ED;
    color: #9A3412;
    border: 1.5px solid #FED7AA;
  }

  /* ── ANA İÇERİK ── */
  .body-wrap { padding: 0 28px; }

  /* ── BÖLÜM BAŞLIĞI ── */
  .sec {
    margin-top: 16px;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid #E2E8F0;
  }
  .sec-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    font-size: 9px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: #fff;
  }
  .sec-head.blue   { background: #1e3a5f; }
  .sec-head.red    { background: #9F1239; }
  .sec-head.amber  { background: #78350F; }
  .sec-head.teal   { background: #134E4A; }
  .sec-head.green  { background: #14532D; }
  .sec-head.slate  { background: #334155; }
  .sec-head.violet { background: #4C1D95; }
  .sec-icon {
    width: 18px; height: 18px;
    border-radius: 4px;
    background: rgba(255,255,255,0.15);
    display: flex; align-items: center; justify-content: center;
    font-size: 10px;
  }
  .sec-body { background: #fff; }

  /* ── BİLGİ TABLOSU ── */
  .info-grid {
    display: grid;
    gap: 0;
  }
  .info-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-bottom: 1px solid #F1F5F9;
  }
  .info-row:last-child { border-bottom: none; }
  .info-row.full {
    grid-template-columns: 1fr;
  }
  .info-cell-label {
    padding: 8px 12px;
    font-size: 9px;
    font-weight: 700;
    color: #94A3B8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    background: #FAFAFA;
    border-right: 1px solid #F1F5F9;
    white-space: nowrap;
  }
  .info-cell-value {
    padding: 8px 12px;
    font-size: 11px;
    font-weight: 500;
    color: #1E293B;
    border-right: 1px solid #F1F5F9;
  }
  .info-cell-value.bold { font-weight: 700; }
  .info-cell-value.big { font-size: 13px; font-weight: 800; }

  /* ── METİN KUTUSU ── */
  .text-box {
    padding: 10px 14px;
    font-size: 11px;
    line-height: 1.8;
    color: #334155;
    background: #FAFAFA;
  }
  .text-box.danger { background: #FFF1F2; color: #9F1239; }
  .text-box.success { background: #F0FDF4; color: #14532D; }
  .text-box.warning { background: #FFFBEB; color: #78350F; }
  .text-box.empty { color: #94A3B8; font-style: italic; }

  /* ── İKİ SÜTUN ── */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 16px; }

  /* ── VÜCUT DİYAGRAMI ── */
  .diagram-wrap {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0;
  }
  .diagram-svg-area {
    padding: 14px 10px;
    background: #FAFAFA;
    border-right: 1px solid #F1F5F9;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .diagram-info {
    padding: 14px;
  }
  .bolge-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-bottom: 10px;
  }
  .bolge-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 9.5px;
    font-weight: 700;
    background: #FFF1F2;
    color: #9F1239;
    border: 1px solid #FECDD3;
  }
  .bolge-chip::before {
    content: '';
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #F43F5E;
    flex-shrink: 0;
  }
  .klinik-not {
    padding: 10px 12px;
    background: #FEF2F2;
    border: 1px solid #FECACA;
    border-radius: 8px;
    font-size: 10px;
    line-height: 1.7;
    color: #7F1D1D;
  }
  .klinik-not-title {
    font-size: 8.5px;
    font-weight: 800;
    color: #DC2626;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-bottom: 5px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  /* ── İMZA ── */
  .imza-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 16px; }
  .imza-box { border: 1.5px solid #E2E8F0; border-radius: 10px; overflow: hidden; }
  .imza-head { background: #1E293B; color: #fff; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.7px; padding: 7px 12px; }
  .imza-body { padding: 12px; }
  .imza-alan { height: 52px; border-bottom: 1.5px dashed #CBD5E1; margin-bottom: 8px; }
  .imza-field { display: flex; justify-content: space-between; font-size: 9px; color: #64748B; margin-top: 4px; }
  .imza-field span:last-child { font-weight: 600; color: #334155; }

  /* ── YASAL NOT ── */
  .yasal-box {
    padding: 12px 14px;
    background: linear-gradient(135deg, #FFFBEB, #FEF3C7);
    border: 1.5px solid #FDE68A;
    border-radius: 8px;
    font-size: 10px;
    color: #713F12;
    line-height: 1.8;
  }
  .yasal-title { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #92400E; margin-bottom: 6px; display: flex; align-items: center; gap: 5px; }

  /* ── FOOTER ── */
  .footer {
    margin: 18px 28px 0;
    padding-top: 12px;
    border-top: 2px solid #E2E8F0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 9.5px;
    color: #94A3B8;
  }
  .footer-left { display: flex; gap: 14px; }
  .footer-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 20px;
    background: #F1F5F9;
    border: 1px solid #E2E8F0;
    font-size: 9px;
    font-weight: 700;
    color: #64748B;
  }

  /* ── PRINT ── */
  @media print {
    body { background: #fff !important; }
    .page { padding: 0; }
    @page { size: A4 portrait; margin: 0; }
    .sec { page-break-inside: avoid; }
    .imza-grid { page-break-inside: avoid; }
    .body-wrap { padding: 0 20px; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- KAPAK -->
  <div class="cover">
    <div class="cover-top">
      <div class="cover-badge">
        <span class="cover-badge-dot"></span>
        Resmi Tutanak Belgesi
      </div>
      <div class="cover-no">Rapor No: ${esc(raporNo)}</div>
    </div>

    <div class="cover-title">İŞ KAZASI TUTANAĞI</div>
    <div class="cover-sub">WORK ACCIDENT REPORT &nbsp;·&nbsp; ISG Denetim Yönetim Sistemi</div>

    <div class="cover-pills">
      <span class="pill pill-siddet">${sCfg.icon} Şiddet: ${esc(kaza.yaralanmaSiddeti)}</span>
      <span class="pill pill-durum">Durum: ${esc(kaza.durum)}</span>
      ${kaza.hastaneyeKaldirildi ? `<span class="pill pill-hastane">🏥 Hastaneye Kaldırıldı</span>` : ''}
    </div>

    <div class="cover-meta">
      <div class="cover-meta-item">
        <span class="cover-meta-label">Kazazede</span>
        <span class="cover-meta-value">${esc(kaza.personelAd)}</span>
      </div>
      <div class="cover-meta-item">
        <span class="cover-meta-label">Firma</span>
        <span class="cover-meta-value">${esc(kaza.firmaAd)}</span>
      </div>
      <div class="cover-meta-item">
        <span class="cover-meta-label">Kaza Tarihi</span>
        <span class="cover-meta-value">${esc(fmtFull(kaza.kazaTarihi))}${kaza.kazaSaati ? ' &nbsp;' + esc(kaza.kazaSaati) : ''}</span>
      </div>
      <div class="cover-meta-item">
        <span class="cover-meta-label">Rapor Tarihi</span>
        <span class="cover-meta-value">${esc(printDate)}</span>
      </div>
    </div>
  </div>

  <div class="body-wrap">

    <!-- BÖLÜM 1: GENEL BİLGİLER -->
    <div class="sec">
      <div class="sec-head blue">
        <div class="sec-icon">📋</div>Bölüm 1 — Genel Kayıt Bilgileri
      </div>
      <div class="sec-body">
        <div class="info-grid">
          <div class="info-row">
            <div class="info-cell-label">Rapor No</div>
            <div class="info-cell-value bold" style="font-family:monospace;color:#1E3A5F;">${esc(raporNo)}</div>
            <div class="info-cell-label">Rapor Tarihi</div>
            <div class="info-cell-value">${esc(printDate)}</div>
          </div>
          <div class="info-row">
            <div class="info-cell-label">OSGB / Kurum</div>
            <div class="info-cell-value">${esc(kaza.osgbAd ?? '—')}</div>
            <div class="info-cell-label">Hazırlayan</div>
            <div class="info-cell-value">${esc(kaza.hazirlayanAd ?? 'İşyeri Hekimi')}</div>
          </div>
          <div class="info-row">
            <div class="info-cell-label">Yaralanma Şiddeti</div>
            <div class="info-cell-value">
              <span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700;background:${sCfg.bg};color:${sCfg.text};border:1.5px solid ${sCfg.border};">${esc(kaza.yaralanmaSiddeti)}</span>
            </div>
            <div class="info-cell-label">Kayıt Durumu</div>
            <div class="info-cell-value">
              <span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700;background:${dCfg.bg};color:${dCfg.text};border:1.5px solid ${dCfg.border};">${esc(kaza.durum)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- BÖLÜM 2: KAZAZEDE -->
    <div class="sec">
      <div class="sec-head red">
        <div class="sec-icon">👤</div>Bölüm 2 — Kazazede Bilgileri
      </div>
      <div class="sec-body">
        <div class="info-grid">
          <div class="info-row">
            <div class="info-cell-label">Ad Soyad</div>
            <div class="info-cell-value big">${esc(kaza.personelAd)}</div>
            <div class="info-cell-label">Görev / Unvan</div>
            <div class="info-cell-value">${esc(kaza.personelGorev ?? '—')}</div>
          </div>
          <div class="info-row">
            <div class="info-cell-label">Çalıştığı Firma</div>
            <div class="info-cell-value bold">${esc(kaza.firmaAd)}</div>
            <div class="info-cell-label">İş Günü Kaybı</div>
            <div class="info-cell-value bold" style="color:${kaza.isGunuKaybi > 0 ? '#DC2626' : '#16A34A'}">
              ${kaza.isGunuKaybi > 0 ? esc(String(kaza.isGunuKaybi)) + ' gün' : 'Yok'}
            </div>
          </div>
          <div class="info-row">
            <div class="info-cell-label">Hastaneye Kaldırıldı</div>
            <div class="info-cell-value bold" style="color:${kaza.hastaneyeKaldirildi ? '#DC2626' : '#16A34A'}">
              ${kaza.hastaneyeKaldirildi ? '✓ Evet' : '✗ Hayır'}
            </div>
            <div class="info-cell-label">Hastane Adı</div>
            <div class="info-cell-value">${esc(kaza.hastaneAdi || (kaza.hastaneyeKaldirildi ? 'Belirtilmemiş' : '—'))}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- BÖLÜM 3: KAZA BİLGİLERİ -->
    <div class="sec">
      <div class="sec-head amber">
        <div class="sec-icon">📅</div>Bölüm 3 — Kaza Bilgileri
      </div>
      <div class="sec-body">
        <div class="info-grid">
          <div class="info-row">
            <div class="info-cell-label">Kaza Tarihi</div>
            <div class="info-cell-value bold">${esc(fmtFull(kaza.kazaTarihi))}</div>
            <div class="info-cell-label">Kaza Saati</div>
            <div class="info-cell-value">${esc(kaza.kazaSaati || '—')}</div>
          </div>
          <div class="info-row">
            <div class="info-cell-label">Kaza Yeri</div>
            <div class="info-cell-value">${esc(kaza.kazaYeri || '—')}</div>
            <div class="info-cell-label">Kaza Türü</div>
            <div class="info-cell-value">${esc(kaza.kazaTuru || '—')}</div>
          </div>
          <div class="info-row">
            <div class="info-cell-label">Yaralanma Türü</div>
            <div class="info-cell-value">${esc(kaza.yaralanmaTuru || '—')}</div>
            <div class="info-cell-label">Yaralanma Şiddeti</div>
            <div class="info-cell-value">
              <span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700;background:${sCfg.bg};color:${sCfg.text};border:1.5px solid ${sCfg.border};">${esc(kaza.yaralanmaSiddeti)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- BÖLÜM 4: AÇIKLAMA -->
    <div class="sec">
      <div class="sec-head blue">
        <div class="sec-icon">📝</div>Bölüm 4 — Kaza Açıklaması
      </div>
      <div class="sec-body">
        <div class="text-box ${kaza.kazaAciklamasi ? 'danger' : 'empty'}">
          ${kaza.kazaAciklamasi ? esc(kaza.kazaAciklamasi) : 'Açıklama girilmemiş'}
        </div>
      </div>
    </div>

    <!-- BÖLÜM 5: VÜCUT -->
    <div class="sec">
      <div class="sec-head red">
        <div class="sec-icon">🩺</div>Bölüm 5 — Yaralanan Vücut Bölgeleri
      </div>
      <div class="sec-body">
        <div class="diagram-wrap">
          <div class="diagram-svg-area">
            ${svgBody}
          </div>
          <div class="diagram-info">
            <div style="font-size:9px;font-weight:800;color:#64748B;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;">
              Etkilenen Bölgeler — ${kaza.yaraliVucutBolgeleri.length} bölge
            </div>
            <div class="bolge-chips">
              ${kaza.yaraliVucutBolgeleri.length > 0
                ? kaza.yaraliVucutBolgeleri.map(id => `<span class="bolge-chip">${esc(VUCUT_LABEL[id] ?? id)}</span>`).join('')
                : '<span style="font-size:10px;color:#94A3B8;font-style:italic;">Vücut bölgesi belirtilmemiş</span>'
              }
            </div>
            ${kaza.yaraliVucutBolgeleri.length > 0 ? `
            <div class="klinik-not">
              <div class="klinik-not-title">⚕ Klinik Not</div>
              Kazazede <strong>${esc(kaza.personelAd)}</strong>; <strong>${esc(bolgeLabels)}</strong> bölgesinde
              <strong>${esc(kaza.yaralanmaTuru || 'belirtilmemiş türde')}</strong> yaralanma meydana gelmiştir.
              Yaralanma şiddeti <strong>${esc(kaza.yaralanmaSiddeti)}</strong> olarak değerlendirilmiştir.
              ${kaza.isGunuKaybi > 0 ? `Toplam <strong>${kaza.isGunuKaybi} iş günü kaybı</strong> rapor edilmiştir.` : ''}
            </div>
            ` : ''}
          </div>
        </div>
      </div>
    </div>

    <!-- BÖLÜM 6a + 6b YAN YANA -->
    <div class="two-col">
      <div class="sec" style="margin-top:0;">
        <div class="sec-head teal">
          <div class="sec-icon">👁</div>Bölüm 6a — Tanık Bilgileri
        </div>
        <div class="sec-body">
          <div class="text-box ${kaza.tanikBilgileri ? '' : 'empty'}">
            ${kaza.tanikBilgileri ? esc(kaza.tanikBilgileri) : 'Tanık bilgisi girilmemiş'}
          </div>
        </div>
      </div>
      <div class="sec" style="margin-top:0;">
        <div class="sec-head green">
          <div class="sec-icon">🛡</div>Bölüm 6b — Alınan Önlemler
        </div>
        <div class="sec-body">
          <div class="text-box ${kaza.onlemler ? 'success' : 'empty'}">
            ${kaza.onlemler ? esc(kaza.onlemler) : 'Önlem bilgisi girilmemiş'}
          </div>
        </div>
      </div>
    </div>

    <!-- BÖLÜM 7: YASAL -->
    <div class="sec">
      <div class="sec-head violet">
        <div class="sec-icon">⚖</div>Bölüm 7 — Yasal Yükümlülükler
      </div>
      <div class="sec-body">
        <div class="yasal-box">
          <div class="yasal-title">⚠ 6331 Sayılı İSG Kanunu Uyarınca</div>
          İş kazaları, kazanın olduğu günden itibaren en geç <strong>3 iş günü</strong> içinde işveren tarafından Sosyal Güvenlik Kurumu'na bildirilmelidir.
          Bu tutanak, yasal bildirim yükümlülüğünün yerine getirilmesine yönelik resmi kayıt belgesidir.
          Ağır yaralanma veya ölüm halinde yetkili Çalışma ve İş Kurumu İl Müdürlüğü'ne derhal bilgi verilmesi zorunludur.
        </div>
      </div>
    </div>

    <!-- İMZA ALANLARI -->
    <div class="imza-grid">
      <div class="imza-box">
        <div class="imza-head">Kazazede / Çalışan</div>
        <div class="imza-body">
          <div class="imza-alan"></div>
          <div class="imza-field"><span>Ad Soyad:</span><span>${esc(kaza.personelAd)}</span></div>
          <div class="imza-field"><span>Tarih:</span><span>${fmt(kaza.kazaTarihi)}</span></div>
        </div>
      </div>
      <div class="imza-box">
        <div class="imza-head">İşveren Vekili</div>
        <div class="imza-body">
          <div class="imza-alan"></div>
          <div class="imza-field"><span>Ad Soyad:</span><span>___________________</span></div>
          <div class="imza-field"><span>Ünvan:</span><span>___________________</span></div>
        </div>
      </div>
      <div class="imza-box">
        <div class="imza-head">İşyeri Hekimi / ISG Uzmanı</div>
        <div class="imza-body">
          <div class="imza-alan"></div>
          <div class="imza-field"><span>Ad Soyad:</span><span>${esc(kaza.hazirlayanAd ?? 'İşyeri Hekimi')}</span></div>
          <div class="imza-field"><span>Tarih:</span><span>${esc(printDate)}</span></div>
        </div>
      </div>
    </div>

  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-left">
      <span>Rapor No: <strong style="color:#334155;">${esc(raporNo)}</strong></span>
      <span>Kazazede: <strong style="color:#334155;">${esc(kaza.personelAd)}</strong></span>
      <span>Firma: <strong style="color:#334155;">${esc(kaza.firmaAd)}</strong></span>
    </div>
    <div>
      <span class="footer-badge">ISG Denetim Yönetim Sistemi</span>
    </div>
  </div>

</div>
</body>
</html>`;
}

function buildBodySvg(selected: string[]): string {
  const sel = new Set(selected);
  const fill = (id: string) => sel.has(id) ? '#EF4444' : '#CBD5E1';
  const opacity = (id: string) => sel.has(id) ? '1' : '0.45';
  const glow = (id: string) => sel.has(id) ? `filter:drop-shadow(0 0 3px #EF4444);` : '';

  // SVG inline vücut silueti - ön görünüm
  return `<svg width="100" height="220" viewBox="0 0 100 220" xmlns="http://www.w3.org/2000/svg" style="display:block;">
    <!-- Baş -->
    <ellipse cx="50" cy="18" rx="13" ry="15" fill="${fill('bas')}" opacity="${opacity('bas')}" style="${glow('bas')}"/>
    <!-- Boyun -->
    <rect x="44" y="31" width="12" height="10" rx="3" fill="${fill('boyun')}" opacity="${opacity('boyun')}" style="${glow('boyun')}"/>
    <!-- Gövde - Göğüs -->
    <rect x="28" y="40" width="44" height="38" rx="6" fill="${fill('gogus')}" opacity="${opacity('gogus')}" style="${glow('gogus')}"/>
    <!-- Gövde - Sırt (üst üste, biraz farklı renk) -->
    <rect x="32" y="42" width="36" height="30" rx="4" fill="${fill('sirt')}" opacity="${sel.has('sirt') ? '0.55' : '0'}"/>
    <!-- Karın/Bel -->
    <rect x="30" y="77" width="40" height="30" rx="5" fill="${fill('karin')}" opacity="${opacity('karin')}" style="${glow('karin')}"/>
    <!-- Sağ Omuz -->
    <ellipse cx="22" cy="46" rx="9" ry="8" fill="${fill('sag_omuz')}" opacity="${opacity('sag_omuz')}" style="${glow('sag_omuz')}"/>
    <!-- Sol Omuz -->
    <ellipse cx="78" cy="46" rx="9" ry="8" fill="${fill('sol_omuz')}" opacity="${opacity('sol_omuz')}" style="${glow('sol_omuz')}"/>
    <!-- Sağ Kol -->
    <rect x="8" y="52" width="13" height="36" rx="6" fill="${fill('sag_kol')}" opacity="${opacity('sag_kol')}" style="${glow('sag_kol')}"/>
    <!-- Sol Kol -->
    <rect x="79" y="52" width="13" height="36" rx="6" fill="${fill('sol_kol')}" opacity="${opacity('sol_kol')}" style="${glow('sol_kol')}"/>
    <!-- Sağ El -->
    <ellipse cx="14" cy="97" rx="8" ry="6" fill="${fill('sag_el')}" opacity="${opacity('sag_el')}" style="${glow('sag_el')}"/>
    <!-- Sol El -->
    <ellipse cx="86" cy="97" rx="8" ry="6" fill="${fill('sol_el')}" opacity="${opacity('sol_el')}" style="${glow('sol_el')}"/>
    <!-- Sağ Kalça -->
    <ellipse cx="36" cy="113" rx="12" ry="9" fill="${fill('sag_kalca')}" opacity="${opacity('sag_kalca')}" style="${glow('sag_kalca')}"/>
    <!-- Sol Kalça -->
    <ellipse cx="64" cy="113" rx="12" ry="9" fill="${fill('sol_kalca')}" opacity="${opacity('sol_kalca')}" style="${glow('sol_kalca')}"/>
    <!-- Sağ Bacak -->
    <rect x="27" y="120" width="18" height="56" rx="8" fill="${fill('sag_bacak')}" opacity="${opacity('sag_bacak')}" style="${glow('sag_bacak')}"/>
    <!-- Sol Bacak -->
    <rect x="55" y="120" width="18" height="56" rx="8" fill="${fill('sol_bacak')}" opacity="${opacity('sol_bacak')}" style="${glow('sol_bacak')}"/>
    <!-- Sağ Ayak -->
    <ellipse cx="36" cy="183" rx="11" ry="7" fill="${fill('sag_ayak')}" opacity="${opacity('sag_ayak')}" style="${glow('sag_ayak')}"/>
    <!-- Sol Ayak -->
    <ellipse cx="64" cy="183" rx="11" ry="7" fill="${fill('sol_ayak')}" opacity="${opacity('sol_ayak')}" style="${glow('sol_ayak')}"/>
    <!-- Merkez çizgisi (dekoratif) -->
    <line x1="50" y1="40" x2="50" y2="105" stroke="rgba(148,163,184,0.25)" stroke-width="1" stroke-dasharray="2,2"/>
  </svg>`;
}

export function printIsKazasiTutanagi(kaza: IsKazasiRaporData): void {
  const html = buildHtml(kaza);
  const win = window.open('', '_blank', 'width=960,height=820');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 900);
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
