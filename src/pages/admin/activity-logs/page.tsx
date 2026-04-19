import { useState, useEffect, useCallback } from 'react';
import PageHeader from '@/components/base/PageHeader';
import EmptyState from '@/components/base/EmptyState';
import Button from '@/components/base/Button';
import { useApp } from '@/store/AppContext';
import { getActivityLogs } from '@/services/activityLogService';
import type { ActivityLog, LogAction, LogEntityType } from '@/services/activityLogService';

// ─── Label maps ───────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<LogAction, string> = {
  user_created: 'Kullanıcı Oluşturuldu',
  user_role_changed: 'Rol Değiştirildi',
  user_status_changed: 'Durum Değiştirildi',
  user_deleted: 'Kullanıcı Silindi',
  user_restored: 'Kullanıcı Geri Yüklendi',
  firm_created: 'Firma Oluşturuldu',
  firm_updated: 'Firma Güncellendi',
  firm_deleted: 'Firma Silindi',
  firm_restored: 'Firma Geri Yüklendi',
  firm_assigned: 'Firma Atandı',
  firm_unassigned: 'Firma Ataması Kaldırıldı',
  visit_started: 'Ziyaret Başlatıldı',
  visit_ended: 'Ziyaret Tamamlandı',
  visit_deleted: 'Ziyaret Silindi',
  dof_created: 'DÖF Oluşturuldu',
  dof_updated: 'DÖF Güncellendi',
  dof_closed: 'DÖF Kapatıldı',
  dof_deleted: 'DÖF Silindi',
};

const ENTITY_LABELS: Record<LogEntityType, string> = {
  profile: 'Kullanıcı',
  firm: 'Firma',
  firm_assignment: 'Atama',
  visit: 'Ziyaret',
  dof_record: 'DÖF',
  training: 'Eğitim',
  equipment: 'Ekipman',
  work_permit: 'İş İzni',
  health_record: 'Sağlık Kaydı',
  firm_document: 'Firma Belgesi',
};

const ACTION_COLORS: Partial<Record<LogAction, { bg: string; text: string }>> = {
  firm_created: { bg: 'rgba(34,197,94,0.1)', text: '#16a34a' },
  user_created: { bg: 'rgba(34,197,94,0.1)', text: '#16a34a' },
  visit_started: { bg: 'rgba(59,130,246,0.1)', text: '#2563eb' },
  visit_ended: { bg: 'rgba(139,92,246,0.1)', text: '#7c3aed' },
  firm_deleted: { bg: 'rgba(239,68,68,0.1)', text: '#dc2626' },
  user_deleted: { bg: 'rgba(239,68,68,0.1)', text: '#dc2626' },
  firm_restored: { bg: 'rgba(234,179,8,0.1)', text: '#a16207' },
  user_restored: { bg: 'rgba(234,179,8,0.1)', text: '#a16207' },
};

const ACTION_ICONS: Partial<Record<LogAction, string>> = {
  firm_created: 'ri-building-2-line',
  firm_updated: 'ri-edit-line',
  firm_deleted: 'ri-delete-bin-line',
  firm_restored: 'ri-refresh-line',
  firm_assigned: 'ri-user-add-line',
  firm_unassigned: 'ri-user-unfollow-line',
  user_created: 'ri-user-add-line',
  user_role_changed: 'ri-shield-user-line',
  user_status_changed: 'ri-toggle-line',
  user_deleted: 'ri-user-unfollow-line',
  user_restored: 'ri-user-follow-line',
  visit_started: 'ri-map-pin-2-line',
  visit_ended: 'ri-checkbox-circle-line',
  visit_deleted: 'ri-delete-bin-line',
  dof_created: 'ri-alert-line',
  dof_updated: 'ri-edit-line',
  dof_closed: 'ri-lock-line',
  dof_deleted: 'ri-delete-bin-line',
};

// ─── Filters ──────────────────────────────────────────────────────────────────

const ALL_ACTIONS: LogAction[] = [
  'user_created', 'user_role_changed', 'user_status_changed', 'user_deleted', 'user_restored',
  'firm_created', 'firm_updated', 'firm_deleted', 'firm_restored', 'firm_assigned', 'firm_unassigned',
  'visit_started', 'visit_ended', 'visit_deleted',
  'dof_created', 'dof_updated', 'dof_closed', 'dof_deleted',
];

