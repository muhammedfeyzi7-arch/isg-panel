import { useState, useRef, useCallback } from 'react';
import { useApp } from '../../../store/AppContext';
import { getEvrakKategori, KATEGORI_META } from '../../../utils/evrakKategori';
import type { EvrakStatus } from '../../../types';

const EVRAK_TURLERI = [
  'Kimlik', 'EK-2', 'Sağlık Raporu', 'Sürücü Belgesi', 'SRC',
  'Sertifika / MYK / Diploma', 'Oryantasyon Eğitimi', 'İşbaşı Eğitimi',
  'İş Sözleşmesi', 'Diğer',
];

interface FileItem {
  id: string;
  file: File;
  dataUrl: string;
  evrakAdi: string;
  tur: string;
  gecerlilikTarihi: string;
  yuklemeTarihi: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
}

interface Props {
  open: boolean;
  onClose: () => void;
}

function calcDurum(dosyaAdi: string, gecerlilikTarihi: string): EvrakStatus {
  if (!dosyaAdi) return 'Eksik';
  if (!gecerlilikTarihi) return 'Yüklü';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const gecerlilik = new Date(gecerlilikTarihi); gecerlilik.setHours(0, 0, 0, 0);
  const diff = Math.ceil((gecerlilik.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return 'Süre Dolmuş';
  if (diff <= 7) return 'Süre Yaklaşıyor';
  return 'Yüklü';
}

export default function BulkEvrakUpload({ open, onClose }: Props) {
  const { firmalar, personeller, addEvrak, addToast } = useApp();
  const dropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [firmaId, setFirmaId] = useState('');
  const [personelId, setPersonelId] = useState('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const filtPersonel = firmaId
    ? personeller.filter(p => p.firmaId === firmaId && !p.silinmis)
    : [];

  const resetState = () => {
    setFirmaId('');
    setPersonelId('');
    setFiles([]);
    setUploading(false);
    setDragOver(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const readFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const addFiles = useCallback(async (newFiles: File[]) => {
    const today = new Date().toISOString().split('T')[0];
    const items: FileItem[] = [];

    for (const file of newFiles) {
      if (!file.type.match(/pdf|jpg|jpeg|png/i) && !file.name.match(/\.(pdf|jpg|jpeg|png)$/i)) {
        addToast(`${file.name} — desteklenmeyen format, atlandı.`, 'warning');
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        addToast(`${file.name} — 10MB sınırını aşıyor, atlandı.`, 'warning');
        continue;
      }
      const dataUrl = await readFile(file);
      const nameWithoutExt = file.name.replace(/\.[^.]+$/, '');
      items.push({
        id: Math.random().toString(36).slice(2),
        file,
        dataUrl,
        evrakAdi: nameWithoutExt,
        tur: 'Diğer',
        gecerlilikTarihi: '',
        yuklemeTarihi: today,
        status: 'pending',
      });
    }

    setFiles(prev => [...prev, ...items]);
  }, [addToast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(Array.from(e.dataTransfer.files));
  }, [addFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      addFiles(Array.from(e.target.files));
    }
    e.target.value = '';
  };

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id));

  const updateFile = (id: string, updates: Partial<FileItem>) =>
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));

  const handleSaveAll = async () => {
    if (!firmaId) { addToast('Firma seçimi zorunludur.', 'error'); return; }
    if (files.length === 0) { addToast('En az bir dosya ekleyin.', 'warning'); return; }

    setUploading(true);
    let successCount = 0;

    for (const item of files) {
      setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'uploading' } : f));
      try {
        const kategori = getEvrakKategori(item.tur, item.evrakAdi);
        addEvrak({
          ad: item.evrakAdi,
          tur: item.tur,
          firmaId,
          personelId: personelId || '',
          durum: calcDurum(item.file.name, item.gecerlilikTarihi),
          yuklemeTarihi: item.yuklemeTarihi,
          gecerlilikTarihi: item.gecerlilikTarihi,
          dosyaAdi: item.file.name,
          dosyaBoyutu: item.file.size,
          dosyaTipi: item.file.type,
          dosyaVeri: item.dataUrl,
          notlar: '',
          kategori,
        });
        setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'done' } : f));
        successCount++;
      } catch {
        setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'error' } : f));
      }
    }

    setUploading(false);
    addToast(`${successCount} evrak başarıyla yüklendi.`, 'success');

    setTimeout(() => {
      handleClose();
    }, 800);
  };

  if (!open) return null;

  const isDone = files.every(f => f.status === 'done');
  const pending = files.filter(f => f.status === 'pending' || f.status === 'uploading').length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="w-full max-w-3xl rounded-2xl flex flex-col"
        style={{
          background: 'linear-gradient(180deg, #0D1526 0%, #0A0F1E 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
              style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.2)' }}
            >
              <i className="ri-upload-cloud-2-line text-base" style={{ color: '#818CF8' }} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">Toplu Evrak Yükle</h3>
              <p className="text-xs mt-0.5" style={{ color: '#475569' }}>
                Birden fazla dosyayı aynı anda yükleyin
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#64748B' }}
          >
            <i className="ri-close-line" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 min-h-0">
          {/* Firma / Personel seçimi */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>
                Firma *
              </label>
              <select
                value={firmaId}
                onChange={e => { setFirmaId(e.target.value); setPersonelId(''); }}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none cursor-pointer"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  color: '#E2E8F0',
                }}
              >
                <option value="">Firma Seçin...</option>
                {firmalar.filter(f => !f.silinmis).map(f => (
                  <option key={f.id} value={f.id}>{f.ad}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>
                Personel (Opsiyonel)
              </label>
              <select
                value={personelId}
                onChange={e => setPersonelId(e.target.value)}
                disabled={!firmaId}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none cursor-pointer disabled:opacity-40"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  color: '#E2E8F0',
                }}
              >
                <option value="">Firma Evrakı (Kişisel Değil)</option>
                {filtPersonel.map(p => (
                  <option key={p.id} value={p.id}>{p.adSoyad}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Drop Zone */}
          <div
            ref={dropRef}
            className="rounded-2xl p-8 text-center cursor-pointer transition-all duration-200"
            style={{
              border: `2px dashed ${dragOver ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.1)'}`,
              background: dragOver ? 'rgba(99,102,241,0.06)' : 'rgba(255,255,255,0.02)',
            }}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <div
              className="w-14 h-14 flex items-center justify-center rounded-2xl mx-auto mb-3"
              style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.15)' }}
            >
              <i className="ri-upload-cloud-2-line text-2xl" style={{ color: dragOver ? '#818CF8' : '#475569' }} />
            </div>
            <p className="text-sm font-semibold text-slate-300">
              Dosyaları sürükleyin veya tıklayın
            </p>
            <p className="text-xs mt-1" style={{ color: '#475569' }}>
              PDF, JPG, PNG desteklenir &bull; Aynı anda birden fazla dosya seçebilirsiniz &bull; Maks. 10MB/dosya
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold" style={{ color: '#64748B' }}>
                  {files.length} dosya seçildi
                </p>
                <button
                  onClick={() => setFiles([])}
                  className="text-xs cursor-pointer"
                  style={{ color: '#EF4444' }}
                >
                  Tümünü Temizle
                </button>
              </div>

              {files.map(item => {
                const kat = getEvrakKategori(item.tur, item.evrakAdi);
                const meta = KATEGORI_META[kat];
                const statusIcon =
                  item.status === 'done' ? 'ri-checkbox-circle-fill'
                    : item.status === 'error' ? 'ri-close-circle-fill'
                      : item.status === 'uploading' ? 'ri-loader-4-line animate-spin'
                        : 'ri-file-line';
                const statusColor =
                  item.status === 'done' ? '#10B981'
                    : item.status === 'error' ? '#EF4444'
                      : item.status === 'uploading' ? '#F59E0B'
                        : '#64748B';

                return (
                  <div
                    key={item.id}
                    className="rounded-xl p-4"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: `1px solid ${item.status === 'done' ? 'rgba(16,185,129,0.2)' : item.status === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)'}`,
                    }}
                  >
                    {/* File header */}
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
                        style={{ background: `${statusColor}18` }}
                      >
                        <i className={`${statusIcon} text-sm`} style={{ color: statusColor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-300 truncate">{item.file.name}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: '#475569' }}>
                          {(item.file.size / 1024).toFixed(0)} KB
                          &nbsp;&bull;&nbsp;
                          <span style={{ color: meta.color }}>{meta.label}</span>
                        </p>
                      </div>
                      {item.status === 'pending' && (
                        <button
                          onClick={() => removeFile(item.id)}
                          className="w-6 h-6 flex items-center justify-center rounded cursor-pointer flex-shrink-0"
                          style={{ color: '#EF4444', background: 'rgba(239,68,68,0.1)' }}
                        >
                          <i className="ri-close-line text-xs" />
                        </button>
                      )}
                    </div>

                    {/* Editable fields */}
                    {item.status === 'pending' && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="sm:col-span-1">
                          <input
                            value={item.evrakAdi}
                            onChange={e => updateFile(item.id, { evrakAdi: e.target.value })}
                            placeholder="Evrak adı"
                            className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none"
                            style={{
                              background: 'rgba(255,255,255,0.04)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              color: '#E2E8F0',
                            }}
                          />
                        </div>
                        <div>
                          <select
                            value={item.tur}
                            onChange={e => updateFile(item.id, { tur: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none cursor-pointer"
                            style={{
                              background: 'rgba(255,255,255,0.04)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              color: '#E2E8F0',
                            }}
                          >
                            {EVRAK_TURLERI.map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <input
                            type="date"
                            value={item.gecerlilikTarihi}
                            onChange={e => updateFile(item.id, { gecerlilikTarihi: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none cursor-pointer"
                            style={{
                              background: 'rgba(255,255,255,0.04)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              color: item.gecerlilikTarihi ? '#E2E8F0' : '#64748B',
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Info note */}
          {files.length > 0 && (
            <div
              className="flex items-start gap-2 px-3 py-2.5 rounded-lg"
              style={{
                background: 'rgba(99,102,241,0.06)',
                border: '1px solid rgba(99,102,241,0.12)',
              }}
            >
              <i className="ri-information-line text-sm flex-shrink-0 mt-0.5" style={{ color: '#818CF8' }} />
              <p className="text-xs" style={{ color: '#64748B' }}>
                Her dosya için <strong style={{ color: '#94A3B8' }}>evrak adı</strong>,
                <strong style={{ color: '#94A3B8' }}> türü</strong> ve
                <strong style={{ color: '#94A3B8' }}> geçerlilik tarihi</strong> girebilirsiniz.
                Geçerlilik tarihi boş bırakılırsa durum otomatik hesaplanır.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0 gap-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center gap-3">
            {files.length > 0 && (
              <div className="flex items-center gap-2">
                {isDone ? (
                  <span className="text-xs font-semibold" style={{ color: '#10B981' }}>
                    <i className="ri-checkbox-circle-line mr-1" />Tümü yüklendi!
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: '#64748B' }}>
                    {pending} dosya bekliyor
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#64748B',
              }}
            >
              İptal
            </button>
            <button
              onClick={handleSaveAll}
              disabled={uploading || files.length === 0 || !firmaId || isDone}
              className="whitespace-nowrap flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer transition-all"
              style={{
                background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
                opacity: (uploading || files.length === 0 || !firmaId || isDone) ? 0.6 : 1,
              }}
            >
              {uploading ? (
                <><i className="ri-loader-4-line animate-spin" />Yükleniyor...</>
              ) : (
                <><i className="ri-upload-cloud-2-line" />Tümünü Yükle ({files.filter(f => f.status === 'pending').length})</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
