import { useState, useEffect } from 'react';
import Drawer from '@/components/base/Drawer';
import { createFirmWorker } from '@/services/firmWorkerService';
import { getAssignedFirms } from '@/services/firmService';
import type { AppFirm } from '@/types/database';
import { useAuth } from '@/store/AuthContext';

interface AddWorkerDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultFirmId?: string;
}

const workStatusOptions = [
  { value: 'active', label: 'Aktif' },
  { value: 'passive', label: 'Pasif' },
  { value: 'on_leave', label: 'İzinli' },
  { value: 'terminated', label: 'Ayrıldı' },
];

export default function AddWorkerDrawer({ open, onClose, onSuccess, defaultFirmId }: AddWorkerDrawerProps) {
  const { session } = useAuth();
  const [firms, setFirms] = useState<AppFirm[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    fullName: '',
    tcNo: '',
    phone: '',
    birthDate: '',
    firmId: defaultFirmId ?? '',
    workStatus: 'active',
    jobTitle: '',
    startDate: '',
    emergencyContact: '',
    emergencyPhone: '',
  });

  useEffect(() => {
    if (!session?.userId) return;
    getAssignedFirms(session.userId)
      .then(setFirms)
      .catch(() => setFirms([]));
  }, [session?.userId]);

  useEffect(() => {
    if (defaultFirmId) setForm((f) => ({ ...f, firmId: defaultFirmId }));
  }, [defaultFirmId]);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleSubmit = async () => {
    if (!form.fullName.trim()) { setError('Ad Soyad zorunludur.'); return; }
    if (!form.firmId) { setError('Firma seçimi zorunludur.'); return; }
    if (!session?.organizationId) return;

    setLoading(true);
    setError('');
    try {
      await createFirmWorker({
        organizationId: session.organizationId,
        firmId: form.firmId,
        fullName: form.fullName.trim(),
        tcNo: form.tcNo.trim() || undefined,
        phone: form.phone.trim() || undefined,
        birthDate: form.birthDate || undefined,
        workStatus: form.workStatus,
        jobTitle: form.jobTitle.trim() || undefined,
        startDate: form.startDate || undefined,
        emergencyContact: form.emergencyContact.trim() || undefined,
        emergencyPhone: form.emergencyPhone.trim() || undefined,
        createdBy: session.userId,
      });
      setForm({ fullName: '', tcNo: '', phone: '', birthDate: '', firmId: defaultFirmId ?? '', workStatus: 'active', jobTitle: '', startDate: '', emergencyContact: '', emergencyPhone: '' });
      onSuccess();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer open={open} onClose={onClose} title="Personel Ekle" width="w-[520px]">
      <div className="p-6 space-y-5">
        {error && (
          <div className="px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}

        {/* Kişisel Bilgiler */}
        <div>
          <p className="drawer-section-title">Kişisel Bilgiler</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Ad Soyad <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                className="input w-full"
                placeholder="Örn: Ahmet Yılmaz"
                value={form.fullName}
                onChange={(e) => handleChange('fullName', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>TC Kimlik No</label>
                <input
                  className="input w-full"
                  placeholder="11 haneli TC No"
                  maxLength={11}
                  value={form.tcNo}
                  onChange={(e) => handleChange('tcNo', e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Telefon</label>
                <input
                  className="input w-full"
                  placeholder="05XX XXX XX XX"
                  value={form.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Doğum Tarihi</label>
              <input
                type="date"
                className="input w-full"
                value={form.birthDate}
                onChange={(e) => handleChange('birthDate', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* İş Bilgileri */}
        <div>
          <p className="drawer-section-title">İş Bilgileri</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Firma <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <select
                className="input w-full cursor-pointer"
                value={form.firmId}
                onChange={(e) => handleChange('firmId', e.target.value)}
              >
                <option value="">Firma seçin...</option>
                {firms.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Çalışma Durumu</label>
                <select
                  className="input w-full cursor-pointer"
                  value={form.workStatus}
                  onChange={(e) => handleChange('workStatus', e.target.value)}
                >
                  {workStatusOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Görev / Unvan</label>
                <input
                  className="input w-full"
                  placeholder="Örn: Operatör"
                  value={form.jobTitle}
                  onChange={(e) => handleChange('jobTitle', e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>İşe Giriş Tarihi</label>
              <input
                type="date"
                className="input w-full"
                value={form.startDate}
                onChange={(e) => handleChange('startDate', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Acil Durum */}
        <div>
          <p className="drawer-section-title">Acil Durum Bilgileri</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Acil Durum Kişisi</label>
              <input
                className="input w-full"
                placeholder="Ad Soyad"
                value={form.emergencyContact}
                onChange={(e) => handleChange('emergencyContact', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Acil Durum Telefonu</label>
              <input
                className="input w-full"
                placeholder="05XX XXX XX XX"
                value={form.emergencyPhone}
                onChange={(e) => handleChange('emergencyPhone', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-colors"
            style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            İptal
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-opacity flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--text-primary)', color: 'var(--card)', opacity: loading ? 0.7 : 1 }}
          >
            {loading && <i className="ri-loader-4-line animate-spin text-sm" />}
            {loading ? 'Kaydediliyor...' : 'Personel Ekle'}
          </button>
        </div>
      </div>
    </Drawer>
  );
}
