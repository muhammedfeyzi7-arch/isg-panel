import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import MonthlyStats from './components/MonthlyStats';
import StatCard from './components/StatCard';
import {
  PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer,
} from 'recharts';

export default function DashboardPage() {
  const {
    firmalar, personeller, evraklar, egitimler, muayeneler,
    uygunsuzluklar, bildirimler, gorevler, ekipmanlar,
  } = useApp();

  const aktifFirmalar      = useMemo(() => firmalar.filter(f => !f.silinmis), [firmalar]);
  const aktifPersoneller   = useMemo(() => personeller.filter(p => !p.silinmis), [personeller]);
  const aktifEvraklar      = useMemo(() => evraklar.filter(e => !e.silinmis), [evraklar]);
  const aktifEgitimler     = useMemo(() => egitimler.filter(e => !e.silinmis), [egitimler]);
  const aktifMuayeneler    = useMemo(() => muayeneler.filter(m => !m.silinmis), [muayeneler]);
  const aktifUygunsuzluklar= useMemo(() => uygunsuzluklar.filter(u => !u.silinmis), [uygunsuzluklar]);
  const aktifGorevler      = useMemo(() => gorevler.filter(g => !g.silinmis), [gorevler]);
  const aktifEkipmanlar    = useMemo(() => ekipmanlar.filter(e => !e.silinmis), [ekipmanlar]);

  const yediGunBildirimler = useMemo(() => bildirimler.filter(b => b.kalanGun >= 0 && b.kalanGun <= 7), [bildirimler]);

  // ── ISG Risk hesaplamaları ──
  const riskStats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in7  = new Date(today.getTime() + 7  * 86400000);
    const in30 = new Date(today.getTime() + 30 * 86400000);

    // Geciken evraklar
    const gecikmisBelge = aktifEvraklar.filter(e => {
      if (!e.gecerlilikTarihi) return false;
      const d = new Date(e.gecerlilikTarihi); d.setHours(0,0,0,0);
      return d < today;
    }).length;

    // Geciken ekipman kontrolleri
    const gecikmisEkipman = aktifEkipmanlar.filter(e => {
      if (!e.sonrakiKontrolTarihi) return false;
      const d = new Date(e.sonrakiKontrolTarihi); d.setHours(0,0,0,0);
      return d < today;
    }).length;

    // Geciken muayeneler
    const gecikmisMuayene = aktifMuayeneler.filter(m => {
      const tarih = m.sonrakiTarih || m.muayeneTarihi;
      if (!tarih) return false;
      const d = new Date(tarih); d.setHours(0,0,0,0);
      return d < today;
    }).length;

    // 7 gün içinde yaklaşanlar
    const yaklasan7Belge = aktifEvraklar.filter(e => {
      if (!e.gecerlilikTarihi) return false;
      const d = new Date(e.gecerlilikTarihi); d.setHours(0,0,0,0);
      return d >= today && d <= in7;
    }).length;

    const yaklasan7Ekipman = aktifEkipmanlar.filter(e => {
      if (!e.sonrakiKontrolTarihi) return false;
      const d = new Date(e.sonrakiKontrolTarihi); d.setHours(0,0,0,0);
      return d >= today && d <= in7;
    }).length;

    const yaklasan7Muayene = aktifMuayeneler.filter(m => {
      const tarih = m.sonrakiTarih || m.muayeneTarihi;
      if (!tarih) return false;
      const d = new Date(tarih); d.setHours(0,0,0,0);
      return d >= today && d <= in7;
    }).length;

    // 30 gün içinde yaklaşanlar
    const yaklasan30Belge = aktifEvraklar.filter(e => {
      if (!e.gecerlilikTarihi) return false;
      const d = new Date(e.gecerlilikTarihi); d.setHours(0,0,0,0);
      return d >= today && d <= in30;
    }).length;

    const yaklasan30Ekipman = aktifEkipmanlar.filter(e => {
      if (!e.sonrakiKontrolTarihi) return false;
      const d = new Date(e.sonrakiKontrolTarihi); d.setHours(0,0,0,0);
      return d >= today && d <= in30;
    }).length;

    const yaklasan30Muayene = aktifMuayeneler.filter(m => {
      const tarih = m.sonrakiTarih || m.muayeneTarihi;
      if (!tarih) return false;
      const d = new Date(tarih); d.setHours(0,0,0,0);
      return d >= today && d <= in30;
    }).length;

    const toplamGecikme = gecikmisBelge + gecikmisEkipman + gecikmisMuayene;
    const toplam7 = yaklasan7Belge + yaklasan7Ekipman + yaklasan7Muayene;
    const toplam30 = yaklasan30Belge + yaklasan30Ekipman + yaklasan30Muayene;

    return {
      gecikmisBelge, gecikmisEkipman, gecikmisMuayene, toplamGecikme,
      yaklasan7Belge, yaklasan7Ekipman, yaklasan7Muayene, toplam7,
      yaklasan30Belge, yaklasan30Ekipman, yaklasan30Muayene, toplam30,
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
    const acikGorev = aktifGorevler.filter(g => g.durum !== 'Tamamlandı').length;
    const gecikmiş = aktifGorevler.filter(g => g.durum !== 'Tamamlandı' && g.bitisTarihi && new Date(g.bitisTarihi) < today).length;

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
      yaklaşan, eksik, acikU, acikGorev, gecikmiş,
      firmaLast30, firmaTrend: calcTrend(firmaLast30, firmaPrev30),
      personelLast30, personelTrend: calcTrend(personelLast30, personelPrev30),
    };
  }, [aktifEvraklar, aktifUygunsuzluklar, aktifGorevler, aktifFirmalar, aktifPersoneller]);

  const evrakPie = useMemo(() => [
    { name: 'Yüklü',          value: aktifEvraklar.filter(e => e.durum === 'Yüklü').length },
    { name: 'Eksik',          value: aktifEvraklar.filter(e => e.durum === 'Eksik').length },
    { name: 'Süre Yaklaşıyor',value: aktifEvraklar.filter(e => e.durum === 'Süre Yaklaşıyor').length },
    { name: 'Süre Dolmuş',    value: aktifEvraklar.filter(e => e.durum === 'Süre Dolmuş').length },
  ].filter(d => d.value > 0), [aktifEvraklar]);

  const recentItems = useMemo(() => {
    const all = [
      ...aktifFirmalar.map(f => ({ tip: 'Firma', ad: f.ad, tarih: f.olusturmaTarihi, icon: 'ri-building-2-line', color: '#3B82F6', badge: 'eklendi', badgeColor: '#10B981', badgeBg: 'rgba(16,185,129,0.12)' })),
      ...aktifPersoneller.map(p => ({ tip: 'Personel', ad: p.adSoyad, tarih: p.olusturmaTarihi, icon: 'ri-user-line', color: '#10B981', badge: 'eklendi', badgeColor: '#10B981', badgeBg: 'rgba(16,185,129,0.12)' })),
      ...aktifEgitimler.map(e => ({ tip: 'Eğitim', ad: e.ad, tarih: e.olusturmaTarihi, icon: 'ri-graduation-cap-line', color: '#F59E0B', badge: 'planlandı', badgeColor: '#F59E0B', badgeBg: 'rgba(245,158,11,0.12)' })),
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

  const yaklaşanEkipmanlar = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in60 = new Date(today.getTime() + 60 * 86400000);
    return aktifEkipmanlar
      .filter(e => {
        if (!e.sonrakiKontrolTarihi) return false;
        const d = new Date(e.sonrakiKontrolTarihi); d.setHours(0, 0, 0, 0);
        return d >= today && d <= in60;
      })
      .sort((a, b) => new Date(a.sonrakiKontrolTarihi).getTime() - new Date(b.sonrakiKontrolTarihi).getTime())
      .slice(0, 5);
  }, [aktifEkipmanlar]);

  const acikUygunsuzluklar = useMemo(() =>
    aktifUygunsuzluklar.filter(u => u.durum === 'Açık')
      .sort((a, b) => new Date(b.olusturmaTarihi).getTime() - new Date(a.olusturmaTarihi).getTime())
      .slice(0, 5),
  [aktifUygunsuzluklar]);

  // Smart insights — ISG odaklı
  const insights = useMemo(() => {
    const list: { icon: string; text: string; color: string; bg: string; priority: number }[] = [];
    if (riskStats.gecikmisBelge > 0)   list.push({ icon: 'ri-file-damage-line',   text: `${riskStats.gecikmisBelge} evrak süresi dolmuş`,          color: '#F87171', bg: 'rgba(239,68,68,0.1)',   priority: 4 });
    if (riskStats.gecikmisEkipman > 0) list.push({ icon: 'ri-tools-line',          text: `${riskStats.gecikmisEkipman} ekipman kontrolü gecikti`,    color: '#F87171', bg: 'rgba(239,68,68,0.1)',   priority: 4 });
    if (riskStats.gecikmisMuayene > 0) list.push({ icon: 'ri-heart-pulse-line',    text: `${riskStats.gecikmisMuayene} muayene tarihi geçti`,         color: '#F87171', bg: 'rgba(239,68,68,0.1)',   priority: 4 });
    if (stats.acikU > 0)               list.push({ icon: 'ri-alert-line',          text: `${stats.acikU} açık uygunsuzluk kapatılmayı bekliyor`,     color: '#F87171', bg: 'rgba(239,68,68,0.1)',   priority: 3 });
    if (stats.gecikmiş > 0)            list.push({ icon: 'ri-time-line',           text: `${stats.gecikmiş} görev gecikmiş durumda`,                  color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', priority: 2 });
    if (riskStats.toplam7 > 0)         list.push({ icon: 'ri-alarm-warning-line',  text: `${riskStats.toplam7} işlem 7 gün içinde sona eriyor`,       color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', priority: 2 });
    if (riskStats.toplam30 > 0)        list.push({ icon: 'ri-timer-line',          text: `${riskStats.toplam30} işlem 30 gün içinde sona eriyor`,     color: '#FBBF24', bg: 'rgba(251,191,36,0.1)', priority: 1 });
    if (list.length === 0)             list.push({ icon: 'ri-checkbox-circle-line',text: 'Tüm sistemler normal çalışıyor',                            color: '#34D399', bg: 'rgba(16,185,129,0.1)', priority: 0 });
    return list.sort((a, b) => b.priority - a.priority).slice(0, 5);
  }, [riskStats, stats]);

  const navigate = useNavigate();
  const isEmpty = aktifFirmalar.length === 0 && aktifPersoneller.length === 0;
  const PIE_COLORS = ['#10B981', '#EF4444', '#F59E0B', '#6366F1'];

  const statCards = [
    { label: 'Toplam Firma',          value: aktifFirmalar.length,    icon: 'ri-building-2-line',  sub: `${aktifFirmalar.filter(f => f.durum === 'Aktif').length} aktif firma`,       trend: stats.firmaTrend,    trendLabel: `Son 30g: +${stats.firmaLast30}`,    gradient: 'linear-gradient(145deg, rgba(59,130,246,0.1) 0%, rgba(99,102,241,0.04) 100%)',  border: 'rgba(59,130,246,0.15)',  iconBg: 'linear-gradient(135deg, #3B82F6, #6366F1)', valueColor: 'linear-gradient(135deg, #93C5FD, #A5B4FC)' },
    { label: 'Toplam Personel',       value: aktifPersoneller.length, icon: 'ri-team-line',        sub: `${aktifPersoneller.filter(p => p.durum === 'Aktif').length} aktif personel`, trend: stats.personelTrend, trendLabel: `Son 30g: +${stats.personelLast30}`, gradient: 'linear-gradient(145deg, rgba(16,185,129,0.1) 0%, rgba(5,150,105,0.04) 100%)',   border: 'rgba(16,185,129,0.15)', iconBg: 'linear-gradient(135deg, #10B981, #059669)', valueColor: 'linear-gradient(135deg, #6EE7B7, #34D399)' },
    { label: 'Eksik / Süresi Dolmuş', value: stats.eksik,             icon: 'ri-file-warning-line',sub: `${stats.yaklaşan} evrak 30 gün içinde`,                                     trend: null,                trendLabel: null,                                gradient: stats.eksik > 0 ? 'linear-gradient(145deg, rgba(239,68,68,0.1) 0%, rgba(220,38,38,0.04) 100%)' : 'linear-gradient(145deg, rgba(16,185,129,0.1) 0%, rgba(5,150,105,0.04) 100%)', border: stats.eksik > 0 ? 'rgba(239,68,68,0.18)' : 'rgba(16,185,129,0.15)', iconBg: stats.eksik > 0 ? 'linear-gradient(135deg, #EF4444, #DC2626)' : 'linear-gradient(135deg, #10B981, #059669)', valueColor: stats.eksik > 0 ? 'linear-gradient(135deg, #FCA5A5, #F87171)' : 'linear-gradient(135deg, #6EE7B7, #34D399)' },
    { label: 'Açık Uygunsuzluk',      value: stats.acikU,             icon: 'ri-alert-line',       sub: `${aktifUygunsuzluklar.filter(u => u.durum === 'Kapandı').length} kapatılmış`, trend: null,                trendLabel: null,                                gradient: stats.acikU > 0 ? 'linear-gradient(145deg, rgba(239,68,68,0.1) 0%, rgba(220,38,38,0.04) 100%)' : 'linear-gradient(145deg, rgba(16,185,129,0.1) 0%, rgba(5,150,105,0.04) 100%)', border: stats.acikU > 0 ? 'rgba(239,68,68,0.18)' : 'rgba(16,185,129,0.15)', iconBg: stats.acikU > 0 ? 'linear-gradient(135deg, #EF4444, #DC2626)' : 'linear-gradient(135deg, #10B981, #059669)', valueColor: stats.acikU > 0 ? 'linear-gradient(135deg, #FCA5A5, #F87171)' : 'linear-gradient(135deg, #6EE7B7, #34D399)' },
  ];

  return (
    <div className="space-y-6">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div>
          <h1 className="text-[22px] font-extrabold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            Kontrol Paneli
          </h1>
          <p className="text-[12px] mt-1 font-medium" style={{ color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', color: '#34D399' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10B981' }} />
            Sistem Aktif
          </div>
          {stats.acikGorev > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', color: '#F59E0B' }}>
              <i className="ri-task-line text-[11px]" />{stats.acikGorev} açık görev
            </div>
          )}
        </div>
      </div>

      {/* ── Welcome Banner ── */}
      {isEmpty && (
        <div className="rounded-xl p-4 flex items-start gap-3 animate-fade-in"
          style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(99,102,241,0.04))', border: '1px solid rgba(99,102,241,0.15)' }}>
          <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}>
            <i className="ri-rocket-line text-white text-sm" />
          </div>
          <div>
            <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>ISG Denetim&apos;e Hoş Geldiniz!</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Sistemi kullanmaya başlamak için sol menüden <strong>Firmalar</strong> modülüne giderek ilk firmanızı ekleyin.
            </p>
          </div>
        </div>
      )}

      {/* ── 7-day warning banner ── */}
      {yediGunBildirimler.length > 0 && (
        <div className="rounded-xl p-4 flex items-start gap-3"
          style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.08),rgba(239,68,68,0.04))', border: '1px solid rgba(245,158,11,0.2)' }}>
          <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(245,158,11,0.12)' }}>
            <i className="ri-alarm-warning-line text-base" style={{ color: '#F59E0B' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>7 Gün İçinde Sona Erecek — {yediGunBildirimler.length} kayıt</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Evrak, ekipman ve muayene dahil tüm yaklaşan işlemler.</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {yediGunBildirimler.slice(0, 5).map(b => (
                <span key={b.id} className="text-[11px] px-2 py-0.5 rounded-md" style={{ background: 'rgba(245,158,11,0.12)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.18)' }}>
                  {b.mesaj}
                </span>
              ))}
              {yediGunBildirimler.length > 5 && (
                <span className="text-[11px] px-2 py-0.5 rounded-md" style={{ background: 'rgba(245,158,11,0.12)', color: '#FCD34D' }}>
                  +{yediGunBildirimler.length - 5} daha
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            icon={card.icon}
            sub={card.sub}
            trend={card.trend}
            trendLabel={card.trendLabel}
            gradient={card.gradient}
            border={card.border}
            iconBg={card.iconBg}
            valueColor={card.valueColor}
            delay={idx * 120}
          />
        ))}
      </div>

      {/* ── Akıllı Özet + Bu Ay Özeti ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl p-5 isg-card">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg, #6366F1, #8B5CF6)' }} />
            <h2 className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>Akıllı Özet</h2>
            <span className="ml-auto text-[10px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(99,102,241,0.1)', color: '#A5B4FC', border: '1px solid rgba(99,102,241,0.15)' }}>
              {insights.filter(i => i.priority >= 2).length > 0 ? `${insights.filter(i => i.priority >= 2).length} uyarı` : 'Temiz'}
            </span>
          </div>
          <div className="space-y-2">
            {insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg"
                style={{ background: insight.bg, border: `1px solid ${insight.color}20` }}>
                <div className="w-6 h-6 flex items-center justify-center rounded-md flex-shrink-0 mt-0.5"
                  style={{ background: `${insight.color}18` }}>
                  <i className={`${insight.icon} text-[11px]`} style={{ color: insight.color }} />
                </div>
                <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{insight.text}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg, #10B981, #059669)' }} />
            <h2 className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>Bu Ay Özeti</h2>
          </div>
          <MonthlyStats />
        </div>
      </div>

      {/* ── ISG Risk Paneli (Büyüme Trendi'nin yerini aldı) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Sol: Geciken İşlemler + Yaklaşan Kritikler */}
        <div className="lg:col-span-2 rounded-2xl p-5 isg-card">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg, #EF4444, #F87171)' }} />
            <h3 className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>İSG Risk Paneli</h3>
            {riskStats.toplamGecikme > 0 && (
              <span className="ml-auto text-[10px] font-bold px-2.5 py-1 rounded-full animate-pulse"
                style={{ background: 'rgba(239,68,68,0.12)', color: '#F87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                {riskStats.toplamGecikme} gecikmiş
              </span>
            )}
          </div>

          {/* Geciken İşlemler */}
          <div className="mb-5">
            <p className="text-[10.5px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
              <i className="ri-error-warning-line mr-1.5" style={{ color: '#EF4444' }} />Geciken İşlemler
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Evrak', value: riskStats.gecikmisBelge,   icon: 'ri-file-damage-line',  color: '#F87171', bg: 'rgba(248,113,113,0.1)',  border: 'rgba(248,113,113,0.2)' },
                { label: 'Ekipman', value: riskStats.gecikmisEkipman, icon: 'ri-tools-line',        color: '#FB923C', bg: 'rgba(251,146,60,0.1)',   border: 'rgba(251,146,60,0.2)' },
                { label: 'Muayene', value: riskStats.gecikmisMuayene, icon: 'ri-heart-pulse-line',  color: '#F87171', bg: 'rgba(248,113,113,0.1)',  border: 'rgba(248,113,113,0.2)' },
              ].map(item => (
                <div key={item.label} className="rounded-xl p-3.5 text-center"
                  style={{ background: item.value > 0 ? item.bg : 'var(--bg-item)', border: `1px solid ${item.value > 0 ? item.border : 'var(--bg-item-border)'}` }}>
                  <div className="w-8 h-8 flex items-center justify-center rounded-lg mx-auto mb-2"
                    style={{ background: item.value > 0 ? `${item.color}20` : 'var(--bg-item)' }}>
                    <i className={`${item.icon} text-sm`} style={{ color: item.value > 0 ? item.color : 'var(--text-muted)' }} />
                  </div>
                  <p className="text-2xl font-extrabold" style={{ color: item.value > 0 ? item.color : 'var(--text-muted)' }}>{item.value}</p>
                  <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Yaklaşan Kritikler */}
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
              <i className="ri-timer-line mr-1.5" style={{ color: '#F59E0B' }} />Yaklaşan Kritikler
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* 7 gün */}
              <div className="rounded-xl p-4" style={{ background: riskStats.toplam7 > 0 ? 'rgba(245,158,11,0.07)' : 'var(--bg-item)', border: `1px solid ${riskStats.toplam7 > 0 ? 'rgba(245,158,11,0.2)' : 'var(--bg-item-border)'}` }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(245,158,11,0.12)' }}>
                    <i className="ri-alarm-warning-line text-xs" style={{ color: '#F59E0B' }} />
                  </div>
                  <p className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>7 Gün İçinde</p>
                  <span className="ml-auto text-[11px] font-bold" style={{ color: riskStats.toplam7 > 0 ? '#F59E0B' : 'var(--text-muted)' }}>{riskStats.toplam7}</span>
                </div>
                <div className="space-y-1.5">
                  {[
                    { label: 'Evrak',   value: riskStats.yaklasan7Belge,   icon: 'ri-file-warning-line',  color: '#94A3B8' },
                    { label: 'Ekipman', value: riskStats.yaklasan7Ekipman, icon: 'ri-tools-line',          color: '#FB923C' },
                    { label: 'Muayene', value: riskStats.yaklasan7Muayene, icon: 'ri-heart-pulse-line',    color: '#34D399' },
                  ].map(r => (
                    <div key={r.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <i className={`${r.icon} text-[10px]`} style={{ color: r.color }} />
                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{r.label}</span>
                      </div>
                      <span className="text-[11px] font-bold" style={{ color: r.value > 0 ? '#F59E0B' : 'var(--text-muted)' }}>{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 30 gün */}
              <div className="rounded-xl p-4" style={{ background: riskStats.toplam30 > 0 ? 'rgba(251,191,36,0.05)' : 'var(--bg-item)', border: `1px solid ${riskStats.toplam30 > 0 ? 'rgba(251,191,36,0.15)' : 'var(--bg-item-border)'}` }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(251,191,36,0.1)' }}>
                    <i className="ri-timer-line text-xs" style={{ color: '#FBBF24' }} />
                  </div>
                  <p className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>30 Gün İçinde</p>
                  <span className="ml-auto text-[11px] font-bold" style={{ color: riskStats.toplam30 > 0 ? '#FBBF24' : 'var(--text-muted)' }}>{riskStats.toplam30}</span>
                </div>
                <div className="space-y-1.5">
                  {[
                    { label: 'Evrak',   value: riskStats.yaklasan30Belge,   icon: 'ri-file-warning-line', color: '#94A3B8' },
                    { label: 'Ekipman', value: riskStats.yaklasan30Ekipman, icon: 'ri-tools-line',         color: '#FB923C' },
                    { label: 'Muayene', value: riskStats.yaklasan30Muayene, icon: 'ri-heart-pulse-line',   color: '#34D399' },
                  ].map(r => (
                    <div key={r.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <i className={`${r.icon} text-[10px]`} style={{ color: r.color }} />
                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{r.label}</span>
                      </div>
                      <span className="text-[11px] font-bold" style={{ color: r.value > 0 ? '#FBBF24' : 'var(--text-muted)' }}>{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sağ: Evrak Durumları Pie */}
        <div className="rounded-2xl p-5 isg-card">
          <div className="mb-4">
            <h3 className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>Evrak Durumları</h3>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Toplam {aktifEvraklar.length} evrak</p>
          </div>
          {evrakPie.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={evrakPie} cx="50%" cy="42%" innerRadius={48} outerRadius={72} dataKey="value" paddingAngle={4} strokeWidth={0}>
                  {evrakPie.map((_, index) => <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '12px' }} itemStyle={{ color: 'var(--text-secondary)' }} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10, color: 'var(--text-muted)' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <DashEmptyState icon="ri-file-chart-line" text="Henüz evrak yok" subtext="Evrak yükledikçe grafik dolacak" />
          )}

          {/* Kritik uyarı özeti */}
          {riskStats.toplamGecikme > 0 && (
            <div className="mt-4 rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <p className="text-[11px] font-bold mb-2" style={{ color: '#F87171' }}>
                <i className="ri-error-warning-line mr-1" />Kritik Uyarılar
              </p>
              <div className="space-y-1">
                {riskStats.gecikmisBelge > 0 && (
                  <p className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                    <i className="ri-circle-fill text-[6px] mr-1.5" style={{ color: '#F87171' }} />
                    {riskStats.gecikmisBelge} evrak süresi dolmuş
                  </p>
                )}
                {riskStats.gecikmisEkipman > 0 && (
                  <p className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                    <i className="ri-circle-fill text-[6px] mr-1.5" style={{ color: '#FB923C' }} />
                    {riskStats.gecikmisEkipman} ekipman kontrolü gecikti
                  </p>
                )}
                {riskStats.gecikmisMuayene > 0 && (
                  <p className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                    <i className="ri-circle-fill text-[6px] mr-1.5" style={{ color: '#F87171' }} />
                    {riskStats.gecikmisMuayene} muayene tarihi geçti
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Açık Uygunsuzluklar ── */}
      {acikUygunsuzluklar.length > 0 && (
        <div className="rounded-2xl p-5 isg-card" style={{ borderLeft: '3px solid #EF4444' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ background: 'rgba(239,68,68,0.12)' }}>
                <i className="ri-alert-fill text-sm" style={{ color: '#EF4444' }} />
              </div>
              <div>
                <h3 className="text-[12.5px] font-bold" style={{ color: 'var(--text-primary)' }}>Açık Uygunsuzluklar</h3>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Kapatılmayı bekleyen kayıtlar</p>
              </div>
            </div>
            <button onClick={() => navigate('/')} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer whitespace-nowrap"
              style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.15)' }}>
              Modüle Git
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5">
            {acikUygunsuzluklar.map(u => {
              const firma = aktifFirmalar.find(f => f.id === u.firmaId);
              return (
                <div key={u.id} className="rounded-lg p-3" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.12)' }}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.12)', color: '#F87171' }}>{u.acilisNo ?? 'DÖF'}</span>
                    <span className="text-[9px] ml-auto" style={{ color: 'var(--text-muted)' }}>{new Date(u.olusturmaTarihi).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}</span>
                  </div>
                  <p className="text-[11.5px] font-semibold line-clamp-2 mb-1" style={{ color: 'var(--text-primary)' }}>{u.baslik || u.aciklama?.slice(0, 40) || '—'}</p>
                  {firma && <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}><i className="ri-building-2-line mr-1" />{firma.ad}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Yaklaşan Süreler + Son Aktiviteler ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl p-5 isg-card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[12.5px] font-bold" style={{ color: 'var(--text-primary)' }}>Yaklaşan Süreler</h3>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Önümüzdeki 60 gün</p>
            </div>
            <span className="flex items-center gap-1 text-[10.5px] font-semibold px-2 py-1 rounded-full"
              style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.15)' }}>
              <i className="ri-time-line text-[10px]" />{yaklaşanEvraklar.length + yaklaşanEkipmanlar.length} kayıt
            </span>
          </div>
          {(yaklaşanEvraklar.length > 0 || yaklaşanEkipmanlar.length > 0) ? (
            <UpcomingTabs evraklar={yaklaşanEvraklar} ekipmanlar={yaklaşanEkipmanlar} firmalar={aktifFirmalar} />
          ) : (
            <InsightEmptyState />
          )}
        </div>

        <div className="rounded-2xl p-5 isg-card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[12.5px] font-bold" style={{ color: 'var(--text-primary)' }}>Son Aktiviteler</h3>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>En son eklenen kayıtlar</p>
            </div>
          </div>
          {recentItems.length === 0 ? (
            <DashEmptyState icon="ri-time-line" text="Henüz aktivite yok" subtext="Kayıt ekledikçe burada görünecek" />
          ) : (
            <div className="space-y-1.5">
              {recentItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5"
                  style={{ background: 'var(--bg-item)', border: '1px solid var(--bg-item-border)' }}>
                  <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
                    style={{ background: `${item.color}15`, border: `1px solid ${item.color}20` }}>
                    <i className={`${item.icon} text-xs`} style={{ color: item.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{item.ad}</p>
                    <p className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>{new Date(item.tarih).toLocaleDateString('tr-TR')}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: `${item.color}12`, color: item.color }}>{item.tip}</span>
                    <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: item.badgeBg, color: item.badgeColor }}>{item.badge}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Progress Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Aktif Firmalar',        value: aktifFirmalar.filter(f => f.durum === 'Aktif').length,         total: aktifFirmalar.length,    color: '#3B82F6', icon: 'ri-building-2-line' },
          { label: 'Aktif Personeller',     value: aktifPersoneller.filter(p => p.durum === 'Aktif').length,      total: aktifPersoneller.length, color: '#10B981', icon: 'ri-team-line' },
          { label: 'Tamamlanan Eğitimler',  value: aktifEgitimler.filter(e => e.durum === 'Tamamlandı').length,   total: aktifEgitimler.length,   color: '#F59E0B', icon: 'ri-graduation-cap-line' },
          { label: 'Çalışabilir Muayene',   value: aktifMuayeneler.filter(m => m.sonuc === 'Çalışabilir').length, total: aktifMuayeneler.length,  color: '#34D399', icon: 'ri-heart-pulse-line' },
        ].map(item => {
          const pct = item.total > 0 ? Math.round((item.value / item.total) * 100) : 0;
          return (
            <div key={item.label} className="rounded-xl p-3.5 isg-card">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 flex items-center justify-center rounded-md flex-shrink-0" style={{ background: `${item.color}12` }}>
                  <i className={`${item.icon} text-[11px]`} style={{ color: item.color }} />
                </div>
                <span className="text-[11px] font-bold" style={{ color: item.color }}>{pct}%</span>
              </div>
              <p className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                {item.value}<span className="text-xs font-normal ml-1" style={{ color: 'var(--text-muted)' }}>/ {item.total}</span>
              </p>
              <p className="text-[10.5px] mt-0.5 mb-2" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-item)' }}>
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: item.color }} />
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
        <p className="text-[12.5px] font-medium" style={{ color: 'var(--text-muted)' }}>{text}</p>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-faint)' }}>{subtext}</p>
      </div>
    </div>
  );
}

function UpcomingTabs({
  evraklar, ekipmanlar, firmalar,
}: {
  evraklar: { id: string; ad: string; tur: string; gecerlilikTarihi?: string }[];
  ekipmanlar: { id: string; ad: string; tur: string; firmaId: string; sonrakiKontrolTarihi: string }[];
  firmalar: { id: string; ad: string }[];
}) {
  const [tab, setTab] = useState<'evrak' | 'ekipman'>('evrak');
  const today = new Date(); today.setHours(0, 0, 0, 0);

  return (
    <div>
      <div className="flex gap-1 mb-3 p-1 rounded-lg" style={{ background: 'var(--bg-item)' }}>
        <button onClick={() => setTab('evrak')}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap"
          style={tab === 'evrak' ? { background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' } : { color: 'var(--text-muted)', border: '1px solid transparent' }}>
          <i className="ri-file-warning-line text-[10px]" />Evraklar
          {evraklar.length > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.2)', color: '#F59E0B' }}>{evraklar.length}</span>}
        </button>
        <button onClick={() => setTab('ekipman')}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap"
          style={tab === 'ekipman' ? { background: 'rgba(59,130,246,0.15)', color: '#60A5FA', border: '1px solid rgba(59,130,246,0.2)' } : { color: 'var(--text-muted)', border: '1px solid transparent' }}>
          <i className="ri-tools-line text-[10px]" />Ekipmanlar
          {ekipmanlar.length > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.2)', color: '#60A5FA' }}>{ekipmanlar.length}</span>}
        </button>
      </div>

      {tab === 'evrak' && (
        evraklar.length === 0 ? (
          <div className="py-6 text-center"><i className="ri-check-double-line text-xl" style={{ color: '#34D399' }} /><p className="text-[11px] mt-1 font-medium" style={{ color: '#34D399' }}>Yaklaşan evrak yok</p></div>
        ) : (
          <div className="space-y-1.5">
            {evraklar.map(ev => {
              const d = new Date(ev.gecerlilikTarihi!); d.setHours(0, 0, 0, 0);
              const days = Math.ceil((d.getTime() - today.getTime()) / 86400000);
              const isUrgent = days <= 15;
              return (
                <div key={ev.id} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5" style={{ background: 'var(--bg-item)', border: '1px solid var(--bg-item-border)' }}>
                  <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: isUrgent ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)' }}>
                    <i className="ri-file-warning-line text-xs" style={{ color: isUrgent ? '#EF4444' : '#F59E0B' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{ev.ad}</p>
                    <p className="text-[10.5px] truncate" style={{ color: 'var(--text-muted)' }}>{ev.tur}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1"
                    style={{ background: isUrgent ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)', color: isUrgent ? '#F87171' : '#FCD34D' }}>
                    <i className="ri-timer-line" />{days === 0 ? 'Bugün!' : `${days}g`}
                  </span>
                </div>
              );
            })}
          </div>
        )
      )}

      {tab === 'ekipman' && (
        ekipmanlar.length === 0 ? (
          <div className="py-6 text-center"><i className="ri-check-double-line text-xl" style={{ color: '#34D399' }} /><p className="text-[11px] mt-1 font-medium" style={{ color: '#34D399' }}>Yaklaşan ekipman kontrolü yok</p></div>
        ) : (
          <div className="space-y-1.5">
            {ekipmanlar.map(ek => {
              const d = new Date(ek.sonrakiKontrolTarihi); d.setHours(0, 0, 0, 0);
              const days = Math.ceil((d.getTime() - today.getTime()) / 86400000);
              const isUrgent = days <= 15;
              const firma = firmalar.find(f => f.id === ek.firmaId);
              return (
                <div key={ek.id} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5" style={{ background: 'var(--bg-item)', border: '1px solid var(--bg-item-border)' }}>
                  <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: isUrgent ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)' }}>
                    <i className="ri-tools-line text-xs" style={{ color: isUrgent ? '#EF4444' : '#60A5FA' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{ek.ad}</p>
                    <p className="text-[10.5px] truncate" style={{ color: 'var(--text-muted)' }}>{ek.tur}{firma ? ` · ${firma.ad}` : ''}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1"
                    style={{ background: isUrgent ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)', color: isUrgent ? '#F87171' : '#93C5FD' }}>
                    <i className="ri-timer-line" />{days === 0 ? 'Bugün!' : `${days}g`}
                  </span>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

function InsightEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-2.5">
      <div className="w-12 h-12 flex items-center justify-center rounded-xl" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.15)' }}>
        <i className="ri-check-double-line text-xl" style={{ color: '#10B981' }} />
      </div>
      <div className="text-center">
        <p className="text-[12.5px] font-semibold" style={{ color: '#34D399' }}>Yaklaşan süre yok</p>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Tüm kayıtlar güncel durumda</p>
        <div className="flex items-center justify-center gap-1.5 mt-2">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10B981' }} />
          <span className="text-[10.5px] font-medium" style={{ color: '#34D399' }}>Sistem sağlıklı</span>
        </div>
      </div>
    </div>
  );
}
