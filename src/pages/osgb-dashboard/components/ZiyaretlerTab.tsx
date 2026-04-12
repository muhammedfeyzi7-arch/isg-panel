import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/store/AppContext';
import ZiyaretDetayPanel from './ZiyaretDetayPanel';

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
  gps_status: 'ok' | 'too_far' | 'no_permission' | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_in_distance_m: number | null;
}

function calcSureDakika(z: Ziyaret): number | null {
  if (z.sure_dakika != null && z.sure_dakika > 0) return z.sure_dakika;
  if (z.cikis_saati && z.giris_saati) {
    const dk = Math.round((new Date(z.cikis_saati).getTime() - new Date(z.giris_saati).getTime()) / 60000);
    return dk > 0 ? dk : null;
  }
  return null;
}

async function exportZiyaretlerExcel(ziyaretler: Ziyaret[], donem: string) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ISG Yönetim Sistemi';
  wb.created = new Date();

  const sorted = [...ziyaretler].sort(
    (a, b) => new Date(b.giris_saati).getTime() - new Date(a.giris_saati).getTime()
  );

  const firmaMap = new Map<string, { ad: string; ziyaretler: Ziyaret[] }>();
  for (const z of sorted) {
    const key = z.firma_org_id ?? z.firma_ad ?? 'Bilinmiyor';
    const ad = z.firma_ad ?? 'Bilinmiyor';
    if (!firmaMap.has(key)) firmaMap.set(key, { ad, ziyaretler: [] });
    firmaMap.get(key)!.ziyaretler.push(z);
  }

  const fmtTarih = (iso: string) =>
    new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const fmtSaat = (iso: string) =>
    new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const fmtSure = (dk: number | null) => {
    if (!dk || dk < 0) return '—';
    const h = Math.floor(dk / 60);
    const m = dk % 60;
    return h > 0 ? `${h}s ${m}dk` : `${m} dk`;
  };
  const fmtGps = (status: string | null) => {
    if (!status) return '—';
    if (status === 'ok') return '✓ Doğrulandı';
    if (status === 'too_far') return '✗ Konum Dışı';
    if (status === 'no_permission') return '⚠ İzin Yok';
    return status;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const headerFill: any = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0369A1' } };
  const headerFont = { bold: true, size: 11, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
  const headerAlignment = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
  const thinBorder = { style: 'thin' as const, color: { argb: 'FFCBD5E1' } };

  // ── ÖZET SAYFASI ──────────────────────────────────────────────────────────
  const wsOzet = wb.addWorksheet('📊 Özet');
  wsOzet.columns = [
    { header: 'Firma', key: 'firma', width: 32 },
    { header: 'Toplam Ziyaret', key: 'toplam', width: 16 },
    { header: 'Tamamlanan', key: 'tamamlanan', width: 16 },
    { header: 'Aktif', key: 'aktif', width: 10 },
    { header: 'Toplam Süre', key: 'toplamSure', width: 16 },
    { header: 'Ort. Süre (dk)', key: 'ortSure', width: 16 },
    { header: 'QR Oranı (%)', key: 'qrOran', width: 16 },
    { header: 'GPS Uyum (%)', key: 'gpsUyum', width: 16 },
  ];
  wsOzet.getRow(1).height = 30;
  wsOzet.getRow(1).eachCell(cell => {
    cell.fill = headerFill; cell.font = headerFont; cell.alignment = headerAlignment;
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF38BDF8' } }, right: thinBorder };
  });

  let ozetToplam = 0, ozetTamamlanan = 0, ozetSureToplam = 0, ozetQr = 0, ozetGpsOk = 0, ozetGpsToplam = 0;
  for (const [, { ad, ziyaretler: fz }] of firmaMap) {
    const tamamlanan = fz.filter(z => z.durum === 'tamamlandi').length;
    const aktifCount = fz.filter(z => z.durum === 'aktif').length;
    const sureler = fz.map(z => calcSureDakika(z)).filter(Boolean) as number[];
    const toplamSure = sureler.reduce((s, v) => s + v, 0);
    const ortSure = sureler.length > 0 ? Math.round(toplamSure / sureler.length) : 0;
    const qrCount = fz.filter(z => z.qr_ile_giris).length;
    const gpsOk = fz.filter(z => z.gps_status === 'ok').length;
    const gpsToplam = fz.filter(z => z.gps_status != null).length;

    ozetToplam += fz.length; ozetTamamlanan += tamamlanan; ozetSureToplam += toplamSure;
    ozetQr += qrCount; ozetGpsOk += gpsOk; ozetGpsToplam += gpsToplam;

    const row = wsOzet.addRow({
      firma: ad,
      toplam: fz.length,
      tamamlanan,
      aktif: aktifCount,
      toplamSure: fmtSure(toplamSure),
      ortSure,
      qrOran: fz.length > 0 ? Math.round((qrCount / fz.length) * 100) : 0,
      gpsUyum: gpsToplam > 0 ? Math.round((gpsOk / gpsToplam) * 100) : 100,
    });
    row.height = 22;
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      const isEven = (wsOzet.rowCount % 2 === 0);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFFFF' : 'FFF0F9FF' } };
      cell.font = { size: 11, name: 'Calibri', color: { argb: 'FF1E293B' } };
      cell.alignment = { vertical: 'middle', horizontal: colNum === 1 ? 'left' : 'center' };
      cell.border = { bottom: thinBorder, right: thinBorder };
    });
    const qrCell = row.getCell('qrOran');
    const qrVal = typeof qrCell.value === 'number' ? qrCell.value : 0;
    qrCell.font = { bold: true, size: 11, name: 'Calibri', color: { argb: qrVal >= 80 ? 'FF0284C7' : qrVal >= 50 ? 'FFF59E0B' : 'FFEF4444' } };
    const gpsCell = row.getCell('gpsUyum');
    const gpsVal = typeof gpsCell.value === 'number' ? gpsCell.value : 100;
    gpsCell.font = { bold: true, size: 11, name: 'Calibri', color: { argb: gpsVal >= 90 ? 'FF16A34A' : gpsVal >= 70 ? 'FFF59E0B' : 'FFEF4444' } };
  }
  // Toplam satırı
  const ozetSum = wsOzet.addRow({
    firma: `GENEL TOPLAM (${ozetToplam} ziyaret)`,
    toplam: ozetToplam, tamamlanan: ozetTamamlanan, aktif: ozetToplam - ozetTamamlanan,
    toplamSure: fmtSure(ozetSureToplam),
    ortSure: ozetTamamlanan > 0 ? Math.round(ozetSureToplam / ozetTamamlanan) : 0,
    qrOran: ozetToplam > 0 ? Math.round((ozetQr / ozetToplam) * 100) : 0,
    gpsUyum: ozetGpsToplam > 0 ? Math.round((ozetGpsOk / ozetGpsToplam) * 100) : 100,
  });
  ozetSum.height = 26;
  ozetSum.eachCell({ includeEmpty: true }, cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
    cell.font = { bold: true, size: 11, name: 'Calibri', color: { argb: 'FF0369A1' } };
    cell.border = { top: { style: 'medium', color: { argb: 'FF38BDF8' } }, bottom: thinBorder };
  });
  wsOzet.views = [{ state: 'frozen', ySplit: 1 }];

  // ── FİRMA SAYFASI ──────────────────────────────────────────────────────────
  for (const [, { ad, ziyaretler: fZiyaretler }] of firmaMap) {
    const sheetName = ad.replace(/[\\/?*[\]:]/g, '').slice(0, 31);
    const ws = wb.addWorksheet(sheetName);
    ws.columns = [
      { header: 'Tarih', key: 'tarih', width: 14 },
      { header: 'Uzman Adı', key: 'uzman', width: 26 },
      { header: 'Giriş', key: 'giris', width: 12 },
      { header: 'Çıkış', key: 'cikis', width: 12 },
      { header: 'Süre (dk)', key: 'sure_dk', width: 12 },
      { header: 'Süre', key: 'sure', width: 12 },
      { header: 'Durum', key: 'durum', width: 14 },
      { header: 'Tip', key: 'tip', width: 10 },
      { header: 'GPS', key: 'gps', width: 18 },
      { header: 'Mesafe (m)', key: 'mesafe', width: 14 },
    ];
    ws.getRow(1).height = 28;
    ws.getRow(1).eachCell(cell => {
      cell.fill = headerFill; cell.font = headerFont; cell.alignment = headerAlignment;
      cell.border = { bottom: { style: 'medium', color: { argb: 'FF38BDF8' } }, right: thinBorder };
    });

    fZiyaretler.forEach((z, i) => {
      const sureDk = calcSureDakika(z);
      const isEven = i % 2 === 0;
      const row = ws.addRow({
        tarih: fmtTarih(z.giris_saati),
        uzman: z.uzman_ad ?? z.uzman_email ?? '—',
        giris: fmtSaat(z.giris_saati),
        cikis: z.cikis_saati ? fmtSaat(z.cikis_saati) : '—',
        sure_dk: sureDk ?? '—',
        sure: fmtSure(sureDk),
        durum: z.durum === 'aktif' ? '▶ Devam Ediyor' : '✓ Tamamlandı',
        tip: z.qr_ile_giris ? 'QR' : 'Manuel',
        gps: fmtGps(z.gps_status),
        mesafe: z.check_in_distance_m ?? '—',
      });
      row.height = 22;
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' } };
        cell.alignment = { vertical: 'middle', horizontal: colNum === 2 ? 'left' : 'center' };
        cell.font = { size: 11, name: 'Calibri', color: { argb: 'FF1E293B' } };
        cell.border = { bottom: thinBorder, right: thinBorder };
      });

      // Durum rengi
      const durumCell = row.getCell('durum');
      durumCell.font = { bold: true, size: 11, name: 'Calibri',
        color: { argb: z.durum === 'aktif' ? 'FF16A34A' : 'FF64748B' } };

      // Tip rengi
      const tipCell = row.getCell('tip');
      tipCell.font = { bold: true, size: 11, name: 'Calibri',
        color: { argb: z.qr_ile_giris ? 'FF0284C7' : 'FF475569' } };

      // GPS rengi
      const gpsCell = row.getCell('gps');
      const gpsColor = z.gps_status === 'ok' ? 'FF16A34A' : z.gps_status === 'too_far' ? 'FFDC2626' : z.gps_status === 'no_permission' ? 'FFD97706' : 'FF94A3B8';
      gpsCell.font = { bold: z.gps_status !== null, size: 11, name: 'Calibri', color: { argb: gpsColor } };

      // Süre rengi
      if (typeof sureDk === 'number') {
        row.getCell('sure_dk').font = { bold: true, size: 11, name: 'Calibri',
          color: { argb: sureDk > 120 ? 'FF0284C7' : sureDk > 60 ? 'FF0891B2' : 'FF94A3B8' } };
      }
    });

    // Toplam satırı
    const totalSure = fZiyaretler.reduce((s, z) => s + (calcSureDakika(z) ?? 0), 0);
    ws.addRow({});
    const sumRow = ws.addRow({
      tarih: `Toplam: ${fZiyaretler.length} ziyaret`,
      uzman: `Tamamlanan: ${fZiyaretler.filter(z => z.durum === 'tamamlandi').length}`,
      giris: '', cikis: '',
      sure_dk: totalSure,
      sure: fmtSure(totalSure),
      durum: `Aktif: ${fZiyaretler.filter(z => z.durum === 'aktif').length}`,
      tip: `QR: %${fZiyaretler.length > 0 ? Math.round((fZiyaretler.filter(z => z.qr_ile_giris).length / fZiyaretler.length) * 100) : 0}`,
      gps: '',
      mesafe: '',
    });
    sumRow.height = 26;
    sumRow.eachCell({ includeEmpty: true }, cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
      cell.font = { bold: true, size: 11, name: 'Calibri', color: { argb: 'FF0369A1' } };
      cell.border = { top: { style: 'medium', color: { argb: 'FF38BDF8' } } };
    });
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  }

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const donemStr = donem ? `-${donem.replace(/\s+/g, '-')}` : '';
  const fileName = `Ziyaret-Raporu${donemStr}-${yyyy}-${mm}.xlsx`;

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface ZiyaretlerTabProps {
  isDark: boolean;
}

