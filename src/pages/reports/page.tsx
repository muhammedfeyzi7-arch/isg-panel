import { useMemo, useState, useEffect, useRef } from 'react';
import { useApp } from '../../store/AppContext';
import Badge, { getFirmaStatusColor, getTehlikeColor } from '../../components/base/Badge';
import type ExcelJS from 'exceljs';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadialBarChart, RadialBar,
} from 'recharts';

const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

function getMonthKey(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function last12Months(): { key: string; label: string }[] {
  const result = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: MONTHS_TR[d.getMonth()],
    });
  }
  return result;
}

function useCountUp(target: number, duration = 1000) {
  const [count, setCount] = useState(0);
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    if (target === 0) { setCount(0); return; }
    startRef.current = null;
    let raf: number;
    const step = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(ease * target));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return count;
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-4 py-3" style={{
      background: 'rgba(10,16,32,0.95)',
      border: '1px solid rgba(255,255,255,0.08)',
      backdropFilter: 'blur(12px)',
      minWidth: 140,
    }}>
      <p className="text-[11px] font-semibold mb-2" style={{ color: '#64748B' }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-[11px] mb-1">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span style={{ color: '#94A3B8' }}>{p.name}:</span>
          <span className="font-bold ml-auto" style={{ color: '#F1F5F9' }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function AnimatedKPICard({ label, value, icon, color, sub, trend, delay = 0 }: {
  label: string; value: number; icon: string; color: string; sub: string; trend?: number; delay?: number;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  const animVal = useCountUp(visible ? value : 0, 900);

  return (
    <div
      className="rounded-2xl p-5 relative overflow-hidden cursor-default transition-all duration-300"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-main)',
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        opacity: visible ? 1 : 0,
        transition: `transform 0.5s ease ${delay}ms, opacity 0.5s ease ${delay}ms`,
      }}
    >
      {/* Glow bg */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `radial-gradient(ellipse at top left, ${color}10 0%, transparent 60%)`,
      }} />
      {/* Top accent */}
      <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${color}, ${color}40)` }} />

      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0" style={{
          background: `${color}18`,
          border: `1px solid ${color}25`,
        }}>
          <i className={`${icon} text-base`} style={{ color }} />
        </div>
        {trend !== undefined && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{
            background: trend >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
            color: trend >= 0 ? '#34D399' : '#F87171',
            border: `1px solid ${trend >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
          }}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>

      <p className="text-3xl font-black mb-1" style={{ color: 'var(--text-primary)', letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}>
        {animVal.toLocaleString('tr-TR')}
      </p>
      <p className="text-[12px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <p className="text-[11px] font-medium" style={{ color }}>{sub}</p>
    </div>
  );
}

function SectionHeader({ title, subtitle, icon, color = '#818CF8', action }: {
  title: string; subtitle?: string; icon: string; color?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0" style={{
          background: `${color}15`,
          border: `1px solid ${color}20`,
        }}>
          <i className={`${icon} text-sm`} style={{ color }} />
        </div>
        <div>
          <h3 className="text-[13.5px] font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
          {subtitle && <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl p-5 ${className}`} style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-main)',
    }}>
      {children}
    </div>
  );
}

function AnimatedProgressBar({ label, value, total, color, delay = 0 }: {
  label: string; value: number; total: number; color: string; delay?: number;
}) {
  const [width, setWidth] = useState(0);
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), delay + 200);
    return () => clearTimeout(t);
  }, [pct, delay]);

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{value}</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{
            background: `${color}15`,
            color,
          }}>%{pct}</span>
        </div>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-item)' }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${width}%`,
            background: `linear-gradient(90deg, ${color}, ${color}99)`,
            transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>
    </div>
  );
}

