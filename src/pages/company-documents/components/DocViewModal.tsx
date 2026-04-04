import { useState, useEffect } from 'react';
import Modal from '@/components/base/Modal';
import type { CompanyDocument } from '@/types';
import type { Firma } from '@/types';
import { getSignedUrlFromPath } from '@/utils/fileUpload';

interface Props {
  doc: CompanyDocument | null;
  firmalar: Firma[];
  onClose: () => void;
  onEdit: (doc: CompanyDocument) => void;
}

const STATUS_CFG = {
  'Aktif': { color: '#34D399', bg: 'rgba(52,211,153,0.12)', icon: 'ri-checkbox-circle-line' },
  'Süresi Dolmuş': { color: '#F87171', bg: 'rgba(248,113,113,0.12)', icon: 'ri-close-circle-line' },
  'Yaklaşan': { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)', icon: 'ri-time-line' },
};

function isPdf(url: string | null) {
  if (!url) return false;
  return url.toLowerCase().includes('.pdf') || url.toLowerCase().includes('pdf');
}

function isImage(url: string | null) {
  if (!url) return false;
  return /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url);
}

export default function DocViewModal({ doc, firmalar, onClose, onEdit }: Props) {
  const sc = doc ? (STATUS_CFG[doc.status] ?? STATUS_CFG['Aktif']) : STATUS_CFG['Aktif'];
  const firma = doc ? firmalar.find(f => f.id === doc.company_id) : undefined;

  // Signed URL state — hooks must be called unconditionally
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!doc?.file_url) { setResolvedUrl(null); return; }
    getSignedUrlFromPath(doc.file_url).then(url => setResolvedUrl(url));
  }, [doc?.file_url]);

  if (!doc) return null;

  const handleDownload = async () => {
    if (!resolvedUrl) return;
    try {
      const res = await fetch(resolvedUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name ?? 'evrak';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      if (resolvedUrl) window.open(resolvedUrl, '_blank');
    }
  };

  return (
    <Modal
      isOpen={!!doc}
      onClose={onClose}
      title={doc.title}
      size="xl"
      icon="ri-file-text-line"
      footer={
        <div className="flex gap-2 flex-wrap">
          {resolvedUrl && (
            <>
              <button onClick={handleDownload} className="btn-secondary whitespace-nowrap">
                <i className="ri-download-2-line" /> İndir
              </button>
              <a href={resolvedUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary whitespace-nowrap">
                <i className="ri-external-link-line" /> Yeni Sekmede Aç
              </a>
            </>
          )}
          <button onClick={() => { onClose(); onEdit(doc); }} className="btn-primary whitespace-nowrap">
            <i className="ri-edit-line" /> Düzenle
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: sc.bg, color: sc.color }}>
            <i className={sc.icon} />{doc.status}
          </span>
          <span className="text-xs px-2.5 py-1.5 rounded-lg font-medium" style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)' }}>
            {doc.document_type}
          </span>
          {doc.version && (
            <span className="text-xs px-2.5 py-1.5 rounded-lg font-mono" style={{ background: 'var(--bg-item)', color: 'var(--text-muted)', border: '1px solid var(--bg-item-border)' }}>
              {doc.version}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Firma', value: firma?.ad ?? '—', icon: 'ri-building-line' },
            { label: 'Eklenme', value: new Date(doc.created_at).toLocaleDateString('tr-TR'), icon: 'ri-calendar-line' },
            { label: 'Geçerlilik Başlangıcı', value: doc.valid_from ? new Date(doc.valid_from).toLocaleDateString('tr-TR') : '—', icon: 'ri-calendar-check-line' },
            { label: 'Geçerlilik Bitişi', value: doc.valid_until ? new Date(doc.valid_until).toLocaleDateString('tr-TR') : '—', icon: 'ri-calendar-close-line' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2.5 py-2.5 px-3 rounded-xl" style={{ background: 'var(--bg-item)', border: '1px solid var(--bg-item-border)' }}>
              <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'rgba(99,102,241,0.1)' }}>
                <i className={`${item.icon} text-sm`} style={{ color: '#818CF8' }} />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>{item.label}</p>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.value}</p>
              </div>
            </div>
          ))}
        </div>

        {doc.description && (
          <div className="py-3 px-4 rounded-xl" style={{ background: 'var(--bg-item)', border: '1px solid var(--bg-item-border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>Açıklama</p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{doc.description}</p>
          </div>
        )}

        {resolvedUrl && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--bg-item-border)' }}>
            <div className="flex items-center justify-between px-4 py-2.5" style={{ background: 'var(--bg-item)', borderBottom: '1px solid var(--bg-item-border)' }}>
              <div className="flex items-center gap-2">
                <i className="ri-file-line text-sm" style={{ color: 'var(--text-muted)' }} />
                <span className="text-sm font-medium truncate max-w-[300px]" style={{ color: 'var(--text-primary)' }}>{doc.file_name ?? 'Dosya'}</span>
                {doc.file_size ? <span className="text-xs" style={{ color: 'var(--text-faint)' }}>({(doc.file_size / 1024).toFixed(1)} KB)</span> : null}
              </div>
              <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all" style={{ background: 'rgba(52,211,153,0.1)', color: '#34D399', border: '1px solid rgba(52,211,153,0.2)' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.2)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.1)'; }}>
                <i className="ri-download-2-line" /> İndir
              </button>
            </div>
            {isPdf(resolvedUrl) && (
              <div className="w-full" style={{ height: '420px' }}>
                <iframe src={`${resolvedUrl}#toolbar=1&navpanes=0`} className="w-full h-full" title={doc.title} style={{ border: 'none' }} />
              </div>
            )}
            {isImage(resolvedUrl) && (
              <div className="flex items-center justify-center p-4" style={{ background: 'var(--bg-main)', minHeight: '200px' }}>
                <img src={resolvedUrl} alt={doc.title} className="max-w-full max-h-96 rounded-lg object-contain" />
              </div>
            )}
            {!isPdf(resolvedUrl) && !isImage(resolvedUrl) && (
              <div className="flex flex-col items-center justify-center py-10 gap-3" style={{ background: 'var(--bg-main)' }}>
                <div className="w-14 h-14 flex items-center justify-center rounded-2xl" style={{ background: 'rgba(99,102,241,0.1)' }}>
                  <i className="ri-file-word-line text-3xl" style={{ color: '#818CF8' }} />
                </div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Bu dosya türü tarayıcıda önizlenemiyor</p>
                <button onClick={handleDownload} className="btn-primary text-sm whitespace-nowrap"><i className="ri-download-2-line" /> Dosyayı İndir</button>
              </div>
            )}
          </div>
        )}

        {!doc.file_url && (
          <div className="flex items-center gap-3 py-3 px-4 rounded-xl" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
            <i className="ri-information-line text-lg" style={{ color: '#FBBF24' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Bu evrak için dosya eklenmemiş.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
