import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../../store/AppContext';
import { supabase } from '../../../lib/supabase';
import {
  type LogEntry,
  type ActionType,
  ACTION_LABELS,
  ACTION_ICONS,
  ACTION_COLORS,
} from '../../../lib/activityLog';

const PAGE_SIZE = 30;

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const past = new Date(dateStr).getTime();
  const diff = Math.floor((now - past) / 1000);
  if (diff < 60) return `${diff} sn önce`;
  if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} sa önce`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} gün önce`;
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const MODULE_FILTERS = [
  { value: '', label: 'Tüm Modüller' },
  { value: 'Firmalar', label: 'Firmalar' },
  { value: 'Personeller', label: 'Personeller' },
  { value: 'Evraklar', label: 'Evraklar' },
  { value: 'Tutanaklar', label: 'Tutanaklar' },
  { value: 'Kullanicilar', label: 'Kullanıcılar' },
  { value: 'Hesap', label: 'Hesap' },
];

const ACTION_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'Tüm İşlemler' },
  { value: 'user_login', label: 'Girişler' },
  { value: 'user_created', label: 'Kullanıcı Oluşturma' },
  { value: 'password_changed', label: 'Şifre Değişikliği' },
  { value: 'document_added,document_deleted', label: 'Evrak İşlemleri' },
  { value: 'tutanak_created,tutanak_updated', label: 'Tutanak İşlemleri' },
  { value: 'firma_created,firma_updated,firma_deleted', label: 'Firma İşlemleri' },
  { value: 'personel_created,personel_updated,personel_deleted', label: 'Personel İşlemleri' },
];

