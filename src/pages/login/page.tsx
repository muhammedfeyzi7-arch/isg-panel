import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../../store/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/ae509f81-0883-42e1-9ed0-d08483f4284e_ChatGPT-Image-28-Mar-2026-23_09_27.png?v=f1e78272586c7081b6d13820591aa1f8';

const FEATURES = [
  { icon: 'ri-building-2-line', title: 'Firma & Personel Yönetimi', desc: 'Tüm firma ve çalışan verilerini tek platformda yönetin.' },
  { icon: 'ri-file-shield-2-line', title: 'Evrak Takip Sistemi', desc: 'Süre dolumu uyarıları ile hiçbir evrakı kaçırmayın.' },
  { icon: 'ri-alert-line', title: 'DÖF & Uygunsuzluk Yönetimi', desc: 'Saha denetim bulgularını kayıt altına alın ve takip edin.' },
  { icon: 'ri-shield-check-line', title: 'ISG Denetim Raporları', desc: 'Profesyonel PDF raporlarını saniyeler içinde oluşturun.' },
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
      sessionStorage.setItem('isg_show_welcome', 'true');
      navigate('/', { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex overflow-hidden" style={{ background: '#040D18' }}>
      <style>{`
        @keyframes loginSlideRight { from { opacity: 0; transform: translateX(32px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes loginSlideLeft  { from { opacity: 0; transform: translateX(-24px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes floatY { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes spinSlow { to { transform: rotate(360deg); } }
        .slide-right { animation: loginSlideRight 0.7s cubic-bezier(0.22,0.61,0.36,1) forwards; }
        .slide-left  { animation: loginSlideLeft 0.65s cubic-bezier(0.22,0.61,0.36,1) 0.1s both; }
        .feat-hover:hover { background: rgba(6,182,212,0.12) !important; transform: translateX(4px); }
        .feat-hover { transition: all 0.2s ease; }
      `}</style>

      {/* ═══ LEFT PANEL ═══ */}
      <div
        className={`hidden lg:flex flex-col flex-1 relative overflow-hidden ${mounted ? 'slide-left' : 'opacity-0'}`}
        style={{ background: 'linear-gradient(145deg, #050F1E 0%, #071626 40%, #060E1B 70%, #040C17 100%)' }}
      >
        {/* Grid overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(6,182,212,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(6,182,212,0.04) 1px,transparent 1px)',
          backgroundSize: '56px 56px',
        }} />

        {/* Glow blobs */}
        <div className="absolute pointer-events-none" style={{ top: '-80px', left: '-80px', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 65%)', filter: 'blur(40px)' }} />
        <div className="absolute pointer-events-none" style={{ bottom: '-60px', right: '-60px', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 65%)', filter: 'blur(40px)' }} />

        {/* Decorative ring */}
        <div className="absolute pointer-events-none" style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '600px', height: '600px', borderRadius: '50%', border: '1px solid rgba(6,182,212,0.06)', animation: 'spinSlow 60s linear infinite' }} />
        <div className="absolute pointer-events-none" style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '820px', height: '820px', borderRadius: '50%', border: '1px solid rgba(6,182,212,0.04)' }} />

        <div className="relative z-10 flex flex-col h-full px-12 py-12">
          {/* Top brand */}
          <div className="flex items-center gap-4 mb-16" style={{ animation: 'floatY 5s ease-in-out infinite' }}>
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl" style={{ background: 'radial-gradient(circle,rgba(6,182,212,0.5) 0%,transparent 70%)', filter: 'blur(12px)', transform: 'scale(1.4)' }} />
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center relative z-10" style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.25)' }}>
                <img src={LOGO_URL} alt="Logo" className="w-10 h-10 object-contain" style={{ filter: 'drop-shadow(0 0 8px rgba(6,182,212,0.8))' }} />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: '#E2F8FB', letterSpacing: '-0.02em' }}>ISG Denetim</h1>
              <p className="text-xs font-medium" style={{ color: '#4A9BB5' }}>İş Sağlığı & Güvenliği Platformu</p>
            </div>
          </div>

          {/* Hero text */}
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 text-xs font-semibold" style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)', color: '#06B6D4' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#06B6D4' }} />
              v2.0 — Güncel Sürüm
            </div>
            <h2 className="text-4xl font-extrabold leading-tight mb-4" style={{ color: '#E2F8FB', letterSpacing: '-0.03em' }}>
              ISG Denetimini<br />
              <span style={{ background: 'linear-gradient(135deg, #06B6D4 0%, #10B981 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Dijitalleştirin
              </span>
            </h2>
            <p className="text-base leading-relaxed max-w-md" style={{ color: '#6BAFC2' }}>
              Firma ve personel yönetiminden saha denetimlerine kadar tüm İSG süreçlerinizi tek platformda yönetin.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-3 flex-1">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="feat-hover flex items-start gap-4 p-4 rounded-xl cursor-default"
                style={{ background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.08)' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,rgba(6,182,212,0.2),rgba(16,185,129,0.1))', border: '1px solid rgba(6,182,212,0.15)' }}>
                  <i className={`${f.icon} text-base`} style={{ color: '#06B6D4' }} />
                </div>
                <div>
                  <p className="text-sm font-bold mb-0.5" style={{ color: '#C8EEF5' }}>{f.title}</p>
                  <p className="text-xs leading-relaxed" style={{ color: '#4A9BB5' }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom info */}
          <div className="mt-10 pt-8" style={{ borderTop: '1px solid rgba(6,182,212,0.1)' }}>
            <div className="flex items-center gap-3 justify-center">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.12)' }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10B981' }} />
                <span className="text-xs font-semibold" style={{ color: '#3A9BB5' }}>Tüm sistemler çalışıyor</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ RIGHT PANEL ═══ */}
      <div
        className={`w-full lg:w-[480px] xl:w-[520px] flex-shrink-0 flex flex-col justify-center px-8 sm:px-12 py-12 relative ${mounted ? 'slide-right' : 'opacity-0'}`}
        style={{ background: '#030B15' }}
      >
        {/* Subtle top glow */}
        <div className="absolute top-0 right-0 pointer-events-none" style={{ width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(6,182,212,0.07) 0%, transparent 65%)', filter: 'blur(30px)' }} />

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center justify-center gap-3 mb-10">
          <img src={LOGO_URL} alt="ISG Denetim" className="w-10 h-10 object-contain" style={{ filter: 'drop-shadow(0 0 10px rgba(6,182,212,0.7))' }} />
          <div>
            <p className="text-lg font-bold" style={{ color: '#E2F8FB' }}>ISG Denetim</p>
            <p className="text-xs" style={{ color: '#4A9BB5' }}>Yönetim Platformu</p>
          </div>
        </div>

        <div className="relative z-10 max-w-[380px] w-full mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-extrabold mb-2" style={{ color: '#E2F8FB', letterSpacing: '-0.025em' }}>
              Hoşgeldiniz
            </h2>
            <p className="text-sm" style={{ color: '#4A9BB5' }}>
              Hesabınıza giriş yaparak devam edin.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: '#3A8A9E' }}>
                E-posta Adresi
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center pointer-events-none">
                  <i className="ri-mail-line text-sm" style={{ color: '#2E7A8F' }} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(null); }}
                  placeholder="ornek@sirket.com"
                  autoComplete="email"
                  className="w-full text-sm outline-none transition-all duration-200"
                  style={{
                    paddingLeft: '42px',
                    paddingRight: '16px',
                    paddingTop: '13px',
                    paddingBottom: '13px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(6,182,212,0.12)',
                    borderRadius: '12px',
                    color: '#D0F4F8',
                    fontSize: '14px',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(6,182,212,0.45)'; e.currentTarget.style.background = 'rgba(6,182,212,0.06)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(6,182,212,0.08)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(6,182,212,0.12)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold uppercase tracking-wide" style={{ color: '#3A8A9E' }}>
                  Şifre
                </label>
                <Link to="/forgot-password" className="text-xs font-semibold transition-colors" style={{ color: '#06B6D4' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#67E8F9'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#06B6D4'; }}>
                  Şifremi Unuttum
                </Link>
              </div>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center pointer-events-none">
                  <i className="ri-lock-line text-sm" style={{ color: '#2E7A8F' }} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(null); }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full text-sm outline-none transition-all duration-200"
                  style={{
                    paddingLeft: '42px',
                    paddingRight: '46px',
                    paddingTop: '13px',
                    paddingBottom: '13px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(6,182,212,0.12)',
                    borderRadius: '12px',
                    color: '#D0F4F8',
                    fontSize: '14px',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(6,182,212,0.45)'; e.currentTarget.style.background = 'rgba(6,182,212,0.06)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(6,182,212,0.08)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(6,182,212,0.12)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.boxShadow = 'none'; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center cursor-pointer transition-colors"
                  style={{ color: '#2E7A8F' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#7DE8F0'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#2E7A8F'; }}
                >
                  <i className={`${showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`} />
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-3 rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <i className="ri-error-warning-line text-sm flex-shrink-0 mt-0.5" style={{ color: '#F87171' }} />
                <p className="text-sm leading-relaxed" style={{ color: '#FCA5A5' }}>{error}</p>
              </div>
            )}

            {/* Submit button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold text-sm cursor-pointer whitespace-nowrap flex items-center justify-center gap-2.5 transition-all duration-200"
                style={{
                  background: loading
                    ? 'rgba(6,182,212,0.2)'
                    : 'linear-gradient(135deg, #0891B2 0%, #0E7490 50%, #06B6D4 100%)',
                  color: loading ? 'rgba(255,255,255,0.4)' : '#ffffff',
                  border: '1px solid rgba(6,182,212,0.3)',
                  letterSpacing: '0.02em',
                  boxShadow: loading ? 'none' : '0 6px 32px rgba(6,182,212,0.35), inset 0 1px 0 rgba(255,255,255,0.1)',
                }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.boxShadow = '0 8px 40px rgba(6,182,212,0.5), inset 0 1px 0 rgba(255,255,255,0.15)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                onMouseLeave={e => { if (!loading) { e.currentTarget.style.boxShadow = '0 6px 32px rgba(6,182,212,0.35), inset 0 1px 0 rgba(255,255,255,0.1)'; e.currentTarget.style.transform = 'translateY(0)'; } }}
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
            <div className="flex-1 h-px" style={{ background: 'rgba(6,182,212,0.1)' }} />
            <span className="text-xs font-semibold" style={{ color: '#1E5A6E' }}>GÜVENLİ BAĞLANTI</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(6,182,212,0.1)' }} />
          </div>

          {/* Trust badges */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: 'ri-shield-check-line', label: 'SSL Şifreli' },
              { icon: 'ri-lock-password-line', label: 'Güvenli Giriş' },
              { icon: 'ri-cloud-line', label: 'Bulut Tabanlı' },
            ].map((b) => (
              <div key={b.label} className="flex flex-col items-center gap-2 p-3 rounded-xl text-center" style={{ background: 'rgba(6,182,212,0.04)', border: '1px solid rgba(6,182,212,0.08)' }}>
                <i className={`${b.icon} text-base`} style={{ color: '#1E5A6E' }} />
                <span className="text-[10px] font-semibold" style={{ color: '#1E5A6E' }}>{b.label}</span>
              </div>
            ))}
          </div>

          <p className="text-center text-xs mt-8" style={{ color: '#173F50' }}>
            ISG Denetim Yönetim Sistemi &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
