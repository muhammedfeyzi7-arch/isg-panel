import Drawer from '@/components/base/Drawer';
import Button from '@/components/base/Button';
import type { DofRow } from '@/services/specialistService';

interface Props {
  record: DofRow;
  onClose: () => void;
  onCloseRequest: (r: DofRow) => void;
  onDelete: (id: string) => void;
}

const statusConfig = {
  open: { label: 'Açık', bg: '#fef3c7', text: '#92400e', dot: '#d97706' },
  closed: { label: 'Kapandı', bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
  critical: { label: 'Kritik', bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{value || '—'}</p>
    </div>
  );
}

export default function DofDetailDrawer({ record, onClose, onCloseRequest, onDelete }: Props) {
  const cfg = statusConfig[record.status];
  const isOpen = record.status !== 'closed';

  return (
    <Drawer
      open
      onClose={onClose}
      title="DÖF Detayı"
      width="w-[540px]"
      footer={
        <>
          <button
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap"
            style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)' }}
            onClick={() => onDelete(record.id)}
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-delete-bin-line text-sm" />
            </div>
            Sil
          </button>
          {isOpen && (
            <button
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap"
              style={{ backgroundColor: '#d1fae5', color: '#065f46' }}
              onClick={() => onCloseRequest(record)}
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-checkbox-circle-line text-sm" />
              </div>
              DÖF Kapat
            </button>
          )}
          <Button variant="secondary" className="flex-1" onClick={onClose}>Kapat</Button>
        </>
      }
    >
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-mono font-semibold mb-1" style={{ color: 'var(--primary)' }}>{record.dof_no}</p>
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{record.title}</h3>
          </div>
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap flex-shrink-0"
            style={{ backgroundColor: cfg.bg, color: cfg.text }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.dot }} />
            {cfg.label}
          </span>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Firma" value={record.firm?.name ?? '—'} />
          <Field label="İlgili Personel" value={record.personnel?.full_name ?? '—'} />
          <Field label="Tespit Tarihi" value={new Date(record.detection_date).toLocaleDateString('tr-TR')} />
          <Field label="Hedef Kapatma" value={new Date(record.target_close_date).toLocaleDateString('tr-TR')} />
          <Field label="Sorumlu Kişi" value={record.responsible_person} />
          {record.closed_at && (
            <Field label="Kapanış Tarihi" value={new Date(record.closed_at).toLocaleDateString('tr-TR')} />
          )}
        </div>

        {/* Açıklama */}
        <div>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Uygunsuzluk Açıklaması</p>
          <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
            {record.description}
          </div>
        </div>

        {/* Önlem */}
        <div>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Alınması Gereken Önlem</p>
          <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
            {record.action_required}
          </div>
        </div>

        {/* Fotoğraflar */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Açılış Fotoğrafı</p>
            {record.opening_photo_url ? (
              <a href={record.opening_photo_url} target="_blank" rel="noopener noreferrer">
                <div className="w-full h-32 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  <img src={record.opening_photo_url} alt="Açılış" className="w-full h-full object-cover" />
                </div>
              </a>
            ) : (
              <div className="w-full h-32 rounded-lg flex flex-col items-center justify-center gap-1" style={{ backgroundColor: 'var(--surface)', border: '1px dashed var(--border)' }}>
                <i className="ri-image-line text-2xl" style={{ color: 'var(--text-muted)' }} />
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Fotoğraf yok</p>
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Kapanış Fotoğrafı</p>
            {record.closing_photo_url ? (
              <a href={record.closing_photo_url} target="_blank" rel="noopener noreferrer">
                <div className="w-full h-32 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  <img src={record.closing_photo_url} alt="Kapanış" className="w-full h-full object-cover" />
                </div>
              </a>
            ) : (
              <div className="w-full h-32 rounded-lg flex flex-col items-center justify-center gap-1" style={{ backgroundColor: 'var(--surface)', border: '1px dashed var(--border)' }}>
                <i className="ri-image-line text-2xl" style={{ color: 'var(--text-muted)' }} />
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {isOpen ? 'Kapanışta eklenecek' : 'Fotoğraf yok'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Kapama Notu */}
        {record.closing_note && (
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Kapama Açıklaması</p>
            <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: '#d1fae5', color: '#065f46', border: '1px solid rgba(16,185,129,0.2)' }}>
              {record.closing_note}
            </div>
          </div>
        )}

        {/* Meta */}
        <div className="pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Oluşturulma: {new Date(record.created_at).toLocaleString('tr-TR')}
          </p>
        </div>
      </div>
    </Drawer>
  );
}
