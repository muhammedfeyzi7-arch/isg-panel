import { useState, useEffect, useRef } from 'react';
import Modal from '@/components/base/Modal';
import type { CompanyDocument } from '@/types';
import type { Firma } from '@/types';

export const DOCUMENT_TYPES = [
  'Acil Durum Planı',
  'Risk Değerlendirmesi',
  'Sağlık ve Güvenlik Planı',
  'Acil Durum Ekipleri',
  'Acil Durum Ekibi Atamaları',
  'İş Sağlığı ve Güvenliği Politikası',
  'Yangın Önleme Planı',
  'Tahliye Planı',
  'Kişisel Koruyucu Donanım Listesi',
  'Diğer',
];

interface FormState {
  company_id: string;
  title: string;
  document_type: string;
  custom_type: string;
  description: string;
  version: string;
  valid_from: string;
  valid_until: string;
  file: File | null;
  existing_file_url: string | null;
  existing_file_name: string | null;
}

const defaultForm: FormState = {
  company_id: '',
  title: '',
  document_type: '',
  custom_type: '',
  description: '',
  version: '',
  valid_from: '',
  valid_until: '',
  file: null,
  existing_file_url: null,
  existing_file_name: null,
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: FormState) => Promise<void>;
  editDoc: CompanyDocument | null;
  firmalar: Firma[];
  saving: boolean;
}

export default function DocFormModal({ isOpen, onClose, onSave, editDoc, firmalar, saving }: Props) {
  const [form, setForm] = useState<FormState>(defaultForm);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editDoc) {
      const isCustomType = !DOCUMENT_TYPES.includes(editDoc.document_type);
      setForm({
        company_id: editDoc.company_id ?? '',
        title: editDoc.title,
        document_type: isCustomType ? 'Diğer' : editDoc.document_type,
        custom_type: isCustomType ? editDoc.document_type : '',
        description: editDoc.description ?? '',
        version: editDoc.version ?? '',
        valid_from: editDoc.valid_from ?? '',
        valid_until: editDoc.valid_until ?? '',
        file: null,
        existing_file_url: editDoc.file_url,
        existing_file_name: editDoc.file_name,
      });
    } else {
      setForm(defaultForm);
    }
  }, [editDoc, isOpen]);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async () => {
    await onSave(form);
  };

  const resolvedType = form.document_type === 'Diğer' && form.custom_type.trim()
    ? form.custom_type.trim()
    : form.document_type;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editDoc ? 'Evrak Düzenle' : 'Yeni Firma Evrakı Ekle'}
      size="lg"
      icon="ri-file-add-line"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary whitespace-nowrap">İptal</button>
          <button
            onClick={handleSubmit}
            disabled={saving || !form.title.trim() || !resolvedType}
            className="btn-primary whitespace-nowrap disabled:opacity-50"
          >
            <i className={saving ? 'ri-loader-4-line animate-spin' : (editDoc ? 'ri-save-line' : 'ri-add-line')} />
            {saving ? 'Kaydediliyor...' : (editDoc ? 'Güncelle' : 'Ekle')}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Firma */}
        <div className="sm:col-span-2">
          <label className="form-label">Firma</label>
          <select value={form.company_id} onChange={e => set('company_id', e.target.value)} className="isg-input">
            <option value="">Firma Seçin (opsiyonel)</option>
            {firmalar.filter(f => !f.silinmis).map(f => (
              <option key={f.id} value={f.id}>{f.ad}</option>
            ))}
          </select>
        </div>

        {/* Evrak Başlığı */}
        <div className="sm:col-span-2">
          <label className="form-label">Evrak Başlığı *</label>
          <input
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="Evrak başlığını girin..."
            className="isg-input"
          />
        </div>

        {/* Evrak Türü */}
        <div>
          <label className="form-label">Evrak Türü *</label>
          <select value={form.document_type} onChange={e => set('document_type', e.target.value)} className="isg-input">
            <option value="">Tür Seçin</option>
            {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Özel tür */}
        {form.document_type === 'Diğer' && (
          <div>
            <label className="form-label">Özel Tür Adı *</label>
            <input
              value={form.custom_type}
              onChange={e => set('custom_type', e.target.value)}
              placeholder="Evrak türünü yazın..."
              className="isg-input"
            />
          </div>
        )}

        {/* Versiyon */}
        <div>
          <label className="form-label">Versiyon</label>
          <input
            value={form.version}
            onChange={e => set('version', e.target.value)}
            placeholder="v1.0, Rev.2..."
            className="isg-input"
          />
        </div>

        {/* Geçerlilik Başlangıç */}
        <div>
          <label className="form-label">Geçerlilik Başlangıcı</label>
          <input type="date" value={form.valid_from} onChange={e => set('valid_from', e.target.value)} className="isg-input" />
        </div>

        {/* Geçerlilik Bitiş */}
        <div>
          <label className="form-label">Geçerlilik Bitiş</label>
          <input type="date" value={form.valid_until} onChange={e => set('valid_until', e.target.value)} className="isg-input" />
        </div>

        {/* Açıklama */}
        <div className="sm:col-span-2">
          <label className="form-label">Açıklama</label>
          <textarea
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="Evrak hakkında notlar..."
            rows={3}
            maxLength={500}
            className="isg-input"
            style={{ resize: 'vertical' }}
          />
        </div>

        {/* Dosya Yükleme */}
        <div className="sm:col-span-2">
          <label className="form-label">Dosya (PDF / JPG / PNG / DOCX)</label>
          <div
            className="rounded-xl p-5 text-center cursor-pointer transition-all duration-200"
            style={{ border: '2px dashed var(--border-main)', background: 'var(--bg-item)' }}
            onClick={() => fileRef.current?.click()}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)'; e.currentTarget.style.background = 'rgba(59,130,246,0.04)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-main)'; e.currentTarget.style.background = 'var(--bg-item)'; }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) set('file', f); }}
          >
            {form.file ? (
              <div className="flex items-center justify-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ background: 'rgba(16,185,129,0.12)' }}>
                  <i className="ri-file-check-line text-xl" style={{ color: '#10B981' }} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{form.file.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{(form.file.size / 1024).toFixed(1)} KB — Değiştirmek için tıklayın</p>
                </div>
              </div>
            ) : form.existing_file_name ? (
              <div className="flex items-center justify-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ background: 'rgba(96,165,250,0.12)' }}>
                  <i className="ri-file-line text-xl" style={{ color: '#60A5FA' }} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{form.existing_file_name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Mevcut dosya — Değiştirmek için tıklayın</p>
                </div>
              </div>
            ) : (
              <>
                <i className="ri-upload-cloud-2-line text-2xl mb-2" style={{ color: 'var(--text-faint)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Dosyayı sürükleyin veya tıklayın</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>PDF, JPG, PNG, DOCX — Maks. 50MB</p>
              </>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.docx,.doc"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) set('file', f); }}
          />
        </div>
      </div>
    </Modal>
  );
}
