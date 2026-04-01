interface BadgeProps {
  label: string;
  color?: 'green' | 'red' | 'amber' | 'sky' | 'gray' | 'purple' | 'orange' | 'teal' | 'pink';
  size?: 'sm' | 'md';
  dot?: boolean;
}

const colorMap: Record<string, { base: string; dot: string }> = {
  green:  { base: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',   dot: 'bg-emerald-400' },
  red:    { base: 'bg-red-500/10 text-red-400 border-red-500/20',               dot: 'bg-red-400' },
  amber:  { base: 'bg-amber-500/10 text-amber-400 border-amber-500/20',         dot: 'bg-amber-400' },
  sky:    { base: 'bg-sky-500/10 text-sky-400 border-sky-500/20',               dot: 'bg-sky-400' },
  gray:   { base: 'bg-slate-500/10 text-slate-400 border-slate-500/20',         dot: 'bg-slate-400' },
  purple: { base: 'bg-violet-500/10 text-violet-400 border-violet-500/20',      dot: 'bg-violet-400' },
  orange: { base: 'bg-orange-500/10 text-orange-400 border-orange-500/20',      dot: 'bg-orange-400' },
  teal:   { base: 'bg-teal-500/10 text-teal-400 border-teal-500/20',            dot: 'bg-teal-400' },
  pink:   { base: 'bg-pink-500/10 text-pink-400 border-pink-500/20',            dot: 'bg-pink-400' },
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

export default function Badge({ label, color = 'gray', size = 'md', dot = false }: BadgeProps) {
  const c = colorMap[color] ?? colorMap.gray;
  const sizeClass = size === 'sm'
    ? 'px-2 py-0.5 text-[10px] gap-1'
    : 'px-2.5 py-[3px] text-[11px] gap-1.5';

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold border whitespace-nowrap tracking-wide ${sizeClass} ${c.base}`}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
      )}
      {label}
    </span>
  );
}
