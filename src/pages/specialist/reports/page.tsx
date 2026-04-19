import PageHeader from '@/components/base/PageHeader';
import StatusBadge from '@/components/base/StatusBadge';
import EmptyState from '@/components/base/EmptyState';
import { useApp } from '@/store/AppContext';

export default function SpecialistReportsPage() {
  const { reports } = useApp();

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <PageHeader title="Raporlar" description="Oluşturduğunuz raporlar ve analizler" />

      {reports.length === 0 ? (
        <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <EmptyState icon="ri-file-chart-line" title="Henüz rapor yok" description="Oluşturduğunuz raporlar burada listelenecek." />
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <table className="w-full">
            <thead className="table-head">
              <tr>{['Rapor Adı', 'Tür', 'Oluşturulma', 'Durum'].map((h) => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="table-row">
                  <td className="table-cell-primary">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <i className="ri-file-chart-line text-xs" style={{ color: 'var(--text-muted)' }} />
                      </div>
                      {r.name}
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                      {r.type === 'firm_report' ? 'Firma Raporu' : 'Ziyaret Raporu'}
                    </span>
                  </td>
                  <td className="table-cell" style={{ color: 'var(--text-muted)' }}>{r.createdAt}</td>
                  <td className="table-cell"><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
