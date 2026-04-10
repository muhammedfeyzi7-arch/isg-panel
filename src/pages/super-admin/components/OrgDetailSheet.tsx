import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { OrgAdmin } from '../hooks/useOrganizationAdmin';
import OrgMembersTab from './OrgMembersTab';

interface Props {
  org: OrgAdmin | null;
  onClose: () => void;
  onUpdate: (orgId: string, fields: { subscription_end?: string; is_active?: boolean }) => Promise<void>;
  onDelete: (orgId: string) => Promise<void>;
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}
function isExpired(d: string | null | undefined) { return d ? new Date(d) < new Date() : false; }
function daysLeft(d: string | null | undefined) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - new Date().getTime()) / 86400000);
}

function orgInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function OrgDetailSheet({ org, onClose, onUpdate, onDelete }: Props) {
  const [tab, setTab] = useState<'info' | 'members'>('info');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  useEffect(() => {
    if (org) { setEndDate(org.subscription_end || ''); setConfirmDelete(false); setTab('info'); }
  }, [org]);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 2500); return () => clearTimeout(t); }
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

  const expired = isExpired(org.subscription_end);
  const days = daysLeft(org.subscription_end);
  const initials = orgInitials(org.name);

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full md:max-w-md bg-white border-l border-slate-200 z-50 flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
            <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-900 text-white text-xs font-semibold flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <h2 className="text-slate-800 font-semibold text-sm leading-tight truncate">{org.name}</h2>
              <p className="text-slate-400 text-xs font-mono mt-0.5">{org.invite_code}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer flex-shrink-0">
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-5 flex-shrink-0">
          {(['info', 'members'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-3 text-xs font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                tab === t ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {t === 'info' ? 'Bilgiler' : 'Üyeler'}
            </button>
          ))}
        </div>

        {/* İçerik */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 bg-[#f8fafc]">

          {tab === 'members' && <OrgMembersTab orgId={org.id} />}

          {tab === 'info' && (
            <>
              {/* Durum */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${
                  org.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${org.is_active ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  {org.is_active ? 'Aktif' : 'Pasif'}
                </span>
                {expired && org.is_active && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-orange-50 text-orange-600">
                    Süresi doldu
                  </span>
                )}
                {!expired && days !== null && days <= 14 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-700">
                    {days} gün kaldı
                  </span>
                )}
              </div>

              {/* Bilgiler */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {[
                  { label: 'Oluşturulma', value: formatDate(org.created_at), cls: '' },
                  { label: 'Üye Sayısı', value: `${org.member_count || 0} üye`, cls: '' },
                  { label: 'Abonelik Başlangıç', value: formatDate(org.subscription_start), cls: '' },
                  { label: 'Abonelik Bitiş', value: formatDate(org.subscription_end), cls: expired ? 'text-red-500' : '' },
                ].map((row, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-slate-100 last:border-0">
                    <span className="text-slate-500 text-xs">{row.label}</span>
                    <span className={`text-sm font-medium ${row.cls || 'text-slate-700'}`}>{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Abonelik tarihi güncelle */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <p className="text-slate-600 text-xs font-medium">Abonelik Bitiş Tarihini Güncelle</p>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-400 transition-colors"
                  />
                  <button
                    onClick={handleSaveDate}
                    disabled={saving || !endDate}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                  >
                    {saving ? <i className="ri-loader-4-line animate-spin text-sm"></i> : null}
                    Kaydet
                  </button>
                </div>
              </div>

              {/* Aktif/Pasif */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-slate-600 text-xs font-medium mb-3">Organizasyon Durumu</p>
                <button
                  onClick={handleToggleActive}
                  disabled={saving}
                  className={`w-full py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 border ${
                    org.is_active
                      ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                      : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                  }`}
                >
                  {saving
                    ? <><i className="ri-loader-4-line animate-spin text-sm"></i> İşleniyor...</>
                    : org.is_active ? 'Pasife Al' : 'Aktif Et'
                  }
                </button>
              </div>

              {/* Tehlikeli alan */}
              <div className="bg-white rounded-xl border border-red-200 p-4">
                <p className="text-red-500 text-xs font-medium mb-1">Tehlikeli Alan</p>
                <p className="text-slate-400 text-xs mb-3">Organizasyonu silmek tüm verilerini kalıcı olarak siler.</p>
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="w-full py-2 rounded-lg text-sm font-medium bg-white border border-red-200 text-red-500 hover:bg-red-50 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Organizasyonu Sil
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-red-500 text-xs text-center font-medium">Emin misiniz? Geri alınamaz.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="flex-1 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        İptal
                      </button>
                      <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex-1 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {deleting ? <i className="ri-loader-4-line animate-spin text-sm"></i> : null}
                        Evet, Sil
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div className={`mx-5 mb-4 flex items-center gap-2 text-sm rounded-lg px-4 py-2.5 border flex-shrink-0 ${
            toast.type === 'ok'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-600'
          }`}>
            <i className={`text-sm ${toast.type === 'ok' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'}`}></i>
            {toast.msg}
          </div>
        )}
      </div>
    </>,
    document.body
  );
}
