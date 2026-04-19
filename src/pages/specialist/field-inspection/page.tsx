import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/store/AppContext';
import { useAuth } from '@/store/AuthContext';
import PageHeader from '@/components/base/PageHeader';
import Button from '@/components/base/Button';
import EmptyState from '@/components/base/EmptyState';
import DofStatsCards from '@/pages/specialist/field-inspection/components/DofStatsCards';
import DofFilters from '@/pages/specialist/field-inspection/components/DofFilters';
import DofTable from '@/pages/specialist/field-inspection/components/DofTable';
import DofAddDrawer from '@/pages/specialist/field-inspection/components/DofAddDrawer';
import DofDetailDrawer from '@/pages/specialist/field-inspection/components/DofDetailDrawer';
import DofCloseDrawer from '@/pages/specialist/field-inspection/components/DofCloseDrawer';
import DofEditDrawer from '@/pages/specialist/field-inspection/components/DofEditDrawer';
import { getDofRecords, deleteDofRecord } from '@/services/specialistService';
import { exportDofToExcel } from '@/services/dofExportService';
import type { DofRow } from '@/services/specialistService';

export default function FieldInspectionPage() {
  const { organizationId, showToast, firms, personnel } = useApp();
  const { session } = useAuth();

  const [records, setRecords] = useState<DofRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<'last30' | 'last90' | 'thisYear' | 'custom'>('last30');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed' | 'critical'>('all');

  const [addOpen, setAddOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<DofRow | null>(null);
  const [closeRecord, setCloseRecord] = useState<DofRow | null>(null);
  const [editRecord, setEditRecord] = useState<DofRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const getDateRange = useCallback(() => {
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    if (dateRange === 'last30') {
      const from = new Date(today); from.setDate(from.getDate() - 30);
      return { from: fmt(from), to: fmt(today) };
    }
    if (dateRange === 'last90') {
      const from = new Date(today); from.setDate(from.getDate() - 90);
      return { from: fmt(from), to: fmt(today) };
    }
    if (dateRange === 'thisYear') {
      return { from: `${today.getFullYear()}-01-01`, to: fmt(today) };
    }
    return { from: customFrom || undefined, to: customTo || undefined };
  }, [dateRange, customFrom, customTo]);

  const loadRecords = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const { from, to } = getDateRange();
      const data = await getDofRecords(organizationId, from, to);
      setRecords(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Veriler yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  }, [organizationId, getDateRange, showToast]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const filtered = records.filter((r) => {
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || r.dof_no.toLowerCase().includes(q)
      || r.title.toLowerCase().includes(q)
      || (r.firm?.name ?? '').toLowerCase().includes(q)
      || (r.personnel?.full_name ?? '').toLowerCase().includes(q)
      || r.responsible_person.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const stats = {
    total: records.length,
    open: records.filter((r) => r.status === 'open').length,
    closed: records.filter((r) => r.status === 'closed').length,
    critical: records.filter((r) => r.status === 'critical').length,
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDofRecord(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setDeleteConfirm(null);
      showToast('DÖF kaydı silindi');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Silinemedi', 'error');
    }
  };

  const handleExport = async () => {
    if (filtered.length === 0) { showToast('Dışa aktarılacak kayıt yok', 'error'); return; }
    setExporting(true);
    try {
      await exportDofToExcel(filtered);
      showToast('Excel ve HTML raporu indirildi');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Export başarısız', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Saha Denetimi — DÖF"
        description="Düzeltici ve Önleyici Faaliyet kayıtları"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="btn btn-secondary whitespace-nowrap flex items-center gap-2"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-file-excel-line text-sm" style={{ color: '#16a34a' }} />
              </div>
              {exporting ? 'Hazırlanıyor...' : 'Excel İndir'}
            </button>
            <Button variant="primary" icon="ri-add-line" onClick={() => setAddOpen(true)}>
              Yeni DÖF Ekle
            </Button>
          </div>
        }
      />

      <DofStatsCards stats={stats} />

      <DofFilters
        search={search}
        onSearchChange={setSearch}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        customFrom={customFrom}
        customTo={customTo}
        onCustomFromChange={setCustomFrom}
        onCustomToChange={setCustomTo}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <EmptyState
            icon="ri-file-warning-line"
            title="DÖF kaydı bulunamadı"
            description="Seçilen tarih aralığında kayıt yok veya arama kriterlerine uyan sonuç bulunamadı."
            actionLabel="Yeni DÖF Ekle"
            onAction={() => setAddOpen(true)}
          />
        </div>
      ) : (
        <DofTable
          records={filtered}
          onDetail={setDetailRecord}
          onDelete={(id) => setDeleteConfirm(id)}
          onClose={(r) => setCloseRecord(r)}
          onEdit={(r) => setEditRecord(r)}
        />
      )}

      {/* Add Drawer */}
      <DofAddDrawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        firms={firms}
        personnel={personnel}
        organizationId={organizationId ?? ''}
        userId={session?.userId ?? ''}
        onCreated={(rec) => {
          setRecords((prev) => [rec, ...prev]);
          showToast('DÖF kaydı oluşturuldu');
          setAddOpen(false);
        }}
      />

      {/* Detail Drawer */}
      {detailRecord && (
        <DofDetailDrawer
          record={detailRecord}
          onClose={() => setDetailRecord(null)}
          onCloseRequest={(r) => { setDetailRecord(null); setCloseRecord(r); }}
          onDelete={(id) => { setDetailRecord(null); setDeleteConfirm(id); }}
        />
      )}

      {/* Edit Drawer */}
      {editRecord && (
        <DofEditDrawer
          record={editRecord}
          onClose={() => setEditRecord(null)}
          firms={firms}
          personnel={personnel}
          onUpdated={(updated) => {
            setRecords((prev) => prev.map((r) => r.id === updated.id ? updated : r));
            setEditRecord(null);
            showToast('DÖF kaydı güncellendi');
          }}
        />
      )}

      {/* Close Drawer */}
      {closeRecord && (
        <DofCloseDrawer
          record={closeRecord}
          onClose={() => setCloseRecord(null)}
          onClosed={(updated) => {
            setRecords((prev) => prev.map((r) => r.id === updated.id ? updated : r));
            setCloseRecord(null);
            showToast('DÖF başarıyla kapatıldı');
          }}
        />
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(15,23,42,0.35)' }}>
          <div className="rounded-2xl p-6 w-[360px]" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="w-12 h-12 flex items-center justify-center rounded-xl mb-4" style={{ backgroundColor: 'var(--danger-bg)' }}>
              <i className="ri-delete-bin-line text-xl" style={{ color: 'var(--danger)' }} />
            </div>
            <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>DÖF Kaydını Sil</h3>
            <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>Bu işlem geri alınamaz. Kaydı silmek istediğinize emin misiniz?</p>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setDeleteConfirm(null)}>İptal</Button>
              <button
                className="flex-1 btn whitespace-nowrap text-sm font-medium rounded-lg px-4 py-2 cursor-pointer"
                style={{ backgroundColor: 'var(--danger)', color: '#fff' }}
                onClick={() => handleDelete(deleteConfirm)}
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
