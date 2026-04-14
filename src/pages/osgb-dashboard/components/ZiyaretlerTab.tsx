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

// ── HELPERS ──────────────────────────────────────────────────────

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
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
}

// ── CANLAYICI ──────────────────────────────────────────────────
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

// ── GPS BADGE ─────────────────────────────────────────────────
interface GpsBadgeCfg {
  dot: string; text: string; color: string; bg: string; border: string;
}

function getGpsBadgeCfg(status: 'ok' | 'too_far' | 'no_permission' | null, distM?: number | null): GpsBadgeCfg | null {
  if (!status) return null;
  const distStr = distM != null ? (distM >= 1000 ? ` (${(distM / 1000).toFixed(1)}km)` : ` (${distM}m)`) : '';
  switch (status) {
    case 'ok':
      return { dot: '#22C55E', text: 'Doğrulandı', color: '#16A34A', bg: 'rgba(34,197,94,0.09)', border: 'rgba(34,197,94,0.22)' };
    case 'too_far':
      return { dot: '#EF4444', text: `Kapsam dışı${distStr}`, color: '#DC2626', bg: 'rgba(239,68,68,0.09)', border: 'rgba(239,68,68,0.22)' };
    case 'no_permission':
      return { dot: '#F59E0B', text: 'GPS alınamadı', color: '#D97706', bg: 'rgba(245,158,11,0.09)', border: 'rgba(245,158,11,0.22)' };
    default: return null;
  }
}

function GpsBadge({ status, distanceM }: { status: 'ok' | 'too_far' | 'no_permission' | null; distanceM?: number | null }) {
  const cfg = getGpsBadgeCfg(status, distanceM);
  if (!cfg) return null;
  return (
    <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
      {cfg.text}
    </span>
  );
}

