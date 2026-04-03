import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import type { EkipmanStatus } from '../../types';

const STATUS_CONFIG: Record<EkipmanStatus, { label: string; color: string; bg: string; border: string; icon: string }> = {
  'Uygun':       { label: 'Uygun',       color: '#34D399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.3)',  icon: 'ri-checkbox-circle-line' },
  'Uygun Değil': { label: 'Uygun Değil', color: '#F87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)', icon: 'ri-close-circle-line' },
  'Bakımda':     { label: 'Bakımda',     color: '#FBBF24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)',  icon: 'ri-time-line' },
  'Hurda':       { label: 'Hurda',       color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)', icon: 'ri-delete-bin-line' },
};

function getDaysUntil(dateStr: string): number {
  if (!dateStr) return 999;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function QrDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { ekipmanlar, firmalar, org, dataLoading } = useApp();

  const ekipman = useMemo(() => ekipmanlar.find(e => e.id === id && !e.silinmis), [ekipmanlar, id]);
  const firma = useMemo(() => firmalar.find(f => f.id === ekipman?.firmaId), [firmalar, ekipman]);

  // Yükleniyor
  if (dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: 'rgba(100,116,139,0.4)', borderTopColor: '#64748B' }} />
          <p className="text-sm" style={{ color: '#64748B' }}>Yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Ekipman bulunamadı
  if (!ekipman) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg-main)' }}>
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <i className="ri-error-warning-line text-4xl" style={{ color: '#EF4444' }} />
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Ekipman Bulunamadı</h2>
          <p className="text-sm mb-2" style={{ color: '#64748B' }}>Bu QR koda ait ekipman kaydı mevcut değil veya silinmiş.</p>
          <p className="text-xs mb-6 px-3 py-2 rounded-lg" style={{ color: '#F87171', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <i className="ri-shield-cross-line mr-1" />Bu ekipmana erişim yetkiniz yok veya kayıt mevcut değil.
          </p>
          <button onClick={() => navigate('/')} className="btn-primary whitespace-nowrap">
            <i className="ri-home-line mr-1" />Ana Sayfaya Dön
          </button>
        </div>
      </div>
    );
  }

  // Organization kontrolü — ekipman başka org'a aitse erişim reddet
  // (ekipmanlar zaten org bazlı yükleniyor, ama ekstra güvenlik katmanı)
  const sc = STATUS_CONFIG[ekipman.durum];
  const days = getDaysUntil(ekipman.sonrakiKontrolTarihi);
  const isOverdue = days < 0;
  const isUrgent = days >= 0 && days <= 30;

  const InfoRow = ({ icon, label, value, valueColor }: { icon: string; label: string; value?: string | null; valueColor?: string }) => (
    <div className="flex items-start gap-3 py-3" style={{ borderBottom: '1px solid rgba(51,65,85,0.3)' }}>
      <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 mt-0.5" style={{ background: 'rgba(51,65,85,0.4)' }}>
        <i className={`${icon} text-sm`} style={{ color: '#64748B' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: '#475569' }}>{label}</p>
        <p className="text-sm font-medium" style={{ color: valueColor || (value ? 'var(--text-primary)' : '#475569') }}>
          {value || '—'}
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: 'var(--bg-main)' }}>
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-xl cursor-pointer transition-all"
            style={{ background: 'rgba(51,65,85,0.4)', color: '#94A3B8' }}
          >
            <i className="ri-arrow-left-line" />
          </button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>QR Ekipman Detayı</p>
            <p className="text-xs mt-0.5" style={{ color: '#334155' }}>
              <i className="ri-shield-check-line mr-1" style={{ color: '#22C55E' }} />
              {org?.name || 'Organizasyon'} — Yetkili Erişim
            </p>
          </div>
        </div>

        {/* Main Card */}
        <div className="isg-card rounded-2xl overflow-hidden">
          {/* Card Header */}
          <div className="px-5 py-4" style={{ background: 'rgba(15,23,42,0.6)', borderBottom: '1px solid rgba(51,65,85,0.4)' }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)' }}>
                    {ekipman.seriNo || 'SN—'}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(51,65,85,0.4)', color: '#64748B' }}>
                    {ekipman.tur || 'Ekipman'}
                  </span>
                </div>
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{ekipman.ad}</h1>
                {firma && <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>{firma.ad}</p>}
              </div>
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex-shrink-0"
                style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}
              >
                <i className={sc.icon} />{sc.label}
              </span>
            </div>
          </div>

          {/* Kontrol Durumu Banner */}
          {(isOverdue || isUrgent) && (
            <div
              className="px-5 py-3 flex items-center gap-2"
              style={{
                background: isOverdue ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
                borderBottom: `1px solid ${isOverdue ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
              }}
            >
              <i className={`${isOverdue ? 'ri-alarm-warning-line' : 'ri-time-line'} text-sm`} style={{ color: isOverdue ? '#EF4444' : '#F59E0B' }} />
              <p className="text-xs font-semibold" style={{ color: isOverdue ? '#EF4444' : '#F59E0B' }}>
                {isOverdue
                  ? `Kontrol ${Math.abs(days)} gün gecikmiş!`
                  : `Kontrol tarihi ${days} gün sonra`}
              </p>
            </div>
          )}

          {/* Info Rows */}
          <div className="px-5">
            <InfoRow icon="ri-building-line" label="Firma" value={firma?.ad} />
            <InfoRow icon="ri-map-pin-line" label="Bulunduğu Alan" value={ekipman.bulunduguAlan} />
            <InfoRow icon="ri-price-tag-3-line" label="Marka / Model" value={[ekipman.marka, ekipman.model].filter(Boolean).join(' / ') || null} />
            <InfoRow
              icon="ri-calendar-check-line"
              label="Son Kontrol Tarihi"
              value={ekipman.sonKontrolTarihi ? new Date(ekipman.sonKontrolTarihi).toLocaleDateString('tr-TR') : null}
            />
            <InfoRow
              icon="ri-calendar-2-line"
              label="Sonraki Kontrol Tarihi"
              value={ekipman.sonrakiKontrolTarihi ? new Date(ekipman.sonrakiKontrolTarihi).toLocaleDateString('tr-TR') : null}
              valueColor={isOverdue ? '#EF4444' : isUrgent ? '#F59E0B' : undefined}
            />
            {ekipman.aciklama && (
              <InfoRow icon="ri-file-text-line" label="Açıklama" value={ekipman.aciklama} />
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 flex items-center justify-between" style={{ background: 'rgba(15,23,42,0.4)', borderTop: '1px solid rgba(51,65,85,0.3)' }}>
            <div className="flex items-center gap-1.5">
              <i className="ri-qr-code-line text-xs" style={{ color: '#334155' }} />
              <span className="text-xs" style={{ color: '#334155' }}>QR ile erişildi</span>
            </div>
            <div className="flex items-center gap-1.5">
              <i className="ri-shield-check-line text-xs" style={{ color: '#22C55E' }} />
              <span className="text-xs" style={{ color: '#475569' }}>Güvenli erişim</span>
            </div>
          </div>
        </div>

        {/* Geri dön butonu */}
        <div className="mt-4 text-center">
          <button
            onClick={() => navigate('/')}
            className="btn-secondary whitespace-nowrap text-sm"
          >
            <i className="ri-arrow-left-line mr-1" />Ekipman Listesine Dön
          </button>
        </div>
      </div>
    </div>
  );
}
