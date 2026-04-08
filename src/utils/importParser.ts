/**
 * Global Excel/CSV import utility
 * Tüm modüllerde ortak kullanılan parse ve validation fonksiyonları
 */
import XLSXStyle from 'xlsx-js-style';

export interface ParseResult {
  rows: string[][];
  totalRaw: number;      // Ham satır sayısı (header dahil)
  validCount: number;    // Boş olmayan, header hariç satır sayısı
  skippedCount: number;  // Atlanan boş/geçersiz satır sayısı
}

/**
 * Bir satırın tamamen boş olup olmadığını kontrol eder
 */
function isEmptyRow(row: unknown[]): boolean {
  return row.every(cell => {
    const val = String(cell ?? '').trim();
    return val === '' || val === 'undefined' || val === 'null';
  });
}

/**
 * Excel/CSV dosyasını parse eder.
 * - Header satırını (ilk satır) otomatik atlar
 * - Tamamen boş satırları filtreler
 * - Her hücreyi trim eder
 * - Şablon not satırlarını (ilk hücre büyük harfle başlayan uzun metin) filtreler
 */
export async function parseImportFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Dosya okunamadı.'));

    reader.onload = (e) => {
      try {
        const result = e.target?.result;
        if (!result) throw new Error('Dosya içeriği boş.');

        let allRows: unknown[][];

        if (file.name.toLowerCase().endsWith('.csv')) {
          // CSV parse
          const text = typeof result === 'string' ? result : new TextDecoder('utf-8').decode(result as ArrayBuffer);
          allRows = parseCsvToRows(text);
        } else {
          // Excel parse (xlsx, xls)
          const data = result instanceof ArrayBuffer ? new Uint8Array(result) : new TextEncoder().encode(result as string);
          const wb = XLSXStyle.read(data, { type: 'array', cellDates: false });
          const ws = wb.Sheets[wb.SheetNames[0]];
          allRows = XLSXStyle.utils.sheet_to_json<unknown[]>(ws, {
            header: 1,
            defval: '',
            blankrows: false,
          }) as unknown[][];
        }

        if (allRows.length < 2) {
          resolve({ rows: [], totalRaw: allRows.length, validCount: 0, skippedCount: 0 });
          return;
        }

        const totalRaw = allRows.length;

        // İlk satır header — atla
        const dataRows = allRows.slice(1);

        // Boş satırları ve şablon not satırlarını filtrele
        const validRows = dataRows.filter(row => {
          const r = row as unknown[];
          if (isEmptyRow(r)) return false;

          // Şablon not satırları: ilk hücre çeşitli not/açıklama kalıplarıyla başlıyorsa atla
          const firstCell = String(r[0] ?? '').trim();
          const firstUpper = firstCell.toUpperCase();

          // "NOTLAR:", "NOT:", "KULLANIM NOTLARI" gibi başlıklar
          if (firstUpper.startsWith('NOTLAR')) return false;
          if (firstUpper.startsWith('NOT:')) return false;
          if (firstUpper.startsWith('KULLANIM')) return false;
          // "1. Tarih formatı..." gibi numaralı not satırları
          if (/^\d+[\.\)]\s/.test(firstCell)) return false;
          // "ISG ..." başlıklı satırlar
          if (firstUpper.startsWith('ISG ')) return false;
          // "AÇIKLAMA:", "UYARI:", "DİKKAT:" gibi uyarı satırları
          if (firstUpper.startsWith('AÇIKLAMA') || firstUpper.startsWith('ACIKLAMA')) return false;
          if (firstUpper.startsWith('UYARI') || firstUpper.startsWith('DİKKAT') || firstUpper.startsWith('DIKKAT')) return false;
          // Tüm hücreler aynı değerdeyse (birleştirilmiş hücre satırı) ve uzun metin içeriyorsa atla
          const nonEmpty = r.filter(c => String(c ?? '').trim() !== '');
          if (nonEmpty.length === 1 && firstCell.length > 30 && !firstCell.includes('\t')) return false;

          return true;
        });

        // Her hücreyi string'e çevir ve trim et
        const cleanRows = validRows.map(row =>
          (row as unknown[]).map(cell => String(cell ?? '').trim()),
        );

        resolve({
          rows: cleanRows,
          totalRaw,
          validCount: cleanRows.length,
          skippedCount: dataRows.length - cleanRows.length,
        });
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Dosya parse edilemedi.'));
      }
    };

    // CSV için text, Excel için ArrayBuffer oku
    if (file.name.toLowerCase().endsWith('.csv')) {
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
}

/**
 * CSV metnini satır/sütun dizisine çevirir
 * Quoted fields ve virgül içeren değerleri doğru parse eder
 */
function parseCsvToRows(text: string): string[][] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  return lines
    .filter(line => line.trim() !== '')
    .map(line => {
      const result: string[] = [];
      let cur = '';
      let inQuote = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
          else { inQuote = !inQuote; }
        } else if (ch === ',' && !inQuote) {
          result.push(cur.trim());
          cur = '';
        } else {
          cur += ch;
        }
      }
      result.push(cur.trim());
      return result;
    });
}

/**
 * Excel serial date'i YYYY-MM-DD formatına çevirir.
 * Desteklenen formatlar:
 *  - Sayısal serial (44927 gibi) — hem number hem string olabilir
 *  - GG.AA.YYYY
 *  - GG/AA/YYYY
 *  - YYYY-MM-DD (ISO)
 */
export function parseExcelDate(val: unknown): string {
  if (val === null || val === undefined || val === '') return '';

  // Sayısal serial — hem gerçek number hem "44927" gibi string olabilir
  const asNum = typeof val === 'number' ? val : (typeof val === 'string' && /^\d{4,6}$/.test(val.trim()) ? Number(val.trim()) : NaN);
  if (!isNaN(asNum) && asNum > 1000) {
    try {
      const d = XLSXStyle.SSF.parse_date_code(asNum);
      if (d && d.y > 1900 && d.y < 2100) {
        return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
      }
    } catch { /* ignore */ }
  }

  const str = String(val).trim();
  // ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // DD.MM.YYYY
  const m = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  // DD/MM/YYYY
  const m2 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m2) return `${m2[3]}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;
  return '';
}
