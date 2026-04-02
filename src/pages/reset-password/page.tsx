import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518';

type PageState = 'loading' | 'ready' | 'success' | 'invalid';

function getPasswordStrength(pwd: string): { score: number; label: string; color: string } {
  if (pwd.length === 0) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { score, label: 'Çok Zayıf', color: '#EF4444' };
  if (score === 2) return { score, label: 'Zayıf', color: '#F97316' };
  if (score === 3) return { score, label: 'Orta', color: '#EAB308' };
  if (score === 4) return { score, label: 'Güçlü', color: '#22C55E' };
  return { score, label: 'Çok Güçlü', color: '#10B981' };
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'RECOVERY') setPageState('ready');
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setPageState('ready');
      } else {
        setTimeout(() => {
          setPageState(prev => prev === 'loading' ? 'invalid' : prev);
        }, 3000);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError('Şifre en az 6 karakter olmalıdır.'); return; }
    if (password !== confirmPassword) { setError('Şifreler eşleşmiyor. Lütfen tekrar kontrol edin.'); return; }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError('Şifre güncellenemedi. Bağlantı süresi dolmuş olabilir.');
    } else {
      await supabase.auth.signOut();
      setPageState('success');
    }
  };

  const strength = getPasswordStrength(password);

  return (
    <div
      className="min-h-screen flex overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 30%, #f0fdf4 60%, #fafafa 100%)' }}
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
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1; }
        }
        @keyframes successPop {
          0%   { transform: scale(0.7); opacity: 0; }
          70%  { transform: scale(1.08); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .slide-left  { animation: fadeSlideLeft  0.75s cubic-bezier(0.22,0.61,0.36,1) forwards; }
        .slide-right { animation: fadeSlideRight 0.75s cubic-bezier(0.22,0.61,0.36,1) 0.1s both; }
        .glow-pulse  { animation: pulseGlow 4s ease-in-out infinite; }
        .success-pop { animation: successPop 0.5s cubic-bezier(0.22,0.61,0.36,1) forwards; }

        .auth-input {
          transition: all 0.2s ease;
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          color: #1e293b;
          font-size: 14px;
          width: 100%;
          outline: none;
          padding: 14px 46px 14px 44px;
        }
        .auth-input::placeholder { color: #94a3b8; }
        .auth-input:focus {
          border-color: #06B6D4;
          box-shadow: 0 0 0 4px rgba(6,182,212,0.12);
          background: #f0fdff;
        }
        .auth-input.match { border-color: rgba(16,185,129,0.5); }
        .auth-input.mismatch { border-color: rgba(239,68,68,0.5); }

        .auth-btn {
          background: linear-gradient(135deg, #0891B2 0%, #06B6D4 50%, #22D3EE 100%);
          background-size: 200% auto;
          transition: all 0.3s ease;
          box-shadow: 0 4px 24px rgba(6,182,212,0.35);
        }
        .auth-btn:hover:not(:disabled) {
          background-position: right center;
          box-shadow: 0 8px 36px rgba(6,182,212,0.5);
          transform: translateY(-2px);
        }
      `}</style>

      {/* ═══ LEFT PANEL ═══ */}
      <div
        className={`hidden lg:flex flex-col flex-1 relative overflow-hidden ${mounted ? 'slide-left' : 'opacity-0'}`}
        style={{ background: 'linear-gradient(160deg, #0c1a2e 0%, #0f2744 45%, #0a1f38 75%, #071628 100%)' }}
      >
        <div className="absolute pointer-events-none glow-pulse"
          style={{ top: '-140px', left: '-100px', width: '650px', height: '650px', background: 'radial-gradient(circle, rgba(6,182,212,0.16) 0%, transparent 65%)', filter: 'blur(70px)' }} />
        <div className="absolute pointer-events-none glow-pulse"
          style={{ bottom: '-120px', right: '-80px', width: '550px', height: '550px', background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 65%)', filter: 'blur(70px)', animationDelay: '2s' }} />

        <div className="relative z-10 flex flex-col h-full px-14 py-14">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.25)', boxShadow: '0 0 24px rgba(6,182,212,0.15)' }}>
              <img src={LOGO_URL} alt="ISG" className="w-7 h-7 object-contain" />
            </div>
            <div>
              <p className="text-base font-bold" style={{ color: '#e2f8fb', letterSpacing: '-0.02em' }}>ISG Denetim</p>
              <p className="text-xs" style={{ color: '#4a9bb5' }}>İş Sağlığı & Güvenliği Platformu</p>
            </div>
          </div>

          {/* Center */}
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="relative mb-10">
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at center, rgba(16,185,129,0.25) 0%, transparent 65%)', filter: 'blur(30px)', transform: 'scale(1.3)' }} />
              <div className="relative z-10 w-24 h-24 rounded-3xl flex items-center justify-center"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', backdropFilter: 'blur(10px)' }}>
                <i className="ri-lock-password-line text-4xl" style={{ color: '#10B981' }} />
              </div>
            </div>

            <div style={{ maxWidth: '320px' }}>
              <h2 className="text-3xl font-extrabold leading-tight mb-4"
                style={{ color: '#f0f9ff', letterSpacing: '-0.03em' }}>
                Yeni şifrenizi<br />
                <span style={{ background: 'linear-gradient(135deg, #10B981 0%, #34D399 50%, #06B6D4 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  belirleyin
                </span>
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: '#6aacbf' }}>
                Güçlü bir şifre seçin. Büyük harf, rakam ve özel karakter kullanmanızı öneririz.
              </p>
            </div>

            {/* Password tips */}
            <div className="mt-10 space-y-2.5 w-full" style={{ maxWidth: '300px' }}>
              {[
                { icon: 'ri-check-line', text: 'En az 8 karakter', color: '#06B6D4' },
                { icon: 'ri-check-line', text: 'Büyük ve küçük harf', color: '#06B6D4' },
                { icon: 'ri-check-line', text: 'Rakam veya özel karakter', color: '#06B6D4' },
              ].map((tip) => (
                <div key={tip.text} className="flex items-center gap-3 text-left">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.2)' }}>
                    <i className={`${tip.icon} text-xs`} style={{ color: tip.color }} />
                  </div>
                  <p className="text-sm" style={{ color: '#4a8fa5' }}>{tip.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10B981' }} />
            <span className="text-xs" style={{ color: '#2e6a7e' }}>Tüm sistemler çalışıyor</span>
          </div>
        </div>
      </div>

      {/* ═══ RIGHT PANEL ═══ */}
      <div
        className={`w-full lg:w-[480px] xl:w-[520px] flex-shrink-0 flex flex-col justify-center px-8 sm:px-14 py-12 relative ${mounted ? 'slide-right' : 'opacity-0'}`}
        style={{ background: '#ffffff' }}
      >
        <div className="absolute top-0 right-0 pointer-events-none"
          style={{ width: '280px', height: '280px', background: 'radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 70%)', filter: 'blur(40px)' }} />

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center justify-center gap-3 mb-10">
          <img src={LOGO_URL} alt="ISG Denetim" className="w-9 h-9 object-contain" />
          <div>
            <p className="text-base font-bold" style={{ color: '#0f172a' }}>ISG Denetim</p>
            <p className="text-xs" style={{ color: '#64748b' }}>Yönetim Platformu</p>
          </div>
        </div>

        <div className="relative z-10 max-w-[380px] w-full mx-auto">

          {/* Loading */}
          {pageState === 'loading' && (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)' }}>
                <i className="ri-loader-4-line text-2xl animate-spin" style={{ color: '#06B6D4' }} />
              </div>
              <p className="text-sm font-medium" style={{ color: '#64748b' }}>Bağlantı doğrulanıyor...</p>
            </div>
          )}

          {/* Invalid */}
          {pageState === 'invalid' && (
            <div className="text-center">
              <div className="success-pop w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <i className="ri-error-warning-line text-3xl" style={{ color: '#ef4444' }} />
              </div>
              <h2 className="text-2xl font-extrabold mb-3" style={{ color: '#0f172a', letterSpacing: '-0.02em' }}>
                Bağlantı Geçersiz
              </h2>
              <p className="text-sm leading-relaxed mb-8" style={{ color: '#64748b' }}>
                Bu şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş. Yeni bir bağlantı talep edin.
              </p>
              <Link to="/forgot-password"
                className="auth-btn inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold text-white cursor-pointer whitespace-nowrap">
                <i className="ri-refresh-line" />
                Yeni Bağlantı İste
              </Link>
              <div className="mt-5">
                <Link to="/login" className="text-sm transition-colors cursor-pointer" style={{ color: '#94a3b8' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#0891B2'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; }}>
                  Giriş sayfasına dön
                </Link>
              </div>
            </div>
          )}

          {/* Ready — form */}
          {pageState === 'ready' && (
            <>
              <div className="mb-10">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 text-xs font-semibold"
                  style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#059669' }}>
                  <i className="ri-lock-password-line text-xs" />
                  Yeni Şifre Belirleme
                </div>
                <h2 className="text-3xl font-extrabold mb-2" style={{ color: '#0f172a', letterSpacing: '-0.03em' }}>
                  Yeni Parola Belirle
                </h2>
                <p className="text-sm" style={{ color: '#64748b' }}>
                  Hesabınız için güçlü bir parola oluşturun.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* New password */}
                <div>
                  <label className="block text-xs font-semibold mb-2" style={{ color: '#374151' }}>Yeni Parola</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center pointer-events-none">
                      <i className="ri-lock-line text-sm" style={{ color: '#94a3b8' }} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => { setPassword(e.target.value); setError(null); }}
                      placeholder="En az 6 karakter"
                      autoComplete="new-password"
                      className="auth-input"
                    />
                    <button type="button" onClick={() => setShowPassword(p => !p)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center cursor-pointer transition-colors"
                      style={{ color: '#94a3b8' }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#0891B2'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; }}>
                      <i className={`${showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`} />
                    </button>
                  </div>
                  {/* Strength bar */}
                  {password.length > 0 && (
                    <div className="mt-2.5 space-y-1.5">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div key={i} className="flex-1 h-1.5 rounded-full transition-all duration-300"
                            style={{ background: i <= strength.score ? strength.color : '#f1f5f9' }} />
                        ))}
                      </div>
                      <p className="text-xs font-semibold" style={{ color: strength.color }}>{strength.label}</p>
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-xs font-semibold mb-2" style={{ color: '#374151' }}>Parola Tekrar</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center pointer-events-none">
                      <i className="ri-lock-2-line text-sm" style={{ color: '#94a3b8' }} />
                    </div>
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => { setConfirmPassword(e.target.value); setError(null); }}
                      placeholder="Parolayı tekrar girin"
                      autoComplete="new-password"
                      className={`auth-input ${confirmPassword && confirmPassword === password ? 'match' : confirmPassword && confirmPassword !== password ? 'mismatch' : ''}`}
                    />
                    <button type="button" onClick={() => setShowConfirm(p => !p)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center cursor-pointer transition-colors"
                      style={{ color: '#94a3b8' }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#0891B2'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; }}>
                      <i className={`${showConfirm ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`} />
                    </button>
                    {confirmPassword && (
                      <span className="absolute right-10 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
                        <i className={`text-sm ${confirmPassword === password ? 'ri-check-line' : 'ri-close-line'}`}
                          style={{ color: confirmPassword === password ? '#10B981' : '#ef4444' }} />
                      </span>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-3 rounded-xl p-4"
                    style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <i className="ri-error-warning-line text-sm flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                    <p className="text-sm" style={{ color: '#dc2626' }}>{error}</p>
                  </div>
                )}

                <div className="pt-2">
                  <button type="submit" disabled={loading}
                    className="auth-btn w-full py-4 rounded-xl font-bold text-sm text-white cursor-pointer whitespace-nowrap flex items-center justify-center gap-2.5"
                    style={{ opacity: loading ? 0.7 : 1, letterSpacing: '0.02em' }}>
                    {loading ? (
                      <><i className="ri-loader-4-line text-base animate-spin" /><span>Kaydediliyor...</span></>
                    ) : (
                      <><i className="ri-save-3-line text-base" /><span>Parolayı Güncelle</span></>
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-8 text-center">
                <Link to="/login"
                  className="inline-flex items-center gap-2 text-sm font-medium transition-colors cursor-pointer"
                  style={{ color: '#94a3b8' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#0891B2'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; }}>
                  <i className="ri-arrow-left-line text-sm" />
                  Giriş sayfasına dön
                </Link>
              </div>
            </>
          )}

          {/* Success */}
          {pageState === 'success' && (
            <div className="text-center">
              <div className="success-pop w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}>
                <i className="ri-checkbox-circle-line text-3xl" style={{ color: '#10B981' }} />
              </div>
              <h2 className="text-2xl font-extrabold mb-3" style={{ color: '#0f172a', letterSpacing: '-0.02em' }}>
                Parola Güncellendi!
              </h2>
              <p className="text-sm leading-relaxed mb-8" style={{ color: '#64748b' }}>
                Parolanız başarıyla değiştirildi. Yeni parolanızla giriş yapabilirsiniz.
              </p>
              <button onClick={() => navigate('/login', { replace: true })}
                className="auth-btn inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm font-bold text-white cursor-pointer whitespace-nowrap">
                <i className="ri-login-circle-line" />
                Giriş Yap
              </button>
            </div>
          )}

          <p className="text-center text-xs mt-10" style={{ color: '#cbd5e1' }}>
            ISG Denetim Yönetim Sistemi &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
