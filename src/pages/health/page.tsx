import { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../../store/AppContext';
import Modal from '../../components/base/Modal';
import Badge, { getEvrakStatusColor } from '../../components/base/Badge';
import type { Muayene, MuayeneResult } from '../../types';
import { getEvrakKategori } from '../../utils/evrakKategori';
import XLSXStyle from 'xlsx-js-style';
import { uploadFileToStorage, downloadFromUrl, downloadFromBase64, validateFile, getSignedUrlFromPath } from '@/utils/fileUpload';

const RESULT_CONFIG: Record<MuayeneResult, { label: string; color: string; bg: string; icon: string }> = {
  'Çalışabilir': { label: 'Çalışabilir', color: '#34D399', bg: 'rgba(52,211,153,0.12)', icon: 'ri-checkbox-circle-line' },
  'Kısıtlı Çalışabilir': { label: 'Kısıtlı', color: '#FBBF24', bg: 'rgba(251,191,36,0.12)', icon: 'ri-error-warning-line' },
  'Çalışamaz': { label: 'Çalışamaz', color: '#F87171', bg: 'rgba(248,113,113,0.12)', icon: 'ri-close-circle-line' },
};

const defaultForm: Omit<Muayene, 'id' | 'olusturmaTarihi'> = {
  personelId: '',
  firmaId: '',
  muayeneTarihi: '',
  sonrakiTarih: '',
  sonuc: 'Çalışabilir',
  hastane: '',
  doktor: '',
  notlar: '',
  belgeMevcut: false,
  dosyaAdi: '',
  dosyaBoyutu: 0,
  dosyaTipi: '',
  dosyaVeri: '',
};

function getDaysUntil(dateStr: string): number {
  if (!dateStr) return 999;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function exportMuayenelerToExcel(
  muayeneler: Muayene[],
  firmalar: { id: string; ad: string }[],
  personeller: { id: string; adSoyad: string; gorev?: string }[],
): void {
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('tr-TR') : '-';
  const aktif = muayeneler.filter(m => !m.silinmis);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tarih = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
  const calisabilir = aktif.filter(m => m.sonuc === 'Çalışabilir').length;
  const kisitli = aktif.filter(m => m.sonuc === 'Kısıtlı Çalışabilir').length;
  const calisamaz = aktif.filter(m => m.sonuc === 'Çalışamaz').length;
  const yaklasan = aktif.filter(m => { const d = getDaysUntil(m.sonrakiTarih); return d >= 0 && d <= 30; }).length;
  const gecmis = aktif.filter(m => getDaysUntil(m.sonrakiTarih) < 0).length;

  const HEADER_BG = '1E293B'; const HEADER_FG = 'FFFFFF'; const TITLE_BG = '0F172A';
  const ROW_ALT = 'F1F5F9'; const ROW_NORMAL = 'FFFFFF'; const BC = 'CBD5E1';
  const thinB = { top: { style: 'thin', color: { rgb: BC } }, bottom: { style: 'thin', color: { rgb: BC } }, left: { style: 'thin', color: { rgb: BC } }, right: { style: 'thin', color: { rgb: BC } } };
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
    if (sl.includes('çalışabilir') || sl === 'var') { fg = '16A34A'; bg = 'DCFCE7'; }
    else if (sl.includes('çalışamaz') || sl.includes('gecikmiş') || sl.includes('geçti')) { fg = 'DC2626'; bg = 'FEE2E2'; }
    else if (sl.includes('kısıtlı') || sl.includes('kaldı') || sl === 'bugün') { fg = 'D97706'; bg = 'FEF3C7'; }
    return { font: { bold: true, sz: 10, color: { rgb: fg }, name: 'Calibri' }, fill: { fgColor: { rgb: bg } }, alignment: { horizontal: 'center', vertical: 'center' }, border: thinB };
  };

  const wb = XLSXStyle.utils.book_new();

  // ── Sayfa 1 ──
  const COLS1 = ['#', 'Personel', 'Görev', 'Firma', 'Muayene Tarihi', 'Sonraki Muayene', 'Kalan Gün', 'Sonuç', 'Hastane', 'Doktor', 'Belge', 'Notlar'];
  const dataRows1 = aktif.map((m, i) => {
    const personel = personeller.find(p => p.id === m.personelId);
    const firma = firmalar.find(f => f.id === m.firmaId);
    const diff = getDaysUntil(m.sonrakiTarih);
    const kalanGun = m.sonrakiTarih ? (diff < 0 ? `${Math.abs(diff)} gün geçti` : diff === 0 ? 'BUGÜN' : `${diff} gün kaldı`) : '-';
    return [i + 1, personel?.adSoyad || '-', personel?.gorev || '-', firma?.ad || '-', fmtDate(m.muayeneTarihi), fmtDate(m.sonrakiTarih), kalanGun, m.sonuc, m.hastane || '-', m.doktor ? `Dr. ${m.doktor}` : '-', m.belgeMevcut ? 'Var' : 'Yok', m.notlar || '-'];
  });
  const ws1Rows = [
    [`ISG SAĞLIK MUAYENELERİ RAPORU — ${new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}`, ...Array(COLS1.length - 1).fill('')],
    ['Toplam', 'Çalışabilir', 'Kısıtlı', 'Çalışamaz', 'Yaklaşan (≤30 gün)', 'Süresi Geçmiş', '', '', '', '', '', ''],
    [aktif.length, calisabilir, kisitli, calisamaz, yaklasan, gecmis, '', '', '', '', '', ''],
    COLS1, ...dataRows1,
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
      else { const dr = ri - 4; if (ci === 0) s = numS(dr); else if (ci === 6) s = statusS(String(val ?? '')); else if (ci === 7) s = statusS(String(val ?? '')); else if (ci === 10) s = statusS(String(val ?? '')); else if (ci >= 4 && ci <= 5) s = cellS(dr, 'center'); else s = cellS(dr); }
      (ws1[addr] as XLSXStyle.CellObject).s = s;
    });
  });
  ws1['!cols'] = [{ wch: 4 }, { wch: 24 }, { wch: 18 }, { wch: 22 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 22 }, { wch: 18 }, { wch: 8 }, { wch: 32 }];
  if (!ws1['!rows']) ws1['!rows'] = [];
  (ws1['!rows'] as XLSXStyle.RowInfo[])[0] = { hpt: 30 }; (ws1['!rows'] as XLSXStyle.RowInfo[])[1] = { hpt: 22 }; (ws1['!rows'] as XLSXStyle.RowInfo[])[2] = { hpt: 22 }; (ws1['!rows'] as XLSXStyle.RowInfo[])[3] = { hpt: 24 };
  XLSXStyle.utils.book_append_sheet(wb, ws1, 'Muayene Listesi');

  // ── Sayfa 2 ──
  const firmaOzet = firmalar.filter(f => !('silinmis' in f) || !(f as { silinmis?: boolean }).silinmis).map(f => { const fps = aktif.filter(m => m.firmaId === f.id); return [f.ad, fps.length, fps.filter(m => m.sonuc === 'Çalışabilir').length, fps.filter(m => m.sonuc === 'Kısıtlı Çalışabilir').length, fps.filter(m => m.sonuc === 'Çalışamaz').length, fps.filter(m => getDaysUntil(m.sonrakiTarih) < 0).length]; }).filter(r => (r[1] as number) > 0).sort((a, b) => (b[1] as number) - (a[1] as number));
  const COLS2 = ['Firma Adı', 'Toplam', 'Çalışabilir', 'Kısıtlı', 'Çalışamaz', 'Süresi Geçmiş'];
  const ws2Rows = [['FİRMA BAZLI SAĞLIK ÖZETİ', '', '', '', '', ''], COLS2, ...firmaOzet, ['TOPLAM', aktif.length, calisabilir, kisitli, calisamaz, gecmis], ['', '', '', '', '', ''], ['Rapor Tarihi', new Date().toLocaleDateString('tr-TR'), '', '', '', '']];
  const ws2 = XLSXStyle.utils.aoa_to_sheet(ws2Rows);
  if (!ws2['!merges']) ws2['!merges'] = [];
  ws2['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } });
  ws2Rows.forEach((row, ri) => {
    (row as (string | number)[]).forEach((val, ci) => {
      const addr = XLSXStyle.utils.encode_cell({ r: ri, c: ci });
      if (!ws2[addr]) ws2[addr] = { v: val ?? '', t: typeof val === 'number' ? 'n' : 's' };
      const totalRowIdx = 2 + firmaOzet.length;
      let s: object = cellS(ri - 2);
      if (ri === 0) s = titleS; else if (ri === 1) s = headerS; else if (ri === totalRowIdx) s = totalS;
      else if (ri > 1 && ri < totalRowIdx) { const dr = ri - 2; s = ci === 0 ? cellS(dr) : { font: { bold: true, sz: 11, color: { rgb: '1E293B' }, name: 'Calibri' }, fill: { fgColor: { rgb: dr % 2 === 0 ? ROW_NORMAL : ROW_ALT } }, alignment: { horizontal: 'center', vertical: 'center' }, border: thinB }; }
      (ws2[addr] as XLSXStyle.CellObject).s = s;
    });
  });
  ws2['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 16 }];
  if (!ws2['!rows']) ws2['!rows'] = []; (ws2['!rows'] as XLSXStyle.RowInfo[])[0] = { hpt: 28 }; (ws2['!rows'] as XLSXStyle.RowInfo[])[1] = { hpt: 22 };
  XLSXStyle.utils.book_append_sheet(wb, ws2, 'Firma Özeti');

  // ── Sayfa 3 ──
  const kritikler = aktif.filter(m => m.sonrakiTarih).map(m => { const diff = getDaysUntil(m.sonrakiTarih); const personel = personeller.find(p => p.id === m.personelId); const firma = firmalar.find(f => f.id === m.firmaId); return { m, diff, personel, firma }; }).filter(x => x.diff <= 30).sort((a, b) => a.diff - b.diff);
  const COLS3 = ['Personel', 'Görev', 'Firma', 'Sonraki Muayene', 'Kalan Gün', 'Sonuç'];
  const kritikData = kritikler.map(x => [x.personel?.adSoyad || '-', x.personel?.gorev || '-', x.firma?.ad || '-', fmtDate(x.m.sonrakiTarih), x.diff < 0 ? `${Math.abs(x.diff)} gün gecikmiş` : x.diff === 0 ? 'BUGÜN' : `${x.diff} gün kaldı`, x.m.sonuc]);
  const ws3Rows = [['YAKLAŞAN & GECİKMİŞ MUAYENELER (30 Gün İçinde)', '', '', '', '', ''], COLS3, ...(kritikData.length > 0 ? kritikData : [['Yaklaşan veya gecikmiş muayene bulunmuyor.', '', '', '', '', '']])];
  const ws3 = XLSXStyle.utils.aoa_to_sheet(ws3Rows);
  if (!ws3['!merges']) ws3['!merges'] = [];
  ws3['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: COLS3.length - 1 } });
  ws3Rows.forEach((row, ri) => {
    (row as (string | number)[]).forEach((val, ci) => {
      const addr = XLSXStyle.utils.encode_cell({ r: ri, c: ci });
      if (!ws3[addr]) ws3[addr] = { v: val ?? '', t: typeof val === 'number' ? 'n' : 's' };
      let s: object = cellS(ri - 2);
      if (ri === 0) s = titleS; else if (ri === 1) s = headerS;
      else { const dr = ri - 2; if (ci === 4 || ci === 5) s = statusS(String(val ?? '')); else if (ci === 3) s = cellS(dr, 'center'); else s = cellS(dr); }
      (ws3[addr] as XLSXStyle.CellObject).s = s;
    });
  });
  ws3['!cols'] = [{ wch: 24 }, { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 22 }, { wch: 16 }];
  if (!ws3['!rows']) ws3['!rows'] = []; (ws3['!rows'] as XLSXStyle.RowInfo[])[0] = { hpt: 28 }; (ws3['!rows'] as XLSXStyle.RowInfo[])[1] = { hpt: 22 };
  XLSXStyle.utils.book_append_sheet(wb, ws3, 'Kritik Muayeneler');

  const xlsxData = XLSXStyle.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([xlsxData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `${new Date().toLocaleDateString('tr-TR')} Sağlık Muayeneleri Raporu.xlsx`;
  document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
}

export default function MuayenelerPage() {
  const { muayeneler, evraklar, personeller, firmalar, addMuayene, updateMuayene, deleteMuayene, addToast, quickCreate, setQuickCreate, org, refreshData } = useApp();

  const [search, setSearch] = useState('');
  const [firmaFilter, setFirmaFilter] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Muayene, 'id' | 'olusturmaTarihi'>>(defaultForm);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [belgeLoading, setBelgeLoading] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  useEffect(() => {
    if (quickCreate === 'muayeneler') {
      setEditId(null);
      setForm(defaultForm);
      setShowModal(true);
      setQuickCreate(null);
    }
  }, [quickCreate, setQuickCreate]);

  // Bildirimden gelen kayıt açma
  useEffect(() => {
    const handleOpenRecord = (e: Event) => {
      const detail = (e as CustomEvent).detail as { module: string; recordId: string };
      if (detail.module !== 'muayeneler') return;
      const m = muayeneler.find(x => x.id === detail.recordId);
      if (m) openEdit(m);
    };
    window.addEventListener('isg_open_record', handleOpenRecord);
    try {
      const saved = localStorage.getItem('isg_open_record');
      if (saved) {
        const { module, recordId, ts } = JSON.parse(saved);
        if (module === 'muayeneler' && recordId && Date.now() - ts < 5000) {
          const m = muayeneler.find(x => x.id === recordId);
          if (m) { openEdit(m); localStorage.removeItem('isg_open_record'); }
        }
      }
    } catch { /* ignore */ }
    return () => window.removeEventListener('isg_open_record', handleOpenRecord);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muayeneler]);

  const filteredPersoneller = useMemo(
    () => form.firmaId ? personeller.filter(p => p.firmaId === form.firmaId && p.durum === 'Aktif' && !p.silinmis) : personeller.filter(p => p.durum === 'Aktif' && !p.silinmis),
    [personeller, form.firmaId]
  );

  const filtered = useMemo(() => {
    return muayeneler
      .filter(m => {
        if (m.silinmis) return false;
        const personel = personeller.find(p => p.id === m.personelId);
        const firma = firmalar.find(f => f.id === m.firmaId);
        const q = search.toLowerCase();
        const matchSearch = !q || (personel?.adSoyad.toLowerCase().includes(q) ?? false) || (firma?.ad.toLowerCase().includes(q) ?? false);
        const matchFirma = !firmaFilter || m.firmaId === firmaFilter;
        return matchSearch && matchFirma;
      })
      .sort((a, b) => {
        const ta = a.olusturmaTarihi ?? '';
        const tb = b.olusturmaTarihi ?? '';
        return tb.localeCompare(ta);
      });
  }, [muayeneler, personeller, firmalar, search, firmaFilter]);

  // Sağlık kategorisindeki evraklar (EK-2, Sağlık Raporu vb.)
  // Üç katmanlı kontrol: kayıtlı kategori → tur direkt eşleşme → keyword fallback
  const SAGLIK_TURLERI = ['EK-2', 'Sağlık Raporu', 'ek-2', 'sağlık raporu', 'saglik raporu'];
  const saglikEvraklar = useMemo(() => {
    return evraklar.filter(e => {
      if (e.silinmis) return false;
      if (e.kategori === 'saglik') return true;
      if (SAGLIK_TURLERI.some(t => e.tur?.toLowerCase() === t.toLowerCase())) return true;
      return getEvrakKategori(e.tur ?? '', e.ad ?? '') === 'saglik';
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evraklar]);

  // Filtrelenmiş sağlık evrakları
  const filteredSaglikEvraklar = useMemo(() => {
    return saglikEvraklar.filter(e => {
      const personel = personeller.find(p => p.id === e.personelId);
      const firma = firmalar.find(f => f.id === e.firmaId);
      const q = search.toLowerCase();
      const matchSearch = !q
        || (personel?.adSoyad.toLowerCase().includes(q) ?? false)
        || (firma?.ad.toLowerCase().includes(q) ?? false)
        || e.ad.toLowerCase().includes(q);
      const matchFirma = !firmaFilter || e.firmaId === firmaFilter;
      return matchSearch && matchFirma;
    });
  }, [saglikEvraklar, personeller, firmalar, search, firmaFilter]);

  const aktifMuayeneler = useMemo(() => muayeneler.filter(m => !m.silinmis), [muayeneler]);
  const stats = useMemo(() => {
    const total = aktifMuayeneler.length;
    const uygun = aktifMuayeneler.filter(m => m.sonuc === 'Çalışabilir').length;
    const yaklasan = aktifMuayeneler.filter(m => { const d = getDaysUntil(m.sonrakiTarih); return d >= 0 && d <= 30; }).length;
    const gecmis = aktifMuayeneler.filter(m => getDaysUntil(m.sonrakiTarih) < 0).length;
    return { total, uygun, yaklasan, gecmis };
  }, [aktifMuayeneler]);

  const allSelected = filtered.length > 0 && filtered.every(m => selectedIds.has(m.id));
  const toggleAll = () => allSelected ? setSelectedIds(new Set()) : setSelectedIds(new Set(filtered.map(m => m.id)));
  const toggleOne = (id: string) => setSelectedIds(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const handleBulkDelete = () => {
    Array.from(selectedIds).forEach(id => deleteMuayene(id));
    addToast(`${selectedIds.size} sağlık kaydı silindi.`, 'success');
    setSelectedIds(new Set());
    setBulkDeleteConfirm(false);
  };

  const openAdd = () => { setEditId(null); setForm(defaultForm); setPendingFile(null); setShowModal(true); };
  const openEdit = (m: Muayene) => {
    setEditId(m.id);
    setPendingFile(null);
    setForm({
      personelId: m.personelId, firmaId: m.firmaId, muayeneTarihi: m.muayeneTarihi,
      sonrakiTarih: m.sonrakiTarih, sonuc: m.sonuc, hastane: m.hastane,
      doktor: m.doktor, notlar: m.notlar, belgeMevcut: m.belgeMevcut,
      dosyaAdi: m.dosyaAdi || '', dosyaBoyutu: m.dosyaBoyutu || 0,
      dosyaTipi: m.dosyaTipi || '', dosyaVeri: '',
    });
    setShowModal(true);
  };

  const handleFileChange = (file?: File) => {
    if (!file) return;
    const err = validateFile(file, 10);
    if (err) { addToast(err, 'error'); return; }
    setPendingFile(file);
    setForm(p => ({
      ...p, dosyaAdi: file.name, dosyaBoyutu: file.size,
      dosyaTipi: file.type, belgeMevcut: true,
    }));
  };

  const handleSave = async () => {
    if (!form.personelId) { addToast('Personel seçimi zorunludur.', 'error'); return; }
    if (!form.muayeneTarihi) { addToast('Muayene tarihi zorunludur.', 'error'); return; }

    const orgId = org?.id ?? 'unknown';
    setUploading(true);

    try {
      if (editId) {
        // Düzenleme: dosya varsa önce yükle
        if (pendingFile) {
          const url = await uploadFileToStorage(pendingFile, orgId, 'saglik', editId);
          if (!url) {
            addToast('Dosya yüklenemedi. Lütfen tekrar deneyin.', 'error');
            return;
          }
          updateMuayene(editId, { ...form, dosyaUrl: url });
        } else {
          updateMuayene(editId, form);
        }
        addToast('Sağlık evrakı güncellendi.', 'success');
      } else {
        // Yeni kayıt: dosya varsa önce yükle, sonra kayıt oluştur
        if (pendingFile) {
          const tempId = crypto.randomUUID();
          const url = await uploadFileToStorage(pendingFile, orgId, 'saglik', tempId);
          if (!url) {
            addToast('Dosya yüklenemedi. Kayıt oluşturulmadı.', 'error');
            return;
          }
          addMuayene({ ...form, dosyaUrl: url });
        } else {
          addMuayene(form);
        }
        addToast('Sağlık evrakı eklendi.', 'success');
      }
      setPendingFile(null);
      setShowModal(false);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteMuayene(deleteId);
    // Eğer silinen kayıt görüntüleniyorsa modalı kapat
    if (viewId === deleteId) setViewId(null);
    addToast('Sağlık evrakı silindi.', 'success');
    setDeleteId(null);
  };

  const handleViewFile = async (m: Muayene) => {
    if (!m.dosyaUrl) return;
    setBelgeLoading(m.id);
    try {
      const signedUrl = await getSignedUrlFromPath(m.dosyaUrl, 'uploads');
      if (!signedUrl) {
        addToast('Dosya açılamadı. Lütfen tekrar deneyin.', 'error');
        return;
      }
      window.open(signedUrl, '_blank');
    } finally {
      setBelgeLoading(null);
    }
  };

  const handleDownloadFile = async (m: Muayene) => {
    if (!m.dosyaUrl) return;
    setBelgeLoading(m.id);
    try {
      const signedUrl = await getSignedUrlFromPath(m.dosyaUrl, 'uploads');
      if (!signedUrl) {
        addToast('Dosya indirilemedi. Lütfen tekrar deneyin.', 'error');
        return;
      }
      const ok = await downloadFromUrl(signedUrl, m.dosyaAdi || 'belge');
      if (!ok) addToast('Dosya indirilemedi.', 'error');
    } finally {
      setBelgeLoading(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Sağlık Evrakları</h2>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>Personel sağlık muayene kayıtlarını takip edin</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button
            onClick={async () => {
              setRefreshing(true);
              await refreshData();
              setRefreshing(false);
            }}
            disabled={refreshing}
            className="btn-secondary whitespace-nowrap"
            title="Verileri yenile"
          >
            <i className={`ri-refresh-line mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Yenileniyor...' : 'Yenile'}
          </button>
          <button onClick={() => exportMuayenelerToExcel(muayeneler, firmalar, personeller)} className="btn-secondary whitespace-nowrap">
            <i className="ri-file-excel-2-line mr-1" />Excel Raporu İndir
          </button>
          <button onClick={openAdd} className="btn-primary whitespace-nowrap">
            <i className="ri-add-line" /> Sağlık Evrakı Ekle
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Toplam Kayıt', value: stats.total, icon: 'ri-heart-pulse-line', color: '#F43F5E', bg: 'rgba(244,63,94,0.1)' },
          { label: 'Çalışabilir', value: stats.uygun, icon: 'ri-checkbox-circle-line', color: '#34D399', bg: 'rgba(52,211,153,0.1)' },
          { label: 'Yaklaşan Kontrol', value: stats.yaklasan, icon: 'ri-time-line', color: '#FBBF24', bg: 'rgba(251,191,36,0.1)' },
          { label: 'Süresi Geçmiş', value: stats.gecmis, icon: 'ri-alert-line', color: '#F87171', bg: 'rgba(248,113,113,0.1)' },
        ].map(s => (
          <div key={s.label} className="isg-card rounded-xl p-4 flex items-center gap-4">
            <div className="w-11 h-11 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: s.bg }}>
              <i className={`${s.icon} text-xl`} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
              <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="relative flex-1 min-w-[200px]">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#475569' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Personel veya firma ara..."
            className="isg-input pl-9"
          />
        </div>
        <select
          value={firmaFilter}
          onChange={e => setFirmaFilter(e.target.value)}
          className="isg-input"
          style={{ minWidth: '180px' }}
        >
          <option value="">Tüm Firmalar</option>
          {firmalar.filter(f => !f.silinmis).map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="isg-card rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.15)' }}>
              <i className="ri-heart-pulse-line text-3xl" style={{ color: '#F43F5E' }} />
            </div>
            <p className="font-semibold" style={{ color: 'var(--text-muted)' }}>Sağlık evrakı kaydı bulunamadı</p>
            <p className="text-sm mt-2" style={{ color: 'var(--text-faint)' }}>Yeni kayıt eklemek için butonu kullanın</p>
            <button onClick={openAdd} className="btn-primary mt-5"><i className="ri-add-line" /> Sağlık Evrakı Ekle</button>
          </div>
        ) : (
          <>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-2.5 flex-wrap" style={{ background: 'rgba(99,102,241,0.08)', borderBottom: '1px solid rgba(99,102,241,0.2)' }}>
              <span className="text-sm font-semibold" style={{ color: '#818CF8' }}>{selectedIds.size} kayıt seçildi</span>
              <button onClick={() => setBulkDeleteConfirm(true)} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                <i className="ri-delete-bin-line" /> Seçilenleri Sil
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="text-xs px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap ml-auto" style={{ background: 'rgba(100,116,139,0.1)', color: '#94A3B8' }}>Seçimi Kaldır</button>
            </div>
          )}

          {/* Mobil kart görünümü */}
          <div className="md:hidden divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {filtered.map(m => {
              const personel = personeller.find(p => p.id === m.personelId);
              const firma = firmalar.find(f => f.id === m.firmaId);
              const rc = RESULT_CONFIG[m.sonuc];
              const days = getDaysUntil(m.sonrakiTarih);
              const isOverdue = days < 0;
              const isUrgent = days >= 0 && days <= 30;
              return (
                <div key={m.id} className="p-4" style={{ background: selectedIds.has(m.id) ? 'rgba(99,102,241,0.04)' : undefined }}>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" checked={selectedIds.has(m.id)} onChange={() => toggleOne(m.id)} className="cursor-pointer mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{personel?.adSoyad || '—'}</p>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold whitespace-nowrap flex-shrink-0" style={{ background: rc.bg, color: rc.color }}>
                          <i className={rc.icon} />{rc.label}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{personel?.gorev || ''} {firma ? `· ${firma.ad}` : ''}</p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {m.muayeneTarihi && <span className="text-xs" style={{ color: 'var(--text-faint)' }}>Muayene: {new Date(m.muayeneTarihi).toLocaleDateString('tr-TR')}</span>}
                        {m.sonrakiTarih && (
                          <span className={`text-xs font-medium ${isOverdue ? 'text-red-400' : isUrgent ? 'text-yellow-400' : ''}`} style={!isOverdue && !isUrgent ? { color: 'var(--text-faint)' } : {}}>
                            Sonraki: {new Date(m.sonrakiTarih).toLocaleDateString('tr-TR')}
                            {isOverdue && ' ⚠'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 justify-end mt-2">
                    {m.dosyaUrl && <button onClick={() => handleViewFile(m)} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(96,165,250,0.1)', color: '#60A5FA' }} title="Görüntüle"><i className="ri-eye-line text-sm" /></button>}
                    <button onClick={() => openEdit(m)} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6' }} title="Düzenle"><i className="ri-edit-line text-sm" /></button>
                    <button onClick={() => setDeleteId(m.id)} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }} title="Sil"><i className="ri-delete-bin-line text-sm" /></button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Masaüstü tablo görünümü */}
          <div className="hidden md:block overflow-x-auto">
            <table className="table-premium w-full">
              <thead>
                <tr>
                  <th className="w-10 text-center">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="cursor-pointer" />
                  </th>
                  <th className="text-left">Personel</th>
                  <th className="text-left hidden md:table-cell">Firma</th>
                  <th className="text-left hidden sm:table-cell">Muayene Tarihi</th>
                  <th className="text-left hidden lg:table-cell">Sonraki Muayene</th>
                  <th className="text-left hidden lg:table-cell">Hastane / Doktor</th>
                  <th className="text-left">Sonuç</th>
                  <th className="text-left hidden md:table-cell">Belge</th>
                  <th className="text-right w-20">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => {
                  const personel = personeller.find(p => p.id === m.personelId);
                  const firma = firmalar.find(f => f.id === m.firmaId);
                  const rc = RESULT_CONFIG[m.sonuc];
                  const days = getDaysUntil(m.sonrakiTarih);
                  const isOverdue = days < 0;
                  const isUrgent = days >= 0 && days <= 30;
                  // Dosya durumu: dosyaAdi var ama dosyaUrl yoksa "yüklenemedi"
                  const hasFileError = m.dosyaAdi && !m.dosyaUrl;
                  return (
                    <tr key={m.id} style={{ background: selectedIds.has(m.id) ? 'rgba(99,102,241,0.04)' : undefined }}>
                      <td className="text-center">
                        <input type="checkbox" checked={selectedIds.has(m.id)} onChange={() => toggleOne(m.id)} className="cursor-pointer" />
                      </td>
                      <td>
                        <div>
                          <p className="font-semibold text-sm truncate max-w-[150px]" style={{ color: 'var(--text-primary)' }}>{personel?.adSoyad || '—'}</p>
                          <p className="text-xs mt-0.5 truncate max-w-[150px]" style={{ color: '#475569' }}>{personel?.gorev || ''}</p>
                        </div>
                      </td>
                      <td className="hidden md:table-cell"><span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{firma?.ad || '—'}</span></td>
                      <td className="hidden sm:table-cell"><span className="text-sm" style={{ color: 'var(--text-muted)' }}>{m.muayeneTarihi ? new Date(m.muayeneTarihi).toLocaleDateString('tr-TR') : '—'}</span></td>
                      <td className="hidden lg:table-cell">
                        <div>
                          <span className={`text-sm ${isOverdue ? 'text-red-400' : isUrgent ? 'text-yellow-400' : ''}`} style={!isOverdue && !isUrgent ? { color: 'var(--text-muted)' } : {}}>
                            {m.sonrakiTarih ? new Date(m.sonrakiTarih).toLocaleDateString('tr-TR') : '—'}
                          </span>
                          {isOverdue && <p className="text-[10px] text-red-500 mt-0.5">Gecikmiş!</p>}
                          {isUrgent && !isOverdue && <p className="text-[10px] text-yellow-500 mt-0.5">{days} gün kaldı</p>}
                        </div>
                      </td>
                      <td className="hidden lg:table-cell">
                        <div>
                          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{m.hastane || '—'}</p>
                          {m.doktor && <p className="text-xs mt-0.5" style={{ color: '#475569' }}>Dr. {m.doktor}</p>}
                        </div>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap" style={{ background: rc.bg, color: rc.color }}>
                          <i className={rc.icon} />{rc.label}
                        </span>
                      </td>
                      <td className="hidden md:table-cell">
                        {hasFileError ? (
                          <button
                            onClick={() => openEdit(m)}
                            className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg cursor-pointer whitespace-nowrap transition-all"
                            style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}
                            title="Dosya yüklenmemiş — düzenleyerek ekleyin"
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.2)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.1)'; }}
                          >
                            <i className="ri-upload-2-line" />Belge Ekle
                          </button>
                        ) : m.dosyaUrl ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg" style={{ background: 'rgba(52,211,153,0.1)', color: '#34D399' }}>
                            <i className="ri-file-check-line" />Mevcut
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>Yok</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5 justify-end">
                          {m.dosyaUrl && (
                            <>
                              <button
                                onClick={() => handleViewFile(m)}
                                disabled={belgeLoading === m.id}
                                className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all disabled:opacity-50"
                                style={{ background: 'rgba(96,165,250,0.1)', color: '#60A5FA' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(96,165,250,0.2)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(96,165,250,0.1)'; }}
                                title="Görüntüle"
                              >
                                {belgeLoading === m.id
                                  ? <i className="ri-loader-4-line animate-spin text-sm" />
                                  : <i className="ri-eye-line text-sm" />}
                              </button>
                              <button
                                onClick={() => handleDownloadFile(m)}
                                disabled={belgeLoading === m.id}
                                className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all disabled:opacity-50"
                                style={{ background: 'rgba(52,211,153,0.1)', color: '#34D399' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.2)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.1)'; }}
                                title="İndir"
                              >
                                {belgeLoading === m.id
                                  ? <i className="ri-loader-4-line animate-spin text-sm" />
                                  : <i className="ri-download-line text-sm" />}
                              </button>
                            </>
                          )}
                          <button onClick={() => openEdit(m)} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all" style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.2)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.1)'; }} title="Düzenle"><i className="ri-edit-line text-sm" /></button>
                          <button onClick={() => setDeleteId(m.id)} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }} title="Sil"><i className="ri-delete-bin-line text-sm" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {/* ── Sağlık Evrakları — sadece veri varsa göster ── */}
      {filteredSaglikEvraklar.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: 'rgba(248,113,113,0.12)' }}>
              <i className="ri-file-text-line text-sm" style={{ color: '#F87171' }} />
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Sağlık Evrakları</h3>
              <p className="text-xs" style={{ color: '#64748B' }}>EK-2, Sağlık Raporu ve sağlık kategorisindeki tüm belgeler</p>
            </div>
            <span
              className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(248,113,113,0.12)', color: '#F87171', border: '1px solid rgba(248,113,113,0.2)' }}
            >
              {filteredSaglikEvraklar.length}
            </span>
          </div>

          <div className="isg-card rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table-premium w-full">
                <thead>
                  <tr>
                    <th className="text-left">Evrak Adı / Tür</th>
                    <th className="text-left hidden md:table-cell">Personel</th>
                    <th className="text-left hidden md:table-cell">Firma</th>
                    <th className="text-left">Durum</th>
                    <th className="text-left hidden lg:table-cell">Geçerlilik</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSaglikEvraklar.map(ev => {
                    const personel = personeller.find(p => p.id === ev.personelId);
                    const firma = firmalar.find(f => f.id === ev.firmaId);
                    return (
                      <tr key={ev.id}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.2)' }}>
                              <i className="ri-file-text-line text-xs" style={{ color: '#F87171' }} />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-200">{ev.ad}</p>
                              <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{ev.tur}</p>
                            </div>
                          </div>
                        </td>
                        <td className="hidden md:table-cell">
                          <p className="text-sm text-slate-300">{personel?.adSoyad || <span className="italic" style={{ color: '#475569' }}>Firma Evrakı</span>}</p>
                        </td>
                        <td className="hidden md:table-cell">
                          <p className="text-sm text-slate-400">{firma?.ad || '—'}</p>
                        </td>
                        <td>
                          <Badge label={ev.durum} color={getEvrakStatusColor(ev.durum)} />
                        </td>
                        <td className="hidden lg:table-cell">
                          <p className="text-sm text-slate-400">
                            {ev.gecerlilikTarihi ? new Date(ev.gecerlilikTarihi).toLocaleDateString('tr-TR') : '—'}
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Modal */}
      <Modal
        isOpen={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        title="Toplu Silme"
        size="sm"
        icon="ri-delete-bin-2-line"
        footer={
          <>
            <button onClick={() => setBulkDeleteConfirm(false)} className="btn-secondary whitespace-nowrap">İptal</button>
            <button onClick={handleBulkDelete} className="btn-danger whitespace-nowrap">
              <i className="ri-delete-bin-line" /> {selectedIds.size} Kaydı Sil
            </button>
          </>
        }
      >
        <div className="py-2">
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl mb-4" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <i className="ri-error-warning-line text-xl" style={{ color: '#EF4444' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: '#E2E8F0' }}>
            <strong>{selectedIds.size}</strong> sağlık kaydı silinecek.
          </p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>Bu işlem geri alınamaz.</p>
        </div>
      </Modal>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { if (!uploading) setShowModal(false); }}
        title={editId ? 'Sağlık Evrakı Düzenle' : 'Yeni Sağlık Evrakı Ekle'}
        size="lg"
        icon="ri-heart-pulse-line"
        footer={
          <>
            <button onClick={() => { if (!uploading) setShowModal(false); }} disabled={uploading} className="btn-secondary whitespace-nowrap disabled:opacity-50">İptal</button>
            <button onClick={handleSave} disabled={uploading} className="btn-primary whitespace-nowrap">
              {uploading ? (
                <><i className="ri-loader-4-line animate-spin" /> Yükleniyor...</>
              ) : (
                <><i className={editId ? 'ri-save-line' : 'ri-add-line'} />{editId ? 'Güncelle' : 'Ekle'}</>
              )}
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
            <label className="form-label">Personel *</label>
            <select value={form.personelId} onChange={e => setForm(p => ({ ...p, personelId: e.target.value }))} className="isg-input">
              <option value="">Personel Seçin</option>
              {filteredPersoneller.map(p => <option key={p.id} value={p.id}>{p.adSoyad}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Muayene Tarihi *</label>
            <input type="date" value={form.muayeneTarihi} onChange={e => setForm(p => ({ ...p, muayeneTarihi: e.target.value }))} className="isg-input" />
          </div>
          <div>
            <label className="form-label">Sonraki Muayene Tarihi</label>
            <input type="date" value={form.sonrakiTarih} onChange={e => setForm(p => ({ ...p, sonrakiTarih: e.target.value }))} className="isg-input" />
          </div>
          <div>
            <label className="form-label">Hastane / Klinik</label>
            <input value={form.hastane} onChange={e => setForm(p => ({ ...p, hastane: e.target.value }))} placeholder="Hastane adı" className="isg-input" />
          </div>
          <div>
            <label className="form-label">Doktor</label>
            <input value={form.doktor} onChange={e => setForm(p => ({ ...p, doktor: e.target.value }))} placeholder="Doktor adı" className="isg-input" />
          </div>
          <div>
            <label className="form-label">Muayene Sonucu</label>
            <select value={form.sonuc} onChange={e => setForm(p => ({ ...p, sonuc: e.target.value as MuayeneResult }))} className="isg-input">
              {Object.keys(RESULT_CONFIG).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Belge Mevcut mu?</label>
            <div className="flex items-center gap-4 mt-2">
              {[true, false].map(v => (
                <label key={String(v)} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={form.belgeMevcut === v} onChange={() => setForm(p => ({ ...p, belgeMevcut: v }))} style={{ accentColor: '#3B82F6' }} />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{v ? 'Evet' : 'Hayır'}</span>
                </label>
              ))}
            </div>
          </div>
          {form.belgeMevcut && (
            <div className="sm:col-span-2">
              <label className="form-label">Belge Dosyası (PDF / JPG / PNG — Maks. 10MB)</label>
              <div
                className="rounded-xl p-5 text-center cursor-pointer transition-all duration-200"
                style={{ border: '2px dashed rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}
                onClick={() => fileRef.current?.click()}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)'; e.currentTarget.style.background = 'rgba(59,130,246,0.04)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleFileChange(e.dataTransfer.files[0]); }}
              >
                {form.dosyaAdi ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ background: 'rgba(16,185,129,0.12)' }}>
                      <i className="ri-file-check-line text-lg" style={{ color: '#10B981' }} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-slate-200">{form.dosyaAdi}</p>
                      <p className="text-xs" style={{ color: '#475569' }}>{form.dosyaBoyutu ? `${(form.dosyaBoyutu / 1024).toFixed(1)} KB` : ''}</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); setPendingFile(null); setForm(p => ({ ...p, dosyaAdi: '', dosyaBoyutu: 0, dosyaTipi: '', dosyaVeri: '' })); }} className="ml-2 w-6 h-6 flex items-center justify-center rounded-full cursor-pointer" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>
                      <i className="ri-close-line text-xs" />
                    </button>
                  </div>
                ) : (
                  <>
                    <i className="ri-upload-cloud-2-line text-2xl mb-2" style={{ color: '#334155' }} />
                    <p className="text-sm text-slate-400">Dosyayı buraya sürükleyin veya tıklayın</p>
                    <p className="text-xs mt-1" style={{ color: '#334155' }}>PDF, JPG, PNG — Maks. 10MB</p>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => handleFileChange(e.target.files?.[0])} />
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="form-label">Notlar</label>
            <textarea value={form.notlar} onChange={e => setForm(p => ({ ...p, notlar: e.target.value }))} placeholder="Ek notlar..." rows={3} maxLength={500} className="isg-input" />
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal
        isOpen={!!deleteId}
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
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl mb-4" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <i className="ri-error-warning-line text-xl" style={{ color: '#EF4444' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: '#E2E8F0' }}>Bu sağlık muayene kaydını silmek istediğinizden emin misiniz?</p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>Bu işlem geri alınamaz.</p>
        </div>
      </Modal>
    </div>
  );
}
