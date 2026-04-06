import { useMemo, Fragment } from 'react';
import { useApp } from '../../../store/AppContext';

export default function MonthlyStats() {
  const { personeller, egitimler, gorevler, muayeneler, uygunsuzluklar, theme, setActiveModule } = useApp();
  const isDark = theme === 'dark';

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const next30 = new Date(now.getTime() + 30 * 86400000);
  const next7 = new Date(now.getTime() + 7 * 86400000);

  // ── Theme tokens ──
  const itemBg = isDark ? 'rgba(255,255,255,0.03)' : 'var(--bg-item)';
  const itemBorder = isDark ? 'rgba(255,255,255,0.05)' : 'var(--bg-item-border)';
  const urgentItemBg = isDark ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.04)';
  const urgentItemBorder = isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.12)';

  const stats = useMemo(() => {
    const buAyPersonel = personeller.filter(p => {
      if (p.silinmis) return false;
      const t = new Date(p.olusturmaTarihi);
      return t >= monthStart && t <= monthEnd;
    });

    const deptMap: Record<string, number> = {};
    buAyPersonel.forEach(p => {
      const dept = p.departman || 'Belirtilmemiş';
      deptMap[dept] = (deptMap[dept] ?? 0) + 1;
    });
    const topDepts = Object.entries(deptMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const yaklaşanEgitimler = egitimler.filter(e => {
      if (e.silinmis || e.durum === 'Tamamlandı') return false;
      if (!e.tarih) return false;
      const t = new Date(e.tarih);
      return t >= now && t <= next30;
    }).sort((a, b) => new Date(a.tarih!).getTime() - new Date(b.tarih!).getTime());

    const acilEgitimler = yaklaşanEgitimler.filter(e => {
      if (!e.tarih) return false;
      return new Date(e.tarih) <= next7;
    });

    const acikGorevler = gorevler.filter(g => {
      if (g.silinmis) return false;
      return g.durum !== 'Tamamlandı';
    });

    const gecikmisSayisi = acikGorevler.filter(g => {
      if (!g.bitisTarihi) return false;
      return new Date(g.bitisTarihi) < now;
    }).length;

    const buAyMuayene = muayeneler.filter(m => {
      if (m.silinmis) return false;
      const t = new Date(m.muayeneTarihi || m.olusturmaTarihi);
      return t >= monthStart && t <= monthEnd;
    });

    // Uygunsuzluk istatistikleri
    const acikUygunsuzluklar = uygunsuzluklar.filter(u => {
      if (u.silinmis) return false;
      return u.durum === 'Açık';
    });

    const kritikUygunsuzluklar = acikUygunsuzluklar.filter(u => u.oncelik === 'Kritik' || u.oncelik === 'Yüksek');
    const buAyAcilanUygunsuzluklar = uygunsuzluklar.filter(u => {
      if (u.silinmis) return false;
      const t = new Date(u.olusturmaTarihi);
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
      acikUygunsuzluklar,
      kritikUygunsuzluklar,
      buAyAcilanUygunsuzluklar,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personeller, egitimler, gorevler, muayeneler, uygunsuzluklar]);

  const ayAdi = now.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* ── Bu Ay Personel ── */}
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
          <span className="text-2xl font-extrabold" style={{ color: '#34D399' }}>
            {stats.buAyPersonel.length}
          </span>
        </div>

        {stats.buAyPersonel.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 gap-2">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.12)' }}>
              <i className="ri-user-line text-lg" style={{ color: 'rgba(16,185,129,0.4)' }} />
            </div>
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              Bu ay henüz personel eklenmedi
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              {stats.buAyPersonel.slice(0, 4).map(p => (
                <div
                  key={p.id}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                  style={{ background: itemBg, border: `1px solid ${itemBorder}` }}
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

      {/* ── Yaklaşan Eğitimler ── */}
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
            <span className="text-xl font-extrabold" style={{ color: '#F59E0B' }}>
              {stats.yaklaşanEgitimler.length}
            </span>
          </div>
        </div>

        {stats.yaklaşanEgitimler.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 gap-2">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.12)' }}>
              <i className="ri-graduation-cap-line text-lg" style={{ color: 'rgba(245,158,11,0.4)' }} />
            </div>
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
                    background: isUrgent ? urgentItemBg : itemBg,
                    border: `1px solid ${isUrgent ? urgentItemBorder : itemBorder}`,
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
              onClick={() => setActiveModule('egitimler')}
              className="w-full py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all"
              style={{
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.15)',
                color: '#F59E0B',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.14)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.08)'; }}
            >
              <i className="ri-arrow-right-line mr-1" />
              Tüm Eğitimlere Git
            </button>
          </div>
        )}
      </div>

      {/* ── Uygunsuzluklar ── */}
      <div className="rounded-2xl p-5 isg-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              <i className="ri-alert-line text-base" style={{ color: '#EF4444' }} />
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Uygunsuzluklar</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Açık &amp; kritik</p>
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
              style={{ color: stats.acikUygunsuzluklar.length > 0 ? '#EF4444' : '#34D399' }}
            >
              {stats.acikUygunsuzluklar.length}
            </span>
          </div>
        </div>

        {stats.acikUygunsuzluklar.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 gap-2">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.12)' }}>
              <i className="ri-shield-check-line text-lg" style={{ color: '#10B981' }} />
            </div>
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              Açık uygunsuzluk yok
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Öncelik özeti */}
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  label: 'Kritik',
                  count: stats.kritikUygunsuzluklar.length,
                  color: '#EF4444',
                  bg: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.07)',
                },
                {
                  label: 'Bu Ay',
                  count: stats.buAyAcilanUygunsuzluklar.length,
                  color: '#F59E0B',
                  bg: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.07)',
                },
                {
                  label: 'Toplam',
                  count: stats.acikUygunsuzluklar.length,
                  color: isDark ? '#64748B' : '#94A3B8',
                  bg: isDark ? 'rgba(100,116,139,0.1)' : 'rgba(100,116,139,0.07)',
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

            {/* Son uygunsuzluklar */}
            <div className="space-y-1.5">
              {stats.acikUygunsuzluklar.slice(0, 4).map(u => {
                const isKritik = u.oncelik === 'Kritik' || u.oncelik === 'Yüksek';
                return (
                  <div
                    key={u.id}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                    style={{
                      background: isKritik ? urgentItemBg : itemBg,
                      border: `1px solid ${isKritik ? urgentItemBorder : itemBorder}`,
                    }}
                  >
                    <div
                      className="w-5 h-5 flex items-center justify-center rounded flex-shrink-0"
                      style={{ background: isKritik ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)' }}
                    >
                      <i
                        className="ri-alert-line text-xs"
                        style={{ color: isKritik ? '#EF4444' : '#F59E0B' }}
                      />
                    </div>
                    <p className="text-xs flex-1 min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>
                      {u.baslik || u.aciklama?.slice(0, 30) || '—'}
                    </p>
                    {isKritik && (
                      <span className="text-[10px] font-bold whitespace-nowrap" style={{ color: '#EF4444' }}>
                        Kritik
                      </span>
                    )}
                  </div>
                );
              })}
              {stats.acikUygunsuzluklar.length > 4 && (
                <p className="text-xs text-center pt-1" style={{ color: 'var(--text-muted)' }}>
                  +{stats.acikUygunsuzluklar.length - 4} uygunsuzluk daha
                </p>
              )}
            </div>

            <button
              onClick={() => setActiveModule('uygunsuzluklar')}
              className="w-full py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all"
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.15)',
                color: '#F87171',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.14)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
            >
              <i className="ri-arrow-right-line mr-1" />
              Uygunsuzluklara Git
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Suppress unused import warning
const _Fragment = Fragment;
void _Fragment;
