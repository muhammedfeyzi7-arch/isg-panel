import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../../store/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518';

export default function OsgbLoginPage() {
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
      // osgb_role'ü sorgula → gezici uzmanı doğrudan /osgb-uzman'a at
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        const { data: uo } = await supabase
          .from('user_organizations')
          .select('osgb_role')
          .eq('user_id', currentUser?.id ?? '')
          .eq('is_active', true)
          .maybeSingle();
        if (uo?.osgb_role === 'gezici_uzman') {
          navigate('/osgb-uzman', { replace: true });
        } else {
          navigate('/osgb-dashboard', { replace: true });
        }
      } catch {
        navigate('/osgb-dashboard', { replace: true });
      }
    }
  };

  return (
    <div
      className="min-h-screen flex overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 30%, #f0f9ff 60%, #fafafa 100%)',
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

        .slide-left-osgb  { animation: fadeSlideLeft  0.75s cubic-bezier(0.22,0.61,0.36,1) forwards; }
        .slide-right-osgb { animation: fadeSlideRight 0.75s cubic-bezier(0.22,0.61,0.36,1) 0.1s both; }

        .osgb-input {
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
        .osgb-input::placeholder { color: #94a3b8; }
        .osgb-input:focus {
          border-color: #10B981;
          box-shadow: 0 0 0 4px rgba(16,185,129,0.12);
          background: #f0fdf4;
        }

        .osgb-btn {
          background: linear-gradient(135deg, #059669 0%, #10B981 50%, #34D399 100%);
          background-size: 200% auto;
          transition: all 0.3s ease;
          box-shadow: 0 4px 24px rgba(16,185,129,0.35);
        }
        .osgb-btn:hover:not(:disabled) {
          background-position: right center;
          box-shadow: 0 8px 36px rgba(16,185,129,0.5);
          transform: translateY(-2px);
        }
        .osgb-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .illus-float-osgb {
          animation: floatUp 7s ease-in-out infinite;
        }
        .glow-pulse-osgb {
          animation: pulseGlow 4s ease-in-out infinite;
        }
      `}</style>

      {/* ═══ LEFT PANEL ═══ */}
      <div
        className={`hidden lg:flex flex-col flex-1 relative overflow-hidden ${mounted ? 'slide-left-osgb' : 'opacity-0'}`}
        style={{
          background: 'linear-gradient(160deg, #071f14 0%, #0a2e1c 45%, #071a10 75%, #040f09 100%)',
        }}
      >
        {/* Ambient glow blobs */}
        <div
          className="absolute pointer-events-none glow-pulse-osgb"
          style={{
            top: '-140px', left: '-100px',
            width: '650px', height: '650px',
            background: 'radial-gradient(circle, rgba(16,185,129,0.18) 0%, transparent 65%)',
            filter: 'blur(70px)',
          }}
        />
        <div
          className="absolute pointer-events-none glow-pulse-osgb"
          style={{
            bottom: '-120px', right: '-80px',
            width: '550px', height: '550px',
            background: 'radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 65%)',
            filter: 'blur(70px)',
            animationDelay: '2s',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full px-14 py-14">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'rgba(16,185,129,0.12)',
                border: '1px solid rgba(16,185,129,0.25)',
                boxShadow: '0 0 24px rgba(16,185,129,0.15)',
              }}
            >
              <img src={LOGO_URL} alt="ISG" className="w-7 h-7 object-contain" />
            </div>
            <div>
              <p className="text-base font-bold" style={{ color: '#e2fbf0', letterSpacing: '-0.02em' }}>ISG Denetim</p>
              <p className="text-xs" style={{ color: '#3a8a60' }}>OSGB Yönetim Platformu</p>
            </div>
          </div>

          {/* Center content */}
          <div className="flex-1 flex flex-col items-center justify-center text-center">

            {/* OSGB Icon visual */}
            <div className="illus-float-osgb relative mb-12">
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'radial-gradient(ellipse at center, rgba(16,185,129,0.25) 0%, transparent 65%)',
                  filter: 'blur(30px)',
                  transform: 'scale(1.3)',
                }}
              />
              <img
                src="https://readdy.ai/api/search-image?query=professional%20occupational%20health%20and%20safety%20management%20platform%2C%20abstract%20visualization%20of%20multiple%20connected%20companies%20and%20health%20professionals%20network%2C%20glowing%20green%20nodes%20and%20connection%20lines%20on%20dark%20background%2C%20medical%20cross%20symbols%2C%20shield%20protection%20icons%2C%20organizational%20hierarchy%20diagram%20with%20soft%20emerald%20green%20lights%2C%20minimal%20clean%20design%2C%20dark%20forest%20background%20with%20teal%20accent%20glow%2C%20premium%20corporate%20safety%20tech%20visualization&width=700&height=500&seq=osgb-login-illus-v2&orientation=landscape"
                alt="OSGB Platform"
                style={{
                  width: '320px',
                  height: '220px',
                  objectFit: 'cover',
                  objectPosition: 'center',
                  opacity: 0.35,
                  filter: 'blur(1px) saturate(1.3) brightness(1.1)',
                  borderRadius: '16px',
                  border: '1px solid rgba(16,185,129,0.15)',
                  position: 'relative',
                  zIndex: 1,
                }}
              />
            </div>

            {/* Hero text */}
            <div style={{ maxWidth: '360px' }}>
              <h2
                className="text-3xl font-extrabold leading-tight mb-4"
                style={{ color: '#f0fdf4', letterSpacing: '-0.03em' }}
              >
                Tüm müşteri firmalarınızı<br />
                <span
                  style={{
                    background: 'linear-gradient(135deg, #10B981 0%, #34D399 50%, #6EE7B7 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  tek ekrandan yönetin
                </span>
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: '#4a8a6a' }}>
                OSGB panelinizle gezici uzmanlarınızı atayın, tüm firmaların İSG süreçlerini merkezi olarak takip edin.
              </p>
            </div>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2 justify-center mt-8">
              {[
                { icon: 'ri-building-line', label: 'Çoklu Firma Yönetimi' },
                { icon: 'ri-user-star-line', label: 'Gezici Uzman Takibi' },
                { icon: 'ri-bar-chart-line', label: 'Merkezi Raporlama' },
              ].map(f => (
                <div
                  key={f.label}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
                  style={{
                    background: 'rgba(16,185,129,0.1)',
                    border: '1px solid rgba(16,185,129,0.2)',
                    color: '#6EE7B7',
                  }}
                >
                  <i className={`${f.icon} text-xs`} />
                  {f.label}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom status */}
          <div className="flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10B981' }} />
            <span className="text-xs" style={{ color: '#2e6a4e' }}>Tüm sistemler çalışıyor</span>
          </div>
        </div>
      </div>

      {/* ═══ RIGHT PANEL ═══ */}
      <div
        className={`w-full lg:w-[480px] xl:w-[520px] flex-shrink-0 flex flex-col justify-center px-8 sm:px-14 py-12 relative ${mounted ? 'slide-right-osgb' : 'opacity-0'}`}
        style={{ background: '#ffffff' }}
      >
        {/* Subtle accent glows */}
        <div
          className="absolute top-0 right-0 pointer-events-none"
          style={{
            width: '280px', height: '280px',
            background: 'radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
        <div
          className="absolute bottom-0 left-0 pointer-events-none"
          style={{
            width: '200px', height: '200px',
            background: 'radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center justify-center gap-3 mb-10">
          <img src={LOGO_URL} alt="ISG Denetim" className="w-9 h-9 object-contain" />
          <div>
            <p className="text-base font-bold" style={{ color: '#0f172a' }}>ISG Denetim</p>
            <p className="text-xs" style={{ color: '#64748b' }}>OSGB Platformu</p>
          </div>
        </div>

        <div className="relative z-10 max-w-[380px] w-full mx-auto">

          {/* Geri butonu */}
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="flex items-center gap-2 mb-8 text-sm font-semibold cursor-pointer transition-colors"
            style={{ color: '#64748b' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#059669'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; }}
          >
            <i className="ri-arrow-left-line text-base" />
            Giriş tipini değiştir
          </button>

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(16,185,129,0.1)' }}
              >
                <i className="ri-stethoscope-line text-lg" style={{ color: '#059669' }} />
              </div>
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{
                  background: 'rgba(16,185,129,0.08)',
                  border: '1px solid rgba(16,185,129,0.2)',
                  color: '#059669',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#10B981' }} />
                OSGB Girişi
              </div>
            </div>
            <h2
              className="text-3xl font-extrabold mb-2"
              style={{ color: '#0f172a', letterSpacing: '-0.03em' }}
            >
              Hoşgeldiniz
            </h2>
            <p className="text-sm" style={{ color: '#64748b' }}>
              OSGB hesabınıza giriş yaparak tüm firmaları yönetin.
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
                  placeholder="ornek@osgb.com"
                  autoComplete="email"
                  className="osgb-input"
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
                  style={{ color: '#059669' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#10B981'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#059669'; }}
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
                  className="osgb-input"
                  style={{ paddingRight: '46px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center cursor-pointer transition-colors"
                  style={{ color: '#94a3b8' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#059669'; }}
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
                className="osgb-btn w-full py-4 rounded-xl font-bold text-sm text-white cursor-pointer whitespace-nowrap flex items-center justify-center gap-2.5"
                style={{ opacity: loading ? 0.7 : 1, letterSpacing: '0.02em' }}
              >
                {loading ? (
                  <>
                    <i className="ri-loader-4-line text-base animate-spin" />
                    <span>Giriş yapılıyor...</span>
                  </>
                ) : (
                  <>
                    <i className="ri-login-circle-line text-base" />
                    <span>OSGB Paneline Giriş Yap</span>
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
              { icon: 'ri-group-line', label: 'Çoklu Firma', color: '#059669' },
              { icon: 'ri-cloud-line', label: 'Bulut Tabanlı', color: '#06B6D4' },
            ].map((b) => (
              <div
                key={b.label}
                className="flex flex-col items-center gap-2 p-3 rounded-xl text-center"
                style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}
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
            ISG Denetim OSGB Yönetim Platformu &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
