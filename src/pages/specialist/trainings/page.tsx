import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/store/AuthContext';
import { useApp } from '@/store/AppContext';
import PageHeader from '@/components/base/PageHeader';
import Button from '@/components/base/Button';
import StatusBadge from '@/components/base/StatusBadge';
import EmptyState from '@/components/base/EmptyState';
import Drawer from '@/components/base/Drawer';
import {
  getTrainings, createTraining, updateTraining, deleteTraining,
  type TrainingRow,
} from '@/services/specialistService';

const TRAINING_TYPES = ['Zorunlu', 'Periyodik', 'Bilgilendirme'];
const STATUSES = ['Planlandı', 'Tamamlandı', 'İptal'];

interface FormState {
  title: string;
  type: string;
  firmId: string;
  trainingDate: string;
  durationHours: string;
  participantCount: string;
  status: string;
  notes: string;
}

const emptyForm = (): FormState => ({
  title: '', type: 'Zorunlu', firmId: '', trainingDate: '',
  durationHours: '4', participantCount: '0', status: 'Planlandı', notes: '',
});

export default function TrainingsPage() {
  const { session } = useAuth();
  const { firms, showToast } = useApp();

  const [trainings, setTrainings] = useState<TrainingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<TrainingRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.organizationId) return;
    setLoading(true);
    try {
      const data = await getTrainings(session.organizationId);
      setTrainings(data);
    } catch {
      showToast('Eğitimler yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  }, [session?.organizationId, showToast]);

  useEffect(() => { load(); }, [load]);

  const filtered = trainings.filter((t) => !filter || t.status === filter);
  const planned = trainings.filter((t) => t.status === 'Planlandı').length;
  const completed = trainings.filter((t) => t.status === 'Tamamlandı').length;
  const totalParticipants = trainings.reduce((a, t) => a + t.participant_count, 0);

  const openAdd = () => { setEditing(null); setForm(emptyForm()); setDrawerOpen(true); };
  const openEdit = (t: TrainingRow) => {
    setEditing(t);
    setForm({
      title: t.title, type: t.type, firmId: t.firm_id ?? '',
      trainingDate: t.training_date, durationHours: String(t.duration_hours),
      participantCount: String(t.participant_count), status: t.status, notes: t.notes ?? '',
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.trainingDate) {
      showToast('Başlık ve tarih zorunludur', 'error'); return;
    }
    if (!session) return;
    setSaving(true);
    try {
      if (editing) {
        const updated = await updateTraining(editing.id, {
          title: form.title, type: form.type, firmId: form.firmId || null,
          trainingDate: form.trainingDate, durationHours: parseFloat(form.durationHours) || 1,
          participantCount: parseInt(form.participantCount) || 0,
          status: form.status, notes: form.notes,
        });
        setTrainings((prev) => prev.map((t) => t.id === editing.id ? updated : t));
        showToast('Eğitim güncellendi');
      } else {
        const created = await createTraining(session.organizationId, session.userId, {
          title: form.title, type: form.type, firmId: form.firmId || null,
          trainingDate: form.trainingDate, durationHours: parseFloat(form.durationHours) || 1,
          participantCount: parseInt(form.participantCount) || 0,
          status: form.status, notes: form.notes,
        });
        setTrainings((prev) => [created, ...prev]);
        showToast('Eğitim eklendi');
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
      await deleteTraining(id);
      setTrainings((prev) => prev.filter((t) => t.id !== id));
      setDeleteConfirm(null);
      showToast('Eğitim silindi');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Silinemedi', 'error');
    }
  };

  const f = (k: keyof FormState, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Eğitimler"
        description="Planlanan ve tamamlanan eğitim kayıtları"
        action={<Button variant="primary" icon="ri-add-line" onClick={openAdd}>Eğitim Ekle</Button>}
      />

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-5 md:mb-6">
        {[
          { label: 'Planlanan', count: planned, icon: 'ri-calendar-line', color: 'var(--info)' },
          { label: 'Tamamlanan', count: completed, icon: 'ri-checkbox-circle-line', color: 'var(--success)' },
          { label: 'Toplam Katılımcı', count: totalParticipants, icon: 'ri-team-line', color: 'var(--purple)' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-5 flex items-center gap-4" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
              <i className={`${s.icon} text-lg`} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{s.count}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="filter-bar mb-5">
        {['', 'Planlandı', 'Tamamlandı', 'İptal'].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer whitespace-nowrap transition-colors"
            style={{ backgroundColor: filter === s ? 'var(--text-primary)' : 'transparent', color: filter === s ? 'var(--card)' : 'var(--text-muted)', border: `1px solid ${filter === s ? 'var(--text-primary)' : 'var(--border)'}` }}
          >{s || 'Tümü'}</button>
        ))}
        <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>{filtered.length} eğitim</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <i className="ri-loader-4-line animate-spin text-2xl" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <EmptyState icon="ri-graduation-cap-line" title="Eğitim bulunamadı"
            description={filter ? 'Seçili kriterlere uygun eğitim yok.' : 'Henüz eğitim eklenmemiş.'}
            actionLabel={!filter ? 'Eğitim Ekle' : undefined} onAction={!filter ? openAdd : undefined}
          />
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <table className="w-full">
            <thead className="table-head">
              <tr>{['Eğitim', 'Firma', 'Tarih', 'Süre', 'Katılımcı', 'Tür', 'Durum', ''].map((h) => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="table-row">
                  <td className="table-cell-primary">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <i className="ri-graduation-cap-line text-xs" style={{ color: 'var(--text-muted)' }} />
                      </div>
                      {t.title}
                    </div>
                  </td>
                  <td className="table-cell">{t.firm?.name ?? '—'}</td>
                  <td className="table-cell" style={{ color: 'var(--text-muted)' }}>{t.training_date}</td>
                  <td className="table-cell" style={{ color: 'var(--text-muted)' }}>{t.duration_hours} saat</td>
                  <td className="table-cell">{t.participant_count} kişi</td>
                  <td className="table-cell">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>{t.type}</span>
                  </td>
                  <td className="table-cell"><StatusBadge status={t.status} /></td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(t)} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors" style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}>
                        <i className="ri-edit-line text-xs" />
                      </button>
                      {deleteConfirm === t.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(t.id)} className="text-xs px-2 py-0.5 rounded cursor-pointer" style={{ backgroundColor: 'var(--danger)', color: '#fff' }}>Sil</button>
                          <button onClick={() => setDeleteConfirm(null)} className="text-xs px-2 py-0.5 rounded cursor-pointer" style={{ backgroundColor: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>İptal</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirm(t.id)} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors" style={{ color: 'var(--text-muted)' }}
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

      {/* Add/Edit Drawer */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}
        title={editing ? 'Eğitimi Düzenle' : 'Yeni Eğitim'}
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
            <label className="form-label">Eğitim Başlığı *</label>
            <input className="input" placeholder="Yangın Güvenliği ve Tahliye" value={form.title} onChange={(e) => f('title', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Tür</label>
              <select className="input cursor-pointer" value={form.type} onChange={(e) => f('type', e.target.value)}>
                {TRAINING_TYPES.map((t) => <option key={t}>{t}</option>)}
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Tarih *</label>
              <input type="date" className="input" value={form.trainingDate} onChange={(e) => f('trainingDate', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Süre (saat)</label>
              <input type="number" min="0.5" step="0.5" className="input" value={form.durationHours} onChange={(e) => f('durationHours', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="form-label">Katılımcı Sayısı</label>
            <input type="number" min="0" className="input" value={form.participantCount} onChange={(e) => f('participantCount', e.target.value)} />
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
