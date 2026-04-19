import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/store/AuthContext';
import { useApp } from '@/store/AppContext';
import PageHeader from '@/components/base/PageHeader';
import Button from '@/components/base/Button';
import StatusBadge from '@/components/base/StatusBadge';
import EmptyState from '@/components/base/EmptyState';
import Drawer from '@/components/base/Drawer';
import {
  getHealthRecords, createHealthRecord, updateHealthRecord, deleteHealthRecord,
  type HealthRecordRow,
} from '@/services/specialistService';

const STATUSES = ['Uygun', 'Uygun Değil', 'Muayene Gerekli'];

interface FormState {
  personnelName: string; firmId: string;
  examDate: string; nextExamDate: string; status: string; notes: string;
}

const emptyForm = (): FormState => ({
  personnelName: '', firmId: '', examDate: '', nextExamDate: '', status: 'Uygun', notes: '',
});

function daysLeft(nextExamDate: string): number {
  const today = new Date();
  const next = new Date(nextExamDate);
  return Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function DoctorHealthStatusPage() {
  const { session } = useAuth();
  const { firms, showToast } = useApp();

  const [records, setRecords] = useState<HealthRecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<HealthRecordRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.organizationId) return;
    setLoading(true);
    try {
      const data = await getHealthRecords(session.organizationId);
      setRecords(data);
    } catch {
      showToast('Sağlık kayıtları yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  }, [session?.organizationId, showToast]);

  useEffect(() => { load(); }, [load]);

  const filtered = records.filter((r) => {
    const matchStatus = !filter || r.status === filter;
    const matchSearch = !search
      || r.personnel_name.toLowerCase().includes(search.toLowerCase())
      || (r.firm?.name ?? '').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const openAdd = () => { setEditing(null); setForm(emptyForm()); setDrawerOpen(true); };
  const openEdit = (r: HealthRecordRow) => {
    setEditing(r);
    setForm({
      personnelName: r.personnel_name, firmId: r.firm_id ?? '',
      examDate: r.exam_date, nextExamDate: r.next_exam_date,
      status: r.status, notes: r.notes ?? '',
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!form.personnelName.trim() || !form.examDate || !form.nextExamDate) {
      showToast('Zorunlu alanları doldurun', 'error'); return;
    }
    if (!session) return;
    setSaving(true);
    try {
      if (editing) {
        const updated = await updateHealthRecord(editing.id, {
          personnelName: form.personnelName, firmId: form.firmId || null,
          examDate: form.examDate, nextExamDate: form.nextExamDate,
          status: form.status, notes: form.notes,
        });
        setRecords((prev) => prev.map((r) => r.id === editing.id ? updated : r));
        showToast('Sağlık kaydı güncellendi');
      } else {
        const created = await createHealthRecord(session.organizationId, session.userId, {
          personnelName: form.personnelName, firmId: form.firmId || null,
          examDate: form.examDate, nextExamDate: form.nextExamDate,
          status: form.status, notes: form.notes,
        });
        setRecords((prev) => [created, ...prev]);
        showToast('Sağlık kaydı eklendi');
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
      await deleteHealthRecord(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setDeleteConfirm(null);
      showToast('Kayıt silindi');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Silinemedi', 'error');
    }
  };

  const f = (k: keyof FormState, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const suitable = records.filter((r) => r.status === 'Uygun').length;
  const needsExam = records.filter((r) => r.status === 'Muayene Gerekli').length;
  const unsuitable = records.filter((r) => r.status === 'Uygun Değil').length;

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Sağlık Durumu"
        description="Personel sağlık muayene takibi ve uygunluk durumları"
        action={<Button variant="primary" icon="ri-add-line" onClick={openAdd}>Kayıt Ekle</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-5 md:mb-6">
        {[
          { label: 'Uygun', count: suitable, icon: 'ri-heart-pulse-line', color: 'var(--success)', bg: 'var(--success-bg)' },
          { label: 'Muayene Gerekli', count: needsExam, icon: 'ri-alarm-warning-line', color: 'var(--warning)', bg: 'var(--warning-bg)' },
          { label: 'Uygun Değil', count: unsuitable, icon: 'ri-close-circle-line', color: 'var(--danger)', bg: 'var(--danger-bg)' },
        ].map((s) => (
          <button key={s.label} onClick={() => setFilter(filter === s.label ? '' : s.label)}
            className="rounded-xl p-5 flex items-center gap-4 cursor-pointer transition-all text-left"
            style={{ backgroundColor: 'var(--card)', border: `1px solid ${filter === s.label ? s.color : 'var(--border)'}` }}
          >
            <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0" style={{ backgroundColor: s.bg }}>
              <i className={`${s.icon} text-lg`} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{s.count}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="filter-bar mb-5">
        <div className="relative flex-1 max-w-xs">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }} />
          <input className="input pl-9 text-sm" placeholder="Personel veya firma ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {(filter || search) && (
          <button onClick={() => { setFilter(''); setSearch(''); }} className="text-xs cursor-pointer whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>Temizle</button>
        )}
        <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>{filtered.length} kayıt</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <i className="ri-loader-4-line animate-spin text-2xl" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <EmptyState icon="ri-heart-pulse-line" title="Kayıt bulunamadı"
            description={filter || search ? 'Seçili kriterlere uygun kayıt yok.' : 'Henüz sağlık kaydı eklenmemiş.'}
            actionLabel={!filter && !search ? 'Kayıt Ekle' : undefined}
            onAction={!filter && !search ? openAdd : undefined}
          />
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <table className="w-full">
            <thead className="table-head">
              <tr>{['Personel', 'Firma', 'Son Muayene', 'Sonraki Muayene', 'Kalan Gün', 'Durum', ''].map((h) => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const days = daysLeft(r.next_exam_date);
                return (
                  <tr key={r.id} className="table-row">
                    <td className="table-cell-primary">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                          <i className="ri-user-line text-xs" style={{ color: 'var(--text-muted)' }} />
                        </div>
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{r.personnel_name}</p>
                          {r.notes && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.notes}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">{r.firm?.name ?? '—'}</td>
                    <td className="table-cell" style={{ color: 'var(--text-muted)' }}>{r.exam_date}</td>
                    <td className="table-cell" style={{ color: 'var(--text-muted)' }}>{r.next_exam_date}</td>
                    <td className="table-cell">
                      <span className="font-medium" style={{ color: days < 0 ? 'var(--danger)' : days <= 30 ? 'var(--warning)' : 'var(--success)' }}>
                        {days < 0 ? `${Math.abs(days)} gün geçti` : `${days} gün`}
                      </span>
                    </td>
                    <td className="table-cell"><StatusBadge status={r.status} /></td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(r)} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors" style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface)')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}>
                          <i className="ri-edit-line text-xs" />
                        </button>
                        {deleteConfirm === r.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleDelete(r.id)} className="text-xs px-2 py-0.5 rounded cursor-pointer" style={{ backgroundColor: 'var(--danger)', color: '#fff' }}>Sil</button>
                            <button onClick={() => setDeleteConfirm(null)} className="text-xs px-2 py-0.5 rounded cursor-pointer" style={{ backgroundColor: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>İptal</button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteConfirm(r.id)} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors" style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--danger-bg)')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}>
                            <i className="ri-delete-bin-line text-xs" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}
        title={editing ? 'Kaydı Düzenle' : 'Yeni Sağlık Kaydı'}
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
            <label className="form-label">Personel Adı *</label>
            <input className="input" placeholder="Ad Soyad" value={form.personnelName} onChange={(e) => f('personnelName', e.target.value)} />
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
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Son Muayene *</label>
              <input type="date" className="input" value={form.examDate} onChange={(e) => f('examDate', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Sonraki Muayene *</label>
              <input type="date" className="input" value={form.nextExamDate} onChange={(e) => f('nextExamDate', e.target.value)} />
            </div>
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
