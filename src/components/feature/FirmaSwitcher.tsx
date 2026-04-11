import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '@/store/AppContext';

interface FirmaOption {
  id: string;
  name: string;
}

interface FirmaSwitcherProps {
  /** Header theme — dark/light */
  isDark: boolean;
}

/**
 * FirmaSwitcher — sadece gezici uzman + activeFirmIds.length > 1 durumunda render edilir.
 *
 * Özellikler:
 * - Aktif firma adını gösterir
 * - Tıklayınca tüm atanmış firmalar listelenir
 * - Seçim → switchActiveFirma(id) → navigate YOK, state değişir
 * - isSwitching=true → disabled + spinner
 */
export default function FirmaSwitcher({ isDark }: FirmaSwitcherProps) {
  const { org, isSwitching, switchActiveFirma, fetchActiveFirmNames } = useApp();

  const [open, setOpen] = useState(false);
  const [firmalar, setFirmalar] = useState<FirmaOption[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [secimYapiliyor, setSecimYapiliyor] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sadece gezici uzman + 1'den fazla firma varsa göster
  const goster = org?.osgbRole === 'gezici_uzman' && (org.activeFirmIds?.length ?? 0) > 1;

  const loadFirmalar = useCallback(async () => {
    if (!goster) return;
    setYukleniyor(true);
    const list = await fetchActiveFirmNames();
    setFirmalar(list);
    setYukleniyor(false);
  }, [goster, fetchActiveFirmNames]);

  // Dropdown açılınca firma listesini çek (cache'le — org değişince temizle)
  useEffect(() => {
    if (open && firmalar.length === 0) {
      loadFirmalar();
    }
  }, [open, firmalar.length, loadFirmalar]);

  // Org değişince firma listesi cache'ini temizle
  useEffect(() => {
    setFirmalar([]);
  }, [org?.activeFirmIds]);

  // Dışarı tıklayınca kapat
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // ESC ile kapat
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  if (!goster) return null;

  const activeFirmaName = org?.activeFirmName || org?.name || 'Firma';
  const disabled = isSwitching || !!secimYapiliyor;

  // ── Theme tokens ──
  const triggerBg     = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.038)';
  const triggerBorder = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.09)';
  const triggerColor  = isDark ? '#CBD5E1' : '#334155';
  const dropdownBg    = isDark ? '#1E293B' : '#FFFFFF';
  const dropdownBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.09)';
  const itemHover     = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.038)';

  const handleSecim = async (firmaId: string) => {
    if (firmaId === org?.id || disabled) return;
    setSecimYapiliyor(firmaId);
    setOpen(false);
    await switchActiveFirma(firmaId);
    setSecimYapiliyor(null);
  };

  return (
    <div className="relative flex-shrink-0 hidden md:block" ref={dropdownRef}>
      {/* ── Trigger butonu ── */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 cursor-pointer rounded-lg transition-all duration-200"
        style={{
          padding: '4px 8px 4px 6px',
          background: disabled
            ? (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)')
            : open
              ? (isDark ? 'rgba(6,182,212,0.12)' : 'rgba(6,182,212,0.08)')
              : triggerBg,
          border: `1px solid ${open ? 'rgba(6,182,212,0.3)' : triggerBorder}`,
          opacity: disabled ? 0.65 : 1,
          maxWidth: '180px',
        }}
        onMouseEnter={e => {
          if (!disabled && !open) {
            e.currentTarget.style.background = isDark ? 'rgba(6,182,212,0.1)' : 'rgba(6,182,212,0.07)';
            e.currentTarget.style.borderColor = 'rgba(6,182,212,0.25)';
          }
        }}
        onMouseLeave={e => {
          if (!disabled && !open) {
            e.currentTarget.style.background = triggerBg;
            e.currentTarget.style.borderColor = triggerBorder;
          }
        }}
      >
        {/* Firma ikonu */}
        <div
          className="w-5 h-5 flex items-center justify-center rounded flex-shrink-0"
          style={{ background: 'rgba(6,182,212,0.12)' }}
        >
          {isSwitching || secimYapiliyor ? (
            <i
              className="ri-loader-4-line text-[10px] animate-spin"
              style={{ color: '#06B6D4' }}
            />
          ) : (
            <i className="ri-building-2-line text-[10px]" style={{ color: '#06B6D4' }} />
          )}
        </div>

        {/* Firma adı */}
        <div className="flex flex-col items-start min-w-0">
          <span
            className="text-[9px] font-semibold leading-none mb-0.5 uppercase tracking-wide"
            style={{ color: '#06B6D4', letterSpacing: '0.06em' }}
          >
            Aktif Firma
          </span>
          <span
            className="text-[11px] font-bold truncate leading-none"
            style={{ color: triggerColor, maxWidth: '110px' }}
          >
            {isSwitching ? 'Değiştiriliyor...' : activeFirmaName}
          </span>
        </div>

        {/* Ok ikonu */}
        <i
          className={`ri-arrow-down-s-line text-xs flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          style={{ color: isDark ? '#475569' : '#94A3B8' }}
        />
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div
          className="absolute left-0 top-11 z-50 min-w-[220px] animate-slide-up overflow-hidden"
          style={{
            background: dropdownBg,
            border: `1px solid ${dropdownBorder}`,
            borderRadius: '14px',
            boxShadow: isDark
              ? '0 20px 50px rgba(0,0,0,0.55)'
              : '0 16px 40px rgba(15,23,42,0.14)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Dropdown header */}
          <div
            className="px-4 py-2.5 flex items-center gap-2"
            style={{ borderBottom: `1px solid ${dropdownBorder}` }}
          >
            <div
              className="w-6 h-6 flex items-center justify-center rounded-lg flex-shrink-0"
              style={{ background: 'rgba(6,182,212,0.1)' }}
            >
              <i className="ri-swap-line text-[11px]" style={{ color: '#06B6D4' }} />
            </div>
            <p
              className="text-[11.5px] font-bold"
              style={{ color: isDark ? '#E2E8F0' : '#0F172A' }}
            >
              Firma Değiştir
            </p>
            <span
              className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{
                background: 'rgba(6,182,212,0.1)',
                color: '#06B6D4',
                border: '1px solid rgba(6,182,212,0.2)',
              }}
            >
              {org?.activeFirmIds?.length ?? 0} firma
            </span>
          </div>

          {/* Firma listesi */}
          <div className="py-1.5 max-h-64 overflow-y-auto">
            {yukleniyor ? (
              <div className="flex items-center justify-center py-6 gap-2">
                <i
                  className="ri-loader-4-line text-sm animate-spin"
                  style={{ color: '#06B6D4' }}
                />
                <span className="text-[11px]" style={{ color: isDark ? '#64748B' : '#94A3B8' }}>
                  Yükleniyor...
                </span>
              </div>
            ) : (
              firmalar.map(firma => {
                const isActive = firma.id === org?.id;
                const isLoading = secimYapiliyor === firma.id;

                return (
                  <button
                    key={firma.id}
                    type="button"
                    disabled={isActive || disabled}
                    onClick={() => handleSecim(firma.id)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-150 cursor-pointer"
                    style={{
                      background: isActive
                        ? (isDark ? 'rgba(6,182,212,0.1)' : 'rgba(6,182,212,0.07)')
                        : 'transparent',
                      cursor: isActive ? 'default' : 'pointer',
                      opacity: disabled && !isActive ? 0.5 : 1,
                    }}
                    onMouseEnter={e => {
                      if (!isActive && !disabled) {
                        e.currentTarget.style.background = itemHover;
                      }
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = isActive
                        ? (isDark ? 'rgba(6,182,212,0.1)' : 'rgba(6,182,212,0.07)')
                        : 'transparent';
                    }}
                  >
                    {/* Durum ikonu */}
                    <div
                      className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
                      style={{
                        background: isActive
                          ? 'rgba(6,182,212,0.15)'
                          : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)'),
                        border: isActive
                          ? '1px solid rgba(6,182,212,0.3)'
                          : `1px solid ${dropdownBorder}`,
                      }}
                    >
                      {isLoading ? (
                        <i
                          className="ri-loader-4-line text-[11px] animate-spin"
                          style={{ color: '#06B6D4' }}
                        />
                      ) : isActive ? (
                        <i
                          className="ri-checkbox-circle-fill text-[11px]"
                          style={{ color: '#06B6D4' }}
                        />
                      ) : (
                        <i
                          className="ri-building-2-line text-[11px]"
                          style={{ color: isDark ? '#475569' : '#94A3B8' }}
                        />
                      )}
                    </div>

                    {/* Firma adı */}
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[12px] font-semibold truncate"
                        style={{
                          color: isActive
                            ? '#06B6D4'
                            : (isDark ? '#CBD5E1' : '#334155'),
                        }}
                      >
                        {firma.name}
                      </p>
                      {isActive && (
                        <p
                          className="text-[10px] mt-0.5"
                          style={{ color: '#06B6D4', opacity: 0.75 }}
                        >
                          Şu an aktif
                        </p>
                      )}
                    </div>

                    {/* Sağ ok (aktif olmayan için) */}
                    {!isActive && !isLoading && (
                      <i
                        className="ri-arrow-right-line text-[11px] flex-shrink-0"
                        style={{ color: isDark ? '#334155' : '#CBD5E1' }}
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div
            className="px-4 py-2.5"
            style={{ borderTop: `1px solid ${dropdownBorder}` }}
          >
            <p
              className="text-[10px] text-center"
              style={{ color: isDark ? '#334155' : '#CBD5E1' }}
            >
              Firma değişiminde tüm veriler güncellenir
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
