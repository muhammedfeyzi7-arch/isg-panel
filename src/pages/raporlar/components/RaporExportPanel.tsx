import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import XLSXStyle from 'xlsx-js-style';
import {
  COLORS, headerStyle, cellStyle, titleStyle, statusStyle,
  cellAddr, setRowHeights, addMerge,
} from '@/utils/excelStyles';
import jsPDF from 'jspdf';

function getDaysUntil(dateStr: string): number {
  if (!dateStr) return 9999;
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / 86400000);
}

function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('tr-TR');
}

type ExportTip = 'genel' | 'firma' | 'muayene' | 'ekipman';

export default function RaporExportPanel() {
  const { firmalar, personeller, evraklar, ekipmanlar, muayeneler, uygunsuzluklar, egitimler } = useApp();
  const [secilenTip, setSecilenTip] = useState<ExportTip>('genel');
  const [secilenFirmaId, setSecilenFirmaId] = useState('');
  const [exporting, setExporting] = useState<string | null>(null);

  const aktifFirmalar = firmalar.filter(f => !f.silinmis);

  // ── GENEL EXCEL ──
  const handleGenelExcel = async () => {
    setExporting('genel_excel');
    try {
      const today = new Date().toLocaleDateString('tr-TR');
      const firma = secilenFirmaId ? aktifFirmalar.find(f => f.id === secilenFirmaId) : null;
      const baslik = firma ? `${firma.ad} — Genel Rapor — ${today}` : `Genel ISG Raporu — ${today}`;

      // Birden fazla sekme oluştur
      const wb = XLSXStyle.utils.book_new();

      // 1. SEKME: Personeller
      const filteredPersoneller = personeller.filter(p => !p.silinmis && p.durum === 'Aktif' && (!secilenFirmaId || p.firmaId === secilenFirmaId));
      const pData = [
        [baslik, '', '', '', ''],
        ['Ad Soyad', 'Görev', 'Firma', 'Durum', 'TC Kimlik'],
        ...filteredPersoneller.map(p => {
          const f = firmalar.find(x => x.id === p.firmaId);
          return [p.adSoyad, p.gorev || '—', f?.ad || '—', p.durum, p.tcKimlik || '—'];
        }),
      ];
      const wsP = XLSXStyle.utils.aoa_to_sheet(pData);
      [0, 1, 2, 3, 4].forEach((ci) => {
        const addr = cellAddr(ci, 0);
        if (!wsP[addr]) wsP[addr] = { v: ci === 0 ? baslik : '', t: 's' };
        (wsP[addr] as XLSXStyle.CellObject).s = titleStyle();
      });
      ['Ad Soyad', 'Görev', 'Firma', 'Durum', 'TC Kimlik'].forEach((col, ci) => {
        const addr = cellAddr(ci, 1);
        if (!wsP[addr]) wsP[addr] = { v: col, t: 's' };
        (wsP[addr] as XLSXStyle.CellObject).s = headerStyle();
      });
      filteredPersoneller.forEach((_, ri) => {
        [0, 1, 2, 3, 4].forEach(ci => {
          const addr = cellAddr(ci, ri + 2);
          if (wsP[addr]) (wsP[addr] as XLSXStyle.CellObject).s = cellStyle(ri);
        });
      });
      addMerge(wsP, { r: 0, c: 0 }, { r: 0, c: 4 });
      wsP['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 22 }, { wch: 14 }, { wch: 18 }];
      setRowHeights(wsP, [28, 22, ...filteredPersoneller.map(() => 18)]);
      XLSXStyle.utils.book_append_sheet(wb, wsP, 'Personeller');

      // 2. SEKME: Ekipmanlar
      const filteredEkipmanlar = ekipmanlar.filter(e => !e.silinmis && (!secilenFirmaId || e.firmaId === secilenFirmaId));
      const ekData = [
        [baslik, '', '', '', '', ''],
        ['Ekipman Adı', 'Firma', 'Durum', 'Son Kontrol', 'Sonraki Kontrol', 'Kalan Gün'],
        ...filteredEkipmanlar.map(e => {
          const f = firmalar.find(x => x.id === e.firmaId);
          const days = getDaysUntil(e.sonrakiKontrolTarihi ?? '');
          return [e.ad, f?.ad || '—', e.durum, fmtDate(e.sonKontrolTarihi ?? ''), fmtDate(e.sonrakiKontrolTarihi ?? ''), e.sonrakiKontrolTarihi ? String(days) : '—'];
        }),
      ];
      const wsEk = XLSXStyle.utils.aoa_to_sheet(ekData);
      [0, 1, 2, 3, 4, 5].forEach((ci) => {
        const addr = cellAddr(ci, 0);
        if (!wsEk[addr]) wsEk[addr] = { v: ci === 0 ? baslik : '', t: 's' };
        (wsEk[addr] as XLSXStyle.CellObject).s = titleStyle();
      });
      ['Ekipman Adı', 'Firma', 'Durum', 'Son Kontrol', 'Sonraki Kontrol', 'Kalan Gün'].forEach((col, ci) => {
        const addr = cellAddr(ci, 1);
        if (!wsEk[addr]) wsEk[addr] = { v: col, t: 's' };
        (wsEk[addr] as XLSXStyle.CellObject).s = headerStyle();
      });
      filteredEkipmanlar.forEach((e, ri) => {
        [0, 1, 2, 3, 4, 5].forEach(ci => {
          const addr = cellAddr(ci, ri + 2);
          if (!wsEk[addr]) return;
          if (ci === 2) (wsEk[addr] as XLSXStyle.CellObject).s = statusStyle(e.durum);
          else (wsEk[addr] as XLSXStyle.CellObject).s = cellStyle(ri);
        });
      });
      addMerge(wsEk, { r: 0, c: 0 }, { r: 0, c: 5 });
      wsEk['!cols'] = [{ wch: 26 }, { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 12 }];
      setRowHeights(wsEk, [28, 22, ...filteredEkipmanlar.map(() => 18)]);
      XLSXStyle.utils.book_append_sheet(wb, wsEk, 'Ekipmanlar');

      // 3. SEKME: Muayeneler
      const filteredMuayeneler = muayeneler.filter(m => !m.silinmis && (!secilenFirmaId || m.firmaId === secilenFirmaId));
      const muData = [
        [baslik, '', '', '', '', ''],
        ['Personel', 'Firma', 'Muayene Tarihi', 'Sonraki Muayene', 'Kalan Gün', 'Durum'],
        ...filteredMuayeneler.map(m => {
          const p = personeller.find(x => x.id === m.personelId);
          const f = firmalar.find(x => x.id === m.firmaId);
          const days = getDaysUntil(m.sonrakiTarih);
          const durum = days < 0 ? 'Süresi Geçmiş' : days <= 30 ? 'Yaklaşıyor' : 'Güncel';
          return [p?.adSoyad || '—', f?.ad || '—', fmtDate(m.muayeneTarihi), fmtDate(m.sonrakiTarih), m.sonrakiTarih ? String(days) : '—', durum];
        }),
      ];
      const wsMu = XLSXStyle.utils.aoa_to_sheet(muData);
      [0, 1, 2, 3, 4, 5].forEach((ci) => {
        const addr = cellAddr(ci, 0);
        if (!wsMu[addr]) wsMu[addr] = { v: ci === 0 ? baslik : '', t: 's' };
        (wsMu[addr] as XLSXStyle.CellObject).s = titleStyle();
      });
      ['Personel', 'Firma', 'Muayene Tarihi', 'Sonraki Muayene', 'Kalan Gün', 'Durum'].forEach((col, ci) => {
        const addr = cellAddr(ci, 1);
        if (!wsMu[addr]) wsMu[addr] = { v: col, t: 's' };
        (wsMu[addr] as XLSXStyle.CellObject).s = headerStyle();
      });
      filteredMuayeneler.forEach((m, ri) => {
        const days = getDaysUntil(m.sonrakiTarih);
        const durum = days < 0 ? 'Süresi Geçmiş' : days <= 30 ? 'Yaklaşıyor' : 'Güncel';
        [0, 1, 2, 3, 4, 5].forEach(ci => {
          const addr = cellAddr(ci, ri + 2);
          if (!wsMu[addr]) return;
          if (ci === 5) (wsMu[addr] as XLSXStyle.CellObject).s = statusStyle(durum);
          else if (ci === 4) {
            const color = isNaN(days) ? COLORS.gray : days < 0 ? COLORS.red : days <= 30 ? COLORS.yellow : COLORS.green;
            (wsMu[addr] as XLSXStyle.CellObject).s = {
              ...cellStyle(ri, 'center'),
              font: { bold: true, sz: 10, color: { rgb: color }, name: 'Calibri' },
            };
          } else (wsMu[addr] as XLSXStyle.CellObject).s = cellStyle(ri);
        });
      });
      addMerge(wsMu, { r: 0, c: 0 }, { r: 0, c: 5 });
      wsMu['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 16 }];
      setRowHeights(wsMu, [28, 22, ...filteredMuayeneler.map(() => 18)]);
      XLSXStyle.utils.book_append_sheet(wb, wsMu, 'Muayeneler');

      // 4. SEKME: Uygunsuzluklar
      const filteredUyg = uygunsuzluklar.filter(u => !u.silinmis && (!secilenFirmaId || u.firmaId === secilenFirmaId));
      const uygData = [
        [baslik, '', '', '', ''],
        ['Başlık', 'Firma', 'Durum', 'Önem', 'Tarih'],
        ...filteredUyg.map(u => {
          const f = firmalar.find(x => x.id === u.firmaId);
          return [u.baslik, f?.ad || '—', u.durum, u.severity || '—', fmtDate(u.tarih ?? u.olusturmaTarihi ?? '')];
        }),
      ];
      const wsUyg = XLSXStyle.utils.aoa_to_sheet(uygData);
      [0, 1, 2, 3, 4].forEach((ci) => {
        const addr = cellAddr(ci, 0);
        if (!wsUyg[addr]) wsUyg[addr] = { v: ci === 0 ? baslik : '', t: 's' };
        (wsUyg[addr] as XLSXStyle.CellObject).s = titleStyle();
      });
      ['Başlık', 'Firma', 'Durum', 'Önem', 'Tarih'].forEach((col, ci) => {
        const addr = cellAddr(ci, 1);
        if (!wsUyg[addr]) wsUyg[addr] = { v: col, t: 's' };
        (wsUyg[addr] as XLSXStyle.CellObject).s = headerStyle();
      });
      filteredUyg.forEach((_, ri) => {
        [0, 1, 2, 3, 4].forEach(ci => {
          const addr = cellAddr(ci, ri + 2);
          if (wsUyg[addr]) (wsUyg[addr] as XLSXStyle.CellObject).s = cellStyle(ri);
        });
      });
      addMerge(wsUyg, { r: 0, c: 0 }, { r: 0, c: 4 });
      wsUyg['!cols'] = [{ wch: 32 }, { wch: 22 }, { wch: 18 }, { wch: 14 }, { wch: 14 }];
      setRowHeights(wsUyg, [28, 22, ...filteredUyg.map(() => 18)]);
      XLSXStyle.utils.book_append_sheet(wb, wsUyg, 'Uygunsuzluklar');

      // 5. SEKME: Eğitimler
      const filteredEg = egitimler.filter(e => !secilenFirmaId || e.firmaId === secilenFirmaId);
      const egData = [
        [baslik, '', '', ''],
        ['Eğitim Adı', 'Firma', 'Tarih', 'Durum'],
        ...filteredEg.map(e => {
          const f = firmalar.find(x => x.id === e.firmaId);
          return [e.ad, f?.ad || '—', fmtDate(e.tarih ?? ''), e.durum ?? '—'];
        }),
      ];
      const wsEg = XLSXStyle.utils.aoa_to_sheet(egData);
      [0, 1, 2, 3].forEach((ci) => {
        const addr = cellAddr(ci, 0);
        if (!wsEg[addr]) wsEg[addr] = { v: ci === 0 ? baslik : '', t: 's' };
        (wsEg[addr] as XLSXStyle.CellObject).s = titleStyle();
      });
      ['Eğitim Adı', 'Firma', 'Tarih', 'Durum'].forEach((col, ci) => {
        const addr = cellAddr(ci, 1);
        if (!wsEg[addr]) wsEg[addr] = { v: col, t: 's' };
        (wsEg[addr] as XLSXStyle.CellObject).s = headerStyle();
      });
      filteredEg.forEach((_, ri) => {
        [0, 1, 2, 3].forEach(ci => {
          const addr = cellAddr(ci, ri + 2);
          if (wsEg[addr]) (wsEg[addr] as XLSXStyle.CellObject).s = cellStyle(ri);
        });
      });
      addMerge(wsEg, { r: 0, c: 0 }, { r: 0, c: 3 });
      wsEg['!cols'] = [{ wch: 32 }, { wch: 22 }, { wch: 14 }, { wch: 14 }];
      setRowHeights(wsEg, [28, 22, ...filteredEg.map(() => 18)]);
      XLSXStyle.utils.book_append_sheet(wb, wsEg, 'Eğitimler');

      const data = XLSXStyle.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fileName = firma ? `${firma.ad}_Rapor_${today.replace(/\./g, '-')}.xlsx` : `ISG_Genel_Rapor_${today.replace(/\./g, '-')}.xlsx`;
      a.download = fileName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Excel export error:', err);
    } finally {
      setExporting(null);
    }
  };

  // ── MUAYENE PDF ──
  const handleMuayenePdf = () => {
    setExporting('muayene_pdf');
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const today = new Date().toLocaleDateString('tr-TR');
      const firma = secilenFirmaId ? aktifFirmalar.find(f => f.id === secilenFirmaId) : null;

      // Başlık
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, doc.internal.pageSize.width, 20, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(firma ? `${firma.ad} — Muayene Raporu` : 'Periyodik Muayene Raporu', 14, 13);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(today, doc.internal.pageSize.width - 14, 13, { align: 'right' });

      const filteredMuayeneler = muayeneler
        .filter(m => !m.silinmis && (!secilenFirmaId || m.firmaId === secilenFirmaId))
        .sort((a, b) => getDaysUntil(a.sonrakiTarih) - getDaysUntil(b.sonrakiTarih));

      // Manuel tablo çiz
      const HEADERS = ['#', 'Personel', 'Firma', 'Muayene', 'Sonraki', 'Kalan', 'Durum'];
      const COL_W = [10, 50, 45, 28, 28, 22, 24];
      const pageW = doc.internal.pageSize.width;
      const marginL = 14;
      let curY = 28;

      // Başlık satırı
      doc.setFillColor(15, 23, 42);
      doc.rect(marginL, curY, pageW - marginL * 2, 8, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      let cx = marginL + 2;
      HEADERS.forEach((h, i) => { doc.text(h, cx, curY + 5.5); cx += COL_W[i]; });
      curY += 8;

      filteredMuayeneler.forEach((m, idx) => {
        const p = personeller.find(x => x.id === m.personelId);
        const f = firmalar.find(x => x.id === m.firmaId);
        const days = getDaysUntil(m.sonrakiTarih);
        const durum = days < 0 ? 'Gecikti' : days <= 30 ? 'Yaklaşıyor' : 'Güncel';
        const row = [
          String(idx + 1),
          (p?.adSoyad || '—').slice(0, 22),
          (f?.ad || '—').slice(0, 20),
          fmtDate(m.muayeneTarihi),
          fmtDate(m.sonrakiTarih),
          m.sonrakiTarih ? (days < 0 ? `-${Math.abs(days)}g` : `${days}g`) : '—',
          durum,
        ];

        if (curY > doc.internal.pageSize.height - 20) {
          doc.addPage();
          curY = 20;
        }

        const rowBg = idx % 2 === 0 ? [255, 255, 255] as [number,number,number] : [248, 250, 252] as [number,number,number];
        doc.setFillColor(...rowBg);
        doc.rect(marginL, curY, pageW - marginL * 2, 7, 'F');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        let rx = marginL + 2;
        row.forEach((val, ci) => {
          if (ci === 6) {
            const c = durum === 'Gecikti' ? [239,68,68] as [number,number,number] : durum === 'Yaklaşıyor' ? [245,158,11] as [number,number,number] : [52,211,153] as [number,number,number];
            doc.setTextColor(...c);
          } else {
            doc.setTextColor(51, 65, 85);
          }
          doc.text(val, rx, curY + 5);
          rx += COL_W[ci];
        });
        curY += 7;
      });

      // Özet
      const gecmis = filteredMuayeneler.filter(m => getDaysUntil(m.sonrakiTarih) < 0).length;
      const yaklasan = filteredMuayeneler.filter(m => { const d = getDaysUntil(m.sonrakiTarih); return d >= 0 && d <= 30; }).length;
      curY += 6;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text(`Toplam: ${filteredMuayeneler.length}  |  Gecikmiş: ${gecmis}  |  Yaklaşan: ${yaklasan}  |  Güncel: ${filteredMuayeneler.length - gecmis - yaklasan}`, marginL, curY);

      const fileName = firma ? `${firma.ad}_Muayene_${today.replace(/\./g, '-')}.pdf` : `Muayene_Raporu_${today.replace(/\./g, '-')}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setExporting(null);
    }
  };

  const EXPORT_ACTIONS = [
    {
      id: 'genel_excel',
      title: 'Genel ISG Raporu',
      desc: 'Personel, Ekipman, Muayene, Uygunsuzluk, Eğitim — 5 sekmeli Excel',
      icon: 'ri-file-excel-2-line',
      color: '#34D399',
      bg: 'rgba(52,211,153,0.1)',
      border: 'rgba(52,211,153,0.2)',
      format: 'XLSX',
      onClick: handleGenelExcel,
    },
    {
      id: 'muayene_pdf',
      title: 'Muayene Takip Raporu',
      desc: 'Periyodik muayene listesi — kalan gün ve durum renklendirmeli PDF',
      icon: 'ri-file-pdf-2-line',
      color: '#F87171',
      bg: 'rgba(248,113,113,0.1)',
      border: 'rgba(248,113,113,0.2)',
      format: 'PDF',
      onClick: handleMuayenePdf,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Firma filtresi */}
      <div className="isg-card rounded-xl p-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <i className="ri-building-2-line text-sm" style={{ color: 'var(--text-muted)' }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Firma Filtresi:</span>
        </div>
        <select
          value={secilenFirmaId}
          onChange={e => setSecilenFirmaId(e.target.value)}
          className="isg-input"
          style={{ minWidth: '200px' }}
        >
          <option value="">Tüm Firmalar</option>
          {aktifFirmalar.map(f => (
            <option key={f.id} value={f.id}>{f.ad}</option>
          ))}
        </select>
        {secilenFirmaId && (
          <button onClick={() => setSecilenFirmaId('')} className="btn-secondary text-xs whitespace-nowrap">
            <i className="ri-close-line mr-1" />Temizle
          </button>
        )}
        {secilenFirmaId && (
          <span className="text-xs px-3 py-1.5 rounded-lg font-semibold"
            style={{ background: 'rgba(167,139,250,0.1)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.2)' }}>
            <i className="ri-filter-3-line mr-1" />
            {aktifFirmalar.find(f => f.id === secilenFirmaId)?.ad} için filtrelendi
          </span>
        )}
      </div>

      {/* Export seçenekleri */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {EXPORT_ACTIONS.map(action => (
          <div key={action.id} className="isg-card rounded-xl p-5"
            style={{ border: `1px solid ${action.border}` }}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 flex items-center justify-center rounded-2xl flex-shrink-0"
                style={{ background: action.bg }}>
                <i className={`${action.icon} text-xl`} style={{ color: action.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{action.title}</h3>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: action.bg, color: action.color }}>
                    {action.format}
                  </span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{action.desc}</p>
                <button
                  onClick={action.onClick}
                  disabled={exporting === action.id}
                  className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all whitespace-nowrap"
                  style={{ background: action.bg, color: action.color, border: `1px solid ${action.border}`, opacity: exporting === action.id ? 0.7 : 1 }}
                  onMouseEnter={e => { if (exporting !== action.id) (e.currentTarget as HTMLElement).style.opacity = '0.8'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = exporting === action.id ? '0.7' : '1'; }}
                >
                  {exporting === action.id ? (
                    <><i className="ri-loader-4-line animate-spin" />Hazırlanıyor...</>
                  ) : (
                    <><i className="ri-download-2-line" />İndir</>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tip seçici (gelecek için) */}
      <div className="isg-card rounded-xl p-4" style={{ border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-2 mb-3">
          <i className="ri-information-line text-sm" style={{ color: 'var(--text-muted)' }} />
          <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Rapor İçerik Seçimi</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'genel' as ExportTip, label: 'Tüm Modüller' },
            { id: 'firma' as ExportTip, label: 'Firma Özeti' },
            { id: 'muayene' as ExportTip, label: 'Muayene' },
            { id: 'ekipman' as ExportTip, label: 'Ekipman' },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setSecilenTip(opt.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
              style={{
                background: secilenTip === opt.id ? 'rgba(167,139,250,0.12)' : 'var(--bg-item)',
                color: secilenTip === opt.id ? '#A78BFA' : 'var(--text-muted)',
                border: secilenTip === opt.id ? '1px solid rgba(167,139,250,0.25)' : '1px solid var(--border-subtle)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
          Seçili içerik türüne göre dışa aktarma yapılacak
        </p>
      </div>
    </div>
  );
}
