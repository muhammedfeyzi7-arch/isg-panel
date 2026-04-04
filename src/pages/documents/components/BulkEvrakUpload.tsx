import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../../store/AppContext';
import { getEvrakKategori, KATEGORI_META } from '../../../utils/evrakKategori';
import { uploadFileToStorage } from '../../../utils/fileUpload';
import type { EvrakStatus } from '../../../types';

const EVRAK_TURLERI = [
  'Kimlik', 'EK-2', 'Sağlık Raporu', 'Sürücü Belgesi', 'SRC',
  'Sertifika / MYK / Diploma', 'Oryantasyon Eğitimi', 'İşbaşı Eğitimi',
  'İş Sözleşmesi', 'Diğer',
];

interface FileItem {
  id: string;
  file: File;
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
  const { firmalar, personeller, addEvrak, addToast, theme, org } = useApp();
  const dropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDark = theme === 'dark';

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

  const addFiles = useCallback((newFiles: File[]) => {
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
      const nameWithoutExt = file.name.replace(/\.[^.]+$/, '');
      items.push({
        id: Math.random().toString(36).slice(2),
        file,
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
    const orgId = org?.id ?? 'unknown';

    for (const item of files) {
      setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'uploading' } : f));
      try {
        const kategori = getEvrakKategori(item.tur, item.evrakAdi);

        // Önce Storage'a yükle — başarısız olursa kayıt oluşturma
        const tempId = Math.random().toString(36).slice(2);
        const url = await uploadFileToStorage(item.file, orgId, 'evrak', tempId);
        if (!url) {
          addToast(`${item.file.name} — dosya yüklenemedi, kayıt oluşturulmadı.`, 'error');
          setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'error' } : f));
          continue;
        }

