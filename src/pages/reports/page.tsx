import { useMemo, useState, useEffect, useRef } from 'react';
import { useApp } from '../../store/AppContext';
import Badge, { getFirmaStatusColor, getTehlikeColor } from '../../components/base/Badge';
import { urlToBase64 } from '@/utils/fileUpload';
import type ExcelJS from 'exceljs';
import {
  setWorkbookMetadata,
  addWatermark,
  addFooter,
  protectSheet,
} from '@/utils/excelProtection';
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

  const [activeTab, setActiveTab] = useState<'genel' | 'evrak' | 'uygunsuzluk' | 'egitim' | 'saglik'>('genel');
  const [selectedFirmaId, setSelectedFirmaId] = useState<string>('all');
  const [firmaDropdownOpen, setFirmaDropdownOpen] = useState(false);
  const firmaDropdownRef = useRef<HTMLDivElement>(null);
  const months = useMemo(() => last12Months(), []);

  // Tarih aralığı filtresi
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [datePreset, setDatePreset] = useState<string>('all');
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const dateDropdownRef = useRef<HTMLDivElement>(null);

  const DATE_PRESETS = [
    { id: 'all', label: 'Tüm Zamanlar' },
    { id: 'this_month', label: 'Bu Ay' },
    { id: 'last_month', label: 'Geçen Ay' },
    { id: 'last_3', label: 'Son 3 Ay' },
    { id: 'last_6', label: 'Son 6 Ay' },
    { id: 'this_year', label: 'Bu Yıl' },
    { id: 'custom', label: 'Özel Aralık' },
  ];

  // Preset seçilince tarih aralığını hesapla
  const applyPreset = (preset: string) => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    setDatePreset(preset);
    if (preset === 'all') { setDateFrom(''); setDateTo(''); }
    else if (preset === 'this_month') {
      setDateFrom(fmt(new Date(now.getFullYear(), now.getMonth(), 1)));
      setDateTo(fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
    } else if (preset === 'last_month') {
      setDateFrom(fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
      setDateTo(fmt(new Date(now.getFullYear(), now.getMonth(), 0)));
    } else if (preset === 'last_3') {
      setDateFrom(fmt(new Date(now.getFullYear(), now.getMonth() - 2, 1)));
      setDateTo(fmt(now));
    } else if (preset === 'last_6') {
      setDateFrom(fmt(new Date(now.getFullYear(), now.getMonth() - 5, 1)));
      setDateTo(fmt(now));
    } else if (preset === 'this_year') {
      setDateFrom(fmt(new Date(now.getFullYear(), 0, 1)));
      setDateTo(fmt(new Date(now.getFullYear(), 11, 31)));
    }
    if (preset !== 'custom') setDateDropdownOpen(false);
  };

  const isDateActive = datePreset !== 'all' || (dateFrom !== '' || dateTo !== '');
  const activeDateLabel = useMemo(() => {
    if (datePreset !== 'all' && datePreset !== 'custom') return DATE_PRESETS.find(p => p.id === datePreset)?.label ?? '';
    if (dateFrom && dateTo) return `${new Date(dateFrom).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} – ${new Date(dateTo).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    if (dateFrom) return `${new Date(dateFrom).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })} sonrası`;
    if (dateTo) return `${new Date(dateTo).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })} öncesi`;
    return 'Tarih Filtresi';
  }, [datePreset, dateFrom, dateTo]);

  // Tarih aralığı kontrol fonksiyonu
  const isInDateRange = (dateStr: string | null | undefined): boolean => {
    if (!dateFrom && !dateTo) return true;
    if (!dateStr) return false;
    const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
    if (dateFrom) { const f = new Date(dateFrom); f.setHours(0, 0, 0, 0); if (d < f) return false; }
    if (dateTo) { const t = new Date(dateTo); t.setHours(23, 59, 59, 999); if (d > t) return false; }
    return true;
  };

  // Dropdown dışına tıklayınca kapat
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (firmaDropdownRef.current && !firmaDropdownRef.current.contains(e.target as Node)) {
        setFirmaDropdownOpen(false);
      }
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target as Node)) {
        setDateDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Tüm aktif firmalar (filtre için)
  const aktifFirmalar = useMemo(() => firmalar.filter(f => !f.silinmis), [firmalar]);

  // Seçili firma
  const secilenFirma = useMemo(
    () => selectedFirmaId === 'all' ? null : aktifFirmalar.find(f => f.id === selectedFirmaId) ?? null,
    [selectedFirmaId, aktifFirmalar],
  );

  // Filtrelenmiş veriler — firma + tarih aralığı filtresi
  const filtrePersoneller = useMemo(
    () => personeller.filter(p =>
      !p.silinmis &&
      (selectedFirmaId === 'all' || p.firmaId === selectedFirmaId) &&
      isInDateRange(p.olusturmaTarihi)
    ),
    [personeller, selectedFirmaId, dateFrom, dateTo],
  );
  const filtreEvraklar = useMemo(
    () => evraklar.filter(e =>
      !e.silinmis &&
      (selectedFirmaId === 'all' || e.firmaId === selectedFirmaId) &&
      isInDateRange(e.olusturmaTarihi)
    ),
    [evraklar, selectedFirmaId, dateFrom, dateTo],
  );
  const filtreEgitimler = useMemo(
    () => egitimler.filter(e => {
      if (e.silinmis) return false;
      if (!isInDateRange(e.olusturmaTarihi)) return false;
      if (selectedFirmaId === 'all') return true;
      // Çoklu firma desteği: firmaIds array'ini kontrol et, yoksa firmaId'ye bak
      const egFirmaIds = e.firmaIds && e.firmaIds.length > 0 ? e.firmaIds : (e.firmaId ? [e.firmaId] : []);
      return egFirmaIds.includes(selectedFirmaId);
    }),
    [egitimler, selectedFirmaId, dateFrom, dateTo],
  );
  const filtreMuayeneler = useMemo(
    () => muayeneler.filter(m =>
      !m.silinmis &&
      (selectedFirmaId === 'all' || filtrePersoneller.some(p => p.id === m.personelId)) &&
      isInDateRange(m.muayeneTarihi)
    ),
    [muayeneler, selectedFirmaId, filtrePersoneller, dateFrom, dateTo],
  );
  const filtreUygunsuzluklar = useMemo(
    () => uygunsuzluklar.filter(u =>
      !u.silinmis &&
      (selectedFirmaId === 'all' || u.firmaId === selectedFirmaId) &&
      isInDateRange(u.olusturmaTarihi)
    ),
    [uygunsuzluklar, selectedFirmaId, dateFrom, dateTo],
  );
  const filtreEkipmanlar = useMemo(
    () => ekipmanlar.filter(e =>
      !e.silinmis &&
      (selectedFirmaId === 'all' || e.firmaId === selectedFirmaId) &&
      isInDateRange(e.olusturmaTarihi)
    ),
    [ekipmanlar, selectedFirmaId, dateFrom, dateTo],
  );
  const filtreGorevler = useMemo(
    () => gorevler.filter(g =>
      !g.silinmis &&
      (selectedFirmaId === 'all' || g.firmaId === selectedFirmaId) &&
      isInDateRange(g.olusturmaTarihi)
    ),
    [gorevler, selectedFirmaId, dateFrom, dateTo],
  );
  const filtreTutanaklar = useMemo(
    () => tutanaklar.filter(t =>
      !t.silinmis &&
      (selectedFirmaId === 'all' || t.firmaId === selectedFirmaId) &&
      isInDateRange(t.olusturmaTarihi)
    ),
    [tutanaklar, selectedFirmaId, dateFrom, dateTo],
  );

  // Alias'lar — eski kod uyumluluğu için
  const aktifPersoneller = filtrePersoneller;
  const aktifEvraklar = filtreEvraklar;
  const aktifEgitimler = filtreEgitimler;
  const aktifMuayeneler = filtreMuayeneler;
  const aktifUygunsuzluklar = filtreUygunsuzluklar;
  const aktifEkipmanlar = filtreEkipmanlar;
  const aktifGorevler = filtreGorevler;
  const aktifTutanaklar = filtreTutanaklar;

  // Gösterilen firma listesi (genel bakış tablosunda)
  const goruntulenenFirmalar = useMemo(
    () => selectedFirmaId === 'all' ? aktifFirmalar : aktifFirmalar.filter(f => f.id === selectedFirmaId),
    [selectedFirmaId, aktifFirmalar],
  );

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

  // Yeni katılım istatistikleri
  const egitimKatilimStats = useMemo(() => {
    let toplamKatilimci = 0;
    let toplamKatildi = 0;
    let toplamKatilmadi = 0;
    let egitimSayisiKatilimciVar = 0;

    aktifEgitimler.forEach(e => {
      const katilimcilar = e.katilimcilar ?? (e.katilimciIds ?? []).map(id => ({ personelId: id, katildi: true }));
      if (katilimcilar.length > 0) {
        egitimSayisiKatilimciVar++;
        toplamKatilimci += katilimcilar.length;
        toplamKatildi += katilimcilar.filter(k => k.katildi).length;
        toplamKatilmadi += katilimcilar.filter(k => !k.katildi).length;
      }
    });

    const katilimOrani = toplamKatilimci > 0 ? Math.round((toplamKatildi / toplamKatilimci) * 100) : 0;

    return {
      toplamEgitim: aktifEgitimler.length,
      egitimSayisiKatilimciVar,
      toplamKatilimci,
      toplamKatildi,
      toplamKatilmadi,
      katilimOrani,
    };
  }, [aktifEgitimler]);

  // Firma bazlı eğitim dağılımı — çoklu firma (firmaIds) desteğiyle
  const egitimFirmaDagilim = useMemo(() => {
    const map = new Map<string, { firmaAd: string; egitimSayisi: number; toplamKatilimci: number; toplamKatildi: number }>();
    aktifEgitimler.forEach(e => {
      const katilimcilar = e.katilimcilar ?? (e.katilimciIds ?? []).map(id => ({ personelId: id, katildi: true }));
      const katildi = katilimcilar.filter(k => k.katildi).length;
      // Çoklu firma desteği
      const egFirmaIds = e.firmaIds && e.firmaIds.length > 0 ? e.firmaIds : (e.firmaId ? [e.firmaId] : []);
      egFirmaIds.forEach(firmaId => {
        const firma = aktifFirmalar.find(f => f.id === firmaId);
        if (!firma) return;
        const existing = map.get(firmaId) ?? { firmaAd: firma.ad, egitimSayisi: 0, toplamKatilimci: 0, toplamKatildi: 0 };
        map.set(firmaId, {
          firmaAd: firma.ad,
          egitimSayisi: existing.egitimSayisi + 1,
          toplamKatilimci: existing.toplamKatilimci + katilimcilar.length,
          toplamKatildi: existing.toplamKatildi + katildi,
        });
      });
    });
    return Array.from(map.values()).sort((a, b) => b.egitimSayisi - a.egitimSayisi).slice(0, 8);
  }, [aktifEgitimler, aktifFirmalar]);

  // Aylık katılım trendi
  const egitimAylikKatilim = useMemo(() => months.map(m => {
    const ayEgitimleri = aktifEgitimler.filter(e => getMonthKey(e.tarih || e.olusturmaTarihi) === m.key);
    let katildi = 0;
    let katilmadi = 0;
    ayEgitimleri.forEach(e => {
      const katilimcilar = e.katilimcilar ?? (e.katilimciIds ?? []).map(id => ({ personelId: id, katildi: true }));
      katildi += katilimcilar.filter(k => k.katildi).length;
      katilmadi += katilimcilar.filter(k => !k.katildi).length;
    });
    return { ay: m.label, 'Katıldı': katildi, 'Katılmadı': katilmadi, 'Eğitim Sayısı': ayEgitimleri.length };
  }), [months, aktifEgitimler]);

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
    { id: 'saglik', label: 'Sağlık Durumu', icon: 'ri-heart-pulse-line', color: '#EC4899' },
  ] as const;

  // ── Sağlık Takibi İstatistikleri ──
  const getDaysUntil = (dateStr: string) => {
    if (!dateStr) return 9999;
    const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return Math.ceil((d.getTime() - now.getTime()) / 86400000);
  };

  const saglikStats = useMemo(() => ({
    toplam: aktifMuayeneler.length,
    guncel: aktifMuayeneler.filter(m => getDaysUntil(m.sonrakiTarih) > 30).length,
    yaklasan: aktifMuayeneler.filter(m => { const d = getDaysUntil(m.sonrakiTarih); return d >= 0 && d <= 30; }).length,
    gecmis: aktifMuayeneler.filter(m => getDaysUntil(m.sonrakiTarih) < 0).length,
  }), [aktifMuayeneler]);

  const saglikTrend = useMemo(() => months.map(m => ({
    ay: m.label,
    Muayene: aktifMuayeneler.filter(mu => getMonthKey(mu.muayeneTarihi) === m.key).length,
  })), [months, aktifMuayeneler]);

  const saglikDurumData = useMemo(() => [
    { name: 'Güncel', value: saglikStats.guncel, color: '#10B981' },
    { name: 'Yaklaşıyor', value: saglikStats.yaklasan, color: '#F59E0B' },
    { name: 'Süresi Geçmiş', value: saglikStats.gecmis, color: '#EF4444' },
  ].filter(d => d.value > 0), [saglikStats]);

  const egitimDurumSub = useMemo(() => {
    const tamamlandi = aktifEgitimler.filter(e => e.durum === 'Tamamlandı').length;
    const planlandi = aktifEgitimler.filter(e => e.durum === 'Planlandı').length;
    const eksik = aktifEgitimler.filter(e => e.durum === 'Eksik').length;
    const parts: string[] = [];
    if (tamamlandi > 0) parts.push(`${tamamlandi} tamamlandı`);
    if (planlandi > 0) parts.push(`${planlandi} planlandı`);
    if (eksik > 0) parts.push(`${eksik} eksik`);
    return parts.length > 0 ? parts.join(' · ') : 'Kayıt yok';
  }, [aktifEgitimler]);

  const kpiCards = [
    { label: 'Toplam Firma', value: aktifFirmalar.length, icon: 'ri-building-2-line', color: '#3B82F6', sub: `${aktifFirmalar.filter(f => f.durum === 'Aktif').length} aktif firma` },
    { label: 'Toplam Personel', value: aktifPersoneller.length, icon: 'ri-team-line', color: '#10B981', sub: `${aktifPersoneller.filter(p => p.durum === 'Aktif').length} aktif personel` },
    { label: 'Toplam Evrak', value: aktifEvraklar.length, icon: 'ri-file-list-3-line', color: '#F59E0B', sub: `${evrakStats.eksik + evrakStats.sureDolmus} sorunlu evrak` },
    { label: 'Eğitim Kayıtları', value: aktifEgitimler.length, icon: 'ri-graduation-cap-line', color: '#6366F1', sub: egitimDurumSub },
    { label: 'Açık Uygunsuzluk', value: uygunsuzlukStats.acik, icon: 'ri-alert-line', color: uygunsuzlukStats.acik > 0 ? '#EF4444' : '#10B981', sub: `${uygunsuzlukStats.kapandi} kapatıldı` },
    { label: 'Sağlık Takibi', value: saglikStats.toplam, icon: 'ri-heart-pulse-line', color: '#EC4899', sub: `${saglikStats.gecmis} süresi geçmiş` },
    { label: 'Ekipmanlar', value: aktifEkipmanlar.length, icon: 'ri-tools-line', color: '#F97316', sub: `${aktifEkipmanlar.filter(e => e.durum === 'Uygun Değil').length} uygun değil · ${aktifEkipmanlar.filter(e => e.sonrakiKontrolTarihi && new Date(e.sonrakiKontrolTarihi) < new Date()).length} gecikmiş` },
    { label: 'Tutanaklar', value: aktifTutanaklar.length, icon: 'ri-article-line', color: '#14B8A6', sub: `${aktifTutanaklar.filter(t => t.durum === 'Onaylandı').length} onaylı` },
  ];

  // Özet sağlık skoru — tüm alanları kapsamlı hesaplar
  const healthScore = useMemo(() => {
    // Her kategori için ceza puanı (toplam 100 üzerinden)
    // 1. Evrak sorunları (ağırlık: 35 puan)
    const evrakTotal = aktifEvraklar.length;
    const evrakSorunlu = evrakStats.eksik + evrakStats.sureDolmus;
    const evrakCeza = evrakTotal > 0 ? (evrakSorunlu / evrakTotal) * 35 : 0;

    // 2. Açık uygunsuzluklar (ağırlık: 30 puan) — kritik olanlar daha fazla ceza
    const acikUygunsuzluk = aktifUygunsuzluklar.filter(u => u.durum !== 'Kapandı').length;
    const kritikUygunsuzluk = aktifUygunsuzluklar.filter(u => u.durum !== 'Kapandı' && (u.severity === 'Kritik' || u.severity === 'Yüksek')).length;
    const uygunsuzlukRef = Math.max(aktifUygunsuzluklar.length, 1);
    const uygunsuzlukCeza = Math.min(30, ((acikUygunsuzluk * 1 + kritikUygunsuzluk * 2) / uygunsuzlukRef) * 30);

    // 3. Gecikmiş / uygun olmayan ekipmanlar (ağırlık: 20 puan)
    const ekipmanTotal = aktifEkipmanlar.length;
    const ekipmanSorunlu = aktifEkipmanlar.filter(e =>
      e.durum === 'Uygun Değil' ||
      (e.sonrakiKontrolTarihi && new Date(e.sonrakiKontrolTarihi) < new Date())
    ).length;
    const ekipmanCeza = ekipmanTotal > 0 ? (ekipmanSorunlu / ekipmanTotal) * 20 : 0;

    // 4. Süresi geçmiş sağlık takibi (ağırlık: 15 puan)
    const saglikTotal = saglikStats.toplam;
    const saglikSorunlu = saglikStats.gecmis;
    const saglikCeza = saglikTotal > 0 ? (saglikSorunlu / saglikTotal) * 15 : 0;

    const toplamCeza = evrakCeza + uygunsuzlukCeza + ekipmanCeza + saglikCeza;
    return Math.max(0, Math.round(100 - toplamCeza));
  }, [aktifEvraklar, evrakStats, aktifUygunsuzluklar, aktifEkipmanlar, saglikStats]);

  const healthColor = healthScore >= 80 ? '#10B981' : healthScore >= 60 ? '#F59E0B' : '#EF4444';
  const healthLabel = healthScore >= 80 ? 'İyi' : healthScore >= 60 ? 'Orta' : 'Kritik';

  // ── Excel Export ──
  const [exporting, setExporting] = useState(false);

  const handleExcelExport = () => {
    setExporting(true);
    (async () => {
      try {
        const ExcelJS = (await import('exceljs')).default;
        const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('tr-TR') : '—';

        // ── calcDays: en başta tanımla, tüm sayfalarda kullanılıyor ──
        const calcDays = (dateStr: string | null | undefined): number | null => {
          if (!dateStr) return null;
          const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
          const n = new Date(); n.setHours(0, 0, 0, 0);
          return Math.ceil((d.getTime() - n.getTime()) / 86400000);
        };
        const getDurumLabel = (days: number | null) => {
          if (days === null) return '—';
          if (days < 0) return 'Süresi Geçmiş';
          if (days <= 30) return 'Yaklaşıyor';
          return 'Güncel';
        };
        const now = new Date();
        const tarih = now.toLocaleDateString('tr-TR');
        const tarihDosya = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
        const firmaAdi = secilenFirma ? secilenFirma.ad : 'TÜM FİRMALAR';
        const firmaAdiDosya = secilenFirma ? secilenFirma.ad.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ\s]/g, '').trim().replace(/\s+/g, '-').toUpperCase() : 'GENEL';
        const tarihAralikLabel = isDateActive ? activeDateLabel : 'Tüm Zamanlar';
        const tarihAralikDosya = isDateActive
          ? (dateFrom && dateTo ? `${dateFrom.replace(/-/g, '')}-${dateTo.replace(/-/g, '')}` : dateFrom ? `${dateFrom.replace(/-/g, '')}-SONRASI` : `${dateTo.replace(/-/g, '')}-ONCESI`)
          : '';

        // Excel'de kullanılacak filtrelenmiş veriler
        const exFirmalar = selectedFirmaId === 'all' ? aktifFirmalar : aktifFirmalar.filter(f => f.id === selectedFirmaId);
        const exPersoneller = aktifPersoneller;
        const exEvraklar = aktifEvraklar;
        const exEgitimler = aktifEgitimler;
        const exMuayeneler = aktifMuayeneler;
        const exUygunsuzluklar = aktifUygunsuzluklar;
        const exEkipmanlar = aktifEkipmanlar;

        const wb = new ExcelJS.Workbook();
        setWorkbookMetadata(wb);

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
          c3.value = `${subtitle}  |  Dönem: ${tarihAralikLabel}`;
          c3.font = { italic: true, size: 10, color: { argb: 'FF94A3B8' }, name: 'Calibri' };
          c3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
          c3.alignment = { horizontal: 'left', vertical: 'middle' };
        };

        const applyHeaderCols = (ws: ExcelJS.Worksheet, cols: string[], useBlue = false, rowNum = 5) => {
          const hdrRow = ws.getRow(rowNum); hdrRow.height = 22;
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
          rowHeight = 20,
        ) => {
          rows.forEach((rowVals, ri) => {
            const exRow = ws.getRow(startRow + ri);
            // Satırdaki en uzun metin içeriğine göre yüksekliği dinamik hesapla
            const maxLen = rowVals.reduce((mx, v) => {
              const s = String(v[0] ?? '');
              return Math.max(mx, s.length);
            }, 0);
            exRow.height = Math.max(rowHeight, Math.min(80, Math.ceil(maxLen / 40) * 15 + 8));
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
          
          // Marka koruması: Watermark
          addWatermark(ws, cols.length);
          
          // Header satırları (watermark sonrası 2. satırdan başlar)
          ws.mergeCells(2, 1, 2, cols.length);
          ws.mergeCells(3, 1, 3, cols.length);
          ws.mergeCells(4, 1, 4, cols.length);
          const r2 = ws.getRow(2); r2.height = 32;
          const r3 = ws.getRow(3); r3.height = 26;
          const r4 = ws.getRow(4); r4.height = 18;
          const c2 = ws.getCell(2, 1);
          c2.value = 'ISG DENETİM YÖNETİM SİSTEMİ';
          c2.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
          c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF020817' } };
          c2.alignment = { horizontal: 'left', vertical: 'middle' };
          const c3 = ws.getCell(3, 1);
          c3.value = title;
          c3.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
          c3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A0F1E' } };
          c3.alignment = { horizontal: 'left', vertical: 'middle' };
          const c4 = ws.getCell(4, 1);
          c4.value = `${subtitle}  |  Dönem: ${tarihAralikLabel}`;
          c4.font = { italic: true, size: 10, color: { argb: 'FF94A3B8' }, name: 'Calibri' };
          c4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
          c4.alignment = { horizontal: 'left', vertical: 'middle' };
          
          // Kolon header'ı (5. satır)
          applyHeaderCols(ws, cols, useBlue);
          
          // Veri satırları (6. satırdan başlar)
          applyDataRows(ws, rows.map(r => r.map(v => [v])), cols, 6);
          
          // Freeze pane
          ws.views = [{ state: 'frozen', ySplit: 5 }];
          
          // Marka koruması: Footer
          addFooter(ws, rows.length + 5, cols.length);
          
          // Marka koruması: Sheet protection
          protectSheet(ws);
          
          return ws;
        };

        // ── SAYFA 1: ÖZET ──
        const ozetWs = wb.addWorksheet('Genel Özet');
        ozetWs.columns = [{ width: 30 }, { width: 16 }, { width: 30 }, { width: 16 }];
        
        // Marka koruması: Watermark
        addWatermark(ozetWs, 4);
        
        // Header satırları (watermark sonrası)
        ozetWs.mergeCells(2, 1, 2, 4);
        ozetWs.mergeCells(3, 1, 3, 4);
        ozetWs.mergeCells(4, 1, 4, 4);
        const r2 = ozetWs.getRow(2); r2.height = 32;
        const r3 = ozetWs.getRow(3); r3.height = 26;
        const r4 = ozetWs.getRow(4); r4.height = 18;
        const c2 = ozetWs.getCell(2, 1);
        c2.value = 'ISG DENETİM YÖNETİM SİSTEMİ';
        c2.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
        c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF020817' } };
        c2.alignment = { horizontal: 'left', vertical: 'middle' };
        const c3 = ozetWs.getCell(3, 1);
        c3.value = `GENEL ÖZET RAPORU — ${firmaAdi}`;
        c3.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
        c3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A0F1E' } };
        c3.alignment = { horizontal: 'left', vertical: 'middle' };
        const c4 = ozetWs.getCell(4, 1);
        c4.value = `Rapor Tarihi: ${tarih}  |  Firma: ${firmaAdi}`;
        c4.font = { italic: true, size: 10, color: { argb: 'FF94A3B8' }, name: 'Calibri' };
        c4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        c4.alignment = { horizontal: 'left', vertical: 'middle' };
        
        applyHeaderCols(ozetWs, ['Kategori', 'Toplam', 'Alt Kategori', 'Değer'], false);
        const ozetRows = [
          ['Toplam Firma', exFirmalar.length, 'Aktif Firma', exFirmalar.filter(f => f.durum === 'Aktif').length],
          ['Toplam Personel', exPersoneller.length, 'Aktif Personel', exPersoneller.filter(p => p.durum === 'Aktif').length],
          ['Toplam Evrak', exEvraklar.length, 'Sorunlu Evrak', evrakStats.eksik + evrakStats.sureDolmus],
          ['Toplam Eğitim', exEgitimler.length, 'Katılım Oranı', `%${egitimKatilimStats.katilimOrani}`],
          ['Sağlık Takibi', exMuayeneler.length, 'Süresi Geçmiş', exMuayeneler.filter(m => (calcDays(m.sonrakiTarih) ?? 1) < 0).length],
          ['Toplam Ekipman', exEkipmanlar.length, 'Uygun Değil', exEkipmanlar.filter(e => e.durum === 'Uygun Değil').length],
          ['Açık Uygunsuzluk', uygunsuzlukStats.acik, 'Kapatılan', uygunsuzlukStats.kapandi],
          ['Sistem Sağlık Skoru', `${healthScore}/100`, 'Durum', healthLabel],
        ];
        ozetRows.forEach((row, ri) => {
          const exRow = ozetWs.getRow(6 + ri);
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
        ozetWs.views = [{ state: 'frozen', ySplit: 5 }];
        
        // Marka koruması: Footer ve Protection
        addFooter(ozetWs, ozetRows.length + 5, 4);
        protectSheet(ozetWs);

        // ── SAYFA 2: FİRMALAR ──
        buildSheet('Firmalar', 'FİRMALAR LİSTESİ', `Toplam ${exFirmalar.length} firma  |  ${firmaAdi}  |  Rapor: ${tarih}`,
          ['#', 'Firma Adı', 'Yetkili Kişi', 'Telefon', 'E-posta', 'Tehlike Sınıfı', 'Durum', 'Personel', 'Evrak', 'Açık Uyg.', 'Sözleşme Baş.', 'Sözleşme Bit.'],
          exFirmalar.map((f, i) => {
            const pS = exPersoneller.filter(p => p.firmaId === f.id).length;
            const eS = exEvraklar.filter(e => e.firmaId === f.id).length;
            const uS = exUygunsuzluklar.filter(u => u.firmaId === f.id && u.durum === 'Açık').length;
            return [i+1, f.ad, f.yetkiliKisi||'—', f.telefon||'—', f.email||'—', f.tehlikeSinifi, f.durum, pS, eS, uS, fmtDate(f.sozlesmeBas), fmtDate(f.sozlesmeBit)];
          }),
          [4, 32, 24, 16, 30, 18, 13, 11, 11, 13, 15, 15],
        );

        // ── SAYFA 3: PERSONELLER ──
        buildSheet('Personeller', 'PERSONELLER LİSTESİ', `Toplam ${exPersoneller.length} personel  |  ${firmaAdi}  |  Rapor: ${tarih}`,
          ['#', 'Ad Soyad', 'TC Kimlik', 'Telefon', 'E-posta', 'Firma', 'Görev', 'Departman', 'Durum', 'Kan Grubu', 'Doğum Tarihi', 'İşe Giriş'],
          exPersoneller.map((p, i) => {
            const firma = aktifFirmalar.find(f => f.id === p.firmaId);
            return [i+1, p.adSoyad, p.tc||'—', p.telefon||'—', p.email||'—', firma?.ad||'—', p.gorev||'—', p.departman||'—', p.durum, p.kanGrubu||'—', fmtDate(p.dogumTarihi), fmtDate(p.iseGirisTarihi)];
          }),
          [4, 28, 15, 17, 30, 26, 22, 20, 13, 11, 15, 15],
        );

        // ── SAYFA 4: EVRAKLAR ──
        buildSheet('Evraklar', 'EVRAKLAR LİSTESİ', `Toplam ${exEvraklar.length} evrak  |  Sorunlu: ${evrakStats.eksik + evrakStats.sureDolmus}  |  ${firmaAdi}  |  Rapor: ${tarih}`,
          ['#', 'Evrak Adı', 'Tür', 'Firma', 'Personel', 'Durum', 'Geçerlilik Tarihi', 'Kalan Süre'],
          exEvraklar.map((e, i) => {
            const firma = aktifFirmalar.find(f => f.id === e.firmaId);
            const personel = exPersoneller.find(p => p.id === e.personelId);
            const t2 = new Date(); t2.setHours(0,0,0,0);
            const kg = e.gecerlilikTarihi ? Math.ceil((new Date(e.gecerlilikTarihi).getTime() - t2.getTime()) / 86400000) : null;
            return [i+1, e.ad, e.tur||'—', firma?.ad||'—', personel?.adSoyad||'—', e.durum, fmtDate(e.gecerlilikTarihi), kg !== null ? (kg < 0 ? `${Math.abs(kg)}g önce doldu` : `${kg}g kaldı`) : '—'];
          }),
          [4, 34, 22, 26, 26, 17, 17, 15],
        );

        // ── SAYFA 5: EĞİTİMLER ──
        const egitimListeWs = wb.addWorksheet('Eğitimler');
        const egitimListeCols = ['#', 'Eğitim Adı', 'Firma', 'Eğitmen', 'Tarih', 'Açıklama', 'Toplam Katılımcı', 'Katıldı', 'Katılmadı', 'Katılım Oranı'];
        egitimListeWs.columns = [4, 36, 28, 24, 14, 42, 16, 12, 12, 14].map(w => ({ width: w }));
        
        // Marka koruması
        addWatermark(egitimListeWs, egitimListeCols.length);
        
        // Header (watermark sonrası 2. satırdan)
        egitimListeWs.mergeCells(2, 1, 2, egitimListeCols.length);
        egitimListeWs.mergeCells(3, 1, 3, egitimListeCols.length);
        egitimListeWs.mergeCells(4, 1, 4, egitimListeCols.length);
        const eR2 = egitimListeWs.getRow(2); eR2.height = 32;
        const eR3 = egitimListeWs.getRow(3); eR3.height = 26;
        const eR4 = egitimListeWs.getRow(4); eR4.height = 18;
        const eC2 = egitimListeWs.getCell(2, 1);
        eC2.value = 'ISG DENETİM YÖNETİM SİSTEMİ';
        eC2.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
        eC2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF020817' } };
        eC2.alignment = { horizontal: 'left', vertical: 'middle' };
        const eC3 = egitimListeWs.getCell(3, 1);
        eC3.value = 'EĞİTİMLER LİSTESİ';
        eC3.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
        eC3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A0F1E' } };
        eC3.alignment = { horizontal: 'left', vertical: 'middle' };
        const eC4 = egitimListeWs.getCell(4, 1);
        eC4.value = `Toplam ${exEgitimler.length} eğitim  |  ${firmaAdi}  |  Rapor: ${tarih}`;
        eC4.font = { italic: true, size: 10, color: { argb: 'FF94A3B8' }, name: 'Calibri' };
        eC4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        eC4.alignment = { horizontal: 'left', vertical: 'middle' };
        
        applyHeaderCols(egitimListeWs, egitimListeCols);
        exEgitimler
          .sort((a, b) => new Date(b.tarih || b.olusturmaTarihi).getTime() - new Date(a.tarih || a.olusturmaTarihi).getTime())
          .forEach((e, i) => {
            // Çoklu firma desteği
            const exEgFirmaIds = e.firmaIds && e.firmaIds.length > 0 ? e.firmaIds : (e.firmaId ? [e.firmaId] : []);
            const exEgFirmaAd = exEgFirmaIds.map(id => aktifFirmalar.find(f => f.id === id)?.ad || '—').join(', ');
            const katilimcilar = e.katilimcilar ?? (e.katilimciIds ?? []).map(id => ({ personelId: id, katildi: true }));
            const katildi = katilimcilar.filter(k => k.katildi).length;
            const katilmadi = katilimcilar.filter(k => !k.katildi).length;
            const oran = katilimcilar.length > 0 ? `%${Math.round((katildi / katilimcilar.length) * 100)}` : '—';
            // Açıklama uzunluğuna göre satır yüksekliğini dinamik hesapla
            const aciklamaLen = (e.aciklama || '').length;
            const dinamikHeight = Math.max(20, Math.min(80, Math.ceil(aciklamaLen / 35) * 15 + 10));
            const exRow = egitimListeWs.getRow(6 + i);
            exRow.height = dinamikHeight;
            const bg = i % 2 === 0 ? 'FFFFFFFF' : 'FFF0F4FF';
            const vals = [i+1, e.ad, exEgFirmaAd, e.egitmen||'—', fmtDate(e.tarih), e.aciklama||'—', katilimcilar.length, katildi, katilmadi, oran];
            vals.forEach((val, ci) => {
              const cell = exRow.getCell(ci + 1);
              cell.value = val;
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
              cell.font = { size: 10, name: 'Calibri', color: { argb: 'FF1E293B' } };
              cell.alignment = { vertical: ci === 5 ? 'top' : 'middle', horizontal: ci === 5 ? 'left' : undefined, wrapText: ci === 5 };
              cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } }, right: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
              if (ci === 0) { cell.font = { size: 9, name: 'Calibri', color: { argb: 'FF94A3B8' } }; cell.alignment = { horizontal: 'center', vertical: 'middle' }; }
              if (ci === 7) { cell.font = { bold: true, size: 10, name: 'Calibri', color: { argb: 'FF16A34A' } }; cell.alignment = { horizontal: 'center', vertical: 'middle' }; }
              if (ci === 8 && katilmadi > 0) { cell.font = { bold: true, size: 10, name: 'Calibri', color: { argb: 'FFD97706' } }; cell.alignment = { horizontal: 'center', vertical: 'middle' }; }
              if (ci === 9 && oran !== '—') {
                const oranNum = parseInt(oran.replace('%', ''));
                const oranColor = oranNum >= 80 ? 'FF16A34A' : oranNum >= 60 ? 'FFD97706' : 'FFDC2626';
                const oranBg = oranNum >= 80 ? 'FFDCFCE7' : oranNum >= 60 ? 'FFFEF3C7' : 'FFFEE2E2';
                cell.font = { bold: true, size: 10, name: 'Calibri', color: { argb: oranColor } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: oranBg } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
              }
            });
          });
        egitimListeWs.views = [{ state: 'frozen', ySplit: 5 }];
        addFooter(egitimListeWs, exEgitimler.length + 5, egitimListeCols.length);
        protectSheet(egitimListeWs);

        // ── SAYFA 5b: EĞİTİM KATILIMCI DETAY ──
        const katilimWs = wb.addWorksheet('Eğitim Katılım Detay');
        const katilimCols = ['#', 'Eğitim Adı', 'Firma', 'Tarih', 'Personel Adı', 'Görev', 'Katılım Durumu'];
        katilimWs.columns = [4, 30, 24, 14, 26, 20, 16].map(w => ({ width: w }));
        
        // Marka koruması
        addWatermark(katilimWs, katilimCols.length);
        
        // Header (watermark sonrası)
        katilimWs.mergeCells(2, 1, 2, katilimCols.length);
        katilimWs.mergeCells(3, 1, 3, katilimCols.length);
        katilimWs.mergeCells(4, 1, 4, katilimCols.length);
        const kR2 = katilimWs.getRow(2); kR2.height = 32;
        const kR3 = katilimWs.getRow(3); kR3.height = 26;
        const kR4 = katilimWs.getRow(4); kR4.height = 18;
        const kC2 = katilimWs.getCell(2, 1);
        kC2.value = 'ISG DENETİM YÖNETİM SİSTEMİ';
        kC2.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
        kC2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF020817' } };
        kC2.alignment = { horizontal: 'left', vertical: 'middle' };
        const kC3 = katilimWs.getCell(3, 1);
        kC3.value = 'EĞİTİM KATILIM DETAY';
        kC3.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
        kC3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A0F1E' } };
        kC3.alignment = { horizontal: 'left', vertical: 'middle' };
        const kC4 = katilimWs.getCell(4, 1);
        kC4.value = `Tüm eğitimlerin katılımcı detayı  |  ${firmaAdi}  |  Rapor: ${tarih}`;
        kC4.font = { italic: true, size: 10, color: { argb: 'FF94A3B8' }, name: 'Calibri' };
        kC4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        kC4.alignment = { horizontal: 'left', vertical: 'middle' };
        
        applyHeaderCols(katilimWs, katilimCols);
        let katilimRowIdx = 0;
        exEgitimler
          .sort((a, b) => new Date(b.tarih || b.olusturmaTarihi).getTime() - new Date(a.tarih || a.olusturmaTarihi).getTime())
          .forEach(e => {
            // Çoklu firma desteği
            const katilimEgFirmaIds = e.firmaIds && e.firmaIds.length > 0 ? e.firmaIds : (e.firmaId ? [e.firmaId] : []);
            const katilimEgFirmaAd = katilimEgFirmaIds.map(id => aktifFirmalar.find(f => f.id === id)?.ad || '—').join(', ');
            const katilimcilar = e.katilimcilar ?? (e.katilimciIds ?? []).map(id => ({ personelId: id, katildi: true }));
            katilimcilar.forEach(k => {
              const personel = exPersoneller.find(p => p.id === k.personelId);
              const exRow = katilimWs.getRow(6 + katilimRowIdx);
              exRow.height = 18;
              const bg = katilimRowIdx % 2 === 0 ? 'FFFFFFFF' : 'FFF0F4FF';
              const durumLabel = k.katildi ? 'Katıldı' : 'Katılmadı';
              const vals = [katilimRowIdx + 1, e.ad, katilimEgFirmaAd, fmtDate(e.tarih), personel?.adSoyad||'—', personel?.gorev||'—', durumLabel];
              vals.forEach((val, ci) => {
                const cell = exRow.getCell(ci + 1);
                cell.value = val;
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
                cell.font = { size: 10, name: 'Calibri', color: { argb: 'FF1E293B' } };
                cell.alignment = { vertical: 'middle' };
                cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } }, right: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
                if (ci === 0) { cell.font = { size: 9, name: 'Calibri', color: { argb: 'FF94A3B8' } }; cell.alignment = { horizontal: 'center', vertical: 'middle' }; }
                if (ci === 6) {
                  const sc = k.katildi ? { fg: 'FF16A34A', bg: 'FFDCFCE7' } : { fg: 'FFD97706', bg: 'FFFEF3C7' };
                  cell.font = { bold: true, size: 10, name: 'Calibri', color: { argb: sc.fg } };
                  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sc.bg } };
                  cell.alignment = { horizontal: 'center', vertical: 'middle' };
                }
              });
              katilimRowIdx++;
            });
          });
        katilimWs.views = [{ state: 'frozen', ySplit: 5 }];
        addFooter(katilimWs, katilimRowIdx + 5, katilimCols.length);
        protectSheet(katilimWs);

        // ── SAYFA 6: SAĞLIK TAKİBİ ──
        const saglikWs = wb.addWorksheet('Sağlık Takibi');
        const saglikCols = ['#', 'Ad Soyad', 'Görev', 'Firma', 'Muayene Tarihi', 'Sonraki Muayene', 'Kalan Gün', 'Durum', 'Sağlık Durumu'];
        saglikWs.columns = [4, 26, 20, 24, 16, 18, 12, 16, 20].map(w => ({ width: w }));
        applyHeaderRows(saglikWs, 'SAĞLIK TAKİBİ', `Toplam ${exMuayeneler.length} kayıt  |  Geçmiş: ${exMuayeneler.filter(m => (calcDays(m.sonrakiTarih) ?? 1) < 0).length}  |  ${firmaAdi}  |  Rapor: ${tarih}`, saglikCols.length);
        applyHeaderCols(saglikWs, saglikCols, false, 4);

        exMuayeneler
          .sort((a, b) => (calcDays(a.sonrakiTarih) ?? 9999) - (calcDays(b.sonrakiTarih) ?? 9999))
          .forEach((m, i) => {
            const personel = exPersoneller.find(p => p.id === m.personelId);
            const firma = aktifFirmalar.find(f => f.id === (personel?.firmaId ?? ''));
            const days = calcDays(m.sonrakiTarih);
            const durumLabel = getDurumLabel(days);
            const saglikDurumu = (m as unknown as { saglikDurumu?: string }).saglikDurumu || '—';

            const exRow = saglikWs.getRow(5 + i);
            exRow.height = 18;
            const isEven = i % 2 === 0;
            const rowBg = isEven ? 'FFFFFFFF' : 'FFF8F0FF';

            const vals = [i+1, personel?.adSoyad||'—', personel?.gorev||'—', firma?.ad||'—', fmtDate(m.muayeneTarihi), fmtDate(m.sonrakiTarih), days !== null ? days : '—', durumLabel, saglikDurumu];
            vals.forEach((val, ci) => {
              const cell = exRow.getCell(ci + 1);
              cell.value = val;
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
              cell.font = { size: 10, name: 'Calibri', color: { argb: 'FF1E293B' } };
              cell.alignment = { vertical: 'middle', wrapText: false };
              cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } }, right: { style: 'thin', color: { argb: 'FFCBD5E1' } } };

              // Sıra no
              if (ci === 0) { cell.font = { size: 9, name: 'Calibri', color: { argb: 'FF94A3B8' } }; cell.alignment = { horizontal: 'center', vertical: 'middle' }; }

              // Kalan gün — renkli
              if (ci === 6 && days !== null) {
                const dayColor = days < 0 ? 'FFDC2626' : days <= 30 ? 'FFD97706' : 'FF16A34A';
                const dayBg = days < 0 ? 'FFFEE2E2' : days <= 30 ? 'FFFEF3C7' : 'FFDCFCE7';
                cell.font = { bold: true, size: 10, name: 'Calibri', color: { argb: dayColor } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: dayBg } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
              }

              // Durum sütunu — renkli
              if (ci === 7) {
                const sc = STATUS_COLORS[durumLabel] ?? (
                  durumLabel === 'Güncel' ? { fg: 'FF16A34A', bg: 'FFDCFCE7' } :
                  durumLabel === 'Yaklaşıyor' ? { fg: 'FFD97706', bg: 'FFFEF3C7' } :
                  { fg: 'FFDC2626', bg: 'FFFEE2E2' }
                );
                cell.font = { bold: true, size: 10, name: 'Calibri', color: { argb: sc.fg } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sc.bg } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
              }
            });
          });
        saglikWs.views = [{ state: 'frozen', ySplit: 5 }];
        addFooter(saglikWs, exMuayeneler.length + 5, saglikCols.length);
        protectSheet(saglikWs);

        // ── SAYFA 7: UYGUNSUZLUKLAR — fotoğraf embed ──
        // urlToBase64: filePath ise signed URL üretir, http URL ise direkt fetch eder
        const photoResults = await Promise.all(
          exUygunsuzluklar.map(async u => ({
            id: u.id,
            acilis: u.acilisFotoMevcut ? await urlToBase64(u.acilisFotoUrl ?? '') : null,
            kapanis: u.kapatmaFotoMevcut ? await urlToBase64(u.kapatmaFotoUrl ?? '') : null,
          }))
        );
        const photoMap2 = new Map(photoResults.map(r => [r.id, { acilis: r.acilis, kapanis: r.kapanis }]));

        const wsUyg = wb.addWorksheet('Uygunsuzluklar');
        const uygCols = ['#', 'DÖF No', 'Başlık', 'Firma', 'Durum', 'Seviye', 'Açılış Tarihi', 'Kapanış Tarihi', 'Sorumlu', 'Açılış Fotosu', 'Kapanış Fotosu'];
        wsUyg.columns = [5, 15, 42, 28, 14, 15, 17, 17, 24, 28, 28].map(w => ({ width: w }));
        applyHeaderRows(wsUyg, 'UYGUNSUZLUKLAR LİSTESİ', `Açık: ${uygunsuzlukStats.acik}  |  Kapandı: ${uygunsuzlukStats.kapandi}  |  Kritik: ${uygunsuzlukStats.kritik}  |  ${firmaAdi}  |  Rapor: ${tarih}`, uygCols.length);
        applyHeaderCols(wsUyg, uygCols, true, 4);

        for (let i = 0; i < exUygunsuzluklar.length; i++) {
          const u = exUygunsuzluklar[i];
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
        wsUyg.views = [{ state: 'frozen', ySplit: 5 }];
        addFooter(wsUyg, exUygunsuzluklar.length + 5, uygCols.length);
        protectSheet(wsUyg);

        // ── SAYFA 8: EKİPMANLAR ──
        buildSheet('Ekipmanlar', 'EKİPMANLAR LİSTESİ', `Toplam ${exEkipmanlar.length} ekipman  |  Uygun Değil: ${exEkipmanlar.filter(e => e.durum === 'Uygun Değil').length}  |  ${firmaAdi}  |  Rapor: ${tarih}`,
          ['#', 'Ekipman Adı', 'Tür', 'Marka', 'Model', 'Firma', 'Durum', 'Sonraki Kontrol', 'Kalan Süre'],
          exEkipmanlar.map((e, i) => {
            const firma = aktifFirmalar.find(f => f.id === e.firmaId);
            const t2 = new Date(); t2.setHours(0,0,0,0);
            const kg = e.sonrakiKontrolTarihi ? Math.ceil((new Date(e.sonrakiKontrolTarihi).getTime() - t2.getTime()) / 86400000) : null;
            return [i+1, e.ad, e.tur||'—', e.marka||'—', e.model||'—', firma?.ad||'—', e.durum, fmtDate(e.sonrakiKontrolTarihi), kg !== null ? (kg < 0 ? `${Math.abs(kg)}g gecikti` : `${kg}g kaldı`) : '—'];
          }),
          [4, 28, 18, 16, 16, 24, 14, 16, 14],
        );

        // ── SAYFA 9: FİRMA BAZLI ÖZET ──
        buildSheet('Firma Özeti', 'FİRMA BAZLI ÖZET', `${exFirmalar.length} firma için konsolide özet  |  ${firmaAdi}  |  Rapor: ${tarih}`,
          ['#', 'Firma Adı', 'Tehlike Sınıfı', 'Durum', 'Personel', 'Aktif P.', 'Evrak', 'Sorunlu E.', 'Eğitim', 'Katılım Oranı', 'Sağlık Takibi', 'Geçmiş Muayene', 'Açık Uyg.', 'Ekipman'],
          exFirmalar.map((f, i) => {
            const pS = exPersoneller.filter(p => p.firmaId === f.id).length;
            const aP = exPersoneller.filter(p => p.firmaId === f.id && p.durum === 'Aktif').length;
            const eS = exEvraklar.filter(e => e.firmaId === f.id).length;
            const xE = exEvraklar.filter(e => e.firmaId === f.id && (e.durum === 'Eksik' || e.durum === 'Süre Dolmuş')).length;
            // Çoklu firma desteği: firmaIds array'ini kontrol et
            const firmaEgitimler = exEgitimler.filter(e => {
              const egFirmaIds = e.firmaIds && e.firmaIds.length > 0 ? e.firmaIds : (e.firmaId ? [e.firmaId] : []);
              return egFirmaIds.includes(f.id);
            });
            const egS = firmaEgitimler.length;
            // Katılım oranı: firmanın toplam personel sayısına göre hesaplanır
            let firmaToplamKatilimci = 0;
            let firmaKatildi = 0;
            firmaEgitimler.forEach(eg => {
              const kl = eg.katilimcilar ?? (eg.katilimciIds ?? []).map(id => ({ personelId: id, katildi: true }));
              firmaToplamKatilimci += kl.length;
              firmaKatildi += kl.filter(k => k.katildi).length;
            });
            // Firma personel sayısına göre oran (eğitim sayısı × personel sayısı = beklenen toplam katılım)
            const beklenenToplamKatilim = egS > 0 ? egS * pS : 0;
            const firmaKatilimOrani = beklenenToplamKatilim > 0 ? `%${Math.round((firmaKatildi / beklenenToplamKatilim) * 100)}` : '—';
            const firmaMuayeneler = exMuayeneler.filter(m => exPersoneller.find(p => p.id === m.personelId)?.firmaId === f.id);
            const muS = firmaMuayeneler.length;
            const muGecmis = firmaMuayeneler.filter(m => (calcDays(m.sonrakiTarih) ?? 1) < 0).length;
            const uS = exUygunsuzluklar.filter(u => u.firmaId === f.id && u.durum === 'Açık').length;
            const ekS = exEkipmanlar.filter(e => e.firmaId === f.id).length;
            return [i+1, f.ad, f.tehlikeSinifi, f.durum, pS, aP, eS, xE, egS, firmaKatilimOrani, muS, muGecmis, uS, ekS];
          }),
          [4, 26, 16, 12, 10, 10, 10, 12, 10, 14, 12, 14, 12, 10],
        );

        // ── TEK DOSYA OLARAK İNDİR ──
        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const donemSuffix = tarihAralikDosya ? `-${tarihAralikDosya}` : '';
        link.download = `${tarihDosya}-${firmaAdiDosya}${donemSuffix}-RAPOR.xlsx`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
      } finally {
        setExporting(false);
      }
    })();
  };

  const radialData = [{ name: 'Skor', value: healthScore, fill: healthColor }];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            Raporlar
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {secilenFirma ? (
              <span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{secilenFirma.ad}</span>
                {' '}firmasına ait veriler gösteriliyor
              </span>
            ) : 'Sistemdeki tüm verilerin özet analizi ve grafikleri'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tarih */}
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)', color: 'var(--text-muted)' }}>
            <i className="ri-calendar-line text-xs" />
            {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>

          {/* Tarih Aralığı Filtresi */}
          <div className="relative" ref={dateDropdownRef}>
            <button
              onClick={() => setDateDropdownOpen(v => !v)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all"
              style={{
                background: isDateActive ? 'rgba(16,185,129,0.1)' : 'var(--bg-card)',
                border: isDateActive ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--border-main)',
                color: isDateActive ? '#10B981' : 'var(--text-secondary)',
                minWidth: 150,
              }}
            >
              <i className="ri-calendar-line text-xs" />
              <span className="flex-1 text-left truncate" style={{ maxWidth: 140 }}>
                {isDateActive ? activeDateLabel : 'Tarih Filtresi'}
              </span>
              {dateDropdownOpen ? <i className="ri-arrow-up-s-line text-xs" /> : <i className="ri-arrow-down-s-line text-xs" />}
            </button>

            {dateDropdownOpen && (
              <div
                className="absolute right-0 mt-1.5 rounded-xl overflow-hidden z-50"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-main)',
                  minWidth: 260,
                  top: '100%',
                }}
              >
                {/* Preset seçenekleri */}
                <div className="p-2 space-y-0.5">
                  {DATE_PRESETS.filter(p => p.id !== 'custom').map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => applyPreset(preset.id)}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-left text-xs font-medium transition-colors cursor-pointer"
                      style={{
                        background: datePreset === preset.id ? 'rgba(16,185,129,0.08)' : 'transparent',
                        color: datePreset === preset.id ? '#10B981' : 'var(--text-secondary)',
                      }}
                    >
                      <i className={`ri-${preset.id === 'all' ? 'time-line' : preset.id === 'this_month' ? 'calendar-2-line' : preset.id === 'last_month' ? 'arrow-left-s-line' : 'history-line'} text-[10px]`} />
                      {preset.label}
                      {datePreset === preset.id && <i className="ri-check-line text-[10px] ml-auto" style={{ color: '#10B981' }} />}
                    </button>
                  ))}
                </div>

                {/* Özel aralık */}
                <div className="px-3 pb-3 pt-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <p className="text-[10px] font-semibold mb-2 mt-2" style={{ color: 'var(--text-muted)' }}>ÖZEL ARALIK</p>
                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] mb-1 block" style={{ color: 'var(--text-muted)' }}>Başlangıç</label>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={e => { setDateFrom(e.target.value); setDatePreset('custom'); }}
                        className="w-full px-2.5 py-1.5 rounded-lg text-xs"
                        style={{
                          background: 'var(--bg-item)',
                          border: '1px solid var(--border-main)',
                          color: 'var(--text-primary)',
                          outline: 'none',
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] mb-1 block" style={{ color: 'var(--text-muted)' }}>Bitiş</label>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={e => { setDateTo(e.target.value); setDatePreset('custom'); }}
                        className="w-full px-2.5 py-1.5 rounded-lg text-xs"
                        style={{
                          background: 'var(--bg-item)',
                          border: '1px solid var(--border-main)',
                          color: 'var(--text-primary)',
                          outline: 'none',
                        }}
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => { setDateDropdownOpen(false); }}
                        className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-all"
                        style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}
                      >
                        Uygula
                      </button>
                      <button
                        onClick={() => { applyPreset('all'); }}
                        className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-all"
                        style={{ background: 'var(--bg-item)', color: 'var(--text-muted)', border: '1px solid var(--border-main)' }}
                      >
                        Temizle
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Firma Filtresi */}
          <div className="relative" ref={firmaDropdownRef}>
            <button
              onClick={() => setFirmaDropdownOpen(v => !v)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all"
              style={{
                background: secilenFirma ? 'rgba(99,102,241,0.1)' : 'var(--bg-card)',
                border: secilenFirma ? '1px solid rgba(99,102,241,0.3)' : '1px solid var(--border-main)',
                color: secilenFirma ? '#818CF8' : 'var(--text-secondary)',
                minWidth: 160,
              }}
            >
              <i className="ri-building-2-line text-xs" />
              <span className="flex-1 text-left truncate" style={{ maxWidth: 140 }}>
                {secilenFirma ? secilenFirma.ad : 'Tüm Firmalar'}
              </span>
              {firmaDropdownOpen ? <i className="ri-arrow-up-s-line text-xs" /> : <i className="ri-arrow-down-s-line text-xs" />}
            </button>

            {firmaDropdownOpen && (
              <div
                className="absolute right-0 mt-1.5 rounded-xl overflow-hidden z-50"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-main)',
                  minWidth: 220,
                  maxHeight: 320,
                  overflowY: 'auto',
                  top: '100%',
                }}
              >
                {/* Tüm Firmalar seçeneği */}
                <button
                  onClick={() => { setSelectedFirmaId('all'); setFirmaDropdownOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-xs font-medium transition-colors cursor-pointer"
                  style={{
                    background: selectedFirmaId === 'all' ? 'rgba(99,102,241,0.08)' : 'transparent',
                    color: selectedFirmaId === 'all' ? '#818CF8' : 'var(--text-secondary)',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <div className="w-6 h-6 flex items-center justify-center rounded-lg flex-shrink-0"
                    style={{ background: selectedFirmaId === 'all' ? 'rgba(99,102,241,0.15)' : 'var(--bg-item)' }}>
                    <i className="ri-apps-line text-[10px]" style={{ color: selectedFirmaId === 'all' ? '#818CF8' : 'var(--text-muted)' }} />
                  </div>
                  <span className="font-semibold">Tüm Firmalar</span>
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ background: 'var(--bg-item)', color: 'var(--text-muted)' }}>
                    {aktifFirmalar.length}
                  </span>
                </button>

                {/* Firma listesi */}
                {aktifFirmalar.map(firma => (
                  <button
                    key={firma.id}
                    onClick={() => { setSelectedFirmaId(firma.id); setFirmaDropdownOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-xs font-medium transition-colors cursor-pointer"
                    style={{
                      background: selectedFirmaId === firma.id ? 'rgba(99,102,241,0.08)' : 'transparent',
                      color: selectedFirmaId === firma.id ? '#818CF8' : 'var(--text-secondary)',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div className="w-6 h-6 flex items-center justify-center rounded-lg flex-shrink-0 text-[9px] font-bold text-white"
                      style={{ background: selectedFirmaId === firma.id ? '#818CF8' : 'linear-gradient(135deg, #475569, #334155)' }}>
                      {firma.ad.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate flex-1">{firma.ad}</span>
                    {selectedFirmaId === firma.id && (
                      <i className="ri-check-line text-[10px] flex-shrink-0" style={{ color: '#818CF8' }} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Excel İndir */}
          <button
            onClick={handleExcelExport}
            disabled={exporting}
            className="btn-primary whitespace-nowrap"
            style={{ fontSize: '12.5px', padding: '8px 16px' }}
          >
            {exporting
              ? <><i className="ri-loader-4-line animate-spin text-sm" /> Hazırlanıyor...</>
              : <><i className="ri-file-excel-2-line text-sm" /> {secilenFirma ? `${secilenFirma.ad} Raporu` : 'Excel Raporu'} İndir</>
            }
          </button>
        </div>
      </div>

      {/* Tarih filtresi aktifse bilgi bandı */}
      {isDateActive && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}
        >
          <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
            style={{ background: 'rgba(16,185,129,0.12)' }}>
            <i className="ri-calendar-line text-xs" style={{ color: '#10B981' }} />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[12px] font-semibold" style={{ color: '#10B981' }}>Tarih Filtresi Aktif: </span>
            <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
              <strong>{activeDateLabel}</strong> dönemine ait veriler gösteriliyor.
            </span>
          </div>
          <button
            onClick={() => applyPreset('all')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-all"
            style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}
          >
            <i className="ri-close-line text-xs" />
            Filtreyi Kaldır
          </button>
        </div>
      )}

      {/* Firma filtresi aktifse bilgi bandı */}
      {secilenFirma && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}
        >
          <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
            style={{ background: 'rgba(99,102,241,0.12)' }}>
            <i className="ri-filter-3-line text-xs" style={{ color: '#818CF8' }} />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[12px] font-semibold" style={{ color: '#818CF8' }}>Firma Filtresi Aktif: </span>
            <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
              Sadece <strong>{secilenFirma.ad}</strong> firmasına ait veriler gösteriliyor.
              {secilenFirma.tehlikeSinifi && (
                <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8' }}>
                  {secilenFirma.tehlikeSinifi}
                </span>
              )}
            </span>
          </div>
          <button
            onClick={() => setSelectedFirmaId('all')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-all"
            style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)' }}
          >
            <i className="ri-close-line text-xs" />
            Filtreyi Kaldır
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-4 gap-3">
        {kpiCards.map((card, i) => (
          <AnimatedKPICard key={card.label} {...card} delay={i * 60} />
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="overflow-x-auto">
        <div className="flex items-center gap-1 p-1 rounded-xl min-w-max sm:min-w-0 sm:flex-wrap"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-[12.5px] font-semibold transition-all duration-200 whitespace-nowrap cursor-pointer"
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
      </div>

      {/* GENEL BAKIŞ */}
      {activeTab === 'genel' && (
        <div className="space-y-5">
          {/* Trend + Health Score */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
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
                    {(() => {
                      const sorunlar = [];
                      const evrakSorun = evrakStats.eksik + evrakStats.sureDolmus;
                      const uygunsuzlukAcik = aktifUygunsuzluklar.filter(u => u.durum !== 'Kapandı').length;
                      const ekipmanSorun = aktifEkipmanlar.filter(e => e.durum === 'Uygun Değil' || (e.sonrakiKontrolTarihi && new Date(e.sonrakiKontrolTarihi) < new Date())).length;
                      const saglikSorun = saglikStats.gecmis;
                      if (evrakSorun > 0) sorunlar.push(`${evrakSorun} sorunlu evrak`);
                      if (uygunsuzlukAcik > 0) sorunlar.push(`${uygunsuzlukAcik} açık uygunsuzluk`);
                      if (ekipmanSorun > 0) sorunlar.push(`${ekipmanSorun} sorunlu ekipman`);
                      if (saglikSorun > 0) sorunlar.push(`${saglikSorun} gecikmiş sağlık`);
                      return sorunlar.length > 0 ? sorunlar.join(' · ') : 'Sorun tespit edilmedi';
                    })()}
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
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
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3">
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
                {goruntulenenFirmalar.length}
              </span>
            </div>
            {goruntulenenFirmalar.length === 0 ? (
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
                    {goruntulenenFirmalar.map(firma => {
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
        <div className="space-y-4 sm:space-y-5">
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
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
        <div className="space-y-4 sm:space-y-5">
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
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
          {/* KPI Kartları */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Toplam Eğitim', value: egitimKatilimStats.toplamEgitim, color: '#6366F1', icon: 'ri-graduation-cap-line', sub: `${egitimKatilimStats.egitimSayisiKatilimciVar} eğitimde katılımcı var` },
              { label: 'Toplam Katılımcı', value: egitimKatilimStats.toplamKatilimci, color: '#10B981', icon: 'ri-team-line', sub: 'Tüm eğitimlerde' },
              { label: 'Katıldı', value: egitimKatilimStats.toplamKatildi, color: '#34D399', icon: 'ri-checkbox-circle-line', sub: `%${egitimKatilimStats.katilimOrani} katılım oranı` },
              { label: 'Katılmadı', value: egitimKatilimStats.toplamKatilmadi, color: '#F59E0B', icon: 'ri-close-circle-line', sub: 'Devamsız personel' },
            ].map((item, i) => (
              <AnimatedKPICard key={item.label} {...item} trend={undefined} delay={i * 80} />
            ))}
          </div>

          {/* Katılım Oranı Göstergesi */}
          <GlassCard>
            <SectionHeader title="Genel Katılım Oranı" subtitle="Tüm eğitimlerdeki toplam katılım performansı" icon="ri-bar-chart-grouped-line" color="#6366F1" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
              {/* Büyük oran göstergesi */}
              <div className="flex flex-col items-center justify-center py-4">
                <div className="relative w-36 h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart cx="50%" cy="50%" innerRadius="65%" outerRadius="90%" startAngle={225} endAngle={-45}
                      data={[{ value: egitimKatilimStats.katilimOrani, fill: egitimKatilimStats.katilimOrani >= 80 ? '#10B981' : egitimKatilimStats.katilimOrani >= 60 ? '#F59E0B' : '#EF4444' }]}>
                      <RadialBar dataKey="value" cornerRadius={8} background={{ fill: 'rgba(255,255,255,0.04)' }}
                        fill={egitimKatilimStats.katilimOrani >= 80 ? '#10B981' : egitimKatilimStats.katilimOrani >= 60 ? '#F59E0B' : '#EF4444'} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black" style={{
                      color: egitimKatilimStats.katilimOrani >= 80 ? '#10B981' : egitimKatilimStats.katilimOrani >= 60 ? '#F59E0B' : '#EF4444',
                      letterSpacing: '-0.04em',
                    }}>
                      %{egitimKatilimStats.katilimOrani}
                    </span>
                    <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>katılım</span>
                  </div>
                </div>
                <span className="mt-2 text-xs font-bold px-3 py-1 rounded-full" style={{
                  background: egitimKatilimStats.katilimOrani >= 80 ? 'rgba(16,185,129,0.12)' : egitimKatilimStats.katilimOrani >= 60 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
                  color: egitimKatilimStats.katilimOrani >= 80 ? '#10B981' : egitimKatilimStats.katilimOrani >= 60 ? '#F59E0B' : '#EF4444',
                }}>
                  {egitimKatilimStats.katilimOrani >= 80 ? 'İyi' : egitimKatilimStats.katilimOrani >= 60 ? 'Orta' : 'Düşük'}
                </span>
              </div>

              {/* Progress barlar */}
              <div className="lg:col-span-2 space-y-4">
                <AnimatedProgressBar label="Katılan Personel" value={egitimKatilimStats.toplamKatildi} total={egitimKatilimStats.toplamKatilimci} color="#10B981" delay={0} />
                <AnimatedProgressBar label="Katılmayan Personel" value={egitimKatilimStats.toplamKatilmadi} total={egitimKatilimStats.toplamKatilimci} color="#F59E0B" delay={100} />
                <div className="pt-3 grid grid-cols-3 gap-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  {[
                    { label: 'Toplam Eğitim', value: egitimKatilimStats.toplamEgitim, color: '#6366F1' },
                    { label: 'Toplam Katılımcı', value: egitimKatilimStats.toplamKatilimci, color: '#10B981' },
                    { label: 'Ort. Katılımcı/Eğitim', value: egitimKatilimStats.egitimSayisiKatilimciVar > 0 ? Math.round(egitimKatilimStats.toplamKatilimci / egitimKatilimStats.egitimSayisiKatilimciVar) : 0, color: '#F59E0B' },
                  ].map(s => (
                    <div key={s.label} className="text-center rounded-xl p-3" style={{ background: `${s.color}08`, border: `1px solid ${s.color}15` }}>
                      <p className="text-2xl font-black" style={{ color: s.color, letterSpacing: '-0.04em' }}>{s.value}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Aylık Katılım Trendi */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <GlassCard>
              <SectionHeader title="Aylık Katılım Trendi" subtitle="Son 12 ayda katılan ve katılmayan personel sayısı" icon="ri-bar-chart-line" color="#6366F1" />
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={egitimAylikKatilim} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="ay" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingTop: 10, color: '#94A3B8' }} />
                  <Bar dataKey="Katıldı" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Katılmadı" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </GlassCard>

            <GlassCard>
              <SectionHeader title="Aylık Eğitim Sayısı" subtitle="Son 12 ayda düzenlenen eğitim sayısı" icon="ri-line-chart-line" color="#6366F1" />
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={egitimAylikKatilim} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gEgitim" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="ay" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="Eğitim Sayısı" stroke="#6366F1" strokeWidth={2} fill="url(#gEgitim)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </GlassCard>
          </div>

          {/* Firma Bazlı Eğitim Dağılımı */}
          {egitimFirmaDagilim.length > 0 && (
            <GlassCard className="!p-0 overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-2.5" style={{ borderBottom: '1px solid var(--border-main)' }}>
                <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(99,102,241,0.12)' }}>
                  <i className="ri-building-2-line text-xs" style={{ color: '#6366F1' }} />
                </div>
                <h3 className="text-[13.5px] font-bold" style={{ color: 'var(--text-primary)' }}>Firma Bazlı Eğitim Özeti</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366F1' }}>
                  {egitimFirmaDagilim.length} firma
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="table-premium w-full">
                  <thead>
                    <tr>
                      <th className="text-left">Firma</th>
                      <th className="text-center">Eğitim Sayısı</th>
                      <th className="text-center">Toplam Katılımcı</th>
                      <th className="text-center">Katıldı</th>
                      <th className="text-center">Katılmadı</th>
                      <th className="text-center">Katılım Oranı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {egitimFirmaDagilim.map(firma => {
                      const oran = firma.toplamKatilimci > 0 ? Math.round((firma.toplamKatildi / firma.toplamKatilimci) * 100) : 0;
                      const oranColor = oran >= 80 ? '#10B981' : oran >= 60 ? '#F59E0B' : '#EF4444';
                      return (
                        <tr key={firma.firmaAd}>
                          <td>
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0 text-[10px] font-bold text-white"
                                style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)' }}>
                                {firma.firmaAd.charAt(0)}
                              </div>
                              <span className="text-[12.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>{firma.firmaAd}</span>
                            </div>
                          </td>
                          <td className="text-center">
                            <span className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{firma.egitimSayisi}</span>
                          </td>
                          <td className="text-center">
                            <span className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{firma.toplamKatilimci}</span>
                          </td>
                          <td className="text-center">
                            <span className="text-[13px] font-bold" style={{ color: '#10B981' }}>{firma.toplamKatildi}</span>
                          </td>
                          <td className="text-center">
                            <span className="text-[13px] font-bold" style={{ color: firma.toplamKatilmadi > 0 ? '#F59E0B' : 'var(--text-muted)' }}>{firma.toplamKatilmadi}</span>
                          </td>
                          <td className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-item)' }}>
                                <div className="h-full rounded-full" style={{ width: `${oran}%`, background: oranColor }} />
                              </div>
                              <span className="text-[11px] font-bold whitespace-nowrap" style={{ color: oranColor }}>%{oran}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )}

          {/* Son Eğitimler Listesi */}
          {aktifEgitimler.length > 0 && (
            <GlassCard className="!p-0 overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-2.5" style={{ borderBottom: '1px solid var(--border-main)' }}>
                <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(99,102,241,0.12)' }}>
                  <i className="ri-graduation-cap-line text-xs" style={{ color: '#6366F1' }} />
                </div>
                <h3 className="text-[13.5px] font-bold" style={{ color: 'var(--text-primary)' }}>Eğitim Listesi</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366F1' }}>
                  {aktifEgitimler.length}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="table-premium w-full">
                  <thead>
                    <tr>
                      <th className="text-left">Eğitim Adı</th>
                      <th className="text-left hidden md:table-cell">Firma</th>
                      <th className="text-left hidden lg:table-cell">Eğitmen</th>
                      <th className="text-center">Tarih</th>
                      <th className="text-center">Katılımcı</th>
                      <th className="text-center">Katıldı</th>
                      <th className="text-center">Oran</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aktifEgitimler
                      .sort((a, b) => new Date(b.tarih || b.olusturmaTarihi).getTime() - new Date(a.tarih || a.olusturmaTarihi).getTime())
                      .slice(0, 20)
                      .map(e => {
                        const firma = aktifFirmalar.find(f => f.id === e.firmaId);
                        const katilimcilar = e.katilimcilar ?? (e.katilimciIds ?? []).map(id => ({ personelId: id, katildi: true }));
                        const katildi = katilimcilar.filter(k => k.katildi).length;
                        const oran = katilimcilar.length > 0 ? Math.round((katildi / katilimcilar.length) * 100) : null;
                        const oranColor = oran === null ? 'var(--text-muted)' : oran >= 80 ? '#10B981' : oran >= 60 ? '#F59E0B' : '#EF4444';
                        return (
                          <tr key={e.id}>
                            <td>
                              <p className="text-[12.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>{e.ad}</p>
                              {e.aciklama && <p className="text-[10.5px] truncate max-w-[200px]" style={{ color: 'var(--text-muted)' }}>{e.aciklama}</p>}
                            </td>
                            <td className="hidden md:table-cell">
                              <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{firma?.ad || '—'}</span>
                            </td>
                            <td className="hidden lg:table-cell">
                              <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{e.egitmen || '—'}</span>
                            </td>
                            <td className="text-center">
                              <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                                {e.tarih ? new Date(e.tarih).toLocaleDateString('tr-TR') : '—'}
                              </span>
                            </td>
                            <td className="text-center">
                              <span className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{katilimcilar.length}</span>
                            </td>
                            <td className="text-center">
                              <span className="text-[13px] font-bold" style={{ color: katildi > 0 ? '#10B981' : 'var(--text-muted)' }}>{katildi}</span>
                            </td>
                            <td className="text-center">
                              {oran !== null ? (
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{
                                  background: `${oranColor}15`,
                                  color: oranColor,
                                }}>
                                  %{oran}
                                </span>
                              ) : (
                                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )}

          {aktifEgitimler.length === 0 && (
            <GlassCard>
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-16 h-16 flex items-center justify-center rounded-2xl" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <i className="ri-graduation-cap-line text-3xl" style={{ color: '#6366F1' }} />
                </div>
                <p className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>Henüz eğitim kaydı yok</p>
                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Eğitim modülünden kayıt ekleyebilirsiniz</p>
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {/* SAĞLIK TAKİBİ */}
      {activeTab === 'saglik' && (
        <div className="space-y-5">
          {/* KPI */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Toplam Kayıt',    value: saglikStats.toplam,   color: '#EC4899', icon: 'ri-heart-pulse-line',    sub: 'Tüm muayeneler' },
              { label: 'Güncel',          value: saglikStats.guncel,   color: '#10B981', icon: 'ri-checkbox-circle-line', sub: '30+ gün kaldı' },
              { label: 'Yaklaşıyor',      value: saglikStats.yaklasan, color: '#F59E0B', icon: 'ri-time-line',            sub: '0–30 gün kaldı' },
              { label: 'Süresi Geçmiş',   value: saglikStats.gecmis,   color: '#EF4444', icon: 'ri-alarm-warning-line',   sub: 'Yenilenmeli' },
            ].map((item, i) => (
              <AnimatedKPICard key={item.label} {...item} trend={undefined} delay={i * 80} />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Aylık trend */}
            <GlassCard>
              <SectionHeader title="Aylık Muayene Trendi" subtitle="Son 12 ayda yapılan muayeneler" icon="ri-bar-chart-line" color="#EC4899" />
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={saglikTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="ay" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Muayene" fill="#EC4899" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </GlassCard>

            {/* Durum dağılımı */}
            <GlassCard>
              <SectionHeader title="Muayene Durum Dağılımı" subtitle="Sonraki muayene tarihine göre durum analizi" icon="ri-pie-chart-line" color="#EC4899" />
              {saglikDurumData.length === 0 ? (
                <div className="flex items-center justify-center h-40">
                  <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Henüz muayene kaydı yok</p>
                </div>
              ) : (
                <DonutChart data={saglikDurumData} size={160} />
              )}
            </GlassCard>
          </div>

          {/* Durum analizi progress */}
          <GlassCard>
            <SectionHeader title="Sağlık Takibi Analizi" subtitle="Tüm kayıtların durum bazlı dağılımı" icon="ri-bar-chart-grouped-line" color="#EC4899" />
            <div className="space-y-4">
              <AnimatedProgressBar label="Güncel (30+ gün)" value={saglikStats.guncel} total={saglikStats.toplam} color="#10B981" delay={0} />
              <AnimatedProgressBar label="Yaklaşıyor (0–30 gün)" value={saglikStats.yaklasan} total={saglikStats.toplam} color="#F59E0B" delay={100} />
              <AnimatedProgressBar label="Süresi Geçmiş" value={saglikStats.gecmis} total={saglikStats.toplam} color="#EF4444" delay={200} />
            </div>
            <div className="mt-5 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Toplam Kayıt</span>
              <span className="text-[15px] font-black" style={{ color: 'var(--text-primary)' }}>{saglikStats.toplam}</span>
            </div>
          </GlassCard>

          {/* Yaklaşan / Geçmiş tablo */}
          {(saglikStats.yaklasan > 0 || saglikStats.gecmis > 0) && (
            <GlassCard className="!p-0 overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-2.5" style={{ borderBottom: '1px solid var(--border-main)' }}>
                <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(239,68,68,0.12)' }}>
                  <i className="ri-alarm-warning-line text-xs" style={{ color: '#EF4444' }} />
                </div>
                <h3 className="text-[13.5px] font-bold" style={{ color: 'var(--text-primary)' }}>Dikkat Gerektiren Kayıtlar</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                  {saglikStats.yaklasan + saglikStats.gecmis}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="table-premium w-full">
                  <thead>
                    <tr>
                      <th className="text-left">Personel</th>
                      <th className="text-left hidden md:table-cell">Firma</th>
                      <th className="text-left">Muayene Tarihi</th>
                      <th className="text-left">Sonraki Muayene</th>
                      <th className="text-left">Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aktifMuayeneler
                      .filter(m => getDaysUntil(m.sonrakiTarih) <= 30)
                      .sort((a, b) => getDaysUntil(a.sonrakiTarih) - getDaysUntil(b.sonrakiTarih))
                      .slice(0, 20)
                      .map(m => {
                        const p = personeller.find(x => x.id === m.personelId);
                        const f = aktifFirmalar.find(x => x.id === p?.firmaId);
                        const days = getDaysUntil(m.sonrakiTarih);
                        const color = days < 0 ? '#EF4444' : '#F59E0B';
                        const label = days < 0 ? `${Math.abs(days)}g geçti` : `${days}g kaldı`;
                        const icon = days < 0 ? 'ri-alarm-warning-line' : 'ri-time-line';
                        return (
                          <tr key={m.id}>
                            <td>
                              <p className="text-[12.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>{p?.adSoyad || '—'}</p>
                              {p?.gorev && <p className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>{p.gorev}</p>}
                            </td>
                            <td className="hidden md:table-cell">
                              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{f?.ad || '—'}</span>
                            </td>
                            <td>
                              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                {m.muayeneTarihi ? new Date(m.muayeneTarihi).toLocaleDateString('tr-TR') : '—'}
                              </span>
                            </td>
                            <td>
                              <span className="text-sm font-medium" style={{ color }}>
                                {m.sonrakiTarih ? new Date(m.sonrakiTarih).toLocaleDateString('tr-TR') : '—'}
                              </span>
                            </td>
                            <td>
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap"
                                style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}>
                                <i className={`${icon} text-xs`} />{label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )}
        </div>
      )}
    </div>
  );
}
