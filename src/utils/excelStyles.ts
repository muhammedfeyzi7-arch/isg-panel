// Excel stil yardımcıları — xlsx-js-style ile kullanılır
import XLSXStyle from 'xlsx-js-style';

export { XLSXStyle };

// ── Renk Paleti ──
export const COLORS = {
  headerBg: '1E293B',       // Koyu lacivert başlık
  headerFg: 'FFFFFF',       // Beyaz yazı
  titleBg: '0F172A',        // Çok koyu başlık satırı
  titleFg: 'F8FAFC',
  subHeaderBg: '334155',    // İkincil başlık
  subHeaderFg: 'E2E8F0',
  rowAlt: 'F8FAFC',         // Alternatif satır (açık)
  rowNormal: 'FFFFFF',
  borderColor: 'CBD5E1',    // Çizgi rengi
  summaryBg: 'EFF6FF',      // Özet satır arka planı
  summaryFg: '1E40AF',
  green: '16A34A',
  greenBg: 'DCFCE7',
  red: 'DC2626',
  redBg: 'FEE2E2',
  yellow: 'D97706',
  yellowBg: 'FEF3C7',
  orange: 'EA580C',
  orangeBg: 'FFEDD5',
  gray: '64748B',
  grayBg: 'F1F5F9',
};

// ── Kenarlık tanımı ──
const THIN_BORDER = {
  top: { style: 'thin', color: { rgb: COLORS.borderColor } },
  bottom: { style: 'thin', color: { rgb: COLORS.borderColor } },
  left: { style: 'thin', color: { rgb: COLORS.borderColor } },
  right: { style: 'thin', color: { rgb: COLORS.borderColor } },
};

const MEDIUM_BORDER = {
  top: { style: 'medium', color: { rgb: '94A3B8' } },
  bottom: { style: 'medium', color: { rgb: '94A3B8' } },
  left: { style: 'medium', color: { rgb: '94A3B8' } },
  right: { style: 'medium', color: { rgb: '94A3B8' } },
};

// ── Stil Fabrikaları ──
export function titleStyle(): object {
  return {
    font: { bold: true, sz: 14, color: { rgb: COLORS.titleFg }, name: 'Calibri' },
    fill: { fgColor: { rgb: COLORS.titleBg } },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: false },
    border: MEDIUM_BORDER,
  };
}

export function headerStyle(bgColor = COLORS.headerBg): object {
  return {
    font: { bold: true, sz: 10, color: { rgb: COLORS.headerFg }, name: 'Calibri' },
    fill: { fgColor: { rgb: bgColor } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
    border: THIN_BORDER,
  };
}

export function cellStyle(rowIndex: number, align: 'left' | 'center' | 'right' = 'left'): object {
  return {
    font: { sz: 10, color: { rgb: '1E293B' }, name: 'Calibri' },
    fill: { fgColor: { rgb: rowIndex % 2 === 0 ? COLORS.rowNormal : COLORS.rowAlt } },
    alignment: { horizontal: align, vertical: 'center', wrapText: true },
    border: THIN_BORDER,
  };
}

export function summaryLabelStyle(): object {
  return {
    font: { bold: true, sz: 10, color: { rgb: COLORS.summaryFg }, name: 'Calibri' },
    fill: { fgColor: { rgb: COLORS.summaryBg } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: THIN_BORDER,
  };
}

export function summaryValueStyle(): object {
  return {
    font: { bold: true, sz: 11, color: { rgb: COLORS.summaryFg }, name: 'Calibri' },
    fill: { fgColor: { rgb: COLORS.summaryBg } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: THIN_BORDER,
  };
}

export function statusStyle(status: string): object {
  let fg = COLORS.gray;
  let bg = COLORS.grayBg;

  const s = status.toLowerCase();
  if (s.includes('uygun') && !s.includes('değil')) { fg = COLORS.green; bg = COLORS.greenBg; }
  else if (s.includes('uygun değil') || s.includes('çalışamaz') || s.includes('gecikmiş') || s.includes('geçti') || s.includes('dolmuş')) { fg = COLORS.red; bg = COLORS.redBg; }
  else if (s.includes('yaklaşan') || s.includes('kısıtlı') || s.includes('kaldı') || s.includes('kritik') || s.includes('eksik')) { fg = COLORS.yellow; bg = COLORS.yellowBg; }
  else if (s.includes('bakımda') || s.includes('bekliyor') || s.includes('planlandı')) { fg = COLORS.orange; bg = COLORS.orangeBg; }
  else if (s.includes('tamamlandı') || s.includes('çalışabilir') || s.includes('aktif') || s.includes('zamanında')) { fg = COLORS.green; bg = COLORS.greenBg; }

  return {
    font: { bold: true, sz: 10, color: { rgb: fg }, name: 'Calibri' },
    fill: { fgColor: { rgb: bg } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: THIN_BORDER,
  };
}

export function numberStyle(rowIndex: number): object {
  return {
    font: { sz: 10, color: { rgb: COLORS.gray }, name: 'Calibri' },
    fill: { fgColor: { rgb: rowIndex % 2 === 0 ? COLORS.rowNormal : COLORS.rowAlt } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: THIN_BORDER,
  };
}

export function totalRowStyle(): object {
  return {
    font: { bold: true, sz: 10, color: { rgb: COLORS.headerFg }, name: 'Calibri' },
    fill: { fgColor: { rgb: COLORS.subHeaderBg } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: MEDIUM_BORDER,
  };
}

// ── Hücre adresi yardımcısı ──
export function cellAddr(col: number, row: number): string {
  let colStr = '';
  let c = col;
  while (c >= 0) {
    colStr = String.fromCharCode(65 + (c % 26)) + colStr;
    c = Math.floor(c / 26) - 1;
  }
  return `${colStr}${row + 1}`;
}

// ── Satır yüksekliği ayarla ──
export function setRowHeights(ws: XLSXStyle.WorkSheet, heights: number[]): void {
  if (!ws['!rows']) ws['!rows'] = [];
  heights.forEach((h, i) => {
    (ws['!rows'] as XLSXStyle.RowInfo[])[i] = { hpt: h };
  });
}

// ── Birleştirme (merge) ekle ──
export function addMerge(ws: XLSXStyle.WorkSheet, s: { r: number; c: number }, e: { r: number; c: number }): void {
  if (!ws['!merges']) ws['!merges'] = [];
  ws['!merges'].push({ s, e });
}

// ── Stil uygula: tüm hücrelere ──
export function applyStyles(
  ws: XLSXStyle.WorkSheet,
  data: (string | number | null | undefined)[][],
  styleMap: ((rowIdx: number, colIdx: number, value: string | number | null | undefined) => object | null)[],
): void {
  data.forEach((row, ri) => {
    row.forEach((val, ci) => {
      const addr = cellAddr(ci, ri);
      if (!ws[addr]) ws[addr] = { v: val ?? '', t: typeof val === 'number' ? 'n' : 's' };
      const styleFn = styleMap[ri] ?? styleMap[styleMap.length - 1];
      const style = styleFn(ri, ci, val);
      if (style) (ws[addr] as XLSXStyle.CellObject).s = style;
    });
  });
}
