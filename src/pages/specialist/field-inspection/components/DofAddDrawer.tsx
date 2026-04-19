import { useState, useRef } from 'react';
import Drawer from '@/components/base/Drawer';
import Button from '@/components/base/Button';
import { createDofRecord } from '@/services/specialistService';
import { uploadDofPhoto } from '@/services/dofStorageService';
import type { DofRow } from '@/services/specialistService';
import type { AppFirm, AppPersonnel } from '@/types/database';

interface Props {
  open: boolean;
  onClose: () => void;
  firms: AppFirm[];
  personnel: AppPersonnel[];
  organizationId: string;
  userId: string;
  onCreated: (rec: DofRow) => void;
}

const today = new Date().toISOString().slice(0, 10);

const emptyForm = {
  title: '',
  firmId: '',
  personnelId: '',
  detectionDate: today,
  responsiblePerson: '',
  targetCloseDate: '',
  description: '',
  actionRequired: '',
};

export default function DofAddDrawer({ open, onClose, firms, personnel, organizationId, userId, onCreated }: Props) {
  const [form, setForm] = useState({ ...emptyForm });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (key: keyof typeof emptyForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError('');
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const validate = () => {
    if (!form.title.trim()) return 'Uygunsuzluk başlığı zorunludur.';
    if (!form.firmId) return 'Firma seçimi zorunludur.';
    if (!form.detectionDate) return 'Tespit tarihi zorunludur.';
    if (!form.responsiblePerson.trim()) return 'Sorumlu kişi zorunludur.';
    if (!form.targetCloseDate) return 'Hedef kapatma tarihi zorunludur.';
    if (!form.description.trim()) return 'Uygunsuzluk açıklaması zorunludur.';
    if (!form.actionRequired.trim()) return 'Alınması gereken önlem zorunludur.';
    return '';
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    if (!organizationId || !userId) { setError('Oturum bilgisi eksik.'); return; }
    setLoading(true);
    try {
      let openingPhotoUrl: string | undefined;
      if (photoFile) {
        openingPhotoUrl = await uploadDofPhoto(photoFile, organizationId, 'opening');
      }
      const rec = await createDofRecord(organizationId, userId, {
        title: form.title.trim(),
        firmId: form.firmId || null,
        personnelId: form.personnelId || null,
        detectionDate: form.detectionDate,
        responsiblePerson: form.responsiblePerson.trim(),
        targetCloseDate: form.targetCloseDate,
        description: form.description.trim(),
        actionRequired: form.actionRequired.trim(),
        openingPhotoUrl,
        status: 'open',
      });
      onCreated(rec);
      setForm({ ...emptyForm });
      setPhotoFile(null);
      setPhotoPreview('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kayıt oluşturulamadı');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setForm({ ...emptyForm });
    setPhotoFile(null);
    setPhotoPreview('');
    setError('');
    onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      title="Yeni DÖF Kaydı"
      width="w-[520px]"
      footer={
        <>
          <Button variant="secondary" className="flex-1" onClick={handleClose}>İptal</Button>
          <Button variant="primary" className="flex-1" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
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
          <input className="input text-sm" placeholder="Kısa ve açıklayıcı başlık" value={form.title} onChange={(e) => set('title', e.target.value)} />
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
            <label className="form-label">Hedef Kapatma Tarihi <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="date" className="input text-sm" value={form.targetCloseDate} onChange={(e) => set('targetCloseDate', e.target.value)} />
          </div>
        </div>

        {/* Sorumlu Kişi */}
        <div>
          <label className="form-label">Sorumlu Kişi <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input className="input text-sm" placeholder="Ad Soyad" value={form.responsiblePerson} onChange={(e) => set('responsiblePerson', e.target.value)} />
        </div>

        {/* Açıklama */}
        <div>
          <label className="form-label">Uygunsuzluk Açıklaması <span style={{ color: 'var(--danger)' }}>*</span></label>
          <textarea
            className="input text-sm resize-none"
            rows={3}
            placeholder="Uygunsuzluğu detaylı açıklayın..."
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            maxLength={500}
          />
          <p className="text-xs mt-1 text-right" style={{ color: 'var(--text-muted)' }}>{form.description.length}/500</p>
        </div>

        {/* Alınması Gereken Önlem */}
        <div>
          <label className="form-label">Alınması Gereken Önlem <span style={{ color: 'var(--danger)' }}>*</span></label>
          <textarea
            className="input text-sm resize-none"
            rows={3}
            placeholder="Düzeltici ve önleyici faaliyetleri açıklayın..."
            value={form.actionRequired}
            onChange={(e) => set('actionRequired', e.target.value)}
            maxLength={500}
          />
          <p className="text-xs mt-1 text-right" style={{ color: 'var(--text-muted)' }}>{form.actionRequired.length}/500</p>
        </div>

        {/* Açılış Fotoğrafı */}
        <div>
          <label className="form-label">Açılış Fotoğrafı</label>
          {photoPreview ? (
            <div className="relative">
              <div className="w-full h-40 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                <img src={photoPreview} alt="Önizleme" className="w-full h-full object-cover" />
              </div>
              <button
                onClick={removePhoto}
                className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full cursor-pointer"
                style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff' }}
              >
                <i className="ri-close-line text-sm" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full h-28 rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
              style={{ backgroundColor: 'var(--surface)', border: '2px dashed var(--border)' }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <div className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ backgroundColor: 'var(--card)' }}>
                <i className="ri-upload-cloud-line text-xl" style={{ color: 'var(--text-muted)' }} />
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Fotoğraf yüklemek için tıklayın</p>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
        </div>

        {/* Durum notu */}
        <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: 'var(--warning-bg)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <i className="ri-information-line text-sm flex-shrink-0" style={{ color: 'var(--warning)' }} />
          <p className="text-xs" style={{ color: 'var(--warning-text)' }}>Yeni DÖF kaydı otomatik olarak <strong>Açık</strong> durumunda oluşturulur.</p>
        </div>
      </div>
    </Drawer>
  );
}
