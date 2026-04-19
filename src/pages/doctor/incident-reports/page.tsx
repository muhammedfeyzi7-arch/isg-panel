import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/store/AuthContext';
import { useApp } from '@/store/AppContext';
import PageHeader from '@/components/base/PageHeader';
import Button from '@/components/base/Button';
import StatusBadge from '@/components/base/StatusBadge';
import EmptyState from '@/components/base/EmptyState';
import Drawer from '@/components/base/Drawer';
import {
  getIncidentReports, createIncidentReport, updateIncidentReport, deleteIncidentReport,
  type IncidentReportRow,
} from '@/services/incidentReportService';

const SEVERITIES = ['Hafif', 'Orta', 'Ağır', 'Ölümlü'];
const STATUSES = ['Taslak', 'İncelemede', 'Tamamlandı'];

const severityColors: Record<string, { color: string; bg: string }> = {
  'Hafif':  { color: 'var(--success)', bg: 'var(--success-bg)' },
  'Orta':   { color: 'var(--warning)', bg: 'var(--warning-bg)' },
  'Ağır':   { color: 'var(--danger)',  bg: 'var(--danger-bg)' },
  'Ölümlü': { color: '#7f1d1d',        bg: '#fef2f2' },
};

interface FormState {
  title: string; description: string; severity: string; status: string;
  injuredCount: string; reportedBy: string; incidentDate: string;
  firmId: string; notes: string;
}

const emptyForm = (): FormState => ({
  title: '', description: '', severity: 'Hafif', status: 'Taslak',
  injuredCount: '0', reportedBy: '', incidentDate: '',
  firmId: '', notes: '',
});

