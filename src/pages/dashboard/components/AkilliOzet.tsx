import { useMemo, useState } from 'react';
import { useApp } from '@/store/AppContext';

interface InsightItem {
  id: string;
  icon: string;
  title: string;
  detail: string;
  color: string;
  bg: string;
  border: string;
  priority: number;
  level: 'critical' | 'warning' | 'info' | 'ok';
  module?: string;
  count?: number;
  subItems?: { icon: string; text: string; count: number; color: string }[];
}

function parseValidDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr || !dateStr.trim()) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

interface AkilliOzetProps {
  acikKontrolFormu: number;
  kontrolFormYuklendi: boolean;
}

export default function AkilliOzet({ acikKontrolFormu, kontrolFormYuklendi }: AkilliOzetProps) {
  const {
    firmalar, personeller, evraklar, egitimler, muayeneler,
    uygunsuzluklar, ekipmanlar, gorevler, isIzinleri,
    setActiveModule,
  } = useApp();

  const [expanded, setExpanded] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');

  const aktifFirmalar      = useMemo(() => firmalar.filter(f => !f.silinmis), [firmalar]);
  const aktifPersoneller   = useMemo(() => personeller.filter(p => !p.silinmis), [personeller]);
  const aktifEvraklar      = useMemo(() => evraklar.filter(e => !e.silinmis), [evraklar]);
  const aktifEgitimler     = useMemo(() => egitimler.filter(e => !e.silinmis), [egitimler]);
  const aktifMuayeneler    = useMemo(() => muayeneler.filter(m => !m.silinmis), [muayeneler]);
  const aktifUygunsuzluklar= useMemo(() => uygunsuzluklar.filter(u => !u.silinmis), [uygunsuzluklar]);
  const aktifEkipmanlar    = useMemo(() => ekipmanlar.filter(e => !e.silinmis), [ekipmanlar]);
  const aktifGorevler      = useMemo(() => gorevler.filter(g => !g.silinmis), [gorevler]);
  const aktifIsIzinleri    = useMemo(() => isIzinleri.filter(iz => !iz.silinmis), [isIzinleri]);

  const insights = useMemo((): InsightItem[] => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in7   = new Date(today.getTime() + 7  * 86400000);
    const in30  = new Date(today.getTime() + 30 * 86400000);
    const list: InsightItem[] = [];

    // ── KRİTİK ──
    const uygunDegil = aktifEkipmanlar.filter(e => e.durum === 'Uygun Değil');
    if (uygunDegil.length > 0) {
      list.push({
        id: 'ekipman-uygun-degil',
        icon: 'ri-error-warning-fill',
        title: `${uygunDegil.length} Ekipman Uygun Değil`,
        detail: uygunDegil.slice(0, 3).map(e => e.ad).join(', ') + (uygunDegil.length > 3 ? ` +${uygunDegil.length - 3} daha` : ''),
        color: '#EF4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)',
        priority: 100, level: 'critical', module: 'ekipmanlar', count: uygunDegil.length,
      });
    }

    const gecikmisBelge = aktifEvraklar.filter(e => {
      const d = parseValidDate(e.gecerlilikTarihi);
      return d !== null && d < today;
    });
    if (gecikmisBelge.length > 0) {
      list.push({
        id: 'belge-suresi-dolmus',
        icon: 'ri-file-damage-line',
        title: `${gecikmisBelge.length} Evrak Süresi Dolmuş`,
        detail: gecikmisBelge.slice(0, 3).map(e => e.ad).join(', ') + (gecikmisBelge.length > 3 ? ` +${gecikmisBelge.length - 3} daha` : ''),
        color: '#EF4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)',
        priority: 95, level: 'critical', module: 'evraklar', count: gecikmisBelge.length,
      });
    }

    const gecikmisEkipman = aktifEkipmanlar.filter(e => {
      if (e.durum === 'Uygun Değil') return false;
      const d = parseValidDate(e.sonrakiKontrolTarihi);
      return d !== null && d < today;
    });
    if (gecikmisEkipman.length > 0) {
      list.push({
        id: 'ekipman-kontrol-gecikti',
        icon: 'ri-tools-line',
        title: `${gecikmisEkipman.length} Ekipman Kontrolü Gecikti`,
        detail: gecikmisEkipman.slice(0, 3).map(e => e.ad).join(', ') + (gecikmisEkipman.length > 3 ? ` +${gecikmisEkipman.length - 3} daha` : ''),
        color: '#EF4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)',
        priority: 90, level: 'critical', module: 'ekipmanlar', count: gecikmisEkipman.length,
      });
    }

    const gecikmisMuayene = aktifMuayeneler.filter(m => {
      const d = parseValidDate(m.sonrakiTarih || m.muayeneTarihi);
      return d !== null && d < today;
    });
    if (gecikmisMuayene.length > 0) {
      list.push({
        id: 'muayene-gecikti',
        icon: 'ri-heart-pulse-line',
        title: `${gecikmisMuayene.length} Muayene Tarihi Geçti`,
        detail: gecikmisMuayene.slice(0, 3).map(m => {
          const p = aktifPersoneller.find(p => p.id === m.personelId);
          return p ? p.adSoyad : 'Personel';
        }).join(', ') + (gecikmisMuayene.length > 3 ? ` +${gecikmisMuayene.length - 3} daha` : ''),
        color: '#EF4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)',
        priority: 88, level: 'critical', module: 'saglik', count: gecikmisMuayene.length,
      });
    }

    // ── UYARI ──
    const gecikmisgGorev = aktifGorevler.filter(g => {
      if (g.durum === 'Tamamlandı') return false;
      if (!g.bitisTarihi) return false;
      return new Date(g.bitisTarihi) < today;
    });
    if (gecikmisgGorev.length > 0) {
      list.push({
        id: 'gorev-gecikti',
        icon: 'ri-task-line',
        title: `${gecikmisgGorev.length} Görev Gecikmiş`,
        detail: gecikmisgGorev.slice(0, 3).map(g => g.baslik || 'Görev').join(', ') + (gecikmisgGorev.length > 3 ? ` +${gecikmisgGorev.length - 3} daha` : ''),
        color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)',
        priority: 85, level: 'warning', module: 'gorevler', count: gecikmisgGorev.length,
      });
    }

    const acikUygunsuzluk = aktifUygunsuzluklar.filter(u => u.durum === 'Açık');
    if (acikUygunsuzluk.length > 0) {
      list.push({
        id: 'acik-uygunsuzluk',
        icon: 'ri-alert-line',
        title: `${acikUygunsuzluk.length} Açık Uygunsuzluk`,
        detail: `${acikUygunsuzluk.length} kayıt kapatılmayı bekliyor`,
        color: '#F87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)',
        priority: 80, level: 'warning', module: 'uygunsuzluklar', count: acikUygunsuzluk.length,
      });
    }

    if (acikKontrolFormu > 0 && kontrolFormYuklendi) {
      list.push({
        id: 'kontrol-formu',
        icon: 'ri-folder-shield-2-line',
        title: `${acikKontrolFormu} Kontrol Formu Tarihi Geçti`,
        detail: 'Kontrol formları güncellenmeli',
        color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)',
        priority: 75, level: 'warning', count: acikKontrolFormu,
      });
    }

    const bekleyenIsIzni = aktifIsIzinleri.filter(iz => iz.durum === 'Beklemede' || iz.durum === 'İncelemede');
    if (bekleyenIsIzni.length > 0) {
      list.push({
        id: 'is-izni-bekliyor',
        icon: 'ri-shield-check-line',
        title: `${bekleyenIsIzni.length} İş İzni Onay Bekliyor`,
        detail: bekleyenIsIzni.slice(0, 3).map(iz => iz.baslik || iz.tip || 'İzin').join(', '),
        color: '#A78BFA', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.2)',
        priority: 70, level: 'warning', module: 'is-izni', count: bekleyenIsIzni.length,
      });
    }

    // ── BİLGİ ──
    const yaklasan7Sub: InsightItem['subItems'] = [];
    const yaklasan7Belge = aktifEvraklar.filter(e => {
      const d = parseValidDate(e.gecerlilikTarihi);
      return d !== null && d >= today && d <= in7;
    });
    const yaklasan7Ekipman = aktifEkipmanlar.filter(e => {
      if (e.durum === 'Uygun Değil') return false;
      const d = parseValidDate(e.sonrakiKontrolTarihi);
      return d !== null && d >= today && d <= in7;
    });
    const yaklasan7Muayene = aktifMuayeneler.filter(m => {
      const d = parseValidDate(m.sonrakiTarih || m.muayeneTarihi);
      return d !== null && d >= today && d <= in7;
    });
    if (yaklasan7Belge.length > 0) yaklasan7Sub.push({ icon: 'ri-file-warning-line', text: 'Evrak', count: yaklasan7Belge.length, color: '#94A3B8' });
    if (yaklasan7Ekipman.length > 0) yaklasan7Sub.push({ icon: 'ri-tools-line', text: 'Ekipman', count: yaklasan7Ekipman.length, color: '#FB923C' });
    if (yaklasan7Muayene.length > 0) yaklasan7Sub.push({ icon: 'ri-heart-pulse-line', text: 'Muayene', count: yaklasan7Muayene.length, color: '#34D399' });
    const toplam7 = yaklasan7Belge.length + yaklasan7Ekipman.length + yaklasan7Muayene.length;
    if (toplam7 > 0) {
      list.push({
        id: 'yaklasan-7',
        icon: 'ri-alarm-warning-line',
        title: `${toplam7} İşlem 7 Gün İçinde Sona Eriyor`,
        detail: yaklasan7Sub.map(s => `${s.count} ${s.text}`).join(' · '),
        color: '#F59E0B', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.15)',
        priority: 65, level: 'info', count: toplam7, subItems: yaklasan7Sub,
      });
    }

    const yaklasan30Sub: InsightItem['subItems'] = [];
    const yaklasan30Belge = aktifEvraklar.filter(e => {
      const d = parseValidDate(e.gecerlilikTarihi);
      return d !== null && d > in7 && d <= in30;
    });
    const yaklasan30Ekipman = aktifEkipmanlar.filter(e => {
      if (e.durum === 'Uygun Değil') return false;
      const d = parseValidDate(e.sonrakiKontrolTarihi);
      return d !== null && d > in7 && d <= in30;
    });
    const yaklasan30Muayene = aktifMuayeneler.filter(m => {
      const d = parseValidDate(m.sonrakiTarih || m.muayeneTarihi);
      return d !== null && d > in7 && d <= in30;
    });
    if (yaklasan30Belge.length > 0) yaklasan30Sub.push({ icon: 'ri-file-warning-line', text: 'Evrak', count: yaklasan30Belge.length, color: '#94A3B8' });
    if (yaklasan30Ekipman.length > 0) yaklasan30Sub.push({ icon: 'ri-tools-line', text: 'Ekipman', count: yaklasan30Ekipman.length, color: '#FB923C' });
    if (yaklasan30Muayene.length > 0) yaklasan30Sub.push({ icon: 'ri-heart-pulse-line', text: 'Muayene', count: yaklasan30Muayene.length, color: '#34D399' });
    const toplam30 = yaklasan30Belge.length + yaklasan30Ekipman.length + yaklasan30Muayene.length;
    if (toplam30 > 0) {
      list.push({
        id: 'yaklasan-30',
        icon: 'ri-timer-line',
        title: `${toplam30} İşlem 30 Gün İçinde Sona Eriyor`,
        detail: yaklasan30Sub.map(s => `${s.count} ${s.text}`).join(' · '),
        color: '#FBBF24', bg: 'rgba(251,191,36,0.06)', border: 'rgba(251,191,36,0.12)',
        priority: 55, level: 'info', count: toplam30, subItems: yaklasan30Sub,
      });
    }

    // Eğitim eksikliği
    const egitimSizPersonel = aktifPersoneller.filter(p => {
      return !aktifEgitimler.some(e => e.personelId === p.id || (e as unknown as Record<string, unknown>).katilimcilar?.includes?.(p.id));
    });
    if (egitimSizPersonel.length > 0 && aktifPersoneller.length > 0) {
      list.push({
        id: 'egitim-eksik',
        icon: 'ri-graduation-cap-line',
        title: `${egitimSizPersonel.length} Personelin Eğitim Kaydı Yok`,
        detail: egitimSizPersonel.slice(0, 3).map(p => p.adSoyad).join(', ') + (egitimSizPersonel.length > 3 ? ` +${egitimSizPersonel.length - 3} daha` : ''),
        color: '#60A5FA', bg: 'rgba(96,165,250,0.06)', border: 'rgba(96,165,250,0.15)',
        priority: 40, level: 'info', module: 'egitimler', count: egitimSizPersonel.length,
      });
    }

    // Ayrılan personel
    const ayrilanPersonel = aktifPersoneller.filter(p => p.durum === 'Ayrıldı');
    if (ayrilanPersonel.length > 0) {
      list.push({
        id: 'ayrilan-personel',
        icon: 'ri-user-unfollow-line',
        title: `${ayrilanPersonel.length} Personel Ayrıldı`,
        detail: ayrilanPersonel.slice(0, 3).map(p => p.adSoyad).join(', ') + (ayrilanPersonel.length > 3 ? ` +${ayrilanPersonel.length - 3} daha` : ''),
        color: '#94A3B8', bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.15)',
        priority: 30, level: 'info', module: 'personeller', count: ayrilanPersonel.length,
      });
    }

    if (list.length === 0) {
      list.push({
        id: 'all-ok',
        icon: 'ri-checkbox-circle-fill',
        title: 'Tüm Sistemler Normal',
        detail: 'Kritik veya uyarı gerektiren durum bulunmuyor',
        color: '#34D399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.2)',
        priority: 0, level: 'ok',
      });
    }

    return list.sort((a, b) => b.priority - a.priority);
  }, [
    aktifEkipmanlar, aktifEvraklar, aktifMuayeneler, aktifGorevler,
    aktifUygunsuzluklar, aktifIsIzinleri, aktifPersoneller, aktifEgitimler,
    acikKontrolFormu, kontrolFormYuklendi,
  ]);

  // Sağlık skoru hesapla
  const healthScore = useMemo(() => {
    const criticalCount = insights.filter(i => i.level === 'critical').reduce((s, i) => s + (i.count || 1), 0);
    const warningCount  = insights.filter(i => i.level === 'warning').reduce((s, i) => s + (i.count || 1), 0);
    const total = aktifEvraklar.length + aktifEkipmanlar.length + aktifMuayeneler.length + aktifGorevler.length;
    if (total === 0) return 100;
    const penalty = (criticalCount * 3 + warningCount * 1.5);
    const score = Math.max(0, Math.min(100, Math.round(100 - (penalty / Math.max(total, 1)) * 100)));
    return score;
  }, [insights, aktifEvraklar, aktifEkipmanlar, aktifMuayeneler, aktifGorevler]);

  const scoreColor = healthScore >= 80 ? '#34D399' : healthScore >= 50 ? '#F59E0B' : '#EF4444';
  const scoreLabel = healthScore >= 80 ? 'İyi' : healthScore >= 50 ? 'Dikkat' : 'Kritik';
  const scoreBg    = healthScore >= 80 ? 'rgba(52,211,153,0.1)' : healthScore >= 50 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)';

  const criticalItems = insights.filter(i => i.level === 'critical');
  const warningItems  = insights.filter(i => i.level === 'warning');
  const infoItems     = insights.filter(i => i.level === 'info');

  const filteredInsights = activeFilter === 'all' ? insights
    : activeFilter === 'critical' ? criticalItems
    : activeFilter === 'warning'  ? warningItems
    : infoItems;

  const levelConfig = {
    critical: { label: 'Kritik', color: '#EF4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)', icon: 'ri-error-warning-fill' },
    warning:  { label: 'Uyarı',  color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)', icon: 'ri-alert-line' },
    info:     { label: 'Bilgi',  color: '#60A5FA', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.2)', icon: 'ri-information-line' },
    ok:       { label: 'Tamam',  color: '#34D399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.2)', icon: 'ri-checkbox-circle-fill' },
  };

  return (
    <div className="rounded-2xl overflow-hidden isg-card h-full flex flex-col">
      <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${scoreColor}, ${scoreColor}80)` }} />

      {/* Header */}
      <div className="px-5 pt-4 pb-3" style={{ borderBottom: '1px solid var(--bg-item-border)' }}>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
            <i className="ri-brain-line text-white text-sm" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[13.5px] font-bold" style={{ color: 'var(--text-primary)' }}>Akıllı Özet</h2>
            <p className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>Sistem durumu analizi</p>
          </div>
          {/* Sağlık Skoru */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl flex-shrink-0"
            style={{ background: scoreBg, border: `1px solid ${scoreColor}30` }}>
            <div className="relative w-8 h-8 flex-shrink-0">
              <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="12" fill="none" stroke="var(--bg-item)" strokeWidth="3" />
                <circle cx="16" cy="16" r="12" fill="none" stroke={scoreColor} strokeWidth="3"
                  strokeDasharray={`${(healthScore / 100) * 75.4} 75.4`}
                  strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black" style={{ color: scoreColor }}>
                {healthScore}
              </span>
            </div>
            <div>
              <p className="text-[11px] font-black" style={{ color: scoreColor }}>{scoreLabel}</p>
              <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Sağlık Skoru</p>
            </div>
          </div>
        </div>

        {/* Özet sayaçlar */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Kritik', count: criticalItems.length, ...levelConfig.critical },
            { label: 'Uyarı',  count: warningItems.length,  ...levelConfig.warning },
            { label: 'Bilgi',  count: infoItems.length,     ...levelConfig.info },
          ].map(item => (
            <button
              key={item.label}
              onClick={() => setActiveFilter(activeFilter === item.label.toLowerCase() as typeof activeFilter ? 'all' : item.label.toLowerCase() as typeof activeFilter)}
              className="rounded-lg p-2 text-center cursor-pointer transition-all"
              style={{
                background: activeFilter === item.label.toLowerCase() ? item.bg : 'var(--bg-item)',
                border: `1px solid ${activeFilter === item.label.toLowerCase() ? item.border : 'var(--bg-item-border)'}`,
              }}
            >
              <p className="text-[16px] font-black" style={{ color: item.count > 0 ? item.color : 'var(--text-muted)' }}>{item.count}</p>
              <p className="text-[9.5px] font-semibold" style={{ color: item.count > 0 ? item.color : 'var(--text-muted)' }}>{item.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Filtre tab */}
      {activeFilter !== 'all' && (
        <div className="px-5 pt-3 pb-0">
          <div className="flex items-center gap-1.5 text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
            <i className="ri-filter-3-line" />
            <span>Filtre:</span>
            <span className="font-bold" style={{ color: levelConfig[activeFilter as keyof typeof levelConfig]?.color }}>
              {levelConfig[activeFilter as keyof typeof levelConfig]?.label}
            </span>
            <button onClick={() => setActiveFilter('all')} className="ml-auto flex items-center gap-1 cursor-pointer"
              style={{ color: 'var(--text-muted)' }}>
              <i className="ri-close-line" /> Temizle
            </button>
          </div>
        </div>
      )}

      {/* İnsight listesi */}
      <div className="flex-1 overflow-y-auto p-5 pt-3 space-y-2" style={{ maxHeight: '420px' }}>
        {filteredInsights.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl"
              style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}>
              <i className="ri-checkbox-circle-line text-lg" style={{ color: '#34D399' }} />
            </div>
            <p className="text-[12px] font-semibold" style={{ color: '#34D399' }}>Bu kategoride sorun yok</p>
          </div>
        ) : (
          filteredInsights.map(insight => {
            const cfg = levelConfig[insight.level];
            const isOpen = expanded === insight.id;
            return (
              <div key={insight.id} className="rounded-xl overflow-hidden transition-all"
                style={{ background: insight.bg, border: `1px solid ${insight.border}` }}>
                <button
                  className="w-full flex items-start gap-2.5 px-3 py-2.5 cursor-pointer text-left"
                  onClick={() => setExpanded(isOpen ? null : insight.id)}
                >
                  {/* Level badge */}
                  <div className="w-6 h-6 flex items-center justify-center rounded-md flex-shrink-0 mt-0.5"
                    style={{ background: `${insight.color}18` }}>
                    <i className={`${insight.icon} text-[10px]`} style={{ color: insight.color }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                        style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                        {cfg.label}
                      </span>
                      {insight.count !== undefined && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                          style={{ background: `${insight.color}15`, color: insight.color }}>
                          {insight.count}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
                      {insight.title}
                    </p>
                    {!isOpen && (
                      <p className="text-[10.5px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                        {insight.detail}
                      </p>
                    )}
                  </div>

                  {isOpen
                    ? <i className="ri-arrow-up-s-line text-sm flex-shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }} />
                    : <i className="ri-arrow-down-s-line text-sm flex-shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }} />
                  }
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="px-3 pb-3">
                    <p className="text-[11px] mb-2.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {insight.detail}
                    </p>
                    {insight.subItems && insight.subItems.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2.5">
                        {insight.subItems.map((sub, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium"
                            style={{ background: `${sub.color}15`, border: `1px solid ${sub.color}25`, color: sub.color }}>
                            <i className={`${sub.icon} text-[9px]`} />
                            <span>{sub.count} {sub.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {insight.module && (
                      <button
                        onClick={() => setActiveModule(insight.module as Parameters<typeof setActiveModule>[0])}
                        className="flex items-center gap-1.5 text-[10.5px] font-bold px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap transition-all"
                        style={{ background: `${insight.color}15`, color: insight.color, border: `1px solid ${insight.color}25` }}
                      >
                        <i className="ri-arrow-right-up-line text-[10px]" />
                        Modüle Git
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3" style={{ borderTop: '1px solid var(--bg-item-border)' }}>
        <div className="flex items-center justify-between">
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <i className="ri-refresh-line mr-1" />
            Gerçek zamanlı güncelleniyor
          </p>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: scoreColor }} />
            <span className="text-[10px] font-semibold" style={{ color: scoreColor }}>{scoreLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