function getLastVisitByFirma(ziyaretler: Ziyaret[]): Record<string, Ziyaret> {
  const map: Record<string, Ziyaret> = {};
  for (const z of ziyaretler) {
    const key = z.firma_org_id;
    if (!map[key] || new Date(z.giris_saati) > new Date(map[key].giris_saati)) map[key] = z;
  }
  return map;
}

function getLastVisitByUzman(ziyaretler: Ziyaret[]): Record<string, Ziyaret> {
  const map: Record<string, Ziyaret> = {};
  for (const z of ziyaretler) {
    const key = z.uzman_user_id;
    if (!map[key] || new Date(z.giris_saati) > new Date(map[key].giris_saati)) map[key] = z;
  }
  return map;
}

function getInactiveFirmalar(lastVisitMap: Record<string, Ziyaret>, allFirmaIds: string[]): string[] {
  const threshold = Date.now() - 7 * 24 * 3600 * 1000;
  return allFirmaIds.filter(id => {
    const last = lastVisitMap[id];
    if (!last) return true;
    return new Date(last.giris_saati).getTime() < threshold;
  });
}

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

// ── GPS DURUM BADGE ──────────────────────────────────────────────
interface GpsBadgeConfig {
  dot: string;
  text: string;
  color: string;
  bg: string;
  border: string;
  tooltip: string;
}

