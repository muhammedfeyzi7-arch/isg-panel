import { useRef } from 'react';

interface Props {
  label: string;
  value?: string | null;
  onChange: (base64: string | null) => void;
  accept?: string;
  disabled?: boolean;
}

export default function ImageUpload({ label, value, onChange, accept = 'image/jpeg,image/jpg,image/png,image/webp', disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) return; // 8MB limit
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) onChange(e.target.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-2">
      <label className="form-label">{label}</label>
      {value ? (
        <div className="relative rounded-xl overflow-hidden border" style={{ border: '1px solid rgba(34,197,94,0.3)' }}>
          <img
            src={value}
            alt={label}
            className="w-full object-cover"
            style={{ maxHeight: '220px', objectFit: 'contain', background: '#0F172A' }}
          />
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full cursor-pointer transition-all"
              style={{ background: 'rgba(239,68,68,0.9)', color: '#fff' }}
            >
              <i className="ri-delete-bin-line text-sm" />
            </button>
          )}
          <div className="px-3 py-1.5 text-xs font-medium" style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E' }}>
            <i className="ri-image-line mr-1" />Fotoğraf yüklendi
          </div>
        </div>
      ) : (
        <div
          onClick={() => !disabled && inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          className="flex flex-col items-center justify-center gap-2 rounded-xl transition-all"
          style={{
            border: '2px dashed rgba(100,116,139,0.3)',
            minHeight: '120px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            background: 'rgba(15,23,42,0.3)',
          }}
        >
          <div className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ background: 'rgba(100,116,139,0.1)' }}>
            <i className="ri-upload-cloud-2-line text-xl" style={{ color: '#64748B' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: '#94A3B8' }}>Fotoğraf yüklemek için tıklayın</p>
          <p className="text-xs" style={{ color: '#475569' }}>JPG, PNG, WEBP — Maks. 8MB</p>
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
