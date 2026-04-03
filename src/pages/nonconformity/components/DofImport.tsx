import { useState, useRef } from 'react';
import XLSXStyle from 'xlsx-js-style';
import Modal from '../../../components/base/Modal';
import { parseImportFile, parseExcelDate } from '../../../utils/importParser';

interface DofRow {
  baslik: string;
  aciklama: string;
  tarih: string;
  firmaAd: string;
  personelAd: string;
  severity: string;
  bolum: string;
  notlar: string;
}

interface DofImportProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (rows: DofRow[]) => void;
}

const TEMPLATE_HEADERS = [
  'Başlık *',
  'Açıklama',
  'Tarih (YYYY-AA-GG)',
  'Firma Adı',
  'Personel Adı',
  'Önem (Düşük/Orta/Yüksek/Kritik)',
  'Bölüm/Alan',
  'Notlar',
];

const SAMPLE_ROWS = [
  ['Koruyucu ekipman eksikliği', 'Sahada baret takılmadan çalışıldığı tespit edildi', '2026-03-15', 'ABC İnşaat Ltd.', 'Ahmet Yılmaz', 'Yüksek', 'Üretim Alanı', 'İkinci denetimde de aynı durum gözlemlendi'],
  ['Yangın tüpü süresi dolmuş', 'B blok yangın tüpleri 6 ay önce dolmuş', '2026-03-20', 'XYZ Fabrika A.Ş.', 'Mehmet Kaya', 'Kritik', 'Depo', ''],
  ['Elektrik panosu açık bırakıldı', 'Ana dağıtım panosu kilitsiz ve açık bulundu', '2026-03-25', 'DEF Lojistik', '', 'Orta', 'Teknik Oda', 'Uyarı yazısı asılmamış'],
];

