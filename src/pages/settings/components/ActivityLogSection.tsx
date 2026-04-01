import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../../../store/AppContext';
import { supabase } from '../../../lib/supabase';
import { ACTION_LABELS, ACTION_COLORS } from '../../../utils/activityLog';

interface ActivityLog {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  user_role: string;
  action_type: string;
  module: string | null;
  record_id: string | null;
  record_name: string | null;
  description: string | null;
  created_at: string;
}

interface UniqueUser {
  user_email: string;
  user_name: string;
}

const MODULE_COLORS: Record<string, string> = {
  'Firmalar': '#60A5FA',
  'Personeller': '#4ADE80',
  'Evraklar': '#C084FC',
  'Tutanaklar': '#FB923C',
  'Eğitimler': '#2DD4BF',
  'Görevler': '#FCD34D',
  'Sistem': '#94A3B8',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

const ACTION_FILTER_OPTIONS = [
  { value: 'all', label: 'Tüm İşlemler' },
  { value: 'user_login', label: 'Giriş' },
  { value: 'user_created', label: 'Kullanıcı Oluşturma' },
  { value: 'password_changed', label: 'Şifre Değişikliği' },
  { value: 'firma_created', label: 'Firma Oluşturma' },
  { value: 'personel_created', label: 'Personel Ekleme' },
  { value: 'evrak_created', label: 'Evrak Oluşturma' },
  { value: 'evrak_deleted', label: 'Evrak Silme' },
  { value: 'tutanak_created', label: 'Tutanak Oluşturma' },
];

export default function ActivityLogSection() {
  const { org, orgLoading, theme } = useApp();
  const isDark = theme === 'dark';

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [page, setPage] = useState(0);
  const [uniqueUsers, setUniqueUsers] = useState<UniqueUser[]>([]);
  const PAGE_SIZE = 15;

  const fetchUniqueUsers = useCallback(async () => {
    if (!org?.id) return;
    const { data } = await supabase
      .from('activity_logs')
      .select('user_email, user_name')
      .eq('organization_id', org.id)
      .order('user_name', { ascending: true });

    if (data) {
      const seen = new Set<string>();
      const users: UniqueUser[] = [];
      data.forEach(r => {
        if (r.user_email && !seen.has(r.user_email)) {
          seen.add(r.user_email);
          users.push({ user_email: r.user_email, user_name: r.user_name || r.user_email });
        }
      });
      setUniqueUsers(users);
    }
  }, [org?.id]);

  const fetchLogs = useCallback(async () => {
    if (!org?.id) return;
    setLoading(true);
    try {
      let query = supabase
        .from('activity_logs')
        .select('*')
        .eq('organization_id', org.id)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (actionFilter !== 'all') {
        query = query.eq('action_type', actionFilter);
      }
      if (userFilter !== 'all') {
        query = query.eq('user_email', userFilter);
      }
      if (dateFrom) {
        query = query.gte('created_at', dateFrom + 'T00:00:00');
      }
      if (dateTo) {
        query = query.lte('created_at', dateTo + 'T23:59:59');
      }

      const { data } = await query;
      setLogs(data ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [org?.id, actionFilter, userFilter, dateFrom, dateTo, page]);

  useEffect(() => {
    if (org) fetchUniqueUsers();
  }, [org, fetchUniqueUsers]);

  useEffect(() => {
    if (org) fetchLogs();
  }, [org, fetchLogs]);

  const handleReset = () => {
    setActionFilter('all');
    setUserFilter('all');
    setDateFrom('');
    setDateTo('');
    setPage(0);
  };

  const hasActiveFilters = actionFilter !== 'all' || userFilter !== 'all' || dateFrom !== '' || dateTo !== '';

  if (orgLoading || !org) return null;

  const cardStyle = {
    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.8)',
    border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(15,23,42,0.1)',
    borderRadius: '16px',
  };
  const nameColor = isDark ? '#E2E8F0' : '#0F172A';
  const subColor = isDark ? '#64748B' : '#94A3B8';
  const sectionTitleColor = isDark ? '#CBD5E1' : '#334155';
  const inputStyle: React.CSSProperties = {
    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)',
    border: isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(15,23,42,0.12)',
    borderRadius: '10px',
    color: isDark ? '#E2E8F0' : '#0F172A',
    outline: 'none',
    fontSize: '12px',
    padding: '8px 10px',
  };

  return (
    <div style={cardStyle} className="p-6 space-y-5">
      {/* Header */}
      <div
        className="flex items-center justify-between flex-wrap gap-3 pb-4"
        style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(15,23,42,0.08)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.15)' }}
          >
            <i className="ri-history-line text-base" style={{ color: '#6366F1' }} />
          </div>
          <div>
            <h4 className="text-sm font-bold" style={{ color: sectionTitleColor }}>İşlem Kayıtları</h4>
            <p className="text-xs mt-0.5" style={{ color: subColor }}>
              Organizasyondaki tüm kullanıcı işlemleri
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap"
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.15)',
                color: '#EF4444',
              }}
            >
              <i className="ri-filter-off-line" />
              Filtreleri Temizle
            </button>
          )}
          <button
            onClick={() => { setPage(0); fetchLogs(); }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap"
            style={{
              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)',
              border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.1)',
              color: subColor,
            }}
          >
            <i className="ri-refresh-line" />
            Yenile
          </button>
        </div>
      </div>

      {/* ─── Filters ─── */}
      <div
        className="p-4 rounded-xl space-y-3"
        style={{
          background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)',
          border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(15,23,42,0.07)',
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <i className="ri-filter-3-line text-sm" style={{ color: '#6366F1' }} />
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: sectionTitleColor }}>Filtreler</span>
          {hasActiveFilters && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(99,102,241,0.15)', color: '#818CF8' }}
            >
              Aktif
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Action type filter */}
          <div>
            <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: subColor }}>
              İşlem Tipi
            </label>
            <select
              value={actionFilter}
              onChange={e => { setActionFilter(e.target.value); setPage(0); }}
              style={{ ...inputStyle, width: '100%', cursor: 'pointer' }}
            >
              {ACTION_FILTER_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* User filter */}
          <div>
            <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: subColor }}>
              Kullanıcı
            </label>
            <select
              value={userFilter}
              onChange={e => { setUserFilter(e.target.value); setPage(0); }}
              style={{ ...inputStyle, width: '100%', cursor: 'pointer' }}
            >
              <option value="all">Tüm Kullanıcılar</option>
              {uniqueUsers.map(u => (
                <option key={u.user_email} value={u.user_email}>
                  {u.user_name !== u.user_email ? `${u.user_name} (${u.user_email})` : u.user_email}
                </option>
              ))}
            </select>
          </div>

          {/* Date from */}
          <div>
            <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: subColor }}>
              Başlangıç Tarihi
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(0); }}
              style={{ ...inputStyle, width: '100%' }}
            />
          </div>

          {/* Date to */}
          <div>
            <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: subColor }}>
              Bitiş Tarihi
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(0); }}
              style={{ ...inputStyle, width: '100%' }}
            />
          </div>
        </div>
      </div>

      {/* Log List */}
      {loading ? (
        <div className="flex items-center justify-center py-10 gap-2" style={{ color: subColor }}>
          <i className="ri-loader-4-line animate-spin" />
          <span className="text-sm">Yükleniyor...</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div
            className="w-12 h-12 flex items-center justify-center rounded-2xl"
            style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)' }}
          >
            <i className="ri-history-line text-xl" style={{ color: subColor }} />
          </div>
          <p className="text-sm" style={{ color: subColor }}>
            {hasActiveFilters ? 'Bu filtreyle eşleşen kayıt bulunamadı.' : 'Henüz işlem kaydı bulunmuyor.'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={handleReset}
              className="text-xs font-semibold cursor-pointer"
              style={{ color: '#818CF8' }}
            >
              Filtreleri temizle
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map(log => {
            const actionInfo = ACTION_COLORS[log.action_type] ?? { bg: 'rgba(100,116,139,0.1)', color: '#94A3B8', icon: 'ri-checkbox-blank-circle-line' };
            const actionLabel = ACTION_LABELS[log.action_type] ?? log.action_type;
            const moduleColor = MODULE_COLORS[log.module ?? ''] ?? '#94A3B8';

            return (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3.5 rounded-xl"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)',
                  border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(15,23,42,0.06)',
                }}
              >
                {/* Action icon */}
                <div
                  className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 mt-0.5"
                  style={{ background: actionInfo.bg }}
                >
                  <i className={`${actionInfo.icon} text-sm`} style={{ color: actionInfo.color }} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-md"
                      style={{ background: actionInfo.bg, color: actionInfo.color }}
                    >
                      {actionLabel}
                    </span>
                    {log.module && (
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ background: `${moduleColor}15`, color: moduleColor }}
                      >
                        {log.module}
                      </span>
                    )}
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{
                        background: log.user_role === 'admin'
                          ? 'rgba(245,158,11,0.1)'
                          : log.user_role === 'denetci'
                          ? 'rgba(6,182,212,0.1)'
                          : 'rgba(99,102,241,0.1)',
                        color: log.user_role === 'admin'
                          ? '#F59E0B'
                          : log.user_role === 'denetci'
                          ? '#06B6D4'
                          : '#818CF8',
                      }}
                    >
                      {log.user_role === 'admin' ? 'Admin' : log.user_role === 'denetci' ? 'Denetçi' : 'Kullanıcı'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <p className="text-xs font-medium" style={{ color: nameColor }}>
                      {log.user_name || log.user_email || 'Bilinmeyen'}
                    </p>
                    {log.user_email && log.user_name && log.user_name !== log.user_email && (
                      <p className="text-[10px]" style={{ color: subColor }}>{log.user_email}</p>
                    )}
                    {log.record_name && (
                      <p className="text-xs" style={{ color: subColor }}>
                        → <span style={{ color: isDark ? '#94A3B8' : '#475569' }}>{log.record_name}</span>
                      </p>
                    )}
                  </div>

                  {log.description && (
                    <p className="text-xs mt-0.5" style={{ color: subColor }}>{log.description}</p>
                  )}
                </div>

                {/* Timestamp */}
                <div className="text-[10px] font-medium flex-shrink-0 mt-1" style={{ color: subColor }}>
                  {formatDate(log.created_at)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs" style={{ color: subColor }}>
          {logs.length > 0
            ? `${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + logs.length} arası gösteriliyor`
            : 'Sonuç yok'
          }
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
            style={{
              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)',
              border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.1)',
              color: subColor,
              opacity: page === 0 ? 0.4 : 1,
              cursor: page === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            <i className="ri-arrow-left-s-line" />
            Önceki
          </button>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={logs.length < PAGE_SIZE}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
            style={{
              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)',
              border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.1)',
              color: subColor,
              opacity: logs.length < PAGE_SIZE ? 0.4 : 1,
              cursor: logs.length < PAGE_SIZE ? 'not-allowed' : 'pointer',
            }}
          >
            Sonraki
            <i className="ri-arrow-right-s-line ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
}
