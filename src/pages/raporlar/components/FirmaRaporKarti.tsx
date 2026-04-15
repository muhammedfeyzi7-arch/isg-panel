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

interface Props {
  firmaId: string;
  compact?: boolean;
  onClick?: () => void;
}

export default function FirmaRaporKarti({ firmaId, compact, onClick }: Props) {
  const { firmalar, personeller, evraklar, ekipmanlar, muayeneler, uygunsuzluklar, egitimler } = useApp();

  const firma = useMemo(() => firmalar.find(f => f.id === firmaId), [firmalar, firmaId]);

  const stats = useMemo(() => {
    const fp = personeller.filter(p => !p.silinmis && p.firmaId === firmaId && p.durum === 'Aktif');
    const fe = evraklar.filter(e => !e.silinmis && e.firmaId === firmaId);
    const fek = ekipmanlar.filter(e => !e.silinmis && e.firmaId === firmaId);
    const fm = muayeneler.filter(m => !m.silinmis && m.firmaId === firmaId);
    const fu = uygunsuzluklar.filter(u => !u.silinmis && u.firmaId === firmaId);
    const feg = egitimler.filter(e => e.firmaId === firmaId);

    const evrakDolmus = fe.filter(e => e.durum === 'Süre Dolmuş' || getDaysUntil(e.gecerlilikTarihi ?? '') < 0).length;
    const evrakYaklasan = fe.filter(e => { const d = getDaysUntil(e.gecerlilikTarihi ?? ''); return d >= 0 && d <= 30; }).length;
    const ekipmanUygunDegil = fek.filter(e => e.durum === 'Uygun Değil').length;
    const muayeneGecmis = fm.filter(m => getDaysUntil(m.sonrakiTarih) < 0).length;
    const muayeneYaklasan = fm.filter(m => { const d = getDaysUntil(m.sonrakiTarih); return d >= 0 && d <= 30; }).length;
    const uygunsuzAcik = fu.filter(u => u.durum !== 'Kapandı').length;

    // Risk skoru (0-100, düşük = iyi)
    let riskPuan = 0;
    if (fp.length > 0) {
      riskPuan += (evrakDolmus / Math.max(fe.length, 1)) * 30;
      riskPuan += (muayeneGecmis / Math.max(fm.length, 1)) * 25;
      riskPuan += (ekipmanUygunDegil / Math.max(fek.length, 1)) * 25;
      riskPuan += Math.min(uygunsuzAcik / 10, 1) * 20;
    }
    const riskLevel = riskPuan < 20 ? 'Düşük' : riskPuan < 50 ? 'Orta' : 'Yüksek';
    const riskColor = riskPuan < 20 ? '#34D399' : riskPuan < 50 ? '#F59E0B' : '#EF4444';

    return {
      personelSayisi: fp.length,
      evrakToplam: fe.length, evrakDolmus, evrakYaklasan,
      ekipmanToplam: fek.length, ekipmanUygunDegil,
      muayeneToplam: fm.length, muayeneGecmis, muayeneYaklasan,
      egitimToplam: feg.length,
      uygunsuzAcik, uygunsuzKapali: fu.filter(u => u.durum === 'Kapandı').length,
      riskLevel, riskColor, riskPuan: Math.round(riskPuan),
    };
  }, [firmaId, personeller, evraklar, ekipmanlar, muayeneler, uygunsuzluklar, egitimler]);

  if (!firma) return null;

  const riskBg = stats.riskColor === '#34D399' ? 'rgba(52,211,153,0.1)' : stats.riskColor === '#F59E0B' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)';

  if (compact) {
    return (
      <button
        onClick={onClick}
        className="isg-card rounded-xl p-4 text-left cursor-pointer transition-all w-full"
        style={{ border: '1px solid var(--border-subtle)' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = stats.riskColor + '40'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(167,139,250,0.1)' }}>
              <i className="ri-building-2-line text-sm" style={{ color: '#A78BFA' }} />
            </div>
            <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{firma.ad}</p>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0"
            style={{ background: riskBg, color: stats.riskColor, border: `1px solid ${stats.riskColor}30` }}>
            {stats.riskLevel} Risk
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Personel', value: stats.personelSayisi, color: '#34D399' },
            { label: 'Evrak', value: `${stats.evrakToplam - stats.evrakDolmus}/${stats.evrakToplam}`, color: stats.evrakDolmus > 0 ? '#EF4444' : '#34D399' },
            { label: 'Ekipman', value: `${stats.ekipmanToplam - stats.ekipmanUygunDegil}/${stats.ekipmanToplam}`, color: stats.ekipmanUygunDegil > 0 ? '#F59E0B' : '#34D399' },
            { label: 'Muayene', value: `${stats.muayeneToplam - stats.muayeneGecmis}/${stats.muayeneToplam}`, color: stats.muayeneGecmis > 0 ? '#EF4444' : '#34D399' },
          ].map(s => (
            <div key={s.label} className="rounded-lg px-2.5 py-2" style={{ background: 'var(--bg-item)' }}>
              <p className="text-[11px] font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-end mt-2">
          <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>
            Detay görüntüle <i className="ri-arrow-right-s-line" />
          </span>
        </div>
      </button>
    );
  }

  // Full detay görünümü
  return (
    <div className="space-y-4">
      {/* Firma başlık */}
      <div className="isg-card rounded-xl p-5">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)' }}>
            <i className="ri-building-2-line text-2xl" style={{ color: '#A78BFA' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>{firma.ad}</h2>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{firma.sektor || 'Sektör belirtilmemiş'}</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(167,139,250,0.1)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.2)' }}>
                {firma.tehlikeSinifi}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Risk Puanı</p>
              <p className="text-3xl font-black leading-none" style={{ color: stats.riskColor }}>{stats.riskPuan}</p>
            </div>
            <span className="text-sm font-bold px-3 py-1.5 rounded-xl"
              style={{ background: riskBg, color: stats.riskColor, border: `1px solid ${stats.riskColor}30` }}>
              {stats.riskLevel} Risk
            </span>
          </div>
        </div>
      </div>

      {/* KPI ızgara */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Personel', value: stats.personelSayisi, icon: 'ri-user-line', color: '#34D399', bg: 'rgba(52,211,153,0.1)', sub: 'aktif' },
          { label: 'Evrak', value: stats.evrakToplam, icon: 'ri-file-list-3-line', color: '#60A5FA', bg: 'rgba(96,165,250,0.1)', sub: `${stats.evrakDolmus} dolmuş` },
          { label: 'Ekipman', value: stats.ekipmanToplam, icon: 'ri-tools-line', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', sub: `${stats.ekipmanUygunDegil} uygunsuz` },
          { label: 'Muayene', value: stats.muayeneToplam, icon: 'ri-heart-pulse-line', color: '#A78BFA', bg: 'rgba(167,139,250,0.1)', sub: `${stats.muayeneGecmis} gecikmiş` },
          { label: 'Eğitim', value: stats.egitimToplam, icon: 'ri-graduation-cap-line', color: '#F472B6', bg: 'rgba(244,114,182,0.1)', sub: 'toplam' },
          { label: 'Uygunsuzluk', value: stats.uygunsuzAcik, icon: 'ri-error-warning-line', color: '#F87171', bg: 'rgba(248,113,113,0.1)', sub: 'açık' },
        ].map(s => (
          <div key={s.label} className="isg-card rounded-xl p-3 flex flex-col items-center text-center gap-1">
            <div className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ background: s.bg }}>
              <i className={`${s.icon} text-base`} style={{ color: s.color }} />
            </div>
            <p className="text-xl font-black leading-none" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
            <p className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: s.color }}>{s.label}</p>
            <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Sorunlar listesi */}
      {(stats.evrakDolmus > 0 || stats.muayeneGecmis > 0 || stats.ekipmanUygunDegil > 0 || stats.uygunsuzAcik > 0) && (
        <div className="isg-card rounded-xl overflow-hidden" style={{ border: '1px solid rgba(239,68,68,0.15)' }}>
          <div className="px-4 py-3 flex items-center gap-2"
            style={{ background: 'rgba(239,68,68,0.04)', borderBottom: '1px solid rgba(239,68,68,0.1)' }}>
            <i className="ri-alert-fill text-sm" style={{ color: '#EF4444' }} />
            <h3 className="text-xs font-bold" style={{ color: '#EF4444' }}>Dikkat Gerektiren Durumlar</h3>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { condition: stats.evrakDolmus > 0, icon: 'ri-file-damage-line', color: '#EF4444', bg: 'rgba(239,68,68,0.08)', text: `${stats.evrakDolmus} evrakın süresi dolmuş` },
              { condition: stats.evrakYaklasan > 0, icon: 'ri-file-warning-line', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', text: `${stats.evrakYaklasan} evrak 30 günde dolacak` },
              { condition: stats.muayeneGecmis > 0, icon: 'ri-heart-pulse-line', color: '#EF4444', bg: 'rgba(239,68,68,0.08)', text: `${stats.muayeneGecmis} muayene gecikmiş` },
              { condition: stats.muayeneYaklasan > 0, icon: 'ri-time-line', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', text: `${stats.muayeneYaklasan} muayene yaklaşıyor` },
              { condition: stats.ekipmanUygunDegil > 0, icon: 'ri-tools-line', color: '#EF4444', bg: 'rgba(239,68,68,0.08)', text: `${stats.ekipmanUygunDegil} ekipman uygun değil` },
              { condition: stats.uygunsuzAcik > 0, icon: 'ri-error-warning-line', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', text: `${stats.uygunsuzAcik} açık uygunsuzluk` },
            ].filter(i => i.condition).map((item, idx) => (
              <div key={idx} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg" style={{ background: item.bg, border: `1px solid ${item.color}20` }}>
                <i className={`${item.icon} text-sm flex-shrink-0`} style={{ color: item.color }} />
                <p className="text-xs font-semibold" style={{ color: item.color }}>{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
