import { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../../store/AppContext';
import type { Personel } from '../../types';
import Modal from '../../components/base/Modal';
import Badge, { getPersonelStatusColor } from '../../components/base/Badge';
import * as XLSX from 'xlsx';
import PersonelDetayModal from './components/PersonelDetayModal';

/* ── Sabitler ──────────────────────────────────────────────── */
const KAN_GRUPLARI = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'];

// Excel şablonundaki sütun başlıkları (sabit & sıralı)
const EXCEL_COLUMNS = [
  'Ad Soyad',        // 0  — zorunlu
  'TC Kimlik No',    // 1  — duplicate kontrolü
  'Telefon',         // 2
  'E-posta',         // 3
  'Doğum Tarihi',    // 4  — GG.AA.YYYY
  'İşe Giriş Tarihi',// 5  — GG.AA.YYYY
  'Görev',           // 6
  'Departman',       // 7
  'Firma Adı',       // 8  — zorunlu (firmaId çözümü için)
  'Durum',           // 9  — Aktif / Pasif / Ayrıldı
  'Kan Grubu',       // 10
  'Acil Durum Kişisi',// 11
  'Acil Durum Telefonu',// 12
  'Adres',           // 13
] as const;

const emptyPersonel: Omit<Personel, 'id' | 'olusturmaTarihi' | 'guncellemeTarihi'> = {
  adSoyad: '', tc: '', telefon: '', email: '', dogumTarihi: '', gorev: '',
  departman: '', iseGirisTarihi: '', firmaId: '', durum: 'Aktif',
  kanGrubu: '', acilKisi: '', acilTelefon: '', adres: '',
};

/* ── Küçük Form Bileşenleri ────────────────────────────────── */
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

function IR({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#475569' }}>{label}</p>
      <p className="text-sm font-medium text-slate-200">{value || '—'}</p>
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

/* ── Tarih yardımcısı: GG.AA.YYYY → YYYY-MM-DD ─────────────── */
function parseTrDate(raw: unknown): string {
  if (!raw) return '';
  const str = String(raw).trim();
  // GG.AA.YYYY veya GG/AA/YYYY
  const m = str.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  // YYYY-MM-DD zaten
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // Excel sayısal tarih
  if (!isNaN(Number(str))) {
    try {
      const d = XLSX.SSF.parse_date_code(Number(str));
      if (d) {
        const mm = String(d.m).padStart(2, '0');
        const dd = String(d.d).padStart(2, '0');
        return `${d.y}-${mm}-${dd}`;
      }
    } catch { /* ignore */ }
  }
  return '';
}

/* ── Türkçe normalize: Türkçe char ÖNCE replace, sonra toLowerCase ── */
// NOT: JavaScript'te İ.toLowerCase() → "i\u0307" (birleştirici nokta) dönebildiği için
//      toLowerCase'den ÖNCE Türkçe karakterler elle replace edilmelidir.
const TR_CHAR_MAP: Record<string, string> = {
  'İ': 'i', 'I': 'i', 'ı': 'i',
  'Ğ': 'g', 'ğ': 'g',
  'Ü': 'u', 'ü': 'u',
  'Ş': 's', 'ş': 's',
  'Ö': 'o', 'ö': 'o',
  'Ç': 'c', 'ç': 'c',
};
const TR_CHARS_RE = /[İIıĞğÜüŞşÖöÇç]/g;

function normalize(s: unknown): string {
  return String(s ?? '')
    .trim()
    // 1. Türkçe karakterleri ASCII'ye çevir (toLowerCase öncesi!)
    .replace(TR_CHARS_RE, c => TR_CHAR_MAP[c] ?? c)
    // 2. Kalan karakterleri lowercase yap
    .toLowerCase()
    // 3. Çoklu boşlukları tek boşluğa indir
    .replace(/\s+/g, ' ');
}

/**
 * Sıkı normalize: normalize() + noktalama işaretleri temizleme.
 * Firma adı karşılaştırmalarında kullanılır.
 * Örn: "ABC Sanayi Ltd. Şti." → "abc sanayi ltd sti"
 *      "A.Ş."  → "as"
 */
function strictNorm(s: unknown): string {
  return normalize(s)
    .replace(/[.\-,;:'"()[\]\/\\&@#!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Kelime (token) kümesini döndürür; 1–2 karakterlik anlamsız kelimeleri eler */
function tokenSet(normalized: string): Set<string> {
  return new Set(normalized.split(' ').filter(t => t.length >= 2));
}

/* ── Import Sonuç Tipi ──────────────────────────────────────── */
interface ImportResult {
  successCount: number;
  duplicateCount: number;
  errorCount: number;
  rows: {
    row: number;
    adSoyad: string;
    status: 'success' | 'duplicate' | 'error';
    message: string;
  }[];
}

/* ── Ana Bileşen ───────────────────────────────────────────── */
export default function PersonellerPage() {
  const {
    personeller, firmalar,
    addPersonel, updatePersonel, deletePersonel, addToast,
    quickCreate, setQuickCreate,
  } = useApp();

  const [search, setSearch] = useState('');
  const [firmaFilter, setFirmaFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyPersonel });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Import state
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (quickCreate === 'personeller') {
      setForm({ ...emptyPersonel });
      setEditingId(null);
      setFormOpen(true);
      setQuickCreate(null);
    }
  }, [quickCreate, setQuickCreate]);

  /* ── 5A & 5B: Excel Export (Tam Şablon) ────────────────── */
  const handleExcelExport = () => {
    const headerRow = [...EXCEL_COLUMNS];

    const dataRows = filtered.map(p => {
      const firma = firmalar.find(f => f.id === p.firmaId);
      return [
        p.adSoyad,
        p.tc,
        p.telefon,
        p.email,
        p.dogumTarihi ? new Date(p.dogumTarihi).toLocaleDateString('tr-TR') : '',
        p.iseGirisTarihi ? new Date(p.iseGirisTarihi).toLocaleDateString('tr-TR') : '',
        p.gorev,
        p.departman,
        firma?.ad || '',
        p.durum,
        p.kanGrubu,
        p.acilKisi,
        p.acilTelefon,
        p.adres,
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);

    // Kolon genişlikleri
    ws['!cols'] = [
      { wch: 26 }, { wch: 15 }, { wch: 16 }, { wch: 28 }, { wch: 14 },
      { wch: 14 }, { wch: 22 }, { wch: 20 }, { wch: 28 }, { wch: 12 },
      { wch: 12 }, { wch: 24 }, { wch: 18 }, { wch: 36 },
    ];

    // AutoFilter + Freeze ilk satır
    ws['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(EXCEL_COLUMNS.length - 1)}1` };
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

    // Başlık satırı kalın + arka plan rengi
    headerRow.forEach((_, colIdx) => {
      const cellAddr = XLSX.utils.encode_cell({ r: 0, c: colIdx });
      if (!ws[cellAddr]) ws[cellAddr] = { v: headerRow[colIdx], t: 's' };
      ws[cellAddr].s = {
        font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
        fill: { patternType: 'solid', fgColor: { rgb: '1E3A5F' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
        border: {
          bottom: { style: 'thin', color: { rgb: '94A3B8' } },
        },
      };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Personeller');

    // 2. Sayfa: Açıklama / Rehber
    const guideRows = [
      ['ALAN', 'ZORUNLU', 'AÇIKLAMA', 'ÖRNEK'],
      ['Ad Soyad', 'EVET', 'Personelin tam adı ve soyadı', 'Ahmet Yılmaz'],
      ['TC Kimlik No', 'Hayır', '11 haneli TC — boş bırakılabilir; büyük/küçük harf ve boşluk toleranslı', '12345678901'],
      ['Telefon', 'Hayır', 'Personel telefon numarası', '0555 123 45 67'],
      ['E-posta', 'Hayır', 'Personel e-posta adresi', 'ahmet@firma.com'],
      ['Doğum Tarihi', 'Hayır', 'GG.AA.YYYY veya GG/AA/YYYY veya YYYY-MM-DD', '15.03.1990'],
      ['İşe Giriş Tarihi', 'Hayır', 'GG.AA.YYYY veya GG/AA/YYYY veya YYYY-MM-DD', '01.06.2020'],
      ['Görev', 'Hayır', 'Personelin unvanı veya görevi', 'Operatör'],
      ['Departman', 'Hayır', 'Çalıştığı departman', 'Üretim'],
      ['Firma Adı', 'EVET', 'Büyük/küçük harf farksız, kısmi eşleşme desteklenir', 'ABC Sanayi Ltd.'],
      ['Durum', 'Hayır', 'Aktif / Pasif / Ayrıldı — boş = Aktif; büyük/küçük harf farksız', 'aktif'],
      ['Kan Grubu', 'Hayır', 'A+ / A- / B+ / B- / AB+ / AB- / 0+ / 0- — tanınmıyorsa boş bırakılır', 'A+'],
      ['Acil Durum Kişisi', 'Hayır', 'Yakın kişinin adı soyadı', 'Fatma Yılmaz'],
      ['Acil Durum Telefonu', 'Hayır', 'Acil kişi telefonu', '0532 000 00 00'],
      ['Adres', 'Hayır', 'İkamet adresi', 'Kadıköy, İstanbul'],
      ['', '', '', ''],
      ['NOT', '', 'Sütun başlıklarında büyük/küçük harf farkı ve başındaki boşluklar otomatik tolere edilir.', ''],
    ];
    const wsGuide = XLSX.utils.aoa_to_sheet(guideRows);
    wsGuide['!cols'] = [{ wch: 24 }, { wch: 10 }, { wch: 62 }, { wch: 28 }];
    XLSX.utils.book_append_sheet(wb, wsGuide, 'Kullanım Kılavuzu');

    const xlsxData = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
    const blob = new Blob([xlsxData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const tarih = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
    link.href = url;
    link.download = `ISG_Personeller_${tarih}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast(`${dataRows.length} personel Excel olarak indirildi.`, 'success');
  };

  /* ── Boş Şablon İndir ───────────────────────────────────── */
  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([[...EXCEL_COLUMNS]]);
    ws['!cols'] = [
      { wch: 26 }, { wch: 15 }, { wch: 16 }, { wch: 28 }, { wch: 14 },
      { wch: 14 }, { wch: 22 }, { wch: 20 }, { wch: 28 }, { wch: 12 },
      { wch: 12 }, { wch: 24 }, { wch: 18 }, { wch: 36 },
    ];
    ws['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(EXCEL_COLUMNS.length - 1)}1` };
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    EXCEL_COLUMNS.forEach((_, colIdx) => {
      const cellAddr = XLSX.utils.encode_cell({ r: 0, c: colIdx });
      if (ws[cellAddr]) {
        ws[cellAddr].s = {
          font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
          fill: { patternType: 'solid', fgColor: { rgb: '1E3A5F' } },
          alignment: { horizontal: 'center' },
        };
      }
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Personeller');

    const guideRows = [
      ['ALAN', 'ZORUNLU', 'AÇIKLAMA', 'ÖRNEK'],
      ['Ad Soyad', 'EVET', 'Personelin tam adı ve soyadı', 'Ahmet Yılmaz'],
      ['TC Kimlik No', 'Hayır', '11 haneli TC — boş bırakılabilir; büyük/küçük harf ve boşluk toleranslı', '12345678901'],
      ['Telefon', 'Hayır', 'Personel telefon numarası', '0555 123 45 67'],
      ['E-posta', 'Hayır', 'Personel e-posta adresi', 'ahmet@firma.com'],
      ['Doğum Tarihi', 'Hayır', 'GG.AA.YYYY veya GG/AA/YYYY veya YYYY-MM-DD', '15.03.1990'],
      ['İşe Giriş Tarihi', 'Hayır', 'GG.AA.YYYY veya GG/AA/YYYY veya YYYY-MM-DD', '01.06.2020'],
      ['Görev', 'Hayır', 'Personelin unvanı veya görevi', 'Operatör'],
      ['Departman', 'Hayır', 'Çalıştığı departman', 'Üretim'],
      ['Firma Adı', 'EVET', 'Büyük/küçük harf farksız, kısmi eşleşme desteklenir', 'ABC Sanayi Ltd.'],
      ['Durum', 'Hayır', 'Aktif / Pasif / Ayrıldı — boş = Aktif; büyük/küçük harf farksız', 'aktif'],
      ['Kan Grubu', 'Hayır', 'A+ / A- / B+ / B- / AB+ / AB- / 0+ / 0- — tanınmıyorsa boş bırakılır', 'A+'],
      ['Acil Durum Kişisi', 'Hayır', 'Yakın kişinin adı soyadı', 'Fatma Yılmaz'],
      ['Acil Durum Telefonu', 'Hayır', 'Acil kişi telefonu', '0532 000 00 00'],
      ['Adres', 'Hayır', 'İkamet adresi', 'Kadıköy, İstanbul'],
      ['', '', '', ''],
      ['NOT', '', 'Sütun başlıklarında büyük/küçük harf farkı ve başındaki boşluklar otomatik tolere edilir.', ''],
    ];
    const wsGuide = XLSX.utils.aoa_to_sheet(guideRows);
    wsGuide['!cols'] = [{ wch: 24 }, { wch: 10 }, { wch: 62 }, { wch: 28 }];
    XLSX.utils.book_append_sheet(wb, wsGuide, 'Kullanım Kılavuzu');

    const xlsxData = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
    const blob = new Blob([xlsxData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ISG_Personel_Sablonu.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast('Boş şablon indirildi.', 'success');
  };

  /* ── 5C, 5D, 5E: Excel Import ───────────────────────────── */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      addToast('Lütfen .xlsx veya .xls uzantılı dosya seçin.', 'error');
      return;
    }
    processImport(file);
    // input'u sıfırla — aynı dosyayı tekrar seçebilmek için
    e.target.value = '';
  };

  const processImport = (file: File) => {
    setImportLoading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result;
        const wb = XLSX.read(data, { type: 'array', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as unknown[][];

        if (rows.length < 2) {
          addToast('Excel dosyası boş veya yalnızca başlık satırı içeriyor.', 'warning');
          setImportLoading(false);
          return;
        }

        /* ── 1. Esnek sütun eşleştirme ── */
        const headerRow = (rows[0] as unknown[]).map(h => String(h ?? '').trim());
        // normalize() ile hem Excel başlığı hem beklenen sütun adı karşılaştırılıyor
        const colIndex: Record<string, number> = {};
        EXCEL_COLUMNS.forEach(col => {
          const normCol = normalize(col);
          const idx = headerRow.findIndex(h => normalize(h) === normCol);
          colIndex[col] = idx; // bulunamazsa -1
        });

        /* ── 2. Firma haritası — hem soft hem strict normalize ile ── */
        const aktivFirmalar = firmalar.filter(f => !f.silinmis);

        // Soft normalize haritası (harf bazlı)
        const firmaMapSoft = new Map<string, string>(
          aktivFirmalar.map(f => [normalize(f.ad), f.id])
        );
        // Strict normalize haritası (noktalama da temizlenmiş)
        const firmaMapStrict = new Map<string, string>(
          aktivFirmalar.map(f => [strictNorm(f.ad), f.id])
        );
        // Token listesi (kelime bazlı eşleşme için)
        const firmaNormList = aktivFirmalar.map(f => ({
          ad: f.ad,
          id: f.id,
          soft:   normalize(f.ad),
          strict: strictNorm(f.ad),
          tokens: tokenSet(strictNorm(f.ad)),
        }));

        /**
         * Firma eşleşme stratejisi (sırayla):
         * 1. Soft normalize tam eşleşme  → kesin
         * 2. Strict normalize tam eşleşme (noktalama farkı)  → kesin
         * 3. Kısmi eşleşme (strict — biri diğerini içeriyor)  → kesin
         * 4. Token bazlı eşleşme (≥ %70 kelime örtüşmesi)  → kesin
         * 5. Token bazlı benzerlik (≥ %40)  → öneri
         * 6. Bulunamadı → tüm firma listesi
         */
        const findFirmaId = (raw: string): { id: string | null; hint: string } => {
          const softRaw   = normalize(raw);
          const strictRaw = strictNorm(raw);
          if (!softRaw) return { id: null, hint: '' };

          // 1. Soft tam
          const s1 = firmaMapSoft.get(softRaw);
          if (s1) return { id: s1, hint: '' };

          // 2. Strict tam
          const s2 = firmaMapStrict.get(strictRaw);
          if (s2) return { id: s2, hint: '' };

          // 3. Strict kısmi (biri diğerini içeriyor)
          const partialStrict = firmaNormList.find(
            f => f.strict.includes(strictRaw) || strictRaw.includes(f.strict)
          );
          if (partialStrict) return { id: partialStrict.id, hint: `(Eşleşti: "${partialStrict.ad}")` };

          // 4 & 5. Token bazlı skor
          const inputTokens = tokenSet(strictRaw);
          if (inputTokens.size > 0) {
            const scored = firmaNormList
              .map(f => {
                const ft = f.tokens;
                let matched = 0;
                inputTokens.forEach(t => { if (ft.has(t)) matched++; });
                const score = matched / Math.max(inputTokens.size, ft.size, 1);
                return { ...f, score };
              })
              .filter(f => f.score >= 0.4)
              .sort((a, b) => b.score - a.score);

            if (scored.length > 0) {
              // En iyi eşleşme güvenilir ise doğrudan bağla
              if (scored[0].score >= 0.7) {
                return { id: scored[0].id, hint: `(Eşleşti: "${scored[0].ad}")` };
              }
              // Yakın ama emin değiliz — öneri göster
              const suggestions = scored.slice(0, 3).map(f => `"${f.ad}"`).join(', ');
              return { id: null, hint: `En yakın firma önerileri: ${suggestions}` };
            }
          }

          // 6. Hiç benzer yok — listeyi göster
          const allList = aktivFirmalar.slice(0, 5).map(f => `"${f.ad}"`).join(', ');
          const suffix  = aktivFirmalar.length > 5 ? ` ve ${aktivFirmalar.length - 5} firma daha` : '';
          return { id: null, hint: `Sistemdeki firmalar: ${allList}${suffix}` };
        };

        /* ── 3. Durum fuzzy map (tüm anahtarlar normalize edilmiş formda) ── */
        // ÖNEMLI: Bu haritanın anahtarları normalize(rawDurum) çıktısına göre
        // yazılmalıdır — Türkçe karakter veya büyük harf içermemeli!
        const durumMap: Record<string, 'Aktif' | 'Pasif' | 'Ayrıldı'> = {
          // Aktif varyantları
          aktif: 'Aktif', active: 'Aktif', '1': 'Aktif',
          calisiyor: 'Aktif', calisıyor: 'Aktif', devam: 'Aktif',
          // Pasif varyantları
          pasif: 'Pasif', inactive: 'Pasif', beklemede: 'Pasif',
          durdu: 'Pasif', durduruldu: 'Pasif',
          // Ayrıldı varyantları
          ayrildi: 'Ayrıldı', ayrilmis: 'Ayrıldı',
          left: 'Ayrıldı', cikti: 'Ayrıldı', cikis: 'Ayrıldı',
          isten: 'Ayrıldı', istenayrild: 'Ayrıldı',
        };

        /* ── 4. Kan grubu normalize map (yeni A+ ve eski A Rh+ formatı) ── */
        const kanMap: Record<string, string> = {};
        KAN_GRUPLARI.forEach(k => { kanMap[normalize(k)] = k; });
        // Geriye dönük uyumluluk: eski "A Rh+" formatı
        const KAN_LEGACY: Record<string, string> = {
          'a rh+': 'A+', 'a rh-': 'A-', 'b rh+': 'B+', 'b rh-': 'B-',
          'ab rh+': 'AB+', 'ab rh-': 'AB-', '0 rh+': '0+', '0 rh-': '0-',
          'a rh +': 'A+', 'a rh -': 'A-', 'b rh +': 'B+', 'b rh -': 'B-',
          'ab rh +': 'AB+', 'ab rh -': 'AB-', '0 rh +': '0+', '0 rh -': '0-',
        };
        Object.assign(kanMap, KAN_LEGACY);

        /* ── 5. Mevcut TC seti (duplicate kontrolü) ── */
        const existingTCs = new Set(
          personeller.filter(p => !p.silinmis && p.tc).map(p => p.tc.replace(/\D/g, ''))
        );

        const result: ImportResult = {
          successCount: 0, duplicateCount: 0, errorCount: 0, rows: [],
        };

        const dataRows = rows.slice(1);

        dataRows.forEach((rawRow, idx) => {
          const rowNum = idx + 2;
          const row = rawRow as unknown[];

          /** Hücre değerini sütun adına göre al, trim et */
          const get = (col: typeof EXCEL_COLUMNS[number]): string => {
            const ci = colIndex[col];
            if (ci === undefined || ci < 0) return '';
            return String(row[ci] ?? '').trim();
          };

          const adSoyad = get('Ad Soyad');
          const tcRaw   = get('TC Kimlik No');
          const firmaAdi = get('Firma Adı');

          // Tamamen boş satır → atla (sessizce)
          if (!adSoyad && !tcRaw && !firmaAdi) return;

          /* ── Hata listesi ── */
          const errors: string[] = [];

          // Zorunlu: Ad Soyad
          if (!adSoyad) {
            errors.push('"Ad Soyad" sütunu boş — bu alan zorunludur');
          }

          // Zorunlu: Firma Adı + eşleşme kontrolü
          let firmaId: string | null = null;
          if (!firmaAdi) {
            errors.push('"Firma Adı" sütunu boş — bu alan zorunludur');
          } else {
            const match = findFirmaId(firmaAdi);
            firmaId = match.id;
            if (!firmaId) {
              errors.push(`"Firma Adı": "${firmaAdi}" sistemde bulunamadı. ${match.hint}`);
            }
          }

          // TC: sadece rakam bırak, sonra uzunluk kontrolü
          const tc = tcRaw.replace(/\D/g, '');
          if (tcRaw && tc.length !== 11) {
            errors.push(
              `"TC Kimlik No": "${tcRaw}" geçersiz ` +
              `(${tc.length} rakam — 11 olmalı${tc.length < 11 ? ', eksik hane' : ', fazla karakter'})`,
            );
          }

          if (errors.length > 0) {
            result.errorCount++;
            result.rows.push({
              row: rowNum,
              adSoyad: adSoyad || '(İsimsiz)',
              status: 'error',
              message: errors.join(' • '),
            });
            return;
          }

          // Duplicate kontrolü
          if (tc && existingTCs.has(tc)) {
            result.duplicateCount++;
            result.rows.push({
              row: rowNum, adSoyad,
              status: 'duplicate',
              message: `TC No ${tc} zaten sistemde kayıtlı — kayıt atlandı`,
            });
            return;
          }

          // Durum normalize
          const rawDurum = get('Durum');
          const durum: 'Aktif' | 'Pasif' | 'Ayrıldı' = durumMap[normalize(rawDurum)] ?? 'Aktif';

          // Kan grubu normalize
          const rawKan = get('Kan Grubu');
          const kanGrubu = kanMap[normalize(rawKan)] ?? '';

          // Personeli ekle
          addPersonel({
            adSoyad: adSoyad.trim(),
            tc,
            telefon:         get('Telefon'),
            email:           get('E-posta'),
            dogumTarihi:     parseTrDate(get('Doğum Tarihi')),
            iseGirisTarihi:  parseTrDate(get('İşe Giriş Tarihi')),
            gorev:           get('Görev'),
            departman:       get('Departman'),
            firmaId:         firmaId!,
            durum,
            kanGrubu,
            acilKisi:        get('Acil Durum Kişisi'),
            acilTelefon:     get('Acil Durum Telefonu'),
            adres:           get('Adres'),
          });

          if (tc) existingTCs.add(tc);

          result.successCount++;
          result.rows.push({
            row: rowNum, adSoyad,
            status: 'success',
            message: `Başarıyla eklendi${durum !== 'Aktif' ? ` (Durum: ${durum})` : ''}`,
          });
        });

        setImportResult(result);

        if (result.successCount > 0)  addToast(`${result.successCount} personel başarıyla içe aktarıldı.`, 'success');
        if (result.duplicateCount > 0) addToast(`${result.duplicateCount} tekrar kayıt atlandı.`, 'warning');
        if (result.errorCount > 0)     addToast(`${result.errorCount} satırda hata — detayları inceleyin.`, 'error');

      } catch {
        addToast('Excel dosyası okunurken hata oluştu. Dosyanın bozuk olmadığından emin olun.', 'error');
      } finally {
        setImportLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  /* ── Filtreler ──────────────────────────────────────────── */
  const filtered = useMemo(() => personeller.filter(p => {
    if (p.silinmis) return false;
    const q = search.toLowerCase();
    return (!search || p.adSoyad.toLowerCase().includes(q) || p.tc.includes(q) || p.gorev.toLowerCase().includes(q))
      && (!firmaFilter || p.firmaId === firmaFilter)
      && (!statusFilter || p.durum === statusFilter);
  }), [personeller, search, firmaFilter, statusFilter]);

  const getFirmaAd = (id: string) => firmalar.find(f => f.id === id)?.ad || '—';

  const openAdd = () => { setForm({ ...emptyPersonel }); setEditingId(null); setFormOpen(true); };
  const openEdit = (p: Personel) => { setForm({ ...p }); setEditingId(p.id); setFormOpen(true); };

  const handleSave = () => {
    if (!form.adSoyad.trim()) { addToast('Ad Soyad zorunludur.', 'error'); return; }
    if (!form.firmaId) { addToast('Firma seçimi zorunludur.', 'error'); return; }
    if (editingId) { updatePersonel(editingId, form); addToast('Personel güncellendi.', 'success'); }
    else { addPersonel(form); addToast('Personel eklendi.', 'success'); }
    setFormOpen(false);
  };

  const handleDelete = (id: string) => {
    deletePersonel(id); setDeleteConfirm(null); setDetailId(null);
    addToast('Personel silindi.', 'info');
  };



  const f = (field: keyof typeof form) => form[field] as string;
  const set = (field: keyof typeof form, value: string) => setForm(prev => ({ ...prev, [field]: value }));



  const aktifCount = personeller.filter(p => !p.silinmis && p.durum === 'Aktif').length;

  /* ── Import Sonuç Renkleri ──────────────────────────────── */
  const statusStyle = (s: ImportResult['rows'][0]['status']) => {
    if (s === 'success') return { color: '#34D399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.2)', icon: 'ri-checkbox-circle-line' };
    if (s === 'duplicate') return { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)', icon: 'ri-error-warning-line' };
    return { color: '#EF4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)', icon: 'ri-close-circle-line' };
  };

  return (
    <div className="space-y-5">
      {/* Gizli dosya inputu */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Personeller</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {personeller.filter(p => !p.silinmis).length} personel kayıtlı
            </span>
            <span className="w-1 h-1 rounded-full" style={{ background: 'var(--border-main)' }} />
            <span className="text-xs font-medium" style={{ color: '#34D399' }}>{aktifCount} aktif</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Excel işlemleri dropdown yerine inline butonlar */}
          <button
            onClick={handleDownloadTemplate}
            title="Boş şablon indir"
            className="btn-secondary whitespace-nowrap"
          >
            <i className="ri-download-2-line text-base" />
            Şablon İndir
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importLoading}
            className="btn-secondary whitespace-nowrap"
          >
            {importLoading
              ? <><i className="ri-loader-4-line animate-spin text-base" /> Yükleniyor...</>
              : <><i className="ri-upload-2-line text-base" /> Excel İçe Aktar</>
            }
          </button>
          <button onClick={handleExcelExport} className="btn-secondary whitespace-nowrap">
            <i className="ri-file-excel-2-line text-base" />
            Excel İndir
          </button>
          <button onClick={openAdd} className="btn-primary whitespace-nowrap">
            <i className="ri-user-add-line text-base" />
            Yeni Personel Ekle
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 px-4 py-3 rounded-2xl isg-card">
        <div className="relative flex-1 min-w-[180px]">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Ad, TC kimlik veya görev ara..."
            className="isg-input pl-9"
          />
        </div>
        <select
          value={firmaFilter}
          onChange={e => setFirmaFilter(e.target.value)}
          className="isg-input"
          style={{ width: 'auto', minWidth: '160px' }}
        >
          <option value="">Tüm Firmalar</option>
          {firmalar.filter(fi => !fi.silinmis).map(fi => <option key={fi.id} value={fi.id}>{fi.ad}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="isg-input"
          style={{ width: 'auto', minWidth: '140px' }}
        >
          <option value="">Tüm Durumlar</option>
          <option value="Aktif">Aktif</option>
          <option value="Pasif">Pasif</option>
          <option value="Ayrıldı">Ayrıldı</option>
        </select>
        {(search || firmaFilter || statusFilter) && (
          <button onClick={() => { setSearch(''); setFirmaFilter(''); setStatusFilter(''); }} className="btn-secondary">
            <i className="ri-filter-off-line" /> Temizle
          </button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl p-16 flex flex-col items-center text-center isg-card">
          <div className="w-16 h-16 flex items-center justify-center rounded-2xl mb-4" style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)' }}>
            <i className="ri-team-line text-3xl" style={{ color: 'var(--text-faint)' }} />
          </div>
          <p className="text-base font-bold" style={{ color: 'var(--text-muted)' }}>
            {search || firmaFilter || statusFilter ? 'Sonuç bulunamadı' : 'Henüz personel eklenmedi'}
          </p>
          {firmalar.filter(f => !f.silinmis).length === 0 && (
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Önce bir firma eklemeniz gerekmektedir.</p>
          )}
          {personeller.filter(p => !p.silinmis).length === 0 && firmalar.filter(f => !f.silinmis).length > 0 && (
            <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
              Yukarıdaki <strong>"Excel İçe Aktar"</strong> butonu ile toplu ekleyebilirsiniz.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden isg-card">
          <div className="overflow-x-auto">
            <table className="w-full table-premium">
              <thead>
                <tr>
                  <th className="text-left">Personel</th>
                  <th className="text-left hidden md:table-cell">Firma</th>
                  <th className="text-left hidden lg:table-cell">Görev / Departman</th>
                  <th className="text-left hidden lg:table-cell">İletişim</th>
                  <th className="text-left">Durum</th>
                  <th className="w-24 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, idx) => (
                  <tr key={p.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 text-xs font-bold text-white"
                          style={{ background: AVATAR_COLORS[idx % AVATAR_COLORS.length] }}
                        >
                          {p.adSoyad.charAt(0)}
                        </div>
                        <div>
                          <button
                            onClick={() => setDetailId(p.id)}
                            className="text-sm font-semibold text-slate-200 hover:text-blue-400 transition-colors cursor-pointer block text-left"
                          >
                            {p.adSoyad}
                          </button>
                          <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{p.tc || 'TC yok'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell">
                      <p className="text-sm text-slate-300">{getFirmaAd(p.firmaId)}</p>
                    </td>
                    <td className="hidden lg:table-cell">
                      <p className="text-sm text-slate-400">{p.gorev || '—'}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#334155' }}>{p.departman || ''}</p>
                    </td>
                    <td className="hidden lg:table-cell">
                      <p className="text-sm text-slate-400">{p.telefon || '—'}</p>
                    </td>
                    <td>
                      <Badge label={p.durum} color={getPersonelStatusColor(p.durum)} />
                    </td>
                    <td>
                      <div className="flex items-center gap-1 justify-end">
                        <ABtn icon="ri-eye-line" color="#3B82F6" onClick={() => setDetailId(p.id)} title="Detay" />
                        <ABtn icon="ri-edit-line" color="#F59E0B" onClick={() => openEdit(p)} title="Düzenle" />
                        <ABtn icon="ri-delete-bin-line" color="#EF4444" onClick={() => setDeleteConfirm(p.id)} title="Sil" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? 'Personel Düzenle' : 'Yeni Personel Ekle'}
        size="xl"
        icon="ri-user-line"
        footer={
          <>
            <button onClick={() => setFormOpen(false)} className="btn-secondary">İptal</button>
            <button onClick={handleSave} className="btn-primary"><i className="ri-save-line" /> Kaydet</button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FF label="Ad Soyad *" value={f('adSoyad')} onChange={v => set('adSoyad', v)} placeholder="Personelin tam adı" />
          <FF label="TC Kimlik No" value={f('tc')} onChange={v => set('tc', v)} placeholder="12345678901" />
          <FF label="Telefon" value={f('telefon')} onChange={v => set('telefon', v)} placeholder="0555 000 00 00" />
          <FF label="E-posta" value={f('email')} onChange={v => set('email', v)} placeholder="personel@email.com" type="email" />
          <FF label="Doğum Tarihi" value={f('dogumTarihi')} onChange={v => set('dogumTarihi', v)} type="date" />
          <FF label="İşe Giriş Tarihi" value={f('iseGirisTarihi')} onChange={v => set('iseGirisTarihi', v)} type="date" />
          <FF label="Görev / Unvan" value={f('gorev')} onChange={v => set('gorev', v)} placeholder="Operatör, Mühendis, Teknisyen..." />
          <FF label="Departman" value={f('departman')} onChange={v => set('departman', v)} placeholder="Üretim, Kalite, Güvenlik..." />
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>Firma *</label>
            <select
              value={f('firmaId')}
              onChange={e => set('firmaId', e.target.value)}
              className="input-premium cursor-pointer"
            >
              <option value="">Firma Seçin...</option>
              {firmalar.filter(fi => !fi.silinmis).map(firma => <option key={firma.id} value={firma.id}>{firma.ad}</option>)}
            </select>
            {firmalar.filter(fi => !fi.silinmis).length === 0 && (
              <p className="text-xs mt-1" style={{ color: '#F59E0B' }}>Önce firma eklemeniz gerekmektedir.</p>
            )}
          </div>
          <FS label="Çalışma Durumu" value={f('durum')} onChange={v => set('durum', v)} options={['Aktif', 'Pasif', 'Ayrıldı']} />
          <FS label="Kan Grubu" value={f('kanGrubu')} onChange={v => set('kanGrubu', v)} options={['', ...KAN_GRUPLARI]} />
          <FF label="Acil Durum Kişisi" value={f('acilKisi')} onChange={v => set('acilKisi', v)} placeholder="Yakınının adı soyadı" />
          <FF label="Acil Durum Telefonu" value={f('acilTelefon')} onChange={v => set('acilTelefon', v)} placeholder="0555 000 00 00" />
          <div className="md:col-span-2">
            <FF label="İkamet Adresi" value={f('adres')} onChange={v => set('adres', v)} placeholder="Açık adres" />
          </div>
        </div>
      </Modal>

      {/* Personel Detay Modal — merkezi bileşen */}
      <PersonelDetayModal personelId={detailId} onClose={() => setDetailId(null)} />

      {/* Delete Confirm */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Personeli Sil"
        size="sm"
        icon="ri-delete-bin-line"
        footer={
          <>
            <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">İptal</button>
            <button onClick={() => handleDelete(deleteConfirm!)} className="btn-danger"><i className="ri-delete-bin-line" /> Evet, Sil</button>
          </>
        }
      >
        <div className="py-2">
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl mb-4" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <i className="ri-error-warning-line text-xl" style={{ color: '#EF4444' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: '#E2E8F0' }}>Bu personeli silmek istediğinizden emin misiniz?</p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>Personel çöp kutusuna taşınacak, oradan geri yükleyebilirsiniz.</p>
        </div>
      </Modal>

      {/* ── Import Sonuç Modalı ───────────────────────────── */}
      <Modal
        open={!!importResult}
        onClose={() => setImportResult(null)}
        title="Excel İçe Aktarma Sonucu"
        size="xl"
        icon="ri-file-excel-2-line"
        footer={
          <button onClick={() => setImportResult(null)} className="btn-primary">Tamam</button>
        }
      >
        {importResult && (
          <div className="space-y-4">
            {/* Özet kartlar */}
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

            {/* Satır detayları */}
            {importResult.rows.length > 0 && (
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {importResult.rows.map((r, i) => {
                  const st = statusStyle(r.status);
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 rounded-xl px-3 py-2.5"
                      style={{ background: st.bg, border: `1px solid ${st.border}` }}
                    >
                      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <i className={`${st.icon} text-sm`} style={{ color: st.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                            style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}
                          >
                            Satır {r.row}
                          </span>
                          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {r.adSoyad}
                          </span>
                        </div>
                        {r.status === 'error'
                          ? (
                            <ul className="space-y-0.5">
                              {r.message.split(' • ').map((msg, mi) => (
                                <li key={mi} className="flex items-start gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                                  <i className="ri-arrow-right-s-line flex-shrink-0 mt-0.5 text-xs" style={{ color: st.color }} />
                                  <span>{msg}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.message}</p>
                          )
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Ipucu */}
            {(importResult.errorCount > 0 || importResult.duplicateCount > 0) && (
              <div className="rounded-xl px-4 py-3 space-y-1.5" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
                <p className="text-xs font-semibold" style={{ color: '#A5B4FC' }}>
                  <i className="ri-lightbulb-line mr-1.5" />İpuçları
                </p>
                {importResult.errorCount > 0 && (
                  <ul className="space-y-1">
                    <li className="text-xs flex items-start gap-1.5" style={{ color: '#C4B5FD' }}>
                      <i className="ri-arrow-right-s-line flex-shrink-0" />
                      <span>Firma adını sistemdeki firma adıyla birebir aynı yazın (büyük/küçük harf önemli değil)</span>
                    </li>
                    <li className="text-xs flex items-start gap-1.5" style={{ color: '#C4B5FD' }}>
                      <i className="ri-arrow-right-s-line flex-shrink-0" />
                      <span>TC Kimlik No: 11 rakamlı olmalı, başında 0 dahil (boş bırakılabilir)</span>
                    </li>
                    <li className="text-xs flex items-start gap-1.5" style={{ color: '#C4B5FD' }}>
                      <i className="ri-arrow-right-s-line flex-shrink-0" />
                      <span>Zorunlu alanlar sadece "Ad Soyad" ve "Firma Adı" — diğerleri boş bırakılabilir</span>
                    </li>
                  </ul>
                )}
                {importResult.duplicateCount > 0 && (
                  <p className="text-xs" style={{ color: '#C4B5FD' }}>
                    <i className="ri-information-line mr-1" />
                    TC numarası zaten kayıtlı olan personeller tekrar eklenmedi.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ── Yardımcı Bileşenler ───────────────────────────────────── */
function ABtn({ icon, color, onClick, title }: { icon: string; color: string; onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} title={title}
      className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200 hover:scale-110"
      style={{ color: '#475569' }}
      onMouseEnter={e => { e.currentTarget.style.color = color; e.currentTarget.style.background = `${color}18`; }}
      onMouseLeave={e => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = 'transparent'; }}
    >
      <i className={`${icon} text-sm`} />
    </button>
  );
}

function EmptyTabState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="text-center py-8">
      <i className={`${icon} text-3xl`} style={{ color: '#1E293B' }} />
      <p className="text-sm mt-2" style={{ color: '#334155' }}>{text}</p>
    </div>
  );
}

function ListItem({ icon, iconColor, title, sub, badge }: { icon: string; iconColor: string; title: string; sub: string; badge: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-3.5 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: `${iconColor}18` }}>
        <i className={`${icon} text-sm`} style={{ color: iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200">{title}</p>
        <p className="text-xs" style={{ color: '#475569' }}>{sub}</p>
      </div>
      {badge}
    </div>
  );
}
