interface BadgeProps {
  label: string;
  color?: 'green' | 'red' | 'amber' | 'sky' | 'gray' | 'purple' | 'orange';
}

const colorMap: Record<string, string> = {
  green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  red: 'bg-red-500/15 text-red-400 border-red-500/30',
  amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  sky: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  gray: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  purple: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  orange: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
};

export function getFirmaStatusColor(s: string): BadgeProps['color'] {
  if (s === 'Aktif') return 'green';
  if (s === 'Pasif') return 'gray';
  return 'amber';
}

export function getTehlikeColor(s: string): BadgeProps['color'] {
  if (s === 'Az Tehlikeli') return 'green';
  if (s === 'Tehlikeli') return 'amber';
  return 'red';
}

export function getEvrakStatusColor(s: string): BadgeProps['color'] {
  if (s === 'Yüklü') return 'green';
  if (s === 'Eksik') return 'red';
  if (s === 'Süre Yaklaşıyor') return 'amber';
  return 'orange';
}

export function getPersonelStatusColor(s: string): BadgeProps['color'] {
  if (s === 'Aktif') return 'green';
  if (s === 'Pasif') return 'gray';
  return 'red';
}

export function getUygunsuzlukSeverityColor(s: string): BadgeProps['color'] {
  if (s === 'Düşük') return 'sky';
  if (s === 'Orta') return 'amber';
  if (s === 'Yüksek') return 'orange';
  return 'red';
}

export function getEgitimStatusColor(s: string): BadgeProps['color'] {
  if (s === 'Tamamlandı') return 'green';
  if (s === 'Planlandı') return 'sky';
  return 'gray';
}

export default function Badge({ label, color = 'gray' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${colorMap[color]}`}>
      {label}
    </span>
  );
}
