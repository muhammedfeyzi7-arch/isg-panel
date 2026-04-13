import { useEffect, useState } from 'react';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518';

const STEPS = [
  { label: 'Bağlantı kuruluyor...', icon: 'ri-wifi-line', duration: 500 },
  { label: 'OSGB bilgileri yükleniyor...', icon: 'ri-building-3-line', duration: 700 },
  { label: 'Firmalar hazırlanıyor...', icon: 'ri-community-line', duration: 700 },
  { label: 'Uzman verileri alınıyor...', icon: 'ri-user-star-line', duration: 600 },
  { label: 'Hazır!', icon: 'ri-check-double-line', duration: 300 },
];

interface OsgbLoadingScreenProps {
  onDone: () => void;
  isDark?: boolean;
}

export default function OsgbLoadingScreen({ onDone, isDark = false }: OsgbLoadingScreenProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    let current = 0;
    const total = STEPS.reduce((s, st) => s + st.duration, 0);
    let elapsed = 0;

    const tick = () => {
      if (current >= STEPS.length) {
        setFadeOut(true);
        setTimeout(() => onDone(), 400);
        return;
      }
      setStepIndex(current);
      const stepDuration = STEPS[current].duration;
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

  const step = STEPS[Math.min(stepIndex, STEPS.length - 1)];
  const isDone = stepIndex >= STEPS.length - 1 && progress >= 95;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{
        background: isDark ? '#0f172a' : '#f8fafc',
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 0.4s ease',
        pointerEvents: fadeOut ? 'none' : 'all',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes osgbLoadSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Logo & Başlık */}
      <div className="flex flex-col items-center gap-5 mb-10">
        <div
          className="w-16 h-16 flex items-center justify-center rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, rgba(14,165,233,0.18), rgba(14,165,233,0.06))',
            border: '1px solid rgba(14,165,233,0.3)',
            boxShadow: '0 0 40px rgba(14,165,233,0.15)',
          }}
        >
          <img
            src={LOGO_URL}
            alt="ISG Logo"
            style={{
              height: '32px', width: 'auto', objectFit: 'contain',
              filter: 'brightness(1.2) drop-shadow(0 0 8px rgba(14,165,233,0.5))',
            }}
          />
        </div>
        <div className="text-center">
          <h1
            className="text-2xl font-black"
            style={{ color: isDark ? '#f1f5f9' : '#0f172a', letterSpacing: '-0.04em' }}
          >
            ISG Denetim
          </h1>
          <p className="text-sm mt-1 font-semibold" style={{ color: '#0EA5E9' }}>
            OSGB Yönetim Paneli
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-64 mb-5">
        <div
          className="h-1 rounded-full overflow-hidden"
          style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-200"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #0EA5E9, #38BDF8)',
              boxShadow: '0 0 8px rgba(14,165,233,0.5)',
            }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px]" style={{ color: isDark ? '#475569' : '#94a3b8' }}>
            {Math.round(progress)}%
          </span>
          <span className="text-[10px]" style={{ color: isDark ? '#475569' : '#94a3b8' }}>
            {stepIndex + 1}/{STEPS.length}
          </span>
        </div>
      </div>

      {/* Step badge */}
      <div
        className="flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300"
        style={{
          background: isDone ? 'rgba(14,165,233,0.12)' : 'rgba(14,165,233,0.07)',
          border: `1px solid ${isDone ? 'rgba(14,165,233,0.3)' : 'rgba(14,165,233,0.15)'}`,
        }}
      >
        <i
          className={`${step.icon} text-sm`}
          style={{
            color: '#0EA5E9',
            animation: isDone ? 'none' : 'osgbLoadSpin 1.5s linear infinite',
          }}
        />
        <span className="text-xs font-semibold" style={{ color: '#0EA5E9' }}>{step.label}</span>
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
              background:
                i < stepIndex
                  ? '#0EA5E9'
                  : i === stepIndex
                  ? '#38BDF8'
                  : isDark
                  ? 'rgba(14,165,233,0.15)'
                  : 'rgba(14,165,233,0.12)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
