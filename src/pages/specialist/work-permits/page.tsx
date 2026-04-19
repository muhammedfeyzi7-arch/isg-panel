import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/store/AuthContext';
import { useApp } from '@/store/AppContext';
import PageHeader from '@/components/base/PageHeader';
import Button from '@/components/base/Button';
import StatusBadge from '@/components/base/StatusBadge';
import EmptyState from '@/components/base/EmptyState';
import Drawer from '@/components/base/Drawer';
import {
  getWorkPermits, createWorkPermit, updateWorkPermit, deleteWorkPermit,
  type WorkPermitRow,
} from '@/services/specialistService';

const PERMIT_TYPES = ['Yüksekte Çalışma', 'Sıcak Çalışma', 'Kapalı Alan', 'Elektrik', 'Kazı', 'Diğer'];
const STATUSES = ['Beklemede', 'Onaylı', 'Reddedildi', 'Süresi Dolmuş'];

const typeColors: Record<string, string> = {
  'Yüksekte Çalışma': 'var(--warning)',
  'Sıcak Çalışma': 'var(--danger)',
  'Kapalı Alan': 'var(--purple)',
  'Elektrik': 'var(--info)',
  'Kazı': 'var(--success)',
  'Diğer': 'var(--text-muted)',
};

interface FormState {
  title: string; permitType: string; firmId: string;
  requestedBy: string; permitDate: string; validUntil: string;
  status: string; notes: string;
}

const emptyForm = (): FormState => ({
  title: '', permitType: 'Yüksekte Çalışma', firmId: '',
  requestedBy: '', permitDate: '', validUntil: '', status: 'Beklemede', notes: '',
});

