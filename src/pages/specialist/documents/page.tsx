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

const DOC_TYPES = [
  'Risk Değerlendirmesi', 'Acil Durum Planı', 'İş Güvenliği Talimatı',
  'Eğitim Belgesi', 'Muayene Raporu', 'Denetim Raporu', 'Diğer',
];
const DOC_STATUSES = ['Güncel', 'Yaklaşıyor', 'Süresi Dolmuş', 'Eksik'];

interface FormState {
  docName: string; firmId: string; status: string; expiryDate: string; notes: string;
}

const emptyForm = (): FormState => ({
  docName: '', firmId: '', status: 'Güncel', expiryDate: '', notes: '',
});

export default function SpecialistDocumentsPage() {
  const { session } = useAuth();
  const { firms, showToast } = useApp();

  const [docs, setDocs] = useState<FirmDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
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
      showToast('Dökümanlar yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  }, [session?.organizationId, showToast]);

  useEffect(() => { load(); }, [load]);

  const filtered = docs.filter((d) => {
    const matchSearch = !search
      || d.doc_name.toLowerCase().includes(search.toLowerCase())
      || (d.firm?.name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = !selectedStatus || d.status === selectedStatus;
    return matchSearch && matchStatus;
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
    if (!form.docName.trim()) { showToast('Döküman adı zorunludur', 'error'); return; }
    if (!session) return;
    setSaving(true);
    try {
      if (editing) {
        const updated = await updateFirmDocument(editing.id, {
          docName: form.docName, firmId: form.firmId || null,
          status: form.status, expiryDate: form.expiryDate, notes: form.notes,
        });
        setDocs((prev) => prev.map((d) => d.id === editing.id ? updated : d));
        showToast('Döküman güncellendi');
      } else {
        const created = await createFirmDocument(session.organizationId, session.userId, {
          docName: form.docName, firmId: form.firmId || null,
          status: form.status, expiryDate: form.expiryDate, notes: form.notes,
        });
        setDocs((prev) => [created, ...prev]);
        showToast('Döküman eklendi');
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
      showToast('Döküman silindi');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Silinemedi', 'error');
    }
  };

  const f = (k: keyof FormState, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const counts = {
    total: docs.length,
    guncel: docs.filter((d) => d.status === 'Güncel').length,
    yaklasan: docs.filter((d) => d.status === 'Yaklaşıyor').length,
    suresi: docs.filter((d) => d.status === 'Süresi Dolmuş' || d.status === 'Eksik').length,
  };

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Dökümanlar"
        description="Tüm döküman ve dosyalarınız"
        action={<Button variant="primary" icon="ri-add-line" onClick={openAdd}>Döküman Ekle</Button>}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 mb-5 md:mb-6">
        {[
          { label: 'Toplam', count: counts.total, icon: 'ri-folder-line', color: 'var(--text-secondary)', bg: 'var(--surface)' },
          { label: 'Güncel', count: counts.guncel, icon: 'ri-checkbox-circle-line', color: 'var(--success)', bg: 'var(--success-bg)' },
          { label: 'Yaklaşıyor', count: counts.yaklasan, icon: 'ri-alarm-warning-line', color: 'var(--warning)', bg: 'var(--warning-bg)' },
          { label: 'Sorunlu', count: counts.suresi, icon: 'ri-close-circle-line', color: 'var(--danger)', bg: 'var(--danger-bg)' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-4 flex items-center gap-3" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0" style={{ backgroundColor: s.bg }}>
              <i className={`${s.icon} text-base`} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{s.count}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }} />
          <input className="input pl-8 text-sm" placeholder="Döküman veya firma ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          {['', ...DOC_STATUSES].map((s) => (
            <button key={s} onClick={() => setSelectedStatus(s)}
              className="px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap transition-all"
              style={{
                backgroundColor: selectedStatus === s ? 'var(--card)' : 'transparent',
                color: selectedStatus === s ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: selectedStatus === s ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >{s || 'Tümü'}</button>
          ))}
        </div>
        <span className="text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{filtered.length} döküman</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <i className="ri-loader-4-line animate-spin text-2xl" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <EmptyState icon="ri-folder-line" title="Döküman bulunamadı"
            description={search || selectedStatus ? 'Seçili kriterlere uygun döküman yok.' : 'Henüz döküman eklenmemiş.'}
            actionLabel={!search && !selectedStatus ? 'Döküman Ekle' : undefined}
            onAction={!search && !selectedStatus ? openAdd : undefined}
          />
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <table className="w-full">
            <thead className="table-head">
              <tr>{['Döküman Adı', 'Firma', 'Durum', 'Son Kullanma', 'Yüklenme', ''].map((h) => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map((doc) => (
                <tr key={doc.id} className="table-row">
                  <td className="table-cell-primary">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <i className="ri-file-text-line text-xs" style={{ color: 'var(--text-muted)' }} />
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

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}
        title={editing ? 'Dökümanı Düzenle' : 'Yeni Döküman'}
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
            <label className="form-label">Döküman Adı *</label>
            <input className="input" list="doc-types" placeholder="Risk Değerlendirmesi" value={form.docName} onChange={(e) => f('docName', e.target.value)} />
            <datalist id="doc-types">{DOC_TYPES.map((t) => <option key={t} value={t} />)}</datalist>
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
            <textarea className="input resize-none" rows={3} placeholder="Ek notlar..." value={form.notes} onChange={(e) => f('notes', e.target.value)} maxLength={500} />
          </div>
        </div>
      </Drawer>
    </div>
  );
}
