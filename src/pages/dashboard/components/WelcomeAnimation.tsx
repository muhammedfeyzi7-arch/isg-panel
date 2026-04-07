import { useState, useEffect } from 'react';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518';

const WELCOME_PARTICLES = Array.from({ length: 36 }, (_, i) => ({
  id: i,
  left: `${5 + Math.floor((i * 2.77) % 90)}%`,
  top: `${5 + Math.floor((i * 3.13) % 90)}%`,
  size: i % 4 === 0 ? 3 : i % 7 === 0 ? 2 : 1.5,
  delay: `${(i * 0.08) % 1.2}s`,
  duration: `${2.5 + (i * 0.21) % 2.5}s`,
  color: i % 3 === 0 ? '#06B6D4' : i % 5 === 0 ? '#10B981' : '#0FCCCE',
  opacity: i % 4 === 0 ? 0.7 : i % 3 === 0 ? 0.5 : 0.3,
}));

interface WelcomeAnimationProps {
  onDone: () => void;
}

export default function WelcomeAnimation({ onDone }: WelcomeAnimationProps) {
  const [phase, setPhase] = useState<'enter' | 'visible' | 'exit'>('enter');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('visible'), 400);
    const t2 = setTimeout(() => setPhase('exit'), 2800);
    const t3 = setTimeout(() => onDone(), 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(150deg, #040C1A 0%, #061628 50%, #050E1C 100%)',
    transition: 'opacity 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
    opacity: phase === 'exit' ? 0 : 1,
    pointerEvents: phase === 'exit' ? 'none' : 'all',
  };

  const contentStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0',
    transition: 'opacity 0.6s ease, transform 0.6s cubic-bezier(0.22, 0.61, 0.36, 1)',
    opacity: phase === 'visible' ? 1 : 0,
    transform: phase === 'visible' ? 'translateY(0)' : 'translateY(20px)',
  };

  return (
    <div style={overlayStyle}>
      <style>{`
        @keyframes wParticleFloat {
          0%, 100% { transform: translateY(0) scale(1); opacity: var(--wop); }
          50% { transform: translateY(-16px) scale(1.4); opacity: calc(var(--wop) * 1.8); }
        }
        @keyframes wGlowPulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.06); }
        }
        @keyframes wLogoGlow {
          0%, 100% { filter: drop-shadow(0 0 20px rgba(6,182,212,0.6)) drop-shadow(0 0 8px rgba(0,200,180,0.3)); }
          50% { filter: drop-shadow(0 0 36px rgba(6,182,212,0.9)) drop-shadow(0 0 16px rgba(0,200,180,0.55)); }
        }
        @keyframes wRingExpand {
          0% { transform: scale(0.7); opacity: 0.8; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes wTextSlide {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes wBarGrow {
          from { width: 0%; }
          to { width: 100%; }
        }
        .w-logo-img { animation: wLogoGlow 2.5s ease-in-out infinite; }
        .w-text-title {
          animation: wTextSlide 0.5s ease 0.35s both;
          color: #E2F8FB;
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.025em;
        }
        .w-text-sub {
          animation: wTextSlide 0.5s ease 0.55s both;
          color: #1E6B7C;
          font-size: 14px;
          margin-top: 8px;
        }
        .w-progress-bar {
          animation: wBarGrow 2.2s linear 0.6s both;
        }
        .w-ring {
          position: absolute;
          border-radius: 50%;
          border: 1.5px solid rgba(6,182,212,0.35);
        }
        .w-ring-1 { animation: wRingExpand 2.2s ease-out 0.3s infinite; width: 120px; height: 120px; }
        .w-ring-2 { animation: wRingExpand 2.2s ease-out 0.9s infinite; width: 120px; height: 120px; }
      `}</style>

      {/* Grid overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(6,182,212,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          pointerEvents: 'none',
        }}
      />

      {/* Ambient glows */}
      <div
        style={{
          position: 'absolute',
          top: '-80px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '700px',
          height: '450px',
          background: 'radial-gradient(ellipse, rgba(6,182,212,0.18) 0%, rgba(0,200,180,0.08) 45%, transparent 70%)',
          filter: 'blur(55px)',
          animation: 'wGlowPulse 4s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-40px',
          right: '-60px',
          width: '500px',
          height: '400px',
          background: 'radial-gradient(ellipse, rgba(16,185,129,0.12) 0%, transparent 65%)',
          filter: 'blur(55px)',
          animation: 'wGlowPulse 6s ease-in-out infinite 2s',
          pointerEvents: 'none',
        }}
      />

      {/* Particles */}
      {WELCOME_PARTICLES.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: p.left,
            top: p.top,
            width: `${p.size}px`,
            height: `${p.size}px`,
            borderRadius: '50%',
            background: p.color,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
            // @ts-expect-error custom css var
            '--wop': p.opacity,
            animation: `wParticleFloat ${p.duration} ease-in-out ${p.delay} infinite`,
            opacity: p.opacity,
            pointerEvents: 'none',
          } as React.CSSProperties}
        />
      ))}

      {/* Content */}
      <div style={contentStyle}>
        {/* Logo with rings */}
        <div style={{ position: 'relative', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '28px' }}>
          <div className="w-ring w-ring-1" />
          <div className="w-ring w-ring-2" />
          {/* Glow backdrop */}
          <div
            style={{
              position: 'absolute',
              inset: '-12px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(6,182,212,0.35) 0%, rgba(0,200,180,0.1) 55%, transparent 72%)',
              filter: 'blur(10px)',
              animation: 'wGlowPulse 2.5s ease-in-out infinite',
            }}
          />
          <img
            src={LOGO_URL}
            alt="ISG Denetim"
            className="w-logo-img"
            style={{
              width: '100px',
              height: '100px',
              objectFit: 'contain',
              position: 'relative',
              zIndex: 2,
            }}
          />
        </div>

        <p className="w-text-title">Hoş Geldiniz!</p>
        <p className="w-text-sub">ISG Denetim Yönetim Platformu&apos;na bağlandınız.</p>

        {/* Progress bar */}
        <div
          style={{
            marginTop: '32px',
            width: '180px',
            height: '2px',
            borderRadius: '99px',
            background: 'rgba(6,182,212,0.12)',
            overflow: 'hidden',
          }}
        >
          <div
            className="w-progress-bar"
            style={{
              height: '100%',
              background: 'linear-gradient(90deg, #06B6D4, #10B981)',
              borderRadius: '99px',
              boxShadow: '0 0 8px rgba(6,182,212,0.6)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
