import { useState } from 'react';
import { createPortal } from 'react-dom';
import { MockZiyaret } from '@/mocks/ziyaretler';

interface ZiyaretDetayPanelProps {
  ziyaret: MockZiyaret;
  isDark: boolean;
  onClose: () => void;
  onBitir: (id: string) => void;
}

function calcDuration(giris: string, cikis: string | null): string {
  const end = cikis ? new Date(cikis) : new Date();
  const diff = Math.max(0, end.getTime() - new Date(giris).getTime());
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h === 0) return `${m} dk`;
  if (m === 0) return `${h} sa`;
  return `${h} sa ${m} dk`;
}

export default function ZiyaretDetayPanel({ ziyaret, isDark, onClose, onBitir }: ZiyaretDetayPanelProps) {
  const [bitirOnay, setBitirOnay] = useState(false);
  const [bitirLoading, setBitirLoading] = useState(false);

  const isAktif = ziyaret.durum === 'aktif';
  const duration = calcDuration(ziyaret.giris_saati, ziyaret.cikis_saati);

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

  const handleBitir = async () => {
    setBitirLoading(true);
    await new Promise(r => setTimeout(r, 700));
    onBitir(ziyaret.id);
    setBitirLoading(false);
    setBitirOnay(false);
  };

  const mapSrc = ziyaret.konum_lat && ziyaret.konum_lng
    ? `https://www.google.com/maps/embed/v1/place?key=AIzaSyD-9tSrke72PouQMnMX-a7eZSW0jkFMBWY&q=${ziyaret.konum_lat},${ziyaret.konum_lng}&zoom=15`
    : null;

  const panelBg = isDark ? '#1a2335' : '#ffffff';
  const borderColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.1)';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = isDark ? '#64748b' : '#64748b';
  const textSecondary = isDark ? '#94a3b8' : '#475569';
  const dividerColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.07)';
  const rowBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)';
  const overlayBg = isDark ? 'rgba(0,0,0,0.7)' : 'rgba(15,23,42,0.4)';

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4 z-[9999]"
      style={{ background: overlayBg, backdropFilter: 'blur(12px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden animate-modal-in"
        style={{ background: panelBg, border: `1px solid ${borderColor}`, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: `1px solid ${dividerColor}` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 flex items-center justify-center rounded-xl"
              style={{
                background: isAktif ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.1)',
                border: `1px solid ${isAktif ? 'rgba(16,185,129,0.25)' : 'rgba(100,116,139,0.2)'}`,
              }}
            >
              <i className="ri-map-pin-2-line text-sm" style={{ color: isAktif ? '#10B981' : '#64748b' }} />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: textPrimary }}>Ziyaret Detayı</h2>
              <p className="text-[10px] font-medium mt-0.5" style={{ color: textMuted }}>
                {fmtDate(ziyaret.giris_saati)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Durum badge */}
            <span
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-bold"
              style={{
                background: isAktif ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.1)',
                border: `1px solid ${isAktif ? 'rgba(16,185,129,0.28)' : 'rgba(100,116,139,0.2)'}`,
                color: isAktif ? '#10B981' : '#64748b',
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{
                  background: isAktif ? '#10B981' : '#64748b',
                  animation: isAktif ? 'status-pulse 2s ease-in-out infinite' : 'none',
                }}
              />
              {isAktif ? 'Aktif' : 'Tamamlandı'}
            </span>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-150"
              style={{ color: textMuted, background: rowBg }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = rowBg; }}
            >
              <i className="ri-close-line text-sm" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Uzman + Firma */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-3" style={{ background: rowBg, border: `1px solid ${dividerColor}` }}>
              <p className="text-[9.5px] font-bold uppercase tracking-[0.1em] mb-2" style={{ color: textMuted }}>Uzman</p>
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
                >
                  {ziyaret.uzman_ad.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: textPrimary }}>{ziyaret.uzman_ad}</p>
                  <p className="text-[9px] truncate" style={{ color: textMuted }}>{ziyaret.uzman_email}</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl p-3" style={{ background: rowBg, border: `1px solid ${dividerColor}` }}>
              <p className="text-[9.5px] font-bold uppercase tracking-[0.1em] mb-2" style={{ color: textMuted }}>Firma</p>
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(16,185,129,0.1)' }}
                >
                  <i className="ri-building-3-line text-xs" style={{ color: '#059669' }} />
                </div>
                <p className="text-xs font-semibold truncate" style={{ color: textPrimary }}>{ziyaret.firma_ad}</p>
              </div>
            </div>
          </div>

          {/* Süre + Saat bilgileri */}
          <div className="rounded-xl p-4" style={{ background: rowBg, border: `1px solid ${dividerColor}` }}>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-[9px] font-bold uppercase tracking-[0.1em] mb-1.5" style={{ color: textMuted }}>Giriş</p>
                <p className="text-[15px] font-extrabold" style={{ color: '#10B981' }}>{fmtTime(ziyaret.giris_saati)}</p>
                <p className="text-[9px] mt-0.5" style={{ color: textMuted }}>
                  {new Date(ziyaret.giris_saati).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                </p>
              </div>
              <div className="flex flex-col items-center justify-center">
                <div className="flex items-center gap-1 w-full">
                  <div className="flex-1 h-px" style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.12)' }} />
                  <div
                    className="flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold"
                    style={{ background: isAktif ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.1)', color: isAktif ? '#10B981' : '#64748b' }}
                  >
                    {duration}
                  </div>
                  <div className="flex-1 h-px" style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.12)' }} />
                </div>
                <p className="text-[9px] mt-1.5 font-medium" style={{ color: textMuted }}>toplam süre</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] font-bold uppercase tracking-[0.1em] mb-1.5" style={{ color: textMuted }}>Çıkış</p>
                {ziyaret.cikis_saati ? (
                  <>
                    <p className="text-[15px] font-extrabold" style={{ color: textPrimary }}>{fmtTime(ziyaret.cikis_saati)}</p>
                    <p className="text-[9px] mt-0.5" style={{ color: textMuted }}>
                      {new Date(ziyaret.cikis_saati).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-[13px] font-bold" style={{ color: '#64748b' }}>—</p>
                    <p className="text-[9px] mt-0.5" style={{ color: '#10B981' }}>Devam ediyor</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* QR Badge */}
          {ziyaret.qr_ile_giris && (
            <div
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
              style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}
            >
              <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(16,185,129,0.12)' }}>
                <i className="ri-qr-code-line text-xs" style={{ color: '#10B981' }} />
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: '#10B981' }}>QR Kod ile Giriş</p>
                <p className="text-[10px]" style={{ color: textMuted }}>Giriş QR tarama ile doğrulandı</p>
              </div>
              <i className="ri-check-double-line ml-auto text-sm" style={{ color: '#10B981' }} />
            </div>
          )}

          {/* Notlar */}
          {ziyaret.notlar && (
            <div>
              <p className="text-[9.5px] font-bold uppercase tracking-[0.1em] mb-2" style={{ color: textMuted }}>Ziyaret Notları</p>
              <div
                className="rounded-xl px-4 py-3"
                style={{ background: rowBg, border: `1px solid ${dividerColor}` }}
              >
                <p className="text-[12.5px] leading-relaxed" style={{ color: textSecondary }}>{ziyaret.notlar}</p>
              </div>
            </div>
          )}

          {/* Harita */}
          {ziyaret.konum_lat && ziyaret.konum_lng ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-[9.5px] font-bold uppercase tracking-[0.1em]" style={{ color: textMuted }}>Konum</p>
                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.08)', color: '#10B981' }}>
                  GPS Doğrulandı
                </span>
              </div>
              <div className="rounded-xl overflow-hidden" style={{ height: '160px', border: `1px solid ${borderColor}` }}>
                <iframe
                  src={`https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d1000!2d${ziyaret.konum_lng}!3d${ziyaret.konum_lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1str!2str!4v1`}
                  width="100%"
                  height="160"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Konum Haritası"
                />
              </div>
              <p className="text-[9px] mt-1.5" style={{ color: textMuted }}>
                {ziyaret.konum_lat.toFixed(4)}, {ziyaret.konum_lng.toFixed(4)}
              </p>
            </div>
          ) : (
            <div
              className="rounded-xl px-4 py-3 flex items-center gap-2.5"
              style={{ background: rowBg, border: `1px solid ${dividerColor}` }}
            >
              <i className="ri-map-pin-line text-sm flex-shrink-0" style={{ color: textMuted }} />
              <p className="text-xs" style={{ color: textMuted }}>Konum bilgisi mevcut değil</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {isAktif && (
          <div
            className="flex-shrink-0 px-5 py-4"
            style={{ borderTop: `1px solid ${dividerColor}` }}
          >
            {!bitirOnay ? (
              <button
                onClick={() => setBitirOnay(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold cursor-pointer whitespace-nowrap transition-all duration-150"
                style={{
                  background: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.06))',
                  border: '1.5px solid rgba(239,68,68,0.3)',
                  color: '#ef4444',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.18)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.06))'; }}
              >
                <i className="ri-stop-circle-line text-base" />
                Ziyareti Bitir
              </button>
            ) : (
              <div className="space-y-3">
                <div
                  className="flex items-start gap-3 p-3 rounded-xl"
                  style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}
                >
                  <i className="ri-alert-line text-base flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                  <p className="text-xs leading-relaxed" style={{ color: isDark ? '#fca5a5' : '#dc2626' }}>
                    Ziyaret sonlandırılacak. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setBitirOnay(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold cursor-pointer whitespace-nowrap"
                    style={{ background: rowBg, border: `1px solid ${borderColor}`, color: textMuted }}
                  >
                    Vazgeç
                  </button>
                  <button
                    onClick={handleBitir}
                    disabled={bitirLoading}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer whitespace-nowrap"
                    style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', opacity: bitirLoading ? 0.7 : 1 }}
                  >
                    {bitirLoading ? (
                      <><i className="ri-loader-4-line animate-spin" />Sonlandırılıyor...</>
                    ) : (
                      <><i className="ri-stop-circle-line" />Evet, Bitir</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
