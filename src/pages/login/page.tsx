import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useAuth } from '../../store/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518';

const REMEMBER_KEY = 'isg_remember_me';
const REMEMBER_EMAIL_KEY = 'isg_remember_email';
const REMEMBER_PW_KEY = 'isg_remember_pw';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  // Beni Hatırla — localStorage'dan yükle
  const [rememberMe, setRememberMe] = useState(() => {
    try { return localStorage.getItem(REMEMBER_KEY) === '1'; } catch { return false; }
  });
  const [email, setEmail] = useState(() => {
    try { return rememberMe ? (localStorage.getItem(REMEMBER_EMAIL_KEY) || '') : ''; } catch { return ''; }
  });
  const [password, setPassword] = useState(() => {
    try { return rememberMe ? (localStorage.getItem(REMEMBER_PW_KEY) || '') : ''; } catch { return ''; }
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Eğer hatırlanan bilgi yoksa email'e focus
    if (!email) emailRef.current?.focus();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('E-posta ve şifre alanları boş bırakılamaz.');
      return;
    }
    setLoading(true);
    setError(null);

    // Beni Hatırla kaydet/temizle
    try {
      if (rememberMe) {
        localStorage.setItem(REMEMBER_KEY, '1');
        localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
        localStorage.setItem(REMEMBER_PW_KEY, password);
      } else {
        localStorage.removeItem(REMEMBER_KEY);
        localStorage.removeItem(REMEMBER_EMAIL_KEY);
        localStorage.removeItem(REMEMBER_PW_KEY);
      }
    } catch { /* ignore */ }

    const { error: loginError } = await login(email.trim(), password);
    if (loginError) {
      setLoading(false);
      setError(loginError);
      return;
    }
    navigate('/resolve', { replace: true });
  };

  return (
    <div className="min-h-screen flex overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

        @keyframes fadeSlideLeft {
          from { opacity:0; transform:translateX(-32px); }
          to   { opacity:1; transform:translateX(0); }
        }
        @keyframes fadeSlideRight {
          from { opacity:0; transform:translateX(32px); }
          to   { opacity:1; transform:translateX(0); }
        }
        @keyframes glowPulse {
          0%,100% { opacity:0.4; }
          50%      { opacity:0.85; }
        }
        @keyframes cardFloat {
          0%,100% { transform:translateY(0px); }
          50%      { transform:translateY(-6px); }
        }

        .panel-left  { animation: fadeSlideLeft  0.65s cubic-bezier(0.22,0.61,0.36,1) forwards; }
        .panel-right { animation: fadeSlideRight 0.65s cubic-bezier(0.22,0.61,0.36,1) 0.06s both; }
        .glow-orb    { animation: glowPulse 6s ease-in-out infinite; }
        .card-float  { animation: cardFloat 7s ease-in-out infinite; }
        .card-float-delay { animation: cardFloat 7s ease-in-out 1.5s infinite; }

        .white-input {
          width:100%;
          outline:none;
          background: #ffffff;
          border: 1.5px solid #e8ecf0;
          border-radius: 12px;
          color: #0f172a;
          font-size: 14px;
          padding: 14px 16px 14px 44px;
          transition: all 0.2s ease;
          font-family: 'Inter', sans-serif;
        }
        .white-input::placeholder { color: #b0bac5; }
        .white-input:focus {
          border-color: #0891B2;
          background: #f8fdff;
          box-shadow: 0 0 0 4px rgba(8,145,178,0.08);
        }

        .btn-login {
          background: linear-gradient(135deg, #0c4a6e 0%, #0891B2 50%, #06B6D4 100%);
          background-size: 200% auto;
          transition: all 0.28s ease;
          box-shadow: 0 4px 20px rgba(8,145,178,0.28);
        }
        .btn-login:hover:not(:disabled) {
          background-position: right center;
          box-shadow: 0 8px 32px rgba(8,145,178,0.42);
          transform: translateY(-1px);
        }
        .btn-login:active:not(:disabled) { transform:translateY(0); }
      `}</style>

      {/* ════════════════════════
          LEFT — Dark panel, centered
      ════════════════════════ */}
      <div
        className="hidden lg:flex flex-col flex-1 relative overflow-hidden panel-left"
        style={{ background: 'linear-gradient(155deg, #060d18 0%, #0b1929 45%, #091522 80%, #050e18 100%)' }}
      >
        {/* Glow orbs */}
        <div className="absolute pointer-events-none glow-orb" style={{ top:'-80px', left:'-60px', width:'550px', height:'550px', background:'radial-gradient(circle, rgba(6,182,212,0.18) 0%, transparent 60%)', filter:'blur(70px)' }} />
        <div className="absolute pointer-events-none glow-orb" style={{ bottom:'-80px', right:'-40px', width:'480px', height:'480px', background:'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 60%)', filter:'blur(70px)', animationDelay:'3s' }} />
        <div className="absolute pointer-events-none glow-orb" style={{ top:'38%', left:'55%', transform:'translate(-50%,-50%)', width:'350px', height:'350px', background:'radial-gradient(circle, rgba(6,182,212,0.07) 0%, transparent 55%)', filter:'blur(50px)', animationDelay:'1.5s' }} />

        {/* Subtle dot grid */}
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage:'radial-gradient(rgba(6,182,212,0.06) 1px, transparent 1px)', backgroundSize:'28px 28px' }} />

        <div className="relative z-10 flex flex-col h-full px-14 py-12">
          {/* Brand top-left */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background:'rgba(6,182,212,0.1)', border:'1px solid rgba(6,182,212,0.22)', boxShadow:'0 0 18px rgba(6,182,212,0.14)' }}>
              <img src={LOGO_URL} alt="ISG" className="w-6 h-6 object-contain" />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color:'#d8f4fb', letterSpacing:'-0.01em' }}>ISG Denetim</p>
              <p className="text-[11px]" style={{ color:'#2e6a7e' }}>İş Sağlığı &amp; Güvenliği</p>
            </div>
          </div>

          {/* ── CENTER content ── */}
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">

            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-xs font-semibold"
              style={{ background:'rgba(6,182,212,0.07)', border:'1px solid rgba(6,182,212,0.18)', color:'#22D3EE' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background:'#06B6D4' }} />
              Tüm roller için tek platform
            </div>

            {/* Main headline */}
            <h1 className="text-[2.6rem] font-black leading-[1.12] mb-5"
              style={{ color:'#f0f9ff', letterSpacing:'-0.045em', maxWidth:'380px' }}>
              İSG Süreçlerini<br />
              <span style={{ background:'linear-gradient(120deg, #06B6D4 0%, #22D3EE 45%, #10B981 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
                Tek Platformda
              </span><br />
              Yönetin
            </h1>

            <p className="text-sm leading-relaxed mb-12" style={{ color:'#3e7a90', maxWidth:'300px' }}>
              OSGB'ler ve firmalar için geliştirilen sistem ile saha, evrak ve sağlık süreçlerini tek ekrandan takip edin.
            </p>

            {/* Two feature cards — centered, side by side */}
            <div className="flex gap-4 w-full justify-center">
              {/* OSGB */}
              <div className="card-float flex flex-col items-center gap-3 px-6 py-6 rounded-2xl"
                style={{ background:'rgba(6,182,212,0.07)', border:'1px solid rgba(6,182,212,0.18)', width:'180px' }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background:'rgba(6,182,212,0.12)', border:'1px solid rgba(6,182,212,0.25)' }}>
                  <i className="ri-building-4-line text-xl" style={{ color:'#22D3EE' }} />
                </div>
                <div>
                  <p className="text-xs font-black tracking-widest text-center mb-1.5" style={{ color:'#22D3EE', letterSpacing:'0.1em' }}>OSGB</p>
                  <p className="text-[11px] font-bold text-center" style={{ color:'#22D3EE', letterSpacing:'0.06em' }}>YÖNETİMİ</p>
                  <p className="text-[10.5px] leading-relaxed text-center mt-2" style={{ color:'#2e6a7e' }}>
                    Firma, uzman ve hekim yönetimi tek panelde
                  </p>
                </div>
              </div>

              {/* FİRMA */}
              <div className="card-float-delay flex flex-col items-center gap-3 px-6 py-6 rounded-2xl"
                style={{ background:'rgba(16,185,129,0.07)', border:'1px solid rgba(16,185,129,0.18)', width:'180px' }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background:'rgba(16,185,129,0.12)', border:'1px solid rgba(16,185,129,0.25)' }}>
                  <i className="ri-shield-user-line text-xl" style={{ color:'#34D399' }} />
                </div>
                <div>
                  <p className="text-xs font-black tracking-widest text-center mb-1.5" style={{ color:'#34D399', letterSpacing:'0.1em' }}>FİRMA</p>
                  <p className="text-[11px] font-bold text-center" style={{ color:'#34D399', letterSpacing:'0.06em' }}>YÖNETİMİ</p>
                  <p className="text-[10.5px] leading-relaxed text-center mt-2" style={{ color:'#1e5c44' }}>
                    Evrak, ekipman ve personel sağlık takibi
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background:'#10B981' }} />
              <span className="text-xs" style={{ color:'#1e4d59' }}>Tüm sistemler aktif</span>
            </div>
            <div className="flex items-center gap-2">
              {['ri-shield-check-line','ri-lock-line','ri-cloud-line'].map(ic => (
                <div key={ic} className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                  <i className={`${ic} text-[10px]`} style={{ color:'#1e4d59' }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════
          RIGHT — White premium
      ════════════════════════ */}
      <div
        className="w-full lg:w-[480px] xl:w-[520px] flex-shrink-0 flex flex-col justify-center relative panel-right"
        style={{ background:'#ffffff', minHeight:'100vh' }}
      >
        {/* Very subtle corner tints */}
        <div className="absolute top-0 right-0 pointer-events-none" style={{ width:'320px', height:'320px', background:'radial-gradient(circle, rgba(6,182,212,0.04) 0%, transparent 70%)', filter:'blur(50px)' }} />
        <div className="absolute bottom-0 left-0 pointer-events-none" style={{ width:'260px', height:'260px', background:'radial-gradient(circle, rgba(16,185,129,0.03) 0%, transparent 70%)', filter:'blur(50px)' }} />

        {/* Mobile brand */}
        <div className="lg:hidden px-7 pt-10 pb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background:'rgba(8,145,178,0.08)', border:'1px solid rgba(8,145,178,0.18)' }}>
              <img src={LOGO_URL} alt="ISG" className="w-5 h-5 object-contain" />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color:'#0f172a' }}>ISG Denetim</p>
              <p className="text-xs" style={{ color:'#94a3b8' }}>İş Sağlığı &amp; Güvenliği</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {['OSGB Yönetimi','Firma Yönetimi'].map(t => (
              <span key={t} className="text-[11px] font-semibold px-3 py-1 rounded-full"
                style={{ background:'rgba(8,145,178,0.07)', border:'1px solid rgba(8,145,178,0.15)', color:'#0891B2' }}>{t}</span>
            ))}
          </div>
        </div>

        <div className="relative z-10 max-w-[380px] w-full mx-auto px-7 lg:px-0 pb-10 lg:pb-0">

          {/* Header */}
          <div className="mb-9">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 text-[11px] font-semibold"
              style={{ background:'rgba(8,145,178,0.07)', border:'1px solid rgba(8,145,178,0.15)', color:'#0891B2' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background:'#06B6D4' }} />
              Güvenli Giriş
            </div>
            <h2 className="text-[2rem] font-black mb-2 leading-tight" style={{ color:'#0a1628', letterSpacing:'-0.04em' }}>
              Hoşgeldiniz
            </h2>
            <p className="text-sm" style={{ color:'#94a3b8' }}>
              Hesabınıza giriş yaparak devam edin.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color:'#64748b', letterSpacing:'0.07em' }}>
                E-posta
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center pointer-events-none">
                  <i className="ri-mail-line text-sm" style={{ color:'#b0bac5' }} />
                </div>
                <input
                  ref={emailRef}
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(null); }}
                  placeholder="ornek@sirket.com"
                  autoComplete="email"
                  className="white-input"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color:'#64748b', letterSpacing:'0.07em' }}>
                  Şifre
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold transition-colors"
                  style={{ color:'#0891B2' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#06B6D4'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#0891B2'; }}
                >
                  Şifremi Unuttum
                </Link>
              </div>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center pointer-events-none">
                  <i className="ri-lock-line text-sm" style={{ color:'#b0bac5' }} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(null); }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="white-input"
                  style={{ paddingRight:'46px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center cursor-pointer transition-colors"
                  style={{ color:'#b0bac5' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#0891B2'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#b0bac5'; }}
                >
                  <i className={`${showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`} />
                </button>
              </div>
            </div>

            {/* Beni Hatırla */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2.5 cursor-pointer group select-none">
                <div
                  onClick={() => setRememberMe(v => !v)}
                  className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all"
                  style={{
                    background: rememberMe ? 'linear-gradient(135deg, #0891B2, #06B6D4)' : '#fff',
                    border: rememberMe ? '1.5px solid #0891B2' : '1.5px solid #d1d8e0',
                    boxShadow: rememberMe ? '0 0 0 3px rgba(8,145,178,0.12)' : 'none',
                  }}
                >
                  {rememberMe && <i className="ri-check-line text-[11px] text-white font-bold" />}
                </div>
                <span className="text-sm font-medium" style={{ color: '#475569' }}>Beni Hatırla</span>
              </label>
              <span className="text-[11px]" style={{ color: '#b0bac5' }}>
                {rememberMe ? 'Giriş bilgileri kaydedilecek' : 'Bu oturuma özel'}
              </span>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-3 rounded-xl p-3.5"
                style={{ background:'#fff5f5', border:'1.5px solid #fecaca' }}>
                <i className="ri-error-warning-line text-sm flex-shrink-0 mt-0.5" style={{ color:'#ef4444' }} />
                <p className="text-sm leading-relaxed" style={{ color:'#dc2626' }}>{error}</p>
              </div>
            )}

            {/* Submit */}
            <div className="pt-1">
              <button
                type="submit"
                disabled={loading}
                className="btn-login w-full py-4 rounded-xl font-bold text-sm text-white cursor-pointer whitespace-nowrap flex items-center justify-center gap-2.5"
                style={{ opacity: loading ? 0.75 : 1, letterSpacing:'0.04em' }}
              >
                {loading ? (
                  <><i className="ri-loader-4-line text-base animate-spin" /><span>Giriş yapılıyor...</span></>
                ) : (
                  <><i className="ri-login-circle-line text-base" /><span>Giriş Yap</span></>
                )}
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="my-7 flex items-center gap-4">
            <div className="flex-1" style={{ height:'1px', background:'#f0f2f5' }} />
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color:'#d1d8e0' }}>Güvenli Bağlantı</span>
            <div className="flex-1" style={{ height:'1px', background:'#f0f2f5' }} />
          </div>

          {/* Trust badges */}
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { icon:'ri-shield-check-line', label:'SSL Şifreli', color:'#059669' },
              { icon:'ri-lock-password-line', label:'2FA Desteği', color:'#0891B2' },
              { icon:'ri-cloud-line', label:'Bulut Tabanlı', color:'#6366f1' },
            ].map(b => (
              <div key={b.label}
                className="flex flex-col items-center gap-2 p-3 rounded-xl text-center"
                style={{ background:'#f9fafb', border:'1px solid #f0f2f5' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background:`${b.color}12` }}>
                  <i className={`${b.icon} text-sm`} style={{ color: b.color }} />
                </div>
                <span className="text-[10px] font-semibold" style={{ color:'#b0bac5' }}>{b.label}</span>
              </div>
            ))}
          </div>

          <p className="text-center text-[11px] mt-8" style={{ color:'#d1d8e0' }}>
            ISG Denetim &copy; {new Date().getFullYear()} — Tüm hakları saklıdır
          </p>
        </div>
      </div>
    </div>
  );
}
