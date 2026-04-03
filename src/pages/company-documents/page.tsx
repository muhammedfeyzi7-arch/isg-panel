import { useState, useMemo } from 'react';
import Modal from '@/components/base/Modal';
import { useApp } from '@/store/AppContext';
import DocStatsCards from './components/DocStatsCards';
import DocTable from './components/DocTable';
import DocFormModal, { DOCUMENT_TYPES } from './components/DocFormModal';
import DocViewModal from './components/DocViewModal';
import BulkDocUpload, { type BulkFile } from './components/BulkDocUpload';
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
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<CompanyDocument | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<CompanyDocument | null>(null);
  const [viewDoc, setViewDoc] = useState<CompanyDocument | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);

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
    if (!org?.id) { addToast('Organizasyon bilgisi bulunamadı.', 'error'); return; }
    setSaving(true);
    try {
      let fileUrl = editDoc?.file_url ?? null;
      let fileName = editDoc?.file_name ?? null;
      let fileSize = editDoc?.file_size ?? 0;
      let fileType = editDoc?.file_type ?? null;

      if (formData.file) {
        const { url, error: uploadErr } = await uploadFile(formData.file, org.id);
        if (uploadErr) {
          // Dosya yükleme başarısız olsa bile kaydı devam ettir, sadece uyar
          addToast(`Dosya yüklenemedi (${uploadErr}), evrak bilgileri kaydediliyor...`, 'error');
        } else {
          fileUrl = url;
          fileName = formData.file.name;
          fileSize = formData.file.size;
          fileType = formData.file.type;
        }
      }

      const resolvedType = formData.document_type === 'Diğer' && formData.custom_type.trim()
        ? formData.custom_type.trim()
        : formData.document_type;

      const payload = {
        organization_id: org.id,
        company_id: formData.company_id || null,
        title: formData.title.trim(),
        document_type: resolvedType,
        description: formData.description ?? '',
        version: formData.version ?? '',
        valid_from: formData.valid_from || null,
        valid_until: formData.valid_until || null,
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize ?? 0,
        file_type: fileType,
        created_by: null,
      };

      if (editDoc) {
        const { error } = await updateDocument(editDoc.id, payload);
        if (error) { addToast(`Güncellenemedi: ${error}`, 'error'); return; }
        addToast('Evrak güncellendi.', 'success');
      } else {
        const { error } = await addDocument(payload);
        if (error) { addToast(`Kaydedilemedi: ${error}`, 'error'); return; }
        addToast('Evrak eklendi.', 'success');
      }
      setFormOpen(false);
    } catch (e) {
      addToast(`Beklenmeyen hata: ${e instanceof Error ? e.message : String(e)}`, 'error');
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

  // Toplu yükleme
  const handleBulkUpload = async (items: BulkFile[]) => {
    if (!org?.id) return;
    setBulkUploading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const item of items) {
      try {
        let fileUrl: string | null = null;
        let fileName: string | null = null;
        let fileSize = 0;
        let fileType: string | null = null;

        const { url, error: uploadErr } = await uploadFile(item.file, org.id);
        if (uploadErr) { errorCount++; continue; }
        fileUrl = url;
        fileName = item.file.name;
        fileSize = item.file.size;
        fileType = item.file.type;

        const resolvedType = item.document_type === 'Diğer' ? item.document_type : item.document_type;

        const { error } = await addDocument({
          organization_id: org.id,
          company_id: item.company_id || null,
          title: item.title.trim(),
          document_type: resolvedType,
          description: '',
          version: '',
          valid_from: null,
          valid_until: null,
          file_url: fileUrl,
          file_name: fileName,
          file_size: fileSize,
          file_type: fileType,
          created_by: null,
        });

        if (error) { errorCount++; } else { successCount++; }
      } catch {
        errorCount++;
      }
    }

    setBulkUploading(false);
    setBulkOpen(false);
    if (successCount > 0) addToast(`${successCount} evrak başarıyla yüklendi.`, 'success');
    if (errorCount > 0) addToast(`${errorCount} evrak yüklenemedi.`, 'error');
  };

  // Toplu indirme
  const handleBulkDownload = async () => {
    const toDownload = filtered.filter(d => selectedIds.has(d.id) && d.file_url);
    if (toDownload.length === 0) { addToast('İndirilecek dosya seçilmedi.', 'error'); return; }
    setBulkDownloading(true);
    for (const doc of toDownload) {
      try {
        const res = await fetch(doc.file_url!);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.file_name ?? doc.title;
        a.click();
        URL.revokeObjectURL(url);
        await new Promise(r => setTimeout(r, 300));
      } catch {
        // skip
      }
    }
    setBulkDownloading(false);
    addToast(`${toDownload.length} dosya indirildi.`, 'success');
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(d => d.id)));
    }
  };

  // Dinamik tür listesi
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
        <div className="flex gap-2 flex-wrap self-start sm:self-auto">
          <button onClick={() => setBulkOpen(true)} className="btn-secondary whitespace-nowrap">
            <i className="ri-stack-line text-base" /> Toplu Yükle
          </button>
          <button onClick={openAdd} className="btn-primary whitespace-nowrap">
            <i className="ri-add-line text-base" /> Evrak Ekle
          </button>
        </div>
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

      {/* Toplu seçim araç çubuğu */}
      {selectedIds.size > 0 && (
        <div className="isg-card rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap" style={{ border: '1px solid rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.05)' }}>
          <span className="text-sm font-semibold" style={{ color: '#34D399' }}>
            <i className="ri-checkbox-multiple-line mr-1" />{selectedIds.size} evrak seçildi
          </span>
          <button
            onClick={handleBulkDownload}
            disabled={bulkDownloading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all whitespace-nowrap disabled:opacity-50"
            style={{ background: 'rgba(52,211,153,0.15)', color: '#34D399', border: '1px solid rgba(52,211,153,0.3)' }}
          >
            <i className={bulkDownloading ? 'ri-loader-4-line animate-spin' : 'ri-download-2-line'} />
            {bulkDownloading ? 'İndiriliyor...' : 'Seçilenleri İndir'}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <i className="ri-close-line" /> Seçimi Temizle
          </button>
        </div>
      )}

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
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
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

      {/* Toplu Yükleme Modal */}
      <BulkDocUpload
        isOpen={bulkOpen}
        onClose={() => setBulkOpen(false)}
        firmalar={firmalar}
        onUpload={handleBulkUpload}
        uploading={bulkUploading}
      />

      {/* Gelişmiş Görüntüleme Modal */}
      <DocViewModal
        doc={viewDoc}
        firmalar={firmalar}
        onClose={() => setViewDoc(null)}
        onEdit={openEdit}
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
    </div>
  );
}
