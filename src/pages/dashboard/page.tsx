import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import WelcomeAnimation from './components/WelcomeAnimation';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid,
} from 'recharts';
import Badge, { getEvrakStatusColor } from '../../components/base/Badge';

export default function DashboardPage() {
  const [welcomeDone, setWelcomeDone] = useState(false);
  const [showWelcome] = useState(() => {
    const flag = sessionStorage.getItem('isg_show_welcome');
    if (flag === 'true') { sessionStorage.removeItem('isg_show_welcome'); return true; }
    return false;
  });

  const {
    firmalar, personeller, evraklar, egitimler, muayeneler,
    uygunsuzluklar, bildirimler, gorevler,
  } = useApp();

  const aktifFirmalar = useMemo(() => firmalar.filter(f => !f.silinmis), [firmalar]);
  const aktifPersoneller = useMemo(() => personeller.filter(p => !p.silinmis), [personeller]);
  const aktifEvraklar = useMemo(() => evraklar.filter(e => !e.silinmis), [evraklar]);
  const aktifEgitimler = useMemo(() => egitimler.filter(e => !e.silinmis), [egitimler]);
  const aktifMuayeneler = useMemo(() => muayeneler.filter(m => !m.silinmis), [muayeneler]);
  const aktifUygunsuzluklar = useMemo(() => uygunsuzluklar.filter(u => !u.silinmis), [uygunsuzluklar]);
  const aktifGorevler = useMemo(() => gorevler.filter(g => !g.silinmis), [gorevler]);

  const yediGunEvraklar = useMemo(() => bildirimler.filter(b => b.tip === 'evrak_surecek'), [bildirimler]);

  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in30 = new Date(today.getTime() + 30 * 86400000);
    const yaklaşan = aktifEvraklar.filter(e => {
      if (!e.gecerlilikTarihi) return false;
      const d = new Date(e.gecerlilikTarihi); d.setHours(0, 0, 0, 0);
      return d >= today && d <= in30;
    }).length;
    const eksik = aktifEvraklar.filter(e => e.durum === 'Eksik' || e.durum === 'Süre Dolmuş').length;
    const acikU = aktifUygunsuzluklar.filter(u => u.durum === 'Açık').length;
    const acikGorev = aktifGorevler.filter(g => g.durum !== 'Tamamlandı').length;
    return { yaklaşan, eksik, acikU, acikGorev };
  }, [aktifEvraklar, aktifUygunsuzluklar, aktifGorevler]);

  const evrakPie = useMemo(() => [
    { name: 'Yüklü', value: aktifEvraklar.filter(e => e.durum === 'Yüklü').length },
    { name: 'Eksik', value: aktifEvraklar.filter(e => e.durum === 'Eksik').length },
    { name: 'Süre Yaklaşıyor', value: aktifEvraklar.filter(e => e.durum === 'Süre Yaklaşıyor').length },
    { name: 'Süre Dolmuş', value: aktifEvraklar.filter(e => e.durum === 'Süre Dolmuş').length },
  ].filter(d => d.value > 0), [aktifEvraklar]);

  const monthlyData = useMemo(() => {
    const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    const currentMonth = new Date().getMonth();
    return months.slice(0, currentMonth + 1).map((ay, idx) => ({
      ay,
      firmalar: aktifFirmalar.filter(f => { const m = new Date(f.olusturmaTarihi).getMonth(); const y = new Date(f.olusturmaTarihi).getFullYear(); return y <= new Date().getFullYear() && m <= idx; }).length,
      personeller: aktifPersoneller.filter(p => { const m = new Date(p.olusturmaTarihi).getMonth(); const y = new Date(p.olusturmaTarihi).getFullYear(); return y <= new Date().getFullYear() && m <= idx; }).length,
    }));
  }, [aktifFirmalar, aktifPersoneller]);

  const recentItems = useMemo(() => {
    const all = [
      ...aktifFirmalar.map(f => ({ tip: 'Firma', ad: f.ad, tarih: f.olusturmaTarihi, icon: 'ri-building-2-line', color: '#3B82F6' })),
      ...aktifPersoneller.map(p => ({ tip: 'Personel', ad: p.adSoyad, tarih: p.olusturmaTarihi, icon: 'ri-user-line', color: '#10B981' })),
      ...aktifEgitimler.map(e => ({ tip: 'Eğitim', ad: e.ad, tarih: e.olusturmaTarihi, icon: 'ri-graduation-cap-line', color: '#F59E0B' })),
    ];
    return all.sort((a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime()).slice(0, 8);
  }, [aktifFirmalar, aktifPersoneller, aktifEgitimler]);

  const yaklaşanEvraklar = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in60 = new Date(today.getTime() + 60 * 86400000);
    return aktifEvraklar
      .filter(e => { if (!e.gecerlilikTarihi) return false; const d = new Date(e.gecerlilikTarihi); d.setHours(0, 0, 0, 0); return d >= today && d <= in60; })
      .sort((a, b) => new Date(a.gecerlilikTarihi!).getTime() - new Date(b.gecerlilikTarihi!).getTime())
      .slice(0, 5);
  }, [aktifEvraklar]);

  const acikUygunsuzluklar = useMemo(() => aktifUygunsuzluklar.filter(u => u.durum === 'Açık').sort((a, b) => new Date(b.olusturmaTarihi).getTime() - new Date(a.olusturmaTarihi).getTime()).slice(0, 5), [aktifUygunsuzluklar]);

  const navigate = useNavigate();
  const isEmpty = aktifFirmalar.length === 0 && aktifPersoneller.length === 0;
  const PIE_COLORS = ['#10B981', '#EF4444', '#F59E0B', '#6366F1'];

  const statCards = [
    { label: 'Toplam Firma', value: aktifFirmalar.length, icon: 'ri-building-2-line', sub: `${aktifFirmalar.filter(f => f.durum === 'Aktif').length} aktif firma`, gradient: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(99,102,241,0.08))', border: 'rgba(59,130,246,0.2)', iconBg: 'linear-gradient(135deg, #3B82F6, #6366F1)', iconShadow: '0 8px 20px rgba(99,102,241,0.3)', valueColor: 'linear-gradient(135deg, #60A5FA, #818CF8)' },
    { label: 'Toplam Personel', value: aktifPersoneller.length, icon: 'ri-team-line', sub: `${aktifPersoneller.filter(p => p.durum === 'Aktif').length} aktif personel`, gradient: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.08))', border: 'rgba(16,185,129,0.2)', iconBg: 'linear-gradient(135deg, #10B981, #059669)', iconShadow: '0 8px 20px rgba(16,185,129,0.3)', valueColor: 'linear-gradient(135deg, #34D399, #10B981)' },
    { label: 'Eksik / Süresi Dolmuş', value: stats.eksik, icon: 'ri-file-warning-line', sub: `${stats.yaklaşan} evrak 30 gün içinde`, gradient: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(220,38,38,0.08))', border: 'rgba(239,68,68,0.2)', iconBg: 'linear-gradient(135deg, #EF4444, #DC2626)', iconShadow: '0 8px 20px rgba(239,68,68,0.3)', valueColor: 'linear-gradient(135deg, #FCA5A5, #F87171)' },
    { label: 'Açık Uygunsuzluk', value: stats.acikU, icon: 'ri-alert-line', sub: `${aktifUygunsuzluklar.filter(u => u.durum === 'Kapandı').length} kapatılmış`, gradient: stats.acikU > 0 ? 'linear-gradient(135deg, rgba(239,68,68,0.18), rgba(220,38,38,0.08))' : 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.08))', border: stats.acikU > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.2)', iconBg: stats.acikU > 0 ? 'linear-gradient(135deg, #EF4444, #DC2626)' : 'linear-gradient(135deg, #10B981, #059669)', iconShadow: stats.acikU > 0 ? '0 8px 20px rgba(239,68,68,0.35)' : '0 8px 20px rgba(16,185,129,0.3)', valueColor: stats.acikU > 0 ? 'linear-gradient(135deg, #FCA5A5, #F87171)' : 'linear-gradient(135deg, #34D399, #10B981)' },
  ];

  return (
    <>
      {showWelcome && !welcomeDone && <WelcomeAnimation onDone={() => setWelcomeDone(true)} />}
    <div className="space-y-6" style={showWelcome && !welcomeDone ? { opacity: 0, pointerEvents: 'none' } : undefined}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Kontrol Paneli</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#34D399' }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#10B981' }} />
            Sistem Aktif
          </div>
          {stats.acikGorev > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
              style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#F59E0B' }}>
              <i className="ri-task-line" />{stats.acikGorev} açık görev
            </div>
          )}
        </div>
      </div>

      {isEmpty && (
        <div className="rounded-2xl p-5 flex items-start gap-4 animate-fade-in"
          style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(99,102,241,0.05))', border: '1px solid rgba(99,102,241,0.2)' }}>
          <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)', boxShadow: '0 8px 20px rgba(99,102,241,0.35)' }}>
            <i className="ri-rocket-line text-white text-base" />
          </div>
          <div>
            <p className="font-bold" style={{ color: 'var(--text-primary)' }}>ISG Denetim&apos;e Hoş Geldiniz!</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Sistemi kullanmaya başlamak için sol menüden <strong>Firmalar</strong> modülüne giderek ilk firmanızı ekleyin.
            </p>
          </div>
        </div>
      )}

      {yediGunEvraklar.length > 0 && (
        <div className="rounded-2xl p-4 flex items-start gap-4"
          style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.1),rgba(239,68,68,0.06))', border: '1px solid rgba(245,158,11,0.25)' }}>
          <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: 'rgba(245,158,11,0.15)' }}>
            <i className="ri-alarm-warning-line text-xl" style={{ color: '#F59E0B' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Süresi Yaklaşan Evraklar — {yediGunEvraklar.length} kayıt</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Aşağıdaki evrakların geçerlilik süresi 7 gün içinde dolacak.</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {yediGunEvraklar.slice(0, 5).map(b => (
                <span key={b.id} className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'rgba(245,158,11,0.15)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.2)' }}>
                  {b.mesaj.replace(' evrakının süresi dolmak üzere', '')}
                </span>
              ))}
              {yediGunEvraklar.length > 5 && <span className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'rgba(245,158,11,0.15)', color: '#FCD34D' }}>+{yediGunEvraklar.length - 5} daha</span>}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="stat-card rounded-2xl p-5" style={{ background: card.gradient, border: `1px solid ${card.border}` }}>
            <div className="flex items-start justify-between mb-4">
              <div className="w-11 h-11 flex items-center justify-center rounded-xl" style={{ background: card.iconBg, boxShadow: card.iconShadow }}>
                <i className={`${card.icon} text-white text-lg`} />
              </div>
            </div>
            <div>
              <p className="text-4xl font-extrabold" style={{ background: card.valueColor, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>{card.value}</p>
              <p className="text-sm font-semibold mt-2" style={{ color: 'var(--text-primary)' }}>{card.label}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{card.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {acikUygunsuzluklar.length > 0 && (
        <div className="rounded-2xl p-5 isg-card" style={{ borderLeft: '3px solid #EF4444' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ background: 'rgba(239,68,68,0.15)' }}>
                <i className="ri-alert-fill" style={{ color: '#EF4444' }} />
              </div>
              <div>
                <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Açık Uygunsuzluklar</h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Kapatılmayı bekleyen kayıtlar</p>
              </div>
            </div>
            <button onClick={() => navigate('/')} className="text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
              Modüle Git
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {acikUygunsuzluklar.map(u => {
              const firma = aktifFirmalar.find(f => f.id === u.firmaId);
              return (
                <div key={u.id} className="rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(239,68,68,0.15)', color: '#F87171' }}>{u.acilisNo ?? 'DÖF'}</span>
                    <span className="text-[10px] ml-auto" style={{ color: 'var(--text-muted)' }}>{new Date(u.olusturmaTarihi).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}</span>
                  </div>
                  <p className="text-xs font-semibold line-clamp-2 mb-1.5" style={{ color: 'var(--text-primary)' }}>{u.baslik || u.aciklama?.slice(0, 40) || '—'}</p>
                  {firma && <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}><i className="ri-building-2-line mr-1" />{firma.ad}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-2xl p-5 isg-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-3">
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Büyüme Trendi</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{new Date().getFullYear()} yılı — aylık firma ve personel artışı</p>
            </div>
            <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#3B82F6' }} />Firmalar</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#10B981' }} />Personeller</span>
            </div>
          </div>
          {aktifFirmalar.length === 0 && aktifPersoneller.length === 0 ? (
            <DashEmptyState icon="ri-bar-chart-line" text="Grafik için veri yok" subtext="Firma ve personel ekledikçe grafik dolacak" />
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} /><stop offset="100%" stopColor="#3B82F6" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10B981" stopOpacity={0.3} /><stop offset="100%" stopColor="#10B981" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="ay" stroke="var(--chart-axis)" tick={{ fontSize: 11, fill: 'var(--chart-tick)' }} />
                <YAxis stroke="var(--chart-axis)" tick={{ fontSize: 11, fill: 'var(--chart-tick)' }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: '12px', color: 'var(--text-primary)' }} labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }} itemStyle={{ color: 'var(--text-secondary)' }} />
                <Area type="monotone" dataKey="firmalar" stroke="#3B82F6" fill="url(#gradBlue)" strokeWidth={2.5} name="Firmalar" dot={false} activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="personeller" stroke="#10B981" fill="url(#gradGreen)" strokeWidth={2.5} name="Personeller" dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="rounded-2xl p-5 isg-card">
          <div className="mb-5">
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Evrak Durumları</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Toplam {aktifEvraklar.length} evrak kaydı</p>
          </div>
          {evrakPie.length > 0 ? (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={evrakPie} cx="50%" cy="42%" innerRadius={52} outerRadius={78} dataKey="value" paddingAngle={4} strokeWidth={0}>
                  {evrakPie.map((_, index) => <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: '12px', color: 'var(--text-primary)' }} itemStyle={{ color: 'var(--text-secondary)' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: 'var(--text-muted)' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <DashEmptyState icon="ri-file-chart-line" text="Henüz evrak yok" subtext="Evrak yükledikçe grafik dolacak" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl p-5 isg-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Yaklaşan Süreler</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Önümüzdeki 60 gün</p>
            </div>
            <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}>
              <i className="ri-time-line" />{yaklaşanEvraklar.length} kayıt
            </span>
          </div>
          {yaklaşanEvraklar.length === 0 ? (
            <DashEmptyState icon="ri-check-double-line" text="Yaklaşan süre yok" subtext="Tüm evraklar güncel" color="#10B981" />
          ) : (
            <div className="space-y-2">
              {yaklaşanEvraklar.map(ev => {
                const d = new Date(ev.gecerlilikTarihi!); d.setHours(0, 0, 0, 0);
                const today = new Date(); today.setHours(0, 0, 0, 0);
                const days = Math.ceil((d.getTime() - today.getTime()) / 86400000);
                const isUrgent = days <= 15;
                return (
                  <div key={ev.id} className="flex items-center gap-3 rounded-xl px-3.5 py-3" style={{ background: 'var(--bg-item)', border: '1px solid var(--bg-item-border)' }}>
                    <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: isUrgent ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)' }}>
                      <i className="ri-file-warning-line text-sm" style={{ color: isUrgent ? '#EF4444' : '#F59E0B' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{ev.ad}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{ev.tur}</p>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap flex items-center gap-1" style={{ background: isUrgent ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)', color: isUrgent ? '#F87171' : '#FCD34D' }}>
                      <i className="ri-timer-line" />{days === 0 ? 'Bugün!' : `${days}g`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="rounded-2xl p-5 isg-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Son Aktiviteler</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>En son eklenen kayıtlar</p>
            </div>
          </div>
          {recentItems.length === 0 ? (
            <DashEmptyState icon="ri-time-line" text="Henüz aktivite yok" subtext="Kayıt ekledikçe burada görünecek" />
          ) : (
            <div className="relative">
              <div className="absolute left-3.5 top-0 bottom-0 w-px" style={{ background: 'var(--border-subtle)' }} />
              <div className="space-y-0.5">
                {recentItems.map((item, idx) => (
                  <div key={idx} className="relative flex items-start gap-3 pb-3 pl-9 last:pb-0">
                    <div className="absolute left-0 top-1 w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: `${item.color}18`, border: `1px solid ${item.color}25` }}>
                      <i className={`${item.icon} text-xs`} style={{ color: item.color }} />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[11px] font-semibold" style={{ color: item.color }}>{item.tip}</span>
                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{new Date(item.tarih).toLocaleDateString('tr-TR')}</span>
                      </div>
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{item.ad}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Aktif Firmalar', value: aktifFirmalar.filter(f => f.durum === 'Aktif').length, total: aktifFirmalar.length, color: '#3B82F6', icon: 'ri-building-2-line' },
          { label: 'Aktif Personeller', value: aktifPersoneller.filter(p => p.durum === 'Aktif').length, total: aktifPersoneller.length, color: '#10B981', icon: 'ri-team-line' },
          { label: 'Tamamlanan Eğitimler', value: aktifEgitimler.filter(e => e.durum === 'Tamamlandı').length, total: aktifEgitimler.length, color: '#F59E0B', icon: 'ri-graduation-cap-line' },
          { label: 'Çalışabilir Muayene', value: aktifMuayeneler.filter(m => m.sonuc === 'Çalışabilir').length, total: aktifMuayeneler.length, color: '#6366F1', icon: 'ri-heart-pulse-line' },
        ].map(item => {
          const pct = item.total > 0 ? Math.round((item.value / item.total) * 100) : 0;
          return (
            <div key={item.label} className="rounded-2xl p-4 isg-card">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: `${item.color}15` }}>
                  <i className={`${item.icon} text-xs`} style={{ color: item.color }} />
                </div>
                <span className="text-xs font-bold" style={{ color: item.color }}>{pct}%</span>
              </div>
              <p className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{item.value}<span className="text-sm font-normal ml-1" style={{ color: 'var(--text-muted)' }}>/ {item.total}</span></p>
              <p className="text-xs mt-1 mb-2" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-item)' }}>
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: item.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
    </>
  );
}

function DashEmptyState({ icon, text, subtext, color = '#475569' }: { icon: string; text: string; subtext: string; color?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3">
      <div className="w-14 h-14 flex items-center justify-center rounded-2xl" style={{ background: `${color}12`, border: `1px solid ${color}20` }}>
        <i className={`${icon} text-2xl`} style={{ color: `${color}80` }} />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{text}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>{subtext}</p>
      </div>
    </div>
  );
}
