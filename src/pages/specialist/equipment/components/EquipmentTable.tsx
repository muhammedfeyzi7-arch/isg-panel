import type { EquipmentRow } from '@/services/specialistService';

interface Props {
  equipmentList: EquipmentRow[];
  deleteConfirm: string | null;
  onEdit: (e: EquipmentRow) => void;
  onDetail: (e: EquipmentRow) => void;
  onDeleteConfirm: (id: string | null) => void;
  onDelete: (id: string) => void;
}

function StatusPill({ status }: { status: string }) {
  const isOk = status === 'Uygun';
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap"
      style={{
        backgroundColor: isOk ? '#16A34A' : '#DC2626',
        color: '#fff',
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-white/70 flex-shrink-0" />
      {status}
    </span>
  );
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('tr-TR');
}

function isUpcoming(d: string | null) {
  if (!d) return false;
  const date = new Date(d);
  const today = new Date();
  const in30 = new Date();
  in30.setDate(today.getDate() + 30);
  return date >= today && date <= in30;
}

export default function EquipmentTable({
  equipmentList, deleteConfirm, onEdit, onDetail, onDeleteConfirm, onDelete,
}: Props) {
  const headers = ['Ekipman', 'Tür', 'Firma', 'Alan', 'Seri No', 'Son Kontrol', 'Sonraki Kontrol', 'Durum', ''];

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
      <table className="w-full">
        <thead className="table-head">
          <tr>
            {headers.map((h) => (
              <th key={h} className="text-left px-4 py-3 text-xs font-semibold whitespace-nowrap"
                style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {equipmentList.map((e, i) => (
            <tr
              key={e.id}
              className="transition-colors"
              style={{ borderBottom: i < equipmentList.length - 1 ? '1px solid var(--border)' : 'none' }}
            >
              {/* Ekipman */}
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
                    style={{ backgroundColor: '#EEF2FF' }}
                  >
                    <i className="ri-tools-line text-sm" style={{ color: '#6366F1' }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{e.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{e.category}</p>
                  </div>
                </div>
              </td>
              {/* Tür */}
              <td className="px-4 py-3">
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{e.equipment_type ?? '—'}</span>
              </td>
              {/* Firma */}
              <td className="px-4 py-3">
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{e.firm?.name ?? '—'}</span>
              </td>
              {/* Alan */}
              <td className="px-4 py-3">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{e.area ?? '—'}</span>
              </td>
              {/* Seri No */}
              <td className="px-4 py-3">
                <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{e.serial_no ?? '—'}</span>
              </td>
              {/* Son Kontrol */}
              <td className="px-4 py-3">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(e.last_control_date)}</span>
              </td>
              {/* Sonraki Kontrol */}
              <td className="px-4 py-3">
                <span
                  className="text-xs font-medium"
                  style={{ color: isUpcoming(e.next_control_date) ? '#D97706' : 'var(--text-muted)' }}
                >
                  {isUpcoming(e.next_control_date) && <i className="ri-alarm-warning-line mr-1" />}
                  {formatDate(e.next_control_date)}
                </span>
              </td>
              {/* Durum */}
              <td className="px-4 py-3">
                <StatusPill status={e.status} />
              </td>
              {/* Aksiyonlar */}
              <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onDetail(e)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    title="Detaylar"
                    onMouseEnter={(ev) => (ev.currentTarget.style.backgroundColor = 'var(--surface)')}
                    onMouseLeave={(ev) => (ev.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <i className="ri-eye-line text-xs" />
                  </button>
                  <button
                    onClick={() => onEdit(e)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    title="Düzenle"
                    onMouseEnter={(ev) => (ev.currentTarget.style.backgroundColor = 'var(--surface)')}
                    onMouseLeave={(ev) => (ev.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <i className="ri-edit-line text-xs" />
                  </button>
                  {deleteConfirm === e.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onDelete(e.id)}
                        className="text-xs px-2 py-0.5 rounded cursor-pointer whitespace-nowrap"
                        style={{ backgroundColor: '#DC2626', color: '#fff' }}
                      >
                        Sil
                      </button>
                      <button
                        onClick={() => onDeleteConfirm(null)}
                        className="text-xs px-2 py-0.5 rounded cursor-pointer whitespace-nowrap"
                        style={{ backgroundColor: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                      >
                        İptal
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => onDeleteConfirm(e.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      title="Sil"
                      onMouseEnter={(ev) => (ev.currentTarget.style.backgroundColor = '#FEE2E2')}
                      onMouseLeave={(ev) => (ev.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <i className="ri-delete-bin-line text-xs" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
