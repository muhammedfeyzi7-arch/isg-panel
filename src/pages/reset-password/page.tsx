import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

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

  useEffect(() => {
    // Supabase detects the recovery token from the URL hash and fires RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'RECOVERY') {
        setPageState('ready');
      } else if (event === 'SIGNED_IN') {
        // Already handled by RECOVERY
      }
    });

    // Also check if there's already a session (in case onAuthStateChange already fired)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setPageState('ready');
      } else {
        // No session yet — wait for RECOVERY event, but set a timeout fallback
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

    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Şifreler eşleşmiyor. Lütfen tekrar kontrol edin.');
      return;
    }

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

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    color: '#E2E8F0',
    outline: 'none',
    width: '100%',
    padding: '11px 14px',
    fontSize: '14px',
    transition: 'all 0.15s',
  };

  const bgDecor = (
    <>
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, #3B82F6 0%, transparent 70%)', filter: 'blur(60px)' }}
      />
      <div
        className="fixed bottom-0 right-0 w-[500px] h-[400px] opacity-10 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, #6366F1 0%, transparent 70%)', filter: 'blur(60px)' }}
      />
    </>
  );

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #0A0F1E 0%, #0D1526 50%, #0A1020 100%)' }}
    >
      {bgDecor}

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)', boxShadow: '0 8px 30px rgba(99,102,241,0.45)' }}
          >
            <i className="ri-shield-check-line text-white text-2xl" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">ISG Denetim</h1>
          <p className="text-sm mt-1.5" style={{ color: '#475569' }}>Yönetim Sistemine Hoş Geldiniz</p>
        </div>

        <div
          className="rounded-2xl p-8"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          }}
        >
          {/* Loading */}
          {pageState === 'loading' && (
            <div className="text-center py-8">
              <i className="ri-loader-4-line text-3xl animate-spin mb-3" style={{ color: '#3B82F6' }} />
              <p className="text-sm" style={{ color: '#64748B' }}>Bağlantı doğrulanıyor...</p>
            </div>
          )}

          {/* Invalid / Expired */}
          {pageState === 'invalid' && (
            <div className="text-center py-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                <i className="ri-error-warning-line text-2xl" style={{ color: '#EF4444' }} />
              </div>
              <h2 className="text-lg font-bold text-white mb-2">Bağlantı Geçersiz</h2>
              <p className="text-sm leading-relaxed mb-6" style={{ color: '#94A3B8' }}>
                Bu parola sıfırlama bağlantısı geçersiz veya süresi dolmuş.
                Yeni bir bağlantı talep etmek için şifremi unuttum sayfasını kullanın.
              </p>
              <Link
                to="/forgot-password"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer whitespace-nowrap transition-all"
                style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)', boxShadow: '0 4px 20px rgba(99,102,241,0.3)' }}
              >
                <i className="ri-refresh-line" />
                Yeni Bağlantı İste
              </Link>
              <div className="mt-4">
                <Link
                  to="/login"
                  className="text-sm transition-colors cursor-pointer"
                  style={{ color: '#475569' }}
                >
                  Giriş sayfasına dön
                </Link>
              </div>
            </div>
          )}

          {/* Set New Password Form */}
          {pageState === 'ready' && (
            <>
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}
              >
                <i className="ri-lock-password-line text-xl" style={{ color: '#60A5FA' }} />
              </div>
              <h2 className="text-lg font-bold text-white mb-1">Yeni Parola Belirle</h2>
              <p className="text-sm mb-6" style={{ color: '#475569' }}>
                Hesabınız için güçlü bir parola oluşturun.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* New Password */}
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8' }}>
                    Yeni Parola
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center" style={{ color: '#475569' }}>
                      <i className="ri-lock-line text-sm" />
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => { setPassword(e.target.value); setError(null); }}
                      placeholder="En az 6 karakter"
                      style={{ ...inputStyle, paddingLeft: '36px', paddingRight: '42px' }}
                      onFocus={e => {
                        e.currentTarget.style.borderColor = 'rgba(59,130,246,0.6)';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)';
                        e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                      }}
                      onBlur={e => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                      }}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center cursor-pointer transition-colors"
                      style={{ color: '#475569' }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#94A3B8'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#475569'; }}
                    >
                      <i className={`${showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`} />
                    </button>
                  </div>

                  {/* Strength bar */}
                  {password.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div
                            key={i}
                            className="flex-1 h-1 rounded-full transition-all duration-300"
                            style={{
                              background: i <= strength.score ? strength.color : 'rgba(255,255,255,0.06)',
                            }}
                          />
                        ))}
                      </div>
                      <p className="text-[11px] font-medium" style={{ color: strength.color }}>
                        {strength.label}
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8' }}>
                    Parola Tekrar
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center" style={{ color: '#475569' }}>
                      <i className="ri-lock-2-line text-sm" />
                    </span>
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => { setConfirmPassword(e.target.value); setError(null); }}
                      placeholder="Parolayı tekrar girin"
                      style={{
                        ...inputStyle,
                        paddingLeft: '36px',
                        paddingRight: '42px',
                        borderColor: confirmPassword && confirmPassword !== password
                          ? 'rgba(239,68,68,0.5)'
                          : confirmPassword && confirmPassword === password
                            ? 'rgba(34,197,94,0.5)'
                            : 'rgba(255,255,255,0.1)',
                      }}
                      onFocus={e => {
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)';
                        e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                      }}
                      onBlur={e => {
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                      }}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center cursor-pointer transition-colors"
                      style={{ color: '#475569' }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#94A3B8'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#475569'; }}
                    >
                      <i className={`${showConfirm ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`} />
                    </button>
                    {confirmPassword && (
                      <span className="absolute right-9 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
                        <i
                          className={`text-sm ${confirmPassword === password ? 'ri-check-line' : 'ri-close-line'}`}
                          style={{ color: confirmPassword === password ? '#22C55E' : '#EF4444' }}
                        />
                      </span>
                    )}
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div
                    className="flex items-start gap-2.5 rounded-xl p-3.5"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
                  >
                    <span className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <i className="ri-error-warning-line text-sm" style={{ color: '#EF4444' }} />
                    </span>
                    <p className="text-sm" style={{ color: '#FCA5A5' }}>{error}</p>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl font-semibold text-sm text-white cursor-pointer whitespace-nowrap transition-all duration-200 flex items-center justify-center gap-2 mt-1"
                  style={{
                    background: loading ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #3B82F6, #6366F1)',
                    boxShadow: loading ? 'none' : '0 4px 20px rgba(99,102,241,0.4)',
                    opacity: loading ? 0.7 : 1,
                  }}
                  onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  {loading ? (
                    <>
                      <i className="ri-loader-4-line text-base animate-spin" />
                      <span>Kaydediliyor...</span>
                    </>
                  ) : (
                    <>
                      <i className="ri-save-3-line text-base" />
                      <span>Parolayı Güncelle</span>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-5 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-sm transition-colors cursor-pointer"
                  style={{ color: '#475569' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#94A3B8'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#475569'; }}
                >
                  <i className="ri-arrow-left-line text-sm" />
                  Giriş sayfasına dön
                </Link>
              </div>
            </>
          )}

          {/* Success */}
          {pageState === 'success' && (
            <div className="text-center py-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)' }}
              >
                <i className="ri-checkbox-circle-line text-3xl" style={{ color: '#34D399' }} />
              </div>
              <h2 className="text-lg font-bold text-white mb-2">Parola Güncellendi!</h2>
              <p className="text-sm leading-relaxed mb-6" style={{ color: '#94A3B8' }}>
                Parolanız başarıyla değiştirildi. Yeni parolanızla giriş yapabilirsiniz.
              </p>
              <button
                onClick={() => navigate('/login', { replace: true })}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer whitespace-nowrap transition-all"
                style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)', boxShadow: '0 4px 20px rgba(99,102,241,0.4)' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <i className="ri-login-circle-line" />
                Giriş Yap
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#1E293B' }}>
          ISG Denetim Yönetim Sistemi &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
