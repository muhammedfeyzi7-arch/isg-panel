import { useMemo } from 'react';

interface KazaRow {
  id: string;
  kazaTarihi: string;
  kazaYeri: string;
  kazaTuru: string;
  yaralanmaSiddeti: string;
  isGunuKaybi: number;
  hastaneyeKaldirildi: boolean;
  durum: string;
  firmaAd: string;
  yaraliVucutBolgeleri: string[];
  personelAd: string;
}

interface Props {
  kazalar: KazaRow[];
  isDark: boolean;
}

const ACCENT = '#0EA5E9';

const VUCUT_LABEL: Record<string, string> = {
  bas: 'Baş', boyun: 'Boyun', sag_omuz: 'Sağ Omuz', sol_omuz: 'Sol Omuz',
  gogus: 'Göğüs', sirt: 'Sırt', sag_kol: 'Sağ Kol', sol_kol: 'Sol Kol',
  sag_el: 'Sağ El', sol_el: 'Sol El', karin: 'Karın/Bel',
  sag_kalca: 'Sağ Kalça', sol_kalca: 'Sol Kalça',
  sag_bacak: 'Sağ Bacak', sol_bacak: 'Sol Bacak',
  sag_ayak: 'Sağ Ayak', sol_ayak: 'Sol Ayak',
};

function getMonthLabel(date: Date) {
  return date.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
}

