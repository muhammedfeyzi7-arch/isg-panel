import { useState, useRef, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import TeamMembersSection from './components/TeamMembersSection';
import ActivityLogSection from './components/ActivityLogSection';

interface NotifState {
  type: 'success' | 'error';
  message: string;
  target: 'profile' | 'password';
} 

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

export default function SettingsPage() {
  const { currentUser, updateCurrentUser, addToast, theme, firmalar, personeller, evraklar, egitimler, muayeneler, uygunsuzluklar, ekipmanlar, gorevler, tutanaklar, org, orgLoading, regenerateInviteCode } = useApp();
  const { updatePassword, user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [memberCount, setMemberCount] = useState<number | null>(null);

  useEffect(() => {
    if (!org?.id) return;
    import('../../lib/supabase').then(({ supabase }) => {
      supabase
        .from('user_organizations')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', org.id)
        .then(({ count }) => { if (count !== null) setMemberCount(count); });
    });
  }, [org?.id]);

  const handleCopyCode = () => {
    if (!org?.invite_code) return;
    navigator.clipboard.writeText(org.invite_code).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  };

  const handleRegenCode = async () => {
    setRegenLoading(true);
    const result = await regenerateInviteCode();
    if (result.error) {
      addToast(result.error, 'error');
    } else {
      addToast('Davet kodu yenilendi.', 'success');
    }
    setRegenLoading(false);
  };

  const isDark = theme === 'dark';

  // Profile state
  const [profileData, setProfileData] = useState({ ad: currentUser.ad, rol: currentUser.rol });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileNotif, setProfileNotif] = useState<NotifState | null>(null);

  // Password state
  const [pwdData, setPwdData] = useState({ newPassword: '', confirmPassword: '' });
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdNotif, setPwdNotif] = useState<NotifState | null>(null);

  const pwdStrength = getPasswordStrength(pwdData.newPassword);
  const passwordsMatch = pwdData.newPassword && pwdData.confirmPassword && pwdData.newPassword === pwdData.confirmPassword;
  const passwordsMismatch = pwdData.confirmPassword && pwdData.newPassword !== pwdData.confirmPassword;

  const cardStyle = {
    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.8)',
    border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(15,23,42,0.1)',
    borderRadius: '16px',
  };

  const inputStyle = {
    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)',
    border: isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(15,23,42,0.12)',
    borderRadius: '10px',
    color: isDark ? '#E2E8F0' : '#0F172A',
    outline: 'none',
    width: '100%',
    padding: '10px 12px',
    fontSize: '13px',
    transition: 'all 0.15s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 600,
    marginBottom: '6px',
    color: isDark ? '#94A3B8' : '#475569',
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)';
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)';
  };
  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.12)';
    e.currentTarget.style.boxShadow = 'none';
  };

  const handleExport = () => {
    setBackupLoading(true);
    try {
      const exportData = {
        exportDate: new Date().toISOString(),
        version: '2.0.0',
        firmalar, personeller, evraklar, egitimler,
        muayeneler, uygunsuzluklar, ekipmanlar, gorevler, tutanaklar,
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `isg_yedek_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('Veriler başarıyla dışa aktarıldı.', 'success');
    } catch {
      addToast('Dışa aktarma sırasında hata oluştu.', 'error');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleProfileSave = async () => {
    if (!profileData.ad.trim()) {
      setProfileNotif({ type: 'error', message: 'Ad Soyad alanı boş bırakılamaz.', target: 'profile' });
      return;
    }
    setProfileLoading(true);
    setProfileNotif(null);
    try {
      updateCurrentUser({ ...currentUser, ...profileData });
      setProfileNotif({ type: 'success', message: 'Profil bilgileri başarıyla güncellendi.', target: 'profile' });
      addToast('Profil bilgileri güncellendi.', 'success');
    } catch {
      setProfileNotif({ type: 'error', message: 'Profil güncellenirken bir hata oluştu.', target: 'profile' });
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    setPwdNotif(null);
    if (!pwdData.newPassword) {
      setPwdNotif({ type: 'error', message: 'Yeni şifre alanı boş bırakılamaz.', target: 'password' });
      return;
    }
    if (pwdData.newPassword.length < 6) {
      setPwdNotif({ type: 'error', message: 'Şifre en az 6 karakter olmalıdır.', target: 'password' });
      return;
    }
    if (pwdData.newPassword !== pwdData.confirmPassword) {
      setPwdNotif({ type: 'error', message: 'Şifreler eşleşmiyor. Lütfen tekrar kontrol edin.', target: 'password' });
      return;
    }
    setPwdLoading(true);
    const result = await updatePassword(pwdData.newPassword);
    if (result.error) {
      setPwdNotif({ type: 'error', message: result.error, target: 'password' });
    } else {
      setPwdNotif({ type: 'success', message: 'Şifreniz başarıyla güncellendi.', target: 'password' });
      setPwdData({ newPassword: '', confirmPassword: '' });
      addToast('Şifre başarıyla güncellendi.', 'success');
    }
    setPwdLoading(false);
  };

  const nameColor = isDark ? '#E2E8F0' : '#0F172A';
  const subColor = isDark ? '#64748B' : '#94A3B8';
  const sectionTitleColor = isDark ? '#CBD5E1' : '#334155';

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Page Title */}
      <div>
        <h2 className="text-2xl font-bold" style={{ color: nameColor }}>Ayarlar</h2>
        <p className="text-sm mt-1" style={{ color: subColor }}>Hesap ve profil ayarlarınızı yönetin</p>
      </div>

      {/* ─── Profil Bilgileri ─── */}
      <div style={cardStyle} className="p-6 space-y-5">
        {/* Card Header */}
        <div className="flex items-center gap-3 pb-4" style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(15,23,42,0.08)' }}>
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)', boxShadow: '0 4px 15px rgba(99,102,241,0.4)' }}
          >
            {profileData.ad.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ color: nameColor }}>{profileData.ad}</h3>
            <p className="text-xs mt-0.5" style={{ color: subColor }}>{user?.email || currentUser.email}</p>
            <span
              className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1"
              style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)' }}
            >
              {profileData.rol}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-6 h-6 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(59,130,246,0.1)' }}>
            <i className="ri-user-line text-xs" style={{ color: '#3B82F6' }} />
          </div>
          <h4 className="text-sm font-bold" style={{ color: sectionTitleColor }}>Profil Bilgileri</h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label style={labelStyle}>Ad Soyad</label>
            <input
              value={profileData.ad}
              onChange={e => setProfileData(p => ({ ...p, ad: e.target.value }))}
              style={inputStyle}
              placeholder="Ad Soyad giriniz"
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </div>
          <div>
            <label style={labelStyle}>E-posta Adresi</label>
            <div className="relative">
              <input
                value={user?.email || currentUser.email}
                readOnly
                style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed', paddingRight: '36px' }}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
                <i className="ri-lock-line text-xs" style={{ color: '#64748B' }} />
              </div>
            </div>
            <p className="text-[10px] mt-1" style={{ color: isDark ? '#475569' : '#94A3B8' }}>
              E-posta adresi Supabase üzerinden yönetilir
            </p>
          </div>
          <div className="sm:col-span-2">
            <label style={labelStyle}>Sistem Rolü</label>
            <select
              value={profileData.rol}
              onChange={e => setProfileData(p => ({ ...p, rol: e.target.value }))}
              style={{ ...inputStyle, cursor: 'pointer' }}
              onFocus={handleFocus}
              onBlur={handleBlur}
            >
              <option value="Admin">Admin</option>
              <option value="ISG Uzmanı">ISG Uzmanı</option>
              <option value="Firma Yetkilisi">Firma Yetkilisi</option>
              <option value="Görüntüleyici">Görüntüleyici</option>
            </select>
          </div>
        </div>

        {/* Profile Notification */}
        {profileNotif && (
          <div
            className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
            style={{
              background: profileNotif.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${profileNotif.type === 'success' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
            }}
          >
            <i
              className={`${profileNotif.type === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'} text-base flex-shrink-0 mt-0.5`}
              style={{ color: profileNotif.type === 'success' ? '#10B981' : '#EF4444' }}
            />
            <span style={{ color: profileNotif.type === 'success' ? '#10B981' : '#F87171' }}>
              {profileNotif.message}
            </span>
          </div>
        )}

        <div className="pt-1">
          <button
            onClick={handleProfileSave}
            disabled={profileLoading}
            className="btn-primary whitespace-nowrap"
            style={{ opacity: profileLoading ? 0.7 : 1 }}
          >
            {profileLoading ? (
              <>
                <i className="ri-loader-4-line animate-spin" />
                Kaydediliyor...
              </>
            ) : (
              <>
                <i className="ri-save-line" />
                Değişiklikleri Kaydet
              </>
            )}
          </button>
        </div>
      </div>

      {/* ─── Şifre Değiştirme ─── */}
      <div style={cardStyle} className="p-6 space-y-5">
        <div className="flex items-center gap-3 pb-4" style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(15,23,42,0.08)' }}>
          <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: 'rgba(234,88,12,0.1)', border: '1px solid rgba(234,88,12,0.15)' }}>
            <i className="ri-lock-password-line text-base" style={{ color: '#EA580C' }} />
          </div>
          <div>
            <h4 className="text-sm font-bold" style={{ color: sectionTitleColor }}>Şifre Değiştir</h4>
            <p className="text-xs mt-0.5" style={{ color: subColor }}>Hesabınızın güvenliği için güçlü bir şifre kullanın</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* New Password */}
          <div>
            <label style={labelStyle}>Yeni Şifre</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={pwdData.newPassword}
                onChange={e => setPwdData(p => ({ ...p, newPassword: e.target.value }))}
                style={{ ...inputStyle, paddingRight: '40px' }}
                placeholder="Yeni şifrenizi girin"
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center cursor-pointer transition-opacity"
                style={{ color: '#64748B', opacity: 0.8 }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '0.8'; }}
              >
                <i className={`${showNew ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`} />
              </button>
            </div>

            {/* Password Strength */}
            {pwdData.newPassword && (
              <div className="mt-2 space-y-1.5">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div
                      key={i}
                      className="h-1 flex-1 rounded-full transition-all duration-300"
                      style={{
                        background: i <= pwdStrength.score
                          ? pwdStrength.color
                          : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
                      }}
                    />
                  ))}
                </div>
                <p className="text-[11px] font-medium" style={{ color: pwdStrength.color }}>
                  {pwdStrength.label}
                </p>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label style={labelStyle}>Yeni Şifre (Tekrar)</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={pwdData.confirmPassword}
                onChange={e => setPwdData(p => ({ ...p, confirmPassword: e.target.value }))}
                style={{
                  ...inputStyle,
                  paddingRight: '40px',
                  borderColor: passwordsMatch
                    ? 'rgba(34,197,94,0.5)'
                    : passwordsMismatch
                    ? 'rgba(239,68,68,0.5)'
                    : undefined,
                }}
                placeholder="Yeni şifrenizi tekrar girin"
                onFocus={handleFocus}
                onBlur={e => {
                  e.currentTarget.style.boxShadow = 'none';
                  if (!passwordsMatch && !passwordsMismatch) {
                    e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.12)';
                  }
                }}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {pwdData.confirmPassword && (
                  <i
                    className={`text-sm ${passwordsMatch ? 'ri-checkbox-circle-line' : passwordsMismatch ? 'ri-close-circle-line' : ''}`}
                    style={{ color: passwordsMatch ? '#22C55E' : '#EF4444' }}
                  />
                )}
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="w-5 h-5 flex items-center justify-center cursor-pointer transition-opacity"
                  style={{ color: '#64748B', opacity: 0.8 }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '0.8'; }}
                >
                  <i className={`${showConfirm ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`} />
                </button>
              </div>
            </div>
            {passwordsMismatch && (
              <p className="text-[11px] mt-1" style={{ color: '#EF4444' }}>Şifreler eşleşmiyor</p>
            )}
            {passwordsMatch && (
              <p className="text-[11px] mt-1" style={{ color: '#22C55E' }}>Şifreler eşleşiyor</p>
            )}
          </div>
        </div>

        {/* Password requirements hint */}
        <div
          className="flex items-start gap-2 px-3 py-2.5 rounded-lg"
          style={{
            background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.04)',
            border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(15,23,42,0.07)',
          }}
        >
          <i className="ri-information-line text-sm flex-shrink-0 mt-0.5" style={{ color: '#64748B' }} />
          <p className="text-xs leading-relaxed" style={{ color: isDark ? '#475569' : '#64748B' }}>
            Şifreniz en az <strong style={{ color: isDark ? '#94A3B8' : '#475569' }}>6 karakter</strong> olmalıdır. Güvenlik için büyük harf, rakam ve özel karakter içermesi önerilir.
          </p>
        </div>

        {/* Password Notification */}
        {pwdNotif && (
          <div
            className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
            style={{
              background: pwdNotif.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${pwdNotif.type === 'success' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
            }}
          >
            <i
              className={`${pwdNotif.type === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'} text-base flex-shrink-0 mt-0.5`}
              style={{ color: pwdNotif.type === 'success' ? '#10B981' : '#EF4444' }}
            />
            <span style={{ color: pwdNotif.type === 'success' ? '#10B981' : '#F87171' }}>
              {pwdNotif.message}
            </span>
          </div>
        )}

        <div className="pt-1">
          <button
            onClick={handlePasswordChange}
            disabled={pwdLoading || !pwdData.newPassword}
            className="whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #EA580C, #F97316)',
              boxShadow: '0 4px 12px rgba(234,88,12,0.3)',
              opacity: (pwdLoading || !pwdData.newPassword) ? 0.6 : 1,
              cursor: (pwdLoading || !pwdData.newPassword) ? 'not-allowed' : 'pointer',
            }}
          >
            {pwdLoading ? (
              <>
                <i className="ri-loader-4-line animate-spin" />
                Güncelleniyor...
              </>
            ) : (
              <>
                <i className="ri-lock-password-line" />
                Şifreyi Güncelle
              </>
            )}
          </button>
        </div>
      </div>

      {/* ─── Takım & Organizasyon ─── */}
      {!orgLoading && org && (
        <div style={cardStyle} className="p-6 space-y-5">
          <div className="flex items-center gap-3 pb-4" style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(15,23,42,0.08)' }}>
            <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.15)' }}>
              <i className="ri-building-2-line text-base" style={{ color: '#6366F1' }} />
            </div>
            <div>
              <h4 className="text-sm font-bold" style={{ color: sectionTitleColor }}>Takım &amp; Organizasyon</h4>
              <p className="text-xs mt-0.5" style={{ color: subColor }}>Davet kodu ile ekip arkadaşlarınızı ekleyin</p>
            </div>
          </div>

          {/* Org info */}
          <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: isDark ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.12)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
              <i className="ri-building-2-line text-white text-base" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: nameColor }}>{org.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: org.role === 'admin' ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.15)', color: org.role === 'admin' ? '#F59E0B' : '#818CF8' }}>
                  {org.role === 'admin' ? 'Admin' : 'Üye'}
                </span>
                {memberCount !== null && (
                  <span className="text-xs" style={{ color: subColor }}>
                    <i className="ri-group-line mr-1" />{memberCount} üye
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Invite code */}
          <div>
            <label style={labelStyle}>Davet Kodu</label>
            <p className="text-xs mb-2" style={{ color: subColor }}>Bu kodu ekip arkadaşlarınızla paylaşın. Kayıt olduktan sonra bu kodla organizasyonunuza katılabilirler.</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl font-mono text-lg font-bold tracking-[0.3em]"
                style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)', border: isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(15,23,42,0.12)', color: '#6366F1' }}>
                {org.invite_code}
              </div>
              <button
                onClick={handleCopyCode}
                className="whitespace-nowrap flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer"
                style={{
                  background: codeCopied ? 'rgba(16,185,129,0.15)' : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
                  border: codeCopied ? '1px solid rgba(16,185,129,0.3)' : isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(15,23,42,0.12)',
                  color: codeCopied ? '#10B981' : (isDark ? '#94A3B8' : '#475569'),
                }}
              >
                <i className={codeCopied ? 'ri-checkbox-circle-line' : 'ri-clipboard-line'} />
                {codeCopied ? 'Kopyalandı!' : 'Kopyala'}
              </button>
            </div>
          </div>

          {/* Regenerate (admin only) */}
          {org.role === 'admin' && (
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleRegenCode}
                disabled={regenLoading}
                className="whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer"
                style={{
                  background: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.06)',
                  border: '1px solid rgba(239,68,68,0.15)',
                  color: '#EF4444',
                  opacity: regenLoading ? 0.7 : 1,
                }}
              >
                <i className={regenLoading ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'} />
                Kodu Yenile
              </button>
              <p className="text-xs" style={{ color: subColor }}>Eski kod geçersiz hale gelir.</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Kullanıcı Yönetimi (Admin Only) ─── */}
      <TeamMembersSection />

      {/* ─── İşlem Kayıtları ─── */}
      <ActivityLogSection />

      {/* ─── Veri Güvenliği & Yedekleme ─── */}
      <div style={cardStyle} className="p-6 space-y-5">
        <div className="flex items-center gap-3 pb-4" style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(15,23,42,0.08)' }}>
          <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.15)' }}>
            <i className="ri-shield-check-line text-base" style={{ color: '#10B981' }} />
          </div>
          <div>
            <h4 className="text-sm font-bold" style={{ color: sectionTitleColor }}>Veri Güvenliği &amp; Yedekleme</h4>
            <p className="text-xs mt-0.5" style={{ color: subColor }}>Verilerinizi JSON olarak dışa aktarın ve güvenlik durumunu görün</p>
          </div>
        </div>

        {/* RLS Güvenlik Durumu */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: 'ri-shield-check-line', label: 'RLS Aktif', desc: 'Row Level Security', color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
            { icon: 'ri-lock-2-line', label: 'Auth Korumalı', desc: 'Supabase Auth', color: '#6366F1', bg: 'rgba(99,102,241,0.1)' },
            { icon: 'ri-building-line', label: 'Org. İzolasyon', desc: 'Firmaya Özel Erişim', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: item.bg, border: `1px solid ${item.bg}` }}>
              <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                <i className={`${item.icon} text-base`} style={{ color: item.color }} />
              </div>
              <div>
                <p className="text-xs font-bold" style={{ color: item.color }}>{item.label}</p>
                <p className="text-[10px]" style={{ color: subColor }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* İstatistikler */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center">
          {[
            { label: 'Firma', count: firmalar.filter(f => !f.silinmis).length },
            { label: 'Personel', count: personeller.filter(p => !p.silinmis).length },
            { label: 'Evrak', count: evraklar.filter(e => !e.silinmis).length },
            { label: 'Ekipman', count: ekipmanlar.filter(e => !e.silinmis).length },
            { label: 'Tutanak', count: tutanaklar.length },
          ].map(item => (
            <div key={item.label} className="p-2 rounded-lg" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.04)', border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(15,23,42,0.07)' }}>
              <p className="text-lg font-bold" style={{ color: nameColor }}>{item.count}</p>
              <p className="text-[10px]" style={{ color: subColor }}>{item.label}</p>
            </div>
          ))}
        </div>

        {importMsg && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs" style={{ background: importMsg.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${importMsg.type === 'success' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`, color: importMsg.type === 'success' ? '#10B981' : '#EF4444' }}>
            <i className={importMsg.type === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'} />
            {importMsg.text}
          </div>
        )}

        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={() => setImportMsg({ type: 'info' as 'success', text: 'İçe aktarma yakında eklenecek.' })} />

        <div className="flex flex-wrap gap-3 pt-1">
          <button onClick={handleExport} disabled={backupLoading} className="whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 cursor-pointer" style={{ background: 'linear-gradient(135deg, #10B981, #059669)', boxShadow: '0 4px 12px rgba(16,185,129,0.3)', opacity: backupLoading ? 0.7 : 1 }}>
            <i className={backupLoading ? 'ri-loader-4-line animate-spin' : 'ri-download-2-line'} />
            {backupLoading ? 'Hazırlanıyor...' : 'JSON Yedek İndir'}
          </button>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.04)', border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(15,23,42,0.1)', color: subColor }}>
            <i className="ri-calendar-check-line" />
            Son yedek: {new Date().toLocaleDateString('tr-TR')}
          </div>
        </div>
      </div>

      {/* ─── Sistem Bilgisi ─── */}
      <div style={cardStyle} className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(100,116,139,0.15)' }}>
            <i className="ri-information-line text-xs" style={{ color: '#64748B' }} />
          </div>
          <h4 className="text-sm font-bold" style={{ color: sectionTitleColor }}>Sistem Bilgisi</h4>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Sistem Adı', value: 'ISG Denetim' },
            { label: 'Versiyon', value: '2.0.0' },
            { label: 'Dil', value: 'Türkçe' },
            { label: 'Auth Sistemi', value: 'Supabase Auth', color: '#34D399' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="text-sm" style={{ color: isDark ? '#475569' : '#94A3B8' }}>{item.label}:</span>
              <span className="text-sm font-medium" style={{ color: item.color || (isDark ? '#E2E8F0' : '#0F172A') }}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
