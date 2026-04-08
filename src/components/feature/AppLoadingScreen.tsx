import { useEffect, useState } from 'react';

const STEPS = [
  { label: 'Bağlantı kuruluyor...', icon: 'ri-wifi-line', duration: 600 },
  { label: 'Organizasyon yükleniyor...', icon: 'ri-building-2-line', duration: 700 },
  { label: 'Veriler hazırlanıyor...', icon: 'ri-database-2-line', duration: 900 },
  { label: 'Hazır!', icon: 'ri-check-double-line', duration: 400 },
];

interface AppLoadingScreenProps {
  onDone?: () => void;
}

export default function AppLoadingScreen({ onDone }: AppLoadingScreenProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    let current = 0;
    let elapsed = 0;
    const total = STEPS.reduce((s, st) => s + st.duration, 0);

    const tick = () => {
      if (current >= STEPS.length) {
        setFadeOut(true);
        setTimeout(() => onDone?.(), 400);
        return;
      }
      setStepIndex(current);
      const stepDuration = STEPS[current].duration;
      const stepStart = elapsed;

      const interval = setInterval(() => {
        elapsed += 30;
        const pct = Math.min((elapsed / total) * 100, 100);
        setProgress(pct);
      }, 30);

      setTimeout(() => {
        clearInterval(interval);
        current++;
        tick();
      }, stepDuration);

      elapsed = stepStart + stepDuration;
    };

    tick();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const step = STEPS[Math.min(stepIndex, STEPS.length - 1)];
  const isDone = stepIndex >= STEPS.length - 1 && progress >= 95;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{
        background: 'var(--bg-app)',
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 0.4s ease',
        pointerEvents: fadeOut ? 'none' : 'all',
      }}
    >
      {/* Logo */}
      <div className="flex flex-col items-center gap-6 mb-10">
        <div
          className="w-16 h-16 flex items-center justify-center rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(99,102,241,0.08))',
            border: '1px solid rgba(99,102,241,0.3)',
            boxShadow: '0 0 40px rgba(99,102,241,0.15)',
          }}
        >
          <img
            src="https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518"
            alt="ISG Logo"
            style={{ height: '32px', width: 'auto', objectFit: 'contain', filter: 'brightness(1.2) drop-shadow(0 0 8px rgba(99,102,241,0.5))' }}
          />
        </div>
        <div className="text-center">
          <h1
            className="text-2xl font-black"
            style={{ color: 'var(--text-primary)', letterSpacing: '-0.04em' }}
          >
            ISG Denetim
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Yönetim Sistemi
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-64 mb-5">
        <div
          className="h-1 rounded-full overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #6366F1, #818CF8)',
              boxShadow: '0 0 8px rgba(99,102,241,0.5)',
            }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {Math.round(progress)}%
          </span>
        </div>
      </div>

      {/* Step indicator */}
      <div
        className="flex items-center gap-2 px-4 py-2 rounded-full"
        style={{
          background: isDone ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.08)',
          border: `1px solid ${isDone ? 'rgba(16,185,129,0.2)' : 'rgba(99,102,241,0.15)'}`,
          transition: 'all 0.3s ease',
        }}
      >
        <i
          className={`${step.icon} text-sm`}
          style={{
            color: isDone ? '#10B981' : '#818CF8',
            animation: isDone ? 'none' : 'spin 1.5s linear infinite',
          }}
        />
        <span
          className="text-xs font-semibold"
          style={{ color: isDone ? '#10B981' : '#818CF8' }}
        >
          {step.label}
        </span>
      </div>

      {/* Step dots */}
      <div className="flex items-center gap-2 mt-6">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === stepIndex ? '20px' : '6px',
              height: '6px',
              background: i < stepIndex
                ? '#10B981'
                : i === stepIndex
                  ? '#818CF8'
                  : 'rgba(255,255,255,0.1)',
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
