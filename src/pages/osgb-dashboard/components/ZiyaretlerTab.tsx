import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/store/AppContext';
import ZiyaretDetayPanel from './ZiyaretDetayPanel';
import { openZiyaretPdfRapor } from '@/pages/osgb-dashboard/utils/ziyaretPdfRapor';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Ziyaret {
  id: string;
  osgb_org_id: string;
  firma_org_id: string;
  firma_ad: string | null;
  uzman_user_id: string;
  uzman_ad: string | null;
  uzman_email: string | null;
  giris_saati: string;
  cikis_saati: string | null;
  durum: 'aktif' | 'tamamlandi';
  konum_lat: number | null;
  konum_lng: number | null;
  konum_adres: string | null;
  qr_ile_giris: boolean;
  notlar: string | null;
  sure_dakika: number | null;
}

// ─── Excel Export ──────────────────────────────────────────────────────────────
async function exportZiyaretlerExcel(ziyaretler: Ziyaret[], donem: string) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ISG Yönetim Sistemi';
  wb.created = new Date();

  const ws = wb.addWorksheet('Ziyaretler');

  const headerStyle = {
    font: { bold: true, size: 11, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF059669' } },
    alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
    border: {
      top: { style: 'thin' as const }, bottom: { style: 'thin' as const },
      left: { style: 'thin' as const }, right: { style: 'thin' as const },
    },
  };
  const cellStyle = {
    alignment: { vertical: 'middle' as const },
    border: {
      top: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
    },
  };

  ws.columns = [
    { header: 'Uzman Adı', key: 'uzman', width: 24 },
    { header: 'Firma Adı', key: 'firma', width: 28 },
    { header: 'Giriş Tarihi', key: 'giris', width: 20 },
    { header: 'Çıkış Tarihi', key: 'cikis', width: 20 },
    { header: 'Süre', key: 'sure', width: 12 },
    { header: 'Ziyaret Tipi', key: 'tip', width: 14 },
    { header: 'Durum', key: 'durum', width: 14 },
  ];

  // Başlık stili
  ws.getRow(1).eachCell(cell => { Object.assign(cell, headerStyle); });
  ws.getRow(1).height = 22;

  const fmtDT = (iso: string) =>
    new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');

  const fmtSure = (dk: number | null) => {
    if (!dk || dk < 0) return '—';
    const h = Math.floor(dk / 60); const m = dk % 60;
    return h > 0 ? `${h}s ${m}d` : `${m} dk`;
  };

  ziyaretler.forEach((z, i) => {
    const row = ws.addRow({
      uzman: z.uzman_ad ?? z.uzman_email ?? '—',
      firma: z.firma_ad ?? '—',
      giris: fmtDT(z.giris_saati),
      cikis: z.cikis_saati ? fmtDT(z.cikis_saati) : '—',
      sure: fmtSure(z.sure_dakika),
      tip: z.qr_ile_giris ? 'QR' : 'Manuel',
      durum: z.durum === 'aktif' ? 'Devam Ediyor' : 'Tamamlandı',
    });
    row.height = 18;
    row.eachCell(cell => { Object.assign(cell, cellStyle); });
    // Zebra şeridi
    if (i % 2 === 1) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }
    // Durum rengi
    const durumCell = row.getCell('durum');
    durumCell.font = { bold: true, color: { argb: z.durum === 'aktif' ? 'FF16A34A' : 'FF64748B' } };
    // QR badge rengi
    const tipCell = row.getCell('tip');
    tipCell.font = { bold: z.qr_ile_giris, color: { argb: z.qr_ile_giris ? 'FF7C3AED' : 'FF475569' } };
  });

  // Toplam satır
  ws.addRow({});
  const totalRow = ws.addRow({ uzman: `Toplam: ${ziyaretler.length} kayıt`, firma: '', giris: '', cikis: '', sure: '', tip: '', durum: '' });
  totalRow.getCell('uzman').font = { bold: true, color: { argb: 'FF059669' } };

  const dateStr = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${dateStr}-Ziyaret-Raporu${donem ? '-' + donem : ''}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

interface ZiyaretlerTabProps {
  isDark: boolean;
}

// ─── Helper Fonksiyonlar ──────────────────────────────────────────────────────

/** Firma bazlı en son ziyareti döndürür */
function getLastVisitByFirma(ziyaretler: Ziyaret[]): Record<string, Ziyaret> {
  const map: Record<string, Ziyaret> = {};
  for (const z of ziyaretler) {
    const key = z.firma_org_id;
    if (!map[key] || new Date(z.giris_saati) > new Date(map[key].giris_saati)) {
      map[key] = z;
    }
  }
  return map;
}

