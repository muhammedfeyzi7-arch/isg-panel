import type { CompanyDocument } from '@/types';
import type { Firma } from '@/types';

const STATUS_CFG = {
  'Aktif': { color: '#34D399', bg: 'rgba(52,211,153,0.12)', icon: 'ri-checkbox-circle-line' },
  'Süresi Dolmuş': { color: '#F87171', bg: 'rgba(248,113,113,0.12)', icon: 'ri-close-circle-line' },
  'Yaklaşan': { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)', icon: 'ri-time-line' },
};

interface Props {
  documents: CompanyDocument[];
  firmalar: Firma[];
  onEdit: (doc: CompanyDocument) => void;
  onDelete: (doc: CompanyDocument) => void;
  onView: (doc: CompanyDocument) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
}

export default function DocTable({ documents, firmalar, onEdit, onDelete, onView, selectedIds, onToggleSelect, onToggleSelectAll }: Props) {
  const getFirmaAd = (id: string | null) => id ? (firmalar.find(f => f.id === id)?.ad ?? '—') : '—';
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('tr-TR') : '—';

  const getDaysLeft = (until: string | null) => {
    if (!until) return null;
    return Math.ceil((new Date(until).getTime() - Date.now()) / 86400000);
  };

  const allSelected = documents.length > 0 && selectedIds.size === documents.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < documents.length;

  if (documents.length === 0) {
    return (
      <div className="isg-card rounded-xl py-20 text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)' }}>
          <i className="ri-file-text-line text-3xl" style={{ color: '#60A5FA' }} />
        </div>
        <p className="font-semibold text-slate-400 text-base">Evrak bulunamadı</p>
        <p className="text-sm mt-2" style={{ color: '#475569' }}>Yeni evrak eklemek için butonu kullanın</p>
      </div>
    );
  }

  return (
    <div className="isg-card rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="table-premium w-full">
          <thead>
            <tr>
              <th className="w-10">
                <div className="w-5 h-5 flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected; }}
                    onChange={onToggleSelectAll}
                    className="w-4 h-4 rounded cursor-pointer accent-emerald-400"
                  />
                </div>
              </th>
              <th className="text-left">Evrak Başlığı</th>
              <th className="text-left hidden md:table-cell">Tür</th>
              <th className="text-left hidden md:table-cell">Firma</th>
              <th className="text-left hidden lg:table-cell">Geçerlilik</th>
              <th className="text-left hidden lg:table-cell">Versiyon</th>
              <th className="text-left">Durum</th>
              <th className="text-right w-32">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {documents.map(doc => {
              const sc = STATUS_CFG[doc.status] ?? STATUS_CFG['Aktif'];
              const daysLeft = getDaysLeft(doc.valid_until);
              const isSelected = selectedIds.has(doc.id);
              return (
                <tr key={doc.id} style={isSelected ? { background: 'rgba(52,211,153,0.04)' } : {}}>
                  <td>
                    <div className="w-5 h-5 flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(doc.id)}
                        className="w-4 h-4 rounded cursor-pointer accent-emerald-400"
                      />
                    </div>
                  </td>
                  <td>
                    <div>
                      <button
                        onClick={() => onView(doc)}
                        className="text-sm font-semibold text-left hover:opacity-70 transition-opacity cursor-pointer block"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {doc.title}
                      </button>
                      {doc.description && (
                        <p className="text-xs mt-0.5 truncate max-w-[200px]" style={{ color: 'var(--text-muted)' }}>
                          {doc.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="hidden md:table-cell">
                    <span className="text-xs px-2 py-1 rounded-lg font-medium" style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)' }}>
                      {doc.document_type}
                    </span>
                  </td>
                  <td className="hidden md:table-cell">
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{getFirmaAd(doc.company_id)}</span>
                  </td>
                  <td className="hidden lg:table-cell">
                    <div>
                      <span className="text-sm" style={{ color: daysLeft !== null && daysLeft < 0 ? '#F87171' : daysLeft !== null && daysLeft <= 30 ? '#FBBF24' : 'var(--text-muted)' }}>
                        {fmtDate(doc.valid_until)}
                      </span>
                      {daysLeft !== null && daysLeft >= 0 && daysLeft <= 30 && (
                        <p className="text-[10px] mt-0.5" style={{ color: '#FBBF24' }}>{daysLeft} gün kaldı</p>
                      )}
                      {daysLeft !== null && daysLeft < 0 && (
                        <p className="text-[10px] mt-0.5" style={{ color: '#F87171' }}>Gecikmiş!</p>
                      )}
                    </div>
                  </td>
                  <td className="hidden lg:table-cell">
                    <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{doc.version || '—'}</span>
                  </td>
                  <td>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap" style={{ background: sc.bg, color: sc.color }}>
                      <i className={sc.icon} />{doc.status}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1 justify-end">
                      {doc.file_url && (
                        <button
                          onClick={() => onView(doc)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200"
                          style={{ background: 'rgba(52,211,153,0.1)', color: '#34D399' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.2)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.1)'; }}
                          title="Görüntüle / İndir"
                        >
                          <i className="ri-eye-line text-sm" />
                        </button>
                      )}
                      <button
                        onClick={() => onEdit(doc)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200"
                        style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.2)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.1)'; }}
                        title="Düzenle"
                      >
                        <i className="ri-edit-line text-sm" />
                      </button>
                      <button
                        onClick={() => onDelete(doc)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200"
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
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
