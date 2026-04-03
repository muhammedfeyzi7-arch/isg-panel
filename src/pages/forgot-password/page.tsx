import { useState, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('E-posta adresi boş bırakılamaz.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Geçerli bir e-posta adresi giriniz.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const { error: supabaseError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (supabaseError) {
        // Güvenlik: email bulunamasa bile başarılı göster (enumeration koruması)
        console.error('[ForgotPassword] Supabase error:', supabaseError.message);
      }

      // Her durumda başarılı göster — kullanıcı enumeration'ı önlemek için
      setSent(true);
    } catch {
      setError('Bağlantı hatası. İnternet bağlantınızı kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

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
          padding: 14px 16px 14px 44px;
        }
        .auth-input::placeholder { color: #94a3b8; }
        .auth-input:focus {
          border-color: #06B6D4;
          box-shadow: 0 0 0 4px rgba(6,182,212,0.12);
          background: #f0fdff;
        }

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
        {/* Ambient blobs */}
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

          {/* Center content */}
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            {/* Icon visual */}
            <div className="relative mb-10">
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at center, rgba(6,182,212,0.25) 0%, transparent 65%)', filter: 'blur(30px)', transform: 'scale(1.3)' }} />
              <div className="relative z-10 w-24 h-24 rounded-3xl flex items-center justify-center"
                style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)', backdropFilter: 'blur(10px)' }}>
                <i className="ri-key-2-line text-4xl" style={{ color: '#06B6D4' }} />
              </div>
            </div>

            <div style={{ maxWidth: '320px' }}>
              <h2 className="text-3xl font-extrabold leading-tight mb-4"
                style={{ color: '#f0f9ff', letterSpacing: '-0.03em' }}>
                Şifrenizi mi<br />
                <span style={{ background: 'linear-gradient(135deg, #06B6D4 0%, #22D3EE 50%, #10B981 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  unuttunuz?
                </span>
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: '#6aacbf' }}>
                Endişelenmeyin. E-posta adresinizi girin, sıfırlama bağlantısını hemen gönderelim.
              </p>
            </div>

            {/* Steps */}
            <div className="mt-10 space-y-3 w-full" style={{ maxWidth: '300px' }}>
              {[
                { num: '1', text: 'E-posta adresinizi girin', done: true },
                { num: '2', text: 'Gelen kutunuzu kontrol edin', done: false },
                { num: '3', text: 'Yeni şifrenizi belirleyin', done: false },
              ].map((step) => (
                <div key={step.num} className="flex items-center gap-3 text-left">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                    style={{ background: step.done ? 'rgba(6,182,212,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${step.done ? 'rgba(6,182,212,0.4)' : 'rgba(255,255,255,0.1)'}`, color: step.done ? '#06B6D4' : '#3a6a7e' }}>
                    {step.num}
                  </div>
                  <p className="text-sm" style={{ color: step.done ? '#c0e8f5' : '#3a6a7e' }}>{step.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom */}
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
          {!sent ? (
            <>
              {/* Header */}
              <div className="mb-10">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 text-xs font-semibold"
                  style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)', color: '#0891B2' }}>
                  <i className="ri-key-2-line text-xs" />
                  Şifre Sıfırlama
                </div>
                <h2 className="text-3xl font-extrabold mb-2" style={{ color: '#0f172a', letterSpacing: '-0.03em' }}>
                  Şifremi Unuttum
                </h2>
                <p className="text-sm leading-relaxed" style={{ color: '#64748b' }}>
                  Hesabınıza kayıtlı e-posta adresini girin. Sıfırlama bağlantısı göndereceğiz.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold mb-2" style={{ color: '#374151' }}>
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
                      className="auth-input"
                    />
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
                  <button
                    type="submit"
                    disabled={loading}
                    className="auth-btn w-full py-4 rounded-xl font-bold text-sm text-white cursor-pointer whitespace-nowrap flex items-center justify-center gap-2.5"
                    style={{ opacity: loading ? 0.7 : 1, letterSpacing: '0.02em' }}
                  >
                    {loading ? (
                      <><i className="ri-loader-4-line text-base animate-spin" /><span>Gönderiliyor...</span></>
                    ) : (
                      <><i className="ri-send-plane-line text-base" /><span>Sıfırlama Bağlantısı Gönder</span></>
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
          ) : (
            /* Success State */
            <div className="text-center">
              <div className="success-pop w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}>
                <i className="ri-mail-check-line text-3xl" style={{ color: '#10B981' }} />
              </div>
              <h2 className="text-2xl font-extrabold mb-3" style={{ color: '#0f172a', letterSpacing: '-0.02em' }}>
                E-posta Gönderildi!
              </h2>
              <p className="text-sm leading-relaxed mb-2" style={{ color: '#374151' }}>
                <span className="font-semibold" style={{ color: '#0f172a' }}>{email}</span> adresine sıfırlama bağlantısı gönderdik.
              </p>
              <p className="text-xs leading-relaxed mb-8" style={{ color: '#94a3b8' }}>
                Gelen kutunuzu kontrol edin. Spam klasörünü de kontrol etmeyi unutmayın.
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => { setSent(false); setEmail(''); }}
                  className="w-full py-3.5 rounded-xl font-semibold text-sm cursor-pointer whitespace-nowrap transition-all"
                  style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#374151' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#06B6D4'; e.currentTarget.style.color = '#0891B2'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#374151'; }}
                >
                  Farklı bir e-posta dene
                </button>
                <Link to="/login"
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold text-sm cursor-pointer whitespace-nowrap transition-all"
                  style={{ color: '#94a3b8' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#0891B2'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; }}>
                  <i className="ri-arrow-left-line" />
                  Giriş sayfasına dön
                </Link>
              </div>
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
