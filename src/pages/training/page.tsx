import { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import type { Egitim, EgitimKatilimci } from '../../types';
import type ExcelJSType from 'exceljs';
import Modal from '../../components/base/Modal';
import { usePermissions } from '@/hooks/usePermissions';
import AiKatilimAnaliz from './components/AiKatilimAnaliz';



// ── Katılım istatistikleri hesapla ──
// toplam: firmaya kayıtlı aktif personel sayısı (payda)
// katildi: katılımcı listesinde katildi=true olanlar
// katilmadi: katılımcı listesinde katildi=false olanlar
// kayitliKatilimci: katılımcı listesine eklenen toplam kişi
function getKatilimStats(
  eg: Egitim,
  personeller?: { id: string; firmaId: string; silinmis?: boolean }[],
) {
  const katilimcilar = eg.katilimcilar ?? [];
  const legacyIds = eg.katilimciIds ?? [];

  // Katılımcı listesi (yeni veya legacy)
  const liste = katilimcilar.length > 0
    ? katilimcilar
    : legacyIds.map(id => ({ personelId: id, katildi: true }));

  const kayitliKatilimci = liste.length;
  const katildi = liste.filter(k => k.katildi).length;
  const katilmadi = kayitliKatilimci - katildi;

  // Payda: firmaya kayıtlı toplam aktif personel sayısı
  let toplam = kayitliKatilimci; // fallback: personel listesi yoksa eski davranış
  if (personeller && personeller.length > 0) {
    const firmaIds = eg.firmaIds && eg.firmaIds.length > 0
      ? eg.firmaIds
      : eg.firmaId ? [eg.firmaId] : [];
    if (firmaIds.length > 0) {
      const firmaPersonelSayisi = personeller.filter(
        p => !p.silinmis && firmaIds.includes(p.firmaId),
      ).length;
      // Firma personeli varsa onu kullan, yoksa kayıtlı katılımcı sayısını kullan
      if (firmaPersonelSayisi > 0) {
        toplam = firmaPersonelSayisi;
      }
    }
  }

  return { toplam, katildi, katilmadi, kayitliKatilimci };
}

// ── Durum badge ──
function DurumBadge({ eg, personeller }: { eg: Egitim; personeller?: { id: string; firmaId: string; silinmis?: boolean }[] }) {
  const { toplam, katildi, kayitliKatilimci } = getKatilimStats(eg, personeller);
  if (kayitliKatilimci === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap"
        style={{ background: 'rgba(100,116,139,0.12)', color: '#94A3B8', border: '1px solid rgba(100,116,139,0.2)' }}>
        <i className="ri-user-add-line text-[10px]" />
        Katılımcı Yok
      </span>
    );
  }
  const oran = toplam > 0 ? Math.round((katildi / toplam) * 100) : 0;
  const color = oran >= 80 ? '#10B981' : oran >= 50 ? '#F59E0B' : '#EF4444';
  const bg = oran >= 80 ? 'rgba(16,185,129,0.1)' : oran >= 50 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)';
  const border = oran >= 80 ? 'rgba(16,185,129,0.2)' : oran >= 50 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)';
  const icon = oran >= 80 ? 'ri-checkbox-circle-line' : oran >= 50 ? 'ri-time-line' : 'ri-close-circle-line';
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap"
      style={{ background: bg, color, border: `1px solid ${border}` }}>
      <i className={`${icon} text-[10px]`} />
      {katildi}/{toplam} (%{oran})
    </span>
  );
}

