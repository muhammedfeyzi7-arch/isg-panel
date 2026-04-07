import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/store/AppContext';

interface DocRow {
  id: string;
  title: string;
  document_type: string;
  valid_until: string | null;
  company_id: string;
}

interface CompanyRow {
  id: string;
  name: string;
}

type DocStatus = 'expired' | 'upcoming' | 'active';

function getDocStatus(validUntil: string | null): DocStatus {
  if (!validUntil) return 'active';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(validUntil); d.setHours(0, 0, 0, 0);
  if (d < today) return 'expired';
  const in30 = new Date(today.getTime() + 30 * 86400000);
  if (d <= in30) return 'upcoming';
  return 'active';
}

export default function CompanyDocumentsWidget() {
  const { theme, setActiveModule } = useApp();
  const isDark = theme === 'dark';

  const [docs, setDocs] = useState<DocRow[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      const [docsRes, companiesRes] = await Promise.all([
        supabase
          .from('company_documents')
          .select('id, title, document_type, valid_until, company_id')
          .order('valid_until', { ascending: true }),
        supabase
          .from('companies')
          .select('id, name'),
      ]);
      if (!cancelled) {
        setDocs(docsRes.data ?? []);
        setCompanies(companiesRes.data ?? []);
        setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    const total = docs.length;
    const expired = docs.filter(d => getDocStatus(d.valid_until) === 'expired').length;
    const upcoming = docs.filter(d => getDocStatus(d.valid_until) === 'upcoming').length;
    const active = docs.filter(d => getDocStatus(d.valid_until) === 'active').length;
    return { total, expired, upcoming, active };
  }, [docs]);

  const criticalDocs = useMemo(() => {
    return docs
      .filter(d => getDocStatus(d.valid_until) === 'expired' || getDocStatus(d.valid_until) === 'upcoming')
      .sort((a, b) => {
        const statusOrder = { expired: 0, upcoming: 1, active: 2 };
        const sa = getDocStatus(a.valid_until);
        const sb = getDocStatus(b.valid_until);
        if (statusOrder[sa] !== statusOrder[sb]) return statusOrder[sa] - statusOrder[sb];
        if (!a.valid_until) return 1;
        if (!b.valid_until) return -1;
        return new Date(a.valid_until).getTime() - new Date(b.valid_until).getTime();
      })
      .slice(0, 6);
  }, [docs]);

  const getCompanyName = (companyId: string) =>
    companies.find(c => c.id === companyId)?.name ?? '—';

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getDaysLeft = (validUntil: string | null): number | null => {
    if (!validUntil) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(validUntil); d.setHours(0, 0, 0, 0);
    return Math.ceil((d.getTime() - today.getTime()) / 86400000);
  };

  const statItems = [
    {
      label: 'Toplam Evrak',
      value: stats.total,
      icon: 'ri-folder-3-line',
      color: '#6366F1',
      bg: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.07)',
      border: 'rgba(99,102,241,0.18)',
    },
    {
      label: 'Aktif',
      value: stats.active,
      icon: 'ri-checkbox-circle-line',
      color: '#10B981',
      bg: isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.07)',
      border: 'rgba(16,185,129,0.18)',
    },
    {
      label: 'Süresi Dolmuş',
      value: stats.expired,
      icon: 'ri-error-warning-line',
      color: '#EF4444',
      bg: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.07)',
      border: 'rgba(239,68,68,0.18)',
    },
    {
      label: 'Yaklaşan (30g)',
      value: stats.upcoming,
      icon: 'ri-timer-line',
      color: '#F59E0B',
      bg: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.07)',
      border: 'rgba(245,158,11,0.18)',
    },
  ];

  if (loading) {
    return (
      <div className="rounded-xl p-4 isg-card">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 rounded-full" style={{ background: 'linear-gradient(180deg, #6366F1, #8B5CF6)' }} />
          <h2 className="text-[12.5px] font-bold" style={{ color: 'var(--text-primary)' }}>Firma Evrakları</h2>
        </div>
        <div className="space-y-1.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-9 rounded-lg animate-pulse" style={{ background: 'var(--bg-item)' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-4 isg-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full" style={{ background: 'linear-gradient(180deg, #6366F1, #8B5CF6)' }} />
          <h2 className="text-[12.5px] font-bold" style={{ color: 'var(--text-primary)' }}>Firma Evrakları</h2>
          {(stats.expired > 0 || stats.upcoming > 0) && (
            <span
              className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              {stats.expired + stats.upcoming} uyarı
            </span>
          )}
        </div>
        <button
          onClick={() => setActiveModule('firma-evraklari')}
          className="flex items-center gap-1 text-[10.5px] font-semibold px-2 py-1 rounded-lg cursor-pointer whitespace-nowrap transition-all"
          style={{ background: 'rgba(99,102,241,0.08)', color: '#A5B4FC', border: '1px solid rgba(99,102,241,0.15)' }}
        >
          Tümünü Gör
          <i className="ri-arrow-right-line text-[10px]" />
        </button>
      </div>

      {/* Stat Mini Cards */}
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        {statItems.map(item => (
          <div
            key={item.label}
            className="rounded-lg p-2.5 text-center"
            style={{ background: item.bg, border: `1px solid ${item.border}` }}
          >
            <div className="w-6 h-6 flex items-center justify-center rounded-md mx-auto mb-1"
              style={{ background: `${item.color}18` }}>
              <i className={`${item.icon} text-[11px]`} style={{ color: item.color }} />
            </div>
            <p className="text-[16px] font-extrabold leading-none" style={{ color: item.color }}>{item.value}</p>
            <p className="text-[9px] mt-0.5 leading-tight" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
          </div>
        ))}
      </div>

      {/* Critical Docs List */}
      {criticalDocs.length > 0 ? (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
            <i className="ri-alarm-warning-line mr-1.5" style={{ color: '#F59E0B' }} />
            Kritik Evrak Uyarıları
          </p>
          <div className="space-y-1">
            {criticalDocs.map(doc => {
              const status = getDocStatus(doc.valid_until);
              const daysLeft = getDaysLeft(doc.valid_until);
              const isExpired = status === 'expired';
              const color = isExpired ? '#EF4444' : '#F59E0B';
              const bg = isExpired ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)';
              const borderColor = isExpired ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)';
              const badgeBg = isExpired ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)';
              const badgeText = isExpired ? 'Kritik' : 'Yaklaşan';

              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2"
                  style={{ background: bg, border: `1px solid ${borderColor}` }}
                >
                  <div className="w-6 h-6 flex items-center justify-center rounded-md flex-shrink-0"
                    style={{ background: `${color}15` }}>
                    <i className={`${isExpired ? 'ri-file-damage-line' : 'ri-file-warning-line'} text-[10px]`}
                      style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {doc.title}
                    </p>
                    <p className="text-[9.5px] truncate" style={{ color: 'var(--text-muted)' }}>
                      <i className="ri-building-2-line mr-1" />
                      {getCompanyName(doc.company_id)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap"
                      style={{ background: badgeBg, color }}
                    >
                      {badgeText}
                    </span>
                    <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                      {isExpired
                        ? (daysLeft !== null ? `${Math.abs(daysLeft)}g önce doldu` : formatDate(doc.valid_until))
                        : (daysLeft !== null ? `${daysLeft}g kaldı` : formatDate(doc.valid_until))
                      }
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-4 gap-2">
          <div className="w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.15)' }}>
            <i className="ri-checkbox-circle-line text-base" style={{ color: '#10B981' }} />
          </div>
          <div className="text-center">
            <p className="text-[11.5px] font-semibold" style={{ color: '#34D399' }}>
              {stats.total === 0 ? 'Henüz evrak eklenmemiş' : 'Tüm evraklar güncel'}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {stats.total === 0 ? 'Firma Evrakları modülünden ekleyebilirsiniz' : 'Kritik uyarı bulunmuyor'}
            </p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex gap-1.5 mt-3 pt-2.5" style={{ borderTop: '1px solid var(--bg-item-border)' }}>
        <button
          onClick={() => setActiveModule('firma-evraklari')}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10.5px] font-semibold cursor-pointer whitespace-nowrap transition-all"
          style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08))', color: '#A5B4FC', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          <i className="ri-add-line text-[11px]" />
          Evrak Ekle
        </button>
        <button
          onClick={() => setActiveModule('firma-evraklari')}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10.5px] font-semibold cursor-pointer whitespace-nowrap transition-all"
          style={{ background: 'var(--bg-item)', color: 'var(--text-muted)', border: '1px solid var(--bg-item-border)' }}
        >
          <i className="ri-eye-line text-[11px]" />
          Tümünü Gör
        </button>
      </div>
    </div>
  );
}
