import { useMemo } from 'react';
import { useApp } from '@/store/AppContext';

function getDaysUntil(dateStr: string): number {
  if (!dateStr) return 9999;
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / 86400000);
}

// Basit bar chart bileşeni
function BarChart({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="space-y-2">
      {data.map(d => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="text-[10px] w-24 text-right flex-shrink-0 truncate" style={{ color: 'var(--text-muted)' }}>{d.label}</span>
          <div className="flex-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-item)', height: '8px' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(d.value / max) * 100}%`, background: color }}
            />
          </div>
          <span className="text-[11px] font-bold w-6 text-right flex-shrink-0" style={{ color: 'var(--text-primary)' }}>{d.value}</span>
        </div>
      ))}
    </div>
  );
}

// Donut / Pie benzeri progress ring
function RingChart({ pct, color, label, value }: { pct: number; color: string; label: string; value: string }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
        <circle
          cx="36" cy="36" r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text x="36" y="40" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--text-primary)">{value}</text>
      </svg>
      <span className="text-[10px] font-semibold text-center" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
  );
}

export default function RaporOzetGrafik() {
  const { firmalar, personeller, evraklar, ekipmanlar, muayeneler, uygunsuzluklar, egitimler } = useApp();

  const stats = useMemo(() => {
    const aktifFirmalar = firmalar.filter(f => !f.silinmis);
    const aktifPersoneller = personeller.filter(p => !p.silinmis && p.durum === 'Aktif');
    const aktifEvraklar = evraklar.filter(e => !e.silinmis);
    const aktifEkipmanlar = ekipmanlar.filter(e => !e.silinmis);
    const aktifMuayeneler = muayeneler.filter(m => !m.silinmis);
    const aktifUygunsuzluklar = uygunsuzluklar.filter(u => !u.silinmis);

    // Evrak durumları
    const evrakDolmus = aktifEvraklar.filter(e => e.durum === 'Süre Dolmuş').length;
    const evrakYaklasan = aktifEvraklar.filter(e => {
      const d = getDaysUntil(e.gecerlilikTarihi ?? '');
      return d >= 0 && d <= 30;
    }).length;
    const evrakGuncel = aktifEvraklar.length - evrakDolmus - evrakYaklasan;

    // Ekipman durumları
    const ekipmanUygun = aktifEkipmanlar.filter(e => e.durum === 'Uygun').length;
    const ekipmanUygunDegil = aktifEkipmanlar.filter(e => e.durum === 'Uygun Değil').length;
    const ekipmanBakim = aktifEkipmanlar.filter(e => e.durum === 'Bakımda').length;

    // Muayene durumları
    const muayeneGecmis = aktifMuayeneler.filter(m => getDaysUntil(m.sonrakiTarih) < 0).length;
    const muayeneYaklasan = aktifMuayeneler.filter(m => { const d = getDaysUntil(m.sonrakiTarih); return d >= 0 && d <= 30; }).length;
    const muayeneGuncel = aktifMuayeneler.length - muayeneGecmis - muayeneYaklasan;

    // Uygunsuzluk durumları
    const uygunsuzAcik = aktifUygunsuzluklar.filter(u => u.durum !== 'Kapandı').length;
    const uygunsuzKapali = aktifUygunsuzluklar.filter(u => u.durum === 'Kapandı').length;

    // Firma başına personel dağılımı (top 5)
    const firmaPersonelMap = aktifFirmalar
      .map(f => ({
        label: f.ad.length > 14 ? f.ad.slice(0, 14) + '…' : f.ad,
        value: aktifPersoneller.filter(p => p.firmaId === f.id).length,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    // Aylık eğitim dağılımı (son 6 ay)
    const months: { label: string; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const y = d.getFullYear();
      const m = d.getMonth();
      const label = d.toLocaleDateString('tr-TR', { month: 'short' });
      const count = egitimler.filter(e => {
        if (!e.tarih) return false;
        const ed = new Date(e.tarih);
        return ed.getFullYear() === y && ed.getMonth() === m;
      }).length;
      months.push({ label, value: count });
    }

    return {
      firmaSayisi: aktifFirmalar.length,
      personelSayisi: aktifPersoneller.length,
      evrakToplam: aktifEvraklar.length,
      evrakDolmus,
      evrakYaklasan,
      evrakGuncel,
      ekipmanToplam: aktifEkipmanlar.length,
      ekipmanUygun,
      ekipmanUygunDegil,
      ekipmanBakim,
      muayeneToplam: aktifMuayeneler.length,
      muayeneGecmis,
      muayeneYaklasan,
      muayeneGuncel,
      uygunsuzAcik,
      uygunsuzKapali,
      firmaPersonelMap,
      egitimAylık: months,
      egitimToplam: egitimler.length,
    };
  }, [firmalar, personeller, evraklar, ekipmanlar, muayeneler, uygunsuzluklar, egitimler]);

  return (
    <div className="space-y-5">
      {/* KPI Kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Toplam Firma', value: stats.firmaSayisi, icon: 'ri-building-2-line', color: '#A78BFA', bg: 'rgba(167,139,250,0.1)' },
          { label: 'Aktif Personel', value: stats.personelSayisi, icon: 'ri-user-line', color: '#34D399', bg: 'rgba(52,211,153,0.1)' },
          { label: 'Toplam Evrak', value: stats.evrakToplam, icon: 'ri-file-list-3-line', color: '#60A5FA', bg: 'rgba(96,165,250,0.1)' },
          { label: 'Açık Uygunsuzluk', value: stats.uygunsuzAcik, icon: 'ri-error-warning-line', color: '#F87171', bg: 'rgba(248,113,113,0.1)' },
        ].map(s => (
          <div key={s.label} className="isg-card rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: s.bg }}>
              <i className={`${s.icon} text-lg`} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-2xl font-black leading-none" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Grafik satırı — Ring charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Evrak Durumu */}
        <div className="isg-card rounded-xl p-5">
          <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            <i className="ri-file-list-3-line mr-2" style={{ color: '#60A5FA' }} />
            Evrak Durumu
          </h3>
          <div className="flex items-center justify-around">
            <RingChart
              pct={stats.evrakToplam > 0 ? (stats.evrakGuncel / stats.evrakToplam) * 100 : 0}
              color="#34D399" label="Güncel" value={String(stats.evrakGuncel)}
            />
            <RingChart
              pct={stats.evrakToplam > 0 ? (stats.evrakYaklasan / stats.evrakToplam) * 100 : 0}
              color="#F59E0B" label="Yaklaşan" value={String(stats.evrakYaklasan)}
            />
            <RingChart
              pct={stats.evrakToplam > 0 ? (stats.evrakDolmus / stats.evrakToplam) * 100 : 0}
              color="#EF4444" label="Dolmuş" value={String(stats.evrakDolmus)}
            />
          </div>
        </div>

        {/* Ekipman Durumu */}
        <div className="isg-card rounded-xl p-5">
          <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            <i className="ri-tools-line mr-2" style={{ color: '#F59E0B' }} />
            Ekipman Durumu
          </h3>
          <div className="flex items-center justify-around">
            <RingChart
              pct={stats.ekipmanToplam > 0 ? (stats.ekipmanUygun / stats.ekipmanToplam) * 100 : 0}
              color="#34D399" label="Uygun" value={String(stats.ekipmanUygun)}
            />
            <RingChart
              pct={stats.ekipmanToplam > 0 ? (stats.ekipmanUygunDegil / stats.ekipmanToplam) * 100 : 0}
              color="#EF4444" label="Uygun Değil" value={String(stats.ekipmanUygunDegil)}
            />
            <RingChart
              pct={stats.ekipmanToplam > 0 ? (stats.ekipmanBakim / stats.ekipmanToplam) * 100 : 0}
              color="#F59E0B" label="Bakımda" value={String(stats.ekipmanBakim)}
            />
          </div>
        </div>

        {/* Muayene Durumu */}
        <div className="isg-card rounded-xl p-5">
          <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            <i className="ri-heart-pulse-line mr-2" style={{ color: '#34D399' }} />
            Muayene Durumu
          </h3>
          <div className="flex items-center justify-around">
            <RingChart
              pct={stats.muayeneToplam > 0 ? (stats.muayeneGuncel / stats.muayeneToplam) * 100 : 0}
              color="#34D399" label="Güncel" value={String(stats.muayeneGuncel)}
            />
            <RingChart
              pct={stats.muayeneToplam > 0 ? (stats.muayeneYaklasan / stats.muayeneToplam) * 100 : 0}
              color="#F59E0B" label="Yaklaşan" value={String(stats.muayeneYaklasan)}
            />
            <RingChart
              pct={stats.muayeneToplam > 0 ? (stats.muayeneGecmis / stats.muayeneToplam) * 100 : 0}
              color="#EF4444" label="Geçmiş" value={String(stats.muayeneGecmis)}
            />
          </div>
        </div>
      </div>

      {/* Bar chart satırı */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Firma başına personel */}
        <div className="isg-card rounded-xl p-5">
          <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            <i className="ri-user-3-line mr-2" style={{ color: '#A78BFA' }} />
            Firma Başına Personel (Top 6)
          </h3>
          {stats.firmaPersonelMap.length > 0 ? (
            <BarChart data={stats.firmaPersonelMap} color="rgba(167,139,250,0.7)" />
          ) : (
            <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>Veri yok</p>
          )}
        </div>

        {/* Aylık eğitim */}
        <div className="isg-card rounded-xl p-5">
          <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            <i className="ri-graduation-cap-line mr-2" style={{ color: '#34D399' }} />
            Son 6 Ay Eğitim Sayısı
          </h3>
          {stats.egitimAylık.some(e => e.value > 0) ? (
            <BarChart data={stats.egitimAylık} color="rgba(52,211,153,0.7)" />
          ) : (
            <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>Eğitim kaydı bulunamadı</p>
          )}
        </div>
      </div>

      {/* Risk özet tablosu */}
      <div className="isg-card rounded-xl overflow-hidden">
        <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-item)' }}>
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            <i className="ri-alert-line mr-2" style={{ color: '#F59E0B' }} />
            Risk Özeti
          </h3>
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
          {[
            {
              module: 'Evrak Takibi',
              kritik: stats.evrakDolmus,
              uyari: stats.evrakYaklasan,
              guncel: stats.evrakGuncel,
              icon: 'ri-file-list-3-line',
              color: '#60A5FA',
            },
            {
              module: 'Ekipmanlar',
              kritik: stats.ekipmanUygunDegil,
              uyari: stats.ekipmanBakim,
              guncel: stats.ekipmanUygun,
              icon: 'ri-tools-line',
              color: '#F59E0B',
            },
            {
              module: 'Periyodik Muayene',
              kritik: stats.muayeneGecmis,
              uyari: stats.muayeneYaklasan,
              guncel: stats.muayeneGuncel,
              icon: 'ri-heart-pulse-line',
              color: '#34D399',
            },
            {
              module: 'Uygunsuzluklar',
              kritik: stats.uygunsuzAcik,
              uyari: 0,
              guncel: stats.uygunsuzKapali,
              icon: 'ri-error-warning-line',
              color: '#F87171',
            },
          ].map(r => (
            <div key={r.module} className="grid items-center px-5 py-3"
              style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
              <div className="flex items-center gap-2">
                <i className={`${r.icon} text-sm flex-shrink-0`} style={{ color: r.color }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{r.module}</span>
              </div>
              <div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: r.kritik > 0 ? 'rgba(239,68,68,0.1)' : 'transparent', color: r.kritik > 0 ? '#EF4444' : 'var(--text-muted)' }}>
                  {r.kritik > 0 ? `${r.kritik} kritik` : '—'}
                </span>
              </div>
              <div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: r.uyari > 0 ? 'rgba(245,158,11,0.1)' : 'transparent', color: r.uyari > 0 ? '#F59E0B' : 'var(--text-muted)' }}>
                  {r.uyari > 0 ? `${r.uyari} uyarı` : '—'}
                </span>
              </div>
              <div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(52,211,153,0.1)', color: '#34D399' }}>
                  {r.guncel} güncel
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
