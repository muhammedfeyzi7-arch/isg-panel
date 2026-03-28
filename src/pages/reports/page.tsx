import { useMemo } from 'react';
import { useApp } from '../../store/AppContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';

const COLORS = ['#10B981', '#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6'];

export default function RaporlarPage() {
  const { firmalar, personeller, evraklar, egitimler, muayeneler, uygunsuzluklar, theme } = useApp();

  const isDark = theme === 'dark';

  const tooltipStyle = {
    background: isDark ? 'rgba(10,15,25,0.97)' : 'rgba(255,255,255,0.99)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.12)'}`,
    borderRadius: '12px',
    color: isDark ? '#E2E8F0' : '#0F172A',
    boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
  };

  const cardStyle = {
    background: isDark ? 'rgba(15,24,40,0.7)' : 'rgba(255,255,255,0.92)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.1)'}`,
  };

  const primaryText = isDark ? '#E2E8F0' : '#0F172A';
  const mutedText = isDark ? '#475569' : '#64748B';
  const gridColor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.06)';
  const axisColor = isDark ? '#334155' : '#CBD5E1';
  const tickColor = isDark ? '#475569' : '#64748B';

  const firmaStats = useMemo(() => firmalar.slice(0, 8).map(f => ({
    ad: f.ad.length > 14 ? f.ad.substring(0, 14) + '..' : f.ad,
    personel: personeller.filter(p => p.firmaId === f.id).length,
    evrak: evraklar.filter(e => e.firmaId === f.id).length,
  })), [firmalar, personeller, evraklar]);

  const evrakDurum = useMemo(() => [
    { name: 'Yüklü', value: evraklar.filter(e => e.durum === 'Yüklü').length },
    { name: 'Eksik', value: evraklar.filter(e => e.durum === 'Eksik').length },
    { name: 'Süre Yaklaşıyor', value: evraklar.filter(e => e.durum === 'Süre Yaklaşıyor').length },
    { name: 'Süre Dolmuş', value: evraklar.filter(e => e.durum === 'Süre Dolmuş').length },
  ].filter(d => d.value > 0), [evraklar]);

  const uygunsuzlukDurum = useMemo(() => [
    { name: 'Açık', value: uygunsuzluklar.filter(u => u.durum === 'Açık').length },
    { name: 'İncelemede', value: uygunsuzluklar.filter(u => u.durum === 'İncelemede').length },
    { name: 'Kapatıldı', value: uygunsuzluklar.filter(u => u.durum === 'Kapatıldı').length },
  ].filter(d => d.value > 0), [uygunsuzluklar]);

  const monthlyData = useMemo(() => {
    const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    return months.map((ay, idx) => ({
      ay,
      egitim: egitimler.filter(e => new Date(e.olusturmaTarihi).getMonth() === idx).length,
      evrak: evraklar.filter(e => new Date(e.olusturmaTarihi).getMonth() === idx).length,
    }));
  }, [egitimler, evraklar]);

  const handleExcelExport = () => {
    const rows = [
      ['Ad Soyad', 'TC', 'Firma', 'Görev', 'Departman', 'Telefon', 'E-posta', 'Durum', 'İşe Giriş'],
      ...personeller.map(p => [
        p.adSoyad, p.tc, firmalar.find(f => f.id === p.firmaId)?.ad || '',
        p.gorev, p.departman, p.telefon, p.email, p.durum,
        p.iseGirisTarihi ? new Date(p.iseGirisTarihi).toLocaleDateString('tr-TR') : '',
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ISG_Denetim_Personeller_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const summaryCards = [
    { label: 'Toplam Firma', value: firmalar.length, sub: `${firmalar.filter(f => f.durum === 'Aktif').length} aktif`, icon: 'ri-building-2-line', gradient: 'linear-gradient(135deg, #3B82F6, #6366F1)', shadow: '0 8px 20px rgba(99,102,241,0.35)' },
    { label: 'Toplam Personel', value: personeller.length, sub: `${personeller.filter(p => p.durum === 'Aktif').length} aktif`, icon: 'ri-team-line', gradient: 'linear-gradient(135deg, #10B981, #059669)', shadow: '0 8px 20px rgba(16,185,129,0.35)' },
    { label: 'Toplam Evrak', value: evraklar.length, sub: `${evraklar.filter(e => e.durum === 'Yüklü').length} yüklü`, icon: 'ri-file-list-3-line', gradient: 'linear-gradient(135deg, #F59E0B, #D97706)', shadow: '0 8px 20px rgba(245,158,11,0.35)' },
    { label: 'Toplam Eğitim', value: egitimler.length, sub: `${egitimler.filter(e => e.durum === 'Tamamlandı').length} tamamlandı`, icon: 'ri-graduation-cap-line', gradient: 'linear-gradient(135deg, #8B5CF6, #7C3AED)', shadow: '0 8px 20px rgba(139,92,246,0.35)' },
    { label: 'Sağlık Muayenesi', value: muayeneler.length, sub: `${muayeneler.filter(m => m.sonuc === 'Çalışabilir').length} çalışabilir`, icon: 'ri-heart-pulse-line', gradient: 'linear-gradient(135deg, #EF4444, #DC2626)', shadow: '0 8px 20px rgba(239,68,68,0.35)' },
    { label: 'Uygunsuzluk', value: uygunsuzluklar.length, sub: `${uygunsuzluklar.filter(u => u.durum === 'Açık').length} açık`, icon: 'ri-alert-line', gradient: 'linear-gradient(135deg, #F97316, #EA580C)', shadow: '0 8px 20px rgba(249,115,22,0.35)' },
  ];

  const ChartCard = ({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) => (
    <div className="rounded-2xl p-5" style={cardStyle}>
      <div className="mb-5">
        <h3 className="text-sm font-bold" style={{ color: primaryText }}>{title}</h3>
        {sub && <p className="text-xs mt-0.5" style={{ color: mutedText }}>{sub}</p>}
      </div>
      {children}
    </div>
  );

  const EmptyChart = () => (
    <div className="h-52 flex flex-col items-center justify-center gap-3">
      <i className="ri-bar-chart-line text-4xl" style={{ color: isDark ? '#1E293B' : '#CBD5E1' }} />
      <p className="text-sm" style={{ color: mutedText }}>Yeterli veri yok</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: primaryText }}>Raporlar &amp; Analiz</h1>
          <p className="text-sm mt-1" style={{ color: mutedText }}>Sistem geneli istatistikler ve raporlar</p>
        </div>
        <button
          onClick={handleExcelExport}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 cursor-pointer whitespace-nowrap hover:scale-105 hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(135deg, #10B981, #059669)', boxShadow: '0 8px 20px rgba(16,185,129,0.35)', border: '1px solid rgba(16,185,129,0.3)' }}
        >
          <i className="ri-file-excel-2-line text-base" />
          Excel İndir (Personeller)
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {summaryCards.map(c => (
          <div key={c.label} className="rounded-2xl p-4 text-center transition-all duration-200 hover:scale-[1.03]" style={cardStyle}>
            <div className="w-8 h-8 flex items-center justify-center rounded-xl mx-auto mb-3" style={{ background: c.gradient, boxShadow: c.shadow }}>
              <i className={`${c.icon} text-white text-sm`} />
            </div>
            <p className="text-2xl font-extrabold" style={{ color: primaryText }}>{c.value}</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: mutedText }}>{c.label}</p>
            <p className="text-[10px] mt-0.5" style={{ color: isDark ? '#475569' : '#94A3B8' }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Firma Bazlı Personel Dağılımı" sub="Her firmadaki personel sayısı">
          {firmaStats.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={firmaStats} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                <XAxis type="number" stroke={axisColor} tick={{ fontSize: 11, fill: tickColor }} allowDecimals={false} />
                <YAxis dataKey="ad" type="category" stroke={axisColor} tick={{ fontSize: 11, fill: tickColor }} width={90} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="personel" name="Personel" fill="#3B82F6" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Evrak Durum Analizi" sub="Evrakların güncel durum dağılımı">
          {evrakDurum.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={evrakDurum} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" paddingAngle={4} strokeWidth={0}>
                  {evrakDurum.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11, color: tickColor }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Aylık Kayıt Trendi" sub="Aylık eklenen eğitim ve evrak sayıları">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="gradEgitim" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.3} /><stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradEvrak" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} /><stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="ay" stroke={axisColor} tick={{ fontSize: 11, fill: tickColor }} />
              <YAxis stroke={axisColor} tick={{ fontSize: 11, fill: tickColor }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="egitim" stroke="#F59E0B" fill="url(#gradEgitim)" strokeWidth={2} name="Eğitim" dot={false} />
              <Area type="monotone" dataKey="evrak" stroke="#3B82F6" fill="url(#gradEvrak)" strokeWidth={2} name="Evrak" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Uygunsuzluk Dağılımı" sub="Uygunsuzlukların durum dağılımı">
          {uygunsuzlukDurum.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={uygunsuzlukDurum} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" paddingAngle={4} strokeWidth={0}>
                  {uygunsuzlukDurum.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11, color: tickColor }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Tehlike Sınıfı */}
      <div className="rounded-2xl p-5" style={cardStyle}>
        <div className="mb-5">
          <h3 className="text-sm font-bold" style={{ color: primaryText }}>Tehlike Sınıfı Dağılımı</h3>
          <p className="text-xs mt-0.5" style={{ color: mutedText }}>Firmaların tehlike sınıfına göre dağılımı</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {(['Az Tehlikeli', 'Tehlikeli', 'Çok Tehlikeli'] as const).map((s, i) => {
            const count = firmalar.filter(f => f.tehlikeSinifi === s).length;
            const pct = firmalar.length ? Math.round((count / firmalar.length) * 100) : 0;
            const colors = ['#10B981', '#F59E0B', '#EF4444'];
            const bgs = ['rgba(16,185,129,0.1)', 'rgba(245,158,11,0.1)', 'rgba(239,68,68,0.1)'];
            const borders = ['rgba(16,185,129,0.2)', 'rgba(245,158,11,0.2)', 'rgba(239,68,68,0.2)'];
            return (
              <div key={s} className="rounded-xl p-4" style={{ background: bgs[i], border: `1px solid ${borders[i]}` }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold" style={{ color: primaryText }}>{s}</p>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${colors[i]}20`, color: colors[i] }}>%{pct}</span>
                </div>
                <p className="text-3xl font-extrabold mb-3" style={{ color: colors[i] }}>{count}</p>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: colors[i] }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
