import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../../store/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518';

const DASHBOARD_IMG =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/a412202c-a804-4de0-aae9-0b5780c6f9d8_Ekran-grnts-2026-04-03-153631.png?v=4bca9fc891792b5acf19c22dec8807cd';

const MOBILE_IMG =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/a4e6c0d7-d0a9-421e-a4b0-8465c4e36506_2dbb3038-c1d8-45bc-b6d2-fb17e43dbead.jpg?v=78051f97fd138e1069865626eb01f2e8';

const FEATURES = [
  { icon: 'ri-tools-line', label: 'Ekipman Takibi', desc: 'QR kod ile anlık durum' },
  { icon: 'ri-file-text-line', label: 'Evrak Yönetimi', desc: 'Otomatik süre takibi' },
  { icon: 'ri-search-eye-line', label: 'Saha Denetimleri', desc: 'Mobil uyumlu denetim' },
  { icon: 'ri-notification-3-line', label: 'Otomatik Bildirimler', desc: 'Anlık uyarı sistemi' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('E-posta ve şifre alanları boş bırakılamaz.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: loginError } = await login(email.trim(), password);
    setLoading(false);
    if (loginError) {
      setError(loginError);
    } else {
      navigate('/', { replace: true });
    }
  };

  return (
    <div
      className="min-h-screen flex overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 30%, #f0fdf4 60%, #fafafa 100%)',
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        * { font-family: 'Inter', sans-serif; }

        @keyframes fadeSlideLeft {
          from { opacity: 0; transform: translateX(-28px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeSlideRight {
          from { opacity: 0; transform: translateX(28px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes floatY {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-10px); }
        }
        @keyframes floatYSlow {
          0%, 100% { transform: translateY(0px) rotate(-2deg); }
          50%       { transform: translateY(-7px) rotate(2deg); }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.45; }
          50%       { opacity: 1; }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .slide-left  { animation: fadeSlideLeft  0.75s cubic-bezier(0.22,0.61,0.36,1) forwards; }
        .slide-right { animation: fadeSlideRight 0.75s cubic-bezier(0.22,0.61,0.36,1) 0.1s both; }
        .float-monitor { animation: floatY 7s ease-in-out infinite; }
        .float-phone   { animation: floatYSlow 6s ease-in-out infinite 1.5s; }
        .glow-pulse    { animation: pulseGlow 4s ease-in-out infinite; }

        .feature-item {
          animation: fadeInUp 0.5s ease forwards;
          opacity: 0;
        }
        .feature-item:nth-child(1) { animation-delay: 0.3s; }
        .feature-item:nth-child(2) { animation-delay: 0.45s; }
        .feature-item:nth-child(3) { animation-delay: 0.6s; }
        .feature-item:nth-child(4) { animation-delay: 0.75s; }

        .gradient-text {
          background: linear-gradient(135deg, #22D3EE 0%, #06B6D4 40%, #10B981 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 4s linear infinite;
        }

        .monitor-screen {
          position: relative;
          overflow: hidden;
          border-radius: 6px;
        }
        .monitor-screen::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            135deg,
            rgba(255,255,255,0.04) 0%,
            transparent 40%,
            rgba(0,0,0,0.15) 100%
          );
          pointer-events: none;
          z-index: 2;
        }
        .blur-overlay {
          position: absolute;
          z-index: 3;
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          background: rgba(10,25,50,0.15);
          border-radius: 3px;
        }

        .login-input {
          transition: all 0.2s ease;
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          color: #1e293b;
          font-size: 14px;
          width: 100%;
          outline: none;
          padding: 14px 16px 14px 44px;
        }
        .login-input::placeholder { color: #94a3b8; }
        .login-input:focus {
          border-color: #06B6D4;
          box-shadow: 0 0 0 4px rgba(6,182,212,0.12);
          background: #f0fdff;
        }

        .login-btn {
          background: linear-gradient(135deg, #0891B2 0%, #06B6D4 50%, #22D3EE 100%);
          background-size: 200% auto;
          transition: all 0.3s ease;
          box-shadow: 0 4px 24px rgba(6,182,212,0.35);
        }
        .login-btn:hover:not(:disabled) {
          background-position: right center;
          box-shadow: 0 8px 36px rgba(6,182,212,0.5);
          transform: translateY(-2px);
        }
        .login-btn:active:not(:disabled) { transform: translateY(0); }
      `}</style>

      {/* ═══ LEFT PANEL ═══ */}
      <div
        className={`hidden lg:flex flex-col flex-1 relative overflow-hidden ${mounted ? 'slide-left' : 'opacity-0'}`}
        style={{
          background: 'linear-gradient(160deg, #060f1e 0%, #0a1a35 35%, #0c2040 65%, #071628 100%)',
        }}
      >
        {/* Ambient glow blobs */}
        <div
          className="absolute pointer-events-none glow-pulse"
          style={{
            top: '-180px', left: '-120px',
            width: '700px', height: '700px',
            background: 'radial-gradient(circle, rgba(6,182,212,0.18) 0%, transparent 60%)',
            filter: 'blur(80px)',
          }}
        />
        <div
          className="absolute pointer-events-none glow-pulse"
          style={{
            bottom: '-150px', right: '-100px',
            width: '600px', height: '600px',
            background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 60%)',
            filter: 'blur(80px)',
            animationDelay: '2s',
          }}
        />
        <div
          className="absolute pointer-events-none glow-pulse"
          style={{
            top: '40%', left: '50%',
            width: '400px', height: '400px',
            background: 'radial-gradient(circle, rgba(6,182,212,0.07) 0%, transparent 60%)',
            filter: 'blur(60px)',
            animationDelay: '1s',
          }}
        />

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(6,182,212,0.04) 1px, transparent 1px),
              linear-gradient(90deg, rgba(6,182,212,0.04) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full px-12 py-10">

          {/* Brand */}
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'rgba(6,182,212,0.12)',
                border: '1px solid rgba(6,182,212,0.28)',
                boxShadow: '0 0 20px rgba(6,182,212,0.18)',
              }}
            >
              <img src={LOGO_URL} alt="ISG" className="w-6 h-6 object-contain" />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: '#e2f8fb', letterSpacing: '-0.01em' }}>ISG Denetim</p>
              <p className="text-[10px]" style={{ color: '#3a7a90' }}>İş Sağlığı &amp; Güvenliği Platformu</p>
            </div>
          </div>

          {/* Hero text */}
          <div className="mt-10 mb-8">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-5 text-[10px] font-semibold"
              style={{
                background: 'rgba(6,182,212,0.1)',
                border: '1px solid rgba(6,182,212,0.22)',
                color: '#22D3EE',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10B981' }} />
              Türkiye&apos;nin İSG Yönetim Platformu
            </div>
            <h1
              className="text-3xl xl:text-4xl font-extrabold leading-tight mb-3"
              style={{ color: '#f0f9ff', letterSpacing: '-0.03em' }}
            >
              İSG süreçlerinizi<br />
              <span className="gradient-text">tek platformda yönetin</span>
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: '#5a9ab0', maxWidth: '340px' }}>
              Tüm denetim, evrak ve ekipman süreçlerinizi kolayca yönetin.
            </p>
          </div>

          {/* ── MOCKUP AREA ── */}
          <div className="flex-1 flex items-center justify-center relative">

            {/* Monitor */}
            <div className="float-monitor relative" style={{ zIndex: 2 }}>
              {/* Monitor body */}
              <div
                style={{
                  width: '420px',
                  background: 'linear-gradient(180deg, #1a2a3a 0%, #0f1e2e 100%)',
                  borderRadius: '14px 14px 0 0',
                  padding: '10px 10px 0 10px',
                  border: '1px solid rgba(6,182,212,0.2)',
                  boxShadow: '0 0 60px rgba(6,182,212,0.15), 0 30px 60px rgba(0,0,0,0.5)',
                }}
              >
                {/* Top bar */}
                <div
                  className="flex items-center gap-1.5 mb-2 px-2"
                  style={{ height: '22px' }}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#ff5f57' }} />
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#febc2e' }} />
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#28c840' }} />
                  <div
                    className="flex-1 mx-3 rounded-full flex items-center px-2"
                    style={{
                      height: '14px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <span className="text-[8px]" style={{ color: 'rgba(255,255,255,0.25)' }}>isgdenetim.com.tr</span>
                  </div>
                </div>

                {/* Screen */}
                <div className="monitor-screen" style={{ height: '240px' }}>
                  <img
                    src={DASHBOARD_IMG}
                    alt="ISG Dashboard"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: 'top left',
                      display: 'block',
                    }}
                  />
                  {/* Blur overlays for sensitive text areas */}
                  {/* Top nav area - names */}
                  <div className="blur-overlay" style={{ top: '6px', right: '8px', width: '90px', height: '14px' }} />
                  {/* Sidebar items text */}
                  <div className="blur-overlay" style={{ top: '40px', left: '4px', width: '55px', height: '120px' }} />
                  {/* Main content text rows */}
                  <div className="blur-overlay" style={{ top: '55px', left: '68px', width: '120px', height: '10px' }} />
                  <div className="blur-overlay" style={{ top: '90px', left: '68px', width: '100px', height: '10px' }} />
                  <div className="blur-overlay" style={{ top: '125px', left: '68px', width: '130px', height: '10px' }} />
                  <div className="blur-overlay" style={{ top: '160px', left: '68px', width: '90px', height: '10px' }} />
                  {/* Right panel text */}
                  <div className="blur-overlay" style={{ top: '55px', right: '8px', width: '100px', height: '10px' }} />
                  <div className="blur-overlay" style={{ top: '80px', right: '8px', width: '80px', height: '10px' }} />
                  <div className="blur-overlay" style={{ top: '105px', right: '8px', width: '110px', height: '10px' }} />
                  {/* Bottom table rows */}
                  <div className="blur-overlay" style={{ bottom: '30px', left: '68px', width: '200px', height: '8px' }} />
                  <div className="blur-overlay" style={{ bottom: '16px', left: '68px', width: '160px', height: '8px' }} />
                </div>
              </div>

              {/* Monitor stand */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div
                  style={{
                    width: '420px',
                    height: '12px',
                    background: 'linear-gradient(180deg, #0f1e2e 0%, #0a1520 100%)',
                    border: '1px solid rgba(6,182,212,0.15)',
                    borderTop: 'none',
                    borderRadius: '0 0 4px 4px',
                  }}
                />
                <div
                  style={{
                    width: '60px',
                    height: '20px',
                    background: 'linear-gradient(180deg, #0a1520 0%, #071020 100%)',
                    borderRadius: '0 0 4px 4px',
                    border: '1px solid rgba(6,182,212,0.1)',
                    borderTop: 'none',
                  }}
                />
                <div
                  style={{
                    width: '120px',
                    height: '6px',
                    background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.15), transparent)',
                    borderRadius: '4px',
                    marginTop: '2px',
                  }}
                />
              </div>

              {/* Monitor glow */}
              <div
                className="absolute pointer-events-none"
                style={{
                  bottom: '-30px', left: '50%',
                  transform: 'translateX(-50%)',
                  width: '300px', height: '60px',
                  background: 'radial-gradient(ellipse, rgba(6,182,212,0.2) 0%, transparent 70%)',
                  filter: 'blur(20px)',
                }}
              />
            </div>

            {/* iPhone mockup — bottom right */}
            <div
              className="float-phone absolute"
              style={{
                bottom: '-10px',
                right: '30px',
                zIndex: 3,
              }}
            >
              {/* Phone frame */}
              <div
                style={{
                  width: '90px',
                  height: '180px',
                  background: 'linear-gradient(180deg, #1c2c3c 0%, #0f1e2e 100%)',
                  borderRadius: '18px',
                  padding: '6px',
                  border: '1.5px solid rgba(6,182,212,0.3)',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.6), 0 0 30px rgba(6,182,212,0.12)',
                  position: 'relative',
                }}
              >
                {/* Notch */}
                <div
                  style={{
                    position: 'absolute',
                    top: '8px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '28px',
                    height: '5px',
                    background: '#0a1520',
                    borderRadius: '4px',
                    zIndex: 5,
                  }}
                />
                {/* Screen */}
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '13px',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <img
                    src={MOBILE_IMG}
                    alt="ISG Mobile"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: 'top center',
                      display: 'block',
                    }}
                  />
                  {/* Blur sensitive text on mobile */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '18px', left: '4px', right: '4px',
                      height: '12px',
                      backdropFilter: 'blur(5px)',
                      WebkitBackdropFilter: 'blur(5px)',
                      background: 'rgba(10,25,50,0.1)',
                      borderRadius: '3px',
                      zIndex: 3,
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '40px', left: '4px', right: '4px',
                      height: '8px',
                      backdropFilter: 'blur(5px)',
                      WebkitBackdropFilter: 'blur(5px)',
                      background: 'rgba(10,25,50,0.1)',
                      borderRadius: '3px',
                      zIndex: 3,
                    }}
                  />
                  {/* Screen glare */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%)',
                      pointerEvents: 'none',
                      zIndex: 4,
                    }}
                  />
                </div>
              </div>

              {/* Phone glow */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '-15px', left: '50%',
                  transform: 'translateX(-50%)',
                  width: '80px', height: '30px',
                  background: 'radial-gradient(ellipse, rgba(6,182,212,0.25) 0%, transparent 70%)',
                  filter: 'blur(12px)',
                }}
              />
            </div>

          </div>

          {/* Feature list */}
          <div className="mt-6 mb-4 grid grid-cols-2 gap-2">
            {FEATURES.map((f) => (
              <div
                key={f.label}
                className="feature-item flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                style={{
                  background: 'rgba(6,182,212,0.06)',
                  border: '1px solid rgba(6,182,212,0.12)',
                }}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: 'rgba(6,182,212,0.12)',
                    border: '1px solid rgba(6,182,212,0.2)',
                  }}
                >
                  <i className={`${f.icon} text-xs`} style={{ color: '#22D3EE' }} />
                </div>
                <div>
                  <p className="text-xs font-semibold" style={{ color: '#c8eaf0', lineHeight: 1.2 }}>{f.label}</p>
                  <p className="text-[10px]" style={{ color: '#3a6a7a' }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10B981' }} />
              <span className="text-[10px]" style={{ color: '#2e6a7e' }}>Tüm sistemler çalışıyor</span>
            </div>
            <div className="flex items-center gap-3">
              {[
                { icon: 'ri-shield-check-line', color: '#10B981' },
                { icon: 'ri-lock-line', color: '#06B6D4' },
                { icon: 'ri-cloud-line', color: '#22D3EE' },
              ].map((b) => (
                <div key={b.icon} className="w-5 h-5 flex items-center justify-center">
                  <i className={`${b.icon} text-xs`} style={{ color: b.color, opacity: 0.6 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ RIGHT PANEL ═══ */}
      <div
        className={`w-full lg:w-[480px] xl:w-[520px] flex-shrink-0 flex flex-col justify-center px-8 sm:px-14 py-12 relative ${mounted ? 'slide-right' : 'opacity-0'}`}
        style={{ background: '#ffffff' }}
      >
        {/* Subtle accent glows */}
        <div
          className="absolute top-0 right-0 pointer-events-none"
          style={{
            width: '280px', height: '280px',
            background: 'radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
        <div
          className="absolute bottom-0 left-0 pointer-events-none"
          style={{
            width: '200px', height: '200px',
            background: 'radial-gradient(circle, rgba(16,185,129,0.05) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center justify-center gap-3 mb-10">
          <img src={LOGO_URL} alt="ISG Denetim" className="w-9 h-9 object-contain" />
          <div>
            <p className="text-base font-bold" style={{ color: '#0f172a' }}>ISG Denetim</p>
            <p className="text-xs" style={{ color: '#64748b' }}>Yönetim Platformu</p>
          </div>
        </div>

        <div className="relative z-10 max-w-[380px] w-full mx-auto">
          {/* Header */}
          <div className="mb-10">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 text-xs font-semibold"
              style={{
                background: 'rgba(6,182,212,0.08)',
                border: '1px solid rgba(6,182,212,0.2)',
                color: '#0891B2',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#06B6D4' }} />
              Güvenli Giriş
            </div>
            <h2
              className="text-3xl font-extrabold mb-2"
              style={{ color: '#0f172a', letterSpacing: '-0.03em' }}
            >
              Hoşgeldiniz
            </h2>
            <p className="text-sm" style={{ color: '#64748b' }}>
              Hesabınıza giriş yaparak devam edin.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label
                className="block text-xs font-semibold mb-2"
                style={{ color: '#374151', letterSpacing: '0.01em' }}
              >
                E-posta Adresi
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center pointer-events-none">
                  <i className="ri-mail-line text-sm" style={{ color: '#94a3b8' }} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(null); }}
                  placeholder="ornek@sirket.com"
                  autoComplete="email"
                  className="login-input"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  className="block text-xs font-semibold"
                  style={{ color: '#374151', letterSpacing: '0.01em' }}
                >
                  Şifre
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold transition-colors"
                  style={{ color: '#0891B2' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#06B6D4'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#0891B2'; }}
                >
                  Şifremi Unuttum
                </Link>
              </div>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center pointer-events-none">
                  <i className="ri-lock-line text-sm" style={{ color: '#94a3b8' }} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(null); }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="login-input"
                  style={{ paddingRight: '46px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center cursor-pointer transition-colors"
                  style={{ color: '#94a3b8' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#0891B2'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#0891B2'; }}
                >
                  <i className={`${showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`} />
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                className="flex items-start gap-3 rounded-xl p-4"
                style={{
                  background: 'rgba(239,68,68,0.06)',
                  border: '1px solid rgba(239,68,68,0.2)',
                }}
              >
                <i className="ri-error-warning-line text-sm flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                <p className="text-sm leading-relaxed" style={{ color: '#dc2626' }}>{error}</p>
              </div>
            )}

            {/* Submit */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="login-btn w-full py-4 rounded-xl font-bold text-sm text-white cursor-pointer whitespace-nowrap flex items-center justify-center gap-2.5"
                style={{
                  opacity: loading ? 0.7 : 1,
                  letterSpacing: '0.02em',
                }}
              >
                {loading ? (
                  <>
                    <i className="ri-loader-4-line text-base animate-spin" />
                    <span>Giriş yapılıyor...</span>
                  </>
                ) : (
                  <>
                    <i className="ri-login-circle-line text-base" />
                    <span>Giriş Yap</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="my-8 flex items-center gap-4">
            <div className="flex-1 h-px" style={{ background: '#f1f5f9' }} />
            <span className="text-xs font-medium" style={{ color: '#cbd5e1' }}>GÜVENLİ BAĞLANTI</span>
            <div className="flex-1 h-px" style={{ background: '#f1f5f9' }} />
          </div>

          {/* Trust badges */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: 'ri-shield-check-line', label: 'SSL Şifreli', color: '#10B981' },
              { icon: 'ri-lock-password-line', label: 'Güvenli Giriş', color: '#06B6D4' },
              { icon: 'ri-cloud-line', label: 'Bulut Tabanlı', color: '#8B5CF6' },
            ].map((b) => (
              <div
                key={b.label}
                className="flex flex-col items-center gap-2 p-3 rounded-xl text-center"
                style={{
                  background: '#f8fafc',
                  border: '1px solid #f1f5f9',
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${b.color}15` }}
                >
                  <i className={`${b.icon} text-sm`} style={{ color: b.color }} />
                </div>
                <span className="text-[10px] font-semibold" style={{ color: '#94a3b8' }}>{b.label}</span>
              </div>
            ))}
          </div>

          <p className="text-center text-xs mt-8" style={{ color: '#cbd5e1' }}>
            ISG Denetim Yönetim Sistemi &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
