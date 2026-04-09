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
  const initials = org.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return createPortal(
    <>
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white border-l border-slate-200 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 flex items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white text-sm font-black flex-shrink-0 shadow-md shadow-amber-400/25">
              {initials}
            </div>
            <div>
              <h2 className="text-slate-900 font-bold text-sm leading-tight">{org.name}</h2>
              <p className="text-slate-400 text-xs font-mono mt-0.5">{org.invite_code}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        {/* Sekmeler */}
        <div className="flex border-b border-slate-100 px-6 flex-shrink-0 bg-white">
          {(['info', 'members'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                tab === t ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {t === 'info' ? 'Bilgiler & Yönetim' : 'Üyeler'}
            </button>
          ))}
        </div>

        {/* İçerik */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-slate-50">

          {tab === 'members' && <OrgMembersTab orgId={org.id} />}

          {tab === 'info' && (
            <>
              {/* Durum Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                  org.is_active
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-red-50 text-red-600 border-red-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${org.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                  {org.is_active ? 'Aktif' : 'Pasif'}
                </span>
                {expired && org.is_active && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-600 border border-orange-200">
                    <i className="ri-timer-flash-line"></i> Süresi doldu
                  </span>
                )}
                {!expired && days !== null && days <= 14 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    <i className="ri-alarm-warning-line"></i> {days} gün kaldı
                  </span>
                )}
              </div>

              {/* Bilgiler */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                {[
                  { icon: 'ri-calendar-line', label: 'Oluşturulma', value: formatDate(org.created_at), cls: '' },
                  { icon: 'ri-team-line', label: 'Üye Sayısı', value: `${org.member_count || 0} üye`, cls: '' },
                  { icon: 'ri-calendar-check-line', label: 'Abonelik Başlangıç', value: formatDate(org.subscription_start), cls: '' },
                  { icon: 'ri-calendar-close-line', label: 'Abonelik Bitiş', value: formatDate(org.subscription_end), cls: expired ? 'text-red-500' : '' },
                ].map((row, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-slate-100 last:border-0">
                    <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
                      <i className={`${row.icon} text-sm text-slate-400`}></i>{row.label}
                    </div>
                    <span className={`text-sm font-semibold ${row.cls || 'text-slate-700'}`}>{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Abonelik Tarihi */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-sm">
                <h3 className="text-slate-700 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <i className="ri-calendar-2-line text-amber-500"></i>Abonelik Bitiş Tarihini Güncelle
                </h3>
                <div className="flex gap-2">
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/15 transition-all" />
                  <button onClick={handleSaveDate} disabled={saving || !endDate}
                    className="px-4 py-2 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shadow-md shadow-amber-400/20">
                    {saving ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-save-line"></i>}Kaydet
                  </button>
                </div>
              </div>

              {/* Aktif/Pasif */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <h3 className="text-slate-700 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                  <i className="ri-toggle-line text-amber-500"></i>Organizasyon Durumu
                </h3>
                <button onClick={handleToggleActive} disabled={saving}
                  className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 border ${
                    org.is_active
                      ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                  }`}>
                  {saving ? <><i className="ri-loader-4-line animate-spin"></i> İşleniyor...</>
                    : org.is_active ? <><i className="ri-pause-circle-line"></i> Pasife Al</>
                    : <><i className="ri-play-circle-line"></i> Aktif Et</>}
                </button>
              </div>

              {/* Tehlikeli Alan */}
              <div className="bg-red-50 rounded-2xl border border-red-200 p-4">
                <h3 className="text-red-600 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                  <i className="ri-error-warning-line"></i>Tehlikeli Alan
                </h3>
                <p className="text-slate-500 text-xs mb-3">Organizasyonu silmek tüm verilerini kalıcı olarak siler.</p>
                {!confirmDelete ? (
                  <button onClick={() => setConfirmDelete(true)}
                    className="w-full py-2.5 rounded-xl text-sm font-bold bg-white border border-red-200 text-red-600 hover:bg-red-100 transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2">
                    <i className="ri-delete-bin-6-line"></i> Organizasyonu Sil
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-red-600 text-xs text-center font-bold">Emin misiniz? Geri alınamaz!</p>
                    <div className="flex gap-2">
                      <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 rounded-xl text-sm font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all cursor-pointer">İptal</button>
                      <button onClick={handleDelete} disabled={deleting}
                        className="flex-1 py-2 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-700 text-white transition-all cursor-pointer flex items-center justify-center gap-1.5">
                        {deleting ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-delete-bin-line"></i>}Evet, Sil
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
          <div className={`mx-6 mb-4 flex items-center gap-2 text-sm rounded-xl px-4 py-3 border flex-shrink-0 ${
            toast.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-red-50 border-red-200 text-red-600'
          }`}>
            <i className={toast.type === 'ok' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'}></i>
            {toast.msg}
          </div>
        )}
      </div>
    </>,
    document.body
  );
}
