import { useState } from 'react';
import PageHeader from '@/components/base/PageHeader';
import StatusBadge from '@/components/base/StatusBadge';
import EmptyState from '@/components/base/EmptyState';
import Button from '@/components/base/Button';
import Drawer from '@/components/base/Drawer';
import { useApp } from '@/store/AppContext';
import type { ReportType } from '@/types/database';

type Tab = ReportType;

const emptyReportForm = { name: '', type: 'firm_report' as Tab, description: '' };

export default function RaporlarPage() {
  const { reports, addReport, deleteReport, showToast } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('firm_report');
  const [addOpen, setAddOpen] = useState(false);
  const [reportForm, setReportForm] = useState(emptyReportForm);
  const [formError, setFormError] = useState('');

  const filteredReports = reports.filter((r) => r.type === activeTab);

  const handleAddReport = async () => {
    if (!reportForm.name.trim()) { setFormError('Rapor adı zorunludur'); return; }
    await addReport({ name: reportForm.name.trim(), type: activeTab, description: reportForm.description });
    showToast(`"${reportForm.name}" raporu oluşturuldu`);
    setReportForm(emptyReportForm);
    setFormError('');
    setAddOpen(false);
  };

  const handleDelete = async (id: string, name: string) => {
    await deleteReport(id);
    showToast(`"${name}" raporu silindi`, 'error');
  };

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Raporlar"
        description="Firma ve ziyaret raporları"
        action={
          <Button variant="primary" icon="ri-add-line" onClick={() => setAddOpen(true)}>
            Yeni Rapor
          </Button>
        }
      />

      <div
        className="inline-flex items-center rounded-full p-1 mb-6"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {([
          ['firm_report', 'Firma Raporları', 'ri-building-2-line'],
          ['visit_report', 'Ziyaret Raporları', 'ri-map-pin-time-line'],
        ] as [Tab, string, string][]).map(([key, label, icon]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full transition-colors cursor-pointer whitespace-nowrap"
            style={{
              backgroundColor: activeTab === key ? 'var(--card)' : 'transparent',
              color: activeTab === key ? 'var(--text-primary)' : 'var(--text-muted)',
              border: activeTab === key ? '1px solid var(--border)' : '1px solid transparent',
            }}
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className={`${icon} text-sm`} />
            </div>
            {label}
          </button>
        ))}
      </div>

      {/* Desktop Table */}
      <div className="table-wrap hidden md:block">
        {filteredReports.length === 0 ? (
          <EmptyState
            icon="ri-file-chart-line"
            title={activeTab === 'firm_report' ? 'Henüz firma raporu yok' : 'Henüz ziyaret raporu yok'}
            description={activeTab === 'firm_report' ? 'Firma bazlı raporlarınız burada görünecek.' : 'Ziyaret özet raporlarınız burada görünecek.'}
            actionLabel="Rapor Oluştur"
            onAction={() => setAddOpen(true)}
          />
        ) : (
          <table className="w-full">
            <thead className="table-head">
              <tr>
                {['Rapor Adı', 'Oluşturan', 'Tarih', 'Durum', 'İşlemler'].map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((report) => (
                <tr
                  key={report.id}
                  className="transition-colors"
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <td className="table-cell-primary">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <i className="ri-file-chart-line text-sm" style={{ color: 'var(--text-muted)' }} />
                      </div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{report.name}</p>
                    </div>
                  </td>
                  <td className="table-cell whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{report.createdBy}</td>
                  <td className="table-cell whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{report.createdAt}</td>
                  <td className="table-cell"><StatusBadge status={report.status} /></td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" size="sm" icon="ri-eye-line">Görüntüle</Button>
                      <Button variant="secondary" size="sm" icon="ri-download-line">İndir</Button>
                      <button
                        onClick={() => handleDelete(report.id, report.name)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.backgroundColor = 'var(--danger-bg)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                        title="Sil"
                      >
                        <i className="ri-delete-bin-line text-sm" />
                      </button>
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
        {filteredReports.length === 0 ? (
          <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
            <EmptyState
              icon="ri-file-chart-line"
              title={activeTab === 'firm_report' ? 'Henüz firma raporu yok' : 'Henüz ziyaret raporu yok'}
              description="Rapor oluşturmak için + butonuna tıklayın."
              actionLabel="Rapor Oluştur"
              onAction={() => setAddOpen(true)}
            />
          </div>
        ) : (
          filteredReports.map((report) => (
            <div
              key={report.id}
              className="rounded-xl p-4"
              style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <i className="ri-file-chart-line text-base" style={{ color: 'var(--text-muted)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{report.name}</p>
                    <StatusBadge status={report.status} />
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{report.createdBy} · {report.createdAt}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <button className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg cursor-pointer whitespace-nowrap"
                  style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}>
                  <i className="ri-eye-line text-xs" /> Görüntüle
                </button>
                <button className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg cursor-pointer whitespace-nowrap"
                  style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}>
                  <i className="ri-download-line text-xs" /> İndir
                </button>
                <button
                  onClick={() => handleDelete(report.id, report.name)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer flex-shrink-0"
                  style={{ border: '1px solid var(--border)', color: 'var(--danger)', backgroundColor: 'var(--danger-bg)' }}
                >
                  <i className="ri-delete-bin-line text-sm" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Drawer
        open={addOpen}
        onClose={() => { setAddOpen(false); setFormError(''); }}
        title="Yeni Rapor Oluştur"
        width="w-[440px]"
        footer={
          <>
            <Button variant="secondary" className="flex-1" onClick={() => { setAddOpen(false); setFormError(''); }}>İptal</Button>
            <Button variant="primary" className="flex-1" onClick={handleAddReport}>Oluştur</Button>
          </>
        }
      >
        <div className="p-6 space-y-4">
          <div>
            <label className="form-label">Rapor Türü</label>
            <div className="flex gap-2">
              {([['firm_report', 'Firma Raporu'], ['visit_report', 'Ziyaret Raporu']] as [Tab, string][]).map(([t, label]) => (
                <button
                  key={t}
                  onClick={() => setReportForm({ ...reportForm, type: t })}
                  className="flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  style={{
                    border: `1px solid ${reportForm.type === t ? 'var(--text-primary)' : 'var(--border)'}`,
                    backgroundColor: reportForm.type === t ? 'var(--text-primary)' : 'transparent',
                    color: reportForm.type === t ? 'var(--card)' : 'var(--text-secondary)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="form-label">Rapor Adı *</label>
            <input
              className="input"
              placeholder="Örn: Aylık Ziyaret Özeti"
              value={reportForm.name}
              onChange={(e) => { setReportForm({ ...reportForm, name: e.target.value }); setFormError(''); }}
              style={formError ? { borderColor: 'var(--danger)' } : {}}
            />
            {formError && <p style={{ color: 'var(--danger)', fontSize: '11px', marginTop: '4px' }}>{formError}</p>}
          </div>
          <div>
            <label className="form-label">Açıklama</label>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="Rapor hakkında kısa açıklama..."
              value={reportForm.description}
              onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
            />
          </div>
        </div>
      </Drawer>
    </div>
  );
}