const ALL_ENTITIES: LogEntityType[] = [
  'profile', 'firm', 'firm_assignment', 'visit', 'dof_record',
  'training', 'equipment', 'work_permit', 'health_record', 'firm_document',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function shortId(id: string | null): string {
  if (!id) return '—';
  return id.slice(0, 8) + '...';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ActivityLogsPage() {
  const { organizationId } = useApp();

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterAction, setFilterAction] = useState<LogAction | ''>('');
  const [filterEntity, setFilterEntity] = useState<LogEntityType | ''>('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [limit, setLimit] = useState(100);

  const fetchLogs = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getActivityLogs(organizationId, limit);
      setLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Loglar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [organizationId, limit]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // ── Filtered logs ──────────────────────────────────────────────────────────
  const filtered = logs.filter((log) => {
    if (filterAction && log.action !== filterAction) return false;
    if (filterEntity && log.entity_type !== filterEntity) return false;
    if (filterDateFrom) {
      const logDate = log.created_at.split('T')[0];
      if (logDate < filterDateFrom) return false;
    }
    if (filterDateTo) {
      const logDate = log.created_at.split('T')[0];
      if (logDate > filterDateTo) return false;
    }
    return true;
  });

  const clearFilters = () => {
    setFilterAction('');
    setFilterEntity('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const hasFilters = filterAction || filterEntity || filterDateFrom || filterDateTo;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Aktivite Logları"
        description="Sistemdeki tüm önemli işlemlerin kayıtları"
        action={
          <Button variant="secondary" icon="ri-refresh-line" onClick={fetchLogs}>
            Yenile
          </Button>
        }
      />

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div
        className="rounded-xl p-4 mb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
        style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
      >
        {/* Action filter */}
        <div>
          <label className="form-label">İşlem Türü</label>
          <select
            className="input text-sm"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value as LogAction | '')}
          >
            <option value="">Tümü</option>
            {ALL_ACTIONS.map((a) => (
              <option key={a} value={a}>{ACTION_LABELS[a]}</option>
            ))}
          </select>
        </div>

        {/* Entity filter */}
        <div>
          <label className="form-label">Varlık Türü</label>
          <select
            className="input text-sm"
            value={filterEntity}
            onChange={(e) => setFilterEntity(e.target.value as LogEntityType | '')}
          >
            <option value="">Tümü</option>
            {ALL_ENTITIES.map((e) => (
              <option key={e} value={e}>{ENTITY_LABELS[e]}</option>
            ))}
          </select>
        </div>

        {/* Date from */}
        <div>
          <label className="form-label">Başlangıç Tarihi</label>
          <input
            type="date"
            className="input text-sm"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
          />
        </div>

        {/* Date to */}
        <div>
          <label className="form-label">Bitiş Tarihi</label>
          <input
            type="date"
            className="input text-sm"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
          />
        </div>
      </div>

      {/* ── Stats bar ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {filtered.length} kayıt gösteriliyor
            {hasFilters && ` (${logs.length} toplam)`}
          </span>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-xs px-2 py-1 rounded-md cursor-pointer transition-colors"
              style={{ backgroundColor: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              Filtreleri Temizle
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Limit:</span>
          <select
            className="text-xs px-2 py-1 rounded-md cursor-pointer"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            <option value={50}>Son 50</option>
            <option value={100}>Son 100</option>
            <option value={250}>Son 250</option>
            <option value={500}>Son 500</option>
          </select>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      {loading ? (
        <div
          className="rounded-xl flex items-center justify-center py-20"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="text-center">
            <i className="ri-loader-4-line text-2xl animate-spin" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>Loglar yükleniyor...</p>
          </div>
        </div>
      ) : error ? (
        <div
          className="rounded-xl p-6"
          style={{ backgroundColor: 'var(--danger-bg)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <div className="flex items-center gap-2">
            <i className="ri-error-warning-line" style={{ color: 'var(--danger)' }} />
            <p className="text-sm" style={{ color: 'var(--danger-text)' }}>{error}</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <EmptyState
            icon="ri-file-list-3-line"
            title="Log bulunamadı"
            description={hasFilters ? 'Seçili filtrelere uygun kayıt yok. Filtreleri temizleyin.' : 'Henüz aktivite logu yok.'}
            actionLabel={hasFilters ? 'Filtreleri Temizle' : undefined}
            onAction={hasFilters ? clearFilters : undefined}
          />
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <table className="w-full">
            <thead className="table-head">
              <tr>
                <th>İşlem</th>
                <th>Varlık Türü</th>
                <th>Varlık ID</th>
                <th>Kullanıcı ID</th>
                <th>Tarih</th>
                <th>Saat</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => {
                const color = ACTION_COLORS[log.action as LogAction] ?? { bg: 'var(--surface)', text: 'var(--text-secondary)' };
                const icon = ACTION_ICONS[log.action as LogAction] ?? 'ri-information-line';
                return (
                  <tr key={log.id} className="table-row">
                    <td className="table-cell">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
                          style={{ backgroundColor: color.bg }}
                        >
                          <i className={`${icon} text-xs`} style={{ color: color.text }} />
                        </div>
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{ backgroundColor: color.bg, color: color.text }}
                        >
                          {ACTION_LABELS[log.action as LogAction] ?? log.action}
                        </span>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                      >
                        {ENTITY_LABELS[log.entity_type as LogEntityType] ?? log.entity_type}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                        {shortId(log.entity_id)}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                        {shortId(log.user_id)}
                      </span>
                    </td>
                    <td className="table-cell" style={{ color: 'var(--text-muted)' }}>
                      <span className="text-xs">{formatDate(log.created_at)}</span>
                    </td>
                    <td className="table-cell" style={{ color: 'var(--text-muted)' }}>
                      <span className="text-xs">{formatTime(log.created_at)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Load more */}
          {logs.length >= limit && (
            <div
              className="px-5 py-3 flex items-center justify-center"
              style={{ borderTop: '1px solid var(--border-subtle)' }}
            >
              <button
                onClick={() => setLimit((prev) => prev + 100)}
                className="text-xs px-4 py-2 rounded-lg cursor-pointer transition-colors"
                style={{ backgroundColor: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
              >
                Daha fazla yükle (+100)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
