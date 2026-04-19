import { useState, useRef } from 'react';
import Drawer from '@/components/base/Drawer';
import Button from '@/components/base/Button';
import { updateDofRecord } from '@/services/specialistService';
import { uploadDofPhoto } from '@/services/dofStorageService';
import type { DofRow } from '@/services/specialistService';

interface Props {
  record: DofRow;
  onClose: () => void;
  onClosed: (updated: DofRow) => void;
}

export default function DofCloseDrawer({ record, onClose, onClosed }: Props) {
  const [closingNote, setClosingNote] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

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

  const handleSubmit = async () => {
    if (!closingNote.trim() && !photoFile) {
      setError('Kapama açıklaması veya fotoğraf ekleyin.');
      return;
    }
    setLoading(true);
    try {
      let closingPhotoUrl: string | undefined;
      if (photoFile) {
        closingPhotoUrl = await uploadDofPhoto(photoFile, record.organization_id, 'closing');
      }
      const updated = await updateDofRecord(record.id, {
        status: 'closed',
        closingPhotoUrl,
        closingNote: closingNote.trim() || undefined,
      });
      onClosed(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kapatılamadı');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title="DÖF Kapatma"
      width="w-[480px]"
      footer={
        <>
          <Button variant="secondary" className="flex-1" onClick={onClose}>İptal</Button>
          <Button variant="primary" className="flex-1" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Kapatılıyor...' : 'DÖF\'ü Kapat'}
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-5">
        {/* DÖF Özeti */}
        <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-mono font-semibold mb-1" style={{ color: 'var(--primary)' }}>{record.dof_no}</p>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{record.title}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{record.firm?.name ?? '—'}</p>
        </div>

        {error && (
          <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <div className="flex items-center gap-2">
              <i className="ri-error-warning-line" />
              {error}
            </div>
          </div>
        )}

        {/* Kapama Açıklaması */}
        <div>
          <label className="form-label">Kapama Açıklaması</label>
          <textarea
            className="input text-sm resize-none"
            rows={4}
            placeholder="Yapılan düzeltici faaliyeti açıklayın, uygunsuzluğun nasıl giderildiğini belirtin..."
            value={closingNote}
            onChange={(e) => { setClosingNote(e.target.value); setError(''); }}
            maxLength={500}
          />
          <p className="text-xs mt-1 text-right" style={{ color: 'var(--text-muted)' }}>{closingNote.length}/500</p>
        </div>

        {/* Kapanış Fotoğrafı */}
        <div>
          <label className="form-label">Kapanış Fotoğrafı</label>
          {photoPreview ? (
            <div className="relative">
              <div className="w-full h-44 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                <img src={photoPreview} alt="Kapanış" className="w-full h-full object-cover" />
              </div>
              <button
                onClick={removePhoto}
                className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full cursor-pointer"
                style={{ backgroundColor: 'rgba(0,0,0,0.65)', color: '#fff' }}
                title="Fotoğrafı kaldır"
              >
                <i className="ri-close-line text-sm" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full h-32 rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
              style={{ backgroundColor: 'var(--surface)', border: '2px dashed var(--border)' }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--success)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <div className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ backgroundColor: 'var(--card)' }}>
                <i className="ri-camera-line text-xl" style={{ color: 'var(--text-muted)' }} />
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Kapanış fotoğrafı ekleyin</p>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
        </div>

        <div className="flex items-start gap-2 p-3 rounded-lg" style={{ backgroundColor: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <i className="ri-checkbox-circle-line text-sm mt-0.5 flex-shrink-0" style={{ color: 'var(--success)' }} />
          <p className="text-xs" style={{ color: 'var(--success-text)' }}>
            Kapatma işlemi geri alınamaz. DÖF <strong>Kapandı</strong> durumuna geçecek ve kapanış tarihi otomatik kaydedilecektir.
          </p>
        </div>
      </div>
    </Drawer>
  );
}
