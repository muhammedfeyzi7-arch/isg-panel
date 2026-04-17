// EK-2 Periyodik Muayene Raporu — Profesyonel HTML/PDF Generator

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

function fmtFull(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch { return dateStr; }
}

function fmt(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return dateStr; }
}

function getDaysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
}

const SONUC_CFG: Record<string, { bg: string; text: string; border: string; label: string; icon: string }> = {
  uygun:       { bg: '#F0FDF4', text: '#14532D', border: '#86EFAC', label: 'Çalışabilir',         icon: '✓' },
  kisitli:     { bg: '#FFFBEB', text: '#78350F', border: '#FDE68A', label: 'Kısıtlı Çalışabilir', icon: '⚠' },
  uygun_degil: { bg: '#FFF1F2', text: '#9F1239', border: '#FECDD3', label: 'Çalışamaz',           icon: '✗' },
  // Eski değerler için geriye dönük uyumluluk
  'Çalışabilir':         { bg: '#F0FDF4', text: '#14532D', border: '#86EFAC', label: 'Çalışabilir',         icon: '✓' },
  'Kısıtlı Çalışabilir': { bg: '#FFFBEB', text: '#78350F', border: '#FDE68A', label: 'Kısıtlı Çalışabilir', icon: '⚠' },
  'Çalışamaz':           { bg: '#FFF1F2', text: '#9F1239', border: '#FECDD3', label: 'Çalışamaz',           icon: '✗' },
};

export interface MuayeneRaporData {
  id: string;
  personelAd: string;
  personelGorev?: string;
  firmaAd: string;
  muayeneTarihi: string;
  sonrakiTarih?: string;
  sonuc: string;
  hastane?: string;
  doktor?: string;
  notlar?: string;
  aciklama?: string;
  // EK-2 alanları
  kronikHastaliklar?: string;
  ilacKullanim?: string;
  ameliyatGecmisi?: string;
  tansiyon?: string;
  nabiz?: string;
  gorme?: string;
  isitme?: string;
  // Meta
  hekimAd?: string;
  osgbAd?: string;
}

