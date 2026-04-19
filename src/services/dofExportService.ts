import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { DofRow } from '@/services/specialistService';

const STATUS_LABELS: Record<string, string> = {
  open: 'Açık',
  closed: 'Kapandı',
  critical: 'Kritik',
};

function getTodayFilename(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `DÖF_Raporu_${dd}.${mm}.${yyyy}`;
}

function applyHeaderStyle(cell: ExcelJS.Cell) {
  cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  cell.border = {
    top: { style: 'medium', color: { argb: 'FF111827' } },
    bottom: { style: 'medium', color: { argb: 'FF111827' } },
    left: { style: 'thin', color: { argb: 'FF374151' } },
    right: { style: 'thin', color: { argb: 'FF374151' } },
  };
}

function applyDataCell(cell: ExcelJS.Cell, bgColor: string, wrapText = false, center = false) {
  cell.font = { size: 10, color: { argb: 'FF374151' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${bgColor}` } };
  cell.alignment = { vertical: 'middle', wrapText, horizontal: center ? 'center' : 'left' };
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  };
}

async function fetchImageAsBase64(url: string): Promise<{ base64: string; ext: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const mimeType = blob.type || 'image/jpeg';
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('gif') ? 'gif' : 'jpeg';
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // data:image/jpeg;base64,XXXX → sadece base64 kısmı
        const base64 = result.split(',')[1] ?? '';
        resolve({ base64, ext });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Sütun indeksleri (1-based)
const COL = {
  NO: 1,
  DOF_NO: 2,
  DATE: 3,
  FIRM: 4,
  DESCRIPTION: 5,
  OPEN_PHOTO: 6,
  ACTION: 7,
  CLOSE_DATE: 8,
  CLOSE_PHOTO: 9,
  STATUS: 10,
} as const;

const PHOTO_ROW_HEIGHT = 80; // piksel cinsinden satır yüksekliği (pt: ~60)
const PHOTO_COL_WIDTH = 18;  // karakter genişliği

export async function exportDofToExcel(records: DofRow[]): Promise<void> {
  const filename = getTodayFilename();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'DÖF Sistemi';
  wb.created = new Date();

  // ─── DÖF LİSTESİ SAYFASI ────────────────────────────────────────────────
  const ws = wb.addWorksheet('DÖF Listesi', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    views: [{ state: 'frozen', ySplit: 4 }],
  });

  ws.columns = [
    { key: 'no',          width: 5  },
    { key: 'dof_no',      width: 20 },
    { key: 'date',        width: 14 },
    { key: 'firm',        width: 24 },
    { key: 'description', width: 38 },
    { key: 'open_photo',  width: PHOTO_COL_WIDTH },
    { key: 'action',      width: 38 },
    { key: 'close_date',  width: 15 },
    { key: 'close_photo', width: PHOTO_COL_WIDTH },
    { key: 'status',      width: 12 },
  ];

  // ── Satır 1: Büyük başlık ─────────────────────────────────────────────────
  const titleRow = ws.addRow(['DÖF RAPORU']);
  ws.mergeCells('A1:J1');
  const titleCell = titleRow.getCell(1);
  titleCell.value = 'DÖF RAPORU';
  titleCell.font = { bold: true, size: 20, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleRow.height = 40;

  // ── Satır 2: Alt başlık ───────────────────────────────────────────────────
  const now = new Date().toLocaleString('tr-TR');
  const subRow = ws.addRow([`Oluşturulma: ${now}   |   Toplam Kayıt: ${records.length}`]);
  ws.mergeCells('A2:J2');
  const subCell = subRow.getCell(1);
  subCell.font = { size: 10, color: { argb: 'FF6B7280' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  subRow.height = 20;

  // ── Satır 3: Boş ─────────────────────────────────────────────────────────
  ws.addRow([]);

  // ── Satır 4: Kolon başlıkları ─────────────────────────────────────────────
  const headerRow = ws.addRow([
    'No',
    'DÖF No',
    'Tespit Tarihi',
    'Firma',
    'Açıklama',
    'Fotoğraf',
    'Alınması Gereken Önlemler',
    'Kapatma Tarihi',
    'Kapatma Fotoğrafı',
    'Durum',
  ]);
  headerRow.height = 30;
  headerRow.eachCell((cell) => applyHeaderStyle(cell));

  // ── Fotoğrafları önceden çek ──────────────────────────────────────────────
  const photoResults = await Promise.all(
    records.map(async (r) => ({
      id: r.id,
      opening: r.opening_photo_url ? await fetchImageAsBase64(r.opening_photo_url) : null,
      closing: r.closing_photo_url ? await fetchImageAsBase64(r.closing_photo_url) : null,
    }))
  );
  const photoMap = new Map(photoResults.map((p) => [p.id, p]));

  // ── Veri satırları ────────────────────────────────────────────────────────
  const DATA_START_ROW = 5; // 1-indexed (başlık=1,alt=2,boş=3,kolon=4,veri=5+)

  records.forEach((r, i) => {
    const rowBg = i % 2 === 0 ? 'FFFFFF' : 'F9FAFB';
    const excelRowNum = DATA_START_ROW + i;

    const dataRow = ws.addRow([
      i + 1,
      r.dof_no,
      new Date(r.detection_date).toLocaleDateString('tr-TR'),
      r.firm?.name ?? '—',
      r.description,
      '',  // açılış fotoğrafı — boş bırak, resim ekleyeceğiz
      r.action_required,
      r.closed_at ? new Date(r.closed_at).toLocaleDateString('tr-TR') : '—',
      '',  // kapanış fotoğrafı — boş bırak
      STATUS_LABELS[r.status] ?? r.status,
    ]);
    dataRow.height = PHOTO_ROW_HEIGHT;

    // Tüm hücrelere temel stil
    dataRow.eachCell((cell, colNum) => {
      const isCenter = colNum === COL.NO || colNum === COL.DATE || colNum === COL.CLOSE_DATE || colNum === COL.STATUS;
      applyDataCell(cell, rowBg, colNum === COL.DESCRIPTION || colNum === COL.ACTION, isCenter);
    });

    // Durum hücresi özel renk — Açık=kırmızı dolgu, Kapandı=yeşil dolgu
    const statusCell = dataRow.getCell(COL.STATUS);
    let bgColor = 'EF4444'; // Açık → kırmızı
    let textColor = 'FFFFFFFF';
    if (r.status === 'closed') { bgColor = '22C55E'; textColor = 'FFFFFFFF'; }   // Kapandı → yeşil
    if (r.status === 'critical') { bgColor = 'DC2626'; textColor = 'FFFFFFFF'; } // Kritik → koyu kırmızı
    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${bgColor}` } };
    statusCell.font = { bold: true, size: 10, color: { argb: textColor } };
    statusCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // ── Fotoğrafları hücreye göm ──────────────────────────────────────────
    const photos = photoMap.get(r.id);

    if (photos?.opening) {
      const imgId = wb.addImage({
        base64: photos.opening.base64,
        extension: photos.opening.ext as 'jpeg' | 'png' | 'gif',
      });
      ws.addImage(imgId, {
        tl: { col: COL.OPEN_PHOTO - 1, row: excelRowNum - 1 },
        br: { col: COL.OPEN_PHOTO, row: excelRowNum },
        editAs: 'oneCell',
      });
    } else {
      const cell = dataRow.getCell(COL.OPEN_PHOTO);
      cell.value = 'Fotoğraf yok';
      cell.font = { size: 9, color: { argb: 'FF9CA3AF' }, italic: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }

    if (photos?.closing) {
      const imgId = wb.addImage({
        base64: photos.closing.base64,
        extension: photos.closing.ext as 'jpeg' | 'png' | 'gif',
      });
      ws.addImage(imgId, {
        tl: { col: COL.CLOSE_PHOTO - 1, row: excelRowNum - 1 },
        br: { col: COL.CLOSE_PHOTO, row: excelRowNum },
        editAs: 'oneCell',
      });
    } else {
      const cell = dataRow.getCell(COL.CLOSE_PHOTO);
      cell.value = 'Fotoğraf yok';
      cell.font = { size: 9, color: { argb: 'FF9CA3AF' }, italic: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  });

  // ─── ÖZET SAYFASI ────────────────────────────────────────────────────────
  const openCount = records.filter((r) => r.status === 'open').length;
  const closedCount = records.filter((r) => r.status === 'closed').length;
  const criticalCount = records.filter((r) => r.status === 'critical').length;
  const closeRate = records.length > 0 ? Math.round((closedCount / records.length) * 100) : 0;

  const summaryWs = wb.addWorksheet('Özet');
  summaryWs.columns = [{ width: 30 }, { width: 18 }];

  const sTitleRow = summaryWs.addRow(['DÖF ÖZET RAPORU']);
  summaryWs.mergeCells('A1:B1');
  const sTitleCell = sTitleRow.getCell(1);
  sTitleCell.value = 'DÖF ÖZET RAPORU';
  sTitleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  sTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } };
  sTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sTitleRow.height = 32;

  const sSubRow = summaryWs.addRow([`Tarih: ${now}`]);
  summaryWs.mergeCells('A2:B2');
  sSubRow.getCell(1).font = { size: 10, color: { argb: 'FF6B7280' } };
  sSubRow.getCell(1).alignment = { horizontal: 'center' };
  sSubRow.height = 18;

  summaryWs.addRow([]);

  const sHeaderRow = summaryWs.addRow(['Metrik', 'Değer']);
  sHeaderRow.height = 24;
  sHeaderRow.eachCell((cell) => applyHeaderStyle(cell));

  const summaryData: [string, number | string, string][] = [
    ['Toplam DÖF Kaydı', records.length, 'F3F4F6'],
    ['Açık Uygunsuzluk', openCount, 'FEF3C7'],
    ['Kapanan DÖF', closedCount, 'D1FAE5'],
    ['Kritik Açık', criticalCount, 'FEE2E2'],
    ['Kapatma Oranı', `%${closeRate}`, 'DBEAFE'],
  ];

  summaryData.forEach(([label, value, bg]) => {
    const row = summaryWs.addRow([label, value]);
    row.height = 26;
    const labelCell = row.getCell(1);
    const valueCell = row.getCell(2);

    labelCell.font = { size: 11, color: { argb: 'FF374151' } };
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
    labelCell.alignment = { vertical: 'middle' };
    labelCell.border = {
      top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };

    valueCell.font = { bold: true, size: 14, color: { argb: 'FF111827' } };
    valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${bg}` } };
    valueCell.alignment = { horizontal: 'center', vertical: 'middle' };
    valueCell.border = {
      top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };
  });

  // ─── DOSYAYI İNDİR ───────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, `${filename}.xlsx`);
}
