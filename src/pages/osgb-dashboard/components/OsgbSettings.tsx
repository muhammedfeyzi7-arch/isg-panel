import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/store/AuthContext';
import { supabase } from '@/lib/supabase';

const EDGE_URL = 'https://niuvjthvhjbfyuuhoowq.supabase.co/functions/v1/admin-user-management';

type SettingsTab = 'profil' | 'guvenlik' | 'ekip' | 'sistem';

interface NotifState { type: 'success' | 'error'; message: string; }

interface OsgbMember {
  user_id: string;
  display_name: string;
  email: string;
  osgb_role: string;
  role: string;
  is_active: boolean;
  created_at?: string;
  joined_at?: string;
  active_firm_name: string | null;
  active_firm_ids?: string[] | null;
}

interface FirmaOption { id: string; name: string; }

interface AddUserForm {
  display_name: string;
  email: string;
  password: string;
  osgb_role: 'gezici_uzman' | 'isyeri_hekimi';
  active_firm_ids: string[];
}

const emptyForm: AddUserForm = {
  display_name: '', email: '', password: '',
  osgb_role: 'gezici_uzman', active_firm_ids: [],
};

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
  return { score, label: 'Çok Güçlü', color: '#0EA5E9' };
}

const NAV_ITEMS: { id: SettingsTab; label: string; icon: string; desc: string }[] = [
  { id: 'profil',   label: 'Profil',        icon: 'ri-user-settings-line',  desc: 'Hesap bilgileri' },
  { id: 'guvenlik', label: 'Güvenlik',      icon: 'ri-shield-keyhole-line', desc: 'Şifre yönetimi' },
  { id: 'ekip',     label: 'Ekip Yönetimi', icon: 'ri-group-line',          desc: 'OSGB üyeleri ve uzmanlar' },
  { id: 'sistem',   label: 'Sistem',        icon: 'ri-information-line',    desc: 'Versiyon ve OSGB bilgisi' },
];

