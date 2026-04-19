import type { DofRow } from '@/services/specialistService';

interface Props {
  records: DofRow[];
  onDetail: (r: DofRow) => void;
  onDelete: (id: string) => void;
  onClose: (r: DofRow) => void;
  onEdit: (r: DofRow) => void;
}

const statusConfig = {
  open: { label: 'Açık', bg: '#fef3c7', text: '#92400e', dot: '#d97706' },
  closed: { label: 'Kapandı', bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
  critical: { label: 'Kritik', bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
};

export default function DofTable({ records, onDetail, onDelete, onClose, onEdit }: Props) {
  const headers = [
    'No', 'DÖF No', 'Başlık', 'Açıklama', 'A. Foto', 'Firma', 'Personel', 'Tarih', 'Durum', 'K. Foto', 'İşlem'
  ];

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px]">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface)' }}>
              {headers.map((h) => (
                <th
                  key={h}
                  className="px-3 py-3 text-left text-xs font-semibold whitespace-nowrap"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((r, idx) => {
              const cfg = statusConfig[r.status];
              const isOpen = r.status !== 'closed';
              return (
                <tr
                  key={r.id}
                  className="cursor-pointer transition-colors"
                  style={{ borderBottom: idx < records.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  onClick={() => onDetail(r)}
                >
                  {/* No */}
                  <td className="px-3 py-3">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{idx + 1}</span>
                  </td>

                  {/* DÖF No */}
                  <td className="px-3 py-3">
                    <span className="text-xs font-mono font-semibold whitespace-nowrap" style={{ color: 'var(--primary)' }}>
                      {r.dof_no}
                    </span>
                  </td>

                  {/* Başlık */}
                  <td className="px-3 py-3">
                    <p className="text-sm font-medium whitespace-nowrap max-w-[150px] truncate" style={{ color: 'var(--text-primary)' }}>
                      {r.title}
                    </p>
                  </td>

                  {/* Açıklama */}
                  <td className="px-3 py-3">
                    <p className="text-xs max-w-[180px] truncate" style={{ color: 'var(--text-muted)' }}>
                      {r.description}
                    </p>
                  </td>

                  {/* Açılış Foto */}
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    {r.opening_photo_url ? (
                      <a href={r.opening_photo_url} target="_blank" rel="noopener noreferrer">
                        <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0" style={{ border: '1px solid var(--border)' }}>
                          <img src={r.opening_photo_url} alt="Açılış" className="w-full h-full object-cover" />
                        </div>
                      </a>
                    ) : (
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <i className="ri-image-line text-sm" style={{ color: 'var(--text-muted)' }} />
                      </div>
                    )}
                  </td>

                  {/* Firma */}
                  <td className="px-3 py-3">
                    <span className="text-sm whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                      {r.firm?.name ?? '—'}
                    </span>
                  </td>

                  {/* Personel */}
                  <td className="px-3 py-3">
                    <span className="text-sm whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                      {r.personnel?.full_name ?? '—'}
                    </span>
                  </td>

                  {/* Tarih */}
                  <td className="px-3 py-3">
                    <span className="text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                      {new Date(r.detection_date).toLocaleDateString('tr-TR')}
                    </span>
                  </td>

                  {/* Durum */}
                  <td className="px-3 py-3">
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap"
                      style={{ backgroundColor: cfg.bg, color: cfg.text }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.dot }} />
                      {cfg.label}
                    </span>
                  </td>

                  {/* Kapanış Foto */}
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    {r.closing_photo_url ? (
                      <a href={r.closing_photo_url} target="_blank" rel="noopener noreferrer">
                        <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0" style={{ border: '1px solid var(--border)' }}>
                          <img src={r.closing_photo_url} alt="Kapanış" className="w-full h-full object-cover" />
                        </div>
                      </a>
                    ) : (
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <i className="ri-image-line text-sm" style={{ color: 'var(--text-muted)' }} />
                      </div>
                    )}
                  </td>

                  {/* İşlem */}
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      {/* Kapat butonu — sadece açık/kritik olanlarda */}
                      {isOpen && (
                        <button
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium cursor-pointer whitespace-nowrap transition-colors"
                          style={{ backgroundColor: '#d1fae5', color: '#065f46' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#a7f3d0')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#d1fae5')}
                          onClick={() => onClose(r)}
                          title="DÖF Kapat"
                        >
                          <div className="w-3 h-3 flex items-center justify-center">
                            <i className="ri-checkbox-circle-line text-xs" />
                          </div>
                          Kapat
                        </button>
                      )}
                      {/* Düzenle */}
                      <button
                        className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface)'; e.currentTarget.style.color = 'var(--primary)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                        onClick={() => onEdit(r)}
                        title="Düzenle"
                      >
                        <i className="ri-pencil-line text-sm" />
                      </button>
                      {/* Detay */}
                      <button
                        className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        onClick={() => onDetail(r)}
                        title="Detay"
                      >
                        <i className="ri-eye-line text-sm" />
                      </button>
                      {/* Sil */}
                      <button
                        className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors"
                        style={{ color: 'var(--danger)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--danger-bg)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        onClick={() => onDelete(r.id)}
                        title="Sil"
                      >
                        <i className="ri-delete-bin-line text-sm" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
