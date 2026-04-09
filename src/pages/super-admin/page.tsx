import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const EDGE_URL = 'https://niuvjthvhjbfyuuhoowq.supabase.co/functions/v1/super-admin-orgs';

interface Organization {
  id: string;
  name: string;
  invite_code: string;
  is_active: boolean;
  subscription_start: string | null;
  subscription_end: string | null;
  created_at: string;
  member_count: number;
  creator_email: string | null;
  last_activity: string | null;
  total_actions: number;
}

interface Member {
  id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  role: string;
  is_active: boolean;
  joined_at: string | null;
  last_activity: string | null;
  last_action: string | null;
  action_count: number;
}

interface ActivityLog {
  id: string;
  user_email: string | null;
  user_name: string | null;
  action_type: string | null;
  module: string | null;
  description: string | null;
  created_at: string;
  severity: string | null;
}

interface EditForm {
  is_active: boolean;
  subscription_start: string;
  subscription_end: string;
}

type AccessState = 'loading' | 'forbidden' | 'granted';
type ModalType = 'members' | 'activity' | null;

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatDate(d: string | null, withTime = false) {
  if (!d) return '—';
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
  if (withTime) { opts.hour = '2-digit'; opts.minute = '2-digit'; }
  return new Date(d).toLocaleDateString('tr-TR', opts);
}