function buildHtml(m: MuayeneRaporData): string {
  const printDate = fmtFull(new Date().toISOString());
  const raporNo = `EK2-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000) + 10000)}`;
  const sCfg = SONUC_CFG[m.sonuc] ?? SONUC_CFG['uygun'];
  const sonucLabel = sCfg.label;
  const daysUntil = getDaysUntil(m.sonrakiTarih);
  const isYaklasiyor = daysUntil !== null && daysUntil >= 0 && daysUntil <= 30;
  const isGecmis = daysUntil !== null && daysUntil < 0;

  const sonrakiStyle = isGecmis
    ? 'background:#FFF1F2;color:#9F1239;border:1.5px solid #FECDD3;'
    : isYaklasiyor
    ? 'background:#FFFBEB;color:#78350F;border:1.5px solid #FDE68A;'
    : 'background:#F0FDF4;color:#14532D;border:1.5px solid #86EFAC;';

  const bulgular = [
    { label: 'Tansiyon', value: m.tansiyon, icon: '❤' },
    { label: 'Nabız', value: m.nabiz, icon: '〜' },
    { label: 'Görme', value: m.gorme, icon: '👁' },
    { label: 'İşitme', value: m.isitme, icon: '👂' },
  ].filter(b => b.value);

  const saglikBeyan = [
    { label: 'Kronik Hastalıklar', value: m.kronikHastaliklar },
    { label: 'İlaç Kullanımı', value: m.ilacKullanim },
    { label: 'Ameliyat Geçmişi', value: m.ameliyatGecmisi },
  ].filter(b => b.value);

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>EK-2 Periyodik Muayene Formu — ${raporNo}</title>
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

  /* ── KAPAK ── */
  .cover {
    background: linear-gradient(135deg, #0F172A 0%, #0C4A6E 60%, #0a2540 100%);
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
    background: rgba(14,165,233,0.08);
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
    background: rgba(14,165,233,0.2);
    color: #7DD3FC;
    border: 1px solid rgba(14,165,233,0.3);
  }
  .cover-badge-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #0EA5E9;
  }
  .cover-no {
    font-size: 10px;
    font-weight: 700;
    color: rgba(255,255,255,0.5);
    letter-spacing: 0.5px;
  }
  .cover-title {
    font-size: 24px;
    font-weight: 900;
    color: #fff;
    letter-spacing: -0.5px;
    line-height: 1.15;
    margin-bottom: 4px;
  }
  .cover-sub {
    font-size: 11px;
    color: rgba(255,255,255,0.5);
    letter-spacing: 0.5px;
    margin-bottom: 14px;
  }
  .cover-sonuc {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 18px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 800;
    background: ${sCfg.bg};
    color: ${sCfg.text};
    border: 2px solid ${sCfg.border};
    margin-bottom: 14px;
  }
  .cover-meta {
    display: flex;
    gap: 20px;
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

  /* ── ANA İÇERİK ── */
  .body-wrap { padding: 0 28px; }

  /* ── BÖLÜM ── */
  .sec {
    margin-top: 14px;
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
  .sec-head.blue   { background: #0C4A6E; }
  .sec-head.teal   { background: #134E4A; }
  .sec-head.green  { background: #14532D; }
  .sec-head.amber  { background: #78350F; }
  .sec-head.red    { background: #9F1239; }
  .sec-head.slate  { background: #334155; }
  .sec-icon {
    width: 18px; height: 18px;
    border-radius: 4px;
    background: rgba(255,255,255,0.15);
    display: flex; align-items: center; justify-content: center;
    font-size: 10px;
  }
  .sec-body { background: #fff; }

  /* ── BİLGİ TABLOSU ── */
  .info-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-bottom: 1px solid #F1F5F9;
  }
  .info-row:last-child { border-bottom: none; }
  .info-row.full { grid-template-columns: 1fr; }
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
  .text-box.empty { color: #94A3B8; font-style: italic; }

  /* ── BULGULAR GRID ── */
  .bulgular-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0;
  }
  .bulgu-cell {
    padding: 12px 14px;
    border-right: 1px solid #F1F5F9;
    text-align: center;
  }
  .bulgu-cell:last-child { border-right: none; }
  .bulgu-icon { font-size: 18px; margin-bottom: 4px; }
  .bulgu-label { font-size: 8.5px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .bulgu-value { font-size: 13px; font-weight: 800; color: #0C4A6E; }
  .bulgu-empty { font-size: 11px; color: #CBD5E1; font-style: italic; }

  /* ── KARAR KUTUSU ── */
  .karar-box {
    padding: 16px 20px;
    background: ${sCfg.bg};
    border-bottom: 1px solid ${sCfg.border};
  }
  .karar-main {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 10px;
  }
  .karar-icon-wrap {
    width: 48px; height: 48px;
    border-radius: 12px;
    background: rgba(255,255,255,0.7);
    border: 2px solid ${sCfg.border};
    display: flex; align-items: center; justify-content: center;
    font-size: 22px;
    flex-shrink: 0;
  }
  .karar-title {
    font-size: 18px;
    font-weight: 900;
    color: ${sCfg.text};
    letter-spacing: -0.3px;
  }
  .karar-sub {
    font-size: 10px;
    color: ${sCfg.text};
    opacity: 0.7;
    margin-top: 2px;
  }
  .karar-aciklama {
    padding: 10px 14px;
    background: rgba(255,255,255,0.6);
    border-radius: 8px;
    font-size: 11px;
    line-height: 1.7;
    color: ${sCfg.text};
    border: 1px solid ${sCfg.border};
  }

  /* ── TAKİP ── */
  .takip-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
  }
  .takip-cell {
    padding: 12px 16px;
    border-right: 1px solid #F1F5F9;
  }
  .takip-cell:last-child { border-right: none; }
  .takip-label { font-size: 9px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .takip-value { font-size: 13px; font-weight: 800; color: #0C4A6E; }
  .takip-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 10px;
    font-weight: 700;
    margin-top: 4px;
  }

  /* ── İMZA ── */
  .imza-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
  .imza-box { border: 1.5px solid #E2E8F0; border-radius: 10px; overflow: hidden; }
  .imza-head { background: #0C4A6E; color: #fff; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.7px; padding: 7px 12px; }
  .imza-body { padding: 12px; }
  .imza-alan { height: 52px; border-bottom: 1.5px dashed #CBD5E1; margin-bottom: 8px; }
  .imza-field { display: flex; justify-content: space-between; font-size: 9px; color: #64748B; margin-top: 4px; }
  .imza-field span:last-child { font-weight: 600; color: #334155; }

  /* ── YASAL ── */
  .yasal-box {
    padding: 12px 14px;
    background: linear-gradient(135deg, #EFF6FF, #DBEAFE);
    border: 1.5px solid #BFDBFE;
    border-radius: 8px;
    font-size: 10px;
    color: #1E3A5F;
    line-height: 1.8;
  }
  .yasal-title { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #1E40AF; margin-bottom: 6px; }

  /* ── FOOTER ── */
  .footer {
    margin: 16px 28px 0;
    padding-top: 12px;
    border-top: 2px solid #E2E8F0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 9.5px;
    color: #94A3B8;
  }
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
        EK-2 Periyodik Muayene Formu
      </div>
      <div class="cover-no">Rapor No: ${esc(raporNo)}</div>
    </div>

    <div class="cover-title">PERİYODİK SAĞLIK MUAYENESİ</div>
    <div class="cover-sub">PERIODIC HEALTH EXAMINATION &nbsp;·&nbsp; ISG Denetim Yönetim Sistemi</div>

    <div class="cover-sonuc">
      <span>${sCfg.icon}</span>
      <span>KARAR: ${esc(sonucLabel)}</span>
    </div>

    <div class="cover-meta">
      <div class="cover-meta-item">
        <span class="cover-meta-label">Çalışan</span>
        <span class="cover-meta-value">${esc(m.personelAd)}</span>
      </div>
      <div class="cover-meta-item">
        <span class="cover-meta-label">Firma</span>
        <span class="cover-meta-value">${esc(m.firmaAd)}</span>
      </div>
      <div class="cover-meta-item">
        <span class="cover-meta-label">Muayene Tarihi</span>
        <span class="cover-meta-value">${esc(fmtFull(m.muayeneTarihi))}</span>
      </div>
      <div class="cover-meta-item">
        <span class="cover-meta-label">Rapor Tarihi</span>
        <span class="cover-meta-value">${esc(printDate)}</span>
      </div>
    </div>
  </div>

  <div class="body-wrap">

    <!-- BÖLÜM 1: KİŞİSEL BİLGİLER -->
    <div class="sec">
      <div class="sec-head blue">
        <div class="sec-icon">👤</div>Bölüm 1 — Çalışan Bilgileri
      </div>
      <div class="sec-body">
        <div class="info-row">
          <div class="info-cell-label">Ad Soyad</div>
          <div class="info-cell-value big">${esc(m.personelAd)}</div>
          <div class="info-cell-label">Görev / Unvan</div>
          <div class="info-cell-value">${esc(m.personelGorev || '—')}</div>
        </div>
        <div class="info-row">
          <div class="info-cell-label">Çalıştığı Firma</div>
          <div class="info-cell-value bold">${esc(m.firmaAd)}</div>
          <div class="info-cell-label">Rapor No</div>
          <div class="info-cell-value" style="font-family:monospace;color:#0C4A6E;font-weight:700;">${esc(raporNo)}</div>
        </div>
        <div class="info-row">
          <div class="info-cell-label">Muayene Tarihi</div>
          <div class="info-cell-value bold">${esc(fmtFull(m.muayeneTarihi))}</div>
          <div class="info-cell-label">Sonraki Muayene</div>
          <div class="info-cell-value">
            ${m.sonrakiTarih
              ? `<span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700;${sonrakiStyle}">${esc(fmtFull(m.sonrakiTarih))}${isGecmis ? ' (Geçti!)' : isYaklasiyor ? ' (Yaklaşıyor)' : ''}</span>`
              : '<span style="color:#94A3B8;">—</span>'
            }
          </div>
        </div>
        <div class="info-row">
          <div class="info-cell-label">Hekim / Klinik</div>
          <div class="info-cell-value">${esc(m.doktor || '—')}</div>
          <div class="info-cell-label">Hastane / Kurum</div>
          <div class="info-cell-value">${esc(m.hastane || '—')}</div>
        </div>
      </div>
    </div>

    <!-- BÖLÜM 2: SAĞLIK BEYANI -->
    ${saglikBeyan.length > 0 ? `
    <div class="sec">
      <div class="sec-head teal">
        <div class="sec-icon">📋</div>Bölüm 2 — Sağlık Beyanı
      </div>
      <div class="sec-body">
        ${saglikBeyan.map(b => `
        <div class="info-row full">
          <div class="info-cell-label">${esc(b.label)}</div>
        </div>
        <div class="info-row full">
          <div class="text-box">${esc(b.value)}</div>
        </div>
        `).join('')}
      </div>
    </div>
    ` : `
    <div class="sec">
      <div class="sec-head teal">
        <div class="sec-icon">📋</div>Bölüm 2 — Sağlık Beyanı
      </div>
      <div class="sec-body">
        <div class="text-box empty">Sağlık beyanı bilgisi girilmemiş</div>
      </div>
    </div>
    `}

    <!-- BÖLÜM 3: BULGULAR -->
    <div class="sec">
      <div class="sec-head blue">
        <div class="sec-icon">🩺</div>Bölüm 3 — Muayene Bulguları
      </div>
      <div class="sec-body">
        ${bulgular.length > 0 ? `
        <div class="bulgular-grid">
          ${bulgular.map(b => `
          <div class="bulgu-cell">
            <div class="bulgu-icon">${b.icon}</div>
            <div class="bulgu-label">${esc(b.label)}</div>
            <div class="bulgu-value">${esc(b.value)}</div>
          </div>
          `).join('')}
        </div>
        ` : `<div class="text-box empty">Bulgu bilgisi girilmemiş — değerlendirilmedi</div>`}
      </div>
    </div>

    <!-- BÖLÜM 4: KARAR -->
    <div class="sec">
      <div class="sec-head ${m.sonuc === 'uygun' || m.sonuc === 'Çalışabilir' ? 'green' : m.sonuc === 'kisitli' || m.sonuc === 'Kısıtlı Çalışabilir' ? 'amber' : 'red'}">
        <div class="sec-icon">✅</div>Bölüm 4 — Hekim Kararı
      </div>
      <div class="sec-body">
        <div class="karar-box">
          <div class="karar-main">
            <div class="karar-icon-wrap">${sCfg.icon}</div>
            <div>
              <div class="karar-title">${esc(sonucLabel)}</div>
              <div class="karar-sub">
                ${m.sonuc === 'uygun' || m.sonuc === 'Çalışabilir'
                  ? 'Çalışan, mevcut görevinde çalışmaya uygundur.'
                  : m.sonuc === 'kisitli' || m.sonuc === 'Kısıtlı Çalışabilir'
                  ? 'Çalışan, belirtilen kısıtlamalar dahilinde çalışabilir.'
                  : 'Çalışan, mevcut görevinde çalışmaya uygun değildir.'
                }
              </div>
            </div>
          </div>
          ${(m.aciklama || m.notlar) ? `
          <div class="karar-aciklama">
            <strong>Hekim Notu / Kısıtlamalar:</strong><br>
            ${esc(m.aciklama || m.notlar)}
          </div>
          ` : ''}
        </div>
      </div>
    </div>

    <!-- BÖLÜM 5: TAKİP TARİHLERİ -->
    <div class="sec">
      <div class="sec-head slate">
        <div class="sec-icon">📅</div>Bölüm 5 — Takip Tarihleri
      </div>
      <div class="sec-body">
        <div class="takip-grid">
          <div class="takip-cell">
            <div class="takip-label">Muayene Tarihi</div>
            <div class="takip-value">${esc(fmt(m.muayeneTarihi))}</div>
          </div>
          <div class="takip-cell">
            <div class="takip-label">Sonraki Muayene</div>
            <div class="takip-value">${m.sonrakiTarih ? esc(fmt(m.sonrakiTarih)) : '—'}</div>
            ${m.sonrakiTarih ? `
            <div class="takip-badge" style="${sonrakiStyle}">
              ${isGecmis ? 'Muayene tarihi geçti!' : isYaklasiyor ? `${daysUntil} gün kaldı` : 'Zamanında'}
            </div>
            ` : ''}
          </div>
        </div>
      </div>
    </div>

    <!-- BÖLÜM 6: YASAL -->
    <div class="sec">
      <div class="sec-head blue">
        <div class="sec-icon">⚖</div>Bölüm 6 — Yasal Dayanak
      </div>
      <div class="sec-body" style="padding:14px;">
        <div class="yasal-box">
          <div class="yasal-title">6331 Sayılı İSG Kanunu &amp; İşyeri Hekimliği Yönetmeliği</div>
          Bu form, 6331 Sayılı İş Sağlığı ve Güvenliği Kanunu ile İşyeri Hekimi ve Diğer Sağlık Personelinin Görev, Yetki, Sorumluluk ve Eğitimleri Hakkında Yönetmelik kapsamında
          düzenlenen <strong>EK-2 Periyodik Sağlık Muayenesi</strong> belgesidir.
          Muayene sonucu işveren ve çalışana bildirilmiş olup, kayıtlar yasal süre boyunca saklanacaktır.
        </div>
      </div>
    </div>

    <!-- İMZA ALANLARI -->
    <div class="imza-grid">
      <div class="imza-box">
        <div class="imza-head">Çalışan</div>
        <div class="imza-body">
          <div class="imza-alan"></div>
          <div class="imza-field"><span>Ad Soyad:</span><span>${esc(m.personelAd)}</span></div>
          <div class="imza-field"><span>Tarih:</span><span>${esc(fmt(m.muayeneTarihi))}</span></div>
        </div>
      </div>
      <div class="imza-box">
        <div class="imza-head">İşyeri Hekimi</div>
        <div class="imza-body">
          <div class="imza-alan"></div>
          <div class="imza-field"><span>Ad Soyad:</span><span>${esc(m.hekimAd || m.doktor || 'İşyeri Hekimi')}</span></div>
          <div class="imza-field"><span>Tarih:</span><span>${esc(printDate)}</span></div>
        </div>
      </div>
    </div>

  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div style="display:flex;gap:14px;">
      <span>Rapor No: <strong style="color:#334155;">${esc(raporNo)}</strong></span>
      <span>Çalışan: <strong style="color:#334155;">${esc(m.personelAd)}</strong></span>
      <span>Firma: <strong style="color:#334155;">${esc(m.firmaAd)}</strong></span>
    </div>
    <span class="footer-badge">ISG Denetim — EK-2 Muayene Formu</span>
  </div>

</div>
</body>
</html>`;
}

export function printMuayeneRaporu(data: MuayeneRaporData): void {
  const html = buildHtml(data);
  const win = window.open('', '_blank', 'width=960,height=820');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 900);
}

export function downloadMuayeneHtml(data: MuayeneRaporData): void {
  const html = buildHtml(data);
  const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const dateStr = data.muayeneTarihi
    ? new Date(data.muayeneTarihi).toLocaleDateString('tr-TR').replace(/\./g, '-')
    : new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
  link.download = `${dateStr}-EK2-Muayene-${data.personelAd.replace(/\s+/g, '-')}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
