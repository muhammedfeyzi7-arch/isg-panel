import { useState } from 'react';
import Drawer from '@/components/base/Drawer';
import StatusBadge from '@/components/base/StatusBadge';
import { softDeleteFirmWorker } from '@/services/firmWorkerService';
import type { FirmWorker } from '@/services/firmWorkerService';

interface WorkerDetailDrawerProps {
  worker: FirmWorker | null;
  onClose: () => void;
  onDeleted: () => void;
}

const workStatusLabel: Record<string, string> = {
  active: 'Aktif',
  passive: 'Pasif',
  on_leave: 'İzinli',
  terminated: 'Ayrıldı',
};

export default function WorkerDetailDrawer({ worker, onClose, onDeleted }: WorkerDetailDrawerProps) {
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = async () => {
    if (!worker) return;
    setDeleting(true);
    try {
      await softDeleteFirmWorker(worker.id);
      onDeleted();
      onClose();
    } catch {
      setDeleting(false);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('tr-TR');
  };

  return (
    <Drawer open={!!worker} onClose={onClose} title="Personel Detayı" width="w-[480px]">
      {worker && (
        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 flex items-center justify-center rounded-xl flex-shrink-0" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
              <i className="ri-user-line text-xl" style={{ color: 'var(--text-muted)' }} />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{worker.fullName}</h3>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{worker.jobTitle ?? 'Görev belirtilmemiş'}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <StatusBadge status={workStatusLabel[worker.workStatus] ?? worker.workStatus} />
                {worker.firmName && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    <i className="ri-building-2-line mr-1 text-xs" />{worker.firmName}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Kişisel Bilgiler */}
          <div>
            <p className="drawer-section-title">Kişisel Bilgiler</p>
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
              {[
                { label: 'TC Kimlik No', value: worker.tcNo ?? '—', icon: 'ri-id-card-line' },
                { label: 'Telefon', value: worker.phone ?? '—', icon: 'ri-phone-line' },
                { label: 'Doğum Tarihi', value: formatDate(worker.birthDate), icon: 'ri-cake-line' },
              ].map((item, i) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ borderBottom: i < 2 ? '1px solid var(--border-subtle)' : 'none', backgroundColor: 'var(--surface)' }}
                >
                  <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
                    <i className={`${item.icon} text-xs`} style={{ color: 'var(--text-muted)' }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                    <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* İş Bilgileri */}
          <div>
            <p className="drawer-section-title">İş Bilgileri</p>
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
              {[
                { label: 'Firma', value: worker.firmName ?? '—', icon: 'ri-building-2-line' },
                { label: 'Görev / Unvan', value: worker.jobTitle ?? '—', icon: 'ri-briefcase-line' },
                { label: 'İşe Giriş Tarihi', value: formatDate(worker.startDate), icon: 'ri-calendar-check-line' },
                { label: 'Çalışma Durumu', value: workStatusLabel[worker.workStatus] ?? worker.workStatus, icon: 'ri-user-follow-line' },
              ].map((item, i) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ borderBottom: i < 3 ? '1px solid var(--border-subtle)' : 'none', backgroundColor: 'var(--surface)' }}
                >
                  <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
                    <i className={`${item.icon} text-xs`} style={{ color: 'var(--text-muted)' }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                    <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Acil Durum */}
          {(worker.emergencyContact || worker.emergencyPhone) && (
            <div>
              <p className="drawer-section-title">Acil Durum</p>
              <div className="rounded-lg p-4 space-y-2" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
                {worker.emergencyContact && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Kişi</span>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{worker.emergencyContact}</span>
                  </div>
                )}
                {worker.emergencyPhone && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Telefon</span>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{worker.emergencyPhone}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Delete */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-colors flex items-center justify-center gap-2"
                style={{ border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger)' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--danger-bg)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <i className="ri-delete-bin-line text-sm" />
                Personeli Sil
              </button>
            ) : (
              <div className="rounded-lg p-4 space-y-3" style={{ backgroundColor: 'var(--danger-bg)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <p className="text-sm font-medium" style={{ color: 'var(--danger)' }}>Bu personeli silmek istediğinizden emin misiniz?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 px-3 py-2 rounded-lg text-sm cursor-pointer whitespace-nowrap"
                    style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap flex items-center justify-center gap-1"
                    style={{ backgroundColor: 'var(--danger)', color: '#fff', opacity: deleting ? 0.7 : 1 }}
                  >
                    {deleting && <i className="ri-loader-4-line animate-spin text-xs" />}
                    Evet, Sil
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
