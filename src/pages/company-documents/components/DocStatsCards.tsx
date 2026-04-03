import type { CompanyDocument } from '@/types';

interface Props {
  documents: CompanyDocument[];
}

export default function DocStatsCards({ documents }: Props) {
  const total = documents.length;
  const aktif = documents.filter(d => d.status === 'Aktif').length;
  const dolmus = documents.filter(d => d.status === 'Süresi Dolmuş').length;
  const yaklasan = documents.filter(d => d.status === 'Yaklaşan').length;

  const stats = [
    { label: 'Toplam Evrak', value: total, icon: 'ri-file-text-line', color: '#60A5FA', bg: 'rgba(96,165,250,0.1)' },
    { label: 'Aktif', value: aktif, icon: 'ri-checkbox-circle-line', color: '#34D399', bg: 'rgba(52,211,153,0.1)' },
    { label: 'Süresi Dolmuş', value: dolmus, icon: 'ri-close-circle-line', color: '#F87171', bg: 'rgba(248,113,113,0.1)' },
    { label: 'Yaklaşan (≤30 gün)', value: yaklasan, icon: 'ri-time-line', color: '#FBBF24', bg: 'rgba(251,191,36,0.1)' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map(s => (
        <div key={s.label} className="isg-card rounded-xl p-4 flex items-center gap-4">
          <div className="w-11 h-11 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: s.bg }}>
            <i className={`${s.icon} text-xl`} style={{ color: s.color }} />
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
