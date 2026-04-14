import { createPortal } from 'react-dom';

interface Ziyaret {
  id: string;
  uzman_ad: string | null;
  uzman_email: string | null;
  firma_ad: string | null;
  giris_saati: string;
  cikis_saati: string | null;
  durum: 'aktif' | 'tamamlandi';
  konum_lat: number | null;
  konum_lng: number | null;
  konum_adres: string | null;
  qr_ile_giris: boolean;
  notlar: string | null;
  sure_dakika: number | null;
  gps_status: 'ok' | 'too_far' | 'no_permission' | null;
  check_in_distance_m?: number | null;
  check_in_lat?: number | null;
  check_in_lng?: number | null;
}

interface GpsStatusConfig {
  icon: string;
  label: string;
  sub: string;
  color: string;
  bg: string;
  border: string;
}

function getGpsStatusConfig(status: 'ok' | 'too_far' | 'no_permission' | null): GpsStatusConfig | null {
  if (!status) return null;
  switch (status) {
    case 'ok':
      return {
        icon: 'ri-map-pin-2-fill',
        label: 'Konum Doğrulandı',
        sub: 'Uzman check-in anında firma konumundaydı',
        color: '#16A34A',
        bg: 'rgba(34,197,94,0.08)',
        border: 'rgba(34,197,94,0.22)',
      };
    case 'too_far':
      return {
        icon: 'ri-map-pin-line',
        label: 'Konum Dışında',
        sub: 'Uzman check-in anında firma konumunun dışındaydı',
        color: '#DC2626',
        bg: 'rgba(239,68,68,0.08)',
        border: 'rgba(239,68,68,0.22)',
      };
    case 'no_permission':
      return {
        icon: 'ri-map-pin-line',
        label: 'Konum Alınamadı',
        sub: 'GPS izni verilmedi veya konum alınamadı',
        color: '#D97706',
        bg: 'rgba(245,158,11,0.08)',
        border: 'rgba(245,158,11,0.22)',
      };
    default:
      return null;
  }
}

interface ZiyaretDetayPanelProps {
  ziyaret: Ziyaret;
  isDark: boolean;
  onClose: () => void;
  onBitir?: (id: string) => Promise<void>;
}

function formatSure(dakika: number | null): string {
  if (!dakika || dakika < 0) return '—';
  const h = Math.floor(dakika / 60);
  const m = dakika % 60;
  if (h > 0) return `${h} saat ${m} dakika`;
  return `${m} dakika`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function calcElapsed(giris: string): string {
  const diff = Math.floor((Date.now() - new Date(giris).getTime()) / 60000);
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h > 0) return `${h}s ${m}d`;
  return `${m} dakika`;
}

