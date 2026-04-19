import { useState, FormEvent } from 'react';
import { useAuth } from '@/store/AuthContext';

const FEATURE_CARDS = [
  {
    icon: 'ri-building-4-line',
    title: 'OSGB\nYÖNETİMİ',
    desc: 'Firma, uzman ve hekim yönetimi tek panelde',
  },
  {
    icon: 'ri-shield-check-line',
    title: 'FİRMA\nYÖNETİMİ',
    desc: 'Evrak, ekipman ve personel sağlık takibi',
  },
];

const SECURITY_ITEMS = [
  { icon: 'ri-shield-keyhole-line', label: 'SSL Şifreli' },
  { icon: 'ri-lock-2-line', label: '2FA Desteği' },
  { icon: 'ri-cloud-line', label: 'Bulut Tabanlı' },
];

export default function LoginPage() {
  const { login, isConfigured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });

  const emailError = touched.email && !email ? 'E-posta adresi zorunludur' : '';
  const passwordError = touched.password && !password ? 'Şifre zorunludur' : '';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!email || !password) return;
    if (!isConfigured) {
      setError('Sistem henüz yapılandırılmamış. Lütfen yöneticinizle iletişime geçin.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş başarısız. Bilgilerinizi kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ── Sol: Koyu Panel ── */}
      <div
        className="hidden lg:flex flex-col justify-between flex-1 p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d1f3c 50%, #0a2a2a 100%)' }}
      >
        {/* Arka plan dekoratif daireler */}
        <div
          className="absolute top-[-80px] left-[-80px] w-[400px] h-[400px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #00d4aa 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-[-100px] right-[-60px] w-[350px] h-[350px] rounded-full opacity-8"
          style={{ background: 'radial-gradient(circle, #00b4d8 0%, transparent 70%)' }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div
              className="w-10 h-10 flex items-center justify-center rounded-xl"
              style={{ backgroundColor: 'rgba(0,212,170,0.15)', border: '1px solid rgba(0,212,170,0.3)' }}
            >
              <i className="ri-shield-check-line text-lg" style={{ color: '#00d4aa' }} />
            </div>
            <div>
              <div className="text-white font-bold text-base tracking-tight">ISG Denetim</div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>İş Sağlığı &amp; Güvenliği</div>
            </div>
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8" style={{ border: '1px solid rgba(0,212,170,0.4)', backgroundColor: 'rgba(0,212,170,0.08)' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#00d4aa' }} />
            <span className="text-xs font-medium" style={{ color: '#00d4aa' }}>Tüm roller için tek platform</span>
          </div>

          {/* Ana başlık */}
          <div className="mb-10">
            <h1 className="text-4xl font-black leading-tight mb-4 text-white">
              İSG Süreçlerini<br />
              <span style={{ color: '#00d4aa' }}>Tek Platformda</span><br />
              Yönetin
            </h1>
            <p className="text-sm leading-relaxed max-w-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
              OSGB&apos;ler ve firmalar için geliştirilmiş sistem ile saha, evrak ve sağlık süreçlerini tek ekrandan takip edin.
            </p>
          </div>

          {/* Feature kartları */}
          <div className="grid grid-cols-2 gap-4 max-w-sm">
            {FEATURE_CARDS.map((card) => (
              <div
                key={card.title}
                className="p-5 rounded-2xl"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div
                  className="w-10 h-10 flex items-center justify-center rounded-xl mb-3"
                  style={{ backgroundColor: 'rgba(0,212,170,0.12)', border: '1px solid rgba(0,212,170,0.2)' }}
                >
                  <i className={`${card.icon} text-lg`} style={{ color: '#00d4aa' }} />
                </div>
                <div className="text-xs font-bold text-white mb-1 whitespace-pre-line leading-tight">{card.title}</div>
                <div className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>{card.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Alt */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#00d4aa' }} />
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Tüm sistemler aktif</span>
          </div>
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer"
                style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <i className={`text-xs ${i === 1 ? 'ri-twitter-x-line' : i === 2 ? 'ri-linkedin-line' : 'ri-global-line'}`} style={{ color: 'rgba(255,255,255,0.4)' }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sağ: Login ── */}
      <div
        className="flex flex-col justify-between w-full lg:w-[480px] shrink-0 px-8 py-10 lg:px-12 lg:py-12"
        style={{ backgroundColor: '#ffffff' }}
      >
        {/* Mobil logo */}
        <div className="flex lg:hidden items-center gap-3 mb-10">
          <div
            className="w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ backgroundColor: '#0a1628' }}
          >
            <i className="ri-shield-check-line text-base text-white" />
          </div>
          <span className="font-bold text-base" style={{ color: '#0a1628' }}>ISG Denetim</span>
        </div>

        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
          {/* Güvenli Giriş badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8 self-start" style={{ border: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#22c55e' }} />
            <span className="text-xs font-medium" style={{ color: '#374151' }}>Güvenli Giriş</span>
          </div>

          {/* Başlık */}
          <div className="mb-8">
            <h2 className="text-3xl font-black mb-2" style={{ color: '#0a1628' }}>Hoşgeldiniz</h2>
            <p className="text-sm" style={{ color: '#6b7280' }}>Hesabınıza giriş yaparak devam edin.</p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* E-posta */}
            <div>
              <label className="block text-xs font-semibold mb-2 tracking-wider uppercase" style={{ color: '#374151' }}>
                E-Posta
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
                  <i className="ri-mail-line text-sm" style={{ color: '#9ca3af' }} />
                </div>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="ornek@sirket.com"
                  value={email}
                  disabled={loading}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  className="w-full pl-10 pr-4 py-3 text-sm rounded-xl outline-none transition-all"
                  style={{
                    border: emailError ? '1.5px solid #ef4444' : '1.5px solid #00d4aa',
                    backgroundColor: '#f9fafb',
                    color: '#111827',
                  }}
                />
              </div>
              {emailError && (
                <p className="mt-1.5 text-xs flex items-center gap-1" style={{ color: '#ef4444' }}>
                  <i className="ri-error-warning-line" />{emailError}
                </p>
              )}
            </div>

            {/* Şifre */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold tracking-wider uppercase" style={{ color: '#374151' }}>
                  Şifre
                </label>
                <button type="button" className="text-xs cursor-pointer" style={{ color: '#00b4a0' }}>
                  Şifremi Unuttum
                </button>
              </div>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
                  <i className="ri-lock-2-line text-sm" style={{ color: '#9ca3af' }} />
                </div>
                <input
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  disabled={loading}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                  className="w-full pl-10 pr-11 py-3 text-sm rounded-xl outline-none transition-all"
                  style={{
                    border: passwordError ? '1.5px solid #ef4444' : '1.5px solid #e5e7eb',
                    backgroundColor: '#f9fafb',
                    color: '#111827',
                  }}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center cursor-pointer"
                  style={{ color: '#9ca3af' }}
                >
                  <i className={`text-sm ${showPass ? 'ri-eye-off-line' : 'ri-eye-line'}`} />
                </button>
              </div>
              {passwordError && (
                <p className="mt-1.5 text-xs flex items-center gap-1" style={{ color: '#ef4444' }}>
                  <i className="ri-error-warning-line" />{passwordError}
                </p>
              )}
            </div>

            {/* Beni Hatırla */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <div
                  className="w-4 h-4 rounded flex items-center justify-center cursor-pointer transition-all"
                  style={{
                    border: rememberMe ? '1.5px solid #0a1628' : '1.5px solid #d1d5db',
                    backgroundColor: rememberMe ? '#0a1628' : 'transparent',
                  }}
                  onClick={() => setRememberMe((v) => !v)}
                >
                  {rememberMe && <i className="ri-check-line text-white" style={{ fontSize: '10px' }} />}
                </div>
                <span className="text-sm" style={{ color: '#374151' }}>Beni Hatırla</span>
              </label>
              <span className="text-xs" style={{ color: '#9ca3af' }}>Bu oturuma özel</span>
            </div>

            {/* Hata */}
            {error && (
              <div
                className="flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm"
                style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}
              >
                <i className="ri-error-warning-line mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-2.5"
              style={{
                background: loading ? '#374151' : 'linear-gradient(135deg, #0a1628 0%, #0d2a3a 100%)',
                color: '#ffffff',
                opacity: loading ? 0.8 : 1,
              }}
            >
              {loading ? (
                <>
                  <i className="ri-loader-4-line animate-spin text-base" />
                  <span>Giriş yapılıyor...</span>
                </>
              ) : (
                <>
                  <i className="ri-login-circle-line text-base" />
                  <span>Giriş Yap</span>
                </>
              )}
            </button>
          </form>

          {/* Güvenli bağlantı */}
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px" style={{ backgroundColor: '#f3f4f6' }} />
              <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#d1d5db' }}>Güvenli Bağlantı</span>
              <div className="flex-1 h-px" style={{ backgroundColor: '#f3f4f6' }} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {SECURITY_ITEMS.map((item) => (
                <div
                  key={item.label}
                  className="flex flex-col items-center gap-2 py-3 rounded-xl"
                  style={{ backgroundColor: '#f9fafb', border: '1px solid #f3f4f6' }}
                >
                  <div className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ backgroundColor: '#f0fdf4' }}>
                    <i className={`${item.icon} text-sm`} style={{ color: '#16a34a' }} />
                  </div>
                  <span className="text-xs font-medium" style={{ color: '#6b7280' }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-xs" style={{ color: '#d1d5db' }}>
            ISG Denetim © {new Date().getFullYear()} — Tüm hakları saklıdır
          </p>
        </div>
      </div>
    </div>
  );
}
