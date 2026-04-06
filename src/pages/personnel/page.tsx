import { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../../store/AppContext';
import { usePermissions } from '../../hooks/usePermissions';
import type { Personel } from '../../types';
import Modal from '../../components/base/Modal';
import Badge, { getPersonelStatusColor } from '../../components/base/Badge';
import XLSXStyle from 'xlsx-js-style';
import PersonelDetayModal from './components/PersonelDetayModal';
import PersonelAvatar from '../../components/base/PersonelAvatar';
import PersonelKartvizit from './components/PersonelKartvizit';
import { parseImportFile } from '../../utils/importParser';

const KAN_GRUPLARI = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'];

const EXCEL_COLUMNS = [
  'Ad Soyad', 'TC Kimlik No', 'Telefon', 'E-posta', 'Doğum Tarihi',
  'İşe Giriş Tarihi', 'Görev', 'Departman', 'Firma Adı', 'Durum',
  'Kan Grubu', 'Acil Durum Kişisi', 'Acil Durum Telefonu', 'Adres',
] as const;

const emptyPersonel: Omit<Personel, 'id' | 'olusturmaTarihi' | 'guncellemeTarihi'> = {
  adSoyad: '', tc: '', telefon: '', email: '', dogumTarihi: '', gorev: '',
  departman: '', iseGirisTarihi: '', firmaId: '', durum: 'Aktif',
  kanGrubu: '', acilKisi: '', acilTelefon: '', adres: '',
};

function FF({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="input-premium" />
    </div>
  );
}

function FS({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="input-premium cursor-pointer">
        {options.map(o => <option key={o} value={o}>{o || 'Seçiniz'}</option>)}
      </select>
    </div>
  );
}

const AVATAR_COLORS = [
  'linear-gradient(135deg, #3B82F6, #6366F1)',
  'linear-gradient(135deg, #10B981, #059669)',
  'linear-gradient(135deg, #F59E0B, #D97706)',
  'linear-gradient(135deg, #EF4444, #DC2626)',
  'linear-gradient(135deg, #8B5CF6, #7C3AED)',
];

function parseTrDate(raw: unknown): string {
  if (!raw) return '';
  const str = String(raw).trim();
  const m = str.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (!isNaN(Number(str))) {
    try {
      const d = XLSXStyle.SSF.parse_date_code(Number(str));
      if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    } catch { /* ignore */ }
  }
  return '';
}

const TR_CHAR_MAP: Record<string, string> = { 'İ': 'i', 'I': 'i', 'ı': 'i', 'Ğ': 'g', 'ğ': 'g', 'Ü': 'u', 'ü': 'u', 'Ş': 's', 'ş': 's', 'Ö': 'o', 'ö': 'o', 'Ç': 'c', 'ç': 'c' };
const TR_CHARS_RE = /[İIıĞğÜüŞşÖöÇç]/g;

function normalize(s: unknown): string {
  return String(s ?? '').trim().replace(TR_CHARS_RE, c => TR_CHAR_MAP[c] ?? c).toLowerCase().replace(/\s+/g, ' ');
}

function strictNorm(s: unknown): string {
  return normalize(s).replace(/[.\-,;:'"()[\]/\\&@#!?]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenSet(normalized: string): Set<string> {
  return new Set(normalized.split(' ').filter(t => t.length >= 2));
}

interface ImportResult {
  successCount: number;
  duplicateCount: number;
  errorCount: number;
  rows: { row: number; adSoyad: string; status: 'success' | 'duplicate' | 'error'; message: string }[];
}

export default function PersonellerPage() {
  const { personeller, firmalar, addPersonel, updatePersonel, deletePersonel, addToast, quickCreate, setQuickCreate, getPersonelFoto, setPersonelFoto, refreshData, dataLoading } = useApp();
  const { canCreate, canEdit, canDelete, isReadOnly, canViewSensitiveData } = usePermissions();

  const [search, setSearch] = useState('');
  const [firmaFilter, setFirmaFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [kartvizitId, setKartvizitId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyPersonel });
  const [pendingFotoFile, setPendingFotoFile] = useState<File | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  // Toplu silme state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  useEffect(() => {
    if (quickCreate === 'personeller') {
      setForm({ ...emptyPersonel }); setEditingId(null); setFormOpen(true); setQuickCreate(null);
    }
  }, [quickCreate, setQuickCreate]);

  const handleExcelExport = () => {
    const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('tr-TR') : '-';
    const aktif = filtered;
    const wb = XLSXStyle.utils.book_new();
    const tarih = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
    const aktifSayisi = aktif.filter(p => p.durum === 'Aktif').length;
    const pasifSayisi = aktif.filter(p => p.durum === 'Pasif').length;
    const ayrildiSayisi = aktif.filter(p => p.durum === 'Ayrıldı').length;

    // ── Stil tanımları ──
    const HEADER_BG = '1E293B'; const HEADER_FG = 'FFFFFF'; const TITLE_BG = '0F172A';
    const ROW_ALT = 'F1F5F9'; const ROW_NORMAL = 'FFFFFF'; const BORDER_COLOR = 'CBD5E1';
    const thinB = { top: { style: 'thin', color: { rgb: BORDER_COLOR } }, bottom: { style: 'thin', color: { rgb: BORDER_COLOR } }, left: { style: 'thin', color: { rgb: BORDER_COLOR } }, right: { style: 'thin', color: { rgb: BORDER_COLOR } } };
    const medB = { top: { style: 'medium', color: { rgb: '94A3B8' } }, bottom: { style: 'medium', color: { rgb: '94A3B8' } }, left: { style: 'medium', color: { rgb: '94A3B8' } }, right: { style: 'medium', color: { rgb: '94A3B8' } } };
    const titleS = { font: { bold: true, sz: 13, color: { rgb: HEADER_FG }, name: 'Calibri' }, fill: { fgColor: { rgb: TITLE_BG } }, alignment: { horizontal: 'left', vertical: 'center' }, border: medB };
    const headerS = { font: { bold: true, sz: 10, color: { rgb: HEADER_FG }, name: 'Calibri' }, fill: { fgColor: { rgb: HEADER_BG } }, alignment: { horizontal: 'center', vertical: 'center' }, border: thinB };
    const subHeaderS = { font: { bold: true, sz: 10, color: { rgb: HEADER_FG }, name: 'Calibri' }, fill: { fgColor: { rgb: '334155' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: thinB };
    const cellS = (ri: number, align: 'left' | 'center' | 'right' = 'left') => ({ font: { sz: 10, color: { rgb: '1E293B' }, name: 'Calibri' }, fill: { fgColor: { rgb: ri % 2 === 0 ? ROW_NORMAL : ROW_ALT } }, alignment: { horizontal: align, vertical: 'center', wrapText: true }, border: thinB });
    const numS = (ri: number) => ({ font: { sz: 10, color: { rgb: '64748B' }, name: 'Calibri' }, fill: { fgColor: { rgb: ri % 2 === 0 ? ROW_NORMAL : ROW_ALT } }, alignment: { horizontal: 'center', vertical: 'center' }, border: thinB });
    const totalS = { font: { bold: true, sz: 10, color: { rgb: HEADER_FG }, name: 'Calibri' }, fill: { fgColor: { rgb: '334155' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: medB };
    const sumValS = { font: { bold: true, sz: 11, color: { rgb: '1E40AF' }, name: 'Calibri' }, fill: { fgColor: { rgb: 'EFF6FF' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: thinB };
    const statusS = (s: string) => {
      const sl = s.toLowerCase();
      let fg = '64748B'; let bg = 'F1F5F9';
      if (sl === 'aktif') { fg = '16A34A'; bg = 'DCFCE7'; }
      else if (sl === 'pasif') { fg = 'D97706'; bg = 'FEF3C7'; }
      else if (sl === 'ayrıldı') { fg = 'DC2626'; bg = 'FEE2E2'; }
      return { font: { bold: true, sz: 10, color: { rgb: fg }, name: 'Calibri' }, fill: { fgColor: { rgb: bg } }, alignment: { horizontal: 'center', vertical: 'center' }, border: thinB };
    };

    // ── Sayfa 1: Personel Listesi ──
    const COLS1 = ['#', 'Ad Soyad', 'TC Kimlik No', 'Telefon', 'E-posta', 'Doğum Tarihi', 'İşe Giriş Tarihi', 'Görev / Unvan', 'Departman', 'Firma', 'Durum', 'Kan Grubu', 'Acil Durum Kişisi', 'Acil Durum Tel.', 'Adres'];
    const dataRows1 = aktif.map((p, i) => {
      const firma = firmalar.find(f => f.id === p.firmaId);
      return [i + 1, p.adSoyad, p.tc || '-', p.telefon || '-', p.email || '-', fmtDate(p.dogumTarihi), fmtDate(p.iseGirisTarihi), p.gorev || '-', p.departman || '-', firma?.ad || '-', p.durum, p.kanGrubu || '-', p.acilKisi || '-', p.acilTelefon || '-', p.adres || '-'];
    });
    const summaryRow = ['Toplam', 'Aktif', 'Pasif', 'Ayrıldı', '', '', '', '', '', '', '', '', '', '', ''];
    const summaryVal = [aktif.length, aktifSayisi, pasifSayisi, ayrildiSayisi, '', '', '', '', '', '', '', '', '', '', ''];
    const ws1Rows = [
      [`ISG PERSONEL LİSTESİ RAPORU — ${new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}`, ...Array(COLS1.length - 1).fill('')],
      summaryRow,
      summaryVal,
      COLS1,
      ...dataRows1,
    ];
    const ws1 = XLSXStyle.utils.aoa_to_sheet(ws1Rows);
    if (!ws1['!merges']) ws1['!merges'] = [];
    ws1['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: COLS1.length - 1 } });
    ws1Rows.forEach((row, ri) => {
      (row as (string | number)[]).forEach((val, ci) => {
        const addr = XLSXStyle.utils.encode_cell({ r: ri, c: ci });
        if (!ws1[addr]) ws1[addr] = { v: val ?? '', t: typeof val === 'number' ? 'n' : 's' };
        let s: object = cellS(ri - 4);
        if (ri === 0) s = titleS;
        else if (ri === 1) s = subHeaderS;
        else if (ri === 2) s = sumValS;
        else if (ri === 3) s = headerS;
        else {
          const dataRi = ri - 4;
          if (ci === 0) s = numS(dataRi);
          else if (ci === 10) s = statusS(String(val ?? ''));
          else if (ci >= 5 && ci <= 6) s = cellS(dataRi, 'center');
          else s = cellS(dataRi);
        }
        (ws1[addr] as XLSXStyle.CellObject).s = s;
      });
    });
    ws1['!cols'] = [{ wch: 4 }, { wch: 26 }, { wch: 14 }, { wch: 16 }, { wch: 28 }, { wch: 14 }, { wch: 16 }, { wch: 22 }, { wch: 18 }, { wch: 26 }, { wch: 10 }, { wch: 10 }, { wch: 22 }, { wch: 16 }, { wch: 36 }];
    if (!ws1['!rows']) ws1['!rows'] = [];
    (ws1['!rows'] as XLSXStyle.RowInfo[])[0] = { hpt: 30 };
    (ws1['!rows'] as XLSXStyle.RowInfo[])[1] = { hpt: 22 };
    (ws1['!rows'] as XLSXStyle.RowInfo[])[2] = { hpt: 22 };
    (ws1['!rows'] as XLSXStyle.RowInfo[])[3] = { hpt: 24 };
    XLSXStyle.utils.book_append_sheet(wb, ws1, 'Personel Listesi');

    // ── Sayfa 2: Firma Bazlı Özet ──
    const firmaOzet = firmalar.filter(f => !f.silinmis).map(f => {
      const fps = aktif.filter(p => p.firmaId === f.id);
      return [f.ad, fps.length, fps.filter(p => p.durum === 'Aktif').length, fps.filter(p => p.durum === 'Pasif').length, fps.filter(p => p.durum === 'Ayrıldı').length];
    }).filter(r => (r[1] as number) > 0).sort((a, b) => (b[1] as number) - (a[1] as number));
    const COLS2 = ['Firma Adı', 'Toplam', 'Aktif', 'Pasif', 'Ayrıldı'];
    const ws2Rows = [
      ['FİRMA BAZLI PERSONEL ÖZETİ', '', '', '', ''],
      COLS2,
      ...firmaOzet,
      ['TOPLAM', aktif.length, aktifSayisi, pasifSayisi, ayrildiSayisi],
      ['', '', '', '', ''],
      ['Rapor Tarihi', new Date().toLocaleDateString('tr-TR'), '', '', ''],
    ];
    const ws2 = XLSXStyle.utils.aoa_to_sheet(ws2Rows);
    if (!ws2['!merges']) ws2['!merges'] = [];
    ws2['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } });
    ws2Rows.forEach((row, ri) => {
      (row as (string | number)[]).forEach((val, ci) => {
        const addr = XLSXStyle.utils.encode_cell({ r: ri, c: ci });
        if (!ws2[addr]) ws2[addr] = { v: val ?? '', t: typeof val === 'number' ? 'n' : 's' };
        const totalRowIdx = 2 + firmaOzet.length;
        let s: object = cellS(ri - 2);
        if (ri === 0) s = titleS;
        else if (ri === 1) s = headerS;
        else if (ri === totalRowIdx) s = totalS;
        else if (ri > 1 && ri < totalRowIdx) {
          const dataRi = ri - 2;
          if (ci === 0) s = cellS(dataRi);
          else s = { ...cellS(dataRi, 'center'), font: { bold: true, sz: 11, color: { rgb: '1E293B' }, name: 'Calibri' }, fill: { fgColor: { rgb: dataRi % 2 === 0 ? ROW_NORMAL : ROW_ALT } }, border: thinB };
        }
        (ws2[addr] as XLSXStyle.CellObject).s = s;
      });
    });
    ws2['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
    if (!ws2['!rows']) ws2['!rows'] = [];
    (ws2['!rows'] as XLSXStyle.RowInfo[])[0] = { hpt: 28 };
    (ws2['!rows'] as XLSXStyle.RowInfo[])[1] = { hpt: 22 };
    XLSXStyle.utils.book_append_sheet(wb, ws2, 'Firma Özeti');

    // ── Sayfa 3: Yaklaşan Yıldönümleri ──
    const today = new Date();
    const yildonumleri = aktif.filter(p => p.iseGirisTarihi && p.durum === 'Aktif').map(p => {
      const giris = new Date(p.iseGirisTarihi);
      const thisYear = new Date(today.getFullYear(), giris.getMonth(), giris.getDate());
      if (thisYear < today) thisYear.setFullYear(today.getFullYear() + 1);
      const diff = Math.ceil((thisYear.getTime() - today.getTime()) / 86400000);
      const yil = today.getFullYear() - giris.getFullYear();
      const firma = firmalar.find(f => f.id === p.firmaId);
      return { p, diff, yil, firma };
    }).filter(x => x.diff <= 30).sort((a, b) => a.diff - b.diff);
    const COLS3 = ['Ad Soyad', 'Firma', 'Görev', 'İşe Giriş', 'Yıldönümü', 'Kalan Gün', 'Çalışma Yılı'];
    const yilData = yildonumleri.map(x => [x.p.adSoyad, x.firma?.ad || '-', x.p.gorev || '-', fmtDate(x.p.iseGirisTarihi), `${new Date(x.p.iseGirisTarihi).getDate()}.${new Date(x.p.iseGirisTarihi).getMonth() + 1}`, x.diff === 0 ? 'BUGÜN' : `${x.diff} gün`, `${x.yil}. yıl`]);
    const ws3Rows = [
      ['YAKLAŞAN İŞE GİRİŞ YILDÖNÜMLERİ (30 Gün İçinde)', '', '', '', '', '', ''],
      COLS3,
      ...(yilData.length > 0 ? yilData : [['30 gün içinde yıldönümü bulunmuyor.', '', '', '', '', '', '']]),
    ];
    const ws3 = XLSXStyle.utils.aoa_to_sheet(ws3Rows);
    if (!ws3['!merges']) ws3['!merges'] = [];
    ws3['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: COLS3.length - 1 } });
    ws3Rows.forEach((row, ri) => {
      (row as (string | number)[]).forEach((val, ci) => {
        const addr = XLSXStyle.utils.encode_cell({ r: ri, c: ci });
        if (!ws3[addr]) ws3[addr] = { v: val ?? '', t: typeof val === 'number' ? 'n' : 's' };
        let s: object = cellS(ri - 2);
        if (ri === 0) s = titleS;
        else if (ri === 1) s = headerS;
        else {
          const dataRi = ri - 2;
          if (ci === 5) {
            const v = String(val ?? '');
            s = v === 'BUGÜN' ? { font: { bold: true, sz: 10, color: { rgb: '16A34A' }, name: 'Calibri' }, fill: { fgColor: { rgb: 'DCFCE7' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: thinB } : cellS(dataRi, 'center');
          } else if (ci >= 3) s = cellS(dataRi, 'center');
          else s = cellS(dataRi);
        }
        (ws3[addr] as XLSXStyle.CellObject).s = s;
      });
    });
    ws3['!cols'] = [{ wch: 26 }, { wch: 24 }, { wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
    if (!ws3['!rows']) ws3['!rows'] = [];
    (ws3['!rows'] as XLSXStyle.RowInfo[])[0] = { hpt: 28 };
    (ws3['!rows'] as XLSXStyle.RowInfo[])[1] = { hpt: 22 };
    XLSXStyle.utils.book_append_sheet(wb, ws3, 'Yıldönümleri');

    const xlsxData = XLSXStyle.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([xlsxData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${new Date().toLocaleDateString('tr-TR')} Personel Listesi Raporu.xlsx`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
    addToast(`${aktif.length} personel Excel olarak indirildi.`, 'success');
  };

  const handleDownloadTemplate = () => {
    const HEADER_BG = '1E293B'; const HEADER_FG = 'FFFFFF'; const BC = 'CBD5E1';
    const thinB = { top: { style: 'thin', color: { rgb: BC } }, bottom: { style: 'thin', color: { rgb: BC } }, left: { style: 'thin', color: { rgb: BC } }, right: { style: 'thin', color: { rgb: BC } } };
    const headerS = { font: { bold: true, sz: 10, color: { rgb: HEADER_FG }, name: 'Calibri' }, fill: { fgColor: { rgb: HEADER_BG } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: thinB };
    const cellS = { font: { sz: 10, color: { rgb: '1E293B' }, name: 'Calibri' }, fill: { fgColor: { rgb: 'FFFFFF' } }, alignment: { horizontal: 'left', vertical: 'center', wrapText: true }, border: thinB };
    const noteS = { font: { sz: 9, color: { rgb: '64748B' }, italic: true, name: 'Calibri' }, fill: { fgColor: { rgb: 'F8FAFC' } }, alignment: { horizontal: 'left', vertical: 'center', wrapText: true }, border: thinB };

    // Örnek satır: sistemdeki ilk aktif firmayı kullan, yoksa boş bırak
    const ilkFirma = firmalar.find(f => !f.silinmis)?.ad ?? 'Sistemdeki Firma Adı';
    const example = ['Ahmet Yılmaz', '12345678901', '05551234567', 'ahmet@email.com', '15.05.1990', '01.01.2020', 'Operatör', 'Üretim', ilkFirma, 'Aktif', 'A+', 'Mehmet Yılmaz', '05301234567', 'İstanbul, Kadıköy'];
    const notlar = [
      ['NOTLAR:', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['1. Tarih formatı: GG.AA.YYYY (örnek: 15.01.2025)', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['2. Durum değerleri: Aktif / Pasif / Ayrıldı', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['3. Firma adı sistemdeki kayıtla birebir eşleşmelidir', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['4. TC Kimlik No 11 haneli olmalıdır', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ];

    const wb = XLSXStyle.utils.book_new();
    const ws = XLSXStyle.utils.aoa_to_sheet([[...EXCEL_COLUMNS], example, ...notlar]);

    // Stilleri uygula
    EXCEL_COLUMNS.forEach((_, ci) => {
      const hAddr = XLSXStyle.utils.encode_cell({ r: 0, c: ci });
      const eAddr = XLSXStyle.utils.encode_cell({ r: 1, c: ci });
      if (ws[hAddr]) (ws[hAddr] as XLSXStyle.CellObject).s = headerS;
      if (ws[eAddr]) (ws[eAddr] as XLSXStyle.CellObject).s = cellS;
    });

    // Not satırları
    notlar.forEach((row, ri) => {
      row.forEach((_, ci) => {
        const addr = XLSXStyle.utils.encode_cell({ r: ri + 2, c: ci });
        if (ws[addr]) (ws[addr] as XLSXStyle.CellObject).s = noteS;
      });
    });

    // Birleştirmeler
    if (!ws['!merges']) ws['!merges'] = [];
    notlar.forEach((_, ri) => {
      ws['!merges']!.push({ s: { r: ri + 2, c: 0 }, e: { r: ri + 2, c: EXCEL_COLUMNS.length - 1 } });
    });

    ws['!cols'] = [{ wch: 26 }, { wch: 15 }, { wch: 16 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 20 }, { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 24 }, { wch: 18 }, { wch: 36 }];
    if (!ws['!rows']) ws['!rows'] = [];
    (ws['!rows'] as XLSXStyle.RowInfo[])[0] = { hpt: 28 };
    (ws['!rows'] as XLSXStyle.RowInfo[])[1] = { hpt: 22 };

    XLSXStyle.utils.book_append_sheet(wb, ws, 'Personel Sablonu');
    const xlsxData = XLSXStyle.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([xlsxData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `${new Date().toLocaleDateString('tr-TR')} Personel Şablonu.xlsx`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
    addToast('Bos sablon indirildi.', 'success');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) { addToast('Lütfen .xlsx, .xls veya .csv uzantılı dosya seçin.', 'error'); return; }
    void processImport(file);
    e.target.value = '';
  };

  const processImport = async (file: File) => {
    setImportLoading(true);
    try {
      // Global utility: boş satırları, not satırlarını ve header'ı otomatik filtreler
      const { rows: dataRows, validCount } = await parseImportFile(file);

      if (validCount === 0) {
        addToast('Excel dosyası boş veya yalnızca başlık/not satırı içeriyor.', 'warning');
        return;
      }

      // Header satırını ayrıca oku — colIndex için
      const rawBuffer = await file.arrayBuffer();
      const wb = XLSXStyle.read(new Uint8Array(rawBuffer), { type: 'array', cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const allRows = XLSXStyle.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as unknown[][];
      const headerRow = (allRows[0] as unknown[]).map(h => String(h ?? '').trim());

      // Header bazlı kolon eşleştirme — normalize ile Türkçe karakter uyumu
      const colIndex: Record<string, number> = {};
      EXCEL_COLUMNS.forEach(col => {
        const idx = headerRow.findIndex(h => normalize(h) === normalize(col));
        colIndex[col] = idx;
      });

      // Kolon bulunamadıysa uyar
      const missingCols = EXCEL_COLUMNS.filter(c => colIndex[c] < 0);
      if (missingCols.length > 0) {
        console.warn('[Import] Bulunamayan kolonlar:', missingCols);
      }

      const aktivFirmalar = firmalar.filter(f => !f.silinmis);
      const firmaMapSoft = new Map<string, string>(aktivFirmalar.map(f => [normalize(f.ad), f.id]));
      const firmaMapStrict = new Map<string, string>(aktivFirmalar.map(f => [strictNorm(f.ad), f.id]));
      const firmaNormList = aktivFirmalar.map(f => ({ ad: f.ad, id: f.id, soft: normalize(f.ad), strict: strictNorm(f.ad), tokens: tokenSet(strictNorm(f.ad)) }));

      const findFirmaId = (raw: string): { id: string | null; hint: string } => {
        const softRaw = normalize(raw); const strictRaw = strictNorm(raw);
        if (!softRaw) return { id: null, hint: '' };

        // 1. Birebir eşleşme (normalize edilmiş)
        const s1 = firmaMapSoft.get(softRaw); if (s1) return { id: s1, hint: '' };
        // 2. Noktalama temizlenmiş eşleşme
        const s2 = firmaMapStrict.get(strictRaw); if (s2) return { id: s2, hint: '' };

        // 3. Kısmi içerme eşleşmesi (her iki yönde)
        const partial = firmaNormList.find(f => f.strict.includes(strictRaw) || strictRaw.includes(f.strict));
        if (partial) return { id: partial.id, hint: `(Eşleşti: "${partial.ad}")` };

        // 4. Token bazlı benzerlik skoru
        const inputTokens = tokenSet(strictRaw);
        if (inputTokens.size > 0) {
          const scored = firmaNormList.map(f => {
            let matched = 0;
            inputTokens.forEach(t => { if (f.tokens.has(t)) matched++; });
            // Ters yön: firma tokenları input'ta var mı?
            let reverseMatched = 0;
            f.tokens.forEach(t => { if (inputTokens.has(t)) reverseMatched++; });
            const score = Math.max(
              matched / Math.max(inputTokens.size, 1),
              reverseMatched / Math.max(f.tokens.size, 1),
            );
            return { ...f, score };
          }).filter(f => f.score >= 0.3).sort((a, b) => b.score - a.score);
          if (scored.length > 0 && scored[0].score >= 0.5) return { id: scored[0].id, hint: `(Eşleşti: "${scored[0].ad}")` };
        }

        // 5. Bulunamadı — sistemdeki firmaları göster
        const firmaListesi = aktivFirmalar.slice(0, 5).map(f => `"${f.ad}"`).join(', ');
        return { id: null, hint: `Sistemdeki firmalar: ${firmaListesi}` };
      };

      const durumMap: Record<string, 'Aktif' | 'Pasif' | 'Ayrıldı'> = { aktif: 'Aktif', active: 'Aktif', pasif: 'Pasif', inactive: 'Pasif', ayrildi: 'Ayrıldı', ayrilmis: 'Ayrıldı', left: 'Ayrıldı' };
      const kanMap: Record<string, string> = {};
      KAN_GRUPLARI.forEach(k => { kanMap[normalize(k)] = k; });
      Object.assign(kanMap, { 'a rh+': 'A+', 'a rh-': 'A-', 'b rh+': 'B+', 'b rh-': 'B-', 'ab rh+': 'AB+', 'ab rh-': 'AB-', '0 rh+': '0+', '0 rh-': '0-' });

      const existingTCs = new Set(personeller.filter(p => !p.silinmis && p.tc).map(p => p.tc.replace(/\D/g, '')));
      const result: ImportResult = { successCount: 0, duplicateCount: 0, errorCount: 0, rows: [] };

      // dataRows: global utility'den gelen temiz satırlar (boş + not satırları filtrelenmiş)
      dataRows.forEach((row, idx) => {
        const rowNum = idx + 2; // header = satır 1, data = satır 2+

        // Header bazlı get: colIndex ile kolon bul, yoksa index bazlı fallback
        const get = (col: typeof EXCEL_COLUMNS[number]): string => {
          const ci = colIndex[col];
          if (ci !== undefined && ci >= 0) return String(row[ci] ?? '').trim();
          // Fallback: EXCEL_COLUMNS sırasına göre index
          const fallbackIdx = EXCEL_COLUMNS.indexOf(col);
          return fallbackIdx >= 0 ? String(row[fallbackIdx] ?? '').trim() : '';
        };

        const adSoyad = get('Ad Soyad');
        const tcRaw = get('TC Kimlik No');
        const firmaAdi = get('Firma Adı');

        // Tamamen boş satır — atla
        if (!adSoyad && !tcRaw && !firmaAdi) return;

        const errors: string[] = [];
        if (!adSoyad) errors.push('"Ad Soyad" sütunu boş — bu alan zorunludur');

        let firmaId: string | null = null;
        if (!firmaAdi) {
          errors.push('"Firma Adı" sütunu boş — bu alan zorunludur');
        } else {
          const match = findFirmaId(firmaAdi);
          firmaId = match.id;
          if (!firmaId) errors.push(`"Firma Adı": "${firmaAdi}" sistemde bulunamadı. ${match.hint}`);
        }

        const tc = tcRaw.replace(/\D/g, '');
        if (tcRaw && tc.length !== 11) errors.push(`"TC Kimlik No": "${tcRaw}" geçersiz (${tc.length} rakam — 11 olmalı)`);

        if (errors.length > 0) {
          result.errorCount++;
          result.rows.push({ row: rowNum, adSoyad: adSoyad || '(İsimsiz)', status: 'error', message: errors.join(' • ') });
          return;
        }

        if (tc && existingTCs.has(tc)) {
          result.duplicateCount++;
          result.rows.push({ row: rowNum, adSoyad, status: 'duplicate', message: `TC No ${tc} zaten sistemde kayıtlı` });
          return;
        }

        const durum: 'Aktif' | 'Pasif' | 'Ayrıldı' = durumMap[normalize(get('Durum'))] ?? 'Aktif';
        const kanGrubu = kanMap[normalize(get('Kan Grubu'))] ?? '';

        addPersonel({
          adSoyad: adSoyad.trim(), tc, telefon: get('Telefon'), email: get('E-posta'),
          dogumTarihi: parseTrDate(get('Doğum Tarihi')), iseGirisTarihi: parseTrDate(get('İşe Giriş Tarihi')),
          gorev: get('Görev'), departman: get('Departman'), firmaId: firmaId!,
          durum, kanGrubu, acilKisi: get('Acil Durum Kişisi'),
          acilTelefon: get('Acil Durum Telefonu'), adres: get('Adres'),
        });
        if (tc) existingTCs.add(tc);
        result.successCount++;
        result.rows.push({ row: rowNum, adSoyad, status: 'success', message: `Başarıyla eklendi${durum !== 'Aktif' ? ` (Durum: ${durum})` : ''}` });
      });

      setImportResult(result);
      if (result.successCount > 0) addToast(`${result.successCount} personel başarıyla içe aktarıldı.`, 'success');
      if (result.duplicateCount > 0) addToast(`${result.duplicateCount} tekrar kayıt atlandı.`, 'warning');
      if (result.errorCount > 0) addToast(`${result.errorCount} satırda hata — detayları inceleyin.`, 'error');
    } catch (err) {
      console.error('[Import] Hata:', err);
      addToast('Excel dosyası okunurken hata oluştu.', 'error');
    } finally {
      setImportLoading(false);
    }
  };

  const filtered = useMemo(() => personeller
    .filter(p => {
      if (p.silinmis) return false;
      const q = search.toLowerCase();
      return (!search || p.adSoyad.toLowerCase().includes(q) || p.tc.includes(q) || p.gorev.toLowerCase().includes(q))
        && (!firmaFilter || p.firmaId === firmaFilter)
        && (!statusFilter || p.durum === statusFilter);
    })
    .sort((a, b) => {
      const ta = a.olusturmaTarihi ?? '';
      const tb = b.olusturmaTarihi ?? '';
      return tb.localeCompare(ta);
    }), [personeller, search, firmaFilter, statusFilter]);

  const allSelected = filtered.length > 0 && filtered.every(p => selected.has(p.id));
  const toggleAll = () => allSelected ? setSelected(new Set()) : setSelected(new Set(filtered.map(p => p.id)));
  const toggleOne = (id: string) => setSelected(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const handleBulkDelete = () => {
    selected.forEach(id => deletePersonel(id));
    addToast(`${selected.size} personel silindi.`, 'info');
    setSelected(new Set());
    setBulkDeleteConfirm(false);
  };

  const getFirmaAd = (id: string) => firmalar.find(f => f.id === id)?.ad || '—';

  const openAdd = () => { setForm({ ...emptyPersonel }); setEditingId(null); setFormOpen(true); setQuickCreate(null); };
  const openEdit = (p: Personel) => { setForm({ ...p }); setEditingId(p.id); setPendingFotoFile(null); setFormOpen(true); };

  const handleSave = async () => {
    if (saving) return;
    if (!form.adSoyad.trim()) { addToast('Ad Soyad zorunludur.', 'error'); return; }
    if (!form.firmaId) { addToast('Firma seçimi zorunludur.', 'error'); return; }
    setSaving(true);
    try {
      if (editingId) {
        updatePersonel(editingId, form);
        if (pendingFotoFile) setPersonelFoto(editingId, pendingFotoFile);
        addToast('Personel güncellendi.', 'success');
      } else {
        const newP = addPersonel(form);
        if (pendingFotoFile) setPersonelFoto(newP.id, pendingFotoFile);
        addToast('Personel eklendi.', 'success');
      }
      setFormOpen(false);
      setPendingFotoFile(null);
    } finally {
      setSaving(false);
    }
  };

  const handleFotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { addToast('Lütfen bir resim dosyası seçin.', 'error'); return; }
    setPendingFotoFile(file);
    e.target.value = '';
  };

  const handleDelete = (id: string) => {
    deletePersonel(id);
    setDeleteConfirm(null);
    // Silinen kayıt detay modalda açıksa kapat
    if (detailId === id) setDetailId(null);
    addToast('Personel silindi.', 'info');
  };

  const f = (field: keyof typeof form) => form[field] as string;
  const set = (field: keyof typeof form, value: string) => setForm(prev => ({ ...prev, [field]: value }));
  const aktifCount = personeller.filter(p => !p.silinmis && p.durum === 'Aktif').length;
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    if (refreshing || dataLoading) return;
    setRefreshing(true);
    try { await refreshData(); addToast('Veriler güncellendi.', 'success'); }
    finally { setRefreshing(false); }
  };

  const statusStyle = (s: ImportResult['rows'][0]['status']) => {
    if (s === 'success') return { color: '#34D399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.2)', icon: 'ri-checkbox-circle-line' };
    if (s === 'duplicate') return { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)', icon: 'ri-error-warning-line' };
    return { color: '#EF4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)', icon: 'ri-close-circle-line' };
  };

  return (
    <div className="space-y-4">
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />
      <input ref={fotoInputRef} type="file" accept="image/*" onChange={handleFotoSelect} className="hidden" />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Personeller</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{personeller.filter(p => !p.silinmis).length} personel kayıtlı</span>
            <span className="w-1 h-1 rounded-full" style={{ background: 'var(--border-main)' }} />
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,182,212,0.1)', color: '#06B6D4' }}>{aktifCount} aktif</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleRefresh} disabled={refreshing || dataLoading} className="btn-secondary whitespace-nowrap" style={{ fontSize: '12px', padding: '6px 12px' }}>
            <i className={`ri-refresh-line text-xs ${refreshing ? 'animate-spin' : ''}`} />{refreshing ? 'Yenileniyor...' : 'Yenile'}
          </button>
          <button onClick={handleDownloadTemplate} className="btn-secondary whitespace-nowrap" style={{ fontSize: '12px', padding: '6px 12px' }}>
            <i className="ri-download-2-line text-xs" />Şablon İndir
          </button>
          <button onClick={() => fileInputRef.current?.click()} disabled={importLoading} className="btn-secondary whitespace-nowrap" style={{ fontSize: '12px', padding: '6px 12px' }}>
            {importLoading ? <><i className="ri-loader-4-line animate-spin text-xs" />Yükleniyor...</> : <><i className="ri-upload-2-line text-xs" />Excel İçe Aktar</>}
          </button>
          <button onClick={handleExcelExport} className="btn-secondary whitespace-nowrap" style={{ fontSize: '12px', padding: '6px 12px' }}>
            <i className="ri-file-excel-2-line text-xs" />Excel İndir
          </button>
          {canCreate && (
            <button onClick={openAdd} className="btn-primary whitespace-nowrap" style={{ fontSize: '12.5px', padding: '7px 14px' }}>
              <i className="ri-user-add-line text-sm" />Yeni Personel Ekle
            </button>
          )}
        </div>
      </div>

      {isReadOnly && (
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl" style={{ background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.15)' }}>
          <i className="ri-eye-line text-xs flex-shrink-0" style={{ color: '#06B6D4' }} />
          <p className="text-[12px]" style={{ color: '#06B6D4' }}><strong>Denetçi modunda görüntülüyorsunuz</strong> — Bu sayfada yalnızca okuma yetkisine sahipsiniz.</p>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2.5 px-4 py-3 rounded-xl isg-card">
        <div className="relative flex-1 min-w-[180px]">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ad, TC kimlik veya görev ara..." className="isg-input pl-8 text-[12.5px]" />
        </div>
        <select value={firmaFilter} onChange={e => setFirmaFilter(e.target.value)} className="isg-input text-[12.5px]" style={{ width: 'auto', minWidth: '150px' }}>
          <option value="">Tüm Firmalar</option>
          {firmalar.filter(fi => !fi.silinmis).map(fi => <option key={fi.id} value={fi.id}>{fi.ad}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="isg-input text-[12.5px]" style={{ width: 'auto', minWidth: '130px' }}>
          <option value="">Tüm Durumlar</option>
          <option value="Aktif">Aktif</option>
          <option value="Pasif">Pasif</option>
          <option value="Ayrıldı">Ayrıldı</option>
        </select>
        {(search || firmaFilter || statusFilter) && (
          <button onClick={() => { setSearch(''); setFirmaFilter(''); setStatusFilter(''); }} className="btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }}>
            <i className="ri-filter-off-line text-xs" /> Temizle
          </button>
        )}
        <div className="ml-auto flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <i className="ri-list-check text-xs" />
          {filtered.length} sonuç
        </div>
      </div>

      {/* Toplu seçim aksiyonları */}
      {selected.size > 0 && canDelete && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <span className="text-sm font-semibold" style={{ color: '#F87171' }}>{selected.size} personel seçildi</span>
          <button
            onClick={() => setBulkDeleteConfirm(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)' }}
          >
            <i className="ri-delete-bin-line" /> Seçilenleri Sil
          </button>
          <button onClick={() => setSelected(new Set())} className="text-xs px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap ml-auto" style={{ background: 'rgba(100,116,139,0.1)', color: '#94A3B8' }}>
            Seçimi Kaldır
          </button>
        </div>
      )}

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <div className="rounded-xl p-14 flex flex-col items-center text-center isg-card">
          <div className="w-14 h-14 flex items-center justify-center rounded-xl mb-3" style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)' }}>
            <i className="ri-team-line text-2xl" style={{ color: 'var(--text-faint)' }} />
          </div>
          <p className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>
            {search || firmaFilter || statusFilter ? 'Sonuç bulunamadı' : 'Henüz personel eklenmedi'}
          </p>
          {firmalar.filter(f => !f.silinmis).length === 0 && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Önce bir firma eklemeniz gerekmektedir.</p>}
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden isg-card">
          <div className="overflow-x-auto">
            <table className="w-full table-premium">
              <thead>
                <tr>
                  {canDelete && (
                    <th className="w-10 text-center">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} className="cursor-pointer" />
                    </th>
                  )}
                  <th className="text-left">Personel</th>
                  <th className="text-left hidden md:table-cell">Firma</th>
                  <th className="text-left hidden lg:table-cell">Görev / Departman</th>
                  {canViewSensitiveData && <th className="text-left hidden lg:table-cell">İletişim</th>}
                  <th className="text-left">Durum</th>
                  <th className="w-28 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const foto = getPersonelFoto(p.id);
                  return (
                    <tr key={p.id} style={{ background: selected.has(p.id) ? 'rgba(239,68,68,0.04)' : undefined }}>
                      {canDelete && (
                        <td className="text-center">
                          <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} className="cursor-pointer" />
                        </td>
                      )}
                      <td>
                        <div className="flex items-center gap-2.5">
                          <PersonelAvatar adSoyad={p.adSoyad} fotoUrl={foto} size="sm" />
                          <div>
                            <button onClick={() => setDetailId(p.id)} className="text-[12.5px] font-semibold hover:text-blue-400 transition-colors cursor-pointer block text-left" style={{ color: 'var(--text-primary)' }}>{p.adSoyad}</button>
                            {canViewSensitiveData
                              ? <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{p.tc || 'TC yok'}</p>
                              : <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-faint)' }}>—</p>
                            }
                          </div>
                        </div>
                      </td>
                      <td className="hidden md:table-cell"><p className="text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>{getFirmaAd(p.firmaId)}</p></td>
                      <td className="hidden lg:table-cell">
                        <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{p.gorev || '—'}</p>
                        <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-faint)' }}>{p.departman || ''}</p>
                      </td>
                      {canViewSensitiveData && (
                        <td className="hidden lg:table-cell"><p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{p.telefon || '—'}</p></td>
                      )}
                      <td><Badge label={p.durum} color={getPersonelStatusColor(p.durum)} /></td>
                      <td>
                        <div className="flex items-center gap-1 justify-end">
                          <ABtn icon="ri-contacts-book-2-line" color="#818CF8" onClick={() => setKartvizitId(p.id)} title="Kartvizit" />
                          <ABtn icon="ri-eye-line" color="#3B82F6" onClick={() => setDetailId(p.id)} title="Detay" />
                          {canEdit && <ABtn icon="ri-edit-line" color="#F59E0B" onClick={() => openEdit(p)} title="Düzenle" />}
                          {canDelete && <ABtn icon="ri-delete-bin-line" color="#EF4444" onClick={() => setDeleteConfirm(p.id)} title="Sil" />}
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

      {/* ── Form Modal ── */}
      <Modal open={formOpen} onClose={() => { setFormOpen(false); setPendingFotoFile(null); }} title={editingId ? 'Personel Düzenle' : 'Yeni Personel Ekle'} size="xl" icon="ri-user-line"
        footer={<><button onClick={() => setFormOpen(false)} className="btn-secondary">İptal</button><button onClick={handleSave} disabled={saving} className="btn-primary"><i className="ri-save-line" /> {saving ? 'Kaydediliyor...' : 'Kaydet'}</button></>}>
        <div className="space-y-5">

          {/* Bölüm 0: Profil Fotoğrafı */}
          <div className="form-section">
            <div className="form-section-header">
              <div className="form-section-icon" style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8' }}>
                <i className="ri-user-3-line text-sm" />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Profil Fotoğrafı</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>İsteğe bağlı — yüklenmezse baş harfler gösterilir</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                {(() => {
                  const previewUrl = pendingFotoFile ? URL.createObjectURL(pendingFotoFile) : null;
                  const displayFoto = previewUrl || (editingId ? getPersonelFoto(editingId) : null);
                  return <PersonelAvatar adSoyad={form.adSoyad || '?'} fotoUrl={displayFoto} size="lg" ring />;
                })()}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => fotoInputRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer transition-all whitespace-nowrap"
                  style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.22)', color: '#818CF8' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.22)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.12)'; }}
                >
                  <i className="ri-upload-2-line" />
                  {pendingFotoFile || (editingId && getPersonelFoto(editingId)) ? 'Fotoğrafı Değiştir' : 'Fotoğraf Yükle'}
                </button>
                {pendingFotoFile && (
                  <button
                    type="button"
                    onClick={() => setPendingFotoFile(null)}
                    className="flex items-center gap-1 text-xs font-medium px-2.5 py-2 rounded-lg cursor-pointer whitespace-nowrap"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.2)' }}
                  >
                    <i className="ri-close-line" /> Kaldır
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Bölüm 1: Temel Bilgiler */}
          <div className="form-section">
            <div className="form-section-header">
              <div className="form-section-icon" style={{ background: 'rgba(59,130,246,0.12)', color: '#60A5FA' }}>
                <i className="ri-id-card-line text-sm" />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Temel Bilgiler</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Kimlik ve iletişim bilgileri</p>
              </div>
            </div>
            <div className="form-grid-2">
              <FF label="Ad Soyad *" value={f('adSoyad')} onChange={v => set('adSoyad', v)} placeholder="Personelin tam adı" />
              <FF label="TC Kimlik No" value={f('tc')} onChange={v => set('tc', v)} placeholder="12345678901" />
              <FF label="Telefon" value={f('telefon')} onChange={v => set('telefon', v)} placeholder="0555 000 00 00" />
              <FF label="E-posta" value={f('email')} onChange={v => set('email', v)} placeholder="personel@email.com" type="email" />
              <FF label="Doğum Tarihi" value={f('dogumTarihi')} onChange={v => set('dogumTarihi', v)} type="date" />
              <FS label="Kan Grubu" value={f('kanGrubu')} onChange={v => set('kanGrubu', v)} options={['', ...KAN_GRUPLARI]} />
              <div className="col-span-2">
                <FF label="İkamet Adresi" value={f('adres')} onChange={v => set('adres', v)} placeholder="Açık adres" />
              </div>
            </div>
          </div>

          {/* Bölüm 2: İş Bilgileri */}
          <div className="form-section">
            <div className="form-section-header">
              <div className="form-section-icon" style={{ background: 'rgba(16,185,129,0.12)', color: '#34D399' }}>
                <i className="ri-briefcase-line text-sm" />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>İş Bilgileri</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Firma, görev ve çalışma durumu</p>
              </div>
            </div>
            <div className="form-grid-2">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Firma *</label>
                <select value={f('firmaId')} onChange={e => set('firmaId', e.target.value)} className="input-premium cursor-pointer">
                  <option value="">Firma Seçin...</option>
                  {firmalar.filter(fi => !fi.silinmis).map(firma => <option key={firma.id} value={firma.id}>{firma.ad}</option>)}
                </select>
                {firmalar.filter(fi => !fi.silinmis).length === 0 && (
                  <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: '#F59E0B' }}>
                    <i className="ri-error-warning-line" /> Önce firma eklemeniz gerekmektedir.
                  </p>
                )}
              </div>
              <FS label="Çalışma Durumu" value={f('durum')} onChange={v => set('durum', v)} options={['Aktif', 'Pasif', 'Ayrıldı']} />
              <FF label="Görev / Unvan" value={f('gorev')} onChange={v => set('gorev', v)} placeholder="Operatör, Mühendis..." />
              <FF label="Departman" value={f('departman')} onChange={v => set('departman', v)} placeholder="Üretim, Kalite..." />
              <FF label="İşe Giriş Tarihi" value={f('iseGirisTarihi')} onChange={v => set('iseGirisTarihi', v)} type="date" />
            </div>
          </div>

          {/* Bölüm 3: Acil Durum */}
          <div className="form-section">
            <div className="form-section-header">
              <div className="form-section-icon" style={{ background: 'rgba(239,68,68,0.12)', color: '#F87171' }}>
                <i className="ri-heart-pulse-line text-sm" />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Acil Durum</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Acil durumda ulaşılacak kişi bilgileri</p>
              </div>
            </div>
            <div className="form-grid-2">
              <FF label="Acil Durum Kişisi" value={f('acilKisi')} onChange={v => set('acilKisi', v)} placeholder="Yakınının adı soyadı" />
              <FF label="Acil Durum Telefonu" value={f('acilTelefon')} onChange={v => set('acilTelefon', v)} placeholder="0555 000 00 00" />
            </div>
          </div>

        </div>
      </Modal>

      <PersonelDetayModal personelId={detailId} onClose={() => setDetailId(null)} />

      <PersonelKartvizit personelId={kartvizitId} onClose={() => setKartvizitId(null)} />

      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Personeli Sil" size="sm" icon="ri-delete-bin-line"
        footer={<><button onClick={() => setDeleteConfirm(null)} className="btn-secondary">İptal</button><button onClick={() => handleDelete(deleteConfirm!)} className="btn-danger"><i className="ri-delete-bin-line" /> Evet, Sil</button></>}>
        <div className="py-2">
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl mb-4" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <i className="ri-error-warning-line text-xl" style={{ color: '#EF4444' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: '#E2E8F0' }}>Bu personeli silmek istediğinizden emin misiniz?</p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>Personel çöp kutusuna taşınacak, oradan geri yükleyebilirsiniz.</p>
        </div>
      </Modal>

      {/* Toplu Silme Onay Modal */}
      <Modal open={bulkDeleteConfirm} onClose={() => setBulkDeleteConfirm(false)} title="Toplu Silme Onayı" size="sm" icon="ri-delete-bin-2-line"
        footer={
          <>
            <button onClick={() => setBulkDeleteConfirm(false)} className="btn-secondary">İptal</button>
            <button onClick={handleBulkDelete} className="btn-danger">
              <i className="ri-delete-bin-line" /> {selected.size} Personeli Sil
            </button>
          </>
        }
      >
        <div className="py-2">
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl mb-4" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <i className="ri-error-warning-line text-xl" style={{ color: '#EF4444' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: '#E2E8F0' }}>
            <strong>{selected.size}</strong> personel çöp kutusuna taşınacak.
          </p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>Çöp kutusundan geri yükleyebilirsiniz.</p>
        </div>
      </Modal>

      <Modal open={!!importResult} onClose={() => setImportResult(null)} title="Excel İçe Aktarma Sonucu" size="xl" icon="ri-file-excel-2-line"
        footer={<button onClick={() => setImportResult(null)} className="btn-primary">Tamam</button>}>
        {importResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}>
                <p className="text-2xl font-bold" style={{ color: '#34D399' }}>{importResult.successCount}</p>
                <p className="text-xs font-medium mt-1" style={{ color: '#6EE7B7' }}>Başarılı</p>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <p className="text-2xl font-bold" style={{ color: '#F59E0B' }}>{importResult.duplicateCount}</p>
                <p className="text-xs font-medium mt-1" style={{ color: '#FCD34D' }}>Tekrar Kayıt</p>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <p className="text-2xl font-bold" style={{ color: '#EF4444' }}>{importResult.errorCount}</p>
                <p className="text-xs font-medium mt-1" style={{ color: '#FCA5A5' }}>Hatalı Satır</p>
              </div>
            </div>
            {importResult.rows.length > 0 && (
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {importResult.rows.map((r, i) => {
                  const st = statusStyle(r.status);
                  return (
                    <div key={i} className="flex items-start gap-2.5 rounded-xl px-3 py-2.5" style={{ background: st.bg, border: `1px solid ${st.border}` }}>
                      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5"><i className={`${st.icon} text-sm`} style={{ color: st.color }} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>Satır {r.row}</span>
                          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{r.adSoyad}</span>
                        </div>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.message}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function ABtn({ icon, color, onClick, title }: { icon: string; color: string; onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} title={title} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200 hover:scale-110" style={{ color: '#475569' }}
      onMouseEnter={e => { e.currentTarget.style.color = color; e.currentTarget.style.background = `${color}18`; }}
      onMouseLeave={e => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = 'transparent'; }}>
      <i className={`${icon} text-sm`} />
    </button>
  );
}
