import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { useApp } from '../../store/AppContext';
import { supabase } from '../../lib/supabase';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518';

const OSGB_FEATURES = [
  { icon: 'ri-building-2-line', label: 'Müşteri Firma Yönetimi', desc: 'Tüm firmalarınızı tek panelden takip edin' },
  { icon: 'ri-user-star-line', label: 'Gezici Uzman Ataması', desc: 'ISG uzmanlarını firmalara atayın' },
  { icon: 'ri-map-pin-line', label: 'Saha Denetim Takibi', desc: 'Ziyaret geçmişi ve denetim raporları' },
  { icon: 'ri-alert-line', label: 'Uygunsuzluk & DÖF', desc: 'Anlık uygunsuzluk kayıt ve takibi' },
  { icon: 'ri-file-shield-2-line', label: 'Evrak & Belge Yönetimi', desc: 'ISG belgelerini dijital ortamda saklayın' },
];

export default function OsgbOnboardingPage() {
  const { user } = useAuth();
  const { refetchOrg, addToast } = useApp();
  const navigate = useNavigate();

  const [osgbAd, setOsgbAd] = useState('');
  const [yetkiliAd, setYetkiliAd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!osgbAd.trim()) { setError('OSGB adı zorunludur.'); return; }
    if (!yetkiliAd.trim()) { setError('Yetkili adı zorunludur.'); return; }
    if (!user) { setError('Oturum bulunamadı.'); return; }

    setLoading(true);
    setError(null);

    try {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const inviteCode = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

      const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: osgbAd.trim(),
          invite_code: inviteCode,
          created_by: user.id,
          org_type: 'osgb',
        })
        .select()
        .maybeSingle();

      if (orgError || !newOrg) {
        setError(orgError?.message ?? 'Organizasyon oluşturulamadı.');
        return;
      }

      const { error: memberError } = await supabase
        .from('user_organizations')
        .insert({
          user_id: user.id,
          organization_id: newOrg.id,
          role: 'admin',
          display_name: yetkiliAd.trim(),
          email: user.email ?? '',
          is_active: true,
          must_change_password: false,
          osgb_role: 'osgb_admin',
        });

      if (memberError && memberError.code !== '23505') {
        setError(memberError.message);
        return;
      }

      await supabase.from('app_data').upsert(
        { organization_id: newOrg.id, data: {}, updated_at: new Date().toISOString() },
        { onConflict: 'organization_id' }
      );

      addToast('OSGB hesabınız başarıyla oluşturuldu!', 'success');
      await refetchOrg();
      navigate('/osgb-dashboard', { replace: true });
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Inter', sans-serif" }}>
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

        .osgb-input {
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
          background: var(--bg-input, #f8fafc);
          border: 1.5px solid var(--border-input, #e2e8f0);
          border-radius: 12px;
          color: var(--text-primary, #1e293b);
          font-size: 14px;
          width: 100%;
          outline: none;
          padding: 13px 16px 13px 44px;
          font-family: 'Inter', sans-serif;
        }
        .osgb-input::placeholder { color: var(--text-faint, #94a3b8); }
        .osgb-input:focus {
          border-color: #10B981;
          box-shadow: 0 0 0 3px rgba(16,185,129,0.1);
          background: var(--bg-input, #f0fdf8);
        }

        .osgb-btn {
          background: linear-gradient(135deg, #059669 0%, #10B981 50%, #34D399 100%);
          background-size: 200% auto;
          transition: all 0.3s ease;
          box-shadow: 0 4px 24px rgba(16,185,129,0.3);
        }
        .osgb-btn:hover:not(:disabled) {
          background-position: right center;
          box-shadow: 0 8px 36px rgba(16,185,129,0.45);
          transform: translateY(-2px);
        }
        .osgb-btn:active:not(:disabled) { transform: translateY(0); }
        .osgb-btn:disabled { opacity: 0.55; }

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

      {/* ═══ LEFT PANEL ═══ */}
      <div
        className={`hidden lg:flex flex-col flex-1 relative overflow-hidden ${mounted ? 'slide-left' : 'opacity-0'}`}
        style={{ background: 'linear-gradient(160deg, #0c1a2e 0%, #0f2744 50%, #071628 100%)' }}
      >
        {/* Glow blobs — green tinted for OSGB */}
        <div className="absolute pointer-events-none glow-pulse"
          style={{ top: '-120px', left: '-80px', width: '600px', height: '600px',
            background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 65%)', filter: 'blur(60px)' }} />
        <div className="absolute pointer-events-none glow-pulse"
          style={{ bottom: '-100px', right: '-60px', width: '500px', height: '500px',
            background: 'radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 65%)', filter: 'blur(60px)', animationDelay: '2s' }} />

        <div className="relative z-10 flex flex-col h-full px-12 py-12">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.22)' }}>
              <img src={LOGO_URL} alt="ISG" className="w-6 h-6 object-contain" />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: '#e2f8fb', letterSpacing: '-0.01em' }}>ISG Denetim</p>
              <p className="text-[11px]" style={{ color: '#4aad8a' }}>OSGB Yönetim Platformu</p>
            </div>
          </div>

          {/* Center content */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 text-xs font-semibold"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.22)', color: '#34D399' }}>
                <i className="ri-stethoscope-line text-xs" />
                OSGB Kurulumu
              </div>
              <h2 className="text-3xl font-extrabold leading-snug mb-3"
                style={{ color: '#f0f9ff', letterSpacing: '-0.03em' }}>
                OSGB panelinizi<br />
                <span style={{ background: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  hemen kurun
                </span>
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: '#4a8a6a' }}>
                Müşteri firmalarınızı ve gezici uzmanlarınızı yönetmek için birkaç adımda kurulumu tamamlayın.
              </p>
            </div>

            {/* Feature list — tablo tarzı */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-widest mb-3"
                style={{ color: '#2e6a4e' }}>OSGB Panel Kapsamı</p>
              {OSGB_FEATURES.map((f) => (
                <div key={f.label} className="feature-row">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <i className={`${f.icon} text-sm`} style={{ color: '#34D399' }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: '#b8f0d8' }}>{f.label}</p>
                    <p className="text-[11px]" style={{ color: '#4a7a5a' }}>{f.desc}</p>
                  </div>
                  <div className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: 'rgba(16,185,129,0.4)' }} />
                </div>
              ))}
            </div>
          </div>

          {/* Bottom */}
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10B981' }} />
            <span className="text-xs" style={{ color: '#2e6a4e' }}>Tüm sistemler çalışıyor</span>
          </div>
        </div>
      </div>

      {/* ═══ RIGHT PANEL ═══ */}
      <div
        className={`w-full lg:w-[500px] xl:w-[540px] flex-shrink-0 flex flex-col justify-start lg:justify-center overflow-y-auto px-6 sm:px-12 py-10 relative ${mounted ? 'slide-right' : 'opacity-0'}`}
        style={{ background: 'var(--bg-card-solid)', minHeight: '100vh', borderLeft: '1px solid var(--border-subtle)' }}
      >
        {/* Subtle accent glow */}
        <div className="absolute top-0 right-0 pointer-events-none"
          style={{ width: '260px', height: '260px',
            background: 'radial-gradient(circle, rgba(16,185,129,0.05) 0%, transparent 70%)', filter: 'blur(40px)' }} />

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-8">
          <img src={LOGO_URL} alt="ISG" className="w-8 h-8 object-contain" />
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>ISG Denetim</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>OSGB Yönetim Platformu</p>
          </div>
        </div>

        <div className="relative z-10 w-full max-w-[400px] mx-auto">
          {/* Header */}
          <div className="mb-7">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 text-xs font-semibold"
              style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)', color: '#059669' }}>
              <i className="ri-stethoscope-line text-xs" />
              OSGB Kurulumu
            </div>
            <h2 className="text-2xl font-extrabold mb-1.5" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
              OSGB Hesabınızı Kurun
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Bilgilerinizi girerek yönetim panelinizi etkinleştirin.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                OSGB / Kurum Adı <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center pointer-events-none">
                  <i className="ri-hospital-line text-sm" style={{ color: '#94a3b8' }} />
                </div>
                <input
                  value={osgbAd}
                  onChange={e => { setOsgbAd(e.target.value); setError(null); }}
                  placeholder="Örn: Sağlıklı İş OSGB Ltd. Şti."
                  className="osgb-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Yetkili Adı Soyadı <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center pointer-events-none">
                  <i className="ri-user-line text-sm" style={{ color: '#94a3b8' }} />
                </div>
                <input
                  value={yetkiliAd}
                  onChange={e => { setYetkiliAd(e.target.value); setError(null); }}
                  placeholder="Örn: Ahmet Yılmaz"
                  className="osgb-input"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-3 rounded-xl p-3.5"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}>
                <i className="ri-error-warning-line text-sm flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                <p className="text-sm" style={{ color: '#dc2626' }}>{error}</p>
              </div>
            )}

            <div className="pt-1">
              <button
                type="submit"
                disabled={loading}
                className="osgb-btn w-full py-4 rounded-xl font-bold text-sm text-white cursor-pointer whitespace-nowrap flex items-center justify-center gap-2.5"
              >
                {loading ? (
                  <><i className="ri-loader-4-line text-base animate-spin" /><span>Oluşturuluyor...</span></>
                ) : (
                  <><i className="ri-arrow-right-line text-base" /><span>OSGB Panelime Git</span></>
                )}
              </button>
            </div>
          </form>

          {/* What you get — tablo listesi */}
          <div className="mt-6 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            <div className="px-4 py-2.5" style={{ background: 'var(--bg-item)', borderBottom: '1px solid var(--border-subtle)' }}>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
                Kurulum Sonrası Yapabilecekleriniz
              </p>
            </div>
            {[
              { icon: 'ri-building-2-line', text: 'Müşteri firma ekle ve yönet' },
              { icon: 'ri-user-star-line', text: 'Gezici uzman ata ve takip et' },
              { icon: 'ri-map-pin-line', text: 'Saha denetim ziyaretlerini görüntüle' },
              { icon: 'ri-file-shield-2-line', text: 'ISG belge ve evrak arşivi oluştur' },
            ].map((item, idx, arr) => (
              <div key={item.text}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: idx < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                  <i className={`${item.icon} text-sm`} style={{ color: '#10B981' }} />
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.text}</p>
                <i className="ri-check-line text-xs ml-auto" style={{ color: '#10B981' }} />
              </div>
            ))}
          </div>

          {/* Mobile feature list */}
          <div className="lg:hidden mt-5 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            <div className="px-4 py-2.5" style={{ background: 'var(--bg-item)', borderBottom: '1px solid var(--border-subtle)' }}>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
                OSGB Panel Kapsamı
              </p>
            </div>
            {OSGB_FEATURES.map((f, idx) => (
              <div key={f.label}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: idx < OSGB_FEATURES.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                  <i className={`${f.icon} text-sm`} style={{ color: '#10B981' }} />
                </div>
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{f.label}</p>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-[11px] mt-7" style={{ color: 'var(--text-faint)' }}>
            ISG Denetim &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
