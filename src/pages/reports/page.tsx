import { useMemo, useState } from 'react';
import { useApp } from '../../store/AppContext';
import Badge, { getFirmaStatusColor, getTehlikeColor } from '../../components/base/Badge';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
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

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3.5 py-2.5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)', minWidth: 130 }}>
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

function KPICard({ label, value, icon, color, sub, trend }: {
  label: string; value: number; icon: string; color: string; sub: string; trend?: number;
}) {
  return (
    <div className="isg-card rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: color }} />
      <div className="flex items-start justify-between">
        <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: `${color}18` }}>
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
      <div>
        <p className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>{value}</p>
        <p className="text-[11px] font-semibold mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <p className="text-[10.5px] mt-1 font-medium" style={{ color }}>{sub}</p>
      </div>
    </div>
  );
}

function SectionTitle({ title, subtitle, icon, color = '#818CF8' }: { title: string; subtitle?: string; icon: string; color?: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: `${color}18` }}>
        <i className={`${icon} text-sm`} style={{ color }} />
      </div>
      <div>
        <h3 className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        {subtitle && <p className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
      </div>
    </div>
  );
}

function ProgressBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold" style={{ color }}>{value}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: `${color}15`, color }}>%{pct}</span>
        </div>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-item)' }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
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
    return { ay: m.label, 'Tamamlanma %': total > 0 ? Math.round((yuklu / total) * 100) : 0, 'Eksik %': total > 0 ? Math.round(((total - yuklu) / total) * 100) : 0 };
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

  const DEPT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

  const tabs = [
    { id: 'genel', label: 'Genel Bakış', icon: 'ri-dashboard-line' },
    { id: 'evrak', label: 'Evrak Analizi', icon: 'ri-file-chart-line' },
    { id: 'uygunsuzluk', label: 'Uygunsuzluklar', icon: 'ri-alert-line' },
    { id: 'egitim', label: 'Eğitimler', icon: 'ri-graduation-cap-line' },
  ] as const;

  const kpiCards = [
    { label: 'Toplam Firma', value: aktifFirmalar.length, icon: 'ri-building-2-line', color: '#3B82F6', sub: `${aktifFirmalar.filter(f => f.durum === 'Aktif').length} aktif`, trend: 0 },
    { label: 'Toplam Personel', value: aktifPersoneller.length, icon: 'ri-team-line', color: '#10B981', sub: `${aktifPersoneller.filter(p => p.durum === 'Aktif').length} aktif`, trend: 0 },
    { label: 'Toplam Evrak', value: aktifEvraklar.length, icon: 'ri-file-list-3-line', color: '#F59E0B', sub: `${evrakStats.eksik + evrakStats.sureDolmus} sorunlu` },
    { label: 'Eğitim Kayıtları', value: aktifEgitimler.length, icon: 'ri-graduation-cap-line', color: '#6366F1', sub: `${aktifEgitimler.filter(e => e.durum === 'Tamamlandı').length} tamamlandı` },
    { label: 'Açık Uygunsuzluk', value: uygunsuzlukStats.acik, icon: 'ri-alert-line', color: uygunsuzlukStats.acik > 0 ? '#EF4444' : '#10B981', sub: `${uygunsuzlukStats.kapandi} kapatıldı` },
    { label: 'Muayene Kayıtları', value: aktifMuayeneler.length, icon: 'ri-heart-pulse-line', color: '#EC4899', sub: `${aktifMuayeneler.filter(m => m.sonuc === 'Çalışabilir').length} uygun` },
    { label: 'Görevler', value: aktifGorevler.length, icon: 'ri-task-line', color: '#8B5CF6', sub: `${aktifGorevler.filter(g => g.durum === 'Tamamlandı').length} tamamlandı` },
    { label: 'Tutanaklar', value: tutanaklar.length, icon: 'ri-article-line', color: '#F97316', sub: `${tutanaklar.filter(t => t.durum === 'Onaylandı').length} onaylı` },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Raporlar &amp; Analiz</h1>
          <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>Sistemdeki tüm verilerin özet analizi ve grafikleri</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium isg-card"
          style={{ color: 'var(--text-muted)' }}>
          <i className="ri-refresh-line text-xs" />
          {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpiCards.map(card => <KPICard key={card.label} {...card} />)}
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 p-1 rounded-xl isg-card w-fit flex-wrap">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-semibold transition-all duration-200 whitespace-nowrap cursor-pointer"
            style={{
              background: activeTab === tab.id ? 'rgba(99,102,241,0.15)' : 'transparent',
              color: activeTab === tab.id ? '#818CF8' : 'var(--text-muted)',
              border: activeTab === tab.id ? '1px solid rgba(99,102,241,0.25)' : '1px solid transparent',
            }}>
            <i className={`${tab.icon} text-xs`} />{tab.label}
          </button>
        ))}
      </div>

      {/* GENEL BAKIŞ */}
      {activeTab === 'genel' && (
        <div className="space-y-5">
          <div className="isg-card rounded-2xl p-5">
            <SectionTitle title="Aylık Kayıt Trendi" subtitle="Son 12 ayda eklenen kayıtlar" icon="ri-line-chart-line" />
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  {[['gradPersonel','#10B981'],['gradEvrak','#F59E0B'],['gradFirma','#3B82F6']].map(([id, c]) => (
                    <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={c} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={c} stopOpacity={0} />
                    </linearGradient>
                  ))}
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="isg-card rounded-2xl p-5">
              <SectionTitle title="Tehlike Sınıfı Dağılımı" subtitle="Firmaların tehlike sınıflarına göre dağılımı" icon="ri-pie-chart-line" color="#EF4444" />
              {tehlikeDagilim.length === 0 ? (
                <div className="flex items-center justify-center h-40"><p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Henüz firma kaydı yok</p></div>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="55%" height={170}>
                    <PieChart>
                      <Pie data={tehlikeDagilim} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value" strokeWidth={0}>
                        {tehlikeDagilim.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-3">
                    {tehlikeDagilim.map(d => (
                      <div key={d.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                          <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
                        </div>
                        <span className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="isg-card rounded-2xl p-5">
              <SectionTitle title="Departman Dağılımı" subtitle="Personellerin departmanlara göre dağılımı" icon="ri-organization-chart" color="#10B981" />
              {departmanDagilim.length === 0 ? (
                <div className="flex items-center justify-center h-40"><p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Henüz personel kaydı yok</p></div>
              ) : (
                <ResponsiveContainer width="100%" height={170}>
                  <BarChart data={departmanDagilim} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Personel" radius={[0, 4, 4, 0]}>
                      {departmanDagilim.map((_, i) => <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Firma Özet Tablosu */}
          <div className="isg-card rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border-main)' }}>
              <div className="w-6 h-6 flex items-center justify-center rounded-lg" style={{ background: 'rgba(99,102,241,0.12)' }}>
                <i className="ri-building-2-line text-xs" style={{ color: '#818CF8' }} />
              </div>
              <h3 className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>Firma Özet Listesi</h3>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1" style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8' }}>{aktifFirmalar.length}</span>
            </div>
            {aktifFirmalar.length === 0 ? (
              <div className="py-10 text-center"><i className="ri-building-2-line text-2xl" style={{ color: 'var(--text-faint)' }} /><p className="text-[12px] mt-2" style={{ color: 'var(--text-muted)' }}>Henüz firma kaydı yok</p></div>
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
                          <td className="hidden md:table-cell"><Badge label={firma.tehlikeSinifi} color={getTehlikeColor(firma.tehlikeSinifi)} /></td>
                          <td><Badge label={firma.durum} color={getFirmaStatusColor(firma.durum)} /></td>
                          <td className="hidden lg:table-cell"><span className="text-[12.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>{firmaPersonel}</span></td>
                          <td className="hidden lg:table-cell"><span className="text-[12.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>{firmaEvrak}</span></td>
                          <td className="hidden lg:table-cell"><span className="text-[12.5px] font-semibold" style={{ color: firmaUyg > 0 ? '#EF4444' : 'var(--text-primary)' }}>{firmaUyg}</span></td>
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

      {/* EVRAK ANALİZİ */}
      {activeTab === 'evrak' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Yüklü', value: evrakStats.yuklu, color: '#10B981', icon: 'ri-checkbox-circle-fill' },
              { label: 'Eksik', value: evrakStats.eksik, color: '#EF4444', icon: 'ri-close-circle-fill' },
              { label: 'Süre Dolmuş', value: evrakStats.sureDolmus, color: '#F97316', icon: 'ri-error-warning-fill' },
              { label: 'Süre Yaklaşıyor', value: evrakStats.sureYaklasiyor, color: '#F59E0B', icon: 'ri-time-fill' },
            ].map(item => (
              <div key={item.label} className="isg-card rounded-2xl p-4 flex items-center gap-3 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: item.color }} />
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

          <div className="isg-card rounded-2xl p-5">
            <SectionTitle title="Aylık Evrak Tamamlanma Oranı" subtitle="Son 12 ayda yüklenen evrakların tamamlanma yüzdesi" icon="ri-bar-chart-line" color="#10B981" />
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={evrakTamamlanma} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="ay" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Bar dataKey="Tamamlanma %" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Eksik %" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="isg-card rounded-2xl p-5">
            <SectionTitle title="Evrak Durum Dağılımı" subtitle="Tüm evrakların durum bazlı dağılımı" icon="ri-pie-chart-line" color="#F59E0B" />
            <div className="space-y-4">
              <ProgressBar label="Yüklü Evraklar" value={evrakStats.yuklu} total={aktifEvraklar.length} color="#10B981" />
              <ProgressBar label="Eksik Evraklar" value={evrakStats.eksik} total={aktifEvraklar.length} color="#EF4444" />
              <ProgressBar label="Süresi Dolmuş" value={evrakStats.sureDolmus} total={aktifEvraklar.length} color="#F97316" />
              <ProgressBar label="Yaklaşan Süre (30g)" value={evrakStats.sureYaklasiyor} total={aktifEvraklar.length} color="#F59E0B" />
            </div>
          </div>
        </div>
      )}

      {/* UYGUNSUZLUKLAR */}
      {activeTab === 'uygunsuzluk' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Açık', value: uygunsuzlukStats.acik, color: '#EF4444', icon: 'ri-alert-fill' },
              { label: 'Kapandı', value: uygunsuzlukStats.kapandi, color: '#10B981', icon: 'ri-checkbox-circle-fill' },
              { label: 'Kritik Seviye', value: uygunsuzlukStats.kritik, color: '#DC2626', icon: 'ri-error-warning-fill' },
              { label: 'Yüksek Seviye', value: uygunsuzlukStats.yuksek, color: '#F97316', icon: 'ri-arrow-up-circle-fill' },
            ].map(item => (
              <div key={item.label} className="isg-card rounded-2xl p-4 flex items-center gap-3 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: item.color }} />
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

          <div className="isg-card rounded-2xl p-5">
            <SectionTitle title="Aylık Uygunsuzluk Trendi" subtitle="Son 12 ayda açılan ve kapatılan uygunsuzluklar" icon="ri-line-chart-line" color="#EF4444" />
            <ResponsiveContainer width="100%" height={220}>
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

          <div className="isg-card rounded-2xl p-5">
            <SectionTitle title="Uygunsuzluk Analizi" subtitle="Durum ve seviye bazlı dağılım" icon="ri-pie-chart-line" color="#EF4444" />
            <div className="space-y-4">
              <ProgressBar label="Açık Uygunsuzluklar" value={uygunsuzlukStats.acik} total={aktifUygunsuzluklar.length} color="#EF4444" />
              <ProgressBar label="Kapatılan Uygunsuzluklar" value={uygunsuzlukStats.kapandi} total={aktifUygunsuzluklar.length} color="#10B981" />
              <ProgressBar label="Kritik Seviye" value={uygunsuzlukStats.kritik} total={aktifUygunsuzluklar.length} color="#DC2626" />
              <ProgressBar label="Yüksek Seviye" value={uygunsuzlukStats.yuksek} total={aktifUygunsuzluklar.length} color="#F97316" />
            </div>
          </div>
        </div>
      )}

      {/* EĞİTİMLER */}
      {activeTab === 'egitim' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: 'Toplam Eğitim', value: aktifEgitimler.length, color: '#6366F1', icon: 'ri-graduation-cap-line' },
              { label: 'Tamamlandı', value: aktifEgitimler.filter(e => e.durum === 'Tamamlandı').length, color: '#10B981', icon: 'ri-checkbox-circle-fill' },
              { label: 'Planlandı', value: aktifEgitimler.filter(e => e.durum === 'Planlandı').length, color: '#3B82F6', icon: 'ri-calendar-check-line' },
            ].map(item => (
              <div key={item.label} className="isg-card rounded-2xl p-4 flex items-center gap-3 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: item.color }} />
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="isg-card rounded-2xl p-5">
              <SectionTitle title="Eğitim Durum Dağılımı" subtitle="Eğitimlerin duruma göre dağılımı" icon="ri-pie-chart-line" color="#6366F1" />
              {egitimDurum.length === 0 ? (
                <div className="flex items-center justify-center h-40"><p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Henüz eğitim kaydı yok</p></div>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="55%" height={170}>
                    <PieChart>
                      <Pie data={egitimDurum} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value" strokeWidth={0}>
                        {egitimDurum.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-3">
                    {egitimDurum.map(d => (
                      <div key={d.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                          <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
                        </div>
                        <span className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="isg-card rounded-2xl p-5">
              <SectionTitle title="Aylık Eğitim Trendi" subtitle="Son 12 ayda eklenen eğitimler" icon="ri-bar-chart-line" color="#6366F1" />
              <ResponsiveContainer width="100%" height={170}>
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
