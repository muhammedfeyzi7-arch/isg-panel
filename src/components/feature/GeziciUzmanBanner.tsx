import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';

/**
 * GeziciUzmanBanner
 *
 * Header'ın hemen altında sabit bir context bar.
 * Sadece gezici uzman + activeFirmIds.length > 1 durumunda render edilir.
 *
 * Özellikler:
 * - "Şu anda: [Firma Adı] firmasında çalışıyorsun" gösterir
 * - Firma değişince 2sn highlight animasyonu oynatır
 * - isSwitching sırasında loading durumu gösterir
 */
export default function GeziciUzmanBanner() {
  const { org, isSwitching } = useApp();
  const { logout } = useAuth();

  const [switched, setSwitched] = useState(false);
  const [switchedFirma, setSwitchedFirma] = useState<string | null>(null);
  const prevFirmaId = useRef<string | null>(null);
  const prevFirmaName = useRef<string | null>(null);
  const switchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Firma değişimini algıla → highlight animasyonu tetikle
  useEffect(() => {
    const currentId = org?.id ?? null;
    const currentName = org?.activeFirmName || org?.name || null;

    if (
      prevFirmaId.current &&
      currentId &&
      prevFirmaId.current !== currentId
    ) {
      setSwitchedFirma(currentName);
      setSwitched(true);
      if (switchTimerRef.current) clearTimeout(switchTimerRef.current);
      switchTimerRef.current = setTimeout(() => {
        setSwitched(false);
        setSwitchedFirma(null);
      }, 2200);
    }

    prevFirmaId.current = currentId;
    prevFirmaName.current = currentName;
  }, [org?.id, org?.activeFirmName, org?.name]);

  useEffect(() => () => {
    if (switchTimerRef.current) clearTimeout(switchTimerRef.current);
  }, []);

  // Sadece gezici uzman + 1'den fazla firma
  const multiFirem = (org?.activeFirmIds?.length ?? 0) > 1;
  if (org?.osgbRole !== 'gezici_uzman' || !multiFirem) return null;

  const firmaAdi = org.activeFirmName || org.name || '—';

  return (
    <>
      <style>{`
        @keyframes bannerPulse {
          0%   { opacity: 1; transform: scaleX(1); }
          50%  { opacity: 0.7; transform: scaleX(1.01); }
          100% { opacity: 1; transform: scaleX(1); }
        }
        @keyframes switchFlash {
          0%   { background-color: rgba(6,182,212,0.3); }
          60%  { background-color: rgba(6,182,212,0.12); }
          100% { background-color: transparent; }
        }
        @keyframes firmaBadgeIn {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .banner-switch-flash { animation: switchFlash 2s ease forwards; }
        .firma-badge-in { animation: firmaBadgeIn 0.35s cubic-bezier(0.22,0.61,0.36,1) forwards; }
      `}</style>

      <div
        className={`fixed left-0 right-0 z-[29] flex items-center gap-3 px-4 ${switched ? 'banner-switch-flash' : ''}`}
        style={{
          top: '46px',          // header yüksekliği kadar aşağıda
          height: '28px',
          background: switched
            ? 'rgba(6,182,212,0.14)'
            : 'rgba(6,182,212,0.07)',
          borderBottom: '1px solid rgba(6,182,212,0.18)',
          backdropFilter: 'blur(8px)',
          transition: 'background 0.4s ease',
        }}
      >
        {/* Sol: Gezici uzman etiketi */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div
            className="w-4 h-4 flex items-center justify-center rounded flex-shrink-0"
            style={{ background: 'rgba(6,182,212,0.15)' }}
          >
            <i className="ri-user-star-line text-[9px]" style={{ color: '#06B6D4' }} />
          </div>
          <span className="text-[10px] font-bold" style={{ color: '#06B6D4', letterSpacing: '0.04em' }}>
            GEZİCİ UZMAN
          </span>
        </div>

        {/* Ayırıcı */}
        <span style={{ color: 'rgba(6,182,212,0.25)', fontSize: '10px' }}>|</span>

        {/* Orta: Aktif firma bilgisi */}
        {isSwitching ? (
          /* Değişim sırasında loading */
          <div className="flex items-center gap-1.5">
            <i
              className="ri-loader-4-line text-[10px] animate-spin"
              style={{ color: '#06B6D4' }}
            />
            <span className="text-[10px] font-medium" style={{ color: 'rgba(6,182,212,0.7)' }}>
              Firma değiştiriliyor...
            </span>
          </div>
        ) : switched && switchedFirma ? (
          /* Switch sonrası geçici bildirim */
          <div className="flex items-center gap-1.5 firma-badge-in">
            <i className="ri-checkbox-circle-fill text-[10px]" style={{ color: '#06B6D4' }} />
            <span className="text-[10px] font-semibold" style={{ color: '#06B6D4' }}>
              Firma değiştirildi:&nbsp;
              <strong>{switchedFirma}</strong>
            </span>
          </div>
        ) : (
          /* Normal durum */
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]" style={{ color: 'rgba(6,182,212,0.55)' }}>
              Şu anda
            </span>
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(6,182,212,0.1)',
                border: '1px solid rgba(6,182,212,0.22)',
              }}
            >
              <i className="ri-building-2-line text-[9px]" style={{ color: '#22D3EE' }} />
              <span
                className="text-[10px] font-bold"
                style={{ color: '#22D3EE', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
              >
                {firmaAdi}
              </span>
            </div>
            <span className="text-[10px]" style={{ color: 'rgba(6,182,212,0.55)' }}>
              firmasında çalışıyorsun
            </span>
          </div>
        )}

        <div className="flex-1" />

        {/* Sağ: Firma sayısı */}
        <span
          className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={{
            background: 'rgba(6,182,212,0.08)',
            color: 'rgba(6,182,212,0.5)',
            border: '1px solid rgba(6,182,212,0.12)',
          }}
        >
          {org.activeFirmIds?.length} firma atandı
        </span>

        {/* Çıkış */}
        <button
          onClick={logout}
          className="flex items-center gap-1 cursor-pointer rounded transition-all flex-shrink-0"
          style={{ color: 'rgba(6,182,212,0.45)', padding: '2px 6px' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#EF4444'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(6,182,212,0.45)'; }}
          title="Oturumu kapat"
        >
          <i className="ri-logout-box-line text-[10px]" />
          <span className="text-[9px] font-medium hidden sm:block">Çıkış</span>
        </button>
      </div>
    </>
  );
}
