import { useState, useEffect } from 'react';
import { useAuth } from '../../store/AuthContext';
import { useOrganization } from '../../hooks/useOrganization';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518';

type Tab = 'create' | 'join';

const FEATURES = [
  { icon: 'ri-building-2-line', label: 'Firma Yönetimi', desc: 'Tüm firmalarınızı tek panelden takip edin' },
  { icon: 'ri-team-line', label: 'Personel Takibi', desc: 'Personel evrak ve sağlık kayıtları' },
  { icon: 'ri-file-shield-2-line', label: 'Evrak & Denetim', desc: 'ISG evraklarını dijital ortamda yönetin' },
  { icon: 'ri-shield-check-line', label: 'Uygunsuzluk Takibi', desc: 'DÖF ve uygunsuzluk süreçleri' },
];

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
        style={{ background: '#0c1a2e' }}>
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
      className="min-h-screen flex"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

        @keyframes fadeSlideLeft {
          from { opacity: 0; transform: translateX(-24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeSlideRight {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 0.9; }
        }

        .slide-left  { animation: fadeSlideLeft  0.7s cubic-bezier(0.22,0.61,0.36,1) forwards; }
        .slide-right { animation: fadeSlideRight 0.7s cubic-bezier(0.22,0.61,0.36,1) 0.1s both; }
        .glow-pulse  { animation: pulseGlow 4s ease-in-out infinite; }

        .onb-input {
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
          background: #f8fafc;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          color: #1e293b;
          font-size: 14px;
          width: 100%;
          outline: none;
          padding: 13px 16px;
          font-family: 'Inter', sans-serif;
        }
        .onb-input::placeholder { color: #94a3b8; }
        .onb-input:focus {
          border-color: #06B6D4;
          box-shadow: 0 0 0 3px rgba(6,182,212,0.1);
          background: #f0fdff;
        }

        .primary-btn {
          background: linear-gradient(135deg, #0891B2 0%, #06B6D4 100%);
          transition: opacity 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
          box-shadow: 0 4px 20px rgba(6,182,212,0.3);
        }
        .primary-btn:hover:not(:disabled) {
          opacity: 0.92;
          transform: translateY(-1px);
          box-shadow: 0 6px 28px rgba(6,182,212,0.4);
        }
        .primary-btn:disabled { opacity: 0.55; }

        .feature-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 11px 14px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.03);
          transition: background 0.15s;
        }
        .feature-row:hover { background: rgba(255,255,255,0.06); }
      `}</style>

      {/* ═══ LEFT PANEL ═══ */}
      <div
        className={`hidden lg:flex flex-col flex-1 relative overflow-hidden ${mounted ? 'slide-left' : 'opacity-0'}`}
        style={{ background: 'linear-gradient(160deg, #0c1a2e 0%, #0f2744 50%, #071628 100%)' }}
      >
        {/* Glow blobs */}
        <div className="absolute pointer-events-none glow-pulse"
          style={{ top: '-120px', left: '-80px', width: '600px', height: '600px',
            background: 'radial-gradient(circle, rgba(6,182,212,0.14) 0%, transparent 65%)', filter: 'blur(60px)' }} />
        <div className="absolute pointer-events-none glow-pulse"
          style={{ bottom: '-100px', right: '-60px', width: '500px', height: '500px',
            background: 'radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 65%)', filter: 'blur(60px)', animationDelay: '2s' }} />

        <div className="relative z-10 flex flex-col h-full px-12 py-12">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.22)' }}>
              <img src={LOGO_URL} alt="ISG" className="w-6 h-6 object-contain" />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: '#e2f8fb', letterSpacing: '-0.01em' }}>ISG Denetim</p>
              <p className="text-[11px]" style={{ color: '#4a9bb5' }}>İş Sağlığı & Güvenliği Platformu</p>
            </div>
          </div>

          {/* Center content */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="mb-8">
              <h2 className="text-3xl font-extrabold leading-snug mb-3"
                style={{ color: '#f0f9ff', letterSpacing: '-0.03em' }}>
                Organizasyonunuza<br />
                <span style={{ background: 'linear-gradient(135deg, #06B6D4 0%, #22D3EE 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  bağlanın
                </span>
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: '#5a96ad' }}>
                Yeni bir organizasyon oluşturun veya davet koduyla mevcut birine katılın.
              </p>
            </div>

            {/* Feature list — tablo tarzı */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest mb-3"
                style={{ color: '#2e6a7e' }}>Platform Özellikleri</p>
              {FEATURES.map((f) => (
                <div key={f.label} className="feature-row">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.2)' }}>
                    <i className={`${f.icon} text-sm`} style={{ color: '#22D3EE' }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: '#b8e6f0' }}>{f.label}</p>
                    <p className="text-[11px]" style={{ color: '#4a7a8a' }}>{f.desc}</p>
                  </div>
                  <div className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: 'rgba(6,182,212,0.4)' }} />
                </div>
              ))}
            </div>
          </div>

          {/* Bottom */}
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#06B6D4' }} />
            <span className="text-xs" style={{ color: '#2e6a7e' }}>Tüm sistemler çalışıyor</span>
          </div>
        </div>
      </div>

      {/* ═══ RIGHT PANEL ═══ */}
      <div
        className={`w-full lg:w-[500px] xl:w-[540px] flex-shrink-0 flex flex-col justify-start lg:justify-center overflow-y-auto px-6 sm:px-12 py-10 relative ${mounted ? 'slide-right' : 'opacity-0'}`}
        style={{ background: '#ffffff', minHeight: '100vh' }}
      >
        {/* Subtle top glow */}
        <div className="absolute top-0 right-0 pointer-events-none"
          style={{ width: '260px', height: '260px',
            background: 'radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 70%)', filter: 'blur(40px)' }} />

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-8">
          <img src={LOGO_URL} alt="ISG" className="w-8 h-8 object-contain" />
          <div>
            <p className="text-sm font-bold" style={{ color: '#0f172a' }}>ISG Denetim</p>
            <p className="text-xs" style={{ color: '#64748b' }}>Yönetim Platformu</p>
          </div>
        </div>

        <div className="relative z-10 w-full max-w-[400px] mx-auto">
          {/* Header */}
          <div className="mb-7">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 text-xs font-semibold"
              style={{ background: 'rgba(6,182,212,0.07)', border: '1px solid rgba(6,182,212,0.18)', color: '#0891B2' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#06B6D4' }} />
              Kurulum Adımı
            </div>
            <h2 className="text-2xl font-extrabold mb-1.5" style={{ color: '#0f172a', letterSpacing: '-0.03em' }}>
              Hoş geldiniz!
            </h2>
            <p className="text-sm" style={{ color: '#64748b' }}>
              <span className="font-medium" style={{ color: '#374151' }}>{user?.email}</span> ile giriş yaptınız.
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 p-1 rounded-xl mb-6"
            style={{ background: '#f8fafc', border: '1.5px solid #f1f5f9' }}>
            {(['create', 'join'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(null); }}
                className="flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5"
                style={{
                  background: tab === t ? '#ffffff' : 'transparent',
                  color: tab === t ? '#0f172a' : '#94a3b8',
                  boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.07)' : 'none',
                  border: tab === t ? '1px solid #e8edf2' : '1px solid transparent',
                }}
              >
                <i className={`${t === 'create' ? 'ri-add-circle-line' : 'ri-group-line'} text-xs`} />
                {t === 'create' ? 'Yeni Organizasyon' : 'Davet Koduyla Katıl'}
              </button>
            ))}
          </div>

          {/* Create tab */}
          {tab === 'create' && (
            <div className="space-y-4">
              {hasLegacy && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.15)' }}>
                  <i className="ri-information-line text-sm flex-shrink-0 mt-0.5" style={{ color: '#06B6D4' }} />
                  <p className="text-xs leading-relaxed" style={{ color: '#0891B2' }}>
                    Mevcut verileriniz yeni organizasyona otomatik aktarılacak.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#374151' }}>
                  Organizasyon Adı
                </label>
                <input
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  placeholder="Örn: ABC İnşaat A.Ş."
                  className="onb-input"
                />
                <p className="text-[11px] mt-1" style={{ color: '#94a3b8' }}>
                  Şirket veya kurum adınızı girin.
                </p>
              </div>

              <button
                onClick={handleCreate}
                disabled={submitting || !orgName.trim()}
                className="primary-btn w-full py-3.5 rounded-xl text-sm font-bold text-white cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
              >
                {submitting
                  ? <><i className="ri-loader-4-line animate-spin" /><span>Oluşturuluyor...</span></>
                  : <><i className="ri-add-circle-line" /><span>Organizasyon Oluştur</span></>}
              </button>
            </div>
          )}

          {/* Join tab */}
          {tab === 'join' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#374151' }}>
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
                <p className="text-[11px] mt-1" style={{ color: '#94a3b8' }}>
                  Organizasyon yöneticinizden 6 haneli davet kodunu isteyin.
                </p>
              </div>

              <button
                onClick={handleJoin}
                disabled={submitting || !inviteCode.trim()}
                className="primary-btn w-full py-3.5 rounded-xl text-sm font-bold text-white cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
              >
                {submitting
                  ? <><i className="ri-loader-4-line animate-spin" /><span>Katılınıyor...</span></>
                  : <><i className="ri-group-line" /><span>Organizasyona Katıl</span></>}
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 rounded-xl p-3.5 mt-4"
              style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}>
              <i className="ri-error-warning-line text-sm flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
              <p className="text-sm" style={{ color: '#dc2626' }}>{error}</p>
            </div>
          )}

          {/* What you get — tablo listesi */}
          <div className="mt-7 rounded-xl overflow-hidden"
            style={{ border: '1px solid #f1f5f9' }}>
            <div className="px-4 py-2.5" style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>
                Neler Yapabilirsiniz
              </p>
            </div>
            {[
              { icon: 'ri-building-2-line', text: 'Firma & personel yönetimi' },
              { icon: 'ri-file-shield-2-line', text: 'Evrak takip & uyarı sistemi' },
              { icon: 'ri-tools-line', text: 'Ekipman bakım ve kontrol' },
              { icon: 'ri-alert-line', text: 'Uygunsuzluk ve DÖF takibi' },
            ].map((item, idx, arr) => (
              <div key={item.text}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: idx < arr.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                  <i className={`${item.icon} text-sm`} style={{ color: '#06B6D4' }} />
                </div>
                <p className="text-xs" style={{ color: '#475569' }}>{item.text}</p>
                <i className="ri-check-line text-xs ml-auto" style={{ color: '#06B6D4' }} />
              </div>
            ))}
          </div>

          {/* Divider + logout */}
          <div className="mt-6 flex items-center gap-4">
            <div className="flex-1 h-px" style={{ background: '#f1f5f9' }} />
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-colors whitespace-nowrap"
              style={{ color: '#94a3b8' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; }}
            >
              <i className="ri-logout-box-line text-xs" />
              Farklı hesapla giriş yap
            </button>
            <div className="flex-1 h-px" style={{ background: '#f1f5f9' }} />
          </div>

          <p className="text-center text-[11px] mt-6" style={{ color: '#cbd5e1' }}>
            ISG Denetim &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
