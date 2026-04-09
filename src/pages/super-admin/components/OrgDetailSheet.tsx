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
  return new Date(dateStr).toLocaleDateString('tr-TR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

function isExpired(dateStr: string | null | undefined) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function daysLeft(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function OrgDetailSheet({ org, onClose, onUpdate, onDelete }: Props) {
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (org) {
      setEndDate(org.subscription_end || '');
      setConfirmDelete(false);
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
      setToast(org.is_active ? 'Organizasyon pasife alındı.' : 'Organizasyon aktif edildi.');
    } catch {
      setToast('İşlem başarısız.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDate = async () => {
    if (!org || !endDate) return;
    setSaving(true);
    try {
      await onUpdate(org.id, { subscription_end: endDate });
      setToast('Abonelik tarihi güncellendi.');
    } catch {
      setToast('Güncelleme başarısız.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!org) return;
    setDeleting(true);
    try {
      await onDelete(org.id);
      onClose();
    } catch {
      setToast('Silme işlemi başarısız.');
      setDeleting(false);
    }
  };

  if (!org) return null;

  const expired = isExpired(org.subscription_end);
  const days = daysLeft(org.subscription_end);

  return createPortal(
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-slate-900 border-l border-slate-700/50 z-50 overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 sticky top-0 bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
              <i className="ri-building-2-line text-amber-400 text-base"></i>
            </div>
            <div>
              <h2 className="text-white font-semibold text-base leading-tight">{org.name}</h2>
              <p className="text-slate-400 text-xs font-mono">{org.invite_code}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        <div className="flex-1 px-6 py-6 space-y-6">
          {/* Durum Badge */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
              org.is_active
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                : 'bg-red-500/15 text-red-400 border border-red-500/20'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${org.is_active ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
              {org.is_active ? 'Aktif' : 'Pasif'}
            </span>
            {expired && org.is_active && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-orange-500/15 text-orange-400 border border-orange-500/20">
                <i className="ri-timer-flash-line"></i>
                Süresi doldu
              </span>
            )}
            {!expired && days !== null && days <= 14 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
                <i className="ri-alarm-warning-line"></i>
                {days} gün kaldı
              </span>
            )}
          </div>

          {/* Temel Bilgiler */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/40 divide-y divide-slate-700/30">
            <InfoRow icon="ri-calendar-line" label="Oluşturulma" value={formatDate(org.created_at)} />
            <InfoRow icon="ri-team-line" label="Üye Sayısı" value={`${org.member_count || 0} üye`} />
            <InfoRow icon="ri-calendar-check-line" label="Abonelik Başlangıç" value={formatDate(org.subscription_start)} />
            <InfoRow
              icon="ri-calendar-close-line"
              label="Abonelik Bitiş"
              value={formatDate(org.subscription_end)}
              valueClass={expired ? 'text-red-400' : ''}
            />
          </div>

          {/* Abonelik Tarihi Düzenleme */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/40 p-5 space-y-4">
            <h3 className="text-white text-sm font-semibold flex items-center gap-2">
              <i className="ri-calendar-2-line text-amber-400"></i>
              Abonelik Bitiş Tarihini Güncelle
            </h3>
            <div className="flex gap-3">
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="flex-1 bg-slate-700/50 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-all"
              />
              <button
                onClick={handleSaveDate}
                disabled={saving || !endDate}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/40 text-slate-900 font-semibold text-sm rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-2"
              >
                {saving ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-save-line"></i>}
                Kaydet
              </button>
            </div>
          </div>

          {/* Aktif/Pasif Toggle */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/40 p-5">
            <h3 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
              <i className="ri-toggle-line text-amber-400"></i>
              Organizasyon Durumu
            </h3>
            <button
              onClick={handleToggleActive}
              disabled={saving}
              className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 ${
                org.is_active
                  ? 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20'
                  : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
              }`}
            >
              {saving ? (
                <><i className="ri-loader-4-line animate-spin"></i> İşleniyor...</>
              ) : org.is_active ? (
                <><i className="ri-pause-circle-line"></i> Pasife Al</>
              ) : (
                <><i className="ri-play-circle-line"></i> Aktif Et</>
              )}
            </button>
          </div>

          {/* Silme */}
          <div className="bg-slate-800/50 rounded-xl border border-red-500/20 p-5">
            <h3 className="text-red-400 text-sm font-semibold mb-2 flex items-center gap-2">
              <i className="ri-delete-bin-line"></i>
              Tehlikeli Alan
            </h3>
            <p className="text-slate-400 text-xs mb-4">
              Organizasyonu silmek tüm verilerini kalıcı olarak siler. Bu işlem geri alınamaz.
            </p>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full py-2.5 rounded-lg text-sm font-semibold bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
              >
                <i className="ri-delete-bin-6-line"></i>
                Organizasyonu Sil
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-red-300 text-xs text-center font-medium">Emin misiniz? Bu işlem geri alınamaz!</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 py-2 rounded-lg text-sm font-medium bg-slate-700 text-slate-300 hover:bg-slate-600 transition-all cursor-pointer"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-500 text-white transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
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
          <div className="sticky bottom-4 mx-6 mb-4 flex items-center gap-2 bg-slate-700 border border-slate-600 text-white text-sm rounded-xl px-4 py-3 shadow-lg">
            <i className="ri-checkbox-circle-line text-emerald-400"></i>
            {toast}
          </div>
        )}
      </div>
    </>,
    document.body
  );
}

function InfoRow({
  icon,
  label,
  value,
  valueClass = '',
}: {
  icon: string;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2 text-slate-400 text-sm">
        <div className="w-4 h-4 flex items-center justify-center">
          <i className={`${icon} text-sm`}></i>
        </div>
        {label}
      </div>
      <span className={`text-sm font-medium ${valueClass || 'text-white'}`}>{value}</span>
    </div>
  );
}
