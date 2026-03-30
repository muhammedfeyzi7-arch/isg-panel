import { useMemo } from 'react';
import { useApp } from '../../store/AppContext';
import Badge, { getEvrakStatusColor, getFirmaStatusColor, getTehlikeColor } from '../../components/base/Badge';

export default function RaporlarPage() {
  const {
    firmalar, personeller, evraklar, egitimler, muayeneler,
    uygunsuzluklar, ekipmanlar, gorevler, tutanaklar,
  } = useApp();

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

  const summaryCards = [
    { label: 'Toplam Firma', value: aktifFirmalar.length, icon: 'ri-building-2-line', color: '#3B82F6', sub: `${aktifFirmalar.filter(f => f.durum === 'Aktif').length} aktif` },
    { label: 'Toplam Personel', value: aktifPersoneller.length, icon: 'ri-team-line', color: '#10B981', sub: `${aktifPersoneller.filter(p => p.durum === 'Aktif').length} aktif` },
    { label: 'Toplam Evrak', value: aktifEvraklar.length, icon: 'ri-file-list-3-line', color: '#F59E0B', sub: `${evrakStats.eksik + evrakStats.sureDolmus} sorunlu` },
    { label: 'Eğitim Kayıtları', value: aktifEgitimler.length, icon: 'ri-graduation-cap-line', color: '#6366F1', sub: `${aktifEgitimler.filter(e => e.durum === 'Tamamlandı').length} tamamlandı` },
    { label: 'Açık Uygunsuzluk', value: uygunsuzlukStats.acik, icon: 'ri-alert-line', color: uygunsuzlukStats.acik > 0 ? '#EF4444' : '#10B981', sub: `${uygunsuzlukStats.kapandi} kapatıldı` },
    { label: 'Ekipman Kontrolü', value: aktifEkipmanlar.length, icon: 'ri-tools-line', color: '#14B8A6', sub: `${aktifEkipmanlar.filter(e => e.durum === 'Uygun').length} uygun` },
    { label: 'Görevler', value: aktifGorevler.length, icon: 'ri-task-line', color: '#8B5CF6', sub: `${aktifGorevler.filter(g => g.durum === 'Tamamlandı').length} tamamlandı` },
    { label: 'Tutanaklar', value: tutanaklar.length, icon: 'ri-article-line', color: '#F97316', sub: `${tutanaklar.filter(t => t.durum === 'Onaylandı').length} onaylı` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Raporlar &amp; Analiz</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Sistemdeki tüm verilerin özet analizi</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryCards.map(card => (
          <div key={card.label} className="isg-card rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: `${card.color}18` }}>
                <i className={`${card.icon} text-lg`} style={{ color: card.color }} />
              </div>
              <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-muted)' }}>{card.label}</p>
            </div>
            <p className="text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{card.value}</p>
            <p className="text-xs mt-1" style={{ color: card.color }}>{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Evrak Durumu */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="isg-card rounded-xl p-5">
          <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Evrak Durumu Özeti</h3>
          <div className="space-y-3">
            {[
              { label: 'Yüklü Evraklar', value: evrakStats.yuklu, total: aktifEvraklar.length, color: '#10B981' },
              { label: 'Eksik Evraklar', value: evrakStats.eksik, total: aktifEvraklar.length, color: '#EF4444' },
              { label: 'Süresi Dolmuş', value: evrakStats.sureDolmus, total: aktifEvraklar.length, color: '#F87171' },
              { label: 'Yaklaşan Süre (30g)', value: evrakStats.sureYaklasiyor, total: aktifEvraklar.length, color: '#F59E0B' },
            ].map(item => {
              const pct = item.total > 0 ? Math.round((item.value / item.total) * 100) : 0;
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                    <span className="text-xs font-bold" style={{ color: item.color }}>{item.value} ({pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-item)' }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: item.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="isg-card rounded-xl p-5">
          <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Uygunsuzluk Analizi</h3>
          <div className="space-y-3">
            {[
              { label: 'Açık Uygunsuzluklar', value: uygunsuzlukStats.acik, color: '#EF4444' },
              { label: 'Kapatılan Uygunsuzluklar', value: uygunsuzlukStats.kapandi, color: '#10B981' },
              { label: 'Kritik Seviye', value: uygunsuzlukStats.kritik, color: '#EF4444' },
              { label: 'Yüksek Seviye', value: uygunsuzlukStats.yuksek, color: '#F97316' },
            ].map(item => {
              const total = aktifUygunsuzluklar.length;
              const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                    <span className="text-xs font-bold" style={{ color: item.color }}>{item.value}</span>
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

      {/* Firma Listesi */}
      <div className="isg-card rounded-xl overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-main)' }}>
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Firma Özet Listesi</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Tüm firmaların durum özeti</p>
        </div>
        {aktifFirmalar.length === 0 ? (
          <div className="py-12 text-center">
            <i className="ri-building-2-line text-3xl" style={{ color: '#334155' }} />
            <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>Henüz firma kaydı yok</p>
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
                  <th className="text-left hidden lg:table-cell">Uygunsuzluk</th>
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
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0 text-xs font-bold text-white"
                            style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}>
                            {firma.ad.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{firma.ad}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{firma.yetkiliKisi || '—'}</p>
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
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{firmaPersonel}</span>
                      </td>
                      <td className="hidden lg:table-cell">
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{firmaEvrak}</span>
                      </td>
                      <td className="hidden lg:table-cell">
                        <span className="text-sm font-semibold" style={{ color: firmaUyg > 0 ? '#EF4444' : 'var(--text-primary)' }}>{firmaUyg}</span>
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
  );
}