        // Upload başarılı → evrak kaydını oluştur
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
          dosyaUrl: url,
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
    setTimeout(() => { handleClose(); }, 800);
  };

  if (!open) return null;

  const isDone = files.every(f => f.status === 'done');
  const pendingCount = files.filter(f => f.status === 'pending' || f.status === 'uploading').length;

  // Theme tokens
  const modalBg      = isDark ? '#0D1526'                      : '#FFFFFF';
  const borderColor  = isDark ? 'rgba(255,255,255,0.07)'       : 'rgba(15,23,42,0.09)';
  const inputBg      = isDark ? 'rgba(255,255,255,0.05)'       : 'rgba(15,23,42,0.04)';
  const inputBorder  = isDark ? 'rgba(255,255,255,0.1)'        : 'rgba(15,23,42,0.1)';
  const inputColor   = isDark ? '#E2E8F0'                      : '#0F172A';
  const labelColor   = isDark ? '#64748B'                      : '#94A3B8';
  const textPrimary  = isDark ? '#E2E8F0'                      : '#0F172A';
  const textSecondary= isDark ? '#94A3B8'                      : '#64748B';
  const cardBg       = isDark ? 'rgba(255,255,255,0.03)'       : 'rgba(15,23,42,0.02)';
  const cardBorder   = isDark ? 'rgba(255,255,255,0.07)'       : 'rgba(15,23,42,0.08)';

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', zIndex: 99999 }}
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="w-full max-w-2xl flex flex-col animate-slide-up"
        style={{
          background: modalBg,
          border: `1px solid ${borderColor}`,
          borderRadius: '20px',
          boxShadow: isDark ? '0 40px 80px rgba(0,0,0,0.7)' : '0 30px 70px rgba(15,23,42,0.18)',
          maxHeight: '90vh',
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-6 py-5 flex-shrink-0"
          style={{ borderBottom: `1px solid ${borderColor}` }}
        >
          <div>
            <h3 className="text-base font-bold" style={{ color: textPrimary }}>Toplu Evrak Yükle</h3>
            <p className="text-xs mt-0.5" style={{ color: textSecondary }}>
              Birden fazla dosyayı aynı anda yükleyin
            </p>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200"
            style={{ color: textSecondary, background: 'transparent', border: `1px solid ${borderColor}` }}
            onMouseEnter={e => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = textSecondary; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = borderColor; }}
          >
            <i className="ri-close-line text-sm" />
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 min-h-0">

          {/* Firma / Personel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: labelColor }}>
                Firma *
              </label>
              <select
                value={firmaId}
                onChange={e => { setFirmaId(e.target.value); setPersonelId(''); }}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none cursor-pointer transition-all"
                style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: inputColor }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = inputBorder; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <option value="">Firma Seçin...</option>
                {firmalar.filter(f => !f.silinmis).map(f => (
                  <option key={f.id} value={f.id}>{f.ad}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: labelColor }}>
                Personel <span style={{ color: isDark ? '#334155' : '#CBD5E1' }}>(Opsiyonel)</span>
              </label>
              <select
                value={personelId}
                onChange={e => setPersonelId(e.target.value)}
                disabled={!firmaId}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none cursor-pointer transition-all disabled:opacity-40"
                style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: inputColor }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = inputBorder; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <option value="">Firma Evrakı (Kişisel Değil)</option>
                {filtPersonel.map(p => (
                  <option key={p.id} value={p.id}>{p.adSoyad}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Drop Zone ── */}
          <div
            ref={dropRef}
            className="rounded-2xl text-center cursor-pointer transition-all duration-200"
            style={{
              border: `2px dashed ${dragOver ? 'rgba(59,130,246,0.6)' : borderColor}`,
              background: dragOver
                ? 'rgba(59,130,246,0.05)'
                : isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)',
              padding: '40px 24px',
            }}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onMouseEnter={e => {
              if (!dragOver) {
                e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)';
                e.currentTarget.style.background = isDark ? 'rgba(59,130,246,0.04)' : 'rgba(59,130,246,0.03)';
              }
            }}
            onMouseLeave={e => {
              if (!dragOver) {
                e.currentTarget.style.borderColor = borderColor;
                e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)';
              }
            }}
          >
            <div
              className="w-14 h-14 flex items-center justify-center rounded-2xl mx-auto mb-4"
              style={{
                background: dragOver ? 'rgba(59,130,246,0.15)' : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)',
                border: `1px solid ${dragOver ? 'rgba(59,130,246,0.3)' : borderColor}`,
                transition: 'all 0.2s',
              }}
            >
              <i
                className="ri-upload-cloud-2-line text-2xl"
                style={{ color: dragOver ? '#3B82F6' : textSecondary, transition: 'color 0.2s' }}
              />
            </div>
            <p className="text-sm font-semibold mb-1" style={{ color: textPrimary }}>
              Dosyaları sürükleyin veya tıklayın
            </p>
            <p className="text-xs" style={{ color: textSecondary }}>
              PDF, JPG, PNG &bull; Aynı anda birden fazla dosya &bull; Maks. 10MB/dosya
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

          {/* ── File List ── */}
          {files.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold" style={{ color: textSecondary }}>
                  {files.length} dosya seçildi
                </p>
                <button
                  onClick={() => setFiles([])}
                  className="text-xs font-semibold cursor-pointer transition-all"
                  style={{ color: '#EF4444' }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.7'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                >
                  Tümünü Temizle
                </button>
              </div>

              {files.map(item => {
                const kat = getEvrakKategori(item.tur, item.evrakAdi);
                const meta = KATEGORI_META[kat];
                const statusIcon =
                  item.status === 'done'      ? 'ri-checkbox-circle-fill'
                  : item.status === 'error'   ? 'ri-close-circle-fill'
                  : item.status === 'uploading' ? 'ri-loader-4-line animate-spin'
                  : 'ri-file-line';
                const statusColor =
                  item.status === 'done'      ? '#10B981'
                  : item.status === 'error'   ? '#EF4444'
                  : item.status === 'uploading' ? '#F59E0B'
                  : textSecondary;

                return (
                  <div
                    key={item.id}
                    className="rounded-xl p-4 transition-all"
                    style={{
                      background: cardBg,
                      border: `1px solid ${
                        item.status === 'done'  ? 'rgba(16,185,129,0.2)'
                        : item.status === 'error' ? 'rgba(239,68,68,0.2)'
                        : cardBorder
                      }`,
                    }}
                  >
                    {/* File header row */}
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
                        style={{ background: `${statusColor}18` }}
                      >
                        <i className={`${statusIcon} text-sm`} style={{ color: statusColor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: textPrimary }}>
                          {item.file.name}
                        </p>
                        <p className="text-[10px] mt-0.5" style={{ color: textSecondary }}>
                          {(item.file.size / 1024).toFixed(0)} KB
                          &nbsp;&bull;&nbsp;
                          <span style={{ color: meta.color }}>{meta.label}</span>
                        </p>
                      </div>
                      {item.status === 'pending' && (
                        <button
                          onClick={() => removeFile(item.id)}
                          className="w-6 h-6 flex items-center justify-center rounded-lg cursor-pointer transition-all flex-shrink-0"
                          style={{ color: '#EF4444', background: 'rgba(239,68,68,0.1)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                        >
                          <i className="ri-close-line text-xs" />
                        </button>
                      )}
                    </div>

                    {/* Editable fields */}
                    {item.status === 'pending' && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <input
                            value={item.evrakAdi}
                            onChange={e => updateFile(item.id, { evrakAdi: e.target.value })}
                            placeholder="Evrak adı"
                            className="w-full px-2.5 py-2 rounded-lg text-xs outline-none transition-all"
                            style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: inputColor }}
                            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = inputBorder; }}
                          />
                        </div>
                        <div>
                          <select
                            value={item.tur}
                            onChange={e => updateFile(item.id, { tur: e.target.value })}
                            className="w-full px-2.5 py-2 rounded-lg text-xs outline-none cursor-pointer transition-all"
                            style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: inputColor }}
                            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = inputBorder; }}
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
                            className="w-full px-2.5 py-2 rounded-lg text-xs outline-none cursor-pointer transition-all"
                            style={{
                              background: inputBg,
                              border: `1px solid ${inputBorder}`,
                              color: item.gecerlilikTarihi ? inputColor : textSecondary,
                            }}
                            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = inputBorder; }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Info note */}
              <div
                className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl mt-1"
                style={{ background: isDark ? 'rgba(59,130,246,0.06)' : 'rgba(59,130,246,0.04)', border: `1px solid rgba(59,130,246,0.12)` }}
              >
                <i className="ri-information-line text-sm flex-shrink-0 mt-0.5" style={{ color: '#60A5FA' }} />
                <p className="text-xs leading-relaxed" style={{ color: textSecondary }}>
                  Her dosya için <strong style={{ color: textPrimary }}>evrak adı</strong>,{' '}
                  <strong style={{ color: textPrimary }}>türü</strong> ve{' '}
                  <strong style={{ color: textPrimary }}>geçerlilik tarihi</strong> girebilirsiniz.
                  Dosyalar Supabase Storage&apos;a yüklenir, tüm cihazlardan erişilebilir.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0 gap-3"
          style={{ borderTop: `1px solid ${borderColor}` }}
        >
          <div>
            {files.length > 0 && (
              isDone ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#10B981' }}>
                  <i className="ri-checkbox-circle-line" />Tümü yüklendi!
                </span>
              ) : (
                <span className="text-xs" style={{ color: textSecondary }}>
                  {pendingCount} dosya bekliyor
                </span>
              )
            )}
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={handleClose}
              className="whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all"
              style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)', border: `1px solid ${borderColor}`, color: textSecondary }}
              onMouseEnter={e => { e.currentTarget.style.color = textPrimary; }}
              onMouseLeave={e => { e.currentTarget.style.color = textSecondary; }}
            >
              İptal
            </button>
            <button
              onClick={handleSaveAll}
              disabled={uploading || files.length === 0 || !firmaId || isDone}
              className="whitespace-nowrap flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer transition-all"
              style={{
                background: 'linear-gradient(135deg, #3B82F6, #22C55E)',
                boxShadow: '0 4px 14px rgba(59,130,246,0.3)',
                opacity: (uploading || files.length === 0 || !firmaId || isDone) ? 0.5 : 1,
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
    </div>,
    document.body
  );
}
