import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/store/AuthContext';
import { supabase } from '@/lib/supabase';

type SettingsTab = 'profil' | 'guvenlik' | 'ekip' | 'sistem';

interface NotifState { type: 'success' | 'error'; message: string; }

interface OsgbMember {
  user_id: string;
  display_name: string;
  email: string;
  osgb_role: string;
  is_active: boolean;
  created_at: string;
  active_firm_name: string | null;
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

const NAV_ITEMS: { id: SettingsTab; label: string; icon: string; desc: string }[] = [
  { id: 'profil',   label: 'Profil',        icon: 'ri-user-settings-line',  desc: 'Hesap bilgileri' },
  { id: 'guvenlik', label: 'Güvenlik',      icon: 'ri-shield-keyhole-line', desc: 'Şifre yönetimi' },
  { id: 'ekip',     label: 'Ekip Yönetimi', icon: 'ri-group-line',          desc: 'OSGB üyeleri ve uzmanlar' },
  { id: 'sistem',   label: 'Sistem',        icon: 'ri-information-line',    desc: 'Versiyon ve OSGB bilgisi' },
];

interface OsgbSettingsProps {
  orgId: string;
  orgName: string;
  firmaCount: number;
  uzmanCount: number;
}

export default function OsgbSettings({ orgId, orgName, firmaCount, uzmanCount }: OsgbSettingsProps) {
  const { user, updatePassword } = useAuth();

  const [activeTab, setActiveTab] = useState<SettingsTab>('profil');

  // ── Profile ──
  const [displayName, setDisplayName] = useState(user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileNotif, setProfileNotif] = useState<NotifState | null>(null);

  // ── Password ──
  const [pwdData, setPwdData] = useState({ newPwd: '', confirmPwd: '' });
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdNotif, setPwdNotif] = useState<NotifState | null>(null);
  const pwdStrength = getPasswordStrength(pwdData.newPwd);
  const passwordsMatch = !!(pwdData.newPwd && pwdData.confirmPwd && pwdData.newPwd === pwdData.confirmPwd);
  const passwordsMismatch = !!(pwdData.confirmPwd && pwdData.newPwd !== pwdData.confirmPwd);

