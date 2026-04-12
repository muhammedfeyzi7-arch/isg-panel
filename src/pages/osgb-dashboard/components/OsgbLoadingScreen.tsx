import { useEffect, useState } from 'react';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518';

interface OsgbLoadingScreenProps {
  onDone: () => void;
}

export default function OsgbLoadingScreen({ onDone }: OsgbLoadingScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // 2.2 saniye sonra fade out başlat, 2.6'da done çağır
    const fadeTimer = setTimeout(() => setFadeOut(true), 2200);
    const doneTimer = setTimeout(() => onDone(), 2600);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 40%, #f0fdf4 100%)',
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 0.4s ease',
        pointerEvents: fadeOut ? 'none' : 'all',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes osgbSpin { to { transform: rotate(360deg); } }
        @keyframes osgbFadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .osgb-fadein { animation: osgbFadeIn 0.4s ease forwards; }
      `}</style>

      <div className="osgb-fadein flex flex-col items-center gap-6">
        {/* Spinner ring + Logo */}
        <div className="relative w-16 h-16 flex items-center justify-center">
          {/* Outer ring */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              border: '3px solid rgba(6,182,212,0.15)',
              borderTop: '3px solid #06B6D4',
              animation: 'osgbSpin 0.9s linear infinite',
            }}
          />
          {/* Inner ring (counter spin for nice effect) */}
          <div
            className="absolute rounded-full"
            style={{
              inset: '6px',
              border: '2px solid rgba(14,165,233,0.1)',
              borderBottom: '2px solid rgba(14,165,233,0.4)',
              animation: 'osgbSpin 1.4s linear infinite reverse',
            }}
          />
          {/* Logo center */}
          <img
            src={LOGO_URL}
            alt="ISG"
            className="w-8 h-8 object-contain relative z-10"
          />
        </div>

        {/* Text */}
        <div className="text-center">
          <p className="text-sm font-semibold" style={{ color: '#0f172a' }}>
            OSGB Paneli yükleniyor
          </p>
          <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>
            Lütfen bekleyin...
          </p>
        </div>
      </div>
    </div>
  );
}
