import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/store/AuthContext';
import PageHeader from '@/components/base/PageHeader';
import StatusBadge from '@/components/base/StatusBadge';
import EmptyState from '@/components/base/EmptyState';
import Drawer from '@/components/base/Drawer';
import { getWorkersForDoctor } from '@/services/firmWorkerService';
import type { FirmWorker } from '@/services/firmWorkerService';

const workStatusLabel: Record<string, string> = {
  active: 'Aktif',
  passive: 'Pasif',
  on_leave: 'İzinli',
  terminated: 'Ayrıldı',
};

export default function DoctorPersonnelPage() {
  const { session } = useAuth();
  const [workers, setWorkers] = useState<FirmWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [firmFilter, setFirmFilter] = useState('');
  const [selectedWorker, setSelectedWorker] = useState<FirmWorker | null>(null);

  const loadWorkers = useCallback(async () => {
    if (!session?.userId) return;
    setLoading(true);
    try {
      const data = await getWorkersForDoctor(session.userId);
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
        || (w.phone ?? '').includes(q)
        || (w.jobTitle ?? '').toLowerCase().includes(q);
      const matchFirm = !firmFilter || w.firmName === firmFilter;
      return matchSearch && matchFirm;
    });
  }, [workers, search, firmFilter]);

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('tr-TR');
  };

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Personel"
        description="Atanmış firmalarınızdaki çalışanlar (salt okunur)"
      />

      {/* Info banner */}
      <div className="mb-5 px-4 py-3 rounded-lg flex items-center gap-3" style={{ backgroundColor: 'var(--info-bg)', border: '1px solid rgba(14,165,233,0.2)' }}>
        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
          <i className="ri-information-line text-sm" style={{ color: 'var(--info)' }} />
        </div>
        <p className="text-xs" style={{ color: 'var(--info-text)' }}>
          Personel bilgilerini yalnızca görüntüleyebilirsiniz. Düzenleme ve silme işlemleri için iş güvenliği uzmanınızla iletişime geçin.
        </p>
      </div>

      {/* Filters */}
      <div className="filter-bar mb-5">
        <div className="relative flex-1 max-w-xs">
          <div className="w-4 h-4 flex items-center justify-center absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
            <i className="ri-search-line text-sm" />
          </div>
          <input
            className="input pl-9"
            placeholder="İsim, telefon, görev ara..."
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
        {(search || firmFilter) && (
          <button onClick={() => { setSearch(''); setFirmFilter(''); }} className="text-xs cursor-pointer whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
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
            description="Atanmış firmalarınıza personel eklendiğinde burada görünecek."
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <EmptyState
            icon="ri-search-line"
            title="Sonuç bulunamadı"
            description="Arama kriterlerinizi değiştirin."
            actionLabel="Temizle"
            onAction={() => { setSearch(''); setFirmFilter(''); }}
          />
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
            <table className="w-full">
              <thead className="table-head">
                <tr>
                  {['Ad Soyad', 'Telefon', 'Firma', 'Görev / Unvan', 'İşe Giriş', 'Durum'].map((h) => (
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
                    <td className="table-cell" style={{ color: 'var(--text-secondary)' }}>{w.phone ?? '—'}</td>
                    <td className="table-cell">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                        {w.firmName ?? '—'}
                      </span>
                    </td>
                    <td className="table-cell" style={{ color: 'var(--text-secondary)' }}>{w.jobTitle ?? '—'}</td>
                    <td className="table-cell" style={{ color: 'var(--text-muted)' }}>
                      {formatDate(w.startDate)}
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

      {/* Detail Drawer — read-only for doctor */}
      <Drawer open={!!selectedWorker} onClose={() => setSelectedWorker(null)} title="Personel Detayı" width="w-[480px]">
        {selectedWorker && (
          <div className="p-6 space-y-5">
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 flex items-center justify-center rounded-xl flex-shrink-0" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                <i className="ri-user-line text-xl" style={{ color: 'var(--text-muted)' }} />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{selectedWorker.fullName}</h3>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{selectedWorker.jobTitle ?? 'Görev belirtilmemiş'}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <StatusBadge status={workStatusLabel[selectedWorker.workStatus] ?? selectedWorker.workStatus} />
                  {selectedWorker.firmName && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      <i className="ri-building-2-line mr-1 text-xs" />{selectedWorker.firmName}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Kişisel Bilgiler */}
            <div>
              <p className="drawer-section-title">Kişisel Bilgiler</p>
              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                {[
                  { label: 'Telefon', value: selectedWorker.phone ?? '—', icon: 'ri-phone-line' },
                  { label: 'Doğum Tarihi', value: formatDate(selectedWorker.birthDate), icon: 'ri-cake-line' },
                ].map((item, i) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 px-4 py-3"
                    style={{ borderBottom: i < 1 ? '1px solid var(--border-subtle)' : 'none', backgroundColor: 'var(--surface)' }}
                  >
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
                      <i className={`${item.icon} text-xs`} style={{ color: 'var(--text-muted)' }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                      <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* İş Bilgileri */}
            <div>
              <p className="drawer-section-title">İş Bilgileri</p>
              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                {[
                  { label: 'Firma', value: selectedWorker.firmName ?? '—', icon: 'ri-building-2-line' },
                  { label: 'Görev / Unvan', value: selectedWorker.jobTitle ?? '—', icon: 'ri-briefcase-line' },
                  { label: 'İşe Giriş Tarihi', value: formatDate(selectedWorker.startDate), icon: 'ri-calendar-check-line' },
                ].map((item, i) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 px-4 py-3"
                    style={{ borderBottom: i < 2 ? '1px solid var(--border-subtle)' : 'none', backgroundColor: 'var(--surface)' }}
                  >
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
                      <i className={`${item.icon} text-xs`} style={{ color: 'var(--text-muted)' }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                      <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Acil Durum */}
            {(selectedWorker.emergencyContact || selectedWorker.emergencyPhone) && (
              <div>
                <p className="drawer-section-title">Acil Durum</p>
                <div className="rounded-lg p-4 space-y-2" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
                  {selectedWorker.emergencyContact && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Kişi</span>
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{selectedWorker.emergencyContact}</span>
                    </div>
                  )}
                  {selectedWorker.emergencyPhone && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Telefon</span>
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{selectedWorker.emergencyPhone}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Read-only notice */}
            <div className="px-4 py-3 rounded-lg flex items-center gap-2" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
              <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                <i className="ri-lock-line text-xs" style={{ color: 'var(--text-muted)' }} />
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Personel bilgileri salt okunurdur. Değişiklik için uzmanınızla iletişime geçin.
              </p>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
