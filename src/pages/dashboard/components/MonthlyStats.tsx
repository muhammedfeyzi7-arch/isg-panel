import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../store/AppContext';

export default function MonthlyStats() {
  const { personeller, egitimler, gorevler, muayeneler } = useApp();
  const navigate = useNavigate();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const next30 = new Date(now.getTime() + 30 * 86400000);
  const next7 = new Date(now.getTime() + 7 * 86400000);

  const stats = useMemo(() => {
    // Bu ay eklenen personeller
    const buAyPersonel = personeller.filter(p => {
      if (p.silinmis) return false;
      const t = new Date(p.olusturmaTarihi);
      return t >= monthStart && t <= monthEnd;
    });

    // Bu ay eklenen personellerin departman dağılımı (top 3)
    const deptMap: Record<string, number> = {};
    buAyPersonel.forEach(p => {
      const dept = p.departman || 'Belirtilmemiş';
      deptMap[dept] = (deptMap[dept] ?? 0) + 1;
    });
    const topDepts = Object.entries(deptMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    // Yaklaşan eğitimler (sonraki 30 gün)
    const yaklaşanEgitimler = egitimler.filter(e => {
      if (e.silinmis || e.durum === 'Tamamlandı') return false;
      if (!e.tarih) return false;
      const t = new Date(e.tarih);
      return t >= now && t <= next30;
    }).sort((a, b) => new Date(a.tarih!).getTime() - new Date(b.tarih!).getTime());

    // Acil eğitimler (7 gün içinde)
    const acilEgitimler = yaklaşanEgitimler.filter(e => {
      if (!e.tarih) return false;
      return new Date(e.tarih) <= next7;
    });

    // Bekleyen/açık görevler
    const acikGorevler = gorevler.filter(g => {
      if (g.silinmis) return false;
      return g.durum !== 'Tamamlandı';
    });

    const gecikmisSayisi = acikGorevler.filter(g => {
      if (!g.bitisTarihi) return false;
      return new Date(g.bitisTarihi) < now;
    }).length;

    // Bu ay yapılan muayeneler
    const buAyMuayene = muayeneler.filter(m => {
      if (m.silinmis) return false;
      const t = new Date(m.muayeneTarihi || m.olusturmaTarihi);
      return t >= monthStart && t <= monthEnd;
    });

    return {
      buAyPersonel,
      topDepts,
      yaklaşanEgitimler: yaklaşanEgitimler.slice(0, 5),
      acilEgitimler: acilEgitimler.length,
      acikGorevler,
      gecikmisSayisi,
      buAyMuayene,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personeller, egitimler, gorevler, muayeneler]);

  const ayAdi = now.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Bu Ay Personel */}
      <div className="rounded-2xl p-5 isg-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}
            >
              <i className="ri-user-add-line text-base" style={{ color: '#10B981' }} />
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Bu Ay Personel</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{ayAdi}</p>
            </div>
          </div>
          <span
            className="text-2xl font-extrabold"
            style={{ color: '#34D399' }}
          >
            {stats.buAyPersonel.length}
          </span>
        </div>

        {stats.buAyPersonel.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 gap-2">
            <i className="ri-user-line text-2xl" style={{ color: '#1E293B' }} />
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              Bu ay henüz personel eklenmedi
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Son eklenenler */}
            <div className="space-y-1.5">
              {stats.buAyPersonel.slice(0, 4).map(p => (
                <div
                  key={p.id}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
                  >
                    {p.adSoyad.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {p.adSoyad}
                    </p>
                    <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                      {p.gorev || p.departman || '—'}
                    </p>
                  </div>
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                    style={{
                      background: p.durum === 'Aktif' ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.12)',
                      color: p.durum === 'Aktif' ? '#34D399' : '#94A3B8',
                    }}
                  >
                    {p.durum}
                  </span>
                </div>
              ))}
              {stats.buAyPersonel.length > 4 && (
                <p className="text-xs text-center pt-1" style={{ color: 'var(--text-muted)' }}>
                  +{stats.buAyPersonel.length - 4} personel daha
                </p>
              )}
            </div>

            {/* Departman dağılımı */}
            {stats.topDepts.length > 0 && (
              <div
                className="px-3 py-2.5 rounded-xl space-y-1.5"
                style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.1)' }}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#34D399' }}>
                  Departman Dağılımı
                </p>
                {stats.topDepts.map(([dept, count]) => (
                  <div key={dept} className="flex items-center justify-between">
                    <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{dept}</span>
                    <span className="text-xs font-bold" style={{ color: '#34D399' }}>{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Yaklaşan Eğitimler */}
      <div className="rounded-2xl p-5 isg-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
              style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)' }}
            >
              <i className="ri-graduation-cap-line text-base" style={{ color: '#F59E0B' }} />
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Yaklaşan Eğitimler</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Sonraki 30 gün</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {stats.acilEgitimler > 0 && (
              <span
                className="text-[10px] font-bold px-2 py-1 rounded-full"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                {stats.acilEgitimler} acil
              </span>
            )}
            <span
              className="text-xl font-extrabold"
              style={{ color: '#F59E0B' }}
            >
              {stats.yaklaşanEgitimler.length}
            </span>
          </div>
        </div>

        {stats.yaklaşanEgitimler.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 gap-2">
            <i className="ri-graduation-cap-line text-2xl" style={{ color: '#1E293B' }} />
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              Önümüzdeki 30 gün içinde eğitim yok
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {stats.yaklaşanEgitimler.map(eg => {
              const daysLeft = eg.tarih
                ? Math.ceil((new Date(eg.tarih).getTime() - now.getTime()) / 86400000)
                : null;
              const isUrgent = daysLeft !== null && daysLeft <= 7;

              return (
                <div
                  key={eg.id}
                  className="flex items-start gap-3 px-3 py-2.5 rounded-xl"
                  style={{
                    background: isUrgent ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isUrgent ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)'}`,
                  }}
                >
                  <div
                    className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
                    style={{ background: isUrgent ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)' }}
                  >
                    <i
                      className="ri-graduation-cap-line text-sm"
                      style={{ color: isUrgent ? '#EF4444' : '#F59E0B' }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {eg.ad}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {eg.katilimciIds?.length ?? 0} katılımcı
                    </p>
                  </div>
                  {daysLeft !== null && (
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0"
                      style={{
                        background: isUrgent ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                        color: isUrgent ? '#F87171' : '#FCD34D',
                      }}
                    >
                      {daysLeft === 0 ? 'Bugün!' : `${daysLeft}g`}
                    </span>
                  )}
                </div>
              );
            })}

            <button
              onClick={() => navigate('/training')}
              className="w-full py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all"
              style={{
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.15)',
                color: '#F59E0B',
              }}
            >
              <i className="ri-arrow-right-line mr-1" />
              Tüm Eğitimlere Git
            </button>
          </div>
        )}
      </div>

      {/* Bekleyen Görevler */}
      <div className="rounded-2xl p-5 isg-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
              style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}
            >
              <i className="ri-task-line text-base" style={{ color: '#818CF8' }} />
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Bekleyen Görevler</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Açık & devam eden</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {stats.gecikmisSayisi > 0 && (
              <span
                className="text-[10px] font-bold px-2 py-1 rounded-full"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                {stats.gecikmisSayisi} gecikmiş
              </span>
            )}
            <span
              className="text-xl font-extrabold"
              style={{ color: stats.acikGorevler.length > 0 ? '#818CF8' : '#34D399' }}
            >
              {stats.acikGorevler.length}
            </span>
          </div>
        </div>

        {stats.acikGorevler.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 gap-2">
            <i className="ri-check-double-line text-2xl" style={{ color: '#10B981' }} />
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              Tüm görevler tamamlandı!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Görev öncelik özeti */}
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  label: 'Yüksek',
                  count: stats.acikGorevler.filter(g => g.oncelik === 'Yüksek' || g.oncelik === 'Kritik').length,
                  color: '#EF4444',
                  bg: 'rgba(239,68,68,0.1)',
                },
                {
                  label: 'Orta',
                  count: stats.acikGorevler.filter(g => g.oncelik === 'Orta').length,
                  color: '#F59E0B',
                  bg: 'rgba(245,158,11,0.1)',
                },
                {
                  label: 'Düşük',
                  count: stats.acikGorevler.filter(g => g.oncelik === 'Düşük' || !g.oncelik).length,
                  color: '#64748B',
                  bg: 'rgba(100,116,139,0.1)',
                },
              ].map(item => (
                <div
                  key={item.label}
                  className="flex flex-col items-center py-2 rounded-xl"
                  style={{ background: item.bg }}
                >
                  <p className="text-base font-extrabold" style={{ color: item.color }}>{item.count}</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                </div>
              ))}
            </div>

            {/* Son görevler */}
            <div className="space-y-1.5">
              {stats.acikGorevler.slice(0, 4).map(g => {
                const isGecikmis = g.bitisTarihi && new Date(g.bitisTarihi) < now;
                return (
                  <div
                    key={g.id}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                    style={{
                      background: isGecikmis ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isGecikmis ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)'}`,
                    }}
                  >
                    <div
                      className="w-5 h-5 flex items-center justify-center rounded flex-shrink-0"
                      style={{ background: isGecikmis ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)' }}
                    >
                      <i
                        className="ri-checkbox-blank-circle-line text-xs"
                        style={{ color: isGecikmis ? '#EF4444' : '#818CF8' }}
                      />
                    </div>
                    <p className="text-xs flex-1 min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>
                      {g.baslik}
                    </p>
                    {isGecikmis && (
                      <span className="text-[10px] font-bold whitespace-nowrap" style={{ color: '#EF4444' }}>
                        Gecikmiş
                      </span>
                    )}
                  </div>
                );
              })}
              {stats.acikGorevler.length > 4 && (
                <p className="text-xs text-center pt-1" style={{ color: 'var(--text-muted)' }}>
                  +{stats.acikGorevler.length - 4} görev daha
                </p>
              )}
            </div>

            <button
              onClick={() => navigate('/tasks')}
              className="w-full py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all"
              style={{
                background: 'rgba(99,102,241,0.08)',
                border: '1px solid rgba(99,102,241,0.15)',
                color: '#818CF8',
              }}
            >
              <i className="ri-arrow-right-line mr-1" />
              Görev Yönetimine Git
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
