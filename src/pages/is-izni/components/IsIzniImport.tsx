import { useState, useRef } from 'react';
import Modal from '@/components/base/Modal';
import type { IsIzniTip, IsIzniStatus, Firma } from '@/types';
import XLSXStyle from 'xlsx-js-style';
import { parseImportFile } from '@/utils/importParser';

interface ImportRow {
  tip: IsIzniTip;
  firmaId: string;
  bolum: string;
  sorumlu: string;
  calisanlar: string;
  calisanSayisi: number;
  aciklama: string;
  tehlikeler: string;
  onlemler: string;
  gerekliEkipman: string;
  baslamaTarihi: string;
  bitisTarihi: string;
  durum: IsIzniStatus;
  onaylayanKisi: string;
  onayTarihi: string;
  notlar: string;
  olusturanKisi: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  firmalar: Firma[];
  onImport: (rows: ImportRow[]) => void;
}

const TIPLER: IsIzniTip[] = ['Sıcak Çalışma', 'Yüksekte Çalışma', 'Kapalı Alan', 'Elektrikli Çalışma', 'Kazı', 'Genel'];
const DURUMLAR: IsIzniStatus[] = ['Onay Bekliyor', 'Onaylandı', 'Reddedildi'];

export default function IsIzniImport({ open, onClose, firmalar, onImport }: Props) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setErrors([]);
    try {
      const { rows: dataRows, validCount } = await parseImportFile(file);
      if (validCount === 0) {
        setErrors(['Dosya boş veya geçersiz. Dolu satır bulunamadı.']);
        return;
      }

      const errs: string[] = [];
      const parsed: ImportRow[] = dataRows.map((cols, idx) => {
        const rowNum = idx + 2;
        const tip = TIPLER.find(t => t.toLowerCase() === (cols[0] ?? '').toLowerCase()) ?? 'Genel';
        const durum = DURUMLAR.find(d => d.toLowerCase() === (cols[12] ?? '').toLowerCase()) ?? 'Onay Bekliyor';
        const firmaAd = (cols[1] ?? '').trim();
        const firma = firmalar.find(f => f.ad.toLowerCase() === firmaAd.toLowerCase());
        if (!firma && firmaAd) errs.push(`Satır ${rowNum}: "${firmaAd}" firması bulunamadı.`);
        if (!(cols[6] ?? '').trim()) errs.push(`Satır ${rowNum}: Açıklama zorunludur.`);
        if (!(cols[10] ?? '').trim()) errs.push(`Satır ${rowNum}: Başlama tarihi zorunludur.`);
        return {
          tip, firmaId: firma?.id ?? '',
          bolum: cols[2] ?? '', sorumlu: cols[3] ?? '',
          calisanlar: cols[4] ?? '', calisanSayisi: parseInt(cols[5] ?? '1') || 1,
          aciklama: cols[6] ?? '', tehlikeler: cols[7] ?? '',
          onlemler: cols[8] ?? '', gerekliEkipman: cols[9] ?? '',
          baslamaTarihi: cols[10] ?? '', bitisTarihi: cols[11] ?? '',
          durum, onaylayanKisi: cols[13] ?? '',
          onayTarihi: cols[14] ?? '', notlar: cols[15] ?? '',
          olusturanKisi: '',
        };
      });

      setErrors(errs);
      setRows(parsed);
      setStep('preview');
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Dosya okunamadı.']);
    }
  };

  const downloadTemplate = () => {
    const HEADER_BG = '1E293B'; const HEADER_FG = 'FFFFFF'; const TITLE_BG = '0F172A';
    const ROW_ALT = 'F1F5F9'; const ROW_NORMAL = 'FFFFFF'; const BC = 'CBD5E1';
    const thinB = { top: { style: 'thin', color: { rgb: BC } }, bottom: { style: 'thin', color: { rgb: BC } }, left: { style: 'thin', color: { rgb: BC } }, right: { style: 'thin', color: { rgb: BC } } };
    const medB = { top: { style: 'medium', color: { rgb: '94A3B8' } }, bottom: { style: 'medium', color: { rgb: '94A3B8' } }, left: { style: 'medium', color: { rgb: '94A3B8' } }, right: { style: 'medium', color: { rgb: '94A3B8' } } };
    const titleS = { font: { bold: true, sz: 13, color: { rgb: HEADER_FG }, name: 'Calibri' }, fill: { fgColor: { rgb: TITLE_BG } }, alignment: { horizontal: 'left', vertical: 'center' }, border: medB };
    const headerS = { font: { bold: true, sz: 10, color: { rgb: HEADER_FG }, name: 'Calibri' }, fill: { fgColor: { rgb: HEADER_BG } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: thinB };
    const cellS = (ri: number) => ({ font: { sz: 10, color: { rgb: '1E293B' }, name: 'Calibri' }, fill: { fgColor: { rgb: ri % 2 === 0 ? ROW_NORMAL : ROW_ALT } }, alignment: { horizontal: 'left', vertical: 'center', wrapText: true }, border: thinB });
    const noteS = { font: { sz: 9, color: { rgb: '475569' }, italic: true, name: 'Calibri' }, fill: { fgColor: { rgb: 'FFF7ED' } }, alignment: { horizontal: 'left', vertical: 'center', wrapText: true }, border: thinB };
    const noteTitleS = { font: { bold: true, sz: 10, color: { rgb: 'EA580C' }, name: 'Calibri' }, fill: { fgColor: { rgb: 'FFF7ED' } }, alignment: { horizontal: 'left', vertical: 'center' }, border: thinB };

    const DISPLAY_HEADERS = ['Tip', 'Firma Adi', 'Bolum', 'Sorumlu', 'Calisanlar', 'Calisan Sayisi', 'Aciklama', 'Tehlikeler', 'Onlemler', 'Gerekli Ekipman', 'Baslama Tarihi', 'Bitis Tarihi', 'Durum', 'Onaylayan Kisi', 'Onay Tarihi', 'Notlar'];
    const exampleRow = ['Sicak Calisma', 'Firma A.S.', 'Uretim Alani', 'Ahmet Yilmaz', 'Mehmet Kaya', '3', 'Kaynak islemi yapilacak', 'Yangin riski', 'Yangin tupu hazir', 'Baret,Eldiven', '2026-04-10', '2026-04-10', 'Onay Bekliyor', 'Mudur Adi', '', 'Ek not'];
    const notlar = [
      ['KULLANIM NOTLARI:'],
      ['1. Tip: Sicak Calisma / Yuksekte Calisma / Kapali Alan / Elektrikli Calisma / Kazi / Genel'],
      ['2. Durum: Onay Bekliyor / Onaylandi / Reddedildi'],
      ['3. Tarih formati: YYYY-AA-GG (ornek: 2026-04-10)'],
      ['4. Firma adi sistemdeki kayitla birebir eslesmelidir.'],
    ];

    const wsData = [
      ['ISG Is Izni - Ice Aktarma Sablonu', ...Array(DISPLAY_HEADERS.length - 1).fill('')],
      DISPLAY_HEADERS,
      exampleRow,
      ...notlar.map(n => [...n, ...Array(DISPLAY_HEADERS.length - 1).fill('')]),
    ];

    const wb = XLSXStyle.utils.book_new();
    const ws = XLSXStyle.utils.aoa_to_sheet(wsData);
    if (!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: DISPLAY_HEADERS.length - 1 } });
    notlar.forEach((_, ri) => { ws['!merges']!.push({ s: { r: ri + 3, c: 0 }, e: { r: ri + 3, c: DISPLAY_HEADERS.length - 1 } }); });
    wsData.forEach((row, ri) => {
      (row as string[]).forEach((_, ci) => {
        const addr = XLSXStyle.utils.encode_cell({ r: ri, c: ci });
        if (!ws[addr]) return;
        let s: object;
        if (ri === 0) s = titleS;
        else if (ri === 1) s = headerS;
        else if (ri === 2) s = cellS(0);
        else if (ri === 3) s = noteTitleS;
        else s = noteS;
        (ws[addr] as XLSXStyle.CellObject).s = s;
      });
    });
    ws['!cols'] = [{ wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 30 }, { wch: 24 }, { wch: 24 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 24 }];
    if (!ws['!rows']) ws['!rows'] = [];
    (ws['!rows'] as XLSXStyle.RowInfo[])[0] = { hpt: 30 };
    (ws['!rows'] as XLSXStyle.RowInfo[])[1] = { hpt: 26 };
    (ws['!rows'] as XLSXStyle.RowInfo[])[2] = { hpt: 22 };
    XLSXStyle.utils.book_append_sheet(wb, ws, 'Is Izni Sablonu');
    const xlsxData = XLSXStyle.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([xlsxData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${new Date().toLocaleDateString('tr-TR')} İş İzni Şablonu.xlsx`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
  };

  const handleImport = () => {
    const valid = rows.filter(r => r.firmaId && r.aciklama && r.baslamaTarihi);
    if (valid.length === 0) return;
    setImporting(true);
    try {
      onImport(valid);
      setRows([]); setErrors([]); setStep('upload');
      onClose();
    } finally {
      setImporting(false);
    }
  };

  const reset = () => { setRows([]); setErrors([]); setStep('upload'); };
  const validCount = rows.filter(r => r.firmaId && r.aciklama && r.baslamaTarihi).length;

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title={step === 'upload' ? 'İş İzni Excel/CSV İçe Aktarma' : `Önizleme — ${validCount} geçerli kayıt`}
      size="lg"
      icon="ri-upload-cloud-2-line"
      footer={
        step === 'preview' ? (
          <>
            <button onClick={reset} className="btn-secondary whitespace-nowrap"><i className="ri-arrow-left-line mr-1" />Geri</button>
            <button
              onClick={handleImport}
              disabled={validCount === 0 || importing}
              className="btn-primary whitespace-nowrap"
            >
              {importing
                ? <><i className="ri-loader-4-line animate-spin mr-1" />Aktarılıyor...</>
                : <><i className="ri-check-line mr-1" />{validCount} Kaydı Aktar</>}
            </button>
          </>
        ) : (
          <button onClick={() => { reset(); onClose(); }} className="btn-secondary whitespace-nowrap">İptal</button>
        )
      }
    >
      {step === 'upload' ? (
        <div className="space-y-5">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)' }}>
            <i className="ri-information-line flex-shrink-0" style={{ color: '#60A5FA' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Excel veya CSV formatında iş izni aktarımı</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Şablonu indirip doldurun, ardından yükleyin. Boş satırlar ve notlar otomatik atlanır.</p>
            </div>
          </div>

          <button onClick={downloadTemplate} className="btn-secondary w-full whitespace-nowrap">
            <i className="ri-download-line mr-1" />Excel Şablonunu İndir
          </button>

          <div
            className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors"
            style={{ borderColor: 'rgba(96,165,250,0.3)', background: 'rgba(96,165,250,0.03)' }}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void handleFile(f); }}
          >
            <div className="w-14 h-14 flex items-center justify-center rounded-2xl mx-auto mb-3" style={{ background: 'rgba(96,165,250,0.1)' }}>
              <i className="ri-file-upload-line text-2xl" style={{ color: '#60A5FA' }} />
            </div>
            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Dosyayı sürükleyin veya tıklayın</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>.xlsx, .xls veya .csv formatı desteklenir</p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ''; }} />
          </div>

          {errors.length > 0 && (
            <div className="flex items-start gap-3 rounded-xl p-3.5" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <i className="ri-error-warning-line flex-shrink-0 mt-0.5" style={{ color: '#EF4444' }} />
              <p className="text-sm" style={{ color: '#FCA5A5' }}>{errors[0]}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {errors.length > 0 && (
            <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <p className="text-sm font-semibold mb-2" style={{ color: '#EF4444' }}>
                <i className="ri-error-warning-line mr-1" />{errors.length} Uyarı
              </p>
              <ul className="space-y-1 max-h-32 overflow-y-auto">
                {errors.map((e, i) => <li key={i} className="text-xs" style={{ color: '#EF4444' }}>• {e}</li>)}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
            <i className="ri-checkbox-circle-line" style={{ color: '#34D399' }} />
            <p className="text-sm" style={{ color: '#34D399' }}>
              <strong>{validCount}</strong> geçerli kayıt aktarılmaya hazır
              {rows.length > validCount && <span style={{ color: '#94A3B8' }}> ({rows.length - validCount} geçersiz atlandı)</span>}
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl max-h-80 overflow-y-auto" style={{ border: '1px solid var(--border-color)' }}>
            <table className="w-full text-xs">
              <thead style={{ position: 'sticky', top: 0 }}>
                <tr style={{ background: 'var(--bg-item)' }}>
                  {['#', 'Tip', 'Firma', 'Bölüm', 'Sorumlu', 'Başlama', 'Durum', ''].map((h, i) => (
                    <th key={i} className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const valid = r.firmaId && r.aciklama && r.baslamaTarihi;
                  return (
                    <tr key={i} style={{ borderTop: '1px solid var(--border-color)', background: valid ? undefined : 'rgba(239,68,68,0.04)' }}>
                      <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                      <td className="px-3 py-2">{r.tip}</td>
                      <td className="px-3 py-2">{firmalar.find(f => f.id === r.firmaId)?.ad ?? <span style={{ color: '#EF4444' }}>Bulunamadı</span>}</td>
                      <td className="px-3 py-2">{r.bolum || '—'}</td>
                      <td className="px-3 py-2">{r.sorumlu || '—'}</td>
                      <td className="px-3 py-2">{r.baslamaTarihi || <span style={{ color: '#EF4444' }}>Eksik</span>}</td>
                      <td className="px-3 py-2">{r.durum}</td>
                      <td className="px-3 py-2">
                        {valid
                          ? <i className="ri-checkbox-circle-line" style={{ color: '#34D399' }} />
                          : <i className="ri-close-circle-line" style={{ color: '#EF4444' }} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
