import { useState, useMemo } from 'react';
import { useApp } from '@/store/AppContext';
import Modal from '@/components/base/Modal';
import DocStatsCards from './components/DocStatsCards';
import DocTable from './components/DocTable';
import DocFormModal, { DOCUMENT_TYPES } from './components/DocFormModal';
import { useCompanyDocuments } from './hooks/useCompanyDocuments';
import type { CompanyDocument } from '@/types';

export default function FirmaEvraklariPage() {
  const { firmalar, org, addToast } = useApp();

  const { documents, loading, addDocument, updateDocument, deleteDocument, uploadFile } = useCompanyDocuments({
    organizationId: org?.id ?? null,
  });

  const [search, setSearch] = useState('');
  const [firmaFilter, setFirmaFilter] = useState('');
  const [turFilter, setTurFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<CompanyDocument | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<CompanyDocument | null>(null);
  const [viewDoc, setViewDoc] = useState<CompanyDocument | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return documents.filter(d => {
      const firma = firmalar.find(f => f.id === d.company_id);
      const matchSearch = !q || d.title.toLowerCase().includes(q) || d.document_type.toLowerCase().includes(q) || (firma?.ad.toLowerCase().includes(q) ?? false);
      const matchFirma = !firmaFilter || d.company_id === firmaFilter;
      const matchTur = !turFilter || d.document_type === turFilter;
      const matchStatus = !statusFilter || d.status === statusFilter;
      return matchSearch && matchFirma && matchTur && matchStatus;
    });
  }, [documents, firmalar, search, firmaFilter, turFilter, statusFilter]);

  const openAdd = () => { setEditDoc(null); setFormOpen(true); };
  const openEdit = (doc: CompanyDocument) => { setEditDoc(doc); setFormOpen(true); };

  const handleSave = async (formData: Parameters<typeof DocFormModal>[0]['onSave'] extends (d: infer D) => unknown ? D : never) => {
    if (!org?.id) return;
    setSaving(true);
    try {
      let fileUrl = editDoc?.file_url ?? null;
      let fileName = editDoc?.file_name ?? null;
      let fileSize = editDoc?.file_size ?? 0;
      let fileType = editDoc?.file_type ?? null;

      if (formData.file) {
        const { url, error: uploadErr } = await uploadFile(formData.file, org.id);
        if (uploadErr) { addToast(`Dosya yüklenemedi: ${uploadErr}`, 'error'); setSaving(false); return; }
        fileUrl = url;
        fileName = formData.file.name;
        fileSize = formData.file.size;
        fileType = formData.file.type;
      }

      const resolvedType = formData.document_type === 'Diğer' && formData.custom_type.trim()
        ? formData.custom_type.trim()
        : formData.document_type;

      const payload = {
        organization_id: org.id,
        company_id: formData.company_id || null,
        title: formData.title.trim(),
        document_type: resolvedType,
        description: formData.description,
        version: formData.version,
        valid_from: formData.valid_from || null,
        valid_until: formData.valid_until || null,
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize,
        file_type: fileType,
        created_by: null,
      };

      if (editDoc) {
        const { error } = await updateDocument(editDoc.id, payload);
        if (error) { addToast(`Güncellenemedi: ${error}`, 'error'); return; }
        addToast('Evrak güncellendi.', 'success');
      } else {
        const { error } = await addDocument(payload);
        if (error) { addToast(`Eklenemedi: ${error}`, 'error'); return; }
        addToast('Evrak eklendi.', 'success');
      }
      setFormOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDoc) return;
    setDeleting(true);
    const { error } = await deleteDocument(deleteDoc.id);
    setDeleting(false);
    if (error) { addToast(`Silinemedi: ${error}`, 'error'); return; }
    addToast('Evrak silindi.', 'success');
    setDeleteDoc(null);
  };

  // Dinamik tür listesi: sabit liste + mevcut verilerdeki özel türler
  const allTypes = useMemo(() => {
    const fromDocs = documents.map(d => d.document_type).filter(t => !DOCUMENT_TYPES.includes(t));
    return [...new Set([...DOCUMENT_TYPES.filter(t => t !== 'Diğer'), ...fromDocs])];
  }, [documents]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Firma Evrakları</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Firmalara ait tüm evrakları merkezi olarak yönetin
          </p>
        </div>
        <button onClick={openAdd} className="btn-primary whitespace-nowrap self-start sm:self-auto">
          <i className="ri-add-line text-base" />Evrak Ekle
        </button>
      </div>

      {/* Stats */}
      <DocStatsCards documents={documents} />

      {/* Filters */}
      <div className="isg-card rounded-xl p-4 flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Evrak adı, tür veya firma ara..."
            className="isg-input pl-9"
          />
        </div>
        <select value={firmaFilter} onChange={e => setFirmaFilter(e.target.value)} className="isg-input" style={{ minWidth: '160px' }}>
          <option value="">Tüm Firmalar</option>
          {firmalar.filter(f => !f.silinmis).map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
        </select>
        <select value={turFilter} onChange={e => setTurFilter(e.target.value)} className="isg-input" style={{ minWidth: '180px' }}>
          <option value="">Tüm Türler</option>
          {allTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="isg-input" style={{ minWidth: '150px' }}>
          <option value="">Tüm Durumlar</option>
          <option value="Aktif">Aktif</option>
          <option value="Yaklaşan">Yaklaşan</option>
          <option value="Süresi Dolmuş">Süresi Dolmuş</option>
        </select>
        {(search || firmaFilter || turFilter || statusFilter) && (
          <button onClick={() => { setSearch(''); setFirmaFilter(''); setTurFilter(''); setStatusFilter(''); }} className="btn-secondary whitespace-nowrap">
            <i className="ri-filter-off-line" /> Temizle
          </button>
        )}
      </div>

      {/* Loading */}
      {loading ? (
        <div className="isg-card rounded-xl py-20 text-center">
          <i className="ri-loader-4-line text-3xl animate-spin" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm mt-3" style={{ color: 'var(--text-muted)' }}>Yükleniyor...</p>
        </div>
      ) : (
        <DocTable
          documents={filtered}
          firmalar={firmalar}
          onEdit={openEdit}
          onDelete={setDeleteDoc}
          onView={setViewDoc}
        />
      )}

      {/* Form Modal */}
      <DocFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        editDoc={editDoc}
        firmalar={firmalar}
        saving={saving}
      />

      {/* Delete Confirm */}
      <Modal
        isOpen={!!deleteDoc}
        onClose={() => setDeleteDoc(null)}
        title="Evrakı Sil"
        size="sm"
        icon="ri-delete-bin-line"
        footer={
          <>
            <button onClick={() => setDeleteDoc(null)} className="btn-secondary whitespace-nowrap">İptal</button>
            <button onClick={handleDelete} disabled={deleting} className="btn-danger whitespace-nowrap disabled:opacity-50">
              {deleting ? <><i className="ri-loader-4-line animate-spin" /> Siliniyor...</> : 'Evet, Sil'}
            </button>
          </>
        }
      >
        <div className="py-2">
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl mb-4" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <i className="ri-error-warning-line text-xl" style={{ color: '#EF4444' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            <strong>"{deleteDoc?.title}"</strong> evrakını silmek istediğinizden emin misiniz?
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Bu işlem geri alınamaz.</p>
        </div>
      </Modal>

      {/* View Modal */}
      {viewDoc && (
        <Modal
          isOpen={!!viewDoc}
          onClose={() => setViewDoc(null)}
          title={viewDoc.title}
          size="md"
          icon="ri-file-text-line"
          footer={
            <div className="flex gap-2">
              {viewDoc.file_url && (
                <a href={viewDoc.file_url} target="_blank" rel="noopener noreferrer" className="btn-secondary whitespace-nowrap">
                  <i className="ri-external-link-line" /> Dosyayı Aç
                </a>
              )}
              <button onClick={() => { setViewDoc(null); openEdit(viewDoc); }} className="btn-primary whitespace-nowrap">
                <i className="ri-edit-line" /> Düzenle
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            {[
              { label: 'Evrak Türü', value: viewDoc.document_type },
              { label: 'Firma', value: firmalar.find(f => f.id === viewDoc.company_id)?.ad ?? '—' },
              { label: 'Versiyon', value: viewDoc.version || '—' },
              { label: 'Geçerlilik Başlangıcı', value: viewDoc.valid_from ? new Date(viewDoc.valid_from).toLocaleDateString('tr-TR') : '—' },
              { label: 'Geçerlilik Bitişi', value: viewDoc.valid_until ? new Date(viewDoc.valid_until).toLocaleDateString('tr-TR') : '—' },
              { label: 'Eklenme Tarihi', value: new Date(viewDoc.created_at).toLocaleDateString('tr-TR') },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-2.5 px-3 rounded-xl" style={{ background: 'var(--bg-item)', border: '1px solid var(--bg-item-border)' }}>
                <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.value}</span>
              </div>
            ))}
            {viewDoc.description && (
              <div className="py-2.5 px-3 rounded-xl" style={{ background: 'var(--bg-item)', border: '1px solid var(--bg-item-border)' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Açıklama</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{viewDoc.description}</p>
              </div>
            )}
            {viewDoc.file_name && (
              <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
                <i className="ri-file-check-line text-lg" style={{ color: '#34D399' }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{viewDoc.file_name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{viewDoc.file_size ? `${(viewDoc.file_size / 1024).toFixed(1)} KB` : ''}</p>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
