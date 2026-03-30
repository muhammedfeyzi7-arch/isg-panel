import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../../store/AuthContext';
import { testSupabaseConnection, resolvedSupabaseUrl, resolvedKeyFormat } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/ae509f81-0883-42e1-9ed0-d08483f4284e_ChatGPT-Image-28-Mar-2026-23_09_27.png?v=f1e78272586c7081b6d13820591aa1f8';

const FEATURES = [
  {
    icon: 'ri-shield-check-line',
    title: 'Denetim Yönetimi',
    desc: 'İş güvenliği denetimlerini planlayın, yürütün ve takip edin.',
  },
  {
    icon: 'ri-file-list-3-line',
    title: 'Evrak Takibi',
    desc: 'Sertifika ve belgelerin geçerlilik sürelerini otomatik izleyin.',
  },
  {
    icon: 'ri-bar-chart-2-line',
    title: 'Raporlama',
    desc: 'Detaylı analiz ve raporlarla kurumsal uyumu kanıtlayın.',
  },
  {
    icon: 'ri-team-line',
    title: 'Ekip Yönetimi',
    desc: 'Personel, firma ve ekipman kayıtlarını tek merkezden yönetin.',
  },
];

const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  left: `${Math.floor((i * 37 + 13) % 100)}%`,
  top: `${Math.floor((i * 61 + 7) % 100)}%`,
  size: i % 3 === 0 ? 2.5 : i % 5 === 0 ? 1.5 : 1,
  delay: `${(i * 0.37) % 4}s`,
  duration: `${3 + (i * 0.43) % 4}s`,
  opacity: i % 4 === 0 ? 0.5 : i % 3 === 0 ? 0.3 : 0.18,
}));

