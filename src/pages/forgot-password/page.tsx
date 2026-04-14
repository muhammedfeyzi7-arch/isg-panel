import { useState, useRef, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => { emailRef.current?.focus(); }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const t = email.trim();
    if (!t) { setError('E-posta adresi boş bırakılamaz.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) { setError('Geçerli bir e-posta adresi giriniz.'); return; }
    setLoading(true); setError(null);
    try {
      await supabase.auth.resetPasswordForEmail(t, { redirectTo: `${window.location.origin}/reset-password` });
      setSent(true);
    } catch { setError('Bağlantı hatası. İnternet bağlantınızı kontrol edin.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex overflow-hidden" style={{ fontFamily:"'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

        @keyframes fpSlideLeft {
          from { opacity:0; transform:translateX(-32px); }
          to   { opacity:1; transform:translateX(0); }
        }
        @keyframes fpSlideRight {
          from { opacity:0; transform:translateX(32px); }
          to   { opacity:1; transform:translateX(0); }
        }
        @keyframes fpGlow {
          0%,100% { opacity:0.4; }
          50%      { opacity:0.85; }
        }
        @keyframes fpIconFloat {
          0%,100% { transform:translateY(0) rotate(0deg); }
          50%      { transform:translateY(-8px) rotate(3deg); }
        }
        @keyframes fpPop {
          0%   { transform:scale(0.72); opacity:0; }
          70%  { transform:scale(1.06); }
          100% { transform:scale(1); opacity:1; }
        }
        @keyframes fpFadeUp {
          from { opacity:0; transform:translateY(14px); }
          to   { opacity:1; transform:translateY(0); }
        }

        .fp-left   { animation: fpSlideLeft  0.65s cubic-bezier(0.22,0.61,0.36,1) forwards; }
        .fp-right  { animation: fpSlideRight 0.65s cubic-bezier(0.22,0.61,0.36,1) 0.06s both; }
        .fp-glow   { animation: fpGlow 6s ease-in-out infinite; }
        .fp-icon   { animation: fpIconFloat 5s ease-in-out infinite; }
        .fp-pop    { animation: fpPop 0.5s cubic-bezier(0.22,0.61,0.36,1) forwards; }
        .fp-fadeup { animation: fpFadeUp 0.4s ease forwards; }

        .fp-white-input {
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
        .fp-white-input::placeholder { color: #b0bac5; }
        .fp-white-input:focus {
          border-color: #0891B2;
          background: #f8fdff;
          box-shadow: 0 0 0 4px rgba(8,145,178,0.08);
        }

        .fp-btn {
          background: linear-gradient(135deg, #0c4a6e 0%, #0891B2 50%, #06B6D4 100%);
          background-size: 200% auto;
          transition: all 0.28s ease;
          box-shadow: 0 4px 20px rgba(8,145,178,0.28);
        }
        .fp-btn:hover:not(:disabled) {
          background-position: right center;
          box-shadow: 0 8px 32px rgba(8,145,178,0.42);
          transform: translateY(-1px);
        }
        .fp-btn:active:not(:disabled) { transform:translateY(0); }
      `}</style>

      {/* ════════ LEFT — Dark, centered, deep ════════ */}
      <div
        className="hidden lg:flex flex-col flex-1 relative overflow-hidden fp-left"
        style={{ background:'linear-gradient(155deg, #060d18 0%, #0b1929 45%, #091522 80%, #050e18 100%)' }}
      >
        {/* Glow orbs */}
        <div className="absolute pointer-events-none fp-glow" style={{ top:'-80px', left:'-60px', width:'550px', height:'550px', background:'radial-gradient(circle, rgba(6,182,212,0.18) 0%, transparent 60%)', filter:'blur(70px)' }} />
        <div className="absolute pointer-events-none fp-glow" style={{ bottom:'-80px', right:'-40px', width:'480px', height:'480px', background:'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 60%)', filter:'blur(70px)', animationDelay:'3s' }} />
        <div className="absolute pointer-events-none fp-glow" style={{ top:'40%', left:'50%', transform:'translate(-50%,-50%)', width:'360px', height:'360px', background:'radial-gradient(circle, rgba(6,182,212,0.07) 0%, transparent 55%)', filter:'blur(50px)', animationDelay:'1.5s' }} />

        {/* Dot grid */}
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage:'radial-gradient(rgba(6,182,212,0.06) 1px, transparent 1px)', backgroundSize:'28px 28px' }} />

        {/* Ghost big text — depth layer */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
          <p className="font-black text-[11rem] leading-none tracking-tighter"
            style={{ color:'rgba(6,182,212,0.03)', letterSpacing:'-0.05em', whiteSpace:'nowrap' }}>
            ŞİFRE
          </p>
        </div>

        <div className="relative z-10 flex flex-col h-full px-14 py-12">
          {/* Brand */}
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

          {/* ─ CENTER ─ */}
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            {/* Floating icon with glow ring */}
            <div className="relative mb-10 fp-icon">
              {/* Outer glow ring */}
              <div className="absolute inset-0 rounded-3xl pointer-events-none"
                style={{ background:'radial-gradient(ellipse at center, rgba(6,182,212,0.3) 0%, transparent 65%)', filter:'blur(24px)', transform:'scale(1.5)' }} />
              {/* Mid ring */}
              <div className="absolute inset-[-8px] rounded-3xl pointer-events-none"
                style={{ border:'1px solid rgba(6,182,212,0.1)' }} />
              {/* Icon box */}
              <div className="relative w-[88px] h-[88px] rounded-3xl flex items-center justify-center"
                style={{ background:'linear-gradient(135deg, rgba(6,182,212,0.15) 0%, rgba(6,182,212,0.06) 100%)', border:'1px solid rgba(6,182,212,0.25)', backdropFilter:'blur(8px)' }}>
                <i className="ri-key-2-line text-4xl" style={{ color:'#22D3EE', filter:'drop-shadow(0 0 12px rgba(6,182,212,0.7))' }} />
              </div>
            </div>

            {/* Headline with layered depth */}
            <div style={{ maxWidth:'340px' }}>
              {/* Step label */}
              <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-3" style={{ color:'rgba(6,182,212,0.4)' }}>
                Şifre Sıfırlama
              </p>

              <h2 className="font-black leading-[1.1] mb-5"
                style={{ fontSize:'2.5rem', color:'#f0f9ff', letterSpacing:'-0.045em' }}>
                Şifrenizi mi<br />
                {/* Gradient + outline text combo for depth */}
                <span className="relative inline-block">
                  <span style={{ background:'linear-gradient(120deg, #06B6D4 0%, #22D3EE 45%, #10B981 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
                    unuttunuz?
                  </span>
                </span>
              </h2>

              <p className="text-sm leading-relaxed" style={{ color:'#3e7a90' }}>
                Endişelenmeyin. E-posta adresinizi girin,<br />
                <span style={{ color:'#5a9ab5' }}>sıfırlama bağlantısını hemen gönderelim.</span>
              </p>
            </div>

            {/* Steps with connecting line */}
            <div className="mt-12 relative" style={{ maxWidth:'260px', width:'100%' }}>
              {/* Connecting line */}
              <div className="absolute left-4 top-4 bottom-4 w-px pointer-events-none"
                style={{ background:'linear-gradient(to bottom, rgba(6,182,212,0.3) 0%, rgba(6,182,212,0.08) 50%, rgba(6,182,212,0.0) 100%)' }} />

              <div className="space-y-4">
                {[
                  { num:'01', text:'E-posta adresinizi girin', active:true },
                  { num:'02', text:'Gelen kutunuzu kontrol edin', active:false },
                  { num:'03', text:'Yeni şifrenizi belirleyin', active:false },
                ].map(step => (
                  <div key={step.num} className="flex items-center gap-4 text-left pl-1">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-black z-10"
                      style={{
                        background: step.active ? 'rgba(6,182,212,0.18)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${step.active ? 'rgba(6,182,212,0.4)' : 'rgba(255,255,255,0.06)'}`,
                        color: step.active ? '#22D3EE' : '#1e4a58',
                        boxShadow: step.active ? '0 0 12px rgba(6,182,212,0.2)' : 'none',
                      }}>
                      {step.num}
                    </div>
                    <p className="text-sm font-medium" style={{ color: step.active ? '#b8e6f0' : '#1e4a58' }}>
                      {step.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background:'#10B981' }} />
              <span className="text-xs" style={{ color:'#1e4a58' }}>Tüm sistemler aktif</span>
            </div>
            <div className="flex items-center gap-2">
              {['ri-shield-check-line','ri-lock-line','ri-cloud-line'].map(ic => (
                <div key={ic} className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                  <i className={`${ic} text-[10px]`} style={{ color:'#1e4a58' }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ════════ RIGHT — White Premium ════════ */}
      <div
        className="w-full lg:w-[480px] xl:w-[520px] flex-shrink-0 flex flex-col justify-center relative fp-right"
        style={{ background:'#ffffff', minHeight:'100vh' }}
      >
        {/* Subtle corner tints */}
        <div className="absolute top-0 right-0 pointer-events-none" style={{ width:'320px', height:'320px', background:'radial-gradient(circle, rgba(6,182,212,0.04) 0%, transparent 70%)', filter:'blur(50px)' }} />
        <div className="absolute bottom-0 left-0 pointer-events-none" style={{ width:'260px', height:'260px', background:'radial-gradient(circle, rgba(16,185,129,0.03) 0%, transparent 70%)', filter:'blur(50px)' }} />

        {/* Mobile brand */}
        <div className="lg:hidden px-7 pt-10 pb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background:'rgba(8,145,178,0.08)', border:'1px solid rgba(8,145,178,0.18)' }}>
              <img src={LOGO_URL} alt="ISG" className="w-5 h-5 object-contain" />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color:'#0f172a' }}>ISG Denetim</p>
              <p className="text-xs" style={{ color:'#94a3b8' }}>Şifre Sıfırlama</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 max-w-[380px] w-full mx-auto px-7 lg:px-0 pb-10 lg:pb-0">
          {!sent ? (
            <div className="fp-fadeup">
              {/* Header */}
              <div className="mb-9">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 text-[11px] font-semibold"
                  style={{ background:'rgba(8,145,178,0.07)', border:'1px solid rgba(8,145,178,0.15)', color:'#0891B2' }}>
                  <i className="ri-key-2-line text-xs" />
                  Şifre Sıfırlama
                </div>
                <h2 className="text-[2rem] font-black mb-2 leading-tight" style={{ color:'#0a1628', letterSpacing:'-0.04em' }}>
                  Şifremi Unuttum
                </h2>
                <p className="text-sm leading-relaxed" style={{ color:'#94a3b8' }}>
                  Hesabınıza kayıtlı e-posta adresini girin.<br />Sıfırlama bağlantısı göndereceğiz.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color:'#64748b', letterSpacing:'0.07em' }}>
                    E-posta Adresi
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
                      className="fp-white-input"
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-3 rounded-xl p-3.5"
                    style={{ background:'#fff5f5', border:'1.5px solid #fecaca' }}>
                    <i className="ri-error-warning-line text-sm flex-shrink-0 mt-0.5" style={{ color:'#ef4444' }} />
                    <p className="text-sm" style={{ color:'#dc2626' }}>{error}</p>
                  </div>
                )}

                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={loading}
                    className="fp-btn w-full py-4 rounded-xl font-bold text-sm text-white cursor-pointer whitespace-nowrap flex items-center justify-center gap-2.5"
                    style={{ opacity: loading ? 0.75 : 1, letterSpacing:'0.04em' }}
                  >
                    {loading ? (
                      <><i className="ri-loader-4-line text-base animate-spin" /><span>Gönderiliyor...</span></>
                    ) : (
                      <><i className="ri-send-plane-line text-base" /><span>Sıfırlama Bağlantısı Gönder</span></>
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

              <div className="text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm font-semibold transition-colors cursor-pointer"
                  style={{ color:'#94a3b8' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#0891B2'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; }}
                >
                  <i className="ri-arrow-left-line text-sm" />
                  Giriş sayfasına dön
                </Link>
              </div>
            </div>
          ) : (
            /* ── SUCCESS ── */
            <div className="text-center fp-pop">
              <div className="fp-pop w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6"
                style={{ background:'rgba(5,150,105,0.08)', border:'1.5px solid rgba(5,150,105,0.2)' }}>
                <i className="ri-mail-check-line text-3xl" style={{ color:'#059669' }} />
              </div>
              <h2 className="text-2xl font-extrabold mb-3" style={{ color:'#0a1628', letterSpacing:'-0.03em' }}>
                E-posta Gönderildi!
              </h2>
              <p className="text-sm leading-relaxed mb-1" style={{ color:'#374151' }}>
                <span className="font-bold" style={{ color:'#0891B2' }}>{email}</span> adresine
              </p>
              <p className="text-sm leading-relaxed mb-2" style={{ color:'#374151' }}>
                sıfırlama bağlantısı gönderdik.
              </p>
              <p className="text-xs leading-relaxed mb-8" style={{ color:'#b0bac5' }}>
                Spam klasörünü de kontrol etmeyi unutmayın.
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => { setSent(false); setEmail(''); }}
                  className="w-full py-3.5 rounded-xl font-semibold text-sm cursor-pointer whitespace-nowrap transition-all"
                  style={{ background:'#f9fafb', border:'1.5px solid #e8ecf0', color:'#374151' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#0891B2'; e.currentTarget.style.color = '#0891B2'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e8ecf0'; e.currentTarget.style.color = '#374151'; }}
                >
                  Farklı bir e-posta dene
                </button>
                <Link
                  to="/login"
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold text-sm cursor-pointer whitespace-nowrap transition-all"
                  style={{ color:'#b0bac5' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#0891B2'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#b0bac5'; }}
                >
                  <i className="ri-arrow-left-line" />
                  Giriş sayfasına dön
                </Link>
              </div>
            </div>
          )}

          <p className="text-center text-[11px] mt-10" style={{ color:'#d1d8e0' }}>
            ISG Denetim &copy; {new Date().getFullYear()} — Tüm hakları saklıdır
          </p>
        </div>
      </div>
    </div>
  );
}
