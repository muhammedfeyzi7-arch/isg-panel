import type { Uygunsuzluk, Firma, Personel } from '../../../types';

function esc(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
}

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
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
    const personel = personeller.find(p => p.id === r.personelId);
    const acilisFoto = r.acilisFotoMevcut ? getPhoto(r.id, 'acilis') : undefined;
    const kapatmaFoto = r.kapatmaFotoMevcut ? getPhoto(r.id, 'kapatma') : undefined;
    const isKapandi = r.durum === 'Kapandı';

    const photoSection = (src: string | undefined, label: string, borderColor: string) => src ? `
      <div class="photo-box" style="border-color:${borderColor}">
        <div class="photo-label" style="color:${borderColor}">${label}</div>
        <img src="${src}" alt="${label}" />
      </div>` : '';

    return `
    <div class="record" style="page-break-inside:avoid">
      <div class="record-header">
        <div class="record-num">${i + 1}</div>
        <div class="record-title-wrap">
          <span class="dof-no">${esc(r.acilisNo ?? `DÖF-${i + 1}`)}</span>
          <h3>${esc(r.baslik)}</h3>
        </div>
        <div class="status-badge ${isKapandi ? 'status-kapandi' : 'status-acik'}">
          ${isKapandi ? 'Kapandı' : 'Açık Uygunsuzluk'}
        </div>
      </div>

      <table class="info-table">
        <tr>
          <td class="info-cell"><span class="info-lbl">Firma</span><span class="info-val">${esc(firma?.ad)}</span></td>
          <td class="info-cell"><span class="info-lbl">Personel</span><span class="info-val">${esc(personel?.adSoyad ?? '—')}</span></td>
          <td class="info-cell"><span class="info-lbl">Tespit Tarihi</span><span class="info-val">${esc(fmtDate(r.tarih))}</span></td>
          <td class="info-cell"><span class="info-lbl">Önem</span><span class="info-val">${esc(r.severity)}</span></td>
        </tr>
        ${r.sorumlu || r.hedefTarih ? `<tr>
          ${r.sorumlu ? `<td class="info-cell"><span class="info-lbl">Sorumlu</span><span class="info-val">${esc(r.sorumlu)}</span></td>` : '<td></td>'}
          ${r.hedefTarih ? `<td class="info-cell"><span class="info-lbl">Hedef Tarih</span><span class="info-val">${esc(fmtDate(r.hedefTarih))}</span></td>` : '<td></td>'}
          ${r.kapatmaTarihi ? `<td class="info-cell"><span class="info-lbl">Kapatma Tarihi</span><span class="info-val">${esc(fmtDate(r.kapatmaTarihi))}</span></td>` : '<td></td>'}
          <td></td>
        </tr>` : ''}
      </table>

      ${r.aciklama ? `<div class="section-block"><div class="section-title">Uygunsuzluk Açıklaması</div><div class="section-body">${esc(r.aciklama)}</div></div>` : ''}
      ${r.onlem ? `<div class="section-block warning-block"><div class="section-title">Alınması Gereken Önlem</div><div class="section-body">${esc(r.onlem)}</div></div>` : ''}

      ${acilisFoto || kapatmaFoto ? `<div class="photos-row">
        ${photoSection(acilisFoto, 'Açılış Fotoğrafı', '#F97316')}
        ${photoSection(kapatmaFoto, 'Kapatma Fotoğrafı', '#22C55E')}
      </div>` : ''}

      ${r.kapatmaAciklama ? `<div class="section-block success-block"><div class="section-title">Kapatma Açıklaması</div><div class="section-body">${esc(r.kapatmaAciklama)}</div></div>` : ''}
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>DÖF Raporu — ${printDate}</title>
<style>
  *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
  html{font-size:12.5px}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1E293B;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{width:794px;margin:0 auto;padding:0 40px 40px}
  .accent{height:5px;background:linear-gradient(90deg,#EF4444 0%,#F97316 60%,#FCD34D 100%);margin-bottom:24px}
  .header{display:table;width:100%;border-collapse:collapse;padding-bottom:16px;border-bottom:2px solid #E2E8F0;margin-bottom:20px}
  .hdr-l{display:table-cell;vertical-align:middle}
  .hdr-r{display:table-cell;vertical-align:middle;text-align:right}
  .hdr-tag{font-size:9px;letter-spacing:3px;font-weight:700;color:#94A3B8;text-transform:uppercase;margin-bottom:3px}
  .hdr-title{font-size:20px;font-weight:800;color:#0F172A}
  .hdr-sub{font-size:11px;font-weight:600;color:#EF4444;margin-top:2px;text-transform:uppercase;letter-spacing:1px}
  .print-date{font-size:11px;color:#94A3B8}
  .summary{display:table;width:100%;border-collapse:separate;border-spacing:8px;margin-bottom:24px}
  .sum-cell{display:table-cell;width:33%;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:10px 14px;text-align:center;vertical-align:middle}
  .sum-num{font-size:22px;font-weight:800;color:#0F172A;line-height:1}
  .sum-label{font-size:10px;color:#64748B;margin-top:3px;font-weight:600}
  .sum-acik .sum-num{color:#EF4444}
  .sum-kapandi .sum-num{color:#22C55E}
  .record{border:1px solid #E2E8F0;border-radius:10px;overflow:hidden;margin-bottom:20px}
  .record-header{display:flex;align-items:center;gap:10px;padding:12px 16px;background:#F8FAFC;border-bottom:1px solid #E2E8F0}
  .record-num{width:26px;height:26px;background:#EF4444;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0}
  .record-title-wrap{flex:1}
  .dof-no{font-size:10px;font-family:'Courier New',monospace;font-weight:700;color:#6366F1;background:#EEF2FF;padding:2px 8px;border-radius:4px;margin-bottom:3px;display:inline-block}
  .record-title-wrap h3{font-size:14px;font-weight:700;color:#0F172A;margin-top:2px}
  .status-badge{padding:4px 12px;border-radius:20px;font-size:10px;font-weight:700;white-space:nowrap;flex-shrink:0}
  .status-acik{background:rgba(239,68,68,0.1);color:#EF4444;border:1px solid rgba(239,68,68,0.2)}
  .status-kapandi{background:rgba(34,197,94,0.1);color:#16A34A;border:1px solid rgba(34,197,94,0.2)}
  .info-table{width:100%;border-collapse:collapse;padding:0 16px;margin:12px 0}
  .info-cell{padding:4px 16px 4px 0;vertical-align:top;width:25%}
  .info-lbl{display:block;font-size:9.5px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;margin-bottom:2px}
  .info-val{display:block;font-size:12px;font-weight:600;color:#374151}
  .section-block{margin:0 16px 12px;padding:10px 12px;border-radius:8px;background:#F8FAFC;border-left:3px solid #6366F1}
  .warning-block{background:#FFFBEB;border-left-color:#F59E0B}
  .success-block{background:#F0FDF4;border-left-color:#22C55E}
  .section-title{font-size:9.5px;text-transform:uppercase;letter-spacing:0.8px;font-weight:700;color:#94A3B8;margin-bottom:4px}
  .section-body{font-size:12px;color:#374151;line-height:1.6;white-space:pre-wrap;word-wrap:break-word}
  .photos-row{display:flex;gap:12px;padding:0 16px 14px}
  .photo-box{flex:1;border:1px solid;border-radius:8px;overflow:hidden}
  .photo-label{padding:5px 10px;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;font-weight:700;background:#F8FAFC}
  .photo-box img{width:100%;max-height:220px;object-fit:contain;background:#F1F5F9;display:block}
  .footer{text-align:center;font-size:10px;color:#94A3B8;padding-top:14px;border-top:1px solid #E2E8F0;margin-top:16px}
  @media print{body{background:#fff!important}.page{width:100%!important;padding:0 24px 24px!important}@page{size:A4 portrait;margin:1.2cm}}
</style>
</head>
<body>
<div class="accent"></div>
<div class="page">
  <div class="header">
    <div class="hdr-l">
      <div class="hdr-tag">T.C.</div>
      <div class="hdr-title">DÖF RAPORU</div>
      <div class="hdr-sub">Düzeltici ve Önleyici Faaliyet — Uygunsuzluk Yönetimi</div>
    </div>
    <div class="hdr-r">
      <div class="print-date">${printDate}</div>
    </div>
  </div>

  <table class="summary">
    <tr>
      <td class="sum-cell"><div class="sum-num">${total}</div><div class="sum-label">Toplam Kayıt</div></td>
      <td class="sum-cell sum-acik"><div class="sum-num">${acik}</div><div class="sum-label">Açık Uygunsuzluk</div></td>
      <td class="sum-cell sum-kapandi"><div class="sum-num">${kapandi}</div><div class="sum-label">Kapatılan</div></td>
    </tr>
  </table>

  ${rows}

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