function timeAgo(d: string | null) {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Az önce';
  if (mins < 60) return `${mins} dk önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} sa önce`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} gün önce`;
  return formatDate(d);
}

function initials(name: string | null, email: string) {
  if (name) {
    const parts = name.trim().split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

// ─── Subscription Warning Banner ────────────────────────────────────────────
function SubscriptionWarningBanner({
  orgs,
  onSendAlert,
}: {
  orgs: Organization[];
  onSendAlert: (org: Organization) => void;
}) {
  const now = new Date();
  const warnings = orgs
    .filter(org => org.is_active && org.subscription_end)
    .map(org => {
      const end = new Date(org.subscription_end!);
      end.setHours(23, 59, 59, 999);
      const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { org, diffDays };
    })
    .filter(({ diffDays }) => diffDays > 0 && diffDays <= 30)
    .sort((a, b) => a.diffDays - b.diffDays);

  if (warnings.length === 0) return null;

  return (
    <div className="mb-6 space-y-2">
      {warnings.map(({ org, diffDays }) => {
        const isCritical = diffDays <= 3;
        return (
          <div
            key={org.id}
            className={`flex items-center gap-3 px-5 py-4 rounded-xl border ${
              isCritical ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
            }`}
          >
            <div className={`w-5 h-5 flex items-center justify-center shrink-0 ${isCritical ? 'text-red-500' : 'text-amber-500'}`}>
              <i className={isCritical ? 'ri-alarm-warning-line' : 'ri-time-line'} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${isCritical ? 'text-red-800' : 'text-amber-800'}`}>
                {isCritical ? 'Kritik Uyarı' : 'Abonelik Uyarısı'}
              </p>
              <p className={`text-xs mt-0.5 ${isCritical ? 'text-red-700' : 'text-amber-700'}`}>
                <strong>{org.name}</strong> organizasyonunun aboneliği{' '}
                <strong>{diffDays} gün</strong> içinde sona erecek.
                Üyeliğiniz hakkında bilgi almak için hizmet sağlayıcınızla iletişime geçin.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                isCritical ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {diffDays} gün
              </span>
              <button
                onClick={() => onSendAlert(org)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isCritical
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-amber-600 text-white hover:bg-amber-700'
                }`}
              >
                <i className="ri-mail-send-line" />
                Uyarı Gönder
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Activity Modal ──────────────────────────────────────────────────────────
function ActivityModal({
  org,
  onClose,
  getAuthHeader,
}: {
  org: Organization;
  onClose: () => void;
  getAuthHeader: () => Promise<string | null>;
}) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getAuthHeader();
        if (!token) throw new Error('Oturum bulunamadı');
        const res = await fetch(`${EDGE_URL}?op=org_activity&orgId=${org.id}`, {
          headers: { Authorization: token },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Hata');
        setLogs(json.data ?? []);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [org.id, getAuthHeader]);

  const severityColor = (s: string | null) => {
    if (s === 'high') return 'text-red-500';
    if (s === 'medium') return 'text-amber-500';
    return 'text-gray-400';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">{org.name} — Aktivite Logları</h2>
            <p className="text-xs text-gray-400 mt-0.5">Son 30 işlem · Toplam {org.total_actions} işlem</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer text-gray-400">
            <i className="ri-close-line text-lg" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Loglar yükleniyor...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded-full">
                <i className="ri-file-list-line text-gray-400 text-xl" />
              </div>
              <p className="text-sm text-gray-400">Henüz aktivite kaydı yok</p>
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map(log => (
                <div key={log.id} className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
                  <div className={`w-5 h-5 flex items-center justify-center shrink-0 mt-0.5 ${severityColor(log.severity)}`}>
                    <i className="ri-circle-fill text-[6px]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-gray-700">{log.user_name ?? log.user_email ?? '—'}</span>
                      {log.module && (
                        <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">{log.module}</span>
                      )}
                      {log.action_type && (
                        <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">{log.action_type}</span>
                      )}
                    </div>
                    {log.description && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{log.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">{timeAgo(log.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/60">
          <p className="text-xs text-gray-400 text-center">
            Üyeliğiniz hakkında bilgi almak için hizmet sağlayıcınızla iletişime geçin.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Members Modal ───────────────────────────────────────────────────────────
function MembersModal({
  org,
  onClose,
  getAuthHeader,
  showToast,
}: {
  org: Organization;
  onClose: () => void;
  getAuthHeader: () => Promise<string | null>;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAuthHeader();
      if (!token) throw new Error('Oturum bulunamadı');
      const res = await fetch(`${EDGE_URL}?op=get_members&orgId=${org.id}`, {
        headers: { Authorization: token },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Hata');
      setMembers(json.data ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [org.id, getAuthHeader]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const startEditRole = (m: Member) => {
    setEditingMemberId(m.id);
    setEditRole(m.role);
  };

  const saveRole = async (m: Member) => {
    setSaving(true);
    try {
      const token = await getAuthHeader();
      if (!token) throw new Error('No token');
      const res = await fetch(`${EDGE_URL}?op=update_member`, {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: m.id, role: editRole }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Hata');
      showToast('Rol güncellendi', 'success');
      setEditingMemberId(null);
      await loadMembers();
    } catch (e) {
      showToast('Hata: ' + String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (m: Member) => {
    setSaving(true);
    try {
      const token = await getAuthHeader();
      if (!token) throw new Error('No token');
      const res = await fetch(`${EDGE_URL}?op=remove_member`, {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: m.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Hata');
      showToast('Üye çıkarıldı', 'success');
      setConfirmRemove(null);
      await loadMembers();
    } catch (e) {
      showToast('Hata: ' + String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = (role: string) => {
    if (role === 'admin') return { label: 'Yönetici', color: 'bg-emerald-100 text-emerald-700' };
    if (role === 'manager') return { label: 'Müdür', color: 'bg-amber-100 text-amber-700' };
    return { label: 'Üye', color: 'bg-gray-100 text-gray-600' };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Confirm Remove Dialog */}
      {confirmRemove && (
        <div className="relative z-10 bg-white rounded-2xl p-6 w-full max-w-sm">
          <div className="w-12 h-12 flex items-center justify-center bg-red-100 rounded-full mx-auto mb-4">
            <i className="ri-user-unfollow-line text-red-500 text-xl" />
          </div>
          <h3 className="text-base font-bold text-gray-900 text-center mb-2">Üyeyi Çıkar</h3>
          <p className="text-sm text-gray-500 text-center mb-6">
            <strong>{confirmRemove.display_name ?? confirmRemove.email}</strong> adlı üyeyi organizasyondan çıkarmak istediğinize emin misiniz?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmRemove(null)}
              className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              İptal
            </button>
            <button
              onClick={() => removeMember(confirmRemove)}
              disabled={saving}
              className="flex-1 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              {saving ? 'Çıkarılıyor...' : 'Çıkar'}
            </button>
          </div>
        </div>
      )}

      {!confirmRemove && (
        <div className="relative bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-base font-bold text-gray-900">{org.name} — Üyeler</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {loading ? 'Yükleniyor...' : `${members.length} üye`}
              </p>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer text-gray-400">
              <i className="ri-close-line text-lg" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
                <p className="text-sm text-gray-400">Üyeler yükleniyor...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-10 h-10 flex items-center justify-center bg-red-100 rounded-full">
                  <i className="ri-error-warning-line text-red-500" />
                </div>
                <p className="text-sm text-red-500">{error}</p>
              </div>
            ) : members.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded-full">
                  <i className="ri-user-line text-gray-400 text-xl" />
                </div>
                <p className="text-sm text-gray-400">Bu organizasyonda üye bulunmuyor</p>
              </div>
            ) : (
              <div className="space-y-2">
                {members.map(m => {
                  const role = roleLabel(m.role);
                  const isEditing = editingMemberId === m.id;
                  return (
                    <div key={m.id} className={`rounded-xl border p-4 transition-colors ${isEditing ? 'border-gray-300 bg-gray-50' : 'border-gray-100 hover:bg-gray-50/60'}`}>
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-200 shrink-0 text-xs font-bold text-gray-600">
                          {initials(m.display_name, m.email)}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {m.display_name && (
                              <span className="text-sm font-medium text-gray-900">{m.display_name}</span>
                            )}
                            <span className="text-xs text-gray-400 truncate">{m.email}</span>
                            <span className={`w-2 h-2 rounded-full shrink-0 ${m.is_active ? 'bg-green-400' : 'bg-gray-300'}`} title={m.is_active ? 'Aktif' : 'Pasif'} />
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-xs text-gray-400">
                              <i className="ri-calendar-line mr-1" />
                              Katılım: {formatDate(m.joined_at)}
                            </span>
                            {m.last_activity && (
                              <span className="text-xs text-gray-400">
                                <i className="ri-time-line mr-1" />
                                Son: {timeAgo(m.last_activity)}
                              </span>
                            )}
                            <span className="text-xs text-gray-400">
                              <i className="ri-bar-chart-line mr-1" />
                              {m.action_count} işlem
                            </span>
                          </div>
                        </div>

                        {/* Role + Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {isEditing ? (
                            <>
                              <select
                                value={editRole}
                                onChange={e => setEditRole(e.target.value)}
                                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-200 cursor-pointer"
                              >
                                <option value="member">Üye</option>
                                <option value="manager">Müdür</option>
                                <option value="admin">Yönetici</option>
                              </select>
                              <button
                                onClick={() => saveRole(m)}
                                disabled={saving}
                                className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                              >
                                {saving ? '...' : 'Kaydet'}
                              </button>
                              <button
                                onClick={() => setEditingMemberId(null)}
                                className="text-xs px-2 py-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                              >
                                İptal
                              </button>
                            </>
                          ) : (
                            <>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${role.color}`}>
                                {role.label}
                              </span>
                              <button
                                onClick={() => startEditRole(m)}
                                className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                                title="Rolü Değiştir"
                              >
                                <i className="ri-edit-line text-xs" />
                              </button>
                              <button
                                onClick={() => setConfirmRemove(m)}
                                className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Üyeyi Çıkar"
                              >
                                <i className="ri-user-unfollow-line text-xs" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/60">
            <p className="text-xs text-gray-400 text-center">
              Üyeliğiniz hakkında bilgi almak için hizmet sağlayıcınızla iletişime geçin.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Alert Confirm Modal ─────────────────────────────────────────────────────
