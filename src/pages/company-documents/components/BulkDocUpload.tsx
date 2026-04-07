import { useState, useRef, useCallback } from 'react';
import Modal from '@/components/base/Modal';
import type { Firma } from '@/types';

interface BulkFile {
  id: string;
  file: File;
  title: string;
  document_type: string;
  company_id: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  firmalar: Firma[];
  onUpload: (items: BulkFile[]) => Promise<void>;
  uploading: boolean;
}

const DOCUMENT_TYPES = [
  'Acil Durum Planı', 'Risk Değerlendirmesi', 'Sağlık ve Güvenlik Planı',
  'Acil Durum Ekipleri', 'Acil Durum Ekibi Atamaları', 'İş Sağlığı ve Güvenliği Politikası',
  'Yangın Önleme Planı', 'Tahliye Planı', 'Kişisel Koruyucu Donanım Listesi', 'Diğer',
];

export default function BulkDocUpload({ isOpen, onClose, firmalar, onUpload, uploading }: Props) {
  const [files, setFiles] = useState<BulkFile[]>([]);
  const [globalCompany, setGlobalCompany] = useState('');
  const [globalType, setGlobalType] = useState('');
  const dropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    const items: BulkFile[] = arr.map(f => ({
      id: `${Date.now()}-${Math.random()}`,
      file: f,
      title: f.name.replace(/\.[^.]+$/, ''),
      document_type: globalType || '',
      company_id: globalCompany || '',
      status: 'pending',
    }));
    setFiles(prev => [...prev, ...items]);
  }, [globalType, globalCompany]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const updateFile = (id: string, key: keyof BulkFile, val: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, [key]: val } : f));
  };

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id));

  const applyGlobal = () => {
    setFiles(prev => prev.map(f => ({
      ...f,
      company_id: globalCompany || f.company_id,
      document_type: globalType || f.document_type,
    })));
  };

  const handleClose = () => {
    setFiles([]);
    setGlobalCompany('');
    setGlobalType('');
    onClose();
  };

  const canUpload = files.length > 0 && files.every(f => f.title.trim() && f.document_type);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Toplu Evrak Yükleme"
      size="xl"
      icon="ri-stack-line"
      footer={
        <>
          <button onClick={handleClose} className="btn-secondary whitespace-nowrap">İptal</button>
          <button
            onClick={() => onUpload(files)}
            disabled={!canUpload || uploading}
            className="btn-primary whitespace-nowrap disabled:opacity-50"
          >
            <i className={uploading ? 'ri-loader-4-line animate-spin' : 'ri-upload-cloud-2-line'} />
            {uploading ? 'Yükleniyor...' : `${files.length} Evrak Yükle`}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Global ayarlar */}
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--bg-item)', border: '1px solid var(--bg-item-border)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Tüm Dosyalara Uygula</p>
          <div className="flex gap-3 flex-wrap">
            <select value={globalCompany} onChange={e => setGlobalCompany(e.target.value)} className="isg-input flex-1 min-w-[160px]">
              <option value="">Firma Seçin (opsiyonel)</option>
              {firmalar.filter(f => !f.silinmis).map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
            </select>
            <select value={globalType} onChange={e => setGlobalType(e.target.value)} className="isg-input flex-1 min-w-[160px]">
              <option value="">Evrak Türü Seçin</option>
              {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={applyGlobal} disabled={!globalCompany && !globalType} className="btn-secondary whitespace-nowrap disabled:opacity-40">
              <i className="ri-check-double-line" /> Uygula
            </button>
          </div>
        </div>

        {/* Drop zone */}
        <div
          ref={dropRef}
          className="rounded-xl p-8 text-center cursor-pointer transition-all duration-200"
          style={{ border: '2px dashed var(--border-main)', background: 'var(--bg-item)' }}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'rgba(52,211,153,0.5)'; }}
          onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border-main)'; }}
          onDrop={e => { e.currentTarget.style.borderColor = 'var(--border-main)'; handleDrop(e); }}
        >
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl mx-auto mb-3" style={{ background: 'rgba(52,211,153,0.1)' }}>
            <i className="ri-upload-cloud-2-line text-2xl" style={{ color: '#34D399' }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Dosyaları sürükleyin veya tıklayın</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>PDF, JPG, PNG, DOCX — Birden fazla dosya seçebilirsiniz</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.docx,.doc"
            className="hidden"
            onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
          />
        </div>

        {/* Dosya listesi */}
        {files.length > 0 && (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {files.map((f, idx) => (
              <div key={f.id} className="rounded-xl p-3 flex gap-3 items-start" style={{ background: 'var(--bg-item)', border: '1px solid var(--bg-item-border)' }}>
                <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 mt-0.5" style={{ background: 'rgba(99,102,241,0.1)' }}>
                  <span className="text-xs font-bold" style={{ color: '#818CF8' }}>{idx + 1}</span>
                </div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    value={f.title}
                    onChange={e => updateFile(f.id, 'title', e.target.value)}
                    placeholder="Evrak başlığı *"
                    className="isg-input text-sm sm:col-span-1"
                  />
                  <select
                    value={f.document_type}
                    onChange={e => updateFile(f.id, 'document_type', e.target.value)}
                    className="isg-input text-sm"
                  >
                    <option value="">Tür Seçin *</option>
                    {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select
                    value={f.company_id}
                    onChange={e => updateFile(f.id, 'company_id', e.target.value)}
                    className="isg-input text-sm"
                  >
                    <option value="">Firma (opsiyonel)</option>
                    {firmalar.filter(fi => !fi.silinmis).map(fi => <option key={fi.id} value={fi.id}>{fi.ad}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {f.status === 'done' && <i className="ri-checkbox-circle-fill text-lg" style={{ color: '#34D399' }} />}
                  {f.status === 'error' && <i className="ri-close-circle-fill text-lg" style={{ color: '#F87171' }} title={f.error} />}
                  {f.status === 'uploading' && <i className="ri-loader-4-line animate-spin text-lg" style={{ color: '#FBBF24' }} />}
                  <button
                    onClick={() => removeFile(f.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}
                  >
                    <i className="ri-close-line text-sm" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {files.length === 0 && (
          <p className="text-center text-xs py-2" style={{ color: 'var(--text-faint)' }}>Henüz dosya eklenmedi</p>
        )}
      </div>
    </Modal>
  );
}

export type { BulkFile };
