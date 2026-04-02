import { useMemo, useState } from 'react';
import { useApp } from '../../store/AppContext';
import Badge, { getFirmaStatusColor, getTehlikeColor } from '../../components/base/Badge';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

// ── Helpers ──────────────────────────────────────────────────────────────────
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

// ── Custom Tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3.5 py-2.5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)', minWidth: 120 }}>
      <p className="text-[11px] font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-[11px]">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span style={{ color: 'var(--text-secondary)' }}>{p.name}:</span>
          <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color, sub, trend }: {
  label: string; value: number; icon: string; color: string; sub: string; trend?: number;
}) {
  return (
    <div className="isg-card rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: `${color}15` }}>
          <i className={`${icon} text-base`} style={{ color }} />
        </div>
        {trend !== undefined && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{
            background: trend >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            color: trend >= 0 ? '#34D399' : '#F87171',
          }}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <p className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>{value}</p>
      <p className="text-[11px] font-semibold mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-[10.5px] mt-1" style={{ color }}>{sub}</p>
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle, icon }: { title: string; subtitle?: string; icon: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(99,102,241,0.1)' }}>
        <i className={`${icon} text-sm`} style={{ color: '#818CF8' }} />
      </div>
      <div>
        <h3 className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        {subtitle && <p className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
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

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const in30 = new Date(today.getTime() + 30 * 86400000);

  // ── Aylık Trend Verisi ──────────────────────────────────────────────────────
  const monthlyTrend = useMemo(() => months.map(m => {
    const firmaCount = aktifFirmalar.filter(f => getMonthKey(f.olusturmaTarihi) === m.key).length;
    const personelCount = aktifPersoneller.filter(p => getMonthKey(p.olusturmaTarihi) === m.key).length;
    const evrakCount = aktifEvraklar.filter(e => getMonthKey(e.olusturmaTarihi) === m.key).length;
    const egitimCount = aktifEgitimler.filter(e => getMonthKey(e.olusturmaTarihi) === m.key).length;
    return { ay: m.label, Firma: firmaCount, Personel: personelCount, Evrak: evrakCount, Eğitim: egitimCount };
  }), [months, aktifFirmalar, aktifPersoneller, aktifEvraklar, aktifEgitimler]);

  // ── Evrak Tamamlanma Oranı (aylık) ─────────────────────────────────────────
  const evrakTamamlanma = useMemo(() => months.map(m => {
    const ayEvraklar = aktifEvraklar.filter(e => getMonthKey(e.olusturmaTarihi) === m.key);
    const total = ayEvraklar.length;
    const yuklu = ayEvraklar.filter(e => e.durum === 'Yüklü').length;
    const oran = total > 0 ? Math.round((yuklu / total) * 100) : 0;
    return { ay: m.label, Tamamlanma: oran, Eksik: 100 - oran };
  }), [months, aktifEvraklar]);

  // ── Tehlike Sınıfı Dağılımı ─────────────────────────────────────────────────
  const tehlikeDagilim = useMemo(() => {
    const az = aktifFirmalar.filter(f => f.tehlikeSinifi === 'Az Tehlikeli').length;
    const teh = aktifFirmalar.filter(f => f.tehlikeSinifi === 'Tehlikeli').length;
    const cok = aktifFirmalar.filter(f => f.tehlikeSinifi === 'Çok Tehlikeli').length;
    return [
      { name: 'Az Tehlikeli', value: az, color: '#10B981' },
      { name: 'Tehlikeli', value: teh, color: '#F59E0B' },
      { name: 'Çok Tehlikeli', value: cok, color: '#EF4444' },
    ].filter(d => d.value > 0);
  }, [aktifFirmalar]);

  // ── Uygunsuzluk Aylık ──────────────────────────────────────────────────────
  const uygunsuzlukTrend = useMemo(() => months.map(m => {
    const acik = aktifUygunsuzluklar.filter(u => getMonthKey(u.olusturmaTarihi) === m.key && u.durum === 'Açık').length;
    const kapandi = aktifUygunsuzluklar.filter(u => getMonthKey(u.olusturmaTarihi) === m.key && u.durum === 'Kapandı').length;
    return { ay: m.label, Açık: acik, Kapandı: kapandi };
  }), [months, aktifUygunsuzluklar]);

  // ── Departman Dağılımı ──────────────────────────────────────────────────────
  const departmanDagilim = useMemo(() => {
    const map = new Map<string, number>();
    aktifPersoneller.forEach(p => {
      const dep = p.departman || 'Belirtilmemiş';
      map.set(dep, (map.get(dep) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [aktifPersoneller]);

  // ── Evrak Durum Özeti ───────────────────────────────────────────────────────
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

  // ── Eğitim Durum Dağılımı ───────────────────────────────────────────────────
  const egitimDurum = useMemo(() => [
    { name: 'Tamamlandı', value: aktifEgitimler.filter(e => e.durum === 'Tamamlandı').length, color: '#10B981' },
    { name: 'Planlandı', value: aktifEgitimler.filter(e => e.durum === 'Planlandı').length, color: '#3B82F6' },
    { name: 'İptal', value: aktifEgitimler.filter(e => e.durum === 'İptal').length, color: '#EF4444' },
  ].filter(d => d.value > 0), [aktifEgitimler]);

  const summaryCards = [
    { label: 'Toplam Firma', value: aktifFirmalar.length, icon: 'ri-building-2-line', color: '#3B82F6', sub: `${aktifFirmalar.filter(f => f.durum === 'Aktif').length} aktif`, trend: 0 },
    { label: 'Toplam Personel', value: aktifPersoneller.length, icon: 'ri-team-line', color: '#10B981', sub: `${aktifPersoneller.filter(p => p.durum === 'Aktif').length} aktif`, trend: 0 },
    { label: 'Toplam Evrak', value: aktifEvraklar.length, icon: 'ri-file-list-3-line', color: '#F59E0B', sub: `${evrakStats.eksik + evrakStats.sureDolmus} sorunlu`, trend: undefined },
    { label: 'Eğitim Kayıtları', value: aktifEgitimler.length, icon: 'ri-graduation-cap-line', color: '#6366F1', sub: `${aktifEgitimler.filter(e => e.durum === 'Tamamlandı').length} tamamlandı`, trend: undefined },
    { label: 'Açık Uygunsuzluk', value: uygunsuzlukStats.acik, icon: 'ri-alert-line', color: uygunsuzlukStats.acik > 0 ? '#EF4444' : '#10B981', sub: `${uygunsuzlukStats.kapandi} kapatıldı`, trend: undefined },
    { label: 'Muayene Kayıtları', value: aktifMuayeneler.length, icon: 'ri-heart-pulse-line', color: '#EC4899', sub: `${aktifMuayeneler.filter(m => m.sonuc === 'Uygun').length} uygun`, trend: undefined },
    { label: 'Görevler', value: aktifGorevler.length, icon: 'ri-task-line', color: '#8B5CF6', sub: `${aktifGorevler.filter(g => g.durum === 'Tamamlandı').length} tamamlandı`, trend: undefined },
    { label: 'Tutanaklar', value: tutanaklar.length, icon: 'ri-article-line', color: '#F97316', sub: `${tutanaklar.filter(t => t.durum === 'Onaylandı').length} onaylı`, trend: undefined },
  ];

  const DEPT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

  const tabs = [
    { id: 'genel', label: 'Genel Bakış', icon: 'ri-dashboard-line' },
    { id: 'evrak', label: 'Evrak Analizi', icon: 'ri-file-chart-line' },
    { id: 'uygunsuzluk', label: 'Uygunsuzluklar', icon: 'ri-alert-line' },
    { id: 'egitim', label: 'Eğitimler', icon: 'ri-graduation-cap-line' },
  ] as const;

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Raporlar &amp; Analiz</h1>
          <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>Sistemdeki tüm verilerin özet analizi ve grafikleri</p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <i className="ri-time-line text-xs" />
          Son güncelleme: {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {summaryCards.map(card => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      {/* ── Tab Navigation ── */}
      <div className="flex items-center gap-1 p-1 rounded-xl isg-card w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-semibold transition-all duration-200 whitespace-nowrap cursor-pointer"
            style={{
              background: activeTab === tab.id ? 'rgba(99,102,241,0.15)' : 'transparent',
              color: activeTab === tab.id ? '#818CF8' : 'var(--text-muted)',
              border: activeTab === tab.id ? '1px solid rgba(99,102,241,0.25)' : '1px solid transparent',
            }}
          >
            <i className={`${tab.icon} text-xs`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── GENEL BAKIŞ ── */}
      {activeTab === 'genel' && (
        <div className="space-y-4">
          {/* Aylık Kayıt Trendi */}
          <div className="isg-card rounded-xl p-5">
            <SectionHeader title="Aylık Kayıt Trendi" subtitle="Son 12 ayda eklenen kayıtlar" icon="ri-line-chart-line" />
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={monthlyTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradPersonel" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradEvrak" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradFirma" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="ay" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Area type="monotone" dataKey="Personel" stroke="#10B981" strokeWidth={2} fill="url(#gradPersonel)" dot={false} />
                <Area type="monotone" dataKey="Evrak" stroke="#F59E0B" strokeWidth={2} fill="url(#gradEvrak)" dot={false} />
                <Area type="monotone" dataKey="Firma" stroke="#3B82F6" strokeWidth={2} fill="url(#gradFirma)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Tehlike Sınıfı Dağılımı */}
            <div className="isg-card rounded-xl p-5">
              <SectionHeader title="Tehlike Sınıfı Dağılımı" subtitle="Firmaların tehlike sınıflarına göre dağılımı" icon="ri-pie-chart-line" />
              {tehlikeDagilim.length === 0 ? (
                <div className="flex items-center justify-center h-40">
                  <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Henüz firma kaydı yok</p>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="55%" height={160}>
                    <PieChart>
                      <Pie data={tehlikeDagilim} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                        {tehlikeDagilim.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2.5">
                    {tehlikeDagilim.map(d => (
                      <div key={d.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                          <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
                        </div>
                        <span className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Departman Dağılımı */}
            <div className="isg-card rounded-xl p-5">
              <SectionHeader title="Departman Dağılımı" subtitle="Personellerin departmanlara göre dağılımı" icon="ri-organization-chart" />
              {departmanDagilim.length === 0 ? (
                <div className="flex items-center justify-center h-40">
                  <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Henüz personel kaydı yok</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={departmanDagilim} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Personel" radius={[0, 4, 4, 0]}>
                      {departmanDagilim.map((_, index) => (
                        <Cell key={index} fill={DEPT_COLORS[index % DEPT_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Firma Özet Tablosu */}
          <div className="isg-card rounded-xl overflow-hidden">
            <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-main)' }}>
              <div className="flex items-center gap-2">
                <i className="ri-building-2-line text-sm" style={{ color: '#818CF8' }} />
                <h3 className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>Firma Özet Listesi</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1" style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8' }}>
                  {aktifFirmalar.length}
                </span>
              </div>
            </div>
            {aktifFirmalar.length === 0 ? (
              <div className="py-10 text-center">
                <i className="ri-building-2-line text-2xl" style={{ color: 'var(--text-faint)' }} />
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
                      <th className="text-left hidden lg:table-cell">Personel</th>
                      <th className="text-left hidden lg:table-cell">Evrak</th>
                      <th className="text-left hidden lg:table-cell">Açık Uyg.</th>
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
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0 text-[10px] font-bold text-white"
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
                          <td>
                            <Badge label={firma.durum} color={getFirmaStatusColor(firma.durum)} />
                          </td>
                          <td className="hidden lg:table-cell">
                            <span className="text-[12.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>{firmaPersonel}</span>
                          </td>
                          <td className="hidden lg:table-cell">
                            <span className="text-[12.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>{firmaEvrak}</span>
                          </td>
                          <td className="hidden lg:table-cell">
                            <span className="text-[12.5px] font-semibold" style={{ color: firmaUyg > 0 ? '#EF4444' : 'var(--text-primary)' }}>{firmaUyg}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── EVRAK ANALİZİ ── */}
      {activeTab === 'evrak' && (
        <div className="space-y-4">
          {/* Evrak Durum Özeti */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Yüklü', value: evrakStats.yuklu, color: '#10B981', icon: 'ri-checkbox-circle-fill' },
              { label: 'Eksik', value: evrakStats.eksik, color: '#EF4444', icon: 'ri-close-circle-fill' },
              { label: 'Süre Dolmuş', value: evrakStats.sureDolmus, color: '#F97316', icon: 'ri-error-warning-fill' },
              { label: 'Süre Yaklaşıyor', value: evrakStats.sureYaklasiyor, color: '#F59E0B', icon: 'ri-time-fill' },
            ].map(item => (
              <div key={item.label} className="isg-card rounded-xl p-4 flex items-center gap-3">
                <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: `${item.color}15` }}>
                  <i className={`${item.icon} text-base`} style={{ color: item.color }} />
                </div>
                <div>
                  <p className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>{item.value}</p>
                  <p className="text-[10.5px] font-medium" style={{ color: item.color }}>{item.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Evrak Tamamlanma Oranı Trendi */}
          <div className="isg-card rounded-xl p-5">
            <SectionHeader title="Aylık Evrak Tamamlanma Oranı" subtitle="Son 12 ayda yüklenen evrakların tamamlanma yüzdesi" icon="ri-bar-chart-line" />
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={evrakTamamlanma} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="ay" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Bar dataKey="Tamamlanma" fill="#10B981" radius={[4, 4, 0, 0]} name="Tamamlanma %" />
                <Bar dataKey="Eksik" fill="#EF4444" radius={[4, 4, 0, 0]} name="Eksik %" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Evrak Durum Progress Bars */}
          <div className="isg-card rounded-xl p-5">
            <SectionHeader title="Evrak Durum Dağılımı" subtitle="Tüm evrakların durum bazlı dağılımı" icon="ri-pie-chart-line" />
            <div className="space-y-4">
              {[
                { label: 'Yüklü Evraklar', value: evrakStats.yuklu, total: aktifEvraklar.length, color: '#10B981' },
                { label: 'Eksik Evraklar', value: evrakStats.eksik, total: aktifEvraklar.length, color: '#EF4444' },
                { label: 'Süresi Dolmuş', value: evrakStats.sureDolmus, total: aktifEvraklar.length, color: '#F97316' },
                { label: 'Yaklaşan Süre (30g)', value: evrakStats.sureYaklasiyor, total: aktifEvraklar.length, color: '#F59E0B' },
              ].map(item => {
                const pct = item.total > 0 ? Math.round((item.value / item.total) * 100) : 0;
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold" style={{ color: item.color }}>{item.value} evrak</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: `${item.color}15`, color: item.color }}>%{pct}</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-item)' }}>
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: item.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── UYGUNSUZLUKLAR ── */}
      {activeTab === 'uygunsuzluk' && (
        <div className="space-y-4">
          {/* Özet Kartlar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Açık', value: uygunsuzlukStats.acik, color: '#EF4444', icon: 'ri-alert-fill' },
              { label: 'Kapandı', value: uygunsuzlukStats.kapandi, color: '#10B981', icon: 'ri-checkbox-circle-fill' },
              { label: 'Kritik Seviye', value: uygunsuzlukStats.kritik, color: '#DC2626', icon: 'ri-error-warning-fill' },
              { label: 'Yüksek Seviye', value: uygunsuzlukStats.yuksek, color: '#F97316', icon: 'ri-arrow-up-circle-fill' },
            ].map(item => (
              <div key={item.label} className="isg-card rounded-xl p-4 flex items-center gap-3">
                <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: `${item.color}15` }}>
                  <i className={`${item.icon} text-base`} style={{ color: item.color }} />
                </div>
                <div>
                  <p className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>{item.value}</p>
                  <p className="text-[10.5px] font-medium" style={{ color: item.color }}>{item.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Aylık Uygunsuzluk Trendi */}
          <div className="isg-card rounded-xl p-5">
            <SectionHeader title="Aylık Uygunsuzluk Trendi" subtitle="Son 12 ayda açılan ve kapatılan uygunsuzluklar" icon="ri-line-chart-line" />
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={uygunsuzlukTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="ay" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Bar dataKey="Açık" fill="#EF4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Kapandı" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Uygunsuzluk Durum Progress */}
          <div className="isg-card rounded-xl p-5">
            <SectionHeader title="Uygunsuzluk Analizi" subtitle="Durum ve seviye bazlı dağılım" icon="ri-pie-chart-line" />
            <div className="space-y-4">
              {[
                { label: 'Açık Uygunsuzluklar', value: uygunsuzlukStats.acik, color: '#EF4444' },
                { label: 'Kapatılan Uygunsuzluklar', value: uygunsuzlukStats.kapandi, color: '#10B981' },
                { label: 'Kritik Seviye', value: uygunsuzlukStats.kritik, color: '#DC2626' },
                { label: 'Yüksek Seviye', value: uygunsuzlukStats.yuksek, color: '#F97316' },
              ].map(item => {
                const total = aktifUygunsuzluklar.length;
                const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold" style={{ color: item.color }}>{item.value}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: `${item.color}15`, color: item.color }}>%{pct}</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-item)' }}>
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: item.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── EĞİTİMLER ── */}
      {activeTab === 'egitim' && (
        <div className="space-y-4">
          {/* Özet */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: 'Toplam Eğitim', value: aktifEgitimler.length, color: '#6366F1', icon: 'ri-graduation-cap-line' },
              { label: 'Tamamlandı', value: aktifEgitimler.filter(e => e.durum === 'Tamamlandı').length, color: '#10B981', icon: 'ri-checkbox-circle-fill' },
              { label: 'Planlandı', value: aktifEgitimler.filter(e => e.durum === 'Planlandı').length, color: '#3B82F6', icon: 'ri-calendar-check-line' },
            ].map(item => (
              <div key={item.label} className="isg-card rounded-xl p-4 flex items-center gap-3">
                <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: `${item.color}15` }}>
                  <i className={`${item.icon} text-base`} style={{ color: item.color }} />
                </div>
                <div>
                  <p className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>{item.value}</p>
                  <p className="text-[10.5px] font-medium" style={{ color: item.color }}>{item.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Eğitim Durum Pie */}
            <div className="isg-card rounded-xl p-5">
              <SectionHeader title="Eğitim Durum Dağılımı" subtitle="Eğitimlerin duruma göre dağılımı" icon="ri-pie-chart-line" />
              {egitimDurum.length === 0 ? (
                <div className="flex items-center justify-center h-40">
                  <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Henüz eğitim kaydı yok</p>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="55%" height={160}>
                    <PieChart>
                      <Pie data={egitimDurum} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                        {egitimDurum.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2.5">
                    {egitimDurum.map(d => (
                      <div key={d.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                          <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
                        </div>
                        <span className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Aylık Eğitim Trendi */}
            <div className="isg-card rounded-xl p-5">
              <SectionHeader title="Aylık Eğitim Trendi" subtitle="Son 12 ayda eklenen eğitimler" icon="ri-bar-chart-line" />
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={monthlyTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="ay" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Eğitim" fill="#6366F1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
