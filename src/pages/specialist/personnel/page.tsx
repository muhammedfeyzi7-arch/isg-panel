import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/store/AuthContext';
import PageHeader from '@/components/base/PageHeader';
import StatusBadge from '@/components/base/StatusBadge';
import EmptyState from '@/components/base/EmptyState';
import AddWorkerDrawer from './components/AddWorkerDrawer';
import WorkerDetailDrawer from './components/WorkerDetailDrawer';
import { getWorkersForSpecialist } from '@/services/firmWorkerService';
import type { FirmWorker } from '@/services/firmWorkerService';

const workStatusLabel: Record<string, string> = {
  active: 'Aktif',
  passive: 'Pasif',
  on_leave: 'İzinli',
  terminated: 'Ayrıldı',
};

export default function SpecialistPersonnelPage() {
  const { session } = useAuth();
  const [workers, setWorkers] = useState<FirmWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [firmFilter, setFirmFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<FirmWorker | null>(null);

  const loadWorkers = useCallback(async () => {
    if (!session?.userId) return;
    setLoading(true);
    try {
      const data = await getWorkersForSpecialist(session.userId);
      setWorkers(data);
    } catch {
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  }, [session?.userId]);

  useEffect(() => { loadWorkers(); }, [loadWorkers]);

  const firmNames = useMemo(() => {
    const names = new Set<string>();
    workers.forEach((w) => { if (w.firmName) names.add(w.firmName); });
    return [...names].sort();
  }, [workers]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return workers.filter((w) => {
      const matchSearch = !search
        || w.fullName.toLowerCase().includes(q)
        || (w.tcNo ?? '').includes(q)
        || (w.phone ?? '').includes(q)
        || (w.jobTitle ?? '').toLowerCase().includes(q);
      const matchFirm = !firmFilter || w.firmName === firmFilter;
      const matchStatus = !statusFilter || w.workStatus === statusFilter;
      return matchSearch && matchFirm && matchStatus;
    });
  }, [workers, search, firmFilter, statusFilter]);

  const clearFilters = () => { setSearch(''); setFirmFilter(''); setStatusFilter(''); };

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Personel"
        description="Atanmış firmalarınızdaki çalışanlar"
        action={
          <button
            onClick={() => setAddOpen(true)}
            className="btn-primary flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-user-add-line text-sm" />
            Personel Ekle
          </button>
        }
      />

      {/* Filters */}
      <div className="filter-bar mb-5">
        <div className="relative flex-1 max-w-xs">
          <div className="w-4 h-4 flex items-center justify-center absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
            <i className="ri-search-line text-sm" />
          </div>
          <input
            className="input pl-9"
            placeholder="İsim, TC, telefon ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {firmNames.length > 0 && (
          <select className="input w-auto cursor-pointer" value={firmFilter} onChange={(e) => setFirmFilter(e.target.value)}>
            <option value="">Tüm Firmalar</option>
            {firmNames.map((f) => <option key={f}>{f}</option>)}
          </select>
        )}
        <select className="input w-auto cursor-pointer" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Tüm Durumlar</option>
          <option value="active">Aktif</option>
          <option value="passive">Pasif</option>
          <option value="on_leave">İzinli</option>
          <option value="terminated">Ayrıldı</option>
        </select>
        {(search || firmFilter || statusFilter) && (
          <button onClick={clearFilters} className="text-xs cursor-pointer whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
            Temizle
          </button>
        )}
        <span className="text-xs ml-auto whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{filtered.length} personel</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <i className="ri-loader-4-line animate-spin text-2xl" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : workers.length === 0 ? (
        <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <EmptyState
            icon="ri-team-line"
            title="Henüz personel yok"
            description="Atanmış firmalarınıza personel eklemek için 'Personel Ekle' butonunu kullanın."
            actionLabel="Personel Ekle"
            onAction={() => setAddOpen(true)}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <EmptyState
            icon="ri-search-line"
            title="Sonuç bulunamadı"
            description="Arama kriterlerinize uygun personel yok."
            actionLabel="Filtreleri Temizle"
            onAction={clearFilters}
          />
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
            <table className="w-full">
              <thead className="table-head">
                <tr>
                  {['Ad Soyad', 'TC Kimlik No', 'Telefon', 'Firma', 'Görev / Unvan', 'İşe Giriş', 'Durum'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((w) => (
                  <tr
                    key={w.id}
                    className="table-row cursor-pointer"
                    onClick={() => setSelectedWorker(w)}
                  >
                    <td className="table-cell-primary">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                          <i className="ri-user-line text-sm" style={{ color: 'var(--text-muted)' }} />
                        </div>
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{w.fullName}</p>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                        {w.tcNo ? `${w.tcNo.slice(0, 3)}****${w.tcNo.slice(-4)}` : '—'}
                      </span>
                    </td>
                    <td className="table-cell" style={{ color: 'var(--text-secondary)' }}>{w.phone ?? '—'}</td>
                    <td className="table-cell">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                        {w.firmName ?? '—'}
                      </span>
                    </td>
                    <td className="table-cell" style={{ color: 'var(--text-secondary)' }}>{w.jobTitle ?? '—'}</td>
                    <td className="table-cell" style={{ color: 'var(--text-muted)' }}>
                      {w.startDate ? new Date(w.startDate).toLocaleDateString('tr-TR') : '—'}
                    </td>
                    <td className="table-cell">
                      <StatusBadge status={workStatusLabel[w.workStatus] ?? w.workStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((w) => (
              <button
                key={w.id}
                onClick={() => setSelectedWorker(w)}
                className="w-full text-left rounded-xl p-4 cursor-pointer transition-colors"
                style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--text-secondary)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 flex items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <i className="ri-user-line text-base" style={{ color: 'var(--text-muted)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{w.fullName}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{w.jobTitle ?? 'Görev belirtilmemiş'}</p>
                  </div>
                  <StatusBadge status={workStatusLabel[w.workStatus] ?? w.workStatus} />
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {w.firmName && (
                    <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                      <i className="ri-building-2-line text-xs" />{w.firmName}
                    </span>
                  )}
                  {w.phone && (
                    <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                      <i className="ri-phone-line text-xs" />{w.phone}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <AddWorkerDrawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={loadWorkers}
      />

      <WorkerDetailDrawer
        worker={selectedWorker}
        onClose={() => setSelectedWorker(null)}
        onDeleted={loadWorkers}
      />
    </div>
  );
}