export default function ZiyaretDetayPanel({ ziyaret, isDark, onClose, onBitir: _onBitir }: ZiyaretDetayPanelProps) {
  const isAktif = ziyaret.durum === 'aktif';

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-item)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '14px',
  };

  const mapUrl = ziyaret.konum_lat && ziyaret.konum_lng
    ? `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU3qiE&q=${ziyaret.konum_lat},${ziyaret.konum_lng}&zoom=15`
    : null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', zIndex: 99999 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: 'var(--modal-bg)',
          border: '1px solid var(--modal-border)',
          maxHeight: '90vh',
        }}
      >
        {/* Handle bar (mobil) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-main)' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center rounded-xl"
              style={{ background: isAktif ? 'rgba(34,197,94,0.12)' : 'rgba(148,163,184,0.12)' }}>
              <i className={`ri-map-pin-2-line text-base`} style={{ color: isAktif ? '#22C55E' : '#94A3B8' }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Ziyaret Detayı</h3>
                {isAktif ? (
                  <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#22C55E' }} />
                    AKTİF
                  </span>
                ) : (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(148,163,184,0.12)', color: '#94A3B8', border: '1px solid rgba(148,163,184,0.2)' }}>
                    TAMAMLANDI
                  </span>
                )}
              </div>
              {ziyaret.qr_ile_giris && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md mt-1 inline-block"
                  style={{ background: 'rgba(16,185,129,0.1)', color: '#059669' }}>
                  QR ile giriş
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
            style={{ background: 'var(--bg-item)', color: 'var(--text-muted)' }}>
            <i className="ri-close-line text-sm" />
          </button>
        </div>

        {/* İçerik */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* Uzman + Firma kartları */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-2xl" style={cardStyle}>
              <p className="text-[9.5px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-faint)' }}>Uzman</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background: isAktif ? 'linear-gradient(135deg, #10B981, #059669)' : 'linear-gradient(135deg, #64748b, #475569)' }}>
                  {(ziyaret.uzman_ad ?? '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{ziyaret.uzman_ad ?? '—'}</p>
                  <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{ziyaret.uzman_email ?? ''}</p>
                </div>
              </div>
            </div>
            <div className="p-3 rounded-2xl" style={cardStyle}>
              <p className="text-[9.5px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-faint)' }}>Firma</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(16,185,129,0.1)' }}>
                  <i className="ri-building-2-line text-sm" style={{ color: '#059669' }} />
                </div>
                <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{ziyaret.firma_ad ?? '—'}</p>
              </div>
            </div>
          </div>

          {/* Zaman çizelgesi */}
          <div className="p-4 rounded-2xl" style={cardStyle}>
            <p className="text-[9.5px] font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--text-faint)' }}>Zaman</p>
            <div className="flex items-center gap-3">
              {/* Giriş */}
              <div className="flex-1 text-center">
                <div className="w-8 h-8 flex items-center justify-center rounded-full mx-auto mb-1.5"
                  style={{ background: 'rgba(16,185,129,0.12)', border: '1.5px solid rgba(16,185,129,0.3)' }}>
                  <i className="ri-login-circle-line text-xs" style={{ color: '#10B981' }} />
                </div>
                <p className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Giriş</p>
                <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                  {new Date(ziyaret.giris_saati).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-[9px]" style={{ color: 'var(--text-faint)' }}>
                  {new Date(ziyaret.giris_saati).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}
                </p>
              </div>
              {/* Süre ortası */}
              <div className="flex-1 text-center">
                <div className="flex items-center gap-1">
                  <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
                  <div className="px-2 py-1 rounded-full text-[10px] font-bold flex-shrink-0"
                    style={{ background: isAktif ? 'rgba(34,197,94,0.1)' : 'rgba(16,185,129,0.1)', color: isAktif ? '#22C55E' : '#10B981' }}>
                    {isAktif ? calcElapsed(ziyaret.giris_saati) : formatSure(ziyaret.sure_dakika)}
                  </div>
                  <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
                </div>
              </div>
              {/* Çıkış */}
              <div className="flex-1 text-center">
                <div className="w-8 h-8 flex items-center justify-center rounded-full mx-auto mb-1.5"
                  style={{
                    background: ziyaret.cikis_saati ? 'rgba(148,163,184,0.12)' : 'rgba(245,158,11,0.08)',
                    border: `1.5px solid ${ziyaret.cikis_saati ? 'rgba(148,163,184,0.3)' : 'rgba(245,158,11,0.2)'}`,
                  }}>
                  <i className={`ri-logout-circle-line text-xs`}
                    style={{ color: ziyaret.cikis_saati ? '#94A3B8' : '#F59E0B' }} />
                </div>
                <p className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Çıkış</p>
                {ziyaret.cikis_saati ? (
                  <>
                    <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                      {new Date(ziyaret.cikis_saati).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-[9px]" style={{ color: 'var(--text-faint)' }}>
                      {new Date(ziyaret.cikis_saati).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}
                    </p>
                  </>
                ) : (
                  <p className="text-xs font-bold" style={{ color: '#F59E0B' }}>Devam ediyor</p>
                )}
              </div>
            </div>
          </div>

          {/* GPS Konum Durumu */}
          {(() => {
            const cfg = getGpsStatusConfig(ziyaret.gps_status);
            if (!cfg) return null;
            const distM = ziyaret.check_in_distance_m;
            const distStr = distM != null
              ? (distM >= 1000 ? `${(distM / 1000).toFixed(2)} km` : `${distM} m`)
              : null;
            return (
              <div className="p-4 rounded-2xl" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                <p className="text-[9.5px] font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--text-faint)' }}>Konum Durumu</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
                    style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}` }}>
                    <i className={`${cfg.icon} text-base`} style={{ color: cfg.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.label}</p>
                    <p className="text-[10px] mt-0.5 leading-snug" style={{ color: 'var(--text-muted)' }}>{cfg.sub}</p>
                    {distStr && (
                      <p className="text-[10px] mt-1 font-semibold" style={{ color: cfg.color }}>
                        <i className="ri-map-pin-2-line mr-0.5" />
                        {ziyaret.gps_status === 'too_far'
                          ? `Firma konumundan ${distStr} uzakta`
                          : `Firma konumuna mesafe: ${distStr}`}
                      </p>
                    )}
                  </div>
                  <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-xl flex-shrink-0 whitespace-nowrap"
                    style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
                    {ziyaret.gps_status === 'ok' ? 'Doğrulandı' : ziyaret.gps_status === 'too_far' ? 'İhlal' : 'GPS yok'}
                  </span>
                </div>
                {/* Mesafe görsel göstergesi */}
                {distM != null && (
                  <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${cfg.border}` }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Mesafe</span>
                      <span className="text-[10px] font-bold" style={{ color: cfg.color }}>{distStr}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.08)' }}>
                      <div className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (distM / 2000) * 100)}%`,
                          background: distM > 1000 ? '#EF4444' : distM > 300 ? '#F59E0B' : '#22C55E',
                        }} />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[9px]" style={{ color: 'var(--text-faint)' }}>0m</span>
                      <span className="text-[9px]" style={{ color: 'var(--text-faint)' }}>2km+</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Notlar */}
          {ziyaret.notlar && (
            <div className="p-4 rounded-2xl" style={cardStyle}>
              <div className="flex items-center gap-2 mb-2">
                <i className="ri-file-text-line text-xs" style={{ color: '#10B981' }} />
                <p className="text-[9.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>Notlar</p>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{ziyaret.notlar}</p>
            </div>
          )}

          {/* Harita */}
          {mapUrl && (
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-2 p-3" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-item)' }}>
                <i className="ri-map-2-line text-xs" style={{ color: '#10B981' }} />
                <p className="text-[9.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>Konum</p>
                {ziyaret.konum_adres && (
                  <span className="text-[10px] ml-1" style={{ color: 'var(--text-muted)' }}>{ziyaret.konum_adres}</span>
                )}
              </div>
              <iframe
                src={mapUrl}
                width="100%"
                height="220"
                style={{ border: 0, display: 'block' }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Ziyaret Konumu"
              />
            </div>
          )}
        </div>

        {/* Footer — Aktif ziyaret bilgi notu (admin sonlandıramaz) */}
        {isAktif && (
          <div className="px-5 py-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-2 p-3 rounded-xl"
              style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <i className="ri-information-line text-sm flex-shrink-0" style={{ color: '#F59E0B' }} />
              <p className="text-xs leading-relaxed" style={{ color: '#92400E' }}>
                Ziyaret devam ediyor. Uzman QR kodu tekrar okutarak ziyareti bitirebilir.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
