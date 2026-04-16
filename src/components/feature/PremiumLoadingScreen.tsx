import { useEffect, useState } from 'react';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518';

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
  const [visible, setVisible] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  const totalDuration = steps.reduce((s, st) => s + st.duration, 0);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 30);
    const t2 = setTimeout(() => {
      setFadeOut(true);
      setTimeout(() => onDone?.(), 500);
    }, totalDuration);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bg = isDark
    ? '#080f1e'
    : '#f8fafc';

  const accent = '#0EA5E9';
  const accent2 = '#38BDF8';
  const accent3 = '#7DD3FC';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: bg,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Inter', sans-serif",
        opacity: fadeOut ? 0 : visible ? 1 : 0,
        transition: fadeOut ? 'opacity 0.5s ease' : 'opacity 0.4s ease',
        overflow: 'hidden',
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        @keyframes pls-spin-cw  { from { transform: rotate(0deg);   } to { transform: rotate(360deg);  } }
        @keyframes pls-spin-ccw { from { transform: rotate(0deg);   } to { transform: rotate(-360deg); } }
        @keyframes pls-spin-med { from { transform: rotate(45deg);  } to { transform: rotate(405deg);  } }
        @keyframes pls-pulse-ring {
          0%,100% { opacity: .25; transform: scale(.97); }
          50%      { opacity: .55; transform: scale(1.03); }
        }
        @keyframes pls-float {
          0%,100% { transform: translateY(0px);  }
          50%      { transform: translateY(-7px); }
        }
        @keyframes pls-fade-in {
          from { opacity: 0; transform: scale(.92) translateY(16px); }
          to   { opacity: 1; transform: scale(1)   translateY(0);    }
        }
        @keyframes pls-dot-bounce {
          0%,80%,100% { transform: scale(0); opacity: 0; }
          40%          { transform: scale(1); opacity: 1; }
        }
        @keyframes pls-blob {
          0%,100% { transform: translate(-50%,-50%) scale(1);    }
          33%      { transform: translate(-50%,-50%) scale(1.12); }
          66%      { transform: translate(-50%,-50%) scale(.9);   }
        }
        @keyframes pls-text-blink {
          0%,100% { opacity: .5; }
          50%      { opacity: 1;  }
        }
      `}</style>

      {/* ── Ambient blobs ── */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {[
          { x: '20%',  y: '25%', size: 480, color: isDark ? 'rgba(14,165,233,.07)' : 'rgba(14,165,233,.06)', dur: '8s',  delay: '0s'  },
          { x: '78%',  y: '70%', size: 380, color: isDark ? 'rgba(56,189,248,.05)' : 'rgba(56,189,248,.05)', dur: '10s', delay: '2s'  },
          { x: '55%',  y: '85%', size: 300, color: isDark ? 'rgba(14,165,233,.04)' : 'rgba(14,165,233,.04)', dur: '7s',  delay: '4s'  },
        ].map((b, i) => (
          <div key={i} style={{
            position: 'absolute', left: b.x, top: b.y,
            width: b.size, height: b.size, borderRadius: '50%',
            background: `radial-gradient(circle, ${b.color} 0%, transparent 70%)`,
            filter: 'blur(70px)',
            transform: 'translate(-50%,-50%)',
            animation: `pls-blob ${b.dur} ease-in-out ${b.delay} infinite`,
          }} />
        ))}
      </div>

      {/* ── Main content ── */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        animation: 'pls-fade-in 0.6s cubic-bezier(0.22,1,0.36,1) forwards',
      }}>

        {/* ── Spinner stack ── */}
        <div style={{
          position: 'relative',
          width: '180px', height: '180px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'pls-float 3.5s ease-in-out infinite',
          marginBottom: '36px',
        }}>

          {/* Ring 1 — outermost, slow CW */}
          <svg width="180" height="180" viewBox="0 0 180 180"
            style={{ position: 'absolute', inset: 0, animation: 'pls-spin-cw 3.2s linear infinite' }}>
            <defs>
              <linearGradient id="g1a" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor={accent}  stopOpacity="0"   />
                <stop offset="45%"  stopColor={accent}  stopOpacity="1"   />
                <stop offset="100%" stopColor={accent2} stopOpacity="0.2" />
              </linearGradient>
            </defs>
            <circle cx="90" cy="90" r="84" fill="none"
              stroke={isDark ? 'rgba(14,165,233,.08)' : 'rgba(14,165,233,.1)'}
              strokeWidth="1.5" />
            <circle cx="90" cy="90" r="84" fill="none"
              stroke="url(#g1a)" strokeWidth="3" strokeLinecap="round"
              strokeDasharray="130 398" />
          </svg>

          {/* Ring 2 — medium, fast CCW */}
          <svg width="148" height="148" viewBox="0 0 148 148"
            style={{ position: 'absolute', inset: '16px', animation: 'pls-spin-ccw 2.1s linear infinite' }}>
            <defs>
              <linearGradient id="g2a" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%"   stopColor={accent2} stopOpacity="0"   />
                <stop offset="50%"  stopColor={accent2} stopOpacity="1"   />
                <stop offset="100%" stopColor={accent3} stopOpacity="0"   />
              </linearGradient>
            </defs>
            <circle cx="74" cy="74" r="68" fill="none"
              stroke={isDark ? 'rgba(56,189,248,.06)' : 'rgba(56,189,248,.08)'}
              strokeWidth="1" />
            <circle cx="74" cy="74" r="68" fill="none"
              stroke="url(#g2a)" strokeWidth="2.5" strokeLinecap="round"
              strokeDasharray="80 347" />
          </svg>

          {/* Ring 3 — inner, medium CW, dashed */}
          <svg width="112" height="112" viewBox="0 0 112 112"
            style={{ position: 'absolute', inset: '34px', animation: 'pls-spin-med 4.5s linear infinite' }}>
            <defs>
              <linearGradient id="g3a" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor={accent3} stopOpacity="0"   />
                <stop offset="60%"  stopColor={accent}  stopOpacity="0.9" />
                <stop offset="100%" stopColor={accent}  stopOpacity="0"   />
              </linearGradient>
            </defs>
            <circle cx="56" cy="56" r="50" fill="none"
              stroke={isDark ? 'rgba(14,165,233,.05)' : 'rgba(14,165,233,.07)'}
              strokeWidth="1" />
            <circle cx="56" cy="56" r="50" fill="none"
              stroke="url(#g3a)" strokeWidth="2" strokeLinecap="round"
              strokeDasharray="40 274" />
          </svg>

          {/* Pulse ring behind logo */}
          <div style={{
            position: 'absolute', inset: '58px',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${isDark ? 'rgba(14,165,233,.18)' : 'rgba(14,165,233,.12)'} 0%, transparent 70%)`,
            animation: 'pls-pulse-ring 2s ease-in-out infinite',
          }} />

          {/* Logo card */}
          <div style={{
            position: 'relative', zIndex: 2,
            width: '64px', height: '64px', borderRadius: '18px',
            background: isDark
              ? 'linear-gradient(145deg, rgba(14,165,233,.22) 0%, rgba(2,132,199,.1) 100%)'
              : 'linear-gradient(145deg, #ffffff 0%, #e0f2fe 100%)',
            border: `1.5px solid ${isDark ? 'rgba(14,165,233,.3)' : 'rgba(14,165,233,.22)'}`,
            boxShadow: isDark
              ? '0 0 32px rgba(14,165,233,.22), inset 0 1px 0 rgba(255,255,255,.1)'
              : '0 8px 32px rgba(14,165,233,.18), inset 0 1px 0 #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <img src={LOGO_URL} alt="ISG"
              style={{ width: '34px', height: '34px', objectFit: 'contain',
                filter: 'drop-shadow(0 0 6px rgba(14,165,233,.5))' }} />
          </div>
        </div>

        {/* ── Text ── */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h1 style={{
            fontSize: '26px', fontWeight: 800, letterSpacing: '-0.04em',
            color: isDark ? '#f1f5f9' : '#0f172a',
            lineHeight: 1.1, marginBottom: '10px',
          }}>
            {panelName}
          </h1>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '7px',
            padding: '5px 14px 5px 10px', borderRadius: '100px',
            background: isDark ? 'rgba(14,165,233,.1)' : 'rgba(14,165,233,.08)',
            border: `1px solid ${isDark ? 'rgba(14,165,233,.25)' : 'rgba(14,165,233,.2)'}`,
          }}>
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: accent,
              boxShadow: `0 0 8px ${accent}`,
              animation: 'pls-pulse-ring 1.5s ease-in-out infinite',
            }} />
            <span style={{ fontSize: '11px', fontWeight: 700, color: accent, letterSpacing: '0.06em' }}>
              {panelSubtitle.toUpperCase()}
            </span>
          </div>
        </div>

        {/* ── Bouncing dots ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: i === 0 ? accent : i === 1 ? accent2 : accent3,
              boxShadow: `0 0 8px ${i === 0 ? accent : i === 1 ? accent2 : accent3}`,
              animation: `pls-dot-bounce 1.2s ease-in-out ${i * 0.18}s infinite`,
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}
