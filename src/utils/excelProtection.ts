// Excel Marka Koruma ve Güvenlik Özellikleri
// Tüm Excel export'larında kullanılır

import type ExcelJS from 'exceljs';

// ─── SABİT MARKA METİNLERİ ───────────────────────────────────────────────────
const BRAND_TEXTS = {
  // Watermark (arka plan)
  watermark: 'isgdenetim.com.tr tarafından oluşturulmuştur',
  // Footer (sayfa altı)
  footer: 'Bu rapor ISG Denetim sistemi tarafından oluşturulmuştur',
  // Creator metadata
  creator: 'ISG Denetim Sistemi',
  // Company metadata
  company: 'isgdenetim.com.tr',
};

// ─── WATERMARK EKLE ───────────────────────────────────────────────────────────
export function addWatermark(ws: ExcelJS.Worksheet, colCount: number): void {
  // Watermark'i A1 hücresine ekle (birleştirilmiş alan olarak)
  // Şeffaf ve büyük yazı
  ws.mergeCells(1, 1, 1, colCount);
  const watermarkCell = ws.getCell(1, 1);
  watermarkCell.value = BRAND_TEXTS.watermark;
  watermarkCell.font = {
    size: 28,
    color: { argb: '15CCCCCC' }, // %8 opaklık (çok şeffaf)
    name: 'Calibri',
    italic: true,
  };
  watermarkCell.alignment = {
    horizontal: 'center',
    vertical: 'middle',
  };
}

// ─── FOOTER EKLE ──────────────────────────────────────────────────────────────
export function addFooter(ws: ExcelJS.Worksheet, rowCount: number, colCount: number): void {
  // Footer için boş satır ekle
  const footerRow = rowCount + 2;
  
  // Tüm sütunları birleştir
  ws.mergeCells(footerRow, 1, footerRow, colCount);
  
  const footerCell = ws.getCell(footerRow, 1);
  footerCell.value = BRAND_TEXTS.footer;
  footerCell.font = {
    size: 9,
    color: { argb: 'FF64748B' }, // Gri renk
    name: 'Calibri',
    italic: true,
  };
  footerCell.alignment = {
    horizontal: 'center',
    vertical: 'middle',
  };
  footerCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF8FAFC' }, // Çok açık gri arka plan
  };
  footerCell.border = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  };
  
  // Satır yüksekliği
  ws.getRow(footerRow).height = 24;
}

// ─── SHEET PROTECTION AYARLA ──────────────────────────────────────────────────
export function protectSheet(ws: ExcelJS.Worksheet): void {
  // Sheet protection - kullanıcı düzenleyemesin
  ws.protect('', {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    insertColumns: false,
    insertRows: false,
    insertHyperlinks: false,
    deleteColumns: false,
    deleteRows: false,
    sort: false,
    autoFilter: false,
    pivotTables: false,
  });
}

// ─── WORKBOOK METADATA AYARLA ─────────────────────────────────────────────────
export function setWorkbookMetadata(wb: ExcelJS.Workbook): void {
  wb.creator = BRAND_TEXTS.creator;
  wb.lastModifiedBy = BRAND_TEXTS.creator;
  wb.company = BRAND_TEXTS.company;
  wb.created = new Date();
  wb.modified = new Date();
}

// ─── TÜM KORUMA ÖZELLİKLERİNİ UYGULA ──────────────────────────────────────────
export function applyBrandProtection(
  ws: ExcelJS.Worksheet,
  dataRowCount: number,
  colCount: number,
  options: {
    watermark?: boolean;
    footer?: boolean;
    protection?: boolean;
  } = {}
): void {
  const { watermark = true, footer = true, protection = true } = options;
  
  if (watermark) {
    addWatermark(ws, colCount);
  }
  
  if (footer) {
    addFooter(ws, dataRowCount, colCount);
  }
  
  if (protection) {
    protectSheet(ws);
  }
}

// ─── STANDART HEADER SATIRLARI (Marka ile) ────────────────────────────────────
export function applyBrandedHeaderRows(
  ws: ExcelJS.Worksheet,
  title: string,
  subtitle: string,
  colCount: number,
  options?: {
    watermark?: boolean;
  }
): void {
  // Eğer watermark isteniyorsa, header'ı 2. satırdan başlat
  const startRow = options?.watermark !== false ? 2 : 1;
  
  ws.mergeCells(startRow, 1, startRow, colCount);
  ws.mergeCells(startRow + 1, 1, startRow + 1, colCount);
  ws.mergeCells(startRow + 2, 1, startRow + 2, colCount);
  
  const r1 = ws.getRow(startRow); r1.height = 32;
  const r2 = ws.getRow(startRow + 1); r2.height = 26;
  const r3 = ws.getRow(startRow + 2); r3.height = 18;
  
  const c1 = ws.getCell(startRow, 1);
  c1.value = 'ISG DENETİM YÖNETİM SİSTEMİ';
  c1.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
  c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF020817' } };
  c1.alignment = { horizontal: 'left', vertical: 'middle' };
  
  const c2 = ws.getCell(startRow + 1, 1);
  c2.value = title;
  c2.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
  c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A0F1E' } };
  c2.alignment = { horizontal: 'left', vertical: 'middle' };
  
  const c3 = ws.getCell(startRow + 2, 1);
  c3.value = subtitle;
  c3.font = { italic: true, size: 10, color: { argb: 'FF94A3B8' }, name: 'Calibri' };
  c3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  c3.alignment = { horizontal: 'left', vertical: 'middle' };
}

// ─── STANDART KOLON HEADER ────────────────────────────────────────────────────
export function applyBrandedColHeader(
  ws: ExcelJS.Worksheet,
  cols: string[],
  startRow: number,
  accentColor: string = 'FF6366F1'
): void {
  const hdrRow = ws.getRow(startRow);
  hdrRow.height = 22;
  
  cols.forEach((h, ci) => {
    const cell = hdrRow.getCell(ci + 1);
    cell.value = h;
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { bottom: { style: 'medium', color: { argb: accentColor } } };
  });
}

// ─── TAM KORUMALI SAYFA OLUŞTUR ────────────────────────────────────────────────
export function createProtectedSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  title: string,
  subtitle: string,
  cols: string[],
  colWidths: number[],
  accentColor: string = 'FF6366F1'
): { ws: ExcelJS.Worksheet; dataStartRow: number } {
  const ws = wb.addWorksheet(sheetName, {
    properties: {
      tabColor: { argb: accentColor },
    },
  });
  
  ws.columns = colWidths.map(w => ({ width: w }));
  
  // Watermark (1. satır)
  addWatermark(ws, cols.length);
  
  // Header satırları (2-4. satırlar)
  applyBrandedHeaderRows(ws, title, subtitle, cols.length, { watermark: true });
  
  // Kolon header'ı (5. satır)
  applyBrandedColHeader(ws, cols, 5, accentColor);
  
  // Freeze pane
  ws.views = [{ state: 'frozen', ySplit: 5 }];
  
  // Protection (footer eklendikten sonra uygulanacak)
  protectSheet(ws);
  
  return { ws, dataStartRow: 6 };
}

// ─── FOOTER EKLE VE KORUMAYI GÜNCELLE ─────────────────────────────────────────
export function finalizeProtectedSheet(
  ws: ExcelJS.Worksheet,
  dataRowCount: number,
  colCount: number
): void {
  // Footer ekle
  addFooter(ws, dataRowCount + 5, colCount); // +5 header satırları için
}