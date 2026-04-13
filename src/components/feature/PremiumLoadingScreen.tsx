import { useEffect, useState } from 'react';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518';

const ACCENT = '#0EA5E9';

interface PremiumLoadingScreenProps {
  isDark?: boolean;
  panelName: string;
  panelSubtitle: string;
  steps: { label: string; icon: string; duration: number }[];
  onDone?: () => void;
}

export default function PremiumLoadingScreen({
  isDark = false,
  panelName,
  panelSubtitle,
  steps,
  onDone,
}: PremiumLoadingScreenProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    let current = 0;
    let elapsed = 0;
    const total = steps.reduce((s, st) => s + st.duration, 0);

    const tick = () => {
      if (current >= steps.length) {
        setFadeOut(true);
        setTimeout(() => onDone?.(), 400);
        return;
      }
      setStepIndex(current);
      const stepDuration = steps[current].duration;
      const stepStart = elapsed;

      const interval = setInterval(() => {
        elapsed += 20;
        setProgress(Math.min((elapsed / total) * 100, 100));
      }, 20);

      setTimeout(() => {
        clearInterval(interval);
        current++;
        elapsed = stepStart + stepDuration;
        tick();
      }, stepDuration);
    };

    tick();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const isDone = stepIndex >= steps.length - 1 && progress >= 95;
  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const trackColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)';
  const numColor = isDark ? '#475569' : '#94a3b8';

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{
        background: bgColor,
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 0.4s ease',
        pointerEvents: fadeOut ? 'none' : 'all',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @keyframes premiumSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes premiumRing {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes premiumPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.95); }
        }
        @keyframes premiumFadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Ambient glow blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full"
          style={{ background: `radial-gradient(circle, rgba(14,165,233,0.06) 0%, transparent 70%)`, filter: 'blur(40px)' }} />
        <div className="absolute bottom-1/3 right-1/3 w-48 h-48 rounded-full"
          style={{ background: `radial-gradient(circle, rgba(56,189,248,0.05) 0%, transparent 70%)`, filter: 'blur(32px)' }} />
      </div>

      {/* Logo + Title */}
      <div className="flex flex-col items-center gap-5 mb-10 relative">
        {/* Spinner ring around logo */}
        <div className="relative w-20 h-20">
          {/* Outer rotating ring */}
          <svg
            className="absolute inset-0 w-full h-full"
            style={{ animation: 'premiumRing 2s linear infinite' }}
            viewBox="0 0 80 80"
          >
            <circle
              cx="40" cy="40" r="36"
              fill="none"
              stroke={ACCENT}
              strokeWidth="2.5"
              strokeDasharray="60 160"
              strokeLinecap="round"
              opacity="0.7"
            />
          </svg>
          {/* Inner slow ring */}
          <svg
            className="absolute inset-0 w-full h-full"
            style={{ animation: 'premiumRing 3s linear infinite reverse' }}
            viewBox="0 0 80 80"
          >
            <circle
              cx="40" cy="40" r="30"
              fill="none"
              stroke={ACCENT}
              strokeWidth="1.5"
              strokeDasharray="30 160"
              strokeLinecap="round"
              opacity="0.35"
            />
          </svg>
          {/* Logo center */}
          <div
            className="absolute inset-2 flex items-center justify-center rounded-2xl"
            style={{
              background: isDark
                ? 'linear-gradient(135deg, rgba(14,165,233,0.18), rgba(14,165,233,0.06))'
                : 'linear-gradient(135deg, rgba(14,165,233,0.12), rgba(14,165,233,0.04))',
              border: '1px solid rgba(14,165,233,0.3)',
              boxShadow: '0 0 24px rgba(14,165,233,0.12)',
            }}
          >
            <img
              src={LOGO_URL}
              alt="ISG Logo"
              style={{
                height: '28px',
                width: 'auto',
                objectFit: 'contain',
                filter: 'brightness(1.2) drop-shadow(0 0 6px rgba(14,165,233,0.5))',
              }}
            />
          </div>
        </div>

        <div className="text-center" style={{ animation: 'premiumFadeUp 0.5s ease forwards' }}>
          <h1
            className="text-2xl font-black leading-tight"
            style={{ color: isDark ? '#f1f5f9' : '#0f172a', letterSpacing: '-0.04em' }}
          >
            {panelName}
          </h1>
          <p className="text-sm mt-1.5 font-semibold" style={{ color: ACCENT }}>
            {panelSubtitle}
          </p>
        </div>
      </div>

      {/* Progress section */}
      <div className="w-72 mb-6 relative">
        {/* Progress bar */}
        <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: trackColor }}>
          <div
            className="h-full rounded-full transition-all duration-200"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #0284C7, #0EA5E9, #38BDF8)',
              boxShadow: '0 0 12px rgba(14,165,233,0.6)',
            }}
          />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-semibold" style={{ color: numColor }}>
            {Math.round(progress)}%
          </span>
          <span className="text-[10px] font-semibold" style={{ color: numColor }}>
            {stepIndex + 1} / {steps.length}
          </span>
        </div>
      </div>

      {/* Step indicator */}
      <div
        key={step.label}
        className="flex items-center gap-2.5 px-5 py-2.5 rounded-full transition-all duration-300 mb-6"
        style={{
          background: isDone
            ? 'rgba(14,165,233,0.12)'
            : isDark ? 'rgba(14,165,233,0.07)' : 'rgba(14,165,233,0.06)',
          border: `1px solid ${isDone ? 'rgba(14,165,233,0.35)' : 'rgba(14,165,233,0.18)'}`,
          animation: 'premiumFadeUp 0.25s ease forwards',
        }}
      >
        {/* Spinner icon */}
        {isDone ? (
          <i className="ri-check-double-line text-sm" style={{ color: ACCENT }} />
        ) : (
          <div className="relative w-4 h-4 flex-shrink-0">
            <svg className="w-4 h-4" style={{ animation: 'premiumSpin 1s linear infinite' }} viewBox="0 0 16 16">
              <circle cx="8" cy="8" r="6" fill="none" stroke={`${ACCENT}30`} strokeWidth="2" />
              <circle cx="8" cy="8" r="6" fill="none" stroke={ACCENT} strokeWidth="2"
                strokeDasharray="10 28" strokeLinecap="round" />
            </svg>
          </div>
        )}
        <span className="text-xs font-semibold" style={{ color: ACCENT }}>
          {step.label}
        </span>
      </div>

      {/* Dot stepper */}
      <div className="flex items-center gap-2">
        {steps.map((_, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-400"
            style={{
              width: i === stepIndex ? '22px' : '7px',
              height: '7px',
              background: i < stepIndex
                ? ACCENT
                : i === stepIndex
                  ? '#38BDF8'
                  : isDark ? 'rgba(14,165,233,0.15)' : 'rgba(14,165,233,0.12)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
