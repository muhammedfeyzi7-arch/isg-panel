import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../../store/AuthContext';
import { useNavigate } from 'react-router-dom';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/ae509f81-0883-42e1-9ed0-d08483f4284e_ChatGPT-Image-28-Mar-2026-23_09_27.png?v=f1e78272586c7081b6d13820591aa1f8';

const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  left: `${Math.floor((i * 37 + 13) % 100)}%`,
  top: `${Math.floor((i * 61 + 7) % 100)}%`,
  size: i % 3 === 0 ? 2.5 : i % 5 === 0 ? 1.5 : 1,
  delay: `${(i * 0.37) % 4}s`,
  duration: `${3 + (i * 0.43) % 4}s`,
  opacity: i % 4 === 0 ? 0.6 : i % 3 === 0 ? 0.4 : 0.25,
}));

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
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
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden"
      style={{ background: 'linear-gradient(150deg, #040C1A 0%, #061628 45%, #050E1C 75%, #030A15 100%)' }}
    >
      <style>{`
        @keyframes floatParticle { 0%,100%{transform:translateY(0) scale(1);opacity:var(--op)}50%{transform:translateY(-18px) scale(1.3);opacity:calc(var(--op)*1.6)} }
        @keyframes loginFadeUp { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
        @keyframes glowPulse { 0%,100%{opacity:0.7} 50%{opacity:1} }
        .login-card-animate { animation: loginFadeUp 0.65s cubic-bezier(0.22,0.61,0.36,1) forwards }
        .login-logo-animate { animation: loginFadeUp 0.55s cubic-bezier(0.22,0.61,0.36,1) 0.1s both }
      `}</style>

      <div className="fixed pointer-events-none" style={{ top:'-120px',left:'50%',transform:'translateX(-50%)',width:'900px',height:'560px',background:'radial-gradient(ellipse, rgba(6,182,212,0.14) 0%, transparent 70%)',filter:'blur(55px)',animation:'glowPulse 5s ease-in-out infinite' }} />
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage:'linear-gradient(rgba(6,182,212,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(6,182,212,0.04) 1px,transparent 1px)',backgroundSize:'48px 48px' }} />

      {mounted && PARTICLES.map(p => (
        <div key={p.id} className="fixed pointer-events-none rounded-full" style={{
          left: p.left, top: p.top, width: `${p.size}px`, height: `${p.size}px`,
          background: p.id % 3 === 0 ? '#06B6D4' : '#10B981',
          boxShadow: `0 0 ${p.size * 3}px rgba(6,182,212,0.8)`,
          // @ts-expect-error custom css var
          '--op': p.opacity,
          animation: `floatParticle ${p.duration} ease-in-out ${p.delay} infinite`,
          opacity: p.opacity,
        } as React.CSSProperties} />
      ))}

      <div className={`w-full max-w-[420px] relative z-10 ${mounted ? 'login-logo-animate' : 'opacity-0'}`}>
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-5 flex items-center justify-center" style={{ width: '100px', height: '100px' }}>
            <div className="absolute inset-0 rounded-full pointer-events-none" style={{ background:'radial-gradient(circle,rgba(6,182,212,0.4) 0%,transparent 72%)',filter:'blur(14px)',transform:'scale(1.5)',animation:'glowPulse 3s ease-in-out infinite' }} />
            <img src={LOGO_URL} alt="ISG Denetim" style={{ width:'100px',height:'100px',objectFit:'contain',position:'relative',zIndex:1,filter:'drop-shadow(0 0 18px rgba(6,182,212,0.6))' }} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color:'#E2F8FB',letterSpacing:'-0.02em' }}>ISG Denetim</h1>
          <p className="text-sm mt-1.5 font-medium" style={{ color:'#4A9BB5' }}>Yönetim Platformu</p>
        </div>

        <div className={mounted ? 'login-card-animate' : 'opacity-0'} style={{ position:'relative',borderRadius:'20px',overflow:'hidden',background:'rgba(6,182,212,0.04)',border:'1px solid rgba(6,182,212,0.12)',backdropFilter:'blur(28px)',boxShadow:'0 36px 88px rgba(0,0,0,0.65)' }}>
          <div style={{ position:'absolute',top:0,left:0,right:0,height:'1px',background:'linear-gradient(90deg,transparent,rgba(6,182,212,0.6) 30%,rgba(0,200,180,0.6) 60%,transparent)' }} />
          <div className="p-8 sm:p-9">
            <div className="mb-7">
              <h2 className="text-xl font-bold mb-1.5" style={{ color:'#E2F8FB',letterSpacing:'-0.015em' }}>Giriş Yap</h2>
              <p className="text-sm leading-relaxed" style={{ color:'#7ECFDC' }}>Herhangi bir e-posta ve en az 4 karakterli şifre ile giriş yapabilirsiniz.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: emailFocused ? '#7DE8F0' : '#4A9BB5', transition: 'color 0.15s' }}>E-posta Adresi</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center pointer-events-none" style={{ color: emailFocused ? '#06B6D4' : '#3A8A9E' }}>
                    <i className="ri-mail-line text-sm" />
                  </span>
                  <input
                    type="email" value={email}
                    onChange={e => { setEmail(e.target.value); setError(null); }}
                    onFocus={() => setEmailFocused(true)} onBlur={() => setEmailFocused(false)}
                    placeholder="ornek@sirket.com" autoComplete="email"
                    style={{ width:'100%',paddingLeft:'40px',paddingRight:'14px',paddingTop:'11px',paddingBottom:'11px',background: emailFocused ? 'rgba(6,182,212,0.07)' : 'rgba(6,182,212,0.02)',border: emailFocused ? '1px solid rgba(6,182,212,0.45)' : '1px solid rgba(6,182,212,0.1)',borderRadius:'10px',color:'#D0F4F8',fontSize:'14px',outline:'none',transition:'all 0.2s',boxShadow: emailFocused ? '0 0 0 3px rgba(6,182,212,0.1)' : 'none' }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold" style={{ color: passwordFocused ? '#7DE8F0' : '#4A9BB5', transition: 'color 0.15s' }}>Şifre</label>
                  <span className="text-xs" style={{ color: '#4A9BB5' }}>En az 4 karakter</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center pointer-events-none" style={{ color: passwordFocused ? '#06B6D4' : '#3A8A9E' }}>
                    <i className="ri-lock-line text-sm" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'} value={password}
                    onChange={e => { setPassword(e.target.value); setError(null); }}
                    onFocus={() => setPasswordFocused(true)} onBlur={() => setPasswordFocused(false)}
                    placeholder="••••••••" autoComplete="current-password"
                    style={{ width:'100%',paddingLeft:'40px',paddingRight:'44px',paddingTop:'11px',paddingBottom:'11px',background: passwordFocused ? 'rgba(6,182,212,0.07)' : 'rgba(6,182,212,0.02)',border: passwordFocused ? '1px solid rgba(6,182,212,0.45)' : '1px solid rgba(6,182,212,0.1)',borderRadius:'10px',color:'#D0F4F8',fontSize:'14px',outline:'none',transition:'all 0.2s',boxShadow: passwordFocused ? '0 0 0 3px rgba(6,182,212,0.1)' : 'none' }}
                  />
                  <button type="button" onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center cursor-pointer"
                    style={{ color: '#3A8A9E' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#7DE8F0'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#3A8A9E'; }}>
                    <i className={`${showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`} />
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-3 rounded-xl p-3.5" style={{ background:'rgba(239,68,68,0.07)',border:'1px solid rgba(239,68,68,0.18)' }}>
                  <i className="ri-error-warning-line text-sm flex-shrink-0 mt-0.5" style={{ color:'#F87171' }} />
                  <p className="text-sm leading-relaxed" style={{ color:'#FCA5A5' }}>{error}</p>
                </div>
              )}

              <div className="pt-1">
                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-xl font-semibold text-sm cursor-pointer whitespace-nowrap flex items-center justify-center gap-2.5"
                  style={{ background: loading ? 'rgba(6,182,212,0.3)' : 'linear-gradient(135deg, #0891B2 0%, #0E7490 50%, #06B6D4 100%)',boxShadow: loading ? 'none' : '0 4px 28px rgba(6,182,212,0.4)',color: loading ? 'rgba(255,255,255,0.5)' : '#ffffff',opacity: loading ? 0.7 : 1,transition:'all 0.22s ease',border:'1px solid rgba(6,182,212,0.25)' }}>
                  {loading ? <><i className="ri-loader-4-line text-base animate-spin" /><span>Giriş yapılıyor...</span></> : <><i className="ri-login-circle-line text-base" /><span>Giriş Yap</span></>}
                </button>
              </div>
            </form>
          </div>
        </div>

        <p className="text-center text-xs mt-6" style={{ color:'#2E7A8F' }}>ISG Denetim Yönetim Sistemi &copy; {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
