import { useState, useEffect } from 'react';
import { useAuth } from '../../store/AuthContext';
import { useOrganization } from '../../hooks/useOrganization';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518';

type Tab = 'create' | 'join';

export default function OnboardingPage() {
  const { user, logout } = useAuth();
  const { org, loading, createOrg, joinOrg } = useOrganization(user);
  const [tab, setTab] = useState<Tab>('create');
  const [orgName, setOrgName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const hasLegacy = Boolean(user && localStorage.getItem(`isg_data_${user.id}`));

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!loading && org) {
      const nav = (window as unknown as { REACT_APP_NAVIGATE?: (path: string) => void }).REACT_APP_NAVIGATE;
      if (nav) nav('/');
    }
  }, [org, loading]);

  const handleCreate = async () => {
    if (!orgName.trim()) { setError('Organizasyon adı zorunludur.'); return; }
    if (!user) return;
    setSubmitting(true);
    setError(null);
    const result = await createOrg(orgName.trim(), user.id);
    if (result.error) setError(result.error);
    setSubmitting(false);
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) { setError('Davet kodu zorunludur.'); return; }
    setSubmitting(true);
    setError(null);
    const result = await joinOrg(inviteCode.trim());
    if (result.error) setError(result.error);
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 30%, #f0fdf4 60%, #fafafa 100%)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)' }}>
            <img src={LOGO_URL} alt="ISG" className="w-9 h-9 object-contain" />
          </div>
          <div className="flex items-center gap-2" style={{ color: '#64748b' }}>
            <i className="ri-loader-4-line text-lg animate-spin" />
            <span className="text-sm">Yükleniyor...</span>
          </div>
        </div>
      </div>
    );
  }

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
        @keyframes floatUp {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-8px); }
        }

        .slide-left  { animation: fadeSlideLeft  0.75s cubic-bezier(0.22,0.61,0.36,1) forwards; }
        .slide-right { animation: fadeSlideRight 0.75s cubic-bezier(0.22,0.61,0.36,1) 0.1s both; }
        .glow-pulse  { animation: pulseGlow 4s ease-in-out infinite; }
        .float-anim  { animation: floatUp 5s ease-in-out infinite; }

        .onb-input {
          transition: all 0.2s ease;
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          color: #1e293b;
          font-size: 14px;
          width: 100%;
          outline: none;
          padding: 14px 16px;
        }
        .onb-input::placeholder { color: #94a3b8; }
        .onb-input:focus {
          border-color: #06B6D4;
          box-shadow: 0 0 0 4px rgba(6,182,212,0.12);
          background: #f0fdff;
        }

        .create-btn {
          background: linear-gradient(135deg, #0891B2 0%, #06B6D4 50%, #22D3EE 100%);
          background-size: 200% auto;
          transition: all 0.3s ease;
          box-shadow: 0 4px 24px rgba(6,182,212,0.35);
        }
        .create-btn:hover:not(:disabled) {
          background-position: right center;
          box-shadow: 0 8px 36px rgba(6,182,212,0.5);
          transform: translateY(-2px);
        }
        .join-btn {
          background: linear-gradient(135deg, #059669 0%, #10B981 50%, #34D399 100%);
          background-size: 200% auto;
          transition: all 0.3s ease;
          box-shadow: 0 4px 24px rgba(16,185,129,0.35);
        }
        .join-btn:hover:not(:disabled) {
          background-position: right center;
          box-shadow: 0 8px 36px rgba(16,185,129,0.5);
          transform: translateY(-2px);
        }
      `}</style>

      {/* ═══ LEFT PANEL ═══ */}
      <div
        className={`hidden lg:flex flex-col flex-1 relative overflow-hidden ${mounted ? 'slide-left' : 'opacity-0'}`}
        style={{ background: 'linear-gradient(160deg, #0c1a2e 0%, #0f2744 45%, #0a1f38 75%, #071628 100%)' }}
      >
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

          {/* Center */}
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            {/* Floating icon cluster */}
            <div className="float-anim relative mb-10">
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at center, rgba(6,182,212,0.2) 0%, transparent 65%)', filter: 'blur(30px)', transform: 'scale(1.4)' }} />
              <div className="relative z-10 flex items-center justify-center gap-3">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.2)' }}>
                  <i className="ri-building-2-line text-2xl" style={{ color: '#06B6D4' }} />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <i className="ri-team-line text-lg" style={{ color: '#10B981' }} />
                  </div>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <i className="ri-file-shield-2-line text-lg" style={{ color: '#F59E0B' }} />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ maxWidth: '320px' }}>
              <h2 className="text-3xl font-extrabold leading-tight mb-4"
                style={{ color: '#f0f9ff', letterSpacing: '-0.03em' }}>
                Organizasyonunuza<br />
                <span style={{ background: 'linear-gradient(135deg, #06B6D4 0%, #22D3EE 50%, #10B981 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  bağlanın
                </span>
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: '#6aacbf' }}>
                Yeni bir organizasyon oluşturun veya mevcut birine davet koduyla katılın.
              </p>
            </div>

            {/* Feature list */}
            <div className="mt-10 space-y-3 w-full" style={{ maxWidth: '300px' }}>
              {[
                { icon: 'ri-building-2-line', text: 'Firma ve personel yönetimi', color: '#06B6D4' },
                { icon: 'ri-file-shield-2-line', text: 'Evrak takip ve uyarı sistemi', color: '#10B981' },
                { icon: 'ri-shield-check-line', text: 'ISG denetim ve raporlama', color: '#F59E0B' },
              ].map((f) => (
                <div key={f.text} className="flex items-center gap-3 text-left px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${f.color}18`, border: `1px solid ${f.color}25` }}>
                    <i className={`${f.icon} text-sm`} style={{ color: f.color }} />
                  </div>
                  <p className="text-sm" style={{ color: '#8ab8cc' }}>{f.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10B981' }} />
            <span className="text-xs" style={{ color: '#2e6a7e' }}>Tüm sistemler çalışıyor</span>
          </div>
        </div>
      </div>

      {/* ═══ RIGHT PANEL ═══ */}
      <div
        className={`w-full lg:w-[520px] xl:w-[560px] flex-shrink-0 flex flex-col justify-center px-8 sm:px-14 py-12 relative ${mounted ? 'slide-right' : 'opacity-0'}`}
        style={{ background: '#ffffff' }}
      >
        <div className="absolute top-0 right-0 pointer-events-none"
          style={{ width: '280px', height: '280px', background: 'radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        <div className="absolute bottom-0 left-0 pointer-events-none"
          style={{ width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(16,185,129,0.05) 0%, transparent 70%)', filter: 'blur(40px)' }} />

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center justify-center gap-3 mb-10">
          <img src={LOGO_URL} alt="ISG Denetim" className="w-9 h-9 object-contain" />
          <div>
            <p className="text-base font-bold" style={{ color: '#0f172a' }}>ISG Denetim</p>
            <p className="text-xs" style={{ color: '#64748b' }}>Yönetim Platformu</p>
          </div>
        </div>

        <div className="relative z-10 max-w-[420px] w-full mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 text-xs font-semibold"
              style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)', color: '#0891B2' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#06B6D4' }} />
              Kurulum Adımı
            </div>
            <h2 className="text-3xl font-extrabold mb-2" style={{ color: '#0f172a', letterSpacing: '-0.03em' }}>
              Hoş geldiniz!
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: '#64748b' }}>
              <span className="font-semibold" style={{ color: '#374151' }}>{user?.email}</span> hesabıyla giriş yaptınız.
              Devam etmek için bir organizasyon seçin.
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 p-1 rounded-xl mb-6"
            style={{ background: '#f8fafc', border: '1.5px solid #f1f5f9' }}>
            {(['create', 'join'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(null); }}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
                style={{
                  background: tab === t ? '#ffffff' : 'transparent',
                  color: tab === t ? '#0f172a' : '#94a3b8',
                  boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  border: tab === t ? '1px solid #e2e8f0' : '1px solid transparent',
                }}
              >
                <i className={`${t === 'create' ? 'ri-add-circle-line' : 'ri-group-line'} text-sm`} />
                {t === 'create' ? 'Yeni Organizasyon' : 'Davet Koduyla Katıl'}
              </button>
            ))}
          </div>

          {/* Create tab */}
          {tab === 'create' && (
            <div className="space-y-5">
              {hasLegacy && (
                <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl"
                  style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <i className="ri-information-line text-sm flex-shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
                  <p className="text-xs leading-relaxed" style={{ color: '#92400e' }}>
                    Mevcut verileriniz yeni organizasyona otomatik aktarılacak.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: '#374151' }}>
                  Organizasyon Adı
                </label>
                <input
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  placeholder="Örn: ABC İnşaat A.Ş."
                  className="onb-input"
                />
                <p className="text-xs mt-1.5" style={{ color: '#94a3b8' }}>
                  Şirket veya kurum adınızı girin.
                </p>
              </div>

              <button
                onClick={handleCreate}
                disabled={submitting || !orgName.trim()}
                className="create-btn w-full py-4 rounded-xl text-sm font-bold text-white cursor-pointer whitespace-nowrap flex items-center justify-center gap-2.5"
                style={{ opacity: (submitting || !orgName.trim()) ? 0.6 : 1, letterSpacing: '0.02em' }}
              >
                {submitting
                  ? <><i className="ri-loader-4-line animate-spin" /><span>Oluşturuluyor...</span></>
                  : <><i className="ri-add-circle-line" /><span>Organizasyon Oluştur</span></>}
              </button>
            </div>
          )}

          {/* Join tab */}
          {tab === 'join' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: '#374151' }}>
                  Davet Kodu
                </label>
                <input
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                  placeholder="Örn: ABC123"
                  maxLength={8}
                  className="onb-input"
                  style={{ letterSpacing: '0.15em', fontFamily: 'monospace', textTransform: 'uppercase', fontSize: '16px' }}
                />
                <p className="text-xs mt-1.5" style={{ color: '#94a3b8' }}>
                  Organizasyon yöneticinizden 6 haneli davet kodunu isteyin.
                </p>
              </div>

              <button
                onClick={handleJoin}
                disabled={submitting || !inviteCode.trim()}
                className="join-btn w-full py-4 rounded-xl text-sm font-bold text-white cursor-pointer whitespace-nowrap flex items-center justify-center gap-2.5"
                style={{ opacity: (submitting || !inviteCode.trim()) ? 0.6 : 1, letterSpacing: '0.02em' }}
              >
                {submitting
                  ? <><i className="ri-loader-4-line animate-spin" /><span>Katılınıyor...</span></>
                  : <><i className="ri-group-line" /><span>Organizasyona Katıl</span></>}
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 rounded-xl p-4 mt-4"
              style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <i className="ri-error-warning-line text-sm flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
              <p className="text-sm" style={{ color: '#dc2626' }}>{error}</p>
            </div>
          )}

          {/* Divider */}
          <div className="my-8 flex items-center gap-4">
            <div className="flex-1 h-px" style={{ background: '#f1f5f9' }} />
            <span className="text-xs font-medium" style={{ color: '#cbd5e1' }}>VEYA</span>
            <div className="flex-1 h-px" style={{ background: '#f1f5f9' }} />
          </div>

          {/* Logout */}
          <div className="text-center">
            <button
              onClick={logout}
              className="inline-flex items-center gap-2 text-sm font-medium cursor-pointer transition-colors"
              style={{ color: '#94a3b8' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; }}
            >
              <i className="ri-logout-box-line text-sm" />
              Farklı hesapla giriş yap
            </button>
          </div>

          <p className="text-center text-xs mt-8" style={{ color: '#cbd5e1' }}>
            ISG Denetim Yönetim Sistemi &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
