import { useState } from 'react';

interface AltFirma {
  id: string;
  name: string;
  uzmanAd: string | null;
}

interface Uzman {
  user_id: string;
  display_name: string;
  email: string;
  is_active: boolean;
  active_firm_id: string | null;
  active_firm_ids: string[] | null;
  active_firm_name: string | null;
}

interface OsgbOnboardingProps {
  firmalar: AltFirma[];
  uzmanlar: Uzman[];
  isDark: boolean;
  onFirmaEkle: () => void;
  onUzmanEkle: () => void;
  onAtamaYap: () => void;
}

// Kurulum adımı durumu hesapla
function getSetupState(firmalar: AltFirma[], uzmanlar: Uzman[]) {
  const firmaVar = firmalar.length > 0;
  const uzmanVar = uzmanlar.length > 0;
  const baglantiVar = firmalar.some(f => f.uzmanAd !== null);

  const completedSteps = [firmaVar, uzmanVar, baglantiVar].filter(Boolean).length;
  const progress = Math.round((completedSteps / 3) * 100);

  return { firmaVar, uzmanVar, baglantiVar, completedSteps, progress };
}

export default function OsgbOnboarding({
  firmalar,
  uzmanlar,
  isDark,
  onFirmaEkle,
  onUzmanEkle,
  onAtamaYap,
}: OsgbOnboardingProps) {
  const { firmaVar, uzmanVar, baglantiVar, completedSteps, progress } = getSetupState(firmalar, uzmanlar);
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);

  const textPrimary = 'var(--text-primary)';
  const textMuted = 'var(--text-muted)';
  const cardBg = 'var(--bg-card-solid)';
  const borderSubtle = 'var(--border-subtle)';

  const steps = [
    {
      index: 1,
      icon: 'ri-building-2-line',
      title: 'Firma Ekle',
      description: 'Hizmet verdiğiniz müşteri firmayı sisteme tanıtın.',
      detail: 'Firma adı, iletişim bilgileri ve sözleşme tarihlerini ekleyin.',
      color: '#10B981',
      colorBg: 'rgba(16,185,129,0.1)',
      colorBorder: 'rgba(16,185,129,0.2)',
      done: firmaVar,
      active: !firmaVar,
      actionLabel: firmaVar ? `${firmalar.length} Firma Eklendi` : 'Firma Ekle',
      onAction: onFirmaEkle,
    },
    {
      index: 2,
      icon: 'ri-user-star-line',
      title: 'Uzman Ekle',
      description: 'Sahada çalışacak gezici uzmanı sisteme ekleyin.',
      detail: 'İsim, e-posta ve şifre bilgileriyle uzman hesabı oluşturun.',
      color: '#8B5CF6',
      colorBg: 'rgba(139,92,246,0.1)',
      colorBorder: 'rgba(139,92,246,0.2)',
      done: uzmanVar,
      active: firmaVar && !uzmanVar,
      locked: !firmaVar,
      actionLabel: uzmanVar ? `${uzmanlar.length} Uzman Eklendi` : 'Uzman Ekle',
      onAction: onUzmanEkle,
    },
    {
      index: 3,
      icon: 'ri-links-line',
      title: 'Uzman Ata',
      description: 'Uzmanı bir firmaya atayarak süreci tamamlayın.',
      detail: 'Hangi uzmanın hangi firmada görev yapacağını belirleyin.',
      color: '#F59E0B',
      colorBg: 'rgba(245,158,11,0.1)',
      colorBorder: 'rgba(245,158,11,0.2)',
      done: baglantiVar,
      active: firmaVar && uzmanVar && !baglantiVar,
      locked: !firmaVar || !uzmanVar,
      actionLabel: baglantiVar ? 'Atama Tamamlandı' : 'Uzman Ata',
      onAction: onAtamaYap,
    },
  ];

  const progressColor =
    progress === 100
      ? 'linear-gradient(90deg, #10B981, #34D399)'
      : progress >= 66
      ? 'linear-gradient(90deg, #10B981, #F59E0B)'
      : progress >= 33
      ? 'linear-gradient(90deg, #10B981, #8B5CF6)'
      : 'linear-gradient(90deg, #10B981, #10B981)';

  const progressLabel =
    progress === 100
      ? 'Kurulum tamamlandı!'
      : progress >= 66
      ? 'Neredeyse bitti...'
      : progress >= 33
      ? 'İyi gidiyorsunuz!'
      : 'Kuruluma başlayın';

  return (
    <div className="space-y-6 page-enter">
      {/* ── Üst Karşılama + Progress ── */}
      <div
        className="rounded-2xl p-6 relative overflow-hidden"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(139,92,246,0.06) 50%, rgba(245,158,11,0.05) 100%)'
            : 'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(139,92,246,0.04) 50%, rgba(245,158,11,0.03) 100%)',
          border: '1px solid rgba(16,185,129,0.15)',
        }}
      >
        {/* Dekoratif arka plan ikonları */}
        <div className="absolute top-4 right-8 opacity-5">
          <i className="ri-settings-3-line text-6xl" style={{ color: '#10B981' }} />
        </div>
        <div className="absolute bottom-2 right-32 opacity-5">
          <i className="ri-building-2-line text-5xl" style={{ color: '#8B5CF6' }} />
        </div>

        <div className="relative z-10">
          <div className="flex items-start justify-between flex-wrap gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <div
                  className="w-7 h-7 flex items-center justify-center rounded-lg"
                  style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.25)' }}
                >
                  <i className="ri-rocket-2-line text-xs" style={{ color: '#10B981' }} />
                </div>
                <span
                  className="text-[10px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(16,185,129,0.1)',
                    border: '1px solid rgba(16,185,129,0.2)',
                    color: '#10B981',
                  }}
                >
                  Kurulum Rehberi
                </span>
              </div>
              <h2 className="text-lg font-extrabold" style={{ color: textPrimary }}>
                OSGB Panelinizi Kurun
              </h2>
              <p className="text-sm mt-1" style={{ color: textMuted }}>
                3 adımda sistemi hazır hale getirin, firmalarınızı yönetmeye başlayın.
              </p>
            </div>

            {/* Progress çember */}
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center relative"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                  border: '3px solid rgba(16,185,129,0.15)',
                }}
              >
                {/* Dairesel progress göstergesi */}
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 64 64">
                  <circle
                    cx="32" cy="32" r="28"
                    fill="none"
                    stroke="rgba(16,185,129,0.2)"
                    strokeWidth="4"
                  />
                  <circle
                    cx="32" cy="32" r="28"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 28}`}
                    strokeDashoffset={`${2 * Math.PI * 28 * (1 - progress / 100)}`}
                    style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                  />
                </svg>
                <span className="text-base font-extrabold relative z-10" style={{ color: '#10B981' }}>
                  {progress}%
                </span>
              </div>
              <p className="text-[10px] font-semibold text-center" style={{ color: textMuted }}>
                {progressLabel}
              </p>
            </div>
          </div>

          {/* Linear progress bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold" style={{ color: textMuted }}>
                {completedSteps}/3 adım tamamlandı
              </span>
              <span className="text-[10px] font-bold" style={{ color: '#10B981' }}>
                %{progress}
              </span>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progress}%`, background: progressColor }}
              />
            </div>
            {/* Step dots */}
            <div className="flex items-center justify-between pt-0.5">
              {steps.map(s => (
                <div key={s.index} className="flex items-center gap-1">
                  <div
                    className="w-2 h-2 rounded-full transition-all"
                    style={{
                      background: s.done ? '#10B981' : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                      boxShadow: s.done ? '0 0 5px rgba(16,185,129,0.5)' : 'none',
                    }}
                  />
                  <span
                    className="text-[9px] font-medium"
                    style={{ color: s.done ? '#10B981' : textMuted }}
                  >
                    {s.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Step Kartları ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {steps.map(step => {
          const isHovered = hoveredStep === step.index;
          const canAct = !step.locked && !step.done;
          const showPulse = step.active && !step.done;

          return (
            <div
              key={step.index}
              className="rounded-2xl p-5 relative overflow-hidden transition-all duration-200"
              style={{
                background: step.done
                  ? (isDark ? `${step.colorBg}` : step.colorBg)
                  : step.locked
                  ? (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)')
                  : (isDark ? step.colorBg : step.colorBg),
                border: step.done
                  ? `1.5px solid ${step.colorBorder}`
                  : step.locked
                  ? `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`
                  : step.active
                  ? `1.5px solid ${step.colorBorder}`
                  : `1px solid ${borderSubtle}`,
                opacity: step.locked ? 0.5 : 1,
                transform: isHovered && !step.locked ? 'translateY(-2px)' : 'none',
              }}
              onMouseEnter={() => setHoveredStep(step.index)}
              onMouseLeave={() => setHoveredStep(null)}
            >
              {/* Adım numarası + aktif pulse */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center relative"
                    style={{
                      background: step.done
                        ? step.colorBg
                        : step.locked
                        ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)')
                        : step.colorBg,
                      border: step.done
                        ? `1.5px solid ${step.colorBorder}`
                        : step.locked
                        ? (isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)')
                        : `1.5px solid ${step.colorBorder}`,
                    }}
                  >
                    {step.done ? (
                      <i className="ri-check-line text-base" style={{ color: step.color }} />
                    ) : step.locked ? (
                      <i className="ri-lock-2-line text-sm" style={{ color: textMuted }} />
                    ) : (
                      <i className={`${step.icon} text-sm`} style={{ color: step.color }} />
                    )}
                    {showPulse && (
                      <span
                        className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full animate-pulse"
                        style={{ background: step.color, boxShadow: `0 0 6px ${step.color}` }}
                      />
                    )}
                  </div>
                  <div>
                    <span
                      className="text-[10px] font-bold uppercase tracking-wide"
                      style={{
                        color: step.done ? step.color : step.locked ? textMuted : step.color,
                        opacity: step.locked ? 0.6 : 1,
                      }}
                    >
                      Adım {step.index}
                    </span>
                  </div>
                </div>

                {step.done && (
                  <div
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                    style={{
                      background: `${step.colorBg}`,
                      border: `1px solid ${step.colorBorder}`,
                    }}
                  >
                    <i className="ri-check-double-line text-[10px]" style={{ color: step.color }} />
                    <span className="text-[9px] font-bold" style={{ color: step.color }}>
                      Tamamlandı
                    </span>
                  </div>
                )}
              </div>

              {/* İçerik */}
              <div className="mb-5">
                <h3
                  className="text-sm font-bold mb-1.5"
                  style={{ color: step.locked ? textMuted : textPrimary }}
                >
                  {step.title}
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: textMuted }}>
                  {step.description}
                </p>
                {!step.locked && !step.done && (
                  <p
                    className="text-[10.5px] mt-2 leading-relaxed"
                    style={{ color: step.color, opacity: 0.8 }}
                  >
                    <i className="ri-information-line mr-1" />
                    {step.detail}
                  </p>
                )}
              </div>

              {/* Aksiyon butonu */}
              {!step.locked && (
                <button
                  onClick={canAct ? step.onAction : undefined}
                  disabled={step.done}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                  style={{
                    background: step.done
                      ? `${step.colorBg}`
                      : `${step.colorBg}`,
                    border: `1.5px solid ${step.colorBorder}`,
                    color: step.done ? step.color : step.color,
                    cursor: step.done ? 'default' : 'pointer',
                    opacity: step.done ? 0.8 : 1,
                  }}
                  onMouseEnter={e => {
                    if (!step.done) {
                      (e.currentTarget as HTMLElement).style.background = isDark
                        ? `rgba(${hexToRgb(step.color)}, 0.2)`
                        : `rgba(${hexToRgb(step.color)}, 0.15)`;
                    }
                  }}
                  onMouseLeave={e => {
                    if (!step.done) {
                      (e.currentTarget as HTMLElement).style.background = step.colorBg;
                    }
                  }}
                >
                  {step.done ? (
                    <>
                      <i className="ri-check-line" />
                      {step.actionLabel}
                    </>
                  ) : (
                    <>
                      <i className={step.icon} />
                      {step.actionLabel}
                      <i className="ri-arrow-right-line text-xs ml-auto" />
                    </>
                  )}
                </button>
              )}

              {step.locked && (
                <div
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                    border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)',
                    color: textMuted,
                  }}
                >
                  <i className="ri-lock-2-line text-xs" />
                  Önceki adımı tamamlayın
                </div>
              )}

              {/* Dekoratif arka plan ikonu */}
              <div
                className="absolute bottom-3 right-4 opacity-[0.04] pointer-events-none"
                style={{ fontSize: '64px', lineHeight: 1 }}
              >
                <i className={step.icon} style={{ color: step.color }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Alt bilgi / Tamamlandı mesajı ── */}
      {progress === 100 ? (
        <div
          className="rounded-2xl p-5 flex items-center gap-4"
          style={{
            background: 'rgba(16,185,129,0.06)',
            border: '1.5px solid rgba(16,185,129,0.2)',
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(16,185,129,0.12)' }}
          >
            <i className="ri-checkbox-circle-line text-xl" style={{ color: '#10B981' }} />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: '#10B981' }}>
              Kurulum Tamamlandı!
            </p>
            <p className="text-xs mt-0.5" style={{ color: textMuted }}>
              Harika! Artık tüm firma ve uzman yönetimini bu panel üzerinden yapabilirsiniz.
            </p>
          </div>
        </div>
      ) : (
        <div
          className="rounded-2xl p-4 flex items-start gap-3"
          style={{
            background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
            border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.05)',
          }}
        >
          <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(16,185,129,0.08)' }}>
            <i className="ri-lightbulb-line text-xs" style={{ color: '#10B981' }} />
          </div>
          <div>
            <p className="text-xs font-semibold" style={{ color: textPrimary }}>
              İpucu
            </p>
            <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: textMuted }}>
              {!firmaVar
                ? 'Önce bir müşteri firma ekleyin. Firma eklendikten sonra uzman ekleyebilir ve atama yapabilirsiniz.'
                : !uzmanVar
                ? 'Firma eklendi! Şimdi sahada çalışacak bir gezici uzman oluşturun.'
                : 'Uzman eklendi! Son adım olarak uzmanı firmaya atayın ve kurulumu tamamlayın.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Yardımcı: hex rengi RGB'ye çevir (hover animasyonu için)
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '16,185,129';
  return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`;
}