const OSGB_ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  osgb_admin:    { label: 'OSGB Admin',     color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)',   icon: 'ri-shield-star-line' },
  gezici_uzman:  { label: 'Gezici Uzman',   color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)',   icon: 'ri-user-star-line' },
  isyeri_hekimi: { label: 'İşyeri Hekimi', color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)',   icon: 'ri-heart-pulse-line' },
};

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
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<OsgbMember | null>(null);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Add User ──
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<AddUserForm>(emptyForm);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [firmalar, setFirmalar] = useState<FirmaOption[]>([]);
  const [firmalarLoading, setFirmalarLoading] = useState(false);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 3000);
  };

  const getAuthHeader = useCallback(async (): Promise<string> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) return `Bearer ${token}`;
    const { data: r } = await supabase.auth.refreshSession();
    if (r.session?.access_token) return `Bearer ${r.session.access_token}`;
    throw new Error('Oturum bulunamadı.');
  }, []);

  const fetchMembers = useCallback(async () => {
    if (!orgId) return;
    setTeamLoading(true);
    try {
      const authHeader = await getAuthHeader();
      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ action: 'list', organization_id: orgId }),
      });
      const json = await res.json();
      if (json.members) {
        const enriched: OsgbMember[] = json.members.map((m: {
          user_id: string; display_name?: string; email?: string;
          osgb_role?: string; role?: string; is_active?: boolean;
          joined_at?: string; active_firm_ids?: string[] | null;
        }) => ({
          user_id: m.user_id,
          display_name: m.display_name ?? '',
          email: m.email ?? '',
          osgb_role: m.osgb_role ?? m.role ?? '',
          role: m.role ?? '',
          is_active: m.is_active ?? true,
          joined_at: m.joined_at,
          active_firm_name: null,
          active_firm_ids: m.active_firm_ids ?? null,
        }));
        setMembers(enriched);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Üye listesi yüklenemedi.', 'error');
    } finally {
      setTeamLoading(false);
    }
  }, [orgId, getAuthHeader]);

  // Atanmış firmaları çek (OSGB'nin müşteri firmaları)
  const fetchFirmalar = useCallback(async () => {
    if (!orgId) return;
    setFirmalarLoading(true);
    try {
      // OSGB'nin müşteri firma organizasyonları — osgb_org_id ile bağlı
      // Önce uzmanların active_firm_ids üzerinden çek, yoksa organizations tablosundan
      const { data } = await supabase
        .from('osgb_ziyaretler')
        .select('firma_org_id, firma_ad')
        .eq('osgb_org_id', orgId)
        .not('firma_org_id', 'is', null);

      const seenIds = new Set<string>();
      const list: FirmaOption[] = [];

      (data ?? []).forEach(row => {
        const id = row.firma_org_id as string;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          list.push({ id, name: row.firma_ad as string || id });
        }
      });

      // Eğer ziyaret verisi yoksa veya az ise organizations tablosundan da bak
      if (list.length === 0) {
        // OSGB admin olarak oluşturulan firma org'larını çek
        // FirmalarTab'dan aldığımız verileri kullanabiliriz - organizations tablosu
        const { data: orgs } = await supabase
          .from('organizations')
          .select('id, name')
          .eq('created_by', user?.id)
          .neq('org_type', 'osgb')
          .order('created_at', { ascending: false })
          .limit(100);

        (orgs ?? []).forEach(o => {
          if (!seenIds.has(o.id)) {
            seenIds.add(o.id);
            list.push({ id: o.id, name: o.name });
          }
        });
      }

      // Uzmanların active_firm_ids'inden de çek
      const { data: uzmanRows } = await supabase
        .from('user_organizations')
        .select('active_firm_ids, active_firm_id')
        .eq('organization_id', orgId)
        .in('osgb_role', ['gezici_uzman', 'isyeri_hekimi']);

      const extraIds: string[] = [];
      (uzmanRows ?? []).forEach(u => {
        const ids: string[] = (u.active_firm_ids as string[] | null) ?? (u.active_firm_id ? [u.active_firm_id as string] : []);
        ids.forEach(id => { if (!seenIds.has(id)) { seenIds.add(id); extraIds.push(id); } });
      });

      if (extraIds.length > 0) {
        const { data: extraOrgs } = await supabase
          .from('organizations')
          .select('id, name')
          .in('id', extraIds);
        (extraOrgs ?? []).forEach(o => list.push({ id: o.id, name: o.name }));
      }

      setFirmalar(list.sort((a, b) => a.name.localeCompare(b.name, 'tr')));
    } catch {
      // silent
    } finally {
      setFirmalarLoading(false);
    }
  }, [orgId, user?.id]);

  useEffect(() => {
    if (activeTab === 'ekip') {
      fetchMembers();
      fetchFirmalar();
    }
  }, [activeTab, fetchMembers, fetchFirmalar]);

  const handleToggleActive = async (member: OsgbMember) => {
    setActionLoadingId(member.user_id);
    try {
      const authHeader = await getAuthHeader();
      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({
          action: 'update', organization_id: orgId,
          target_user_id: member.user_id, is_active: !member.is_active,
        }),
      });
      const json = await res.json();
      if (json.error) {
        showToast(json.error, 'error');
      } else {
        showToast(member.is_active ? `${member.display_name || member.email} pasif yapıldı.` : `${member.display_name || member.email} aktif yapıldı.`);
        setMembers(prev => prev.map(m => m.user_id === member.user_id ? { ...m, is_active: !m.is_active } : m));
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Güncelleme sırasında hata oluştu.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteMember = async () => {
    if (!deleteConfirm) return;
    setActionLoadingId(deleteConfirm.user_id + '_delete');
    try {
      const authHeader = await getAuthHeader();
      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ action: 'delete', organization_id: orgId, target_user_id: deleteConfirm.user_id }),
      });
      const json = await res.json();
      if (json.error) {
        showToast(json.error, 'error');
      } else {
        showToast(`${deleteConfirm.display_name || deleteConfirm.email} organizasyondan kaldırıldı.`);
        setDeleteConfirm(null);
        await fetchMembers();
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Silme işlemi sırasında hata oluştu.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAddUser = async () => {
    setAddError(null);
    if (!addForm.display_name.trim()) { setAddError('Ad Soyad zorunludur.'); return; }
    if (!addForm.email.trim() || !addForm.email.includes('@')) { setAddError('Geçerli bir e-posta girin.'); return; }
    if (!addForm.password || addForm.password.length < 8) { setAddError('Şifre en az 8 karakter olmalıdır.'); return; }
    if (addForm.active_firm_ids.length === 0) {
      setAddError(`${addForm.osgb_role === 'isyeri_hekimi' ? 'İşyeri Hekimi' : 'Gezici Uzman'} için en az bir firma seçmelisiniz.`);
      return;
    }

    setAddLoading(true);
    try {
      const authHeader = await getAuthHeader();
      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({
          action: 'create',
          organization_id: orgId,
          email: addForm.email.trim().toLowerCase(),
          password: addForm.password,
          display_name: addForm.display_name.trim(),
          role: 'member',
          osgb_role: addForm.osgb_role,
          active_firm_ids: addForm.active_firm_ids,
          active_firm_id: addForm.active_firm_ids[0] ?? null,
        }),
      });
      const json = await res.json();
      if (json.error) {
        setAddError(json.error);
      } else {
        showToast(`${addForm.display_name} başarıyla eklendi.`);
        setShowAddModal(false);
        setAddForm(emptyForm);
        await fetchMembers();
      }
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Bilinmeyen hata oluştu.');
    } finally {
      setAddLoading(false);
    }
  };

  const toggleFirmaSelection = (firmaId: string) => {
    setAddForm(prev => ({
      ...prev,
      active_firm_ids: prev.active_firm_ids.includes(firmaId)
        ? prev.active_firm_ids.filter(id => id !== firmaId)
        : [...prev.active_firm_ids, firmaId],
    }));
  };

  const handleProfileSave = async () => {
    if (!displayName.trim()) { setProfileNotif({ type: 'error', message: 'Ad Soyad boş olamaz.' }); return; }
    setProfileLoading(true);
    setProfileNotif(null);
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: displayName.trim() } });
      if (error) throw error;
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
    background: 'var(--bg-input)', border: '1.5px solid var(--border-input)',
    borderRadius: '10px', color: 'var(--text-primary)', outline: 'none',
    width: '100%', padding: '10px 12px', fontSize: '13px', transition: 'all 0.15s',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '6px',
    color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
  };
  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'rgba(14,165,233,0.5)';
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.08)';
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'var(--border-input)';
    e.currentTarget.style.boxShadow = 'none';
  };

  const Notif = ({ n }: { n: NotifState }) => (
    <div className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
      style={{ background: n.type === 'success' ? 'rgba(14,165,233,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${n.type === 'success' ? 'rgba(14,165,233,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
      <i className={`${n.type === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'} text-base flex-shrink-0 mt-0.5`}
        style={{ color: n.type === 'success' ? '#0EA5E9' : '#EF4444' }} />
      <span style={{ color: n.type === 'success' ? '#0EA5E9' : '#F87171' }}>{n.message}</span>
    </div>
  );

  const SectionHeader = ({ icon, iconBg, iconColor, title, desc }: { icon: string; iconBg: string; iconColor: string; title: string; desc: string }) => (
    <div className="flex items-center gap-4 pb-5 mb-6" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <div className="w-11 h-11 flex items-center justify-center rounded-2xl flex-shrink-0" style={{ background: iconBg }}>
        <i className={`${icon} text-lg`} style={{ color: iconColor }} />
      </div>
      <div>
        <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
      </div>
    </div>
  );

  const getRoleConf = (member: OsgbMember) => {
    if (member.osgb_role && OSGB_ROLE_CONFIG[member.osgb_role]) return OSGB_ROLE_CONFIG[member.osgb_role];
    return OSGB_ROLE_CONFIG.osgb_admin;
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-120px)]">

      {/* ── LEFT NAV ── */}
      <aside className="w-full lg:w-64 flex-shrink-0 hidden lg:block">
        <div className="sticky top-4 rounded-2xl overflow-hidden isg-card">
          <div className="px-5 py-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-base font-bold text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)', boxShadow: '0 4px 14px rgba(14,165,233,0.35)' }}>
                {(displayName || user?.email || 'O').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{displayName || user?.email?.split('@')[0]}</p>
                <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
                <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1"
                  style={{ background: 'rgba(14,165,233,0.1)', color: '#0EA5E9', border: '1px solid rgba(14,165,233,0.2)' }}>
                  OSGB Admin
                </span>
              </div>
            </div>
          </div>
          <nav className="p-2">
            {NAV_ITEMS.map(item => {
              const isActive = activeTab === item.id;
              return (
                <button key={item.id} onClick={() => setActiveTab(item.id)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left cursor-pointer transition-all duration-150 mb-0.5"
                  style={{ background: isActive ? 'rgba(14,165,233,0.08)' : 'transparent', border: isActive ? '1px solid rgba(14,165,233,0.2)' : '1px solid transparent' }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                  <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
                    style={{ background: isActive ? 'rgba(14,165,233,0.15)' : 'var(--bg-item)' }}>
                    <i className={`${item.icon} text-sm`} style={{ color: isActive ? '#0EA5E9' : 'var(--text-muted)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold truncate" style={{ color: isActive ? '#0284C7' : 'var(--text-primary)' }}>{item.label}</p>
                    <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.desc}</p>
                  </div>
                  {isActive && <i className="ri-arrow-right-s-line text-sm flex-shrink-0" style={{ color: '#0EA5E9' }} />}
                </button>
              );
            })}
          </nav>
          <div className="px-4 py-3 mx-2 mb-2 rounded-xl" style={{ background: 'rgba(14,165,233,0.05)', border: '1px solid rgba(14,165,233,0.12)' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#0EA5E9' }} />
              <span className="text-[10px] font-bold" style={{ color: '#0EA5E9' }}>Sistem Aktif</span>
            </div>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{orgName}</p>
          </div>
        </div>
      </aside>

      {/* ── MOBILE TAB BAR ── */}
      <div className="lg:hidden w-full overflow-x-auto">
        <div className="flex gap-1 p-1 rounded-xl min-w-max isg-card">
          {NAV_ITEMS.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap transition-all"
              style={{ background: activeTab === item.id ? 'rgba(14,165,233,0.1)' : 'transparent', color: activeTab === item.id ? '#0284C7' : 'var(--text-muted)', border: activeTab === item.id ? '1px solid rgba(14,165,233,0.2)' : '1px solid transparent' }}>
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
          <div className="rounded-2xl p-4 sm:p-7 isg-card">
            <SectionHeader icon="ri-user-settings-line" iconBg="rgba(16,185,129,0.1)" iconColor="#10B981" title="Profil Bilgileri" desc="Hesabınıza ait kişisel bilgileri güncelleyin" />
            <div className="flex items-center gap-5 p-5 rounded-2xl mb-7" style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.12)' }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)', boxShadow: '0 6px 20px rgba(14,165,233,0.35)' }}>
                {(displayName || user?.email || 'O').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold truncate" style={{ color: 'var(--text-primary)' }}>{displayName || user?.email?.split('@')[0]}</p>
                <p className="text-sm mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}>OSGB Admin</span>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1" style={{ background: 'var(--bg-item)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                    <i className="ri-building-2-line text-[10px]" />{orgName}
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label style={labelStyle}>Ad Soyad</label>
                <input value={displayName} onChange={e => setDisplayName(e.target.value)} style={inputStyle} placeholder="Ad Soyad giriniz" onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div>
                <label style={labelStyle}>E-posta Adresi</label>
                <div className="relative">
                  <input value={user?.email ?? ''} readOnly style={{ ...inputStyle, opacity: 0.55, cursor: 'not-allowed', paddingRight: '36px' }} />
                  <i className="ri-lock-line absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--text-muted)' }} />
                </div>
              </div>
              <div><label style={labelStyle}>Rol</label><input value="OSGB Admin" readOnly style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }} /></div>
              <div><label style={labelStyle}>OSGB Adı</label><input value={orgName} readOnly style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }} /></div>
            </div>
            {profileNotif && <div className="mt-5"><Notif n={profileNotif} /></div>}
            <div className="mt-6">
              <button onClick={handleProfileSave} disabled={profileLoading}
                className="whitespace-nowrap flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)', opacity: profileLoading ? 0.7 : 1 }}>
                {profileLoading ? <><i className="ri-loader-4-line animate-spin" />Kaydediliyor...</> : <><i className="ri-save-line" />Kaydet</>}
              </button>
            </div>
          </div>
        )}

        {/* ── GÜVENLİK ── */}
        {activeTab === 'guvenlik' && (
          <div className="rounded-2xl p-4 sm:p-7 isg-card">
            <SectionHeader icon="ri-shield-keyhole-line" iconBg="rgba(234,88,12,0.1)" iconColor="#EA580C" title="Güvenlik Ayarları" desc="Şifrenizi güncelleyin" />
            <div className="p-5 rounded-2xl space-y-5" style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)' }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label style={labelStyle}>Yeni Şifre</label>
                  <div className="relative">
                    <input type={showNew ? 'text' : 'password'} value={pwdData.newPwd}
                      onChange={e => setPwdData(p => ({ ...p, newPwd: e.target.value }))}
                      style={{ ...inputStyle, paddingRight: '40px' }} placeholder="Yeni şifrenizi girin" onFocus={onFocus} onBlur={onBlur} />
                    <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                      <i className={`${showNew ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`} />
                    </button>
                  </div>
                  {pwdData.newPwd && (
                    <div className="mt-2">
                      <div className="flex gap-1">
                        {[1,2,3,4,5].map(i => <div key={i} className="h-1 flex-1 rounded-full" style={{ background: i <= pwdStrength.score ? pwdStrength.color : 'var(--border-subtle)' }} />)}
                      </div>
                      <p className="text-[11px] mt-1 font-semibold" style={{ color: pwdStrength.color }}>{pwdStrength.label}</p>
                    </div>
                  )}
                </div>
                <div>
                  <label style={labelStyle}>Şifre Tekrar</label>
                  <div className="relative">
                    <input type={showConfirm ? 'text' : 'password'} value={pwdData.confirmPwd}
                      onChange={e => setPwdData(p => ({ ...p, confirmPwd: e.target.value }))}
                      style={{ ...inputStyle, paddingRight: '64px', borderColor: passwordsMatch ? 'rgba(34,197,94,0.5)' : passwordsMismatch ? 'rgba(239,68,68,0.5)' : undefined }}
                      placeholder="Şifrenizi tekrar girin" onFocus={onFocus} onBlur={e => { e.currentTarget.style.boxShadow = 'none'; }} />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {pwdData.confirmPwd && <i className={`text-sm ${passwordsMatch ? 'ri-checkbox-circle-line' : passwordsMismatch ? 'ri-close-circle-line' : ''}`} style={{ color: passwordsMatch ? '#22C55E' : '#EF4444' }} />}
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                        <i className={`${showConfirm ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`} />
                      </button>
                    </div>
                  </div>
                  {passwordsMismatch && <p className="text-[11px] mt-1" style={{ color: '#EF4444' }}>Şifreler eşleşmiyor</p>}
                  {passwordsMatch && <p className="text-[11px] mt-1" style={{ color: '#22C55E' }}>Şifreler eşleşiyor</p>}
                </div>
              </div>
              {pwdNotif && <Notif n={pwdNotif} />}
              <button onClick={handlePasswordChange} disabled={pwdLoading || !pwdData.newPwd}
                className="whitespace-nowrap flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #EA580C, #F97316)', opacity: (pwdLoading || !pwdData.newPwd) ? 0.6 : 1 }}>
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
                { label: 'Toplam Üye', value: members.length, icon: 'ri-group-line', color: '#0EA5E9', bg: 'rgba(14,165,233,0.08)' },
                { label: 'OSGB Admin', value: members.filter(m => m.osgb_role === 'osgb_admin').length, icon: 'ri-shield-star-line', color: '#0EA5E9', bg: 'rgba(14,165,233,0.08)' },
                { label: 'Gezici Uzman', value: members.filter(m => m.osgb_role === 'gezici_uzman').length, icon: 'ri-user-star-line', color: '#0EA5E9', bg: 'rgba(14,165,233,0.08)' },
                { label: 'İşyeri Hekimi', value: members.filter(m => m.osgb_role === 'isyeri_hekimi').length, icon: 'ri-heart-pulse-line', color: '#0EA5E9', bg: 'rgba(14,165,233,0.08)' },
              ].map(s => (
                <div key={s.label} className="rounded-2xl p-4 isg-card">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2" style={{ background: s.bg }}>
                    <i className={`${s.icon} text-base`} style={{ color: s.color }} />
                  </div>
                  <p className="text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Members list */}
            <div className="rounded-2xl overflow-hidden isg-card">
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>OSGB Üyeleri</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(14,165,233,0.08)', color: '#0284C7' }}>
                    {members.length} üye
                  </span>
                  <button
                    onClick={() => { setShowAddModal(true); setAddForm(emptyForm); setAddError(null); }}
                    className="whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white cursor-pointer"
                    style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}
                  >
                    <i className="ri-user-add-line text-xs" />
                    Kullanıcı Ekle
                  </button>
                </div>
              </div>

              {teamLoading ? (
                <div className="flex items-center justify-center py-10 gap-2" style={{ color: 'var(--text-muted)' }}>
                  <i className="ri-loader-4-line animate-spin text-lg" style={{ color: '#0EA5E9' }} />
                  <span className="text-sm">Yükleniyor...</span>
                </div>
              ) : members.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <i className="ri-group-line text-2xl" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Henüz üye bulunamadı</p>
                </div>
              ) : (
                <>
                  <div className="hidden md:grid grid-cols-[2fr_1.5fr_1fr_1fr_100px] items-center px-5 py-2"
                    style={{ background: 'var(--bg-item)', borderBottom: '1px solid var(--border-subtle)' }}>
                    {['ÜYE', 'ROL', 'FİRMA', 'DURUM', 'İŞLEM'].map(h => (
                      <div key={h}>
                        <span className="text-[10px] font-bold tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    {members.map((member, idx) => {
                      const isMe = member.user_id === user?.id;
                      const roleConf = getRoleConf(member);
                      return (
                        <div key={member.user_id}
                          className="flex flex-col md:grid md:grid-cols-[2fr_1.5fr_1fr_1fr_100px] items-start md:items-center px-5 py-3 gap-2 md:gap-0 transition-all"
                          style={{
                            opacity: member.is_active ? 1 : 0.65,
                            borderBottom: idx < members.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-item)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>

                          {/* Üye */}
                          <div className="flex items-center gap-2.5 min-w-0 w-full">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                              style={{ background: member.is_active ? 'linear-gradient(135deg, #0EA5E9, #0284C7)' : 'linear-gradient(135deg, #94a3b8, #64748b)' }}>
                              {(member.display_name || member.email || '?').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                                {member.display_name || '—'}
                                {isMe && <span className="ml-1 text-[10px] font-normal" style={{ color: '#0EA5E9' }}>(siz)</span>}
                              </p>
                              <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{member.email}</p>
                            </div>
                            {/* Mobile: actions inline */}
                            <div className="flex md:hidden items-center gap-1.5 ml-auto flex-shrink-0">
                              {!isMe && (
                                <>
                                  <button onClick={() => handleToggleActive(member)} disabled={actionLoadingId === member.user_id}
                                    title={member.is_active ? 'Pasif yap' : 'Aktif et'}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer disabled:opacity-50"
                                    style={{ background: member.is_active ? 'rgba(245,158,11,0.08)' : 'rgba(14,165,233,0.08)', border: `1px solid ${member.is_active ? 'rgba(245,158,11,0.2)' : 'rgba(14,165,233,0.2)'}`, color: member.is_active ? '#F59E0B' : '#0EA5E9' }}>
                                    {actionLoadingId === member.user_id ? <i className="ri-loader-4-line animate-spin text-[10px]" /> : <i className={`${member.is_active ? 'ri-pause-circle-line' : 'ri-play-circle-line'} text-[10px]`} />}
                                  </button>
                                  <button onClick={() => setDeleteConfirm(member)} title="Üyeyi kaldır"
                                    className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer"
                                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#EF4444' }}>
                                    <i className="ri-delete-bin-line text-[10px]" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Rol */}
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                              style={{
                                background: member.is_active ? 'rgba(14,165,233,0.1)' : 'rgba(100,116,139,0.1)',
                                color: member.is_active ? '#0EA5E9' : 'var(--text-muted)',
                                border: `1px solid ${member.is_active ? 'rgba(14,165,233,0.2)' : 'rgba(100,116,139,0.2)'}`,
                              }}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: member.is_active ? '#0EA5E9' : '#94A3B8' }} />
                              {member.is_active ? 'Aktif' : 'Pasif'}
                            </span>
                          </div>

                          {/* Firma */}
                          <div>
                            {(member.osgb_role === 'gezici_uzman' || member.osgb_role === 'isyeri_hekimi') && member.active_firm_ids && member.active_firm_ids.length > 0 ? (
                              <span className="text-[10px] font-semibold" style={{ color: '#0EA5E9' }}>
                                <i className="ri-building-3-line text-[9px] mr-0.5" />
                                {member.active_firm_ids.length} firma
                              </span>
                            ) : (
                              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                          </div>

                          {/* Durum */}
                          <div>
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                              style={{
                                background: member.is_active ? 'rgba(14,165,233,0.1)' : 'rgba(100,116,139,0.1)',
                                color: member.is_active ? '#0EA5E9' : 'var(--text-muted)',
                                border: `1px solid ${member.is_active ? 'rgba(14,165,233,0.2)' : 'rgba(100,116,139,0.2)'}`,
                              }}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: member.is_active ? '#0EA5E9' : '#94A3B8' }} />
                              {member.is_active ? 'Aktif' : 'Pasif'}
                            </span>
                          </div>

                          {/* Desktop: İşlem */}
                          <div className="hidden md:flex items-center justify-end gap-1.5">
                            {!isMe ? (
                              <>
                                <button onClick={() => handleToggleActive(member)} disabled={actionLoadingId === member.user_id}
                                  title={member.is_active ? 'Pasif yap' : 'Aktif et'}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer disabled:opacity-50 transition-all"
                                  style={{ background: member.is_active ? 'rgba(245,158,11,0.08)' : 'rgba(14,165,233,0.08)', border: `1px solid ${member.is_active ? 'rgba(245,158,11,0.2)' : 'rgba(14,165,233,0.2)'}`, color: member.is_active ? '#F59E0B' : '#0EA5E9' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.8'; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}>
                                  {actionLoadingId === member.user_id ? <i className="ri-loader-4-line animate-spin text-[10px]" /> : <i className={`${member.is_active ? 'ri-pause-circle-line' : 'ri-play-circle-line'} text-[10px]`} />}
                                </button>
                                <button onClick={() => setDeleteConfirm(member)} disabled={actionLoadingId === member.user_id + '_delete'}
                                  title="Üyeyi kaldır"
                                  className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer disabled:opacity-50 transition-all"
                                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#EF4444' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.15)'; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'; }}>
                                  <i className="ri-delete-bin-line text-[10px]" />
                                </button>
                              </>
                            ) : (
                              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(14,165,233,0.04)', border: '1px solid rgba(14,165,233,0.12)' }}>
              <i className="ri-information-line text-sm flex-shrink-0 mt-0.5" style={{ color: '#0EA5E9' }} />
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                <strong style={{ color: '#0284C7' }}>OSGB Admin:</strong> Tam yetki &bull;&nbsp;
                <strong style={{ color: '#0EA5E9' }}>Gezici Uzman:</strong> Atanan firmalarda denetim &bull;&nbsp;
                <strong style={{ color: '#0EA5E9' }}>İşyeri Hekimi:</strong> Atanan firmalarda sağlık takibi
              </p>
            </div>
          </div>
        )}

        {/* ── SİSTEM ── */}
        {activeTab === 'sistem' && (
          <div className="space-y-5">
            <div className="rounded-2xl p-4 sm:p-7 isg-card">
              <SectionHeader icon="ri-information-line" iconBg="rgba(100,116,139,0.1)" iconColor="#64748B" title="Sistem Bilgisi" desc="Uygulama versiyonu ve OSGB teknik detayları" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'OSGB Adı', value: orgName, icon: 'ri-building-4-line', color: '#0EA5E9' },
                  { label: 'Müşteri Firma', value: String(firmaCount), icon: 'ri-building-2-line', color: '#0EA5E9' },
                  { label: 'Gezici Uzman', value: String(uzmanCount), icon: 'ri-user-star-line', color: '#0EA5E9' },
                  { label: 'İşyeri Hekimi', value: String(members.filter(m => m.osgb_role === 'isyeri_hekimi').length), icon: 'ri-heart-pulse-line', color: '#0EA5E9' },
                ].map(s => (
                  <div key={s.label} className="p-4 rounded-xl text-center" style={{ background: 'rgba(14,165,233,0.04)', border: '1px solid rgba(14,165,233,0.12)' }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ background: 'rgba(14,165,233,0.15)' }}>
                      <i className={`${s.icon} text-base`} style={{ color: s.color }} />
                    </div>
                    <p className="text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Toast ── */}
      {toastMsg && createPortal(
        <div className="fixed bottom-6 right-6 z-[99999] flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-white"
          style={{ background: toastMsg.type === 'success' ? 'linear-gradient(135deg, #0EA5E9, #0284C7)' : 'linear-gradient(135deg, #EF4444, #DC2626)', border: `1px solid ${toastMsg.type === 'success' ? 'rgba(14,165,233,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
          <i className={toastMsg.type === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'} />
          {toastMsg.text}
        </div>,
        document.body
      )}

      {/* ── Kullanıcı Ekle Modal ── */}
      {showAddModal && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 99999 }}
          onClick={e => { if (e.target === e.currentTarget) setShowAddModal(false); }}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden"
            style={{ background: 'var(--modal-bg)', border: '1px solid var(--modal-border)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ background: 'rgba(14,165,233,0.1)' }}>
                  <i className="ri-user-add-line text-base" style={{ color: '#0EA5E9' }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Yeni Kullanıcı Ekle</h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Gezici uzman veya işyeri hekimi oluşturun</p>
                </div>
              </div>
              <button onClick={() => setShowAddModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
                style={{ background: 'var(--bg-item)', color: 'var(--text-muted)' }}>
                <i className="ri-close-line" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              <div>
                <label style={labelStyle}>Rol *</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: 'gezici_uzman', label: 'Gezici Uzman', icon: 'ri-user-star-line' },
                    { value: 'isyeri_hekimi', label: 'İşyeri Hekimi', icon: 'ri-heart-pulse-line' },
                  ] as const).map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setAddForm(p => ({ ...p, osgb_role: opt.value, active_firm_ids: [] }))}
                      className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all text-left"
                      style={{
                        background: addForm.osgb_role === opt.value ? 'rgba(14,165,233,0.1)' : 'var(--bg-item)',
                        border: `2px solid ${addForm.osgb_role === opt.value ? 'rgba(14,165,233,0.3)' : 'var(--border-subtle)'}`,
                      }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: addForm.osgb_role === opt.value ? 'rgba(14,165,233,0.15)' : 'var(--bg-item)' }}>
                        <i className={`${opt.icon} text-sm`} style={{ color: addForm.osgb_role === opt.value ? '#0EA5E9' : 'var(--text-muted)' }} />
                      </div>
                      <span className="text-xs font-semibold" style={{ color: addForm.osgb_role === opt.value ? '#0EA5E9' : 'var(--text-secondary)' }}>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={labelStyle}>Ad Soyad *</label>
                <input value={addForm.display_name} onChange={e => setAddForm(p => ({ ...p, display_name: e.target.value }))} style={inputStyle} placeholder="Ad Soyad giriniz" onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div>
                <label style={labelStyle}>E-posta *</label>
                <input type="email" value={addForm.email} onChange={e => setAddForm(p => ({ ...p, email: e.target.value }))} style={inputStyle} placeholder="kullanici@email.com" onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div>
                <label style={labelStyle}>Geçici Şifre *</label>
                <div className="relative">
                  <input type={showAddPassword ? 'text' : 'password'} value={addForm.password}
                    onChange={e => setAddForm(p => ({ ...p, password: e.target.value }))}
                    style={{ ...inputStyle, paddingRight: '40px' }} placeholder="En az 8 karakter" onFocus={onFocus} onBlur={onBlur} />
                  <button type="button" onClick={() => setShowAddPassword(!showAddPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                    <i className={`${showAddPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`} />
                  </button>
                </div>
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>İlk girişte şifre değiştirmesi gerekecek.</p>
              </div>

              <div>
                <label style={labelStyle}>
                  Firma Ataması *
                  <span className="ml-1 text-[10px] font-normal normal-case" style={{ color: 'var(--text-muted)' }}>(en az 1 firma seç)</span>
                </label>
                {firmalarLoading ? (
                  <div className="flex items-center justify-center py-4 gap-2" style={{ color: 'var(--text-muted)' }}>
                    <i className="ri-loader-4-line animate-spin text-sm" />
                    <span className="text-xs">Firmalar yükleniyor...</span>
                  </div>
                ) : firmalar.length === 0 ? (
                  <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <i className="ri-information-line text-sm flex-shrink-0" style={{ color: '#F59E0B' }} />
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Henüz atanmış müşteri firma bulunamadı. Önce Firmalar sekmesinden firma ekleyin.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto border rounded-xl p-2" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-item)' }}>
                    {firmalar.map(f => {
                      const selected = addForm.active_firm_ids.includes(f.id);
                      return (
                        <button key={f.id} type="button" onClick={() => toggleFirmaSelection(f.id)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-left transition-all"
                          style={{ background: selected ? 'rgba(14,165,233,0.08)' : 'var(--bg-card-solid)', border: `1.5px solid ${selected ? 'rgba(14,165,233,0.3)' : 'var(--border-subtle)'}` }}>
                          <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                            style={{ background: selected ? 'linear-gradient(135deg, #0EA5E9, #0284C7)' : 'var(--bg-input)', border: selected ? 'none' : '1.5px solid var(--border-main)' }}>
                            {selected && <i className="ri-check-line text-white text-[9px]" />}
                          </div>
                          <i className="ri-building-3-line text-xs flex-shrink-0" style={{ color: selected ? '#0EA5E9' : 'var(--text-muted)' }} />
                          <span className="text-xs font-medium flex-1 truncate" style={{ color: selected ? '#0284C7' : 'var(--text-primary)' }}>{f.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {addForm.active_firm_ids.length > 0 && (
                  <p className="text-[10px] mt-1 font-semibold" style={{ color: '#0EA5E9' }}>
                    <i className="ri-check-double-line mr-0.5" />
                    {addForm.active_firm_ids.length} firma seçildi
                  </p>
                )}
              </div>

              {addError && (
                <div className="flex items-start gap-2 px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#F87171' }}>
                  <i className="ri-error-warning-line flex-shrink-0 mt-0.5" />
                  <span>{addError}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <button onClick={() => setShowAddModal(false)}
                className="flex-1 whitespace-nowrap py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
                style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                İptal
              </button>
              <button onClick={handleAddUser} disabled={addLoading}
                className="flex-1 whitespace-nowrap flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)', opacity: addLoading ? 0.7 : 1 }}>
                {addLoading ? <><i className="ri-loader-4-line animate-spin" />Ekleniyor...</> : <><i className="ri-user-add-line" />Kullanıcı Ekle</>}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteConfirm && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', zIndex: 99999 }}
          onClick={e => { if (e.target === e.currentTarget) setDeleteConfirm(null); }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4"
            style={{ background: 'var(--modal-bg)', border: '1px solid var(--modal-border)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <i className="ri-delete-bin-line text-base" style={{ color: '#EF4444' }} />
              </div>
              <div>
                <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Üyeyi Kaldır</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Bu işlem geri alınamaz</p>
              </div>
            </div>
            <div className="px-3 py-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.12)' }}>
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                <strong>{deleteConfirm.display_name || deleteConfirm.email}</strong> adlı üyeyi kaldırmak istediğinize emin misiniz?
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 whitespace-nowrap py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
                style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>İptal</button>
              <button onClick={handleDeleteMember} disabled={actionLoadingId === deleteConfirm.user_id + '_delete'}
                className="flex-1 whitespace-nowrap flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer disabled:opacity-70"
                style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)' }}>
                {actionLoadingId === deleteConfirm.user_id + '_delete' ? <><i className="ri-loader-4-line animate-spin" />Kaldırılıyor...</> : <><i className="ri-delete-bin-line" />Evet, Kaldır</>}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