  // ── Team ──
  const [members, setMembers] = useState<OsgbMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [toggleLoadingId, setToggleLoadingId] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!orgId) return;
    setTeamLoading(true);
    try {
      const { data } = await supabase
        .from('user_organizations')
        .select('user_id, display_name, email, osgb_role, is_active, created_at, active_firm_id')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      const enriched: OsgbMember[] = await Promise.all(
        (data ?? []).map(async m => {
          let active_firm_name: string | null = null;
          if (m.active_firm_id) {
            const { data: f } = await supabase.from('organizations').select('name').eq('id', m.active_firm_id).maybeSingle();
            active_firm_name = f?.name ?? null;
          }
          return { ...m, active_firm_name };
        })
      );
      setMembers(enriched);
    } finally {
      setTeamLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (activeTab === 'ekip') fetchMembers();
  }, [activeTab, fetchMembers]);

  const handleToggleActive = async (member: OsgbMember) => {
    setToggleLoadingId(member.user_id);
    try {
      await supabase
        .from('user_organizations')
        .update({ is_active: !member.is_active })
        .eq('user_id', member.user_id)
        .eq('organization_id', orgId);
      setMembers(prev => prev.map(m => m.user_id === member.user_id ? { ...m, is_active: !m.is_active } : m));
    } finally {
      setToggleLoadingId(null);
    }
  };

  const handleProfileSave = async () => {
    if (!displayName.trim()) { setProfileNotif({ type: 'error', message: 'Ad Soyad boş olamaz.' }); return; }
    setProfileLoading(true);
    setProfileNotif(null);
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: displayName.trim() } });
      if (error) throw error;
      // user_organizations tablosunu da güncelle
      await supabase.from('user_organizations').update({ display_name: displayName.trim() }).eq('user_id', user!.id).eq('organization_id', orgId);
      setProfileNotif({ type: 'success', message: 'Profil bilgileri güncellendi.' });
    } catch {
      setProfileNotif({ type: 'error', message: 'Güncelleme sırasında hata oluştu.' });
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    setPwdNotif(null);
    if (!pwdData.newPwd) { setPwdNotif({ type: 'error', message: 'Yeni şifre boş bırakılamaz.' }); return; }
    if (pwdData.newPwd.length < 6) { setPwdNotif({ type: 'error', message: 'Şifre en az 6 karakter olmalıdır.' }); return; }
    if (pwdData.newPwd !== pwdData.confirmPwd) { setPwdNotif({ type: 'error', message: 'Şifreler eşleşmiyor.' }); return; }
    setPwdLoading(true);
    const result = await updatePassword(pwdData.newPwd);
    if (result.error) {
      setPwdNotif({ type: 'error', message: result.error });
    } else {
      setPwdNotif({ type: 'success', message: 'Şifreniz başarıyla güncellendi.' });
      setPwdData({ newPwd: '', confirmPwd: '' });
    }
    setPwdLoading(false);
  };

  // ── Styles ──
  const inputStyle: React.CSSProperties = {
    background: 'rgba(15,23,42,0.04)', border: '1px solid rgba(15,23,42,0.12)',
    borderRadius: '10px', color: '#0F172A', outline: 'none',
    width: '100%', padding: '10px 12px', fontSize: '13px', transition: 'all 0.15s',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '6px',
    color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em',
  };
  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'rgba(16,185,129,0.5)';
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.08)';
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'rgba(15,23,42,0.12)';
    e.currentTarget.style.boxShadow = 'none';
  };

  const Notif = ({ n }: { n: NotifState }) => (
    <div className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
      style={{ background: n.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${n.type === 'success' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
      <i className={`${n.type === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'} text-base flex-shrink-0 mt-0.5`}
        style={{ color: n.type === 'success' ? '#10B981' : '#EF4444' }} />
      <span style={{ color: n.type === 'success' ? '#10B981' : '#F87171' }}>{n.message}</span>
    </div>
  );

  const SectionHeader = ({ icon, iconBg, iconColor, title, desc }: { icon: string; iconBg: string; iconColor: string; title: string; desc: string }) => (
    <div className="flex items-center gap-4 pb-5 mb-6" style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
      <div className="w-11 h-11 flex items-center justify-center rounded-2xl flex-shrink-0" style={{ background: iconBg }}>
        <i className={`${icon} text-lg`} style={{ color: iconColor }} />
      </div>
      <div>
        <h3 className="text-base font-bold" style={{ color: '#0F172A' }}>{title}</h3>
        <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{desc}</p>
      </div>
    </div>
  );

  const roleLabel = (role: string) => {
    if (role === 'osgb_admin') return 'OSGB Admin';
    if (role === 'gezici_uzman') return 'Gezici Uzman';
    return role || 'Üye';
  };
  const roleColor = (role: string) => role === 'osgb_admin' ? '#10B981' : '#8B5CF6';
  const roleBg = (role: string) => role === 'osgb_admin' ? 'rgba(16,185,129,0.1)' : 'rgba(139,92,246,0.1)';

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-120px)]">

      {/* ── LEFT NAV ── */}
      <aside className="w-64 flex-shrink-0 hidden lg:block">
        <div className="sticky top-4 rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #f1f5f9' }}>
          {/* User card */}
          <div className="px-5 py-5" style={{ borderBottom: '1px solid #f1f5f9' }}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-base font-bold text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #10B981, #059669)', boxShadow: '0 4px 14px rgba(16,185,129,0.35)' }}>
                {(displayName || user?.email || 'O').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: '#0F172A' }}>{displayName || user?.email?.split('@')[0]}</p>
                <p className="text-[11px] truncate mt-0.5" style={{ color: '#94A3B8' }}>{user?.email}</p>
                <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1"
                  style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}>
                  OSGB Admin
                </span>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="p-2">
            {NAV_ITEMS.map(item => {
              const isActive = activeTab === item.id;
              return (
                <button key={item.id} onClick={() => setActiveTab(item.id)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left cursor-pointer transition-all duration-150 mb-0.5"
                  style={{ background: isActive ? 'rgba(16,185,129,0.08)' : 'transparent', border: isActive ? '1px solid rgba(16,185,129,0.2)' : '1px solid transparent' }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(15,23,42,0.04)'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
                    style={{ background: isActive ? 'rgba(16,185,129,0.15)' : 'rgba(15,23,42,0.05)' }}>
                    <i className={`${item.icon} text-sm`} style={{ color: isActive ? '#10B981' : '#94A3B8' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold truncate" style={{ color: isActive ? '#059669' : '#0F172A' }}>{item.label}</p>
                    <p className="text-[10px] truncate mt-0.5" style={{ color: '#94A3B8' }}>{item.desc}</p>
                  </div>
                  {isActive && <i className="ri-arrow-right-s-line text-sm flex-shrink-0" style={{ color: '#10B981' }} />}
                </button>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="px-4 py-3 mx-2 mb-2 rounded-xl" style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.12)' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10B981' }} />
              <span className="text-[10px] font-bold" style={{ color: '#10B981' }}>Sistem Aktif</span>
            </div>
            <p className="text-[10px]" style={{ color: '#94A3B8' }}>{orgName}</p>
          </div>
        </div>
      </aside>

      {/* ── MOBILE TAB BAR ── */}
      <div className="lg:hidden w-full overflow-x-auto">
        <div className="flex gap-1 p-1 rounded-xl min-w-max" style={{ background: '#fff', border: '1px solid #f1f5f9' }}>
          {NAV_ITEMS.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap transition-all"
              style={{ background: activeTab === item.id ? 'rgba(16,185,129,0.1)' : 'transparent', color: activeTab === item.id ? '#059669' : '#94A3B8', border: activeTab === item.id ? '1px solid rgba(16,185,129,0.2)' : '1px solid transparent' }}>
              <i className={`${item.icon} text-xs`} />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 min-w-0 w-full">

        {/* ── PROFİL ── */}
        {activeTab === 'profil' && (
          <div className="rounded-2xl p-7" style={{ background: '#fff', border: '1px solid #f1f5f9' }}>
            <SectionHeader icon="ri-user-settings-line" iconBg="rgba(16,185,129,0.1)" iconColor="#10B981" title="Profil Bilgileri" desc="Hesabınıza ait kişisel bilgileri güncelleyin" />

            {/* Avatar card */}
            <div className="flex items-center gap-5 p-5 rounded-2xl mb-7"
              style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.12)' }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #10B981, #059669)', boxShadow: '0 6px 20px rgba(16,185,129,0.35)' }}>
                {(displayName || user?.email || 'O').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold truncate" style={{ color: '#0F172A' }}>{displayName || user?.email?.split('@')[0]}</p>
                <p className="text-sm mt-0.5 truncate" style={{ color: '#64748B' }}>{user?.email}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}>
                    OSGB Admin
                  </span>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1"
                    style={{ background: 'rgba(15,23,42,0.05)', color: '#475569' }}>
                    <i className="ri-building-2-line text-[10px]" />
                    {orgName}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label style={labelStyle}>Ad Soyad</label>
                <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                  style={inputStyle} placeholder="Ad Soyad giriniz" onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div>
                <label style={labelStyle}>E-posta Adresi</label>
                <div className="relative">
                  <input value={user?.email ?? ''} readOnly
                    style={{ ...inputStyle, opacity: 0.55, cursor: 'not-allowed', paddingRight: '36px' }} />
                  <i className="ri-lock-line absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#64748B' }} />
                </div>
                <p className="text-[10px] mt-1.5" style={{ color: '#94A3B8' }}>E-posta Supabase üzerinden yönetilir</p>
              </div>
              <div>
                <label style={labelStyle}>Rol</label>
                <input value="OSGB Admin" readOnly style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }} />
              </div>
              <div>
                <label style={labelStyle}>OSGB Adı</label>
                <input value={orgName} readOnly style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }} />
              </div>
            </div>

            {profileNotif && <div className="mt-5"><Notif n={profileNotif} /></div>}

            <div className="mt-6 flex items-center gap-3">
              <button onClick={handleProfileSave} disabled={profileLoading}
                className="whitespace-nowrap flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer transition-all"
                style={{ background: 'linear-gradient(135deg, #10B981, #059669)', boxShadow: '0 4px 14px rgba(16,185,129,0.3)', opacity: profileLoading ? 0.7 : 1 }}>
                {profileLoading ? <><i className="ri-loader-4-line animate-spin" />Kaydediliyor...</> : <><i className="ri-save-line" />Değişiklikleri Kaydet</>}
              </button>
              <p className="text-xs" style={{ color: '#94A3B8' }}>Son güncelleme: {new Date().toLocaleDateString('tr-TR')}</p>
            </div>
          </div>
        )}

        {/* ── GÜVENLİK ── */}
        {activeTab === 'guvenlik' && (
          <div className="rounded-2xl p-7" style={{ background: '#fff', border: '1px solid #f1f5f9' }}>
            <SectionHeader icon="ri-shield-keyhole-line" iconBg="rgba(234,88,12,0.1)" iconColor="#EA580C" title="Güvenlik Ayarları" desc="Şifrenizi güncelleyin ve hesap güvenliğinizi yönetin" />

            {/* Security cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-7">
              {[
                { icon: 'ri-shield-check-line', label: 'Hesap Korumalı', desc: 'Supabase Auth aktif', color: '#10B981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.15)' },
                { icon: 'ri-lock-2-line', label: 'RLS Aktif', desc: 'Veri izolasyonu sağlandı', color: '#6366F1', bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.15)' },
                { icon: 'ri-building-line', label: 'OSGB İzolasyon', desc: 'OSGB\u0027ye özel erişim', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.15)' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3 p-4 rounded-xl" style={{ background: item.bg, border: `1px solid ${item.border}` }}>
                  <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: `${item.color}18` }}>
                    <i className={`${item.icon} text-base`} style={{ color: item.color }} />
                  </div>
                  <div>
                    <p className="text-xs font-bold" style={{ color: item.color }}>{item.label}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: '#64748B' }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Password form */}
            <div className="p-5 rounded-2xl space-y-5" style={{ background: 'rgba(15,23,42,0.02)', border: '1px solid rgba(15,23,42,0.08)' }}>
              <div className="flex items-center gap-2">
                <i className="ri-lock-password-line text-sm" style={{ color: '#EA580C' }} />
                <h4 className="text-sm font-bold" style={{ color: '#334155' }}>Şifre Değiştir</h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label style={labelStyle}>Yeni Şifre</label>
                  <div className="relative">
                    <input type={showNew ? 'text' : 'password'} value={pwdData.newPwd}
                      onChange={e => setPwdData(p => ({ ...p, newPwd: e.target.value }))}
                      style={{ ...inputStyle, paddingRight: '40px' }} placeholder="Yeni şifrenizi girin"
                      onFocus={onFocus} onBlur={onBlur} />
                    <button type="button" onClick={() => setShowNew(!showNew)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer" style={{ color: '#64748B' }}>
                      <i className={`${showNew ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`} />
                    </button>
                  </div>
                  {pwdData.newPwd && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        {[1,2,3,4,5].map(i => (
                          <div key={i} className="h-1 flex-1 rounded-full transition-all"
                            style={{ background: i <= pwdStrength.score ? pwdStrength.color : 'rgba(15,23,42,0.08)' }} />
                        ))}
                      </div>
                      <p className="text-[11px] font-semibold" style={{ color: pwdStrength.color }}>{pwdStrength.label}</p>
                    </div>
                  )}
                </div>
                <div>
                  <label style={labelStyle}>Şifre Tekrar</label>
                  <div className="relative">
                    <input type={showConfirm ? 'text' : 'password'} value={pwdData.confirmPwd}
                      onChange={e => setPwdData(p => ({ ...p, confirmPwd: e.target.value }))}
                      style={{ ...inputStyle, paddingRight: '64px', borderColor: passwordsMatch ? 'rgba(34,197,94,0.5)' : passwordsMismatch ? 'rgba(239,68,68,0.5)' : undefined }}
                      placeholder="Şifrenizi tekrar girin"
                      onFocus={onFocus} onBlur={e => { e.currentTarget.style.boxShadow = 'none'; }} />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {pwdData.confirmPwd && (
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

              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg" style={{ background: 'rgba(15,23,42,0.03)', border: '1px solid rgba(15,23,42,0.08)' }}>
                <i className="ri-information-line text-sm flex-shrink-0 mt-0.5" style={{ color: '#64748B' }} />
                <p className="text-xs leading-relaxed" style={{ color: '#64748B' }}>
                  En az <strong style={{ color: '#0F172A' }}>6 karakter</strong>. Güvenlik için büyük harf, rakam ve özel karakter önerilir.
                </p>
              </div>

              {pwdNotif && <Notif n={pwdNotif} />}

              <button onClick={handlePasswordChange} disabled={pwdLoading || !pwdData.newPwd}
                className="whitespace-nowrap flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #EA580C, #F97316)', boxShadow: '0 4px 14px rgba(234,88,12,0.3)', opacity: (pwdLoading || !pwdData.newPwd) ? 0.6 : 1 }}>
                {pwdLoading ? <><i className="ri-loader-4-line animate-spin" />Güncelleniyor...</> : <><i className="ri-lock-password-line" />Şifreyi Güncelle</>}
              </button>
            </div>
          </div>
        )}

        {/* ── EKİP YÖNETİMİ ── */}
        {activeTab === 'ekip' && (
          <div className="space-y-5">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Toplam Üye', value: members.length, icon: 'ri-group-line', color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
                { label: 'OSGB Admin', value: members.filter(m => m.osgb_role === 'osgb_admin').length, icon: 'ri-shield-star-line', color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
                { label: 'Gezici Uzman', value: members.filter(m => m.osgb_role === 'gezici_uzman').length, icon: 'ri-user-star-line', color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)' },
                { label: 'Aktif Üye', value: members.filter(m => m.is_active).length, icon: 'ri-user-follow-line', color: '#06B6D4', bg: 'rgba(6,182,212,0.08)' },
              ].map(s => (
                <div key={s.label} className="rounded-2xl p-4" style={{ background: '#fff', border: '1px solid #f1f5f9' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2" style={{ background: s.bg }}>
                    <i className={`${s.icon} text-base`} style={{ color: s.color }} />
                  </div>
                  <p className="text-xl font-extrabold" style={{ color: '#0F172A' }}>{s.value}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: '#94A3B8' }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Members list */}
            <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #f1f5f9' }}>
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #f1f5f9' }}>
                <h3 className="text-sm font-bold" style={{ color: '#0F172A' }}>OSGB Üyeleri</h3>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(16,185,129,0.08)', color: '#059669' }}>
                  {members.length} üye
                </span>
              </div>

              {teamLoading ? (
                <div className="flex items-center justify-center py-12 gap-2" style={{ color: '#94A3B8' }}>
                  <i className="ri-loader-4-line animate-spin text-lg" style={{ color: '#10B981' }} />
                  <span className="text-sm">Yükleniyor...</span>
                </div>
              ) : members.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.08)' }}>
                    <i className="ri-group-line text-xl" style={{ color: '#10B981' }} />
                  </div>
                  <p className="text-sm" style={{ color: '#94A3B8' }}>Henüz üye bulunamadı</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {members.map(member => (
                    <div key={member.user_id} className="flex items-center gap-4 px-5 py-4 transition-all"
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f8fafc'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                        style={{ background: member.is_active ? 'linear-gradient(135deg, #10B981, #059669)' : 'linear-gradient(135deg, #94a3b8, #64748b)' }}>
                        {(member.display_name || member.email || '?').charAt(0).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold truncate" style={{ color: '#0F172A' }}>{member.display_name || '—'}</p>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: roleBg(member.osgb_role), color: roleColor(member.osgb_role) }}>
                            {roleLabel(member.osgb_role)}
                          </span>
                        </div>
                        <p className="text-xs truncate mt-0.5" style={{ color: '#94A3B8' }}>{member.email}</p>
                        {member.active_firm_name && (
                          <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: '#64748B' }}>
                            <i className="ri-building-2-line text-[10px]" style={{ color: '#10B981' }} />
                            {member.active_firm_name}
                          </p>
                        )}
                      </div>

                      {/* Status + toggle */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-[10px] font-semibold px-2 py-1 rounded-full hidden sm:inline-flex"
                          style={{ background: member.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.1)', color: member.is_active ? '#10B981' : '#94A3B8' }}>
                          {member.is_active ? 'Aktif' : 'Pasif'}
                        </span>
                        <button
                          onClick={() => handleToggleActive(member)}
                          disabled={toggleLoadingId === member.user_id}
                          title={member.is_active ? 'Pasif yap' : 'Aktif yap'}
                          className="w-10 h-5 rounded-full relative cursor-pointer transition-all duration-300 flex-shrink-0 disabled:opacity-50"
                          style={{ background: member.is_active ? 'linear-gradient(135deg, #10B981, #059669)' : 'rgba(15,23,42,0.15)' }}
                        >
                          {toggleLoadingId === member.user_id ? (
                            <span className="absolute inset-0 flex items-center justify-center">
                              <i className="ri-loader-4-line animate-spin text-[10px] text-white" />
                            </span>
                          ) : (
                            <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-300"
                              style={{ left: member.is_active ? 'calc(100% - 18px)' : '2px', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SİSTEM ── */}
        {activeTab === 'sistem' && (
          <div className="space-y-5">
            <div className="rounded-2xl p-7" style={{ background: '#fff', border: '1px solid #f1f5f9' }}>
              <SectionHeader icon="ri-information-line" iconBg="rgba(100,116,139,0.1)" iconColor="#64748B" title="Sistem Bilgisi" desc="Uygulama versiyonu ve OSGB teknik detayları" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-7">
                {[
                  { label: 'Sistem Adı', value: 'ISG Denetim', icon: 'ri-shield-star-line', color: '#10B981' },
                  { label: 'Versiyon', value: '2.0.0', icon: 'ri-code-s-slash-line', color: '#059669' },
                  { label: 'Panel Tipi', value: 'OSGB Yönetim Paneli', icon: 'ri-building-4-line', color: '#06B6D4' },
                  { label: 'Auth Sistemi', value: 'Supabase Auth', icon: 'ri-lock-2-line', color: '#34D399' },
                  { label: 'Veritabanı', value: 'PostgreSQL (Supabase)', icon: 'ri-database-2-line', color: '#8B5CF6' },
                  { label: 'Güvenlik', value: 'RLS + JWT', icon: 'ri-shield-check-line', color: '#4ADE80' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'rgba(15,23,42,0.03)', border: '1px solid rgba(15,23,42,0.07)' }}>
                    <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: `${item.color}15` }}>
                      <i className={`${item.icon} text-sm`} style={{ color: item.color }} />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>{item.label}</p>
                      <p className="text-sm font-bold mt-0.5" style={{ color: '#0F172A' }}>{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* OSGB bilgisi */}
            <div className="rounded-2xl p-7" style={{ background: '#fff', border: '1px solid #f1f5f9' }}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ background: 'rgba(16,185,129,0.1)' }}>
                  <i className="ri-building-2-line text-lg" style={{ color: '#10B981' }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: '#0F172A' }}>OSGB Bilgileri</h3>
                  <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>Organizasyon ve kapsam detayları</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                {[
                  { label: 'OSGB Adı', value: orgName, icon: 'ri-building-4-line', color: '#10B981' },
                  { label: 'Müşteri Firma', value: String(firmaCount), icon: 'ri-building-2-line', color: '#06B6D4' },
                  { label: 'Gezici Uzman', value: String(uzmanCount), icon: 'ri-user-star-line', color: '#8B5CF6' },
                  { label: 'Admin', value: String(members.filter(m => m.osgb_role === 'osgb_admin').length || 1), icon: 'ri-shield-star-line', color: '#F59E0B' },
                ].map(s => (
                  <div key={s.label} className="p-4 rounded-xl text-center" style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.12)' }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ background: `${s.color}15` }}>
                      <i className={`${s.icon} text-base`} style={{ color: s.color }} />
                    </div>
                    <p className="text-lg font-extrabold" style={{ color: '#0F172A' }}>{s.value}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: '#94A3B8' }}>{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.12)' }}>
                <span className="w-2 h-2 rounded-full mt-1 flex-shrink-0 animate-pulse" style={{ background: '#10B981' }} />
                <div>
                  <p className="text-xs font-semibold" style={{ color: '#059669' }}>OSGB sistemi aktif çalışıyor</p>
                  <p className="text-[10px] mt-0.5" style={{ color: '#64748B' }}>Tüm gezici uzmanlar ve müşteri firmalar senkronize.</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
