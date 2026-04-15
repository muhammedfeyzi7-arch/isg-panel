import { useMemo, useState } from 'react';
import { useApp } from '@/store/AppContext';

function getDaysUntil(dateStr: string): number {
  if (!dateStr) return 9999;
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / 86400000);
}

function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('tr-TR');
}

type UyariSeviye = 'kritik' | 'yaklasan' | 'bilgi';

interface UyariItem {
  id: string;
  personelAd: string;
  firmaAd: string;
  sonrakiTarih: string;
  kalanGun: number;
  seviye: UyariSeviye;
}

export default function MuayeneUyariPanel() {
  const { muayeneler, personeller, firmalar } = useApp();
  const [collapsed, setCollapsed] = useState(false);

  const uyarilar = useMemo<UyariItem[]>(() => {
    const aktif = muayeneler.filter(m => !m.silinmis && m.sonrakiTarih);
    return aktif
      .map(m => {
        const p = personeller.find(x => x.id === m.personelId);
        const f = firmalar.find(x => x.id === m.firmaId);
        const kalanGun = getDaysUntil(m.sonrakiTarih);
        let seviye: UyariSeviye = 'bilgi';
        if (kalanGun < 0) seviye = 'kritik';
        else if (kalanGun <= 14) seviye = 'kritik';
        else if (kalanGun <= 30) seviye = 'yaklasan';
        else return null;
        return {
          id: m.id,
          personelAd: p?.adSoyad ?? '—',
          firmaAd: f?.ad ?? '—',
          sonrakiTarih: m.sonrakiTarih,
          kalanGun,
          seviye,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a!.kalanGun - b!.kalanGun) as UyariItem[];
  }, [muayeneler, personeller, firmalar]);

  const kritikSayisi = uyarilar.filter(u => u.seviye === 'kritik').length;
  const yaklasSayisi = uyarilar.filter(u => u.seviye === 'yaklasan').length;

  if (uyarilar.length === 0) return null;

  const SEV_CONFIG: Record<UyariSeviye, { color: string; bg: string; border: string; icon: string; label: string }> = {
    kritik: {
      color: '#EF4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)',
      icon: 'ri-alarm-warning-fill', label: 'Kritik',
    },
    yaklasan: {
      color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)',
      icon: 'ri-time-fill', label: 'Yaklaşıyor',
    },
    bilgi: {
      color: '#60A5FA', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.2)',
      icon: 'ri-information-fill', label: 'Bilgi',
    },
  };

  return (
    <div className="rounded-2xl overflow-hidden isg-card" style={{ border: `1px solid ${kritikSayisi > 0 ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}` }}>
      {/* Başlık şeridi */}
      <div
        className="h-[2px]"
        style={{ background: kritikSayisi > 0 ? 'linear-gradient(90deg, #EF4444, #F87171)' : 'linear-gradient(90deg, #F59E0B, #FCD34D)' }}
      />

      {/* Header */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 cursor-pointer"
        style={{ background: kritikSayisi > 0 ? 'rgba(239,68,68,0.04)' : 'rgba(245,158,11,0.04)' }}
      >
        <div
          className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
          style={{ background: kritikSayisi > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)' }}
        >
          <i className={`${kritikSayisi > 0 ? 'ri-alarm-warning-fill' : 'ri-time-fill'} text-sm`}
            style={{ color: kritikSayisi > 0 ? '#EF4444' : '#F59E0B' }} />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Muayene Uyarıları
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {kritikSayisi > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                {kritikSayisi} kritik
              </span>
            )}
            {yaklasSayisi > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}>
                {yaklasSayisi} yaklaşıyor
              </span>
            )}
          </div>
        </div>
        <i className={collapsed ? 'ri-arrow-down-s-line text-sm' : 'ri-arrow-up-s-line text-sm'}
          style={{ color: 'var(--text-muted)' }} />
      </button>

      {/* İçerik */}
      {!collapsed && (
        <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
          {uyarilar.slice(0, 8).map(u => {
            const cfg = SEV_CONFIG[u.seviye];
            const gunText = u.kalanGun < 0
              ? `${Math.abs(u.kalanGun)} gün geçti`
              : u.kalanGun === 0
              ? 'Bugün!'
              : `${u.kalanGun} gün kaldı`;

            return (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
                  style={{ background: cfg.bg }}>
                  <i className={`${cfg.icon} text-xs`} style={{ color: cfg.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{u.personelAd}</p>
                  <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{u.firmaAd}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] font-bold" style={{ color: cfg.color }}>{gunText}</p>
                  <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{fmtDate(u.sonrakiTarih)}</p>
                </div>
              </div>
            );
          })}
          {uyarilar.length > 8 && (
            <div className="px-4 py-2 text-center">
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                +{uyarilar.length - 8} kayıt daha var — Sağlık Durumu sayfasını görüntüleyin
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
