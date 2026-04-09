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
    <div className="min-h-screen flex" style={{ background: '#F8FAFC' }}>
      {/* Sol panel */}
      <div className="hidden lg:flex w-[480px] flex-shrink-0 flex-col items-center justify-center relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #1E293B 0%, #0F172A 100%)' }}>
        {/* Dekoratif arka plan */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: 'linear-gradient(90deg, #F59E0B, #F97316)' }} />

        <div className="relative z-10 px-12 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #F59E0B, #F97316)' }}>
              <i className="ri-shield-keyhole-fill text-white text-base"></i>
            </div>
            <span className="text-white font-bold text-lg">ISG Denetim</span>
          </div>

          <h2 className="text-white text-3xl font-black mb-3 leading-tight">
            Süper Admin<br />Paneli
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-10">
            Tüm organizasyonları, abonelikleri ve destek taleplerini tek yerden yönetin.
          </p>

          <div className="space-y-3">
            {[
              { icon: 'ri-building-2-line', title: 'Organizasyon Yönetimi', desc: 'Tüm müşterileri görüntüle ve yönet' },
              { icon: 'ri-calendar-check-line', title: 'Abonelik Takibi', desc: 'Bitiş tarihlerini kontrol et' },
              { icon: 'ri-customer-service-2-line', title: 'Destek Sistemi', desc: 'Kullanıcı taleplerini yanıtla' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(245,158,11,0.15)' }}>
                  <i className={`${item.icon} text-amber-400 text-sm`}></i>
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">{item.title}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sağ form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-[400px]">
          {/* Mobil logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #F59E0B, #F97316)' }}>
              <i className="ri-shield-keyhole-fill text-white text-base"></i>
            </div>
            <span className="text-slate-900 font-bold text-lg">ISG Denetim Admin</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-black text-slate-900 mb-1">Giriş Yap</h1>
            <p className="text-slate-500 text-sm">Süper admin hesabınızla devam edin</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">E-posta</label>
              <div className="relative">
                <i className="ri-mail-line absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-400/15 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Şifre</label>
              <div className="relative">
                <i className="ri-lock-line absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-400/15 transition-all"
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

            {error && (
              <div className="flex items-center gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                <i className="ri-error-warning-line flex-shrink-0"></i>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-white font-bold text-sm cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 transition-all disabled:opacity-60 mt-2"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #F97316)' }}
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
