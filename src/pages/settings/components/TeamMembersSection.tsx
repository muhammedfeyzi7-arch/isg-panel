import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../../store/AppContext';
import { useAuth } from '../../../store/AuthContext';
import { supabase } from '../../../lib/supabase';

const EDGE_URL = 'https://niuvjthvhjbfyuuhoowq.supabase.co/functions/v1/admin-user-management';

interface Member {
  user_id: string;
  role: string;
  is_active: boolean;
  must_change_password: boolean;
  display_name: string;
  email: string;
  joined_at: string;
}

interface AddUserForm {
  display_name: string;
  email: string;
  password: string;
  role: string;
}

const emptyForm: AddUserForm = { display_name: '', email: '', password: '', role: 'member' };

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; gradient: string }> = {
  admin: { label: 'Admin', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', gradient: 'linear-gradient(135deg, #F59E0B, #EA580C)' },
  denetci: { label: 'Denetçi', color: '#06B6D4', bg: 'rgba(6,182,212,0.1)', gradient: 'linear-gradient(135deg, #06B6D4, #0891B2)' },
  member: { label: 'Kullanıcı', color: '#818CF8', bg: 'rgba(99,102,241,0.1)', gradient: 'linear-gradient(135deg, #6366F1, #8B5CF6)' },
};

export default function TeamMembersSection() {
  const { org, orgLoading, theme, addToast } = useApp();
  const { user } = useAuth();
  const isDark = theme === 'dark';

  const [members, setMembers] = useState<Member[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState<AddUserForm>(emptyForm);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Member | null>(null);
  // Password reset modal
  const [resetTarget, setResetTarget] = useState<Member | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetShowPassword, setResetShowPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const getAuthHeader = useCallback(async (): Promise<string> => {
    const { data } = await supabase.auth.getSession();
    return `Bearer ${data.session?.access_token ?? ''}`;
  }, []);

  const fetchMembers = useCallback(async () => {
    if (!org?.id) return;
    setListLoading(true);
    try {
      const authHeader = await getAuthHeader();
      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ action: 'list', organization_id: org.id }),
      });
      const json = await res.json();
      if (json.error) {
        addToast(json.error, 'error');
      } else if (json.members) {
        setMembers(json.members);
      }
    } catch {
      addToast('Üye listesi yüklenemedi.', 'error');
    } finally {
      setListLoading(false);
    }
  }, [org?.id, getAuthHeader, addToast]);

  useEffect(() => {
    if (org?.role === 'admin') {
      fetchMembers();
    }
  }, [org?.role, fetchMembers]);

  const handleAddUser = async () => {
    setFormError(null);
    if (!form.display_name.trim()) { setFormError('Ad Soyad zorunludur.'); return; }
    if (!form.email.trim() || !form.email.includes('@')) { setFormError('Geçerli bir e-posta girin.'); return; }
    if (!form.password || form.password.length < 8) { setFormError('Şifre en az 8 karakter olmalıdır.'); return; }

    setFormLoading(true);
    try {
      const authHeader = await getAuthHeader();
      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({
          action: 'create',
          organization_id: org?.id,
          email: form.email.trim().toLowerCase(),
          password: form.password,
          display_name: form.display_name.trim(),
          role: form.role,
        }),
      });
      const json = await res.json();
      if (json.error) {
        setFormError(json.error);
      } else {
        addToast(`${form.display_name} başarıyla eklendi.`, 'success');
        setShowAddModal(false);
        setForm(emptyForm);
        await fetchMembers();
      }
    } catch {
      setFormError('Kullanıcı eklenirken hata oluştu.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleActive = async (member: Member) => {
    setActionLoading(member.user_id);
    try {
      const authHeader = await getAuthHeader();
      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({
          action: 'update',
          organization_id: org?.id,
          target_user_id: member.user_id,
          is_active: !member.is_active,
        }),
      });
      const json = await res.json();
      if (json.error) {
        addToast(json.error, 'error');
      } else {
        addToast(
          member.is_active
            ? `${member.display_name || member.email} pasif yapıldı.`
            : `${member.display_name || member.email} aktif yapıldı.`,
          'success',
        );
        await fetchMembers();
      }
    } catch {
      addToast('Güncelleme sırasında hata oluştu.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleChangeRole = async (member: Member, newRole: string) => {
    setActionLoading(member.user_id + '_role');
    try {
      const authHeader = await getAuthHeader();
      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({
          action: 'update',
          organization_id: org?.id,
          target_user_id: member.user_id,
          role: newRole,
        }),
      });
      const json = await res.json();
      if (json.error) {
        addToast(json.error, 'error');
      } else {
        const roleLabel = ROLE_CONFIG[newRole]?.label ?? newRole;
        addToast(`Rol ${roleLabel} olarak güncellendi.`, 'success');
        await fetchMembers();
      }
    } catch {
      addToast('Rol güncellenirken hata oluştu.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteMember = async () => {
    if (!deleteConfirm) return;
    setActionLoading(deleteConfirm.user_id + '_delete');
    try {
      const authHeader = await getAuthHeader();
      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({
          action: 'delete',
          organization_id: org?.id,
          target_user_id: deleteConfirm.user_id,
        }),
      });
      const json = await res.json();
      if (json.error) {
        addToast(json.error, 'error');
      } else {
        addToast(`${deleteConfirm.display_name || deleteConfirm.email} organizasyondan kaldırıldı.`, 'success');
        setDeleteConfirm(null);
        await fetchMembers();
      }
    } catch {
      addToast('Silme işlemi sırasında hata oluştu.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    setResetError(null);
    if (!resetPassword || resetPassword.length < 8) {
      setResetError('Şifre en az 8 karakter olmalıdır.');
      return;
    }
    setResetLoading(true);
    try {
      const authHeader = await getAuthHeader();
      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({
          action: 'reset_password',
          organization_id: org?.id,
          target_user_id: resetTarget.user_id,
          new_password: resetPassword,
        }),
      });
      const json = await res.json();
      if (json.error) {
        setResetError(json.error);
      } else {
        addToast(`${resetTarget.display_name || resetTarget.email} kullanıcısının şifresi sıfırlandı.`, 'success');
        setResetTarget(null);
        setResetPassword('');
        await fetchMembers();
      }
    } catch {
      setResetError('Şifre sıfırlanırken hata oluştu.');
    } finally {
      setResetLoading(false);
    }
  };

  if (orgLoading) return null;
  if (!org || org.role !== 'admin') return null;

  const cardStyle = {
    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.8)',
    border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(15,23,42,0.1)',
    borderRadius: '16px',
  };

  const nameColor = isDark ? '#E2E8F0' : '#0F172A';
  const subColor = isDark ? '#64748B' : '#94A3B8';
  const sectionTitleColor = isDark ? '#CBD5E1' : '#334155';
  const inputStyle: React.CSSProperties = {
    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)',
    border: isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(15,23,42,0.12)',
    borderRadius: '10px',
    color: isDark ? '#E2E8F0' : '#0F172A',
    outline: 'none',
    width: '100%',
    padding: '10px 12px',
    fontSize: '13px',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 600,
    marginBottom: '6px',
    color: isDark ? '#94A3B8' : '#475569',
  };

  return (
    <>
      <div style={cardStyle} className="p-6 space-y-5">
        {/* Header */}
        <div
          className="flex items-center justify-between pb-4"
          style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(15,23,42,0.08)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
              style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.15)' }}
            >
              <i className="ri-group-line text-base" style={{ color: '#10B981' }} />
            </div>
            <div>
              <h4 className="text-sm font-bold" style={{ color: sectionTitleColor }}>Kullanıcı Yönetimi</h4>
              <p className="text-xs mt-0.5" style={{ color: subColor }}>
                Organizasyonunuzdaki kullanıcıları yönetin
              </p>
            </div>
          </div>
          <button
            onClick={() => { setShowAddModal(true); setFormError(null); setForm(emptyForm); }}
            className="whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer transition-all"
            style={{ background: 'linear-gradient(135deg, #10B981, #059669)', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}
          >
            <i className="ri-user-add-line" />
            Kullanıcı Ekle
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Toplam Üye', value: members.length, color: '#6366F1', bg: 'rgba(99,102,241,0.1)' },
            { label: 'Aktif', value: members.filter(m => m.is_active).length, color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
            { label: 'Şifre Bekliyor', value: members.filter(m => m.must_change_password).length, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
            { label: 'Pasif', value: members.filter(m => !m.is_active).length, color: '#64748B', bg: 'rgba(100,116,139,0.1)' },
          ].map(s => (
            <div
              key={s.label}
              className="flex flex-col items-center justify-center p-3 rounded-xl"
              style={{ background: s.bg }}
            >
              <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] mt-0.5 text-center" style={{ color: subColor }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Member List */}
        {listLoading ? (
          <div className="flex items-center justify-center py-8 gap-2" style={{ color: subColor }}>
            <i className="ri-loader-4-line animate-spin" />
            <span className="text-sm">Yükleniyor...</span>
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="w-12 h-12 flex items-center justify-center rounded-2xl" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)' }}>
              <i className="ri-group-line text-xl" style={{ color: subColor }} />
            </div>
            <p className="text-sm" style={{ color: subColor }}>Henüz üye bulunmuyor</p>
          </div>
        ) : (
          <div className="space-y-2">
            {members.map(member => {
              const isMe = member.user_id === user?.id;
              const isDeleting = actionLoading === member.user_id + '_delete';
              const roleConf = ROLE_CONFIG[member.role] ?? ROLE_CONFIG.member;
              return (
                <div
                  key={member.user_id}
                  className="flex items-center gap-3 p-4 rounded-xl"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)',
                    border: member.must_change_password
                      ? isDark ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(245,158,11,0.3)'
                      : isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(15,23,42,0.07)',
                    opacity: member.is_active ? 1 : 0.6,
                  }}
                >
                  {/* Avatar */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ background: roleConf.gradient }}
                  >
                    {(member.display_name || member.email || '?').charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate" style={{ color: nameColor }}>
                        {member.display_name || member.email}
                        {isMe && <span className="ml-1 text-xs font-normal" style={{ color: '#6366F1' }}>(siz)</span>}
                      </p>
                      {/* Role badge */}
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: roleConf.bg, color: roleConf.color }}
                      >
                        {roleConf.label}
                      </span>
                      {member.must_change_password && (
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
                          style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}
                        >
                          <i className="ri-lock-password-line text-[9px]" />
                          Şifre Değiştirilmeli
                        </span>
                      )}
                      {!member.is_active && (
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(100,116,139,0.15)', color: '#94A3B8' }}
                        >
                          Pasif
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5 truncate" style={{ color: subColor }}>{member.email}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: isDark ? '#334155' : '#CBD5E1' }}>
                      {new Date(member.joined_at).toLocaleDateString('tr-TR')} tarihinde eklendi
                    </p>
                  </div>

                  {/* Actions */}
                  {!isMe && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Role selector */}
                      <select
                        value={member.role}
                        onChange={e => handleChangeRole(member, e.target.value)}
                        disabled={actionLoading === member.user_id + '_role'}
                        className="text-xs px-2 py-1.5 rounded-lg cursor-pointer"
                        style={{
                          background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
                          border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(15,23,42,0.1)',
                          color: nameColor,
                          outline: 'none',
                        }}
                      >
                        <option value="admin">Admin</option>
                        <option value="denetci">Denetçi</option>
                        <option value="member">Kullanıcı</option>
                      </select>

                      {/* Reset password button */}
                      <button
                        onClick={() => { setResetTarget(member); setResetPassword(''); setResetError(null); setResetShowPassword(false); }}
                        title="Şifreyi Sıfırla"
                        className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all flex-shrink-0"
                        style={{
                          background: 'rgba(245,158,11,0.08)',
                          border: '1px solid rgba(245,158,11,0.2)',
                          color: '#F59E0B',
                        }}
                      >
                        <i className="ri-lock-password-line text-xs" />
                      </button>

                      {/* Active/Passive toggle */}
                      <button
                        onClick={() => handleToggleActive(member)}
                        disabled={actionLoading === member.user_id}
                        className="whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                        style={{
                          background: member.is_active ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                          border: `1px solid ${member.is_active ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
                          color: member.is_active ? '#EF4444' : '#10B981',
                          opacity: actionLoading === member.user_id ? 0.6 : 1,
                        }}
                      >
                        {actionLoading === member.user_id ? (
                          <i className="ri-loader-4-line animate-spin" />
                        ) : (
                          <i className={member.is_active ? 'ri-pause-circle-line' : 'ri-play-circle-line'} />
                        )}
                        {member.is_active ? 'Pasif' : 'Aktif'}
                      </button>

                      {/* Delete button */}
                      <button
                        onClick={() => setDeleteConfirm(member)}
                        disabled={isDeleting}
                        className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all flex-shrink-0"
                        style={{
                          background: 'rgba(239,68,68,0.08)',
                          border: '1px solid rgba(239,68,68,0.15)',
                          color: '#EF4444',
                          opacity: isDeleting ? 0.6 : 1,
                        }}
                        title="Kullanıcıyı kaldır"
                      >
                        {isDeleting ? (
                          <i className="ri-loader-4-line animate-spin text-xs" />
                        ) : (
                          <i className="ri-delete-bin-line text-xs" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Info note */}
        <div
          className="flex items-start gap-2 px-3 py-2.5 rounded-lg"
          style={{
            background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.03)',
            border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(15,23,42,0.07)',
          }}
        >
          <i className="ri-information-line text-sm flex-shrink-0 mt-0.5" style={{ color: '#64748B' }} />
          <p className="text-xs leading-relaxed" style={{ color: subColor }}>
            <strong style={{ color: nameColor }}>Admin:</strong> Tam yetki &bull;&nbsp;
            <strong style={{ color: '#06B6D4' }}>Denetçi:</strong> Saha denetim, tutanaklar ve raporlar &bull;&nbsp;
            <strong style={{ color: '#818CF8' }}>Kullanıcı:</strong> Tüm modüller (ayarlar hariç)
          </p>
        </div>
      </div>

      {/* ── Add User Modal ── */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAddModal(false); }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 space-y-5"
            style={{
              background: isDark ? '#0D1526' : '#fff',
              border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(15,23,42,0.15)',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 flex items-center justify-center rounded-xl"
                  style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}
                >
                  <i className="ri-user-add-line text-base" style={{ color: '#10B981' }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: nameColor }}>Yeni Kullanıcı Ekle</h3>
                  <p className="text-xs mt-0.5" style={{ color: subColor }}>Aynı organizasyona otomatik bağlanır</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
                style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)', color: subColor }}
              >
                <i className="ri-close-line" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label style={labelStyle}>Ad Soyad *</label>
                <input
                  value={form.display_name}
                  onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))}
                  placeholder="Kullanıcının adı ve soyadı"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>E-posta *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="kullanici@firma.com"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Geçici Şifre *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="En az 8 karakter"
                    style={{ ...inputStyle, paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center cursor-pointer"
                    style={{ color: '#64748B' }}
                  >
                    <i className={`${showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`} />
                  </button>
                </div>
                <p className="text-[10px] mt-1" style={{ color: subColor }}>
                  Kullanıcı ilk girişte şifresini değiştirmek zorundadır.
                </p>
              </div>

              <div>
                <label style={labelStyle}>Rol</label>
                <select
                  value={form.role}
                  onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <option value="member">Kullanıcı</option>
                  <option value="denetci">Denetçi</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            {/* Org info */}
            <div
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}
            >
              <i className="ri-building-2-line text-sm" style={{ color: '#6366F1' }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs" style={{ color: '#818CF8' }}>
                  <strong>{org.name}</strong> organizasyonuna otomatik olarak eklenecek
                </p>
              </div>
            </div>

            {formError && (
              <div
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#F87171' }}
              >
                <i className="ri-error-warning-line flex-shrink-0" />
                {formError}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 whitespace-nowrap flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)',
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.1)',
                  color: subColor,
                }}
              >
                İptal
              </button>
              <button
                onClick={handleAddUser}
                disabled={formLoading}
                className="flex-1 whitespace-nowrap flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer transition-all"
                style={{
                  background: 'linear-gradient(135deg, #10B981, #059669)',
                  boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
                  opacity: formLoading ? 0.7 : 1,
                }}
              >
                {formLoading ? (
                  <><i className="ri-loader-4-line animate-spin" />Ekleniyor...</>
                ) : (
                  <><i className="ri-user-add-line" />Kullanıcı Ekle</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset Password Modal ── */}
      {resetTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) { setResetTarget(null); setResetPassword(''); } }}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 space-y-4"
            style={{ background: isDark ? '#0D1526' : '#fff', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(15,23,42,0.15)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <i className="ri-lock-password-line text-base" style={{ color: '#F59E0B' }} />
              </div>
              <div>
                <h3 className="text-sm font-bold" style={{ color: nameColor }}>Şifreyi Sıfırla</h3>
                <p className="text-xs mt-0.5" style={{ color: subColor }}>{resetTarget.display_name || resetTarget.email}</p>
              </div>
            </div>

            <div
              className="flex items-start gap-2 px-3 py-2.5 rounded-lg"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
            >
              <i className="ri-information-line text-sm flex-shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
              <p className="text-xs leading-relaxed" style={{ color: '#F59E0B' }}>
                Kullanıcı bir sonraki girişinde bu geçici şifreyle giriş yapacak ve yeni şifre belirlemeye zorlanacak.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: subColor }}>Yeni Geçici Şifre *</label>
              <div className="relative">
                <input
                  type={resetShowPassword ? 'text' : 'password'}
                  value={resetPassword}
                  onChange={e => setResetPassword(e.target.value)}
                  placeholder="En az 8 karakter"
                  style={{ ...inputStyle, paddingRight: '40px' }}
                />
                <button type="button" onClick={() => setResetShowPassword(!resetShowPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center cursor-pointer" style={{ color: '#64748B' }}>
                  <i className={`${resetShowPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`} />
                </button>
              </div>
            </div>

            {resetError && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#F87171' }}>
                <i className="ri-error-warning-line flex-shrink-0" />
                {resetError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setResetTarget(null); setResetPassword(''); setResetError(null); }}
                className="flex-1 whitespace-nowrap py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
                style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)', border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.1)', color: subColor }}
              >
                İptal
              </button>
              <button
                onClick={handleResetPassword}
                disabled={resetLoading || !resetPassword}
                className="flex-1 whitespace-nowrap flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #EA580C)', opacity: (resetLoading || !resetPassword) ? 0.7 : 1 }}
              >
                {resetLoading ? <><i className="ri-loader-4-line animate-spin" />Sıfırlanıyor...</> : <><i className="ri-lock-password-line" />Şifreyi Sıfırla</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) setDeleteConfirm(null); }}
        >
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: isDark ? '#0D1526' : '#fff', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(15,23,42,0.15)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <i className="ri-delete-bin-line text-base" style={{ color: '#EF4444' }} />
              </div>
              <div>
                <h3 className="text-sm font-bold" style={{ color: nameColor }}>Kullanıcıyı Kaldır</h3>
                <p className="text-xs mt-0.5" style={{ color: subColor }}>Bu işlem geri alınamaz</p>
              </div>
            </div>
            <div className="px-3 py-3 rounded-xl" style={{ background: isDark ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.12)' }}>
              <p className="text-sm" style={{ color: nameColor }}>
                <strong>{deleteConfirm.display_name || deleteConfirm.email}</strong> kullanıcısını organizasyondan kaldırmak istediğinize emin misiniz?
              </p>
              <p className="text-xs mt-1.5" style={{ color: subColor }}>Kullanıcı organizasyondan çıkarılacak ancak hesabı silinmeyecektir.</p>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 whitespace-nowrap py-2.5 rounded-xl text-sm font-semibold cursor-pointer" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)', border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.1)', color: subColor }}>
                İptal
              </button>
              <button
                onClick={handleDeleteMember}
                disabled={actionLoading === deleteConfirm.user_id + '_delete'}
                className="flex-1 whitespace-nowrap flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)', opacity: actionLoading === deleteConfirm.user_id + '_delete' ? 0.7 : 1 }}
              >
                {actionLoading === deleteConfirm.user_id + '_delete' ? <><i className="ri-loader-4-line animate-spin" />Kaldırılıyor...</> : <><i className="ri-delete-bin-line" />Evet, Kaldır</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
