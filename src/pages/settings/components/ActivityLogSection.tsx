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

// module label → setActiveModule key mapping
const MODULE_TO_KEY: Record<string, string> = {
  Firmalar: 'firmalar',
  Personeller: 'personeller',
  Evraklar: 'evraklar',
  Tutanaklar: 'tutanaklar',
  'Eğitimler': 'egitimler',
  'Görevler': 'gorevler',
  Ekipmanlar: 'ekipmanlar',
  Muayeneler: 'muayeneler',
  Uygunsuzluklar: 'uygunsuzluklar',
  Sistem: 'ayarlar',
};

const MODULE_COLORS: Record<string, string> = {
  Firmalar: '#60A5FA',
  Personeller: '#4ADE80',
  Evraklar: '#C084FC',
  Tutanaklar: '#FB923C',
  'Eğitimler': '#2DD4BF',
  'Görevler': '#FCD34D',
  Ekipmanlar: '#34D399',
  Muayeneler: '#F43F5E',
  Uygunsuzluklar: '#FB923C',
  Sistem: '#94A3B8',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  );
}

function formatDateForExport(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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

const PAGE_SIZE = 15;

// ── Toast notification for realtime ──
interface RealtimeToast {
  id: string;
  log: ActivityLog;
}

export default function ActivityLogSection() {
  const { org, orgLoading, theme, setActiveModule } = useApp();
  const isDark = theme === 'dark';

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [actionFilter, setActionFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [page, setPage] = useState(0);

  const [uniqueUsers, setUniqueUsers] = useState<UniqueUser[]>([]);
  const [realtimeToasts, setRealtimeToasts] = useState<RealtimeToast[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [newCount, setNewCount] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const currentFiltersRef = useRef({ actionFilter, userFilter, dateFrom, dateTo, page });

  useEffect(() => {
    currentFiltersRef.current = { actionFilter, userFilter, dateFrom, dateTo, page };
  }, [actionFilter, userFilter, dateFrom, dateTo, page]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Fetch unique users ──
  const fetchUniqueUsers = useCallback(async (orgId: string) => {
    try {
      const { data } = await supabase
        .from('activity_logs')
        .select('user_email, user_name')
        .eq('organization_id', orgId)
        .limit(500);
      if (!data || !mountedRef.current) return;
      const seen = new Set<string>();
      const users: UniqueUser[] = [];
      data.forEach((r) => {
        if (r.user_email && !seen.has(r.user_email)) {
          seen.add(r.user_email);
          users.push({ user_email: r.user_email, user_name: r.user_name || r.user_email });
        }
      });
      setUniqueUsers(users);
    } catch { /* non-critical */ }
  }, []);

  // ── Main fetch ──
  const fetchLogs = useCallback(async (opts: {
    orgId: string;
    actionFilter: string;
    userFilter: string;
    dateFrom: string;
    dateTo: string;
    page: number;
  }) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    try {
      let countQ = supabase
        .from('activity_logs')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', opts.orgId);
      let dataQ = supabase
        .from('activity_logs')
        .select('*')
        .eq('organization_id', opts.orgId)
        .order('created_at', { ascending: false })
        .range(opts.page * PAGE_SIZE, (opts.page + 1) * PAGE_SIZE - 1);

      if (opts.actionFilter !== 'all') { countQ = countQ.eq('action_type', opts.actionFilter); dataQ = dataQ.eq('action_type', opts.actionFilter); }
      if (opts.userFilter !== 'all')   { countQ = countQ.eq('user_email', opts.userFilter);    dataQ = dataQ.eq('user_email', opts.userFilter); }
      if (opts.dateFrom) { countQ = countQ.gte('created_at', opts.dateFrom + 'T00:00:00'); dataQ = dataQ.gte('created_at', opts.dateFrom + 'T00:00:00'); }
      if (opts.dateTo)   { countQ = countQ.lte('created_at', opts.dateTo + 'T23:59:59');   dataQ = dataQ.lte('created_at', opts.dateTo + 'T23:59:59'); }

      const [countRes, dataRes] = await Promise.all([countQ, dataQ]);
      if (!mountedRef.current) return;
      if (dataRes.error) { setError('Kayıtlar yüklenirken bir hata oluştu.'); setLogs([]); setTotalCount(0); return; }
      setLogs(dataRes.data ?? []);
      setTotalCount(countRes.count ?? 0);
      setNewCount(0);
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      if (err instanceof Error && err.name === 'AbortError') return;
      setError('Bağlantı hatası. Lütfen tekrar deneyin.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  // ── Realtime subscription ──
  useEffect(() => {
    if (!org?.id) return;
    setIsLive(false);

    const channel = supabase
      .channel(`activity_logs_realtime_${org.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_logs',
          filter: `organization_id=eq.${org.id}`,
        },
        (payload) => {
          if (!mountedRef.current) return;
          const newLog = payload.new as ActivityLog;

          // Show toast notification
          const toastId = `rt_${Date.now()}`;
          setRealtimeToasts((prev) => [...prev.slice(-2), { id: toastId, log: newLog }]);
          setTimeout(() => {
            setRealtimeToasts((prev) => prev.filter((t) => t.id !== toastId));
          }, 5000);

          // If on page 0 with no filters, prepend to list
          const f = currentFiltersRef.current;
          const noFilters = f.actionFilter === 'all' && f.userFilter === 'all' && !f.dateFrom && !f.dateTo;
          if (f.page === 0 && noFilters) {
            setLogs((prev) => [newLog, ...prev.slice(0, PAGE_SIZE - 1)]);
            setTotalCount((c) => c + 1);
          } else {
            // Just increment new count badge
            setNewCount((c) => c + 1);
          }
        },
      )
      .subscribe((status) => {
        if (mountedRef.current) setIsLive(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
      if (mountedRef.current) setIsLive(false);
    };
  }, [org?.id]);

  // ── Trigger fetch on filter/page change ──
  useEffect(() => {
    if (!org?.id) return;
    fetchLogs({ orgId: org.id, actionFilter, userFilter, dateFrom, dateTo, page });
  }, [org?.id, actionFilter, userFilter, dateFrom, dateTo, page, fetchLogs]);

  useEffect(() => {
    if (org?.id) fetchUniqueUsers(org.id);
  }, [org?.id, fetchUniqueUsers]);

  // ── Export to CSV ──
  const handleExportCSV = useCallback(async () => {
    if (!org?.id || exporting) return;
    setExporting(true);
    try {
      let query = supabase
        .from('activity_logs')
        .select('*')
        .eq('organization_id', org.id)
        .order('created_at', { ascending: false })
        .limit(5000);

      if (actionFilter !== 'all') query = query.eq('action_type', actionFilter);
      if (userFilter !== 'all')   query = query.eq('user_email', userFilter);
      if (dateFrom) query = query.gte('created_at', dateFrom + 'T00:00:00');
      if (dateTo)   query = query.lte('created_at', dateTo + 'T23:59:59');

      const { data } = await query;
      if (!data || data.length === 0) return;

      const headers = ['Tarih', 'Kullanıcı', 'E-posta', 'Rol', 'İşlem', 'Modül', 'Kayıt Adı', 'Açıklama'];
      const rows = data.map((log) => [
        formatDateForExport(log.created_at),
        log.user_name || '',
        log.user_email || '',
        log.user_role === 'admin' ? 'Admin' : log.user_role === 'denetci' ? 'Denetçi' : 'Kullanıcı',
        ACTION_LABELS[log.action_type] ?? log.action_type,
        log.module || '',
        log.record_name || '',
        log.description || '',
      ]);

      const csvContent = [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const bom = '\uFEFF'; // UTF-8 BOM for Excel Turkish chars
      const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `islem-kayitlari-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silent
    } finally {
      if (mountedRef.current) setExporting(false);
    }
  }, [org?.id, actionFilter, userFilter, dateFrom, dateTo, exporting]);

  // ── Navigate to module on row click ──
  const handleLogClick = useCallback((log: ActivityLog) => {
    const moduleKey = log.module ? MODULE_TO_KEY[log.module] : null;
    if (!moduleKey) return;
    setActiveModule(moduleKey);
    // If there's a record ID, dispatch event so the target module can open it
    if (log.record_id) {
      try {
        localStorage.setItem('isg_open_record', JSON.stringify({
          module: moduleKey,
          recordId: log.record_id,
          tip: log.action_type,
          ts: Date.now(),
        }));
        window.dispatchEvent(new CustomEvent('isg_open_record', {
          detail: { module: moduleKey, recordId: log.record_id, tip: log.action_type },
        }));
      } catch { /* ignore */ }
    }
  }, [setActiveModule]);

  const handleFilterChange = useCallback(
    (setter: (v: string) => void) =>
      (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        setter(e.target.value);
        setPage(0);
      },
    [],
  );

  const handleReset = useCallback(() => {
    setActionFilter('all');
    setUserFilter('all');
    setDateFrom('');
    setDateTo('');
    setPage(0);
  }, []);

  const handleRefresh = useCallback(() => {
    if (!org?.id) return;
    fetchLogs({ orgId: org.id, actionFilter, userFilter, dateFrom, dateTo, page });
  }, [org?.id, actionFilter, userFilter, dateFrom, dateTo, page, fetchLogs]);

  const hasActiveFilters = actionFilter !== 'all' || userFilter !== 'all' || dateFrom !== '' || dateTo !== '';
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hasPrev = page > 0;
  const hasNext = page < totalPages - 1;

  if (orgLoading || !org) return null;

  // ── Theme tokens ──
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
    width: '100%',
  };
  const dividerStyle = { borderBottom: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(15,23,42,0.08)' };

  return (
    <div style={cardStyle} className="p-6 space-y-5 relative">

      {/* ── Realtime toast notifications ── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {realtimeToasts.map((t) => {
          const actionInfo = ACTION_COLORS[t.log.action_type] ?? { bg: 'rgba(99,102,241,0.1)', color: '#818CF8', icon: 'ri-history-line' };
          const actionLabel = ACTION_LABELS[t.log.action_type] ?? t.log.action_type;
          return (
            <div
              key={t.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl pointer-events-auto animate-slide-up"
              style={{
                background: isDark ? 'rgba(8,12,22,0.97)' : 'rgba(255,255,255,0.98)',
                border: `1px solid ${actionInfo.color}30`,
                boxShadow: `0 8px 32px rgba(0,0,0,0.25), 0 0 0 1px ${actionInfo.color}15`,
                backdropFilter: 'blur(16px)',
                minWidth: '280px',
                maxWidth: '360px',
              }}
            >
              <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: actionInfo.bg }}>
                <i className={`${actionInfo.icon} text-sm`} style={{ color: actionInfo.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0" style={{ background: '#10B981' }} />
                  <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#10B981' }}>Canlı</span>
                </div>
                <p className="text-xs font-semibold truncate" style={{ color: nameColor }}>{actionLabel}</p>
                <p className="text-[10px] truncate" style={{ color: subColor }}>{t.log.user_name || t.log.user_email}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-4" style={dividerStyle}>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.15)' }}
          >
            <i className="ri-history-line text-base" style={{ color: '#6366F1' }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold" style={{ color: sectionTitleColor }}>İşlem Kayıtları</h4>
              {/* Live indicator */}
              <div
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{
                  background: isLive ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.1)',
                  border: `1px solid ${isLive ? 'rgba(16,185,129,0.2)' : 'rgba(100,116,139,0.15)'}`,
                  color: isLive ? '#10B981' : '#64748B',
                }}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isLive ? 'animate-pulse' : ''}`}
                  style={{ background: isLive ? '#10B981' : '#64748B' }}
                />
                {isLive ? 'Canlı' : 'Bağlanıyor...'}
              </div>
              {/* New records badge */}
              {newCount > 0 && (
                <button
                  onClick={handleRefresh}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-all"
                  style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)', color: '#818CF8' }}
                >
                  <i className="ri-arrow-up-line text-[10px]" />
                  {newCount} yeni kayıt
                </button>
              )}
            </div>
            <p className="text-xs mt-0.5" style={{ color: subColor }}>
              {totalCount > 0 ? `Toplam ${totalCount.toLocaleString('tr-TR')} kayıt` : 'Organizasyondaki tüm kullanıcı işlemleri'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {hasActiveFilters && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap transition-all"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#EF4444' }}
            >
              <i className="ri-filter-off-line" />
              Filtreleri Temizle
            </button>
          )}
          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            disabled={exporting || totalCount === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap transition-all disabled:opacity-40"
            style={{
              background: isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.06)',
              border: '1px solid rgba(16,185,129,0.2)',
              color: '#10B981',
            }}
            title="CSV olarak dışa aktar (max 5000 kayıt)"
          >
            <i className={`${exporting ? 'ri-loader-4-line animate-spin' : 'ri-download-2-line'}`} />
            {exporting ? 'Hazırlanıyor...' : 'CSV İndir'}
          </button>
          {/* Refresh */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap transition-all disabled:opacity-50"
            style={{
              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)',
              border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.1)',
              color: subColor,
            }}
          >
            <i className={`${loading ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'}`} />
            Yenile
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div
        className="p-4 rounded-xl"
        style={{
          background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)',
          border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(15,23,42,0.07)',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <i className="ri-filter-3-line text-sm" style={{ color: '#6366F1' }} />
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: sectionTitleColor }}>Filtreler</span>
          {hasActiveFilters && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.15)', color: '#818CF8' }}>
              Aktif
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: subColor }}>İşlem Tipi</label>
            <select value={actionFilter} onChange={handleFilterChange(setActionFilter)} style={{ ...inputStyle, cursor: 'pointer' }}>
              {ACTION_FILTER_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: subColor }}>Kullanıcı</label>
            <select value={userFilter} onChange={handleFilterChange(setUserFilter)} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="all">Tüm Kullanıcılar</option>
              {uniqueUsers.map((u) => (
                <option key={u.user_email} value={u.user_email}>
                  {u.user_name !== u.user_email ? `${u.user_name} (${u.user_email})` : u.user_email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: subColor }}>Başlangıç Tarihi</label>
            <input type="date" value={dateFrom} onChange={handleFilterChange(setDateFrom)} style={inputStyle} />
          </div>
          <div>
            <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: subColor }}>Bitiş Tarihi</label>
            <input type="date" value={dateTo} onChange={handleFilterChange(setDateTo)} style={inputStyle} />
          </div>
        </div>
      </div>

      {/* ── Error State ── */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <i className="ri-error-warning-line text-base flex-shrink-0" style={{ color: '#F87171' }} />
          <p className="text-sm flex-1" style={{ color: '#F87171' }}>{error}</p>
          <button onClick={handleRefresh} className="text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap" style={{ background: 'rgba(239,68,68,0.12)', color: '#F87171', border: '1px solid rgba(239,68,68,0.2)' }}>
            Tekrar Dene
          </button>
        </div>
      )}

      {/* ── Log List ── */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl animate-pulse"
              style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)', border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(15,23,42,0.06)' }}>
              <div className="w-8 h-8 rounded-lg flex-shrink-0" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }} />
              <div className="flex-1 space-y-2">
                <div className="h-3 rounded w-1/3" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }} />
                <div className="h-3 rounded w-1/2" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)' }} />
              </div>
              <div className="w-20 h-3 rounded flex-shrink-0" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)' }} />
            </div>
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)' }}>
            <i className="ri-history-line text-xl" style={{ color: subColor }} />
          </div>
          <p className="text-sm" style={{ color: subColor }}>
            {hasActiveFilters ? 'Bu filtreyle eşleşen kayıt bulunamadı.' : 'Henüz işlem kaydı bulunmuyor.'}
          </p>
          {hasActiveFilters && (
            <button onClick={handleReset} className="text-xs font-semibold cursor-pointer transition-all" style={{ color: '#818CF8' }}>
              Filtreleri temizle
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {logs.map((log) => {
            const actionInfo = ACTION_COLORS[log.action_type] ?? { bg: 'rgba(100,116,139,0.1)', color: '#94A3B8', icon: 'ri-checkbox-blank-circle-line' };
            const actionLabel = ACTION_LABELS[log.action_type] ?? log.action_type;
            const moduleColor = MODULE_COLORS[log.module ?? ''] ?? '#94A3B8';
            const moduleKey = log.module ? MODULE_TO_KEY[log.module] : null;
            const isClickable = !!moduleKey;

            return (
              <div
                key={log.id}
                onClick={() => isClickable && handleLogClick(log)}
                className="flex items-start gap-3 p-3.5 rounded-xl transition-all group"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)',
                  border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(15,23,42,0.06)',
                  cursor: isClickable ? 'pointer' : 'default',
                }}
                onMouseEnter={(e) => {
                  if (!isClickable) return;
                  e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)';
                  e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)';
                  e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)';
                }}
              >
                {/* Action icon */}
                <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 mt-0.5" style={{ background: actionInfo.bg }}>
                  <i className={`${actionInfo.icon} text-sm`} style={{ color: actionInfo.color }} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ background: actionInfo.bg, color: actionInfo.color }}>
                      {actionLabel}
                    </span>
                    {log.module && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: `${moduleColor}15`, color: moduleColor }}>
                        {log.module}
                      </span>
                    )}
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{
                        background: log.user_role === 'admin' ? 'rgba(245,158,11,0.1)' : log.user_role === 'denetci' ? 'rgba(6,182,212,0.1)' : 'rgba(99,102,241,0.1)',
                        color: log.user_role === 'admin' ? '#F59E0B' : log.user_role === 'denetci' ? '#06B6D4' : '#818CF8',
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

                {/* Right side: timestamp + navigate hint */}
                <div className="flex flex-col items-end gap-1 flex-shrink-0 mt-0.5">
                  <div className="text-[10px] font-medium" style={{ color: subColor }}>
                    {formatDate(log.created_at)}
                  </div>
                  {isClickable && (
                    <div
                      className="flex items-center gap-1 text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: moduleColor }}
                    >
                      <i className="ri-arrow-right-up-line text-[10px]" />
                      Modüle git
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination ── */}
      {!loading && totalCount > 0 && (
        <div className="flex items-center justify-between pt-2 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <p className="text-xs" style={{ color: subColor }}>
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} / {totalCount.toLocaleString('tr-TR')} kayıt
            </p>
            {totalPages > 1 && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)', color: subColor }}>
                Sayfa {page + 1} / {totalPages}
              </span>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={!hasPrev || loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all"
              style={{
                background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)',
                border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.1)',
                color: subColor,
                opacity: !hasPrev || loading ? 0.4 : 1,
                cursor: !hasPrev || loading ? 'not-allowed' : 'pointer',
              }}
            >
              <i className="ri-arrow-left-s-line" />Önceki
            </button>

            {totalPages > 1 && totalPages <= 7 && (
              <div className="flex gap-1">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-xs font-semibold cursor-pointer transition-all"
                    style={{
                      background: i === page ? 'rgba(99,102,241,0.2)' : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)',
                      border: i === page ? '1px solid rgba(99,102,241,0.35)' : isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(15,23,42,0.08)',
                      color: i === page ? '#818CF8' : subColor,
                    }}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasNext || loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all"
              style={{
                background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)',
                border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.1)',
                color: subColor,
                opacity: !hasNext || loading ? 0.4 : 1,
                cursor: !hasNext || loading ? 'not-allowed' : 'pointer',
              }}
            >
              Sonraki<i className="ri-arrow-right-s-line ml-1" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
