import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/store/AuthContext';
import { useApp } from '@/store/AppContext';
import PageHeader from '@/components/base/PageHeader';
import StatusBadge from '@/components/base/StatusBadge';
import EmptyState from '@/components/base/EmptyState';
import { getFirmDocuments, type FirmDocumentRow } from '@/services/specialistService';

function daysLeft(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  const today = new Date();
  const exp = new Date(expiryDate);
  return Math.round((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getPriority(days: number | null, status: string): 'high' | 'medium' | 'low' {
  if (status === 'Süresi Dolmuş' || status === 'Eksik') return 'high';
  if (days !== null && days <= 14) return 'high';
  if (days !== null && days <= 30) return 'medium';
  return 'low';
}

const priorityConfig = {
  high: { label: 'Yüksek', color: 'var(--danger)', bg: 'var(--danger-bg)' },
  medium: { label: 'Orta', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  low: { label: 'Düşük', color: 'var(--info)', bg: 'var(--info-bg)' },
};

export default function DocumentTrackingPage() {
  const { session } = useAuth();
  const { showToast } = useApp();

  const [docs, setDocs] = useState<FirmDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session?.organizationId) return;
    setLoading(true);
    try {
      const data = await getFirmDocuments(session.organizationId);
      setDocs(data);
    } catch {
      showToast('Belgeler yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  }, [session?.organizationId, showToast]);

  useEffect(() => { load(); }, [load]);

  // Sadece aksiyon gerektiren belgeler
  const actionItems = docs.filter((d) => {
    if (d.status === 'Süresi Dolmuş' || d.status === 'Eksik') return true;
    const days = daysLeft(d.expiry_date);
    return days !== null && days <= 60;
  });

  const expired = actionItems.filter((d) => d.status === 'Süresi Dolmuş');
  const missing = actionItems.filter((d) => d.status === 'Eksik');
  const upcoming = actionItems.filter((d) => d.status === 'Yaklaşıyor' || (d.status === 'Güncel' && daysLeft(d.expiry_date) !== null && (daysLeft(d.expiry_date) ?? 999) <= 60));

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <PageHeader title="Belge Takibi" description="Eksik, süresi dolmuş ve yaklaşan belgeler" />

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-5 md:mb-6">
        {[
          { label: 'Süresi Dolmuş', count: expired.length, icon: 'ri-close-circle-line', color: 'var(--danger)', bg: 'var(--danger-bg)' },
          { label: 'Eksik Belge', count: missing.length, icon: 'ri-file-warning-line', color: 'var(--warning)', bg: 'var(--warning-bg)' },
          { label: 'Yaklaşıyor (60 gün)', count: upcoming.length, icon: 'ri-alarm-warning-line', color: 'var(--info)', bg: 'var(--info-bg)' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-5 flex items-center gap-4" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0" style={{ backgroundColor: s.bg }}>
              <i className={`${s.icon} text-lg`} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{s.count}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <i className="ri-loader-4-line animate-spin text-2xl" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : actionItems.length === 0 ? (
        <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <EmptyState icon="ri-shield-check-line" title="Tüm belgeler güncel" description="Aksiyon gerektiren belge bulunmuyor." />
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="card-header">
            <span className="card-title">Aksiyon Gerektiren Belgeler</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)', border: '1px solid rgba(239,68,68,0.2)' }}>
              {actionItems.length} belge
            </span>
          </div>
          <table className="w-full">
            <thead className="table-head">
              <tr>{['Belge', 'Firma', 'Durum', 'Son Kullanma', 'Kalan Gün', 'Öncelik'].map((h) => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {actionItems.map((item) => {
                const days = daysLeft(item.expiry_date);
                const priority = getPriority(days, item.status);
                const p = priorityConfig[priority];
                return (
                  <tr key={item.id} className="table-row">
                    <td className="table-cell-primary">
                      <div className="flex items-center gap-2">
                        <i className="ri-file-warning-line text-sm" style={{ color: item.status === 'Süresi Dolmuş' ? 'var(--danger)' : item.status === 'Eksik' ? 'var(--warning)' : 'var(--info)' }} />
                        {item.doc_name}
                      </div>
                    </td>
                    <td className="table-cell">{item.firm?.name ?? '—'}</td>
                    <td className="table-cell"><StatusBadge status={item.status} /></td>
                    <td className="table-cell" style={{ color: 'var(--text-muted)' }}>{item.expiry_date ?? '—'}</td>
                    <td className="table-cell">
                      {days !== null ? (
                        <span className="font-medium" style={{ color: days <= 14 ? 'var(--danger)' : 'var(--warning)' }}>
                          {days < 0 ? `${Math.abs(days)} gün geçti` : `${days} gün`}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: p.bg, color: p.color }}>
                        {p.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
