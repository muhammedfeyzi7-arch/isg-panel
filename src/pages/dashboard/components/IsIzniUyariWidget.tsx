import { useMemo } from 'react';
import { useApp } from '@/store/AppContext';
import type { IsIzni } from '@/types';

const TIP_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  'Sıcak Çalışma':      { color: '#F97316', bg: 'rgba(249,115,22,0.12)',  icon: 'ri-fire-line' },
  'Yüksekte Çalışma':   { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  icon: 'ri-arrow-up-line' },
  'Kapalı Alan':        { color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)',  icon: 'ri-door-closed-line' },
  'Elektrikli Çalışma': { color: '#EAB308', bg: 'rgba(234,179,8,0.12)',   icon: 'ri-flashlight-line' },
  'Kazı':               { color: '#A16207', bg: 'rgba(161,98,7,0.12)',    icon: 'ri-tools-line' },
  'Genel':              { color: '#64748B', bg: 'rgba(100,116,139,0.12)', icon: 'ri-file-shield-2-line' },
};

function getDaysLeft(bitisTarihi: string): number | null {
  if (!bitisTarihi) return null;
  const end = new Date(bitisTarihi);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - now.getTime()) / 86400000);
}

interface IsIzniWithDays extends IsIzni {
  daysLeft: number;
}

