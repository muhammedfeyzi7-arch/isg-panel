import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function SuperAdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data } = await supabase
        .from('profiles')
        .select('is_super_admin')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (data?.is_super_admin) navigate('/super-admin', { replace: true });
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) { setError('E-posta ve şifre gereklidir.'); return; }
    setLoading(true);
    try {
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInErr || !data.user) { setError('E-posta veya şifre hatalı.'); setLoading(false); return; }
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_super_admin')
        .eq('user_id', data.user.id)
        .maybeSingle();
      if (!profile?.is_super_admin) {
        await supabase.auth.signOut({ scope: 'local' });
        setError('Bu panele erişim yetkiniz bulunmuyor.');
        setLoading(false);
        return;
      }
      navigate('/super-admin', { replace: true });
    } catch {
      setError('Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sol dekoratif panel */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {/* Subtle pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        {/* Glow circles */}
        <div className="absolute top-1/3 left-1/3 w-72 h-72 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-56 h-56 rounded-full bg-orange-400/8 blur-3xl" />

        {/* İçerik */}
        <div className="relative z-10 px-14 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 mb-8 shadow-2xl shadow-amber-500/30">
            <i className="ri-shield-keyhole-fill text-white text-3xl"></i>
          </div>
          <h2 className="text-3xl font-black text-white mb-3 tracking-tight">
            ISG Denetim
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed max-w-xs mx-auto mb-10">
            Tüm organizasyonları tek panelden yönetin.
          </p>

          <div className="flex flex-col gap-3 text-left max-w-xs mx-auto">
            {[
              { icon: 'ri-building-2-line', text: 'Organizasyon yönetimi', sub: 'Tüm müşterileri görüntüle' },
              { icon: 'ri-calendar-check-line', text: 'Abonelik takibi', sub: 'Bitiş tarihlerini yönet' },
              { icon: 'ri-customer-service-2-line', text: 'Destek sistemi', sub: 'Talepleri yanıtla' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/5 border border-white/8">
                <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-amber-400/15 border border-amber-400/20 flex-shrink-0">
                  <i className={`${item.icon} text-amber-400 text-sm`}></i>
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">{item.text}</p>
                  <p className="text-slate-500 text-xs">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sağ login paneli */}
      <div className="w-full lg:w-[55%] flex items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-sm">
          {/* Mobil logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 mb-3 shadow-lg shadow-amber-400/25">
              <i className="ri-shield-keyhole-fill text-white text-2xl"></i>
            </div>
            <h1 className="text-xl font-black text-slate-900">ISG Denetim Admin</h1>
          </div>

          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              <span className="text-amber-700 text-xs font-semibold">Süper Admin Paneli</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Hoş geldiniz</h1>
            <p className="text-slate-500 text-sm mt-1.5">Hesabınıza giriş yapın</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                E-posta
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-slate-400">
                  <i className="ri-mail-line text-sm"></i>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  autoComplete="email"
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-amber-400 focus:bg-white text-slate-900 placeholder-slate-400 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-all"
                />
              </div>
            </div>

            {/* Şifre */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Şifre
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-slate-400">
                  <i className="ri-lock-line text-sm"></i>
                </div>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-amber-400 focus:bg-white text-slate-900 placeholder-slate-400 rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
                >
                  <i className={showPw ? 'ri-eye-off-line text-sm' : 'ri-eye-line text-sm'}></i>
                </button>
              </div>
            </div>

            {/* Hata */}
            {error && (
              <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                <i className="ri-error-warning-line flex-shrink-0 text-base"></i>
                <span>{error}</span>
              </div>
            )}

            {/* Buton */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 disabled:opacity-50 text-white font-bold rounded-xl py-3 text-sm transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 mt-2 shadow-lg shadow-amber-400/25"
            >
              {loading ? (
                <><i className="ri-loader-4-line animate-spin"></i> Giriş yapılıyor...</>
              ) : (
                <>Giriş Yap <i className="ri-arrow-right-line"></i></>
              )}
            </button>
          </form>

          <p className="text-center text-slate-400 text-xs mt-8">
            Yalnızca yetkili sistem yöneticileri erişebilir
          </p>
        </div>
      </div>
    </div>
  );
}
