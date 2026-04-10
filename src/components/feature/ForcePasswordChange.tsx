import { useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { useApp } from '../../store/AppContext';
import { logActivity } from '../../utils/activityLog';

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
  const { clearMustChangePassword, theme, org } = useApp();
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
    // Log password change
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
    // Kısa bir bekleme sonrası sayfayı yenile — edge function cache'ini bypass et
    setTimeout(() => window.location.reload(), 400);
  };

  const inputStyle: React.CSSProperties = {
    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)',
    border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(15,23,42,0.15)',
    borderRadius: '12px',
    color: isDark ? '#E2E8F0' : '#0F172A',
    outline: 'none',
    width: '100%',
    padding: '12px 14px',
    fontSize: '14px',
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 space-y-6"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, #0D1526 0%, #0A0F1E 100%)'
            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          border: '1px solid rgba(99,102,241,0.25)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div className="text-center space-y-3">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #EA580C)', boxShadow: '0 8px 25px rgba(245,158,11,0.4)' }}
          >
            <i className="ri-lock-password-line text-white text-2xl" />
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ color: isDark ? '#E2E8F0' : '#0F172A' }}>
              Şifrenizi Güncelleyin
            </h2>
            <p className="text-sm mt-1" style={{ color: isDark ? '#64748B' : '#64748B' }}>
              Güvenliğiniz için geçici şifrenizi değiştirmeniz gerekmektedir.
            </p>
          </div>
        </div>

        {/* Info banner */}
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}
        >
          <i className="ri-information-line text-sm flex-shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
          <p className="text-xs leading-relaxed" style={{ color: '#F59E0B' }}>
            Hesabınız yönetici tarafından oluşturuldu. Panele erişmek için kalıcı bir şifre belirlemeniz gerekiyor.
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* New Password */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: isDark ? '#94A3B8' : '#475569' }}>
              Yeni Şifre
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Yeni şifrenizi girin (min. 8 karakter)"
                style={{ ...inputStyle, paddingRight: '44px', borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.15)', color: isDark ? '#E2E8F0' : '#0F172A', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)' }}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center cursor-pointer"
                style={{ color: '#64748B' }}
              >
                <i className={`${showNew ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`} />
              </button>
            </div>

            {/* Strength indicator */}
            {newPassword && (
              <div className="mt-2 space-y-1.5">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div
                      key={i}
                      className="h-1.5 flex-1 rounded-full transition-all duration-300"
                      style={{ background: i <= strength.score ? strength.color : 'rgba(255,255,255,0.1)' }}
                    />
                  ))}
                </div>
                <p className="text-xs font-medium" style={{ color: strength.color }}>{strength.label}</p>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: isDark ? '#94A3B8' : '#475569' }}>
              Şifre Tekrar
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Şifrenizi tekrar girin"
                style={{
                  ...inputStyle,
                  paddingRight: '44px',
                  borderColor: passwordsMatch ? 'rgba(34,197,94,0.5)' : passwordsMismatch ? 'rgba(239,68,68,0.5)' : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.15)'),
                  color: isDark ? '#E2E8F0' : '#0F172A',
                  background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)',
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
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="w-5 h-5 flex items-center justify-center cursor-pointer"
                  style={{ color: '#64748B' }}
                >
                  <i className={`${showConfirm ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`} />
                </button>
              </div>
            </div>
            {passwordsMismatch && <p className="text-xs mt-1" style={{ color: '#EF4444' }}>Şifreler eşleşmiyor</p>}
            {passwordsMatch && <p className="text-xs mt-1" style={{ color: '#22C55E' }}>Şifreler eşleşiyor</p>}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#F87171' }}
          >
            <i className="ri-error-warning-line flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleSubmit}
            disabled={loading || !newPassword || !confirmPassword}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white whitespace-nowrap cursor-pointer transition-all"
            style={{
              background: 'linear-gradient(135deg, #F59E0B, #EA580C)',
              boxShadow: '0 4px 15px rgba(245,158,11,0.4)',
              opacity: (loading || !newPassword || !confirmPassword) ? 0.6 : 1,
              cursor: (loading || !newPassword || !confirmPassword) ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? (
              <><i className="ri-loader-4-line animate-spin" />Güncelleniyor...</>
            ) : (
              <><i className="ri-lock-password-line" />Şifremi Güncelle ve Panele Gir</>
            )}
          </button>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap cursor-pointer transition-all"
            style={{ color: '#64748B', background: 'transparent', border: '1px solid rgba(100,116,139,0.2)' }}
          >
            <i className="ri-logout-box-line" />
            Çıkış Yap
          </button>
        </div>
      </div>
    </div>
  );
}