function DonutChart({ data, size = 160 }: {
  data: { name: string; value: number; color: string }[];
  size?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex items-center gap-5">
      <div style={{ width: size, height: size, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%" cy="50%"
              innerRadius={size * 0.3}
              outerRadius={size * 0.46}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-2.5">
        {data.map(d => (
          <div key={d.name} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
              <span className="text-[11.5px] truncate" style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{d.value}</span>
              <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
                {total > 0 ? `%${Math.round((d.value / total) * 100)}` : '%0'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RaporlarPage() {
  const {
    firmalar, personeller, evraklar, egitimler, muayeneler,
    uygunsuzluklar, ekipmanlar, gorevler, tutanaklar,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'genel' | 'evrak' | 'uygunsuzluk' | 'egitim'>('genel');
  const months = useMemo(() => last12Months(), []);

  const aktifFirmalar = useMemo(() => firmalar.filter(f => !f.silinmis), [firmalar]);
  const aktifPersoneller = useMemo(() => personeller.filter(p => !p.silinmis), [personeller]);
  const aktifEvraklar = useMemo(() => evraklar.filter(e => !e.silinmis), [evraklar]);
  const aktifEgitimler = useMemo(() => egitimler.filter(e => !e.silinmis), [egitimler]);
  const aktifMuayeneler = useMemo(() => muayeneler.filter(m => !m.silinmis), [muayeneler]);
  const aktifUygunsuzluklar = useMemo(() => uygunsuzluklar.filter(u => !u.silinmis), [uygunsuzluklar]);
  const aktifEkipmanlar = useMemo(() => ekipmanlar.filter(e => !e.silinmis), [ekipmanlar]);
  const aktifGorevler = useMemo(() => gorevler.filter(g => !g.silinmis), [gorevler]);
  const aktifTutanaklar = useMemo(() => tutanaklar.filter(t => !(t as unknown as { silinmis?: boolean }).silinmis), [tutanaklar]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const in30 = new Date(today.getTime() + 30 * 86400000);

  const monthlyTrend = useMemo(() => months.map(m => ({
    ay: m.label,
    Firma: aktifFirmalar.filter(f => getMonthKey(f.olusturmaTarihi) === m.key).length,
    Personel: aktifPersoneller.filter(p => getMonthKey(p.olusturmaTarihi) === m.key).length,
    Evrak: aktifEvraklar.filter(e => getMonthKey(e.olusturmaTarihi) === m.key).length,
    Eğitim: aktifEgitimler.filter(e => getMonthKey(e.olusturmaTarihi) === m.key).length,
  })), [months, aktifFirmalar, aktifPersoneller, aktifEvraklar, aktifEgitimler]);

  const evrakTamamlanma = useMemo(() => months.map(m => {
    const ay = aktifEvraklar.filter(e => getMonthKey(e.olusturmaTarihi) === m.key);
    const total = ay.length;
    const yuklu = ay.filter(e => e.durum === 'Yüklü').length;
    return {
      ay: m.label,
      'Tamamlanan': yuklu,
      'Eksik': total - yuklu,
    };
  }), [months, aktifEvraklar]);

  const tehlikeDagilim = useMemo(() => [
    { name: 'Az Tehlikeli', value: aktifFirmalar.filter(f => f.tehlikeSinifi === 'Az Tehlikeli').length, color: '#10B981' },
    { name: 'Tehlikeli', value: aktifFirmalar.filter(f => f.tehlikeSinifi === 'Tehlikeli').length, color: '#F59E0B' },
    { name: 'Çok Tehlikeli', value: aktifFirmalar.filter(f => f.tehlikeSinifi === 'Çok Tehlikeli').length, color: '#EF4444' },
  ].filter(d => d.value > 0), [aktifFirmalar]);

  const uygunsuzlukTrend = useMemo(() => months.map(m => ({
    ay: m.label,
    Açık: aktifUygunsuzluklar.filter(u => getMonthKey(u.olusturmaTarihi) === m.key && u.durum === 'Açık').length,
    Kapandı: aktifUygunsuzluklar.filter(u => getMonthKey(u.olusturmaTarihi) === m.key && u.durum === 'Kapandı').length,
  })), [months, aktifUygunsuzluklar]);

  const departmanDagilim = useMemo(() => {
    const map = new Map<string, number>();
    aktifPersoneller.forEach(p => { const d = p.departman || 'Belirtilmemiş'; map.set(d, (map.get(d) || 0) + 1); });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [aktifPersoneller]);

  const evrakStats = useMemo(() => ({
    yuklu: aktifEvraklar.filter(e => e.durum === 'Yüklü').length,
    eksik: aktifEvraklar.filter(e => e.durum === 'Eksik').length,
    sureDolmus: aktifEvraklar.filter(e => e.durum === 'Süre Dolmuş').length,
    sureYaklasiyor: aktifEvraklar.filter(e => {
      if (!e.gecerlilikTarihi) return false;
      const d = new Date(e.gecerlilikTarihi); d.setHours(0, 0, 0, 0);
      return d >= today && d <= in30;
    }).length,
  }), [aktifEvraklar]);

  const uygunsuzlukStats = useMemo(() => ({
    acik: aktifUygunsuzluklar.filter(u => u.durum === 'Açık').length,
    kapandi: aktifUygunsuzluklar.filter(u => u.durum === 'Kapandı').length,
    kritik: aktifUygunsuzluklar.filter(u => u.severity === 'Kritik').length,
    yuksek: aktifUygunsuzluklar.filter(u => u.severity === 'Yüksek').length,
  }), [aktifUygunsuzluklar]);

  const egitimDurum = useMemo(() => [
    { name: 'Tamamlandı', value: aktifEgitimler.filter(e => e.durum === 'Tamamlandı').length, color: '#10B981' },
    { name: 'Planlandı', value: aktifEgitimler.filter(e => e.durum === 'Planlandı').length, color: '#3B82F6' },
    { name: 'Eksik', value: aktifEgitimler.filter(e => e.durum === 'Eksik').length, color: '#EF4444' },
  ].filter(d => d.value > 0), [aktifEgitimler]);

  const ekipmanDurum = useMemo(() => [
    { name: 'Uygun', value: aktifEkipmanlar.filter(e => e.durum === 'Uygun').length, color: '#10B981' },
    { name: 'Bakımda', value: aktifEkipmanlar.filter(e => e.durum === 'Bakımda').length, color: '#F59E0B' },
    { name: 'Uygun Değil', value: aktifEkipmanlar.filter(e => e.durum === 'Uygun Değil').length, color: '#EF4444' },
    { name: 'Hurda', value: aktifEkipmanlar.filter(e => e.durum === 'Hurda').length, color: '#64748B' },
  ].filter(d => d.value > 0), [aktifEkipmanlar]);

  const DEPT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

  const tabs = [
    { id: 'genel', label: 'Genel Bakış', icon: 'ri-dashboard-line', color: '#818CF8' },
    { id: 'evrak', label: 'Evrak Analizi', icon: 'ri-file-chart-line', color: '#F59E0B' },
    { id: 'uygunsuzluk', label: 'Uygunsuzluklar', icon: 'ri-alert-line', color: '#EF4444' },
    { id: 'egitim', label: 'Eğitimler', icon: 'ri-graduation-cap-line', color: '#6366F1' },
  ] as const;

  const kpiCards = [
    { label: 'Toplam Firma', value: aktifFirmalar.length, icon: 'ri-building-2-line', color: '#3B82F6', sub: `${aktifFirmalar.filter(f => f.durum === 'Aktif').length} aktif firma` },
    { label: 'Toplam Personel', value: aktifPersoneller.length, icon: 'ri-team-line', color: '#10B981', sub: `${aktifPersoneller.filter(p => p.durum === 'Aktif').length} aktif personel` },
    { label: 'Toplam Evrak', value: aktifEvraklar.length, icon: 'ri-file-list-3-line', color: '#F59E0B', sub: `${evrakStats.eksik + evrakStats.sureDolmus} sorunlu evrak` },
    { label: 'Eğitim Kayıtları', value: aktifEgitimler.length, icon: 'ri-graduation-cap-line', color: '#6366F1', sub: `${aktifEgitimler.filter(e => e.durum === 'Tamamlandı').length} tamamlandı` },
    { label: 'Açık Uygunsuzluk', value: uygunsuzlukStats.acik, icon: 'ri-alert-line', color: uygunsuzlukStats.acik > 0 ? '#EF4444' : '#10B981', sub: `${uygunsuzlukStats.kapandi} kapatıldı` },
    { label: 'Muayene Kayıtları', value: aktifMuayeneler.length, icon: 'ri-heart-pulse-line', color: '#EC4899', sub: `${aktifMuayeneler.filter(m => m.sonuc === 'Çalışabilir').length} uygun` },
    { label: 'Görevler', value: aktifGorevler.length, icon: 'ri-task-line', color: '#8B5CF6', sub: `${aktifGorevler.filter(g => g.durum === 'Tamamlandı').length} tamamlandı` },
    { label: 'Tutanaklar', value: aktifTutanaklar.length, icon: 'ri-article-line', color: '#F97316', sub: `${aktifTutanaklar.filter(t => t.durum === 'Onaylandı').length} onaylı` },
  ];

  // ── Excel Export ──
  const [exporting, setExporting] = useState(false);

  const handleExcelExport = () => {
    setExporting(true);
    (async () => {
      try {
        const ExcelJS = (await import('exceljs')).default;
        const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('tr-TR') : '—';
        const now = new Date();
        const tarih = now.toLocaleDateString('tr-TR');
        const tarihDosya = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;

        const wb = new ExcelJS.Workbook();
        wb.creator = 'ISG Denetim Sistemi';
        wb.created = now;

        // ── ExcelJS Stil Yardımcıları ──
        const STATUS_COLORS: Record<string, { fg: string; bg: string }> = {
          'Aktif':          { fg: 'FF16A34A', bg: 'FFDCFCE7' },
          'Pasif':          { fg: 'FFD97706', bg: 'FFFEF3C7' },
          'Askıda':         { fg: 'FF7C3AED', bg: 'FFEDE9FE' },
          'Ayrıldı':        { fg: 'FFDC2626', bg: 'FFFEE2E2' },
          'Açık':           { fg: 'FFDC2626', bg: 'FFFEE2E2' },
          'Kapandı':        { fg: 'FF16A34A', bg: 'FFDCFCE7' },
          'Tamamlandı':     { fg: 'FF16A34A', bg: 'FFDCFCE7' },
          'Planlandı':      { fg: 'FF1D4ED8', bg: 'FFDBEAFE' },
          'Eksik':          { fg: 'FFDC2626', bg: 'FFFEE2E2' },
          'Yüklü':          { fg: 'FF16A34A', bg: 'FFDCFCE7' },
          'Süre Dolmuş':    { fg: 'FFD97706', bg: 'FFFEF3C7' },
          'Süre Yaklaşıyor':{ fg: 'FFD97706', bg: 'FFFEF3C7' },
          'Uygun':          { fg: 'FF16A34A', bg: 'FFDCFCE7' },
          'Bakımda':        { fg: 'FFD97706', bg: 'FFFEF3C7' },
          'Uygun Değil':    { fg: 'FFDC2626', bg: 'FFFEE2E2' },
          'Hurda':          { fg: 'FF64748B', bg: 'FFF1F5F9' },
          'Az Tehlikeli':   { fg: 'FF16A34A', bg: 'FFDCFCE7' },
          'Tehlikeli':      { fg: 'FFD97706', bg: 'FFFEF3C7' },
          'Çok Tehlikeli':  { fg: 'FFDC2626', bg: 'FFFEE2E2' },
          'Çalışabilir':    { fg: 'FF16A34A', bg: 'FFDCFCE7' },
          'Çalışamaz':      { fg: 'FFDC2626', bg: 'FFFEE2E2' },
          'Kritik':         { fg: 'FFDC2626', bg: 'FFFEE2E2' },
          'Yüksek':         { fg: 'FFEA580C', bg: 'FFFFEDD5' },
          'Orta':           { fg: 'FFD97706', bg: 'FFFEF3C7' },
          'Düşük':          { fg: 'FF16A34A', bg: 'FFDCFCE7' },
        };
        const STATUS_COLS = ['Durum', 'Tehlike Sınıfı', 'Sonuç', 'Seviye'];

        const applyHeaderRows = (ws: ExcelJS.Worksheet, title: string, subtitle: string, colCount: number) => {
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

        const applyHeaderCols = (ws: ExcelJS.Worksheet, cols: string[], useBlue = false) => {
          const hdrRow = ws.getRow(4); hdrRow.height = 22;
          cols.forEach((h, ci) => {
            const cell = hdrRow.getCell(ci + 1);
            cell.value = h;
            cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: useBlue ? 'FF0F4C75' : 'FF1E293B' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { bottom: { style: 'medium', color: { argb: 'FF3B82F6' } } };
          });
        };

        const applyDataRows = (
          ws: ExcelJS.Worksheet,
          rows: (string | number | null)[][][],
          cols: string[],
          startRow = 5,
          rowHeight = 18,
        ) => {
          rows.forEach((rowVals, ri) => {
            const exRow = ws.getRow(startRow + ri);
            exRow.height = rowHeight;
            const isEven = ri % 2 === 0;
            const bg = isEven ? 'FFFFFFFF' : 'FFF0F4FF';
            rowVals.forEach((val, ci) => {
              const cell = exRow.getCell(ci + 1);
              const v = val[0];
              cell.value = v ?? '';
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
              cell.font = { size: 10, name: 'Calibri', color: { argb: 'FF1E293B' } };
              cell.alignment = { vertical: 'middle', wrapText: true };
              cell.border = {
                bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              };
              // Sıra no
              if (ci === 0) {
                cell.font = { size: 9, name: 'Calibri', color: { argb: 'FF94A3B8' } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
              }
              // Sayısal değer
              if (typeof v === 'number' && ci > 0) {
                cell.font = { bold: true, size: 10, name: 'Calibri', color: { argb: 'FF1E3A5F' } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
              }
              // Durum sütunları
              const colName = cols[ci] ?? '';
              if (STATUS_COLS.some(k => colName.includes(k))) {
                const sc = STATUS_COLORS[String(v)];
                if (sc) {
                  cell.font = { bold: true, size: 10, name: 'Calibri', color: { argb: sc.fg } };
                  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sc.bg } };
                  cell.alignment = { horizontal: 'center', vertical: 'middle' };
                }
              }
            });
          });
        };

        const buildSheet = (
          sheetName: string,
          title: string,
          subtitle: string,
          cols: string[],
          rows: (string | number | null)[][],
          colWidths: number[],
          useBlue = false,
        ) => {
          const ws = wb.addWorksheet(sheetName);
          ws.columns = colWidths.map(w => ({ width: w }));
          applyHeaderRows(ws, title, subtitle, cols.length);
          applyHeaderCols(ws, cols, useBlue);
          applyDataRows(ws, rows.map(r => r.map(v => [v])), cols);
          ws.views = [{ state: 'frozen', ySplit: 4 }];
          return ws;
        };

        // ── SAYFA 1: ÖZET ──
        const ozetWs = wb.addWorksheet('Genel Özet');
        ozetWs.columns = [{ width: 30 }, { width: 16 }, { width: 30 }, { width: 16 }];
        applyHeaderRows(ozetWs, 'GENEL ÖZET RAPORU', `Rapor Tarihi: ${tarih}  |  Oluşturan: Sistem`, 4);
        applyHeaderCols(ozetWs, ['Kategori', 'Toplam', 'Alt Kategori', 'Değer']);
        const ozetRows = [
          ['Toplam Firma', aktifFirmalar.length, 'Aktif Firma', aktifFirmalar.filter(f => f.durum === 'Aktif').length],
          ['Toplam Personel', aktifPersoneller.length, 'Aktif Personel', aktifPersoneller.filter(p => p.durum === 'Aktif').length],
          ['Toplam Evrak', aktifEvraklar.length, 'Sorunlu Evrak', evrakStats.eksik + evrakStats.sureDolmus],
          ['Toplam Eğitim', aktifEgitimler.length, 'Tamamlanan', aktifEgitimler.filter(e => e.durum === 'Tamamlandı').length],
          ['Toplam Muayene', aktifMuayeneler.length, 'Çalışabilir', aktifMuayeneler.filter(m => m.sonuc === 'Çalışabilir').length],
          ['Toplam Ekipman', aktifEkipmanlar.length, 'Uygun Değil', aktifEkipmanlar.filter(e => e.durum === 'Uygun Değil').length],
          ['Açık Uygunsuzluk', uygunsuzlukStats.acik, 'Kapatılan', uygunsuzlukStats.kapandi],
          ['Sistem Sağlık Skoru', `${healthScore}/100`, 'Durum', healthLabel],
        ];
        ozetRows.forEach((row, ri) => {
          const exRow = ozetWs.getRow(5 + ri);
          exRow.height = 20;
          const bg = ri % 2 === 0 ? 'FFFFFFFF' : 'FFF0F4FF';
          row.forEach((val, ci) => {
            const cell = exRow.getCell(ci + 1);
            cell.value = val;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
            cell.alignment = { vertical: 'middle', wrapText: false };
            cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } }, right: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
            if (ci === 1 || ci === 3) {
              cell.font = { bold: true, size: 12, name: 'Calibri', color: { argb: 'FF1E3A5F' } };
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else {
              cell.font = { size: 10, name: 'Calibri', color: { argb: 'FF1E293B' } };
            }
          });
        });
        ozetWs.views = [{ state: 'frozen', ySplit: 4 }];

        // ── SAYFA 2: FİRMALAR ──
        buildSheet('Firmalar', 'FİRMALAR LİSTESİ', `Toplam ${aktifFirmalar.length} firma  |  Rapor: ${tarih}`,
          ['#', 'Firma Adı', 'Yetkili Kişi', 'Telefon', 'E-posta', 'Tehlike Sınıfı', 'Durum', 'Personel', 'Evrak', 'Açık Uyg.', 'Sözleşme Baş.', 'Sözleşme Bit.'],
          aktifFirmalar.map((f, i) => {
            const pS = aktifPersoneller.filter(p => p.firmaId === f.id).length;
            const eS = aktifEvraklar.filter(e => e.firmaId === f.id).length;
            const uS = aktifUygunsuzluklar.filter(u => u.firmaId === f.id && u.durum === 'Açık').length;
            return [i+1, f.ad, f.yetkiliKisi||'—', f.telefon||'—', f.email||'—', f.tehlikeSinifi, f.durum, pS, eS, uS, fmtDate(f.sozlesmeBas), fmtDate(f.sozlesmeBit)];
          }),
          [4, 28, 22, 16, 28, 16, 12, 10, 10, 12, 14, 14],
        );

        // ── SAYFA 3: PERSONELLER ──
        buildSheet('Personeller', 'PERSONELLER LİSTESİ', `Toplam ${aktifPersoneller.length} personel  |  Rapor: ${tarih}`,
          ['#', 'Ad Soyad', 'TC Kimlik', 'Telefon', 'E-posta', 'Firma', 'Görev', 'Departman', 'Durum', 'Kan Grubu', 'Doğum Tarihi', 'İşe Giriş'],
          aktifPersoneller.map((p, i) => {
            const firma = aktifFirmalar.find(f => f.id === p.firmaId);
            return [i+1, p.adSoyad, p.tc||'—', p.telefon||'—', p.email||'—', firma?.ad||'—', p.gorev||'—', p.departman||'—', p.durum, p.kanGrubu||'—', fmtDate(p.dogumTarihi), fmtDate(p.iseGirisTarihi)];
          }),
          [4, 26, 14, 16, 28, 24, 20, 18, 12, 10, 14, 14],
        );

        // ── SAYFA 4: EVRAKLAR ──
        buildSheet('Evraklar', 'EVRAKLAR LİSTESİ', `Toplam ${aktifEvraklar.length} evrak  |  Sorunlu: ${evrakStats.eksik + evrakStats.sureDolmus}  |  Rapor: ${tarih}`,
          ['#', 'Evrak Adı', 'Tür', 'Firma', 'Personel', 'Durum', 'Geçerlilik Tarihi', 'Kalan Süre'],
          aktifEvraklar.map((e, i) => {
            const firma = aktifFirmalar.find(f => f.id === e.firmaId);
            const personel = aktifPersoneller.find(p => p.id === e.personelId);
            const t2 = new Date(); t2.setHours(0,0,0,0);
            const kg = e.gecerlilikTarihi ? Math.ceil((new Date(e.gecerlilikTarihi).getTime() - t2.getTime()) / 86400000) : null;
            return [i+1, e.ad, e.tur||'—', firma?.ad||'—', personel?.adSoyad||'—', e.durum, fmtDate(e.gecerlilikTarihi), kg !== null ? (kg < 0 ? `${Math.abs(kg)}g önce doldu` : `${kg}g kaldı`) : '—'];
          }),
          [4, 30, 20, 24, 24, 16, 16, 14],
        );

        // ── SAYFA 5: EĞİTİMLER ──
        buildSheet('Eğitimler', 'EĞİTİMLER LİSTESİ', `Toplam ${aktifEgitimler.length} eğitim  |  Rapor: ${tarih}`,
          ['#', 'Eğitim Adı', 'Tür', 'Firma', 'Eğitimci', 'Durum', 'Tarih', 'Süre', 'Katılımcı'],
          aktifEgitimler.map((e, i) => {
            const firma = aktifFirmalar.find(f => f.id === e.firmaId);
            return [i+1, e.ad, e.tur||'—', firma?.ad||'—', e.egitimci||'—', e.durum, fmtDate(e.tarih), e.sure ? `${e.sure} dk` : '—', e.katilimciSayisi ?? '—'];
          }),
          [4, 30, 20, 24, 22, 14, 14, 10, 12],
        );

        // ── SAYFA 6: MUAYENELER ──
        buildSheet('Muayeneler', 'MUAYENELER LİSTESİ', `Toplam ${aktifMuayeneler.length} muayene  |  Rapor: ${tarih}`,
          ['#', 'Personel', 'Firma', 'Muayene Türü', 'Sonuç', 'Muayene Tarihi', 'Sonraki Tarih', 'Hekim'],
          aktifMuayeneler.map((m, i) => {
            const personel = aktifPersoneller.find(p => p.id === m.personelId);
            const firma = aktifFirmalar.find(f => f.id === (personel?.firmaId ?? ''));
            return [i+1, personel?.adSoyad||'—', firma?.ad||'—', m.muayeneTuru||'—', m.sonuc||'—', fmtDate(m.muayeneTarihi), fmtDate(m.sonrakiTarih), m.hekim||'—'];
          }),
          [4, 26, 24, 20, 14, 16, 16, 22],
        );

        // ── SAYFA 7: UYGUNSUZLUKLAR — fotoğraf embed ──
        const resolvePhotoToBase64 = async (url: string | undefined | null): Promise<string | null> => {
          if (!url) return null;
          try {
            const resp = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'no-store' });
            if (!resp.ok) return null;
            const blob = await resp.blob();
            return new Promise(resolve => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = () => resolve(null);
              reader.readAsDataURL(blob);
            });
          } catch { return null; }
        };

        const photoResults = await Promise.all(
          aktifUygunsuzluklar.map(async u => ({
            id: u.id,
            acilis: await resolvePhotoToBase64(u.acilisFotoUrl),
            kapanis: await resolvePhotoToBase64(u.kapatmaFotoUrl),
          }))
        );
        const photoMap2 = new Map(photoResults.map(r => [r.id, { acilis: r.acilis, kapanis: r.kapanis }]));

        const wsUyg = wb.addWorksheet('Uygunsuzluklar');
        const uygCols = ['#', 'DÖF No', 'Başlık', 'Firma', 'Durum', 'Seviye', 'Açılış Tarihi', 'Kapanış Tarihi', 'Sorumlu', 'Açılış Fotosu', 'Kapanış Fotosu'];
        wsUyg.columns = [5, 14, 36, 26, 13, 14, 16, 16, 22, 28, 28].map(w => ({ width: w }));
        applyHeaderRows(wsUyg, 'UYGUNSUZLUKLAR LİSTESİ', `Açık: ${uygunsuzlukStats.acik}  |  Kapandı: ${uygunsuzlukStats.kapandi}  |  Kritik: ${uygunsuzlukStats.kritik}  |  Rapor: ${tarih}`, uygCols.length);
        applyHeaderCols(wsUyg, uygCols, true);

        for (let i = 0; i < aktifUygunsuzluklar.length; i++) {
          const u = aktifUygunsuzluklar[i];
          const firma = aktifFirmalar.find(f => f.id === u.firmaId);
          const rowBg = i % 2 === 0 ? 'FFFFFFFF' : 'FFF0F4FF';
          const exRow = wsUyg.getRow(5 + i);
          exRow.height = 80;

          const vals = [i+1, u.acilisNo||'—', u.baslik||u.aciklama?.slice(0,60)||'—', firma?.ad||'—', u.durum, u.severity||'—', fmtDate(u.olusturmaTarihi), fmtDate(u.kapatmaTarihi), u.sorumlu||'—', '', ''];
          vals.forEach((val, ci) => {
            const cell = exRow.getCell(ci + 1);
            cell.value = val;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
            cell.font = { size: 10, name: 'Calibri', color: { argb: 'FF1E293B' } };
            cell.alignment = { vertical: 'middle', wrapText: true };
            cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } }, right: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
            if (ci === 0) { cell.font = { size: 9, name: 'Calibri', color: { argb: 'FF94A3B8' } }; cell.alignment = { horizontal: 'center', vertical: 'middle' }; }
            if (ci === 4 || ci === 5) {
              const sc = STATUS_COLORS[String(val)];
              if (sc) { cell.font = { bold: true, size: 10, name: 'Calibri', color: { argb: sc.fg } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sc.bg } }; cell.alignment = { horizontal: 'center', vertical: 'middle' }; }
            }
          });

          const photos = photoMap2.get(u.id);
          const embedPhoto = async (b64: string | null | undefined, colIdx: number, isMevcut: boolean | undefined) => {
            if (!b64) {
              const cell = exRow.getCell(colIdx);
              cell.value = isMevcut ? 'Fotoğraf yüklenemedi' : '—';
              cell.font = { size: 9, italic: true, color: { argb: isMevcut ? 'FFCA8A04' : 'FF94A3B8' }, name: 'Calibri' };
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
              return;
            }
            try {
              const [meta, data] = b64.split(',');
              const mime = (meta.match(/data:([^;]+);/) ?? [])[1] ?? 'image/jpeg';
              const ext = mime.includes('png') ? 'png' : mime.includes('gif') ? 'gif' : 'jpeg';
              const imgId = wb.addImage({ base64: data, extension: ext as 'jpeg' | 'png' | 'gif' });
              wsUyg.addImage(imgId, { tl: { col: colIdx - 1, row: 4 + i }, br: { col: colIdx, row: 5 + i }, editAs: 'oneCell' });
              exRow.getCell(colIdx).value = '';
            } catch { /* sessizce geç */ }
          };

          await embedPhoto(photos?.acilis, 10, u.acilisFotoMevcut);
          await embedPhoto(photos?.kapanis, 11, u.kapatmaFotoMevcut);
        }
        wsUyg.views = [{ state: 'frozen', ySplit: 4 }];

        // ── SAYFA 8: EKİPMANLAR ──
        buildSheet('Ekipmanlar', 'EKİPMANLAR LİSTESİ', `Toplam ${aktifEkipmanlar.length} ekipman  |  Uygun Değil: ${aktifEkipmanlar.filter(e => e.durum === 'Uygun Değil').length}  |  Rapor: ${tarih}`,
          ['#', 'Ekipman Adı', 'Tür', 'Marka', 'Model', 'Firma', 'Durum', 'Sonraki Kontrol', 'Kalan Süre'],
          aktifEkipmanlar.map((e, i) => {
            const firma = aktifFirmalar.find(f => f.id === e.firmaId);
            const t2 = new Date(); t2.setHours(0,0,0,0);
            const kg = e.sonrakiKontrolTarihi ? Math.ceil((new Date(e.sonrakiKontrolTarihi).getTime() - t2.getTime()) / 86400000) : null;
            return [i+1, e.ad, e.tur||'—', e.marka||'—', e.model||'—', firma?.ad||'—', e.durum, fmtDate(e.sonrakiKontrolTarihi), kg !== null ? (kg < 0 ? `${Math.abs(kg)}g gecikti` : `${kg}g kaldı`) : '—'];
          }),
          [4, 28, 18, 16, 16, 24, 14, 16, 14],
        );

        // ── SAYFA 9: FİRMA BAZLI ÖZET ──
        buildSheet('Firma Özeti', 'FİRMA BAZLI ÖZET', `${aktifFirmalar.length} firma için konsolide özet  |  Rapor: ${tarih}`,
          ['#', 'Firma Adı', 'Tehlike Sınıfı', 'Durum', 'Personel', 'Aktif P.', 'Evrak', 'Sorunlu E.', 'Eğitim', 'Muayene', 'Açık Uyg.', 'Ekipman'],
          aktifFirmalar.map((f, i) => {
            const pS = aktifPersoneller.filter(p => p.firmaId === f.id).length;
            const aP = aktifPersoneller.filter(p => p.firmaId === f.id && p.durum === 'Aktif').length;
            const eS = aktifEvraklar.filter(e => e.firmaId === f.id).length;
            const xE = aktifEvraklar.filter(e => e.firmaId === f.id && (e.durum === 'Eksik' || e.durum === 'Süre Dolmuş')).length;
            const egS = aktifEgitimler.filter(e => e.firmaId === f.id).length;
            const muS = aktifMuayeneler.filter(m => aktifPersoneller.find(p => p.id === m.personelId)?.firmaId === f.id).length;
            const uS = aktifUygunsuzluklar.filter(u => u.firmaId === f.id && u.durum === 'Açık').length;
            const ekS = aktifEkipmanlar.filter(e => e.firmaId === f.id).length;
            return [i+1, f.ad, f.tehlikeSinifi, f.durum, pS, aP, eS, xE, egS, muS, uS, ekS];
          }),
          [4, 28, 16, 12, 10, 10, 10, 12, 10, 10, 12, 10],
        );

        // ── TEK DOSYA OLARAK İNDİR ──
        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${tarihDosya}-GENEL-RAPOR.xlsx`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
      } finally {
        setExporting(false);
      }
    })();
  };

  // Özet sağlık skoru
  const healthScore = useMemo(() => {
    const total = aktifEvraklar.length;
    if (total === 0) return 100;
    const sorunlu = evrakStats.eksik + evrakStats.sureDolmus;
    return Math.max(0, Math.round(((total - sorunlu) / total) * 100));
  }, [aktifEvraklar, evrakStats]);

  const healthColor = healthScore >= 80 ? '#10B981' : healthScore >= 60 ? '#F59E0B' : '#EF4444';
  const healthLabel = healthScore >= 80 ? 'İyi' : healthScore >= 60 ? 'Orta' : 'Kritik';

  const radialData = [{ name: 'Skor', value: healthScore, fill: healthColor }];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            Raporlar &amp; Analiz
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Sistemdeki tüm verilerin özet analizi ve grafikleri
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)', color: 'var(--text-muted)' }}>
            <i className="ri-calendar-line text-xs" />
            {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <button
            onClick={handleExcelExport}
            disabled={exporting}
            className="btn-primary whitespace-nowrap"
            style={{ fontSize: '12.5px', padding: '8px 16px' }}
          >
            {exporting
              ? <><i className="ri-loader-4-line animate-spin text-sm" /> Hazırlanıyor...</>
              : <><i className="ri-file-excel-2-line text-sm" /> Excel Raporu İndir</>
            }
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpiCards.map((card, i) => (
          <AnimatedKPICard key={card.label} {...card} delay={i * 60} />
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 p-1 rounded-xl flex-wrap"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12.5px] font-semibold transition-all duration-200 whitespace-nowrap cursor-pointer"
            style={activeTab === tab.id ? {
              background: `${tab.color}18`,
              color: tab.color,
              border: `1px solid ${tab.color}25`,
            } : {
              color: 'var(--text-muted)',
              border: '1px solid transparent',
            }}
          >
            <i className={`${tab.icon} text-xs`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* GENEL BAKIŞ */}
      {activeTab === 'genel' && (
        <div className="space-y-5">
          {/* Trend + Health Score */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              <GlassCard>
                <SectionHeader
                  title="Aylık Kayıt Trendi"
                  subtitle="Son 12 ayda eklenen kayıtlar"
                  icon="ri-line-chart-line"
                />
                <ResponsiveContainer width="100%" height={230}>
                  <AreaChart data={monthlyTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      {[['gP', '#10B981'], ['gE', '#F59E0B'], ['gF', '#3B82F6'], ['gEg', '#6366F1']].map(([id, c]) => (
                        <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={c} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={c} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="ay" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingTop: 10, color: '#94A3B8' }} />
                    <Area type="monotone" dataKey="Personel" stroke="#10B981" strokeWidth={2} fill="url(#gP)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                    <Area type="monotone" dataKey="Evrak" stroke="#F59E0B" strokeWidth={2} fill="url(#gE)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                    <Area type="monotone" dataKey="Firma" stroke="#3B82F6" strokeWidth={2} fill="url(#gF)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                    <Area type="monotone" dataKey="Eğitim" stroke="#6366F1" strokeWidth={2} fill="url(#gEg)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </GlassCard>
            </div>

            {/* Health Score */}
            <GlassCard className="flex flex-col">
              <SectionHeader title="Sistem Sağlık Skoru" subtitle="Evrak tamamlanma oranı" icon="ri-heart-pulse-line" color={healthColor} />
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <div className="relative" style={{ width: 160, height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                      cx="50%" cy="50%"
                      innerRadius="65%"
                      outerRadius="90%"
                      startAngle={225}
                      endAngle={-45}
                      data={radialData}
                    >
                      <RadialBar
                        dataKey="value"
                        cornerRadius={8}
                        background={{ fill: 'rgba(255,255,255,0.04)' }}
                        fill={healthColor}
                      />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black" style={{ color: healthColor, letterSpacing: '-0.04em' }}>
                      {healthScore}
                    </span>
                    <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>/ 100</span>
                  </div>
                </div>
                <div className="text-center">
                  <span className="text-sm font-bold px-3 py-1 rounded-full" style={{
                    background: `${healthColor}15`,
                    color: healthColor,
                    border: `1px solid ${healthColor}25`,
                  }}>
                    {healthLabel}
                  </span>
                  <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
                    {evrakStats.eksik + evrakStats.sureDolmus} sorunlu evrak
                  </p>
                </div>
                <div className="w-full space-y-2 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  {[
                    { label: 'Açık Uygunsuzluk', value: uygunsuzlukStats.acik, color: '#EF4444' },
                    { label: 'Eksik Evrak', value: evrakStats.eksik, color: '#F97316' },
                    { label: 'Süre Dolmuş', value: evrakStats.sureDolmus, color: '#F59E0B' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                      <span className="text-[12px] font-bold" style={{ color: item.value > 0 ? item.color : '#10B981' }}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Tehlike + Departman */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <GlassCard>
              <SectionHeader title="Tehlike Sınıfı Dağılımı" subtitle="Firmaların tehlike sınıflarına göre dağılımı" icon="ri-fire-line" color="#EF4444" />
              {tehlikeDagilim.length === 0 ? (
                <div className="flex items-center justify-center h-40">
                  <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Henüz firma kaydı yok</p>
                </div>
              ) : (
                <DonutChart data={tehlikeDagilim} size={160} />
              )}
            </GlassCard>

            <GlassCard>
              <SectionHeader title="Departman Dağılımı" subtitle="Personellerin departmanlara göre dağılımı" icon="ri-organization-chart" color="#10B981" />
              {departmanDagilim.length === 0 ? (
                <div className="flex items-center justify-center h-40">
                  <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Henüz personel kaydı yok</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={departmanDagilim} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={85} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Personel" radius={[0, 4, 4, 0]}>
                      {departmanDagilim.map((_, i) => <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </GlassCard>
          </div>

          {/* Ekipman Durumu */}
          {aktifEkipmanlar.length > 0 && (
            <GlassCard>
              <SectionHeader title="Ekipman Durum Özeti" subtitle="Tüm ekipmanların durum dağılımı" icon="ri-tools-line" color="#F97316" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {ekipmanDurum.map(d => (
                  <div key={d.name} className="rounded-xl p-3.5 flex items-center gap-3" style={{
                    background: `${d.color}08`,
                    border: `1px solid ${d.color}20`,
                  }}>
                    <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: `${d.color}15` }}>
                      <i className="ri-tools-line text-sm" style={{ color: d.color }} />
                    </div>
                    <div>
                      <p className="text-xl font-black" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>{d.value}</p>
                      <p className="text-[10.5px] font-medium" style={{ color: d.color }}>{d.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Firma Özet Tablosu */}
          <GlassCard className="!p-0 overflow-hidden">
            <div className="px-5 py-4 flex items-center gap-2.5" style={{ borderBottom: '1px solid var(--border-main)' }}>
              <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(99,102,241,0.12)' }}>
                <i className="ri-building-2-line text-xs" style={{ color: '#818CF8' }} />
              </div>
              <h3 className="text-[13.5px] font-bold" style={{ color: 'var(--text-primary)' }}>Firma Özet Listesi</h3>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1" style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8' }}>
                {aktifFirmalar.length}
              </span>
            </div>
            {aktifFirmalar.length === 0 ? (
              <div className="py-12 text-center">
                <i className="ri-building-2-line text-3xl" style={{ color: 'var(--text-faint)' }} />
                <p className="text-[12px] mt-2" style={{ color: 'var(--text-muted)' }}>Henüz firma kaydı yok</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-premium w-full">
                  <thead>
                    <tr>
                      <th className="text-left">Firma</th>
                      <th className="text-left hidden md:table-cell">Tehlike Sınıfı</th>
                      <th className="text-left">Durum</th>
                      <th className="text-center hidden lg:table-cell">Personel</th>
                      <th className="text-center hidden lg:table-cell">Evrak</th>
                      <th className="text-center hidden lg:table-cell">Açık Uyg.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aktifFirmalar.map(firma => {
                      const firmaPersonel = aktifPersoneller.filter(p => p.firmaId === firma.id).length;
                      const firmaEvrak = aktifEvraklar.filter(e => e.firmaId === firma.id).length;
                      const firmaUyg = aktifUygunsuzluklar.filter(u => u.firmaId === firma.id && u.durum === 'Açık').length;
                      return (
                        <tr key={firma.id}>
                          <td>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0 text-[11px] font-bold text-white"
                                style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}>
                                {firma.ad.charAt(0)}
                              </div>
                              <div>
                                <p className="text-[12.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>{firma.ad}</p>
                                <p className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>{firma.yetkiliKisi || '—'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="hidden md:table-cell">
                            <Badge label={firma.tehlikeSinifi} color={getTehlikeColor(firma.tehlikeSinifi)} />
                          </td>
                          <td><Badge label={firma.durum} color={getFirmaStatusColor(firma.durum)} /></td>
                          <td className="text-center hidden lg:table-cell">
                            <span className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{firmaPersonel}</span>
                          </td>
                          <td className="text-center hidden lg:table-cell">
                            <span className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{firmaEvrak}</span>
                          </td>
                          <td className="text-center hidden lg:table-cell">
                            <span className="text-[13px] font-bold px-2 py-0.5 rounded-full" style={{
                              color: firmaUyg > 0 ? '#EF4444' : '#10B981',
                              background: firmaUyg > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                            }}>
                              {firmaUyg}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* EVRAK ANALİZİ */}
      {activeTab === 'evrak' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Yüklü', value: evrakStats.yuklu, color: '#10B981', icon: 'ri-checkbox-circle-line', sub: 'Tamamlanmış' },
              { label: 'Eksik', value: evrakStats.eksik, color: '#EF4444', icon: 'ri-close-circle-line', sub: 'Yüklenmemiş' },
              { label: 'Süre Dolmuş', value: evrakStats.sureDolmus, color: '#F97316', icon: 'ri-error-warning-line', sub: 'Geçersiz' },
              { label: 'Süre Yaklaşıyor', value: evrakStats.sureYaklasiyor, color: '#F59E0B', icon: 'ri-time-line', sub: '30 gün içinde' },
            ].map((item, i) => (
              <AnimatedKPICard key={item.label} {...item} trend={undefined} delay={i * 80} />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <GlassCard>
              <SectionHeader title="Aylık Evrak Trendi" subtitle="Son 12 ayda tamamlanan ve eksik evraklar" icon="ri-bar-chart-line" color="#10B981" />
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={evrakTamamlanma} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="ay" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingTop: 10, color: '#94A3B8' }} />
                  <Bar dataKey="Tamamlanan" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Eksik" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </GlassCard>

            <GlassCard>
              <SectionHeader title="Evrak Durum Dağılımı" subtitle="Tüm evrakların durum bazlı analizi" icon="ri-pie-chart-line" color="#F59E0B" />
              <div className="space-y-4 mt-2">
                <AnimatedProgressBar label="Yüklü Evraklar" value={evrakStats.yuklu} total={aktifEvraklar.length} color="#10B981" delay={0} />
                <AnimatedProgressBar label="Eksik Evraklar" value={evrakStats.eksik} total={aktifEvraklar.length} color="#EF4444" delay={100} />
                <AnimatedProgressBar label="Süresi Dolmuş" value={evrakStats.sureDolmus} total={aktifEvraklar.length} color="#F97316" delay={200} />
                <AnimatedProgressBar label="Yaklaşan Süre (30g)" value={evrakStats.sureYaklasiyor} total={aktifEvraklar.length} color="#F59E0B" delay={300} />
              </div>
              <div className="mt-5 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Toplam Evrak</span>
                <span className="text-[15px] font-black" style={{ color: 'var(--text-primary)' }}>{aktifEvraklar.length}</span>
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {/* UYGUNSUZLUKLAR */}
      {activeTab === 'uygunsuzluk' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Açık', value: uygunsuzlukStats.acik, color: '#EF4444', icon: 'ri-alert-line', sub: 'Bekleyen' },
              { label: 'Kapandı', value: uygunsuzlukStats.kapandi, color: '#10B981', icon: 'ri-checkbox-circle-line', sub: 'Çözümlendi' },
              { label: 'Kritik Seviye', value: uygunsuzlukStats.kritik, color: '#DC2626', icon: 'ri-error-warning-line', sub: 'Acil müdahale' },
              { label: 'Yüksek Seviye', value: uygunsuzlukStats.yuksek, color: '#F97316', icon: 'ri-arrow-up-circle-line', sub: 'Öncelikli' },
            ].map((item, i) => (
              <AnimatedKPICard key={item.label} {...item} trend={undefined} delay={i * 80} />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <GlassCard>
              <SectionHeader title="Aylık Uygunsuzluk Trendi" subtitle="Son 12 ayda açılan ve kapatılan uygunsuzluklar" icon="ri-line-chart-line" color="#EF4444" />
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={uygunsuzlukTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="ay" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingTop: 10, color: '#94A3B8' }} />
                  <Bar dataKey="Açık" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Kapandı" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </GlassCard>

            <GlassCard>
              <SectionHeader title="Uygunsuzluk Analizi" subtitle="Durum ve seviye bazlı dağılım" icon="ri-pie-chart-line" color="#EF4444" />
              <div className="space-y-4 mt-2">
                <AnimatedProgressBar label="Açık Uygunsuzluklar" value={uygunsuzlukStats.acik} total={aktifUygunsuzluklar.length} color="#EF4444" delay={0} />
                <AnimatedProgressBar label="Kapatılan Uygunsuzluklar" value={uygunsuzlukStats.kapandi} total={aktifUygunsuzluklar.length} color="#10B981" delay={100} />
                <AnimatedProgressBar label="Kritik Seviye" value={uygunsuzlukStats.kritik} total={aktifUygunsuzluklar.length} color="#DC2626" delay={200} />
                <AnimatedProgressBar label="Yüksek Seviye" value={uygunsuzlukStats.yuksek} total={aktifUygunsuzluklar.length} color="#F97316" delay={300} />
              </div>
              <div className="mt-5 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Toplam Kayıt</span>
                <span className="text-[15px] font-black" style={{ color: 'var(--text-primary)' }}>{aktifUygunsuzluklar.length}</span>
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {/* EĞİTİMLER */}
      {activeTab === 'egitim' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { label: 'Toplam Eğitim', value: aktifEgitimler.length, color: '#6366F1', icon: 'ri-graduation-cap-line', sub: 'Tüm kayıtlar' },
              { label: 'Tamamlandı', value: aktifEgitimler.filter(e => e.durum === 'Tamamlandı').length, color: '#10B981', icon: 'ri-checkbox-circle-line', sub: 'Başarıyla bitti' },
              { label: 'Planlandı', value: aktifEgitimler.filter(e => e.durum === 'Planlandı').length, color: '#3B82F6', icon: 'ri-calendar-check-line', sub: 'Yaklaşan eğitim' },
            ].map((item, i) => (
              <AnimatedKPICard key={item.label} {...item} trend={undefined} delay={i * 80} />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <GlassCard>
              <SectionHeader title="Eğitim Durum Dağılımı" subtitle="Eğitimlerin duruma göre dağılımı" icon="ri-pie-chart-line" color="#6366F1" />
              {egitimDurum.length === 0 ? (
                <div className="flex items-center justify-center h-40">
                  <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Henüz eğitim kaydı yok</p>
                </div>
              ) : (
                <DonutChart data={egitimDurum} size={160} />
              )}
            </GlassCard>

            <GlassCard>
              <SectionHeader title="Aylık Eğitim Trendi" subtitle="Son 12 ayda eklenen eğitimler" icon="ri-bar-chart-line" color="#6366F1" />
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={monthlyTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="ay" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Eğitim" fill="#6366F1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </GlassCard>
          </div>

          <GlassCard>
            <SectionHeader title="Eğitim Durum Analizi" subtitle="Tüm eğitimlerin durum bazlı dağılımı" icon="ri-bar-chart-grouped-line" color="#6366F1" />
            <div className="space-y-4">
              <AnimatedProgressBar label="Tamamlanan Eğitimler" value={aktifEgitimler.filter(e => e.durum === 'Tamamlandı').length} total={aktifEgitimler.length} color="#10B981" delay={0} />
              <AnimatedProgressBar label="Planlanmış Eğitimler" value={aktifEgitimler.filter(e => e.durum === 'Planlandı').length} total={aktifEgitimler.length} color="#3B82F6" delay={100} />
              <AnimatedProgressBar label="Eksik Eğitimler" value={aktifEgitimler.filter(e => e.durum === 'Eksik').length} total={aktifEgitimler.length} color="#EF4444" delay={200} />
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
