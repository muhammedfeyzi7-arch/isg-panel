import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('E-posta adresi boş bırakılamaz.');
      return;
    }
    setLoading(true);
    setError(null);

    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}reset-password`.replace(/\/+/g, '/').replace(':/', '://');

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });

    setLoading(false);

    if (resetError) {
      setError('İstek gönderilemedi. Lütfen tekrar deneyin.');
    } else {
      setSent(true);
    }
  };

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

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #0A0F1E 0%, #0D1526 50%, #0A1020 100%)' }}
    >
      {/* Background glow */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, #3B82F6 0%, transparent 70%)', filter: 'blur(60px)' }}
      />
      <div
        className="fixed bottom-0 right-0 w-[500px] h-[400px] opacity-10 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, #6366F1 0%, transparent 70%)', filter: 'blur(60px)' }}
      />

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

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          }}
        >
          {!sent ? (
            <>
              {/* Icon */}
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}
              >
                <i className="ri-key-2-line text-xl" style={{ color: '#60A5FA' }} />
              </div>

              <h2 className="text-lg font-bold text-white mb-1">Şifremi Unuttum</h2>
              <p className="text-sm mb-6 leading-relaxed" style={{ color: '#475569' }}>
                Hesabınıza kayıtlı e-posta adresini girin. Parola sıfırlama bağlantısı göndereceğiz.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8' }}>
                    E-posta Adresi
                  </label>
                  <div className="relative">
                    <span
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center"
                      style={{ color: '#475569' }}
                    >
                      <i className="ri-mail-line text-sm" />
                    </span>
                    <input
                      type="email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setError(null); }}
                      placeholder="ornek@sirket.com"
                      style={{ ...inputStyle, paddingLeft: '36px' }}
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
                      autoComplete="email"
                    />
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
                  className="w-full py-3 rounded-xl font-semibold text-sm text-white cursor-pointer whitespace-nowrap transition-all duration-200 flex items-center justify-center gap-2"
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
                      <span>Gönderiliyor...</span>
                    </>
                  ) : (
                    <>
                      <i className="ri-send-plane-line text-base" />
                      <span>Sıfırlama Bağlantısı Gönder</span>
                    </>
                  )}
                </button>
              </form>

              {/* Back to login */}
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
          ) : (
            /* Success State */
            <div className="text-center py-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)' }}
              >
                <i className="ri-mail-check-line text-2xl" style={{ color: '#34D399' }} />
              </div>
              <h2 className="text-lg font-bold text-white mb-2">E-posta Gönderildi!</h2>
              <p className="text-sm leading-relaxed mb-2" style={{ color: '#94A3B8' }}>
                <span className="font-semibold" style={{ color: '#E2E8F0' }}>{email}</span> adresine
                parola sıfırlama bağlantısı gönderdik.
              </p>
              <p className="text-xs leading-relaxed mb-6" style={{ color: '#475569' }}>
                Gelen kutunuzu kontrol edin. E-posta birkaç dakika içinde ulaşacaktır.
                Spam klasörünü de kontrol etmeyi unutmayın.
              </p>

              {/* Resend */}
              <button
                onClick={() => { setSent(false); setEmail(''); }}
                className="text-sm cursor-pointer transition-colors"
                style={{ color: '#475569' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#94A3B8'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#475569'; }}
              >
                Farklı bir e-posta dene
              </button>

              <div className="mt-4">
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
