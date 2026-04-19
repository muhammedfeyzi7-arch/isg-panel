import type { EquipmentRow } from '@/services/specialistService';

interface Props {
  equipmentList: EquipmentRow[];
}

export default function EquipmentStatsCards({ equipmentList }: Props) {
  const total = equipmentList.length;
  const suitable = equipmentList.filter((e) => e.status === 'Uygun').length;
  const unsuitable = equipmentList.filter((e) => e.status === 'Uygun Değil').length;

  const today = new Date();
  const in30Days = new Date();
  in30Days.setDate(today.getDate() + 30);
  const upcoming = equipmentList.filter((e) => {
    if (!e.next_control_date) return false;
    const d = new Date(e.next_control_date);
    return d >= today && d <= in30Days;
  }).length;

  const cards = [
    {
      label: 'Toplam Ekipman',
      count: total,
      icon: 'ri-tools-line',
      color: '#6366F1',
      bg: '#EEF2FF',
    },
    {
      label: 'Uygun',
      count: suitable,
      icon: 'ri-checkbox-circle-line',
      color: '#16A34A',
      bg: '#DCFCE7',
    },
    {
      label: 'Uygun Değil',
      count: unsuitable,
      icon: 'ri-close-circle-line',
      color: '#DC2626',
      bg: '#FEE2E2',
    },
    {
      label: 'Kontrol Tarihi Yaklaşan',
      count: upcoming,
      icon: 'ri-alarm-warning-line',
      color: '#D97706',
      bg: '#FEF3C7',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-xl p-5 flex items-center gap-4"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div
            className="w-11 h-11 flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ backgroundColor: c.bg }}
          >
            <i className={`${c.icon} text-xl`} style={{ color: c.color }} />
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{c.count}</p>
            <p className="text-xs leading-tight mt-0.5" style={{ color: 'var(--text-muted)' }}>{c.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
