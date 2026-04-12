import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;

async function saSignIn(email: string, password: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return { data: null, error: 'E-posta veya şifre hatalı.' };
  const data = await res.json();
  return { data, error: null };
}

async function saGetProfile(userId: string, accessToken: string) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${userId}&select=is_super_admin&limit=1`,
    { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${accessToken}` } }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0] ?? null;
}

const FEATURES = [
  { icon: 'ri-building-4-line', label: 'Organizasyon Yönetimi', sub: 'Tüm müşterileri görüntüle ve yönet' },
  { icon: 'ri-line-chart-line', label: 'Abonelik & Gelir Takibi', sub: 'Bitiş tarihleri ve plan yönetimi' },
  { icon: 'ri-customer-service-2-line', label: 'Destek Sistemi', sub: 'Kullanıcı taleplerini yanıtla' },
  { icon: 'ri-shield-check-line', label: 'Güvenlik & Erişim', sub: 'Rol bazlı yetkilendirme kontrolü' },
];

export default function SuperAdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);
  const [mounted, setMounted] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const saToken = sessionStorage.getItem('sa_access_token');
    const saUserId = sessionStorage.getItem('sa_user_id');
    if (saToken && saUserId) {
      saGetProfile(saUserId, saToken).then(profile => {
        if (profile?.is_super_admin) navigate('/super-admin', { replace: true });
        else {
          sessionStorage.removeItem('sa_access_token');
          sessionStorage.removeItem('sa_user_id');
        }
      });
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) { setError('E-posta ve şifre gereklidir.'); return; }
    setLoading(true);
    try {
      const { data, error: signInErr } = await saSignIn(email.trim().toLowerCase(), password);
      if (signInErr || !data?.access_token || !data?.user?.id) {
        setError(signInErr || 'E-posta veya şifre hatalı.');
        setLoading(false);
        return;
      }
      const profile = await saGetProfile(data.user.id, data.access_token);
      if (!profile?.is_super_admin) {
        setError('Bu panele erişim yetkiniz bulunmuyor.');
        setLoading(false);
        return;
      }
      sessionStorage.setItem('sa_access_token', data.access_token);
      sessionStorage.setItem('sa_user_id', data.user.id);
      navigate('/super-admin', { replace: true });
    } catch {
      setError('Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#f8f9fc] overflow-hidden">

      {/* ── Sol koyu panel ── */}
      <div
        className="hidden lg:flex w-[480px] flex-shrink-0 flex-col relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0d1117 0%, #111827 60%, #0f172a 100%)' }}
      >
        {/* Arka plan desen */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Dekoratif glows */}
        <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)' }} />

        {/* Üst çizgi */}
        <div className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: 'linear-gradient(90deg, transparent, #6366f1 40%, #8b5cf6 70%, transparent)' }} />

        <div className="relative z-10 flex flex-col h-full px-10 py-10">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <i className="ri-shield-keyhole-fill text-white text-base"></i>
            </div>
            <div>
              <p className="text-white font-extrabold text-sm leading-none tracking-tight">ISG Denetim</p>
              <p className="text-slate-400 text-xs mt-0.5">Yönetim Sistemi</p>
            </div>
          </div>

          {/* Başlık */}
          <div className="mt-14">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5"
              style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
              <span className="text-indigo-400 text-xs font-semibold tracking-wide uppercase">Süper Admin Erişimi</span>
            </div>

            <h2 className="text-white font-black leading-[1.15] tracking-tight mb-4"
              style={{ fontSize: '2.1rem' }}>
              Kontrol<br />Merkezine<br />Hoş Geldiniz
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed max-w-[260px]">
              Tüm organizasyonları, abonelikleri ve destek taleplerini tek bir panelden yönetin.
            </p>
          </div>

          {/* Feature listesi */}
          <div className="mt-10 space-y-2.5 flex-1">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-300"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(99,102,241,0.18)' }}>
                  <i className={`${f.icon} text-indigo-400 text-sm`}></i>
                </div>
                <div>
                  <p className="text-white text-sm font-semibold leading-none">{f.label}</p>
                  <p className="text-slate-400 text-xs mt-1">{f.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Alt bilgi */}
          <div className="mt-8 pt-6 border-t border-white/[0.10] flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(99,102,241,0.25)' }}>
              <i className="ri-lock-fill text-indigo-300" style={{ fontSize: '10px' }}></i>
            </div>
            <p className="text-slate-400 text-xs leading-snug">
              Yalnızca yetkili sistem yöneticileri erişebilir
            </p>
          </div>
        </div>
      </div>

      {/* ── Sağ form paneli ── */}
      <div className="flex-1 flex items-center justify-center px-5 py-12 sm:px-10 relative">

        {/* Hafif arkaplan şekli */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] opacity-[0.035] pointer-events-none"
          style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 65%)' }} />

        <div
          className={`w-full max-w-[400px] transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <i className="ri-shield-keyhole-fill text-white text-sm"></i>
            </div>
            <div>
              <p className="text-slate-900 font-extrabold text-sm leading-none">ISG Denetim</p>
              <p className="text-slate-400 text-xs mt-0.5">Süper Admin Paneli</p>
            </div>
          </div>

          {/* Başlık */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                <i className="ri-shield-keyhole-line text-white" style={{ fontSize: '12px' }}></i>
              </div>
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Süper Admin</span>
            </div>
            <h1 className="text-[1.75rem] font-black text-slate-900 leading-tight tracking-tight">
              Yönetim Paneli
            </h1>
            <p className="text-slate-500 text-sm mt-1.5">Hesabınızla giriş yaparak devam edin</p>
          </div>

          {/* Form kartı */}
          <div
            className="rounded-2xl p-7"
            style={{ background: '#fff', border: '1px solid #e8eaef', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}
          >
            <form onSubmit={handleLogin} className="space-y-4">

              {/* E-posta */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 tracking-wide">
                  E-POSTA ADRESİ
                </label>
                <div className="relative">
                  <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center transition-colors ${focused === 'email' ? 'text-indigo-500' : 'text-slate-400'}`}>
                    <i className="ri-mail-line text-sm"></i>
                  </div>
                  <input
                    ref={emailRef}
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onFocus={() => setFocused('email')}
                    onBlur={() => setFocused(null)}
                    placeholder="admin@example.com"
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-slate-900 placeholder-slate-400 transition-all outline-none"
                    style={{
                      background: focused === 'email' ? '#f5f6ff' : '#f8f9fc',
                      border: focused === 'email' ? '1.5px solid #6366f1' : '1.5px solid #e8eaef',
                    }}
                  />
                </div>
              </div>

              {/* Şifre */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 tracking-wide">
                  ŞİFRE
                </label>
                <div className="relative">
                  <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center transition-colors ${focused === 'password' ? 'text-indigo-500' : 'text-slate-400'}`}>
                    <i className="ri-lock-line text-sm"></i>
                  </div>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused(null)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full pl-10 pr-11 py-3 rounded-xl text-sm text-slate-900 placeholder-slate-400 transition-all outline-none"
                    style={{
                      background: focused === 'password' ? '#f5f6ff' : '#f8f9fc',
                      border: focused === 'password' ? '1.5px solid #6366f1' : '1.5px solid #e8eaef',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
                  >
                    <i className={`${showPw ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`}></i>
                  </button>
                </div>
              </div>

              {/* Hata mesajı */}
              {error && (
                <div
                  className="flex items-start gap-2.5 p-3.5 rounded-xl text-sm"
                  style={{ background: '#fff5f5', border: '1px solid #fecaca', color: '#dc2626' }}
                >
                  <i className="ri-error-warning-fill flex-shrink-0 mt-0.5"></i>
                  <span>{error}</span>
                </div>
              )}

              {/* Giriş butonu */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl text-white font-bold text-sm cursor-pointer whitespace-nowrap flex items-center justify-center gap-2.5 transition-all disabled:opacity-60 mt-1"
                style={{
                  background: loading
                    ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                    : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  boxShadow: loading ? 'none' : '0 4px 14px rgba(99,102,241,0.35)',
                }}
              >
                {loading
                  ? <><i className="ri-loader-4-line animate-spin"></i> Doğrulanıyor...</>
                  : <><i className="ri-shield-check-line"></i> Güvenli Giriş Yap</>
                }
              </button>
            </form>
          </div>

          {/* Alt güvenlik notu */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <i className="ri-lock-2-line text-slate-400 text-xs"></i>
            <p className="text-slate-400 text-xs">
              256-bit şifreli güvenli bağlantı
            </p>
          </div>

          {/* Versiyon */}
          <p className="text-center text-slate-300 text-xs mt-2">
            ISG Denetim Admin Panel v2.0
          </p>
        </div>
      </div>
    </div>
  );
}