function AlertConfirmModal({
  org,
  onClose,
  onConfirm,
  sending,
  result,
}: {
  org: Organization;
  onClose: () => void;
  onConfirm: () => void;
  sending: boolean;
  result: { success: boolean; message: string; members?: { email: string }[] } | null;
}) {
  const now = new Date();
  const end = org.subscription_end ? new Date(org.subscription_end) : null;
  end?.setHours(23, 59, 59, 999);
  const diffDays = end ? Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl p-6 w-full max-w-md">
        {result ? (
          <>
            <div className={`w-12 h-12 flex items-center justify-center rounded-full mx-auto mb-4 ${result.success ? 'bg-green-100' : 'bg-amber-100'}`}>
              <i className={`text-xl ${result.success ? 'ri-mail-check-line text-green-600' : 'ri-mail-line text-amber-600'}`} />
            </div>
            <h3 className="text-base font-bold text-gray-900 text-center mb-2">
              {result.success ? 'E-postalar Gönderildi' : 'Bilgi'}
            </h3>
            <p className="text-sm text-gray-500 text-center mb-4">{result.message}</p>
            {result.members && result.members.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-3 mb-4 max-h-40 overflow-y-auto">
                <p className="text-xs font-medium text-gray-600 mb-2">Etkilenen üyeler:</p>
                {result.members.map(m => (
                  <p key={m.email} className="text-xs text-gray-500 py-0.5">{m.email}</p>
                ))}
              </div>
            )}
            <button
              onClick={onClose}
              className="w-full py-2.5 text-sm bg-gray-900 text-white rounded-xl hover:bg-gray-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              Tamam
            </button>
          </>
        ) : (
          <>
            <div className="w-12 h-12 flex items-center justify-center bg-amber-100 rounded-full mx-auto mb-4">
              <i className="ri-mail-send-line text-amber-600 text-xl" />
            </div>
            <h3 className="text-base font-bold text-gray-900 text-center mb-2">Abonelik Uyarısı Gönder</h3>
            <p className="text-sm text-gray-500 text-center mb-1">
              <strong>{org.name}</strong> organizasyonunun tüm aktif üyelerine abonelik uyarısı gönderilecek.
            </p>
            {diffDays !== null && (
              <p className="text-sm text-center font-semibold text-amber-700 mb-6">
                Kalan süre: {diffDays} gün
              </p>
            )}
            <p className="text-xs text-gray-400 text-center mb-6">
              Üyeliğiniz hakkında bilgi almak için hizmet sağlayıcınızla iletişime geçin.
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
              >
                İptal
              </button>
              <button
                onClick={onConfirm}
                disabled={sending}
                className="flex-1 py-2.5 text-sm bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                {sending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                    Gönderiliyor...
                  </span>
                ) : 'Uyarı Gönder'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function SuperAdminPage() {
  const [access, setAccess] = useState<AccessState>('loading');
  const [currentEmail, setCurrentEmail] = useState('');
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ is_active: true, subscription_start: '', subscription_end: '' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [search, setSearch] = useState('');
  const [membersOrg, setMembersOrg] = useState<Organization | null>(null);
  const [activityOrg, setActivityOrg] = useState<Organization | null>(null);
  const [alertOrg, setAlertOrg] = useState<Organization | null>(null);
  const [alertSending, setAlertSending] = useState(false);
  const [alertResult, setAlertResult] = useState<{ success: boolean; message: string; members?: { email: string }[] } | null>(null);
  const [forbiddenReason, setForbiddenReason] = useState('');

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const getAuthHeader = useCallback(async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ? `Bearer ${data.session.access_token}` : null;
  }, []);

  const checkAccess = useCallback(async () => {
    setAccess('loading');
    try {
      const token = await getAuthHeader();
      if (!token) { setForbiddenReason('Oturum bulunamadı. Lütfen önce giriş yapın.'); setAccess('forbidden'); return; }
      const res = await fetch(`${EDGE_URL}?op=check_admin`, { headers: { Authorization: token } });
      const json = await res.json();
      if (res.status === 200) { setCurrentEmail(json.email ?? ''); setAccess('granted'); }
      else { setForbiddenReason(json.error ?? `HTTP ${res.status}`); setAccess('forbidden'); }
    } catch (e) { setForbiddenReason(String(e)); setAccess('forbidden'); }
  }, [getAuthHeader]);

  const loadOrgs = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAuthHeader();
      if (!token) throw new Error('No token');
      const res = await fetch(`${EDGE_URL}?op=list`, { headers: { Authorization: token } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Hata');
      setOrgs(json.data ?? []);
    } catch (e) {
      showToast('Organizasyonlar yüklenemedi: ' + String(e), 'error');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader, showToast]);

  useEffect(() => { checkAccess(); }, [checkAccess]);
  useEffect(() => { if (access === 'granted') loadOrgs(); }, [access, loadOrgs]);

  const startEdit = (org: Organization) => {
    setEditingId(org.id);
    setEditForm({
      is_active: org.is_active,
      subscription_start: org.subscription_start ? org.subscription_start.slice(0, 10) : new Date().toISOString().slice(0, 10),
      subscription_end: org.subscription_end ? org.subscription_end.slice(0, 10) : '',
    });
  };

  const saveEdit = async (orgId: string) => {
    setSaving(true);
    try {
      const token = await getAuthHeader();
      if (!token) throw new Error('No token');
      const res = await fetch(`${EDGE_URL}?op=update`, {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, is_active: editForm.is_active, subscription_start: editForm.subscription_start || null, subscription_end: editForm.subscription_end || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Hata');
      showToast('Kaydedildi!', 'success');
      setEditingId(null);
      await loadOrgs();
    } catch (e) {
      showToast('Kayıt hatası: ' + String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const sendAlert = async () => {
    if (!alertOrg) return;
    setAlertSending(true);
    try {
      const token = await getAuthHeader();
      if (!token) throw new Error('No token');
      const res = await fetch(`${EDGE_URL}?op=send_subscription_alerts`, {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: alertOrg.id }),
      });
      const json = await res.json();
      if (json.success) {
        setAlertResult({ success: true, message: `${json.results?.length ?? 0} üyeye e-posta başarıyla gönderildi.` });
      } else {
        // No email service - show member list
        setAlertResult({
          success: false,
          message: json.error ?? 'E-posta servisi yapılandırılmamış. Aşağıdaki üyelerle manuel iletişime geçebilirsiniz.',
          members: json.members ?? [],
        });
      }
    } catch (e) {
      setAlertResult({ success: false, message: 'Hata: ' + String(e) });
    } finally {
      setAlertSending(false);
    }
  };

  const getStatus = (org: Organization) => {
    if (!org.is_active) return { label: 'Pasif', color: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' };
    if (!org.subscription_end) return { label: 'Aktif', color: 'bg-green-50 text-green-700', dot: 'bg-green-500' };
    const end = new Date(org.subscription_end);
    end.setHours(23, 59, 59, 999);
    const now = new Date();
    // diffDays: negative means expired
    const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return { label: 'Süresi Doldu', color: 'bg-red-50 text-red-700', dot: 'bg-red-500' };
    if (diffDays <= 3) return { label: `${diffDays} gün kaldı`, color: 'bg-red-50 text-red-700', dot: 'bg-red-500' };
    if (diffDays <= 30) return { label: `${diffDays} gün kaldı`, color: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' };
    return { label: 'Aktif', color: 'bg-green-50 text-green-700', dot: 'bg-green-500' };
  };

  const filtered = orgs.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.invite_code.toLowerCase().includes(search.toLowerCase()) ||
    (o.creator_email ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: orgs.length,
    active: orgs.filter(o => {
      const s = getStatus(o);
      return s.label === 'Aktif';
    }).length,
    expired: orgs.filter(o => getStatus(o).label === 'Süresi Doldu').length,
    expiringSoon: orgs.filter(o => getStatus(o).label.includes('gün kaldı')).length,
    passive: orgs.filter(o => !o.is_active).length,
  };

  if (access === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Yetki kontrol ediliyor...</p>
        </div>
      </div>
    );
  }

  if (access === 'forbidden') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4 bg-red-100 rounded-full">
            <i className="ri-shield-cross-line text-2xl text-red-500" />
          </div>
          <h1 className="text-xl font-semibold text-gray-800 mb-2">Erişim Reddedildi</h1>
          <p className="text-gray-500 text-sm">Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
          {forbiddenReason && (
            <p className="text-gray-400 text-xs mt-2 bg-gray-100 px-3 py-2 rounded-lg font-mono">{forbiddenReason}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Modals */}
      {membersOrg && (
        <MembersModal
          org={membersOrg}
          onClose={() => setMembersOrg(null)}
          getAuthHeader={getAuthHeader}
          showToast={showToast}
        />
      )}
      {activityOrg && (
        <ActivityModal
          org={activityOrg}
          onClose={() => setActivityOrg(null)}
          getAuthHeader={getAuthHeader}
        />
      )}
      {alertOrg && (
        <AlertConfirmModal
          org={alertOrg}
          onClose={() => { setAlertOrg(null); setAlertResult(null); }}
          onConfirm={sendAlert}
          sending={alertSending}
          result={alertResult}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-lg text-sm font-medium shadow-sm ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <i className="ri-check-line mr-2" /> : <i className="ri-error-warning-line mr-2" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center bg-gray-900 rounded-lg">
              <i className="ri-shield-keyhole-line text-white text-sm" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">Super Admin Paneli</h1>
              <p className="text-xs text-gray-400">{currentEmail}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full font-medium">
              <i className="ri-shield-check-line mr-1" />Yetkili Erişim
            </span>
            <button
              onClick={loadOrgs}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              <i className={`ri-refresh-line ${loading ? 'animate-spin' : ''}`} />
              Yenile
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">

        {/* Warning Banners */}
        <SubscriptionWarningBanner
          orgs={orgs}
          onSendAlert={org => { setAlertOrg(org); setAlertResult(null); }}
        />

        {/* Stats */}
        <div className="grid grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Toplam', value: stats.total, icon: 'ri-building-2-line', bg: 'bg-gray-100', text: 'text-gray-700' },
            { label: 'Aktif', value: stats.active, icon: 'ri-checkbox-circle-line', bg: 'bg-green-100', text: 'text-green-700' },
            { label: 'Süresi Doldu', value: stats.expired, icon: 'ri-close-circle-line', bg: 'bg-red-100', text: 'text-red-700' },
            { label: 'Yakında Dolacak', value: stats.expiringSoon, icon: 'ri-time-line', bg: 'bg-amber-100', text: 'text-amber-700' },
            { label: 'Pasif', value: stats.passive, icon: 'ri-pause-circle-line', bg: 'bg-gray-100', text: 'text-gray-500' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className={`w-8 h-8 flex items-center justify-center rounded-lg ${card.bg} mb-3`}>
                <i className={`${card.icon} ${card.text} text-sm`} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative max-w-xs">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              type="text"
              placeholder="İsim, kod veya e-posta ara..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Yükleniyor...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <div className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded-full">
                <i className="ri-building-line text-gray-400 text-xl" />
              </div>
              <p className="text-sm text-gray-400">Organizasyon bulunamadı</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80">
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-3">Organizasyon</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Kurucu</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Durum</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Başlangıç</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Bitiş</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Aktivite</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Üye</th>
                  <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-3">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(org => {
                  const status = getStatus(org);
                  const isEditing = editingId === org.id;
                  return (
                    <tr key={org.id} className={`transition-colors ${isEditing ? 'bg-amber-50/60' : 'hover:bg-gray-50/60'}`}>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{org.name}</p>
                          <p className="text-xs text-gray-400 font-mono mt-0.5">{org.invite_code}</p>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <p className="text-xs text-gray-500">{org.creator_email ?? '—'}</p>
                      </td>

                      <td className="px-4 py-4">
                        {isEditing ? (
                          <div
                            onClick={() => setEditForm(f => ({ ...f, is_active: !f.is_active }))}
                            className="flex items-center gap-2 cursor-pointer w-fit"
                          >
                            <div className={`w-10 h-5 rounded-full transition-colors relative ${editForm.is_active ? 'bg-green-500' : 'bg-gray-300'}`}>
                              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${editForm.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                            </div>
                            <span className="text-xs text-gray-600 whitespace-nowrap">{editForm.is_active ? 'Aktif' : 'Pasif'}</span>
                          </div>
                        ) : (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                            {status.label}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editForm.subscription_start}
                            onChange={e => setEditForm(f => ({ ...f, subscription_start: e.target.value }))}
                            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-200 w-36"
                          />
                        ) : (
                          <span className="text-sm text-gray-600">
                            {org.subscription_start ? new Date(org.subscription_start).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editForm.subscription_end}
                            onChange={e => setEditForm(f => ({ ...f, subscription_end: e.target.value }))}
                            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-200 w-36"
                          />
                        ) : (
                          <span className="text-sm text-gray-600">
                            {org.subscription_end ? new Date(org.subscription_end).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                          </span>
                        )}
                      </td>

                      {/* Activity column */}
                      <td className="px-4 py-4">
                        <button
                          onClick={() => setActivityOrg(org)}
                          className="flex flex-col gap-0.5 text-left hover:bg-gray-100 px-2 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          <span className="text-xs text-gray-500 font-medium">{org.total_actions} işlem</span>
                          <span className="text-xs text-gray-400">{timeAgo(org.last_activity)}</span>
                        </button>
                      </td>

                      {/* Members column */}
                      <td className="px-4 py-4">
                        <button
                          onClick={() => setMembersOrg(org)}
                          className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <div className="w-4 h-4 flex items-center justify-center">
                            <i className="ri-user-line text-xs" />
                          </div>
                          <span className="font-medium">{org.member_count}</span>
                          <span className="text-gray-400">üye</span>
                          <i className="ri-arrow-right-s-line text-gray-300" />
                        </button>
                      </td>

                      <td className="px-6 py-4 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                            >
                              İptal
                            </button>
                            <button
                              onClick={() => saveEdit(org.id)}
                              disabled={saving}
                              className="px-4 py-1.5 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                            >
                              {saving ? (
                                <span className="flex items-center gap-1.5">
                                  <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                                  Kaydediliyor
                                </span>
                              ) : 'Kaydet'}
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => { setAlertOrg(org); setAlertResult(null); }}
                              className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                              title="Abonelik Uyarısı Gönder"
                            >
                              <i className="ri-mail-send-line text-sm" />
                            </button>
                            <button
                              onClick={() => startEdit(org)}
                              className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
                            >
                              <i className="ri-edit-line mr-1" />
                              Düzenle
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Info note */}
        <div className="mt-5 bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
          <div className="w-5 h-5 flex items-center justify-center mt-0.5 shrink-0">
            <i className="ri-information-line text-amber-500 text-sm" />
          </div>
          <div>
            <p className="text-sm font-medium text-amber-800 mb-1">Nasıl Çalışır?</p>
            <ul className="text-xs text-amber-700 space-y-1">
              <li>• <strong>Bitiş tarihi</strong> geçmiş organizasyonlar bir sonraki girişte sisteme giremez</li>
              <li>• <strong>Pasif</strong> yapılan organizasyonlar bir sonraki girişte anında engellenir</li>
              <li>• Tarih boş bırakılırsa o organizasyon süresiz aktif sayılır</li>
              <li>• Abonelik uyarıları <strong>14 gün</strong> ve <strong>3 gün</strong> kala otomatik gösterilir</li>
              <li>• <strong>Üye modalından</strong> rol değiştirme ve üye çıkarma yapılabilir</li>
              <li>• <strong>Aktivite sütununa</strong> tıklayarak son 30 işlemi görebilirsiniz</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
