import type { IsIzni, Firma, Personel } from '@/types';

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmt(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('tr-TR');
  } catch {
    return dateStr;
  }
}

export function generateIsIzniPdf(
  iz: IsIzni,
  firma: Firma | undefined,
  calisanlar: Personel[],
): void {
  const firmaAd = firma?.ad ?? '—';
  const calisanListesi = calisanlar.length > 0
    ? calisanlar.map(p => `${escHtml(p.adSoyad)} (${escHtml(p.gorev || '—')})`).join(', ')
    : escHtml(iz.calisanlar || '—');

  const durumColor = iz.durum === 'Onaylandı' ? '#16a34a' : iz.durum === 'Reddedildi' ? '#dc2626' : '#d97706';
  const durumBg = iz.durum === 'Onaylandı' ? '#dcfce7' : iz.durum === 'Reddedildi' ? '#fee2e2' : '#fef3c7';

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"/>
<title>İş İzni — ${escHtml(iz.izinNo)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1e293b; background: #fff; }
  .page { width: 210mm; min-height: 297mm; padding: 18mm 16mm; margin: 0 auto; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #1e3a5f; padding-bottom: 12px; margin-bottom: 18px; }
  .header-left h1 { font-size: 18px; font-weight: 800; color: #1e3a5f; letter-spacing: 0.5px; }
  .header-left p { font-size: 11px; color: #64748b; margin-top: 3px; }
  .izin-no { font-size: 22px; font-weight: 900; color: #1e3a5f; font-family: monospace; }
  .durum-badge { display: inline-block; padding: 5px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; background: ${durumBg}; color: ${durumColor}; border: 1.5px solid ${durumColor}; margin-top: 6px; }
  .section { margin-bottom: 16px; }
  .section-title { font-size: 11px; font-weight: 700; color: #fff; background: #1e3a5f; padding: 5px 10px; border-radius: 4px 4px 0 0; text-transform: uppercase; letter-spacing: 0.5px; }
  .section-body { border: 1px solid #cbd5e1; border-top: none; border-radius: 0 0 4px 4px; padding: 10px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  .field { }
  .field-label { font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 2px; }
  .field-value { font-size: 12px; color: #1e293b; font-weight: 500; padding: 4px 8px; background: #f8fafc; border-radius: 3px; border: 1px solid #e2e8f0; min-height: 26px; }
  .field-value.full { min-height: 40px; white-space: pre-wrap; }
  .calisan-list { font-size: 11px; color: #1e293b; padding: 6px 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 3px; line-height: 1.6; }
  .imza-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-top: 8px; }
  .imza-box { border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px; text-align: center; }
  .imza-label { font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
  .imza-alan { height: 50px; border-bottom: 1px dashed #94a3b8; margin-bottom: 4px; }
  .imza-ad { font-size: 10px; color: #94a3b8; }
  .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="header-left">
      <h1>İŞ İZNİ BELGESİ</h1>
      <p>${escHtml(firmaAd)} — ${fmt(iz.baslamaTarihi)}${iz.bitisTarihi ? ' → ' + fmt(iz.bitisTarihi) : ''}</p>
    </div>
    <div style="text-align:right">
      <div class="izin-no">${escHtml(iz.izinNo)}</div>
      <div class="durum-badge">${escHtml(iz.durum)}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Genel Bilgiler</div>
    <div class="section-body">
      <div class="grid3">
        <div class="field"><div class="field-label">İzin Tipi</div><div class="field-value">${escHtml(iz.tip)}</div></div>
        <div class="field"><div class="field-label">Firma</div><div class="field-value">${escHtml(firmaAd)}</div></div>
        <div class="field"><div class="field-label">Bölüm / Alan</div><div class="field-value">${escHtml(iz.bolum || '—')}</div></div>
        <div class="field"><div class="field-label">Sorumlu Kişi</div><div class="field-value">${escHtml(iz.sorumlu || '—')}</div></div>
        <div class="field"><div class="field-label">Başlama Tarihi</div><div class="field-value">${fmt(iz.baslamaTarihi)}</div></div>
        <div class="field"><div class="field-label">Bitiş Tarihi</div><div class="field-value">${fmt(iz.bitisTarihi)}</div></div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">İş Açıklaması</div>
    <div class="section-body">
      <div class="field-value full">${escHtml(iz.aciklama || '—')}</div>
    </div>
  </div>

  <div class="grid2" style="gap:12px; margin-bottom:16px;">
    <div class="section" style="margin-bottom:0">
      <div class="section-title" style="background:#7f1d1d;">Tehlikeler / Riskler</div>
      <div class="section-body">
        <div class="field-value full">${escHtml(iz.tehlikeler || '—')}</div>
      </div>
    </div>
    <div class="section" style="margin-bottom:0">
      <div class="section-title" style="background:#14532d;">Alınan Önlemler</div>
      <div class="section-body">
        <div class="field-value full">${escHtml(iz.onlemler || '—')}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Çalışanlar (${iz.calisanSayisi} kişi)</div>
    <div class="section-body">
      <div class="calisan-list">${calisanListesi}</div>
    </div>
  </div>

  ${iz.gerekliEkipman ? `
  <div class="section">
    <div class="section-title">Gerekli Ekipman / KKD</div>
    <div class="section-body">
      <div class="field-value">${escHtml(iz.gerekliEkipman)}</div>
    </div>
  </div>` : ''}

  <div class="section">
    <div class="section-title">Onay Bilgileri</div>
    <div class="section-body">
      <div class="grid3">
        <div class="field"><div class="field-label">Onaylayan Kişi</div><div class="field-value">${escHtml(iz.onaylayanKisi || '—')}</div></div>
        <div class="field"><div class="field-label">Onay Tarihi</div><div class="field-value">${fmt(iz.onayTarihi || '')}</div></div>
        <div class="field"><div class="field-label">Oluşturan</div><div class="field-value">${escHtml(iz.olusturanKisi || '—')}</div></div>
      </div>
    </div>
  </div>

  <div class="imza-grid">
    <div class="imza-box">
      <div class="imza-label">Çalışan / Sorumlu</div>
      <div class="imza-alan"></div>
      <div class="imza-ad">Ad Soyad / İmza</div>
    </div>
    <div class="imza-box">
      <div class="imza-label">İşveren / Vekili</div>
      <div class="imza-alan"></div>
      <div class="imza-ad">Ad Soyad / İmza</div>
    </div>
    <div class="imza-box">
      <div class="imza-label">ISG Uzmanı / Onay</div>
      <div class="imza-alan"></div>
      <div class="imza-ad">Ad Soyad / İmza / Kaşe</div>
    </div>
  </div>

  <div class="footer">
    <span>İzin No: ${escHtml(iz.izinNo)}</span>
    <span>Oluşturma: ${fmt(iz.olusturmaTarihi)}</span>
    <span>Bu belge resmi iş izni kaydıdır.</span>
  </div>
</div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 600);
}