function getGpsBadgeConfig(status: 'ok' | 'too_far' | 'no_permission' | null, distanceM?: number | null): GpsBadgeConfig | null {
  if (!status) return null;
  const base = 'Ziyaret sırasında kullanıcının konumu firma konumuna göre kontrol edilmiştir.';
  const distStr = distanceM != null
    ? distanceM >= 1000 ? ` (${(distanceM / 1000).toFixed(1)}km)` : ` (${distanceM}m)`
    : '';
  switch (status) {
    case 'ok':
      return { dot: '#22C55E', text: 'Konum doğrulandı', color: '#16A34A', bg: 'rgba(34,197,94,0.09)', border: 'rgba(34,197,94,0.22)', tooltip: base };
    case 'too_far':
      return { dot: '#EF4444', text: `Konum dışında${distStr}`, color: '#DC2626', bg: 'rgba(239,68,68,0.09)', border: 'rgba(239,68,68,0.22)', tooltip: base };
    case 'no_permission':
      return { dot: '#F59E0B', text: 'Konum alınamadı', color: '#D97706', bg: 'rgba(245,158,11,0.09)', border: 'rgba(245,158,11,0.22)', tooltip: base };
    default:
      return null;
  }
}

function GpsBadge({ status, distanceM }: { status: 'ok' | 'too_far' | 'no_permission' | null; distanceM?: number | null }) {
  const cfg = getGpsBadgeConfig(status, distanceM);
  if (!cfg) return null;
  return (
    <div className="relative group flex-shrink-0">
      <span
        className="flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-xl whitespace-nowrap cursor-default"
        style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
      >
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
        {cfg.text}
      </span>
      {/* Tooltip */}
      <div
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-xl text-[10px] leading-snug font-medium pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 w-56 text-center"
        style={{ background: 'rgba(15,23,42,0.92)', color: '#E2E8F0', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {cfg.tooltip}
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0"
          style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid rgba(15,23,42,0.92)' }} />
      </div>
    </div>
  );
}

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

export default function ZiyaretlerTab({ isDark }: ZiyaretlerTabProps) {
  const { org, addToast, firmalar: appFirmalar } = useApp();
  const [ziyaretler, setZiyaretler] = useState<Ziyaret[]>([]);
  const [tumZiyaretler, setTumZiyaretler] = useState<Ziyaret[]>([]);
  const [loading, setLoading] = useState(true);
  const [secilenZiyaret, setSecilenZiyaret] = useState<Ziyaret | null>(null);
  const [exporting, setExporting] = useState(false);

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

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-card-solid)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '16px',
  };
  const textPrimary = 'var(--text-primary)';
  const textMuted = 'var(--text-muted)';

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const fetchTumZiyaretler = useCallback(async () => {
    if (!org?.id) return;
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const { data } = await supabase
      .from('osgb_ziyaretler')
      .select('id, osgb_org_id, firma_org_id, firma_ad, uzman_user_id, uzman_ad, uzman_email, giris_saati, cikis_saati, durum, qr_ile_giris, sure_dakika, notlar, konum_lat, konum_lng, konum_adres, gps_status, check_in_distance_m')
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
      const sure = ziyaret ? Math.round((Date.now() - new Date(ziyaret.giris_saati).getTime()) / 60000) : null;
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

  const aktifZiyaretler = useMemo(() => ziyaretler.filter(z => z.durum === 'aktif'), [ziyaretler]);
  const aktifSahaUzman = useMemo(() => [...new Set(aktifZiyaretler.map(z => z.uzman_user_id))].length, [aktifZiyaretler]);

  // sure_dakika yoksa cikis_saati - giris_saati ile hesapla
  const getSureDakika = useCallback((z: Ziyaret): number | null => {
    if (z.sure_dakika != null && z.sure_dakika > 0) return z.sure_dakika;
    if (z.cikis_saati && z.giris_saati) {
      const dk = Math.round((new Date(z.cikis_saati).getTime() - new Date(z.giris_saati).getTime()) / 60000);
      return dk > 0 ? dk : null;
    }
    return null;
  }, []);

  const tamamlananlar = useMemo(() => tumZiyaretler.filter(z => z.durum === 'tamamlandi'), [tumZiyaretler]);
  const ortalamaSure = useMemo(() => {
    const sureli = tamamlananlar.filter(z => getSureDakika(z) != null);
    if (sureli.length === 0) return 0;
    return Math.round(sureli.reduce((s, z) => s + (getSureDakika(z) ?? 0), 0) / sureli.length);
  }, [tamamlananlar, getSureDakika]);
  const qrOrani = useMemo(() =>
    tumZiyaretler.length > 0 ? Math.round((tumZiyaretler.filter(z => z.qr_ile_giris).length / tumZiyaretler.length) * 100) : 0,
    [tumZiyaretler]
  );

  // GPS istatistikleri
  const gpsIstatistik = useMemo(() => {
    const gpsli = tumZiyaretler.filter(z => z.gps_status !== null);
    const tooFar = gpsli.filter(z => z.gps_status === 'too_far').length;
    const noPermission = gpsli.filter(z => z.gps_status === 'no_permission').length;
    const ok = gpsli.filter(z => z.gps_status === 'ok').length;
    const total = gpsli.length;
    const ihlalOrani = total > 0 ? Math.round(((tooFar + noPermission) / total) * 100) : 0;
    return { tooFar, noPermission, ok, total, ihlalOrani };
  }, [tumZiyaretler]);

  const lastByFirma = useMemo(() => getLastVisitByFirma(tumZiyaretler), [tumZiyaretler]);
  const lastByUzman = useMemo(() => getLastVisitByUzman(tumZiyaretler), [tumZiyaretler]);

  const tumFirmaIds = useMemo(() => appFirmalar.filter(f => !f.silinmis).map(f => f.id), [appFirmalar]);
  const gecikmisFilmalar = useMemo(() => getInactiveFirmalar(lastByFirma, tumFirmaIds), [lastByFirma, tumFirmaIds]);

  const tumUzmanIds = useMemo(() => [...new Set(tumZiyaretler.map(z => z.uzman_user_id))], [tumZiyaretler]);
  const pasifUzmanlar = useMemo(() => getInactiveUzmanlar(lastByUzman, tumUzmanIds), [lastByUzman, tumUzmanIds]);

  const aktifFilterSayisi = [filterUzman, filterFirma, filterDurum].filter(Boolean).length;

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
                  background: filterTarih === opt.id ? 'rgba(14,165,233,0.12)' : 'transparent',
                  color: filterTarih === opt.id ? '#0EA5E9' : textMuted,
                  border: filterTarih === opt.id ? '1px solid rgba(14,165,233,0.25)' : '1px solid transparent',
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
                background: aktifFilterSayisi > 0 ? 'rgba(14,165,233,0.1)' : 'var(--bg-item)',
                border: `1px solid ${aktifFilterSayisi > 0 ? 'rgba(14,165,233,0.25)' : 'var(--border-subtle)'}`,
                color: aktifFilterSayisi > 0 ? '#0EA5E9' : textMuted,
              }}>
              <i className="ri-filter-3-line text-xs" />
              Filtrele
              {aktifFilterSayisi > 0 && (
                <span className="w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: '#0EA5E9' }}>
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
                        placeholder="Uzman adı..." className="w-full text-xs pl-8 pr-3 py-2 rounded-xl outline-none"
                        style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: textPrimary }} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold mb-1.5" style={{ color: textMuted }}>Firma Ara</label>
                    <div className="relative">
                      <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: textMuted }} />
                      <input value={filterFirma} onChange={e => setFilterFirma(e.target.value)}
                        placeholder="Firma adı..." className="w-full text-xs pl-8 pr-3 py-2 rounded-xl outline-none"
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
                              ? opt.val === 'aktif' ? 'rgba(34,197,94,0.12)' : opt.val === 'tamamlandi' ? 'rgba(148,163,184,0.12)' : 'rgba(14,165,233,0.12)'
                              : 'var(--bg-item)',
                            border: filterDurum === opt.val
                              ? opt.val === 'aktif' ? '1px solid rgba(34,197,94,0.25)' : opt.val === 'tamamlandi' ? '1px solid rgba(148,163,184,0.25)' : '1px solid rgba(14,165,233,0.25)'
                              : '1px solid var(--border-subtle)',
                            color: filterDurum === opt.val
                              ? opt.val === 'aktif' ? '#22C55E' : opt.val === 'tamamlandi' ? '#94A3B8' : '#0EA5E9'
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

          {/* Excel Export */}
          <button
            onClick={() => void handleExcelExport()}
            disabled={exporting || ziyaretler.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap transition-all"
            style={{
              background: ziyaretler.length > 0 ? 'rgba(14,165,233,0.1)' : 'var(--bg-item)',
              border: `1px solid ${ziyaretler.length > 0 ? 'rgba(14,165,233,0.25)' : 'var(--border-subtle)'}`,
              color: ziyaretler.length > 0 ? '#0EA5E9' : textMuted,
              opacity: exporting ? 0.7 : 1,
            }}
            title="Her firma için ayrı sekme içeren Excel raporu indir"
          >
            {exporting
              ? <><i className="ri-loader-4-line animate-spin text-xs" />İndiriliyor...</>
              : <><i className="ri-file-excel-2-line text-sm" />Excel</>}
          </button>

          <button onClick={() => { void fetchZiyaretler(); void fetchTumZiyaretler(); }}
            className="w-9 h-9 flex items-center justify-center rounded-xl cursor-pointer transition-all"
            style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', color: textMuted }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.1)'; (e.currentTarget as HTMLElement).style.color = '#0EA5E9'; }}
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
              <span className="text-xs font-bold" style={{ color: '#EF4444' }}>7+ gündür ziyaret edilmeyen firmalar</span>
              <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>
                {gecikmisFilmalar.length} firma
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {gecikmisFilmalarDetay.map(f => (
              <div key={f.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                style={{ background: isDark ? 'rgba(239,68,68,0.08)' : '#fff', border: '1px solid rgba(239,68,68,0.2)' }}>
                <div className="w-5 h-5 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(14,165,233,0.1)' }}>
                  <i className="ri-building-2-line text-[9px]" style={{ color: '#0284C7' }} />
                </div>
                <span className="text-xs font-semibold" style={{ color: textPrimary }}>{f.ad}</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                  style={{ background: f.badge.bg, color: f.badge.color, border: `1px solid ${f.badge.border}` }}>
                  {f.badge.label}
                </span>
              </div>
            ))}
            {gecikmisFilmalar.length > 5 && (
              <div className="flex items-center px-3 py-1.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
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
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full ml-1" style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}>
              {pasifUzmanlar.length} uzman
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {pasifUzmanlar.slice(0, 6).map(u => {
              const lastZ = lastByUzman[u.id];
              const isKritik = u.gunSayisi >= 5;
              return (
                <div key={u.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                  style={{ background: isDark ? (isKritik ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)') : '#fff', border: `1px solid ${isKritik ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
                  <div className="w-5 h-5 flex items-center justify-center rounded-full text-[9px] font-bold text-white flex-shrink-0"
                    style={{ background: isKritik ? 'linear-gradient(135deg, #EF4444, #DC2626)' : 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
                    {(lastZ?.uzman_ad ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-semibold" style={{ color: textPrimary }}>{lastZ?.uzman_ad ?? 'Bilinmiyor'}</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                    style={{ background: isKritik ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)', color: isKritik ? '#EF4444' : '#F59E0B' }}>
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
          {
            label: 'Aktif Ziyaret', value: aktifSahaUzman,
            subLabel: aktifSahaUzman > 0 ? `${aktifSahaUzman} uzman sahada` : 'Şu an kimse yok',
            icon: 'ri-map-pin-user-line', color: '#22C55E',
            gradient: 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(16,185,129,0.05) 100%)',
            border: 'rgba(34,197,94,0.2)', pulse: aktifSahaUzman > 0,
          },
          {
            label: 'Bugünkü Ziyaret',
            value: (() => {
              const today = new Date();
              return ziyaretler.filter(z => new Date(z.giris_saati).toDateString() === today.toDateString()).length;
            })(),
            subLabel: 'Bugün toplam', icon: 'ri-calendar-check-line', color: '#0EA5E9',
            gradient: 'linear-gradient(135deg, rgba(14,165,233,0.12) 0%, rgba(2,132,199,0.04) 100%)',
            border: 'rgba(14,165,233,0.2)', pulse: false,
          },
          {
            label: 'Ortalama Süre', value: formatSure(ortalamaSure),
            subLabel: 'Son 30 günde', icon: 'ri-time-line', color: '#F59E0B',
            gradient: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(217,119,6,0.04) 100%)',
            border: 'rgba(245,158,11,0.2)', pulse: false,
          },
          {
            label: 'QR Oranı', value: `%${qrOrani}`,
            subLabel: 'QR ile giriş', icon: 'ri-qr-code-line', color: '#0EA5E9',
            gradient: 'linear-gradient(135deg, rgba(14,165,233,0.12) 0%, rgba(2,132,199,0.04) 100%)',
            border: 'rgba(14,165,233,0.2)', pulse: false,
          },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-2xl p-4 transition-all"
            style={{ background: kpi.gradient, border: `1px solid ${kpi.border}`, boxShadow: 'none' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${kpi.border}`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ background: `${kpi.color}18`, border: `1px solid ${kpi.border}` }}>
                <i className={`${kpi.icon} text-base`} style={{ color: kpi.color }} />
              </div>
              {kpi.pulse && (
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full animate-ping" style={{ background: '#22C55E', opacity: 0.7 }} />
                  <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#22C55E' }}>CANLI</span>
                </div>
              )}
            </div>
            <p className="text-2xl font-black leading-none" style={{ color: textPrimary }}>{kpi.value}</p>
            <p className="text-[10px] font-medium mt-1.5" style={{ color: textMuted }}>{kpi.subLabel}</p>
          </div>
        ))}
      </div>

      {/* ── GPS İHLAL İSTATİSTİKLERİ ── */}
      {gpsIstatistik.total > 0 && (
        <div className="rounded-2xl p-4" style={{ background: isDark ? 'rgba(15,23,42,0.6)' : '#fff', border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <i className="ri-map-pin-2-line text-sm" style={{ color: '#EF4444' }} />
            </div>
            <span className="text-xs font-bold" style={{ color: textPrimary }}>GPS Konum İstatistikleri</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full ml-1"
              style={{ background: 'rgba(14,165,233,0.08)', color: '#0284C7' }}>
              Son 30 gün · {gpsIstatistik.total} kayıt
            </span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Konum Doğrulandı', value: gpsIstatistik.ok, icon: 'ri-map-pin-2-fill', color: '#16A34A', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)' },
              { label: 'Kapsam Dışında', value: gpsIstatistik.tooFar, icon: 'ri-map-pin-line', color: '#DC2626', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' },
              { label: 'Konum Alınamadı', value: gpsIstatistik.noPermission, icon: 'ri-map-pin-line', color: '#D97706', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
              { label: 'İhlal Oranı', value: `%${gpsIstatistik.ihlalOrani}`, icon: 'ri-pie-chart-line', color: gpsIstatistik.ihlalOrani > 20 ? '#DC2626' : gpsIstatistik.ihlalOrani > 5 ? '#D97706' : '#16A34A', bg: gpsIstatistik.ihlalOrani > 20 ? 'rgba(239,68,68,0.08)' : gpsIstatistik.ihlalOrani > 5 ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)', border: gpsIstatistik.ihlalOrani > 20 ? 'rgba(239,68,68,0.2)' : gpsIstatistik.ihlalOrani > 5 ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)' },
            ].map(stat => (
              <div key={stat.label} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: stat.bg, border: `1px solid ${stat.border}` }}>
                <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
                  style={{ background: stat.bg, border: `1px solid ${stat.border}` }}>
                  <i className={`${stat.icon} text-sm`} style={{ color: stat.color }} />
                </div>
                <div>
                  <p className="text-lg font-extrabold leading-none" style={{ color: stat.color }}>{stat.value}</p>
                  <p className="text-[10px] mt-0.5 font-medium" style={{ color: textMuted }}>{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
          {/* Progress bar */}
          {gpsIstatistik.total > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px]" style={{ color: textMuted }}>Konum uyum dağılımı</span>
                <span className="text-[10px] font-semibold" style={{ color: '#16A34A' }}>%{Math.round((gpsIstatistik.ok / gpsIstatistik.total) * 100)} başarılı</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden flex" style={{ background: 'var(--bg-item)' }}>
                <div className="h-full transition-all" style={{ width: `${(gpsIstatistik.ok / gpsIstatistik.total) * 100}%`, background: '#22C55E' }} />
                <div className="h-full transition-all" style={{ width: `${(gpsIstatistik.tooFar / gpsIstatistik.total) * 100}%`, background: '#EF4444' }} />
                <div className="h-full transition-all" style={{ width: `${(gpsIstatistik.noPermission / gpsIstatistik.total) * 100}%`, background: '#F59E0B' }} />
              </div>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {[
                  { dot: '#22C55E', label: 'Doğrulandı' },
                  { dot: '#EF4444', label: 'Kapsam dışı' },
                  { dot: '#F59E0B', label: 'İzin yok' },
                ].map(l => (
                  <span key={l.label} className="flex items-center gap-1 text-[9px]" style={{ color: textMuted }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: l.dot }} />{l.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TABLO / EMPTY STATE ── */}
      {loading ? (
        <div className="rounded-2xl p-12 flex flex-col items-center gap-3" style={cardStyle}>
          <i className="ri-loader-4-line text-2xl animate-spin" style={{ color: '#0EA5E9' }} />
          <p className="text-sm" style={{ color: textMuted }}>Ziyaretler yükleniyor...</p>
        </div>
      ) : ziyaretler.length === 0 ? (
        <div className="rounded-2xl p-14 flex flex-col items-center gap-5" style={cardStyle}>
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(14,165,233,0.08)', border: '1.5px solid rgba(14,165,233,0.15)' }}>
            <i className="ri-map-pin-2-line text-3xl" style={{ color: '#0EA5E9' }} />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold" style={{ color: textPrimary }}>
              {filterTarih === 'bugun' ? 'Henüz ziyaret yok' : 'Ziyaret bulunamadı'}
            </p>
            <p className="text-xs mt-1.5 max-w-xs" style={{ color: textMuted }}>
              {aktifFilterSayisi > 0 ? 'Seçili filtre koşullarında kayıt yok.' : filterTarih === 'bugun' ? 'Uzmanlar QR ile ziyaret başlatabilir.' : 'Seçili dönemde ziyaret kaydı bulunamadı.'}
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
          <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <p className="text-xs font-semibold" style={{ color: textMuted }}>
              <span className="font-bold" style={{ color: textPrimary }}>{ziyaretler.length}</span> kayıt
            </p>
            {aktifFilterSayisi > 0 && (
              <button onClick={() => { setFilterUzman(''); setFilterFirma(''); setFilterDurum(''); }}
                className="text-[10px] font-semibold cursor-pointer flex items-center gap-1" style={{ color: '#EF4444' }}>
                <i className="ri-close-circle-line" />Filtreleri temizle
              </button>
            )}
          </div>

          <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {ziyaretler.map((z, i) => {
              const isAktif = z.durum === 'aktif';
              return (
                <div key={z.id} onClick={() => setSecilenZiyaret(z)}
                  className="flex items-center gap-4 px-5 py-3.5 cursor-pointer transition-all"
                  style={{ background: isAktif ? (isDark ? 'rgba(34,197,94,0.04)' : 'rgba(34,197,94,0.025)') : 'transparent', animationDelay: `${i * 30}ms` }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = isAktif ? 'rgba(34,197,94,0.08)' : 'var(--bg-row-hover)';
                    (e.currentTarget as HTMLElement).style.paddingLeft = '22px';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = isAktif ? (isDark ? 'rgba(34,197,94,0.04)' : 'rgba(34,197,94,0.025)') : 'transparent';
                    (e.currentTarget as HTMLElement).style.paddingLeft = '20px';
                  }}>
                  <div className="relative flex-shrink-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-extrabold text-white"
                      style={{ background: isAktif ? 'linear-gradient(135deg, #22C55E, #16A34A)' : 'linear-gradient(135deg, #64748b, #475569)' }}>
                      {(z.uzman_ad ?? z.uzman_email ?? '?').charAt(0).toUpperCase()}
                    </div>
                    {isAktif && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 animate-pulse"
                        style={{ background: '#22C55E', borderColor: 'var(--bg-card-solid)' }} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: textPrimary }}>{z.uzman_ad ?? '—'}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <i className="ri-building-2-line text-[9px] flex-shrink-0" style={{ color: '#0EA5E9' }} />
                      <p className="text-[11px] truncate" style={{ color: textMuted }}>{z.firma_ad ?? '—'}</p>
                    </div>
                  </div>

                  <div className="flex-shrink-0 text-right hidden sm:block">
                    <p className="text-xs font-semibold" style={{ color: textPrimary }}>{formatSaat(z.giris_saati)}</p>
                    <p className="text-[10px]" style={{ color: textMuted }}>{formatTarih(z.giris_saati)}</p>
                  </div>

                  <div className="flex-shrink-0">
                    {isAktif ? (
                      <ElapsedTimer since={z.giris_saati} />
                    ) : (() => {
                        const sureDk = getSureDakika(z);
                        return (
                          <span className="text-[10px] font-bold px-2 py-1 rounded-lg"
                            style={{ background: sureDk ? 'rgba(6,182,212,0.08)' : 'transparent', color: sureDk ? '#06B6D4' : textMuted, border: sureDk ? '1px solid rgba(6,182,212,0.15)' : 'none' }}>
                            {formatSure(sureDk)}
                          </span>
                        );
                      })()
                    }
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isAktif ? (
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#22C55E' }} />
                        <span className="text-[10px] font-bold px-2 py-1 rounded-xl whitespace-nowrap"
                          style={{ background: 'rgba(34,197,94,0.1)', color: '#16A34A', border: '1px solid rgba(34,197,94,0.2)' }}>
                          Devam ediyor
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#94A3B8' }} />
                        <span className="text-[10px] font-bold px-2 py-1 rounded-xl whitespace-nowrap"
                          style={{ background: 'rgba(148,163,184,0.08)', color: '#94A3B8', border: '1px solid rgba(148,163,184,0.15)' }}>
                          Tamamlandı
                        </span>
                      </div>
                    )}
                    {z.qr_ile_giris && (
                      <span className="text-[9px] font-bold px-1.5 py-1 rounded-lg whitespace-nowrap"
                        style={{ background: 'rgba(14,165,233,0.1)', color: '#0284C7', border: '1px solid rgba(14,165,233,0.2)' }}>
                        <i className="ri-qr-code-line mr-0.5 text-[9px]" />QR
                      </span>
                    )}
                    <GpsBadge status={z.gps_status} distanceM={z.check_in_distance_m} />
                  </div>

                  <div className="w-7 h-7 flex items-center justify-center rounded-xl flex-shrink-0"
                    style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)' }}>
                    <i className="ri-arrow-right-s-line text-sm" style={{ color: textMuted }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
