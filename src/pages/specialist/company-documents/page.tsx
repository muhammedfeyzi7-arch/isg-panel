import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/store/AuthContext';
import { useApp } from '@/store/AppContext';
import PageHeader from '@/components/base/PageHeader';
import Button from '@/components/base/Button';
import StatusBadge from '@/components/base/StatusBadge';
import EmptyState from '@/components/base/EmptyState';
import Drawer from '@/components/base/Drawer';
import {
  getFirmDocuments, createFirmDocument, updateFirmDocument, deleteFirmDocument,
  type FirmDocumentRow,
} from '@/services/specialistService';

const DOC_STATUSES = ['Güncel', 'Yaklaşıyor', 'Süresi Dolmuş', 'Eksik'];

interface FormState {
  docName: string; firmId: string; status: string; expiryDate: string; notes: string;
}

const emptyForm = (): FormState => ({
  docName: '', firmId: '', status: 'Güncel', expiryDate: '', notes: '',
});

const statusColors: Record<string, string> = {
  'Güncel': 'var(--success)',
  'Yaklaşıyor': 'var(--warning)',
  'Süresi Dolmuş': 'var(--danger)',
  'Eksik': 'var(--text-muted)',
};

export default function CompanyDocumentsPage() {
  const { session } = useAuth();
  const { firms, showToast } = useApp();

  const [docs, setDocs] = useState<FirmDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFirm, setSelectedFirm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<FirmDocumentRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.organizationId) return;
    setLoading(true);
    try {
      const data = await getFirmDocuments(session.organizationId);
      setDocs(data);
    } catch {
      showToast('Belgeler yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  }, [session?.organizationId, showToast]);

  useEffect(() => { load(); }, [load]);

  const filtered = docs.filter((d) => {
    const matchFirm = !selectedFirm || d.firm_id === selectedFirm;
    const matchStatus = !selectedStatus || d.status === selectedStatus;
    const matchSearch = !search || d.doc_name.toLowerCase().includes(search.toLowerCase()) || (d.firm?.name ?? '').toLowerCase().includes(search.toLowerCase());
    return matchFirm && matchStatus && matchSearch;
  });

  const openAdd = () => { setEditing(null); setForm(emptyForm()); setDrawerOpen(true); };
  const openEdit = (d: FirmDocumentRow) => {
    setEditing(d);
    setForm({
      docName: d.doc_name, firmId: d.firm_id ?? '', status: d.status,
      expiryDate: d.expiry_date ?? '', notes: d.notes ?? '',
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!form.docName.trim()) { showToast('Belge adı zorunludur', 'error'); return; }
    if (!session) return;
    setSaving(true);
    try {
      if (editing) {
        const updated = await updateFirmDocument(editing.id, {
          docName: form.docName, firmId: form.firmId || null, status: form.status,
          expiryDate: form.expiryDate, notes: form.notes,
        });
        setDocs((prev) => prev.map((d) => d.id === editing.id ? updated : d));
        showToast('Belge güncellendi');
      } else {
        const created = await createFirmDocument(session.organizationId, session.userId, {
          docName: form.docName, firmId: form.firmId || null, status: form.status,
          expiryDate: form.expiryDate, notes: form.notes,
        });
        setDocs((prev) => [created, ...prev]);
        showToast('Belge eklendi');
      }
      setDrawerOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Hata', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteFirmDocument(id);
      setDocs((prev) => prev.filter((d) => d.id !== id));
      setDeleteConfirm(null);
      showToast('Belge silindi');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Silinemedi', 'error');
    }
  };

  const f = (k: keyof FormState, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Firma Belgeleri"
        description="Atanmış firmalara ait belge arşivi"
        action={<Button variant="primary" icon="ri-add-line" onClick={openAdd}>Belge Ekle</Button>}
      />

      {/* Filter */}
      <div className="filter-bar mb-5 flex-wrap gap-2">
        <div className="relative flex-1 max-w-xs">
          <div className="w-4 h-4 flex items-center justify-center absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
            <i className="ri-search-line text-sm" />
          </div>
          <input className="input pl-9" placeholder="Belge ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto cursor-pointer" value={selectedFirm} onChange={(e) => setSelectedFirm(e.target.value)}>
          <option value="">Tüm Firmalar</option>
          {firms.map((fi) => <option key={fi.id} value={fi.id}>{fi.name}</option>)}
        </select>
        <select className="input w-auto cursor-pointer" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
          <option value="">Tüm Durumlar</option>
          {DOC_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>{filtered.length} belge</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <i className="ri-loader-4-line animate-spin text-2xl" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <EmptyState icon="ri-file-list-3-line" title="Belge bulunamadı"
            description={search || selectedFirm || selectedStatus ? 'Seçili kriterlere uygun belge yok.' : 'Henüz belge eklenmemiş.'}
            actionLabel={!search && !selectedFirm && !selectedStatus ? 'Belge Ekle' : undefined}
            onAction={!search && !selectedFirm && !selectedStatus ? openAdd : undefined}
          />
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <table className="w-full">
            <thead className="table-head">
              <tr>{['Belge Adı', 'Firma', 'Durum', 'Son Kullanma', 'Yüklenme', ''].map((h) => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map((doc) => (
                <tr key={doc.id} className="table-row">
                  <td className="table-cell-primary">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <i className="ri-file-text-line text-xs" style={{ color: statusColors[doc.status] ?? 'var(--text-muted)' }} />
                      </div>
                      {doc.doc_name}
                    </div>
                  </td>
                  <td className="table-cell">{doc.firm?.name ?? '—'}</td>
                  <td className="table-cell"><StatusBadge status={doc.status} /></td>
                  <td className="table-cell" style={{ color: doc.status === 'Süresi Dolmuş' ? 'var(--danger)' : 'var(--text-muted)' }}>
                    {doc.expiry_date ?? '—'}
                  </td>
                  <td className="table-cell" style={{ color: 'var(--text-muted)' }}>{doc.uploaded_at ?? '—'}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(doc)} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors" style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}>
                        <i className="ri-edit-line text-xs" />
                      </button>
                      {deleteConfirm === doc.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(doc.id)} className="text-xs px-2 py-0.5 rounded cursor-pointer" style={{ backgroundColor: 'var(--danger)', color: '#fff' }}>Sil</button>
                          <button onClick={() => setDeleteConfirm(null)} className="text-xs px-2 py-0.5 rounded cursor-pointer" style={{ backgroundColor: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>İptal</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirm(doc.id)} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors" style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--danger-bg)')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}>
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
      )}

      {/* Drawer */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}
        title={editing ? 'Belgeyi Düzenle' : 'Yeni Belge'}
        width="w-[480px]"
        footer={
          <>
            <Button variant="secondary" className="flex-1" onClick={() => setDrawerOpen(false)}>İptal</Button>
            <Button variant="primary" className="flex-1" onClick={handleSave}>
              {saving ? 'Kaydediliyor...' : editing ? 'Güncelle' : 'Ekle'}
            </Button>
          </>
        }
      >
        <div className="p-6 space-y-4">
          <div>
            <label className="form-label">Belge Adı *</label>
            <input className="input" placeholder="Risk Değerlendirmesi" value={form.docName} onChange={(e) => f('docName', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Firma</label>
            <select className="input cursor-pointer" value={form.firmId} onChange={(e) => f('firmId', e.target.value)}>
              <option value="">Firma seçin (opsiyonel)</option>
              {firms.map((fi) => <option key={fi.id} value={fi.id}>{fi.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Durum</label>
            <select className="input cursor-pointer" value={form.status} onChange={(e) => f('status', e.target.value)}>
              {DOC_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Son Kullanma Tarihi</label>
            <input type="date" className="input" value={form.expiryDate} onChange={(e) => f('expiryDate', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Notlar</label>
            <textarea className="input resize-none" rows={3} placeholder="Ek notlar..." value={form.notes} onChange={(e) => f('notes', e.target.value)} />
          </div>
        </div>
      </Drawer>
    </div>
  );
}
