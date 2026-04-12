import { useAuth } from '../../store/AuthContext';
import { useApp } from '../../store/AppContext';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518';

const UZMAN_FEATURES = [
  { icon: 'ri-map-pin-line', label: 'Saha Denetimi', desc: 'Yerinde ISG denetimi ve kontrol' },
  { icon: 'ri-alert-line', label: 'Uygunsuzluk Kaydı', desc: 'Anlık uygunsuzluk tespit ve rapor' },
  { icon: 'ri-file-list-3-line', label: 'İş İzni Formu', desc: 'Dijital iş izni düzenleme' },
  { icon: 'ri-heart-pulse-line', label: 'Sağlık Takibi', desc: 'Personel muayene ve sağlık kayıtları' },
];

export default function OsgbUzmanPage() {
  const { logout } = useAuth();
  const { org } = useApp();

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Inter', sans-serif", background: 'var(--bg-main)' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        @keyframes pulseGlow {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 0.9; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .glow-pulse { animation: pulseGlow 4s ease-in-out infinite; }
        .fade-in    { animation: fadeIn 0.6s cubic-bezier(0.22,0.61,0.36,1) forwards; }

        .feature-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.03);
          transition: background 0.15s;
        }
        .feature-row:hover { background: rgba(255,255,255,0.07); }
      `}</style>

      {/* ═══ LEFT PANEL (koyu arka plan - her modda aynı) ═══ */}
      <div
        className="hidden lg:flex flex-col flex-1 relative overflow-hidden fade-in"
        style={{ background: 'linear-gradient(160deg, #0c1a2e 0%, #0f2744 50%, #071628 100%)' }}
      >
        <div className="absolute pointer-events-none glow-pulse"
          style={{ top: '-120px', left: '-80px', width: '600px', height: '600px',
            background: 'radial-gradient(circle, rgba(14,165,233,0.12) 0%, transparent 65%)', filter: 'blur(60px)' }} />
        <div className="absolute pointer-events-none glow-pulse"
          style={{ bottom: '-100px', right: '-60px', width: '500px', height: '500px',
            background: 'radial-gradient(circle, rgba(14,165,233,0.07) 0%, transparent 65%)', filter: 'blur(60px)', animationDelay: '2s' }} />

        <div className="relative z-10 flex flex-col h-full px-12 py-12">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.22)' }}>
              <img src={LOGO_URL} alt="ISG" className="w-6 h-6 object-contain" />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: '#e0f2fe', letterSpacing: '-0.01em' }}>ISG Denetim</p>
              <p className="text-[11px]" style={{ color: '#38bdf8' }}>Gezici Uzman Paneli</p>
            </div>
          </div>

          {/* Center content */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="mb-8">
              <h2 className="text-3xl font-extrabold leading-snug mb-3"
                style={{ color: '#f0f9ff', letterSpacing: '-0.03em' }}>
                ISG Uzmanı<br />
                <span style={{ background: 'linear-gradient(135deg, #0EA5E9 0%, #38BDF8 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  paneline hoş geldiniz
                </span>
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: '#4a7a9a' }}>
                Saha denetimleri, uygunsuzluk kayıtları ve iş izni formlarını tek ekrandan yönetin.
              </p>
            </div>

            {/* Feature list */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest mb-3"
                style={{ color: '#2e5a7a' }}>Uzman Yetkileri</p>
              {UZMAN_FEATURES.map((f) => (
                <div key={f.label} className="feature-row">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.2)' }}>
                    <i className={`${f.icon} text-sm`} style={{ color: '#38BDF8' }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: '#bae6fd' }}>{f.label}</p>
                    <p className="text-[11px]" style={{ color: '#4a6a8a' }}>{f.desc}</p>
                  </div>
                  <div className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: 'rgba(14,165,233,0.4)' }} />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#0EA5E9' }} />
            <span className="text-xs" style={{ color: '#2e5a7a' }}>Tüm sistemler çalışıyor</span>
          </div>
        </div>
      </div>

      {/* ═══ RIGHT PANEL — dark mode uyumlu ═══ */}
      <div
        className="w-full lg:w-[500px] xl:w-[540px] flex-shrink-0 flex flex-col justify-start lg:justify-center overflow-y-auto px-6 sm:px-12 py-10 relative fade-in"
        style={{ background: 'var(--bg-card-solid)', minHeight: '100vh', borderLeft: '1px solid var(--border-subtle)' }}
      >
        <div className="absolute top-0 right-0 pointer-events-none"
          style={{ width: '260px', height: '260px',
            background: 'radial-gradient(circle, rgba(14,165,233,0.05) 0%, transparent 70%)', filter: 'blur(40px)' }} />

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-8">
          <img src={LOGO_URL} alt="ISG" className="w-8 h-8 object-contain" />
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>ISG Denetim</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Gezici Uzman Paneli</p>
          </div>
        </div>

        <div className="relative z-10 w-full max-w-[380px] mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 text-xs font-semibold"
            style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)', color: '#0EA5E9' }}>
            <i className="ri-user-star-line text-xs" />
            ISG Uzmanı
          </div>

          <h2 className="text-2xl font-extrabold mb-1.5" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            Hoş Geldiniz{org?.displayName ? `, ${org.displayName}` : ''}
          </h2>
          <p className="text-sm mb-7" style={{ color: 'var(--text-muted)' }}>
            Atanan firmanız üzerinden denetimlere başlayabilirsiniz.
          </p>

          {/* Status table */}
          <div className="rounded-xl overflow-hidden mb-6"
            style={{ border: '1px solid var(--border-subtle)' }}>
            {/* Table header */}
            <div className="grid px-4 py-2.5"
              style={{
                gridTemplateColumns: '1fr 1fr 1fr',
                background: 'var(--bg-item)',
                borderBottom: '1px solid var(--border-subtle)',
              }}>
              {['Atanan Firma', 'Rol', 'Durum'].map(h => (
                <p key={h} className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>{h}</p>
              ))}
            </div>

            {/* Table row */}
            <div className="grid items-center px-4 py-3"
              style={{ gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #94a3b8, #64748b)' }}>
                  —
                </div>
                <div>
                  <p className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>Atama Bekleniyor</p>
                  <p className="text-[10.5px]" style={{ color: 'var(--text-faint)' }}>OSGB tarafından atanacak</p>
                </div>
              </div>
              <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>ISG Uzmanı</p>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-semibold"
                  style={{ background: 'rgba(245,158,11,0.1)', color: '#b45309', border: '1px solid rgba(245,158,11,0.25)' }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#F59E0B' }} />
                  Bekleniyor
                </span>
              </div>
            </div>

            {/* Yetki satırı */}
            <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                <i className="ri-shield-check-line text-sm" style={{ color: '#0EA5E9' }} />
              </div>
              <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>Yetki</p>
              <p className="text-[12px] font-medium ml-auto" style={{ color: 'var(--text-primary)' }}>Saha denetimi &amp; raporlama</p>
            </div>

            {/* Saha denetimi satırı */}
            <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                <i className="ri-map-pin-line text-sm" style={{ color: '#0EA5E9' }} />
              </div>
              <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>Saha Denetimi</p>
              <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold"
                style={{ background: 'rgba(14,165,233,0.1)', color: '#0284C7', border: '1px solid rgba(14,165,233,0.2)' }}>
                <i className="ri-check-line text-[9px]" />
                Aktif
              </span>
            </div>

            {/* Uygunsuzluk satırı */}
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                <i className="ri-alert-line text-sm" style={{ color: '#0EA5E9' }} />
              </div>
              <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>Uygunsuzluk Kaydı</p>
              <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold"
                style={{ background: 'rgba(14,165,233,0.1)', color: '#0284C7', border: '1px solid rgba(14,165,233,0.2)' }}>
                <i className="ri-check-line text-[9px]" />
                Aktif
              </span>
            </div>
          </div>

          {/* Info note */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl mb-6"
            style={{ background: 'rgba(14,165,233,0.05)', border: '1px solid rgba(14,165,233,0.18)' }}>
            <i className="ri-information-line text-sm flex-shrink-0 mt-0.5" style={{ color: '#0EA5E9' }} />
            <p className="text-xs leading-relaxed" style={{ color: '#0284C7' }}>
              OSGB admininiz size bir müşteri firma ataması yaptığında panel otomatik olarak açılacaktır.
            </p>
          </div>

          {/* Mobile feature list */}
          <div className="lg:hidden rounded-xl overflow-hidden mb-6"
            style={{ border: '1px solid var(--border-subtle)' }}>
            <div className="px-4 py-2.5" style={{ background: 'var(--bg-item)', borderBottom: '1px solid var(--border-subtle)' }}>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
                Uzman Yetkileri
              </p>
            </div>
            {UZMAN_FEATURES.map((f, idx) => (
              <div key={f.label}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: idx < UZMAN_FEATURES.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                  <i className={`${f.icon} text-sm`} style={{ color: '#0EA5E9' }} />
                </div>
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{f.label}</p>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => window.location.reload()}
              className="whitespace-nowrap flex items-center justify-center gap-2 w-full px-6 py-3.5 rounded-xl text-sm font-bold cursor-pointer text-white"
              style={{ background: 'linear-gradient(135deg, #0284C7 0%, #0EA5E9 100%)' }}
            >
              <i className="ri-refresh-line" />
              Sayfayı Yenile
            </button>
            <button
              onClick={logout}
              className="whitespace-nowrap flex items-center justify-center gap-2 w-full px-6 py-3.5 rounded-xl text-sm font-semibold cursor-pointer"
              style={{ background: 'var(--bg-item)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.3)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-subtle)'; }}
            >
              <i className="ri-logout-box-line" />
              Çıkış Yap
            </button>
          </div>

          <p className="text-center text-[11px] mt-7" style={{ color: 'var(--text-faint)' }}>
            ISG Denetim &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
