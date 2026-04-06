import type { IsIzni, IsIzniStatus } from '@/types';
import type { Firma } from '@/types';

const TIP_CONFIG: Record<string, { color: string; bg: string; icon: string; border: string }> = {
  'Sıcak Çalışma':      { color: '#F97316', bg: 'rgba(249,115,22,0.1)',   icon: 'ri-fire-line',            border: 'rgba(249,115,22,0.25)' },
  'Yüksekte Çalışma':   { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',   icon: 'ri-arrow-up-line',        border: 'rgba(245,158,11,0.25)' },
  'Kapalı Alan':        { color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)',   icon: 'ri-door-closed-line',     border: 'rgba(139,92,246,0.25)' },
  'Elektrikli Çalışma': { color: '#EAB308', bg: 'rgba(234,179,8,0.1)',    icon: 'ri-flashlight-line',      border: 'rgba(234,179,8,0.25)' },
  'Kazı':               { color: '#A16207', bg: 'rgba(161,98,7,0.1)',     icon: 'ri-tools-line',           border: 'rgba(161,98,7,0.25)' },
  'Genel':              { color: '#64748B', bg: 'rgba(100,116,139,0.1)',  icon: 'ri-file-shield-2-line',   border: 'rgba(100,116,139,0.25)' },
};

const DURUM_CONFIG: Record<IsIzniStatus, { color: string; bg: string; border: string; icon: string }> = {
  'Onay Bekliyor': { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)', icon: 'ri-time-line' },
  'Onaylandı':     { color: '#34D399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.25)', icon: 'ri-checkbox-circle-line' },
  'Reddedildi':    { color: '#EF4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)', icon: 'ri-close-circle-line' },
};

function getDaysLeft(bitisTarihi: string): number | null {
  if (!bitisTarihi) return null;
  const end = new Date(bitisTarihi);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - now.getTime()) / 86400000);
}

interface Props {
  izinler: IsIzni[];
  firmalar: Firma[];
  canEdit: boolean;
  canDelete: boolean;
  onView: (iz: IsIzni) => void;
  onEdit: (iz: IsIzni) => void;
  onDelete: (id: string) => void;
  onStatusChange: (iz: IsIzni, durum: IsIzniStatus) => void;
  onPdf: (iz: IsIzni) => void;
  onEvrak: (id: string) => void;
}

