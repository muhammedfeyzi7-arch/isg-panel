import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';
import { useApp } from '@/store/AppContext';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518';

// ── Loading Screen (hekim ile aynı stil) ─────────────────────────────────────
function UzmanLoadingScreen({ isDark }: { isDark: boolean }) {
  const STEPS = [
    { label: 'Bağlantı kuruluyor...', icon: 'ri-wifi-line', duration: 500 },
    { label: 'Uzman bilgileri yükleniyor...', icon: 'ri-user-star-line', duration: 700 },
    { label: 'Atanmış firmalar kontrol ediliyor...', icon: 'ri-building-3-line', duration: 700 },
    { label: 'Saha modülü hazırlanıyor...', icon: 'ri-map-pin-user-line', duration: 600 },
    { label: 'Hazır!', icon: 'ri-check-double-line', duration: 300 },
  ];

  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    let current = 0;
    const total = STEPS.reduce((s, st) => s + st.duration, 0);
    let elapsed = 0;

    const tick = () => {
      if (current >= STEPS.length) { setFadeOut(true); return; }
      setStepIndex(current);
      const stepDuration = STEPS[current].duration;
      const stepStart = elapsed;
      const interval = setInterval(() => {
        elapsed += 20;
        setProgress(Math.min((elapsed / total) * 100, 100));
      }, 20);
      setTimeout(() => {
        clearInterval(interval);
        current++;
        elapsed = stepStart + stepDuration;
        tick();
      }, stepDuration);
    };
    tick();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = STEPS[Math.min(stepIndex, STEPS.length - 1)];
  const isDone = stepIndex >= STEPS.length - 1 && progress >= 95;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{
        background: isDark ? '#0f172a' : '#f8fafc',
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 0.4s ease',
        pointerEvents: fadeOut ? 'none' : 'all',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes uzmanSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <div className="flex flex-col items-center gap-5 mb-10">
        <div className="w-16 h-16 flex items-center justify-center rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, rgba(14,165,233,0.18), rgba(14,165,233,0.06))',
            border: '1px solid rgba(14,165,233,0.3)',
            boxShadow: '0 0 40px rgba(14,165,233,0.15)',
          }}>
          <img src={LOGO_URL} alt="ISG Logo"
            style={{ height: '32px', width: 'auto', objectFit: 'contain',
              filter: 'brightness(1.2) drop-shadow(0 0 8px rgba(14,165,233,0.5))' }} />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-black" style={{ color: isDark ? '#f1f5f9' : '#0f172a', letterSpacing: '-0.04em' }}>
            ISG Denetim
          </h1>
          <p className="text-sm mt-1 font-semibold" style={{ color: '#0EA5E9' }}>Gezici Uzman Paneli</p>
        </div>
      </div>

      <div className="w-64 mb-5">
        <div className="h-1 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }}>
          <div className="h-full rounded-full transition-all duration-200"
            style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #0EA5E9, #38BDF8)', boxShadow: '0 0 8px rgba(14,165,233,0.5)' }} />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px]" style={{ color: isDark ? '#475569' : '#94a3b8' }}>{Math.round(progress)}%</span>
          <span className="text-[10px]" style={{ color: isDark ? '#475569' : '#94a3b8' }}>{stepIndex + 1}/{STEPS.length}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300"
        style={{
          background: isDone ? 'rgba(14,165,233,0.12)' : 'rgba(14,165,233,0.07)',
          border: `1px solid ${isDone ? 'rgba(14,165,233,0.3)' : 'rgba(14,165,233,0.15)'}`,
        }}>
        <i className={`${step.icon} text-sm`}
          style={{ color: '#0EA5E9', animation: isDone ? 'none' : 'uzmanSpin 1.5s linear infinite' }} />
        <span className="text-xs font-semibold" style={{ color: '#0EA5E9' }}>{step.label}</span>
      </div>

      <div className="flex items-center gap-2 mt-6">
        {STEPS.map((_, i) => (
          <div key={i} className="rounded-full transition-all duration-300"
            style={{
              width: i === stepIndex ? '20px' : '6px',
              height: '6px',
              background: i < stepIndex ? '#0EA5E9' : i === stepIndex ? '#38BDF8' : isDark ? 'rgba(14,165,233,0.15)' : 'rgba(14,165,233,0.12)',
            }} />
        ))}
      </div>
    </div>
  );
}

// ── Atama Bekleniyor Ekranı ───────────────────────────────────────────────────
function AtamaBekleyenEkran({ isDark, onLogout, onRefresh }: { isDark: boolean; onLogout: () => void; onRefresh: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8"
      style={{ background: isDark ? '#0f172a' : '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');`}</style>
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6"
          style={{ background: 'rgba(14,165,233,0.08)', border: '1.5px solid rgba(14,165,233,0.18)' }}>
          <i className="ri-map-pin-user-line text-3xl" style={{ color: '#0EA5E9' }} />
        </div>
        <h1 className="text-xl font-extrabold mb-2"
          style={{ color: isDark ? '#f1f5f9' : '#0f172a', letterSpacing: '-0.03em' }}>
          Henüz size firma atanmadı
        </h1>
        <p className="text-sm leading-relaxed mb-6" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
          OSGB admininiz hesabınıza henüz müşteri firma ataması yapmadı. Atama yapıldıktan sonra saha paneline erişebilirsiniz.
        </p>
        <div className="flex flex-col gap-2">
          <button onClick={onRefresh}
            className="whitespace-nowrap inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #0284C7, #0EA5E9)' }}>
            <i className="ri-refresh-line" />
            Yenile
          </button>
          <button onClick={onLogout}
            className="whitespace-nowrap inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
            style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', color: isDark ? '#94a3b8' : '#64748b', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)'}` }}>
            <i className="ri-logout-box-line" />
            Çıkış Yap
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Ana Sayfa ─────────────────────────────────────────────────────────────────
export default function OsgbUzmanPage() {
  const { logout } = useAuth();
  const { org, orgLoading, theme } = useApp();
  const navigate = useNavigate();
  const [showLoading, setShowLoading] = useState(true);
  const isDark = theme === 'dark';

  // Loading ekranını minimum 2.8sn göster (animasyon tamamlansın)
  useEffect(() => {
    const timer = setTimeout(() => setShowLoading(false), 2800);
    return () => clearTimeout(timer);
  }, []);

  // Org yüklendi ve firma atanmışsa saha'ya yönlendir
  useEffect(() => {
    if (showLoading || orgLoading) return;
    const hasAssignment =
      (org?.activeFirmIds && org.activeFirmIds.length > 0) || !!org?.id;
    if (hasAssignment) {
      navigate('/saha', { replace: true });
    }
  }, [showLoading, orgLoading, org, navigate]);

  if (showLoading || orgLoading) {
    return <UzmanLoadingScreen isDark={isDark} />;
  }

  // Firma atanmamışsa bekleme ekranı
  const hasAssignment = (org?.activeFirmIds && org.activeFirmIds.length > 0) || !!org?.id;
  if (!hasAssignment) {
    return (
      <AtamaBekleyenEkran
        isDark={isDark}
        onLogout={logout}
        onRefresh={() => window.location.reload()}
      />
    );
  }

  // Yönlendirme gerçekleşiyor, boş ekran göster
  return null;
}
