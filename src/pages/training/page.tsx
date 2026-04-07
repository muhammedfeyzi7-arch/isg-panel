import { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import type { Egitim, EgitimStatus } from '../../types';
import Modal from '../../components/base/Modal';
import Badge from '../../components/base/Badge';
import XLSXStyle from 'xlsx-js-style';
import { uploadFileToStorage, downloadFromUrl, validateFile, getSignedUrlFromPath } from '@/utils/fileUpload';

const EGITIM_TURLERI = [
  'İşe Giriş ve Oryantasyon Eğitimi',
  'İSG Temel Eğitimi',
  'Yangın Güvenliği Eğitimi',
  'İlk Yardım Eğitimi',
  'Kişisel Koruyucu Donanım Eğitimi',
  'Acil Durum ve Tahliye Eğitimi',
  'Tehlikeli Madde Eğitimi',
  'Yüksekte Çalışma Güvenliği',
  'Elektrik Güvenliği Eğitimi',
  'Diğer',
];

const STATUS_CFG: Record<EgitimStatus, { color: string; bg: string; border: string; icon: string; label: string }> = {
  'Planlandı': { color: '#60A5FA', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.2)', icon: 'ri-time-line', label: 'Bekliyor' },
  'Tamamlandı': { color: '#34D399', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.2)', icon: 'ri-file-check-line', label: 'Evrak Yüklendi' },
  'Eksik': { color: '#F97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.2)', icon: 'ri-error-warning-line', label: 'Evrak Eksik' },
};

function getStatusColor(s: string): 'sky' | 'green' | 'amber' {
  if (s === 'Tamamlandı') return 'green';
  if (s === 'Eksik') return 'amber';
  return 'sky';
}

// downloadFromDataUrl → fileUpload utility'ye taşındı

function exportEgitimlerToExcel(
  egitimler: Egitim[],
  firmalar: { id: string; ad: string }[],
  personeller: { id: string; adSoyad: string }[],
): void {
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('tr-TR') : '-';
  const aktif = egitimler.filter(e => !e.silinmis);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tarih = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
  const tamamlandi = aktif.filter(e => e.durum === 'Tamamlandı').length;
  const planlandi = aktif.filter(e => e.durum === 'Planlandı').length;
  const eksik = aktif.filter(e => e.durum === 'Eksik').length;

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
    if (sl.includes('tamamlandı') || sl === 'var') { fg = '16A34A'; bg = 'DCFCE7'; }
    else if (sl.includes('dolmuş') || sl === 'yok') { fg = 'DC2626'; bg = 'FEE2E2'; }
    else if (sl.includes('kritik') || sl.includes('kaldı') || sl === 'bugün') { fg = 'D97706'; bg = 'FEF3C7'; }
    else if (sl.includes('yaklaşıyor') || sl.includes('eksik') || sl.includes('bekliyor') || sl.includes('planlandı')) { fg = 'EA580C'; bg = 'FFEDD5'; }
    return { font: { bold: true, sz: 10, color: { rgb: fg }, name: 'Calibri' }, fill: { fgColor: { rgb: bg } }, alignment: { horizontal: 'center', vertical: 'center' }, border: thinB };
  };

  const wb = XLSXStyle.utils.book_new();

  // ── Sayfa 1 ──
  const COLS1 = ['#', 'Eğitim Türü / Adı', 'Firma', 'Tarih', 'Katılımcı', 'Katılımcılar', 'Geçerlilik', 'Durum', 'Belge', 'Açıklama'];
  const dataRows1 = aktif.map((e, i) => {
    const firma = firmalar.find(f => f.id === e.firmaId);
    const ids = e.katilimciIds ?? [];
    const katilimcilar = ids.map(id => personeller.find(p => p.id === id)?.adSoyad).filter(Boolean).join(', ');
    return [i + 1, e.ad || '-', firma?.ad || '-', fmtDate(e.tarih), ids.length, katilimcilar || '-', e.gecerlilikSuresi ? `${e.gecerlilikSuresi} ay` : 'Süresiz', e.durum, e.belgeDosyaAdi ? 'Var' : 'Yok', e.aciklama || '-'];
  });
  const ws1Rows = [
    [`ISG EĞİTİM RAPORU — ${new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}`, ...Array(COLS1.length - 1).fill('')],
    ['Toplam', 'Tamamlandı', 'Bekliyor', 'Eksik', '', '', '', '', '', ''],
    [aktif.length, tamamlandi, planlandi, eksik, '', '', '', '', '', ''],
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
      else { const dr = ri - 4; if (ci === 0) s = numS(dr); else if (ci === 7) s = statusS(String(val ?? '')); else if (ci === 8) s = statusS(String(val ?? '')); else if (ci === 3 || ci === 4) s = cellS(dr, 'center'); else s = cellS(dr); }
      (ws1[addr] as XLSXStyle.CellObject).s = s;
    });
  });
  ws1['!cols'] = [{ wch: 4 }, { wch: 32 }, { wch: 24 }, { wch: 14 }, { wch: 10 }, { wch: 40 }, { wch: 14 }, { wch: 16 }, { wch: 8 }, { wch: 36 }];
  if (!ws1['!rows']) ws1['!rows'] = [];
  (ws1['!rows'] as XLSXStyle.RowInfo[])[0] = { hpt: 30 }; (ws1['!rows'] as XLSXStyle.RowInfo[])[1] = { hpt: 22 }; (ws1['!rows'] as XLSXStyle.RowInfo[])[2] = { hpt: 22 }; (ws1['!rows'] as XLSXStyle.RowInfo[])[3] = { hpt: 24 };
  XLSXStyle.utils.book_append_sheet(wb, ws1, 'Eğitim Listesi');

  // ── Sayfa 2 ──
  const firmaOzet = firmalar.filter(f => !('silinmis' in f) || !(f as { silinmis?: boolean }).silinmis).map(f => { const fps = aktif.filter(e => e.firmaId === f.id); return [f.ad, fps.length, fps.filter(e => e.durum === 'Tamamlandı').length, fps.filter(e => e.durum === 'Planlandı').length, fps.filter(e => e.durum === 'Eksik').length]; }).filter(r => (r[1] as number) > 0).sort((a, b) => (b[1] as number) - (a[1] as number));
  const COLS2 = ['Firma Adı', 'Toplam', 'Tamamlandı', 'Bekliyor', 'Eksik'];
  const ws2Rows = [['FİRMA BAZLI EĞİTİM ÖZETİ', '', '', '', ''], COLS2, ...firmaOzet, ['TOPLAM', aktif.length, tamamlandi, planlandi, eksik], ['', '', '', '', ''], ['Rapor Tarihi', new Date().toLocaleDateString('tr-TR'), '', '', '']];
  const ws2 = XLSXStyle.utils.aoa_to_sheet(ws2Rows);
  if (!ws2['!merges']) ws2['!merges'] = [];
  ws2['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } });
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
  ws2['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];
  if (!ws2['!rows']) ws2['!rows'] = []; (ws2['!rows'] as XLSXStyle.RowInfo[])[0] = { hpt: 28 }; (ws2['!rows'] as XLSXStyle.RowInfo[])[1] = { hpt: 22 };
  XLSXStyle.utils.book_append_sheet(wb, ws2, 'Firma Özeti');

  // ── Sayfa 3 ──
  const kritikler = aktif.filter(e => e.tarih && e.gecerlilikSuresi && e.gecerlilikSuresi > 0).map(e => { const bitis = new Date(e.tarih); bitis.setDate(bitis.getDate() + e.gecerlilikSuresi!); bitis.setHours(0, 0, 0, 0); const diff = Math.ceil((bitis.getTime() - today.getTime()) / 86400000); const firma = firmalar.find(f => f.id === e.firmaId); return { e, diff, bitis, firma }; }).filter(x => x.diff <= 60).sort((a, b) => a.diff - b.diff);
  const COLS3 = ['Eğitim Adı', 'Firma', 'Eğitim Tarihi', 'Geçerlilik Bitiş', 'Kalan Gün', 'Durum'];
  const kritikData = kritikler.map(x => [x.e.ad, x.firma?.ad || '-', fmtDate(x.e.tarih), fmtDate(x.bitis.toISOString().split('T')[0]), x.diff < 0 ? `${Math.abs(x.diff)} gün geçti` : x.diff === 0 ? 'BUGÜN' : `${x.diff} gün kaldı`, x.diff < 0 ? 'SÜRESİ DOLMUŞ' : x.diff <= 30 ? 'KRİTİK' : 'YAKLAŞIYOR']);
  const ws3Rows = [['SÜRESİ YAKLAŞAN / DOLMUŞ EĞİTİMLER (60 Gün İçinde)', '', '', '', '', ''], COLS3, ...(kritikData.length > 0 ? kritikData : [['60 gün içinde süresi dolacak eğitim bulunmuyor.', '', '', '', '', '']])];
  const ws3 = XLSXStyle.utils.aoa_to_sheet(ws3Rows);
  if (!ws3['!merges']) ws3['!merges'] = [];
  ws3['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: COLS3.length - 1 } });
  ws3Rows.forEach((row, ri) => {
    (row as (string | number)[]).forEach((val, ci) => {
      const addr = XLSXStyle.utils.encode_cell({ r: ri, c: ci });
      if (!ws3[addr]) ws3[addr] = { v: val ?? '', t: typeof val === 'number' ? 'n' : 's' };
      let s: object = cellS(ri - 2);
      if (ri === 0) s = titleS; else if (ri === 1) s = headerS;
      else { const dr = ri - 2; if (ci === 4 || ci === 5) s = statusS(String(val ?? '')); else if (ci >= 2) s = cellS(dr, 'center'); else s = cellS(dr); }
      (ws3[addr] as XLSXStyle.CellObject).s = s;
    });
  });
  ws3['!cols'] = [{ wch: 32 }, { wch: 24 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 16 }];
  if (!ws3['!rows']) ws3['!rows'] = []; (ws3['!rows'] as XLSXStyle.RowInfo[])[0] = { hpt: 28 }; (ws3['!rows'] as XLSXStyle.RowInfo[])[1] = { hpt: 22 };
  XLSXStyle.utils.book_append_sheet(wb, ws3, 'Kritik Eğitimler');

  const xlsxData = XLSXStyle.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([xlsxData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `${new Date().toLocaleDateString('tr-TR')} Eğitim Evrakları Raporu.xlsx`;
  document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
}

export default function EgitimlerPage() {
  const { egitimler, firmalar, personeller, addEgitim, updateEgitim, deleteEgitim, org, addToast, quickCreate, setQuickCreate, refreshData, dataLoading } = useApp();
  const [search, setSearch] = useState('');
  const [firmaFilter, setFirmaFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [belgeLoading, setBelgeLoading] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  const handleRefresh = async () => {
    if (refreshing || dataLoading) return;
    setRefreshing(true);
    try { await refreshData(); addToast('Veriler güncellendi.', 'success'); }
    finally { setRefreshing(false); }
  };

  // Single definition of emptyEgitim — gecerlilikSuresi is in AY (months)
  const emptyEgitim: Omit<Egitim, 'id' | 'olusturmaTarihi'> = {
    ad: '', firmaId: '', katilimciIds: [], tarih: '', gecerlilikSuresi: 12,
    egitmen: '', yer: '', sure: 0, durum: 'Eksik', belgeMevcut: false,
    aciklama: '', belgeDosyaAdi: '', belgeDosyaBoyutu: 0, belgeDosyaTipi: '', belgeDosyaVeri: '', notlar: '',
  };

  const [form, setForm] = useState({ ...emptyEgitim });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (quickCreate === 'egitimler') {
      setForm({ ...emptyEgitim });
      setEditingId(null);
      setPendingFile(null);
      setFormOpen(true);
      setQuickCreate(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickCreate, setQuickCreate]);

  // Bildirimden gelen kayıt açma
  useEffect(() => {
    const handleOpenRecord = (e: Event) => {
      const detail = (e as CustomEvent).detail as { module: string; recordId: string };
      if (detail.module !== 'egitimler') return;
      const eg = egitimler.find(x => x.id === detail.recordId);
      if (eg) openEdit(eg);
    };
    window.addEventListener('isg_open_record', handleOpenRecord);
    try {
      const saved = localStorage.getItem('isg_open_record');
      if (saved) {
        const { module, recordId, ts } = JSON.parse(saved);
        if (module === 'egitimler' && recordId && Date.now() - ts < 5000) {
          const eg = egitimler.find(x => x.id === recordId);
          if (eg) { openEdit(eg); localStorage.removeItem('isg_open_record'); }
        }
      }
    } catch { /* ignore */ }
    return () => window.removeEventListener('isg_open_record', handleOpenRecord);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [egitimler]);

  const firmaPersoneller = useMemo(() => {
    if (!form.firmaId) return [];
    return personeller.filter(p => p.firmaId === form.firmaId && !p.silinmis);
  }, [form.firmaId, personeller]);

  const filtered = useMemo(() => egitimler
    .filter(e => {
      if (e.silinmis) return false;
      const q = search.toLowerCase();
      return (!search || e.ad.toLowerCase().includes(q) || (e.aciklama || '').toLowerCase().includes(q))
        && (!firmaFilter || e.firmaId === firmaFilter);
    })
    .sort((a, b) => {
      const ta = a.olusturmaTarihi ?? '';
      const tb = b.olusturmaTarihi ?? '';
      return tb.localeCompare(ta);
    }), [egitimler, search, firmaFilter]);

  const getFirmaAd = (id: string) => firmalar.find(fi => fi.id === id)?.ad || '—';

  const openAdd = () => { setForm({ ...emptyEgitim }); setEditingId(null); setPendingFile(null); setFormOpen(true); };
  const openEdit = (e: Egitim) => {
    setForm({ ...e, belgeDosyaVeri: '' });
    setEditingId(e.id);
    setPendingFile(null);
    setFormOpen(true);
  };

  const handleFileChange = (file?: File) => {
    if (!file) return;
    const err = validateFile(file, 10);
    if (err) { addToast(err, 'error'); return; }
    setPendingFile(file);
    setForm(prev => ({
      ...prev,
      belgeDosyaAdi: file.name,
      belgeDosyaBoyutu: file.size,
      belgeDosyaTipi: file.type,
      belgeMevcut: true,
      durum: 'Tamamlandı',
    }));
  };

  const handleBelgeIndir = async (e: Egitim) => {
    if (!e.belgeDosyaUrl) {
      addToast('Bu eğitim için indirilebilir belge bulunamadı. Lütfen belgeyi tekrar yükleyin.', 'error');
      return;
    }
    setBelgeLoading(e.id);
    try {
      const signedUrl = await getSignedUrlFromPath(e.belgeDosyaUrl, 'uploads');
      if (!signedUrl) {
        addToast('Dosya açılamadı. Lütfen tekrar deneyin.', 'error');
        return;
      }
      const ok = await downloadFromUrl(signedUrl, e.belgeDosyaAdi || 'egitim-belgesi');
      if (ok) {
        addToast(`"${e.belgeDosyaAdi}" indiriliyor...`, 'success');
      } else {
        addToast('Dosya indirilemedi. Lütfen tekrar deneyin.', 'error');
      }
    } finally {
      setBelgeLoading(null);
    }
  };

  const handleBelgeGoruntule = async (e: Egitim) => {
    if (!e.belgeDosyaUrl) {
      addToast('Görüntülenecek belge bulunamadı.', 'error');
      return;
    }
    setBelgeLoading(e.id);
    try {
      const signedUrl = await getSignedUrlFromPath(e.belgeDosyaUrl, 'uploads');
      if (!signedUrl) {
        addToast('Dosya açılamadı. Lütfen tekrar deneyin.', 'error');
        return;
      }
      window.open(signedUrl, '_blank');
    } finally {
      setBelgeLoading(null);
    }
  };

  const toggleKatilimci = (id: string) => {
    setForm(prev => {
      const ids = prev.katilimciIds ?? [];
      return {
        ...prev,
        katilimciIds: ids.includes(id) ? ids.filter(k => k !== id) : [...ids, id],
      };
    });
  };

  const handleSave = async () => {
    if (!form.ad.trim()) { addToast('Eğitim türü/adı zorunludur.', 'error'); return; }
    if (!form.firmaId) { addToast('Firma seçimi zorunludur.', 'error'); return; }
    const orgId = org?.id ?? 'unknown';

    if (editingId) {
      // Düzenleme: önce dosya yükle (varsa), sonra güncelle
      let belgeDosyaUrl: string | undefined;
      if (pendingFile) {
        belgeDosyaUrl = await uploadFileToStorage(pendingFile, orgId, 'egitim', editingId) ?? undefined;
        if (!belgeDosyaUrl) {
          addToast('Belge yüklenemedi. Lütfen tekrar deneyin.', 'error');
          return;
        }
      }
      updateEgitim(editingId, { ...form, ...(belgeDosyaUrl ? { belgeDosyaUrl } : {}) });
      addToast('Eğitim güncellendi.', 'success');
    } else {
      // Yeni kayıt: önce dosya yükle (varsa), sonra kayıt oluştur
      let belgeDosyaUrl: string | undefined;
      if (pendingFile) {
        const tempId = crypto.randomUUID();
        belgeDosyaUrl = await uploadFileToStorage(pendingFile, orgId, 'egitim', tempId) ?? undefined;
        if (!belgeDosyaUrl) {
          addToast('Belge yüklenemedi. Eğitim kaydı oluşturulmadı.', 'error');
          return;
        }
      }
      addEgitim({ ...form, ...(belgeDosyaUrl ? { belgeDosyaUrl, belgeMevcut: true, durum: 'Tamamlandı' as EgitimStatus } : {}) });
      addToast('Eğitim eklendi.', 'success');
    }
    setPendingFile(null);
    setFormOpen(false);
  };

  const handleDelete = (id: string) => {
    deleteEgitim(id);
    setDeleteConfirm(null);
    addToast('Eğitim silindi.', 'info');
  };

  const aktifEgitimler = useMemo(() => egitimler.filter(e => !e.silinmis), [egitimler]);
  const stats = useMemo(() => ({
    toplam: aktifEgitimler.length,
    planlandi: aktifEgitimler.filter(e => e.durum === 'Planlandı').length,
    tamamlandi: aktifEgitimler.filter(e => e.durum === 'Tamamlandı').length,
    eksik: aktifEgitimler.filter(e => e.durum === 'Eksik').length,
  }), [aktifEgitimler]);

  const detailEgitim = egitimler.find(e => e.id === detailId);

  const allSelected = filtered.length > 0 && filtered.every(e => selectedIds.has(e.id));
  const toggleAll = () => allSelected ? setSelectedIds(new Set()) : setSelectedIds(new Set(filtered.map(e => e.id)));
  const toggleOne = (id: string) => setSelectedIds(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const handleBulkDelete = () => {
    Array.from(selectedIds).forEach(id => deleteEgitim(id));
    addToast(`${selectedIds.size} eğitim silindi.`, 'success');
    setSelectedIds(new Set());
    setBulkDeleteConfirm(false);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Eğitim Evrakları</h1>
          <p className="text-sm mt-1" style={{ color: '#475569' }}>Personellerin eğitim evraklarını yükleyin ve takip edin</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleRefresh} disabled={refreshing || dataLoading} className="btn-secondary whitespace-nowrap">
            <i className={`ri-refresh-line mr-1 ${refreshing ? 'animate-spin' : ''}`} />{refreshing ? 'Yenileniyor...' : 'Yenile'}
          </button>
          <button onClick={() => exportEgitimlerToExcel(egitimler, firmalar, personeller)} className="btn-secondary whitespace-nowrap">
            <i className="ri-file-excel-2-line mr-1" />Excel Raporu İndir
          </button>
          <button onClick={openAdd} className="btn-primary whitespace-nowrap">
            <i className="ri-add-circle-line text-base" />
            Eğitim Evrakı Ekle
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Toplam Evrak', value: stats.toplam, icon: 'ri-graduation-cap-line', color: 'var(--text-primary)', bg: 'var(--bg-input)', border: 'var(--border-main)' },
          { label: 'Bekliyor', value: stats.planlandi, icon: 'ri-time-line', color: '#60A5FA', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.2)' },
          { label: 'Evrak Yüklendi', value: stats.tamamlandi, icon: 'ri-file-check-line', color: '#34D399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.2)' },
          { label: 'Evrak Eksik', value: stats.eksik, icon: 'ri-error-warning-line', color: '#F97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.2)' },
        ].map(s => (
          <div key={s.label} className="isg-card rounded-xl p-4 flex items-center gap-4 transition-all duration-200 hover:scale-[1.02] cursor-pointer" style={{ border: `1px solid ${s.border}`, background: s.bg }} onClick={() => setFirmaFilter('')}>
            <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: `${s.color}18` }}>
              <i className={`${s.icon} text-xl`} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
              <p className="text-xs mt-0.5" style={{ color: s.color }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="relative flex-1 min-w-[160px]">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#475569' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Eğitim türü veya açıklama ara..."
            className="isg-input pl-9"
          />
        </div>
        <select value={firmaFilter} onChange={e => setFirmaFilter(e.target.value)} className="isg-input" style={{ minWidth: '160px' }}>
          <option value="">Tüm Firmalar</option>
          {firmalar.filter(fi => !fi.silinmis).map(fi => <option key={fi.id} value={fi.id}>{fi.ad}</option>)}
        </select>
        {(search || firmaFilter) && (
          <button onClick={() => { setSearch(''); setFirmaFilter(''); }} className="btn-secondary whitespace-nowrap">
            <i className="ri-filter-off-line" /> Temizle
          </button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="isg-card rounded-2xl p-16 flex flex-col items-center text-center">
          <div className="w-16 h-16 flex items-center justify-center rounded-2xl mb-4" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-main)' }}>
            <i className="ri-graduation-cap-line text-3xl" style={{ color: 'var(--text-faint)' }} />
          </div>
          <p className="text-base font-bold" style={{ color: 'var(--text-muted)' }}>
            {search || firmaFilter ? 'Sonuç bulunamadı' : 'Henüz eğitim evrakı eklenmedi'}
          </p>
          <button onClick={openAdd} className="btn-primary mt-5"><i className="ri-add-line" /> Eğitim Evrakı Ekle</button>
        </div>
      ) : (
        <div className="isg-card rounded-2xl overflow-hidden">
          {/* Toplu seçim aksiyonları */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-2.5 flex-wrap" style={{ background: 'rgba(99,102,241,0.08)', borderBottom: '1px solid rgba(99,102,241,0.2)' }}>
              <span className="text-sm font-semibold" style={{ color: '#818CF8' }}>{selectedIds.size} kayıt seçildi</span>
              <button
                onClick={() => setBulkDeleteConfirm(true)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)' }}
              >
                <i className="ri-delete-bin-line" /> Seçilenleri Sil
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="text-xs px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap ml-auto" style={{ background: 'rgba(100,116,139,0.1)', color: '#94A3B8' }}>
                Seçimi Kaldır
              </button>
            </div>
          )}
          {/* Mobil kart görünümü */}
          <div className="md:hidden divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {filtered.map(eg => {
              const stc = STATUS_CFG[eg.durum as EgitimStatus] || STATUS_CFG['Planlandı'];
              return (
                <div key={eg.id} className="p-4" style={{ background: selectedIds.has(eg.id) ? 'rgba(99,102,241,0.04)' : undefined }}>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" checked={selectedIds.has(eg.id)} onChange={() => toggleOne(eg.id)} className="cursor-pointer mt-1 flex-shrink-0" />
                    <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: stc.bg, border: `1px solid ${stc.border}` }}>
                      <i className="ri-graduation-cap-line text-sm" style={{ color: stc.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{eg.ad}</p>
                        <Badge label={stc.label} color={getStatusColor(eg.durum)} />
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{getFirmaAd(eg.firmaId)}</p>
                      <div className="flex items-center gap-3 mt-1">
                        {eg.tarih && <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{new Date(eg.tarih).toLocaleDateString('tr-TR')}</span>}
                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8' }}>{(eg.katilimciIds ?? []).length} kişi</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 justify-end mt-2">
                    <ABtn icon="ri-eye-line" color="#60A5FA" onClick={() => setDetailId(eg.id)} title="Detay" />
                    {eg.belgeDosyaUrl && <ABtn icon="ri-external-link-line" color="#34D399" onClick={() => handleBelgeGoruntule(eg)} title="Görüntüle" />}
                    <ABtn icon="ri-edit-line" color="#F59E0B" onClick={() => openEdit(eg)} title="Düzenle" />
                    <ABtn icon="ri-delete-bin-line" color="#EF4444" onClick={() => setDeleteConfirm(eg.id)} title="Sil" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Masaüstü tablo görünümü */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full table-premium">
              <thead>
                <tr>
                  <th className="w-10 text-center">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="cursor-pointer" />
                  </th>
                  <th className="text-left">Eğitim Türü</th>
                  <th className="text-left hidden md:table-cell">Firma</th>
                  <th className="text-left hidden lg:table-cell">Katılımcılar</th>
                  <th className="text-left hidden sm:table-cell">Tarih</th>
                  <th className="text-left hidden lg:table-cell">Belge</th>
                  <th className="w-28 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(eg => {
                  const stc = STATUS_CFG[eg.durum as EgitimStatus] || STATUS_CFG['Planlandı'];
                  const hasBelge = !!eg.belgeDosyaUrl;
                  const hasFileError = eg.belgeDosyaAdi && !eg.belgeDosyaUrl;
                  const isLoadingBelge = belgeLoading === eg.id;
                  return (
                    <tr key={eg.id} style={{ background: selectedIds.has(eg.id) ? 'rgba(99,102,241,0.04)' : undefined }}>
                      <td className="text-center">
                        <input type="checkbox" checked={selectedIds.has(eg.id)} onChange={() => toggleOne(eg.id)} className="cursor-pointer" />
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: stc.bg, border: `1px solid ${stc.border}` }}>
                            <i className="ri-graduation-cap-line text-sm" style={{ color: stc.color }} />
                          </div>
                          <div className="min-w-0">
                            <button onClick={() => setDetailId(eg.id)} className="text-sm font-semibold hover:text-blue-400 transition-colors cursor-pointer block text-left" style={{ color: 'var(--text-primary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {eg.ad}
                            </button>
                            {eg.aciklama && <p className="text-xs mt-0.5 truncate max-w-[180px]" style={{ color: '#475569' }}>{eg.aciklama}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="hidden md:table-cell"><p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{getFirmaAd(eg.firmaId)}</p></td>
                      <td className="hidden lg:table-cell">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)' }}>
                          {(eg.katilimciIds ?? []).length} kişi
                        </span>
                      </td>
                      <td className="hidden sm:table-cell"><span className="text-sm" style={{ color: 'var(--text-muted)' }}>{eg.tarih ? new Date(eg.tarih).toLocaleDateString('tr-TR') : '—'}</span></td>
                      <td className="hidden lg:table-cell">
                        {hasFileError ? (
                          <button onClick={() => openEdit(eg)} className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg cursor-pointer whitespace-nowrap transition-all" style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}>
                            <i className="ri-upload-2-line" />Belge Ekle
                          </button>
                        ) : hasBelge ? (
                          <button onClick={() => handleBelgeIndir(eg)} disabled={isLoadingBelge} className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-all whitespace-nowrap disabled:opacity-50" style={{ color: '#34D399' }}>
                            {isLoadingBelge ? <i className="ri-loader-4-line animate-spin text-sm" /> : <i className="ri-file-check-line text-sm" />}
                            <span className="max-w-[80px] truncate">{eg.belgeDosyaAdi || 'Mevcut'}</span>
                          </button>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>Belge yok</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-1 justify-end">
                          <ABtn icon="ri-eye-line" color="#60A5FA" onClick={() => setDetailId(eg.id)} title="Detay" />
                          {eg.belgeDosyaUrl && (
                            isLoadingBelge
                              ? <div className="w-8 h-8 flex items-center justify-center"><i className="ri-loader-4-line animate-spin text-sm" style={{ color: '#34D399' }} /></div>
                              : <ABtn icon="ri-external-link-line" color="#34D399" onClick={() => handleBelgeGoruntule(eg)} title="Görüntüle" />
                          )}
                          <ABtn icon="ri-edit-line" color="#F59E0B" onClick={() => openEdit(eg)} title="Düzenle" />
                          <ABtn icon="ri-delete-bin-line" color="#EF4444" onClick={() => setDeleteConfirm(eg.id)} title="Sil" />
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

      {/* Form Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? 'Eğitim Evrakı Düzenle' : 'Eğitim Evrakı Ekle'}
        size="lg"
        icon="ri-graduation-cap-line"
        footer={
          <>
            <button onClick={() => setFormOpen(false)} className="btn-secondary whitespace-nowrap">İptal</button>
            <button onClick={handleSave} className="btn-primary whitespace-nowrap">
              <i className={editingId ? 'ri-save-line' : 'ri-add-line'} />
              {editingId ? 'Güncelle' : 'Evrak Ekle'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Firma */}
          <div>
            <label className="form-label">Firma *</label>
            <select value={form.firmaId} onChange={e => setForm(p => ({ ...p, firmaId: e.target.value, katilimciIds: [] }))} className="isg-input">
              <option value="">Firma Seçin</option>
              {firmalar.filter(f => !f.silinmis).map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
            </select>
          </div>

          {/* Eğitim Türü */}
          <div>
            <label className="form-label">Eğitim Türü *</label>
            <select value={EGITIM_TURLERI.includes(form.ad) ? form.ad : (form.ad ? 'Diğer' : '')} onChange={e => setForm(p => ({ ...p, ad: e.target.value === 'Diğer' ? '' : e.target.value }))} className="isg-input">
              <option value="">Seçin...</option>
              {EGITIM_TURLERI.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {(!EGITIM_TURLERI.includes(form.ad) || form.ad === '' || form.ad === 'Diğer') && (
              <input
                value={EGITIM_TURLERI.includes(form.ad) ? '' : form.ad}
                onChange={e => setForm(p => ({ ...p, ad: e.target.value }))}
                placeholder="Özel eğitim türü yazın..."
                className="isg-input mt-2"
              />
            )}
          </div>

          {/* Tarih */}
          <div className="sm:col-span-2">
            <label className="form-label">Eğitim Tarihi</label>
            <input type="date" value={form.tarih} onChange={e => setForm(p => ({ ...p, tarih: e.target.value }))} className="isg-input" />
          </div>

          {/* Açıklama */}
          <div className="sm:col-span-2">
            <label className="form-label">Açıklama</label>
            <textarea value={form.aciklama || ''} onChange={e => setForm(p => ({ ...p, aciklama: e.target.value }))} placeholder="Eğitim detayları, notlar..." rows={3} maxLength={500} className="isg-input" />
          </div>

          {/* Katılımcı Seçimi */}
          {firmaPersoneller.length > 0 && (
            <div className="sm:col-span-2">
              <label className="form-label">
                Katılımcı Seçimi ({(form.katilimciIds ?? []).length}/{firmaPersoneller.length})
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
                {firmaPersoneller.map(p => (
                  <label key={p.id} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-150"
                    style={{ background: (form.katilimciIds ?? []).includes(p.id) ? 'rgba(59,130,246,0.1)' : 'var(--bg-item)', border: (form.katilimciIds ?? []).includes(p.id) ? '1px solid rgba(59,130,246,0.3)' : '1px solid var(--bg-item-border)' }}
                  >
                    <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
                      style={(form.katilimciIds ?? []).includes(p.id) ? { background: 'linear-gradient(135deg, #3B82F6, #6366F1)' } : { background: 'var(--bg-input)', border: '1.5px solid var(--border-main)' }}
                    >
                      {(form.katilimciIds ?? []).includes(p.id) && <i className="ri-check-line text-white text-[10px]" />}
                    </div>
                    <input type="checkbox" checked={(form.katilimciIds ?? []).includes(p.id)} onChange={() => toggleKatilimci(p.id)} className="hidden" />
                    <span className="text-xs font-medium truncate" style={{ color: 'var(--text-secondary)' }}>{p.adSoyad}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Belge / Evrak Yükleme */}
          <div className="sm:col-span-2">
            <label className="form-label">Eğitim Belgesi / Evrak (PDF / JPG / PNG — Maks. 10MB)</label>
            <div
              className="rounded-xl p-5 text-center cursor-pointer transition-all duration-200"
              style={{ border: '2px dashed var(--border-main)', background: 'var(--bg-item)' }}
              onClick={() => fileRef.current?.click()}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)'; e.currentTarget.style.background = 'rgba(59,130,246,0.04)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-main)'; e.currentTarget.style.background = 'var(--bg-item)'; }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFileChange(e.dataTransfer.files[0]); }}
            >
              {form.belgeDosyaAdi ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ background: 'rgba(16,185,129,0.12)' }}>
                    <i className="ri-file-check-line text-xl" style={{ color: '#10B981' }} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{form.belgeDosyaAdi}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{form.belgeDosyaBoyutu ? `${(form.belgeDosyaBoyutu / 1024).toFixed(1)} KB` : ''} — Değiştirmek için tıklayın</p>
                  </div>
                </div>
              ) : (
                <>
                  <i className="ri-upload-cloud-2-line text-2xl mb-2" style={{ color: 'var(--text-faint)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Belge sürükleyin veya tıklayın</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>PDF, JPG, PNG • Maks. 10MB</p>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => handleFileChange(e.target.files?.[0])} />
          </div>
        </div>
      </Modal>

      {/* Bulk Delete Modal */}
      <Modal
        open={bulkDeleteConfirm}
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
            <strong>{selectedIds.size}</strong> eğitim kaydı silinecek.
          </p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>Bu işlem geri alınamaz.</p>
        </div>
      </Modal>

      {/* Detail Modal */}
      {detailEgitim && (
        <Modal
          open={!!detailId}
          onClose={() => setDetailId(null)}
          title={detailEgitim.ad}
          size="lg"
          icon="ri-graduation-cap-line"
          footer={
            <button onClick={() => { setDetailId(null); openEdit(detailEgitim); }} className="btn-secondary whitespace-nowrap">
              <i className="ri-edit-line" /> Düzenle
            </button>
          }
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge label={STATUS_CFG[detailEgitim.durum as EgitimStatus]?.label ?? detailEgitim.durum} color={getStatusColor(detailEgitim.durum)} />
              <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: 'rgba(59,102,241,0.1)', color: '#60A5FA', border: '1px solid rgba(59,102,241,0.2)' }}>
                {getFirmaAd(detailEgitim.firmaId)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-item)', border: '1px solid var(--bg-item-border)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Tarih</p>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{detailEgitim.tarih ? new Date(detailEgitim.tarih).toLocaleDateString('tr-TR') : '—'}</p>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-item)', border: '1px solid var(--bg-item-border)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Katılımcı Sayısı</p>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{(detailEgitim.katilimciIds ?? []).length} kişi</p>
              </div>
            </div>
            {detailEgitim.aciklama && (
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-item)', border: '1px solid var(--bg-item-border)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Açıklama</p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{detailEgitim.aciklama}</p>
              </div>
            )}
            {(detailEgitim.katilimciIds ?? []).length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Katılımcılar</p>
                <div className="flex flex-wrap gap-2">
                  {(detailEgitim.katilimciIds ?? []).map(pid => {
                    const p = personeller.find(x => x.id === pid);
                    return p ? (
                      <span key={pid} className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)' }}>
                        {p.adSoyad}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            )}
            {detailEgitim.belgeDosyaAdi && (
              <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <i className="ri-file-check-line text-xl" style={{ color: '#10B981' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{detailEgitim.belgeDosyaAdi}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{detailEgitim.belgeDosyaBoyutu ? `${(detailEgitim.belgeDosyaBoyutu / 1024).toFixed(1)} KB` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleBelgeGoruntule(detailEgitim)} disabled={belgeLoading === detailEgitim.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all whitespace-nowrap disabled:opacity-50" style={{ background: 'rgba(96,165,250,0.12)', color: '#60A5FA', border: '1px solid rgba(96,165,250,0.25)' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(96,165,250,0.22)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(96,165,250,0.12)'; }}>
                    {belgeLoading === detailEgitim.id ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-eye-line" />} Görüntüle
                  </button>
                  <button onClick={() => handleBelgeIndir(detailEgitim)} disabled={belgeLoading === detailEgitim.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all whitespace-nowrap disabled:opacity-50" style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.25)' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.22)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.12)'; }}>
                    {belgeLoading === detailEgitim.id ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-download-line" />} İndir
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Delete Modal */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Eğitimi Sil"
        size="sm"
        icon="ri-delete-bin-line"
        footer={
          <>
            <button onClick={() => setDeleteConfirm(null)} className="btn-secondary whitespace-nowrap">İptal</button>
            <button onClick={() => handleDelete(deleteConfirm!)} className="btn-danger whitespace-nowrap"><i className="ri-delete-bin-line" /> Evet, Sil</button>
          </>
        }
      >
        <div className="py-2">
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl mb-4" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <i className="ri-error-warning-line text-xl" style={{ color: '#EF4444' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: '#E2E8F0' }}>Bu eğitim kaydını silmek istediğinizden emin misiniz?</p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>Bu işlem geri alınamaz.</p>
        </div>
      </Modal>
    </div>
  );
}

function ABtn({ icon, color, onClick, title }: { icon: string; color: string; onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} title={title}
      className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200"
      style={{ color: '#475569' }}
      onMouseEnter={e => { e.currentTarget.style.color = color; e.currentTarget.style.background = `${color}18`; }}
      onMouseLeave={e => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = 'transparent'; }}
    >
      <i className={`${icon} text-sm`} />
    </button>
  );
}