export default function HekimIsKazasiRaporBolumu({ kazalar, isDark }: Props) {
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const borderColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)';
  const cardBg = isDark ? 'rgba(255,255,255,0.03)' : '#ffffff';
  const subtleBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.025)';

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const stats = useMemo(() => {
    const buAyKazalar = kazalar.filter(k => {
      if (!k.kazaTarihi) return false;
      const key = k.kazaTarihi.substring(0, 7);
      return key === currentMonthKey;
    });

    const gecenAyKazalar = kazalar.filter(k => {
      if (!k.kazaTarihi) return false;
      const key = k.kazaTarihi.substring(0, 7);
      return key === prevMonthKey;
    });

    // Aylara göre grupla (son 6 ay)
    const ayGrubu: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      ayGrubu[key] = 0;
    }
    kazalar.forEach(k => {
      if (!k.kazaTarihi) return;
      const key = k.kazaTarihi.substring(0, 7);
      if (key in ayGrubu) ayGrubu[key]++;
    });

    // Kaza yerine göre grupla
    const yerGrubu: Record<string, number> = {};
    kazalar.forEach(k => {
      const yer = k.kazaYeri || 'Belirtilmemiş';
      yerGrubu[yer] = (yerGrubu[yer] || 0) + 1;
    });

    // Kaza türüne göre grupla
    const turGrubu: Record<string, number> = {};
    kazalar.forEach(k => {
      const tur = k.kazaTuru || 'Diğer';
      turGrubu[tur] = (turGrubu[tur] || 0) + 1;
    });

    // Şiddet dağılımı
    const siddetGrubu: Record<string, number> = { Hafif: 0, Orta: 0, Ağır: 0, 'Çok Ağır': 0 };
    kazalar.forEach(k => {
      const s = k.yaralanmaSiddeti || 'Hafif';
      if (s in siddetGrubu) siddetGrubu[s]++;
      else siddetGrubu['Hafif']++;
    });

    // Vücut bölgesi dağılımı
    const bolgeGrubu: Record<string, number> = {};
    kazalar.forEach(k => {
      (k.yaraliVucutBolgeleri ?? []).forEach(b => {
        bolgeGrubu[b] = (bolgeGrubu[b] || 0) + 1;
      });
    });

    // Firmaya göre
    const firmaGrubu: Record<string, number> = {};
    kazalar.forEach(k => {
      firmaGrubu[k.firmaAd] = (firmaGrubu[k.firmaAd] || 0) + 1;
    });

    // En fazla kaza günü
    const gunGrubu: Record<string, number> = {};
    kazalar.forEach(k => {
      if (!k.kazaTarihi) return;
      const gun = new Date(k.kazaTarihi).toLocaleDateString('tr-TR', { weekday: 'long' });
      gunGrubu[gun] = (gunGrubu[gun] || 0) + 1;
    });

    const topYerler = Object.entries(yerGrubu).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topTurler = Object.entries(turGrubu).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topBolgeler = Object.entries(bolgeGrubu).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const topFirmalar = Object.entries(firmaGrubu).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topGunler = Object.entries(gunGrubu).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const enFazlaGun = topGunler[0]?.[0] ?? '—';
    const hastaneSayisi = kazalar.filter(k => k.hastaneyeKaldirildi).length;
    const toplamGunKaybi = kazalar.reduce((s, k) => s + (k.isGunuKaybi || 0), 0);

    return {
      buAy: buAyKazalar.length,
      gecenAy: gecenAyKazalar.length,
      buAyGunKaybi: buAyKazalar.reduce((s, k) => s + (k.isGunuKaybi || 0), 0),
      ayGrubu,
      siddetGrubu,
      topYerler,
      topTurler,
      topBolgeler,
      topFirmalar,
      topGunler,
      enFazlaGun,
      hastaneSayisi,
      toplamGunKaybi,
      trend: buAyKazalar.length - gecenAyKazalar.length,
    };
  }, [kazalar, currentMonthKey, prevMonthKey]);

  const ayEtiketleri = Object.keys(stats.ayGrubu).map(key => {
    const [y, m] = key.split('-');
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('tr-TR', { month: 'short' });
  });
  const ayDegerleri = Object.values(stats.ayGrubu);
  const maxAy = Math.max(...ayDegerleri, 1);

  const siddetRenkler: Record<string, { color: string; bg: string }> = {
    'Hafif':    { color: ACCENT,    bg: 'rgba(14,165,233,0.15)' },
    'Orta':     { color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
    'Ağır':     { color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
    'Çok Ağır': { color: '#F97316', bg: 'rgba(249,115,22,0.15)' },
  };

  if (kazalar.length === 0) {
    return (
      <div className="rounded-2xl p-14 flex flex-col items-center gap-5"
        style={{ background: cardBg, border: `1px solid ${borderColor}` }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(16,185,129,0.08)', border: '1.5px solid rgba(16,185,129,0.15)' }}>
          <i className="ri-bar-chart-grouped-line text-2xl" style={{ color: '#10B981' }} />
        </div>
        <div className="text-center">
          <p className="text-base font-bold mb-2" style={{ color: textPrimary }}>Rapor için veri yok</p>
          <p className="text-sm" style={{ color: textSecondary }}>İş kazası kaydı oluşturulduğunda istatistikler burada görünür.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Başlık ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color: textPrimary, letterSpacing: '-0.02em' }}>Kaza Analiz Raporu</h2>
          <p className="text-xs mt-0.5" style={{ color: textSecondary }}>Toplam {kazalar.length} kaza kaydının istatistiksel analizi</p>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-full"
          style={{ background: 'rgba(14,165,233,0.1)', color: ACCENT, border: '1px solid rgba(14,165,233,0.2)' }}>
          <i className="ri-refresh-line" />Canlı Veri
        </span>
      </div>

      {/* ── Üst KPI Bantı ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Bu Ay Kaza',
            value: stats.buAy,
            icon: 'ri-calendar-event-line',
            color: '#EF4444',
            bg: 'rgba(239,68,68,0.08)',
            border: 'rgba(239,68,68,0.18)',
            sub: `Geçen ay: ${stats.gecenAy}`,
            trend: stats.trend,
          },
          {
            label: 'Hastane Vakası',
            value: stats.hastaneSayisi,
            icon: 'ri-hospital-line',
            color: '#F97316',
            bg: 'rgba(249,115,22,0.08)',
            border: 'rgba(249,115,22,0.18)',
            sub: `Toplam ${kazalar.length} içinde`,
            trend: null,
          },
          {
            label: 'Bu Ay Kayıp Gün',
            value: stats.buAyGunKaybi,
            icon: 'ri-calendar-close-line',
            color: '#F59E0B',
            bg: 'rgba(245,158,11,0.08)',
            border: 'rgba(245,158,11,0.18)',
            sub: `Toplam: ${stats.toplamGunKaybi} gün`,
            trend: null,
          },
          {
            label: 'En Riskli Gün',
            value: stats.enFazlaGun,
            icon: 'ri-sun-line',
            color: '#8B5CF6',
            bg: 'rgba(139,92,246,0.08)',
            border: 'rgba(139,92,246,0.18)',
            sub: `${stats.topGunler[0]?.[1] ?? 0} kaza`,
            trend: null,
            isText: true,
          },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-2xl p-4 relative overflow-hidden transition-all duration-200"
            style={{ background: kpi.bg, border: `1px solid ${kpi.border}` }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
          >
            <div className="absolute -right-3 -top-3 w-14 h-14 rounded-full opacity-10" style={{ background: kpi.color }} />
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `${kpi.color}20`, border: `1px solid ${kpi.color}30` }}>
                <i className={`${kpi.icon} text-sm`} style={{ color: kpi.color }} />
              </div>
              {kpi.trend !== null && kpi.trend !== undefined && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                  style={{
                    background: kpi.trend > 0 ? 'rgba(239,68,68,0.15)' : kpi.trend < 0 ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)',
                    color: kpi.trend > 0 ? '#EF4444' : kpi.trend < 0 ? '#10B981' : '#94A3B8',
                  }}>
                  {kpi.trend > 0 ? `↑ +${kpi.trend}` : kpi.trend < 0 ? `↓ ${kpi.trend}` : '→ 0'}
                </span>
              )}
            </div>
            {kpi.isText
              ? <p className="text-lg font-black leading-tight mb-0.5" style={{ color: kpi.color, fontFamily: "'Inter',sans-serif", letterSpacing: '-0.02em' }}>{kpi.value}</p>
              : <p className="text-3xl font-black leading-none mb-1" style={{ color: kpi.color, fontFamily: "'Inter',sans-serif", letterSpacing: '-0.04em' }}>{kpi.value}</p>
            }
            <p className="text-[11px] font-bold mb-0.5" style={{ color: textPrimary }}>{kpi.label}</p>
            <p className="text-[9px]" style={{ color: textSecondary }}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Aylık Trend Grafiği ── */}
      <div className="rounded-2xl p-5" style={{ background: cardBg, border: `1px solid ${borderColor}` }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-bold" style={{ color: textPrimary }}>Aylık Kaza Trendi</p>
            <p className="text-[11px] mt-0.5" style={{ color: textSecondary }}>Son 6 aylık kaza dağılımı</p>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-semibold"
            style={{ color: textSecondary }}>
            <i className="ri-bar-chart-2-line" />Son 6 Ay
          </div>
        </div>

        {/* Bar chart */}
        <div className="flex items-end gap-2 h-28">
          {ayDegerleri.map((val, i) => {
            const heightPct = maxAy > 0 ? (val / maxAy) * 100 : 0;
            const isCurrentMonth = i === ayDegerleri.length - 1;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <span className="text-[9px] font-bold" style={{ color: val > 0 ? (isCurrentMonth ? '#EF4444' : textSecondary) : textSecondary }}>
                  {val > 0 ? val : ''}
                </span>
                <div className="w-full rounded-t-md transition-all duration-500 relative overflow-hidden"
                  style={{
                    height: `${Math.max(heightPct * 0.8, val > 0 ? 8 : 3)}px`,
                    background: isCurrentMonth
                      ? 'linear-gradient(180deg, #EF4444, #DC2626)'
                      : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.12)'),
                    minHeight: 3,
                  }}
                >
                  {isCurrentMonth && val > 0 && (
                    <div className="absolute inset-0 opacity-40"
                      style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.3), transparent)' }} />
                  )}
                </div>
                <span className="text-[9px]" style={{ color: isCurrentMonth ? '#EF4444' : textSecondary, fontWeight: isCurrentMonth ? 700 : 400 }}>
                  {ayEtiketleri[i]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 2 sütun: Yer + Tür ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

        {/* En çok kaza yaşanan yerler */}
        <div className="rounded-2xl p-4" style={{ background: cardBg, border: `1px solid ${borderColor}` }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <i className="ri-map-pin-2-line text-xs" style={{ color: '#EF4444' }} />
            </div>
            <div>
              <p className="text-xs font-bold" style={{ color: textPrimary }}>Kaza Bölgeleri</p>
              <p className="text-[10px]" style={{ color: textSecondary }}>En çok kaza yaşanan yerler</p>
            </div>
          </div>
          <div className="space-y-2.5">
            {stats.topYerler.length === 0 && (
              <p className="text-xs italic" style={{ color: textSecondary }}>Yer bilgisi girilmemiş</p>
            )}
            {stats.topYerler.map(([yer, sayi], i) => {
              const pct = Math.round((sayi / kazalar.length) * 100);
              return (
                <div key={yer}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold w-4 text-center" style={{ color: textSecondary }}>#{i + 1}</span>
                      <span className="text-[11px] font-semibold" style={{ color: textPrimary }}>{yer}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold" style={{ color: '#EF4444' }}>{sayi}</span>
                      <span className="text-[9px]" style={{ color: textSecondary }}>%{pct}</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.07)' }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: `linear-gradient(90deg, #DC2626, #EF4444)` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Kaza türleri */}
        <div className="rounded-2xl p-4" style={{ background: cardBg, border: `1px solid ${borderColor}` }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <i className="ri-list-check-3 text-xs" style={{ color: '#F59E0B' }} />
            </div>
            <div>
              <p className="text-xs font-bold" style={{ color: textPrimary }}>Kaza Türleri</p>
              <p className="text-[10px]" style={{ color: textSecondary }}>Mekanizma dağılımı</p>
            </div>
          </div>
          <div className="space-y-2.5">
            {stats.topTurler.length === 0 && (
              <p className="text-xs italic" style={{ color: textSecondary }}>Tür bilgisi girilmemiş</p>
            )}
            {stats.topTurler.map(([tur, sayi], i) => {
              const pct = Math.round((sayi / kazalar.length) * 100);
              return (
                <div key={tur}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold w-4 text-center" style={{ color: textSecondary }}>#{i + 1}</span>
                      <span className="text-[11px] font-semibold" style={{ color: textPrimary }}>{tur}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold" style={{ color: '#F59E0B' }}>{sayi}</span>
                      <span className="text-[9px]" style={{ color: textSecondary }}>%{pct}</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.07)' }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: `linear-gradient(90deg, #D97706, #F59E0B)` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 3 sütun: Şiddet + Vücut Bölgeleri + Firma Dağılımı ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

        {/* Şiddet Dağılımı */}
        <div className="rounded-2xl p-4" style={{ background: cardBg, border: `1px solid ${borderColor}` }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)' }}>
              <i className="ri-first-aid-kit-line text-xs" style={{ color: '#F97316' }} />
            </div>
            <p className="text-xs font-bold" style={{ color: textPrimary }}>Şiddet Dağılımı</p>
          </div>
          <div className="space-y-2">
            {Object.entries(stats.siddetGrubu).map(([siddet, sayi]) => {
              const cfg = siddetRenkler[siddet] ?? siddetRenkler['Hafif'];
              const pct = kazalar.length > 0 ? Math.round((sayi / kazalar.length) * 100) : 0;
              return (
                <div key={siddet} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                  style={{ background: sayi > 0 ? cfg.bg : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)') }}>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[11px] font-semibold" style={{ color: sayi > 0 ? cfg.color : textSecondary }}>{siddet}</span>
                      <span className="text-[10px] font-black" style={{ color: cfg.color }}>{sayi}</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cfg.color }} />
                    </div>
                  </div>
                  <span className="text-[9px] font-semibold w-8 text-right flex-shrink-0" style={{ color: textSecondary }}>%{pct}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Vücut Bölgeleri */}
        <div className="rounded-2xl p-4" style={{ background: cardBg, border: `1px solid ${borderColor}` }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <i className="ri-body-scan-line text-xs" style={{ color: '#EF4444' }} />
            </div>
            <p className="text-xs font-bold" style={{ color: textPrimary }}>Vücut Bölgeleri</p>
          </div>
          {stats.topBolgeler.length === 0 ? (
            <p className="text-xs italic" style={{ color: textSecondary }}>Bölge bilgisi girilmemiş</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {stats.topBolgeler.map(([bolge, sayi]) => (
                <div key={bolge} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}>
                  <span className="text-[10px] font-semibold" style={{ color: '#EF4444' }}>
                    {VUCUT_LABEL[bolge] ?? bolge}
                  </span>
                  <span className="text-[9px] font-black px-1 py-0.5 rounded-full"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>{sayi}</span>
                </div>
              ))}
            </div>
          )}

          {/* Haftalık dağılım */}
          {stats.topGunler.length > 0 && (
            <div className="mt-4">
              <p className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: textSecondary }}>Haftanın Günleri</p>
              <div className="space-y-1.5">
                {stats.topGunler.map(([gun, sayi]) => (
                  <div key={gun} className="flex items-center gap-2">
                    <span className="text-[10px] w-20 flex-shrink-0" style={{ color: textSecondary }}>{gun}</span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.07)' }}>
                      <div className="h-full rounded-full"
                        style={{ width: `${(sayi / (stats.topGunler[0]?.[1] ?? 1)) * 100}%`, background: '#8B5CF6' }} />
                    </div>
                    <span className="text-[9px] font-bold w-4 text-right flex-shrink-0" style={{ color: '#8B5CF6' }}>{sayi}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Firma Bazlı Dağılım */}
        <div className="rounded-2xl p-4" style={{ background: cardBg, border: `1px solid ${borderColor}` }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: `rgba(14,165,233,0.1)`, border: `1px solid rgba(14,165,233,0.2)` }}>
              <i className="ri-building-3-line text-xs" style={{ color: ACCENT }} />
            </div>
            <p className="text-xs font-bold" style={{ color: textPrimary }}>Firmaya Göre Kazalar</p>
          </div>
          <div className="space-y-2.5">
            {stats.topFirmalar.length === 0 && (
              <p className="text-xs italic" style={{ color: textSecondary }}>Veri yok</p>
            )}
            {stats.topFirmalar.map(([firma, sayi], i) => {
              const pct = Math.round((sayi / kazalar.length) * 100);
              return (
                <div key={firma}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 text-[8px] font-black text-white"
                        style={{ background: `linear-gradient(135deg, ${ACCENT}, #0284C7)` }}>
                        {firma.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-[11px] font-semibold truncate max-w-[100px]" style={{ color: textPrimary }}>{firma}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black" style={{ color: ACCENT }}>{sayi}</span>
                      <span className="text-[9px]" style={{ color: textSecondary }}>%{pct}</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.07)' }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: `linear-gradient(90deg, #0284C7, ${ACCENT})` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Son 5 kaza özet tablosu */}
      <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${borderColor}` }}>
        <div className="px-5 py-3.5" style={{ borderBottom: `1px solid ${borderColor}`, background: subtleBg }}>
          <p className="text-xs font-bold" style={{ color: textPrimary }}>Son Kayıtlı Kazalar</p>
        </div>
        <div className="divide-y" style={{ borderColor }}>
          {kazalar.slice(0, 5).map(k => {
            const siddetCfg = siddetRenkler[k.yaralanmaSiddeti] ?? siddetRenkler['Hafif'];
            return (
              <div key={k.id} className="flex items-center gap-4 px-5 py-3 transition-all"
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.02)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                  style={{ background: `linear-gradient(135deg, #DC2626, #EF4444)` }}>
                  {k.personelAd.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: textPrimary }}>{k.personelAd}</p>
                  <p className="text-[10px]" style={{ color: textSecondary }}>{k.firmaAd} · {k.kazaYeri || 'Yer belirtilmemiş'}</p>
                </div>
                <div className="hidden sm:block text-[11px]" style={{ color: textSecondary }}>
                  {k.kazaTarihi ? new Date(k.kazaTarihi).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }) : '—'}
                </div>
                <span className="text-[9px] font-bold px-2 py-1 rounded-full whitespace-nowrap"
                  style={{ background: siddetCfg.bg, color: siddetCfg.color }}>
                  {k.yaralanmaSiddeti}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
