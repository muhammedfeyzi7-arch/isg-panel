import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  firm_id?: string;
}

interface AddUserForm {
  display_name: string;
  email: string;
  password: string;
  role: string;
  firm_id: string;
}

interface Firma {
  id: string;
  ad: string;
}

interface FetchOptions {
  method: string;
  headers: Record<string, string>;
  body: string;
}

const emptyForm: AddUserForm = { display_name: '', email: '', password: '', role: 'member', firm_id: '' };

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; gradient: string }> = {
  admin: { label: 'Admin Kullanıcı', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', gradient: 'linear-gradient(135deg, #F59E0B, #EA580C)' },
  denetci: { label: 'Saha Personeli', color: '#06B6D4', bg: 'rgba(6,182,212,0.1)', gradient: 'linear-gradient(135deg, #06B6D4, #0891B2)' },
  member: { label: 'Evrak/Dökümantasyon Denetçi', color: '#818CF8', bg: 'rgba(99,102,241,0.1)', gradient: 'linear-gradient(135deg, #6366F1, #8B5CF6)' },
  firma_user: { label: 'Firma Yetkilisi', color: '#10B981', bg: 'rgba(16,185,129,0.1)', gradient: 'linear-gradient(135deg, #10B981, #059669)' },
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
  const [resetTarget, setResetTarget] = useState<Member | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetShowPassword, setResetShowPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [firmalar, setFirmalar] = useState<Firma[]>([]);

  const getAuthHeader = useCallback(async (): Promise<string> => {
    // Önce mevcut session'ı al
    const { data: sessionData } = await supabase.auth.getSession();
    const currentToken = sessionData.session?.access_token;

    if (currentToken) {
      // Token var, expire kontrolü yap
      const payload = currentToken.split('.')[1];
      if (payload) {
        try {
          const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
          const exp = decoded.exp as number;
          const now = Math.floor(Date.now() / 1000);
          // 60 saniyeden fazla süresi varsa direkt kullan
          if (exp && exp - now > 60) {
            return `Bearer ${currentToken}`;
          }
        } catch {
          // decode başarısız, refresh dene
        }
      }
    }

    // Token yok veya expire yakın, refresh dene
    try {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && refreshData.session?.access_token) {
        return `Bearer ${refreshData.session.access_token}`;
      }
    } catch {
      // ignore
    }

    // Son çare: mevcut token'ı kullan
    if (currentToken) return `Bearer ${currentToken}`;
    throw new Error('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
  }, []);

  // Fetch with 30s timeout + auto-retry on network errors
  const fetchWithRetry = useCallback(async (
    url: string,
    options: FetchOptions,
    retries = 2,
  ): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const isNetwork = err instanceof Error && (
        err.message.includes('Failed to fetch') ||
        err.message.includes('NetworkError') ||
        err.message.includes('network')
      );

      if ((isAbort || isNetwork) && retries > 0) {
        await new Promise(r => setTimeout(r, 1000));
        const freshHeader = await getAuthHeader();
        return fetchWithRetry(
          url,
          { ...options, headers: { ...options.headers, Authorization: freshHeader } },
          retries - 1,
        );
      }

      if (isAbort) throw new Error('İstek zaman aşımına uğradı. Lütfen tekrar deneyin.');
      if (isNetwork) throw new Error('Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.');
      throw err;
    }
  }, [getAuthHeader]);

  const fetchMembers = useCallback(async () => {
    if (!org?.id) return;
    setListLoading(true);
    try {
      const authHeader = await getAuthHeader();
      const res = await fetchWithRetry(EDGE_URL, {
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
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Üye listesi yüklenemedi.', 'error');
    } finally {
      setListLoading(false);
    }
  }, [org?.id, getAuthHeader, fetchWithRetry, addToast]);

  const fetchFirmalar = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('firmalar')
        .select('id, data')
        .order('id');
      if (!error && data) {
        const list = data
          .filter((f) => f.data?.silinmis !== true && f.data?.silinmis !== 'true')
          .map((f) => ({ id: f.id as string, ad: (f.data?.ad as string) || f.id }))
          .sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
        setFirmalar(list);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (org?.role === 'admin') {
      fetchMembers();
      fetchFirmalar();
    }
  }, [org?.role, fetchMembers, fetchFirmalar]);

  const handleAddUser = async () => {
    setFormError(null);
    if (!form.display_name.trim()) { setFormError('Ad Soyad zorunludur.'); return; }
    if (!form.email.trim() || !form.email.includes('@')) { setFormError('Geçerli bir e-posta girin.'); return; }
    if (!form.password || form.password.length < 8) { setFormError('Şifre en az 8 karakter olmalıdır.'); return; }
    if (form.role === 'firma_user' && !form.firm_id) { setFormError('Firma Yetkilisi rolü için firma seçimi zorunludur.'); return; }

    setFormLoading(true);
    try {
      const authHeader = await getAuthHeader();
      const payload: Record<string, unknown> = {
        action: 'create',
        organization_id: org?.id,
        email: form.email.trim().toLowerCase(),
        password: form.password,
        display_name: form.display_name.trim(),
        role: form.role,
      };
      if (form.role === 'firma_user' && form.firm_id) {
        payload.firm_id = form.firm_id;
      }
      const res = await fetchWithRetry(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let errorMsg = `Sunucu hatası (${res.status})`;
        try {
          const errJson = await res.json();
          errorMsg = errJson.error || errorMsg;
        } catch {
          const errText = await res.text().catch(() => '');
          if (errText) errorMsg = errText;
        }
        setFormError(errorMsg);
        return;
      }

      const json = await res.json();
      if (json.error) {
        setFormError(json.error);
      } else if (json.success === true && json.user_id) {
        addToast(`${form.display_name} başarıyla eklendi.`, 'success');
        setShowAddModal(false);
        setForm(emptyForm);
        await fetchMembers();
      } else {
        setFormError('Beklenmeyen yanıt. Lütfen listeyi kontrol edin.');
        await fetchMembers();
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Bilinmeyen hata oluştu.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleActive = async (member: Member) => {
    setActionLoading(member.user_id);
    try {
      const authHeader = await getAuthHeader();
      const res = await fetchWithRetry(EDGE_URL, {
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
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Güncelleme sırasında hata oluştu.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleChangeRole = async (member: Member, newRole: string) => {
    setActionLoading(member.user_id + '_role');
    try {
      const authHeader = await getAuthHeader();
      const res = await fetchWithRetry(EDGE_URL, {
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
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Rol güncellenirken hata oluştu.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteMember = async () => {
    if (!deleteConfirm) return;
    setActionLoading(deleteConfirm.user_id + '_delete');
    try {
      const authHeader = await getAuthHeader();
      const res = await fetchWithRetry(EDGE_URL, {
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
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Silme işlemi sırasında hata oluştu.', 'error');
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
      const res = await fetchWithRetry(EDGE_URL, {
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
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Şifre sıfırlanırken hata oluştu.');
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
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ background: roleConf.gradient }}
                  >
                    {(member.display_name || member.email || '?').charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate" style={{ color: nameColor }}>
                        {member.display_name || member.email}
                        {isMe && <span className="ml-1 text-xs font-normal" style={{ color: '#6366F1' }}>(siz)</span>}
                      </p>
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

                  {!isMe && (
                    <div className="flex items-center gap-2 flex-shrink-0">
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
                        <option value="admin">Admin Kullanıcı</option>
                        <option value="denetci">Saha Personeli</option>
                        <option value="member">Evrak/Dökümantasyon Denetçi</option>
                        <option value="firma_user">Firma Yetkilisi</option>
                      </select>

                      <button
                        onClick={() => { setResetTarget(member); setResetPassword(''); setResetError(null); setResetShowPassword(false); }}
                        title="Şifreyi Sıfırla"
                        className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all flex-shrink-0"
                        style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#F59E0B' }}
                      >
                        <i className="ri-lock-password-line text-xs" />
                      </button>

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

        <div
          className="flex items-start gap-2 px-3 py-2.5 rounded-lg"
          style={{
            background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.03)',
            border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(15,23,42,0.07)',
          }}
        >
          <i className="ri-information-line text-sm flex-shrink-0 mt-0.5" style={{ color: '#64748B' }} />
          <p className="text-xs leading-relaxed" style={{ color: subColor }}>
            <strong style={{ color: nameColor }}>Admin Kullanıcı:</strong> Tam yetki &bull;&nbsp;
            <strong style={{ color: '#06B6D4' }}>Saha Personeli:</strong> Saha denetim, tutanaklar ve raporlar &bull;&nbsp;
            <strong style={{ color: '#818CF8' }}>Evrak/Dökümantasyon Denetçi:</strong> Tüm modüller (ayarlar hariç)
          </p>
        </div>
      </div>

      {/* ── Add User Modal ── */}
      {showAddModal && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 99999 }}
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
                  onChange={e => setForm(p => ({ ...p, role: e.target.value, firm_id: '' }))}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <option value="member">Evrak/Dökümantasyon Denetçi</option>
                  <option value="denetci">Saha Personeli</option>
                  <option value="admin">Admin Kullanıcı</option>
                  <option value="firma_user">Firma Yetkilisi</option>
                </select>
              </div>

              {form.role === 'firma_user' && (
                <div>
                  <label style={labelStyle}>
                    Firma Seç *
                    <span style={{ color: '#EF4444', marginLeft: '2px' }}>(zorunlu)</span>
                  </label>
                  <select
                    value={form.firm_id}
                    onChange={e => setForm(p => ({ ...p, firm_id: e.target.value }))}
                    style={{ ...inputStyle, cursor: 'pointer', borderColor: !form.firm_id ? 'rgba(239,68,68,0.4)' : undefined }}
                  >
                    <option value="">-- Firma seçin --</option>
                    {firmalar.map(f => (
                      <option key={f.id} value={f.id}>{f.ad}</option>
                    ))}
                  </select>
                  {firmalar.length === 0 && (
                    <p className="text-[10px] mt-1" style={{ color: '#F59E0B' }}>
                      Henüz firma bulunamadı. Önce firma eklemeniz gerekiyor.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}
            >
              <i className="ri-building-2-line text-sm" style={{ color: '#6366F1' }} />
              <p className="text-xs flex-1 min-w-0" style={{ color: '#818CF8' }}>
                <strong>{org.name}</strong> organizasyonuna otomatik olarak eklenecek
              </p>
            </div>

            {formError && (
              <div
                className="flex items-start gap-2 px-4 py-3 rounded-xl text-sm"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#F87171' }}
              >
                <i className="ri-error-warning-line flex-shrink-0 mt-0.5" />
                <span>{formError}</span>
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
        </div>,
        document.body
      )}

      {/* ── Reset Password Modal ── */}
      {resetTarget && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 99999 }}
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
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
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
        </div>,
        document.body
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteConfirm && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 99999 }}
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
                <strong>{deleteConfirm.display_name || deleteConfirm.email}</strong> kullanıcısını organizasyondan kaldırmak ve hesabını silmek istediğinize emin misiniz?
              </p>
              <p className="text-xs mt-1.5" style={{ color: subColor }}>Kullanıcı organizasyondan çıkarılacak ve hesabı tamamen silinecektir. Bir daha giriş yapamayacaktır.</p>
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
        </div>,
        document.body
      )}
    </>
  );
}
