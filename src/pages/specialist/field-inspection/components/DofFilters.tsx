type DateRange = 'last30' | 'last90' | 'thisYear' | 'custom';
type StatusFilter = 'all' | 'open' | 'closed' | 'critical';

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  dateRange: DateRange;
  onDateRangeChange: (v: DateRange) => void;
  customFrom: string;
  customTo: string;
  onCustomFromChange: (v: string) => void;
  onCustomToChange: (v: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (v: StatusFilter) => void;
}

const dateOptions: { value: DateRange; label: string }[] = [
  { value: 'last30', label: 'Son 1 Ay' },
  { value: 'last90', label: 'Son 3 Ay' },
  { value: 'thisYear', label: 'Bu Yıl' },
  { value: 'custom', label: 'Özel Aralık' },
];

const statusOptions: { value: StatusFilter; label: string; color: string }[] = [
  { value: 'all', label: 'Tümü', color: 'var(--text-muted)' },
  { value: 'open', label: 'Açık', color: 'var(--warning)' },
  { value: 'closed', label: 'Kapandı', color: 'var(--success)' },
  { value: 'critical', label: 'Kritik', color: 'var(--danger)' },
];

export default function DofFilters({
  search, onSearchChange,
  dateRange, onDateRangeChange,
  customFrom, customTo, onCustomFromChange, onCustomToChange,
  statusFilter, onStatusFilterChange,
}: Props) {
  return (
    <div className="mb-5 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center pointer-events-none">
            <i className="ri-search-line text-sm" style={{ color: 'var(--text-muted)' }} />
          </div>
          <input
            className="input pl-9 text-sm w-full"
            placeholder="DÖF No, başlık, firma, personel ara..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        {/* Date Range Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          {dateOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onDateRangeChange(opt.value)}
              className="px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer transition-all"
              style={{
                backgroundColor: dateRange === opt.value ? 'var(--card)' : 'transparent',
                color: dateRange === opt.value ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: dateRange === opt.value ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onStatusFilterChange(opt.value)}
              className="px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer transition-all"
              style={{
                backgroundColor: statusFilter === opt.value ? 'var(--card)' : 'transparent',
                color: statusFilter === opt.value ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: statusFilter === opt.value ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Date Range */}
      {dateRange === 'custom' && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>Başlangıç</label>
            <input
              type="date"
              className="input text-sm"
              value={customFrom}
              onChange={(e) => onCustomFromChange(e.target.value)}
            />
          </div>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
          <div className="flex items-center gap-2">
            <label className="text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>Bitiş</label>
            <input
              type="date"
              className="input text-sm"
              value={customTo}
              onChange={(e) => onCustomToChange(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
