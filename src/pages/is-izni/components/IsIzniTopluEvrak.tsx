import { useState, useRef, useCallback, useEffect } from 'react';
import Modal from '@/components/base/Modal';
import type { IsIzni, Firma } from '@/types';
import { uploadFileToStorage } from '@/utils/fileUpload';

interface UploadFile {
  id: string;
  file: File;
  status: 'bekliyor' | 'yukleniyor' | 'tamamlandi' | 'hata';
  progress: number;
  url?: string;
  error?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  isIzni: IsIzni | null;
  isIzinleri?: IsIzni[];
  firmalar?: Firma[];
  orgId: string;
  onEvrakEklendi: (izId: string, evraklar: IsIzni['evraklar']) => void;
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

const ACCEPTED_EXT = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.txt,.ppt,.pptx';
const MAX_FILE_SIZE = 25 * 1024 * 1024;

function getFileIcon(type: string): string {
  if (type.includes('pdf')) return 'ri-file-pdf-line';
  if (type.includes('word') || type.includes('msword')) return 'ri-file-word-line';
  if (type.includes('excel') || type.includes('spreadsheet') || type.includes('ms-excel')) return 'ri-file-excel-line';
  if (type.includes('powerpoint') || type.includes('presentation')) return 'ri-file-ppt-line';
  if (type.includes('image')) return 'ri-image-line';
  if (type.includes('text')) return 'ri-file-text-line';
  return 'ri-file-line';
}

function getFileIconColor(type: string): string {
  if (type.includes('pdf')) return '#EF4444';
  if (type.includes('word') || type.includes('msword')) return '#3B82F6';
  if (type.includes('excel') || type.includes('spreadsheet') || type.includes('ms-excel')) return '#22C55E';
  if (type.includes('powerpoint') || type.includes('presentation')) return '#F97316';
  if (type.includes('image')) return '#A855F7';
  return '#64748B';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function IsIzniTopluEvrak({ open, onClose, isIzni, isIzinleri = [], firmalar = [], orgId, onEvrakEklendi }: Props) {
  const [seciliFirmaId, setSeciliFirmaId] = useState<string>(isIzni?.firmaId ?? '');
  const [seciliIzniId, setSeciliIzniId] = useState<string>(isIzni?.id ?? '');
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [evrakTur, setEvrakTur] = useState('Sıcak Çalışma');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSeciliFirmaId(isIzni?.firmaId ?? '');
      setSeciliIzniId(isIzni?.id ?? '');
      setFiles([]);
      setEvrakTur('Sıcak Çalışma');
    }
  }, [open, isIzni]);

  // Seçili firmaya ait iş izinleri
  const firmaIsIzinleri = seciliFirmaId
    ? isIzinleri.filter(i => i.firmaId === seciliFirmaId)
    : isIzinleri;

  const seciliIzni = isIzni ?? isIzinleri.find(i => i.id === seciliIzniId) ?? null;

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    const valid: UploadFile[] = [];
    arr.forEach(f => {
      if (f.size > MAX_FILE_SIZE) return;
      if (!ACCEPTED_TYPES.includes(f.type) && f.type !== '') return;
      valid.push({
        id: Math.random().toString(36).substring(2),
        file: f,
        status: 'bekliyor',
        progress: 0,
      });
    });
    setFiles(prev => [...prev, ...valid]);
  }, []);

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id));

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const handleUpload = async () => {
    if (!seciliIzni || files.length === 0) return;
    setYukleniyor(true);
    const yeniEvraklar = [...(seciliIzni.evraklar || [])];

    for (const uf of files) {
      if (uf.status === 'tamamlandi') continue;
      setFiles(prev => prev.map(f => f.id === uf.id ? { ...f, status: 'yukleniyor', progress: 30 } : f));
      try {
        const evrakId = Math.random().toString(36).substring(2);
        const url = await uploadFileToStorage(uf.file, orgId, 'is-izni-evrak', evrakId);
        setFiles(prev => prev.map(f => f.id === uf.id ? { ...f, status: 'tamamlandi', progress: 100, url: url || '' } : f));
        yeniEvraklar.push({
          id: evrakId,
          ad: uf.file.name.replace(/\.[^/.]+$/, ''),
          tur: evrakTur,
          yuklemeTarihi: new Date().toISOString(),
          dosyaAdi: uf.file.name,
          dosyaBoyutu: uf.file.size,
          dosyaTipi: uf.file.type,
          dosyaUrl: url || '',
          notlar: '',
        });
      } catch {
        setFiles(prev => prev.map(f => f.id === uf.id ? { ...f, status: 'hata', error: 'Yükleme başarısız' } : f));
      }
    }

    onEvrakEklendi(seciliIzni.id, yeniEvraklar);
    setYukleniyor(false);
  };

  const handleClose = () => {
    setFiles([]);
    setDragOver(false);
    setEvrakTur('Belge');
    onClose();
  };

  const bekleyenCount = files.filter(f => f.status === 'bekliyor').length;
  const tamamlananCount = files.filter(f => f.status === 'tamamlandi').length;
  const hataCount = files.filter(f => f.status === 'hata').length;
  const tumTamamlandi = files.length > 0 && files.every(f => f.status === 'tamamlandi' || f.status === 'hata');

  const showIzniSecim = !isIzni && isIzinleri.length > 0;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={seciliIzni ? `Toplu Evrak Yükle — ${seciliIzni.izinNo}` : 'Toplu Evrak Yükle'}
      size="lg"
      icon="ri-upload-cloud-2-line"
      footer={
        <>
          <button onClick={handleClose} className="btn-secondary whitespace-nowrap">
            {tumTamamlandi ? 'Kapat' : 'İptal'}
          </button>
          {!tumTamamlandi && (
            <button
              onClick={handleUpload}
              disabled={bekleyenCount === 0 || yukleniyor || !seciliIzni}
              className="btn-primary whitespace-nowrap"
            >
              {yukleniyor
                ? <><i className="ri-loader-4-line animate-spin mr-1" />Yükleniyor...</>
                : <><i className="ri-upload-cloud-2-line mr-1" />{bekleyenCount} Dosyayı Yükle</>}
            </button>
          )}
        </>
      }
    >
      <div className="space-y-4">

        {/* Firma + İş İzni Seçimi — sadece header butonundan açıldığında göster */}
        {showIzniSecim && (
          <div className="space-y-3">
            <div>
              <label className="form-label">Firma Seçin *</label>
              <select
                value={seciliFirmaId}
                onChange={e => { setSeciliFirmaId(e.target.value); setSeciliIzniId(''); }}
                className="isg-input w-full"
              >
                <option value="">— Firma seçin —</option>
                {firmalar.map(f => (
                  <option key={f.id} value={f.id}>{f.ad}</option>
                ))}
              </select>
            </div>
            {seciliFirmaId && (
              <div>
                <label className="form-label">İş İzni Seçin *</label>
                <select
                  value={seciliIzniId}
                  onChange={e => setSeciliIzniId(e.target.value)}
                  className="isg-input w-full"
                >
                  <option value="">— İş izni seçin —</option>
                  {firmaIsIzinleri.map(iz => (
                    <option key={iz.id} value={iz.id}>
                      {iz.izinNo} — {iz.tip} {iz.sorumlu ? `(${iz.sorumlu})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Evrak Türü */}
        <div>
          <label className="form-label">Evrak Türü</label>
          <select
            value={evrakTur}
            onChange={e => setEvrakTur(e.target.value)}
            className="isg-input w-full"
          >
            <option value="Sıcak Çalışma">Sıcak Çalışma</option>
            <option value="Yüksekte Çalışma">Yüksekte Çalışma</option>
            <option value="Kapalı Alan">Kapalı Alan</option>
            <option value="Elektrikli Çalışma">Elektrikli Çalışma</option>
            <option value="Kazı">Kazı</option>
            <option value="Genel">Genel</option>
          </select>
        </div>

        {/* Drop Zone */}
        <div
          className="rounded-2xl p-8 text-center cursor-pointer transition-all duration-200"
          style={{
            border: `2px dashed ${dragOver ? 'rgba(96,165,250,0.6)' : 'rgba(96,165,250,0.25)'}`,
            background: dragOver ? 'rgba(96,165,250,0.06)' : 'rgba(96,165,250,0.02)',
          }}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <div
            className="w-14 h-14 flex items-center justify-center rounded-2xl mx-auto mb-3 transition-all"
            style={{ background: dragOver ? 'rgba(96,165,250,0.15)' : 'rgba(96,165,250,0.08)' }}
          >
            <i className="ri-upload-cloud-2-line text-2xl" style={{ color: '#60A5FA' }} />
          </div>
          <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>
            {dragOver ? 'Bırakın!' : 'Dosyaları sürükleyin veya tıklayın'}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            PDF • Word • Excel • PowerPoint • JPG • PNG • TXT
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>Maks. 25MB / dosya • Çoklu seçim desteklenir</p>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_EXT}
            multiple
            className="hidden"
            onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
          />
        </div>

        {/* Dosya Listesi */}
        {files.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{files.length} dosya seçildi</span>
              {tamamlananCount > 0 && <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(52,211,153,0.1)', color: '#34D399' }}>{tamamlananCount} tamamlandı</span>}
              {hataCount > 0 && <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>{hataCount} hata</span>}
              {bekleyenCount > 0 && <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}>{bekleyenCount} bekliyor</span>}
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {files.map(uf => {
                const icon = getFileIcon(uf.file.type);
                const iconColor = getFileIconColor(uf.file.type);
                return (
                  <div
                    key={uf.id}
                    className="flex items-center gap-3 p-3 rounded-xl transition-all"
                    style={{
                      background: uf.status === 'tamamlandi' ? 'rgba(52,211,153,0.06)' : uf.status === 'hata' ? 'rgba(239,68,68,0.06)' : 'var(--bg-item)',
                      border: `1px solid ${uf.status === 'tamamlandi' ? 'rgba(52,211,153,0.2)' : uf.status === 'hata' ? 'rgba(239,68,68,0.2)' : 'var(--bg-item-border)'}`,
                    }}
                  >
                    <div className="w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: `${iconColor}18` }}>
                      <i className={`${icon} text-base`} style={{ color: iconColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{uf.file.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {formatBytes(uf.file.size)}
                        {uf.error && <span style={{ color: '#EF4444' }}> • {uf.error}</span>}
                      </p>
                      {uf.status === 'yukleniyor' && (
                        <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: 'var(--border-main)' }}>
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${uf.progress}%`, background: 'linear-gradient(90deg, #60A5FA, #818CF8)' }} />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {uf.status === 'bekliyor' && (
                        <button onClick={() => removeFile(uf.id)} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }} title="Kaldır">
                          <i className="ri-close-line text-sm" />
                        </button>
                      )}
                      {uf.status === 'yukleniyor' && <i className="ri-loader-4-line animate-spin text-base" style={{ color: '#60A5FA' }} />}
                      {uf.status === 'tamamlandi' && <i className="ri-checkbox-circle-fill text-lg" style={{ color: '#34D399' }} />}
                      {uf.status === 'hata' && <i className="ri-close-circle-fill text-lg" style={{ color: '#EF4444' }} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Desteklenen formatlar */}
        <div className="flex flex-wrap gap-2">
          {[
            { ext: 'PDF', color: '#EF4444', icon: 'ri-file-pdf-line' },
            { ext: 'Word', color: '#3B82F6', icon: 'ri-file-word-line' },
            { ext: 'Excel', color: '#22C55E', icon: 'ri-file-excel-line' },
            { ext: 'PowerPoint', color: '#F97316', icon: 'ri-file-ppt-line' },
            { ext: 'JPG/PNG', color: '#A855F7', icon: 'ri-image-line' },
            { ext: 'TXT', color: '#64748B', icon: 'ri-file-text-line' },
          ].map(f => (
            <span key={f.ext} className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg" style={{ background: `${f.color}12`, color: f.color }}>
              <i className={`${f.icon} text-xs`} />{f.ext}
            </span>
          ))}
        </div>
      </div>
    </Modal>
  );
}
