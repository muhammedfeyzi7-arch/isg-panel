import { useState, useRef, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import TeamMembersSection from './components/TeamMembersSection';
import ActivityLogSection from './components/ActivityLogSection';
import RestoreBackup from './components/RestoreBackup';

type SettingsTab = 'profil' | 'guvenlik' | 'ekip' | 'islem-kayitlari' | 'yedekleme' | 'sistem';

interface NotifState {
  type: 'success' | 'error';
  message: string;
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

const NAV_ITEMS: { id: SettingsTab; label: string; icon: string; desc: string; adminOnly?: boolean }[] = [
  { id: 'profil',          label: 'Profil',           icon: 'ri-user-settings-line',   desc: 'Ad, rol ve hesap bilgileri' },
  { id: 'guvenlik',        label: 'Güvenlik',          icon: 'ri-shield-keyhole-line',  desc: 'Şifre ve oturum yönetimi' },
  { id: 'ekip',            label: 'Ekip Yönetimi',    icon: 'ri-group-line',           desc: 'Kullanıcılar ve roller', adminOnly: true },
  { id: 'islem-kayitlari', label: 'İşlem Kayıtları',  icon: 'ri-history-line',         desc: 'Tüm aktivite geçmişi' },
  { id: 'yedekleme',       label: 'Yedekleme',         icon: 'ri-database-2-line',      desc: 'Veri yedekleme ve geri yükleme' },
  { id: 'sistem',          label: 'Sistem',            icon: 'ri-information-line',     desc: 'Versiyon ve sistem bilgisi' },
];

export default function SettingsPage() {
  const {
    currentUser, updateCurrentUser, addToast, theme,
    firmalar, personeller, evraklar, egitimler, muayeneler,
    uygunsuzluklar, ekipmanlar, gorevler, tutanaklar,
    org, orgLoading,
  } = useApp();
  const { updatePassword, user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<SettingsTab>('profil');
  const [backupLoading, setBackupLoading] = useState(false);

  // Profile
  const [profileData, setProfileData] = useState({ ad: currentUser.ad, rol: currentUser.rol });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileNotif, setProfileNotif] = useState<NotifState | null>(null);

  // Password
  const [pwdData, setPwdData] = useState({ newPassword: '', confirmPassword: '' });
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdNotif, setPwdNotif] = useState<NotifState | null>(null);

  const pwdStrength = getPasswordStrength(pwdData.newPassword);
  const passwordsMatch = !!(pwdData.newPassword && pwdData.confirmPassword && pwdData.newPassword === pwdData.confirmPassword);
  const passwordsMismatch = !!(pwdData.confirmPassword && pwdData.newPassword !== pwdData.confirmPassword);

  // Filter nav items based on role
  const visibleNavItems = NAV_ITEMS.filter(item => {
    if (item.adminOnly && org?.role !== 'admin') return false;
    return true;
  });

  // Ensure activeTab is valid after org loads
  useEffect(() => {
    if (!orgLoading && org?.role !== 'admin' && activeTab === 'ekip') {
      setActiveTab('profil');
    }
  }, [orgLoading, org?.role, activeTab]);

  // ── Theme tokens ──
  const bg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.85)';
  const border = isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(15,23,42,0.1)';
  const nameColor = isDark ? '#E2E8F0' : '#0F172A';
  const subColor = isDark ? '#64748B' : '#94A3B8';
  const sectionTitle = isDark ? '#CBD5E1' : '#334155';
  const divider = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)';

  const inputStyle: React.CSSProperties = {
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
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };
  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)';
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.08)';
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.12)';
    e.currentTarget.style.boxShadow = 'none';
  };

  const handleProfileSave = async () => {
    if (!profileData.ad.trim()) {
      setProfileNotif({ type: 'error', message: 'Ad Soyad alanı boş bırakılamaz.' });
      return;
    }
    setProfileLoading(true);
    setProfileNotif(null);
    try {
      const { supabase } = await import('../../lib/supabase');
      const { error } = await supabase.auth.updateUser({
        data: { full_name: profileData.ad.trim(), role: profileData.rol },
      });
      if (error) throw error;
      updateCurrentUser({ ...currentUser, ...profileData });
      setProfileNotif({ type: 'success', message: 'Profil bilgileri başarıyla güncellendi.' });
      addToast('Profil güncellendi.', 'success');
    } catch {
      setProfileNotif({ type: 'error', message: 'Profil güncellenirken bir hata oluştu.' });
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    setPwdNotif(null);
    if (!pwdData.newPassword) { setPwdNotif({ type: 'error', message: 'Yeni şifre boş bırakılamaz.' }); return; }
    if (pwdData.newPassword.length < 6) { setPwdNotif({ type: 'error', message: 'Şifre en az 6 karakter olmalıdır.' }); return; }
    if (pwdData.newPassword !== pwdData.confirmPassword) { setPwdNotif({ type: 'error', message: 'Şifreler eşleşmiyor.' }); return; }
    setPwdLoading(true);
    const result = await updatePassword(pwdData.newPassword);
    if (result.error) {
      setPwdNotif({ type: 'error', message: result.error });
    } else {
      setPwdNotif({ type: 'success', message: 'Şifreniz başarıyla güncellendi.' });
      setPwdData({ newPassword: '', confirmPassword: '' });
      addToast('Şifre güncellendi.', 'success');
    }
    setPwdLoading(false);
  };

  const handleExport = async () => {
    setBackupLoading(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const tarih = new Date().toISOString().slice(0, 10);
      const exportData = {
        exportDate: new Date().toISOString(),
        version: '2.0.0',
        firmalar, personeller, evraklar, egitimler,
        muayeneler, uygunsuzluklar, ekipmanlar, gorevler, tutanaklar,
      };
      zip.file('isg_veriler.json', JSON.stringify(exportData, null, 2));
      const evrakFolder = zip.folder('evraklar');
      const evrakPromises = evraklar
        .filter(e => !e.silinmis && (e as typeof e & { dosyaUrl?: string }).dosyaUrl)
        .map(async e => {
          const dosyaUrl = (e as typeof e & { dosyaUrl?: string }).dosyaUrl!;
          try {
            const res = await fetch(dosyaUrl);
            if (!res.ok) return;
            const blob = await res.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const ext = e.dosyaAdi?.split('.').pop() || 'pdf';
            const personelAd = personeller.find(p => p.id === e.personelId)?.adSoyad?.replace(/\s+/g, '_') || 'firma';
            evrakFolder?.file(`${personelAd}_${e.ad.replace(/\s+/g, '_')}.${ext}`, arrayBuffer);
          } catch { /* skip */ }
        });
      await Promise.all(evrakPromises);
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `isg_yedek_${tarih}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('ZIP yedek indirildi.', 'success');
    } catch {
      addToast('Yedekleme sırasında hata oluştu.', 'error');
    } finally {
      setBackupLoading(false);
    }
  };

  const aktifFirmalar    = firmalar.filter(f => !f.silinmis).length;
  const aktifPersoneller = personeller.filter(p => !p.silinmis).length;
  const aktifEvraklar    = evraklar.filter(e => !e.silinmis).length;
  const aktifEkipmanlar  = ekipmanlar.filter(e => !e.silinmis).length;

  // ── Notification helper ──
  const Notif = ({ n }: { n: NotifState }) => (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
      style={{
        background: n.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
        border: `1px solid ${n.type === 'success' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
      }}
    >
      <i
        className={`${n.type === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'} text-base flex-shrink-0 mt-0.5`}
        style={{ color: n.type === 'success' ? '#10B981' : '#EF4444' }}
      />
      <span style={{ color: n.type === 'success' ? '#10B981' : '#F87171' }}>{n.message}</span>
    </div>
  );

  // ── Section header ──
  const SectionHeader = ({ icon, iconBg, iconColor, title, desc }: { icon: string; iconBg: string; iconColor: string; title: string; desc: string }) => (
    <div className="flex items-center gap-4 pb-5 mb-6" style={{ borderBottom: `1px solid ${divider}` }}>
      <div className="w-11 h-11 flex items-center justify-center rounded-2xl flex-shrink-0" style={{ background: iconBg }}>
        <i className={`${icon} text-lg`} style={{ color: iconColor }} />
      </div>
      <div>
        <h3 className="text-base font-bold" style={{ color: nameColor }}>{title}</h3>
        <p className="text-xs mt-0.5" style={{ color: subColor }}>{desc}</p>
      </div>
    </div>
  );

  return (
    <div className="flex gap-6 min-h-[calc(100vh-120px)]">

      {/* ══════════════════════════════════════
          LEFT SIDEBAR NAV
      ══════════════════════════════════════ */}
      <aside className="w-64 flex-shrink-0 hidden lg:block">
        <div
          className="sticky top-4 rounded-2xl overflow-hidden"
          style={{ background: bg, border }}
        >
          {/* Sidebar header — user card */}
          <div
            className="px-5 py-5"
            style={{ borderBottom: `1px solid ${divider}` }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-base font-bold text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }}
              >
                {(currentUser.ad || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: nameColor }}>{currentUser.ad || 'Kullanıcı'}</p>
                <p className="text-[11px] truncate mt-0.5" style={{ color: subColor }}>{user?.email || currentUser.email}</p>
                <span
                  className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1"
                  style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)' }}
                >
                  {org?.role === 'admin' ? 'Admin' : org?.role === 'denetci' ? 'Denetçi' : 'Kullanıcı'}
                </span>
              </div>
            </div>
          </div>

          {/* Nav items */}
          <nav className="p-2">
            {visibleNavItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left cursor-pointer transition-all duration-150 mb-0.5"
                  style={{
                    background: isActive
                      ? isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)'
                      : 'transparent',
                    border: isActive
                      ? '1px solid rgba(99,102,241,0.25)'
                      : '1px solid transparent',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)';
                  }}
                  onMouseLeave={e => {
                    if (!isActive) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div
                    className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
                    style={{
                      background: isActive ? 'rgba(99,102,241,0.15)' : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)',
                    }}
                  >
                    <i
                      className={`${item.icon} text-sm`}
                      style={{ color: isActive ? '#818CF8' : subColor }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[12.5px] font-semibold truncate"
                      style={{ color: isActive ? '#818CF8' : nameColor }}
                    >
                      {item.label}
                    </p>
                    <p className="text-[10px] truncate mt-0.5" style={{ color: subColor }}>{item.desc}</p>
                  </div>
                  {isActive && (
                    <i className="ri-arrow-right-s-line text-sm flex-shrink-0" style={{ color: '#818CF8' }} />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar footer */}
          <div className="px-4 py-3 mx-2 mb-2 rounded-xl" style={{ background: isDark ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.12)' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10B981' }} />
              <span className="text-[10px] font-bold" style={{ color: '#10B981' }}>Sistem Aktif</span>
            </div>
            <p className="text-[10px]" style={{ color: subColor }}>ISG Denetim v2.0.0</p>
          </div>
        </div>
      </aside>

      {/* ══════════════════════════════════════
          MOBILE TAB BAR
      ══════════════════════════════════════ */}
      <div className="lg:hidden w-full mb-4 overflow-x-auto">
        <div className="flex gap-1 p-1 rounded-xl min-w-max" style={{ background: bg, border }}>
          {visibleNavItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap transition-all"
              style={{
                background: activeTab === item.id ? 'rgba(99,102,241,0.15)' : 'transparent',
                color: activeTab === item.id ? '#818CF8' : subColor,
                border: activeTab === item.id ? '1px solid rgba(99,102,241,0.25)' : '1px solid transparent',
              }}
            >
              <i className={`${item.icon} text-xs`} />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════════ */}
      <main className="flex-1 min-w-0 space-y-0">

        {/* ── PROFIL TAB ── */}
        {activeTab === 'profil' && (
          <div className="rounded-2xl p-7" style={{ background: bg, border }}>
            <SectionHeader
              icon="ri-user-settings-line"
              iconBg="rgba(99,102,241,0.1)"
              iconColor="#818CF8"
              title="Profil Bilgileri"
              desc="Hesabınıza ait kişisel bilgileri güncelleyin"
            />

            {/* Avatar + info */}
            <div
              className="flex items-center gap-5 p-5 rounded-2xl mb-7"
              style={{ background: isDark ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.12)' }}
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', boxShadow: '0 6px 20px rgba(99,102,241,0.4)' }}
              >
                {(profileData.ad || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold truncate" style={{ color: nameColor }}>{profileData.ad || 'Kullanıcı'}</p>
                <p className="text-sm mt-0.5 truncate" style={{ color: subColor }}>{user?.email || currentUser.email}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)' }}>
                    {profileData.rol}
                  </span>
                  {org?.name && (
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)', color: subColor }}>
                      <i className="ri-building-2-line text-[10px]" />
                      {org.name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label style={labelStyle}>Ad Soyad</label>
                <input
                  value={profileData.ad}
                  onChange={e => setProfileData(p => ({ ...p, ad: e.target.value }))}
                  style={inputStyle}
                  placeholder="Ad Soyad giriniz"
                  onFocus={onFocus}
                  onBlur={onBlur}
                />
              </div>
              <div>
                <label style={labelStyle}>E-posta Adresi</label>
                <div className="relative">
                  <input
                    value={user?.email || currentUser.email}
                    readOnly
                    style={{ ...inputStyle, opacity: 0.55, cursor: 'not-allowed', paddingRight: '36px' }}
                  />
                  <i className="ri-lock-line absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#64748B' }} />
                </div>
                <p className="text-[10px] mt-1.5" style={{ color: subColor }}>E-posta Supabase üzerinden yönetilir</p>
              </div>
              <div className="sm:col-span-2">
                <label style={labelStyle}>Sistem Rolü</label>
                <select
                  value={profileData.rol}
                  onChange={e => setProfileData(p => ({ ...p, rol: e.target.value }))}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                  onFocus={onFocus}
                  onBlur={onBlur}
                >
                  <option value="Admin">Admin</option>
                  <option value="ISG Uzmanı">ISG Uzmanı</option>
                  <option value="Firma Yetkilisi">Firma Yetkilisi</option>
                  <option value="Görüntüleyici">Görüntüleyici</option>
                </select>
              </div>
            </div>

            {profileNotif && <div className="mt-5"><Notif n={profileNotif} /></div>}

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={handleProfileSave}
                disabled={profileLoading}
                className="btn-primary whitespace-nowrap"
                style={{ opacity: profileLoading ? 0.7 : 1 }}
              >
                {profileLoading ? <><i className="ri-loader-4-line animate-spin" />Kaydediliyor...</> : <><i className="ri-save-line" />Değişiklikleri Kaydet</>}
              </button>
              <p className="text-xs" style={{ color: subColor }}>Son güncelleme: {new Date().toLocaleDateString('tr-TR')}</p>
            </div>
          </div>
        )}

        {/* ── GÜVENLİK TAB ── */}
        {activeTab === 'guvenlik' && (
          <div className="rounded-2xl p-7" style={{ background: bg, border }}>
            <SectionHeader
              icon="ri-shield-keyhole-line"
              iconBg="rgba(234,88,12,0.1)"
              iconColor="#EA580C"
              title="Güvenlik Ayarları"
              desc="Şifrenizi güncelleyin ve hesap güvenliğinizi yönetin"
            />

            {/* Security status cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-7">
              {[
                { icon: 'ri-shield-check-line', label: 'Hesap Korumalı', desc: 'Supabase Auth aktif', color: '#10B981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.15)' },
                { icon: 'ri-lock-2-line', label: 'RLS Aktif', desc: 'Veri izolasyonu sağlandı', color: '#6366F1', bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.15)' },
                { icon: 'ri-building-line', label: 'Org. İzolasyon', desc: 'Firmaya özel erişim', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.15)' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3 p-4 rounded-xl" style={{ background: item.bg, border: `1px solid ${item.border}` }}>
                  <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: `${item.color}18` }}>
                    <i className={`${item.icon} text-base`} style={{ color: item.color }} />
                  </div>
                  <div>
                    <p className="text-xs font-bold" style={{ color: item.color }}>{item.label}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: subColor }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Password change */}
            <div
              className="p-5 rounded-2xl space-y-5"
              style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)', border: `1px solid ${divider}` }}
            >
              <div className="flex items-center gap-2 mb-1">
                <i className="ri-lock-password-line text-sm" style={{ color: '#EA580C' }} />
                <h4 className="text-sm font-bold" style={{ color: sectionTitle }}>Şifre Değiştir</h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label style={labelStyle}>Yeni Şifre</label>
                  <div className="relative">
                    <input
                      type={showNew ? 'text' : 'password'}
                      value={pwdData.newPassword}
                      onChange={e => setPwdData(p => ({ ...p, newPassword: e.target.value }))}
                      style={{ ...inputStyle, paddingRight: '40px' }}
                      placeholder="Yeni şifrenizi girin"
                      onFocus={onFocus}
                      onBlur={onBlur}
                    />
                    <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer" style={{ color: '#64748B' }}>
                      <i className={`${showNew ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`} />
                    </button>
                  </div>
                  {pwdData.newPassword && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
                            style={{ background: i <= pwdStrength.score ? pwdStrength.color : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }} />
                        ))}
                      </div>
                      <p className="text-[11px] font-semibold" style={{ color: pwdStrength.color }}>{pwdStrength.label}</p>
                    </div>
                  )}
                </div>

                <div>
                  <label style={labelStyle}>Şifre Tekrar</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={pwdData.confirmPassword}
                      onChange={e => setPwdData(p => ({ ...p, confirmPassword: e.target.value }))}
                      style={{
                        ...inputStyle,
                        paddingRight: '64px',
                        borderColor: passwordsMatch ? 'rgba(34,197,94,0.5)' : passwordsMismatch ? 'rgba(239,68,68,0.5)' : undefined,
                      }}
                      placeholder="Şifrenizi tekrar girin"
                      onFocus={onFocus}
                      onBlur={e => { e.currentTarget.style.boxShadow = 'none'; }}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {pwdData.confirmPassword && (
                        <i className={`text-sm ${passwordsMatch ? 'ri-checkbox-circle-line' : passwordsMismatch ? 'ri-close-circle-line' : ''}`}
                          style={{ color: passwordsMatch ? '#22C55E' : '#EF4444' }} />
                      )}
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="cursor-pointer" style={{ color: '#64748B' }}>
                        <i className={`${showConfirm ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`} />
                      </button>
                    </div>
                  </div>
                  {passwordsMismatch && <p className="text-[11px] mt-1" style={{ color: '#EF4444' }}>Şifreler eşleşmiyor</p>}
                  {passwordsMatch && <p className="text-[11px] mt-1" style={{ color: '#22C55E' }}>Şifreler eşleşiyor</p>}
                </div>
              </div>

              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.04)', border: `1px solid ${divider}` }}>
                <i className="ri-information-line text-sm flex-shrink-0 mt-0.5" style={{ color: '#64748B' }} />
                <p className="text-xs leading-relaxed" style={{ color: subColor }}>
                  En az <strong style={{ color: nameColor }}>6 karakter</strong>. Güvenlik için büyük harf, rakam ve özel karakter önerilir.
                </p>
              </div>

              {pwdNotif && <Notif n={pwdNotif} />}

              <button
                onClick={handlePasswordChange}
                disabled={pwdLoading || !pwdData.newPassword}
                className="whitespace-nowrap flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #EA580C, #F97316)',
                  boxShadow: '0 4px 14px rgba(234,88,12,0.3)',
                  opacity: (pwdLoading || !pwdData.newPassword) ? 0.6 : 1,
                  cursor: (pwdLoading || !pwdData.newPassword) ? 'not-allowed' : 'pointer',
                }}
              >
                {pwdLoading ? <><i className="ri-loader-4-line animate-spin" />Güncelleniyor...</> : <><i className="ri-lock-password-line" />Şifreyi Güncelle</>}
              </button>
            </div>
          </div>
        )}

        {/* ── EKİP TAB ── */}
        {activeTab === 'ekip' && (
          <div>
            <TeamMembersSection />
          </div>
        )}

        {/* ── İŞLEM KAYITLARI TAB ── */}
        {activeTab === 'islem-kayitlari' && (
          <div>
            <ActivityLogSection />
          </div>
        )}

        {/* ── YEDEKLEME TAB ── */}
        {activeTab === 'yedekleme' && (
          <div className="space-y-5">
            {/* Backup card */}
            <div className="rounded-2xl p-7" style={{ background: bg, border }}>
              <SectionHeader
                icon="ri-database-2-line"
                iconBg="rgba(16,185,129,0.1)"
                iconColor="#10B981"
                title="Veri Yedekleme"
                desc="Tüm verilerinizi ZIP formatında indirin"
              />

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">
                {[
                  { label: 'Firma', count: aktifFirmalar, icon: 'ri-building-2-line', color: '#60A5FA' },
                  { label: 'Personel', count: aktifPersoneller, icon: 'ri-team-line', color: '#4ADE80' },
                  { label: 'Evrak', count: aktifEvraklar, icon: 'ri-file-list-3-line', color: '#C084FC' },
                  { label: 'Ekipman', count: aktifEkipmanlar, icon: 'ri-tools-line', color: '#34D399' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3 p-4 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)', border: `1px solid ${divider}` }}>
                    <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: `${item.color}15` }}>
                      <i className={`${item.icon} text-sm`} style={{ color: item.color }} />
                    </div>
                    <div>
                      <p className="text-xl font-bold" style={{ color: nameColor }}>{item.count}</p>
                      <p className="text-[10px]" style={{ color: subColor }}>{item.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Download button */}
              <div
                className="flex items-center justify-between p-5 rounded-2xl"
                style={{ background: isDark ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.15)' }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: 'rgba(16,185,129,0.12)' }}>
                    <i className="ri-download-cloud-2-line text-base" style={{ color: '#10B981' }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: nameColor }}>ZIP Yedek İndir</p>
                    <p className="text-xs mt-0.5" style={{ color: subColor }}>Tüm veriler + evrak dosyaları dahil</p>
                    <p className="text-[10px] mt-1 flex items-center gap-1" style={{ color: subColor }}>
                      <i className="ri-calendar-check-line" />
                      Son yedek: {new Date().toLocaleDateString('tr-TR')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleExport}
                  disabled={backupLoading}
                  className="whitespace-nowrap flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer transition-all"
                  style={{ background: 'linear-gradient(135deg, #10B981, #059669)', boxShadow: '0 4px 14px rgba(16,185,129,0.3)', opacity: backupLoading ? 0.7 : 1 }}
                >
                  <i className={backupLoading ? 'ri-loader-4-line animate-spin' : 'ri-download-2-line'} />
                  {backupLoading ? 'Hazırlanıyor...' : 'İndir'}
                </button>
              </div>

              <input ref={fileInputRef} type="file" accept=".json" className="hidden" />
            </div>

            {/* Restore card */}
            <RestoreBackup />
          </div>
        )}

        {/* ── SİSTEM TAB ── */}
        {activeTab === 'sistem' && (
          <div className="rounded-2xl p-7" style={{ background: bg, border }}>
            <SectionHeader
              icon="ri-information-line"
              iconBg="rgba(100,116,139,0.1)"
              iconColor="#64748B"
              title="Sistem Bilgisi"
              desc="Uygulama versiyonu ve teknik detaylar"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-7">
              {[
                { label: 'Sistem Adı', value: 'ISG Denetim', icon: 'ri-shield-star-line', color: '#6366F1' },
                { label: 'Versiyon', value: '2.0.0', icon: 'ri-code-s-slash-line', color: '#10B981' },
                { label: 'Dil', value: 'Türkçe', icon: 'ri-translate-2', color: '#F59E0B' },
                { label: 'Auth Sistemi', value: 'Supabase Auth', icon: 'ri-lock-2-line', color: '#34D399' },
                { label: 'Veritabanı', value: 'PostgreSQL (Supabase)', icon: 'ri-database-2-line', color: '#60A5FA' },
                { label: 'Güvenlik', value: 'RLS + JWT', icon: 'ri-shield-check-line', color: '#4ADE80' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-4 p-4 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)', border: `1px solid ${divider}` }}>
                  <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: `${item.color}15` }}>
                    <i className={`${item.icon} text-sm`} style={{ color: item.color }} />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: subColor }}>{item.label}</p>
                    <p className="text-sm font-bold mt-0.5" style={{ color: nameColor }}>{item.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Org info */}
            {org && (
              <div
                className="p-5 rounded-2xl"
                style={{ background: isDark ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.15)' }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <i className="ri-building-2-line text-sm" style={{ color: '#818CF8' }} />
                  <h4 className="text-sm font-bold" style={{ color: sectionTitle }}>Organizasyon Bilgisi</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: 'Org. Adı', value: org.name || '—' },
                    { label: 'Rolünüz', value: org.role === 'admin' ? 'Admin' : org.role === 'denetci' ? 'Denetçi' : 'Kullanıcı' },
                    { label: 'Org. ID', value: org.id?.slice(0, 8) + '...' },
                    { label: 'Kayıt Tarihi', value: new Date().toLocaleDateString('tr-TR') },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: subColor }}>{item.label}:</span>
                      <span className="text-xs font-semibold" style={{ color: nameColor }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