export default function IsIzniUyariWidget() {
  const { isIzinleri, firmalar, setActiveModule } = useApp();

  const { suresiDolanlar, yaklaşanlar, onayBekleyenler } = useMemo(() => {
    const aktif = isIzinleri.filter(iz => !(iz as unknown as { silinmis?: boolean }).silinmis);

    const suresiDolanlar: IsIzniWithDays[] = [];
    const yaklaşanlar: IsIzniWithDays[] = [];

    aktif.forEach(iz => {
      if (!iz.bitisTarihi) return;
      const d = getDaysLeft(iz.bitisTarihi);
      if (d === null) return;
      if (d < 0) {
        suresiDolanlar.push({ ...iz, daysLeft: d });
      } else if (d <= 7) {
        yaklaşanlar.push({ ...iz, daysLeft: d });
      }
    });

    const onayBekleyenler = aktif.filter(iz => iz.durum === 'Onay Bekliyor');

    return {
      suresiDolanlar: suresiDolanlar.sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 5),
      yaklaşanlar: yaklaşanlar.sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 5),
      onayBekleyenler: onayBekleyenler.slice(0, 5),
    };
  }, [isIzinleri]);

  const totalUyari = suresiDolanlar.length + yaklaşanlar.length;
  const totalOnay = onayBekleyenler.length;

  if (totalUyari === 0 && totalOnay === 0) return null;

  return (
    <div className="rounded-2xl overflow-hidden isg-card">
      <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, #F97316, #EAB308, #8B5CF6)' }} />
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #F97316, #EAB308)' }}>
              <i className="ri-shield-keyhole-line text-white text-sm" />
            </div>
            <div>
              <h3 className="text-[13.5px] font-bold" style={{ color: 'var(--text-primary)' }}>İş İzni Uyarıları</h3>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {totalUyari > 0 && `${totalUyari} süre uyarısı`}
                {totalUyari > 0 && totalOnay > 0 && ' · '}
                {totalOnay > 0 && `${totalOnay} onay bekliyor`}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveModule('is-izinleri')}
            className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer whitespace-nowrap transition-all"
            style={{ background: 'rgba(249,115,22,0.08)', color: '#F97316', border: '1px solid rgba(249,115,22,0.2)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(249,115,22,0.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(249,115,22,0.08)'; }}
          >
            <i className="ri-arrow-right-line mr-1" />Modüle Git
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Süresi Dolanlar */}
          {suresiDolanlar.length > 0 && (
            <div className="rounded-xl p-3.5" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 flex items-center justify-center rounded-lg" style={{ background: 'rgba(239,68,68,0.15)' }}>
                  <i className="ri-alarm-warning-line text-[11px]" style={{ color: '#EF4444' }} />
                </div>
                <p className="text-[11px] font-bold" style={{ color: '#F87171' }}>
                  Süresi Doldu
                </p>
                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse"
                  style={{ background: 'rgba(239,68,68,0.2)', color: '#F87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                  {suresiDolanlar.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {suresiDolanlar.map(iz => {
                  const firma = firmalar.find(f => f.id === iz.firmaId);
                  const tip = TIP_CONFIG[iz.tip] ?? TIP_CONFIG['Genel'];
                  return (
                    <div key={iz.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
                      style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)' }}>
                      <div className="w-6 h-6 flex items-center justify-center rounded-md flex-shrink-0"
                        style={{ background: tip.bg }}>
                        <i className={`${tip.icon} text-[10px]`} style={{ color: tip.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                          {iz.izinNo}
                        </p>
                        <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                          {firma?.ad || '—'}
                        </p>
                      </div>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0"
                        style={{ background: 'rgba(239,68,68,0.15)', color: '#F87171' }}>
                        {Math.abs(iz.daysLeft)}g önce
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Yaklaşanlar (7 gün) */}
          {yaklaşanlar.length > 0 && (
            <div className="rounded-xl p-3.5" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 flex items-center justify-center rounded-lg" style={{ background: 'rgba(245,158,11,0.15)' }}>
                  <i className="ri-timer-line text-[11px]" style={{ color: '#F59E0B' }} />
                </div>
                <p className="text-[11px] font-bold" style={{ color: '#F59E0B' }}>
                  7 Gün İçinde
                </p>
                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(245,158,11,0.2)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}>
                  {yaklaşanlar.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {yaklaşanlar.map(iz => {
                  const firma = firmalar.find(f => f.id === iz.firmaId);
                  const tip = TIP_CONFIG[iz.tip] ?? TIP_CONFIG['Genel'];
                  return (
                    <div key={iz.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
                      style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.1)' }}>
                      <div className="w-6 h-6 flex items-center justify-center rounded-md flex-shrink-0"
                        style={{ background: tip.bg }}>
                        <i className={`${tip.icon} text-[10px]`} style={{ color: tip.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                          {iz.izinNo}
                        </p>
                        <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                          {firma?.ad || '—'}
                        </p>
                      </div>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0"
                        style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
                        {iz.daysLeft === 0 ? 'Bugün!' : `${iz.daysLeft}g`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Onay Bekleyenler */}
          {onayBekleyenler.length > 0 && (
            <div className="rounded-xl p-3.5" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.18)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 flex items-center justify-center rounded-lg" style={{ background: 'rgba(99,102,241,0.15)' }}>
                  <i className="ri-lock-line text-[11px]" style={{ color: '#818CF8' }} />
                </div>
                <p className="text-[11px] font-bold" style={{ color: '#818CF8' }}>
                  Onay Bekliyor
                </p>
                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(99,102,241,0.2)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.3)' }}>
                  {onayBekleyenler.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {onayBekleyenler.map(iz => {
                  const firma = firmalar.find(f => f.id === iz.firmaId);
                  const tip = TIP_CONFIG[iz.tip] ?? TIP_CONFIG['Genel'];
                  const olusturma = iz.olusturmaTarihi
                    ? new Date(iz.olusturmaTarihi).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })
                    : '—';
                  return (
                    <div key={iz.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
                      style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.1)' }}>
                      <div className="w-6 h-6 flex items-center justify-center rounded-md flex-shrink-0"
                        style={{ background: tip.bg }}>
                        <i className={`${tip.icon} text-[10px]`} style={{ color: tip.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                          {iz.izinNo}
                        </p>
                        <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                          {firma?.ad || '—'}
                        </p>
                      </div>
                      <span className="text-[9px] font-medium whitespace-nowrap flex-shrink-0"
                        style={{ color: 'var(--text-muted)' }}>
                        {olusturma}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Eğer sadece 1 veya 2 kolon varsa boş alanı doldur */}
          {suresiDolanlar.length === 0 && yaklaşanlar.length === 0 && onayBekleyenler.length > 0 && (
            <>
              <div className="rounded-xl p-3.5 flex flex-col items-center justify-center gap-2"
                style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)' }}>
                <i className="ri-checkbox-circle-line text-2xl" style={{ color: '#34D399' }} />
                <p className="text-[11px] font-semibold text-center" style={{ color: '#34D399' }}>Süresi dolan izin yok</p>
              </div>
              <div className="rounded-xl p-3.5 flex flex-col items-center justify-center gap-2"
                style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)' }}>
                <i className="ri-timer-line text-2xl" style={{ color: '#34D399' }} />
                <p className="text-[11px] font-semibold text-center" style={{ color: '#34D399' }}>7 günde biten izin yok</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