// ── AKTIF ZIYARET KARTI ─────────────────────────────────────────
function AktifZiyaretKarti({
  z, isDark, onClick,
}: { z: Ziyaret; isDark: boolean; onClick: () => void }) {
  const gpsCfg = getGpsBadgeCfg(z.gps_status, z.check_in_distance_m);

  const statusBadge = () => {
    if (!z.gps_status || z.gps_status === 'ok') {
      return (
        <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
          style={{ background: 'rgba(34,197,94,0.15)', color: '#16A34A', border: '1px solid rgba(34,197,94,0.3)' }}>
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#22C55E' }} />
          Sahada
        </span>
      );
    }
    if (z.gps_status === 'too_far') {
      return (
        <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
          style={{ background: 'rgba(239,68,68,0.12)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.25)' }}>
          <i className="ri-error-warning-line text-xs" />
          Konum ihlali
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
        style={{ background: 'rgba(245,158,11,0.12)', color: '#D97706', border: '1px solid rgba(245,158,11,0.25)' }}>
        <i className="ri-map-pin-line text-xs" />
        GPS alınamadı
      </span>
    );
  };

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-2xl transition-all cursor-pointer"
      style={{
        background: isDark
          ? 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(16,185,129,0.04) 100%)'
          : 'linear-gradient(135deg, rgba(34,197,94,0.06) 0%, rgba(240,253,244,0.9) 100%)',
        border: '1.5px solid rgba(34,197,94,0.25)',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(34,197,94,0.45)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(34,197,94,0.25)'; }}
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-base font-extrabold text-white"
            style={{ background: 'linear-gradient(135deg, #22C55E, #16A34A)' }}>
            {(z.uzman_ad ?? '?').charAt(0).toUpperCase()}
          </div>
          <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white animate-pulse flex-shrink-0"
            style={{ background: '#22C55E' }} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{z.uzman_ad ?? '—'}</p>
            {statusBadge()}
          </div>
          <div className="flex items-center gap-1.5 mb-2">
            <i className="ri-building-2-line text-xs flex-shrink-0" style={{ color: '#0EA5E9' }} />
            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{z.firma_ad ?? '—'}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
              <i className="ri-login-circle-line text-xs" />
              {formatSaat(z.giris_saati)} girdi
            </span>
            {gpsCfg && (
              <GpsBadge status={z.gps_status} distanceM={z.check_in_distance_m} />
            )}
            {z.qr_ile_giris && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                style={{ background: 'rgba(14,165,233,0.1)', color: '#0284C7', border: '1px solid rgba(14,165,233,0.2)' }}>
                <i className="ri-qr-code-line mr-0.5" />QR
              </span>
            )}
          </div>
        </div>

        {/* Sayaç */}
        <div className="flex-shrink-0 text-right">
          <div className="text-xl font-black leading-none mb-1">
            <ElapsedTimer since={z.giris_saati} />
          </div>
          <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>geçen süre</p>
          <div className="flex items-center justify-end gap-1 mt-2">
            <i className="ri-arrow-right-s-line text-xs" style={{ color: 'var(--text-muted)' }} />
            <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Detay</span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ── EXCEL EXPORT ───────────────────────────────────────────────
async function exportZiyaretlerExcel(ziyaretler: Ziyaret[], donem: string) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ISG Denetim Sistemi';
  wb.created = new Date();
  const sorted = [...ziyaretler].sort(
    (a, b) => new Date(b.giris_saati).getTime() - new Date(a.giris_saati).getTime()
  );
  const fmtTarih = (iso: string) =>
    new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const fmtSaat = (iso: string) =>
    new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const fmtSure = (dk: number | null): string => {
    if (!dk || dk < 0) return '—';
    const h = Math.floor(dk / 60);
    const m = dk % 60;
    return h > 0 ? `${h}s ${m}dk` : `${m} dk`;
  };

  const DARK_NAVY  = 'FF0F172A';
  const ACCENT     = 'FF10B981';
  const ACCENT_MID = 'FF059669';
  const LIGHT_ROW  = 'FFF8FFFE';
  const WHITE_ROW  = 'FFFFFFFF';
  const TOTAL_BG   = 'FFE8FDF5';

  const COL_DEFS = [
    { header: '#', key: 'no', width: 5 },
    { header: 'Tarih', key: 'tarih', width: 14 },
    { header: 'Uzman Adı', key: 'uzman', width: 28 },
    { header: 'Firma', key: 'firma', width: 24 },
    { header: 'Giriş', key: 'giris', width: 12 },
    { header: 'Çıkış', key: 'cikis', width: 12 },
    { header: 'Süre (dk)', key: 'sure_dk', width: 12 },
    { header: 'Süre', key: 'sure', width: 11 },
    { header: 'Mesafe', key: 'mesafe', width: 14 },
    { header: 'GPS Durumu', key: 'gps', width: 16 },
    { header: 'Durum', key: 'durum', width: 14 },
  ];

  const wsAll = wb.addWorksheet('Ziyaretler', { tabColor: { argb: 'FF10B981' } });
  wsAll.columns = COL_DEFS;
  wsAll.getRow(1).height = 30;
  wsAll.getRow(1).eachCell({ includeEmpty: true }, cell => {
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_NAVY } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { bottom: { style: 'medium', color: { argb: ACCENT } } };
  });

  const tamamlanan = sorted.filter(z => z.durum === 'tamamlandi').length;

  sorted.forEach((z, i) => {
    const sureDk = z.sure_dakika != null
      ? z.sure_dakika
      : z.cikis_saati
        ? Math.round((new Date(z.cikis_saati).getTime() - new Date(z.giris_saati).getTime()) / 60000)
        : null;
    const gpsText = z.gps_status === 'ok' ? 'Doğrulandı'
      : z.gps_status === 'too_far' ? 'Kapsam Dışı'
      : z.gps_status === 'no_permission' ? 'İzin Yok' : '—';

    const mesafeText = z.check_in_distance_m != null
      ? (z.check_in_distance_m >= 1000
        ? `${(z.check_in_distance_m / 1000).toFixed(2)} km`
        : `${z.check_in_distance_m} m`)
      : '—';

    const row = wsAll.addRow({
      no: i + 1, tarih: fmtTarih(z.giris_saati),
      uzman: z.uzman_ad ?? z.uzman_email ?? '—', firma: z.firma_ad ?? '—',
      giris: fmtSaat(z.giris_saati), cikis: z.cikis_saati ? fmtSaat(z.cikis_saati) : '—',
      sure_dk: sureDk ?? '—', sure: fmtSure(sureDk),
      mesafe: mesafeText,
      gps: gpsText,
      durum: z.durum === 'aktif' ? 'Devam Ediyor' : 'Tamamlandı',
    });
    row.height = 22;
    const zebraColor = i % 2 === 0 ? WHITE_ROW : LIGHT_ROW;
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebraColor } };
      cell.alignment = { vertical: 'middle', horizontal: colNum <= 4 ? 'left' : 'center' };
      cell.font = { size: 10, name: 'Calibri', color: { argb: 'FF334155' } };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE9F0F8' } } };
    });

    // Mesafe renk kodlaması
    const distM = z.check_in_distance_m;
    if (distM != null) {
      const mesafeColor = distM > 1000 ? 'FFDC2626' : distM > 200 ? 'FFD97706' : 'FF16A34A';
      row.getCell('mesafe').font = { bold: true, size: 10, name: 'Calibri', color: { argb: mesafeColor } };
    }

    const gpsColor = z.gps_status === 'ok' ? 'FF16A34A' : z.gps_status === 'too_far' ? 'FFDC2626' : z.gps_status === 'no_permission' ? 'FFD97706' : 'FF94A3B8';
    row.getCell('gps').font = { bold: true, size: 10, name: 'Calibri', color: { argb: gpsColor } };
    row.getCell('durum').font = { bold: true, size: 10, name: 'Calibri', color: { argb: z.durum === 'aktif' ? 'FF16A34A' : 'FF64748B' } };
  });

  const totalSure = sorted.reduce((s, z) => {
    const dk = z.sure_dakika ?? (z.cikis_saati ? Math.round((new Date(z.cikis_saati).getTime() - new Date(z.giris_saati).getTime()) / 60000) : 0);
    return s + dk;
  }, 0);

  wsAll.addRow([]);
  const totRow = wsAll.addRow({
    no: '', tarih: `TOPLAM: ${sorted.length} ziyaret`, uzman: '', firma: '',
    giris: '', cikis: '', sure_dk: totalSure, sure: fmtSure(totalSure),
    mesafe: '', gps: '', durum: `${tamamlanan} tam.`,
  });
  totRow.height = 26;
  totRow.eachCell({ includeEmpty: true }, (cell, ci) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } };
    cell.font = { bold: true, size: 10, name: 'Calibri', color: { argb: ci === 2 ? DARK_NAVY : ACCENT_MID } };
    cell.alignment = { vertical: 'middle', horizontal: ci === 2 ? 'left' : 'center' };
    cell.border = { top: { style: 'medium', color: { argb: ACCENT } } };
  });

  // Alt imza satırı
  wsAll.addRow([]);
  wsAll.addRow([]);
  const now = new Date();
  const signatureRow = wsAll.addRow({
    no: '',
    tarih: `Bu rapor isgdenetim.com.tr tarafından ${now.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} tarihinde oluşturulmuştur.`,
  });
  signatureRow.height = 20;
  signatureRow.getCell('tarih').font = { italic: true, size: 9, name: 'Calibri', color: { argb: 'FF94A3B8' } };
  signatureRow.getCell('tarih').alignment = { horizontal: 'left', vertical: 'middle' };
  // Imza hücrelerini birleştir
  const lastColLetter = 'K';
  const sigRowNum = signatureRow.number;
  wsAll.mergeCells(`B${sigRowNum}:${lastColLetter}${sigRowNum}`);

  wsAll.views = [{ state: 'frozen', ySplit: 1 }];

  const fileName = `Ziyaret-Raporu-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.xlsx`;
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  void donem;
}

