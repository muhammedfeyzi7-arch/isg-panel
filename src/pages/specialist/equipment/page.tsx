import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/store/AuthContext';
import { useApp } from '@/store/AppContext';
import PageHeader from '@/components/base/PageHeader';
import Button from '@/components/base/Button';
import EmptyState from '@/components/base/EmptyState';
import {
  getEquipment, createEquipment, updateEquipment, deleteEquipment,
  type EquipmentRow,
} from '@/services/specialistService';
import EquipmentStatsCards from './components/EquipmentStatsCards';
import EquipmentTable from './components/EquipmentTable';
import EquipmentAddDrawer, { type EquipmentFormData } from './components/EquipmentAddDrawer';
import EquipmentEditDrawer from './components/EquipmentEditDrawer';
import EquipmentDetailDrawer from './components/EquipmentDetailDrawer';

type FilterStatus = '' | 'Uygun' | 'Uygun Değil' | 'upcoming';

export default function EquipmentPage() {
  const { session } = useAuth();
  const { firms, showToast } = useApp();

  const [equipmentList, setEquipmentList] = useState<EquipmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('');
  const [search, setSearch] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EquipmentRow | null>(null);
  const [detailTarget, setDetailTarget] = useState<EquipmentRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.organizationId) return;
    setLoading(true);
    try {
      const data = await getEquipment(session.organizationId);
      setEquipmentList(data);
    } catch {
      showToast('Ekipmanlar yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  }, [session?.organizationId, showToast]);

  useEffect(() => { load(); }, [load]);

  const today = new Date();
  const in30Days = new Date();
  in30Days.setDate(today.getDate() + 30);

  const filtered = equipmentList.filter((e) => {
    if (search && !e.name.toLowerCase().includes(search.toLowerCase()) &&
      !(e.firm?.name ?? '').toLowerCase().includes(search.toLowerCase()) &&
      !(e.serial_no ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'upcoming') {
      if (!e.next_control_date) return false;
      const d = new Date(e.next_control_date);
      return d >= today && d <= in30Days;
    }
    if (filter) return e.status === filter;
    return true;
  });

  const handleAdd = async (data: EquipmentFormData) => {
    if (!data.name.trim()) { showToast('Ekipman adı zorunludur', 'error'); return; }
    if (!session) return;
    try {
      const created = await createEquipment(session.organizationId, session.userId, {
        name: data.name,
        category: data.category,
        equipmentType: data.equipmentType,
        firmId: data.firmId || null,
        area: data.area,
        serialNo: data.serialNo,
        brand: data.brand,
        lastControlDate: data.lastControlDate,
        nextControlDate: data.nextControlDate,
        status: data.status,
        hasDocument: data.hasDocument,
        documentUrl: data.documentUrl,
        notes: data.notes,
      });
      setEquipmentList((prev) => [created, ...prev]);
      setAddOpen(false);
      showToast('Ekipman eklendi');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Hata', 'error');
    }
  };

  const handleEdit = async (id: string, data: EquipmentFormData) => {
    if (!data.name.trim()) { showToast('Ekipman adı zorunludur', 'error'); return; }
    try {
      const updated = await updateEquipment(id, {
        name: data.name,
        category: data.category,
        equipmentType: data.equipmentType,
        firmId: data.firmId || null,
        area: data.area,
        serialNo: data.serialNo,
        brand: data.brand,
        lastControlDate: data.lastControlDate,
        nextControlDate: data.nextControlDate,
        status: data.status,
        hasDocument: data.hasDocument,
        documentUrl: data.documentUrl,
        notes: data.notes,
      });
      setEquipmentList((prev) => prev.map((e) => e.id === id ? updated : e));
      setEditTarget(null);
      showToast('Ekipman güncellendi');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Hata', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEquipment(id);
      setEquipmentList((prev) => prev.filter((e) => e.id !== id));
      setDeleteConfirm(null);
      showToast('Ekipman silindi');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Silinemedi', 'error');
    }
  };

  const filterTabs: { label: string; value: FilterStatus }[] = [
    { label: 'Tümü', value: '' },
    { label: 'Uygun', value: 'Uygun' },
    { label: 'Uygun Değil', value: 'Uygun Değil' },
    { label: 'Kontrol Yaklaşan', value: 'upcoming' },
  ];

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Ekipman Yönetimi"
        description="Firma ekipman ve KKD takip listesi"
        action={
          <Button variant="primary" icon="ri-add-line" onClick={() => setAddOpen(true)}>
            Ekipman Ekle
          </Button>
        }
      />

      {/* Stats */}
      <EquipmentStatsCards equipmentList={equipmentList} />

      {/* Filters + Search */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className="px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap transition-all"
              style={{
                backgroundColor: filter === tab.value ? 'var(--card)' : 'transparent',
                color: filter === tab.value ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: filter === tab.value ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-w-[200px] relative">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }} />
          <input
            className="input pl-8 text-sm"
            placeholder="Ekipman adı, firma veya seri no ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <span className="text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
          {filtered.length} ekipman
        </span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <i className="ri-loader-4-line animate-spin text-2xl" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <EmptyState
            icon="ri-tools-line"
            title="Ekipman bulunamadı"
            description={filter || search ? 'Seçili kriterlere uygun ekipman yok.' : 'Henüz ekipman eklenmemiş.'}
            actionLabel={!filter && !search ? 'Ekipman Ekle' : undefined}
            onAction={!filter && !search ? () => setAddOpen(true) : undefined}
          />
        </div>
      ) : (
        <EquipmentTable
          equipmentList={filtered}
          deleteConfirm={deleteConfirm}
          onEdit={(e) => setEditTarget(e)}
          onDetail={(e) => setDetailTarget(e)}
          onDeleteConfirm={setDeleteConfirm}
          onDelete={handleDelete}
        />
      )}

      {/* Drawers */}
      <EquipmentAddDrawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={handleAdd}
        firms={firms}
        organizationId={session?.organizationId ?? ''}
      />

      <EquipmentEditDrawer
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        equipment={editTarget}
        onSave={handleEdit}
        firms={firms}
        organizationId={session?.organizationId ?? ''}
      />

      <EquipmentDetailDrawer
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        equipment={detailTarget}
        onEdit={() => {
          if (detailTarget) {
            setEditTarget(detailTarget);
            setDetailTarget(null);
          }
        }}
      />
    </div>
  );
}
