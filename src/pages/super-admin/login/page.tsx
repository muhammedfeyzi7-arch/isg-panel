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
    // Sadece sessionStorage'daki SA token'ını kontrol et
    const saToken = sessionStorage.getItem('sa_access_token');
    const saUserId = sessionStorage.getItem('sa_user_id');
    if (saToken && saUserId) {
      // Token var, doğrula
      supabase.auth.getUser(saToken).then(({ data: { user }, error }) => {
        if (!error && user && user.id === saUserId) {
          supabase.from('profiles').select('is_super_admin').eq('user_id', user.id).maybeSingle()
            .then(({ data }) => {
              if (data?.is_super_admin) navigate('/super-admin', { replace: true });
            });
        } else {
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
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInErr || !data.user || !data.session) {
        setError('E-posta veya şifre hatalı.');
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_super_admin')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (!profile?.is_super_admin) {
        // Super admin değil — Supabase session'ını temizle, token kaydetme
        await supabase.auth.signOut({ scope: 'local' });
        setError('Bu panele erişim yetkiniz bulunmuyor.');
        setLoading(false);
        return;
      }

      // Sadece sessionStorage'a kaydet — localStorage'daki normal kullanıcı session'ına dokunma
      // Tarayıcı kapanınca sessionStorage temizlenir (güvenli)
      sessionStorage.setItem('sa_access_token', data.session.access_token);
      sessionStorage.setItem('sa_user_id', data.user.id);

      // Supabase'in kendi localStorage session'ını temizle (normal kullanıcıyla karışmasın)
      await supabase.auth.signOut({ scope: 'local' });

      navigate('/super-admin', { replace: true });
    } catch {
      setError('Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sol panel - sadece desktop */}
      <div className="hidden lg:flex w-[460px] flex-shrink-0 flex-col relative overflow-hidden bg-slate-900">
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-indigo-500" />

        {/* İçerik */}
        <div className="relative z-10 flex flex-col h-full px-10 py-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-auto">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-600">
              <i className="ri-shield-keyhole-fill text-white text-sm"></i>
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-none">ISG Denetim</p>
              <p className="text-slate-500 text-xs mt-0.5">Yönetim Sistemi</p>
            </div>
          </div>

          {/* Ana içerik */}
          <div className="py-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
              <span className="text-indigo-400 text-xs font-semibold">Süper Admin Erişimi</span>
            </div>
            <h2 className="text-white text-3xl font-black mb-3 leading-tight tracking-tight">
              Yönetim<br />Paneli
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Tüm organizasyonları, abonelikleri ve destek taleplerini tek yerden yönetin.
            </p>
          </div>

          {/* Özellik listesi */}
          <div className="space-y-2.5 mb-auto">
            {[
              { icon: 'ri-building-2-line', title: 'Organizasyon Yönetimi', desc: 'Tüm müşterileri görüntüle ve yönet' },
              { icon: 'ri-calendar-check-line', title: 'Abonelik Takibi', desc: 'Bitiş tarihlerini kontrol et' },
              { icon: 'ri-customer-service-2-line', title: 'Destek Sistemi', desc: 'Kullanıcı taleplerini yanıtla' },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3.5 p-3.5 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-indigo-500/15">
                  <i className={`${item.icon} text-indigo-400 text-sm`}></i>
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">{item.title}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-white/[0.07]">
            <p className="text-slate-600 text-xs">
              Yalnızca yetkili sistem yöneticileri erişebilir
            </p>
          </div>
        </div>
      </div>

      {/* Sağ form */}
      <div className="flex-1 flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[400px]">

          {/* Mobil logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-600">
              <i className="ri-shield-keyhole-fill text-white text-sm"></i>
            </div>
            <div>
              <p className="text-slate-900 font-bold text-sm leading-none">ISG Denetim</p>
              <p className="text-slate-400 text-xs mt-0.5">Süper Admin Paneli</p>
            </div>
          </div>

          {/* Başlık */}
          <div className="mb-8">
            <h1 className="text-2xl font-black text-slate-900 mb-1.5 tracking-tight">Giriş Yap</h1>
            <p className="text-slate-500 text-sm">Süper admin hesabınızla devam edin</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* E-posta */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">E-posta</label>
              <div className="relative">
                <i className="ri-mail-line absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/15 transition-all"
                />
              </div>
            </div>

            {/* Şifre */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Şifre</label>
              <div className="relative">
                <i className="ri-lock-line absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/15 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
                >
                  <i className={`${showPw ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`}></i>
                </button>
              </div>
            </div>

            {/* Hata */}
            {error && (
              <div className="flex items-center gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                <i className="ri-error-warning-line flex-shrink-0"></i>
                {error}
              </div>
            )}

            {/* Giriş butonu */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-white font-bold text-sm cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 transition-all disabled:opacity-60 bg-indigo-600 hover:bg-indigo-700 mt-2"
            >
              {loading
                ? <><i className="ri-loader-4-line animate-spin"></i> Giriş yapılıyor...</>
                : <><i className="ri-login-box-line"></i> Giriş Yap</>
              }
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