// ── TİP ──────────────────────────────────────────────────────
type FilterTarih = 'bugun' | 'bu_hafta' | 'bu_ay' | 'ozel';

interface ZiyaretlerTabProps {
  isDark: boolean;
}

// ── ANA COMPONENT ──────────────────────────────────────────────
export default function ZiyaretlerTab({ isDark }: ZiyaretlerTabProps) {
  const { org, addToast } = useApp();
  const [ziyaretler, setZiyaretler] = useState<Ziyaret[]>([]);
  const [tumZiyaretler, setTumZiyaretler] = useState<Ziyaret[]>([]);
  const [loading, setLoading] = useState(true);
  const [secilenZiyaret, setSecilenZiyaret] = useState<Ziyaret | null>(null);
  const [exporting, setExporting] = useState(false);

  // Filtreler
  const [filterTarih, setFilterTarih] = useState<FilterTarih>('bugun');
  const [filterOzelBaslangic, setFilterOzelBaslangic] = useState('');
  const [filterOzelBitis, setFilterOzelBitis] = useState('');
  const [filterUzman, setFilterUzman] = useState('');
  const [filterFirma, setFilterFirma] = useState('');
  const [filterDurum, setFilterDurum] = useState<'' | 'aktif' | 'tamamlandi'>('');
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Realtime canli guncelleme sayaci
  const realtimeRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      .select('id,osgb_org_id,firma_org_id,firma_ad,uzman_user_id,uzman_ad,uzman_email,giris_saati,cikis_saati,durum,qr_ile_giris,sure_dakika,notlar,konum_lat,konum_lng,konum_adres,gps_status,check_in_distance_m,check_in_lat,check_in_lng')
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

      const sorted = ((data ?? []) as Ziyaret[]).sort((a, b) => {
        if (a.durum === 'aktif' && b.durum !== 'aktif') return -1;
        if (a.durum !== 'aktif' && b.durum === 'aktif') return 1;
        return new Date(b.giris_saati).getTime() - new Date(a.giris_saati).getTime();
      });

      const filtered = sorted.filter(z =>
        (!filterUzman || (z.uzman_ad ?? '').toLowerCase().includes(filterUzman.toLowerCase()) ||
          (z.uzman_email ?? '').toLowerCase().includes(filterUzman.toLowerCase())) &&
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

  // Realtime subscription — osgb_ziyaretler değişince otomatik refresh
  useEffect(() => {
    if (!org?.id) return;

    const channel = supabase
      .channel(`ziyaretler_rt_${org.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'osgb_ziyaretler',
          filter: `osgb_org_id=eq.${org.id}`,
        },
        () => {
          void fetchZiyaretler();
          void fetchTumZiyaretler();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [org?.id, fetchZiyaretler, fetchTumZiyaretler]);

  // Aktif ziyaretler için ek polling (15sn — realtime backup)
  useEffect(() => {
    const hasAktif = ziyaretler.some(z => z.durum === 'aktif');
    if (hasAktif) {
      realtimeRef.current = setInterval(() => {
        void fetchZiyaretler();
      }, 15000);
    }
    return () => {
      if (realtimeRef.current) clearInterval(realtimeRef.current);
    };
  }, [ziyaretler, fetchZiyaretler]);

  const handleBitir = async (ziyaretId: string) => {
    try {
      const cikis = new Date().toISOString();
      // sure_dakika GENERATED ALWAYS — DB otomatik hesaplar, göndermiyoruz
      const { error } = await supabase
        .from('osgb_ziyaretler')
        .update({ durum: 'tamamlandi', cikis_saati: cikis, updated_at: cikis })
        .eq('id', ziyaretId);
      if (error) throw error;
      addToast('Ziyaret tamamlandı!', 'success');
      setSecilenZiyaret(null);
      void fetchZiyaretler();
      void fetchTumZiyaretler();
    } catch (err) {
      addToast(`Hata: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  };

  // ── HESAPLAMALAR ──
  const aktifZiyaretler = useMemo(() => ziyaretler.filter(z => z.durum === 'aktif'), [ziyaretler]);

  const bugunSayisi = useMemo(() => {
    const today = new Date().toDateString();
    return tumZiyaretler.filter(z => new Date(z.giris_saati).toDateString() === today).length;
  }, [tumZiyaretler]);

  const son30GunSayisi = useMemo(() => tumZiyaretler.length, [tumZiyaretler]);

  const ihlalOrani = useMemo(() => {
    const gpsli = tumZiyaretler.filter(z => z.gps_status !== null);
    if (gpsli.length === 0) return 0;
    const ihlal = gpsli.filter(z => z.gps_status === 'too_far' || z.gps_status === 'no_permission').length;
    return Math.round((ihlal / gpsli.length) * 100);
  }, [tumZiyaretler]);

  const aktifFilterSayisi = [filterUzman, filterFirma, filterDurum].filter(Boolean).length;

  const textPrimary = 'var(--text-primary)';
  const textMuted = 'var(--text-muted)';
  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-card-solid)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '16px',
  };

  // ── RENDER ──
  return (
    <div className="space-y-4 page-enter">

      {/* HEADER */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-base font-bold" style={{ color: textPrimary }}>Saha Ziyaretleri</h2>
          <p className="text-xs mt-0.5" style={{ color: textMuted }}>Uzmanların saha ziyaret takibi</p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {/* Dönem */}
          <div className="flex items-center gap-0.5 p-1 rounded-xl"
            style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)' }}>
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

          {/* Filtre */}
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
                <span className="w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-bold text-white"
                  style={{ background: '#0EA5E9' }}>
                  {aktifFilterSayisi}
                </span>
              )}
            </button>

            {filterOpen && (
              <div className="absolute right-0 top-11 z-50 w-72 p-4 rounded-2xl"
                style={{
                  background: 'var(--modal-bg)',
                  border: '1px solid var(--modal-border)',
                  boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.5)' : '0 16px 40px rgba(15,23,42,0.12)',
                }}>
                <p className="text-xs font-bold mb-3" style={{ color: textPrimary }}>Filtreler</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-semibold mb-1.5" style={{ color: textMuted }}>Personel</label>
                    <div className="relative">
                      <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: textMuted }} />
                      <input value={filterUzman} onChange={e => setFilterUzman(e.target.value)}
                        placeholder="Uzman adı..." className="w-full text-xs pl-8 pr-3 py-2 rounded-xl outline-none"
                        style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: textPrimary }} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold mb-1.5" style={{ color: textMuted }}>Firma</label>
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
                        { val: 'aktif', label: 'Aktif' },
                        { val: 'tamamlandi', label: 'Tamamlandı' },
                      ] as { val: '' | 'aktif' | 'tamamlandi'; label: string }[]).map(opt => (
                        <button key={opt.val} onClick={() => setFilterDurum(opt.val)}
                          className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold cursor-pointer whitespace-nowrap"
                          style={{
                            background: filterDurum === opt.val
                              ? (opt.val === 'aktif' ? 'rgba(34,197,94,0.12)' : opt.val === 'tamamlandi' ? 'rgba(148,163,184,0.12)' : 'rgba(14,165,233,0.12)')
                              : 'var(--bg-item)',
                            border: filterDurum === opt.val
                              ? (opt.val === 'aktif' ? '1px solid rgba(34,197,94,0.25)' : opt.val === 'tamamlandi' ? '1px solid rgba(148,163,184,0.25)' : '1px solid rgba(14,165,233,0.25)')
                              : '1px solid var(--border-subtle)',
                            color: filterDurum === opt.val
                              ? (opt.val === 'aktif' ? '#22C55E' : opt.val === 'tamamlandi' ? '#94A3B8' : '#0EA5E9')
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
                      <i className="ri-close-line mr-1" />Temizle
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Excel */}
          <button onClick={() => { setExporting(true); void exportZiyaretlerExcel(ziyaretler, filterTarih).finally(() => setExporting(false)); }}
            disabled={exporting || ziyaretler.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap transition-all"
            style={{
              background: ziyaretler.length > 0 ? 'rgba(14,165,233,0.1)' : 'var(--bg-item)',
              border: `1px solid ${ziyaretler.length > 0 ? 'rgba(14,165,233,0.25)' : 'var(--border-subtle)'}`,
              color: ziyaretler.length > 0 ? '#0EA5E9' : textMuted,
              opacity: exporting ? 0.7 : 1,
            }}>
            {exporting ? <><i className="ri-loader-4-line animate-spin text-xs" />İndiriliyor...</> : <><i className="ri-file-excel-2-line text-sm" />Excel</>}
          </button>

          {/* Yenile */}
          <button onClick={() => { void fetchZiyaretler(); void fetchTumZiyaretler(); }}
            className="w-9 h-9 flex items-center justify-center rounded-xl cursor-pointer transition-all"
            style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', color: textMuted }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.1)'; (e.currentTarget as HTMLElement).style.color = '#0EA5E9'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-item)'; (e.currentTarget as HTMLElement).style.color = textMuted; }}>
            <i className="ri-refresh-line text-sm" />
          </button>
        </div>
      </div>

      {/* ── STAT KARTLAR ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Aktif Ziyaret',
            value: aktifZiyaretler.length,
            sub: aktifZiyaretler.length > 0 ? `${aktifZiyaretler.length} kişi sahada` : 'Şu an kimse yok',
            icon: 'ri-map-pin-user-line',
            color: '#22C55E',
            bg: 'linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(16,185,129,0.04) 100%)',
            border: 'rgba(34,197,94,0.2)',
            pulse: aktifZiyaretler.length > 0,
          },
          {
            label: 'Bugün',
            value: bugunSayisi,
            sub: 'Bugünkü ziyaret',
            icon: 'ri-calendar-check-line',
            color: '#0EA5E9',
            bg: 'linear-gradient(135deg, rgba(14,165,233,0.1) 0%, rgba(2,132,199,0.04) 100%)',
            border: 'rgba(14,165,233,0.2)',
            pulse: false,
          },
          {
            label: 'Son 30 Gün',
            value: son30GunSayisi,
            sub: 'Toplam ziyaret',
            icon: 'ri-calendar-2-line',
            color: '#F59E0B',
            bg: 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(217,119,6,0.04) 100%)',
            border: 'rgba(245,158,11,0.2)',
            pulse: false,
          },
          {
            label: 'İhlal Oranı',
            value: `%${ihlalOrani}`,
            sub: 'GPS ihlali',
            icon: 'ri-map-pin-2-line',
            color: ihlalOrani > 20 ? '#EF4444' : ihlalOrani > 5 ? '#F59E0B' : '#22C55E',
            bg: ihlalOrani > 20
              ? 'linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(220,38,38,0.04) 100%)'
              : ihlalOrani > 5
                ? 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(217,119,6,0.04) 100%)'
                : 'linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(16,185,129,0.04) 100%)',
            border: ihlalOrani > 20 ? 'rgba(239,68,68,0.2)' : ihlalOrani > 5 ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)',
            pulse: false,
          },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-2xl p-4"
            style={{ background: kpi.bg, border: `1px solid ${kpi.border}` }}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 flex items-center justify-center rounded-xl"
                style={{ background: `${kpi.color}18`, border: `1px solid ${kpi.border}` }}>
                <i className={`${kpi.icon} text-sm`} style={{ color: kpi.color }} />
              </div>
              {kpi.pulse && (
                <span className="flex items-center gap-1 text-[9px] font-bold" style={{ color: '#22C55E' }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ background: '#22C55E', opacity: 0.7 }} />
                  CANLI
                </span>
              )}
            </div>
            <p className="text-2xl font-black leading-none" style={{ color: textPrimary }}>{kpi.value}</p>
            <p className="text-[10px] mt-1.5" style={{ color: textMuted }}>{kpi.sub}</p>
            <p className="text-[9px] font-semibold mt-0.5 uppercase tracking-wide" style={{ color: kpi.color }}>{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* ── AKTİF ZİYARETLER ALANI ── */}
      {aktifZiyaretler.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1.5px solid rgba(34,197,94,0.3)', background: isDark ? 'rgba(34,197,94,0.02)' : 'rgba(240,253,244,0.5)' }}>
          {/* Başlık */}
          <div className="flex items-center gap-3 px-5 py-3.5"
            style={{ borderBottom: '1px solid rgba(34,197,94,0.15)', background: isDark ? 'rgba(34,197,94,0.06)' : 'rgba(34,197,94,0.04)' }}>
            <div className="relative flex-shrink-0 w-3 h-3 flex items-center justify-center">
              <span className="w-3 h-3 rounded-full absolute animate-ping" style={{ background: 'rgba(34,197,94,0.4)' }} />
              <span className="w-2 h-2 rounded-full relative" style={{ background: '#22C55E' }} />
            </div>
            <h3 className="text-sm font-bold" style={{ color: '#16A34A' }}>
              Şu An Sahada — {aktifZiyaretler.length} Aktif Ziyaret
            </h3>
          </div>
          {/* Kartlar */}
          <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
            {aktifZiyaretler.map(z => (
              <AktifZiyaretKarti
                key={z.id}
                z={z}
                isDark={isDark}
                onClick={() => setSecilenZiyaret(z)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── TABLO ── */}
      {loading ? (
        <div className="rounded-2xl p-12 flex flex-col items-center gap-3" style={cardStyle}>
          <i className="ri-loader-4-line text-2xl animate-spin" style={{ color: '#0EA5E9' }} />
          <p className="text-sm" style={{ color: textMuted }}>Ziyaretler yükleniyor...</p>
        </div>
      ) : ziyaretler.length === 0 ? (
        <div className="rounded-2xl p-14 flex flex-col items-center gap-5" style={cardStyle}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(14,165,233,0.08)', border: '1.5px solid rgba(14,165,233,0.15)' }}>
            <i className="ri-map-pin-2-line text-2xl" style={{ color: '#0EA5E9' }} />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold" style={{ color: textPrimary }}>
              {filterTarih === 'bugun' ? 'Henüz ziyaret yok' : 'Ziyaret bulunamadı'}
            </p>
            <p className="text-xs mt-1.5 max-w-xs" style={{ color: textMuted }}>
              {aktifFilterSayisi > 0
                ? 'Seçili filtre koşullarında kayıt yok.'
                : filterTarih === 'bugun'
                  ? 'Uzmanlar QR ile ziyaret başlatabilir.'
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
          {/* Tablo başlığı */}
          <div className="flex items-center justify-between px-5 py-3.5"
            style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-item)' }}>
            <p className="text-xs font-semibold" style={{ color: textMuted }}>
              <span className="font-bold" style={{ color: textPrimary }}>{ziyaretler.length}</span> ziyaret
            </p>
            {aktifFilterSayisi > 0 && (
              <button onClick={() => { setFilterUzman(''); setFilterFirma(''); setFilterDurum(''); }}
                className="text-[10px] font-semibold cursor-pointer flex items-center gap-1" style={{ color: '#EF4444' }}>
                <i className="ri-close-circle-line" />Filtreleri temizle
              </button>
            )}
          </div>

          {/* Desktop tablo — sütun başlıkları */}
          <div className="hidden lg:grid px-5 py-2.5 text-[10px] font-bold uppercase tracking-wide"
            style={{
              gridTemplateColumns: '36px 1fr 1fr 85px 85px 72px 90px 90px 80px 72px',
              borderBottom: '1px solid var(--border-subtle)',
              color: textMuted,
              background: isDark ? 'rgba(15,23,42,0.4)' : 'rgba(248,250,252,0.8)',
            }}>
            <div>#</div>
            <div>Personel</div>
            <div>Firma</div>
            <div>Giriş</div>
            <div>Çıkış</div>
            <div>Süre</div>
            <div>Mesafe</div>
            <div>GPS</div>
            <div>Durum</div>
            <div className="text-right">Aksiyon</div>
          </div>

          {/* Satırlar */}
          <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {ziyaretler.map((z, i) => {
              const isAktif = z.durum === 'aktif';
              const gpsCfg = getGpsBadgeCfg(z.gps_status, z.check_in_distance_m);

              return (
                <div key={z.id}
                  className="transition-all"
                  style={{
                    background: isAktif
                      ? (isDark ? 'rgba(34,197,94,0.04)' : 'rgba(34,197,94,0.025)')
                      : 'transparent',
                  }}>
                  {/* Desktop layout */}
                  <div
                    className="hidden lg:grid px-5 py-3 items-center cursor-pointer"
                    style={{ gridTemplateColumns: '36px 1fr 1fr 85px 85px 72px 90px 90px 80px 72px' }}
                    onClick={() => setSecilenZiyaret(z)}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isAktif ? 'rgba(34,197,94,0.08)' : 'var(--bg-row-hover)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>

                    {/* # */}
                    <div className="text-[11px] font-bold" style={{ color: textMuted }}>{i + 1}</div>

                    {/* Personel */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative flex-shrink-0">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-extrabold text-white"
                          style={{ background: isAktif ? 'linear-gradient(135deg,#22C55E,#16A34A)' : 'linear-gradient(135deg,#64748b,#475569)' }}>
                          {(z.uzman_ad ?? '?').charAt(0).toUpperCase()}
                        </div>
                        {isAktif && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 animate-pulse"
                            style={{ background: '#22C55E', borderColor: 'var(--bg-card-solid)' }} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: textPrimary }}>{z.uzman_ad ?? '—'}</p>
                        <p className="text-[10px] truncate" style={{ color: textMuted }}>{z.uzman_email ?? ''}</p>
                      </div>
                    </div>

                    {/* Firma */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <i className="ri-building-2-line text-xs flex-shrink-0" style={{ color: '#0EA5E9' }} />
                      <p className="text-xs truncate" style={{ color: textMuted }}>{z.firma_ad ?? '—'}</p>
                    </div>

                    {/* Giriş */}
                    <div>
                      <p className="text-xs font-semibold" style={{ color: textPrimary }}>{formatSaat(z.giris_saati)}</p>
                      <p className="text-[10px]" style={{ color: textMuted }}>{formatTarih(z.giris_saati)}</p>
                    </div>

                    {/* Çıkış */}
                    <div>
                      {z.cikis_saati ? (
                        <>
                          <p className="text-xs font-semibold" style={{ color: textPrimary }}>{formatSaat(z.cikis_saati)}</p>
                          <p className="text-[10px]" style={{ color: textMuted }}>{formatTarih(z.cikis_saati)}</p>
                        </>
                      ) : (
                        <span className="text-xs" style={{ color: '#F59E0B' }}>Devam ediyor</span>
                      )}
                    </div>

                    {/* Süre */}
                    <div>
                      {isAktif
                        ? <ElapsedTimer since={z.giris_saati} />
                        : (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
                            style={{
                              background: z.sure_dakika ? 'rgba(99,102,241,0.08)' : 'transparent',
                              color: z.sure_dakika ? '#6366F1' : textMuted,
                            }}>
                            {formatSure(z.sure_dakika)}
                          </span>
                        )}
                    </div>

                    {/* Mesafe */}
                    <div>
                      {z.check_in_distance_m != null ? (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
                          style={{
                            background: z.check_in_distance_m > 1000
                              ? 'rgba(239,68,68,0.08)'
                              : z.check_in_distance_m > 200
                                ? 'rgba(245,158,11,0.08)'
                                : 'rgba(34,197,94,0.08)',
                            color: z.check_in_distance_m > 1000
                              ? '#EF4444'
                              : z.check_in_distance_m > 200
                                ? '#F59E0B'
                                : '#22C55E',
                          }}>
                          {z.check_in_distance_m >= 1000
                            ? `${(z.check_in_distance_m / 1000).toFixed(1)} km`
                            : `${z.check_in_distance_m} m`}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: textMuted }}>—</span>
                      )}
                    </div>

                    {/* GPS */}
                    <div>
                      {gpsCfg ? (
                        <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap w-fit"
                          style={{ background: gpsCfg.bg, color: gpsCfg.color, border: `1px solid ${gpsCfg.border}` }}>
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: gpsCfg.dot }} />
                          {z.gps_status === 'ok' ? 'Doğrulandı' : z.gps_status === 'too_far' ? 'Uzakta' : 'GPS yok'}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: textMuted }}>—</span>
                      )}
                    </div>

                    {/* Durum */}
                    <div>
                      {isAktif ? (
                        <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap w-fit"
                          style={{ background: 'rgba(34,197,94,0.1)', color: '#16A34A', border: '1px solid rgba(34,197,94,0.2)' }}>
                          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#22C55E' }} />
                          Aktif
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap w-fit"
                          style={{ background: 'rgba(148,163,184,0.1)', color: '#94A3B8', border: '1px solid rgba(148,163,184,0.2)' }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#94A3B8' }} />
                          Tamamlandı
                        </span>
                      )}
                    </div>

                    {/* Aksiyon */}
                    <div className="flex items-center justify-end gap-1">
                      {/* Detay */}
                      <div className="relative group">
                        <button
                          onClick={e => { e.stopPropagation(); setSecilenZiyaret(z); }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all"
                          style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', color: textMuted }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.1)'; (e.currentTarget as HTMLElement).style.color = '#0EA5E9'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-item)'; (e.currentTarget as HTMLElement).style.color = textMuted; }}>
                          <i className="ri-eye-line text-xs" />
                        </button>
                        <div className="absolute bottom-full right-0 mb-1.5 px-2 py-1 rounded-lg text-[10px] font-medium pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10"
                          style={{ background: 'rgba(15,23,42,0.9)', color: '#E2E8F0' }}>Detay</div>
                      </div>
                      {/* Haritada Gör */}
                      {(z.konum_lat || z.check_in_lat) && (
                        <div className="relative group">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              const lat = z.check_in_lat ?? z.konum_lat;
                              const lng = z.check_in_lng ?? z.konum_lng;
                              if (lat && lng) window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
                            }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all"
                            style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', color: textMuted }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(34,197,94,0.1)'; (e.currentTarget as HTMLElement).style.color = '#22C55E'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-item)'; (e.currentTarget as HTMLElement).style.color = textMuted; }}>
                            <i className="ri-map-pin-line text-xs" />
                          </button>
                          <div className="absolute bottom-full right-0 mb-1.5 px-2 py-1 rounded-lg text-[10px] font-medium pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10"
                            style={{ background: 'rgba(15,23,42,0.9)', color: '#E2E8F0' }}>Haritada gör</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Mobil layout */}
                  <div className="flex lg:hidden items-start gap-3 px-4 py-3.5 cursor-pointer"
                    onClick={() => setSecilenZiyaret(z)}>
                    <div className="relative flex-shrink-0">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-extrabold text-white"
                        style={{ background: isAktif ? 'linear-gradient(135deg,#22C55E,#16A34A)' : 'linear-gradient(135deg,#64748b,#475569)' }}>
                        {(z.uzman_ad ?? '?').charAt(0).toUpperCase()}
                      </div>
                      {isAktif && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 animate-pulse"
                          style={{ background: '#22C55E', borderColor: 'var(--bg-card-solid)' }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: textPrimary }}>{z.uzman_ad ?? '—'}</p>
                      <p className="text-[11px] truncate" style={{ color: textMuted }}>{z.firma_ad ?? '—'}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px]" style={{ color: textMuted }}>{formatSaat(z.giris_saati)}</span>
                        {isAktif
                          ? <ElapsedTimer since={z.giris_saati} />
                          : <span className="text-[10px]" style={{ color: textMuted }}>{formatSure(z.sure_dakika)}</span>}
                        {gpsCfg && <GpsBadge status={z.gps_status} distanceM={z.check_in_distance_m} />}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {isAktif ? (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(34,197,94,0.1)', color: '#16A34A', border: '1px solid rgba(34,197,94,0.2)' }}>Aktif</span>
                      ) : (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(148,163,184,0.1)', color: '#94A3B8', border: '1px solid rgba(148,163,184,0.2)' }}>Bitti</span>
                      )}
                    </div>
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
