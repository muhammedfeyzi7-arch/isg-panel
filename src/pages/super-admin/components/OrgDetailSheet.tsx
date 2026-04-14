import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { OrgAdmin } from '../hooks/useOrganizationAdmin';
import OrgMembersTab from './OrgMembersTab';

const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;

function saHeaders() {
  const token = sessionStorage.getItem('sa_access_token') ?? '';
  return { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` };
}

interface ActivityLog {
  id: string;
  user_name: string | null;
  user_email: string | null;
  user_role: string | null;
  action_type: string | null;
  module: string | null;
  description: string | null;
  created_at: string;
  severity: string | null;
}

const ACTION_ICON: Record<string, { icon: string; cls: string }> = {
  create:  { icon: 'ri-add-circle-line',       cls: 'text-emerald-600 bg-emerald-50' },
  update:  { icon: 'ri-edit-line',             cls: 'text-sky-600 bg-sky-50' },
  delete:  { icon: 'ri-delete-bin-line',       cls: 'text-red-500 bg-red-50' },
  login:   { icon: 'ri-login-circle-line',     cls: 'text-slate-600 bg-slate-100' },
  logout:  { icon: 'ri-logout-circle-line',    cls: 'text-slate-500 bg-slate-100' },
  view:    { icon: 'ri-eye-line',              cls: 'text-slate-500 bg-slate-100' },
  export:  { icon: 'ri-download-line',         cls: 'text-amber-600 bg-amber-50' },
  import:  { icon: 'ri-upload-line',           cls: 'text-amber-600 bg-amber-50' },
  approve: { icon: 'ri-checkbox-circle-line',  cls: 'text-emerald-600 bg-emerald-50' },
  reject:  { icon: 'ri-close-circle-line',     cls: 'text-red-500 bg-red-50' },
};

function getActionCfg(type: string | null) {
  return ACTION_ICON[type?.toLowerCase() ?? ''] ?? { icon: 'ri-file-text-line', cls: 'text-slate-500 bg-slate-100' };
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}sn önce`;
  if (diff < 3600) return `${Math.floor(diff / 60)}dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}sa önce`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}g önce`;
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
}

function ActivityTab({ orgId }: { orgId: string }) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/activity_logs?organization_id=eq.${encodeURIComponent(orgId)}&select=id,user_name,user_email,user_role,action_type,module,description,created_at,severity&order=created_at.desc&limit=50`,
        { headers: saHeaders() }
      );
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt}`);
      }
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hata oluştu');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  if (loading) return (
    <div className="flex items-center justify-center py-12 text-slate-400">
      <i className="ri-loader-4-line animate-spin text-xl mr-2"></i>
      <span className="text-sm font-medium">Yükleniyor...</span>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center py-10 gap-3">
      <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
        <i className="ri-error-warning-line text-red-400 text-lg"></i>
      </div>
      <p className="text-red-500 text-xs text-center max-w-[240px]">{error}</p>
      <button onClick={fetchLogs} className="text-xs text-slate-500 underline cursor-pointer">Tekrar Dene</button>
    </div>
  );

  if (logs.length === 0) return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
        <i className="ri-history-line text-2xl text-slate-300"></i>
      </div>
      <p className="text-slate-500 text-sm font-medium mb-1">Aktivite Kaydı Yok</p>
      <p className="text-slate-400 text-xs max-w-[220px]">Bu organizasyona ait henüz bir aktivite kaydı bulunmuyor.</p>
    </div>
  );

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-3">
        <p className="text-slate-500 text-xs font-medium">Son {logs.length} aktivite</p>
        <button onClick={fetchLogs} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer transition-colors">
          <i className="ri-refresh-line text-xs"></i>
        </button>
      </div>
      {logs.map(log => {
        const cfg = getActionCfg(log.action_type);
        const initials = (log.user_name || log.user_email || '?').charAt(0).toUpperCase();
        return (
          <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group">
            <div className={`w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 text-sm ${cfg.cls}`}>
              <i className={cfg.icon}></i>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                <span className="text-slate-800 text-xs font-semibold">{log.user_name || log.user_email || 'Sistem'}</span>
                {log.module && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">{log.module}</span>
                )}
              </div>
              <p className="text-slate-500 text-xs leading-relaxed">{log.description || log.action_type || '—'}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-slate-400 text-[10px] whitespace-nowrap">{timeAgo(log.created_at)}</span>
              {log.severity === 'high' && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0"></span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface Props {
  org: OrgAdmin | null;
  superAdminUserId: string | null;
  onClose: () => void;
  onUpdate: (orgId: string, fields: { subscription_end?: string; is_active?: boolean }) => Promise<void>;
  onDelete: (orgId: string) => Promise<void>;
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function daysLeft(d: string | null | undefined) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

function orgInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

type TabType = 'users' | 'activity' | 'system';

export default function OrgDetailSheet({ org, superAdminUserId, onClose, onUpdate, onDelete }: Props) {
  const [tab, setTab] = useState<TabType>('users');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  useEffect(() => {
    if (org) {
      setEndDate(org.subscription_end || '');
      setConfirmDelete(false);
      setTab('users');
    }
  }, [org]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const handleToggleActive = async () => {
    if (!org) return;
    setSaving(true);
    try {
      await onUpdate(org.id, { is_active: !org.is_active });
      setToast({ msg: org.is_active ? 'Pasife alındı.' : 'Aktif edildi.', type: 'ok' });
    } catch { setToast({ msg: 'İşlem başarısız.', type: 'err' }); }
    finally { setSaving(false); }
  };

  const handleSaveDate = async () => {
    if (!org || !endDate) return;
    setSaving(true);
    try {
      await onUpdate(org.id, { subscription_end: endDate });
      setToast({ msg: 'Tarih güncellendi.', type: 'ok' });
    } catch { setToast({ msg: 'Güncelleme başarısız.', type: 'err' }); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!org) return;
    setDeleting(true);
    try { await onDelete(org.id); onClose(); }
    catch { setToast({ msg: 'Silme başarısız.', type: 'err' }); setDeleting(false); }
  };

  if (!org) return null;

  const days = daysLeft(org.subscription_end);
  const isExpired = org.subscription_end ? new Date(org.subscription_end) < new Date() : false;
  const initials = orgInitials(org.name);

  return createPortal(
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-[100]" onClick={onClose} />
      
      {/* Sidebar */}
      <div className="fixed right-0 top-0 h-full w-full md:max-w-md bg-white border-l border-slate-200 z-[100] flex flex-col shadow-2xl animate-in slide-in-from-right">

        {/* Header - Üst Alan (Summary) */}
        <div className="bg-slate-50 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-start justify-between px-5 pt-5 pb-4">
            <div className="flex gap-4">
              <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-900 text-white font-bold text-lg flex-shrink-0 shadow-sm">
                {initials}
              </div>
              <div className="min-w-0 pt-0.5">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-slate-800 font-bold text-base leading-tight truncate">{org.name}</h2>
                  {org.org_type === 'osgb' ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-teal-100 text-teal-700">OSGB</span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-600">Firma</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="font-mono">{org.invite_code}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                  <span className="flex items-center gap-1">
                    <i className="ri-team-line"></i> {org.member_count || 0} üye
                  </span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer flex-shrink-0">
              <i className="ri-close-line text-xl"></i>
            </button>
          </div>

          {/* Durum / Abonelik Özeti */}
          <div className="px-5 pb-5">
            <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
              {/* Aktif/Pasif */}
              <div className="flex flex-col flex-1 border-r border-slate-100">
                <span className="text-[10px] font-bold uppercase text-slate-400 mb-1">Durum</span>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${org.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                  <span className={`text-sm font-semibold ${org.is_active ? 'text-emerald-700' : 'text-slate-500'}`}>
                    {org.is_active ? 'Aktif' : 'Pasif'}
                  </span>
                </div>
              </div>
              
              {/* Kalan Gün */}
              <div className="flex flex-col flex-1 pl-3">
                <span className="text-[10px] font-bold uppercase text-slate-400 mb-1">Abonelik</span>
                <div className="flex items-center gap-1.5">
                  {!org.is_active ? (
                    <span className="text-sm font-semibold text-slate-400">—</span>
                  ) : isExpired ? (
                    <span className="text-sm font-semibold text-red-600">Doldu</span>
                  ) : days !== null && days <= 14 ? (
                    <span className="text-sm font-semibold text-amber-600">{days} gün kaldı</span>
                  ) : days !== null ? (
                    <span className="text-sm font-semibold text-slate-700">{days} gün kaldı</span>
                  ) : (
                    <span className="text-sm font-semibold text-slate-700">Sınırsız</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-5 flex-shrink-0 bg-white">
          {([
            { id: 'users', icon: 'ri-user-settings-line', label: 'Kullanıcılar' },
            { id: 'activity', icon: 'ri-history-line', label: 'Aktivite' },
            { id: 'system', icon: 'ri-settings-4-line', label: 'Sistem Bilgisi' },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-3.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                tab === t.id ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <i className={t.icon}></i>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-white">
          <div className="p-5">
            {tab === 'users' && <OrgMembersTab orgId={org.id} />}

            {tab === 'activity' && <ActivityTab orgId={org.id} />}

            {tab === 'system' && (
              <div className="space-y-6">
                
                {/* Sistem Bilgileri */}
                <div className="space-y-3">
                  <h3 className="text-slate-800 font-bold text-sm">Kayıt Bilgileri</h3>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                      <span className="text-slate-500 text-xs font-medium">Oluşturulma Tarihi</span>
                      <span className="text-sm font-semibold text-slate-700">{formatDate(org.created_at)}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white">
                      <span className="text-slate-500 text-xs font-medium">Başlangıç Tarihi</span>
                      <span className="text-sm font-semibold text-slate-700">{formatDate(org.subscription_start)}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-50">
                      <span className="text-slate-500 text-xs font-medium">Mevcut Bitiş Tarihi</span>
                      <span className={`text-sm font-semibold ${isExpired ? 'text-red-600' : 'text-slate-700'}`}>
                        {formatDate(org.subscription_end)}
                      </span>
                    </div>
                  </div>
                </div>

                <hr className="border-slate-100" />

                {/* Abonelik Yönetimi */}
                <div className="space-y-3">
                  <h3 className="text-slate-800 font-bold text-sm">Süre Uzat / Güncelle</h3>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="flex-1 bg-white border border-slate-200 text-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all"
                    />
                    <button
                      onClick={handleSaveDate}
                      disabled={saving || !endDate || endDate === org.subscription_end}
                      className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2"
                    >
                      {saving ? <i className="ri-loader-4-line animate-spin text-sm"></i> : <i className="ri-save-line text-sm"></i>}
                      Kaydet
                    </button>
                  </div>
                </div>

                <hr className="border-slate-100" />

                {/* Kritik İşlemler */}
                <div className="space-y-3">
                  <h3 className="text-slate-800 font-bold text-sm">Hesap Durumu</h3>
                  
                  {/* Aktif/Pasif Button */}
                  <button
                    onClick={handleToggleActive}
                    disabled={saving}
                    className={`w-full py-3 rounded-xl text-sm font-bold transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 border ${
                      org.is_active
                        ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-sm'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    {saving
                      ? <><i className="ri-loader-4-line animate-spin text-sm"></i> İşleniyor...</>
                      : org.is_active ? <><i className="ri-pause-circle-line"></i> Hesabı Pasife Al</> : <><i className="ri-play-circle-line"></i> Hesabı Aktif Et</>
                    }
                  </button>

                  {/* Silme Alanı */}
                  {superAdminUserId && org.created_by === superAdminUserId ? (
                    <div className="mt-6 p-4 rounded-xl border border-red-100 bg-red-50/50">
                      <div className="flex items-center gap-2 mb-2">
                        <i className="ri-error-warning-fill text-red-500"></i>
                        <h4 className="text-red-700 font-bold text-sm">Kalıcı Silme</h4>
                      </div>
                      <p className="text-red-600/80 text-xs mb-4">
                        Bu işlem hesabı tamamen kaldırır. Veriler soft delete ile gizlense de sistemden silinmiş sayılır.
                      </p>
                      
                      {!confirmDelete ? (
                        <button
                          onClick={() => setConfirmDelete(true)}
                          className="w-full py-2.5 rounded-xl text-xs font-bold bg-white border border-red-200 text-red-600 hover:bg-red-50 transition-colors cursor-pointer shadow-sm"
                        >
                          Hesabı Sil...
                        </button>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-red-600 text-xs font-bold text-center">Emin misiniz? Geri alınamaz.</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setConfirmDelete(false)}
                              className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                              İptal
                            </button>
                            <button
                              onClick={handleDelete}
                              disabled={deleting}
                              className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              {deleting ? <i className="ri-loader-4-line animate-spin text-sm"></i> : <i className="ri-delete-bin-line"></i>}
                              Evet, Sil
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div className="absolute bottom-5 left-5 right-5">
            <div className={`flex items-center gap-2 text-sm font-medium rounded-xl px-4 py-3 shadow-lg border animate-in slide-in-from-bottom-2 ${
              toast.type === 'ok'
                ? 'bg-emerald-500 border-emerald-600 text-white'
                : 'bg-red-500 border-red-600 text-white'
            }`}>
              <i className={`text-base ${toast.type === 'ok' ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'}`}></i>
              {toast.msg}
            </div>
          </div>
        )}
      </div>
    </>,
    document.body
  );
}
