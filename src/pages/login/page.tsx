import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../../store/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518';

const ILLUSTRATION_URL =
  'https://readdy.ai/api/search-image?query=abstract%20minimal%20SaaS%20dashboard%20interface%20blocks%20floating%20in%20dark%20space%2C%20soft%20glowing%20UI%20panels%20with%20data%20bars%20and%20progress%20rings%2C%20geometric%20shapes%20with%20teal%20and%20cyan%20gradient%20light%2C%20no%20people%20no%20characters%2C%20clean%20corporate%20digital%20management%20visualization%2C%20soft%20light%20orbs%20and%20connection%20dots%2C%20premium%20tech%20product%20aesthetic%2C%20very%20minimal%20and%20calm%20composition%2C%20dark%20navy%20background%20with%20subtle%20glow&width=700&height=500&seq=isg-login-illus-v7&orientation=landscape';

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
        @keyframes floatUp {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-12px); }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1; }
        }

        .slide-left  { animation: fadeSlideLeft  0.75s cubic-bezier(0.22,0.61,0.36,1) forwards; }
        .slide-right { animation: fadeSlideRight 0.75s cubic-bezier(0.22,0.61,0.36,1) 0.1s both; }

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
        .login-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .illus-float {
          animation: floatUp 7s ease-in-out infinite;
        }
        .glow-pulse {
          animation: pulseGlow 4s ease-in-out infinite;
        }
      `}</style>

      {/* ═══ LEFT PANEL ═══ */}
      <div
        className={`hidden lg:flex flex-col flex-1 relative overflow-hidden ${mounted ? 'slide-left' : 'opacity-0'}`}
        style={{
          background: 'linear-gradient(160deg, #0c1a2e 0%, #0f2744 45%, #0a1f38 75%, #071628 100%)',
        }}
      >
        {/* Ambient glow blobs */}
        <div
          className="absolute pointer-events-none glow-pulse"
          style={{
            top: '-140px', left: '-100px',
            width: '650px', height: '650px',
            background: 'radial-gradient(circle, rgba(6,182,212,0.16) 0%, transparent 65%)',
            filter: 'blur(70px)',
          }}
        />
        <div
          className="absolute pointer-events-none glow-pulse"
          style={{
            bottom: '-120px', right: '-80px',
            width: '550px', height: '550px',
            background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 65%)',
            filter: 'blur(70px)',
            animationDelay: '2s',
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            top: '45%', left: '55%',
            width: '350px', height: '350px',
            background: 'radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 65%)',
            filter: 'blur(50px)',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full px-14 py-14">

          {/* Brand */}
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'rgba(6,182,212,0.12)',
                border: '1px solid rgba(6,182,212,0.25)',
                boxShadow: '0 0 24px rgba(6,182,212,0.15)',
              }}
            >
              <img src={LOGO_URL} alt="ISG" className="w-7 h-7 object-contain" />
            </div>
            <div>
              <p className="text-base font-bold" style={{ color: '#e2f8fb', letterSpacing: '-0.02em' }}>ISG Denetim</p>
              <p className="text-xs" style={{ color: '#4a9bb5' }}>İş Sağlığı & Güvenliği Platformu</p>
            </div>
          </div>

          {/* Center content — vertically centered */}
          <div className="flex-1 flex flex-col items-center justify-center text-center">

            {/* Illustration */}
            <div className="illus-float relative mb-12">
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'radial-gradient(ellipse at center, rgba(6,182,212,0.2) 0%, transparent 65%)',
                  filter: 'blur(30px)',
                  transform: 'scale(1.15)',
                }}
              />
              <img
                src={ILLUSTRATION_URL}
                alt="ISG Dashboard"
                style={{
                  width: '320px',
                  height: '220px',
                  objectFit: 'cover',
                  objectPosition: 'center',
                  opacity: 0.32,
                  filter: 'blur(1px) saturate(1.3) brightness(1.1)',
                  borderRadius: '16px',
                  border: '1px solid rgba(6,182,212,0.12)',
                  position: 'relative',
                  zIndex: 1,
                }}
              />
            </div>

            {/* Hero text */}
            <div style={{ maxWidth: '340px' }}>
              <h2
                className="text-3xl font-extrabold leading-tight mb-4"
                style={{ color: '#f0f9ff', letterSpacing: '-0.03em' }}
              >
                İSG süreçlerinizi<br />
                <span
                  style={{
                    background: 'linear-gradient(135deg, #06B6D4 0%, #22D3EE 50%, #10B981 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  kolayca yönetin
                </span>
              </h2>
              <p
                className="text-sm leading-relaxed"
                style={{ color: '#6aacbf' }}
              >
                Tüm operasyonlarınızı tek panelden takip edin.
              </p>
            </div>
          </div>

          {/* Bottom status */}
          <div className="flex items-center justify-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: '#10B981' }}
            />
            <span className="text-xs" style={{ color: '#2e6a7e' }}>Tüm sistemler çalışıyor</span>
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
                  onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; }}
                >
                  <i className={`${showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`} />
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                className="flex items-start gap-3 rounded-xl p-4"
                style={
                  error.includes('ABONELİĞİNİZ SONLANMIŞTIR')
                    ? {
                        background: 'rgba(234,88,12,0.07)',
                        border: '1.5px solid rgba(234,88,12,0.35)',
                      }
                    : {
                        background: 'rgba(239,68,68,0.06)',
                        border: '1px solid rgba(239,68,68,0.2)',
                      }
                }
              >
                <i
                  className={`${error.includes('ABONELİĞİNİZ SONLANMIŞTIR') ? 'ri-alarm-warning-fill' : 'ri-error-warning-line'} text-base flex-shrink-0 mt-0.5`}
                  style={{ color: error.includes('ABONELİĞİNİZ SONLANMIŞTIR') ? '#ea580c' : '#ef4444' }}
                />
                <div>
                  {error.includes('ABONELİĞİNİZ SONLANMIŞTIR') ? (
                    <>
                      <p className="text-sm font-bold leading-snug mb-1" style={{ color: '#c2410c' }}>
                        ABONELİĞİNİZ SONLANMIŞTIR
                      </p>
                      <p className="text-xs leading-relaxed" style={{ color: '#9a3412' }}>
                        Lütfen hizmet sağlayıcınızla iletişime geçin.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm leading-relaxed" style={{ color: '#dc2626' }}>{error}</p>
                  )}
                </div>
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
