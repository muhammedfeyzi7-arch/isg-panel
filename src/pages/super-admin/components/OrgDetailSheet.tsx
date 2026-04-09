import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { OrgAdmin } from '../hooks/useOrganizationAdmin';

interface Props {
  org: OrgAdmin | null;
  onClose: () => void;
  onUpdate: (orgId: string, fields: { subscription_end?: string; is_active?: boolean }) => Promise<void>;
  onDelete: (orgId: string) => Promise<void>;
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function isExpired(dateStr: string | null | undefined) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function daysLeft(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
}

export default function OrgDetailSheet({ org, onClose, onUpdate, onDelete }: Props) {
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  useEffect(() => {
    if (org) { setEndDate(org.subscription_end || ''); setConfirmDelete(false); }
  }, [org]);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 2500); return () => clearTimeout(t); }
  }, [toast]);

  const handleToggleActive = async () => {
    if (!org) return;
    setSaving(true);
    try {
      await onUpdate(org.id, { is_active: !org.is_active });
      setToast({ msg: org.is_active ? 'Organizasyon pasife alındı.' : 'Organizasyon aktif edildi.', type: 'ok' });
    } catch { setToast({ msg: 'İşlem başarısız.', type: 'err' }); }
    finally { setSaving(false); }
  };

  const handleSaveDate = async () => {
    if (!org || !endDate) return;
    setSaving(true);
    try {
      await onUpdate(org.id, { subscription_end: endDate });
      setToast({ msg: 'Abonelik tarihi güncellendi.', type: 'ok' });
    } catch { setToast({ msg: 'Güncelleme başarısız.', type: 'err' }); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!org) return;
    setDeleting(true);
    try { await onDelete(org.id); onClose(); }
    catch { setToast({ msg: 'Silme işlemi başarısız.', type: 'err' }); setDeleting(false); }
  };

  if (!org) return null;

  const expired = isExpired(org.subscription_end);
  const days = daysLeft(org.subscription_end);
  const initials = org.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-[#0d0d14] border-l border-white/6 z-50 overflow-y-auto flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 sticky top-0 bg-[#0d0d14] z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/20 text-amber-300 text-sm font-bold flex-shrink-0">
              {initials}
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm leading-tight">{org.name}</h2>
              <p className="text-slate-600 text-xs font-mono mt-0.5">{org.invite_code}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/8 text-slate-500 hover:text-white transition-colors cursor-pointer">
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        <div className="flex-1 px-6 py-5 space-y-5">

          {/* Durum Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
              org.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15' : 'bg-red-500/10 text-red-400 border-red-500/15'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${org.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></span>
              {org.is_active ? 'Aktif' : 'Pasif'}
            </span>
            {expired && org.is_active && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/15">
                <i className="ri-timer-flash-line"></i> Süresi doldu
              </span>
            )}
            {!expired && days !== null && days <= 14 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/15">
                <i className="ri-alarm-warning-line"></i> {days} gün kaldı
              </span>
            )}
          </div>

          {/* Bilgiler */}
          <div className="bg-white/3 rounded-xl border border-white/6 overflow-hidden">
            {[
              { icon: 'ri-calendar-line', label: 'Oluşturulma', value: formatDate(org.created_at), cls: '' },
              { icon: 'ri-team-line', label: 'Üye Sayısı', value: `${org.member_count || 0} üye`, cls: '' },
              { icon: 'ri-calendar-check-line', label: 'Abonelik Başlangıç', value: formatDate(org.subscription_start), cls: '' },
              { icon: 'ri-calendar-close-line', label: 'Abonelik Bitiş', value: formatDate(org.subscription_end), cls: expired ? 'text-red-400' : '' },
            ].map((row, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-white/4 last:border-0">
                <div className="flex items-center gap-2 text-slate-500 text-xs">
                  <i className={`${row.icon} text-sm`}></i>
                  {row.label}
                </div>
                <span className={`text-sm font-medium ${row.cls || 'text-slate-300'}`}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* Abonelik Tarihi */}
          <div className="bg-white/3 rounded-xl border border-white/6 p-4 space-y-3">
            <h3 className="text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
              <i className="ri-calendar-2-line text-amber-400"></i>
              Abonelik Bitiş Tarihini Güncelle
            </h3>
            <div className="flex gap-2">
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/30 focus:ring-1 focus:ring-amber-500/10 transition-all"
              />
              <button
                onClick={handleSaveDate}
                disabled={saving || !endDate}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold text-xs rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5"
              >
                {saving ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-save-line"></i>}
                Kaydet
              </button>
            </div>
          </div>

          {/* Aktif/Pasif */}
          <div className="bg-white/3 rounded-xl border border-white/6 p-4">
            <h3 className="text-white text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
              <i className="ri-toggle-line text-amber-400"></i>
              Organizasyon Durumu
            </h3>
            <button
              onClick={handleToggleActive}
              disabled={saving}
              className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 border ${
                org.is_active
                  ? 'bg-red-500/8 border-red-500/15 text-red-400 hover:bg-red-500/15'
                  : 'bg-emerald-500/8 border-emerald-500/15 text-emerald-400 hover:bg-emerald-500/15'
              }`}
            >
              {saving ? <><i className="ri-loader-4-line animate-spin"></i> İşleniyor...</>
                : org.is_active ? <><i className="ri-pause-circle-line"></i> Pasife Al</>
                : <><i className="ri-play-circle-line"></i> Aktif Et</>}
            </button>
          </div>

          {/* Tehlikeli Alan */}
          <div className="bg-red-500/5 rounded-xl border border-red-500/10 p-4">
            <h3 className="text-red-400 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2">
              <i className="ri-error-warning-line"></i>
              Tehlikeli Alan
            </h3>
            <p className="text-slate-600 text-xs mb-3">
              Organizasyonu silmek tüm verilerini kalıcı olarak siler. Bu işlem geri alınamaz.
            </p>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full py-2.5 rounded-lg text-sm font-semibold bg-red-500/8 border border-red-500/15 text-red-400 hover:bg-red-500/15 transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
              >
                <i className="ri-delete-bin-6-line"></i> Organizasyonu Sil
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-red-300 text-xs text-center font-medium">Emin misiniz? Bu işlem geri alınamaz!</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 rounded-lg text-sm font-medium bg-white/5 text-slate-400 hover:bg-white/10 transition-all cursor-pointer">
                    İptal
                  </button>
                  <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-500 text-white transition-all cursor-pointer flex items-center justify-center gap-1.5">
                    {deleting ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-delete-bin-line"></i>}
                    Evet, Sil
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div className={`sticky bottom-4 mx-6 mb-4 flex items-center gap-2 text-sm rounded-xl px-4 py-3 border ${
            toast.type === 'ok'
              ? 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400'
              : 'bg-red-500/10 border-red-500/15 text-red-400'
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