// ── Excel export ──
async function exportEgitimlerToExcel(
  egitimler: Egitim[],
  firmalar: { id: string; ad: string }[],
  personeller: { id: string; adSoyad: string; gorev?: string; firmaId: string; silinmis?: boolean }[],
) {
  const { default: ExcelJS } = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = 'ISG Denetim Sistemi';
    wb.created = new Date();
    const aktif = egitimler.filter(e => !e.silinmis);
    const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('tr-TR') : '—';
    const now = new Date();
    const tarih = now.toLocaleDateString('tr-TR');

    const STATUS_COLORS: Record<string, { fg: string; bg: string }> = {
      'Katıldı':    { fg: 'FF16A34A', bg: 'FFDCFCE7' },
      'Katılmadı':  { fg: 'FFDC2626', bg: 'FFFEE2E2' },
    };

    const applyHeader = (ws: ExcelJSType.Worksheet, title: string, subtitle: string, colCount: number) => {
      ws.mergeCells(1, 1, 1, colCount);
      ws.mergeCells(2, 1, 2, colCount);
      ws.mergeCells(3, 1, 3, colCount);
      const r1 = ws.getRow(1); r1.height = 32;
      const r2 = ws.getRow(2); r2.height = 26;
      const r3 = ws.getRow(3); r3.height = 18;
      const c1 = ws.getCell(1, 1);
      c1.value = 'ISG DENETİM YÖNETİM SİSTEMİ';
      c1.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
      c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF020817' } };
      c1.alignment = { horizontal: 'left', vertical: 'middle' };
      const c2 = ws.getCell(2, 1);
      c2.value = title;
      c2.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
      c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A0F1E' } };
      c2.alignment = { horizontal: 'left', vertical: 'middle' };
      const c3 = ws.getCell(3, 1);
      c3.value = subtitle;
      c3.font = { italic: true, size: 10, color: { argb: 'FF94A3B8' }, name: 'Calibri' };
      c3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      c3.alignment = { horizontal: 'left', vertical: 'middle' };
    };

    const applyColHeader = (ws: ExcelJSType.Worksheet, cols: string[]) => {
      const hdr = ws.getRow(4); hdr.height = 22;
      cols.forEach((h, ci) => {
        const cell = hdr.getCell(ci + 1);
        cell.value = h;
        cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { bottom: { style: 'medium', color: { argb: 'FF6366F1' } } };
      });
    };

    // ── SAYFA 1: EĞİTİM LİSTESİ ──
    const ws1 = wb.addWorksheet('Eğitim Listesi');
    const cols1 = ['#', 'Eğitim Adı', 'Firma', 'Tarih', 'Eğitmen', 'Firma Personeli', 'Katılımcı', 'Katıldı', 'Katılmadı', 'Katılım Oranı', 'Açıklama'];
    ws1.columns = [4, 30, 24, 14, 22, 14, 14, 12, 12, 14, 34].map(w => ({ width: w }));
    applyHeader(ws1, 'EĞİTİM LİSTESİ', `Toplam ${aktif.length} eğitim  |  Rapor: ${tarih}`, cols1.length);
    applyColHeader(ws1, cols1);

    aktif.forEach((eg, i) => {
      // Çoklu firma desteği: firmaIds varsa ilk firmayı göster, yoksa firmaId kullan
      const firmaIds = eg.firmaIds && eg.firmaIds.length > 0 ? eg.firmaIds : (eg.firmaId ? [eg.firmaId] : []);
      const firmaAdlari = firmaIds.map(id => firmalar.find(f => f.id === id)?.ad || '—').join(', ');
      const firma = firmalar.find(f => f.id === (firmaIds[0] ?? eg.firmaId));
      const stats = getKatilimStats(eg, personeller);
      // Katılım oranı: katılan / firma toplam personeli
      const oran = stats.toplam > 0 ? `%${Math.round((stats.katildi / stats.toplam) * 100)}` : '—';
      const exRow = ws1.getRow(5 + i);
      exRow.height = 18;
      const bg = i % 2 === 0 ? 'FFFFFFFF' : 'FFF0F4FF';
      const vals = [i + 1, eg.ad, firmaAdlari, fmtDate(eg.tarih), eg.egitmen || '—', stats.toplam, stats.kayitliKatilimci, stats.katildi, stats.katilmadi, oran, eg.aciklama || '—'];
      vals.forEach((val, ci) => {
        const cell = exRow.getCell(ci + 1);
        cell.value = val;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.font = { size: 10, name: 'Calibri', color: { argb: 'FF1E293B' } };
        cell.alignment = { vertical: 'middle', wrapText: false };
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } }, right: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
        if (ci === 0) { cell.font = { size: 9, name: 'Calibri', color: { argb: 'FF94A3B8' } }; cell.alignment = { horizontal: 'center', vertical: 'middle' }; }
        if ([5, 6, 7, 8].includes(ci)) { cell.font = { bold: true, size: 10, name: 'Calibri', color: { argb: 'FF1E3A5F' } }; cell.alignment = { horizontal: 'center', vertical: 'middle' }; }
        if (ci === 9 && stats.toplam > 0) {
          const pct = Math.round((stats.katildi / stats.toplam) * 100);
          const color = pct >= 80 ? 'FF16A34A' : pct >= 50 ? 'FFD97706' : 'FFDC2626';
          const bgc = pct >= 80 ? 'FFDCFCE7' : pct >= 50 ? 'FFFEF3C7' : 'FFFEE2E2';
          cell.font = { bold: true, size: 10, name: 'Calibri', color: { argb: color } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgc } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
      });
    });
    ws1.views = [{ state: 'frozen', ySplit: 4 }];

    // ── SAYFA 2: KATILIMCı DETAY ──
    const ws2 = wb.addWorksheet('Katılımcı Detay');
    const cols2 = ['#', 'Eğitim Adı', 'Firma', 'Tarih', 'Personel Adı', 'Görev', 'Katılım Durumu'];
    ws2.columns = [4, 30, 24, 14, 26, 20, 16].map(w => ({ width: w }));
    applyHeader(ws2, 'KATILIMCı DETAY LİSTESİ', `Tüm eğitimlerin katılımcı bazlı dökümü  |  Rapor: ${tarih}`, cols2.length);
    applyColHeader(ws2, cols2);

    let rowIdx = 5;
    aktif.forEach(eg => {
      const firma = firmalar.find(f => f.id === eg.firmaId);
      const katilimcilar = eg.katilimcilar ?? [];
      const legacyIds = eg.katilimciIds ?? [];
      const allIds = katilimcilar.length > 0
        ? katilimcilar.map(k => ({ personelId: k.personelId, katildi: k.katildi }))
        : legacyIds.map(id => ({ personelId: id, katildi: true }));

      if (allIds.length === 0) return;
      // Katılımcı detay sayfasında da çoklu firma adını kullan
      const egFirmaIds2 = eg.firmaIds && eg.firmaIds.length > 0 ? eg.firmaIds : (eg.firmaId ? [eg.firmaId] : []);
      const egFirmaAdlari2 = egFirmaIds2.map(id => firmalar.find(f => f.id === id)?.ad || '—').join(', ');
      allIds.forEach((k, i) => {
        const p = personeller.find(x => x.id === k.personelId);
        const exRow = ws2.getRow(rowIdx);
        exRow.height = 18;
        const bg = (rowIdx - 5) % 2 === 0 ? 'FFFFFFFF' : 'FFF0F4FF';
        const durumLabel = k.katildi ? 'Katıldı' : 'Katılmadı';
        const vals = [i + 1, eg.ad, egFirmaAdlari2, fmtDate(eg.tarih), p?.adSoyad || '—', p?.gorev || '—', durumLabel];
        vals.forEach((val, ci) => {
          const cell = exRow.getCell(ci + 1);
          cell.value = val;
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
          cell.font = { size: 10, name: 'Calibri', color: { argb: 'FF1E293B' } };
          cell.alignment = { vertical: 'middle' };
          cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } }, right: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
          if (ci === 0) { cell.font = { size: 9, name: 'Calibri', color: { argb: 'FF94A3B8' } }; cell.alignment = { horizontal: 'center', vertical: 'middle' }; }
          if (ci === 6) {
            const sc = STATUS_COLORS[durumLabel];
            if (sc) { cell.font = { bold: true, size: 10, name: 'Calibri', color: { argb: sc.fg } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sc.bg } }; cell.alignment = { horizontal: 'center', vertical: 'middle' }; }
          }
        });
        rowIdx++;
      });
    });
    ws2.views = [{ state: 'frozen', ySplit: 4 }];

    // ── SAYFA 3: FİRMA ÖZETİ ──
    const ws3 = wb.addWorksheet('Firma Özeti');
    const cols3 = ['#', 'Firma Adı', 'Toplam Eğitim', 'Firma Personeli', 'Katıldı', 'Katılmadı', 'Katılım Oranı'];
    ws3.columns = [4, 30, 16, 16, 12, 12, 18].map(w => ({ width: w }));
    applyHeader(ws3, 'FİRMA BAZLI EĞİTİM ÖZETİ', `${firmalar.length} firma  |  Rapor: ${tarih}`, cols3.length);
    applyColHeader(ws3, cols3);

    firmalar.forEach((f, i) => {
      const firmaEgitimler = aktif.filter(e =>
        (e.firmaIds && e.firmaIds.includes(f.id)) || e.firmaId === f.id,
      );
      if (firmaEgitimler.length === 0) return;
      const firmaPersonelSayisi = personeller.filter(p => !p.silinmis && p.firmaId === f.id).length;
      let toplamKatildi = 0;
      firmaEgitimler.forEach(eg => {
        const s = getKatilimStats(eg, personeller);
        toplamKatildi += s.katildi;
      });
      // Oran: toplam katılan / (firma personeli * eğitim sayısı)
      const paydaMax = firmaPersonelSayisi * firmaEgitimler.length;
      const oran = paydaMax > 0 ? `%${Math.round((toplamKatildi / paydaMax) * 100)}` : '—';
      const exRow = ws3.getRow(5 + i);
      exRow.height = 18;
      const bg = i % 2 === 0 ? 'FFFFFFFF' : 'FFF0F4FF';
      const vals = [i + 1, f.ad, firmaEgitimler.length, firmaPersonelSayisi, toplamKatildi, firmaPersonelSayisi - toplamKatildi, oran];
      vals.forEach((val, ci) => {
        const cell = exRow.getCell(ci + 1);
        cell.value = val;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.font = { size: 10, name: 'Calibri', color: { argb: 'FF1E293B' } };
        cell.alignment = { vertical: 'middle' };
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } }, right: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
        if (ci === 0) { cell.font = { size: 9, name: 'Calibri', color: { argb: 'FF94A3B8' } }; cell.alignment = { horizontal: 'center', vertical: 'middle' }; }
        if ([2, 3, 4, 5].includes(ci)) { cell.font = { bold: true, size: 10, name: 'Calibri', color: { argb: 'FF1E3A5F' } }; cell.alignment = { horizontal: 'center', vertical: 'middle' }; }
      });
    });
    ws3.views = [{ state: 'frozen', ySplit: 4 }];

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${new Date().toLocaleDateString('tr-TR').replace(/\./g, '-')}-Egitim-Raporu.xlsx`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
  }

// ── Aksiyon butonu ──
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

// ── Ana sayfa ──
export default function EgitimlerPage() {
  const {
    egitimler, firmalar, personeller,
    addEgitim, updateEgitim, deleteEgitim,
    addToast, quickCreate, setQuickCreate, refreshData, dataLoading,
  } = useApp();
  const { canEdit } = usePermissions();

  const [search, setSearch] = useState('');
  const [firmaFilter, setFirmaFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  // ── Form state ──
  const emptyForm = {
    ad: '',
    firmaIds: [] as string[],
    tarih: '',
    egitmen: '',
    aciklama: '',
    katilimcilar: [] as EgitimKatilimci[],
    katilimGorseli: '' as string,
  };
  const [form, setForm] = useState({ ...emptyForm });

  const handleRefresh = async () => {
    if (refreshing || dataLoading) return;
    setRefreshing(true);
    try { await refreshData(); addToast('Veriler güncellendi.', 'success'); }
    finally { setRefreshing(false); }
  };

  // QuickCreate
  useEffect(() => {
    if (quickCreate === 'egitimler') {
      setForm({ ...emptyForm });
      setEditingId(null);
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
    return () => window.removeEventListener('isg_open_record', handleOpenRecord);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [egitimler]);

  // Seçili firmalara ait personeller
  const firmaPersoneller = useMemo(() => {
    if (!form.firmaIds || form.firmaIds.length === 0) return [];
    return personeller.filter(p => form.firmaIds.includes(p.firmaId) && !p.silinmis);
  }, [form.firmaIds, personeller]);

  // Firma toggle (çoklu seçim)
  const toggleFirma = (firmaId: string) => {
    setForm(prev => {
      const mevcutIds = prev.firmaIds ?? [];
      const yeniFirmaIds = mevcutIds.includes(firmaId)
        ? mevcutIds.filter(id => id !== firmaId)
        : [...mevcutIds, firmaId];
      // Kaldırılan firmanın personellerini katılımcılardan çıkar
      const kaldirildi = mevcutIds.filter(id => !yeniFirmaIds.includes(id));
      const kaldirilmisPersonelIds = new Set(
        personeller.filter(p => kaldirildi.includes(p.firmaId)).map(p => p.id),
      );
      return {
        ...prev,
        firmaIds: yeniFirmaIds,
        firmaId: yeniFirmaIds[0] ?? '',
        katilimcilar: prev.katilimcilar.filter(k => !kaldirilmisPersonelIds.has(k.personelId)),
      };
    });
  };

  // Katılımcı toggle
  const toggleKatilimci = (personelId: string) => {
    setForm(prev => {
      const mevcut = prev.katilimcilar.find(k => k.personelId === personelId);
      if (mevcut) {
        // Listeden çıkar
        return { ...prev, katilimcilar: prev.katilimcilar.filter(k => k.personelId !== personelId) };
      } else {
        // Ekle
        return { ...prev, katilimcilar: [...prev.katilimcilar, { personelId, katildi: true }] };
      }
    });
  };

  // Katılım durumu toggle (seçili kişi için katıldı/katılmadı)
  const toggleKatilimDurumu = (personelId: string) => {
    setForm(prev => ({
      ...prev,
      katilimcilar: prev.katilimcilar.map(k =>
        k.personelId === personelId ? { ...k, katildi: !k.katildi } : k,
      ),
    }));
  };

  const filtered = useMemo(() => egitimler
    .filter(e => {
      if (e.silinmis) return false;
      const q = search.toLowerCase();
      return (!search || e.ad.toLowerCase().includes(q) || (e.aciklama || '').toLowerCase().includes(q) || (e.egitmen || '').toLowerCase().includes(q))
        && (!firmaFilter || (e.firmaIds ? e.firmaIds.includes(firmaFilter) : e.firmaId === firmaFilter));
    })
    .sort((a, b) => (b.olusturmaTarihi ?? '').localeCompare(a.olusturmaTarihi ?? '')),
  [egitimler, search, firmaFilter]);

  const getFirmaAd = (eg: Egitim) => {
    const ids = eg.firmaIds && eg.firmaIds.length > 0 ? eg.firmaIds : (eg.firmaId ? [eg.firmaId] : []);
    if (ids.length === 0) return '—';
    if (ids.length === 1) return firmalar.find(fi => fi.id === ids[0])?.ad || '—';
    return ids.map(id => firmalar.find(fi => fi.id === id)?.ad || '—').join(', ');
  };

  const openAdd = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setFormOpen(true);
  };

  const openEdit = (eg: Egitim) => {
    // Legacy: eski kayıtlarda katilimciIds varsa dönüştür
    const katilimcilar: EgitimKatilimci[] = eg.katilimcilar && eg.katilimcilar.length > 0
      ? eg.katilimcilar
      : (eg.katilimciIds ?? []).map(id => ({ personelId: id, katildi: true }));

    // Legacy: firmaIds yoksa firmaId'den oluştur
    const firmaIds = eg.firmaIds && eg.firmaIds.length > 0
      ? eg.firmaIds
      : eg.firmaId ? [eg.firmaId] : [];

    setForm({
      ad: eg.ad,
      firmaIds,
      tarih: eg.tarih,
      egitmen: eg.egitmen || '',
      aciklama: eg.aciklama || '',
      katilimcilar,
      katilimGorseli: eg.katilimGorseli || '',
    });
    setEditingId(eg.id);
    setFormOpen(true);
  };

  const handleSave = () => {
    if (!form.ad.trim()) { addToast('Eğitim adı zorunludur.', 'error'); return; }
    if (!form.firmaIds || form.firmaIds.length === 0) { addToast('En az bir firma seçimi zorunludur.', 'error'); return; }
    if (!form.tarih) { addToast('Eğitim tarihi zorunludur.', 'error'); return; }

    const payload: Omit<Egitim, 'id' | 'olusturmaTarihi'> = {
      ad: form.ad,
      firmaId: form.firmaIds[0] ?? '',
      firmaIds: form.firmaIds,
      tarih: form.tarih,
      egitmen: form.egitmen,
      aciklama: form.aciklama,
      katilimcilar: form.katilimcilar,
      katilimGorseli: form.katilimGorseli || undefined,
      // Legacy uyumluluk
      katilimciIds: form.katilimcilar.map(k => k.personelId),
      durum: form.katilimcilar.length > 0 ? 'Tamamlandı' : 'Planlandı',
      belgeMevcut: false,
      notlar: '',
    };

    if (editingId) {
      updateEgitim(editingId, payload);
      addToast('Eğitim güncellendi.', 'success');
    } else {
      addEgitim(payload);
      addToast('Eğitim eklendi.', 'success');
    }
    setFormOpen(false);
  };

  const handleDelete = (id: string) => {
    deleteEgitim(id);
    setDeleteConfirm(null);
    addToast('Eğitim silindi.', 'info');
  };

  const aktifEgitimler = useMemo(() => egitimler.filter(e => !e.silinmis), [egitimler]);

  const stats = useMemo(() => {
    const toplam = aktifEgitimler.length;
    let toplamFirmaPersonel = 0; let toplamKatildi = 0; let toplamKayitli = 0;
    aktifEgitimler.forEach(eg => {
      const s = getKatilimStats(eg, personeller);
      toplamFirmaPersonel += s.toplam;
      toplamKatildi += s.katildi;
      toplamKayitli += s.kayitliKatilimci;
    });
    return {
      toplam,
      toplamKatilimci: toplamKayitli,
      toplamKatildi,
      katilimOrani: toplamFirmaPersonel > 0 ? Math.round((toplamKatildi / toplamFirmaPersonel) * 100) : 0,
    };
  }, [aktifEgitimler, personeller]);

  const detailEgitim = egitimler.find(e => e.id === detailId);

  const allSelected = filtered.length > 0 && filtered.every(e => selectedIds.has(e.id));
  const toggleAll = () => allSelected ? setSelectedIds(new Set()) : setSelectedIds(new Set(filtered.map(e => e.id)));
  const toggleOne = (id: string) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleBulkDelete = () => {
    Array.from(selectedIds).forEach(id => deleteEgitim(id));
    addToast(`${selectedIds.size} eğitim silindi.`, 'success');
    setSelectedIds(new Set());
    setBulkDeleteConfirm(false);
  };

  // Tüm katılımcıları seç/kaldır
  const toggleTumKatilimcilar = () => {
    if (form.katilimcilar.length === firmaPersoneller.length) {
      setForm(prev => ({ ...prev, katilimcilar: [] }));
    } else {
      setForm(prev => ({
        ...prev,
        katilimcilar: firmaPersoneller.map(p => {
          const mevcut = prev.katilimcilar.find(k => k.personelId === p.id);
          return mevcut ?? { personelId: p.id, katildi: true };
        }),
      }));
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Eğitimler</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Eğitim kayıtları ve katılım takibi</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleRefresh} disabled={refreshing || dataLoading} className="btn-secondary whitespace-nowrap">
            <i className={`ri-refresh-line mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Yenileniyor...' : 'Yenile'}
          </button>
          <button onClick={() => exportEgitimlerToExcel(egitimler, firmalar, personeller)} className="btn-secondary whitespace-nowrap">
            <i className="ri-file-excel-2-line mr-1" />Excel Raporu
          </button>
          {canEdit && (
            <button onClick={openAdd} className="btn-primary whitespace-nowrap">
              <i className="ri-add-circle-line text-base" />
              Eğitim Ekle
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Toplam Eğitim', value: stats.toplam, icon: 'ri-graduation-cap-line', color: '#818CF8', bg: 'rgba(129,140,248,0.1)', border: 'rgba(129,140,248,0.2)' },
          { label: 'Toplam Katılımcı', value: stats.toplamKatilimci, icon: 'ri-team-line', color: '#60A5FA', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.2)' },
          { label: 'Katılan Kişi', value: stats.toplamKatildi, icon: 'ri-checkbox-circle-line', color: '#34D399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.2)' },
          { label: 'Katılım Oranı', value: `%${stats.katilimOrani}`, icon: 'ri-bar-chart-line', color: stats.katilimOrani >= 80 ? '#34D399' : stats.katilimOrani >= 50 ? '#F59E0B' : '#EF4444', bg: stats.katilimOrani >= 80 ? 'rgba(52,211,153,0.1)' : stats.katilimOrani >= 50 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)', border: stats.katilimOrani >= 80 ? 'rgba(52,211,153,0.2)' : stats.katilimOrani >= 50 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)' },
        ].map(s => (
          <div key={s.label} className="isg-card rounded-xl p-4 flex items-center gap-4 transition-all duration-200 hover:scale-[1.02]"
            style={{ border: `1px solid ${s.border}`, background: s.bg }}>
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Eğitim adı, eğitmen veya açıklama ara..."
            className="isg-input pl-9" />
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
          <div className="w-16 h-16 flex items-center justify-center rounded-2xl mb-4"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-main)' }}>
            <i className="ri-graduation-cap-line text-3xl" style={{ color: 'var(--text-faint)' }} />
          </div>
          <p className="text-base font-bold" style={{ color: 'var(--text-muted)' }}>
            {search || firmaFilter ? 'Sonuç bulunamadı' : 'Henüz eğitim kaydı eklenmedi'}
          </p>
          {canEdit && (
            <button onClick={openAdd} className="btn-primary mt-5">
              <i className="ri-add-line" /> Eğitim Ekle
            </button>
          )}
        </div>
      ) : (
        <div className="isg-card rounded-2xl overflow-hidden">
          {/* Toplu seçim */}
          {selectedIds.size > 0 && canEdit && (
            <div className="flex items-center gap-3 px-4 py-2.5 flex-wrap"
              style={{ background: 'rgba(99,102,241,0.08)', borderBottom: '1px solid rgba(99,102,241,0.2)' }}>
              <span className="text-sm font-semibold" style={{ color: '#818CF8' }}>{selectedIds.size} kayıt seçildi</span>
              <button onClick={() => setBulkDeleteConfirm(true)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                <i className="ri-delete-bin-line" /> Seçilenleri Sil
              </button>
              <button onClick={() => setSelectedIds(new Set())}
                className="text-xs px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap ml-auto"
                style={{ background: 'rgba(100,116,139,0.1)', color: '#94A3B8' }}>
                Seçimi Kaldır
              </button>
            </div>
          )}

          {/* Mobil */}
          <div className="md:hidden divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {filtered.map(eg => {
              const stats2 = getKatilimStats(eg, personeller);
              return (
                <div key={eg.id} className="p-4">
                  <div className="flex items-start gap-3">
                    {canEdit && <input type="checkbox" checked={selectedIds.has(eg.id)} onChange={() => toggleOne(eg.id)} className="cursor-pointer mt-1 flex-shrink-0" />}
                    <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
                      style={{ background: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.2)' }}>
                      <i className="ri-graduation-cap-line text-sm" style={{ color: '#818CF8' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{eg.ad}</p>
                        <DurumBadge eg={eg} personeller={personeller} />
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{getFirmaAd(eg)}</p>
                      <div className="flex items-center gap-3 mt-1">
                        {eg.tarih && <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{new Date(eg.tarih).toLocaleDateString('tr-TR')}</span>}
                        {eg.egitmen && <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{eg.egitmen}</span>}
                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)' }}>
                          {stats2.toplam} kişi
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 justify-end mt-2">
                    <ABtn icon="ri-eye-line" color="#60A5FA" onClick={() => setDetailId(eg.id)} title="Detay" />
                    {canEdit && <>
                      <ABtn icon="ri-edit-line" color="#F59E0B" onClick={() => openEdit(eg)} title="Düzenle" />
                      <ABtn icon="ri-delete-bin-line" color="#EF4444" onClick={() => setDeleteConfirm(eg.id)} title="Sil" />
                    </>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Masaüstü */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full table-premium">
              <thead>
                <tr>
                  {canEdit && <th className="w-10 text-center"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="cursor-pointer" /></th>}
                  <th className="text-left">Eğitim Adı</th>
                  <th className="text-left hidden md:table-cell">Firma</th>
                  <th className="text-left hidden lg:table-cell">Eğitmen</th>
                  <th className="text-left hidden sm:table-cell">Tarih</th>
                  <th className="text-left hidden lg:table-cell">Katılımcı</th>
                  <th className="text-left">Durum</th>
                  <th className="w-28 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(eg => {
                  const stats2 = getKatilimStats(eg, personeller);
                  return (
                    <tr key={eg.id} style={{ background: selectedIds.has(eg.id) ? 'rgba(99,102,241,0.04)' : undefined }}>
                      {canEdit && (
                        <td className="text-center">
                          <input type="checkbox" checked={selectedIds.has(eg.id)} onChange={() => toggleOne(eg.id)} className="cursor-pointer" />
                        </td>
                      )}
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
                            style={{ background: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.2)' }}>
                            <i className="ri-graduation-cap-line text-sm" style={{ color: '#818CF8' }} />
                          </div>
                          <div className="min-w-0">
                            <button onClick={() => setDetailId(eg.id)}
                              className="text-sm font-semibold transition-colors cursor-pointer block text-left"
                              style={{ color: 'var(--text-primary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {eg.ad}
                            </button>
                            {eg.aciklama && (
                              <p className="text-xs mt-0.5 truncate max-w-[180px]" style={{ color: 'var(--text-muted)' }}>{eg.aciklama}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="hidden md:table-cell">
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{getFirmaAd(eg)}</p>
                      </td>
                      <td className="hidden lg:table-cell">
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{eg.egitmen || '—'}</p>
                      </td>
                      <td className="hidden sm:table-cell">
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                          {eg.tarih ? new Date(eg.tarih).toLocaleDateString('tr-TR') : '—'}
                        </span>
                      </td>
                      <td className="hidden lg:table-cell">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)' }}>
                          {stats2.toplam} kişi
                        </span>
                      </td>
                      <td><DurumBadge eg={eg} personeller={personeller} /></td>
                      <td>
                        <div className="flex items-center gap-1 justify-end">
                          <ABtn icon="ri-eye-line" color="#60A5FA" onClick={() => setDetailId(eg.id)} title="Detay" />
                          {canEdit && <>
                            <ABtn icon="ri-edit-line" color="#F59E0B" onClick={() => openEdit(eg)} title="Düzenle" />
                            <ABtn icon="ri-delete-bin-line" color="#EF4444" onClick={() => setDeleteConfirm(eg.id)} title="Sil" />
                          </>}
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

      {/* ── FORM MODAL ── */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? 'Eğitimi Düzenle' : 'Yeni Eğitim Ekle'}
        size="lg"
        icon="ri-graduation-cap-line"
        footer={
          <>
            <button onClick={() => setFormOpen(false)} className="btn-secondary whitespace-nowrap">İptal</button>
            <button onClick={handleSave} className="btn-primary whitespace-nowrap">
              <i className={editingId ? 'ri-save-line' : 'ri-add-line'} />
              {editingId ? 'Güncelle' : 'Eğitim Ekle'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Eğitim Adı */}
            <div className="sm:col-span-2">
              <label className="form-label">Eğitim Adı *</label>
              <input
                value={form.ad}
                onChange={e => setForm(p => ({ ...p, ad: e.target.value }))}
                placeholder="Eğitim adını yazın..."
                className="isg-input"
              />
            </div>

            {/* Çoklu Firma Seçimi */}
            <div className="sm:col-span-2">
              <label className="form-label">
                Firma(lar) *
                <span className="ml-2 text-[11px] font-normal" style={{ color: 'var(--text-faint)' }}>
                  ({(form.firmaIds ?? []).length} seçili)
                </span>
              </label>
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-main)' }}>
                <div className="max-h-36 overflow-y-auto divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                  {firmalar.filter(f => !f.silinmis).map(f => {
                    const secili = (form.firmaIds ?? []).includes(f.id);
                    return (
                      <button key={f.id} type="button" onClick={() => toggleFirma(f.id)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer"
                        style={{ background: secili ? 'rgba(99,102,241,0.06)' : undefined }}>
                        <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all"
                          style={secili
                            ? { background: 'linear-gradient(135deg, #6366F1, #818CF8)' }
                            : { background: 'var(--bg-input)', border: '1.5px solid var(--border-main)' }}>
                          {secili && <i className="ri-check-line text-white text-[10px]" />}
                        </div>
                        <span className="text-sm" style={{ color: secili ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{f.ad}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Tarih */}
            <div>
              <label className="form-label">Eğitim Tarihi *</label>
              <input type="date" value={form.tarih} onChange={e => setForm(p => ({ ...p, tarih: e.target.value }))} className="isg-input" />
            </div>

            {/* Eğitmen */}
            <div>
              <label className="form-label">Eğitmen <span style={{ color: 'var(--text-faint)' }}>(opsiyonel)</span></label>
              <input value={form.egitmen} onChange={e => setForm(p => ({ ...p, egitmen: e.target.value }))} placeholder="Eğitmen adı..." className="isg-input" />
            </div>

            {/* Açıklama */}
            <div className="sm:col-span-2">
              <label className="form-label">Açıklama <span style={{ color: 'var(--text-faint)' }}>(opsiyonel)</span></label>
              <textarea value={form.aciklama} onChange={e => setForm(p => ({ ...p, aciklama: e.target.value }))}
                placeholder="Eğitim hakkında notlar..." rows={2} maxLength={500} className="isg-input" />
            </div>
          </div>

          {/* AI Katılım Asistanı */}
          <AiKatilimAnaliz
            firmaPersoneller={firmaPersoneller}
            tumPersoneller={personeller.filter(p => !p.silinmis)}
            onGorselSecildi={(base64, mimeType) => {
              setForm(prev => ({ ...prev, katilimGorseli: `data:${mimeType};base64,${base64}` }));
            }}
            onEkle={(personelIds) => {
              setForm(prev => {
                // Zaten listede olmayanları ekle, katildi=true
                const mevcutIds = new Set(prev.katilimcilar.map(k => k.personelId));
                const yeniKatilimcilar = personelIds
                  .filter(id => !mevcutIds.has(id))
                  .map(id => ({ personelId: id, katildi: true }));
                return {
                  ...prev,
                  katilimcilar: [...prev.katilimcilar, ...yeniKatilimcilar],
                };
              });
            }}
          />

          {/* Katılımcı Seçimi */}
          {(form.firmaIds ?? []).length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="form-label mb-0">
                  Katılımcılar
                  <span className="ml-2 text-[11px] font-normal" style={{ color: 'var(--text-faint)' }}>
                    ({form.katilimcilar.length} seçili)
                  </span>
                </label>
                {firmaPersoneller.length > 0 && (
                  <button onClick={toggleTumKatilimcilar}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold cursor-pointer transition-all whitespace-nowrap"
                    style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)' }}>
                    {form.katilimcilar.length === firmaPersoneller.length ? 'Tümünü Kaldır' : 'Tümünü Seç'}
                  </button>
                )}
              </div>

              {firmaPersoneller.length === 0 ? (
                <div className="rounded-xl p-4 text-center" style={{ background: 'var(--bg-item)', border: '1px solid var(--bg-item-border)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Bu firmaya ait aktif personel bulunamadı.</p>
                </div>
              ) : (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-main)' }}>
                  {/* Başlık */}
                  <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider"
                    style={{ background: 'var(--bg-item)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                    <span>Personel</span>
                    <span className="text-center w-16">Seçili</span>
                    <span className="text-center w-20">Katıldı mı?</span>
                  </div>
                  {/* Liste */}
                  <div className="max-h-52 overflow-y-auto divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                    {firmaPersoneller.map(p => {
                      const secili = form.katilimcilar.find(k => k.personelId === p.id);
                      return (
                        <div key={p.id} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center px-3 py-2.5 transition-colors"
                          style={{ background: secili ? 'rgba(99,102,241,0.04)' : undefined }}>
                          {/* Personel adı */}
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0 text-[10px] font-bold text-white"
                              style={{ background: 'linear-gradient(135deg, #6366F1, #818CF8)' }}>
                              {p.adSoyad.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{p.adSoyad}</p>
                              {p.gorev && <p className="text-[10px] truncate" style={{ color: 'var(--text-faint)' }}>{p.gorev}</p>}
                            </div>
                          </div>

                          {/* Seç/Kaldır checkbox */}
                          <div className="w-16 flex justify-center">
                            <button onClick={() => toggleKatilimci(p.id)}
                              className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all cursor-pointer"
                              style={secili
                                ? { background: 'linear-gradient(135deg, #6366F1, #818CF8)' }
                                : { background: 'var(--bg-input)', border: '1.5px solid var(--border-main)' }}>
                              {secili && <i className="ri-check-line text-white text-[10px]" />}
                            </button>
                          </div>

                          {/* Katıldı mı toggle */}
                          <div className="w-20 flex justify-center">
                            {secili ? (
                              <button onClick={() => toggleKatilimDurumu(p.id)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold cursor-pointer transition-all whitespace-nowrap"
                                style={secili.katildi
                                  ? { background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }
                                  : { background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                                <i className={secili.katildi ? 'ri-checkbox-circle-line' : 'ri-close-circle-line'} />
                                {secili.katildi ? 'Katıldı' : 'Katılmadı'}
                              </button>
                            ) : (
                              <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>—</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* ── DETAY MODAL ── */}
      {detailEgitim && (
        <Modal
          open={!!detailId}
          onClose={() => setDetailId(null)}
          title={detailEgitim.ad}
          size="lg"
          icon="ri-graduation-cap-line"
          footer={
            canEdit ? (
              <button onClick={() => { setDetailId(null); openEdit(detailEgitim); }} className="btn-secondary whitespace-nowrap">
                <i className="ri-edit-line" /> Düzenle
              </button>
            ) : undefined
          }
        >
          <div className="space-y-4">
            {/* Temel bilgiler */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-item)', border: '1px solid var(--bg-item-border)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Firma</p>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{getFirmaAd(detailEgitim)}</p>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-item)', border: '1px solid var(--bg-item-border)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Tarih</p>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {detailEgitim.tarih ? new Date(detailEgitim.tarih).toLocaleDateString('tr-TR') : '—'}
                </p>
              </div>
              {detailEgitim.egitmen && (
                <div className="rounded-xl p-3" style={{ background: 'var(--bg-item)', border: '1px solid var(--bg-item-border)' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Eğitmen</p>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{detailEgitim.egitmen}</p>
                </div>
              )}
            </div>

            {/* Katılım özeti */}
            {(() => {
              const s = getKatilimStats(detailEgitim, personeller);
              if (s.toplam === 0) return null;
              const oran = Math.round((s.katildi / s.toplam) * 100);
              const color = oran === 100 ? '#10B981' : oran >= 50 ? '#F59E0B' : '#EF4444';
              return (
                <div className="rounded-xl p-4" style={{ background: 'var(--bg-item)', border: '1px solid var(--bg-item-border)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Katılım Özeti</p>
                    <span className="text-sm font-bold" style={{ color }}>%{oran}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: 'var(--bg-input)' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${oran}%`, background: `linear-gradient(90deg, ${color}, ${color}99)` }} />
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span style={{ color: '#10B981' }}><strong>{s.katildi}</strong> Katıldı</span>
                    <span style={{ color: '#EF4444' }}><strong>{s.katilmadi}</strong> Katılmadı</span>
                    <span style={{ color: 'var(--text-muted)' }}><strong>{s.toplam}</strong> Toplam</span>
                  </div>
                </div>
              );
            })()}

            {/* Açıklama */}
            {detailEgitim.aciklama && (
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-item)', border: '1px solid var(--bg-item-border)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Açıklama</p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{detailEgitim.aciklama}</p>
              </div>
            )}

            {/* Katılım Listesi Görseli */}
            {detailEgitim.katilimGorseli && (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-main)' }}>
                <div className="flex items-center justify-between px-3 py-2"
                  style={{ background: 'var(--bg-item)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div className="flex items-center gap-2">
                    <i className="ri-image-line text-sm" style={{ color: '#818CF8' }} />
                    <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                      Katılım Listesi Görseli
                    </p>
                  </div>
                  <a
                    href={detailEgitim.katilimGorseli}
                    download="katilim-listesi.jpg"
                    className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg cursor-pointer whitespace-nowrap"
                    style={{ background: 'rgba(129,140,248,0.1)', color: '#818CF8', border: '1px solid rgba(129,140,248,0.2)' }}
                  >
                    <i className="ri-download-line" /> İndir
                  </a>
                </div>
                <div className="p-2" style={{ background: 'var(--bg-input)' }}>
                  <img
                    src={detailEgitim.katilimGorseli}
                    alt="Katılım listesi görseli"
                    className="w-full rounded-lg object-contain max-h-80"
                    style={{ border: '1px solid var(--border-subtle)' }}
                  />
                </div>
              </div>
            )}

            {/* Katılımcı listesi */}
            {(() => {
              const katilimcilar = detailEgitim.katilimcilar ?? [];
              const legacyIds = detailEgitim.katilimciIds ?? [];
              const allList = katilimcilar.length > 0
                ? katilimcilar
                : legacyIds.map(id => ({ personelId: id, katildi: true }));
              if (allList.length === 0) return null;
              return (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                    Katılımcılar ({allList.length})
                  </p>
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-main)' }}>
                    <div className="max-h-64 overflow-y-auto divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                      {allList.map(k => {
                        const p = personeller.find(x => x.id === k.personelId);
                        return (
                          <div key={k.personelId} className="flex items-center justify-between px-3 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0 text-[10px] font-bold text-white"
                                style={{ background: 'linear-gradient(135deg, #6366F1, #818CF8)' }}>
                                {(p?.adSoyad || '?').charAt(0)}
                              </div>
                              <div>
                                <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{p?.adSoyad || '—'}</p>
                                {p?.gorev && <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>{p.gorev}</p>}
                              </div>
                            </div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold whitespace-nowrap"
                              style={k.katildi
                                ? { background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }
                                : { background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                              <i className={k.katildi ? 'ri-checkbox-circle-line' : 'ri-close-circle-line'} />
                              {k.katildi ? 'Katıldı' : 'Katılmadı'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </Modal>
      )}

      {/* ── TOPLU SİL MODAL ── */}
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
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl mb-4"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <i className="ri-error-warning-line text-xl" style={{ color: '#EF4444' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: '#E2E8F0' }}>
            <strong>{selectedIds.size}</strong> eğitim kaydı silinecek.
          </p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>Bu işlem geri alınamaz.</p>
        </div>
      </Modal>

      {/* ── SİL MODAL ── */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Eğitimi Sil"
        size="sm"
        icon="ri-delete-bin-line"
        footer={
          <>
            <button onClick={() => setDeleteConfirm(null)} className="btn-secondary whitespace-nowrap">İptal</button>
            <button onClick={() => handleDelete(deleteConfirm!)} className="btn-danger whitespace-nowrap">
              <i className="ri-delete-bin-line" /> Evet, Sil
            </button>
          </>
        }
      >
        <div className="py-2">
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl mb-4"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <i className="ri-error-warning-line text-xl" style={{ color: '#EF4444' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: '#E2E8F0' }}>Bu eğitim kaydını silmek istediğinizden emin misiniz?</p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>Bu işlem geri alınamaz.</p>
        </div>
      </Modal>
    </div>
  );
}