export default function IsIzniKartlar({
  izinler, firmalar, canEdit, canDelete,
  onView, onEdit, onDelete, onStatusChange, onPdf, onEvrak,
}: Props) {
  if (izinler.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {izinler.map(iz => {
        const firma = firmalar.find(f => f.id === iz.firmaId);
        const tip = TIP_CONFIG[iz.tip] ?? TIP_CONFIG['Genel'];
        const dur = DURUM_CONFIG[iz.durum] ?? DURUM_CONFIG['Onay Bekliyor'];
        const daysLeft = getDaysLeft(iz.bitisTarihi);
        const isExpired = daysLeft !== null && daysLeft < 0;
        const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 2;
        const isLocked = iz.durum === 'Onay Bekliyor';

        return (
          <div
            key={iz.id}
            className="isg-card rounded-2xl overflow-hidden flex flex-col cursor-pointer isg-card-hover"
            style={{ borderColor: isExpired ? 'rgba(239,68,68,0.3)' : isExpiringSoon ? 'rgba(245,158,11,0.3)' : undefined }}
            onClick={() => onView(iz)}
          >
            {/* Top color bar */}
            <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${tip.color}, ${tip.color}88)` }} />

            {/* Header */}
            <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: tip.bg, border: `1px solid ${tip.border}` }}>
                  <i className={`${tip.icon} text-base`} style={{ color: tip.color }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-mono font-bold" style={{ color: tip.color }}>{iz.izinNo}</p>
                  <p className="text-[12px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{iz.tip}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {isLocked && (
                  <span className="w-5 h-5 flex items-center justify-center rounded-full" style={{ background: 'rgba(245,158,11,0.15)' }} title="Onay bekliyor — kilitli">
                    <i className="ri-lock-line text-[10px]" style={{ color: '#F59E0B' }} />
                  </span>
                )}
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
                  style={{ background: dur.bg, color: dur.color, border: `1px solid ${dur.border}` }}
                >
                  <i className={`${dur.icon} text-[9px]`} />
                  {iz.durum}
                </span>
              </div>
            </div>

            {/* Body */}
            <div className="px-4 pb-3 flex-1 space-y-2">
              {/* Firma */}
              <div className="flex items-center gap-2">
                <i className="ri-building-2-line text-xs flex-shrink-0" style={{ color: 'var(--text-faint)' }} />
                <p className="text-[12px] truncate" style={{ color: 'var(--text-secondary)' }}>{firma?.ad || '—'}</p>
              </div>

              {/* Sorumlu */}
              {iz.sorumlu && (
                <div className="flex items-center gap-2">
                  <i className="ri-user-line text-xs flex-shrink-0" style={{ color: 'var(--text-faint)' }} />
                  <p className="text-[12px] truncate" style={{ color: 'var(--text-secondary)' }}>{iz.sorumlu}</p>
                </div>
              )}

              {/* Tarih aralığı */}
              <div className="flex items-center gap-2">
                <i className="ri-calendar-line text-xs flex-shrink-0" style={{ color: 'var(--text-faint)' }} />
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {iz.baslamaTarihi ? new Date(iz.baslamaTarihi).toLocaleDateString('tr-TR') : '—'}
                  {iz.bitisTarihi ? ` → ${new Date(iz.bitisTarihi).toLocaleDateString('tr-TR')}` : ''}
                </p>
              </div>

              {/* Süre uyarısı */}
              {isExpired && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <i className="ri-alarm-warning-line text-xs" style={{ color: '#EF4444' }} />
                  <p className="text-[11px] font-semibold" style={{ color: '#EF4444' }}>Süresi doldu ({Math.abs(daysLeft!)} gün önce)</p>
                </div>
              )}
              {isExpiringSoon && !isExpired && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <i className="ri-timer-line text-xs" style={{ color: '#F59E0B' }} />
                  <p className="text-[11px] font-semibold" style={{ color: '#F59E0B' }}>
                    {daysLeft === 0 ? 'Bugün bitiyor!' : `${daysLeft} gün kaldı`}
                  </p>
                </div>
              )}

              {/* Açıklama */}
              {iz.aciklama && (
                <p className="text-[11.5px] line-clamp-2" style={{ color: 'var(--text-muted)' }}>{iz.aciklama}</p>
              )}

              {/* Çalışan sayısı + evrak */}
              <div className="flex items-center gap-3 pt-1">
                {iz.calisanSayisi > 0 && (
                  <span className="flex items-center gap-1 text-[10.5px]" style={{ color: 'var(--text-faint)' }}>
                    <i className="ri-group-line text-xs" />
                    {iz.calisanSayisi} çalışan
                  </span>
                )}
                {(iz.evraklar?.length ?? 0) > 0 && (
                  <span className="flex items-center gap-1 text-[10.5px]" style={{ color: 'var(--text-faint)' }}>
                    <i className="ri-attachment-2 text-xs" />
                    {iz.evraklar!.length} evrak
                  </span>
                )}
                {iz.belgeMevcut && (
                  <span className="flex items-center gap-1 text-[10.5px]" style={{ color: '#34D399' }}>
                    <i className="ri-file-check-line text-xs" />
                    Belge var
                  </span>
                )}
              </div>
            </div>

            {/* Footer actions */}
            <div
              className="px-4 py-2.5 flex items-center justify-between"
              style={{ borderTop: '1px solid var(--border-subtle)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Durum değiştir — sadece edit yetkisi varsa */}
              {canEdit && (
                <div className="flex items-center gap-1">
                  {(['Onay Bekliyor', 'Onaylandı', 'Reddedildi'] as IsIzniStatus[]).map(d => (
                    <button
                      key={d}
                      onClick={() => onStatusChange(iz, d)}
                      title={d}
                      className="w-6 h-6 flex items-center justify-center rounded-full transition-all cursor-pointer"
                      style={{
                        background: iz.durum === d ? DURUM_CONFIG[d].bg : 'transparent',
                        border: `1.5px solid ${iz.durum === d ? DURUM_CONFIG[d].color : 'var(--border-main)'}`,
                      }}
                    >
                      <i
                        className={`${DURUM_CONFIG[d].icon} text-[9px]`}
                        style={{ color: iz.durum === d ? DURUM_CONFIG[d].color : 'var(--text-faint)' }}
                      />
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1 ml-auto">
                <button onClick={() => onEvrak(iz.id)} title="Evrak Ekle" className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ color: 'var(--text-faint)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.1)'; e.currentTarget.style.color = '#3B82F6'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-faint)'; }}>
                  <i className="ri-attachment-2 text-xs" />
                </button>
                <button onClick={() => onPdf(iz)} title="PDF" className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ color: 'var(--text-faint)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.1)'; e.currentTarget.style.color = '#10B981'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-faint)'; }}>
                  <i className="ri-file-pdf-line text-xs" />
                </button>
                {canEdit && (
                  <button onClick={() => onEdit(iz)} title="Düzenle" className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ color: 'var(--text-faint)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.1)'; e.currentTarget.style.color = '#F59E0B'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-faint)'; }}>
                    <i className="ri-edit-line text-xs" />
                  </button>
                )}
                {canDelete && (
                  <button onClick={() => onDelete(iz.id)} title="Sil" className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ color: 'var(--text-faint)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#EF4444'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-faint)'; }}>
                    <i className="ri-delete-bin-line text-xs" />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
