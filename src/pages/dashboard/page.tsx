import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../store/AppContext';
import MonthlyStats from './components/MonthlyStats';
import StatCard from './components/StatCard';
import CompanyDocumentsWidget from './components/CompanyDocumentsWidget';
import AkilliOzet from './components/AkilliOzet';

import {
  PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer,
} from 'recharts';

// Güvenli tarih parse — geçersiz/boş tarihler için null döner
function parseValidDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr || !dateStr.trim()) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function DashboardPage() {
  const {
    firmalar, personeller, evraklar, egitimler, muayeneler,
    uygunsuzluklar, bildirimler, ekipmanlar,
    setActiveModule, fetchTable, org, realtimeStatus, refreshData,
  } = useApp();

  // Son güncelleme zamanı takibi
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [lastUpdateStr, setLastUpdateStr] = useState('Az önce');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Veri değişince güncelleme zamanını güncelle
  const prevLengthRef = useRef(
    firmalar.length + personeller.length + evraklar.length + muayeneler.length
  );
  useEffect(() => {
    const curr = firmalar.length + personeller.length + evraklar.length + muayeneler.length;
    if (curr !== prevLengthRef.current) {
      prevLengthRef.current = curr;
      setLastUpdate(new Date());
    }
  }, [firmalar.length, personeller.length, evraklar.length, muayeneler.length]);

  // "Az önce / X dk önce" metni
  useEffect(() => {
    const update = () => {
      const diff = Math.floor((Date.now() - lastUpdate.getTime()) / 60000);
      if (diff < 1) setLastUpdateStr('Az önce');
      else if (diff < 60) setLastUpdateStr(`${diff} dk önce`);
      else setLastUpdateStr(`${Math.floor(diff / 60)} sa önce`);
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [lastUpdate]);

  const handleManualRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await refreshData();
    setLastUpdate(new Date());
    setIsRefreshing(false);
  }, [isRefreshing, refreshData]);

  // Dashboard açılınca tüm tabloları fetch et
  // fetchedRef kaldırıldı — org değişiminde her seferinde taze veri çekilmeli
  useEffect(() => {
    if (!org?.id) return;
    const DASHBOARD_TABLES = [
      'evraklar', 'egitimler', 'muayeneler',
      'uygunsuzluklar', 'ekipmanlar',
    ];
    DASHBOARD_TABLES.forEach(t => { void fetchTable(t); });
  }, [org?.id, fetchTable]);

  const aktifFirmalar      = useMemo(() => firmalar.filter(f => !f.silinmis), [firmalar]);
  const aktifPersoneller   = useMemo(() => personeller.filter(p => !p.silinmis), [personeller]);
  const aktifEvraklar      = useMemo(() => evraklar.filter(e => !e.silinmis), [evraklar]);
  const aktifEgitimler     = useMemo(() => egitimler.filter(e => !e.silinmis), [egitimler]);

  // Eğitim katılım istatistikleri
  const egitimKatilimOrani = useMemo(() => {
    let toplam = 0; let katildi = 0;
    aktifEgitimler.forEach(e => {
      const kl = e.katilimcilar ?? (e.katilimciIds ?? []).map(id => ({ personelId: id, katildi: true }));
      toplam += kl.length;
      katildi += kl.filter(k => k.katildi).length;
    });
    return toplam > 0 ? Math.round((katildi / toplam) * 100) : 0;
  }, [aktifEgitimler]);
  const aktifMuayeneler    = useMemo(() => muayeneler.filter(m => !m.silinmis), [muayeneler]);
  const aktifUygunsuzluklar= useMemo(() => uygunsuzluklar.filter(u => !u.silinmis), [uygunsuzluklar]);
  const aktifEkipmanlar    = useMemo(() => ekipmanlar.filter(e => !e.silinmis), [ekipmanlar]);

  // ── ISG Risk hesaplamaları ──
  const riskStats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in7  = new Date(today.getTime() + 7  * 86400000);
    const in30 = new Date(today.getTime() + 30 * 86400000);

    const gecikmisBelge = aktifEvraklar.filter(e => {
      const d = parseValidDate(e.gecerlilikTarihi);
      return d !== null && d < today;
    }).length;

    const gecikmisEkipman = aktifEkipmanlar.filter(e => {
      if (e.durum === 'Uygun Değil') return false;
      const d = parseValidDate(e.sonrakiKontrolTarihi);
      return d !== null && d < today;
    }).length;

    const gecikmisMuayene = aktifMuayeneler.filter(m => {
      const d = parseValidDate(m.sonrakiTarih || m.muayeneTarihi);
      return d !== null && d < today;
    }).length;

    const uygunDegil = aktifEkipmanlar.filter(e => e.durum === 'Uygun Değil').length;

    const yaklasan7Belge = aktifEvraklar.filter(e => {
      const d = parseValidDate(e.gecerlilikTarihi);
      return d !== null && d >= today && d <= in7;
    }).length;

    const yaklasan7Ekipman = aktifEkipmanlar.filter(e => {
      if (e.durum === 'Uygun Değil') return false;
      const d = parseValidDate(e.sonrakiKontrolTarihi);
      return d !== null && d >= today && d <= in7;
    }).length;

    const yaklasan7Muayene = aktifMuayeneler.filter(m => {
      const d = parseValidDate(m.sonrakiTarih || m.muayeneTarihi);
      return d !== null && d >= today && d <= in7;
    }).length;

    const yaklasan30Belge = aktifEvraklar.filter(e => {
      const d = parseValidDate(e.gecerlilikTarihi);
      return d !== null && d >= today && d <= in30;
    }).length;

    const yaklasan30Ekipman = aktifEkipmanlar.filter(e => {
      if (e.durum === 'Uygun Değil') return false;
      const d = parseValidDate(e.sonrakiKontrolTarihi);
      return d !== null && d >= today && d <= in30;
    }).length;

    const yaklasan30Muayene = aktifMuayeneler.filter(m => {
      const d = parseValidDate(m.sonrakiTarih || m.muayeneTarihi);
      return d !== null && d >= today && d <= in30;
    }).length;

    const toplamGecikme = gecikmisBelge + gecikmisEkipman + gecikmisMuayene;
    const toplam7 = yaklasan7Belge + yaklasan7Ekipman + yaklasan7Muayene;
    const toplam30 = yaklasan30Belge + yaklasan30Ekipman + yaklasan30Muayene;

    return {
      gecikmisBelge, gecikmisEkipman, gecikmisMuayene, toplamGecikme,
      yaklasan7Belge, yaklasan7Ekipman, yaklasan7Muayene, toplam7,
      yaklasan30Belge, yaklasan30Ekipman, yaklasan30Muayene, toplam30,
      uygunDegil,
    };
  }, [aktifEvraklar, aktifEkipmanlar, aktifMuayeneler]);

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

    const now = Date.now();
    const d30 = now - 30 * 86400000;
    const d60 = now - 60 * 86400000;
    const firmaLast30 = aktifFirmalar.filter(f => new Date(f.olusturmaTarihi).getTime() >= d30).length;
    const firmaPrev30 = aktifFirmalar.filter(f => { const t = new Date(f.olusturmaTarihi).getTime(); return t >= d60 && t < d30; }).length;
    const personelLast30 = aktifPersoneller.filter(p => new Date(p.olusturmaTarihi).getTime() >= d30).length;
    const personelPrev30 = aktifPersoneller.filter(p => { const t = new Date(p.olusturmaTarihi).getTime(); return t >= d60 && t < d30; }).length;

    const calcTrend = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? { pct: 100, dir: 'up' as const } : null;
      const pct = Math.round(((curr - prev) / prev) * 100);
      return { pct: Math.abs(pct), dir: pct >= 0 ? 'up' as const : 'down' as const };
    };
    return {
      yaklaşan, eksik, acikU,
      firmaLast30, firmaTrend: calcTrend(firmaLast30, firmaPrev30),
      personelLast30, personelTrend: calcTrend(personelLast30, personelPrev30),
    };
  }, [aktifEvraklar, aktifUygunsuzluklar, aktifFirmalar, aktifPersoneller]);

  const evrakPie = useMemo(() => [
    { name: 'Yüklü',          value: aktifEvraklar.filter(e => e.durum === 'Yüklü').length },
    { name: 'Eksik',          value: aktifEvraklar.filter(e => e.durum === 'Eksik').length },
    { name: 'Süre Yaklaşıyor',value: aktifEvraklar.filter(e => e.durum === 'Süre Yaklaşıyor').length },
    { name: 'Süre Dolmuş',    value: aktifEvraklar.filter(e => e.durum === 'Süre Dolmuş').length },
  ].filter(d => d.value > 0), [aktifEvraklar]);

  const uygunDegılEkipmanlar = useMemo(() =>
    aktifEkipmanlar.filter(e => e.durum === 'Uygun Değil').slice(0, 5),
  [aktifEkipmanlar]);

  const acikUygunsuzluklar = useMemo(() =>
    aktifUygunsuzluklar.filter(u => u.durum === 'Açık')
      .sort((a, b) => new Date(b.olusturmaTarihi).getTime() - new Date(a.olusturmaTarihi).getTime())
      .slice(0, 5),
  [aktifUygunsuzluklar]);



  const isEmpty = aktifFirmalar.length === 0 && aktifPersoneller.length === 0;
  const PIE_COLORS = ['#10B981', '#EF4444', '#F59E0B', '#6366F1'];

  const statCards = [
    {
      label: 'Toplam Firma',
      value: aktifFirmalar.length,
      icon: 'ri-building-2-line',
      sub: `${aktifFirmalar.filter(f => f.durum === 'Aktif').length} aktif firma`,
      trend: stats.firmaTrend,
      trendLabel: `Son 30g: +${stats.firmaLast30}`,
      variant: 'default' as const,
    },
    {
      label: 'Toplam Personel',
      value: aktifPersoneller.length,
      icon: 'ri-team-line',
      sub: `${aktifPersoneller.filter(p => p.durum === 'Aktif').length} aktif personel`,
      trend: stats.personelTrend,
      trendLabel: `Son 30g: +${stats.personelLast30}`,
      variant: 'default' as const,
    },
    {
      label: 'Eksik / Süresi Dolmuş',
      value: stats.eksik,
      icon: 'ri-file-warning-line',
      sub: `${stats.yaklaşan} evrak 30 gün içinde`,
      trend: null,
      trendLabel: null,
      variant: stats.eksik > 0 ? 'danger' as const : 'success' as const,
    },
    {
      label: 'Açık Uygunsuzluk',
      value: stats.acikU,
      icon: 'ri-alert-line',
      sub: `${aktifUygunsuzluklar.filter(u => u.durum === 'Kapandı').length} kapatılmış`,
      trend: null,
      trendLabel: null,
      variant: stats.acikU > 0 ? 'danger' as const : 'success' as const,
    },
  ];

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-subtle)' }}>
        <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #0EA5E9, #38BDF8)' }} />
        <div className="px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}>
              <i className="ri-dashboard-3-line text-white text-sm" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold leading-tight" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                Genel Bakış
              </h1>
              <p className="text-[11px] mt-0.5 font-medium" style={{ color: 'var(--text-muted)' }}>
                {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
            {(riskStats.toplamGecikme + riskStats.uygunDegil) > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171' }}>
                <i className="ri-error-warning-line text-[10px]" />
                {riskStats.toplamGecikme + riskStats.uygunDegil} kritik
              </div>
            )}
            {/* Realtime durum + son güncelleme */}
            <button
              onClick={() => void handleManualRefresh()}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-all"
              style={{
                background: realtimeStatus === 'connected' ? 'rgba(14,165,233,0.1)' : realtimeStatus === 'connecting' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${realtimeStatus === 'connected' ? 'rgba(14,165,233,0.2)' : realtimeStatus === 'connecting' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'}`,
                color: realtimeStatus === 'connected' ? '#0EA5E9' : realtimeStatus === 'connecting' ? '#F59E0B' : '#F87171',
              }}
            >
              {isRefreshing ? (
                <i className="ri-loader-4-line text-[10px] animate-spin" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: realtimeStatus === 'connected' ? '#0EA5E9' : realtimeStatus === 'connecting' ? '#F59E0B' : '#F87171' }} />
              )}
              <span>{realtimeStatus === 'connected' ? 'Canlı' : realtimeStatus === 'connecting' ? 'Bağlanıyor' : 'Bağlantı Yok'}</span>
              <span style={{ opacity: 0.6 }}>· {lastUpdateStr}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Welcome Banner — Onboarding ── */}
      {isEmpty && (
        <div className="rounded-xl overflow-hidden animate-fade-in"
          style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.2)' }}>
          <div className="px-4 pt-4 pb-3 flex items-start gap-3" style={{ borderBottom: '1px solid rgba(14,165,233,0.12)' }}>
            <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}>
              <i className="ri-rocket-2-line text-white text-base" />
            </div>
            <div>
              <p className="font-extrabold text-[14px]" style={{ color: 'var(--text-primary)' }}>ISG Denetim&apos;e Hoş Geldiniz!</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Sistemi 3 adımda kurabilirsiniz. Aşağıdaki adımları sırayla tamamlayın.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x" style={{ borderColor: 'rgba(14,165,233,0.1)' }}>
            {[
              { step: '1', icon: 'ri-building-2-line', color: '#0EA5E9', bg: 'rgba(14,165,233,0.12)', title: 'Firma Ekle', desc: 'Sol menüden "Firmalar" modülüne giderek ilk firmanızı oluşturun.', module: 'firmalar' },
              { step: '2', icon: 'ri-team-line', color: '#0EA5E9', bg: 'rgba(14,165,233,0.12)', title: 'Personel Ekle', desc: 'Firmaya bağlı çalışanları "Personeller" modülünden kaydedin.', module: 'personeller' },
              { step: '3', icon: 'ri-file-add-line', color: '#0EA5E9', bg: 'rgba(14,165,233,0.12)', title: 'Evrak Yükle', desc: '"Evraklar" modülünden belgeleri yükleyin, sistem takibi otomatik yapar.', module: 'evraklar' },
            ].map((item) => (
              <button
                key={item.step}
                onClick={() => setActiveModule(item.module as Parameters<typeof setActiveModule>[0])}
                className="flex items-start gap-3 px-4 py-3 text-left cursor-pointer transition-all group"
                style={{ background: 'transparent' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(14,165,233,0.06)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div className="flex-shrink-0 mt-0.5">
                  <div className="w-7 h-7 flex items-center justify-center rounded-lg"
                    style={{ background: item.bg, border: `1px solid rgba(14,165,233,0.3)` }}>
                    <i className={`${item.icon} text-xs`} style={{ color: item.color }} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                      style={{ background: item.bg, color: item.color }}>
                      Adım {item.step}
                    </span>
                  </div>
                  <p className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>{item.title}</p>
                  <p className="text-[10.5px] mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{item.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 4 Ana Stat Kartı — 2x2 grid mobile, 4-col desktop ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            icon={card.icon}
            sub={card.sub}
            trend={card.trend}
            trendLabel={card.trendLabel}
            variant={card.variant}
            delay={idx * 100}
          />
        ))}
      </div>

      {/* ── Akıllı Özet + Bu Ay Özeti ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <AkilliOzet />
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}>
              <i className="ri-bar-chart-2-line text-white text-xs" />
            </div>
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Bu Ay Özeti</h2>
          </div>
          <MonthlyStats />
        </div>
      </div>

      {/* ── ISG Risk Paneli ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-subtle)' }}>
          <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, #EF4444, #F87171)' }} />
          <div className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)' }}>
                <i className="ri-shield-cross-line text-white text-xs" />
              </div>
              <h3 className="text-[12.5px] font-bold" style={{ color: 'var(--text-primary)' }}>İSG Risk Paneli</h3>
              {(riskStats.toplamGecikme > 0 || riskStats.uygunDegil > 0) && (
                <span className="ml-auto text-[9.5px] font-bold px-2 py-0.5 rounded-full animate-pulse"
                  style={{ background: 'rgba(239,68,68,0.12)', color: '#F87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {riskStats.toplamGecikme + riskStats.uygunDegil} kritik
                </span>
              )}
            </div>

            {riskStats.uygunDegil > 0 && (
              <div className="mb-4 rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 flex items-center justify-center rounded-md" style={{ background: 'rgba(239,68,68,0.15)' }}>
                    <i className="ri-error-warning-fill text-[10px]" style={{ color: '#EF4444' }} />
                  </div>
                  <p className="text-[10.5px] font-bold" style={{ color: '#F87171' }}>
                    KRİTİK — {riskStats.uygunDegil} Uygunsuz Ekipman
                  </p>
                  <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse"
                    style={{ background: 'rgba(239,68,68,0.2)', color: '#F87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                    UYGUNSUZ
                  </span>
                </div>
                <div className="space-y-1">
                  {uygunDegılEkipmanlar.map(ek => {
                    const firma = aktifFirmalar.find(f => f.id === ek.firmaId);
                    return (
                      <div key={ek.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
                        style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}>
                        <i className="ri-tools-line text-[10px]" style={{ color: '#F87171' }} />
                        <span className="text-[11px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{ek.ad}</span>
                        {firma && <span className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{firma.ad}</span>}
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                          style={{ background: 'rgba(239,68,68,0.15)', color: '#F87171' }}>KRİTİK</span>
                      </div>
                    );
                  })}
                  {riskStats.uygunDegil > 5 && (
                    <p className="text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>+{riskStats.uygunDegil - 5} daha</p>
                  )}
                </div>
              </div>
            )}

            <div className="mb-4">
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2.5" style={{ color: 'var(--text-muted)' }}>
                <i className="ri-error-warning-line mr-1.5" style={{ color: '#EF4444' }} />Geciken İşlemler
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Evrak',   value: riskStats.gecikmisBelge,   icon: 'ri-file-damage-line',  color: '#F87171', bg: 'rgba(248,113,113,0.1)',  border: 'rgba(248,113,113,0.2)' },
                  { label: 'Ekipman', value: riskStats.gecikmisEkipman, icon: 'ri-tools-line',        color: '#F59E0B', bg: 'rgba(251,146,60,0.1)',   border: 'rgba(251,146,60,0.2)' },
                  { label: 'Muayene', value: riskStats.gecikmisMuayene, icon: 'ri-heart-pulse-line',  color: '#F87171', bg: 'rgba(248,113,113,0.1)',  border: 'rgba(248,113,113,0.2)' },
                ].map(item => (
                  <div key={item.label} className="rounded-xl p-2.5 text-center"
                    style={{ background: item.value > 0 ? `${item.color}18` : 'var(--bg-item)', border: `1px solid ${item.value > 0 ? `${item.color}30` : 'var(--border-subtle)'}` }}>
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg mx-auto mb-1.5"
                      style={{ background: item.value > 0 ? `${item.color}20` : 'var(--bg-item)' }}>
                      <i className={`${item.icon} text-xs`} style={{ color: item.value > 0 ? item.color : 'var(--text-muted)' }} />
                    </div>
                    <p className="text-xl font-extrabold" style={{ color: item.value > 0 ? item.color : 'var(--text-muted)' }}>{item.value}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2.5" style={{ color: 'var(--text-muted)' }}>
                <i className="ri-timer-line mr-1.5" style={{ color: '#F59E0B' }} />Yaklaşan Kritikler
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="rounded-xl p-3" style={{ background: riskStats.toplam7 > 0 ? 'rgba(245,158,11,0.07)' : 'var(--bg-item)', border: `1px solid ${riskStats.toplam7 > 0 ? 'rgba(245,158,11,0.2)' : 'var(--border-subtle)'}` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 flex items-center justify-center rounded-md" style={{ background: 'rgba(245,158,11,0.12)' }}>
                      <i className="ri-alarm-warning-line text-[10px]" style={{ color: '#F59E0B' }} />
                    </div>
                    <p className="text-[11px] font-bold" style={{ color: 'var(--text-primary)' }}>7 Gün İçinde</p>
                    <span className="ml-auto text-[10.5px] font-bold" style={{ color: riskStats.toplam7 > 0 ? '#F59E0B' : 'var(--text-muted)' }}>{riskStats.toplam7}</span>
                  </div>
                  <div className="space-y-1">
                    {[
                      { label: 'Evrak',   value: riskStats.yaklasan7Belge,   icon: 'ri-file-warning-line',  color: '#10B981' },
                      { label: 'Ekipman', value: riskStats.yaklasan7Ekipman, icon: 'ri-tools-line',          color: '#F59E0B' },
                      { label: 'Muayene', value: riskStats.yaklasan7Muayene, icon: 'ri-heart-pulse-line',    color: '#34D399' },
                    ].map(r => (
                      <div key={r.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <i className={`${r.icon} text-[10px]`} style={{ color: r.color }} />
                          <span className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>{r.label}</span>
                        </div>
                        <span className="text-[10.5px] font-bold" style={{ color: r.value > 0 ? '#F59E0B' : 'var(--text-muted)' }}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl p-3" style={{ background: riskStats.toplam30 > 0 ? 'rgba(251,191,36,0.05)' : 'var(--bg-item)', border: `1px solid ${riskStats.toplam30 > 0 ? 'rgba(251,191,36,0.15)' : 'var(--border-subtle)'}` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 flex items-center justify-center rounded-md" style={{ background: 'rgba(251,191,36,0.1)' }}>
                      <i className="ri-timer-line text-[10px]" style={{ color: '#FBBF24' }} />
                    </div>
                    <p className="text-[11px] font-bold" style={{ color: 'var(--text-primary)' }}>30 Gün İçinde</p>
                    <span className="ml-auto text-[10.5px] font-bold" style={{ color: riskStats.toplam30 > 0 ? '#FBBF24' : 'var(--text-muted)' }}>{riskStats.toplam30}</span>
                  </div>
                  <div className="space-y-1">
                    {[
                      { label: 'Evrak',   value: riskStats.yaklasan30Belge,   icon: 'ri-file-warning-line', color: '#10B981' },
                      { label: 'Ekipman', value: riskStats.yaklasan30Ekipman, icon: 'ri-tools-line',         color: '#F59E0B' },
                      { label: 'Muayene', value: riskStats.yaklasan30Muayene, icon: 'ri-heart-pulse-line',   color: '#34D399' },
                    ].map(r => (
                      <div key={r.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <i className={`${r.icon} text-[10px]`} style={{ color: r.color }} />
                          <span className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>{r.label}</span>
                        </div>
                        <span className="text-[10.5px] font-bold" style={{ color: r.value > 0 ? '#FBBF24' : 'var(--text-muted)' }}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Evrak Durumları Pie */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-subtle)' }}>
          <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #0EA5E9, #38BDF8)' }} />
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}>
                <i className="ri-pie-chart-2-line text-white text-xs" />
              </div>
              <div>
                <h3 className="text-[12.5px] font-bold" style={{ color: 'var(--text-primary)' }}>Evrak Durumları</h3>
                <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Toplam {aktifEvraklar.length} evrak</p>
              </div>
            </div>
            {evrakPie.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={evrakPie} cx="50%" cy="42%" innerRadius={42} outerRadius={64} dataKey="value" paddingAngle={4} strokeWidth={0}>
                    {evrakPie.map((_, index) => <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '11px' }} itemStyle={{ color: 'var(--text-secondary)' }} />
                  <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: 9, color: 'var(--text-muted)' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <DashEmptyState icon="ri-file-chart-line" text="Henüz evrak yok" subtext="Evrak yükledikçe grafik dolacak" />
            )}

            {riskStats.toplamGecikme > 0 && (
              <div className="mt-3 rounded-xl p-2.5" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <p className="text-[10.5px] font-bold mb-1.5" style={{ color: '#F87171' }}>
                  <i className="ri-error-warning-line mr-1" />Kritik Uyarılar
                </p>
                <div className="space-y-1">
                  {riskStats.gecikmisBelge > 0 && (
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      <i className="ri-circle-fill text-[6px] mr-1.5" style={{ color: '#F87171' }} />
                      {riskStats.gecikmisBelge} evrak süresi dolmuş
                    </p>
                  )}
                  {riskStats.gecikmisEkipman > 0 && (
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      <i className="ri-circle-fill text-[6px] mr-1.5" style={{ color: '#F59E0B' }} />
                      {riskStats.gecikmisEkipman} ekipman kontrolü gecikti
                    </p>
                  )}
                  {riskStats.gecikmisMuayene > 0 && (
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      <i className="ri-circle-fill text-[6px] mr-1.5" style={{ color: '#F87171' }} />
                      {riskStats.gecikmisMuayene} muayene tarihi geçti
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Progress Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Aktif Firmalar',        value: aktifFirmalar.filter(f => f.durum === 'Aktif').length,         total: aktifFirmalar.length,    color: '#0EA5E9', icon: 'ri-building-2-line',     accent: 'linear-gradient(135deg, #0EA5E9, #0284C7)' },
          { label: 'Aktif Personeller',     value: aktifPersoneller.filter(p => p.durum === 'Aktif').length,      total: aktifPersoneller.length, color: '#38BDF8', icon: 'ri-team-line',           accent: 'linear-gradient(135deg, #38BDF8, #0EA5E9)' },
          { label: 'Çalışabilir Muayene',   value: aktifMuayeneler.filter(m => m.sonuc === 'Çalışabilir').length, total: aktifMuayeneler.length,  color: '#0284C7', icon: 'ri-heart-pulse-line',    accent: 'linear-gradient(135deg, #0284C7, #0EA5E9)' },
        ].map(item => {
          const pct = item.total > 0 ? Math.round((item.value / item.total) * 100) : 0;
          return (
            <div key={item.label} className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-subtle)' }}>
              <div className="h-[2px]" style={{ background: item.accent }} />
              <div className="p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="w-6 h-6 flex items-center justify-center rounded-md flex-shrink-0"
                    style={{ background: `rgba(14,165,233,0.12)` }}>
                    <i className={`${item.icon} text-[11px]`} style={{ color: item.color }} />
                  </div>
                  <span className="text-[10.5px] font-bold" style={{ color: item.color }}>{pct}%</span>
                </div>
                <p className="text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                  {item.value}<span className="text-xs font-normal ml-1" style={{ color: 'var(--text-muted)' }}>/ {item.total}</span>
                </p>
                <p className="text-[10px] mt-0.5 mb-1.5" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-item)' }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: item.accent }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DashEmptyState({ icon, text, subtext, color = '#475569' }: { icon: string; text: string; subtext: string; color?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-2.5">
      <div className="w-12 h-12 flex items-center justify-center rounded-xl" style={{ background: `${color}10`, border: `1px solid ${color}18` }}>
        <i className={`${icon} text-xl`} style={{ color: `${color}70` }} />
      </div>
      <div className="text-center">
        <p className="text-[12.5px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{text}</p>
        <p className="text-[11px] mt-0.5 leading-relaxed max-w-[200px]" style={{ color: 'var(--text-muted)' }}>{subtext}</p>
      </div>
    </div>
  );
}
