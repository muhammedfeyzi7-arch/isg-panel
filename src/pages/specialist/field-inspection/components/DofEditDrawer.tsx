import { useState, useRef, useEffect } from 'react';
import Drawer from '@/components/base/Drawer';
import Button from '@/components/base/Button';
import { updateDofRecord } from '@/services/specialistService';
import { uploadDofPhoto } from '@/services/dofStorageService';
import type { DofRow } from '@/services/specialistService';
import type { AppFirm, AppPersonnel } from '@/types/database';

interface Props {
  record: DofRow;
  onClose: () => void;
  firms: AppFirm[];
  personnel: AppPersonnel[];
  onUpdated: (rec: DofRow) => void;
}

export default function DofEditDrawer({ record, onClose, firms, personnel, onUpdated }: Props) {
  const [form, setForm] = useState({
    title: record.title,
    firmId: record.firm_id ?? '',
    personnelId: record.personnel_id ?? '',
    detectionDate: record.detection_date,
    responsiblePerson: record.responsible_person,
    targetCloseDate: record.target_close_date,
    description: record.description,
    actionRequired: record.action_required,
  });

  // Açılış fotoğrafı state
  const [openingPhotoUrl, setOpeningPhotoUrl] = useState<string | null>(record.opening_photo_url);
  const [openingPhotoFile, setOpeningPhotoFile] = useState<File | null>(null);
  const [openingPreview, setOpeningPreview] = useState<string>(record.opening_photo_url ?? '');
  const [openingRemoved, setOpeningRemoved] = useState(false);

  // Kapanış fotoğrafı state
  const [closingPhotoUrl, setClosingPhotoUrl] = useState<string | null>(record.closing_photo_url);
  const [closingPhotoFile, setClosingPhotoFile] = useState<File | null>(null);
  const [closingPreview, setClosingPreview] = useState<string>(record.closing_photo_url ?? '');
  const [closingRemoved, setClosingRemoved] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const openingRef = useRef<HTMLInputElement>(null);
  const closingRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm({
      title: record.title,
      firmId: record.firm_id ?? '',
      personnelId: record.personnel_id ?? '',
      detectionDate: record.detection_date,
      responsiblePerson: record.responsible_person,
      targetCloseDate: record.target_close_date,
      description: record.description,
      actionRequired: record.action_required,
    });
    setOpeningPhotoUrl(record.opening_photo_url);
    setOpeningPreview(record.opening_photo_url ?? '');
    setOpeningPhotoFile(null);
    setOpeningRemoved(false);
    setClosingPhotoUrl(record.closing_photo_url);
    setClosingPreview(record.closing_photo_url ?? '');
    setClosingPhotoFile(null);
    setClosingRemoved(false);
  }, [record]);

  const set = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError('');
  };

  // ── Açılış fotoğrafı ──────────────────────────────────────────────────────
  const handleOpeningSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOpeningPhotoFile(file);
    setOpeningRemoved(false);
    const reader = new FileReader();
    reader.onload = (ev) => setOpeningPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const removeOpeningPhoto = () => {
    setOpeningPhotoFile(null);
    setOpeningPreview('');
    setOpeningPhotoUrl(null);
    setOpeningRemoved(true);
    if (openingRef.current) openingRef.current.value = '';
  };

  // ── Kapanış fotoğrafı ─────────────────────────────────────────────────────
  const handleClosingSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setClosingPhotoFile(file);
    setClosingRemoved(false);
    const reader = new FileReader();
    reader.onload = (ev) => setClosingPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const removeClosingPhoto = () => {
    setClosingPhotoFile(null);
    setClosingPreview('');
    setClosingPhotoUrl(null);
    setClosingRemoved(true);
    if (closingRef.current) closingRef.current.value = '';
  };

  const validate = () => {
    if (!form.title.trim()) return 'Başlık zorunludur.';
    if (!form.firmId) return 'Firma seçimi zorunludur.';
    if (!form.detectionDate) return 'Tespit tarihi zorunludur.';
    if (!form.responsiblePerson.trim()) return 'Sorumlu kişi zorunludur.';
    if (!form.targetCloseDate) return 'Hedef kapatma tarihi zorunludur.';
    if (!form.description.trim()) return 'Açıklama zorunludur.';
    if (!form.actionRequired.trim()) return 'Alınması gereken önlem zorunludur.';
    return '';
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true);
    try {
      let finalOpeningUrl: string | null = openingPhotoUrl;
      let finalClosingUrl: string | null = closingPhotoUrl;

      // Yeni açılış fotoğrafı yüklendi
      if (openingPhotoFile) {
        finalOpeningUrl = await uploadDofPhoto(openingPhotoFile, record.organization_id, 'opening');
      } else if (openingRemoved) {
        finalOpeningUrl = null;
      }

      // Yeni kapanış fotoğrafı yüklendi
      if (closingPhotoFile) {
        finalClosingUrl = await uploadDofPhoto(closingPhotoFile, record.organization_id, 'closing');
      } else if (closingRemoved) {
        finalClosingUrl = null;
      }

      const updated = await updateDofRecord(record.id, {
        title: form.title.trim(),
        firmId: form.firmId || null,
        personnelId: form.personnelId || null,
        detectionDate: form.detectionDate,
        responsiblePerson: form.responsiblePerson.trim(),
        targetCloseDate: form.targetCloseDate,
        description: form.description.trim(),
        actionRequired: form.actionRequired.trim(),
        openingPhotoUrl: finalOpeningUrl ?? undefined,
        closingPhotoUrl: finalClosingUrl ?? undefined,
      });
      onUpdated(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Güncellenemedi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title="DÖF Düzenle"
      width="w-[540px]"
      footer={
        <>
          <Button variant="secondary" className="flex-1" onClick={onClose}>İptal</Button>
          <Button variant="primary" className="flex-1" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Kaydediliyor...' : 'Güncelle'}
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        {/* DÖF No badge */}
        <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <i className="ri-file-list-3-line text-sm" style={{ color: 'var(--primary)' }} />
          <span className="text-xs font-mono font-semibold" style={{ color: 'var(--primary)' }}>{record.dof_no}</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>düzenleniyor</span>
        </div>

        {error && (
          <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <div className="flex items-center gap-2">
              <i className="ri-error-warning-line" />
              {error}
            </div>
          </div>
        )}

        {/* Başlık */}
        <div>
          <label className="form-label">Uygunsuzluk Başlığı <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input className="input text-sm" value={form.title} onChange={(e) => set('title', e.target.value)} />
        </div>

        {/* Firma */}
        <div>
          <label className="form-label">Firma <span style={{ color: 'var(--danger)' }}>*</span></label>
          <select className="input text-sm" value={form.firmId} onChange={(e) => set('firmId', e.target.value)}>
            <option value="">Firma seçin...</option>
            {firms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>

        {/* İlgili Personel */}
        <div>
          <label className="form-label">İlgili Personel <span className="text-xs" style={{ color: 'var(--text-muted)' }}>(İsteğe bağlı)</span></label>
          <select className="input text-sm" value={form.personnelId} onChange={(e) => set('personnelId', e.target.value)}>
            <option value="">Personel seçin...</option>
            {personnel.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* Tarihler */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Tespit Tarihi <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="date" className="input text-sm" value={form.detectionDate} onChange={(e) => set('detectionDate', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Hedef Kapatma <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="date" className="input text-sm" value={form.targetCloseDate} onChange={(e) => set('targetCloseDate', e.target.value)} />
          </div>
        </div>

        {/* Sorumlu */}
        <div>
          <label className="form-label">Sorumlu Kişi <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input className="input text-sm" value={form.responsiblePerson} onChange={(e) => set('responsiblePerson', e.target.value)} />
        </div>

        {/* Açıklama */}
        <div>
          <label className="form-label">Uygunsuzluk Açıklaması <span style={{ color: 'var(--danger)' }}>*</span></label>
          <textarea className="input text-sm resize-none" rows={3} value={form.description}
            onChange={(e) => set('description', e.target.value)} maxLength={500} />
          <p className="text-xs mt-1 text-right" style={{ color: 'var(--text-muted)' }}>{form.description.length}/500</p>
        </div>

        {/* Önlem */}
        <div>
          <label className="form-label">Alınması Gereken Önlem <span style={{ color: 'var(--danger)' }}>*</span></label>
          <textarea className="input text-sm resize-none" rows={3} value={form.actionRequired}
            onChange={(e) => set('actionRequired', e.target.value)} maxLength={500} />
          <p className="text-xs mt-1 text-right" style={{ color: 'var(--text-muted)' }}>{form.actionRequired.length}/500</p>
        </div>

        {/* Fotoğraflar */}
        <div className="grid grid-cols-2 gap-3">
          {/* Açılış Fotoğrafı */}
          <div>
            <label className="form-label">Açılış Fotoğrafı</label>
            {openingPreview ? (
              <div className="relative">
                <div className="w-full h-32 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  <img src={openingPreview} alt="Açılış" className="w-full h-full object-cover" />
                </div>
                <button
                  onClick={removeOpeningPhoto}
                  className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-full cursor-pointer"
                  style={{ backgroundColor: 'rgba(0,0,0,0.65)', color: '#fff' }}
                  title="Fotoğrafı kaldır"
                >
                  <i className="ri-close-line text-xs" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => openingRef.current?.click()}
                className="w-full h-32 rounded-lg flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors"
                style={{ backgroundColor: 'var(--surface)', border: '2px dashed var(--border)' }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--card)' }}>
                  <i className="ri-upload-cloud-line text-lg" style={{ color: 'var(--text-muted)' }} />
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Fotoğraf ekle</p>
              </button>
            )}
            <input ref={openingRef} type="file" accept="image/*" className="hidden" onChange={handleOpeningSelect} />
          </div>

          {/* Kapanış Fotoğrafı */}
          <div>
            <label className="form-label">Kapanış Fotoğrafı</label>
            {closingPreview ? (
              <div className="relative">
                <div className="w-full h-32 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  <img src={closingPreview} alt="Kapanış" className="w-full h-full object-cover" />
                </div>
                <button
                  onClick={removeClosingPhoto}
                  className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-full cursor-pointer"
                  style={{ backgroundColor: 'rgba(0,0,0,0.65)', color: '#fff' }}
                  title="Fotoğrafı kaldır"
                >
                  <i className="ri-close-line text-xs" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => closingRef.current?.click()}
                className="w-full h-32 rounded-lg flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors"
                style={{ backgroundColor: 'var(--surface)', border: '2px dashed var(--border)' }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--card)' }}>
                  <i className="ri-upload-cloud-line text-lg" style={{ color: 'var(--text-muted)' }} />
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Fotoğraf ekle</p>
              </button>
            )}
            <input ref={closingRef} type="file" accept="image/*" className="hidden" onChange={handleClosingSelect} />
          </div>
        </div>
      </div>
    </Drawer>
  );
}
