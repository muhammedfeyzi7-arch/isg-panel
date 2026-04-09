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
    <div className="min-h-screen bg-[#0a0a0f] flex">
      {/* Sol dekoratif panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center">
        {/* Gradient arka plan */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f0f1a] via-[#0a0a0f] to-[#0f0f1a]" />
        {/* Dekoratif daireler */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-amber-500/5 blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 rounded-full bg-orange-500/5 blur-3xl" />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        {/* İçerik */}
        <div className="relative z-10 px-12 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/20 mb-8">
            <i className="ri-shield-keyhole-fill text-amber-400 text-3xl"></i>
          </div>
          <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">
            ISG Denetim
          </h2>
          <p className="text-slate-400 text-base leading-relaxed max-w-xs mx-auto">
            Organizasyonlarınızı yönetin, abonelikleri takip edin.
          </p>
          <div className="mt-10 flex flex-col gap-3 text-left max-w-xs mx-auto">
            {[
              { icon: 'ri-building-2-line', text: 'Tüm organizasyonları görüntüle' },
              { icon: 'ri-calendar-check-line', text: 'Abonelik tarihlerini yönet' },
              { icon: 'ri-user-add-line', text: 'Yeni müşteri hesabı oluştur' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-slate-400 text-sm">
                <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/15 flex-shrink-0">
                  <i className={`${item.icon} text-amber-400 text-xs`}></i>
                </div>
                {item.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sağ login paneli */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobil logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-3">
              <i className="ri-shield-keyhole-fill text-amber-400 text-2xl"></i>
            </div>
            <h1 className="text-xl font-bold text-white">ISG Denetim Admin</h1>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white tracking-tight">Hoş geldiniz</h1>
            <p className="text-slate-500 text-sm mt-1">Süper admin paneline giriş yapın</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                E-posta
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-slate-500">
                  <i className="ri-mail-line text-sm"></i>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  autoComplete="email"
                  className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-amber-500/50 text-white placeholder-slate-600 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-all"
                />
              </div>
            </div>

            {/* Şifre */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Şifre
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-slate-500">
                  <i className="ri-lock-line text-sm"></i>
                </div>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-amber-500/50 text-white placeholder-slate-600 rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-slate-500 hover:text-slate-300 cursor-pointer transition-colors"
                >
                  <i className={showPw ? 'ri-eye-off-line text-sm' : 'ri-eye-line text-sm'}></i>
                </button>
              </div>
            </div>

            {/* Hata */}
            {error && (
              <div className="flex items-center gap-2.5 bg-red-500/8 border border-red-500/15 text-red-400 text-sm rounded-xl px-4 py-3">
                <i className="ri-error-warning-line flex-shrink-0 text-base"></i>
                <span>{error}</span>
              </div>
            )}

            {/* Buton */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-sm transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <><i className="ri-loader-4-line animate-spin"></i> Giriş yapılıyor...</>
              ) : (
                <>Giriş Yap <i className="ri-arrow-right-line"></i></>
              )}
            </button>
          </form>

          <p className="text-center text-slate-700 text-xs mt-8">
            Yalnızca yetkili sistem yöneticileri erişebilir
          </p>
        </div>
      </div>
    </div>
  );
}