export default function WorkPermitsPage() {
  const { session } = useAuth();
  const { firms, showToast } = useApp();

  const [permits, setPermits] = useState<WorkPermitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<WorkPermitRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.organizationId) return;
    setLoading(true);
    try {
      const data = await getWorkPermits(session.organizationId);
      setPermits(data);
    } catch {
      showToast('İş izinleri yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  }, [session?.organizationId, showToast]);

  useEffect(() => { load(); }, [load]);

  const filtered = permits.filter((p) => !filter || p.status === filter);

  const openAdd = () => { setEditing(null); setForm(emptyForm()); setDrawerOpen(true); };
  const openEdit = (p: WorkPermitRow) => {
    setEditing(p);
    setForm({
      title: p.title, permitType: p.permit_type, firmId: p.firm_id ?? '',
      requestedBy: p.requested_by, permitDate: p.permit_date, validUntil: p.valid_until,
      status: p.status, notes: p.notes ?? '',
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.requestedBy.trim() || !form.permitDate || !form.validUntil) {
      showToast('Zorunlu alanları doldurun', 'error'); return;
    }
    if (!session) return;
    setSaving(true);
    try {
      if (editing) {
        const updated = await updateWorkPermit(editing.id, {
          title: form.title, permitType: form.permitType, firmId: form.firmId || null,
          requestedBy: form.requestedBy, permitDate: form.permitDate, validUntil: form.validUntil,
          status: form.status, notes: form.notes,
        });
        setPermits((prev) => prev.map((p) => p.id === editing.id ? updated : p));
        showToast('İş izni güncellendi');
      } else {
        const created = await createWorkPermit(session.organizationId, session.userId, {
          title: form.title, permitType: form.permitType, firmId: form.firmId || null,
          requestedBy: form.requestedBy, permitDate: form.permitDate, validUntil: form.validUntil,
          status: form.status, notes: form.notes,
        });
        setPermits((prev) => [created, ...prev]);
        showToast('İş izni eklendi');
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
      await deleteWorkPermit(id);
      setPermits((prev) => prev.filter((p) => p.id !== id));
      setDeleteConfirm(null);
      showToast('İş izni silindi');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Silinemedi', 'error');
    }
  };

  const f = (k: keyof FormState, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="İş İzinleri"
        description="Saha çalışma izinleri ve onay takibi"
        action={<Button variant="primary" icon="ri-add-line" onClick={openAdd}>İzin Ekle</Button>}
      />

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 mb-5 md:mb-6">
        {[
          { label: 'Beklemede', count: permits.filter((p) => p.status === 'Beklemede').length, color: 'var(--warning)', bg: 'var(--warning-bg)', icon: 'ri-time-line' },
          { label: 'Onaylı', count: permits.filter((p) => p.status === 'Onaylı').length, color: 'var(--success)', bg: 'var(--success-bg)', icon: 'ri-checkbox-circle-line' },
          { label: 'Reddedildi', count: permits.filter((p) => p.status === 'Reddedildi').length, color: 'var(--danger)', bg: 'var(--danger-bg)', icon: 'ri-close-circle-line' },
          { label: 'Süresi Dolmuş', count: permits.filter((p) => p.status === 'Süresi Dolmuş').length, color: 'var(--text-muted)', bg: 'var(--surface)', icon: 'ri-alarm-warning-line' },
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

      {/* Filter */}
      <div className="filter-bar mb-5">
        {['', 'Beklemede', 'Onaylı', 'Reddedildi', 'Süresi Dolmuş'].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer whitespace-nowrap transition-colors"
            style={{ backgroundColor: filter === s ? 'var(--text-primary)' : 'transparent', color: filter === s ? 'var(--card)' : 'var(--text-muted)', border: `1px solid ${filter === s ? 'var(--text-primary)' : 'var(--border)'}` }}
          >{s || 'Tümü'}</button>
        ))}
        <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>{filtered.length} izin</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <i className="ri-loader-4-line animate-spin text-2xl" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <EmptyState icon="ri-file-shield-2-line" title="İş izni bulunamadı"
            description={filter ? 'Seçili kriterlere uygun izin yok.' : 'Henüz iş izni eklenmemiş.'}
            actionLabel={!filter ? 'İzin Ekle' : undefined} onAction={!filter ? openAdd : undefined}
          />
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <table className="w-full">
            <thead className="table-head">
              <tr>{['İzin Başlığı', 'Firma', 'Tür', 'Talep Eden', 'Tarih', 'Geçerlilik', 'Durum', ''].map((h) => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="table-row">
                  <td className="table-cell-primary">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <i className="ri-file-shield-2-line text-xs" style={{ color: 'var(--text-muted)' }} />
                      </div>
                      {p.title}
                    </div>
                  </td>
                  <td className="table-cell">{p.firm?.name ?? '—'}</td>
                  <td className="table-cell">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${typeColors[p.permit_type] ?? 'var(--text-muted)'}15`, color: typeColors[p.permit_type] ?? 'var(--text-muted)' }}>
                      {p.permit_type}
                    </span>
                  </td>
                  <td className="table-cell">{p.requested_by}</td>
                  <td className="table-cell" style={{ color: 'var(--text-muted)' }}>{p.permit_date}</td>
                  <td className="table-cell" style={{ color: 'var(--text-muted)' }}>{p.valid_until}</td>
                  <td className="table-cell"><StatusBadge status={p.status} /></td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(p)} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors" style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}>
                        <i className="ri-edit-line text-xs" />
                      </button>
                      {deleteConfirm === p.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(p.id)} className="text-xs px-2 py-0.5 rounded cursor-pointer" style={{ backgroundColor: 'var(--danger)', color: '#fff' }}>Sil</button>
                          <button onClick={() => setDeleteConfirm(null)} className="text-xs px-2 py-0.5 rounded cursor-pointer" style={{ backgroundColor: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>İptal</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirm(p.id)} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors" style={{ color: 'var(--text-muted)' }}
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
        title={editing ? 'İzni Düzenle' : 'Yeni İş İzni'}
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
            <label className="form-label">İzin Başlığı *</label>
            <input className="input" placeholder="Yüksekte Çalışma İzni" value={form.title} onChange={(e) => f('title', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">İzin Türü</label>
              <select className="input cursor-pointer" value={form.permitType} onChange={(e) => f('permitType', e.target.value)}>
                {PERMIT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Durum</label>
              <select className="input cursor-pointer" value={form.status} onChange={(e) => f('status', e.target.value)}>
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="form-label">Firma</label>
            <select className="input cursor-pointer" value={form.firmId} onChange={(e) => f('firmId', e.target.value)}>
              <option value="">Firma seçin (opsiyonel)</option>
              {firms.map((fi) => <option key={fi.id} value={fi.id}>{fi.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Talep Eden *</label>
            <input className="input" placeholder="Ad Soyad" value={form.requestedBy} onChange={(e) => f('requestedBy', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">İzin Tarihi *</label>
              <input type="date" className="input" value={form.permitDate} onChange={(e) => f('permitDate', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Geçerlilik *</label>
              <input type="date" className="input" value={form.validUntil} onChange={(e) => f('validUntil', e.target.value)} />
            </div>
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
