import { useRef, useState } from 'react';
import { useApp } from '@/store/AppContext';
import { uploadFileToStorage, getSignedUrlFromPath } from '@/utils/fileUpload';

interface Props {
  label: string;
  value?: string | null;
  onChange: (filePath: string | null) => void;
  accept?: string;
  disabled?: boolean;
  /** Storage path prefix, e.g. "dof" or "kapatma" */
  pathPrefix?: string;
}

export default function ImageUpload({
  label,
  value,
  onChange,
  accept = 'image/jpeg,image/jpg,image/png,image/webp',
  disabled,
  pathPrefix = 'dof',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { org } = useApp();

  // value değişince signed URL üret (preview için)
  const resolvePreview = async (path: string | null | undefined) => {
    if (!path) { setPreviewUrl(null); return; }
    // base64 ise direkt kullan
    if (path.startsWith('data:')) { setPreviewUrl(path); return; }
    // Zaten tam URL ise (eski kayıtlar) direkt kullan
    if (path.startsWith('http')) { setPreviewUrl(path); return; }
    // filePath → signed URL
    const url = await getSignedUrlFromPath(path);
    setPreviewUrl(url);
  };

  // value prop değişince preview güncelle
  useState(() => { void resolvePreview(value); });

  const uploadToStorage = async (file: File): Promise<string | null> => {
    try {
      const orgId = org?.id ?? 'unknown';
      // uploadFileToStorage → filePath döner (DB'ye kaydedilir)
      const filePath = await uploadFileToStorage(file, orgId, pathPrefix, crypto.randomUUID());
      return filePath;
    } catch (err) {
      console.error('[ImageUpload] upload error:', err);
      return null;
    }
  };

  const handleFile = async (file: File) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      alert('Dosya boyutu 8MB\'dan büyük olamaz.');
      return;
    }
    setLoading(true);
    // Önce local preview göster
    const reader = new FileReader();
    reader.onload = (e) => { if (e.target?.result) setPreviewUrl(e.target.result as string); };
    reader.readAsDataURL(file);

    try {
      const filePath = await uploadToStorage(file);
      if (filePath) {
        // filePath'i parent'a ilet (DB'ye kaydedilecek)
        onChange(filePath);
        // Signed URL ile preview güncelle
        const signedUrl = await getSignedUrlFromPath(filePath);
        if (signedUrl) setPreviewUrl(signedUrl);
      } else {
        // Fallback: base64 olarak sakla (offline/hata durumu)
        const r = new FileReader();
        r.onload = (e) => {
          if (e.target?.result) {
            const b64 = e.target.result as string;
            onChange(b64);
            setPreviewUrl(b64);
          }
        };
        r.readAsDataURL(file);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = '';
  };

  const hasImage = !!previewUrl;
  const isStoragePath = value && !value.startsWith('data:') && !value.startsWith('http');

  return (
    <div className="space-y-2">
      <label className="form-label">{label}</label>
      {loading ? (
        <div
          className="flex items-center justify-center rounded-xl"
          style={{ minHeight: '120px', background: 'rgba(15,23,42,0.3)', border: '2px dashed rgba(100,116,139,0.3)' }}
        >
          <div className="text-center">
            <div
              className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-2"
              style={{ borderColor: 'rgba(100,116,139,0.5)', borderTopColor: 'transparent' }}
            />
            <p className="text-xs" style={{ color: '#94A3B8' }}>Buluta yükleniyor...</p>
          </div>
        </div>
      ) : hasImage ? (
        <div className="relative rounded-xl overflow-hidden" style={{ border: '1px solid rgba(34,197,94,0.3)' }}>
          <img
            src={previewUrl!}
            alt={label}
            className="w-full object-cover"
            style={{ maxHeight: '220px', objectFit: 'contain', background: '#0F172A' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          {!disabled && (
            <button
              type="button"
              onClick={() => { onChange(null); setPreviewUrl(null); }}
              className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full cursor-pointer transition-all"
              style={{ background: 'rgba(239,68,68,0.9)', color: '#fff' }}
            >
              <i className="ri-delete-bin-line text-sm" />
            </button>
          )}
          <div
            className="px-3 py-1.5 text-xs font-medium flex items-center gap-1.5"
            style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E' }}
          >
            <i className="ri-cloud-line" />
            {isStoragePath ? 'Fotoğraf buluta kaydedildi — tüm cihazlarda görünür' : 'Fotoğraf seçildi'}
          </div>
        </div>
      ) : (
        <div
          onClick={() => !disabled && inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="flex flex-col items-center justify-center gap-2 rounded-xl transition-all"
          style={{
            border: '2px dashed rgba(100,116,139,0.3)',
            minHeight: '120px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            background: 'rgba(15,23,42,0.3)',
          }}
        >
          <div
            className="w-10 h-10 flex items-center justify-center rounded-xl"
            style={{ background: 'rgba(100,116,139,0.1)' }}
          >
            <i className="ri-upload-cloud-2-line text-xl" style={{ color: '#64748B' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: '#94A3B8' }}>Fotoğraf yüklemek için tıklayın</p>
          <p className="text-xs" style={{ color: '#475569' }}>JPG, PNG, WEBP — Maks. 8MB — Buluta yüklenir</p>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
        disabled={disabled}
      />
    </div>
  );
}
