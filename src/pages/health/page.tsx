import { useState, useMemo, useRef } from 'react';
import { useApp } from '@/store/AppContext';
import Modal from '@/components/base/Modal';
import XLSXStyle from 'xlsx-js-style';
import {
  COLORS, headerStyle, cellStyle, titleStyle, statusStyle,
  cellAddr, setRowHeights, addMerge,
} from '@/utils/excelStyles';

// ─── Yardımcılar ─────────────────────────────────────────────────────────────
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

function getDurumConfig(days: number) {
  if (days < 0)  return { label: `${Math.abs(days)} gün geçti`, color: '#EF4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)',   icon: 'ri-alarm-warning-line' };
  if (days <= 30) return { label: `${days} gün kaldı`,          color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)',  icon: 'ri-time-line' };
  return           { label: `${days} gün kaldı`,                color: '#34D399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.25)',  icon: 'ri-checkbox-circle-line' };
}

// ─── Excel Export ─────────────────────────────────────────────────────────────
function exportToExcel(
  muayeneler: { id: string; personelId: string; muayeneTarihi: string; sonrakiTarih: string; saglikDurumu?: string; silinmis?: boolean }[],
  personeller: { id: string; adSoyad: string; gorev?: string }[],
  firmalar: { id: string; ad: string }[],
) {
  const aktif = muayeneler.filter(m => !m.silinmis);
  const today = new Date().toLocaleDateString('tr-TR');

  // ── Başlık satırı ──
  const TITLE_ROW = [`SAĞLIK TAKİBİ — ${today}`, '', '', '', '', '', ''];
  const COLS = ['Ad Soyad', 'Görev', 'Firma', 'Muayene Tarihi', 'Sonraki Muayene', 'Kalan Gün', 'Durum'];

  const rows = aktif.map(m => {
    const p = personeller.find(x => x.id === m.personelId);
    const f = firmalar.find(x => x.id === (m as unknown as { firmaId?: string }).firmaId);
    const days = getDaysUntil(m.sonrakiTarih);
    const durum = days < 0 ? 'Süresi Geçmiş' : days <= 30 ? 'Yaklaşıyor' : 'Güncel';
    return [
      p?.adSoyad || '—',
      p?.gorev || '—',
      f?.ad || '—',
      fmtDate(m.muayeneTarihi),
      fmtDate(m.sonrakiTarih),
      m.sonrakiTarih ? String(days) : '—',
      durum,
    ];
  });

  const allData = [TITLE_ROW, COLS, ...rows];
  const ws = XLSXStyle.utils.aoa_to_sheet(allData);

  // Başlık satırı stili
  TITLE_ROW.forEach((_, ci) => {
    const addr = cellAddr(ci, 0);
    if (!ws[addr]) ws[addr] = { v: ci === 0 ? TITLE_ROW[0] : '', t: 's' };
    (ws[addr] as XLSXStyle.CellObject).s = titleStyle();
  });

  // Sütun başlıkları
  COLS.forEach((col, ci) => {
    const addr = cellAddr(ci, 1);
    if (!ws[addr]) ws[addr] = { v: col, t: 's' };
    (ws[addr] as XLSXStyle.CellObject).s = headerStyle();
  });

  // Veri satırları
  rows.forEach((row, ri) => {
    row.forEach((val, ci) => {
      const addr = cellAddr(ci, ri + 2);
      if (!ws[addr]) ws[addr] = { v: val, t: 's' };
      // Durum sütunu (6. kolon) renkli
      if (ci === 6) {
        (ws[addr] as XLSXStyle.CellObject).s = statusStyle(val as string);
      } else if (ci === 5) {
        // Kalan gün — sayısal hizalama
        const days = parseInt(val as string, 10);
        const color = isNaN(days) ? COLORS.gray : days < 0 ? COLORS.red : days <= 30 ? COLORS.yellow : COLORS.green;
        (ws[addr] as XLSXStyle.CellObject).s = {
          ...cellStyle(ri, 'center'),
          font: { bold: true, sz: 10, color: { rgb: color }, name: 'Calibri' },
        };
      } else {
        (ws[addr] as XLSXStyle.CellObject).s = cellStyle(ri, ci === 0 ? 'left' : 'left');
      }
    });
  });

  // Başlık birleştir
  addMerge(ws, { r: 0, c: 0 }, { r: 0, c: 6 });

  // Sütun genişlikleri
  ws['!cols'] = [{ wch: 28 }, { wch: 20 }, { wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 16 }];

  // Satır yükseklikleri
  setRowHeights(ws, [28, 22, ...rows.map(() => 18)]);

  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, ws, 'Sağlık Takibi');
  const data = XLSXStyle.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Saglik_Takibi_${today.replace(/\./g, '-')}.xlsx`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ─── Excel Şablon İndir ───────────────────────────────────────────────────────
function downloadTemplate() {
  const TITLE_ROW = ['SAĞLIK TAKİBİ — İÇE AKTARMA ŞABLONU', '', ''];
  const INFO_ROW = ['Lütfen bu şablonu doldurun. Ad Soyad alanı sistemdeki personel adıyla tam eşleşmelidir.', '', ''];
  const COLS = ['Ad Soyad', 'Muayene Tarihi', 'Sonraki Muayene Tarihi'];
  const EXAMPLE_ROWS = [
    ['Ahmet Yılmaz', '15.03.2025', '15.03.2026'],
    ['Fatma Kaya', '20.01.2025', '20.01.2026'],
    ['Mehmet Demir', '10.06.2024', '10.06.2025'],
  ];

  const allData = [TITLE_ROW, INFO_ROW, COLS, ...EXAMPLE_ROWS];
  const ws = XLSXStyle.utils.aoa_to_sheet(allData);

  // Başlık
  TITLE_ROW.forEach((_, ci) => {
    const addr = cellAddr(ci, 0);
    if (!ws[addr]) ws[addr] = { v: ci === 0 ? TITLE_ROW[0] : '', t: 's' };
    (ws[addr] as XLSXStyle.CellObject).s = titleStyle();
  });

  // Bilgi satırı
  INFO_ROW.forEach((_, ci) => {
    const addr = cellAddr(ci, 1);
    if (!ws[addr]) ws[addr] = { v: ci === 0 ? INFO_ROW[0] : '', t: 's' };
    (ws[addr] as XLSXStyle.CellObject).s = {
      font: { italic: true, sz: 9, color: { rgb: COLORS.gray }, name: 'Calibri' },
      fill: { fgColor: { rgb: 'FEF9C3' } },
      alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
      border: { top: { style: 'thin', color: { rgb: COLORS.borderColor } }, bottom: { style: 'thin', color: { rgb: COLORS.borderColor } }, left: { style: 'thin', color: { rgb: COLORS.borderColor } }, right: { style: 'thin', color: { rgb: COLORS.borderColor } } },
    };
  });

  // Sütun başlıkları
  COLS.forEach((col, ci) => {
    const addr = cellAddr(ci, 2);
    if (!ws[addr]) ws[addr] = { v: col, t: 's' };
    (ws[addr] as XLSXStyle.CellObject).s = headerStyle();
  });

  // Örnek satırlar
  EXAMPLE_ROWS.forEach((row, ri) => {
    row.forEach((val, ci) => {
      const addr = cellAddr(ci, ri + 3);
      if (!ws[addr]) ws[addr] = { v: val, t: 's' };
      (ws[addr] as XLSXStyle.CellObject).s = {
        ...cellStyle(ri),
        font: { italic: true, sz: 10, color: { rgb: COLORS.gray }, name: 'Calibri' },
      };
    });
  });

  // Birleştir
  addMerge(ws, { r: 0, c: 0 }, { r: 0, c: 2 });
  addMerge(ws, { r: 1, c: 0 }, { r: 1, c: 2 });

  ws['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 24 }];
  setRowHeights(ws, [28, 32, 22, 18, 18, 18]);

  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, ws, 'Şablon');
  const data = XLSXStyle.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Saglik_Takibi_Sablon.xlsx';
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ─── Excel Import ─────────────────────────────────────────────────────────────
function excelSerialToDate(serial: number): string {
  // Excel serial date → YYYY-MM-DD
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date = new Date(utc_value * 1000);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateValue(val: unknown): string {
  if (!val) return '';
  // Excel serial number (tarih hücresi sayı olarak gelir)
  if (typeof val === 'number') return excelSerialToDate(val);
  const s = String(val).trim();
  if (!s) return '';
  // DD.MM.YYYY
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(s)) {
    const [d, m, y] = s.split('.');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return s;
}

async function parseImportFile(file: File): Promise<{ adSoyad: string; muayeneTarihi: string; sonrakiTarih: string }[]> {
  const XLSXLib = await import('xlsx-js-style');
  const buf = await file.arrayBuffer();
  const wb = XLSXLib.read(buf, { type: 'array', cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];

  // raw array olarak oku — header satırlarını kendimiz tespit edelim
  const allRows = XLSXLib.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as unknown[][];

  // Kolon başlığı satırını bul: "Ad Soyad" veya "ADI SOYADI" içeren satır
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(allRows.length, 10); i++) {
    const row = allRows[i];
    const rowStr = row.map(c => String(c).toLowerCase()).join('|');
    if (rowStr.includes('ad soyad') || rowStr.includes('adı soyadı') || rowStr.includes('adi soyadi') || rowStr.includes('isim')) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) {
    // Header bulunamadı — ilk satırı header say
    headerRowIdx = 0;
  }

  const headerRow = allRows[headerRowIdx].map(c => String(c).toLowerCase().trim());

  // Kolon indekslerini bul
  const adIdx = headerRow.findIndex(h =>
    h.includes('ad soyad') || h.includes('adı soyadı') || h.includes('adi soyadi') || h === 'isim' || h === 'ad'
  );
  const muayeneIdx = headerRow.findIndex(h =>
    h.includes('muayene tarihi') && !h.includes('sonraki')
  );
  const sonrakiIdx = headerRow.findIndex(h =>
    h.includes('sonraki') || h.includes('sonraki muayene')
  );

  // Veri satırlarını işle (header'dan sonraki satırlar)
  const results: { adSoyad: string; muayeneTarihi: string; sonrakiTarih: string }[] = [];

  for (let i = headerRowIdx + 1; i < allRows.length; i++) {
    const row = allRows[i];
    if (!row || row.length === 0) continue;

    const adSoyad = adIdx >= 0 ? String(row[adIdx] ?? '').trim() : String(row[0] ?? '').trim();
    const muayeneTarihi = muayeneIdx >= 0 ? parseDateValue(row[muayeneIdx]) : parseDateValue(row[1]);
    const sonrakiTarih = sonrakiIdx >= 0 ? parseDateValue(row[sonrakiIdx]) : parseDateValue(row[2]);

    // Boş satır veya örnek veri satırı atla
    if (!adSoyad || adSoyad.toLowerCase().includes('örnek') || adSoyad.toLowerCase().includes('ornek')) continue;
    // Başlık tekrarı atla
    if (adSoyad.toLowerCase().includes('ad soyad') || adSoyad.toLowerCase().includes('isim')) continue;

    results.push({ adSoyad, muayeneTarihi, sonrakiTarih });
  }

  return results;
}

// ─── Form tipi ────────────────────────────────────────────────────────────────
interface MuayeneForm {
  personelId: string;
  firmaId: string;
  muayeneTarihi: string;
  sonrakiTarih: string;
  saglikDurumu: string;
}

const emptyForm: MuayeneForm = {
  personelId: '', firmaId: '', muayeneTarihi: '', sonrakiTarih: '', saglikDurumu: '',
};

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────
export default function MuayenelerPage() {
  const { muayeneler, personeller, firmalar, addMuayene, updateMuayene, deleteMuayene, addToast, refreshData } = useApp();

  const [search, setSearch] = useState('');
  const [firmaFilter, setFirmaFilter] = useState('');
  const [durumFilter, setDurumFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<MuayeneForm>(emptyForm);
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<{ adSoyad: string; muayeneTarihi: string; sonrakiTarih: string; matched?: string }[] | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const aktif = useMemo(() => muayeneler.filter(m => !m.silinmis), [muayeneler]);
  const aktifPersoneller = useMemo(() => personeller.filter(p => !p.silinmis && p.durum === 'Aktif'), [personeller]);
  const filteredPersoneller = useMemo(
    () => form.firmaId ? aktifPersoneller.filter(p => p.firmaId === form.firmaId) : aktifPersoneller,
    [aktifPersoneller, form.firmaId],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return aktif.filter(m => {
      const p = personeller.find(x => x.id === m.personelId);
      const f = firmalar.find(x => x.id === m.firmaId);
      const matchQ = !q || (p?.adSoyad.toLowerCase().includes(q) ?? false) || (f?.ad.toLowerCase().includes(q) ?? false);
      const matchFirma = !firmaFilter || m.firmaId === firmaFilter;
      const days = getDaysUntil(m.sonrakiTarih);
      const matchDurum = !durumFilter
        || (durumFilter === 'gecmis' && days < 0)
        || (durumFilter === 'yaklasan' && days >= 0 && days <= 30)
        || (durumFilter === 'guncel' && days > 30);
      return matchQ && matchFirma && matchDurum;
    }).sort((a, b) => getDaysUntil(a.sonrakiTarih) - getDaysUntil(b.sonrakiTarih));
  }, [aktif, personeller, firmalar, search, firmaFilter, durumFilter]);

  const stats = useMemo(() => ({
    toplam: aktif.length,
    gecmis: aktif.filter(m => getDaysUntil(m.sonrakiTarih) < 0).length,
    yaklasan: aktif.filter(m => { const d = getDaysUntil(m.sonrakiTarih); return d >= 0 && d <= 30; }).length,
    guncel: aktif.filter(m => getDaysUntil(m.sonrakiTarih) > 30).length,
  }), [aktif]);

  const openAdd = () => { setEditId(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (m: typeof muayeneler[0]) => {
    setEditId(m.id);
    setForm({
      personelId: m.personelId,
      firmaId: m.firmaId,
      muayeneTarihi: m.muayeneTarihi,
      sonrakiTarih: m.sonrakiTarih,
      saglikDurumu: (m as unknown as { saglikDurumu?: string }).saglikDurumu ?? '',
    });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.personelId) { addToast('Personel seçimi zorunludur.', 'error'); return; }
    if (!form.muayeneTarihi) { addToast('Muayene tarihi zorunludur.', 'error'); return; }
    if (!form.sonrakiTarih) { addToast('Sonraki muayene tarihi zorunludur.', 'error'); return; }

    const payload = {
      personelId: form.personelId,
      firmaId: form.firmaId,
      muayeneTarihi: form.muayeneTarihi,
      sonrakiTarih: form.sonrakiTarih,
      saglikDurumu: form.saglikDurumu,
      // Zorunlu ama kullanılmayan alanlar — boş bırak
      sonuc: 'Çalışabilir' as const,
      hastane: '',
      doktor: '',
      notlar: '',
      belgeMevcut: false,
    };

    if (editId) {
      updateMuayene(editId, payload);
      addToast('Kayıt güncellendi.', 'success');
    } else {
      addMuayene(payload);
      addToast('Kayıt eklendi.', 'success');
    }
    setShowModal(false);
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteMuayene(deleteId);
    addToast('Kayıt silindi.', 'success');
    setDeleteId(null);
  };

  // ── Excel Import ──
  const normalize = (s: string) =>
    s.toLowerCase()
      .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
      .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/\s+/g, ' ').trim();

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const rows = await parseImportFile(file);
      const preview = rows.map(r => {
        const normR = normalize(r.adSoyad);
        // Önce tam eşleşme dene
        let matched = aktifPersoneller.find(p =>
          normalize(p.adSoyad) === normR
        );
        // Tam eşleşme yoksa içerme dene (kısmi ad)
        if (!matched) {
          matched = aktifPersoneller.find(p =>
            normalize(p.adSoyad).includes(normR) || normR.includes(normalize(p.adSoyad))
          );
        }
        return { ...r, matched: matched?.id };
      });
      setImportPreview(preview);
    } catch (err) {
      console.error('Import error:', err);
      addToast('Dosya okunamadı. Excel formatını kontrol edin.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleImportConfirm = () => {
    if (!importPreview) return;
    let added = 0;
    importPreview.forEach(r => {
      if (!r.matched) return;
      const p = aktifPersoneller.find(x => x.id === r.matched);
      if (!p) return;
      // Tarih parse — DD.MM.YYYY veya YYYY-MM-DD
      const parseDate = (s: string) => {
        if (!s) return '';
        if (s.includes('.')) {
          const [d, m, y] = s.split('.');
          return `${y}-${m?.padStart(2, '0')}-${d?.padStart(2, '0')}`;
        }
        return s;
      };
      addMuayene({
        personelId: r.matched,
        firmaId: p.firmaId,
        muayeneTarihi: parseDate(r.muayeneTarihi),
        sonrakiTarih: parseDate(r.sonrakiTarih),
        sonuc: 'Çalışabilir' as const,
        hastane: '', doktor: '', notlar: '', belgeMevcut: false,
      });
      added++;
    });
    addToast(`${added} kayıt içe aktarıldı.`, 'success');
    setImportPreview(null);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Sağlık Durumu</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Personel periyodik muayene tarihlerini takip edin</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button
            onClick={async () => { setRefreshing(true); await refreshData(); setRefreshing(false); }}
            disabled={refreshing}
            className="btn-secondary whitespace-nowrap"
          >
            <i className={`ri-refresh-line mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Yenileniyor...' : 'Yenile'}
          </button>
          <button onClick={downloadTemplate} className="btn-secondary whitespace-nowrap">
            <i className="ri-file-download-line mr-1" />Şablon İndir
          </button>
          <button onClick={() => importRef.current?.click()} disabled={importing} className="btn-secondary whitespace-nowrap">
            <i className="ri-upload-2-line mr-1" />{importing ? 'Okunuyor...' : 'Excel İçe Aktar'}
          </button>
          <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFile} />
          <button onClick={() => exportToExcel(muayeneler, personeller, firmalar)} className="btn-secondary whitespace-nowrap">
            <i className="ri-file-excel-2-line mr-1" />Excel Dışa Aktar
          </button>
          <button onClick={openAdd} className="btn-primary whitespace-nowrap">
            <i className="ri-add-line" /> Kayıt Ekle
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Toplam Kayıt',    value: stats.toplam,   icon: 'ri-heart-pulse-line',     color: '#60A5FA', bg: 'rgba(96,165,250,0.1)' },
          { label: 'Güncel',          value: stats.guncel,   icon: 'ri-checkbox-circle-line',  color: '#34D399', bg: 'rgba(52,211,153,0.1)' },
          { label: 'Yaklaşan (≤30g)', value: stats.yaklasan, icon: 'ri-time-line',             color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
          { label: 'Süresi Geçmiş',   value: stats.gecmis,   icon: 'ri-alarm-warning-line',    color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
        ].map(s => (
          <div key={s.label} className="isg-card rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: s.bg }}>
              <i className={`${s.icon} text-base`} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-xl font-bold leading-none" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 px-4 py-3 rounded-2xl isg-card">
        <div className="relative flex-1 min-w-[180px]">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Personel veya firma ara..." className="isg-input pl-9" />
        </div>
        <select value={firmaFilter} onChange={e => setFirmaFilter(e.target.value)} className="isg-input" style={{ minWidth: '160px' }}>
          <option value="">Tüm Firmalar</option>
          {firmalar.filter(f => !f.silinmis).map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
        </select>
        <select value={durumFilter} onChange={e => setDurumFilter(e.target.value)} className="isg-input" style={{ minWidth: '140px' }}>
          <option value="">Tüm Durumlar</option>
          <option value="gecmis">Süresi Geçmiş</option>
          <option value="yaklasan">Yaklaşıyor</option>
          <option value="guncel">Güncel</option>
        </select>
        {(search || firmaFilter || durumFilter) && (
          <button onClick={() => { setSearch(''); setFirmaFilter(''); setDurumFilter(''); }} className="btn-secondary whitespace-nowrap">
            <i className="ri-filter-off-line" /> Temizle
          </button>
        )}
        <div className="ml-auto flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <i className="ri-list-check text-xs" />{filtered.length} kayıt
        </div>
      </div>

      {/* Tablo */}
      {filtered.length === 0 ? (
        <div className="isg-card rounded-xl py-20 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)' }}>
            <i className="ri-heart-pulse-line text-3xl" style={{ color: '#60A5FA' }} />
          </div>
          <p className="font-semibold" style={{ color: 'var(--text-muted)' }}>Kayıt bulunamadı</p>
          <button onClick={openAdd} className="btn-primary mt-5"><i className="ri-add-line" /> Kayıt Ekle</button>
        </div>
      ) : (
        <div className="isg-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-premium w-full">
              <thead>
                <tr>
                  <th className="text-left">Personel</th>
                  <th className="text-left hidden md:table-cell">Firma</th>
                  <th className="text-left">Muayene Tarihi</th>
                  <th className="text-left">Sonraki Muayene</th>
                  <th className="text-left">Kalan Gün / Durum</th>
                  <th className="text-left hidden lg:table-cell">Sağlık Durumu</th>
                  <th className="text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => {
                  const p = personeller.find(x => x.id === m.personelId);
                  const f = firmalar.find(x => x.id === m.firmaId);
                  const days = getDaysUntil(m.sonrakiTarih);
                  const dur = getDurumConfig(days);
                  const saglikDurumu = (m as unknown as { saglikDurumu?: string }).saglikDurumu;
                  return (
                    <tr key={m.id}>
                      <td>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{p?.adSoyad || '—'}</p>
                        {p?.gorev && <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{p.gorev}</p>}
                      </td>
                      <td className="hidden md:table-cell">
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{f?.ad || '—'}</span>
                      </td>
                      <td>
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtDate(m.muayeneTarihi)}</span>
                      </td>
                      <td>
                        <span className="text-sm font-medium" style={{ color: days < 0 ? '#EF4444' : days <= 30 ? '#F59E0B' : 'var(--text-secondary)' }}>
                          {fmtDate(m.sonrakiTarih)}
                        </span>
                      </td>
                      <td>
                        {m.sonrakiTarih ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap" style={{ background: dur.bg, color: dur.color, border: `1px solid ${dur.border}` }}>
                            <i className={`${dur.icon} text-xs`} />{dur.label}
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td className="hidden lg:table-cell">
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{saglikDurumu || '—'}</span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => openEdit(m)} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B' }} title="Düzenle">
                            <i className="ri-edit-line text-xs" />
                          </button>
                          <button onClick={() => setDeleteId(m.id)} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }} title="Sil">
                            <i className="ri-delete-bin-line text-xs" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Kayıt Ekle/Düzenle Modal ── */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editId ? 'Kaydı Düzenle' : 'Yeni Kayıt Ekle'}
        size="md"
        icon="ri-heart-pulse-line"
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="btn-secondary whitespace-nowrap">İptal</button>
            <button onClick={handleSave} className="btn-primary whitespace-nowrap">
              <i className={editId ? 'ri-save-line' : 'ri-add-line'} /> {editId ? 'Güncelle' : 'Ekle'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Firma</label>
            <select value={form.firmaId} onChange={e => setForm(p => ({ ...p, firmaId: e.target.value, personelId: '' }))} className="isg-input">
              <option value="">Firma Seçin</option>
              {firmalar.filter(f => !f.silinmis).map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Personel <span style={{ color: '#EF4444' }}>*</span></label>
            <select value={form.personelId} onChange={e => setForm(p => ({ ...p, personelId: e.target.value }))} className="isg-input">
              <option value="">Personel Seçin</option>
              {filteredPersoneller.map(p => <option key={p.id} value={p.id}>{p.adSoyad}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Muayene Tarihi <span style={{ color: '#EF4444' }}>*</span></label>
            <input type="date" value={form.muayeneTarihi} onChange={e => setForm(p => ({ ...p, muayeneTarihi: e.target.value }))} className="isg-input" />
          </div>
          <div>
            <label className="form-label">Sonraki Muayene Tarihi <span style={{ color: '#EF4444' }}>*</span></label>
            <input type="date" value={form.sonrakiTarih} onChange={e => setForm(p => ({ ...p, sonrakiTarih: e.target.value }))} className="isg-input" />
          </div>
          <div className="sm:col-span-2">
            <label className="form-label">Sağlık Durumu <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>(opsiyonel)</span></label>
            <input
              value={form.saglikDurumu}
              onChange={e => setForm(p => ({ ...p, saglikDurumu: e.target.value }))}
              placeholder="Örn: Çalışabilir, Kısıtlı..."
              className="isg-input"
              maxLength={100}
            />
          </div>
        </div>
      </Modal>

      {/* ── Silme Modal ── */}
      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Kaydı Sil"
        size="sm"
        icon="ri-delete-bin-line"
        footer={
          <>
            <button onClick={() => setDeleteId(null)} className="btn-secondary whitespace-nowrap">İptal</button>
            <button onClick={handleDelete} className="btn-danger whitespace-nowrap">Evet, Sil</button>
          </>
        }
      >
        <div className="py-2">
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl mb-4" style={{ background: 'rgba(239,68,68,0.12)' }}>
            <i className="ri-error-warning-line text-xl" style={{ color: '#EF4444' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Bu kaydı silmek istediğinizden emin misiniz?</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Kayıt çöp kutusuna taşınacak.</p>
        </div>
      </Modal>

      {/* ── Excel Import Önizleme Modal ── */}
      <Modal
        open={!!importPreview}
        onClose={() => setImportPreview(null)}
        title="Excel İçe Aktarma Önizleme"
        size="lg"
        icon="ri-upload-2-line"
        footer={
          <>
            <button onClick={() => setImportPreview(null)} className="btn-secondary whitespace-nowrap">İptal</button>
            <button
              onClick={handleImportConfirm}
              className="btn-primary whitespace-nowrap"
              disabled={!importPreview?.some(r => r.matched)}
            >
              <i className="ri-check-line" /> {importPreview?.filter(r => r.matched).length} Kaydı Aktar
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)' }}>
            <i className="ri-information-line" style={{ color: '#60A5FA' }} />
            <p className="text-xs" style={{ color: '#60A5FA' }}>
              {importPreview?.filter(r => r.matched).length} kayıt eşleşti, {importPreview?.filter(r => !r.matched).length} kayıt eşleşmedi (personel bulunamadı).
            </p>
          </div>
          <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--bg-item-border)' }}>
            <table className="table-premium w-full">
              <thead>
                <tr>
                  <th className="text-left">Ad Soyad</th>
                  <th className="text-left">Muayene Tarihi</th>
                  <th className="text-left">Sonraki Muayene</th>
                  <th className="text-left">Durum</th>
                </tr>
              </thead>
              <tbody>
                {importPreview?.map((r, i) => (
                  <tr key={i}>
                    <td><span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{r.adSoyad}</span></td>
                    <td><span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{r.muayeneTarihi || '—'}</span></td>
                    <td><span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{r.sonrakiTarih || '—'}</span></td>
                    <td>
                      {r.matched ? (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.1)', color: '#34D399' }}>Eşleşti</span>
                      ) : (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>Bulunamadı</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </div>
  );
}