export default function IncidentReportsPage() {
  const { session } = useAuth();
  const { firms, showToast } = useApp();

  const [reports, setReports] = useState<IncidentReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<IncidentReportRow | null>(null);
  const [selected, setSelected] = useState<IncidentReportRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.organizationId) return;
    setLoading(true);
    try {
      const data = await getIncidentReports(session.organizationId);
      setReports(data);
    } catch {
      showToast('Raporlar yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  }, [session?.organizationId, showToast]);

  useEffect(() => { load(); }, [load]);

  const filtered = reports.filter((r) => {
    const matchStatus = !filter || r.status === filter;
    const matchSearch = !search
      || r.title.toLowerCase().includes(search.toLowerCase())
      || (r.firm?.name ?? '').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const openAdd = () => { setEditing(null); setForm(emptyForm()); setDrawerOpen(true); };
  const openEdit = (r: IncidentReportRow) => {
    setEditing(r);
    setForm({
      title: r.title, description: r.description, severity: r.severity,
      status: r.status, injuredCount: String(r.injured_count),
      reportedBy: r.reported_by, incidentDate: r.incident_date,
      firmId: r.firm_id ?? '', notes: r.notes ?? '',
    });
    setDetailOpen(false);
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.incidentDate || !form.reportedBy.trim()) {
      showToast('Başlık, tarih ve raporlayan zorunludur', 'error'); return;
    }
    if (!session) return;
    setSaving(true);
    try {
      if (editing) {
        const updated = await updateIncidentReport(editing.id, {
          title: form.title, description: form.description, severity: form.severity,
          status: form.status, injuredCount: parseInt(form.injuredCount) || 0,
          reportedBy: form.reportedBy, incidentDate: form.incidentDate,
          firmId: form.firmId || null, notes: form.notes,
        });
        setReports((prev) => prev.map((r) => r.id === editing.id ? updated : r));
        showToast('Rapor güncellendi');
      } else {
        const created = await createIncidentReport(session.organizationId, session.userId, {
          title: form.title, description: form.description, severity: form.severity,
          status: form.status, injuredCount: parseInt(form.injuredCount) || 0,
          reportedBy: form.reportedBy, incidentDate: form.incidentDate,
          firmId: form.firmId || null, notes: form.notes,
        });
        setReports((prev) => [created, ...prev]);
        showToast('Rapor eklendi');
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
      await deleteIncidentReport(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
      setDeleteConfirm(null);
      setDetailOpen(false);
      showToast('Rapor silindi');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Silinemedi', 'error');
    }
  };

  const f = (k: keyof FormState, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="İş Kazası Raporları"
        description="Kayıt altına alınan iş kazası ve ramak kala olayları"
        action={<Button variant="primary" icon="ri-add-line" onClick={openAdd}>Rapor Ekle</Button>}
      />

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 mb-5 md:mb-6">
        {[
          { label: 'Toplam Rapor', count: reports.length, icon: 'ri-file-warning-line', color: 'var(--text-secondary)', bg: 'var(--surface)' },
          { label: 'Hafif', count: reports.filter((r) => r.severity === 'Hafif').length, icon: 'ri-checkbox-circle-line', color: 'var(--success)', bg: 'var(--success-bg)' },
          { label: 'Orta / Ağır', count: reports.filter((r) => r.severity === 'Orta' || r.severity === 'Ağır').length, icon: 'ri-alarm-warning-line', color: 'var(--warning)', bg: 'var(--warning-bg)' },
          { label: 'İncelemede', count: reports.filter((r) => r.status === 'İncelemede').length, icon: 'ri-search-eye-line', color: 'var(--info)', bg: 'var(--info-bg)' },
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
      <div className="filter-bar mb-5">
        <div className="relative flex-1 max-w-xs">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }} />
          <input className="input pl-9 text-sm" placeholder="Rapor veya firma ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {['', 'Taslak', 'İncelemede', 'Tamamlandı'].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer whitespace-nowrap transition-colors"
            style={{ backgroundColor: filter === s ? 'var(--text-primary)' : 'transparent', color: filter === s ? 'var(--card)' : 'var(--text-muted)', border: `1px solid ${filter === s ? 'var(--text-primary)' : 'var(--border)'}` }}
          >{s || 'Tümü'}</button>
        ))}
        <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>{filtered.length} rapor</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <i className="ri-loader-4-line animate-spin text-2xl" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <EmptyState icon="ri-file-warning-line" title="Rapor bulunamadı"
            description={filter || search ? 'Seçili kriterlere uygun rapor yok.' : 'Henüz iş kazası raporu eklenmemiş.'}
            actionLabel={!filter && !search ? 'Rapor Ekle' : undefined}
            onAction={!filter && !search ? openAdd : undefined}
          />
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <table className="w-full">
            <thead className="table-head">
              <tr>{['Olay', 'Firma', 'Tarih', 'Yaralı', 'Şiddet', 'Durum', ''].map((h) => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const sev = severityColors[r.severity] ?? severityColors['Hafif'];
                return (
                  <tr key={r.id} className="table-row cursor-pointer" onClick={() => { setSelected(r); setDetailOpen(true); }}>
                    <td className="table-cell-primary">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ backgroundColor: sev.bg }}>
                          <i className="ri-file-warning-line text-xs" style={{ color: sev.color }} />
                        </div>
                        {r.title}
                      </div>
                    </td>
                    <td className="table-cell">{r.firm?.name ?? '—'}</td>
                    <td className="table-cell" style={{ color: 'var(--text-muted)' }}>{r.incident_date}</td>
                    <td className="table-cell">{r.injured_count} kişi</td>
                    <td className="table-cell">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: sev.bg, color: sev.color }}>{r.severity}</span>
                    </td>
                    <td className="table-cell"><StatusBadge status={r.status} /></td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
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

      {/* Detail Drawer */}
      <Drawer open={detailOpen} onClose={() => setDetailOpen(false)} title="Kaza Raporu Detayı" width="w-[480px]"
        footer={
          <div className="flex gap-2 w-full">
            <Button variant="secondary" className="flex-1" onClick={() => setDetailOpen(false)}>Kapat</Button>
            {selected && <Button variant="primary" className="flex-1" onClick={() => openEdit(selected)}>Düzenle</Button>}
          </div>
        }
      >
        {selected && (() => {
          const sev = severityColors[selected.severity] ?? severityColors['Hafif'];
          return (
            <div className="p-6 space-y-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0" style={{ backgroundColor: sev.bg }}>
                  <i className="ri-file-warning-line text-lg" style={{ color: sev.color }} />
                </div>
                <div>
                  <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{selected.title}</h3>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{selected.firm?.name ?? '—'} · {selected.incident_date}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: sev.bg, color: sev.color }}>{selected.severity}</span>
                    <StatusBadge status={selected.status} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Yaralı Sayısı', value: `${selected.injured_count} kişi`, icon: 'ri-user-heart-line' },
                  { label: 'Raporlayan', value: selected.reported_by || '—', icon: 'ri-stethoscope-line' },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg p-3" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <i className={`${item.icon} text-xs`} style={{ color: 'var(--text-muted)' }} />
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                    </div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.value}</p>
                  </div>
                ))}
              </div>
              {selected.description && (
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>OLAY AÇIKLAMASI</p>
                  <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{selected.description}</p>
                  </div>
                </div>
              )}
              {selected.notes && (
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>NOTLAR</p>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{selected.notes}</p>
                </div>
              )}
            </div>
          );
        })()}
      </Drawer>

      {/* Add/Edit Drawer */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}
        title={editing ? 'Raporu Düzenle' : 'Yeni Kaza Raporu'}
        width="w-[520px]"
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
            <label className="form-label">Olay Başlığı *</label>
            <input className="input" placeholder="Kayma ve Düşme Kazası" value={form.title} onChange={(e) => f('title', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Şiddet</label>
              <select className="input cursor-pointer" value={form.severity} onChange={(e) => f('severity', e.target.value)}>
                {SEVERITIES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Durum</label>
              <select className="input cursor-pointer" value={form.status} onChange={(e) => f('status', e.target.value)}>
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Olay Tarihi *</label>
              <input type="date" className="input" value={form.incidentDate} onChange={(e) => f('incidentDate', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Yaralı Sayısı</label>
              <input type="number" min="0" className="input" value={form.injuredCount} onChange={(e) => f('injuredCount', e.target.value)} />
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
            <label className="form-label">Raporlayan *</label>
            <input className="input" placeholder="Dr. Ad Soyad" value={form.reportedBy} onChange={(e) => f('reportedBy', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Olay Açıklaması</label>
            <textarea className="input resize-none" rows={3} placeholder="Olayın detaylı açıklaması..." value={form.description} onChange={(e) => f('description', e.target.value)} maxLength={500} />
          </div>
          <div>
            <label className="form-label">Notlar</label>
            <textarea className="input resize-none" rows={2} placeholder="Ek notlar..." value={form.notes} onChange={(e) => f('notes', e.target.value)} maxLength={500} />
          </div>
        </div>
      </Drawer>
    </div>
  );
}
