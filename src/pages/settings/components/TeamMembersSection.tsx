import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../../store/AppContext';
import { useAuth } from '../../../store/AuthContext';
import { supabase } from '../../../lib/supabase';

const EDGE_URL = 'https://dhwthspnuzxowmhumfoy.supabase.co/functions/v1/admin-user-management';

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

export default function TeamMembersSection() {
  const { org, orgLoading, theme, addToast, logAction } = useApp();
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
        body: JSON.stringify({ action: 'list' }),
      });
      const json = await res.json();
      if (json.members) {
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
        logAction('user_created', {
          module: 'Kullanicilar',
          recordName: form.display_name,
          description: `${form.email} e-postasıyla yeni kullanıcı oluşturuldu (Rol: ${form.role === 'admin' ? 'Admin' : 'Kullanıcı'})`,
        });
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
          target_user_id: member.user_id,
          is_active: !member.is_active,
        }),
      });
      const json = await res.json();
      if (json.error) {
        addToast(json.error, 'error');
      } else {
        const name = member.display_name || member.email;
        addToast(
          member.is_active ? `${name} pasif yapıldı.` : `${name} aktif yapıldı.`,
          'success',
        );
        logAction(member.is_active ? 'user_deactivated' : 'user_activated', {
          module: 'Kullanicilar',
          recordName: name,
          description: `${name} kullanıcısı ${member.is_active ? 'pasif' : 'aktif'} yapıldı`,
        });
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
          target_user_id: member.user_id,
          role: newRole,
        }),
      });
      const json = await res.json();
      if (json.error) {
        addToast(json.error, 'error');
      } else {
        addToast('Rol güncellendi.', 'success');
        await fetchMembers();
      }
    } catch {
      addToast('Rol güncellenirken hata oluştu.', 'error');
    } finally {
      setActionLoading(null);
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
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Toplam Üye', value: members.length, color: '#6366F1', bg: 'rgba(99,102,241,0.1)' },
            { label: 'Aktif', value: members.filter(m => m.is_active).length, color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
            { label: 'Pasif', value: members.filter(m => !m.is_active).length, color: '#64748B', bg: 'rgba(100,116,139,0.1)' },
          ].map(s => (
            <div
              key={s.label}
              className="flex flex-col items-center justify-center p-3 rounded-xl"
              style={{ background: s.bg }}
            >
              <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[11px] mt-0.5" style={{ color: subColor }}>{s.label}</p>
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
              return (
                <div
                  key={member.user_id}
                  className="flex items-center gap-3 p-4 rounded-xl"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)',
                    border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(15,23,42,0.07)',
                    opacity: member.is_active ? 1 : 0.6,
                  }}
                >
                  {/* Avatar */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{
                      background: member.role === 'admin'
                        ? 'linear-gradient(135deg, #F59E0B, #EA580C)'
                        : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                    }}
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
                      {member.must_change_password && (
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}
                        >
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

                  {/* Role selector */}
                  {!isMe && (
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
                      <option value="member">Kullanıcı</option>
                    </select>
                  )}

                  {/* Active/Passive toggle */}
                  {!isMe && (
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
                      {member.is_active ? 'Pasif Yap' : 'Aktif Yap'}
                    </button>
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
            Eklenen kullanıcılar geçici şifre ile giriş yapar ve ilk girişte şifrelerini değiştirmeleri istenir.
            Aynı firmanın tüm üyeleri ortak verilere erişir.
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
            {/* Modal header */}
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

            {/* Form */}
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
    </>
  );
}
