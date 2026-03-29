import { useState, useEffect, useCallback } from 'react';
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

export default function ActivityLogSection() {
  const { org, orgLoading, theme } = useApp();
  const isDark = theme === 'dark';

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;

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

      if (filter !== 'all') {
        query = query.eq('action_type', filter);
      }

      const { data } = await query;
      setLogs(data ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [org?.id, filter, page]);

  useEffect(() => {
    if (org?.role === 'admin' || org) {
      fetchLogs();
    }
  }, [org, fetchLogs]);

  if (orgLoading || !org) return null;

  const cardStyle = {
    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.8)',
    border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(15,23,42,0.1)',
    borderRadius: '16px',
  };
  const nameColor = isDark ? '#E2E8F0' : '#0F172A';
  const subColor = isDark ? '#64748B' : '#94A3B8';
  const sectionTitleColor = isDark ? '#CBD5E1' : '#334155';

  const filterOptions = [
    { value: 'all', label: 'Tümü' },
    { value: 'user_login', label: 'Giriş' },
    { value: 'user_created', label: 'Kullanıcı' },
    { value: 'password_changed', label: 'Şifre' },
    { value: 'firma_created', label: 'Firma' },
    { value: 'personel_created', label: 'Personel' },
    { value: 'evrak_created', label: 'Evrak' },
    { value: 'evrak_deleted', label: 'Evrak Silme' },
    { value: 'tutanak_created', label: 'Tutanak' },
  ];

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

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {filterOptions.map(opt => (
          <button
            key={opt.value}
            onClick={() => { setFilter(opt.value); setPage(0); }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap transition-all"
            style={{
              background: filter === opt.value
                ? 'rgba(99,102,241,0.15)'
                : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)'),
              border: filter === opt.value
                ? '1px solid rgba(99,102,241,0.3)'
                : (isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(15,23,42,0.08)'),
              color: filter === opt.value ? '#818CF8' : subColor,
            }}
          >
            {opt.label}
          </button>
        ))}
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
          <p className="text-sm" style={{ color: subColor }}>Henüz işlem kaydı bulunmuyor</p>
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
                    {/* Action label */}
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-md"
                      style={{ background: actionInfo.bg, color: actionInfo.color }}
                    >
                      {actionLabel}
                    </span>

                    {/* Module */}
                    {log.module && (
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ background: `${moduleColor}15`, color: moduleColor }}
                      >
                        {log.module}
                      </span>
                    )}

                    {/* Role badge */}
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{
                        background: log.user_role === 'admin' ? 'rgba(245,158,11,0.1)' : 'rgba(99,102,241,0.1)',
                        color: log.user_role === 'admin' ? '#F59E0B' : '#818CF8',
                      }}
                    >
                      {log.user_role === 'admin' ? 'Admin' : 'Kullanıcı'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <p className="text-xs font-medium" style={{ color: nameColor }}>
                      {log.user_name || log.user_email || 'Bilinmeyen'}
                    </p>
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
          {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + logs.length} arası gösteriliyor
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
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
            className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
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