/** Uzman bazlı en son ziyareti döndürür */
function getLastVisitByUzman(ziyaretler: Ziyaret[]): Record<string, Ziyaret> {
  const map: Record<string, Ziyaret> = {};
  for (const z of ziyaretler) {
    const key = z.uzman_user_id;
    if (!map[key] || new Date(z.giris_saati) > new Date(map[key].giris_saati)) {
      map[key] = z;
    }
  }
  return map;
}

/** 7+ gündür ziyaret edilmemiş firma id'lerini döndürür */
function getInactiveFirmalar(lastVisitMap: Record<string, Ziyaret>, allFirmaIds: string[]): string[] {
  const threshold = Date.now() - 7 * 24 * 3600 * 1000;
  return allFirmaIds.filter(id => {
    const last = lastVisitMap[id];
    if (!last) return true; // hiç ziyaret yok
    return new Date(last.giris_saati).getTime() < threshold;
  });
}

/** 3+ gündür ziyaret yapmayan uzman user_id'lerini döndürür */
function getInactiveUzmanlar(lastVisitMap: Record<string, Ziyaret>, allUzmanIds: string[]): { id: string; gunSayisi: number }[] {
  return allUzmanIds
    .map(id => {
      const last = lastVisitMap[id];
      if (!last) return { id, gunSayisi: 999 };
      const diff = Math.floor((Date.now() - new Date(last.giris_saati).getTime()) / 86400000);
      return { id, gunSayisi: diff };
    })
    .filter(x => x.gunSayisi >= 3);
}