export default function LoginPage() {
  const { login, connectionError } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [connTest, setConnTest] = useState<{ tested: boolean; ok: boolean; error?: string; detail?: string } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  // Run a connection test on mount so production CORS/network failures are immediately visible
  useEffect(() => {
    let cancelled = false;
    testSupabaseConnection().then(result => {
      if (cancelled) return;
      console.log('[ISG:Login] Connection test result:', result);
      setConnTest({ tested: true, ...result });
    });
    return () => { cancelled = true; };
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

  // Show the most relevant error: auth connectionError > login form error
  const displayError = connectionError || error;
  const isCorsError = !!connectionError || (!!error && (error.includes('Failed to fetch') || error.includes('CORS') || error.includes('Ağ Hatası')));

  return (
    <div
      className="min-h-screen flex relative overflow-hidden"
      style={{ background: 'linear-gradient(150deg, #040C1A 0%, #061628 45%, #050E1C 75%, #030A15 100%)' }}
    >
      {/* ── Connection status banner ── */}
      {connTest && !connTest.ok && (
        <div className="fixed top-0 left-0 right-0 z-50 px-4 py-3" style={{ background: 'rgba(239,68,68,0.92)', backdropFilter: 'blur(8px)' }}>
          <div className="max-w-3xl mx-auto">
            <div className="flex items-start gap-3">
              <i className="ri-error-warning-line text-white text-lg flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-bold">Supabase Bağlantı Hatası: {connTest.error}</p>
                <p className="text-red-100 text-xs mt-1 leading-relaxed break-words">{connTest.detail}</p>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-red-200">
                  <span>URL: <code className="text-white">{resolvedSupabaseUrl || '(boş)'}</code></span>
                  <span>Anahtar: <code className="text-white">{resolvedKeyFormat}</code></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {connTest && connTest.ok && (
        <div className="fixed top-0 left-0 right-0 z-50 px-4 py-2" style={{ background: 'rgba(16,185,129,0.85)', backdropFilter: 'blur(8px)' }}>
          <p className="text-center text-white text-xs font-medium">
            <i className="ri-checkbox-circle-line mr-1" /> Supabase bağlantısı başarılı — {resolvedSupabaseUrl}
          </p>
        </div>
      )}
      <style>{`
        @keyframes floatParticle { 0%,100%{transform:translateY(0) scale(1);opacity:var(--op)}50%{transform:translateY(-18px) scale(1.3);opacity:calc(var(--op)*1.6)} }
        @keyframes loginFadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes glowPulse { 0%,100%{opacity:0.7} 50%{opacity:1} }
        @keyframes featureFadeIn { from{opacity:0;transform:translateX(-16px)} to{opacity:1;transform:translateX(0)} }
        .anim-card { animation: loginFadeUp 0.65s cubic-bezier(0.22,0.61,0.36,1) 0.1s both }
        .anim-left { animation: loginFadeUp 0.55s cubic-bezier(0.22,0.61,0.36,1) 0.05s both }
        .anim-feat-0 { animation: featureFadeIn 0.5s ease 0.25s both }
        .anim-feat-1 { animation: featureFadeIn 0.5s ease 0.38s both }
        .anim-feat-2 { animation: featureFadeIn 0.5s ease 0.51s both }
        .anim-feat-3 { animation: featureFadeIn 0.5s ease 0.64s both }
        .isg-input::placeholder { color: rgba(180,220,230,0.38); }
        .isg-input::-webkit-input-placeholder { color: rgba(180,220,230,0.38); }
        .isg-input::-moz-placeholder { color: rgba(180,220,230,0.38); }
      `}</style>

      {/* Background glow */}
      <div className="fixed pointer-events-none" style={{ top:'-80px',left:'30%',transform:'translateX(-50%)',width:'800px',height:'500px',background:'radial-gradient(ellipse, rgba(6,182,212,0.12) 0%, transparent 70%)',filter:'blur(60px)',animation:'glowPulse 6s ease-in-out infinite' }} />
      <div className="fixed pointer-events-none" style={{ bottom:'-100px',right:'10%',width:'600px',height:'400px',background:'radial-gradient(ellipse, rgba(16,185,129,0.07) 0%, transparent 70%)',filter:'blur(50px)' }} />

      {/* Grid overlay */}
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage:'linear-gradient(rgba(6,182,212,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(6,182,212,0.03) 1px,transparent 1px)',backgroundSize:'56px 56px' }} />

      {/* Particles */}
      {mounted && PARTICLES.map(p => (
        <div key={p.id} className="fixed pointer-events-none rounded-full" style={{
          left: p.left, top: p.top, width: `${p.size}px`, height: `${p.size}px`,
          background: p.id % 3 === 0 ? '#06B6D4' : '#10B981',
          boxShadow: `0 0 ${p.size * 4}px rgba(6,182,212,0.7)`,
          // @ts-expect-error custom css var
          '--op': p.opacity,
          animation: `floatParticle ${p.duration} ease-in-out ${p.delay} infinite`,
          opacity: p.opacity,
        } as React.CSSProperties} />
      ))}

      {/* ── Left panel — feature showcase (hidden on mobile) ── */}
      <div className={`hidden lg:flex flex-col justify-between flex-1 px-14 py-14 relative z-10 ${mounted ? 'anim-left' : 'opacity-0'}`}>
        {/* Logo + brand */}
        <div className="flex items-center gap-3.5">
          <div className="relative w-11 h-11 flex items-center justify-center flex-shrink-0">
            <div className="absolute inset-0 rounded-xl pointer-events-none" style={{ background:'radial-gradient(circle,rgba(6,182,212,0.5) 0%,transparent 75%)',filter:'blur(10px)',transform:'scale(1.6)',animation:'glowPulse 3.5s ease-in-out infinite' }} />
            <img src={LOGO_URL} alt="ISG" style={{ width:'44px',height:'44px',objectFit:'contain',position:'relative',zIndex:1,filter:'drop-shadow(0 0 10px rgba(6,182,212,0.6))' }} />
          </div>
          <div>
            <div className="font-bold text-lg leading-none" style={{ color:'#E2F8FB',letterSpacing:'-0.02em' }}>ISG Denetim</div>
            <div className="text-xs mt-0.5 font-medium" style={{ color:'#3A8A9E' }}>Yönetim Platformu</div>
          </div>
        </div>

        {/* Main copy */}
        <div className="max-w-md">
          <h2 className="text-4xl font-bold leading-tight mb-5" style={{ color:'#E2F8FB',letterSpacing:'-0.03em' }}>
            İş Güvenliğini<br />
            <span style={{ background:'linear-gradient(90deg,#06B6D4,#10B981)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent' }}>
              Dijitale Taşıyın
            </span>
          </h2>
          <p className="text-base leading-relaxed mb-10" style={{ color:'#4A7B8C' }}>
            Denetimlerinizi, belgelerinizi ve personelinizi tek bir platformdan güvenle yönetin.
          </p>

          {/* Feature list */}
          <div className="space-y-4">
            {FEATURES.map((f, i) => (
              <div key={f.title} className={`flex items-start gap-4 ${mounted ? `anim-feat-${i}` : 'opacity-0'}`}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background:'rgba(6,182,212,0.1)',border:'1px solid rgba(6,182,212,0.18)' }}>
                  <i className={`${f.icon} text-base`} style={{ color:'#06B6D4' }} />
                </div>
                <div>
                  <div className="text-sm font-semibold mb-0.5" style={{ color:'#C8EEF4' }}>{f.title}</div>
                  <div className="text-xs leading-relaxed" style={{ color:'#3A6D7D' }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom trust note */}
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background:'#10B981' }} />
          <p className="text-xs" style={{ color:'#2E6A7A' }}>Türkiye'deki iş güvenliği profesyonellerine özel platform</p>
        </div>
      </div>

      {/* ── Right panel — login form ── */}
      <div className={`flex items-center justify-center w-full lg:w-[480px] flex-shrink-0 px-6 py-12 lg:px-12 relative z-10 ${mounted ? 'anim-card' : 'opacity-0'}`}
        style={{ borderLeft:'1px solid rgba(6,182,212,0.06)' }}>

        {/* Mobile-only logo */}
        <div className="lg:hidden absolute top-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <img src={LOGO_URL} alt="ISG" style={{ width:'44px',height:'44px',objectFit:'contain',filter:'drop-shadow(0 0 10px rgba(6,182,212,0.6))' }} />
          <div className="text-base font-bold" style={{ color:'#E2F8FB' }}>ISG Denetim</div>
        </div>

        <div className="w-full max-w-sm mt-14 lg:mt-0">
          {/* Card */}
          <div style={{ borderRadius:'20px',overflow:'hidden',background:'rgba(8,22,42,0.75)',border:'1px solid rgba(6,182,212,0.14)',backdropFilter:'blur(32px)',boxShadow:'0 40px 100px rgba(0,0,0,0.7)' }}>
            {/* Top accent line */}
            <div style={{ height:'2px',background:'linear-gradient(90deg,transparent 0%,rgba(6,182,212,0.7) 30%,rgba(16,185,129,0.6) 65%,transparent 100%)' }} />

            <div className="p-8 sm:p-9">
              <div className="mb-7">
                <h1 className="text-xl font-bold mb-2" style={{ color:'#E8F9FC',letterSpacing:'-0.02em' }}>Hesabınıza giriş yapın</h1>
                <p className="text-sm leading-relaxed" style={{ color:'#3D7E90' }}>Herhangi bir e-posta ve en az 4 karakterli şifre ile giriş yapabilirsiniz.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold mb-2" style={{ color:'#5BA8BC' }}>
                    E-posta Adresi
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center pointer-events-none" style={{ color:'#4A8EA0' }}>
                      <i className="ri-mail-line text-sm" />
                    </span>
                    <input
                      type="email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setError(null); }}
                      placeholder="ornek@sirket.com"
                      autoComplete="email"
                      className="isg-input"
                      style={{
                        width:'100%',
                        paddingLeft:'40px',
                        paddingRight:'14px',
                        paddingTop:'11px',
                        paddingBottom:'11px',
                        background:'rgba(255,255,255,0.06)',
                        border:'1px solid rgba(6,182,212,0.18)',
                        borderRadius:'10px',
                        color:'#FFFFFF',
                        fontSize:'14px',
                        outline:'none',
                        transition:'border-color 0.2s, box-shadow 0.2s, background 0.2s',
                      }}
                      onFocus={e => {
                        e.target.style.background = 'rgba(6,182,212,0.08)';
                        e.target.style.borderColor = 'rgba(6,182,212,0.5)';
                        e.target.style.boxShadow = '0 0 0 3px rgba(6,182,212,0.1)';
                      }}
                      onBlur={e => {
                        e.target.style.background = 'rgba(255,255,255,0.06)';
                        e.target.style.borderColor = 'rgba(6,182,212,0.18)';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold" style={{ color:'#5BA8BC' }}>Şifre</label>
                    <span className="text-xs" style={{ color:'#3A6D7D' }}>En az 4 karakter</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center pointer-events-none" style={{ color:'#4A8EA0' }}>
                      <i className="ri-lock-line text-sm" />
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => { setPassword(e.target.value); setError(null); }}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="isg-input"
                      style={{
                        width:'100%',
                        paddingLeft:'40px',
                        paddingRight:'44px',
                        paddingTop:'11px',
                        paddingBottom:'11px',
                        background:'rgba(255,255,255,0.06)',
                        border:'1px solid rgba(6,182,212,0.18)',
                        borderRadius:'10px',
                        color:'#FFFFFF',
                        fontSize:'14px',
                        outline:'none',
                        transition:'border-color 0.2s, box-shadow 0.2s, background 0.2s',
                      }}
                      onFocus={e => {
                        e.target.style.background = 'rgba(6,182,212,0.08)';
                        e.target.style.borderColor = 'rgba(6,182,212,0.5)';
                        e.target.style.boxShadow = '0 0 0 3px rgba(6,182,212,0.1)';
                      }}
                      onBlur={e => {
                        e.target.style.background = 'rgba(255,255,255,0.06)';
                        e.target.style.borderColor = 'rgba(6,182,212,0.18)';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center cursor-pointer"
                      style={{ color:'#4A8EA0',transition:'color 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#A5DEE8'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#4A8EA0'; }}
                    >
                      <i className={`${showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`} />
                    </button>
                  </div>
                </div>

                {/* Error */}
                {displayError && (
                  <div className="flex items-start gap-3 rounded-xl p-3.5" style={{ background: isCorsError ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)', border: `1px solid ${isCorsError ? 'rgba(239,68,68,0.35)' : 'rgba(239,68,68,0.2)'}` }}>
                    <i className={`${isCorsError ? 'ri-wifi-off-line' : 'ri-error-warning-line'} text-sm flex-shrink-0 mt-0.5`} style={{ color: '#F87171' }} />
                    <div>
                      <p className="text-sm leading-relaxed" style={{ color: '#FCA5A5' }}>{displayError.split('\n')[0]}</p>
                      {isCorsError && (
                        <p className="text-xs mt-1.5 leading-relaxed" style={{ color: '#FDA4A4' }}>
                          Supabase Dashboard → Authentication → URL Configuration → <strong>Site URL</strong> ve <strong>Redirect URLs</strong> alanlarına yayın domaininizi ekleyin.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Submit */}
                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl font-semibold text-sm cursor-pointer whitespace-nowrap flex items-center justify-center gap-2.5"
                    style={{
                      background: loading
                        ? 'rgba(6,182,212,0.2)'
                        : 'linear-gradient(135deg, #0891B2 0%, #0E7490 50%, #06B6D4 100%)',
                      boxShadow: loading ? 'none' : '0 4px 24px rgba(6,182,212,0.35)',
                      color: loading ? 'rgba(255,255,255,0.45)' : '#ffffff',
                      opacity: loading ? 0.75 : 1,
                      transition:'all 0.2s ease',
                      border:'1px solid rgba(6,182,212,0.22)',
                    }}
                  >
                    {loading
                      ? <><i className="ri-loader-4-line text-base animate-spin" /><span>Giriş yapılıyor...</span></>
                      : <><i className="ri-login-circle-line text-base" /><span>Giriş Yap</span></>}
                  </button>
                </div>
              </form>

              {/* Divider + trust */}
              <div className="mt-7 pt-6" style={{ borderTop:'1px solid rgba(6,182,212,0.08)' }}>
                <div className="flex items-center justify-center gap-5">
                  {[
                    { icon:'ri-shield-check-line', label:'Güvenli Bağlantı' },
                    { icon:'ri-database-2-line', label:'Veri Korumalı' },
                    { icon:'ri-24-hours-line', label:'7/24 Erişim' },
                  ].map(item => (
                    <div key={item.label} className="flex flex-col items-center gap-1">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background:'rgba(6,182,212,0.08)',border:'1px solid rgba(6,182,212,0.12)' }}>
                        <i className={`${item.icon} text-xs`} style={{ color:'#3A8EA0' }} />
                      </div>
                      <span className="text-xs" style={{ color:'#2E6070' }}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Mobile features (sm only) */}
          <div className="lg:hidden mt-8 grid grid-cols-2 gap-3">
            {FEATURES.map(f => (
              <div key={f.title} className="flex items-start gap-2.5 p-3 rounded-xl"
                style={{ background:'rgba(6,182,212,0.04)',border:'1px solid rgba(6,182,212,0.1)' }}>
                <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ background:'rgba(6,182,212,0.1)' }}>
                  <i className={`${f.icon} text-xs`} style={{ color:'#06B6D4' }} />
                </div>
                <div className="text-xs font-semibold leading-tight pt-0.5" style={{ color:'#6BBFCE' }}>{f.title}</div>
              </div>
            ))}
          </div>

          <p className="text-center text-xs mt-6" style={{ color:'#1E4D5C' }}>
            ISG Denetim Yönetim Sistemi &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
