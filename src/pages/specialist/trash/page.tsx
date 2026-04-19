import { useState, useEffect, useCallback } from 'react';
import PageHeader from '@/components/base/PageHeader';
import EmptyState from '@/components/base/EmptyState';
import Button from '@/components/base/Button';
import { useApp } from '@/store/AppContext';
import { useAuth } from '@/store/AuthContext';
import { getDeletedFirms, restoreFirm } from '@/services/firmService';
import { getDeletedPersonnel, restorePersonnel } from '@/services/personnelService';
import type { AppFirm, AppPersonnel } from '@/types/database';

type TrashTab = 'firms' | 'personnel';

export default function SpecialistTrashPage() {
  const { session } = useAuth();
  const { showToast, refreshFirms, refreshPersonnel, organizationId } = useApp();

  const [tab, setTab] = useState<TrashTab>('firms');
  const [deletedFirms, setDeletedFirms] = useState<AppFirm[]>([]);
  const [deletedPersonnel, setDeletedPersonnel] = useState<AppPersonnel[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const orgId = organizationId ?? session?.organizationId;

  const fetchDeleted = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [firms, personnel] = await Promise.all([
        getDeletedFirms(orgId),
        getDeletedPersonnel(orgId),
      ]);
      setDeletedFirms(firms);
      setDeletedPersonnel(personnel);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  }, [orgId, showToast]);

  useEffect(() => {
    fetchDeleted();
  }, [fetchDeleted]);

  const handleRestoreFirm = async (id: string) => {
    if (!orgId || !session) return;
    setRestoringId(id);
    try {
      await restoreFirm(id, session.userId, orgId);
      setDeletedFirms((prev) => prev.filter((f) => f.id !== id));
      await refreshFirms();
      showToast('Firma geri yüklendi');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Geri yükleme başarısız', 'error');
    } finally {
      setRestoringId(null);
    }
  };

  const handleRestorePersonnel = async (id: string) => {
    if (!orgId || !session) return;
    setRestoringId(id);
    try {
      await restorePersonnel(id, session.userId, orgId);
      setDeletedPersonnel((prev) => prev.filter((p) => p.id !== id));
      await refreshPersonnel();
      showToast('Personel geri yüklendi');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Geri yükleme başarısız', 'error');
    } finally {
      setRestoringId(null);
    }
  };

  const totalCount = deletedFirms.length + deletedPersonnel.length;

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Çöp Kutusu"
        description="Silinen öğeler buradan geri yüklenebilir"
        action={
          <Button variant="secondary" icon="ri-refresh-line" onClick={fetchDeleted}>
            Yenile
          </Button>
        }
      />

      {/* Tab switcher */}
      <div
        className="inline-flex p-1 rounded-full mb-5"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {([
          { key: 'firms', label: 'Firmalar', count: deletedFirms.length, icon: 'ri-building-2-line' },
          { key: 'personnel', label: 'Personel', count: deletedPersonnel.length, icon: 'ri-team-line' },
        ] as { key: TrashTab; label: string; count: number; icon: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer whitespace-nowrap"
            style={{
              backgroundColor: tab === t.key ? 'var(--card)' : 'transparent',
              color: tab === t.key ? 'var(--text-primary)' : 'var(--text-muted)',
              border: tab === t.key ? '1px solid var(--border)' : '1px solid transparent',
            }}
          >
            <i className={`${t.icon} text-sm`} />
            {t.label}
            {t.count > 0 && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)' }}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div
          className="rounded-xl flex items-center justify-center py-20"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="text-center">
            <i className="ri-loader-4-line text-2xl animate-spin" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>Yükleniyor...</p>
          </div>
        </div>
      ) : tab === 'firms' ? (
        deletedFirms.length === 0 ? (
          <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
            <EmptyState
              icon="ri-building-2-line"
              title="Silinmiş firma yok"
              description="Silinen firmalar burada görünecek."
            />
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
            <table className="w-full">
              <thead className="table-head">
                <tr>
                  {['Firma Adı', 'Sektör', 'Çalışan', 'Tehlike Sınıfı', 'İşlem'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deletedFirms.map((firm) => (
                  <tr key={firm.id} className="table-row">
                    <td className="table-cell-primary">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
                          style={{ backgroundColor: 'var(--danger-bg)' }}
                        >
                          <i className="ri-building-2-line text-xs" style={{ color: 'var(--danger)' }} />
                        </div>
                        {firm.name}
                      </div>
                    </td>
                    <td className="table-cell" style={{ color: 'var(--text-muted)' }}>{firm.sector}</td>
                    <td className="table-cell" style={{ color: 'var(--text-muted)' }}>{firm.employeeCount}</td>
                    <td className="table-cell" style={{ color: 'var(--text-muted)' }}>{firm.dangerClass}</td>
                    <td className="table-cell">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon="ri-refresh-line"
                        onClick={() => handleRestoreFirm(firm.id)}
                        disabled={restoringId === firm.id}
                      >
                        {restoringId === firm.id ? 'Geri Yükleniyor...' : 'Geri Yükle'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        deletedPersonnel.length === 0 ? (
          <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
            <EmptyState
              icon="ri-team-line"
              title="Silinmiş personel yok"
              description="Silinen personel burada görünecek."
            />
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
            <table className="w-full">
              <thead className="table-head">
                <tr>
                  {['Ad Soyad', 'Rol', 'E-posta', 'Telefon', 'İşlem'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deletedPersonnel.map((person) => (
                  <tr key={person.id} className="table-row">
                    <td className="table-cell-primary">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0"
                          style={{ backgroundColor: 'var(--danger-bg)' }}
                        >
                          <i className="ri-user-line text-xs" style={{ color: 'var(--danger)' }} />
                        </div>
                        {person.name}
                      </div>
                    </td>
                    <td className="table-cell" style={{ color: 'var(--text-muted)' }}>
                      {person.role === 'doctor' ? 'Hekim' : 'Uzman'}
                    </td>
                    <td className="table-cell" style={{ color: 'var(--text-muted)' }}>{person.email}</td>
                    <td className="table-cell" style={{ color: 'var(--text-muted)' }}>{person.phone}</td>
                    <td className="table-cell">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon="ri-refresh-line"
                        onClick={() => handleRestorePersonnel(person.id)}
                        disabled={restoringId === person.id}
                      >
                        {restoringId === person.id ? 'Geri Yükleniyor...' : 'Geri Yükle'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {!loading && totalCount > 0 && (
        <p className="text-xs mt-4 text-center" style={{ color: 'var(--text-muted)' }}>
          Toplam {totalCount} silinmiş öğe · Kalıcı silme sadece yönetici tarafından yapılabilir
        </p>
      )}
    </div>
  );
}