function downloadTemplate() {
  const HEADER_BG = '1E293B'; const HEADER_FG = 'FFFFFF'; const TITLE_BG = '0F172A';
  const ROW_ALT = 'F1F5F9'; const ROW_NORMAL = 'FFFFFF'; const BC = 'CBD5E1';
  const thinB = { top: { style: 'thin', color: { rgb: BC } }, bottom: { style: 'thin', color: { rgb: BC } }, left: { style: 'thin', color: { rgb: BC } }, right: { style: 'thin', color: { rgb: BC } } };
  const medB = { top: { style: 'medium', color: { rgb: '94A3B8' } }, bottom: { style: 'medium', color: { rgb: '94A3B8' } }, left: { style: 'medium', color: { rgb: '94A3B8' } }, right: { style: 'medium', color: { rgb: '94A3B8' } } };
  const titleS = { font: { bold: true, sz: 13, color: { rgb: HEADER_FG }, name: 'Calibri' }, fill: { fgColor: { rgb: TITLE_BG } }, alignment: { horizontal: 'left', vertical: 'center' }, border: medB };
  const headerS = { font: { bold: true, sz: 10, color: { rgb: HEADER_FG }, name: 'Calibri' }, fill: { fgColor: { rgb: HEADER_BG } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: thinB };
  const cellS = (ri: number) => ({ font: { sz: 10, color: { rgb: '1E293B' }, name: 'Calibri' }, fill: { fgColor: { rgb: ri % 2 === 0 ? ROW_NORMAL : ROW_ALT } }, alignment: { horizontal: 'left', vertical: 'center', wrapText: true }, border: thinB });
  const noteS = { font: { sz: 9, color: { rgb: '475569' }, italic: true, name: 'Calibri' }, fill: { fgColor: { rgb: 'FFF7ED' } }, alignment: { horizontal: 'left', vertical: 'center', wrapText: true }, border: thinB };
  const noteTitleS = { font: { bold: true, sz: 10, color: { rgb: 'EA580C' }, name: 'Calibri' }, fill: { fgColor: { rgb: 'FFF7ED' } }, alignment: { horizontal: 'left', vertical: 'center' }, border: thinB };

  const notlar = [
    ['KULLANIM NOTLARI:'],
    ['1. Baslik alani zorunludur — bos birakilamaz.'],
    ['2. Tarih formati: YYYY-AA-GG (ornek: 2026-03-15) veya GG.AA.YYYY (ornek: 15.03.2026)'],
    ['3. Onem degerleri: Dusuk / Orta / Yuksek / Kritik'],
    ['4. Firma adi sistemdeki kayitla birebir eslesmelidir.'],
    ['5. Ornek satirlar (2-4. satirlar) aktarmadan once silinebilir.'],
  ];

  const wsData = [
    ['ISG DOF - Ice Aktarma Sablonu', ...Array(TEMPLATE_HEADERS.length - 1).fill('')],
    TEMPLATE_HEADERS,
    ...SAMPLE_ROWS,
    ...notlar.map(n => [...n, ...Array(TEMPLATE_HEADERS.length - 1).fill('')]),
  ];

  const wb = XLSXStyle.utils.book_new();
  const ws = XLSXStyle.utils.aoa_to_sheet(wsData);

  // Birleştirmeler
  if (!ws['!merges']) ws['!merges'] = [];
  ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: TEMPLATE_HEADERS.length - 1 } });
  notlar.forEach((_, ri) => {
    ws['!merges']!.push({ s: { r: ri + 2 + SAMPLE_ROWS.length, c: 0 }, e: { r: ri + 2 + SAMPLE_ROWS.length, c: TEMPLATE_HEADERS.length - 1 } });
  });

  // Stilleri uygula
  wsData.forEach((row, ri) => {
    (row as string[]).forEach((_, ci) => {
      const addr = XLSXStyle.utils.encode_cell({ r: ri, c: ci });
      if (!ws[addr]) return;
      let s: object;
      if (ri === 0) s = titleS;
      else if (ri === 1) s = headerS;
      else if (ri >= 2 && ri < 2 + SAMPLE_ROWS.length) s = cellS(ri - 2);
      else if (ri === 2 + SAMPLE_ROWS.length) s = noteTitleS;
      else s = noteS;
      (ws[addr] as XLSXStyle.CellObject).s = s;
    });
  });

  ws['!cols'] = [{ wch: 35 }, { wch: 50 }, { wch: 20 }, { wch: 28 }, { wch: 22 }, { wch: 30 }, { wch: 22 }, { wch: 42 }];
  if (!ws['!rows']) ws['!rows'] = [];
  (ws['!rows'] as XLSXStyle.RowInfo[])[0] = { hpt: 30 };
  (ws['!rows'] as XLSXStyle.RowInfo[])[1] = { hpt: 26 };
  SAMPLE_ROWS.forEach((_, i) => { (ws['!rows'] as XLSXStyle.RowInfo[])[i + 2] = { hpt: 22 }; });

  XLSXStyle.utils.book_append_sheet(wb, ws, 'DOF Sablonu');

  const wbArray = XLSXStyle.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${new Date().toLocaleDateString('tr-TR')} DÖF Şablonu.xlsx`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
}

function normalizeSeverity(val: string): string {
  const v = val?.toLowerCase().trim() ?? '';
  if (v.includes('krit')) return 'Kritik';
  if (v.includes('yük') || v.includes('high')) return 'Yüksek';
  if (v.includes('ort') || v.includes('med')) return 'Orta';
  return 'Düşük';
}

export default function DofImport({ isOpen, onClose, onImport }: DofImportProps) {
  const [preview, setPreview] = useState<DofRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setParseError('');
    try {
      // Dosyayı ham olarak oku — tüm satırları al
      const rawBuffer = await file.arrayBuffer();
      const wb = XLSXStyle.read(new Uint8Array(rawBuffer), { type: 'array', cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const allRows = XLSXStyle.utils.sheet_to_json<unknown[]>(ws, {
        header: 1,
        defval: '',
        blankrows: false,
      }) as string[][];

      if (allRows.length < 2) {
        setParseError('Dosya boş veya yalnızca başlık içeriyor.');
        return;
      }

      // Şablonda satır 1 = "ISG DOF..." başlığı, satır 2 = kolon başlıkları
      // Kolon başlıklarının bulunduğu satırı bul (TEMPLATE_HEADERS ile eşleşen satır)
      let headerRowIdx = 0;
      for (let i = 0; i < Math.min(allRows.length, 5); i++) {
        const row = allRows[i];
        const firstCell = String(row[0] ?? '').trim();
        // Kolon başlığı satırı: "Başlık" veya "Baslik" içeriyor
        if (firstCell.toLowerCase().includes('başlık') || firstCell.toLowerCase().includes('baslik') || firstCell.includes('*')) {
          headerRowIdx = i;
          break;
        }
      }

      // Veri satırları: header satırından sonraki satırlar
      const dataRows = allRows.slice(headerRowIdx + 1);

      // Boş satırları ve not satırlarını filtrele
      const isNoteRow = (row: string[]) => {
        const first = String(row[0] ?? '').trim();
        const firstUpper = first.toUpperCase();
        if (!first) return true; // boş
        if (firstUpper.startsWith('KULLANIM') || firstUpper.startsWith('NOTLAR') || firstUpper.startsWith('NOT:')) return true;
        if (/^\d+[\.\)]\s/.test(first)) return true; // "1. ..." numaralı notlar
        if (row.every(c => String(c ?? '').trim() === '')) return true; // tamamen boş
        return false;
      };

      const validDataRows = dataRows.filter(row => !isNoteRow(row));

      if (validDataRows.length === 0) {
        setParseError('İçe aktarılacak veri satırı bulunamadı. Boş satırlar ve şablon notları otomatik atlandı.');
        return;
      }

      // Header bazlı kolon eşleştirme
      const headerRow = allRows[headerRowIdx].map(h => String(h ?? '').trim().toLowerCase()
        .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i')
        .replace(/Ğ/g, 'g').replace(/ğ/g, 'g')
        .replace(/Ü/g, 'u').replace(/ü/g, 'u')
        .replace(/Ş/g, 's').replace(/ş/g, 's')
        .replace(/Ö/g, 'o').replace(/ö/g, 'o')
        .replace(/Ç/g, 'c').replace(/ç/g, 'c')
        .replace(/[*]/g, '').trim()
      );

      const findCol = (keywords: string[]) => {
        for (const kw of keywords) {
          const idx = headerRow.findIndex(h => h.includes(kw) || kw.includes(h));
          if (idx >= 0) return idx;
        }
        return -1;
      };

      const colBaslik = findCol(['baslik', 'title', 'konu']);
      const colAciklama = findCol(['aciklama', 'description', 'detay']);
      const colTarih = findCol(['tarih', 'date']);
      const colFirma = findCol(['firma', 'company', 'sirket']);
      const colPersonel = findCol(['personel', 'kisi', 'person']);
      const colSeverity = findCol(['onem', 'severity', 'oncelik', 'derece']);
      const colBolum = findCol(['bolum', 'alan', 'department', 'section']);
      const colNotlar = findCol(['notlar', 'not ', 'notes', 'aciklama2']);

      const getCell = (row: string[], idx: number, fallback: number) => {
        if (idx >= 0 && idx < row.length) return String(row[idx] ?? '').trim();
        if (fallback >= 0 && fallback < row.length) return String(row[fallback] ?? '').trim();
        return '';
      };

      const parsed: DofRow[] = validDataRows.map(row => ({
        baslik: getCell(row, colBaslik, 0),
        aciklama: getCell(row, colAciklama, 1),
        tarih: parseExcelDate(getCell(row, colTarih, 2)),
        firmaAd: getCell(row, colFirma, 3),
        personelAd: getCell(row, colPersonel, 4),
        severity: normalizeSeverity(getCell(row, colSeverity, 5)),
        bolum: getCell(row, colBolum, 6),
        notlar: getCell(row, colNotlar, 7),
      }));

      const finalRows = parsed.filter(r => r.baslik.trim() !== '');
      if (finalRows.length === 0) {
        setParseError('Başlık alanı dolu satır bulunamadı. Lütfen şablonu kontrol edin.');
        return;
      }

      setPreview(finalRows);
      setFileName(file.name);
      setStep('preview');
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Dosya okunurken hata oluştu. Excel (.xlsx) veya CSV formatında olduğundan emin olun.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  const handleConfirm = () => {
    onImport(preview);
    onClose();
    setStep('upload');
    setPreview([]);
    setFileName('');
  };

  const handleClose = () => {
    onClose();
    setStep('upload');
    setPreview([]);
    setFileName('');
    setParseError('');
  };

  const SEV_COLOR: Record<string, string> = {
    'Kritik': '#EF4444',
    'Yüksek': '#F97316',
    'Orta': '#F59E0B',
    'Düşük': '#22C55E',
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 'upload' ? 'DÖF Excel İçe Aktarma' : `Önizleme — ${preview.length} kayıt`}
      size={step === 'preview' ? 'xl' : 'md'}
      icon="ri-file-excel-2-line"
      footer={
        step === 'upload' ? (
          <button onClick={handleClose} className="btn-secondary whitespace-nowrap">Kapat</button>
        ) : (
          <>
            <button onClick={() => setStep('upload')} className="btn-secondary whitespace-nowrap">
              <i className="ri-arrow-left-line mr-1" />Geri
            </button>
            <button onClick={handleConfirm} className="btn-primary whitespace-nowrap">
              <i className="ri-check-line mr-1" />{preview.length} Kaydı İçe Aktar
            </button>
          </>
        )
      }
    >
      {step === 'upload' ? (
        <div className="space-y-5">
          {/* Download template */}
          <div className="rounded-xl p-4 flex items-start gap-4" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: 'rgba(99,102,241,0.15)' }}>
              <i className="ri-download-line text-lg" style={{ color: '#818CF8' }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Excel Şablonunu İndir</p>
              <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                Örnek veriler içeren şablonu indirin, doldurun ve sisteme yükleyin.
              </p>
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg cursor-pointer whitespace-nowrap transition-all"
                style={{ background: 'rgba(99,102,241,0.15)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.25)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.25)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.15)'; }}
              >
                <i className="ri-file-excel-2-line" />DOF_Sablon.xlsx indir
              </button>
            </div>
          </div>

          {/* Upload area */}
          <div>
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Doldurulmuş Dosyayı Yükle</p>
            <div
              className="rounded-xl p-8 text-center cursor-pointer transition-all"
              style={{ border: '2px dashed rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)' }}
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)';
                e.currentTarget.style.background = 'rgba(99,102,241,0.08)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(99,102,241,0.25)';
                e.currentTarget.style.background = 'rgba(99,102,241,0.04)';
              }}
            >
              <div className="w-14 h-14 flex items-center justify-center rounded-2xl mx-auto mb-4" style={{ background: 'rgba(99,102,241,0.12)' }}>
                <i className="ri-upload-cloud-2-line text-3xl" style={{ color: '#818CF8' }} />
              </div>
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                Dosyayı buraya sürükleyin veya tıklayın
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Excel (.xlsx, .xls) veya CSV formatı desteklenir</p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={e => { if (e.target.files?.[0]) void handleFile(e.target.files[0]); }}
              />
            </div>
          </div>

          {parseError && (
            <div className="flex items-start gap-3 rounded-xl p-3.5" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <i className="ri-error-warning-line flex-shrink-0 mt-0.5" style={{ color: '#EF4444' }} />
              <p className="text-sm" style={{ color: '#FCA5A5' }}>{parseError}</p>
            </div>
          )}

          {/* Field mapping info */}
          <div className="rounded-xl p-4" style={{ background: 'var(--bg-item)', border: '1px solid var(--bg-item-border)' }}>
            <p className="text-xs font-bold mb-2" style={{ color: 'var(--text-muted)' }}>ŞABLON KOLON SIRASI</p>
            <div className="grid grid-cols-2 gap-1.5">
              {TEMPLATE_HEADERS.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 h-5 flex items-center justify-center rounded-md text-[10px] font-bold flex-shrink-0"
                    style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8' }}>
                    {i + 1}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{h}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <i className="ri-checkbox-circle-line" style={{ color: '#22C55E' }} />
            <p className="text-sm font-semibold" style={{ color: '#22C55E' }}>
              {preview.length} kayıt okundu — <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{fileName}</span>
            </p>
          </div>

          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--bg-item-border)' }}>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full table-premium">
                <thead style={{ position: 'sticky', top: 0 }}>
                  <tr>
                    <th className="text-left">#</th>
                    <th className="text-left">Başlık</th>
                    <th className="text-left hidden sm:table-cell">Firma</th>
                    <th className="text-left hidden md:table-cell">Tarih</th>
                    <th className="text-left">Önem</th>
                    <th className="text-left hidden lg:table-cell">Açıklama</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i}>
                      <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                      <td>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{row.baslik}</p>
                        {row.bolum && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{row.bolum}</p>}
                      </td>
                      <td className="hidden sm:table-cell">
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{row.firmaAd || '—'}</span>
                      </td>
                      <td className="hidden md:table-cell">
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{row.tarih || '—'}</span>
                      </td>
                      <td>
                        <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{
                          background: `${SEV_COLOR[row.severity]}18`,
                          color: SEV_COLOR[row.severity],
                        }}>
                          {row.severity}
                        </span>
                      </td>
                      <td className="hidden lg:table-cell">
                        <span className="text-xs" style={{ color: 'var(--text-muted)', maxWidth: '200px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.aciklama || '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
