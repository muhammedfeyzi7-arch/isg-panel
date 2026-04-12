import { useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { useApp } from '../../store/AppContext';
import { logActivity } from '../../utils/activityLog';
import { supabase } from '../../lib/supabase';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_52.png?v=fb25bed443ccb679f0c66aa2ced3a518';

function getPasswordStrength(pwd: string): { score: number; label: string; color: string } {
  if (!pwd) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { score, label: 'Çok Zayıf', color: '#EF4444' };
  if (score === 2) return { score, label: 'Zayıf', color: '#F97316' };
  if (score === 3) return { score, label: 'Orta', color: '#F59E0B' };
  if (score === 4) return { score, label: 'Güçlü', color: '#22C55E' };
  return { score, label: 'Çok Güçlü', color: '#10B981' };
}

export default function ForcePasswordChange() {
  const { updatePassword, logout, user } = useAuth();
  const { clearMustChangePassword, refetchOrg, theme, org } = useApp();
  const isDark = theme === 'dark';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = getPasswordStrength(newPassword);
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const passwordsMismatch = confirmPassword && newPassword !== confirmPassword;

  const handleSubmit = async () => {
    setError(null);
    if (!newPassword || newPassword.length < 8) {
      setError('Şifre en az 8 karakter olmalıdır.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Şifreler eşleşmiyor.');
      return;
    }
    if (strength.score < 2) {
      setError('Lütfen daha güçlü bir şifre belirleyin.');
      return;
    }

    setLoading(true);
    const result = await updatePassword(newPassword);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    if (user && org) {
      await logActivity({
        organizationId: org.id,
        userId: user.id,
        userEmail: user.email ?? '',
        userName: org.displayName || user.email?.split('@')[0] || 'Bilinmeyen',
        userRole: org.role,
        actionType: 'password_changed',
        module: 'Sistem',
        recordId: user.id,
        description: 'İlk giriş zorunlu şifre değişikliği tamamlandı.',
      });
    }
    await clearMustChangePassword();
    setLoading(false);
    await refetchOrg();
  };

  // theme-aware tokens
  const bg = isDark
    ? 'linear-gradient(160deg, #0c1a2e 0%, #0f2744 50%, #071628 100%)'
    : 'linear-gradient(160deg, #f8fafc 0%, #f1f5f9 100%)';
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : '#ffffff';
  const cardBorder = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.1)';
  const inputBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.03)';
  const inputBorder = isDark ? '1.5px solid rgba(255,255,255,0.1)' : '1.5px solid rgba(15,23,42,0.12)';
  const textPrimary = isDark ? '#E2E8F0' : '#0F172A';
  const textMuted = isDark ? '#64748B' : '#94A3B8';
  const textSub = isDark ? '#94A3B8' : '#475569';

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: isDark ? 'rgba(0,0,0,0.88)' : 'rgba(15,23,42,0.6)', backdropFilter: 'blur(14px)' }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        .fpc-wrap { font-family: 'Inter', sans-serif; }
        @keyframes fpcFadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fpc-card { animation: fpcFadeUp 0.45s cubic-bezier(0.22,0.61,0.36,1) forwards; }
        .fpc-input {
          width: 100%;
          outline: none;
          border-radius: 10px;
          font-size: 14px;
          font-family: 'Inter', sans-serif;
          padding: 11px 42px 11px 14px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .fpc-input:focus {
          border-color: #10B981 !important;
          box-shadow: 0 0 0 3px rgba(16,185,129,0.12);
        }
        .fpc-input::placeholder { color: #94a3b8; }
      `}</style>

      <div className="fpc-wrap w-full flex items-center justify-center">
        {/* Left decorative panel — only on large screens */}
        <div
          className="hidden lg:flex flex-col justify-between w-[340px] h-[560px] rounded-l-3xl px-10 py-10 flex-shrink-0 overflow-hidden relative"
          style={{ background: isDark ? 'linear-gradient(160deg,#071628 0%,#0f2744 100%)' : 'linear-gradient(160deg,#0c1a2e 0%,#0f2744 100%)' }}
        >
          {/* Glow */}
          <div className="absolute pointer-events-none"
            style={{ top: '-80px', left: '-60px', width: '400px', height: '400px',
              background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 65%)', filter: 'blur(50px)' }} />

          {/* Brand */}
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.25)' }}>
              <img src={LOGO_URL} alt="ISG" className="w-5 h-5 object-contain" />
            </div>
            <div>
              <p className="text-xs font-bold" style={{ color: '#e2f8fb', letterSpacing: '-0.01em' }}>ISG Denetim</p>
              <p className="text-[10px]" style={{ color: '#4aad8a' }}>İş Sağlığı & Güvenliği</p>
            </div>
          </div>

          {/* Center message */}
          <div className="relative z-10 space-y-5">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.22)' }}>
              <i className="ri-shield-keyhole-line text-2xl" style={{ color: '#34D399' }} />
            </div>
            <div>
              <h3 className="text-lg font-extrabold leading-snug mb-2"
                style={{ color: '#f0f9ff', letterSpacing: '-0.03em' }}>
                Hesabınızı<br />
                <span style={{ background: 'linear-gradient(135deg,#10B981,#34D399)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  güvence altına alın
                </span>
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: '#4a7a6a' }}>
                Yönetici tarafından oluşturulan geçici şifrenizi kalıcı bir şifreyle değiştirin.
              </p>
            </div>

            {/* Tips */}
            <div className="space-y-2">
              {[
                { icon: 'ri-check-line', text: 'En az 8 karakter' },
                { icon: 'ri-check-line', text: 'Büyük harf & rakam içersin' },
                { icon: 'ri-check-line', text: 'Özel karakter ekle (!@#$)' },
              ].map(t => (
                <div key={t.text} className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(16,185,129,0.15)' }}>
                    <i className={`${t.icon} text-[10px]`} style={{ color: '#34D399' }} />
                  </div>
                  <span className="text-xs" style={{ color: '#5a8a7a' }}>{t.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom */}
          <div className="flex items-center gap-2 relative z-10">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10B981' }} />
            <span className="text-[10px]" style={{ color: '#2e6a4e' }}>Güvenli bağlantı aktif</span>
          </div>
        </div>

        {/* Right — form card */}
        <div
          className="fpc-card w-full lg:w-[420px] rounded-3xl lg:rounded-l-none lg:rounded-r-3xl px-8 py-9 flex-shrink-0"
          style={{
            background: cardBg,
            border: cardBorder,
            boxShadow: isDark
              ? '0 32px 80px rgba(0,0,0,0.6)'
              : '0 20px 60px rgba(15,23,42,0.12)',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}
        >
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-2.5 mb-7">
            <img src={LOGO_URL} alt="ISG" className="w-7 h-7 object-contain" />
            <p className="text-sm font-bold" style={{ color: textPrimary }}>ISG Denetim</p>
          </div>

          {/* Header */}
          <div className="mb-7">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 text-xs font-semibold"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#059669' }}>
              <i className="ri-lock-password-line text-xs" />
              Güvenlik Adımı
            </div>
            <h2 className="text-xl font-extrabold mb-1.5" style={{ color: textPrimary, letterSpacing: '-0.03em' }}>
              Şifrenizi Güncelleyin
            </h2>
            <p className="text-sm" style={{ color: textMuted }}>
              Hesabınıza güvenli erişim için kalıcı bir şifre belirleyin.
            </p>
          </div>

          {/* Info banner */}
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl mb-6"
            style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)' }}>
            <i className="ri-information-line text-sm flex-shrink-0 mt-0.5" style={{ color: '#10B981' }} />
            <p className="text-xs leading-relaxed" style={{ color: isDark ? '#6ee7b7' : '#065f46' }}>
              Hesabınız yönetici tarafından oluşturuldu. Panele erişmek için kalıcı şifrenizi belirlemeniz gerekiyor.
            </p>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {/* New password */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: textSub }}>
                Yeni Şifre <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => { setNewPassword(e.target.value); setError(null); }}
                  placeholder="Yeni şifrenizi girin (min. 8 karakter)"
                  className="fpc-input"
                  style={{ background: inputBg, border: inputBorder, color: textPrimary }}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center cursor-pointer"
                  style={{ color: textMuted }}
                >
                  <i className={`${showNew ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`} />
                </button>
              </div>
              {/* Strength */}
              {newPassword && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
                        style={{ background: i <= strength.score ? strength.color : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }} />
                    ))}
                  </div>
                  <p className="text-xs font-medium" style={{ color: strength.color }}>{strength.label}</p>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: textSub }}>
                Şifre Tekrar <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setError(null); }}
                  placeholder="Şifrenizi tekrar girin"
                  className="fpc-input"
                  style={{
                    background: inputBg,
                    border: passwordsMatch
                      ? '1.5px solid rgba(34,197,94,0.5)'
                      : passwordsMismatch
                        ? '1.5px solid rgba(239,68,68,0.5)'
                        : inputBorder,
                    color: textPrimary,
                    paddingRight: '70px',
                  }}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {confirmPassword && (
                    <i
                      className={`text-sm ${passwordsMatch ? 'ri-checkbox-circle-line' : passwordsMismatch ? 'ri-close-circle-line' : ''}`}
                      style={{ color: passwordsMatch ? '#22C55E' : '#EF4444' }}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="w-5 h-5 flex items-center justify-center cursor-pointer"
                    style={{ color: textMuted }}
                  >
                    <i className={`${showConfirm ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`} />
                  </button>
                </div>
              </div>
              {passwordsMismatch && <p className="text-xs mt-1" style={{ color: '#EF4444' }}>Şifreler eşleşmiyor</p>}
              {passwordsMatch && <p className="text-xs mt-1" style={{ color: '#22C55E' }}>Şifreler eşleşiyor ✓</p>}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm mt-4"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)', color: '#F87171' }}>
              <i className="ri-error-warning-line flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3 mt-6">
            <button
              onClick={handleSubmit}
              disabled={loading || !newPassword || !confirmPassword}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white whitespace-nowrap cursor-pointer transition-all"
              style={{
                background: 'linear-gradient(135deg, #059669 0%, #10B981 50%, #34D399 100%)',
                backgroundSize: '200% auto',
                boxShadow: '0 4px 20px rgba(16,185,129,0.35)',
                opacity: (loading || !newPassword || !confirmPassword) ? 0.55 : 1,
                cursor: (loading || !newPassword || !confirmPassword) ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? (
                <><i className="ri-loader-4-line animate-spin" />Güncelleniyor...</>
              ) : (
                <><i className="ri-shield-check-line" />Şifremi Güncelle ve Panele Gir</>
              )}
            </button>

            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap cursor-pointer transition-all"
              style={{
                color: textMuted,
                background: 'transparent',
                border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.1)',
              }}
            >
              <i className="ri-logout-box-line" />
              Çıkış Yap
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
