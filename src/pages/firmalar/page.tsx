import { useState, useMemo } from 'react';
import PageHeader from '@/components/base/PageHeader';
import StatusBadge from '@/components/base/StatusBadge';
import EmptyState from '@/components/base/EmptyState';
import Button from '@/components/base/Button';
import FirmDrawer from './components/FirmDrawer';
import AddFirmDrawer from './components/AddFirmDrawer';
import type { AppFirm } from '@/types/database';
import { useApp } from '@/store/AppContext';

interface ConfirmTrashModal {
  firmId: string;
  firmName: string;
}


const selectStyle: React.CSSProperties = {
  backgroundColor: 'var(--card)',
  border: '1px solid var(--border)',
  color: 'var(--text-secondary)',
  padding: '8px 12px',
  borderRadius: '8px',
  fontSize: '14px',
  outline: 'none',
  cursor: 'pointer',
};

export default function FirmalarPage() {
  const { firms, softDeleteFirm, showToast } = useApp();
  const [search, setSearch] = useState('');
  const [dangerFilter, setDangerFilter] = useState('');
  const [contractFilter, setContractFilter] = useState('');
  const [selectedFirm, setSelectedFirm] = useState<AppFirm | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [trashConfirm, setTrashConfirm] = useState<ConfirmTrashModal | null>(null);

  const handleSoftDelete = async (firmId: string) => {
    try {
      await softDeleteFirm(firmId);
      showToast('Firma çöp kutusuna taşındı');
      setTrashConfirm(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Silme başarısız', 'error');
    }
  };

  const filtered = useMemo(() => {
    return firms.filter((f) => {
      const q = search.toLowerCase();
      const matchSearch = !search || f.name.toLowerCase().includes(q) || f.contact.toLowerCase().includes(q);
      const matchDanger = !dangerFilter || f.dangerClass === dangerFilter;
      const matchContract = !contractFilter || f.contractStatus === contractFilter;
      return matchSearch && matchDanger && matchContract;
    });
  }, [firms, search, dangerFilter, contractFilter]);

  const hasFilters = search || dangerFilter || contractFilter;
  const currentSelectedFirm = selectedFirm ? firms.find((f) => f.id === selectedFirm.id) || null : null;

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Firmalar"
        description="Firma kayıtları, sözleşmeler ve konum bilgileri"
        action={
          <Button variant="primary" icon="ri-add-line" onClick={() => setAddOpen(true)}>
            Yeni Firma
          </Button>
        }
      />

      {firms.length > 0 && (
        <div className="filter-bar flex-wrap gap-2">
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <div className="w-4 h-4 flex items-center justify-center absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
              <i className="ri-search-line text-sm" />
            </div>
            <input
              type="text"
              placeholder="Firma veya yetkili ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg outline-none transition-colors"
              style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
          </div>
          <select style={selectStyle} value={dangerFilter} onChange={(e) => setDangerFilter(e.target.value)}>
            <option value="">Tüm Tehlike Sınıfları</option>
            <option>Az Tehlikeli</option><option>Tehlikeli</option><option>Çok Tehlikeli</option>
          </select>
          <select style={selectStyle} value={contractFilter} onChange={(e) => setContractFilter(e.target.value)}>
            <option value="">Tüm Sözleşmeler</option>
            <option>Aktif</option><option>Yenileme Bekliyor</option><option>Süresi Dolmuş</option>
          </select>
          {hasFilters && (
            <button onClick={() => { setSearch(''); setDangerFilter(''); setContractFilter(''); }}
              className="text-xs cursor-pointer whitespace-nowrap transition-colors" style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >Filtreleri Temizle</button>
          )}
        </div>
      )}

      {/* Desktop Table */}
      <div className="table-wrap hidden md:block">
        {firms.length === 0 ? (
          <EmptyState icon="ri-building-2-line" title="Henüz firma eklenmedi" description="Hizmet verdiğiniz firmaları sisteme ekleyerek sözleşme ve ziyaret takibine başlayın." actionLabel="Yeni Firma Ekle" onAction={() => setAddOpen(true)} />
        ) : filtered.length === 0 ? (
          <EmptyState icon="ri-search-line" title="Sonuç bulunamadı" description="Arama veya filtre kriterlerinizi değiştirmeyi deneyin." actionLabel="Filtreleri Temizle" onAction={() => { setSearch(''); setDangerFilter(''); setContractFilter(''); }} />
        ) : (
          <table className="w-full">
            <thead className="table-head">
              <tr>{['Firma Adı', 'Yetkili', 'Telefon', 'Tehlike Sınıfı', 'Sözleşme', 'Doğrulama', 'Durum', ''].map((col) => <th key={col}>{col}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map((firm) => (
                <tr key={firm.id} className="table-row" onClick={() => setSelectedFirm(firm)}>
                  <td className="table-cell-primary">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <i className="ri-building-2-line text-sm" style={{ color: 'var(--text-muted)' }} />
                      </div>
                      <div>
                        <p className="text-sm font-medium whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{firm.name}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{firm.sector}</p>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell whitespace-nowrap">{firm.contact}</td>
                  <td className="table-cell whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{firm.phone}</td>
                  <td className="table-cell"><StatusBadge status={firm.dangerClass} /></td>
                  <td className="table-cell"><StatusBadge status={firm.contractStatus} /></td>
                  <td className="table-cell">
                    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <i className={firm.verificationType === 'qr_gprs' ? 'ri-map-pin-line' : 'ri-qr-code-line'} />
                      {firm.verificationType === 'qr_gprs' ? 'QR+GPRS' : 'QR'}
                    </span>
                  </td>
                  <td className="table-cell"><StatusBadge status={firm.status} /></td>
                  <td className="table-cell" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); setSelectedFirm(firm); }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer" style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                        title="Detay"
                      ><i className="ri-eye-line text-sm" /></button>
                      <button onClick={(e) => { e.stopPropagation(); setTrashConfirm({ firmId: firm.id, firmName: firm.name }); }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer" style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--danger-bg)'; e.currentTarget.style.color = 'var(--danger)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                        title="Çöp Kutusuna Taşı"
                      ><i className="ri-delete-bin-line text-sm" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Mobile Card List */}
      <div className="md:hidden space-y-2 mt-2">
        {firms.length === 0 ? (
          <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
            <EmptyState icon="ri-building-2-line" title="Henüz firma eklenmedi" description="Hizmet verdiğiniz firmaları sisteme ekleyerek sözleşme ve ziyaret takibine başlayın." actionLabel="Yeni Firma Ekle" onAction={() => setAddOpen(true)} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
            <EmptyState icon="ri-search-line" title="Sonuç bulunamadı" description="Filtre kriterlerinizi değiştirmeyi deneyin." actionLabel="Temizle" onAction={() => { setSearch(''); setDangerFilter(''); setContractFilter(''); }} />
          </div>
        ) : (
          filtered.map((firm) => (
            <button
              key={firm.id}
              onClick={() => setSelectedFirm(firm)}
              className="w-full text-left rounded-xl p-4 transition-colors cursor-pointer"
              style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <i className="ri-building-2-line text-base" style={{ color: 'var(--text-muted)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{firm.name}</p>
                    <StatusBadge status={firm.status} />
                  </div>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{firm.sector} · {firm.contact}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={firm.dangerClass} />
                    <StatusBadge status={firm.contractStatus} />
                    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <i className={firm.verificationType === 'qr_gprs' ? 'ri-map-pin-line' : 'ri-qr-code-line'} />
                      {firm.verificationType === 'qr_gprs' ? 'QR+GPRS' : 'QR'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{firm.phone}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setTrashConfirm({ firmId: firm.id, firmName: firm.name }); }}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg cursor-pointer whitespace-nowrap"
                  style={{ color: 'var(--danger)', backgroundColor: 'var(--danger-bg)' }}
                >
                  <i className="ri-delete-bin-line text-xs" /> Sil
                </button>
              </div>
            </button>
          ))
        )}
      </div>

      <FirmDrawer open={!!currentSelectedFirm} onClose={() => setSelectedFirm(null)} firm={currentSelectedFirm} />
      <AddFirmDrawer open={addOpen} onClose={() => setAddOpen(false)} />

      {/* Çöp Kutusu Onay Modalı */}
      {trashConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="rounded-xl p-6 w-[360px] shadow-lg" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="w-10 h-10 flex items-center justify-center rounded-full mb-4" style={{ backgroundColor: 'var(--danger-bg)' }}>
              <i className="ri-delete-bin-line text-lg" style={{ color: 'var(--danger)' }} />
            </div>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Firmayı çöp kutusuna taşı</p>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              <strong>"{trashConfirm.firmName}"</strong> çöp kutusuna taşınacak. Ayarlar &gt; Çöp Kutusu bölümünden geri yükleyebilir veya kalıcı olarak silebilirsiniz.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setTrashConfirm(null)}
                className="flex-1 py-2 text-sm font-medium rounded-lg cursor-pointer whitespace-nowrap"
                style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}>
                İptal
              </button>
              <button onClick={() => handleSoftDelete(trashConfirm.firmId)}
                className="flex-1 py-2 text-sm font-medium rounded-lg cursor-pointer whitespace-nowrap"
                style={{ backgroundColor: 'var(--danger)', color: '#fff' }}>
                Çöp Kutusuna Taşı
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