/** Son ziyaret badge rengi */
function getSonZiyaretBadge(lastVisit: Ziyaret | undefined): {
  label: string; color: string; bg: string; border: string;
} {
  if (!lastVisit) return { label: 'Ziyaret edilmedi', color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.25)' };
  const gunSayisi = Math.floor((Date.now() - new Date(lastVisit.giris_saati).getTime()) / 86400000);
  if (gunSayisi === 0) return { label: 'Bugün ziyaret edildi', color: '#22C55E', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.25)' };
  if (gunSayisi <= 2) return { label: `${gunSayisi} gün önce`, color: '#22C55E', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.25)' };
  if (gunSayisi <= 7) return { label: `${gunSayisi} gün önce`, color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' };
  return { label: `${gunSayisi} gün önce`, color: '#EF4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)' };
}

// ─── Yardımcı formatlar ───────────────────────────────────────────────────────
function formatSure(dakika: number | null): string {
  if (!dakika || dakika < 0) return '—';
  const h = Math.floor(dakika / 60);
  const m = dakika % 60;
  if (h > 0) return `${h}s ${m}d`;
  return `${m}d`;
}

function formatSaat(iso: string): string {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function formatTarih(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Bugün';
  if (d.toDateString() === yesterday.toDateString()) return 'Dün';
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Gerçek zamanlı süre sayacı ──────────────────────────────────────────────
function ElapsedTimer({ since }: { since: string }) {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    const update = () => {
      const diff = Date.now() - new Date(since).getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(`${h > 0 ? h + 's ' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [since]);
  return <span className="font-mono text-xs font-bold" style={{ color: '#22C55E' }}>{elapsed}</span>;
}

type FilterTarih = 'bugun' | 'bu_hafta' | 'bu_ay' | 'ozel';

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────
export default function ZiyaretlerTab({ isDark }: ZiyaretlerTabProps) {
  const { org, addToast, firmalar: appFirmalar } = useApp();
  const [ziyaretler, setZiyaretler] = useState<Ziyaret[]>([]);
  const [tumZiyaretler, setTumZiyaretler] = useState<Ziyaret[]>([]); // Son 30 gün — badge hesaplamaları için
  const [loading, setLoading] = useState(true);
  const [secilenZiyaret, setSecilenZiyaret] = useState<Ziyaret | null>(null);
  const [exporting, setExporting] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);

  // Filtreler
  const [filterTarih, setFilterTarih] = useState<FilterTarih>('bugun');
  const [filterOzelBaslangic, setFilterOzelBaslangic] = useState('');
  const [filterOzelBitis, setFilterOzelBitis] = useState('');
  const [filterUzman, setFilterUzman] = useState('');
  const [filterFirma, setFilterFirma] = useState('');
  const [filterDurum, setFilterDurum] = useState<'' | 'aktif' | 'tamamlandi'>('');
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  const handleExcelExport = useCallback(async () => {
    if (ziyaretler.length === 0) return;
    setExporting(true);
    try {
      const donemLabel = filterTarih === 'bugun' ? 'Bugün'
        : filterTarih === 'bu_hafta' ? 'Hafta'
        : filterTarih === 'bu_ay' ? 'Ay'
        : filterOzelBaslangic ? filterOzelBaslangic : '';
      await exportZiyaretlerExcel(ziyaretler, donemLabel);
    } finally {
      setExporting(false);
    }
  }, [ziyaretler, filterTarih, filterOzelBaslangic]);

  const handlePdfExport = useCallback(() => {
    if (ziyaretler.length === 0) return;
    setPdfExporting(true);
    try {
      const donemLabel = filterTarih === 'bugun' ? 'Bugün'
        : filterTarih === 'bu_hafta' ? 'Bu Hafta'
        : filterTarih === 'bu_ay' ? 'Bu Ay'
        : filterOzelBaslangic
          ? (filterOzelBitis ? `${filterOzelBaslangic} — ${filterOzelBitis}` : filterOzelBaslangic)
          : 'Tüm Dönemler';
      openZiyaretPdfRapor({
        orgName: org?.name ?? 'OSGB',
        donem: donemLabel,
        firmaFilter: filterFirma || undefined,
        uzmanFilter: filterUzman || undefined,
        ziyaretler,
      });
    } finally {
      setPdfExporting(false);
    }
  }, [ziyaretler, filterTarih, filterOzelBaslangic, filterOzelBitis, filterFirma, filterUzman, org?.name]);

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-card-solid)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '16px',
  };
  const textPrimary = 'var(--text-primary)';
  const textMuted = 'var(--text-muted)';

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // ── Son 30 günlük tüm ziyaretleri çek (badge hesapları için) ──
  const fetchTumZiyaretler = useCallback(async () => {
    if (!org?.id) return;
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const { data } = await supabase
      .from('osgb_ziyaretler')
      .select('id, osgb_org_id, firma_org_id, firma_ad, uzman_user_id, uzman_ad, uzman_email, giris_saati, cikis_saati, durum, qr_ile_giris, sure_dakika, notlar, konum_lat, konum_lng, konum_adres')
      .eq('osgb_org_id', org.id)
      .gte('giris_saati', since.toISOString())
      .order('giris_saati', { ascending: false })
      .limit(1000);
    setTumZiyaretler((data ?? []) as Ziyaret[]);
  }, [org?.id]);

  const fetchZiyaretler = useCallback(async () => {
    if (!org?.id) return;
    setLoading(true);
    try {
      let query = supabase
        .from('osgb_ziyaretler')
        .select('*')
        .eq('osgb_org_id', org.id)
        .order('giris_saati', { ascending: false });

      const now = new Date();
      if (filterTarih === 'bugun') {
        const start = new Date(now); start.setHours(0, 0, 0, 0);
        const end = new Date(now); end.setHours(23, 59, 59, 999);
        query = query.gte('giris_saati', start.toISOString()).lte('giris_saati', end.toISOString());
      } else if (filterTarih === 'bu_hafta') {
        const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1;
        const start = new Date(now); start.setDate(now.getDate() - dayOfWeek); start.setHours(0, 0, 0, 0);
        const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
        query = query.gte('giris_saati', start.toISOString()).lte('giris_saati', end.toISOString());
      } else if (filterTarih === 'bu_ay') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        query = query.gte('giris_saati', start.toISOString()).lte('giris_saati', end.toISOString());
      } else if (filterTarih === 'ozel' && filterOzelBaslangic) {
        const start = new Date(filterOzelBaslangic); start.setHours(0, 0, 0, 0);
        query = query.gte('giris_saati', start.toISOString());
        if (filterOzelBitis) {
          const end = new Date(filterOzelBitis); end.setHours(23, 59, 59, 999);
          query = query.lte('giris_saati', end.toISOString());
        }
      }

      if (filterDurum) query = query.eq('durum', filterDurum);

      const { data, error } = await query.limit(300);
      if (error) throw error;

      const sorted = (data ?? []).sort((a, b) => {
        if (a.durum === 'aktif' && b.durum !== 'aktif') return -1;
        if (a.durum !== 'aktif' && b.durum === 'aktif') return 1;
        return new Date(b.giris_saati).getTime() - new Date(a.giris_saati).getTime();
      }) as Ziyaret[];

      const filtered = sorted.filter(z =>
        (!filterUzman || (z.uzman_ad ?? '').toLowerCase().includes(filterUzman.toLowerCase()) || (z.uzman_email ?? '').toLowerCase().includes(filterUzman.toLowerCase())) &&
        (!filterFirma || (z.firma_ad ?? '').toLowerCase().includes(filterFirma.toLowerCase()))
      );

      setZiyaretler(filtered);
    } catch (err) {
      console.error('[Ziyaretler] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [org?.id, filterTarih, filterOzelBaslangic, filterOzelBitis, filterDurum, filterUzman, filterFirma]);

  useEffect(() => {
    void fetchZiyaretler();
    void fetchTumZiyaretler();
  }, [fetchZiyaretler, fetchTumZiyaretler]);

  const handleBitir = async (ziyaretId: string) => {
    try {
      const cikis = new Date().toISOString();
      const ziyaret = ziyaretler.find(z => z.id === ziyaretId);
      const sure = ziyaret
        ? Math.round((Date.now() - new Date(ziyaret.giris_saati).getTime()) / 60000)
        : null;
      const { error } = await supabase
        .from('osgb_ziyaretler')
        .update({ durum: 'tamamlandi', cikis_saati: cikis, sure_dakika: sure, updated_at: cikis })
        .eq('id', ziyaretId);
      if (error) throw error;
      addToast('Ziyaret tamamlandı!', 'success');
      setSecilenZiyaret(null);
      void fetchZiyaretler();
      void fetchTumZiyaretler();
    } catch (err) {
      addToast(`Hata: ${String(err)}`, 'error');
    }
  };

  // ── Analytics hesapları ──────────────────────────────────────────────────────
  const aktifZiyaretler = useMemo(() => ziyaretler.filter(z => z.durum === 'aktif'), [ziyaretler]);
  const aktifSahaUzman = useMemo(() => [...new Set(aktifZiyaretler.map(z => z.uzman_user_id))].length, [aktifZiyaretler]);

  // Bu haftaki ziyaretler
  const buHaftaZiyaret = useMemo(() => {
    const dayOfWeek = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
    const haftaBaslangic = new Date(); haftaBaslangic.setDate(new Date().getDate() - dayOfWeek); haftaBaslangic.setHours(0, 0, 0, 0);
    return tumZiyaretler.filter(z => new Date(z.giris_saati) >= haftaBaslangic).length;
  }, [tumZiyaretler]);

  const tamamlananlar = useMemo(() => tumZiyaretler.filter(z => z.sure_dakika && z.sure_dakika > 0), [tumZiyaretler]);
  const ortalamaSure = useMemo(() =>
    tamamlananlar.length > 0 ? Math.round(tamamlananlar.reduce((s, z) => s + (z.sure_dakika ?? 0), 0) / tamamlananlar.length) : 0,
    [tamamlananlar]
  );
  const qrOrani = useMemo(() =>
    tumZiyaretler.length > 0 ? Math.round((tumZiyaretler.filter(z => z.qr_ile_giris).length / tumZiyaretler.length) * 100) : 0,
    [tumZiyaretler]
  );

  // ── Firma & uzman bazlı son ziyaret haritaları ───────────────────────────────
  const lastByFirma = useMemo(() => getLastVisitByFirma(tumZiyaretler), [tumZiyaretler]);
  const lastByUzman = useMemo(() => getLastVisitByUzman(tumZiyaretler), [tumZiyaretler]);

  // App'teki firmalar
  const tumFirmaIds = useMemo(() => appFirmalar.filter(f => !f.silinmis).map(f => f.id), [appFirmalar]);

  // Geciken firmalar (7+ gün ziyaret edilmemiş)
  const gecikmisFilmalar = useMemo(() => getInactiveFirmalar(lastByFirma, tumFirmaIds), [lastByFirma, tumFirmaIds]);

  // Pasif uzmanlar (3+ gün ziyaret yapmamış)
  const tumUzmanIds = useMemo(() =>
    [...new Set(tumZiyaretler.map(z => z.uzman_user_id))],
    [tumZiyaretler]
  );
  const pasifUzmanlar = useMemo(() => getInactiveUzmanlar(lastByUzman, tumUzmanIds), [lastByUzman, tumUzmanIds]);

  const aktifFilterSayisi = [filterUzman, filterFirma, filterDurum].filter(Boolean).length;

  // Geciken firmalar için ilk 5 firma adı
  const gecikmisFilmalarDetay = useMemo(() =>
    gecikmisFilmalar.slice(0, 5).map(id => {
      const firma = appFirmalar.find(f => f.id === id);
      const lastVisit = lastByFirma[id];
      const badge = getSonZiyaretBadge(lastVisit);
      return { id, ad: firma?.ad ?? 'Bilinmiyor', badge };
    }),
    [gecikmisFilmalar, appFirmalar, lastByFirma]
  );

  return (
    <div className="space-y-4 page-enter">

      {/* ── HEADER ── */}
      <div className="flex flex-wrap items-start gap-3">
        <div>
          <h2 className="text-base font-bold" style={{ color: textPrimary }}>Saha Ziyaretleri</h2>
          <p className="text-xs mt-0.5" style={{ color: textMuted }}>Uzmanların saha ziyaret takibi ve analizi</p>
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {/* Dönem seçici */}
          <div className="flex items-center gap-0.5 p-1 rounded-xl" style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)' }}>
            {([
              { id: 'bugun', label: 'Bugün' },
              { id: 'bu_hafta', label: 'Hafta' },
              { id: 'bu_ay', label: 'Ay' },
              { id: 'ozel', label: 'Özel' },
            ] as { id: FilterTarih; label: string }[]).map(opt => (
              <button key={opt.id} onClick={() => setFilterTarih(opt.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
                style={{
                  background: filterTarih === opt.id ? 'rgba(16,185,129,0.12)' : 'transparent',
                  color: filterTarih === opt.id ? '#10B981' : textMuted,
                  border: filterTarih === opt.id ? '1px solid rgba(16,185,129,0.25)' : '1px solid transparent',
                }}>
                {opt.label}
              </button>
            ))}
          </div>

          {/* Özel tarih */}
          {filterTarih === 'ozel' && (
            <div className="flex items-center gap-2">
              <input type="date" value={filterOzelBaslangic} onChange={e => setFilterOzelBaslangic(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl outline-none"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: textPrimary, colorScheme: isDark ? 'dark' : 'light' }} />
              <span className="text-xs" style={{ color: textMuted }}>—</span>
              <input type="date" value={filterOzelBitis} onChange={e => setFilterOzelBitis(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl outline-none"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: textPrimary, colorScheme: isDark ? 'dark' : 'light' }} />
            </div>
          )}

          {/* Filtre dropdown */}
          <div className="relative" ref={filterRef}>
            <button onClick={() => setFilterOpen(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap"
              style={{
                background: aktifFilterSayisi > 0 ? 'rgba(16,185,129,0.1)' : 'var(--bg-item)',
                border: `1px solid ${aktifFilterSayisi > 0 ? 'rgba(16,185,129,0.25)' : 'var(--border-subtle)'}`,
                color: aktifFilterSayisi > 0 ? '#10B981' : textMuted,
              }}>
              <i className="ri-filter-3-line text-xs" />
              Filtrele
              {aktifFilterSayisi > 0 && (
                <span className="w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: '#10B981' }}>
                  {aktifFilterSayisi}
                </span>
              )}
            </button>

            {filterOpen && (
              <div className="absolute right-0 top-11 z-50 w-72 p-4 rounded-2xl"
                style={{ background: 'var(--modal-bg)', border: '1px solid var(--modal-border)', boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.5)' : '0 16px 40px rgba(15,23,42,0.12)' }}>
                <p className="text-xs font-bold mb-3" style={{ color: textPrimary }}>Gelişmiş Filtreler</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-semibold mb-1.5" style={{ color: textMuted }}>Uzman Ara</label>
                    <div className="relative">
                      <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: textMuted }} />
                      <input value={filterUzman} onChange={e => setFilterUzman(e.target.value)}
                        placeholder="Uzman adı..."
                        className="w-full text-xs pl-8 pr-3 py-2 rounded-xl outline-none"
                        style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: textPrimary }} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold mb-1.5" style={{ color: textMuted }}>Firma Ara</label>
                    <div className="relative">
                      <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: textMuted }} />
                      <input value={filterFirma} onChange={e => setFilterFirma(e.target.value)}
                        placeholder="Firma adı..."
                        className="w-full text-xs pl-8 pr-3 py-2 rounded-xl outline-none"
                        style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: textPrimary }} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold mb-1.5" style={{ color: textMuted }}>Durum</label>
                    <div className="flex gap-1.5">
                      {([
                        { val: '', label: 'Tümü' },
                        { val: 'aktif', label: 'Devam Ediyor' },
                        { val: 'tamamlandi', label: 'Tamamlandı' },
                      ] as { val: '' | 'aktif' | 'tamamlandi'; label: string }[]).map(opt => (
                        <button key={opt.val} onClick={() => setFilterDurum(opt.val)}
                          className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold cursor-pointer whitespace-nowrap"
                          style={{
                            background: filterDurum === opt.val
                              ? opt.val === 'aktif' ? 'rgba(34,197,94,0.12)' : opt.val === 'tamamlandi' ? 'rgba(148,163,184,0.12)' : 'rgba(16,185,129,0.12)'
                              : 'var(--bg-item)',
                            border: filterDurum === opt.val
                              ? opt.val === 'aktif' ? '1px solid rgba(34,197,94,0.25)' : opt.val === 'tamamlandi' ? '1px solid rgba(148,163,184,0.25)' : '1px solid rgba(16,185,129,0.25)'
                              : '1px solid var(--border-subtle)',
                            color: filterDurum === opt.val
                              ? opt.val === 'aktif' ? '#22C55E' : opt.val === 'tamamlandi' ? '#94A3B8' : '#10B981'
                              : textMuted,
                          }}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {aktifFilterSayisi > 0 && (
                    <button onClick={() => { setFilterUzman(''); setFilterFirma(''); setFilterDurum(''); setFilterOpen(false); }}
                      className="w-full py-2 rounded-xl text-xs font-semibold cursor-pointer"
                      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}>
                      <i className="ri-close-line mr-1" />Filtreleri Temizle
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* PDF Export */}
          <button
            onClick={handlePdfExport}
            disabled={pdfExporting || ziyaretler.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap transition-all"
            style={{
              background: ziyaretler.length > 0 ? 'rgba(239,68,68,0.08)' : 'var(--bg-item)',
              border: `1px solid ${ziyaretler.length > 0 ? 'rgba(239,68,68,0.25)' : 'var(--border-subtle)'}`,
              color: ziyaretler.length > 0 ? '#DC2626' : textMuted,
              opacity: pdfExporting ? 0.7 : 1,
            }}
            title="Aktif filtrelere göre PDF rapor oluştur"
          >
            {pdfExporting
              ? <><i className="ri-loader-4-line animate-spin text-xs" />Hazırlanıyor...</>
              : <><i className="ri-file-pdf-line text-sm" />PDF</>}
          </button>

          {/* Excel Export */}
          <button
            onClick={() => void handleExcelExport()}
            disabled={exporting || ziyaretler.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap transition-all"
            style={{
              background: ziyaretler.length > 0 ? 'rgba(16,185,129,0.1)' : 'var(--bg-item)',
              border: `1px solid ${ziyaretler.length > 0 ? 'rgba(16,185,129,0.25)' : 'var(--border-subtle)'}`,
              color: ziyaretler.length > 0 ? '#10B981' : textMuted,
              opacity: exporting ? 0.7 : 1,
            }}
            title="Aktif filtrelere göre Excel indir"
          >
            {exporting
              ? <><i className="ri-loader-4-line animate-spin text-xs" />İndiriliyor...</>
              : <><i className="ri-file-excel-2-line text-sm" />Excel</>}
          </button>

          <button onClick={() => { void fetchZiyaretler(); void fetchTumZiyaretler(); }}
            className="w-9 h-9 flex items-center justify-center rounded-xl cursor-pointer transition-all"
            style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', color: textMuted }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.1)'; (e.currentTarget as HTMLElement).style.color = '#10B981'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-item)'; (e.currentTarget as HTMLElement).style.color = textMuted; }}>
            <i className="ri-refresh-line text-sm" />
          </button>
        </div>
      </div>

      {/* ── GECİKEN FİRMA UYARISI ── */}
      {gecikmisFilmalar.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: isDark ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.04)', border: '1.5px solid rgba(239,68,68,0.25)' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(239,68,68,0.12)' }}>
              <i className="ri-alarm-warning-line text-sm" style={{ color: '#EF4444' }} />
            </div>
            <div className="flex-1">
              <span className="text-xs font-bold" style={{ color: '#EF4444' }}>
                7+ gündür ziyaret edilmeyen firmalar
              </span>
              <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>
                {gecikmisFilmalar.length} firma
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {gecikmisFilmalarDetay.map(f => (
              <div key={f.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                style={{ background: isDark ? 'rgba(239,68,68,0.08)' : '#fff', border: '1px solid rgba(239,68,68,0.2)' }}>
                <div className="w-5 h-5 flex items-center justify-center rounded-lg flex-shrink-0"
                  style={{ background: 'rgba(16,185,129,0.1)' }}>
                  <i className="ri-building-2-line text-[9px]" style={{ color: '#059669' }} />
                </div>
                <span className="text-xs font-semibold" style={{ color: textPrimary }}>{f.ad}</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                  style={{ background: f.badge.bg, color: f.badge.color, border: `1px solid ${f.badge.border}` }}>
                  {f.badge.label}
                </span>
              </div>
            ))}
            {gecikmisFilmalar.length > 5 && (
              <div className="flex items-center px-3 py-1.5 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <span className="text-xs font-semibold" style={{ color: '#EF4444' }}>+{gecikmisFilmalar.length - 5} daha</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PASİF UZMAN ANALİZİ ── */}
      {pasifUzmanlar.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: isDark ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.04)', border: '1.5px solid rgba(245,158,11,0.25)' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(245,158,11,0.12)' }}>
              <i className="ri-user-unfollow-line text-sm" style={{ color: '#F59E0B' }} />
            </div>
            <span className="text-xs font-bold" style={{ color: '#F59E0B' }}>Saha Aktivitesi Azalan Uzmanlar</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full ml-1"
              style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}>
              {pasifUzmanlar.length} uzman
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {pasifUzmanlar.slice(0, 6).map(u => {
              const lastZ = lastByUzman[u.id];
              const isKritik = u.gunSayisi >= 5;
              return (
                <div key={u.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                  style={{
                    background: isDark ? (isKritik ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)') : '#fff',
                    border: `1px solid ${isKritik ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
                  }}>
                  <div className="w-5 h-5 flex items-center justify-center rounded-full text-[9px] font-bold text-white flex-shrink-0"
                    style={{ background: isKritik ? 'linear-gradient(135deg, #EF4444, #DC2626)' : 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
                    {(lastZ?.uzman_ad ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-semibold" style={{ color: textPrimary }}>{lastZ?.uzman_ad ?? 'Bilinmiyor'}</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                    style={{
                      background: isKritik ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                      color: isKritik ? '#EF4444' : '#F59E0B',
                    }}>
                    {u.gunSayisi === 999 ? 'Hiç yok' : `${u.gunSayisi}g önce`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── AKTİF ZİYARETLER BANNER ── */}
      {aktifZiyaretler.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: isDark ? 'rgba(34,197,94,0.06)' : 'rgba(34,197,94,0.04)', border: '1.5px solid rgba(34,197,94,0.25)' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-shrink-0">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#22C55E' }} />
              <div className="absolute inset-0 rounded-full animate-ping" style={{ background: 'rgba(34,197,94,0.4)' }} />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#22C55E' }}>
              {aktifZiyaretler.length} Aktif Ziyaret — Sahada Devam Ediyor
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {aktifZiyaretler.map(z => (
              <button key={z.id} onClick={() => setSecilenZiyaret(z)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition-all"
                style={{ background: isDark ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(34,197,94,0.14)' : 'rgba(34,197,94,0.1)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.06)'; }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #22C55E, #16A34A)' }}>
                  {(z.uzman_ad ?? '?').charAt(0).toUpperCase()}
                </div>
                <div className="text-left">
                  <p className="text-xs font-semibold" style={{ color: textPrimary }}>{z.uzman_ad ?? '—'}</p>
                  <p className="text-[10px]" style={{ color: textMuted }}>{z.firma_ad ?? '—'} · <ElapsedTimer since={z.giris_saati} /></p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── KPI KARTLAR ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Devam Eden', value: aktifSahaUzman, icon: 'ri-map-pin-user-line', color: '#22C55E', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.15)', pulse: aktifSahaUzman > 0 },
          { label: 'Bu Hafta', value: buHaftaZiyaret, icon: 'ri-calendar-check-line', color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.15)', pulse: false },
          { label: 'Ort. Süre', value: formatSure(ortalamaSure), icon: 'ri-time-line', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.15)', pulse: false },
          { label: 'QR Oranı', value: `%${qrOrani}`, icon: 'ri-qr-code-line', color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.15)', pulse: false },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-2xl p-4" style={cardStyle}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ background: kpi.bg, border: `1px solid ${kpi.border}` }}>
                <i className={`${kpi.icon} text-base`} style={{ color: kpi.color }} />
              </div>
              {kpi.pulse && (
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#22C55E' }} />
                  <span className="text-[9px] font-bold" style={{ color: '#22C55E' }}>CANLI</span>
                </div>
              )}
            </div>
            <p className="text-2xl font-extrabold leading-none" style={{ color: textPrimary }}>{kpi.value}</p>
            <p className="text-[11px] font-medium mt-1.5" style={{ color: textMuted }}>{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* ── TABLO / EMPTY STATE ── */}
      {loading ? (
        <div className="rounded-2xl p-12 flex flex-col items-center gap-3" style={cardStyle}>
          <i className="ri-loader-4-line text-2xl animate-spin" style={{ color: '#10B981' }} />
          <p className="text-sm" style={{ color: textMuted }}>Ziyaretler yükleniyor...</p>
        </div>
      ) : ziyaretler.length === 0 ? (
        <div className="rounded-2xl p-12 flex flex-col items-center gap-4" style={cardStyle}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
            <i className="ri-map-pin-2-line text-2xl" style={{ color: '#10B981' }} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold" style={{ color: textPrimary }}>
              {filterTarih === 'bugun' ? 'Bugün henüz ziyaret yok' : 'Ziyaret bulunamadı'}
            </p>
            <p className="text-xs mt-1 max-w-xs" style={{ color: textMuted }}>
              {aktifFilterSayisi > 0
                ? 'Seçili filtre koşullarında kayıt yok.'
                : filterTarih === 'bugun'
                  ? 'Uzmanlar QR kodu veya manuel giriş ile ziyaret başlatabilir.'
                  : 'Seçili dönemde ziyaret kaydı bulunamadı.'}
            </p>
          </div>
          {aktifFilterSayisi > 0 && (
            <button onClick={() => { setFilterUzman(''); setFilterFirma(''); setFilterDurum(''); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}>
              <i className="ri-close-line" />Filtreleri Temizle
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={cardStyle}>
          <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <p className="text-xs font-semibold" style={{ color: textMuted }}>
              <span className="font-bold" style={{ color: textPrimary }}>{ziyaretler.length}</span> kayıt
            </p>
            {aktifFilterSayisi > 0 && (
              <button onClick={() => { setFilterUzman(''); setFilterFirma(''); setFilterDurum(''); }}
                className="text-[10px] font-semibold cursor-pointer flex items-center gap-1"
                style={{ color: '#EF4444' }}>
                <i className="ri-close-circle-line" />Filtreleri temizle
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--table-head-bg)' }}>
                  {['Uzman', 'Firma', 'Giriş', 'Çıkış', 'Süre', 'Durum', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10.5px] font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: textMuted }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ziyaretler.map((z, i) => {
                  const isAktif = z.durum === 'aktif';
                  // Uzman son ziyaret badge
                  const uzmanLastVisit = lastByUzman[z.uzman_user_id];
                  const uzmanGun = uzmanLastVisit
                    ? Math.floor((Date.now() - new Date(uzmanLastVisit.giris_saati).getTime()) / 86400000)
                    : 999;
                  const uzmanPasif = !isAktif && uzmanGun >= 3;

                  return (
                    <tr
                      key={z.id}
                      onClick={() => setSecilenZiyaret(z)}
                      className="cursor-pointer transition-all"
                      style={{
                        borderBottom: i < ziyaretler.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        background: isAktif ? (isDark ? 'rgba(34,197,94,0.04)' : 'rgba(34,197,94,0.025)') : 'transparent',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-row-hover)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isAktif ? (isDark ? 'rgba(34,197,94,0.04)' : 'rgba(34,197,94,0.025)') : 'transparent'; }}
                    >
                      {/* Uzman */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                            style={{ background: isAktif ? 'linear-gradient(135deg, #22C55E, #16A34A)' : uzmanPasif ? 'linear-gradient(135deg, #F59E0B, #D97706)' : 'linear-gradient(135deg, #64748b, #475569)' }}>
                            {(z.uzman_ad ?? z.uzman_email ?? '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate max-w-[130px]" style={{ color: textPrimary }}>{z.uzman_ad ?? '—'}</p>
                            <p className="text-[10px] truncate max-w-[130px]" style={{ color: textMuted }}>{z.uzman_email ?? ''}</p>
                          </div>
                        </div>
                      </td>

                      {/* Firma */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 flex items-center justify-center rounded-lg flex-shrink-0"
                            style={{ background: 'rgba(16,185,129,0.08)' }}>
                            <i className="ri-building-2-line text-[10px]" style={{ color: '#059669' }} />
                          </div>
                          <div>
                            <span className="text-xs font-medium truncate block max-w-[120px]" style={{ color: 'var(--text-secondary)' }}>{z.firma_ad ?? '—'}</span>
                            {/* Son ziyaret badge — firma için */}
                            {(() => {
                              const b = getSonZiyaretBadge(lastByFirma[z.firma_org_id]);
                              return (
                                <span className="text-[9px] font-semibold" style={{ color: b.color }}>
                                  {b.label}
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      </td>

                      {/* Giriş */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-xs font-semibold" style={{ color: textPrimary }}>{formatSaat(z.giris_saati)}</p>
                        <p className="text-[10px]" style={{ color: textMuted }}>{formatTarih(z.giris_saati)}</p>
                      </td>

                      {/* Çıkış */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {z.cikis_saati ? (
                          <>
                            <p className="text-xs font-semibold" style={{ color: textPrimary }}>{formatSaat(z.cikis_saati)}</p>
                            <p className="text-[10px]" style={{ color: textMuted }}>{formatTarih(z.cikis_saati)}</p>
                          </>
                        ) : isAktif ? (
                          <span className="text-[10px] font-semibold" style={{ color: '#22C55E' }}>Devam ediyor</span>
                        ) : (
                          <span className="text-xs" style={{ color: textMuted }}>—</span>
                        )}
                      </td>

                      {/* Süre */}
                      <td className="px-4 py-3">
                        {isAktif ? (
                          <ElapsedTimer since={z.giris_saati} />
                        ) : (
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                            style={{ background: z.sure_dakika ? 'rgba(6,182,212,0.1)' : 'var(--bg-item)', color: z.sure_dakika ? '#06B6D4' : textMuted }}>
                            {formatSure(z.sure_dakika)}
                          </span>
                        )}
                      </td>

                      {/* Durum */}
                      <td className="px-4 py-3">
                        {isAktif ? (
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse" style={{ background: '#22C55E' }} />
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                              style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.2)' }}>
                              Devam Ediyor
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#94A3B8' }} />
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                              style={{ background: 'rgba(148,163,184,0.1)', color: '#94A3B8', border: '1px solid rgba(148,163,184,0.2)' }}>
                              Tamamlandı
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Son kolon */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          {z.qr_ile_giris && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap flex-shrink-0"
                              style={{ background: 'rgba(139,92,246,0.1)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.2)' }}>
                              <i className="ri-qr-code-line mr-0.5" />QR
                            </span>
                          )}
                          <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
                            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                            <i className="ri-arrow-right-s-line text-sm" style={{ color: '#059669' }} />
                          </div>
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

      {/* Detay Panel */}
      {secilenZiyaret && (
        <ZiyaretDetayPanel
          ziyaret={secilenZiyaret}
          isDark={isDark}
          onClose={() => setSecilenZiyaret(null)}
          onBitir={handleBitir}
        />
      )}
    </div>
  );
}
