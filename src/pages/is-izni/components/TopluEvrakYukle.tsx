import { useState, useRef } from 'react';
import Modal from '@/components/base/Modal';
import type { Firma } from '@/types';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/store/AppContext';

const IZIN_TURLERI = [
  'Sıcak Çalışma',
  'Yüksekte Çalışma',
  'Kapalı Alan',
  'Elektrikli Çalışma',
  'Kazı',
  'Genel',
];

interface YuklenecekDosya {
  id: string;
  dosya: File;
  ad: string;
  durum: 'bekliyor' | 'yukleniyor' | 'tamamlandi' | 'hata';
  hata?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  firmalar: Firma[];
}

export default function TopluEvrakYukle({ open, onClose, firmalar }: Props) {
  const { addToast, org } = useApp();
  const [firmaId, setFirmaId] = useState('');
  const [izinTuru, setIzinTuru] = useState('');
  const [dosyalar, setDosyalar] = useState<YuklenecekDosya[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDosyaEkle = (files: FileList | null) => {
    if (!files) return;
    const yeni: YuklenecekDosya[] = Array.from(files).map(f => ({
      id: Math.random().toString(36).substring(2),
      dosya: f,
      ad: f.name,
      durum: 'bekliyor',
    }));
    setDosyalar(prev => [...prev, ...yeni]);
  };

  const handleDosyaSil = (id: string) => {
    setDosyalar(prev => prev.filter(d => d.id !== id));
  };

  const handleAdDegistir = (id: string, ad: string) => {
    setDosyalar(prev => prev.map(d => d.id === id ? { ...d, ad } : d));
  };

  const handleYukle = async () => {
    if (!firmaId) { addToast('Firma seçimi zorunludur.', 'error'); return; }
    if (!izinTuru) { addToast('İzin türü seçimi zorunludur.', 'error'); return; }
    if (dosyalar.length === 0) { addToast('En az bir dosya seçmelisiniz.', 'error'); return; }

    setYukleniyor(true);
    const orgId = org?.id ?? 'unknown';
    let basarili = 0;
    let hatali = 0;

    for (const d of dosyalar) {
      setDosyalar(prev => prev.map(x => x.id === d.id ? { ...x, durum: 'yukleniyor' } : x));
      try {
        const MAX_BYTES = 50 * 1024 * 1024; // 50MB
        if (d.dosya.size > MAX_BYTES) {
          setDosyalar(prev => prev.map(x => x.id === d.id ? { ...x, durum: 'hata', hata: 'Dosya 50MB sınırını aşıyor' } : x));
          hatali++;
          continue;
        }
        const ext = d.dosya.name.split('.').pop()?.toLowerCase() ?? 'bin';
        const filePath = `${orgId}/is-izni-evrak/${firmaId}/${izinTuru.replace(/\s+/g, '-')}/${d.id}.${ext}`;
        const { error } = await supabase.storage
          .from('uploads')
          .upload(filePath, d.dosya, { upsert: true, contentType: d.dosya.type });
        if (!error) {
          setDosyalar(prev => prev.map(x => x.id === d.id ? { ...x, durum: 'tamamlandi' } : x));
          basarili++;
        } else {
          setDosyalar(prev => prev.map(x => x.id === d.id ? { ...x, durum: 'hata', hata: error.message || 'Yükleme başarısız' } : x));
          hatali++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Yükleme hatası';
        setDosyalar(prev => prev.map(x => x.id === d.id ? { ...x, durum: 'hata', hata: msg } : x));
        hatali++;
      }
    }

    setYukleniyor(false);
    if (basarili > 0) addToast(`${basarili} dosya başarıyla yüklendi.${hatali > 0 ? ` ${hatali} dosya başarısız.` : ''}`, basarili > 0 ? 'success' : 'error');
    if (hatali === 0 && basarili > 0) {
      setTimeout(() => { handleKapat(); }, 1200);
    }
  };

  const handleKapat = () => {
    setFirmaId('');
    setIzinTuru('');
    setDosyalar([]);
    setYukleniyor(false);
    onClose();
  };

  const tumTamamlandi = dosyalar.length > 0 && dosyalar.every(d => d.durum === 'tamamlandi');
  const bekleyenVar = dosyalar.some(d => d.durum === 'bekliyor');

  const getFileIcon = (dosyaAdi: string) => {
    const ext = dosyaAdi.split('.').pop()?.toLowerCase();
    if (['pdf'].includes(ext ?? '')) return { icon: 'ri-file-pdf-line', color: '#EF4444' };
    if (['doc', 'docx'].includes(ext ?? '')) return { icon: 'ri-file-word-line', color: '#3B82F6' };
    if (['xls', 'xlsx'].includes(ext ?? '')) return { icon: 'ri-file-excel-line', color: '#10B981' };
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext ?? '')) return { icon: 'ri-image-line', color: '#F59E0B' };
    if (['zip', 'rar', '7z'].includes(ext ?? '')) return { icon: 'ri-file-zip-line', color: '#8B5CF6' };
    return { icon: 'ri-file-line', color: '#64748B' };
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Modal
      open={open}
      onClose={handleKapat}
      title="Toplu Evrak Yükle"
      size="lg"
      icon="ri-upload-cloud-2-line"
      footer={
        <>
          <button onClick={handleKapat} className="btn-secondary whitespace-nowrap">
            {tumTamamlandi ? 'Kapat' : 'İptal'}
          </button>
          {!tumTamamlandi && (
            <button
              onClick={handleYukle}
              disabled={yukleniyor || dosyalar.length === 0 || !firmaId || !izinTuru}
              className="btn-primary whitespace-nowrap"
            >
              {yukleniyor
                ? <><i className="ri-loader-4-line animate-spin mr-1" />Yükleniyor...</>
                : <><i className="ri-upload-cloud-2-line mr-1" />{dosyalar.length > 0 ? `${dosyalar.filter(d => d.durum === 'bekliyor').length} Dosyayı Yükle` : 'Yükle'}</>
              }
            </button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        {/* Bilgi banner */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)' }}>
          <i className="ri-information-line flex-shrink-0 mt-0.5" style={{ color: '#60A5FA' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Toplu Evrak Yükleme</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Firma ve izin türünü seçin, ardından istediğiniz formattaki dosyaları yükleyin. Word, Excel, PDF, resim ve diğer tüm formatlar desteklenir.
            </p>
          </div>
        </div>

        {/* Firma ve İzin Türü */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Firma *</label>
            <select
              value={firmaId}
              onChange={e => setFirmaId(e.target.value)}
              className="isg-input w-full"
              disabled={yukleniyor}
            >
              <option value="">Firma Seçin</option>
              {firmalar.map(f => (
                <option key={f.id} value={f.id}>{f.ad}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">İzin Türü *</label>
            <select
              value={izinTuru}
              onChange={e => setIzinTuru(e.target.value)}
              className="isg-input w-full"
              disabled={yukleniyor}
            >
              <option value="">İzin Türü Seçin</option>
              {IZIN_TURLERI.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Dosya Yükleme Alanı */}
        <div>
          <label className="form-label">Dosyalar *</label>
          <div
            className="rounded-xl p-8 text-center cursor-pointer transition-all"
            style={{
              border: '2px dashed rgba(96,165,250,0.35)',
              background: 'rgba(96,165,250,0.03)',
            }}
            onClick={() => !yukleniyor && fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              if (!yukleniyor) handleDosyaEkle(e.dataTransfer.files);
            }}
            onMouseEnter={e => { if (!yukleniyor) { e.currentTarget.style.borderColor = 'rgba(96,165,250,0.6)'; e.currentTarget.style.background = 'rgba(96,165,250,0.06)'; } }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(96,165,250,0.35)'; e.currentTarget.style.background = 'rgba(96,165,250,0.03)'; }}
          >
            <div className="w-14 h-14 flex items-center justify-center rounded-2xl mx-auto mb-3" style={{ background: 'rgba(96,165,250,0.12)' }}>
              <i className="ri-upload-cloud-2-line text-2xl" style={{ color: '#60A5FA' }} />
            </div>
            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              Dosyaları sürükleyin veya tıklayın
            </p>
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
              Word, Excel, PDF, resim ve tüm formatlar desteklenir • Maks. 50MB/dosya
            </p>
            <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
              {[
                { ext: 'PDF', color: '#EF4444', icon: 'ri-file-pdf-line' },
                { ext: 'Word', color: '#3B82F6', icon: 'ri-file-word-line' },
                { ext: 'Excel', color: '#10B981', icon: 'ri-file-excel-line' },
                { ext: 'Resim', color: '#F59E0B', icon: 'ri-image-line' },
                { ext: 'Diğer', color: '#64748B', icon: 'ri-file-line' },
              ].map(f => (
                <span key={f.ext} className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg"
                  style={{ background: `${f.color}12`, color: f.color, border: `1px solid ${f.color}20` }}>
                  <i className={`${f.icon} text-[10px]`} />{f.ext}
                </span>
              ))}
            </div>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={e => { handleDosyaEkle(e.target.files); e.target.value = ''; }}
            />
          </div>
        </div>

        {/* Dosya Listesi */}
        {dosyalar.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                {dosyalar.length} dosya seçildi
                {dosyalar.filter(d => d.durum === 'tamamlandi').length > 0 && (
                  <span className="ml-2" style={{ color: '#34D399' }}>
                    • {dosyalar.filter(d => d.durum === 'tamamlandi').length} tamamlandı
                  </span>
                )}
              </p>
              {bekleyenVar && !yukleniyor && (
                <button
                  onClick={() => setDosyalar([])}
                  className="text-xs cursor-pointer"
                  style={{ color: '#EF4444' }}
                >
                  Tümünü Temizle
                </button>
              )}
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {dosyalar.map(d => {
                const { icon, color } = getFileIcon(d.dosya.name);
                return (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                    style={{
                      background: d.durum === 'tamamlandi'
                        ? 'rgba(52,211,153,0.06)'
                        : d.durum === 'hata'
                        ? 'rgba(239,68,68,0.06)'
                        : d.durum === 'yukleniyor'
                        ? 'rgba(96,165,250,0.06)'
                        : 'var(--bg-item)',
                      border: `1px solid ${
                        d.durum === 'tamamlandi' ? 'rgba(52,211,153,0.2)'
                        : d.durum === 'hata' ? 'rgba(239,68,68,0.2)'
                        : d.durum === 'yukleniyor' ? 'rgba(96,165,250,0.2)'
                        : 'var(--bg-item-border)'
                      }`,
                    }}
                  >
                    {/* Dosya ikonu */}
                    <div className="w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0"
                      style={{ background: `${color}15` }}>
                      <i className={`${icon} text-base`} style={{ color }} />
                    </div>

                    {/* Dosya adı (düzenlenebilir) */}
                    <div className="flex-1 min-w-0">
                      {d.durum === 'bekliyor' ? (
                        <input
                          value={d.ad}
                          onChange={e => handleAdDegistir(d.id, e.target.value)}
                          className="text-xs font-medium w-full bg-transparent outline-none border-b"
                          style={{ color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}
                        />
                      ) : (
                        <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{d.ad}</p>
                      )}
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {formatSize(d.dosya.size)}
                        {d.hata && <span style={{ color: '#EF4444' }}> • {d.hata}</span>}
                      </p>
                    </div>

                    {/* Durum ikonu */}
                    <div className="flex-shrink-0">
                      {d.durum === 'bekliyor' && !yukleniyor && (
                        <button
                          onClick={() => handleDosyaSil(d.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer"
                          style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}
                        >
                          <i className="ri-close-line text-xs" />
                        </button>
                      )}
                      {d.durum === 'yukleniyor' && (
                        <div className="w-7 h-7 flex items-center justify-center">
                          <i className="ri-loader-4-line animate-spin text-sm" style={{ color: '#60A5FA' }} />
                        </div>
                      )}
                      {d.durum === 'tamamlandi' && (
                        <div className="w-7 h-7 flex items-center justify-center rounded-lg"
                          style={{ background: 'rgba(52,211,153,0.15)' }}>
                          <i className="ri-check-line text-sm" style={{ color: '#34D399' }} />
                        </div>
                      )}
                      {d.durum === 'hata' && (
                        <div className="w-7 h-7 flex items-center justify-center rounded-lg"
                          style={{ background: 'rgba(239,68,68,0.15)' }}>
                          <i className="ri-close-line text-sm" style={{ color: '#EF4444' }} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tamamlandı mesajı */}
        {tumTamamlandi && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)' }}>
            <i className="ri-checkbox-circle-fill text-lg flex-shrink-0" style={{ color: '#34D399' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: '#34D399' }}>Tüm dosyalar başarıyla yüklendi!</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {dosyalar.length} dosya • {firmalar.find(f => f.id === firmaId)?.ad} • {izinTuru}
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