export default function ActivityLogSection() {
  const { org, orgLoading, theme } = useApp();
  const isDark = theme === 'dark';

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [moduleFilter, setModuleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const fetchLogs = useCallback(async (reset = false) => {
    if (!org?.id) return;
    setLoading(true);
    const currentOffset = reset ? 0 : offset;

    let query = supabase
      .from('activity_logs')
      .select('*')
      .eq('organization_id', org.id)
      .order('created_at', { ascending: false })
      .range(currentOffset, currentOffset + PAGE_SIZE - 1);

    if (moduleFilter) {
      query = query.eq('module', moduleFilter);
    }
    if (actionFilter) {
      const actions = actionFilter.split(',');
      if (actions.length === 1) {
        query = query.eq('action_type', actions[0]);
      } else {
        query = query.in('action_type', actions);
      }
    }

    const { data } = await query;
    const entries = (data ?? []) as LogEntry[];

    if (reset) {
      setLogs(entries);
      setOffset(entries.length);
    } else {
      setLogs(prev => [...prev, ...entries]);
      setOffset(prev => prev + entries.length);
    }
    setHasMore(entries.length === PAGE_SIZE);
    setLoading(false);
  }, [org?.id, moduleFilter, actionFilter, offset]);

  useEffect(() => {
    if (org?.id) {
      setOffset(0);
      fetchLogs(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.id, moduleFilter, actionFilter]);

  if (orgLoading || !org) return null;

  const cardStyle = {
    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.8)',
    border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(15,23,42,0.1)',
    borderRadius: '16px',
  };
  const nameColor = isDark ? '#E2E8F0' : '#0F172A';
  const subColor = isDark ? '#64748B' : '#94A3B8';
  const sectionTitleColor = isDark ? '#CBD5E1' : '#334155';
  const selectStyle: React.CSSProperties = {
    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)',
    border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(15,23,42,0.12)',
    borderRadius: '8px',
    color: nameColor,
    outline: 'none',
    padding: '7px 10px',
    fontSize: '12px',
    cursor: 'pointer',
  };

  // Group logs by date
  const groupedLogs: { date: string; entries: LogEntry[] }[] = [];
  logs.forEach(log => {
    const d = new Date(log.created_at);
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86400000);
    let label: string;
    if (d.toDateString() === today.toDateString()) label = 'Bugün';
    else if (d.toDateString() === yesterday.toDateString()) label = 'Dün';
    else label = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

    const existing = groupedLogs.find(g => g.date === label);
    if (existing) {
      existing.entries.push(log);
    } else {
      groupedLogs.push({ date: label, entries: [log] });
    }
  });

  return (
    <div style={cardStyle} className="p-6 space-y-5">
      {/* Header */}
      <div
        className="flex items-center justify-between pb-4 flex-wrap gap-3"
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
            <h4 className="text-sm font-bold" style={{ color: sectionTitleColor }}>Aktivite Geçmişi</h4>
            <p className="text-xs mt-0.5" style={{ color: subColor }}>
              Sistemde gerçekleştirilen işlemlerin kaydı
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={moduleFilter}
            onChange={e => setModuleFilter(e.target.value)}
            style={selectStyle}
          >
            {MODULE_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            style={selectStyle}
          >
            {ACTION_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <button
            onClick={() => fetchLogs(true)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
            style={{
              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)',
              border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.1)',
              color: subColor,
            }}
          >
            <i className={`${loading ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'} text-xs`} />
            Yenile
          </button>
        </div>
      </div>

      {/* Log count */}
      {logs.length > 0 && (
        <div className="flex items-center gap-2">
          <span
            className="text-xs px-2.5 py-1 rounded-full font-semibold"
            style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8' }}
          >
            {logs.length}{hasMore ? '+' : ''} kayıt
          </span>
          {(moduleFilter || actionFilter) && (
            <button
              onClick={() => { setModuleFilter(''); setActionFilter(''); }}
              className="text-xs flex items-center gap-1 cursor-pointer"
              style={{ color: '#EF4444' }}
            >
              <i className="ri-close-circle-line" />
              Filtreleri Temizle
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {loading && logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <i className="ri-loader-4-line animate-spin text-2xl" style={{ color: '#6366F1' }} />
          <p className="text-sm" style={{ color: subColor }}>Kayıtlar yükleniyor...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div
            className="w-14 h-14 flex items-center justify-center rounded-2xl"
            style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)' }}
          >
            <i className="ri-history-line text-2xl" style={{ color: subColor }} />
          </div>
          <p className="text-sm font-medium" style={{ color: subColor }}>Henüz aktivite kaydı yok</p>
          <p className="text-xs text-center max-w-xs" style={{ color: isDark ? '#334155' : '#CBD5E1' }}>
            Sistem kullanıldıkça işlem kayıtları burada görünecek
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedLogs.map(group => (
            <div key={group.date}>
              {/* Date separator */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="h-px flex-1"
                  style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)' }}
                />
                <span
                  className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
                    color: subColor,
                  }}
                >
                  {group.date}
                </span>
                <div
                  className="h-px flex-1"
                  style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)' }}
                />
              </div>

              {/* Log entries for this date */}
              <div className="space-y-1">
                {group.entries.map(log => {
                  const actionType = log.action_type as ActionType;
                  const icon = ACTION_ICONS[actionType] || 'ri-record-circle-line';
                  const color = ACTION_COLORS[actionType] || '#64748B';
                  const label = ACTION_LABELS[actionType] || log.action_type;
                  const isHovered = hoveredId === log.id;

                  return (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 px-4 py-3 rounded-xl transition-all cursor-default"
                      style={{
                        background: isHovered
                          ? (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)')
                          : 'transparent',
                      }}
                      onMouseEnter={() => setHoveredId(log.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      {/* Action icon */}
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: `${color}18`, border: `1px solid ${color}30` }}
                      >
                        <i className={`${icon} text-sm`} style={{ color }} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold" style={{ color: nameColor }}>
                            {label}
                          </span>
                          {log.record_name && (
                            <span
                              className="text-xs px-2 py-0.5 rounded-md font-medium max-w-[200px] truncate"
                              style={{
                                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
                                color: subColor,
                              }}
                            >
                              {log.record_name}
                            </span>
                          )}
                          {log.module && (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                              style={{ background: `${color}15`, color }}
                            >
                              {log.module}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {/* User avatar + name */}
                          <div className="flex items-center gap-1.5">
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                              style={{
                                background: log.user_role === 'admin'
                                  ? 'linear-gradient(135deg, #F59E0B, #EA580C)'
                                  : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                              }}
                            >
                              {(log.user_name || log.user_email || '?').charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs font-medium" style={{ color: subColor }}>
                              {log.user_name || log.user_email}
                            </span>
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                              style={{
                                background: log.user_role === 'admin' ? 'rgba(245,158,11,0.12)' : 'rgba(99,102,241,0.12)',
                                color: log.user_role === 'admin' ? '#F59E0B' : '#818CF8',
                              }}
                            >
                              {log.user_role === 'admin' ? 'Admin' : 'Kullanıcı'}
                            </span>
                          </div>

                          <span
                            className="text-[10px]"
                            style={{ color: isDark ? '#334155' : '#CBD5E1' }}
                          >
                            •
                          </span>

                          {/* Time */}
                          <span
                            className="text-[11px]"
                            style={{ color: isDark ? '#475569' : '#94A3B8' }}
                            title={formatDateTime(log.created_at)}
                          >
                            {timeAgo(log.created_at)}
                          </span>
                        </div>

                        {log.description && (
                          <p className="text-xs mt-1 leading-relaxed" style={{ color: isDark ? '#475569' : '#94A3B8' }}>
                            {log.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => fetchLogs(false)}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all whitespace-nowrap"
                style={{
                  background: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.08)',
                  border: '1px solid rgba(99,102,241,0.2)',
                  color: '#818CF8',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? (
                  <><i className="ri-loader-4-line animate-spin" />Yükleniyor...</>
                ) : (
                  <><i className="ri-arrow-down-line" />Daha Fazla Yükle</>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
