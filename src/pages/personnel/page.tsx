import { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../../store/AppContext';
import { usePermissions } from '../../hooks/usePermissions';
import type { Personel } from '../../types';
import Modal from '../../components/base/Modal';
import Badge, { getPersonelStatusColor } from '../../components/base/Badge';
import * as XLSX from 'xlsx';
import PersonelDetayModal from './components/PersonelDetayModal';
import PersonelAvatar from '../../components/base/PersonelAvatar';
import PersonelKartvizit from './components/PersonelKartvizit';

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
      const d = XLSX.SSF.parse_date_code(Number(str));
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
  const { personeller, firmalar, addPersonel, updatePersonel, deletePersonel, addToast, quickCreate, setQuickCreate, getPersonelFoto, setPersonelFoto } = useApp();
  const { canCreate, canEdit, canDelete, isReadOnly } = usePermissions();

  const [search, setSearch] = useState('');
  const [firmaFilter, setFirmaFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [kartvizitId, setKartvizitId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyPersonel });
  const [fotoVeri, setFotoVeri] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (quickCreate === 'personeller') {
      setForm({ ...emptyPersonel }); setEditingId(null); setFormOpen(true); setQuickCreate(null);
    }
  }, [quickCreate, setQuickCreate]);

  const handleExcelExport = () => {
    const headerRow = [...EXCEL_COLUMNS];
    const dataRows = filtered.map(p => {
      const firma = firmalar.find(f => f.id === p.firmaId);
      return [p.adSoyad, p.tc, p.telefon, p.email, p.dogumTarihi ? new Date(p.dogumTarihi).toLocaleDateString('tr-TR') : '', p.iseGirisTarihi ? new Date(p.iseGirisTarihi).toLocaleDateString('tr-TR') : '', p.gorev, p.departman, firma?.ad || '', p.durum, p.kanGrubu, p.acilKisi, p.acilTelefon, p.adres];
    });
    const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
    ws['!cols'] = [{ wch: 26 }, { wch: 15 }, { wch: 16 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 20 }, { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 24 }, { wch: 18 }, { wch: 36 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Personeller');
    const xlsxData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([xlsxData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const tarih = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
    link.href = url; link.download = `ISG_Personeller_${tarih}.xlsx`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
    addToast(`${dataRows.length} personel Excel olarak indirildi.`, 'success');
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([[...EXCEL_COLUMNS]]);
    ws['!cols'] = [{ wch: 26 }, { wch: 15 }, { wch: 16 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 20 }, { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 24 }, { wch: 18 }, { wch: 36 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Personeller');
    const xlsxData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([xlsxData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'ISG_Personel_Sablonu.xlsx';
    document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
    addToast('Boş şablon indirildi.', 'success');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls)$/i)) { addToast('Lütfen .xlsx veya .xls uzantılı dosya seçin.', 'error'); return; }
    processImport(file);
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
        if (rows.length < 2) { addToast('Excel dosyası boş veya yalnızca başlık satırı içeriyor.', 'warning'); setImportLoading(false); return; }

        const headerRow = (rows[0] as unknown[]).map(h => String(h ?? '').trim());
        const colIndex: Record<string, number> = {};
        EXCEL_COLUMNS.forEach(col => { const idx = headerRow.findIndex(h => normalize(h) === normalize(col)); colIndex[col] = idx; });

        const aktivFirmalar = firmalar.filter(f => !f.silinmis);
        const firmaMapSoft = new Map<string, string>(aktivFirmalar.map(f => [normalize(f.ad), f.id]));
        const firmaMapStrict = new Map<string, string>(aktivFirmalar.map(f => [strictNorm(f.ad), f.id]));
        const firmaNormList = aktivFirmalar.map(f => ({ ad: f.ad, id: f.id, soft: normalize(f.ad), strict: strictNorm(f.ad), tokens: tokenSet(strictNorm(f.ad)) }));

        const findFirmaId = (raw: string): { id: string | null; hint: string } => {
          const softRaw = normalize(raw); const strictRaw = strictNorm(raw);
          if (!softRaw) return { id: null, hint: '' };
          const s1 = firmaMapSoft.get(softRaw); if (s1) return { id: s1, hint: '' };
          const s2 = firmaMapStrict.get(strictRaw); if (s2) return { id: s2, hint: '' };
          const partial = firmaNormList.find(f => f.strict.includes(strictRaw) || strictRaw.includes(f.strict));
          if (partial) return { id: partial.id, hint: `(Eşleşti: "${partial.ad}")` };
          const inputTokens = tokenSet(strictRaw);
          if (inputTokens.size > 0) {
            const scored = firmaNormList.map(f => { let matched = 0; inputTokens.forEach(t => { if (f.tokens.has(t)) matched++; }); const score = matched / Math.max(inputTokens.size, f.tokens.size, 1); return { ...f, score }; }).filter(f => f.score >= 0.4).sort((a, b) => b.score - a.score);
            if (scored.length > 0 && scored[0].score >= 0.7) return { id: scored[0].id, hint: `(Eşleşti: "${scored[0].ad}")` };
          }
          return { id: null, hint: `Sistemdeki firmalar: ${aktivFirmalar.slice(0, 5).map(f => `"${f.ad}"`).join(', ')}` };
        };

        const durumMap: Record<string, 'Aktif' | 'Pasif' | 'Ayrıldı'> = { aktif: 'Aktif', active: 'Aktif', pasif: 'Pasif', inactive: 'Pasif', ayrildi: 'Ayrıldı', ayrilmis: 'Ayrıldı', left: 'Ayrıldı' };
        const kanMap: Record<string, string> = {};
        KAN_GRUPLARI.forEach(k => { kanMap[normalize(k)] = k; });
        Object.assign(kanMap, { 'a rh+': 'A+', 'a rh-': 'A-', 'b rh+': 'B+', 'b rh-': 'B-', 'ab rh+': 'AB+', 'ab rh-': 'AB-', '0 rh+': '0+', '0 rh-': '0-' });

        const existingTCs = new Set(personeller.filter(p => !p.silinmis && p.tc).map(p => p.tc.replace(/\D/g, '')));
        const result: ImportResult = { successCount: 0, duplicateCount: 0, errorCount: 0, rows: [] };

        rows.slice(1).forEach((rawRow, idx) => {
          const rowNum = idx + 2;
          const row = rawRow as unknown[];
          const get = (col: typeof EXCEL_COLUMNS[number]): string => { const ci = colIndex[col]; if (ci === undefined || ci < 0) return ''; return String(row[ci] ?? '').trim(); };
          const adSoyad = get('Ad Soyad'); const tcRaw = get('TC Kimlik No'); const firmaAdi = get('Firma Adı');
          if (!adSoyad && !tcRaw && !firmaAdi) return;
          const errors: string[] = [];
          if (!adSoyad) errors.push('"Ad Soyad" sütunu boş — bu alan zorunludur');
          let firmaId: string | null = null;
          if (!firmaAdi) { errors.push('"Firma Adı" sütunu boş — bu alan zorunludur'); } else { const match = findFirmaId(firmaAdi); firmaId = match.id; if (!firmaId) errors.push(`"Firma Adı": "${firmaAdi}" sistemde bulunamadı. ${match.hint}`); }
          const tc = tcRaw.replace(/\D/g, '');
          if (tcRaw && tc.length !== 11) errors.push(`"TC Kimlik No": "${tcRaw}" geçersiz (${tc.length} rakam — 11 olmalı)`);
          if (errors.length > 0) { result.errorCount++; result.rows.push({ row: rowNum, adSoyad: adSoyad || '(İsimsiz)', status: 'error', message: errors.join(' • ') }); return; }
          if (tc && existingTCs.has(tc)) { result.duplicateCount++; result.rows.push({ row: rowNum, adSoyad, status: 'duplicate', message: `TC No ${tc} zaten sistemde kayıtlı` }); return; }
          const durum: 'Aktif' | 'Pasif' | 'Ayrıldı' = durumMap[normalize(get('Durum'))] ?? 'Aktif';
          const kanGrubu = kanMap[normalize(get('Kan Grubu'))] ?? '';
          addPersonel({ adSoyad: adSoyad.trim(), tc, telefon: get('Telefon'), email: get('E-posta'), dogumTarihi: parseTrDate(get('Doğum Tarihi')), iseGirisTarihi: parseTrDate(get('İşe Giriş Tarihi')), gorev: get('Görev'), departman: get('Departman'), firmaId: firmaId!, durum, kanGrubu, acilKisi: get('Acil Durum Kişisi'), acilTelefon: get('Acil Durum Telefonu'), adres: get('Adres') });
          if (tc) existingTCs.add(tc);
          result.successCount++;
          result.rows.push({ row: rowNum, adSoyad, status: 'success', message: `Başarıyla eklendi${durum !== 'Aktif' ? ` (Durum: ${durum})` : ''}` });
        });

        setImportResult(result);
        if (result.successCount > 0) addToast(`${result.successCount} personel başarıyla içe aktarıldı.`, 'success');
        if (result.duplicateCount > 0) addToast(`${result.duplicateCount} tekrar kayıt atlandı.`, 'warning');
        if (result.errorCount > 0) addToast(`${result.errorCount} satırda hata — detayları inceleyin.`, 'error');
      } catch { addToast('Excel dosyası okunurken hata oluştu.', 'error'); } finally { setImportLoading(false); }
    };
    reader.readAsArrayBuffer(file);
  };

  const filtered = useMemo(() => personeller.filter(p => {
    if (p.silinmis) return false;
    const q = search.toLowerCase();
    return (!search || p.adSoyad.toLowerCase().includes(q) || p.tc.includes(q) || p.gorev.toLowerCase().includes(q))
      && (!firmaFilter || p.firmaId === firmaFilter)
      && (!statusFilter || p.durum === statusFilter);
  }), [personeller, search, firmaFilter, statusFilter]);

  const getFirmaAd = (id: string) => firmalar.find(f => f.id === id)?.ad || '—';

  const openAdd = () => { setForm({ ...emptyPersonel }); setEditingId(null); setFotoVeri(null); setFormOpen(true); };
  const openEdit = (p: Personel) => { setForm({ ...p }); setEditingId(p.id); setFotoVeri(null); setFormOpen(true); };

  const handleSave = () => {
    if (!form.adSoyad.trim()) { addToast('Ad Soyad zorunludur.', 'error'); return; }
    if (!form.firmaId) { addToast('Firma seçimi zorunludur.', 'error'); return; }
    if (editingId) {
      updatePersonel(editingId, form);
      if (fotoVeri) setPersonelFoto(editingId, fotoVeri);
      addToast('Personel güncellendi.', 'success');
    } else {
      const newP = addPersonel(form);
      if (fotoVeri) setPersonelFoto(newP.id, fotoVeri);
      addToast('Personel eklendi.', 'success');
    }
    setFormOpen(false);
    setFotoVeri(null);
  };

  const handleFotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { addToast('Lütfen bir resim dosyası seçin.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { setFotoVeri(ev.target?.result as string); };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDelete = (id: string) => { deletePersonel(id); setDeleteConfirm(null); setDetailId(null); addToast('Personel silindi.', 'info'); };

  const f = (field: keyof typeof form) => form[field] as string;
  const set = (field: keyof typeof form, value: string) => setForm(prev => ({ ...prev, [field]: value }));
  const aktifCount = personeller.filter(p => !p.silinmis && p.durum === 'Aktif').length;

  const statusStyle = (s: ImportResult['rows'][0]['status']) => {
    if (s === 'success') return { color: '#34D399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.2)', icon: 'ri-checkbox-circle-line' };
    if (s === 'duplicate') return { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)', icon: 'ri-error-warning-line' };
    return { color: '#EF4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)', icon: 'ri-close-circle-line' };
  };

  return (
    <div className="space-y-5">
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />
      <input ref={fotoInputRef} type="file" accept="image/*" onChange={handleFotoSelect} className="hidden" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Personeller</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{personeller.filter(p => !p.silinmis).length} personel kayıtlı</span>
            <span className="w-1 h-1 rounded-full" style={{ background: 'var(--border-main)' }} />
            <span className="text-xs font-medium" style={{ color: '#34D399' }}>{aktifCount} aktif</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleDownloadTemplate} className="btn-secondary whitespace-nowrap"><i className="ri-download-2-line text-base" />Şablon İndir</button>
          <button onClick={() => fileInputRef.current?.click()} disabled={importLoading} className="btn-secondary whitespace-nowrap">
            {importLoading ? <><i className="ri-loader-4-line animate-spin text-base" />Yükleniyor...</> : <><i className="ri-upload-2-line text-base" />Excel İçe Aktar</>}
          </button>
          <button onClick={handleExcelExport} className="btn-secondary whitespace-nowrap"><i className="ri-file-excel-2-line text-base" />Excel İndir</button>
          {canCreate && <button onClick={openAdd} className="btn-primary whitespace-nowrap"><i className="ri-user-add-line text-base" />Yeni Personel Ekle</button>}
        </div>
      </div>

      {isReadOnly && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)' }}>
          <i className="ri-eye-line text-sm flex-shrink-0" style={{ color: '#06B6D4' }} />
          <p className="text-sm" style={{ color: '#06B6D4' }}><strong>Denetçi modunda görüntülüyorsunuz</strong> — Bu sayfada yalnızca okuma yetkisine sahipsiniz.</p>
        </div>
      )}

      <div className="flex flex-wrap gap-3 px-4 py-3 rounded-2xl isg-card">
        <div className="relative flex-1 min-w-[180px]">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ad, TC kimlik veya görev ara..." className="isg-input pl-9" />
        </div>
        <select value={firmaFilter} onChange={e => setFirmaFilter(e.target.value)} className="isg-input" style={{ width: 'auto', minWidth: '160px' }}>
          <option value="">Tüm Firmalar</option>
          {firmalar.filter(fi => !fi.silinmis).map(fi => <option key={fi.id} value={fi.id}>{fi.ad}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="isg-input" style={{ width: 'auto', minWidth: '140px' }}>
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

      {filtered.length === 0 ? (
        <div className="rounded-2xl p-16 flex flex-col items-center text-center isg-card">
          <div className="w-16 h-16 flex items-center justify-center rounded-2xl mb-4" style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)' }}>
            <i className="ri-team-line text-3xl" style={{ color: 'var(--text-faint)' }} />
          </div>
          <p className="text-base font-bold" style={{ color: 'var(--text-muted)' }}>
            {search || firmaFilter || statusFilter ? 'Sonuç bulunamadı' : 'Henüz personel eklenmedi'}
          </p>
          {firmalar.filter(f => !f.silinmis).length === 0 && <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Önce bir firma eklemeniz gerekmektedir.</p>}
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
                  <th className="w-28 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const foto = getPersonelFoto(p.id);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <PersonelAvatar adSoyad={p.adSoyad} fotoUrl={foto} size="sm" />
                          <div>
                            <button onClick={() => setDetailId(p.id)} className="text-sm font-semibold text-slate-200 hover:text-blue-400 transition-colors cursor-pointer block text-left">{p.adSoyad}</button>
                            <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{p.tc || 'TC yok'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden md:table-cell"><p className="text-sm text-slate-300">{getFirmaAd(p.firmaId)}</p></td>
                      <td className="hidden lg:table-cell">
                        <p className="text-sm text-slate-400">{p.gorev || '—'}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#334155' }}>{p.departman || ''}</p>
                      </td>
                      <td className="hidden lg:table-cell"><p className="text-sm text-slate-400">{p.telefon || '—'}</p></td>
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
      <Modal open={formOpen} onClose={() => { setFormOpen(false); setFotoVeri(null); }} title={editingId ? 'Personel Düzenle' : 'Yeni Personel Ekle'} size="xl" icon="ri-user-line"
        footer={<><button onClick={() => setFormOpen(false)} className="btn-secondary">İptal</button><button onClick={handleSave} className="btn-primary"><i className="ri-save-line" /> Kaydet</button></>}>
        <div className="space-y-4">
          {/* Photo upload section */}
          <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)' }}>
            <div className="flex-shrink-0">
              {(() => {
                const displayFoto = fotoVeri || (editingId ? getPersonelFoto(editingId) : null);
                return (
                  <PersonelAvatar
                    adSoyad={form.adSoyad || '?'}
                    fotoUrl={displayFoto}
                    size="lg"
                    ring
                  />
                );
              })()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>Profil Fotoğrafı</p>
              <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>İsteğe bağlı. Yüklenmezse isim baş harfleri gösterilir.</p>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => fotoInputRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-all whitespace-nowrap"
                  style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)', color: '#818CF8' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.25)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.15)'; }}
                >
                  <i className="ri-upload-2-line" />
                  {fotoVeri || (editingId && getPersonelFoto(editingId)) ? 'Fotoğrafı Değiştir' : 'Fotoğraf Yükle'}
                </button>
                {(fotoVeri) && (
                  <button
                    type="button"
                    onClick={() => setFotoVeri(null)}
                    className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg cursor-pointer"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.2)' }}
                  >
                    <i className="ri-close-line" /> Kaldır
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Existing fields grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FF label="Ad Soyad *" value={f('adSoyad')} onChange={v => set('adSoyad', v)} placeholder="Personelin tam adı" />
            <FF label="TC Kimlik No" value={f('tc')} onChange={v => set('tc', v)} placeholder="12345678901" />
            <FF label="Telefon" value={f('telefon')} onChange={v => set('telefon', v)} placeholder="0555 000 00 00" />
            <FF label="E-posta" value={f('email')} onChange={v => set('email', v)} placeholder="personel@email.com" type="email" />
            <FF label="Doğum Tarihi" value={f('dogumTarihi')} onChange={v => set('dogumTarihi', v)} type="date" />
            <FF label="İşe Giriş Tarihi" value={f('iseGirisTarihi')} onChange={v => set('iseGirisTarihi', v)} type="date" />
            <FF label="Görev / Unvan" value={f('gorev')} onChange={v => set('gorev', v)} placeholder="Operatör, Mühendis..." />
            <FF label="Departman" value={f('departman')} onChange={v => set('departman', v)} placeholder="Üretim, Kalite..." />
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>Firma *</label>
              <select value={f('firmaId')} onChange={e => set('firmaId', e.target.value)} className="input-premium cursor-pointer">
                <option value="">Firma Seçin...</option>
                {firmalar.filter(fi => !fi.silinmis).map(firma => <option key={firma.id} value={firma.id}>{firma.ad}</option>)}
              </select>
              {firmalar.filter(fi => !fi.silinmis).length === 0 && <p className="text-xs mt-1" style={{ color: '#F59E0B' }}>Önce firma eklemeniz gerekmektedir.</p>}
            </div>
            <FS label="Çalışma Durumu" value={f('durum')} onChange={v => set('durum', v)} options={['Aktif', 'Pasif', 'Ayrıldı']} />
            <FS label="Kan Grubu" value={f('kanGrubu')} onChange={v => set('kanGrubu', v)} options={['', ...KAN_GRUPLARI]} />
            <FF label="Acil Durum Kişisi" value={f('acilKisi')} onChange={v => set('acilKisi', v)} placeholder="Yakınının adı soyadı" />
            <FF label="Acil Durum Telefonu" value={f('acilTelefon')} onChange={v => set('acilTelefon', v)} placeholder="0555 000 00 00" />
            <div className="md:col-span-2"><FF label="İkamet Adresi" value={f('adres')} onChange={v => set('adres', v)} placeholder="Açık adres" /></div>
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
